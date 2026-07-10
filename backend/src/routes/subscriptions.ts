import { Router, Response } from 'express';
import { subscriptionRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound } from '../utils/routeHelpers';
import { validate, createSubscriptionSchema, updateSubscriptionSchema } from '../utils/validation';
import { notificationQueue } from '../queues';
import { scheduleSubscriptionAlerts } from '../queues/scheduleSubscriptionAlerts';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /subscriptions:
 *   get:
 *     tags: [Subscriptions]
 *     summary: List subscriptions for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: List of subscriptions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Subscription'
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, category, tag, q } = req.query;
  const subs = await subscriptionRepo.findByUser(req.userId!, {
    status: status as string, category: category as string,
    tag: tag as string, search: q as string,
  });
  res.json(subs);
}));

/**
 * @openapi
 * /subscriptions/stats:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get subscription cost stats (active subs, monthly total)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 totalMonthly:
 *                   type: number
 *                 currency:
 *                   type: string
 */
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

/**
 * @openapi
 * /subscriptions/{id}:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get a subscription by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: Subscription not found
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const sub = await subscriptionRepo.findById(req.params.id as string, req.userId);
  if (!sub) return notFound(res);
  res.json(sub);
}));

/**
 * @openapi
 * /subscriptions:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Create a new subscription
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, provider, amount, billingCycle]
 *             properties:
 *               name:
 *                 type: string
 *               provider:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: USD
 *               billingCycle:
 *                 type: string
 *               nextBillingDate:
 *                 type: string
 *                 format: date-time
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *               autoRenew:
 *                 type: boolean
 *                 default: false
 *               status:
 *                 type: string
 *                 default: active
 *               category:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *               url:
 *                 type: string
 *               notes:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Subscription created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 */
router.post('/', validate(createSubscriptionSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, provider, amount, currency, billingCycle, nextBillingDate, expiryDate, autoRenew, status, category, paymentMethod, url, notes, tags } = req.body;
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

/**
 * @openapi
 * /subscriptions/{id}:
 *   patch:
 *     tags: [Subscriptions]
 *     summary: Update a subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               provider:
 *                 type: string
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               billingCycle:
 *                 type: string
 *               nextBillingDate:
 *                 type: string
 *                 format: date-time
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *               autoRenew:
 *                 type: boolean
 *               status:
 *                 type: string
 *               category:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *               url:
 *                 type: string
 *               notes:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Updated subscription
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Subscription'
 *       404:
 *         description: Subscription not found
 */
router.patch('/:id', validate(updateSubscriptionSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const sub = await subscriptionRepo.update(req.params.id as string, req.body);
  if (!sub) return notFound(res);

  if (req.body.nextBillingDate !== undefined || req.body.expiryDate !== undefined || req.body.status !== undefined) {
    const alertDate = sub.status === 'active' ? (sub.nextBillingDate || sub.expiryDate) : null;
    await scheduleSubscriptionAlerts(notificationQueue, sub.id, req.userId!, alertDate ?? null);
  }

  res.json(sub);
}));

/**
 * @openapi
 * /subscriptions/{id}:
 *   delete:
 *     tags: [Subscriptions]
 *     summary: Delete a subscription
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Subscription not found
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await subscriptionRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  await notificationQueue.cancelByTask(req.params.id as string);
  res.json({ message: 'Deleted' });
}));

export default router;
