import { getSession } from '../../neo4j';
import { IContext, IContextRepository } from '../interfaces/IContextRepository';
import { nanoid } from 'nanoid';

export class Neo4jContextRepository implements IContextRepository {
  async findByUser(userId: string): Promise<IContext[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(c:Context)
         RETURN c ORDER BY c.key`,
        { userId }
      );
      return result.records.map(recordToContext);
    } finally { await session.close(); }
  }

  async findByKey(userId: string, key: string): Promise<IContext | null> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(c:Context {key: $key}) RETURN c`,
        { userId, key }
      );
      if (!result.records.length) return null;
      return recordToContext(result.records[0]);
    } finally { await session.close(); }
  }

  async upsert(userId: string, key: string, value: string): Promise<IContext> {
    const session = getSession();
    try {
      const id = nanoid();
      await session.run(
        `MATCH (u:User {id: $userId})
         MERGE (c:Context {key: $key, userId: $userId})
         ON CREATE SET c.id = $id, c.value = $value, c.updatedAt = datetime(), c.createdAt = datetime()
         ON MATCH SET c.value = $value, c.updatedAt = datetime()
         MERGE (u)-[:OWNS]->(c)`,
        { userId, key, value, id }
      );
      return (await this.findByKey(userId, key))!;
    } finally { await session.close(); }
  }

  async delete(userId: string, key: string): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(c:Context {key: $key})
         DETACH DELETE c`,
        { userId, key }
      );
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally { await session.close(); }
  }
}

function recordToContext(record: any): IContext {
  const c = record.get('c').properties;
  return { id: c.id, key: c.key, value: c.value, updatedAt: new Date(c.updatedAt) };
}
