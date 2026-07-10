import { Router, Response } from 'express';
import { secretRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound } from '../utils/routeHelpers';
import { validate, createSecretSchema, updateSecretSchema } from '../utils/validation';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /secrets:
 *   get:
 *     tags: [Secrets]
 *     summary: List secrets for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [bitwarden, bitwarden_sm, aws_secrets, 1password, vault, lastpass, custom, client_encrypted]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [connection_string, password, api_key, token, certificate, ssh_key, other]
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of secrets
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Secret'
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { search, provider, type, tag } = req.query;
  const secrets = await secretRepo.findByUser(req.userId!, {
    search: search as string,
    provider: provider as string,
    type: type as string,
    tag: tag as string,
  });
  res.json(secrets);
}));

/**
 * @openapi
 * /secrets/{id}:
 *   get:
 *     tags: [Secrets]
 *     summary: Get a secret by ID
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
 *         description: Secret details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Secret'
 *       404:
 *         description: Secret not found
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await secretRepo.findById(req.params.id as string, req.userId);
  if (!secret) return notFound(res);
  res.json(secret);
}));

/**
 * @openapi
 * /secrets:
 *   post:
 *     tags: [Secrets]
 *     summary: Create a new secret
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, provider, providerSecretId, type]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               provider:
 *                 type: string
 *                 enum: [bitwarden, bitwarden_sm, aws_secrets, 1password, vault, lastpass, custom, client_encrypted]
 *               providerSecretId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [connection_string, password, api_key, token, certificate, ssh_key, other]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Secret created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Secret'
 */
router.post('/', validate(createSecretSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, description, provider, providerSecretId, type, tags, expiresAt } = req.body;
  const secret = await secretRepo.create({
    userId: req.userId, name, description: description || '',
    provider, providerSecretId, type, tags: tags || [], expiresAt: expiresAt || null,
  });
  res.status(201).json(secret);
}));

/**
 * @openapi
 * /secrets/{id}:
 *   patch:
 *     tags: [Secrets]
 *     summary: Update a secret
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
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               provider:
 *                 type: string
 *               type:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Updated secret
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Secret'
 *       404:
 *         description: Secret not found
 */
router.patch('/:id', validate(updateSecretSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await secretRepo.update(req.params.id as string, req.body);
  if (!secret) return notFound(res);
  res.json(secret);
}));

/**
 * @openapi
 * /secrets/{id}:
 *   delete:
 *     tags: [Secrets]
 *     summary: Delete a secret (fails if in use)
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
 *       400:
 *         description: Secret is in use
 *       404:
 *         description: Secret not found
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await secretRepo.findById(req.params.id as string, req.userId);
  if (!secret) return notFound(res);

  const { usedBy } = await secretRepo.findUsage(req.params.id as string, req.userId!);
  if (usedBy.length) {
    return res.status(400).json({ error: 'Secret is in use', usedBy });
  }

  await secretRepo.delete(req.params.id as string, req.userId!);
  res.json({ message: 'Deleted' });
}));

/**
 * @openapi
 * /secrets/{id}/touch:
 *   post:
 *     tags: [Secrets]
 *     summary: Update the lastAccessedAt timestamp of a secret
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
 *         description: Updated secret
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Secret'
 *       404:
 *         description: Secret not found
 */
router.post('/:id/touch', asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await secretRepo.touch(req.params.id as string, req.userId!);
  if (!secret) return notFound(res);
  res.json(secret);
}));

export default router;
