import { Router, Response } from 'express';
import { nanoid } from 'nanoid';
import Task from '../models/Task';
import Group from '../models/Group';
import { auth, AuthRequest } from '../middleware/auth';
import { validate, createTaskSchema, updateTaskSchema } from '../utils/validation';

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

// Public: list public tasks of a user (no auth)
router.get('/user/:userId', async (req, res: Response) => {
  try {
    // Check if caller is authenticated
    const token = req.headers.authorization?.split(' ')[1];
    let viewerId: string | null = null;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        viewerId = decoded.userId;
      } catch {}
    }

    const targetUserId = req.params.userId as string;

    // Owner sees all their tasks
    if (viewerId === targetUserId) {
      const tasks = await Task.find({ userId: targetUserId }).sort({ createdAt: -1 });
      return res.json(tasks);
    }

    // Logged-in user sees public + group-shared tasks
    if (viewerId) {
      const userGroups = await Group.find({ 'members.userId': viewerId }).select('_id');
      const groupIds = userGroups.map(g => g._id);
      const tasks = await Task.find({
        userId: targetUserId,
        $or: [
          { visibility: 'public' },
          { visibility: 'group', groupIds: { $in: groupIds } },
        ],
      }).sort({ createdAt: -1 });
      return res.json(tasks);
    }

    // Not logged in — public only
    const tasks = await Task.find({ userId: targetUserId, visibility: 'public' }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: list tasks by username
router.get('/u/:username', async (req, res: Response) => {
  try {
    const User = (await import('../models/User')).default;
    const targetUser = await User.findOne({ username: req.params.username as string });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const token = req.headers.authorization?.split(' ')[1];
    let viewerId: string | null = null;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        viewerId = decoded.userId;
      } catch {}
    }

    const targetUserId = targetUser._id.toString();

    if (viewerId === targetUserId) {
      const tasks = await Task.find({ userId: targetUserId }).sort({ createdAt: -1 });
      return res.json(tasks);
    }

    if (viewerId) {
      const userGroups = await Group.find({ 'members.userId': viewerId }).select('_id');
      const groupIds = userGroups.map(g => g._id);
      const tasks = await Task.find({
        userId: targetUserId,
        $or: [{ visibility: 'public' }, { visibility: 'group', groupIds: { $in: groupIds } }],
      }).sort({ createdAt: -1 });
      return res.json(tasks);
    }

    const tasks = await Task.find({ userId: targetUserId, visibility: 'public' }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// All routes below require auth
router.use(auth);

// List my tasks + tasks shared to my groups
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const userGroups = await Group.find({ 'members.userId': req.userId }).select('_id');
    const groupIds = userGroups.map(g => g._id);

    const filter: any = {
      $or: [
        { userId: req.userId },
        { visibility: 'group', groupIds: { $in: groupIds } },
      ],
    };
    if (status) filter.status = status;

    const [tasks, total] = await Promise.all([
      Task.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Task.countDocuments(filter),
    ]);

    res.json({ tasks, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Count tasks by status
router.get('/count', async (req: AuthRequest, res: Response) => {
  try {
    const userGroups = await Group.find({ 'members.userId': req.userId }).select('_id');
    const groupIds = userGroups.map(g => g._id);

    const baseFilter = {
      $or: [
        { userId: req.userId },
        { visibility: 'group', groupIds: { $in: groupIds } },
      ],
    };

    const [total, pending, in_progress, done] = await Promise.all([
      Task.countDocuments(baseFilter),
      Task.countDocuments({ ...baseFilter, status: 'pending' }),
      Task.countDocuments({ ...baseFilter, status: 'in_progress' }),
      Task.countDocuments({ ...baseFilter, status: 'done' }),
    ]);

    res.json({ total, pending, in_progress, done });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get tasks that are blocked by a specific task
router.get('/:id/blocking', async (req: AuthRequest, res: Response) => {
  try {
    const tasks = await Task.find({ blockedBy: req.params.id as any, userId: req.userId })
      .select('_id title status')
      .sort({ createdAt: -1 });
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
router.post('/', validate(createTaskSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, visibility, groupIds, blockedBy, deadline } = req.body;

    // Verify user is editor in all assigned groups
    if (groupIds?.length) {
      const groups = await Group.find({ _id: { $in: groupIds } });
      for (const g of groups) {
        const member = g.members.find(m => m.userId.toString() === req.userId);
        if (!member || member.role !== 'editor') {
          return res.status(403).json({ error: `Not an editor in group ${g.name}` });
        }
      }
    }

    const task = await Task.create({
      userId: req.userId,
      title,
      description: description || '',
      visibility: visibility || 'private',
      groupIds: groupIds || [],
      blockedBy: blockedBy || [],
      deadline: deadline || null,
      shareToken: nanoid(12),
    });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Detect cycles in blockedBy
async function hasCycle(taskId: string, blockedBy: string[]): Promise<boolean> {
  const allTasks = await Task.find({ blockedBy: { $exists: true, $ne: [] } }).select('_id blockedBy').lean();
  const graph = new Map<string, string[]>();
  for (const t of allTasks) {
    graph.set(t._id.toString(), t.blockedBy.map(b => b.toString()));
  }
  const { hasCycleInGraph } = await import('../utils/cycle');
  return hasCycleInGraph(taskId, blockedBy, graph);
}

// Update task (owner only)
router.patch('/:id', validate(updateTaskSchema), async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Not found' });

    if (req.body.blockedBy?.length) {
      if (req.body.blockedBy.includes(req.params.id)) {
        return res.status(400).json({ error: 'A task cannot block itself' });
      }
      if (await hasCycle(req.params.id as string, req.body.blockedBy)) {
        return res.status(400).json({ error: 'Circular dependency detected' });
      }
    }

    if (req.body.description !== undefined && req.body.description !== task.description) {
      task.descriptionHistory.push({ description: task.description, savedAt: new Date() });
    }

    const allowed = ['title', 'description', 'status', 'visibility', 'groupIds', 'blockedBy', 'deadline'];
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
