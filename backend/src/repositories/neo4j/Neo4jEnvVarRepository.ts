import { nanoid } from 'nanoid';
import { getSession } from '../../neo4j';
import { IEnvVar } from '../../types/envVar';
import { IEnvVarRepository } from '../interfaces/IEnvVarRepository';

export class Neo4jEnvVarRepository implements IEnvVarRepository {
  async findById(id: string, userId?: string): Promise<IEnvVar | null> {
    const session = getSession();
    try {
      const where = userId ? 'AND u.id = $userId' : '';
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(:Repo)-[:OWNS]->(e:EnvFile)-[:HAS_ENV_VAR]->(v:EnvVar {id: $id})
         WHERE 1=1 ${where}
         OPTIONAL MATCH (v)-[:USES_SECRET]->(s:Secret)
         RETURN v, e.id AS envFileId, s.id AS secretId`,
        { id, userId }
      );
      if (!result.records.length) return null;
      return recordToEnvVar(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async findByEnvFile(envFileId: string, userId: string): Promise<IEnvVar[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(:Repo)-[:OWNS]->(e:EnvFile {id: $envFileId})-[:HAS_ENV_VAR]->(v:EnvVar)
         OPTIONAL MATCH (v)-[:USES_SECRET]->(s:Secret)
         RETURN v, e.id AS envFileId, s.id AS secretId
         ORDER BY v.order ASC`,
        { envFileId, userId }
      );
      return result.records.map(recordToEnvVar);
    } finally {
      await session.close();
    }
  }

  async create(data: Partial<IEnvVar>): Promise<IEnvVar> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(async tx => {
        await tx.run(
          `MATCH (e:EnvFile {id: $envFileId})
           CREATE (v:EnvVar {
             id: $id, key: $key, value: $value,
             isSecret: $isSecret, comment: $comment, order: $order,
             createdAt: datetime(), updatedAt: datetime()
           })
           MERGE (e)-[:HAS_ENV_VAR]->(v)
           RETURN v`,
          {
            id, envFileId: data.envFileId,
            key: data.key, value: data.value || null,
            isSecret: data.isSecret || false,
            comment: data.comment || null,
            order: data.order ?? 0,
          }
        );
        if (data.secretId) {
          await tx.run(
            `MATCH (v:EnvVar {id: $id}), (s:Secret {id: $secretId})
             MERGE (v)-[:USES_SECRET]->(s)`,
            { id, secretId: data.secretId }
          );
        }
      });
      return (await this.findById(id))!;
    } finally {
      await session.close();
    }
  }

  async update(id: string, data: Partial<IEnvVar>): Promise<IEnvVar | null> {
    const session = getSession();
    try {
      const sets: string[] = [];
      const params: Record<string, any> = { id };
      const allowed = ['key', 'value', 'isSecret', 'comment', 'order'];

      for (const key of allowed) {
        if ((data as any)[key] !== undefined) {
          sets.push(`v.${key} = $${key}`);
          params[key] = (data as any)[key];
        }
      }

      if (sets.length === 0) return this.findById(id);
      sets.push('v.updatedAt = datetime()');

      await session.executeWrite(async tx => {
        await tx.run(
          `MATCH (e:EnvFile)-[:HAS_ENV_VAR]->(v:EnvVar {id: $id})
           SET ${sets.join(', ')}`,
          params
        );
        if (data.secretId !== undefined) {
          await tx.run(`MATCH (v:EnvVar {id: $id})-[r:USES_SECRET]->() DELETE r`, { id });
          if (data.secretId) {
            await tx.run(
              `MATCH (v:EnvVar {id: $id}), (s:Secret {id: $secretId})
               MERGE (v)-[:USES_SECRET]->(s)`,
              { id, secretId: data.secretId }
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
        `MATCH (u:User {id: $userId})-[:OWNS]->(:Repo)-[:OWNS]->(:EnvFile)-[:HAS_ENV_VAR]->(v:EnvVar {id: $id})
         DETACH DELETE v`,
        { id, userId }
      );
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally {
      await session.close();
    }
  }

  async deleteByEnvFile(envFileId: string, userId: string): Promise<number> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(:Repo)-[:OWNS]->(e:EnvFile {id: $envFileId})-[:HAS_ENV_VAR]->(v:EnvVar)
         DETACH DELETE v`,
        { envFileId, userId }
      );
      return result.summary.counters.updates().nodesDeleted;
    } finally {
      await session.close();
    }
  }
}

function recordToEnvVar(record: any): IEnvVar {
  const v = record.get('v').properties;
  return {
    id: v.id,
    envFileId: record.get('envFileId') || '',
    key: v.key,
    value: v.value ?? undefined,
    isSecret: v.isSecret,
    secretId: record.get('secretId') ?? undefined,
    comment: v.comment ?? undefined,
    order: v.order ?? 0,
    createdAt: new Date(v.createdAt),
    updatedAt: new Date(v.updatedAt),
  };
}
