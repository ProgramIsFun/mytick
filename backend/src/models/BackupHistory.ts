import { Schema, model, Document, Types } from 'mongoose';

export interface IBackupHistory extends Document {
  databaseId: Types.ObjectId;
  userId: Types.ObjectId;
  status: 'success' | 'failed' | 'partial';
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  sizeBytes: number;
  s3Path: string;
  s3Bucket: string;
  errorMessage?: string;
  metadata: {
    collections?: number;
    documents?: number;
    tables?: number;
    rows?: number;
    [key: string]: any;
  };
  triggeredBy: 'scheduled' | 'manual';
  lambdaRequestId?: string;
}

const backupHistorySchema = new Schema<IBackupHistory>({
  databaseId: { type: Schema.Types.ObjectId, ref: 'Database', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['success', 'failed', 'partial'], required: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, required: true },
  durationMs: { type: Number, required: true },
  sizeBytes: { type: Number, default: 0 },
  s3Path: { type: String, required: true },
  s3Bucket: { type: String, required: true },
  errorMessage: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  triggeredBy: { type: String, enum: ['scheduled', 'manual'], default: 'scheduled' },
  lambdaRequestId: { type: String },
}, { timestamps: true });

backupHistorySchema.index({ databaseId: 1, completedAt: -1 });
backupHistorySchema.index({ userId: 1, status: 1 });
backupHistorySchema.index({ completedAt: -1 });

export default model<IBackupHistory>('BackupHistory', backupHistorySchema);
