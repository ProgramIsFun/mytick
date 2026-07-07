import AccountModel, { IAccount as MongoIAccount } from '../../models/Account';
import { IAccount, IAccountRepository } from '../interfaces/IAccountRepository';

function toDomain(a: MongoIAccount): IAccount {
  return {
    id: a._id.toString(),
    userId: a.userId.toString(),
    name: a.name,
    provider: a.provider,
    parentAccountId: a.parentAccountId?.toString(),
    url: a.url,
    username: a.username,
    notes: a.notes,
    tags: a.tags,
    credentials: a.credentials?.map(c => ({ key: c.key, secretId: c.secretId.toString() })),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export class MongoAccountRepository implements IAccountRepository {
  async findById(id: string, userId?: string): Promise<IAccount | null> {
    const filter: any = { _id: id };
    if (userId) filter.userId = userId;
    const a = await AccountModel.findOne(filter);
    return a ? toDomain(a) : null;
  }

  async findByUser(userId: string): Promise<IAccount[]> {
    const accounts = await AccountModel.find({ userId }).sort({ createdAt: -1 });
    return accounts.map(toDomain);
  }

  async findSubAccounts(parentId: string): Promise<IAccount[]> {
    const accounts = await AccountModel.find({ parentAccountId: parentId }).sort({ createdAt: -1 });
    return accounts.map(toDomain);
  }

  async create(data: Partial<IAccount>): Promise<IAccount> {
    const a = await AccountModel.create({
      userId: data.userId,
      name: data.name,
      provider: data.provider,
      parentAccountId: data.parentAccountId || null,
      url: data.url || '',
      username: data.username || '',
      notes: data.notes || '',
      tags: data.tags || [],
      credentials: data.credentials || [],
    });
    return toDomain(a);
  }

  async update(id: string, data: Partial<IAccount>): Promise<IAccount | null> {
    const a = await AccountModel.findById(id);
    if (!a) return null;
    const allowed = ['name', 'provider', 'parentAccountId', 'url', 'username', 'notes', 'tags', 'credentials'];
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) (a as any)[key] = (data as any)[key];
    }
    await a.save();
    return toDomain(a);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const a = await AccountModel.findOneAndDelete({ _id: id, userId });
    return !!a;
  }
}
