import { Router, Response } from 'express';
import Knowledge from '../models/Knowledge';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate, createKnowledgeSchema, updateKnowledgeSchema } from '../utils/validation';
import { applyUpdates, notFound, parsePagination, findOwned } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter: any = { userId: req.userId };
  const tag = req.query.tag as string;
  const q = req.query.q as string;

  if (tag) filter.tags = tag;
  if (q) {
    filter.$text = { $search: q };
  }

  const [items, total] = await Promise.all([
    Knowledge.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Knowledge.countDocuments(filter),
  ]);

  res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await findOwned(Knowledge, req);
  if (!entry) return notFound(res);
  res.json(entry);
}));

router.post('/', validate(createKnowledgeSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await Knowledge.create({ userId: req.userId, ...req.body });
  res.status(201).json(entry);
}));

router.patch('/:id', validate(updateKnowledgeSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await findOwned(Knowledge, req);
  if (!entry) return notFound(res);
  applyUpdates(entry, req.body, ['title', 'content', 'tags', 'source', 'metadata']);
  await entry.save();
  res.json(entry);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await Knowledge.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!entry) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
