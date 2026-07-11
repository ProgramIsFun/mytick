import { Router, Response } from 'express';
import { taskRepo, groupRepo, userRepo, recurrenceExceptionRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, badRequest, parsePagination, extractViewerId } from '../utils/routeHelpers';
import { validate, createTaskSchema, updateTaskSchema, addRepoToTaskSchema } from '../utils/validation';
import { notificationQueue } from '../queues';
import { scheduleDeadlineAlerts } from '../queues/scheduleAlerts';
import { expandOccurrences } from '../utils/recurrence';

const router = Router();

/**
 * @openapi
 * /tasks/share/{shareToken}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a public task by share token
 *     parameters:
 *       - in: path
 *         name: shareToken
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public task info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                 description:
 *                   type: string
 *                 status:
 *                   type: string
 *       404:
 *         description: Task not found or not public
 */
router.get('/share/:shareToken', asyncHandler(async (req, res: Response) => {
  const task = await taskRepo.findByShareToken(req.params.shareToken as string);
  if (!task || task.visibility !== 'public') return notFound(res);
  res.json({ title: task.title, description: task.description, status: task.status });
}));

/**
 * @openapi
 * /tasks/user/{userId}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get tasks by user ID (respects visibility)
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 */
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

/**
 * @openapi
 * /tasks/u/{username}/profile:
 *   get:
 *     tags: [Tasks]
 *     summary: Get public profile and projects for a user
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile with public projects
 *       404:
 *         description: User not found
 */
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

/**
 * @openapi
 * /tasks/u/{username}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get tasks by username (respects visibility)
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 *       404:
 *         description: User not found
 */
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

/**
 * @openapi
 * /tasks/calendar:
 *   get:
 *     tags: [Tasks]
 *     summary: Get calendar view with recurring task expansion
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Calendar entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   taskId:
 *                     type: string
 *                   title:
 *                     type: string
 *                   status:
 *                     type: string
 *                   date:
 *                     type: string
 *                     format: date-time
 *                   recurring:
 *                     type: boolean
 *                   recurrence:
 *                     type: object
 */
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

/**
 * @openapi
 * /tasks/{id}/occurrences:
 *   post:
 *     tags: [Tasks]
 *     summary: Create or update an exception for a recurring task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [pending, done, skipped]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               newDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Exception upserted
 *       404:
 *         description: Recurring task not found
 */
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

/**
 * @openapi
 * /tasks/{id}/occurrences:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a recurrence exception
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Exception removed
 */
router.delete('/:id/occurrences', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { date } = req.body;
  if (!date) return badRequest(res, 'date required');
  await recurrenceExceptionRepo.delete(req.params.id as string, new Date(date));
  res.json({ message: 'Exception removed' });
}));

/**
 * @openapi
 * /tasks/{id}/end-series:
 *   post:
 *     tags: [Tasks]
 *     summary: End a recurring task series at a given date
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       404:
 *         description: Recurring task not found
 */
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

/**
 * @openapi
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in_progress, on_hold, done, abandoned]
 *       - in: query
 *         name: excludeStatus
 *         schema:
 *           type: string
 *         description: Comma-separated statuses to exclude
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [task, project]
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Paginated tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
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

/**
 * @openapi
 * /tasks/count:
 *   get:
 *     tags: [Tasks]
 *     summary: Get task counts by status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Task counts per status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 */
router.get('/count', asyncHandler(async (req: AuthRequest, res: Response) => {
  const groupIds = await groupRepo.getUserGroupIds(req.userId!);
  const counts = await taskRepo.countByStatus(req.userId!, groupIds);
  res.json(counts);
}));

/**
 * @openapi
 * /tasks/roots:
 *   get:
 *     tags: [Tasks]
 *     summary: List root tasks (no parent)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated root tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
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

/**
 * @openapi
 * /tasks/{id}/blocking:
 *   get:
 *     tags: [Tasks]
 *     summary: Get tasks that block this task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Blocking tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 */
router.get('/:id/blocking', asyncHandler(async (req: AuthRequest, res: Response) => {
  const tasks = await taskRepo.findBlocking(req.params.id as string);
  res.json(tasks);
}));

/**
 * @openapi
 * /tasks/{id}/subtasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Get subtasks of a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subtasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Task'
 */
router.get('/:id/subtasks', asyncHandler(async (req: AuthRequest, res: Response) => {
  const tasks = await taskRepo.findSubtasks(req.params.id as string);
  res.json(tasks);
}));

/**
 * @openapi
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get a task by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       404:
 *         description: Task not found
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskRepo.findById(req.params.id as string, req.userId);
  if (!task) return notFound(res);
  res.json(task);
}));

/**
 * @openapi
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a new task
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskCreate'
 *     responses:
 *       201:
 *         description: Task created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 */
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
  const allTasks = await taskRepo.findAllBlockedBy();
  const graph = new Map<string, string[]>();
  for (const t of allTasks) {
    graph.set(t.id, t.blockedBy);
  }
  const { hasCycleInGraph } = await import('../utils/cycle');
  return hasCycleInGraph(taskId, blockedBy, graph);
}

/**
 * @openapi
 * /tasks/{id}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TaskUpdate'
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Cannot mark done (incomplete subtasks/blockers) or circular dependency
 *       404:
 *         description: Task not found
 */
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
  res.json(updated);
}));

/**
 * @openapi
 * /tasks/{id}/rollback/{index}:
 *   post:
 *     tags: [Tasks]
 *     summary: Rollback task description to a previous version
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: index
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Task'
 *       400:
 *         description: Invalid history index
 *       404:
 *         description: Task not found
 */
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

/**
 * @openapi
 * /tasks/{id}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Task not found
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await taskRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  await notificationQueue.cancelByTask(req.params.id as string);
  await recurrenceExceptionRepo.deleteByTask(req.params.id as string);
  res.json({ message: 'Deleted' });
}));

// ─── Task-Repo Relationships ────────────────────────────────────────────────

/**
 * @openapi
 * /tasks/{id}/repos:
 *   get:
 *     tags: [Tasks]
 *     summary: Get repos linked to this task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of repo IDs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *       404:
 *         description: Task not found
 */
router.get('/:id/repos', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskRepo.findById(req.params.id as string);
  if (!task) return notFound(res);
  const { repoRepo } = await import('../repositories');
  const repoIds = await repoRepo.getRepoIdsByTask(req.params.id as string);
  res.json(repoIds);
}));

/**
 * @openapi
 * /tasks/{id}/repos:
 *   post:
 *     tags: [Tasks]
 *     summary: Link a repo to a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [repoId]
 *             properties:
 *               repoId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Repo linked to task
 *       404:
 *         description: Task or repo not found
 */
router.post('/:id/repos', validate(addRepoToTaskSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskRepo.findById(req.params.id as string);
  if (!task) return notFound(res);
  const { repoRepo } = await import('../repositories');
  const repo = await repoRepo.findById(req.body.repoId);
  if (!repo) return notFound(res, 'Repo not found');
  await repoRepo.addRepoToTask(req.params.id as string, req.body.repoId);
  res.json({ message: 'Repo linked to task' });
}));

/**
 * @openapi
 * /tasks/{id}/repos/{repoId}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Unlink a repo from a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: repoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Repo unlinked
 *       404:
 *         description: Relationship not found
 */
router.delete('/:id/repos/:repoId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const task = await taskRepo.findById(req.params.id as string);
  if (!task) return notFound(res);
  const { repoRepo } = await import('../repositories');
  await repoRepo.removeRepoFromTask(req.params.id as string, req.params.repoId as string);
  res.json({ message: 'Repo unlinked from task' });
}));

export default router;
