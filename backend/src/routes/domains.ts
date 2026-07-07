import { Router, Response } from 'express';
import { domainRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, badRequest } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { tag, q, projectId } = req.query;
  const domains = await domainRepo.findByUser(req.userId!, {
    tag: tag as string, search: q as string, projectId: projectId as string,
  });
  res.json(domains);
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const domain = await domainRepo.findById(req.params.id as string, req.userId);
  if (!domain) return notFound(res);
  res.json(domain);
}));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, projectId, registrarAccountId, dnsAccountId, expiryDate, autoRenew, nameservers, sslProvider, notes, tags } = req.body;
  if (!name) return badRequest(res, 'name required');
  const domain = await domainRepo.create({
    userId: req.userId, name, projectId: projectId || null,
    registrarAccountId: registrarAccountId || null, dnsAccountId: dnsAccountId || null,
    expiryDate: expiryDate || null, autoRenew: autoRenew || false,
    nameservers: nameservers || [], sslProvider: sslProvider || '',
    notes: notes || '', tags: tags || [],
  });
  res.status(201).json(domain);
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const domain = await domainRepo.update(req.params.id as string, req.body);
  if (!domain) return notFound(res);
  res.json(domain);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await domainRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
