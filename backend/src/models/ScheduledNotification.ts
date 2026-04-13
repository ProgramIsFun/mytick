import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IScheduledNotification extends Document {
  jobId: string;
  userId: Types.ObjectId;
  taskId: Types.ObjectId;
  alertType: string;
  fireAt: Date;
  sent: boolean;
  createdAt: Date;
}

const schema = new Schema<IScheduledNotification>({
  jobId: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  alertType: { type: String, required: true },
  fireAt: { type: Date, required: true },
  sent: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ fireAt: 1, sent: 1 });
schema.index({ taskId: 1 });

export default mongoose.model<IScheduledNotification>('ScheduledNotification', schema);
