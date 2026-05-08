import { Router, Response } from 'express';
import Secret from '../models/Secret';
import Database from '../models/Database';
import Account from '../models/Account';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { applyUpdates, notFound, badRequest, findOwned } from '../utils/routeHelpers';

const router = Router();

router.use(auth);

/**
 * @swagger
 * /secrets:
 *   get:
 *     summary: List all secrets
 *     tags: [Secrets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: provider, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string } }
 *       - { in: query, name: tag, schema: { type: string } }
 *     responses:
 *       200: { description: List of secrets }
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { search, provider, type, tag } = req.query;
  const filter: any = { userId: req.userId };
  
  if (search) filter.name = { $regex: search, $options: 'i' };
  if (provider) filter.provider = provider;
  if (type) filter.type = type;
  if (tag) filter.tags = tag;
  
  res.json(await Secret.find(filter).sort({ createdAt: -1 }));
}));

/**
 * @swagger
 * /secrets/{id}:
 *   get:
 *     summary: Get a single secret
 *     tags: [Secrets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Secret details }
 *       404: { description: Not found }
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await Secret.findOne({
    _id: req.params.id,
    userId: req.userId,
  });
  
  if (!secret) return notFound(res);
  res.json(secret);
}));

/**
 * @swagger
 * /secrets:
 *   post:
 *     summary: Create a secret
 *     tags: [Secrets]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, provider, providerSecretId, type]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               provider: { type: string, enum: [bitwarden, bitwarden_sm, aws_secrets, 1password, vault, lastpass, custom] }
 *               providerSecretId: { type: string }
 *               type: { type: string, enum: [connection_string, password, api_key, token, certificate, ssh_key, other] }
 *               tags: { type: array, items: { type: string } }
 *               expiresAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: Secret created }
 *       400: { description: Validation error }
 */
router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, description, provider, providerSecretId, type, tags, expiresAt } = req.body;
  
  if (!name || !provider || !providerSecretId || !type) {
    return badRequest(res, 'name, provider, providerSecretId, and type are required');
  }
  
  res.status(201).json(await Secret.create({
    userId: req.userId,
    name,
    description: description || '',
    provider,
    providerSecretId,
    type,
    tags: tags || [],
    expiresAt: expiresAt || null,
  }));
}));

/**
 * @swagger
 * /secrets/{id}:
 *   patch:
 *     summary: Update a secret
 *     tags: [Secrets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Secret updated }
 *       404: { description: Not found }
 */
router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await Secret.findOne({
    _id: req.params.id,
    userId: req.userId,
  });
  
  if (!secret) return notFound(res);
  
  applyUpdates(secret, req.body, ['name', 'description', 'provider', 'providerSecretId', 'type', 'tags', 'expiresAt', 'lastRotatedAt']);
  await secret.save();
  res.json(secret);
}));

/**
 * @swagger
 * /secrets/{id}:
 *   delete:
 *     summary: Delete a secret
 *     tags: [Secrets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 *       400: { description: Secret is in use }
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await Secret.findOne({
    _id: req.params.id,
    userId: req.userId,
  });
  
  if (!secret) return notFound(res);
  
  const [dbUsage, accountUsage] = await Promise.all([
    Database.findOne({ secretId: req.params.id, userId: req.userId }).select('_id name'),
    Account.findOne({ 'credentials.secretId': req.params.id, userId: req.userId }).select('_id name'),
  ]);

  if (dbUsage || accountUsage) {
    const usedBy = [];
    if (dbUsage) usedBy.push({ collection: 'databases', itemId: dbUsage._id, itemName: dbUsage.name });
    if (accountUsage) usedBy.push({ collection: 'accounts', itemId: accountUsage._id, itemName: accountUsage.name });
    return res.status(400).json({ error: 'Secret is in use', usedBy });
  }
  
  await secret.deleteOne();
  res.json({ message: 'Deleted' });
}));

/**
 * @swagger
 * /secrets/{id}/touch:
 *   post:
 *     summary: Update lastAccessedAt timestamp
 *     tags: [Secrets]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Timestamp updated }
 */
router.post('/:id/touch', asyncHandler(async (req: AuthRequest, res: Response) => {
  const secret = await Secret.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { lastAccessedAt: new Date() },
    { new: true }
  );
  
  if (!secret) return notFound(res);
  res.json(secret);
}));

export default router;
