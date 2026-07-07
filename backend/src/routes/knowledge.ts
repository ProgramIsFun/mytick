import { Router, Response } from 'express';
import { knowledgeRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate, createKnowledgeSchema, updateKnowledgeSchema } from '../utils/validation';
import { notFound } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit } = req.query;
  const q = req.query.q as string;
  const result = await knowledgeRepo.findByUser(req.userId!, {
    search: q, page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
  });
  res.json({ items: result.items, total: result.total, page: result.items.length ? parseInt(page as string) || 1 : 1, limit: parseInt(limit as string) || 20, totalPages: Math.ceil(result.total / (parseInt(limit as string) || 20)) });
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await knowledgeRepo.findById(req.params.id as string, req.userId);
  if (!entry) return notFound(res);
  res.json(entry);
}));

router.post('/', validate(createKnowledgeSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await knowledgeRepo.create({ userId: req.userId, content: req.body.content });
  res.status(201).json(entry);
}));

router.patch('/:id', validate(updateKnowledgeSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await knowledgeRepo.update(req.params.id as string, { content: req.body.content });
  if (!entry) return notFound(res);
  res.json(entry);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await knowledgeRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
