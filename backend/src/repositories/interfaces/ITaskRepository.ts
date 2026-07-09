export interface ITask {
  id: string;
  userId: string;
  title: string;
  description?: string;
  type: 'task' | 'project';
  status: 'pending' | 'in_progress' | 'on_hold' | 'done' | 'abandoned';
  visibility: 'private' | 'group' | 'public';
  groupIds?: string[];
  shareToken?: string;
  blockedBy?: string[];
  parentId?: string;
  deadline?: Date | null;
  tags?: string[];
  pinned?: boolean;
  descriptionHistory?: { description: string; savedAt: Date }[];
  recurrence?: {
    freq: string;
    interval: number;
    until?: Date;
    count?: number;
    byDay?: string[];
  } | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskRepository {
  findById(id: string, userId?: string): Promise<ITask | null>;
  findByUser(userId: string, options?: {
    status?: string;
    excludeStatus?: string[];
    type?: string;
    tag?: string;
    parentId?: string | null;
    pinned?: boolean;
    groupIds?: string[];
    q?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }): Promise<{ tasks: ITask[]; total: number }>;
  findByShareToken(shareToken: string): Promise<ITask | null>;
  findBlockedBy(taskId: string): Promise<ITask[]>;
  findBlocking(taskId: string): Promise<ITask[]>;
  findSubtasks(parentId: string): Promise<ITask[]>;
  countByStatus(userId: string, groupIds?: string[]): Promise<Record<string, number>>;
  create(data: Partial<ITask>): Promise<ITask>;
  update(id: string, data: Partial<ITask>): Promise<ITask | null>;
  delete(id: string, userId: string): Promise<boolean>;
  findAllBlockedBy(): Promise<Array<{ id: string; blockedBy: string[] }>>;
  addDescriptionVersion(id: string, description: string): Promise<void>;
  rollbackDescription(id: string, index: number): Promise<void>;
}
