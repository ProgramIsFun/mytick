import GroupModel, { IGroup as MongoIGroup } from '../../models/Group';
import { IGroup, IGroupRepository } from '../interfaces/IGroupRepository';

function toDomain(g: MongoIGroup): IGroup {
  return {
    id: g._id.toString(),
    ownerId: g.ownerId.toString(),
    name: g.name,
    members: g.members.map(m => ({ userId: m.userId.toString(), role: m.role as 'editor' | 'viewer' })),
    createdAt: g.createdAt,
  };
}

export class MongoGroupRepository implements IGroupRepository {
  async findById(id: string): Promise<IGroup | null> {
    const g = await GroupModel.findById(id);
    return g ? toDomain(g) : null;
  }

  async findByUser(userId: string): Promise<IGroup[]> {
    const groups = await GroupModel.find({
      $or: [{ ownerId: userId }, { 'members.userId': userId }],
    }).lean();
    return groups.map(toDomain as any);
  }

  async create(data: Partial<IGroup>): Promise<IGroup> {
    const g = await GroupModel.create({
      name: data.name,
      ownerId: data.ownerId,
      members: data.members || [],
    });
    return toDomain(g);
  }

  async delete(id: string): Promise<boolean> {
    const g = await GroupModel.findByIdAndDelete(id);
    return !!g;
  }

  async addMember(groupId: string, userId: string, role: 'editor' | 'viewer'): Promise<void> {
    await GroupModel.updateOne(
      { _id: groupId, 'members.userId': { $ne: userId } },
      { $push: { members: { userId, role } } }
    );
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await GroupModel.updateOne(
      { _id: groupId },
      { $pull: { members: { userId } } }
    );
  }

  async getUserGroupIds(userId: string): Promise<string[]> {
    const groups = await GroupModel.find({ 'members.userId': userId }).select('_id');
    return groups.map(g => g._id.toString());
  }
}
