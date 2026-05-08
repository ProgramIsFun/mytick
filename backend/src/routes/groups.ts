import { Router, Response } from 'express';
import Group from '../models/Group';
import { auth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate, createGroupSchema, addMemberSchema } from '../utils/validation';
import { notFound, getUserModel } from '../utils/routeHelpers';

const router = Router();
router.use(auth);

router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const User = await getUserModel();
  const groups = await Group.find({
    $or: [{ ownerId: req.userId }, { 'members.userId': req.userId }],
  }).lean();

  const userIds = [...new Set(groups.flatMap(g => g.members.map(m => m.userId.toString())))];
  const users = await User.find({ _id: { $in: userIds } }).select('_id username name').lean();
  const userMap = Object.fromEntries(users.map((u: any) => [u._id.toString(), { username: u.username, name: u.name }]));

  const enriched = groups.map(g => ({
    ...g,
    members: g.members.map(m => ({
      ...m,
      username: userMap[m.userId.toString()]?.username,
      name: userMap[m.userId.toString()]?.name,
    })),
  }));

  res.json(enriched);
}));

router.post('/', validate(createGroupSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const group = await Group.create({
    name,
    ownerId: req.userId,
    members: [{ userId: req.userId, role: 'editor' }],
  });
  res.status(201).json(group);
}));

router.post('/:id/members', validate(addMemberSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId, email, role } = req.body;

  let targetId = userId;
  if (!targetId) {
    const User = await getUserModel();
    const user = await User.findOne({ email });
    if (!user) return notFound(res, 'User not found');
    targetId = user._id.toString();
  }

  const group = await Group.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!group) return notFound(res);

  const already = group.members.some(m => m.userId.toString() === targetId);
  if (already) return res.status(409).json({ error: 'Already a member' });

  group.members.push({ userId: targetId, role: role || 'viewer' });
  await group.save();
  res.json(group);
}));

router.delete('/:id/members/:userId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await Group.findOne({ _id: req.params.id, ownerId: req.userId });
  if (!group) return notFound(res);
  group.members = group.members.filter(m => m.userId.toString() !== req.params.userId) as any;
  await group.save();
  res.json(group);
}));

router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const group = await Group.findOneAndDelete({ _id: req.params.id, ownerId: req.userId });
  if (!group) return notFound(res);
  res.json({ message: 'Deleted' });
}));

export default router;
