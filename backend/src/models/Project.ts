import mongoose, { Schema, Document, Types } from 'mongoose';

// Service types that can be auto-provisioned in the future
export type ServiceProvider = 'mongodb_atlas' | 'firebase' | 'render' | 'aws' | 'stripe' | 'custom';

export interface IEnvMapping {
  target: string;       // e.g. "backend/.env", "frontend/.env", "mobile/.env"
  envVar: string;       // e.g. "MONGODB_URI", "VITE_FIREBASE_API_KEY"
  vaultField: string;   // field name in the Bitwarden item
}

export interface IProjectAccount {
  vaultId: string;            // Bitwarden item UUID
  provider: ServiceProvider;  // what kind of service
  role: string;               // e.g. "database", "auth", "hosting", "payments"
  mappings: IEnvMapping[];    // how credentials map to env vars
}

export interface IProject extends Document {
  userId: Types.ObjectId;
  name: string;
  description: string;
  repoUrl: string;
  localPath: string;
  accounts: IProjectAccount[];
  createdAt: Date;
  updatedAt: Date;
}

const envMappingSchema = new Schema<IEnvMapping>({
  target: { type: String, required: true },
  envVar: { type: String, required: true },
  vaultField: { type: String, required: true },
}, { _id: false });

const projectAccountSchema = new Schema<IProjectAccount>({
  vaultId: { type: String, required: true },
  provider: { type: String, enum: ['mongodb_atlas', 'firebase', 'render', 'aws', 'stripe', 'custom'], required: true },
  role: { type: String, required: true },
  mappings: [envMappingSchema],
}, { _id: false });

// Architecture note:
// This model is designed so that in the future, a provisioning service can:
// 1. Create resources (Atlas DB, Firebase project, Render service) via provider APIs
// 2. Store credentials in Bitwarden, get back a vaultId
// 3. Create a Project with accounts[] pointing to those vaultIds
// 4. Auto-generate .env files from the mappings
// All without changing this schema.

const projectSchema = new Schema<IProject>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  repoUrl: { type: String, default: '' },
  localPath: { type: String, default: '' },
  accounts: [projectAccountSchema],
}, { timestamps: true });

export default mongoose.model<IProject>('Project', projectSchema);
