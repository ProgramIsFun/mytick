import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDomain extends Document {
  userId: Types.ObjectId;
  name: string;
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
  registrarAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  dnsAccountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
  expiryDate: { type: Date, default: null },
  autoRenew: { type: Boolean, default: false },
  nameservers: [{ type: String, trim: true }],
  sslProvider: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  tags: [{ type: String, trim: true }],
}, { timestamps: true });

export default mongoose.model<IDomain>('Domain', domainSchema);
