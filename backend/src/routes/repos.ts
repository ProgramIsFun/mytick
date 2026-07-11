import { Router, Response } from 'express';
import { repoRepo, taskRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, forbidden } from '../utils/routeHelpers';
import { validate, createRepoSchema, addRepoToTaskSchema } from '../utils/validation';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /repos:
 *   get:
 *     tags: [Repos]
 *     summary: List repos for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of repos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Repo'
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const repos = await repoRepo.findByUser(req.userId!);
  res.json(repos);
}));

/**
 * @openapi
 * /repos/{id}:
 *   get:
 *     tags: [Repos]
 *     summary: Get a repo by ID
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
 *         description: Repo details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Repo'
 *       404:
 *         description: Repo not found
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const repo = await repoRepo.findById(req.params.id as string, req.userId);
  if (!repo) return notFound(res);
  res.json(repo);
}));

/**
 * @openapi
 * /repos:
 *   post:
 *     tags: [Repos]
 *     summary: Create a new repo
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Repo created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Repo'
 *       409:
 *         description: Repo already exists
 */
router.post('/', validate(createRepoSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await repoRepo.findByUrl(req.userId!, req.body.url);
  if (existing) return res.status(409).json({ error: 'Repo already exists' });
  const repo = await repoRepo.create({ userId: req.userId, url: req.body.url });
  res.status(201).json(repo);
}));

/**
 * @openapi
 * /repos/{id}:
 *   delete:
 *     tags: [Repos]
 *     summary: Delete a repo
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
 *       404:
 *         description: Repo not found
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await repoRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

/**
 * @openapi
 * /repos/{id}/tasks:
 *   get:
 *     tags: [Repos]
 *     summary: Get tasks linked to this repo
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
 *         description: List of tasks
 *       404:
 *         description: Repo not found
 */
router.get('/:id/tasks', asyncHandler(async (req: AuthRequest, res: Response) => {
  const repo = await repoRepo.findById(req.params.id as string, req.userId);
  if (!repo) return notFound(res);
  const tasks = await repoRepo.findTasksByRepo(req.params.id as string, req.userId!);
  res.json(tasks);
}));

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
 *       404:
 *         description: Task not found
 */

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

export default router;
