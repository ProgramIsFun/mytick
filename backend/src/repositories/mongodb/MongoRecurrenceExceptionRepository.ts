import RecurrenceExceptionModel from '../../models/RecurrenceException';
import { IRecurrenceException, IRecurrenceExceptionRepository } from '../interfaces/IRecurrenceExceptionRepository';

function toDomain(e: any): IRecurrenceException {
  return {
    id: e._id.toString(),
    taskId: e.taskId.toString(),
    date: e.date,
    status: e.status,
    title: e.title,
    description: e.description,
    newDate: e.newDate,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export class MongoRecurrenceExceptionRepository implements IRecurrenceExceptionRepository {
  async findByTaskAndDateRange(taskIds: string[], from: Date, to: Date): Promise<IRecurrenceException[]> {
    const docs = await RecurrenceExceptionModel.find({
      taskId: { $in: taskIds },
      date: { $gte: from, $lte: to },
    });
    return docs.map(toDomain);
  }

  async upsert(taskId: string, date: Date, data: Partial<IRecurrenceException>): Promise<IRecurrenceException> {
    const update: any = {};
    if (data.status) update.status = data.status;
    if (data.title !== undefined) update.title = data.title || undefined;
    if (data.description !== undefined) update.description = data.description || undefined;
    if (data.newDate !== undefined) update.newDate = data.newDate;
    const doc = await RecurrenceExceptionModel.findOneAndUpdate(
      { taskId: taskId as any, date },
      update,
      { upsert: true, new: true },
    );
    return toDomain(doc!);
  }

  async delete(taskId: string, date: Date): Promise<boolean> {
    const result = await RecurrenceExceptionModel.deleteOne({ taskId: taskId as any, date });
    return result.deletedCount > 0;
  }

  async deleteByTask(taskId: string, dateFrom?: Date): Promise<number> {
    const filter: any = { taskId: taskId as any };
    if (dateFrom) filter.date = { $gte: dateFrom };
    const result = await RecurrenceExceptionModel.deleteMany(filter);
    return result.deletedCount;
  }
}
