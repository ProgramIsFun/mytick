import { Router, Response } from 'express';
import Context from '../models/Context';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

// Get all context entries
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const entries = await Context.find({ userId: req.userId }).sort({ key: 1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get by key
router.get('/:key', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await Context.findOne({ userId: req.userId, key: req.params.key });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Set (upsert)
router.put('/:key', async (req: AuthRequest, res: Response) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'value required' });
    const entry = await Context.findOneAndUpdate(
      { userId: req.userId, key: req.params.key },
      { value },
      { upsert: true, new: true },
    );
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete
router.delete('/:key', async (req: AuthRequest, res: Response) => {
  try {
    const entry = await Context.findOneAndDelete({ userId: req.userId, key: req.params.key });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
