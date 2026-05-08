import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth';
import { MAX_PAGE_LIMIT, DEFAULT_PAGE_LIMIT, MAX_BACKUP_HISTORY_LIMIT, DEFAULT_BACKUP_HISTORY_LIMIT } from '../config/constants';
import Group from '../models/Group';

export function applyUpdates(doc: any, updates: Record<string, any>, allowed: string[]) {
  for (const key of allowed) {
    if (updates[key] !== undefined) doc[key] = updates[key];
  }
}

export function notFound(res: Response, msg = 'Not found') {
  return res.status(404).json({ error: msg });
}

export function badRequest(res: Response, msg: string) {
  return res.status(400).json({ error: msg });
}

export function extractViewerId(req: AuthRequest): string | null {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

export function parsePagination(query: Record<string, any>, maxLimit = MAX_PAGE_LIMIT) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit as string) || DEFAULT_PAGE_LIMIT));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function parseBackupHistoryLimit(query: Record<string, any>) {
  return Math.min(parseInt(query.limit as string) || DEFAULT_BACKUP_HISTORY_LIMIT, MAX_BACKUP_HISTORY_LIMIT);
}

export function findOwned(Model: any, req: AuthRequest) {
  return Model.findOne({ _id: req.params.id, userId: req.userId });
}

export async function getUserGroupIds(userId: string) {
  const userGroups = await Group.find({ 'members.userId': userId }).select('_id');
  return userGroups.map(g => g._id);
}

export function forbidden(res: Response, msg = 'Forbidden') {
  return res.status(403).json({ error: msg });
}

let _User: any;
export async function getUserModel() {
  if (!_User) _User = (await import('../models/User')).default;
  return _User;
}
