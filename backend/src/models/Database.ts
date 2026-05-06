import { Schema, model, Document, Types } from 'mongoose';

export interface IDatabase extends Document {
  userId: Types.ObjectId;
  name: string;
  type: 'mongodb' | 'postgres' | 'mysql' | 'redis' | 'sqlite' | 'other';
  connectionUri: string;
  host: string;
  port: number | null;
  database: string;
  backupEnabled: boolean;
  backupRetentionDays: number;
  backupFrequency: 'daily' | 'weekly';
  lastBackupAt: Date | null;
  accountId: Types.ObjectId | null;
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const databaseSchema = new Schema<IDatabase>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['mongodb', 'postgres', 'mysql', 'redis', 'sqlite', 'other'], required: true },
  connectionUri: { type: String, default: '' },
  host: { type: String, default: '' },
  port: { type: Number, default: null },
  database: { type: String, default: '' },
  backupEnabled: { type: Boolean, default: false },
  backupRetentionDays: { type: Number, default: 30 },
  backupFrequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
  lastBackupAt: { type: Date, default: null },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  tags: { type: [String], default: [] },
  notes: { type: String, default: '' },
}, { timestamps: true });

databaseSchema.index({ userId: 1, name: 1 });
databaseSchema.index({ backupEnabled: 1 });

export default model<IDatabase>('Database', databaseSchema);
