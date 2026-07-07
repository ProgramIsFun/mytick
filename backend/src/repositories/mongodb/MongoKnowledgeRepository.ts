import KnowledgeModel, { IKnowledge as MongoIKnowledge } from '../../models/Knowledge';
import { IKnowledge, IKnowledgeRepository } from '../interfaces/IKnowledgeRepository';

function toDomain(k: MongoIKnowledge): IKnowledge {
  return {
    id: k._id.toString(), userId: k.userId.toString(), content: k.content,
    createdAt: k.createdAt, updatedAt: (k as any).updatedAt,
  };
}

export class MongoKnowledgeRepository implements IKnowledgeRepository {
  async findById(id: string, userId?: string): Promise<IKnowledge | null> {
    const filter: any = { _id: id };
    if (userId) filter.userId = userId;
    const k = await KnowledgeModel.findOne(filter);
    return k ? toDomain(k) : null;
  }

  async findByUser(userId: string, options?: { search?: string; page?: number; limit?: number }): Promise<{ items: IKnowledge[]; total: number }> {
    const filter: any = { userId };
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;
    if (options?.search) {
      const words = options.search.split(/\s+/).filter(Boolean);
      filter.content = { $regex: words.join('.*'), $options: 'i' };
    }
    const [items, total] = await Promise.all([
      KnowledgeModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      KnowledgeModel.countDocuments(filter),
    ]);
    return { items: items.map(toDomain), total };
  }

  async create(data: Partial<IKnowledge>): Promise<IKnowledge> {
    const k = await KnowledgeModel.create({ userId: data.userId, content: data.content });
    return toDomain(k);
  }

  async update(id: string, data: Partial<IKnowledge>): Promise<IKnowledge | null> {
    const k = await KnowledgeModel.findById(id);
    if (!k) return null;
    if (data.content !== undefined) k.content = data.content;
    await k.save();
    return toDomain(k);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const k = await KnowledgeModel.findOneAndDelete({ _id: id, userId });
    return !!k;
  }
}
