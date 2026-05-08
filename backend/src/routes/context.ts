import { Router, Response } from 'express';
import Context from '../models/Context';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(await Context.find({ userId: req.userId }).sort({ key: 1 }));
}));

router.get('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await Context.findOne({ userId: req.userId, key: req.params.key });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json(entry);
}));

router.put('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value required' });
  const entry = await Context.findOneAndUpdate(
    { userId: req.userId, key: req.params.key },
    { value },
    { upsert: true, new: true },
  );
  res.json(entry);
}));

router.delete('/:key', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entry = await Context.findOneAndDelete({ userId: req.userId, key: req.params.key });
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}));

export default router;
