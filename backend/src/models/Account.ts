import mongoose, { Schema, Document, Types } from 'mongoose';

export type ServiceProvider = 'mongodb_atlas' | 'firebase' | 'render' | 'aws' | 'stripe' | 'github' | 'custom';

export interface IAccount extends Document {
  userId: Types.ObjectId;
  name: string;
  provider: ServiceProvider;
  vaultId: string;        // Bitwarden item UUID for API keys / service credentials
  loginVaultId: string;   // Bitwarden item UUID for root account login (email + password)
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IAccount>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  provider: { type: String, enum: ['mongodb_atlas', 'firebase', 'render', 'aws', 'stripe', 'github', 'custom'], required: true },
  vaultId: { type: String, default: '' },
  loginVaultId: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model<IAccount>('Account', accountSchema);
