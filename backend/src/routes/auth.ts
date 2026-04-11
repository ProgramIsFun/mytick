import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = Router();

function signToken(userId: unknown) {
  return jwt.sign({ userId: String(userId) }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

function userResponse(user: any) {
  return { id: user._id, email: user.email, name: user.name };
}

// Local register
router.post('/register', async (req, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'All fields required' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
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
        // New user
        user = await User.create({
          email,
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
