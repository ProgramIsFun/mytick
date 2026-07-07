import DomainModel, { IDomain as MongoIDomain } from '../../models/Domain';
import { IDomain, IDomainRepository } from '../interfaces/IDomainRepository';

function toDomain(d: MongoIDomain): IDomain {
  return {
    id: d._id.toString(), userId: d.userId.toString(), name: d.name,
    projectId: d.projectId?.toString(), registrarAccountId: d.registrarAccountId?.toString(),
    dnsAccountId: d.dnsAccountId?.toString(), expiryDate: d.expiryDate || undefined,
    autoRenew: d.autoRenew, nameservers: d.nameservers, sslProvider: d.sslProvider,
    notes: d.notes, tags: d.tags, createdAt: d.createdAt, updatedAt: d.updatedAt,
  };
}

export class MongoDomainRepository implements IDomainRepository {
  async findById(id: string, userId?: string): Promise<IDomain | null> {
    const filter: any = { _id: id };
    if (userId) filter.userId = userId;
    const d = await DomainModel.findOne(filter)
      .populate('registrarAccountId', 'name provider')
      .populate('dnsAccountId', 'name provider')
      .populate('projectId', 'title type');
    return d ? toDomain(d) : null;
  }

  async findByUser(userId: string, options?: { tag?: string; search?: string; projectId?: string }): Promise<IDomain[]> {
    const filter: any = { userId };
    if (options?.tag) filter.tags = options.tag;
    if (options?.search) filter.name = { $regex: options.search, $options: 'i' };
    if (options?.projectId) filter.projectId = options.projectId;
    const domains = await DomainModel.find(filter)
      .populate('registrarAccountId', 'name provider')
      .populate('dnsAccountId', 'name provider')
      .populate('projectId', 'title type')
      .sort({ expiryDate: 1 });
    return domains.map(toDomain);
  }

  async create(data: Partial<IDomain>): Promise<IDomain> {
    const d = await DomainModel.create({
      userId: data.userId, name: data.name, projectId: data.projectId || null,
      registrarAccountId: data.registrarAccountId || null, dnsAccountId: data.dnsAccountId || null,
      expiryDate: data.expiryDate || null, autoRenew: data.autoRenew || false,
      nameservers: data.nameservers || [], sslProvider: data.sslProvider || '',
      notes: data.notes || '', tags: data.tags || [],
    });
    return toDomain(d);
  }

  async update(id: string, data: Partial<IDomain>): Promise<IDomain | null> {
    const d = await DomainModel.findById(id);
    if (!d) return null;
    const allowed = ['name', 'projectId', 'registrarAccountId', 'dnsAccountId', 'expiryDate', 'autoRenew', 'nameservers', 'sslProvider', 'notes', 'tags'];
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) (d as any)[key] = (data as any)[key];
    }
    await d.save();
    return toDomain(d);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const d = await DomainModel.findOneAndDelete({ _id: id, userId });
    return !!d;
  }
}
