import { nanoid } from 'nanoid';
import TaskModel, { ITask as MongoITask } from '../../models/Task';
import GroupModel from '../../models/Group';
import RecurrenceExceptionModel from '../../models/RecurrenceException';
import { ITask, ITaskRepository } from '../interfaces/ITaskRepository';

function toDomain(t: MongoITask): ITask {
  return {
    _id: t._id.toString(),
    id: t._id.toString(),
    userId: t.userId.toString(),
    title: t.title,
    description: t.description,
    type: t.type,
    status: t.status,
    visibility: t.visibility,
    groupIds: t.groupIds?.map(g => g.toString()),
    shareToken: t.shareToken,
    blockedBy: t.blockedBy?.map(b => b.toString()),
    parentId: t.parentId?.toString(),
    deadline: t.deadline || undefined,
    tags: t.tags,
    pinned: t.pinned,
    descriptionHistory: t.descriptionHistory?.map(h => ({ description: h.description, savedAt: h.savedAt })),
    recurrence: t.recurrence ? {
      freq: t.recurrence.freq,
      interval: t.recurrence.interval,
      until: t.recurrence.until,
      count: t.recurrence.count,
      byDay: t.recurrence.byDay as string[],
    } : null,
    metadata: t.metadata,
    createdAt: t.createdAt,
    updatedAt: (t as any).updatedAt,
  };
}

export class MongoTaskRepository implements ITaskRepository {
  async findById(id: string, userId?: string): Promise<ITask | null> {
    const filter: any = { _id: id };
    if (userId) filter.userId = userId;
    const t = await TaskModel.findOne(filter);
    return t ? toDomain(t) : null;
  }

  async findByUser(userId: string, options?: {
    status?: string; type?: string; tag?: string; parentId?: string | null; pinned?: boolean; groupIds?: string[]; q?: string; page?: number; limit?: number; sort?: string;
  }): Promise<{ tasks: ITask[]; total: number }> {
    const filter: any = {};
    if (options?.groupIds?.length) {
      filter.$or = [
        { userId },
        { visibility: 'group', groupIds: { $in: options.groupIds } },
      ];
    } else {
      filter.userId = userId;
    }
    if (options?.status) filter.status = options.status;
    if (options?.type) filter.type = options.type;
    if (options?.tag) filter.tags = options.tag;
    if (options?.parentId !== undefined) filter.parentId = options.parentId;
    if (options?.pinned !== undefined) filter.pinned = options.pinned;
    if (options?.q) filter.title = { $regex: options.q, $options: 'i' };
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;
    const [tasks, total] = await Promise.all([
      TaskModel.find(filter).sort({ pinned: -1, createdAt: -1 }).skip(skip).limit(limit),
      TaskModel.countDocuments(filter),
    ]);
    return { tasks: tasks.map(toDomain), total };
  }

  async findByShareToken(shareToken: string): Promise<ITask | null> {
    const t = await TaskModel.findOne({ shareToken });
    return t ? toDomain(t) : null;
  }

  async findBlockedBy(taskId: string): Promise<ITask[]> {
    const tasks = await TaskModel.find({ blockedBy: taskId as any }).select('_id title status').sort({ createdAt: -1 });
    return tasks.map(t => ({ ...toDomain(t), description: undefined }));
  }

  async findSubtasks(parentId: string): Promise<ITask[]> {
    const tasks = await TaskModel.find({ parentId: parentId as any }).sort({ pinned: -1, createdAt: -1 });
    return tasks.map(toDomain);
  }

  async countByStatus(userId: string, groupIds?: string[]): Promise<Record<string, number>> {
    const filter: any = groupIds?.length ? {
      $or: [
        { userId },
        { visibility: 'group', groupIds: { $in: groupIds } },
      ],
    } : { userId };
    const statuses = ['pending', 'in_progress', 'on_hold', 'done', 'abandoned'] as const;
    const counts = await Promise.all(statuses.map(s => TaskModel.countDocuments({ ...filter, status: s })));
    const total = counts.reduce((a, b) => a + b, 0);
    return Object.fromEntries([['total', total], ...statuses.map((s, i) => [s, counts[i]])]);
  }

  async create(data: Partial<ITask>): Promise<ITask> {
    const task = await TaskModel.create({
      userId: data.userId,
      title: data.title,
      description: data.description || '',
      type: data.type || 'task',
      visibility: data.visibility || 'private',
      groupIds: data.groupIds || [],
      blockedBy: data.blockedBy || [],
      parentId: data.parentId || null,
      deadline: data.deadline || null,
      recurrence: data.recurrence || null,
      metadata: data.metadata || null,
      tags: data.tags || [],
      pinned: data.pinned || false,
      shareToken: nanoid(12),
    });
    return toDomain(task);
  }

  async update(id: string, data: Partial<ITask>): Promise<ITask | null> {
    const t = await TaskModel.findById(id);
    if (!t) return null;
    const allowed = ['title', 'description', 'status', 'visibility', 'groupIds', 'blockedBy', 'parentId', 'deadline', 'recurrence', 'type', 'metadata', 'tags', 'pinned'];
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) (t as any)[key] = (data as any)[key];
    }
    await t.save();
    return toDomain(t);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const t = await TaskModel.findOneAndDelete({ _id: id, userId });
    if (!t) return false;
    await TaskModel.updateMany({ blockedBy: t._id }, { $pull: { blockedBy: t._id } });
    await RecurrenceExceptionModel.deleteMany({ taskId: t._id });
    return true;
  }

  async findAllBlockedBy(): Promise<Array<{ id: string; blockedBy: string[] }>> {
    const tasks = await TaskModel.find({ blockedBy: { $exists: true, $ne: [] as any } }).select('_id blockedBy').lean();
    return tasks.map(t => ({
      id: t._id.toString(),
      blockedBy: t.blockedBy.map((b: any) => b.toString()),
    }));
  }

  async addDescriptionVersion(id: string, description: string): Promise<void> {
    await TaskModel.updateOne({ _id: id }, {
      $push: { descriptionHistory: { description, savedAt: new Date() } },
    });
  }

  async rollbackDescription(id: string, index: number): Promise<void> {
    const t = await TaskModel.findById(id);
    if (!t || index < 0 || index >= t.descriptionHistory.length) return;
    const restored = t.descriptionHistory[index].description;
    t.descriptionHistory.push({ description: t.description, savedAt: new Date() });
    t.description = restored;
    await t.save();
  }
}
