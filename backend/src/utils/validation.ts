import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message });
    }
    req.body = result.data;
    next();
  };
}

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  username: z.string().min(1).max(39).regex(/^[a-z0-9](?:[a-z0-9]*-?[a-z0-9]+)*$/, 'Invalid username format'),
});

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const oauthSchema = z.object({
  provider: z.enum(['google', 'github']),
  providerId: z.string().min(1),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

export const updateProfileSchema = z.object({
  username: z.string().min(1).max(39).regex(/^[a-z0-9](?:[a-z0-9]*-?[a-z0-9]+)*$/, 'Invalid username format').optional(),
  name: z.string().min(1).max(100).optional(),
});

const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1),
  until: z.string().datetime().optional(),
  count: z.number().int().min(1).optional(),
  byDay: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
}).nullable().optional();

const projectMetadataSchema = z.object({
  projectType: z.enum(['software', 'personal', 'business', 'other']).optional(),
  repoUrl: z.string().optional(),
  localPath: z.string().optional(),
  environments: z.array(z.string()).optional(),
  services: z.array(z.object({
    accountId: z.string(),
    role: z.string(),
    env: z.string().optional(),
    mappings: z.array(z.object({
      target: z.string(),
      envVar: z.string(),
      vaultId: z.string(),
    })).optional(),
  })).optional(),
  members: z.array(z.object({
    userId: z.string(),
    role: z.enum(['editor', 'viewer']),
  })).optional(),
}).nullable().optional();

// Task schemas
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(5000).optional(),
  type: z.enum(['task', 'project']).optional(),
  visibility: z.enum(['private', 'group', 'public']).optional(),
  groupIds: z.array(z.string()).optional(),
  blockedBy: z.array(z.string()).optional(),
  deadline: z.string().datetime().nullable().optional(),
  recurrence: recurrenceSchema,
  metadata: projectMetadataSchema,
  tags: z.array(z.string().max(50)).max(20).optional(),
  pinned: z.boolean().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  type: z.enum(['task', 'project']).optional(),
  status: z.enum(['pending', 'in_progress', 'on_hold', 'done', 'abandoned']).optional(),
  visibility: z.enum(['private', 'group', 'public']).optional(),
  groupIds: z.array(z.string()).optional(),
  blockedBy: z.array(z.string()).optional(),
  deadline: z.string().datetime().nullable().optional(),
  recurrence: recurrenceSchema,
  metadata: projectMetadataSchema,
  tags: z.array(z.string().max(50)).max(20).optional(),
  pinned: z.boolean().optional(),
});

// Group schemas
export const createGroupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

export const addMemberSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(['viewer', 'editor']).optional(),
}).refine(d => d.userId || d.email, { message: 'userId or email required' });
