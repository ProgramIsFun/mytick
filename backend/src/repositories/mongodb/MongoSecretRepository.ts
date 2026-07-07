import SecretModel, { ISecret as MongoISecret } from '../../models/Secret';
import DatabaseModel from '../../models/Database';
import AccountModel from '../../models/Account';
import { ISecret, ISecretRepository } from '../interfaces/ISecretRepository';

function toDomain(s: MongoISecret): ISecret {
  return {
    id: s._id.toString(),
    userId: s.userId.toString(),
    name: s.name,
    description: s.description,
    type: s.type,
    tags: s.tags,
    provider: s.provider,
    providerSecretId: s.providerSecretId,
    expiresAt: s.expiresAt,
    lastRotatedAt: s.lastRotatedAt,
    lastAccessedAt: s.lastAccessedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export class MongoSecretRepository implements ISecretRepository {
  async findById(id: string, userId?: string): Promise<ISecret | null> {
    const filter: any = { _id: id };
    if (userId) filter.userId = userId;
    const s = await SecretModel.findOne(filter);
    return s ? toDomain(s) : null;
  }

  async findByUser(userId: string, options?: { search?: string; provider?: string; type?: string; tag?: string }): Promise<ISecret[]> {
    const filter: any = { userId };
    if (options?.search) filter.name = { $regex: options.search, $options: 'i' };
    if (options?.provider) filter.provider = options.provider;
    if (options?.type) filter.type = options.type;
    if (options?.tag) filter.tags = options.tag;
    const secrets = await SecretModel.find(filter).sort({ createdAt: -1 });
    return secrets.map(toDomain);
  }

  async create(data: Partial<ISecret>): Promise<ISecret> {
    const s = await SecretModel.create({
      userId: data.userId,
      name: data.name,
      description: data.description || '',
      provider: data.provider,
      providerSecretId: data.providerSecretId,
      type: data.type,
      tags: data.tags || [],
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    });
    return toDomain(s);
  }

  async update(id: string, data: Partial<ISecret>): Promise<ISecret | null> {
    const s = await SecretModel.findById(id);
    if (!s) return null;
    const allowed = ['name', 'description', 'provider', 'providerSecretId', 'type', 'tags', 'expiresAt', 'lastRotatedAt'];
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) (s as any)[key] = (data as any)[key];
    }
    await s.save();
    return toDomain(s);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const s = await SecretModel.findOneAndDelete({ _id: id, userId });
    return !!s;
  }

  async touch(id: string, userId: string): Promise<ISecret | null> {
    const s = await SecretModel.findOneAndUpdate(
      { _id: id, userId },
      { lastAccessedAt: new Date() },
      { new: true }
    );
    return s ? toDomain(s) : null;
  }

  async findUsage(id: string, userId: string): Promise<{ usedBy: { collection: string; itemId: string; itemName: string }[] }> {
    const [dbUsage, accountUsage] = await Promise.all([
      DatabaseModel.findOne({ secretId: id, userId }).select('_id name'),
      AccountModel.findOne({ 'credentials.secretId': id, userId }).select('_id name'),
    ]);
    const usedBy: { collection: string; itemId: string; itemName: string }[] = [];
    if (dbUsage) usedBy.push({ collection: 'databases', itemId: dbUsage._id.toString(), itemName: dbUsage.name });
    if (accountUsage) usedBy.push({ collection: 'accounts', itemId: accountUsage._id.toString(), itemName: accountUsage.name });
    return { usedBy };
  }
}
