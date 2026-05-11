import mongoose, { Schema, Document, Types } from 'mongoose';

export type BillingCycle = 'monthly' | 'yearly' | 'quarterly' | 'weekly';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'paused' | 'trial';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  name: string;
  provider: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: Date | null;
  expiryDate: Date | null;
  autoRenew: boolean;
  status: SubscriptionStatus;
  category: string;
  paymentMethod: string;
  url: string;
  notes: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  provider: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD', trim: true },
  billingCycle: { type: String, enum: ['monthly', 'yearly', 'quarterly', 'weekly'], required: true },
  nextBillingDate: { type: Date, default: null },
  expiryDate: { type: Date, default: null },
  autoRenew: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'cancelled', 'expired', 'paused', 'trial'], default: 'active' },
  category: { type: String, default: '', trim: true },
  paymentMethod: { type: String, default: '', trim: true },
  url: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  tags: [{ type: String, trim: true }],
}, { timestamps: true });

subscriptionSchema.index({ userId: 1, createdAt: -1 });
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ userId: 1, nextBillingDate: 1 });
subscriptionSchema.index({ userId: 1, expiryDate: 1 });

export default mongoose.model<ISubscription>('Subscription', subscriptionSchema);
