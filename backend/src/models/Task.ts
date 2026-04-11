import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDescriptionVersion {
  description: string;
  savedAt: Date;
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
  blockedBy: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  descriptionHistory: [{
    description: { type: String },
    savedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

export default mongoose.model<ITask>('Task', taskSchema);
