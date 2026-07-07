import DatabaseModel, { IDatabase as MongoIDatabase } from '../../models/Database';
import { IDatabase, IDatabaseRepository } from '../interfaces/IDatabaseRepository';

function toDomain(d: MongoIDatabase): IDatabase {
  return {
    id: d._id.toString(), userId: d.userId.toString(), name: d.name, type: d.type,
    secretId: d.secretId?.toString(), host: d.host, port: d.port, databaseName: d.database,
    backupEnabled: d.backupEnabled, backupRetentionDays: d.backupRetentionDays,
    backupFrequency: d.backupFrequency, lastBackupAt: d.lastBackupAt,
    accountId: d.accountId?.toString(), tags: d.tags, notes: d.notes,
    createdAt: d.createdAt, updatedAt: d.updatedAt,
  };
}

export class MongoDatabaseRepository implements IDatabaseRepository {
  async findById(id: string, userId?: string): Promise<IDatabase | null> {
    const filter: any = { _id: id };
    if (userId) filter.userId = userId;
    const d = await DatabaseModel.findOne(filter)
      .populate('accountId', 'name provider')
      .populate('secretId');
    return d ? toDomain(d) : null;
  }

  async findByUser(userId: string, options?: { search?: string; type?: string; backupEnabled?: boolean }): Promise<IDatabase[]> {
    const filter: any = { userId };
    if (options?.search) filter.name = { $regex: options.search, $options: 'i' };
    if (options?.type) filter.type = options.type;
    if (options?.backupEnabled !== undefined) filter.backupEnabled = options.backupEnabled;
    const dbs = await DatabaseModel.find(filter)
      .populate('accountId', 'name provider')
      .sort({ createdAt: -1 });
    return dbs.map(toDomain);
  }

  async findBackupable(userId: string): Promise<IDatabase[]> {
    const dbs = await DatabaseModel.find({ userId, backupEnabled: true })
      .select('name type secretId backupRetentionDays backupFrequency lastBackupAt')
      .populate('secretId');
    return dbs.map(toDomain);
  }

  async create(data: Partial<IDatabase>): Promise<IDatabase> {
    const d = await DatabaseModel.create({
      userId: data.userId, name: data.name, type: data.type,
      secretId: data.secretId || null, host: data.host || '', port: data.port || null,
      database: data.databaseName || '', backupEnabled: data.backupEnabled || false,
      backupRetentionDays: data.backupRetentionDays || 30, backupFrequency: data.backupFrequency || 'daily',
      accountId: data.accountId || null, tags: data.tags || [], notes: data.notes || '',
    });
    return toDomain(d);
  }

  async update(id: string, data: Partial<IDatabase>): Promise<IDatabase | null> {
    const d = await DatabaseModel.findById(id);
    if (!d) return null;
    const allowed = ['name', 'type', 'secretId', 'host', 'port', 'databaseName', 'backupEnabled', 'backupRetentionDays', 'backupFrequency', 'accountId', 'tags', 'notes'];
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) {
        const mKey = key === 'databaseName' ? 'database' : key;
        (d as any)[mKey] = (data as any)[key];
      }
    }
    await d.save();
    return toDomain(d);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const d = await DatabaseModel.findOneAndDelete({ _id: id, userId });
    return !!d;
  }

  async markBackupSuccess(id: string): Promise<IDatabase | null> {
    const d = await DatabaseModel.findByIdAndUpdate(id, { lastBackupAt: new Date() }, { new: true });
    return d ? toDomain(d) : null;
  }
}
