import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { TASK_TYPES, TASK_STATUSES, VISIBILITY_LEVELS, RECURRENCE_FREQS, WEEKDAYS, SECRET_TYPES, SECRET_PROVIDERS, DB_TYPES, DB_FREQUENCIES, BACKUP_STATUSES } from '../config/enums';

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
  freq: z.enum(RECURRENCE_FREQS),
  interval: z.number().int().min(1),
  until: z.string().datetime().optional(),
  count: z.number().int().min(1).optional(),
  byDay: z.array(z.enum(WEEKDAYS)).optional(),
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
  type: z.enum(TASK_TYPES).optional(),
  visibility: z.enum(VISIBILITY_LEVELS).optional(),
  groupIds: z.array(z.string()).optional(),
  blockedBy: z.array(z.string()).optional(),
  parentId: z.string().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  recurrence: recurrenceSchema,
  metadata: projectMetadataSchema,
  tags: z.array(z.string().max(50)).max(20).optional(),
  pinned: z.boolean().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  type: z.enum(TASK_TYPES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  visibility: z.enum(VISIBILITY_LEVELS).optional(),
  groupIds: z.array(z.string()).optional(),
  blockedBy: z.array(z.string()).optional(),
  parentId: z.string().nullable().optional(),
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

export const createKnowledgeSchema = z.object({
  content: z.string().min(1, 'Content is required'),
});

export const updateKnowledgeSchema = z.object({
  content: z.string().min(1).optional(),
});

// Account schemas
export const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  provider: z.string().min(1, 'Provider is required').max(100),
  parentAccountId: z.string().nullable().optional(),
  url: z.string().max(2000).optional(),
  username: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  credentials: z.array(z.object({
    key: z.string(),
    secretId: z.string(),
  })).optional(),
  accountId: z.string().max(50).optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  provider: z.string().min(1).max(100).optional(),
  parentAccountId: z.string().nullable().optional(),
  url: z.string().max(2000).optional(),
  username: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  credentials: z.array(z.object({
    key: z.string(),
    secretId: z.string(),
  })).optional(),
  accountId: z.string().max(50).optional(),
});

// Domain schemas
export const createDomainSchema = z.object({
  name: z.string().min(1, 'Name is required').max(253),
  projectId: z.string().nullable().optional(),
  registrarAccountId: z.string().nullable().optional(),
  dnsAccountId: z.string().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  autoRenew: z.boolean().optional(),
  nameservers: z.array(z.string().max(253)).max(10).optional(),
  sslProvider: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateDomainSchema = z.object({
  name: z.string().min(1).max(253).optional(),
  projectId: z.string().nullable().optional(),
  registrarAccountId: z.string().nullable().optional(),
  dnsAccountId: z.string().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  autoRenew: z.boolean().optional(),
  nameservers: z.array(z.string().max(253)).max(10).optional(),
  sslProvider: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// Database schemas
export const createDatabaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(DB_TYPES, { message: 'Invalid database type' }),
  secretId: z.string().nullable().optional(),
  host: z.string().max(253).optional(),
  port: z.number().int().min(0).max(65535).nullable().optional(),
  database: z.string().max(200).optional(),
  backupEnabled: z.boolean().optional(),
  backupRetentionDays: z.number().int().min(1).max(365).optional(),
  backupFrequency: z.enum(DB_FREQUENCIES).optional(),
  accountId: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateDatabaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(DB_TYPES).optional(),
  secretId: z.string().nullable().optional(),
  host: z.string().max(253).optional(),
  port: z.number().int().min(0).max(65535).nullable().optional(),
  database: z.string().max(200).optional(),
  backupEnabled: z.boolean().optional(),
  backupRetentionDays: z.number().int().min(1).max(365).optional(),
  backupFrequency: z.enum(DB_FREQUENCIES).optional(),
  accountId: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(5000).optional(),
});

export const backupCompletedSchema = z.object({
  status: z.enum(BACKUP_STATUSES, { message: 'Invalid backup status' }),
  startedAt: z.string().datetime('startedAt must be a valid ISO datetime'),
  completedAt: z.string().datetime('completedAt must be a valid ISO datetime'),
  sizeBytes: z.number().int().min(0).optional(),
  s3Path: z.string().max(1000).optional(),
  s3Bucket: z.string().max(200).optional(),
  errorMessage: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  triggeredBy: z.string().max(100).optional(),
  lambdaRequestId: z.string().max(200).optional(),
});

// Subscription schemas
export const createSubscriptionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  provider: z.string().min(1, 'Provider is required').max(200),
  amount: z.number().min(0, 'Amount must be non-negative'),
  currency: z.string().length(3).optional(),
  billingCycle: z.string().min(1, 'Billing cycle is required').max(50),
  nextBillingDate: z.string().datetime().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  autoRenew: z.boolean().optional(),
  status: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  paymentMethod: z.string().max(100).optional(),
  url: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateSubscriptionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  provider: z.string().min(1).max(200).optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  billingCycle: z.string().min(1).max(50).optional(),
  nextBillingDate: z.string().datetime().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  autoRenew: z.boolean().optional(),
  status: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  paymentMethod: z.string().max(100).optional(),
  url: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// Secret schemas
export const createSecretSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  provider: z.enum(SECRET_PROVIDERS, { message: 'Invalid secret provider' }),
  secretValue: z.string().min(1, 'secretValue is required').max(500),
  type: z.enum(SECRET_TYPES, { message: 'Invalid secret type' }),
  tags: z.array(z.string().max(50)).max(20).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const updateSecretSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  provider: z.enum(SECRET_PROVIDERS).optional(),
  secretValue: z.string().max(500).optional(),
  type: z.enum(SECRET_TYPES).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  lastRotatedAt: z.string().datetime().optional(),
});

// Context schemas
export const upsertContextSchema = z.object({
  value: z.string({ message: 'value is required' }),
});

// Repo schemas
export const createRepoSchema = z.object({
  url: z.string().url('Invalid URL').max(2000),
});

export const updateRepoSchema = z.object({
  url: z.string().url('Invalid URL').max(2000).optional(),
});

export const addRepoToTaskSchema = z.object({
  repoId: z.string().min(1, 'repoId is required'),
});

// EnvFile schemas
export const createEnvFileSchema = z.object({
  repoId: z.string().min(1, 'repoId is required'),
  path: z.string().min(1, 'path is required').max(500),
});

export const updateEnvFileSchema = z.object({
  path: z.string().min(1).max(500).optional(),
});

// EnvVar schemas
export const createEnvVarSchema = z.object({
  envFileId: z.string().min(1, 'envFileId is required'),
  key: z.string().min(1, 'key is required').max(200),
  value: z.string().max(5000).optional(),
  isSecret: z.boolean().optional(),
  secretId: z.string().nullable().optional(),
  comment: z.string().max(500).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateEnvVarSchema = z.object({
  key: z.string().min(1).max(200).optional(),
  value: z.string().max(5000).nullable().optional(),
  isSecret: z.boolean().optional(),
  secretId: z.string().nullable().optional(),
  comment: z.string().max(500).nullable().optional(),
  order: z.number().int().min(0).optional(),
});
