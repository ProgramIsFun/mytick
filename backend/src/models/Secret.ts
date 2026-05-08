import mongoose, { Schema, Document, Types } from 'mongoose';

export type SecretType = 'connection_string' | 'password' | 'api_key' | 'token' | 'certificate' | 'ssh_key' | 'other';
export type SecretProvider = 'bitwarden' | 'aws_secrets' | '1password' | 'vault' | 'lastpass' | 'custom';

export interface ISecret extends Document {
  userId: Types.ObjectId;
  
  // Identity
  name: string;
  description: string;
  type: SecretType;
  tags: string[];
  
  // Provider info
  provider: SecretProvider;
  providerSecretId: string;   // Bitwarden Secret ID, AWS ARN, etc.
  
  // Lifecycle
  expiresAt?: Date;
  lastRotatedAt?: Date;
  lastAccessedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const secretSchema = new Schema<ISecret>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Identity
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  type: { 
    type: String, 
    enum: ['connection_string', 'password', 'api_key', 'token', 'certificate', 'ssh_key', 'other'],
    required: true 
  },
  tags: [{ type: String, trim: true }],
  
  // Provider info
  provider: {
    type: String,
    enum: ['bitwarden', 'aws_secrets', '1password', 'vault', 'lastpass', 'custom'],
    required: true
  },
  providerSecretId: { type: String, required: true, trim: true },
  
  // Lifecycle
  expiresAt: { type: Date, default: null },
  lastRotatedAt: { type: Date, default: null },
  lastAccessedAt: { type: Date, default: null },
}, { timestamps: true });

// Indexes
secretSchema.index({ userId: 1, createdAt: -1 });
secretSchema.index({ userId: 1, provider: 1 });
secretSchema.index({ userId: 1, type: 1 });
secretSchema.index({ userId: 1, tags: 1 });
secretSchema.index({ providerSecretId: 1 });

export default mongoose.model<ISecret>('Secret', secretSchema);
