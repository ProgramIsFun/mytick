// Shared types between frontend, mobile, and backend

export type TaskStatus = 'pending' | 'in_progress' | 'on_hold' | 'done' | 'abandoned';
export type TaskVisibility = 'private' | 'group' | 'public';

export interface Task {
  _id: string;
  userId: string;
  title: string;
  description: string;
  status: TaskStatus;
  visibility: TaskVisibility;
  groupIds: string[];
  shareToken: string;
  blockedBy: string[];
  projectIds: string[];
  deadline: string | null;
  recurrence: Recurrence | null;
  descriptionHistory: DescriptionVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  until?: string;
  count?: number;
  byDay?: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[];
}

export interface DescriptionVersion {
  description: string;
  savedAt: string;
}

export interface Group {
  _id: string;
  name: string;
  ownerId: string;
  members: GroupMember[];
}

export interface GroupMember {
  userId: string;
  role: 'viewer' | 'editor';
}

export interface TaskCounts {
  total: number;
  pending: number;
  in_progress: number;
  on_hold: number;
  done: number;
  abandoned: number;
}

export interface PaginatedTasks {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Status display helpers
export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  done: 'Done',
  abandoned: 'Abandoned',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  on_hold: '#8b5cf6',
  done: '#22c55e',
  abandoned: '#6b7280',
};

// Project management
export type ServiceProvider = 'mongodb_atlas' | 'firebase' | 'render' | 'aws' | 'stripe' | 'github' | 'banking' | 'email' | 'custom';

export interface Credential {
  vaultId: string;   // Bitwarden item UUID (one key-value pair)
  key: string;       // human label, e.g. "MONGODB_URI"
}

export interface Account {
  _id: string;
  userId: string;
  name: string;
  provider: ServiceProvider;
  credentials: Credential[];
  createdAt: string;
  updatedAt: string;
}

export interface EnvMapping {
  target: string;       // e.g. "backend/.env"
  envVar: string;       // e.g. "MONGODB_URI"
  vaultId: string;      // Bitwarden item UUID for this specific value
}

export type ProjectType = 'software' | 'personal' | 'business' | 'other';

export interface ProjectService {
  accountId: string;
  role: string;
  env: string;
  mappings: EnvMapping[];
}

export interface ProjectMember {
  userId: string;
  role: 'editor' | 'viewer';
}

export interface Project {
  _id: string;
  userId: string;
  name: string;
  description: string;
  type: ProjectType;
  repoUrl: string;
  localPath: string;
  environments: string[];
  services: ProjectService[];
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
}
