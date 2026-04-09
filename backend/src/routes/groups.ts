import { Router, Response } from 'express';
import Group from '../models/Group';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

// List my groups (owned + member of)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const groups = await Group.find({
      $or: [{ ownerId: req.userId }, { 'members.userId': req.userId }],
    });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create group
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const group = await Group.create({
      name,
      ownerId: req.userId,
      members: [{ userId: req.userId, role: 'editor' }],
    });

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add member (owner only)
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const group = await Group.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!group) return res.status(404).json({ error: 'Not found' });

    const already = group.members.some(m => m.userId.toString() === userId);
    if (already) return res.status(409).json({ error: 'Already a member' });

    group.members.push({ userId, role: role || 'viewer' });
    await group.save();

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove member (owner only)
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!group) return res.status(404).json({ error: 'Not found' });

    group.members = group.members.filter(m => m.userId.toString() !== req.params.userId) as any;
    await group.save();

    res.json(group);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete group (owner only)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const group = await Group.findOneAndDelete({ _id: req.params.id, ownerId: req.userId });
    if (!group) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
