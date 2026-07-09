import { nanoid } from 'nanoid';
import { getSession } from '../../neo4j';
import { IGroup, IGroupRepository } from '../interfaces/IGroupRepository';

export class Neo4jGroupRepository implements IGroupRepository {
  async findById(id: string): Promise<IGroup | null> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (g:Group {id: $id})
         OPTIONAL MATCH (g)<-[:OWNS]-(o:User)
         OPTIONAL MATCH (g)-[r:HAS_MEMBER]->(m:User)
         RETURN g, o.id AS ownerId,
                collect(m {.id, .username, .name, role: r.role}) AS members`,
        { id }
      );
      if (!result.records.length) return null;
      return recordToGroup(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async findByUser(userId: string): Promise<IGroup[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(g:Group)
         OPTIONAL MATCH (g)-[r:HAS_MEMBER]->(m:User)
         RETURN g, u.id AS ownerId,
                collect(m {.id, .username, .name, role: r.role}) AS members`,
        { userId }
      );
      return result.records.map(recordToGroup);
    } finally {
      await session.close();
    }
  }

  async create(data: Partial<IGroup>): Promise<IGroup> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(tx =>
        tx.run(
          `MATCH (u:User {id: $ownerId})
           CREATE (g:Group {id: $id, name: $name, createdAt: datetime()})
           MERGE (u)-[:OWNS]->(g)
           MERGE (g)-[:HAS_MEMBER {role: 'editor'}]->(u)
           RETURN g`,
          { id, name: data.name, ownerId: data.ownerId }
        )
      );
      return (await this.findById(id))!;
    } finally {
      await session.close();
    }
  }

  async delete(id: string): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (g:Group {id: $id}) DETACH DELETE g`,
        { id }
      );
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally {
      await session.close();
    }
  }

  async addMember(groupId: string, userId: string, role: 'editor' | 'viewer'): Promise<void> {
    const session = getSession();
    try {
      await session.run(
        `MATCH (g:Group {id: $groupId}), (u:User {id: $userId})
         MERGE (g)-[r:HAS_MEMBER]->(u)
         SET r.role = $role`,
        { groupId, userId, role }
      );
    } finally {
      await session.close();
    }
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    const session = getSession();
    try {
      await session.run(
        `MATCH (g:Group {id: $groupId})-[r:HAS_MEMBER]->(u:User {id: $userId})
         DELETE r`,
        { groupId, userId }
      );
    } finally {
      await session.close();
    }
  }

  async getUserGroupIds(userId: string): Promise<string[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})<-[:HAS_MEMBER]-(g:Group)
         RETURN g.id AS id`,
        { userId }
      );
      return result.records.map(r => r.get('id'));
    } finally {
      await session.close();
    }
  }
}

function recordToGroup(record: any): IGroup {
  const g = record.get('g').properties;
  const members = (record.get('members') || []).filter((m: any) => m?.id).map((m: any) => ({
    userId: m.id,
    role: (m.role || 'viewer') as 'editor' | 'viewer',
    username: m.username,
    name: m.name,
  }));
  return {
    id: g.id,
    ownerId: record.get('ownerId') || '',
    name: g.name,
    members,
    createdAt: new Date(g.createdAt),
  };
}
