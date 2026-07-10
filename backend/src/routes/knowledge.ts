import { Router, Response } from 'express';
import { knowledgeRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate, createKnowledgeSchema, updateKnowledgeSchema } from '../utils/validation';
import { notFound } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /knowledge:
 *   get:
 *     tags: [Knowledge]
 *     summary: List knowledge entries for the authenticated user
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
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Paginated knowledge entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Knowledge'
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
  const { page, limit } = req.query;
  const q = req.query.q as string;
  const result = await knowledgeRepo.findByUser(req.userId!, {
    search: q, page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
  });
  res.json({ items: result.items, total: result.total, page: result.items.length ? parseInt(page as string) || 1 : 1, limit: parseInt(limit as string) || 20, totalPages: Math.ceil(result.total / (parseInt(limit as string) || 20)) });
}));

/**
 * @openapi
 * /knowledge/{id}:
 *   get:
 *     tags: [Knowledge]
 *     summary: Get a knowledge entry by ID
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
 *         description: Knowledge entry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Knowledge'
 *       404:
 *         description: Entry not found
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await knowledgeRepo.findById(req.params.id as string, req.userId);
  if (!entry) return notFound(res);
  res.json(entry);
}));

/**
 * @openapi
 * /knowledge:
 *   post:
 *     tags: [Knowledge]
 *     summary: Create a knowledge entry
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       201:
 *         description: Knowledge entry created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Knowledge'
 */
router.post('/', validate(createKnowledgeSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await knowledgeRepo.create({ userId: req.userId, content: req.body.content });
  res.status(201).json(entry);
}));

/**
 * @openapi
 * /knowledge/{id}:
 *   patch:
 *     tags: [Knowledge]
 *     summary: Update a knowledge entry
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
 *               content:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Updated knowledge entry
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Knowledge'
 *       404:
 *         description: Entry not found
 */
router.patch('/:id', validate(updateKnowledgeSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await knowledgeRepo.update(req.params.id as string, { content: req.body.content });
  if (!entry) return notFound(res);
  res.json(entry);
}));

/**
 * @openapi
 * /knowledge/{id}:
 *   delete:
 *     tags: [Knowledge]
 *     summary: Delete a knowledge entry
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
 *         description: Entry not found
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await knowledgeRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
