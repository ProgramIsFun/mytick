import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEnvMapping {
  target: string;       // e.g. "backend/.env", "frontend/.env"
  envVar: string;       // e.g. "MONGODB_URI"
  vaultField: string;   // field name in the Bitwarden item
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
  createdAt: Date;
  updatedAt: Date;
}

const envMappingSchema = new Schema<IEnvMapping>({
  target: { type: String, required: true },
  envVar: { type: String, required: true },
  vaultField: { type: String, required: true },
}, { _id: false });

const projectServiceSchema = new Schema<IProjectService>({
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  role: { type: String, required: true },
  mappings: [envMappingSchema],
}, { _id: false });

// Architecture note:
// Project → services[] → accountId (Account model) → vaultId (Bitwarden)
// Account is a shared resource — multiple projects can reference the same account.
// To switch a project's account, change accountId. Mappings stay.
// To manage the account itself (rotate keys, login), use Account.vaultId / loginVaultId.

const projectSchema = new Schema<IProject>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  repoUrl: { type: String, default: '' },
  localPath: { type: String, default: '' },
  services: [projectServiceSchema],
}, { timestamps: true });

export default mongoose.model<IProject>('Project', projectSchema);
