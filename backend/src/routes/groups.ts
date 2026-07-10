import { Router, Response } from 'express';
import { groupRepo, userRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate, createGroupSchema, addMemberSchema } from '../utils/validation';
import { notFound } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

/**
 * @openapi
 * /groups:
 *   get:
 *     tags: [Groups]
 *     summary: List groups for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of groups with enriched member info
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Group'
 */
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const groups = await groupRepo.findByUser(req.userId!);
  const userIds = [...new Set(groups.flatMap(g => g.members.map(m => m.userId)))];
  const userMap: Record<string, { username: string; name: string }> = {};
  for (const uid of userIds) {
    const u = await userRepo.findById(uid);
    if (u) userMap[uid] = { username: u.username, name: u.name };
  }
  const enriched = groups.map(g => ({
    ...g,
    members: g.members.map(m => ({
      ...m,
      username: userMap[m.userId]?.username,
      name: userMap[m.userId]?.name,
    })),
  }));
  res.json(enriched);
}));

/**
 * @openapi
 * /groups:
 *   post:
 *     tags: [Groups]
 *     summary: Create a new group
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
 *                 minLength: 1
 *                 maxLength: 100
 *     responses:
 *       201:
 *         description: Group created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 */
router.post('/', validate(createGroupSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const group = await groupRepo.create({
    name,
    ownerId: req.userId,
    members: [{ userId: req.userId!, role: 'editor' }],
  });
  res.status(201).json(group);
}));

/**
 * @openapi
 * /groups/{id}/members:
 *   post:
 *     tags: [Groups]
 *     summary: Add a member to a group (owner only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [viewer, editor]
 *                 default: viewer
 *     responses:
 *       200:
 *         description: Updated group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       404:
 *         description: Group or user not found
 *       409:
 *         description: Already a member
 */
router.post('/:id/members', validate(addMemberSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId, email, role } = req.body;

  let targetId = userId;
  if (!targetId) {
    const user = await userRepo.findByEmail(email);
    if (!user) return notFound(res, 'User not found');
    targetId = user.id;
  }

  const group = await groupRepo.findById(req.params.id as string);
  if (!group || group.ownerId !== req.userId) return notFound(res);

  const already = group.members.some(m => m.userId === targetId);
  if (already) return res.status(409).json({ error: 'Already a member' });

  await groupRepo.addMember(req.params.id as string, targetId, role || 'viewer');
  const updated = await groupRepo.findById(req.params.id as string);
  res.json(updated);
}));

/**
 * @openapi
 * /groups/{id}/members/{userId}:
 *   delete:
 *     tags: [Groups]
 *     summary: Remove a member from a group (owner only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Group'
 *       404:
 *         description: Group not found
 */
router.delete('/:id/members/:userId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await groupRepo.findById(req.params.id as string);
  if (!group || group.ownerId !== req.userId) return notFound(res);
  await groupRepo.removeMember(req.params.id as string, req.params.userId as string);
  const updated = await groupRepo.findById(req.params.id as string);
  res.json(updated);
}));

/**
 * @openapi
 * /groups/{id}:
 *   delete:
 *     tags: [Groups]
 *     summary: Delete a group (owner only)
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
 *         description: Group not found
 */
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await groupRepo.findById(req.params.id as string);
  if (!group || group.ownerId !== req.userId) return notFound(res);
  await groupRepo.delete(req.params.id as string);
  res.json({ message: 'Deleted' });
}));

export default router;
