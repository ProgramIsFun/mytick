import BackupHistoryModel, { IBackupHistory as MongoIBackupHistory } from '../../models/BackupHistory';
import { IBackupHistory, IBackupHistoryRepository } from '../interfaces/IBackupHistoryRepository';

function toDomain(b: MongoIBackupHistory): IBackupHistory {
  return {
    id: b._id.toString(), databaseId: b.databaseId.toString(), userId: b.userId.toString(),
    status: b.status, startedAt: b.startedAt, completedAt: b.completedAt,
    durationMs: b.durationMs, sizeBytes: b.sizeBytes, s3Path: b.s3Path, s3Bucket: b.s3Bucket,
    errorMessage: b.errorMessage, metadata: b.metadata, triggeredBy: b.triggeredBy,
    lambdaRequestId: b.lambdaRequestId, createdAt: b.createdAt, updatedAt: b.updatedAt,
  };
}

export class MongoBackupHistoryRepository implements IBackupHistoryRepository {
  async findByDatabase(databaseId: string, userId: string, options?: { status?: string; limit?: number }): Promise<IBackupHistory[]> {
    const filter: any = { databaseId, userId };
    if (options?.status) filter.status = options.status;
    const limit = options?.limit || 50;
    return (await BackupHistoryModel.find(filter).sort({ completedAt: -1 }).limit(limit).lean()).map(toDomain as any);
  }

  async findByUser(userId: string, options?: { status?: string; limit?: number }): Promise<IBackupHistory[]> {
    const filter: any = { userId };
    if (options?.status) filter.status = options.status;
    const limit = options?.limit || 50;
    return (await BackupHistoryModel.find(filter).sort({ completedAt: -1 }).limit(limit).populate('databaseId', 'name type').lean()).map(toDomain as any);
  }

  async create(data: Partial<IBackupHistory>): Promise<IBackupHistory> {
    const b = await BackupHistoryModel.create({
      databaseId: data.databaseId, userId: data.userId, status: data.status,
      startedAt: data.startedAt, completedAt: data.completedAt, durationMs: data.durationMs,
      sizeBytes: data.sizeBytes || 0, s3Path: data.s3Path, s3Bucket: data.s3Bucket,
      errorMessage: data.errorMessage, metadata: data.metadata || {},
      triggeredBy: data.triggeredBy || 'scheduled', lambdaRequestId: data.lambdaRequestId,
    });
    return toDomain(b);
  }
}
