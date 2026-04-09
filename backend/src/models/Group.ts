import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  ownerId: Types.ObjectId;
  members: { userId: Types.ObjectId; role: 'editor' | 'viewer' }[];
  createdAt: Date;
}

const groupSchema = new Schema<IGroup>({
  name: { type: String, required: true, trim: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['editor', 'viewer'], default: 'viewer' },
  }],
}, { timestamps: true });

export default mongoose.model<IGroup>('Group', groupSchema);
