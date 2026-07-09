export interface IBackupHistory {
  id: string;
  databaseId: string | { id: string; name: string; type: string };
  userId: string;
  status: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  sizeBytes: number;
  s3Path: string;
  s3Bucket: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  triggeredBy: string;
  lambdaRequestId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBackupHistoryRepository {
  findByDatabase(databaseId: string, userId: string, options?: { status?: string; limit?: number }): Promise<IBackupHistory[]>;
  findByUser(userId: string, options?: { status?: string; limit?: number }): Promise<IBackupHistory[]>;
  create(data: Partial<IBackupHistory>): Promise<IBackupHistory>;
}
