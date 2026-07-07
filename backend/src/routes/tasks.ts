import { Router, Response } from 'express';
import Task from '../models/Task';
import RecurrenceException from '../models/RecurrenceException';
import { taskRepo, groupRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { applyUpdates, notFound, badRequest, parsePagination, getUserGroupIds, extractViewerId, findOwned } from '../utils/routeHelpers';
import { validate, createTaskSchema, updateTaskSchema } from '../utils/validation';
import { notificationQueue } from '../queues';
import { scheduleDeadlineAlerts } from '../queues/scheduleAlerts';
import { expandOccurrences } from '../utils/recurrence';

const router = Router();

router.get('/share/:shareToken', asyncHandler(async (req, res: Response) => {
  const task = await taskRepo.findByShareToken(req.params.shareToken as string);
  if (!task || task.visibility !== 'public') return notFound(res);
  res.json({ title: task.title, description: task.description, status: task.status });
}));

router.get('/user/:userId', asyncHandler(async (req, res: Response) => {
  const viewerId = extractViewerId(req as AuthRequest);
  const targetUserId = req.params.userId as string;

  if (viewerId === targetUserId) {
    const { tasks } = await taskRepo.findByUser(targetUserId);
    return res.json(tasks);
  }

  if (viewerId) {
    const groupIds = await groupRepo.getUserGroupIds(viewerId);
    // fallback to Mongoose for complex visibility queries
    const tasks = await Task.find({
      userId: targetUserId,
      $or: [
        { visibility: 'public' },
        { visibility: 'group', groupIds: { $in: groupIds } },
      ],
    }).sort({ createdAt: -1 });
    return res.json(tasks);
  }

  const tasks = await Task.find({ userId: targetUserId, visibility: 'public' }).sort({ createdAt: -1 });
  res.json(tasks);
}));

router.get('/u/:username/profile', asyncHandler(async (req, res: Response) => {
  const { default: User } = await import('../models/User');
  const user = await User.findOne({ username: req.params.username as string });
  if (!user) return notFound(res, 'User not found');
  const projects = await Task.find({ userId: user._id, visibility: 'public', type: 'project' }).sort({ pinned: -1, createdAt: -1 });
  res.json({
    username: user.username,
    name: user.name,
    projects: projects.map(p => ({
      _id: p._id, title: p.title, description: p.description, status: p.status,
      metadata: (p as any).metadata, tags: (p as any).tags, createdAt: p.createdAt,
    })),
  });
}));

router.get('/u/:username', asyncHandler(async (req, res: Response) => {
  const { default: User } = await import('../models/User');
  const targetUser = await User.findOne({ username: req.params.username as string });
  if (!targetUser) return notFound(res, 'User not found');

  const viewerId = extractViewerId(req as AuthRequest);
  const targetUserId = targetUser._id.toString();

  if (viewerId === targetUserId) {
    const { tasks } = await taskRepo.findByUser(targetUserId);
    return res.json(tasks);
  }

  if (viewerId) {
    const groupIds = await groupRepo.getUserGroupIds(viewerId);
    const tasks = await Task.find({
      userId: targetUserId,
      $or: [{ visibility: 'public' }, { visibility: 'group', groupIds: { $in: groupIds } }],
    }).sort({ createdAt: -1 });
    return res.json(tasks);
  }

  const tasks = await Task.find({ userId: targetUserId, visibility: 'public' }).sort({ createdAt: -1 });
  res.json(tasks);
}));

router.use(auth);

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
    _id: t._id, taskId: t._id, title: t.title, status: t.status, date: t.deadline, recurring: false,
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
        taskId: task._id, title: ex?.title || task.title, description: ex?.description || task.description,
        status: ex?.status || 'pending', date: ex?.newDate || date, recurring: true, recurrence: task.recurrence,
      });
    }
  }

  results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  res.json(results);
}));

router.post('/:id/occurrences', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskRepo.findById(req.params.id as string, req.userId);
  if (!task || !task.recurrence) return notFound(res, 'Recurring task not found');

  const { date, status, title, description, newDate } = req.body;
  if (!date) return badRequest(res, 'date (ISO) required');

  const update: any = {};
  if (status && ['pending', 'done', 'skipped'].includes(status)) update.status = status;
  if (title !== undefined) update.title = title || undefined;
  if (description !== undefined) update.description = description || undefined;
  if (newDate !== undefined) update.newDate = newDate ? new Date(newDate) : undefined;

  res.json(await RecurrenceException.findOneAndUpdate(
    { taskId: req.params.id, date: new Date(date) },
    update,
    { upsert: true, new: true },
  ));
}));

router.delete('/:id/occurrences', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date } = req.body;
  if (!date) return badRequest(res, 'date required');
  await RecurrenceException.deleteOne({ taskId: req.params.id, date: new Date(date) });
  res.json({ message: 'Exception removed' });
}));

router.post('/:id/end-series', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskRepo.findById(req.params.id as string, req.userId);
  if (!task || !task.recurrence) return notFound(res, 'Recurring task not found');

  const { date } = req.body;
  if (!date) return badRequest(res, 'date required');

  const endDate = new Date(date);
  task.recurrence!.until = new Date(endDate.getTime() - 1);
  await taskRepo.update(task.id, { recurrence: task.recurrence });

  await RecurrenceException.deleteMany({ taskId: req.params.id, date: { $gte: endDate } });
  await scheduleDeadlineAlerts(notificationQueue, task.id, req.userId!, task.deadline || null, task.recurrence || null);

  res.json(task);
}));

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit } = parsePagination(req.query);
  const status = req.query.status as string;
  const type = req.query.type as string;
  const tag = req.query.tag as string;
  const q = req.query.q as string;

  const groupIds = await groupRepo.getUserGroupIds(req.userId!);

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
    Task.find(filter).sort({ pinned: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Task.countDocuments(filter),
  ]);

  res.json({ tasks, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

router.get('/count', asyncHandler(async (req: AuthRequest, res: Response) => {
  const groupIds = await groupRepo.getUserGroupIds(req.userId!);

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

router.get('/roots', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit } = parsePagination(req.query);
  const status = req.query.status as string;
  const type = req.query.type as string;
  const tag = req.query.tag as string;

  const filter: any = { userId: req.userId, parentId: null };
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (tag) filter.tags = tag;

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ pinned: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Task.countDocuments(filter),
  ]);

  res.json({ tasks, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

router.get('/:id/blocking', asyncHandler(async (req: AuthRequest, res: Response) => {
  const tasks = await Task.find({ blockedBy: req.params.id as any, userId: req.userId })
    .select('_id title status')
    .sort({ createdAt: -1 });
  res.json(tasks);
}));

router.get('/:id/subtasks', asyncHandler(async (req: AuthRequest, res: Response) => {
  const tasks = await Task.find({ parentId: req.params.id, userId: req.userId })
    .sort({ pinned: -1, createdAt: -1 });
  res.json(tasks);
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const groupIds = await groupRepo.getUserGroupIds(req.userId!);

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

router.post('/', validate(createTaskSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, description, visibility, groupIds, blockedBy, deadline, recurrence, type, metadata, tags, pinned, parentId } = req.body;

  if (groupIds?.length) {
    for (const gid of groupIds) {
      const g = await groupRepo.findById(gid);
      if (!g) return res.status(404).json({ error: `Group ${gid} not found` });
      const member = g.members.find(m => m.userId === req.userId);
      if (!member || member.role !== 'editor') {
        return res.status(403).json({ error: `Not an editor in group ${g.name}` });
      }
    }
  }

  const task = await taskRepo.create({
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
  });

  if (task.deadline) {
  await scheduleDeadlineAlerts(notificationQueue, task.id, req.userId!, task.deadline || null, task.recurrence);
  }

  res.status(201).json(task);
}));

async function hasCycle(taskId: string, blockedBy: string[]): Promise<boolean> {
  const allTasks = await Task.find({ blockedBy: { $exists: true, $ne: [] } }).select('_id blockedBy').lean();
  const graph = new Map<string, string[]>();
  for (const t of allTasks) {
    graph.set(t._id.toString(), t.blockedBy.map(b => b.toString()));
  }
  const { hasCycleInGraph } = await import('../utils/cycle');
  return hasCycleInGraph(taskId, blockedBy, graph);
}

router.patch('/:id', validate(updateTaskSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskRepo.findById(req.params.id as string, req.userId);
  if (!task) return notFound(res);

  if (req.body.status === 'done') {
    const subtasks = await Task.find({ parentId: req.params.id, userId: req.userId, status: { $ne: 'done' } })
      .select('_id title status');
    if (subtasks.length > 0) {
      return res.status(400).json({
        error: 'Cannot mark as done. This task has incomplete subtasks.',
        incompleteSubtasks: subtasks.map(t => ({ id: t._id, title: t.title, status: t.status })),
      });
    }
    if (task.blockedBy?.length) {
      const incomplete = await Task.find({ _id: { $in: task.blockedBy }, status: { $ne: 'done' } })
        .select('_id title status');
      if (incomplete.length > 0) {
        return res.status(400).json({
          error: 'Cannot mark as done. This task is blocked by incomplete tasks.',
          blockingTasks: incomplete.map(t => ({ id: t._id, title: t.title, status: t.status })),
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
    await taskRepo.addDescriptionVersion(task.id, task.description || '');
  }

  await taskRepo.update(task.id, req.body);

  if (req.body.deadline !== undefined || req.body.status === 'done' || req.body.recurrence !== undefined) {
    const deadline = req.body.status === 'done' ? null : (req.body.deadline !== undefined ? req.body.deadline : task.deadline);
    await scheduleDeadlineAlerts(notificationQueue, task.id, req.userId!, deadline, req.body.recurrence !== undefined ? req.body.recurrence : task.recurrence);
  }

  const updated = await taskRepo.findById(task.id);
  res.json(updated);
}));

router.post('/:id/rollback/:index', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskRepo.findById(req.params.id as string, req.userId);
  if (!task) return notFound(res);

  const idx = parseInt(req.params.index as string);
  if (isNaN(idx) || idx < 0 || !task.descriptionHistory || idx >= task.descriptionHistory.length) {
    return badRequest(res, 'Invalid history index');
  }

  await taskRepo.rollbackDescription(task.id, idx);
  const updated = await taskRepo.findById(task.id);
  res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await taskRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  await notificationQueue.cancelByTask(req.params.id as string);
  await RecurrenceException.deleteMany({ taskId: req.params.id });
  res.json({ message: 'Deleted' });
}));

export default router;
