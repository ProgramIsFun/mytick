import { nanoid } from 'nanoid';
import { int } from 'neo4j-driver';
import { getSession } from '../../neo4j';
import { IKnowledge, IKnowledgeRepository } from '../interfaces/IKnowledgeRepository';

export class Neo4jKnowledgeRepository implements IKnowledgeRepository {
  async findById(id: string, userId?: string): Promise<IKnowledge | null> {
    const session = getSession();
    try {
      const where = userId ? 'AND u.id = $userId' : '';
      const result = await session.run(`MATCH (u:User)-[:OWNS]->(k:Knowledge {id: $id}) WHERE 1=1 ${where} RETURN k`, { id, userId });
      if (!result.records.length) return null;
      return recordToKnowledge(result.records[0]);
    } finally { await session.close(); }
  }

  async findByUser(userId: string, options?: { search?: string; page?: number; limit?: number }): Promise<{ items: IKnowledge[]; total: number }> {
    const session = getSession();
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;
      let where = 'WHERE u.id = $userId';
      const params: any = { userId };
      if (options?.search) { where += ' AND toLower(k.content) CONTAINS toLower($search)'; params.search = options.search; }

      const countResult = await session.run(`MATCH (u:User)-[:OWNS]->(k:Knowledge) ${where} RETURN count(k) AS total`, params);
      const total = countResult.records[0]?.get('total').toNumber() || 0;

      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(k:Knowledge) ${where} RETURN k ORDER BY k.createdAt DESC SKIP $skip LIMIT $limit`,
        { ...params, skip: int(skip), limit: int(limit) }
      );
      return { items: result.records.map(recordToKnowledge), total };
    } finally { await session.close(); }
  }

  async create(data: Partial<IKnowledge>): Promise<IKnowledge> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(tx =>
        tx.run(
          `MATCH (u:User {id: $userId})
           CREATE (k:Knowledge {id: $id, content: $content, createdAt: datetime(), updatedAt: datetime()})
           MERGE (u)-[:OWNS]->(k)`,
          { userId: data.userId, id, content: data.content }
        )
      );
      return (await this.findById(id))!;
    } finally { await session.close(); }
  }

  async update(id: string, data: Partial<IKnowledge>): Promise<IKnowledge | null> {
    const session = getSession();
    try {
      if (data.content !== undefined) {
        await session.run(`MATCH (u:User)-[:OWNS]->(k:Knowledge {id: $id}) SET k.content = $content, k.updatedAt = datetime()`, { id, content: data.content });
      }
      return this.findById(id);
    } finally { await session.close(); }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(`MATCH (u:User {id: $userId})-[:OWNS]->(k:Knowledge {id: $id}) DETACH DELETE k`, { id, userId });
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally { await session.close(); }
  }
}

function recordToKnowledge(record: any): IKnowledge {
  const k = record.get('k').properties;
  return { id: k.id, userId: '', content: k.content, createdAt: new Date(k.createdAt), updatedAt: new Date(k.updatedAt) };
}
