import { Router, Response } from 'express';
import { nanoid } from 'nanoid';
import Task from '../models/Task';
import Group from '../models/Group';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// Public: view shared task (no auth)
router.get('/share/:shareToken', async (req, res: Response) => {
  try {
    const task = await Task.findOne({ shareToken: req.params.shareToken });
    if (!task || task.visibility !== 'public') return res.status(404).json({ error: 'Not found' });
    res.json({ title: task.title, description: task.description, status: task.status });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// All routes below require auth
router.use(auth);

// List my tasks + tasks shared to my groups
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userGroups = await Group.find({ 'members.userId': req.userId }).select('_id');
    const groupIds = userGroups.map(g => g._id);

    const tasks = await Task.find({
      $or: [
        { userId: req.userId },
        { visibility: 'group', groupIds: { $in: groupIds } },
      ],
    }).sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single task by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userGroups = await Group.find({ 'members.userId': req.userId }).select('_id');
    const groupIds = userGroups.map(g => g._id);

    const task = await Task.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.userId },
        { visibility: 'group', groupIds: { $in: groupIds } },
      ],
    });
    if (!task) return res.status(404).json({ error: 'Not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create task
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, visibility, groupIds } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const task = await Task.create({
      userId: req.userId,
      title,
      description: description || '',
      visibility: visibility || 'private',
      groupIds: groupIds || [],
      shareToken: nanoid(12),
    });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update task (owner only)
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Not found' });

    if (req.body.description !== undefined && req.body.description !== task.description) {
      task.descriptionHistory.push({ description: task.description, savedAt: new Date() });
    }

    const allowed = ['title', 'description', 'status', 'visibility', 'groupIds'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) (task as any)[key] = req.body[key];
    }
    await task.save();

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Rollback description to a history version (owner only)
router.post('/:id/rollback/:index', async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Not found' });

    const idx = parseInt(req.params.index as string);
    if (isNaN(idx) || idx < 0 || idx >= task.descriptionHistory.length) {
      return res.status(400).json({ error: 'Invalid history index' });
    }

    // Save current description before rolling back
    task.descriptionHistory.push({ description: task.description, savedAt: new Date() });
    task.description = task.descriptionHistory[idx].description;
    await task.save();

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete task (owner only)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
