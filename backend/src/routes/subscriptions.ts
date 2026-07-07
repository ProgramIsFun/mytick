import { Router, Response } from 'express';
import { subscriptionRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, badRequest } from '../utils/routeHelpers';
import { notificationQueue } from '../queues';
import { scheduleSubscriptionAlerts } from '../queues/scheduleSubscriptionAlerts';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, category, tag, q } = req.query;
  const subs = await subscriptionRepo.findByUser(req.userId!, {
    status: status as string, category: category as string,
    tag: tag as string, search: q as string,
  });
  res.json(subs);
}));

router.get('/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const subs = await subscriptionRepo.findActiveByUser(req.userId!);
  const totalMonthly = subs.reduce((sum, s) => {
    switch (s.billingCycle) {
      case 'monthly': return sum + s.amount;
      case 'yearly': return sum + s.amount / 12;
      case 'quarterly': return sum + s.amount / 3;
      case 'weekly': return sum + s.amount * 4.33;
      default: return sum;
    }
  }, 0);
  res.json({ total: subs.length, totalMonthly: Math.round(totalMonthly * 100) / 100, currency: subs[0]?.currency || 'USD' });
}));

router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const sub = await subscriptionRepo.findById(req.params.id as string, req.userId);
  if (!sub) return notFound(res);
  res.json(sub);
}));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, provider, amount, currency, billingCycle, nextBillingDate, expiryDate, autoRenew, status, category, paymentMethod, url, notes, tags } = req.body;
  if (!name || !provider || amount === undefined || !billingCycle) {
    return badRequest(res, 'name, provider, amount, and billingCycle required');
  }
  const sub = await subscriptionRepo.create({
    userId: req.userId, name, provider, amount,
    currency: currency || 'USD', billingCycle,
    nextBillingDate: nextBillingDate || null, expiryDate: expiryDate || null,
    autoRenew: autoRenew ?? false, status: status || 'active',
    category: category || '', paymentMethod: paymentMethod || '',
    url: url || '', notes: notes || '', tags: tags || [],
  });

  const alertDate = sub.nextBillingDate || sub.expiryDate;
  if (alertDate) {
    await scheduleSubscriptionAlerts(notificationQueue, sub.id, req.userId!, alertDate ?? null);
  }

  res.status(201).json(sub);
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const sub = await subscriptionRepo.update(req.params.id as string, req.body);
  if (!sub) return notFound(res);

  if (req.body.nextBillingDate !== undefined || req.body.expiryDate !== undefined || req.body.status !== undefined) {
    const alertDate = sub.status === 'active' ? (sub.nextBillingDate || sub.expiryDate) : null;
    await scheduleSubscriptionAlerts(notificationQueue, sub.id, req.userId!, alertDate ?? null);
  }

  res.json(sub);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await subscriptionRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  await notificationQueue.cancelByTask(req.params.id as string);
  res.json({ message: 'Deleted' });
}));

export default router;
