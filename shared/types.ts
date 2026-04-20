// Shared types between frontend, mobile, and backend

export type TaskStatus = 'pending' | 'in_progress' | 'on_hold' | 'done' | 'abandoned';
export type TaskVisibility = 'private' | 'group' | 'public';
export type TaskType = 'task' | 'project';

export interface Task {
  _id: string;
  userId: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  visibility: TaskVisibility;
  groupIds: string[];
  shareToken: string;
  blockedBy: string[];
  deadline: string | null;
  recurrence: Recurrence | null;
  metadata: ProjectMetadata | null;
  tags: string[];
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

// Project management (embedded in Task with type='project')
export type ProjectSubtype = 'software' | 'personal' | 'business' | 'other';

export interface ProjectMetadata {
  projectType: ProjectSubtype;
  repoUrl: string;
  localPath: string;
  environments: string[];
  services: ProjectService[];
  members: ProjectMember[];
}

export interface EnvMapping {
  target: string;       // e.g. "backend/.env"
  envVar: string;       // e.g. "MONGODB_URI"
  vaultId: string;      // Bitwarden item UUID for this specific value
}

export interface ProjectMember {
  userId: string;
  role: 'editor' | 'viewer';
}

// Service accounts (kept as separate collection)
export type ServiceProvider = 'mongodb_atlas' | 'firebase' | 'render' | 'aws' | 'stripe' | 'github' | 'banking' | 'email' | 'custom';

export interface Credential {
  vaultId: string;
  key: string;
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
