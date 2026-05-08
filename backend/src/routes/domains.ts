import { Router, Response } from 'express';
import Domain from '../models/Domain';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { applyUpdates } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filter: any = { userId: req.userId };
  const tag = req.query.tag as string;
  const q = req.query.q as string;
  const projectId = req.query.projectId as string;
  if (tag) filter.tags = tag;
  if (q) filter.name = { $regex: q, $options: 'i' };
  if (projectId) filter.projectId = projectId;
  const domains = await Domain.find(filter)
    .populate('registrarAccountId', 'name provider')
    .populate('dnsAccountId', 'name provider')
    .populate('projectId', 'title type')
    .sort({ expiryDate: 1 });
  res.json(domains);
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const domain = await Domain.findOne({ _id: req.params.id, userId: req.userId })
    .populate('registrarAccountId', 'name provider')
    .populate('dnsAccountId', 'name provider')
    .populate('projectId', 'title type');
  if (!domain) return res.status(404).json({ error: 'Not found' });
  res.json(domain);
}));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, projectId, registrarAccountId, dnsAccountId, expiryDate, autoRenew, nameservers, sslProvider, notes, tags } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const domain = await Domain.create({
    userId: req.userId, name,
    projectId: projectId || null,
    registrarAccountId: registrarAccountId || null,
    dnsAccountId: dnsAccountId || null,
    expiryDate: expiryDate || null,
    autoRenew: autoRenew || false,
    nameservers: nameservers || [],
    sslProvider: sslProvider || '',
    notes: notes || '',
    tags: tags || [],
  });
  res.status(201).json(domain);
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const domain = await Domain.findOne({ _id: req.params.id, userId: req.userId });
  if (!domain) return res.status(404).json({ error: 'Not found' });
  applyUpdates(domain, req.body, ['name', 'projectId', 'registrarAccountId', 'dnsAccountId', 'expiryDate', 'autoRenew', 'nameservers', 'sslProvider', 'notes', 'tags']);
  await domain.save();
  res.json(domain);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const domain = await Domain.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!domain) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
}));

export default router;
