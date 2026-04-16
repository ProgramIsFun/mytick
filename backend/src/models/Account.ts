import mongoose, { Schema, Document, Types } from 'mongoose';

export type ServiceProvider = 'mongodb_atlas' | 'firebase' | 'render' | 'aws' | 'stripe' | 'github' | 'custom';

export interface ICredential {
  vaultId: string;   // Bitwarden item UUID (one key-value pair)
  key: string;       // human label, e.g. "MONGODB_URI", "API_KEY"
}

export interface IAccount extends Document {
  userId: Types.ObjectId;
  name: string;
  provider: ServiceProvider;
  loginVaultId: string;          // vault item for root login (email+pw)
  credentials: ICredential[];    // flat list of vault items belonging to this account
  createdAt: Date;
  updatedAt: Date;
}

const credentialSchema = new Schema<ICredential>({
  vaultId: { type: String, required: true },
  key: { type: String, required: true },
}, { _id: false });

const accountSchema = new Schema<IAccount>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  provider: { type: String, enum: ['mongodb_atlas', 'firebase', 'render', 'aws', 'stripe', 'github', 'custom'], required: true },
  loginVaultId: { type: String, default: '' },
  credentials: [credentialSchema],
}, { timestamps: true });

export default mongoose.model<IAccount>('Account', accountSchema);
