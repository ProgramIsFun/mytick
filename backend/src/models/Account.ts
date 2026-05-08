import mongoose, { Schema, Document, Types } from 'mongoose';

export type ServiceProvider = 'mongodb_atlas' | 'firebase' | 'render' | 'aws' | 'stripe' | 'github' | 'banking' | 'email' | 'custom';

export interface ICredential {
  key: string;       // human label, e.g. "MONGODB_URI", "API_KEY"
  secretId: Types.ObjectId; // Reference to Secret collection
}

export interface IAccount extends Document {
  userId: Types.ObjectId;
  name: string;
  provider: ServiceProvider;
  parentAccountId: Types.ObjectId | null;
  url: string;
  username: string;
  notes: string;
  tags: string[];
  credentials: ICredential[];
  createdAt: Date;
  updatedAt: Date;
}

const credentialSchema = new Schema<ICredential>({
  key: { type: String, required: true },
  secretId: { type: Schema.Types.ObjectId, ref: 'Secret', required: true },
}, { _id: false });

const accountSchema = new Schema<IAccount>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  provider: { type: String, enum: ['mongodb_atlas', 'firebase', 'render', 'aws', 'stripe', 'github', 'banking', 'email', 'custom'], required: true },
  parentAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  url: { type: String, default: '', trim: true },
  username: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  tags: [{ type: String, trim: true }],
  credentials: [credentialSchema],
}, { timestamps: true });

// Indexes for common queries
accountSchema.index({ userId: 1, createdAt: -1 }); // List user's accounts
accountSchema.index({ userId: 1, provider: 1 }); // Filter by provider
accountSchema.index({ parentAccountId: 1 }); // Sub-account queries

export default mongoose.model<IAccount>('Account', accountSchema);
