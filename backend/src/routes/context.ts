import { Router, Response } from 'express';
import Context from '../models/Context';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, badRequest } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await Context.find({ userId: req.userId }).sort({ key: 1 }));
}));

router.get('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await Context.findOne({ userId: req.userId, key: req.params.key });
  if (!entry) return notFound(res);
  res.json(entry);
}));

router.put('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { value } = req.body;
  if (value === undefined) return badRequest(res, 'value required');
  const entry = await Context.findOneAndUpdate(
    { userId: req.userId, key: req.params.key },
    { value },
    { upsert: true, new: true },
  );
  res.json(entry);
}));

router.delete('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await Context.findOneAndDelete({ userId: req.userId, key: req.params.key });
  if (!entry) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
