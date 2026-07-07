import { nanoid } from 'nanoid';
import { getSession } from '../../neo4j';
import { ISecret, ISecretRepository } from '../interfaces/ISecretRepository';

export class Neo4jSecretRepository implements ISecretRepository {
  async findById(id: string, userId?: string): Promise<ISecret | null> {
    const session = getSession();
    try {
      const where = userId ? 'AND u.id = $userId' : '';
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(s:Secret {id: $id})
         WHERE 1=1 ${where}
         RETURN s`,
        { id, userId }
      );
      if (!result.records.length) return null;
      return recordToSecret(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async findByUser(userId: string, options?: { search?: string; provider?: string; type?: string; tag?: string }): Promise<ISecret[]> {
    const session = getSession();
    try {
      let where = 'WHERE u.id = $userId';
      const params: any = { userId };
      if (options?.search) { where += ' AND toLower(s.name) CONTAINS toLower($search)'; params.search = options.search; }
      if (options?.provider) { where += ' AND s.provider = $provider'; params.provider = options.provider; }
      if (options?.type) { where += ' AND s.type = $type'; params.type = options.type; }
      if (options?.tag) { where += ' AND $tag IN s.tags'; params.tag = options.tag; }

      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(s:Secret) ${where}
         RETURN s ORDER BY s.createdAt DESC`,
        params
      );
      return result.records.map(recordToSecret);
    } finally {
      await session.close();
    }
  }

  async create(data: Partial<ISecret>): Promise<ISecret> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(tx =>
        tx.run(
          `MATCH (u:User {id: $userId})
           CREATE (s:Secret {
             id: $id, name: $name, description: $description,
             provider: $provider, providerSecretId: $providerSecretId,
             type: $type, tags: $tags, expiresAt: $expiresAt,
             createdAt: datetime(), updatedAt: datetime()
           })
           MERGE (u)-[:OWNS]->(s)
           RETURN s`,
          {
            userId: data.userId, id, name: data.name, description: data.description || '',
            provider: data.provider, providerSecretId: data.providerSecretId,
            type: data.type, tags: data.tags || [], expiresAt: data.expiresAt || null,
          }
        )
      );
      return (await this.findById(id))!;
    } finally {
      await session.close();
    }
  }

  async update(id: string, data: Partial<ISecret>): Promise<ISecret | null> {
    const session = getSession();
    try {
      const props: string[] = ['s.updatedAt = datetime()'];
      const params: any = { id };
      const allowed = ['name', 'description', 'provider', 'providerSecretId', 'type', 'tags', 'expiresAt', 'lastRotatedAt'];
      for (const key of allowed) {
        if ((data as any)[key] !== undefined) {
          props.push(`s.${key} = $${key}`);
          params[key] = (data as any)[key];
        }
      }
      if (props.length === 1) return this.findById(id);
      await session.run(
        `MATCH (u:User)-[:OWNS]->(s:Secret {id: $id}) SET ${props.join(', ')}`,
        params
      );
      return this.findById(id);
    } finally {
      await session.close();
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(s:Secret {id: $id})
         DETACH DELETE s`,
        { id, userId }
      );
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally {
      await session.close();
    }
  }

  async touch(id: string, userId: string): Promise<ISecret | null> {
    const session = getSession();
    try {
      await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(s:Secret {id: $id})
         SET s.lastAccessedAt = datetime(), s.updatedAt = datetime()`,
        { id, userId }
      );
      return this.findById(id);
    } finally {
      await session.close();
    }
  }

  async findUsage(id: string, userId: string): Promise<{ usedBy: { collection: string; itemId: string; itemName: string }[] }> {
    const session = getSession();
    try {
      const dbResult = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(db:Database)-[:USES_SECRET]->(s:Secret {id: $id})
         RETURN db.id AS id, db.name AS name`,
        { id, userId }
      );
      const acctResult = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(a:Account)-[:HAS_CREDENTIAL]->(s:Secret {id: $id})
         RETURN a.id AS id, a.name AS name`,
        { id, userId }
      );
      const usedBy: { collection: string; itemId: string; itemName: string }[] = [];
      for (const r of dbResult.records) usedBy.push({ collection: 'databases', itemId: r.get('id'), itemName: r.get('name') });
      for (const r of acctResult.records) usedBy.push({ collection: 'accounts', itemId: r.get('id'), itemName: r.get('name') });
      return { usedBy };
    } finally {
      await session.close();
    }
  }
}

function recordToSecret(record: any): ISecret {
  const s = record.get('s').properties;
  return {
    id: s.id,
    userId: '',
    name: s.name,
    description: s.description,
    type: s.type,
    tags: s.tags || [],
    provider: s.provider,
    providerSecretId: s.providerSecretId,
    expiresAt: s.expiresAt ? new Date(s.expiresAt) : undefined,
    lastRotatedAt: s.lastRotatedAt ? new Date(s.lastRotatedAt) : undefined,
    lastAccessedAt: s.lastAccessedAt ? new Date(s.lastAccessedAt) : undefined,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
  };
}
