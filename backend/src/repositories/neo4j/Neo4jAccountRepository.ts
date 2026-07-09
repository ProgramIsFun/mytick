import { nanoid } from 'nanoid';
import { getSession } from '../../neo4j';
import { IAccount, IAccountRepository } from '../interfaces/IAccountRepository';

export class Neo4jAccountRepository implements IAccountRepository {
  async findById(id: string, userId?: string): Promise<IAccount | null> {
    const session = getSession();
    try {
      const where = userId ? 'AND u.id = $userId' : '';
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(a:Account {id: $id})
         WHERE 1=1 ${where}
         OPTIONAL MATCH (parent:Account)-[:PARENT_OF]->(a)
         OPTIONAL MATCH (a)-[:PARENT_OF]->(sub:Account)
         OPTIONAL MATCH (a)-[:HAS_CREDENTIAL]->(s:Secret)
         RETURN u.id AS userId, a, parent.id AS parentAccountId,
                collect(DISTINCT sub.id) AS subAccounts,
                collect(DISTINCT s {.id, .name}) AS secrets`,
        { id, userId }
      );
      if (!result.records.length) return null;
      return recordToAccount(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async findByUser(userId: string): Promise<IAccount[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(a:Account)
         OPTIONAL MATCH (parent:Account)-[:PARENT_OF]->(a)
         OPTIONAL MATCH (a)-[:HAS_CREDENTIAL]->(s:Secret)
         RETURN u.id AS userId, a, parent.id AS parentAccountId,
                collect(s {.id, .name}) AS secrets
         ORDER BY a.createdAt DESC`,
        { userId }
      );
      return result.records.map(recordToAccount);
    } finally {
      await session.close();
    }
  }

  async findSubAccounts(parentId: string): Promise<IAccount[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (a:Account {id: $parentId})-[:PARENT_OF]->(sub:Account)
         OPTIONAL MATCH (parent:Account)-[:PARENT_OF]->(sub)
         RETURN '' AS userId, sub, parent.id AS parentAccountId
         ORDER BY sub.createdAt DESC`,
        { parentId }
      );
      return result.records.map(r => recordToAccountSimple(r, 'sub'));
    } finally {
      await session.close();
    }
  }

  async create(data: Partial<IAccount>): Promise<IAccount> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(async tx => {
        await tx.run(
          `MATCH (u:User {id: $userId})
           CREATE (a:Account {
             id: $id, name: $name, provider: $provider,
             url: $url, username: $username, notes: $notes,
             tags: $tags, createdAt: datetime(), updatedAt: datetime()
           })
           MERGE (u)-[:OWNS]->(a)
           RETURN a`,
          {
            userId: data.userId, id, name: data.name, provider: data.provider,
            url: data.url || '', username: data.username || '', notes: data.notes || '',
            tags: data.tags || [],
          }
        );
        if (data.parentAccountId) {
          await tx.run(
            `MATCH (a:Account {id: $id}), (parent:Account {id: $parentId})
             MERGE (parent)-[:PARENT_OF]->(a)`,
            { id, parentId: data.parentAccountId }
          );
        }
        if (data.credentials && data.credentials.length > 0) {
          for (const cred of data.credentials) {
            if (cred.secretId) {
              await tx.run(
                `MATCH (a:Account {id: $aid}), (s:Secret {id: $sid})
                 MERGE (a)-[:HAS_CREDENTIAL]->(s)`,
                { aid: id, sid: cred.secretId }
              );
            }
          }
        }
      });
      return (await this.findById(id))!;
    } finally {
      await session.close();
    }
  }

  async update(id: string, data: Partial<IAccount>): Promise<IAccount | null> {
    const session = getSession();
    try {
      await session.executeWrite(async tx => {
        const props: string[] = ['a.updatedAt = datetime()'];
        const params: any = { id };
        const allowed = ['name', 'provider', 'url', 'username', 'notes', 'tags'];
        for (const key of allowed) {
          if ((data as any)[key] !== undefined) {
            props.push(`a.${key} = $${key}`);
            params[key] = (data as any)[key];
          }
        }
        await tx.run(
          `MATCH (u:User)-[:OWNS]->(a:Account {id: $id}) SET ${props.join(', ')}`,
          params
        );
        if (data.parentAccountId !== undefined) {
          await tx.run(
            `MATCH (a:Account {id: $id})-[r:PARENT_OF]-() DELETE r`,
            { id }
          );
          if (data.parentAccountId) {
            await tx.run(
              `MATCH (a:Account {id: $id}), (p:Account {id: $parent}) MERGE (p)-[:PARENT_OF]->(a)`,
              { id, parent: data.parentAccountId }
            );
          }
        }
      });
      return this.findById(id);
    } finally {
      await session.close();
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(a:Account {id: $id})
         DETACH DELETE a`,
        { id, userId }
      );
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally {
      await session.close();
    }
  }
}

function recordToAccount(record: any): IAccount {
  const a = record.get('a').properties || record.get('a');
  return {
    id: a.id,
    userId: record.get('userId') || '',
    parentAccountId: record.get('parentAccountId') || undefined,
    name: a.name,
    provider: a.provider,
    url: a.url || undefined,
    username: a.username || undefined,
    notes: a.notes || undefined,
    tags: a.tags || [],
    credentials: record.get('secrets')?.filter((s: any) => s?.id).map((s: any) => ({ key: '', secretId: s.id })) || [],
    createdAt: new Date(a.createdAt),
    updatedAt: new Date(a.updatedAt),
  };
}

function recordToAccountSimple(record: any, key = 'a'): IAccount {
  const props = record.get(key).properties || record.get(key);
  return {
    id: props.id,
    userId: record.get('userId') || '',
    parentAccountId: record.get('parentAccountId') || undefined,
    name: props.name,
    provider: props.provider,
    url: props.url || undefined,
    username: props.username || undefined,
    notes: props.notes || undefined,
    tags: props.tags || [],
    createdAt: new Date(props.createdAt),
    updatedAt: new Date(props.updatedAt),
  };
}
