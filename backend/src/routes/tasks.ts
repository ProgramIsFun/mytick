import { Router, Response } from 'express';
import { taskRepo, groupRepo, userRepo, recurrenceExceptionRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, badRequest, parsePagination, extractViewerId } from '../utils/routeHelpers';
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
    const { tasks } = await taskRepo.findByUser(targetUserId, { groupIds, limit: 1000 });
    const filtered = tasks.filter(t => t.visibility === 'public' || (t.visibility === 'group' && t.groupIds?.some(g => groupIds.includes(g))));
    return res.json(filtered);
  }

  const { tasks } = await taskRepo.findByUser(targetUserId, { limit: 1000 });
  res.json(tasks.filter(t => t.visibility === 'public'));
}));

router.get('/u/:username/profile', asyncHandler(async (req, res: Response) => {
  const user = await userRepo.findByUsername(req.params.username as string);
  if (!user) return notFound(res, 'User not found');
  const { tasks: projects } = await taskRepo.findByUser(user.id, { type: 'project', limit: 1000 });
  const publicProjects = projects.filter(p => p.visibility === 'public');
  res.json({
    username: user.username,
    name: user.name,
    projects: publicProjects.map(p => ({
      _id: p.id, title: p.title, description: p.description, status: p.status,
      metadata: p.metadata, tags: p.tags, createdAt: p.createdAt,
    })),
  });
}));

router.get('/u/:username', asyncHandler(async (req, res: Response) => {
  const targetUser = await userRepo.findByUsername(req.params.username as string);
  if (!targetUser) return notFound(res, 'User not found');

  const viewerId = extractViewerId(req as AuthRequest);
  const targetUserId = targetUser.id;

  if (viewerId === targetUserId) {
    const { tasks } = await taskRepo.findByUser(targetUserId);
    return res.json(tasks);
  }

  if (viewerId) {
    const groupIds = await groupRepo.getUserGroupIds(viewerId);
    const { tasks } = await taskRepo.findByUser(targetUserId, { groupIds, limit: 1000 });
    const filtered = tasks.filter(t => t.visibility === 'public' || (t.visibility === 'group' && t.groupIds?.some(g => groupIds.includes(g))));
    return res.json(filtered);
  }

  const { tasks } = await taskRepo.findByUser(targetUserId, { limit: 1000 });
  res.json(tasks.filter(t => t.visibility === 'public'));
}));

router.use(auth);

router.get('/calendar', asyncHandler(async (req: AuthRequest, res: Response) => {
  const from = new Date(req.query.from as string);
  const to = new Date(req.query.to as string);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return badRequest(res, 'from and to query params required (ISO dates)');
  }

  const { tasks: allUserTasks } = await taskRepo.findByUser(req.userId!, { limit: 10000 });
  const oneTimeTasks = allUserTasks.filter(t => !t.recurrence && t.deadline && t.deadline >= from && t.deadline <= to);

  const results: any[] = oneTimeTasks.map(t => ({
    taskId: t.id, title: t.title, status: t.status, date: t.deadline, recurring: false,
  }));

  const recurringTasks = allUserTasks.filter(t => t.recurrence && t.deadline && t.deadline <= to);

  const recurringIds = recurringTasks.map(t => t.id);
  const exceptions = recurringIds.length
    ? await recurrenceExceptionRepo.findByTaskAndDateRange(recurringIds, from, to)
    : [];

  const exMap = new Map<string, typeof exceptions[0]>();
  for (const ex of exceptions) {
    exMap.set(`${ex.taskId}-${ex.date.toISOString()}`, ex);
  }

  for (const task of recurringTasks) {
    const occurrences = expandOccurrences(task as any, from, to);
    for (const date of occurrences) {
      const key = `${task.id}-${date.toISOString()}`;
      const ex = exMap.get(key);
      if (ex?.status === 'skipped') continue;
      results.push({
        taskId: task.id, title: ex?.title || task.title, description: ex?.description || task.description,
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

  const exception = await recurrenceExceptionRepo.upsert(req.params.id as string, new Date(date), update);
  res.json(exception);
}));

router.delete('/:id/occurrences', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date } = req.body;
  if (!date) return badRequest(res, 'date required');
  await recurrenceExceptionRepo.delete(req.params.id as string, new Date(date));
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

  await recurrenceExceptionRepo.deleteByTask(req.params.id as string, endDate);
  await scheduleDeadlineAlerts(notificationQueue, task.id, req.userId!, task.deadline || null, task.recurrence || null);

  res.json(task);
}));

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit } = parsePagination(req.query);
  const status = req.query.status as string;
  const excludeStatus = req.query.excludeStatus
    ? (req.query.excludeStatus as string).split(',').map(s => s.trim())
    : undefined;
  const type = req.query.type as string;
  const tag = req.query.tag as string;
  const q = req.query.q as string;

  const groupIds = await groupRepo.getUserGroupIds(req.userId!);

  const { tasks, total } = await taskRepo.findByUser(req.userId!, {
    status, excludeStatus, type, tag, q, groupIds, page, limit,
  });

  res.json({ tasks, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

router.get('/count', asyncHandler(async (req: AuthRequest, res: Response) => {
  const groupIds = await groupRepo.getUserGroupIds(req.userId!);
  const counts = await taskRepo.countByStatus(req.userId!, groupIds);
  res.json(counts);
}));

router.get('/roots', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit } = parsePagination(req.query);
  const status = req.query.status as string;
  const type = req.query.type as string;
  const tag = req.query.tag as string;

  const { tasks, total } = await taskRepo.findByUser(req.userId!, {
    status, type, tag, parentId: null, page, limit,
  });

  res.json({ tasks, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

router.get('/:id/blocking', asyncHandler(async (req: AuthRequest, res: Response) => {
  const tasks = await taskRepo.findBlockedBy(req.params.id as string);
  res.json(tasks);
}));

router.get('/:id/subtasks', asyncHandler(async (req: AuthRequest, res: Response) => {
  const tasks = await taskRepo.findSubtasks(req.params.id as string);
  res.json(tasks);
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskRepo.findById(req.params.id as string, req.userId);
  if (!task) return notFound(res);
  res.json({ ...task, _id: task.id });
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

  res.status(201).json({ ...task, _id: task.id });
}));

async function hasCycle(taskId: string, blockedBy: string[]): Promise<boolean> {
  const allTasks = await taskRepo.findAllBlockedBy();
  const graph = new Map<string, string[]>();
  for (const t of allTasks) {
    graph.set(t.id, t.blockedBy);
  }
  const { hasCycleInGraph } = await import('../utils/cycle');
  return hasCycleInGraph(taskId, blockedBy, graph);
}

router.patch('/:id', validate(updateTaskSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskRepo.findById(req.params.id as string, req.userId);
  if (!task) return notFound(res);

  if (req.body.status === 'done') {
    const subtasks = await taskRepo.findSubtasks(req.params.id as string);
    const incomplete = subtasks.filter(s => s.status !== 'done');
    if (incomplete.length > 0) {
      return res.status(400).json({
        error: 'Cannot mark as done. This task has incomplete subtasks.',
        incompleteSubtasks: incomplete.map(t => ({ id: t.id, title: t.title, status: t.status })),
      });
    }
    if (task.blockedBy?.length) {
      const blocking = await taskRepo.findBlockedBy(req.params.id as string);
      const incompleteBlocking = blocking.filter(b => b.status !== 'done');
      if (incompleteBlocking.length > 0) {
        return res.status(400).json({
          error: 'Cannot mark as done. This task is blocked by incomplete tasks.',
          blockingTasks: incompleteBlocking.map(t => ({ id: t.id, title: t.title, status: t.status })),
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
  res.json({ ...updated, _id: updated!.id });
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
  await recurrenceExceptionRepo.deleteByTask(req.params.id as string);
  res.json({ message: 'Deleted' });
}));

export default router;
