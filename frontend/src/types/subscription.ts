export interface Subscription {
  _id: string;
  name: string;
  provider: string;
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly' | 'quarterly' | 'weekly';
  nextBillingDate: string | null;
  expiryDate: string | null;
  autoRenew: boolean;
  status: 'active' | 'cancelled' | 'expired' | 'paused' | 'trial';
  category: string;
  paymentMethod: string;
  url: string;
  notes: string;
  tags: string[];
  createdAt: string;
}

export interface SubscriptionStats {
  total: number;
  totalMonthly: number;
  currency: string;
}
