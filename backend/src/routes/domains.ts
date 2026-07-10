import { Router, Response } from 'express';
import { domainRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound } from '../utils/routeHelpers';
import { validate, createDomainSchema, updateDomainSchema } from '../utils/validation';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /domains:
 *   get:
 *     tags: [Domains]
 *     summary: List domains for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of domains
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Domain'
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { tag, q, projectId } = req.query;
  const domains = await domainRepo.findByUser(req.userId!, {
    tag: tag as string, search: q as string, projectId: projectId as string,
  });
  res.json(domains);
}));

/**
 * @openapi
 * /domains/{id}:
 *   get:
 *     tags: [Domains]
 *     summary: Get a domain by ID
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
 *         description: Domain details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Domain'
 *       404:
 *         description: Domain not found
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const domain = await domainRepo.findById(req.params.id as string, req.userId);
  if (!domain) return notFound(res);
  res.json(domain);
}));

/**
 * @openapi
 * /domains:
 *   post:
 *     tags: [Domains]
 *     summary: Register a new domain
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               projectId:
 *                 type: string
 *               registrarAccountId:
 *                 type: string
 *               dnsAccountId:
 *                 type: string
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *               autoRenew:
 *                 type: boolean
 *                 default: false
 *               nameservers:
 *                 type: array
 *                 items:
 *                   type: string
 *               sslProvider:
 *                 type: string
 *               notes:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Domain created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Domain'
 */
router.post('/', validate(createDomainSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, projectId, registrarAccountId, dnsAccountId, expiryDate, autoRenew, nameservers, sslProvider, notes, tags } = req.body;
  const domain = await domainRepo.create({
    userId: req.userId, name, projectId: projectId || null,
    registrarAccountId: registrarAccountId || null, dnsAccountId: dnsAccountId || null,
    expiryDate: expiryDate || null, autoRenew: autoRenew || false,
    nameservers: nameservers || [], sslProvider: sslProvider || '',
    notes: notes || '', tags: tags || [],
  });
  res.status(201).json(domain);
}));

/**
 * @openapi
 * /domains/{id}:
 *   patch:
 *     tags: [Domains]
 *     summary: Update a domain
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
 *               projectId:
 *                 type: string
 *               registrarAccountId:
 *                 type: string
 *               dnsAccountId:
 *                 type: string
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *               autoRenew:
 *                 type: boolean
 *               nameservers:
 *                 type: array
 *                 items:
 *                   type: string
 *               sslProvider:
 *                 type: string
 *               notes:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Updated domain
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Domain'
 *       404:
 *         description: Domain not found
 */
router.patch('/:id', validate(updateDomainSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const domain = await domainRepo.update(req.params.id as string, req.body);
  if (!domain) return notFound(res);
  res.json(domain);
}));

/**
 * @openapi
 * /domains/{id}:
 *   delete:
 *     tags: [Domains]
 *     summary: Delete a domain
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
 *         description: Domain not found
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await domainRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
