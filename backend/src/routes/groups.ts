import { Router, Response } from 'express';
import Group from '../models/Group';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(auth);

// List my groups (owned + member of)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const User = (await import('../models/User')).default;
    const groups = await Group.find({
      $or: [{ ownerId: req.userId }, { 'members.userId': req.userId }],
    }).lean();

    // Resolve member usernames
    const userIds = [...new Set(groups.flatMap(g => g.members.map(m => m.userId.toString())))];
    const users = await User.find({ _id: { $in: userIds } }).select('_id username name').lean();
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), { username: u.username, name: u.name }]));

    const enriched = groups.map(g => ({
      ...g,
      members: g.members.map(m => ({
        ...m,
        username: userMap[m.userId.toString()]?.username,
        name: userMap[m.userId.toString()]?.name,
      })),
    }));

    res.json(enriched);
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
    const { userId, email, role } = req.body;
    if (!userId && !email) return res.status(400).json({ error: 'userId or email required' });

    let targetId = userId;
    if (!targetId) {
      const User = (await import('../models/User')).default;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ error: 'User not found' });
      targetId = user._id.toString();
    }

    const group = await Group.findOne({ _id: req.params.id, ownerId: req.userId });
    if (!group) return res.status(404).json({ error: 'Not found' });

    const already = group.members.some(m => m.userId.toString() === targetId);
    if (already) return res.status(409).json({ error: 'Already a member' });

    group.members.push({ userId: targetId, role: role || 'viewer' });
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
