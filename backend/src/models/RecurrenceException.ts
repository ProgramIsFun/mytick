import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRecurrenceException extends Document {
  taskId: Types.ObjectId;
  date: Date;
  status: 'done' | 'skipped';
}

const schema = new Schema<IRecurrenceException>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['done', 'skipped'], required: true },
}, { timestamps: true });

schema.index({ taskId: 1, date: 1 }, { unique: true });

export default mongoose.model<IRecurrenceException>('RecurrenceException', schema);
