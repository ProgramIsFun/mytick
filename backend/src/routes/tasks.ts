import { Router, Response } from 'express';
import { nanoid } from 'nanoid';
import Task from '../models/Task';
import Group from '../models/Group';
import RecurrenceException from '../models/RecurrenceException';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { applyUpdates, notFound, badRequest, parsePagination, getUserGroupIds, extractViewerId, findOwned, getUserModel } from '../utils/routeHelpers';
import { validate, createTaskSchema, updateTaskSchema } from '../utils/validation';
import { notificationQueue } from '../queues';
import { scheduleDeadlineAlerts } from '../queues/scheduleAlerts';
import { expandOccurrences } from '../utils/recurrence';

const router = Router();

// Public: view shared task (no auth)
router.get('/share/:shareToken', asyncHandler(async (req, res: Response) => {
  const task = await Task.findOne({ shareToken: req.params.shareToken });
  if (!task || task.visibility !== 'public') return notFound(res);
  res.json({ title: task.title, description: task.description, status: task.status });
}));

// Public: list public tasks of a user (no auth)
router.get('/user/:userId', asyncHandler(async (req, res: Response) => {
  const viewerId = extractViewerId(req as AuthRequest);
  const targetUserId = req.params.userId as string;

  if (viewerId === targetUserId) {
    return res.json(await Task.find({ userId: targetUserId }).sort({ createdAt: -1 }));
  }

  if (viewerId) {
    const groupIds = await getUserGroupIds(viewerId);
    return res.json(await Task.find({
      userId: targetUserId,
      $or: [
        { visibility: 'public' },
        { visibility: 'group', groupIds: { $in: groupIds } },
      ],
    }).sort({ createdAt: -1 }));
  }

  res.json(await Task.find({ userId: targetUserId, visibility: 'public' }).sort({ createdAt: -1 }));
}));

// Public: list tasks by username
// Public: user profile with public projects
router.get('/u/:username/profile', asyncHandler(async (req, res: Response) => {
  const User = await getUserModel();
  const user = await User.findOne({ username: req.params.username as string });
  if (!user) return notFound(res, 'User not found');
  const projects = await Task.find({ userId: user._id, visibility: 'public', type: 'project' }).sort({ pinned: -1, createdAt: -1 });
  res.json({
    username: user.username,
    name: user.name,
    projects: projects.map(p => ({ _id: p._id, title: p.title, description: p.description, status: p.status, metadata: (p as any).metadata, tags: (p as any).tags, createdAt: p.createdAt })),
  });
}));

router.get('/u/:username', asyncHandler(async (req, res: Response) => {
  const User = await getUserModel();
  const targetUser = await User.findOne({ username: req.params.username as string });
  if (!targetUser) return notFound(res, 'User not found');

  const viewerId = extractViewerId(req as AuthRequest);
  const targetUserId = targetUser._id.toString();

  if (viewerId === targetUserId) {
    return res.json(await Task.find({ userId: targetUserId }).sort({ createdAt: -1 }));
  }

  if (viewerId) {
    const groupIds = await getUserGroupIds(viewerId);
    return res.json(await Task.find({
      userId: targetUserId,
      $or: [{ visibility: 'public' }, { visibility: 'group', groupIds: { $in: groupIds } }],
    }).sort({ createdAt: -1 }));
  }

  res.json(await Task.find({ userId: targetUserId, visibility: 'public' }).sort({ createdAt: -1 }));
}));

// All routes below require auth
router.use(auth);

// Calendar expansion endpoint
router.get('/calendar', asyncHandler(async (req: AuthRequest, res: Response) => {
  const from = new Date(req.query.from as string);
  const to = new Date(req.query.to as string);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return badRequest(res, 'from and to query params required (ISO dates)');
  }

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
}));

// Create/update a single recurrence occurrence exception
router.post('/:id/occurrences', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await findOwned(Task, req);
  if (!task || !task.recurrence) return notFound(res, 'Recurring task not found');

  const { date, status, title, description, newDate } = req.body;
  if (!date) return badRequest(res, 'date (ISO) required');

  const update: any = {};
  if (status && ['pending', 'done', 'skipped'].includes(status)) update.status = status;
  if (title !== undefined) update.title = title || undefined;
  if (description !== undefined) update.description = description || undefined;
  if (newDate !== undefined) update.newDate = newDate ? new Date(newDate) : undefined;

  res.json(await RecurrenceException.findOneAndUpdate(
    { taskId: task._id, date: new Date(date) },
    update,
    { upsert: true, new: true },
  ));
}));

// Remove exception (revert occurrence to pending)
router.delete('/:id/occurrences', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date } = req.body;
  if (!date) return badRequest(res, 'date required');
  await RecurrenceException.deleteOne({ taskId: req.params.id, date: new Date(date) });
  res.json({ message: 'Exception removed' });
}));

// End recurrence from a specific date ("this and all following")
router.post('/:id/end-series', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await findOwned(Task, req);
  if (!task || !task.recurrence) return notFound(res, 'Recurring task not found');

  const { date } = req.body;
  if (!date) return badRequest(res, 'date required');

  const endDate = new Date(date);
  task.recurrence.until = new Date(endDate.getTime() - 1);
  task.markModified('recurrence');

  await RecurrenceException.deleteMany({ taskId: task._id, date: { $gte: endDate } });
  await task.save();

  await scheduleDeadlineAlerts(notificationQueue, task._id.toString(), req.userId!, task.deadline, task.recurrence);

  res.json(task);
}));

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
 *       - { in: query, name: status, schema: { type: string, enum: [pending, in_progress, on_hold, done, abandoned] } }
 *     responses:
 *       200: { description: Paginated task list }
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const status = req.query.status as string;
  const type = req.query.type as string;
  const tag = req.query.tag as string;
  const q = req.query.q as string;

  const groupIds = await getUserGroupIds(req.userId!);

  const filter: any = {
    $or: [
      { userId: req.userId },
      { visibility: 'group', groupIds: { $in: groupIds } },
    ],
  };
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (tag) filter.tags = tag;
  if (q) filter.title = { $regex: q, $options: 'i' };

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ pinned: -1, createdAt: -1 }).skip(skip).limit(limit),
    Task.countDocuments(filter),
  ]);

  res.json({ tasks, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

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
router.get('/count', asyncHandler(async (req: AuthRequest, res: Response) => {
  const groupIds = await getUserGroupIds(req.userId!);

  const baseFilter = {
    $or: [
      { userId: req.userId },
      { visibility: 'group', groupIds: { $in: groupIds } },
    ],
  };

  const [total, pending, in_progress, on_hold, done, abandoned] = await Promise.all([
    Task.countDocuments(baseFilter),
    Task.countDocuments({ ...baseFilter, status: 'pending' }),
    Task.countDocuments({ ...baseFilter, status: 'in_progress' }),
    Task.countDocuments({ ...baseFilter, status: 'on_hold' }),
    Task.countDocuments({ ...baseFilter, status: 'done' }),
    Task.countDocuments({ ...baseFilter, status: 'abandoned' }),
  ]);

  res.json({ total, pending, in_progress, on_hold, done, abandoned });
}));

// Get root tasks (no parent)
router.get('/roots', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const status = req.query.status as string;
  const type = req.query.type as string;
  const tag = req.query.tag as string;

  const filter: any = { userId: req.userId, parentId: null };
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (tag) filter.tags = tag;

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ pinned: -1, createdAt: -1 }).skip(skip).limit(limit),
    Task.countDocuments(filter),
  ]);

  res.json({ tasks, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

// Get tasks that are blocked by a specific task
router.get('/:id/blocking', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await Task.find({ blockedBy: req.params.id as any, userId: req.userId })
    .select('_id title status')
    .sort({ createdAt: -1 }));
}));

// Get subtasks of a task
router.get('/:id/subtasks', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await Task.find({ parentId: req.params.id, userId: req.userId })
    .sort({ pinned: -1, createdAt: -1 }));
}));

// Get single task by ID
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const groupIds = await getUserGroupIds(req.userId!);

  const task = await Task.findOne({
    _id: req.params.id,
    $or: [
      { userId: req.userId },
      { visibility: 'group', groupIds: { $in: groupIds } },
    ],
  });
  if (!task) return notFound(res);
  res.json(task);
}));

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
router.post('/', validate(createTaskSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, description, visibility, groupIds, blockedBy, deadline, recurrence, type, metadata, tags, pinned, parentId } = req.body;

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
    type: type || 'task',
    visibility: visibility || 'private',
    groupIds: groupIds || [],
    blockedBy: blockedBy || [],
    parentId: parentId || null,
    deadline: deadline || null,
    recurrence: recurrence || null,
    metadata: metadata || null,
    tags: tags || [],
    pinned: pinned || false,
    shareToken: nanoid(12),
  });

  if (task.deadline) {
    await scheduleDeadlineAlerts(notificationQueue, task._id.toString(), req.userId!, task.deadline, task.recurrence);
  }

  res.status(201).json(task);
}));

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
 *               status: { type: string, enum: [pending, in_progress, on_hold, done, abandoned] }
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
router.patch('/:id', validate(updateTaskSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await findOwned(Task, req);
  if (!task) return notFound(res);

  if (req.body.status === 'done') {
    const incompleteSubtasks = await Task.find({ 
      parentId: req.params.id, 
      userId: req.userId,
      status: { $ne: 'done' } 
    }).select('_id title status');
    
    if (incompleteSubtasks.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot mark as done. This task has incomplete subtasks.',
        incompleteSubtasks: incompleteSubtasks.map(t => ({ id: t._id, title: t.title, status: t.status }))
      });
    }

    if (task.blockedBy && task.blockedBy.length > 0) {
      const incompleteBlockingTasks = await Task.find({ 
        _id: { $in: task.blockedBy }, 
        status: { $ne: 'done' } 
      }).select('_id title status');
      
      if (incompleteBlockingTasks.length > 0) {
        return res.status(400).json({ 
          error: 'Cannot mark as done. This task is blocked by incomplete tasks.',
          blockingTasks: incompleteBlockingTasks.map(t => ({ id: t._id, title: t.title, status: t.status }))
        });
      }
    }
  }

  if (req.body.blockedBy?.length) {
    if (req.body.blockedBy.includes(req.params.id)) {
      return badRequest(res, 'A task cannot block itself');
    }
    if (await hasCycle(req.params.id as string, req.body.blockedBy)) {
      return badRequest(res, 'Circular dependency detected');
    }
  }

  if (req.body.description !== undefined && req.body.description !== task.description) {
    task.descriptionHistory.push({ description: task.description, savedAt: new Date() });
  }

  applyUpdates(task, req.body, ['title', 'description', 'status', 'visibility', 'groupIds', 'blockedBy', 'parentId', 'deadline', 'recurrence', 'type', 'metadata', 'tags', 'pinned']);
  await task.save();

  if (req.body.deadline !== undefined || req.body.status === 'done' || req.body.recurrence !== undefined) {
    const deadline = task.status === 'done' ? null : task.deadline;
    await scheduleDeadlineAlerts(notificationQueue, task._id.toString(), req.userId!, deadline, task.recurrence);
  }

  res.json(task);
}));

// Rollback description to a history version (owner only)
router.post('/:id/rollback/:index', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await findOwned(Task, req);
  if (!task) return notFound(res);

  const idx = parseInt(req.params.index as string);
  if (isNaN(idx) || idx < 0 || idx >= task.descriptionHistory.length) {
    return badRequest(res, 'Invalid history index');
  }

  task.descriptionHistory.push({ description: task.description, savedAt: new Date() });
  task.description = task.descriptionHistory[idx].description;
  await task.save();

  res.json(task);
}));

// Delete task (owner only)
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!task) return notFound(res);
  await Task.updateMany({ blockedBy: task._id }, { $pull: { blockedBy: task._id } });
  await notificationQueue.cancelByTask(task._id.toString());
  await RecurrenceException.deleteMany({ taskId: task._id });
  res.json({ message: 'Deleted' });
}));

export default router;
