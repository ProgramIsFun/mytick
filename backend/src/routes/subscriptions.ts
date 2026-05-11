import { Router, Response } from 'express';
import Subscription from '../models/Subscription';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { applyUpdates, notFound, badRequest, findOwned } from '../utils/routeHelpers';
import { notificationQueue } from '../queues';
import { scheduleSubscriptionAlerts } from '../queues/scheduleSubscriptionAlerts';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const filter: any = { userId: req.userId };
  const status = req.query.status as string;
  const category = req.query.category as string;
  const tag = req.query.tag as string;
  const q = req.query.q as string;
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  if (q) filter.name = { $regex: q, $options: 'i' };
  res.json(await Subscription.find(filter).sort({ nextBillingDate: 1 }));
}));

router.get('/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const subs = await Subscription.find({ userId: req.userId, status: 'active' });
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
  const sub = await findOwned(Subscription, req);
  if (!sub) return notFound(res);
  res.json(sub);
}));

router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, provider, amount, currency, billingCycle, nextBillingDate, expiryDate, autoRenew, status, category, paymentMethod, url, notes, tags } = req.body;
  if (!name || !provider || amount === undefined || !billingCycle) {
    return badRequest(res, 'name, provider, amount, and billingCycle required');
  }
  const sub = await Subscription.create({
    userId: req.userId, name, provider, amount,
    currency: currency || 'USD',
    billingCycle,
    nextBillingDate: nextBillingDate || null,
    expiryDate: expiryDate || null,
    autoRenew: autoRenew ?? false,
    status: status || 'active',
    category: category || '',
    paymentMethod: paymentMethod || '',
    url: url || '',
    notes: notes || '',
    tags: tags || [],
  });

  const alertDate = sub.nextBillingDate || sub.expiryDate;
  if (alertDate) {
    await scheduleSubscriptionAlerts(notificationQueue, sub._id.toString(), req.userId!, alertDate);
  }

  res.status(201).json(sub);
}));

router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const sub = await findOwned(Subscription, req);
  if (!sub) return notFound(res);
  applyUpdates(sub, req.body, ['name', 'provider', 'amount', 'currency', 'billingCycle', 'nextBillingDate', 'expiryDate', 'autoRenew', 'status', 'category', 'paymentMethod', 'url', 'notes', 'tags']);
  await sub.save();

  if (req.body.nextBillingDate !== undefined || req.body.expiryDate !== undefined || req.body.status !== undefined) {
    const alertDate = sub.status === 'active' ? (sub.nextBillingDate || sub.expiryDate) : null;
    await scheduleSubscriptionAlerts(notificationQueue, sub._id.toString(), req.userId!, alertDate);
  }

  res.json(sub);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const sub = await Subscription.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!sub) return notFound(res);
  await notificationQueue.cancelByTask(sub._id.toString());
  res.json({ message: 'Deleted' });
}));

export default router;
