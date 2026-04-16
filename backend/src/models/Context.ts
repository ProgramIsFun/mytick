import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IContext extends Document {
  userId: Types.ObjectId;
  key: string;
  value: string;
  updatedAt: Date;
}

const contextSchema = new Schema<IContext>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  key: { type: String, required: true, trim: true },
  value: { type: String, required: true },
}, { timestamps: true });

contextSchema.index({ userId: 1, key: 1 }, { unique: true });

export default mongoose.model<IContext>('Context', contextSchema);
