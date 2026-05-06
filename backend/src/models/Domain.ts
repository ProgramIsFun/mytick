import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDomain extends Document {
  userId: Types.ObjectId;
  name: string;
  projectId: Types.ObjectId | null;
  registrarAccountId: Types.ObjectId | null;
  dnsAccountId: Types.ObjectId | null;
  expiryDate: Date | null;
  autoRenew: boolean;
  nameservers: string[];
  sslProvider: string;
  notes: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const domainSchema = new Schema<IDomain>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
  registrarAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  dnsAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  expiryDate: { type: Date, default: null },
  autoRenew: { type: Boolean, default: false },
  nameservers: [{ type: String, trim: true }],
  sslProvider: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  tags: [{ type: String, trim: true }],
}, { timestamps: true });

// Indexes for common queries
domainSchema.index({ userId: 1, createdAt: -1 }); // List user's domains
domainSchema.index({ projectId: 1 }); // Project lookup
domainSchema.index({ registrarAccountId: 1 }); // Account lookup
domainSchema.index({ dnsAccountId: 1 }); // DNS account lookup
domainSchema.index({ userId: 1, expiryDate: 1 }); // Expiry tracking

export default mongoose.model<IDomain>('Domain', domainSchema);
