import { Schema, model, Document, Types } from 'mongoose';

export interface ISecretRef {
  provider: 'bitwarden' | '1password' | 'lastpass' | 'vault' | 'aws_secrets' | 'custom';
  itemId: string;
  field?: string;
}

export interface IDatabase extends Document {
  userId: Types.ObjectId;
  name: string;
  type: 'mongodb' | 'postgres' | 'mysql' | 'redis' | 'sqlite' | 'other';
  secretRefs: ISecretRef[]; // Legacy - kept for backward compatibility
  secretId: Types.ObjectId | null; // New - reference to Secret collection
  host: string;
  port: number | null;
  database: string;
  backupEnabled: boolean;
  backupRetentionDays: number;
  backupFrequency: 'hourly' | '6hours' | 'daily' | 'weekly';
  lastBackupAt: Date | null;
  accountId: Types.ObjectId | null;
  tags: string[];
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const secretRefSchema = new Schema<ISecretRef>({
  provider: { type: String, enum: ['bitwarden', '1password', 'lastpass', 'vault', 'aws_secrets', 'custom'], required: true },
  itemId: { type: String, required: true },
  field: { type: String, default: '' },
}, { _id: false });

const databaseSchema = new Schema<IDatabase>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['mongodb', 'postgres', 'mysql', 'redis', 'sqlite', 'other'], required: true },
  secretRefs: { type: [secretRefSchema], default: [] }, // Legacy
  secretId: { type: Schema.Types.ObjectId, ref: 'Secret', default: null }, // New
  host: { type: String, default: '' },
  port: { type: Number, default: null },
  database: { type: String, default: '' },
  backupEnabled: { type: Boolean, default: false },
  backupRetentionDays: { type: Number, default: 30 },
  backupFrequency: { type: String, enum: ['hourly', '6hours', 'daily', 'weekly'], default: 'daily' },
  lastBackupAt: { type: Date, default: null },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  tags: { type: [String], default: [] },
  notes: { type: String, default: '' },
}, { timestamps: true });

databaseSchema.index({ userId: 1, name: 1 });
databaseSchema.index({ backupEnabled: 1 });
databaseSchema.index({ accountId: 1 }); // Account lookup
databaseSchema.index({ userId: 1, type: 1 }); // Filter by database type

export default model<IDatabase>('Database', databaseSchema);
