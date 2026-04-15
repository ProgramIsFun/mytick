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

export interface ITask extends Document {
  userId: Types.ObjectId;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done';
  visibility: 'private' | 'group' | 'public';
  groupIds: Types.ObjectId[];
  shareToken: string;
  descriptionHistory: IDescriptionVersion[];
  blockedBy: Types.ObjectId[];
  deadline: Date | null;
  recurrence: IRecurrence | null;
  createdAt: Date;
}

const taskSchema = new Schema<ITask>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  status: { type: String, enum: ['pending', 'in_progress', 'done'], default: 'pending' },
  visibility: { type: String, enum: ['private', 'group', 'public'], default: 'private' },
  groupIds: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
  shareToken: { type: String, required: true, unique: true },
  // Dependencies are stored as an embedded array rather than a separate collection.
  // This is intentional: tasks rarely have >20 deps, and reads always need task+deps together.
  // Embedded = 1 query. Separate collection = 2 queries for every read, at any scale.
  // If relationships become the core product, migrate to a graph DB (Neo4j), not a separate collection.
  blockedBy: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
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
  descriptionHistory: [{
    description: { type: String },
    savedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

export default mongoose.model<ITask>('Task', taskSchema);
