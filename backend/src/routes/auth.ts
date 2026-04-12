import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = Router();

function signToken(userId: unknown) {
  return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

function userResponse(user: any) {
  return { id: user._id, email: user.email, username: user.username, name: user.name };
}

// Local register
router.post('/register', async (req, res: Response) => {
  try {
    const { email, password, name, username } = req.body;
    if (!email || !password || !name || !username) return res.status(400).json({ error: 'All fields required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const RESERVED = ['admin', 'api', 'login', 'register', 'settings', 'profile', 'share', 'tasks', 'groups', 'public', 'about', 'help', 'support'];
    if (RESERVED.includes(username.toLowerCase())) return res.status(400).json({ error: 'Username is reserved' });

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
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Local login
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const localProvider = user.providers.find(p => p.type === 'local');
    if (!localProvider?.passwordHash) return res.status(401).json({ error: 'No local login. Use OAuth.' });

    const valid = await bcrypt.compare(password, localProvider.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: signToken(user._id), user: userResponse(user) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// OAuth callback (Google, GitHub, etc.)
router.post('/oauth', async (req, res: Response) => {
  try {
    const { provider, providerId, email, name } = req.body;
    if (!provider || !providerId || !email) return res.status(400).json({ error: 'Missing fields' });

    // Check if this OAuth account is already linked
    let user = await User.findOne({ 'providers.type': provider, 'providers.providerId': providerId });

    if (!user) {
      // Check if email exists — link the provider
      user = await User.findOne({ email });
      if (user) {
        user.providers.push({ type: provider, providerId });
        await user.save();
      } else {
        // New user — generate username from email prefix
        let base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
        let username = base || 'user';
        let i = 1;
        while (await User.findOne({ username })) { username = `${base}-${i++}`; }
        user = await User.create({
          email,
          username,
          name: name || email,
          providers: [{ type: provider, providerId }],
        });
      }
    }

    res.json({ token: signToken(user._id), user: userResponse(user) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user profile
router.get('/me', async (req, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(userResponse(user));
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Lookup user by email (admin only)
router.get('/lookup', async (req, res: Response) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const email = req.query.email as string;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(userResponse(user));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
