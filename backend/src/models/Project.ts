import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEnvMapping {
  target: string;       // e.g. "backend/.env", "Render dashboard"
  envVar: string;       // e.g. "MONGODB_URI"
  vaultId: string;      // Bitwarden item UUID for this specific value
}

export interface IProjectService {
  accountId: Types.ObjectId;  // points to Account
  role: string;               // e.g. "database", "auth", "hosting"
  mappings: IEnvMapping[];
}

export interface IProject extends Document {
  userId: Types.ObjectId;
  name: string;
  description: string;
  repoUrl: string;
  localPath: string;
  services: IProjectService[];
  members: { userId: Types.ObjectId; role: 'editor' | 'viewer' }[];
  createdAt: Date;
  updatedAt: Date;
}

const envMappingSchema = new Schema<IEnvMapping>({
  target: { type: String, required: true },
  envVar: { type: String, required: true },
  vaultId: { type: String, required: true },
}, { _id: false });

const projectServiceSchema = new Schema<IProjectService>({
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  role: { type: String, required: true },
  mappings: [envMappingSchema],
}, { _id: false });

// Architecture note:
// Bitwarden is flat — each item is one key-value pair.
// Account.credentials[] groups vault items that belong to the same service account.
// Project.services[].mappings[] maps vault items to env vars.
// This is provider-agnostic — any password manager that stores key-value pairs works.

const projectSchema = new Schema<IProject>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  repoUrl: { type: String, default: '' },
  localPath: { type: String, default: '' },
  services: [projectServiceSchema],
  members: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['editor', 'viewer'], default: 'viewer' },
  }],
}, { timestamps: true });

export default mongoose.model<IProject>('Project', projectSchema);
