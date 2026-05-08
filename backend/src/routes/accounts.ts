import { Router, Response } from 'express';
import Account from '../models/Account';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { applyUpdates } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filter: any = { userId: req.userId };
  const tag = req.query.tag as string;
  const q = req.query.q as string;
  if (tag) filter.tags = tag;
  if (q) filter.name = { $regex: q, $options: 'i' };
  res.json(await Account.find(filter).sort({ createdAt: -1 }));
}));

router.get('/:id/sub-accounts', asyncHandler(async (req: AuthRequest, res: Response) => {
  const subAccounts = await Account.find({
    parentAccountId: req.params.id,
    userId: req.userId,
  }).sort({ createdAt: -1 });
  res.json(subAccounts);
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
  if (!account) return res.status(404).json({ error: 'Not found' });
  res.json(account);
}));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, provider, parentAccountId, url, username, notes, tags, credentials } = req.body;
  if (!name || !provider) return res.status(400).json({ error: 'name and provider required' });
  const account = await Account.create({
    userId: req.userId, name, provider,
    parentAccountId: parentAccountId || null,
    url: url || '', username: username || '', notes: notes || '',
    tags: tags || [], credentials: credentials || [],
  });
  res.status(201).json(account);
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
  if (!account) return res.status(404).json({ error: 'Not found' });
  applyUpdates(account, req.body, ['name', 'provider', 'parentAccountId', 'url', 'username', 'notes', 'tags', 'credentials']);
  await account.save();
  res.json(account);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const account = await Account.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!account) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}));

export default router;
