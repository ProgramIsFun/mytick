import { nanoid } from 'nanoid';
import { getSession } from '../../neo4j';
import { IEnvFile } from '../../types/envFile';
import { IEnvFileRepository } from '../interfaces/IEnvFileRepository';

export class Neo4jEnvFileRepository implements IEnvFileRepository {
  async findById(id: string, userId?: string): Promise<IEnvFile | null> {
    const session = getSession();
    try {
      const where = userId ? 'AND u.id = $userId' : '';
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(r:Repo)-[:OWNS]->(e:EnvFile {id: $id})
         WHERE 1=1 ${where}
         RETURN e, r.id AS repoId`,
        { id, userId }
      );
      if (!result.records.length) return null;
      return recordToEnvFile(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async findByRepo(repoId: string, userId: string): Promise<IEnvFile[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(r:Repo {id: $repoId})-[:OWNS]->(e:EnvFile)
         RETURN e, r.id AS repoId
         ORDER BY e.path ASC`,
        { repoId, userId }
      );
      return result.records.map(recordToEnvFile);
    } finally {
      await session.close();
    }
  }

  async findByUser(userId: string): Promise<IEnvFile[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(r:Repo)-[:OWNS]->(e:EnvFile)
         RETURN e, r.id AS repoId
         ORDER BY e.createdAt DESC`,
        { userId }
      );
      return result.records.map(recordToEnvFile);
    } finally {
      await session.close();
    }
  }

  async create(data: Partial<IEnvFile>): Promise<IEnvFile> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(async tx => {
        await tx.run(
          `MATCH (r:Repo {id: $repoId})
           CREATE (e:EnvFile {
             id: $id, path: $path,
             createdAt: datetime(), updatedAt: datetime()
           })
           MERGE (r)-[:OWNS]->(e)
           RETURN e`,
          { id, path: data.path, repoId: data.repoId }
        );
      });
      return (await this.findById(id))!;
    } finally {
      await session.close();
    }
  }

  async update(id: string, data: Partial<IEnvFile>): Promise<IEnvFile | null> {
    const session = getSession();
    try {
      const sets: string[] = [];
      const params: Record<string, any> = { id };

      if (data.path !== undefined) {
        sets.push('e.path = $path');
        params.path = data.path;
      }

      if (sets.length === 0) return this.findById(id);

      sets.push('e.updatedAt = datetime()');

      await session.executeWrite(async tx => {
        await tx.run(
          `MATCH (r:Repo)-[:OWNS]->(e:EnvFile {id: $id})
           SET ${sets.join(', ')}`,
          params
        );
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
        `MATCH (u:User {id: $userId})-[:OWNS]->(r:Repo)-[:OWNS]->(e:EnvFile {id: $id})
         OPTIONAL MATCH (e)-[:HAS_ENV_VAR]->(v:EnvVar)
         DETACH DELETE e, v`,
        { id, userId }
      );
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally {
      await session.close();
    }
  }
}

function recordToEnvFile(record: any): IEnvFile {
  const e = record.get('e').properties;
  return {
    id: e.id,
    repoId: record.get('repoId') || '',
    path: e.path,
    createdAt: new Date(e.createdAt),
    updatedAt: new Date(e.updatedAt),
  };
}
