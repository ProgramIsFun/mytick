import { Router, Response } from 'express';
import { secretRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, badRequest } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

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

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await secretRepo.findById(req.params.id as string, req.userId);
  if (!secret) return notFound(res);
  res.json(secret);
}));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, description, provider, providerSecretId, type, tags, expiresAt } = req.body;
  if (!name || !provider || !providerSecretId || !type) {
    return badRequest(res, 'name, provider, providerSecretId, and type are required');
  }
  const secret = await secretRepo.create({
    userId: req.userId, name, description: description || '',
    provider, providerSecretId, type, tags: tags || [], expiresAt: expiresAt || null,
  });
  res.status(201).json(secret);
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await secretRepo.update(req.params.id as string, req.body);
  if (!secret) return notFound(res);
  res.json(secret);
}));

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

router.post('/:id/touch', asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await secretRepo.touch(req.params.id as string, req.userId!);
  if (!secret) return notFound(res);
  res.json(secret);
}));

export default router;
