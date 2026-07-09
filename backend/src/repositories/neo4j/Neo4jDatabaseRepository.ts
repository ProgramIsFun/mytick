import { nanoid } from 'nanoid';
import { getSession } from '../../neo4j';
import { IDatabase, IDatabaseRepository } from '../interfaces/IDatabaseRepository';

export class Neo4jDatabaseRepository implements IDatabaseRepository {
  async findById(id: string, userId?: string): Promise<IDatabase | null> {
    const session = getSession();
    try {
      const where = userId ? 'AND u.id = $userId' : '';
      const result = await session.run(
         `MATCH (u:User)-[:OWNS]->(d:Database {id: $id})
          WHERE 1=1 ${where}
          OPTIONAL MATCH (d)-[:USES_SECRET]->(s:Secret)
          OPTIONAL MATCH (d)-[:MANAGED_BY]->(a:Account)
          RETURN d, s {.id, .name, .provider} AS secret,
                 a {.id, .name, .provider} AS account,
                 u {.id} AS owner`,
        { id, userId }
      );
      if (!result.records.length) return null;
      return recordToDatabase(result.records[0]);
    } finally { await session.close(); }
  }

  async findByUser(userId: string, options?: { search?: string; type?: string; backupEnabled?: boolean }): Promise<IDatabase[]> {
    const session = getSession();
    try {
      let where = 'WHERE u.id = $userId';
      const params: any = { userId };
      if (options?.search) { where += ' AND toLower(d.name) CONTAINS toLower($search)'; params.search = options.search; }
      if (options?.type) { where += ' AND d.type = $type'; params.type = options.type; }
      if (options?.backupEnabled !== undefined) { where += ' AND d.backupEnabled = $backupEnabled'; params.backupEnabled = options.backupEnabled; }
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(d:Database) ${where}
         OPTIONAL MATCH (d)-[:MANAGED_BY]->(a:Account)
         RETURN d, a {.id, .name, .provider} AS account
         ORDER BY d.createdAt DESC`,
        params
      );
      return result.records.map(r => recordToDatabaseSimple(r));
    } finally { await session.close(); }
  }

  async findBackupable(userId: string): Promise<IDatabase[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(d:Database {backupEnabled: true})
         OPTIONAL MATCH (d)-[:USES_SECRET]->(s:Secret)
         RETURN d, s {.id, .provider, .providerSecretId} AS secret`,
        { userId }
      );
      return result.records.map(r => recordToDatabaseSimple(r));
    } finally { await session.close(); }
  }

  async create(data: Partial<IDatabase>): Promise<IDatabase> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(tx =>
        tx.run(
          `MATCH (u:User {id: $userId})
           CREATE (d:Database {
             id: $id, name: $name, type: $type, host: $host, port: $port,
             databaseName: $databaseName, backupEnabled: $backupEnabled,
             backupRetentionDays: $backupRetentionDays, backupFrequency: $backupFrequency,
             tags: $tags, notes: $notes, createdAt: datetime(), updatedAt: datetime()
           })
           MERGE (u)-[:OWNS]->(d)`,
          {
            userId: data.userId, id, name: data.name, type: data.type, host: data.host || '',
            port: data.port || null, databaseName: data.databaseName || '',
            backupEnabled: data.backupEnabled || false, backupRetentionDays: data.backupRetentionDays || 30,
            backupFrequency: data.backupFrequency || 'daily', tags: data.tags || [], notes: data.notes || '',
          }
        )
      );
      if (data.secretId) {
        await session.run(`MATCH (d:Database {id: $id}), (s:Secret {id: $sid}) MERGE (d)-[:USES_SECRET]->(s)`, { id, sid: data.secretId });
      }
      if (data.accountId) {
        await session.run(`MATCH (d:Database {id: $id}), (a:Account {id: $aid}) MERGE (d)-[:MANAGED_BY]->(a)`, { id, aid: data.accountId });
      }
      return (await this.findById(id))!;
    } finally { await session.close(); }
  }

  async update(id: string, data: Partial<IDatabase>): Promise<IDatabase | null> {
    const session = getSession();
    try {
      const props: string[] = ['d.updatedAt = datetime()'];
      const params: any = { id };
      const allowed = ['name', 'type', 'host', 'port', 'databaseName', 'backupEnabled', 'backupRetentionDays', 'backupFrequency', 'tags', 'notes'];
      for (const key of allowed) {
        if ((data as any)[key] !== undefined) { props.push(`d.${key} = $${key}`); params[key] = (data as any)[key]; }
      }
      if (props.length > 1) {
        await session.run(`MATCH (u:User)-[:OWNS]->(d:Database {id: $id}) SET ${props.join(', ')}`, params);
      }
      if (data.secretId !== undefined) {
        await session.run(`MATCH (d:Database {id: $id})-[r:USES_SECRET]->() DELETE r`, { id });
        if (data.secretId) { await session.run(`MATCH (d:Database {id: $id}), (s:Secret {id: $sid}) MERGE (d)-[:USES_SECRET]->(s)`, { id, sid: data.secretId }); }
      }
      if (data.accountId !== undefined) {
        await session.run(`MATCH (d:Database {id: $id})-[r:MANAGED_BY]->() DELETE r`, { id });
        if (data.accountId) { await session.run(`MATCH (d:Database {id: $id}), (a:Account {id: $aid}) MERGE (d)-[:MANAGED_BY]->(a)`, { id, aid: data.accountId }); }
      }
      return this.findById(id);
    } finally { await session.close(); }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(`MATCH (u:User {id: $userId})-[:OWNS]->(d:Database {id: $id}) DETACH DELETE d`, { id, userId });
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally { await session.close(); }
  }

  async markBackupSuccess(id: string): Promise<IDatabase | null> {
    const session = getSession();
    try {
      await session.run(`MATCH (d:Database {id: $id}) SET d.lastBackupAt = datetime()`, { id });
      return this.findById(id);
    } finally { await session.close(); }
  }
}

function recordToDatabase(record: any): IDatabase {
  const d = record.get('d').properties;
  const s = record.get('secret');
  const a = record.get('account');
  const owner = record.get('owner');
  return {
    id: d.id, userId: owner?.id || '', name: d.name, type: d.type, host: d.host, port: d.port,
    databaseName: d.databaseName, backupEnabled: d.backupEnabled,
    backupRetentionDays: d.backupRetentionDays, backupFrequency: d.backupFrequency,
    lastBackupAt: d.lastBackupAt ? new Date(d.lastBackupAt) : null,
    secretId: s?.id || null, accountId: a?.id || null,
    tags: d.tags || [], notes: d.notes,
    createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt),
  };
}

function recordToDatabaseSimple(record: any, key = 'd'): IDatabase {
  const d = record.get(key).properties || record.get(key);
  return {
    id: d.id, userId: '', name: d.name, type: d.type, host: d.host, port: d.port,
    databaseName: d.databaseName, backupEnabled: d.backupEnabled,
    backupRetentionDays: d.backupRetentionDays, backupFrequency: d.backupFrequency,
    lastBackupAt: d.lastBackupAt ? new Date(d.lastBackupAt) : null,
    tags: d.tags || [], notes: d.notes,
    createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt),
  };
}
