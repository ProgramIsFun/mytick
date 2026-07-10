import { Router, Response } from 'express';
import { contextRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound } from '../utils/routeHelpers';
import { validate, upsertContextSchema } from '../utils/validation';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /context:
 *   get:
 *     tags: [Context]
 *     summary: List all context key-value entries for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of context entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Context'
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await contextRepo.findByUser(req.userId!));
}));

/**
 * @openapi
 * /context/{key}:
 *   get:
 *     tags: [Context]
 *     summary: Get a context entry by key
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Context entry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Context'
 *       404:
 *         description: Key not found
 */
router.get('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await contextRepo.findByKey(req.userId!, req.params.key as string);
  if (!entry) return notFound(res);
  res.json(entry);
}));

/**
 * @openapi
 * /context/{key}:
 *   put:
 *     tags: [Context]
 *     summary: Create or update a context entry
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Context entry upserted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Context'
 */
router.put('/:key', validate(upsertContextSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { value } = req.body;
  const entry = await contextRepo.upsert(req.userId!, req.params.key as string, value);
  res.json(entry);
}));

/**
 * @openapi
 * /context/{key}:
 *   delete:
 *     tags: [Context]
 *     summary: Delete a context entry
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
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
 *         description: Key not found
 */
router.delete('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await contextRepo.delete(req.userId!, req.params.key as string);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
