import { nanoid } from 'nanoid';
import { int } from 'neo4j-driver';
import { getSession } from '../../neo4j';
import { IBackupHistory, IBackupHistoryRepository } from '../interfaces/IBackupHistoryRepository';

export class Neo4jBackupHistoryRepository implements IBackupHistoryRepository {
  async findByDatabase(databaseId: string, userId: string, options?: { status?: string; limit?: number }): Promise<IBackupHistory[]> {
    const session = getSession();
    try {
      let where = 'WHERE db.id = $databaseId AND u.id = $userId';
      const params: any = { databaseId, userId };
      if (options?.status) { where += ' AND h.status = $status'; params.status = options.status; }
      const limit = options?.limit || 50;
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(db:Database {id: $databaseId})<-[:BACKUP_OF]-(h:BackupHistory)
         ${where}
         RETURN h, db {.id, .name, .type} AS database ORDER BY h.completedAt DESC LIMIT $limit`,
        { ...params, limit: int(limit) }
      );
      return result.records.map(recordToHistory);
    } finally { await session.close(); }
  }

  async findByUser(userId: string, options?: { status?: string; limit?: number }): Promise<IBackupHistory[]> {
    const session = getSession();
    try {
      let where = 'WHERE u.id = $userId';
      const params: any = { userId };
      if (options?.status) { where += ' AND h.status = $status'; params.status = options.status; }
      const limit = options?.limit || 50;
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(db:Database)<-[:BACKUP_OF]-(h:BackupHistory)
         ${where}
         OPTIONAL MATCH (h)-[:BACKUP_OF]->(db)
         RETURN h, db {.id, .name, .type} AS database
         ORDER BY h.completedAt DESC LIMIT $limit`,
        { ...params, limit: int(limit) }
      );
      return result.records.map(recordToHistory);
    } finally { await session.close(); }
  }

  async create(data: Partial<IBackupHistory>): Promise<IBackupHistory> {
    const session = getSession();
    const id = nanoid();
    try {
      const now = new Date().toISOString();
      const params: Record<string, unknown> = {
        databaseId: data.databaseId, userId: data.userId, id,
        status: data.status,
        startedAt: data.startedAt instanceof Date ? data.startedAt.toISOString() : data.startedAt,
        completedAt: data.completedAt instanceof Date ? data.completedAt.toISOString() : data.completedAt,
        durationMs: data.durationMs, sizeBytes: data.sizeBytes || 0,
        s3Path: data.s3Path, s3Bucket: data.s3Bucket, errorMessage: data.errorMessage || null,
        metadata: JSON.stringify(data.metadata || {}),
        triggeredBy: data.triggeredBy || 'scheduled', lambdaRequestId: data.lambdaRequestId || null,
        createdAt: now, updatedAt: now,
      };
      await session.executeWrite(tx =>
        tx.run(
          `MATCH (db:Database {id: $databaseId})
           MATCH (u:User {id: $userId})
           CREATE (h:BackupHistory {
             id: $id, status: $status, startedAt: $startedAt,
             completedAt: $completedAt, durationMs: $durationMs,
             sizeBytes: $sizeBytes, s3Path: $s3Path, s3Bucket: $s3Bucket,
             errorMessage: $errorMessage, metadata: $metadata,
             triggeredBy: $triggeredBy, lambdaRequestId: $lambdaRequestId,
             createdAt: $createdAt, updatedAt: $updatedAt
           })
           MERGE (h)-[:BACKUP_OF]->(db)
           RETURN h`,
          params
        )
      );

      return (await this.findByDatabase(data.databaseId as string, data.userId!)).find(h => true)!;
    } finally { await session.close(); }
  }
}

function recordToHistory(record: any): IBackupHistory {
  const h = record.get('h').properties || record.get('h');
  return {
    id: h.id, databaseId: '', userId: '', status: h.status,
    startedAt: new Date(h.startedAt), completedAt: new Date(h.completedAt),
    durationMs: typeof h.durationMs === 'number' ? h.durationMs : Number(h.durationMs),
    sizeBytes: typeof h.sizeBytes === 'number' ? h.sizeBytes : (h.sizeBytes ? Number(h.sizeBytes) : 0),
    s3Path: h.s3Path, s3Bucket: h.s3Bucket, errorMessage: h.errorMessage,
    metadata: typeof h.metadata === 'string' ? JSON.parse(h.metadata) : (h.metadata || {}),
    triggeredBy: h.triggeredBy, lambdaRequestId: h.lambdaRequestId,
    createdAt: new Date(h.createdAt), updatedAt: new Date(h.updatedAt),
  };
}
