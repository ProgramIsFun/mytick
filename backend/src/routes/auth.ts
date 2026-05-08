import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate, registerSchema, loginSchema, oauthSchema, updateProfileSchema } from '../utils/validation';

const router = Router();

function signToken(userId: unknown) {
  return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

function userResponse(user: any) {
  return { id: user._id, email: user.email, username: user.username, name: user.name };
}

const RESERVED_USERNAMES = ['admin', 'api', 'login', 'register', 'settings', 'profile', 'share', 'tasks', 'groups', 'public', 'about', 'help', 'support'];

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, username]
 *             properties:
 *               email: { type: string }
 *               password: { type: string, minLength: 6 }
 *               name: { type: string }
 *               username: { type: string }
 *     responses:
 *       201: { description: User created }
 *       400: { description: Validation error }
 *       409: { description: Email or username taken }
 */
router.post('/register', validate(registerSchema), asyncHandler(async (req, res: Response) => {
  const { email, password, name, username } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  if (RESERVED_USERNAMES.includes(username.toLowerCase())) return res.status(400).json({ error: 'Username is reserved' });

  const usernameTaken = await User.findOne({ username: username.toLowerCase() });
  if (usernameTaken) return res.status(409).json({ error: 'Username already taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email,
    username: username.toLowerCase(),
    name,
    providers: [{ type: 'local', providerId: email, passwordHash }],
  });

  res.status(201).json({ token: signToken(user._id), user: userResponse(user) });
}));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post('/login', validate(loginSchema), asyncHandler(async (req, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const localProvider = user.providers.find(p => p.type === 'local');
  if (!localProvider?.passwordHash) return res.status(401).json({ error: 'No local login. Use OAuth.' });

  const valid = await bcrypt.compare(password, localProvider.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  res.json({ token: signToken(user._id), user: userResponse(user) });
}));

// OAuth callback (Google, GitHub, etc.)
router.post('/oauth', validate(oauthSchema), asyncHandler(async (req, res: Response) => {
  const { provider, providerId, email, name } = req.body;

  let user = await User.findOne({ 'providers.type': provider, 'providers.providerId': providerId });

  if (!user) {
    if (email) user = await User.findOne({ email });
    if (user) {
      user.providers.push({ type: provider, providerId });
      await user.save();
    } else {
      const base = (email ? email.split('@')[0] : name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
      let username = base;
      let i = 1;
      while (await User.findOne({ username })) { username = `${base}-${i++}`; }
      user = await User.create({
        email: email || undefined,
        username,
        name: name || email || username,
        providers: [{ type: provider, providerId }],
      });
    }
  }

  res.json({ token: signToken(user._id), user: userResponse(user) });
}));

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: User profile, content: { application/json: { schema: { $ref: '#/components/schemas/User' } } } }
 *       401: { description: Unauthorized }
 */
router.get('/me', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(userResponse(user));
}));

// Update profile
router.patch('/me', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.body.username !== undefined) {
    const u = req.body.username.toLowerCase();
    if (RESERVED_USERNAMES.includes(u)) return res.status(400).json({ error: 'Username is reserved' });
    const taken = await User.findOne({ username: u, _id: { $ne: user._id } });
    if (taken) return res.status(409).json({ error: 'Username already taken' });
    user.username = u;
  }
  if (req.body.name !== undefined) user.name = req.body.name;

  if (req.body.newPassword !== undefined) {
    if (req.body.newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!user.email) return res.status(400).json({ error: 'Email required to set a password. Update your email first.' });
    const localProvider = user.providers.find(p => p.type === 'local');
    const hash = await bcrypt.hash(req.body.newPassword, 10);
    if (localProvider) {
      localProvider.passwordHash = hash;
    } else {
      user.providers.push({ type: 'local', providerId: user.email, passwordHash: hash });
    }
  }

  if (req.body.email !== undefined) {
    const taken = await User.findOne({ email: req.body.email, _id: { $ne: user._id } });
    if (taken) return res.status(409).json({ error: 'Email already taken' });
    user.email = req.body.email;
  }

  await user.save();
  res.json(userResponse(user));
}));

// Register/update FCM device token
router.post('/fcm-token', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { fcmToken, provider, device } = req.body;
  if (!fcmToken) return res.status(400).json({ error: 'fcmToken required' });
  const pushProvider = provider || 'fcm';
  const pushDevice = device || req.headers['user-agent'] || '';
  await User.updateOne({ _id: req.userId }, {
    $addToSet: { fcmTokens: fcmToken },
  });
  await User.updateOne(
    { _id: req.userId, 'pushTokens.token': { $ne: fcmToken } },
    { $push: { pushTokens: { token: fcmToken, provider: pushProvider, device: pushDevice, registeredAt: new Date() } } }
  );
  res.json({ message: 'Token registered' });
}));

// Remove FCM device token (logout)
router.delete('/fcm-token', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { fcmToken } = req.body;
  if (!fcmToken) return res.status(400).json({ error: 'fcmToken required' });
  await User.updateOne({ _id: req.userId }, {
    $pull: { fcmTokens: fcmToken, pushTokens: { token: fcmToken } },
  });
  res.json({ message: 'Token removed' });
}));

// Get my push tokens
router.get('/fcm-tokens', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId).select('pushTokens fcmTokens');
  const pushTokens = user?.pushTokens?.length ? user.pushTokens : (user?.fcmTokens || []).map(t => ({ token: t, provider: 'fcm', device: '', registeredAt: null }));
  res.json({ tokens: pushTokens });
}));

// Test push notification
router.post('/test-push', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId);
  const allTokens = [
    ...(user?.pushTokens?.filter(t => t.provider === 'fcm').map(t => t.token) || []),
    ...(user?.fcmTokens || []),
  ].filter((t, i, a) => a.indexOf(t) === i);
  if (!allTokens.length) return res.status(400).json({ error: 'No push tokens registered' });
  const { sendPush } = await import('../services/fcm');
  const { tokenIndex } = req.body || {};
  const tokens = tokenIndex !== undefined ? [allTokens[tokenIndex]].filter(Boolean) : allTokens;
  if (!tokens.length) return res.status(400).json({ error: 'Invalid token index' });
  await sendPush(tokens, '🔔 Test Notification', 'Push notifications are working!', {});
  res.json({ message: 'Sent', tokens: tokens.length });
}));

// List all users (admin only)
router.get('/users', asyncHandler(async (req, res: Response) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const users = await User.find().select('_id email username name');
  res.json(users.map(u => ({ id: u._id, email: u.email, username: u.username, name: u.name })));
}));

// Lookup user by email (admin only)
router.get('/lookup', asyncHandler(async (req, res: Response) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(userResponse(user));
}));

/**
 * @swagger
 * /auth/service-token:
 *   post:
 *     summary: Generate a service token for external services (Lambda, etc.)
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service]
 *             properties:
 *               service: { type: string, description: 'Service identifier (e.g., nexus-backup)' }
 *               expiresIn: { type: string, description: 'Token expiration (default: 90d)', default: '90d' }
 *     responses:
 *       200: { description: Service token generated }
 *       401: { description: Unauthorized }
 */
router.post('/service-token', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { service, expiresIn = '90d' } = req.body;
  if (!service) return res.status(400).json({ error: 'service field required' });

  const serviceToken = jwt.sign(
    { userId: String(user._id), service },
    process.env.JWT_SECRET!,
    { expiresIn }
  );

  res.json({
    token: serviceToken,
    service,
    userId: user._id,
    expiresIn
  });
}));

export default router;
