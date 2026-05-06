import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDescriptionVersion {
  description: string;
  savedAt: Date;
}

export interface IRecurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  until?: Date;
  count?: number;
  byDay?: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[];
}

export type TaskType = 'task' | 'project';

export interface IProjectMetadata {
  projectType: 'software' | 'personal' | 'business' | 'other';
  repoUrl: string;
  localPath: string;
  environments: string[];
  services: {
    accountId: Types.ObjectId;
    role: string;
    env: string;
    mappings: { target: string; envVar: string; vaultId: string }[];
  }[];
  members: { userId: Types.ObjectId; role: 'editor' | 'viewer' }[];
}

export interface ITask extends Document {
  userId: Types.ObjectId;
  title: string;
  description: string;
  type: TaskType;
  status: 'pending' | 'in_progress' | 'on_hold' | 'done' | 'abandoned';
  visibility: 'private' | 'group' | 'public';
  groupIds: Types.ObjectId[];
  shareToken: string;
  descriptionHistory: IDescriptionVersion[];
  blockedBy: Types.ObjectId[];
  parentId: Types.ObjectId | null;
  deadline: Date | null;
  recurrence: IRecurrence | null;
  metadata: IProjectMetadata | null;
  tags: string[];
  pinned: boolean;
  createdAt: Date;
}

const taskSchema = new Schema<ITask>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  type: { type: String, enum: ['task', 'project'], default: 'task' },
  status: { type: String, enum: ['pending', 'in_progress', 'on_hold', 'done', 'abandoned'], default: 'pending' },
  visibility: { type: String, enum: ['private', 'group', 'public'], default: 'private' },
  groupIds: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
  shareToken: { type: String, required: true, unique: true },
  // Dependencies are stored as an embedded array rather than a separate collection.
  // This is intentional: tasks rarely have >20 deps, and reads always need task+deps together.
  // Embedded = 1 query. Separate collection = 2 queries for every read, at any scale.
  // If relationships become the core product, migrate to a graph DB (Neo4j), not a separate collection.
  blockedBy: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  parentId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
  deadline: { type: Date, default: null },
  recurrence: {
    type: {
      freq: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
      interval: { type: Number, required: true, min: 1 },
      until: { type: Date, default: undefined },
      count: { type: Number, default: undefined },
      byDay: { type: [String], enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'], default: undefined },
    },
    default: null,
    _id: false,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: null,
  },
  tags: [{ type: String, trim: true }],
  pinned: { type: Boolean, default: false },
  descriptionHistory: [{
    description: { type: String },
    savedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

// Indexes for common queries
taskSchema.index({ userId: 1, createdAt: -1 }); // List user's tasks
taskSchema.index({ userId: 1, status: 1 }); // Filter by status
taskSchema.index({ userId: 1, type: 1 }); // Filter by type (task/project)
taskSchema.index({ parentId: 1 }); // Subtask queries
taskSchema.index({ userId: 1, pinned: 1, createdAt: -1 }); // Pinned tasks first

export default mongoose.model<ITask>('Task', taskSchema);
