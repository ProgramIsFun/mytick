import { nanoid } from 'nanoid';
import { getSession } from '../../neo4j';
import { IRepo } from '../../types/repo';
import { IRepoRepository } from '../interfaces/IRepoRepository';

export class Neo4jRepoRepository implements IRepoRepository {
  async findById(id: string, userId?: string): Promise<IRepo | null> {
    const session = getSession();
    try {
      const where = userId ? 'AND u.id = $userId' : '';
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(r:Repo {id: $id})
         WHERE 1=1 ${where}
         RETURN r, u.id AS userId`,
        { id, userId }
      );
      if (!result.records.length) return null;
      return recordToRepo(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async findByUser(userId: string): Promise<IRepo[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(r:Repo)
         RETURN r, u.id AS userId
         ORDER BY r.createdAt DESC`,
        { userId }
      );
      return result.records.map(recordToRepo);
    } finally {
      await session.close();
    }
  }

  async findByUrl(userId: string, url: string): Promise<IRepo | null> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(r:Repo {url: $url})
         RETURN r, u.id AS userId`,
        { userId, url }
      );
      if (!result.records.length) return null;
      return recordToRepo(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async create(data: Partial<IRepo>): Promise<IRepo> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(async tx => {
        await tx.run(
          `MATCH (u:User {id: $userId})
           CREATE (r:Repo {
             id: $id, url: $url,
             createdAt: datetime(), updatedAt: datetime()
           })
           MERGE (u)-[:OWNS]->(r)
           RETURN r`,
          { userId: data.userId, id, url: data.url }
        );
      });
      return (await this.findById(id))!;
    } finally {
      await session.close();
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(r:Repo {id: $id})
         DETACH DELETE r`,
        { id, userId }
      );
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally {
      await session.close();
    }
  }

  async findTasksByRepo(repoId: string, userId: string): Promise<any[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(t:Task)-[:IN_REPO]->(r:Repo {id: $repoId})
         RETURN t { .id, .title, .status, .type, .tags }`,
        { repoId, userId }
      );
      return result.records.map(r => r.get('t'));
    } finally {
      await session.close();
    }
  }

  async addRepoToTask(taskId: string, repoId: string): Promise<void> {
    const session = getSession();
    try {
      await session.executeWrite(async tx => {
        await tx.run(
          `MATCH (t:Task {id: $taskId}), (r:Repo {id: $repoId})
           MERGE (t)-[:IN_REPO]->(r)`,
          { taskId, repoId }
        );
      });
    } finally {
      await session.close();
    }
  }

  async removeRepoFromTask(taskId: string, repoId: string): Promise<void> {
    const session = getSession();
    try {
      await session.executeWrite(async tx => {
        await tx.run(
          `MATCH (t:Task {id: $taskId})-[rel:IN_REPO]->(r:Repo {id: $repoId})
           DELETE rel`,
          { taskId, repoId }
        );
      });
    } finally {
      await session.close();
    }
  }

  async getReposByTask(taskId: string): Promise<IRepo[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (t:Task {id: $taskId})-[:IN_REPO]->(r:Repo)
         MATCH (u:User)-[:OWNS]->(r)
         RETURN r, u.id AS userId`,
        { taskId }
      );
      return result.records.map(recordToRepo);
    } finally {
      await session.close();
    }
  }
}

function recordToRepo(record: any): IRepo {
  const r = record.get('r').properties || record.get('r');
  return {
    id: r.id,
    userId: record.get('userId') || '',
    url: r.url,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  };
}
