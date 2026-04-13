import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRecurrenceException extends Document {
  taskId: Types.ObjectId;
  date: Date;                    // original occurrence date
  status: 'pending' | 'done' | 'skipped';
  // Overrides for single occurrence (null = inherit from parent task)
  title?: string;
  description?: string;
  newDate?: Date;                // reschedule this occurrence to a different date
}

const schema = new Schema<IRecurrenceException>({
  taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'done', 'skipped'], default: 'pending' },
  title: { type: String, default: undefined },
  description: { type: String, default: undefined },
  newDate: { type: Date, default: undefined },
}, { timestamps: true });

schema.index({ taskId: 1, date: 1 }, { unique: true });

export default mongoose.model<IRecurrenceException>('RecurrenceException', schema);
