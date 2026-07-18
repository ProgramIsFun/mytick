import { Router, Response } from 'express';
import { envFileRepo, envVarRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound } from '../utils/routeHelpers';
import { validate, createEnvFileSchema, updateEnvFileSchema, createEnvVarSchema, updateEnvVarSchema } from '../utils/validation';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /env-files:
 *   get:
 *     tags: [EnvFiles]
 *     summary: List all env files for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of env files
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EnvFile'
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const files = await envFileRepo.findByUser(req.userId!);
  res.json(files);
}));

/**
 * @openapi
 * /env-files/{id}:
 *   get:
 *     tags: [EnvFiles]
 *     summary: Get an env file by ID
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
 *         description: Env file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvFile'
 *       404:
 *         description: Not found
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = await envFileRepo.findById(req.params.id as string, req.userId);
  if (!file) return notFound(res);
  res.json(file);
}));

/**
 * @openapi
 * /env-files:
 *   post:
 *     tags: [EnvFiles]
 *     summary: Create a new env file
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EnvFileCreate'
 *     responses:
 *       201:
 *         description: Created env file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvFile'
 *       400:
 *         description: Validation error
 */
router.post('/', validate(createEnvFileSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = await envFileRepo.create({ repoId: req.body.repoId, path: req.body.path });
  res.status(201).json(file);
}));

/**
 * @openapi
 * /env-files/{id}:
 *   patch:
 *     tags: [EnvFiles]
 *     summary: Update an env file
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
 *             $ref: '#/components/schemas/EnvFileUpdate'
 *     responses:
 *       200:
 *         description: Updated env file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvFile'
 *       404:
 *         description: Not found
 */
router.patch('/:id', validate(updateEnvFileSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = await envFileRepo.update(req.params.id as string, req.body);
  if (!file) return notFound(res);
  res.json(file);
}));

/**
 * @openapi
 * /env-files/{id}:
 *   delete:
 *     tags: [EnvFiles]
 *     summary: Delete an env file and its env vars
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
 *         description: Not found
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await envFileRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

/**
 * @openapi
 * /env-files/{id}/vars:
 *   get:
 *     tags: [EnvFiles]
 *     summary: List env vars for an env file
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
 *         description: List of env vars
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EnvVar'
 *       404:
 *         description: Env file not found
 */
router.get('/:id/vars', asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = await envFileRepo.findById(req.params.id as string, req.userId);
  if (!file) return notFound(res);
  const vars = await envVarRepo.findByEnvFile(req.params.id as string, req.userId!);
  res.json(vars);
}));

/**
 * @openapi
 * /env-files/{id}/vars:
 *   post:
 *     tags: [EnvFiles]
 *     summary: Create an env var in an env file
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
 *             $ref: '#/components/schemas/EnvVarCreate'
 *     responses:
 *       201:
 *         description: Created env var
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvVar'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Env file not found
 */
router.post('/:id/vars', validate(createEnvVarSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = await envFileRepo.findById(req.params.id as string, req.userId);
  if (!file) return notFound(res);
  const envVar = await envVarRepo.create({
    envFileId: req.params.id as string,
    key: req.body.key,
    value: req.body.value,
    isSecret: req.body.isSecret || false,
    secretId: req.body.secretId || null,
    comment: req.body.comment,
    order: req.body.order ?? 0,
  });
  res.status(201).json(envVar);
}));

/**
 * @openapi
 * /env-files/{envFileId}/vars/{varId}:
 *   patch:
 *     tags: [EnvFiles]
 *     summary: Update an env var
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: envFileId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: varId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EnvVarUpdate'
 *     responses:
 *       200:
 *         description: Updated env var
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EnvVar'
 *       404:
 *         description: Not found
 */
router.patch('/:envFileId/vars/:varId', validate(updateEnvVarSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = await envFileRepo.findById(req.params.envFileId as string, req.userId);
  if (!file) return notFound(res);
  const envVar = await envVarRepo.update(req.params.varId as string, req.body);
  if (!envVar) return notFound(res);
  res.json(envVar);
}));

/**
 * @openapi
 * /env-files/{envFileId}/vars/{varId}:
 *   delete:
 *     tags: [EnvFiles]
 *     summary: Delete an env var
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: envFileId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: varId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
router.delete('/:envFileId/vars/:varId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = await envFileRepo.findById(req.params.envFileId as string, req.userId);
  if (!file) return notFound(res);
  const deleted = await envVarRepo.delete(req.params.varId as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
