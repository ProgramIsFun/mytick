import { Router, Response } from 'express';
import Account from '../models/Account';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

// List accounts
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const filter: any = { userId: req.userId };
    const tag = req.query.tag as string;
    const q = req.query.q as string;
    if (tag) filter.tags = tag;
    if (q) filter.name = { $regex: q, $options: 'i' };
    const accounts = await Account.find(filter).sort({ createdAt: -1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get account by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
    if (!account) return res.status(404).json({ error: 'Not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create account
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, provider, url, username, notes, tags, credentials } = req.body;
    if (!name || !provider) return res.status(400).json({ error: 'name and provider required' });
    const account = await Account.create({
      userId: req.userId, name, provider,
      url: url || '', username: username || '', notes: notes || '',
      tags: tags || [], credentials: credentials || [],
    });
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update account
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
    if (!account) return res.status(404).json({ error: 'Not found' });
    const allowed = ['name', 'provider', 'url', 'username', 'notes', 'tags', 'credentials'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) (account as any)[key] = req.body[key];
    }
    await account.save();
    res.json(account);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete account
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const account = await Account.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!account) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
