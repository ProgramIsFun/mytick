import { Router, Response } from 'express';
import { nanoid } from 'nanoid';
import Task from '../models/Task';
import Group from '../models/Group';
import RecurrenceException from '../models/RecurrenceException';
import { auth, AuthRequest } from '../middleware/auth';
import { validate, createTaskSchema, updateTaskSchema } from '../utils/validation';
import { notificationQueue } from '../queues';
import { scheduleDeadlineAlerts } from '../queues/scheduleAlerts';
import { expandOccurrences } from '../utils/recurrence';

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

// Calendar expansion endpoint
router.get('/calendar', async (req: AuthRequest, res: Response) => {
  try {
    const from = new Date(req.query.from as string);
    const to = new Date(req.query.to as string);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return res.status(400).json({ error: 'from and to query params required (ISO dates)' });
    }

    // Non-recurring tasks with deadline in range
    const oneTimeTasks = await Task.find({
      userId: req.userId,
      recurrence: null,
      deadline: { $gte: from, $lte: to },
    });

    const results: any[] = oneTimeTasks.map(t => ({
      _id: t._id,
      taskId: t._id,
      title: t.title,
      status: t.status,
      date: t.deadline,
      recurring: false,
    }));

    // Recurring tasks that started before range end
    const recurringTasks = await Task.find({
      userId: req.userId,
      recurrence: { $ne: null },
      deadline: { $lte: to },
    });

    const recurringIds = recurringTasks.map(t => t._id);
    const exceptions = recurringIds.length
      ? await RecurrenceException.find({ taskId: { $in: recurringIds }, date: { $gte: from, $lte: to } })
      : [];

    const exMap = new Map<string, typeof exceptions[0]>();
    for (const ex of exceptions) {
      exMap.set(`${ex.taskId}-${ex.date.toISOString()}`, ex);
    }

    for (const task of recurringTasks) {
      const occurrences = expandOccurrences(task, from, to);
      for (const date of occurrences) {
        const key = `${task._id}-${date.toISOString()}`;
        const ex = exMap.get(key);
        if (ex?.status === 'skipped') continue;
        results.push({
          taskId: task._id,
          title: ex?.title || task.title,
          description: ex?.description || task.description,
          status: ex?.status || 'pending',
          date: ex?.newDate || date,
          recurring: true,
          recurrence: task.recurrence,
        });
      }
    }

    results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create/update a single recurrence occurrence exception
router.post('/:id/occurrences', async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task || !task.recurrence) return res.status(404).json({ error: 'Recurring task not found' });

    const { date, status, title, description, newDate } = req.body;
    if (!date) return res.status(400).json({ error: 'date (ISO) required' });

    const update: any = {};
    if (status && ['pending', 'done', 'skipped'].includes(status)) update.status = status;
    if (title !== undefined) update.title = title || undefined;
    if (description !== undefined) update.description = description || undefined;
    if (newDate !== undefined) update.newDate = newDate ? new Date(newDate) : undefined;

    const exception = await RecurrenceException.findOneAndUpdate(
      { taskId: task._id, date: new Date(date) },
      update,
      { upsert: true, new: true },
    );
    res.json(exception);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove exception (revert occurrence to pending)
router.delete('/:id/occurrences', async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'date required' });
    await RecurrenceException.deleteOne({ taskId: req.params.id, date: new Date(date) });
    res.json({ message: 'Exception removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// End recurrence from a specific date ("this and all following")
router.post('/:id/end-series', async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task || !task.recurrence) return res.status(404).json({ error: 'Recurring task not found' });

    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'date required' });

    const endDate = new Date(date);
    // Set until to just before this occurrence
    task.recurrence.until = new Date(endDate.getTime() - 1);
    task.markModified('recurrence');

    // Clean up exceptions on or after this date
    await RecurrenceException.deleteMany({ taskId: task._id, date: { $gte: endDate } });
    await task.save();

    // Reschedule notifications
    await scheduleDeadlineAlerts(notificationQueue, task._id.toString(), req.userId!, task.deadline, task.recurrence);

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: List tasks (paginated)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, in_progress, done] } }
 *     responses:
 *       200: { description: Paginated task list }
 */
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

/**
 * @swagger
 * /tasks/count:
 *   get:
 *     summary: Get task counts by status
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Task counts, content: { application/json: { schema: { type: object, properties: { total: { type: integer }, pending: { type: integer }, in_progress: { type: integer }, done: { type: integer } } } } } }
 */
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

// Get root tasks (not in any other task's blockedBy)
router.get('/roots', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    const childIds = await Task.distinct('blockedBy', { userId: req.userId, blockedBy: { $ne: [] } });

    const filter: any = { userId: req.userId, _id: { $nin: childIds } };
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

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a task
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               visibility: { type: string, enum: [private, group, public] }
 *               deadline: { type: string, format: date-time, nullable: true }
 *               blockedBy: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Task created }
 *       400: { description: Validation error }
 */
router.post('/', validate(createTaskSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, visibility, groupIds, blockedBy, deadline, recurrence } = req.body;

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
      recurrence: recurrence || null,
      shareToken: nanoid(12),
    });

    if (task.deadline) {
      await scheduleDeadlineAlerts(notificationQueue, task._id.toString(), req.userId!, task.deadline, task.recurrence);
    }

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

/**
 * @swagger
 * /tasks/{id}:
 *   patch:
 *     summary: Update a task (owner only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               status: { type: string, enum: [pending, in_progress, done] }
 *               visibility: { type: string, enum: [private, group, public] }
 *               deadline: { type: string, format: date-time, nullable: true }
 *               blockedBy: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Task updated }
 *       400: { description: Cycle detected or validation error }
 *       404: { description: Not found }
 *   delete:
 *     summary: Delete a task (owner only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
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

    const allowed = ['title', 'description', 'status', 'visibility', 'groupIds', 'blockedBy', 'deadline', 'recurrence'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) (task as any)[key] = req.body[key];
    }
    await task.save();

    // Reschedule or cancel notifications on deadline/status/recurrence change
    if (req.body.deadline !== undefined || req.body.status === 'done' || req.body.recurrence !== undefined) {
      const deadline = task.status === 'done' ? null : task.deadline;
      await scheduleDeadlineAlerts(notificationQueue, task._id.toString(), req.userId!, deadline, task.recurrence);
    }

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
    await Task.updateMany({ blockedBy: task._id }, { $pull: { blockedBy: task._id } });
    await notificationQueue.cancelByTask(task._id.toString());
    await RecurrenceException.deleteMany({ taskId: task._id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
