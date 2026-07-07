export interface ISubscription {
  id: string;
  userId: string;
  name: string;
  provider: string;
  amount: number;
  currency: string;
  billingCycle: string;
  nextBillingDate?: Date | null;
  expiryDate?: Date | null;
  autoRenew: boolean;
  status: string;
  category?: string;
  paymentMethod?: string;
  url?: string;
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionRepository {
  findById(id: string, userId?: string): Promise<ISubscription | null>;
  findByUser(userId: string, options?: { status?: string; category?: string; tag?: string; search?: string }): Promise<ISubscription[]>;
  findActiveByUser(userId: string): Promise<ISubscription[]>;
  create(data: Partial<ISubscription>): Promise<ISubscription>;
  update(id: string, data: Partial<ISubscription>): Promise<ISubscription | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
