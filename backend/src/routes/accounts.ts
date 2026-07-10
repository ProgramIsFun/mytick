import { Router, Response } from 'express';
import { accountRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { notFound, badRequest } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /accounts:
 *   get:
 *     tags: [Accounts]
 *     summary: List accounts for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Account'
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const accounts = await accountRepo.findByUser(req.userId!);
  res.json(accounts);
}));

/**
 * @openapi
 * /accounts/{id}/sub-accounts:
 *   get:
 *     tags: [Accounts]
 *     summary: Get sub-accounts of a parent account
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
 *         description: Sub-accounts list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Account'
 */
router.get('/:id/sub-accounts', asyncHandler(async (req: AuthRequest, res: Response) => {
  const subAccounts = await accountRepo.findSubAccounts(req.params.id as string);
  res.json(subAccounts);
}));

/**
 * @openapi
 * /accounts/{id}:
 *   get:
 *     tags: [Accounts]
 *     summary: Get an account by ID
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
 *         description: Account details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *       404:
 *         description: Account not found
 */
router.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const account = await accountRepo.findById(req.params.id as string, req.userId);
  if (!account) return notFound(res);
  res.json(account);
}));

/**
 * @openapi
 * /accounts:
 *   post:
 *     tags: [Accounts]
 *     summary: Create a new account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, provider]
 *             properties:
 *               name:
 *                 type: string
 *               provider:
 *                 type: string
 *               parentAccountId:
 *                 type: string
 *               url:
 *                 type: string
 *               username:
 *                 type: string
 *               notes:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               credentials:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key:
 *                       type: string
 *                     secretId:
 *                       type: string
 *     responses:
 *       201:
 *         description: Account created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 */
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

/**
 * @openapi
 * /accounts/{id}:
 *   patch:
 *     tags: [Accounts]
 *     summary: Update an account
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
 *               url:
 *                 type: string
 *               username:
 *                 type: string
 *               notes:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Updated account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Account'
 *       404:
 *         description: Account not found
 */
router.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const account = await accountRepo.update(req.params.id as string, req.body);
  if (!account) return notFound(res);
  res.json(account);
}));

/**
 * @openapi
 * /accounts/{id}:
 *   delete:
 *     tags: [Accounts]
 *     summary: Delete an account
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
 *         description: Account not found
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const deleted = await accountRepo.delete(req.params.id as string, req.userId!);
  if (!deleted) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
