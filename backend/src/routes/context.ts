import { Router, Response } from 'express';
import { contextRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, badRequest } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await contextRepo.findByUser(req.userId!));
}));

router.get('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await contextRepo.findByKey(req.userId!, req.params.key as string);
  if (!entry) return notFound(res);
  res.json(entry);
}));

router.put('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { value } = req.body;
  if (value === undefined) return badRequest(res, 'value required');
  const entry = await contextRepo.upsert(req.userId!, req.params.key as string, value);
  res.json(entry);
}));

router.delete('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await contextRepo.delete(req.userId!, req.params.key as string);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
