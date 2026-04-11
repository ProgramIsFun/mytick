import mongoose, { Schema, Document } from 'mongoose';

export interface IAuthProvider {
  type: 'local' | 'google' | 'github';
  providerId: string; // email for local, OAuth UID for others
  passwordHash?: string;
}

export interface IUser extends Document {
  email: string;
  name: string;
  providers: IAuthProvider[];
  createdAt: Date;
}

const authProviderSchema = new Schema<IAuthProvider>({
  type: { type: String, required: true, enum: ['local', 'google', 'github'] },
  providerId: { type: String, required: true },
  passwordHash: { type: String },
}, { _id: false });

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  providers: { type: [authProviderSchema], default: [] },
}, { timestamps: true });

// Compound index for provider lookups
userSchema.index({ 'providers.type': 1, 'providers.providerId': 1 }, { unique: true, sparse: true });

export default mongoose.model<IUser>('User', userSchema);
