import SubscriptionModel, { ISubscription as MongoISubscription } from '../../models/Subscription';
import { ISubscription, ISubscriptionRepository } from '../interfaces/ISubscriptionRepository';

function toDomain(s: MongoISubscription): ISubscription {
  return {
    id: s._id.toString(), userId: s.userId.toString(), name: s.name,
    provider: s.provider, amount: s.amount, currency: s.currency,
    billingCycle: s.billingCycle, nextBillingDate: s.nextBillingDate,
    expiryDate: s.expiryDate, autoRenew: s.autoRenew, status: s.status,
    category: s.category, paymentMethod: s.paymentMethod, url: s.url,
    notes: s.notes, tags: s.tags, createdAt: s.createdAt, updatedAt: s.updatedAt,
  };
}

export class MongoSubscriptionRepository implements ISubscriptionRepository {
  async findById(id: string, userId?: string): Promise<ISubscription | null> {
    const filter: any = { _id: id };
    if (userId) filter.userId = userId;
    const s = await SubscriptionModel.findOne(filter);
    return s ? toDomain(s) : null;
  }

  async findByUser(userId: string, options?: { status?: string; category?: string; tag?: string; search?: string }): Promise<ISubscription[]> {
    const filter: any = { userId };
    if (options?.status) filter.status = options.status;
    if (options?.category) filter.category = options.category;
    if (options?.tag) filter.tags = options.tag;
    if (options?.search) filter.name = { $regex: options.search, $options: 'i' };
    return (await SubscriptionModel.find(filter).sort({ nextBillingDate: 1 })).map(toDomain);
  }

  async findActiveByUser(userId: string): Promise<ISubscription[]> {
    return (await SubscriptionModel.find({ userId, status: 'active' })).map(toDomain);
  }

  async create(data: Partial<ISubscription>): Promise<ISubscription> {
    const s = await SubscriptionModel.create({
      userId: data.userId, name: data.name, provider: data.provider, amount: data.amount,
      currency: data.currency || 'USD', billingCycle: data.billingCycle,
      nextBillingDate: data.nextBillingDate || null, expiryDate: data.expiryDate || null,
      autoRenew: data.autoRenew ?? false, status: data.status || 'active',
      category: data.category || '', paymentMethod: data.paymentMethod || '',
      url: data.url || '', notes: data.notes || '', tags: data.tags || [],
    });
    return toDomain(s);
  }

  async update(id: string, data: Partial<ISubscription>): Promise<ISubscription | null> {
    const s = await SubscriptionModel.findById(id);
    if (!s) return null;
    const allowed = ['name', 'provider', 'amount', 'currency', 'billingCycle', 'nextBillingDate', 'expiryDate', 'autoRenew', 'status', 'category', 'paymentMethod', 'url', 'notes', 'tags'];
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) (s as any)[key] = (data as any)[key];
    }
    await s.save();
    return toDomain(s);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const s = await SubscriptionModel.findOneAndDelete({ _id: id, userId });
    return !!s;
  }
}
