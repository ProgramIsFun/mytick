import { Router, Response } from 'express';
import { groupRepo, userRepo } from '../repositories';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate, createGroupSchema, addMemberSchema } from '../utils/validation';
import { notFound } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

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

router.post('/', validate(createGroupSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const group = await groupRepo.create({
    name,
    ownerId: req.userId,
    members: [{ userId: req.userId!, role: 'editor' }],
  });
  res.status(201).json(group);
}));

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

router.delete('/:id/members/:userId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await groupRepo.findById(req.params.id as string);
  if (!group || group.ownerId !== req.userId) return notFound(res);
  await groupRepo.removeMember(req.params.id as string, req.params.userId as string);
  const updated = await groupRepo.findById(req.params.id as string);
  res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await groupRepo.findById(req.params.id as string);
  if (!group || group.ownerId !== req.userId) return notFound(res);
  await groupRepo.delete(req.params.id as string);
  res.json({ message: 'Deleted' });
}));

export default router;
