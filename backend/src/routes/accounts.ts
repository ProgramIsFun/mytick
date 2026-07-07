import { Router, Response } from 'express';
import { accountRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, badRequest } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const accounts = await accountRepo.findByUser(req.userId!);
  res.json(accounts);
}));

router.get('/:id/sub-accounts', asyncHandler(async (req: AuthRequest, res: Response) => {
  const subAccounts = await accountRepo.findSubAccounts(req.params.id as string);
  res.json(subAccounts);
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const account = await accountRepo.findById(req.params.id as string, req.userId);
  if (!account) return notFound(res);
  res.json(account);
}));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, provider, parentAccountId, url, username, notes, tags, credentials } = req.body;
  if (!name || !provider) return badRequest(res, 'name and provider required');
  const account = await accountRepo.create({
    userId: req.userId, name, provider,
    parentAccountId: parentAccountId || null,
    url: url || '', username: username || '', notes: notes || '',
    tags: tags || [], credentials: credentials || [],
  });
  res.status(201).json(account);
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const account = await accountRepo.update(req.params.id as string, req.body);
  if (!account) return notFound(res);
  res.json(account);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await accountRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
