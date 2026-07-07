import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepo } from '../repositories';
import { auth, AuthRequest, requireAdminKey } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate, registerSchema, loginSchema, oauthSchema, updateProfileSchema } from '../utils/validation';
import { notFound, badRequest } from '../utils/routeHelpers';
import { BCRYPT_ROUNDS, JWT_EXPIRY, SERVICE_TOKEN_EXPIRY, RESERVED_USERNAMES } from '../config/constants';

const router = Router();

function signToken(userId: unknown) {
  return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET!, { expiresIn: JWT_EXPIRY });
}

function userResponse(user: { id: string; email?: string; username: string; name: string }) {
  return { id: user.id, email: user.email, username: user.username, name: user.name };
}

router.post('/register', validate(registerSchema), asyncHandler(async (req, res: Response) => {
  const { email, password, name, username } = req.body;

  const exists = await userRepo.findByEmail(email);
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  if (RESERVED_USERNAMES.includes(username.toLowerCase())) return badRequest(res, 'Username is reserved');

  const usernameTaken = await userRepo.findByUsername(username);
  if (usernameTaken) return res.status(409).json({ error: 'Username already taken' });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await userRepo.create({
    email,
    username: username.toLowerCase(),
    name,
    providers: [{ type: 'local', providerId: email, passwordHash }],
  });

  res.status(201).json({ token: signToken(user.id), user: userResponse(user) });
}));

router.post('/login', validate(loginSchema), asyncHandler(async (req, res: Response) => {
  const { email, password } = req.body;

  const user = await userRepo.findByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const localProvider = user.providers.find(p => p.type === 'local');
  if (!localProvider?.passwordHash) return res.status(401).json({ error: 'No local login. Use OAuth.' });

  const valid = await bcrypt.compare(password, localProvider.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  res.json({ token: signToken(user.id), user: userResponse(user) });
}));

router.post('/oauth', validate(oauthSchema), asyncHandler(async (req, res: Response) => {
  const { provider, providerId, email, name } = req.body;

  let user = await userRepo.findByIdentity(provider, providerId);

  if (!user) {
    if (email) user = await userRepo.findByEmail(email);
    if (user) {
      await userRepo.addProvider(user.id, { type: provider, providerId });
    } else {
      const base = (email ? email.split('@')[0] : name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'user';
      let username = base;
      let i = 1;
      while (await userRepo.findByUsername(username)) { username = `${base}-${i++}`; }
      user = await userRepo.create({
        email: email || undefined,
        username,
        name: name || email || username,
        providers: [{ type: provider, providerId }],
      });
    }
  }

  res.json({ token: signToken(user.id), user: userResponse(user) });
}));

router.get('/me', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await userRepo.findById(req.userId!);
  if (!user) return notFound(res, 'User not found');
  res.json(userResponse(user));
}));

router.patch('/me', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await userRepo.findById(req.userId!);
  if (!user) return notFound(res, 'User not found');

  const updates: any = {};

  if (req.body.username !== undefined) {
    const u = req.body.username.toLowerCase();
    if (RESERVED_USERNAMES.includes(u)) return badRequest(res, 'Username is reserved');
    const taken = await userRepo.findByUsername(u);
    if (taken && taken.id !== user.id) return res.status(409).json({ error: 'Username already taken' });
    updates.username = u;
  }
  if (req.body.name !== undefined) updates.name = req.body.name;

  if (req.body.newPassword !== undefined) {
    if (req.body.newPassword.length < 6) return badRequest(res, 'Password must be at least 6 characters');
    if (!user.email) return badRequest(res, 'Email required to set a password. Update your email first.');
    const hash = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS);
    const existingProvider = user.providers.find(p => p.type === 'local');
    if (existingProvider) {
      await userRepo.addProvider(user.id, { type: 'local', providerId: user.email, passwordHash: hash });
    } else {
      await userRepo.addProvider(user.id, { type: 'local', providerId: user.email, passwordHash: hash });
    }
  }

  if (req.body.email !== undefined) {
    const taken = await userRepo.findByEmail(req.body.email);
    if (taken && taken.id !== user.id) return res.status(409).json({ error: 'Email already taken' });
    updates.email = req.body.email;
  }

  if (Object.keys(updates).length) {
    await userRepo.update(user.id, updates);
  }
  const updated = await userRepo.findById(user.id);
  res.json(userResponse(updated!));
}));

router.post('/fcm-token', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { fcmToken, provider, device } = req.body;
  if (!fcmToken) return badRequest(res, 'fcmToken required');
  await userRepo.addPushToken(req.userId!, {
    token: fcmToken,
    provider: provider || 'fcm',
    device: device || req.headers['user-agent'] || '',
    registeredAt: new Date(),
  });
  res.json({ message: 'Token registered' });
}));

router.delete('/fcm-token', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { fcmToken } = req.body;
  if (!fcmToken) return badRequest(res, 'fcmToken required');
  await userRepo.removePushToken(req.userId!, fcmToken);
  res.json({ message: 'Token removed' });
}));

router.get('/fcm-tokens', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const tokens = await userRepo.getPushTokens(req.userId!);
  res.json({ tokens });
}));

router.post('/test-push', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await userRepo.findById(req.userId!);
  const allTokens = [
    ...(user?.pushTokens?.filter(t => t.provider === 'fcm').map(t => t.token) || []),
    ...(user?.fcmTokens || []),
  ].filter((t, i, a) => a.indexOf(t) === i);
  if (!allTokens.length) return badRequest(res, 'No push tokens registered');
  const { sendPush } = await import('../services/fcm');
  const { tokenIndex } = req.body || {};
  const tokens = tokenIndex !== undefined ? [allTokens[tokenIndex]].filter(Boolean) : allTokens;
  if (!tokens.length) return badRequest(res, 'Invalid token index');
  await sendPush(tokens, 'Test Notification', 'Push notifications are working!', {});
  res.json({ message: 'Sent', tokens: tokens.length });
}));

router.get('/users', asyncHandler(async (req, res: Response) => {
  if (!requireAdminKey(req, res)) return;
  const { default: User } = await import('../models/User');
  const users = await User.find().select('_id email username name');
  res.json(users.map((u: any) => userResponse({ id: u._id, email: u.email, username: u.username, name: u.name })));
}));

router.get('/lookup', asyncHandler(async (req, res: Response) => {
  if (!requireAdminKey(req, res)) return;
  const email = req.query.email as string;
  if (!email) return badRequest(res, 'Email required');
  const user = await userRepo.findByEmail(email);
  if (!user) return notFound(res, 'User not found');
  res.json(userResponse(user));
}));

router.post('/service-token', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await userRepo.findById(req.userId!);
  if (!user) return notFound(res, 'User not found');

  const { service, expiresIn = SERVICE_TOKEN_EXPIRY } = req.body;
  if (!service) return badRequest(res, 'service field required');

  const serviceToken = jwt.sign(
    { userId: String(user.id), service },
    process.env.JWT_SECRET!,
    { expiresIn }
  );

  res.json({ token: serviceToken, service, userId: user.id, expiresIn });
}));

export default router;
