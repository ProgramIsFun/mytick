import { nanoid } from 'nanoid';
import { int } from 'neo4j-driver';
import { getSession } from '../../neo4j';
import { ITask, ITaskRepository } from '../interfaces/ITaskRepository';

export class Neo4jTaskRepository implements ITaskRepository {
  async findById(id: string, userId?: string): Promise<ITask | null> {
    const session = getSession();
    try {
      const where = userId ? 'AND u.id = $userId' : '';
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(t:Task {id: $id})
         WHERE 1=1 ${where}
         OPTIONAL MATCH (t)-[:BLOCKED_BY]->(b:Task)
         OPTIONAL MATCH (t)-[:PARENT_OF]->(sub:Task)
         OPTIONAL MATCH (t)-[:VISIBLE_TO]->(g:Group)
         OPTIONAL MATCH (t)-[:HAS_DESCRIPTION]->(d:TaskDescription)
         RETURN u.id AS userId, t, collect(DISTINCT b.id) AS blockedBy,
                collect(DISTINCT sub.id) AS subtasks,
                collect(DISTINCT g.id) AS groupIds,
                collect(DISTINCT d {.description, .savedAt}) AS descriptionHistory`,
        { id, userId }
      );
      if (!result.records.length) return null;
      return recordToTask(result.records[0], result.records[0].get('userId'));
    } finally {
      await session.close();
    }
  }

  async findByUser(userId: string, options?: {
    status?: string; excludeStatus?: string[]; type?: string; tag?: string; parentId?: string | null; pinned?: boolean; groupIds?: string[]; q?: string; page?: number; limit?: number; sort?: string;
  }): Promise<{ tasks: ITask[]; total: number }> {
    const session = getSession();
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const skip = (page - 1) * limit;
      const params: any = { userId };

      const filters: string[] = [];
      // Owned by user OR visible to user's groups
      const matchClauses: string[] = [`(u:User {id: $userId})-[:OWNS]->(t:Task)`];
      if (options?.groupIds?.length) {
        matchClauses.push(`(u:User {id: $userId})-[:MEMBER_OF]->(g:Group)<-[:VISIBLE_TO]-(t:Task)`);
      }

      if (options?.status) { filters.push('t.status = $status'); params.status = options.status; }
      if (options?.excludeStatus?.length) { filters.push('NOT t.status IN $excludeStatus'); params.excludeStatus = options.excludeStatus; }
      if (options?.type) { filters.push('t.type = $type'); params.type = options.type; }
      if (options?.tag) { filters.push('$tag IN t.tags'); params.tag = options.tag; }
      if (options?.parentId !== undefined) {
        filters.push(options.parentId ? 't.parentId = $parentId' : 't.parentId IS NULL');
        if (options.parentId) params.parentId = options.parentId;
      }
      if (options?.pinned !== undefined) { filters.push('t.pinned = $pinned'); params.pinned = options.pinned; }
      if (options?.q) { filters.push('toLower(t.title) CONTAINS toLower($q)'); params.q = options.q; }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      // Count query: UNION of personal + group-visible tasks
      const countParts = matchClauses.map(m => `MATCH ${m} ${where} RETURN count(DISTINCT t) AS total`);
      const countQuery = countParts.join(' UNION ALL ');
      const countResult = await session.run(countQuery, params);
      const total = countResult.records.reduce((s, r) => s + (r.get('total').toNumber() || 0), 0);

      // Data query: CALL subquery with UNION ALL (direct UNION ALL ignores SKIP/LIMIT)
      const dataParts = matchClauses.map(m => `MATCH ${m} ${where} RETURN u, t AS task`);
      const dataQuery = matchClauses.length > 1
        ? `CALL { ${dataParts.join(' UNION ALL ')} } RETURN u.id AS userId, task ORDER BY task.pinned DESC, task.createdAt DESC SKIP $skip LIMIT $limit`
        : `${dataParts[0]} RETURN u.id AS userId, task ORDER BY task.pinned DESC, task.createdAt DESC SKIP $skip LIMIT $limit`;

      const result = await session.run(dataQuery, { ...params, skip: int(skip), limit: int(limit) });
      return { tasks: result.records.map(r => recordToTaskSimple(r, 'task', r.get('userId'))), total };
    } finally {
      await session.close();
    }
  }

  async findByShareToken(shareToken: string): Promise<ITask | null> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(t:Task {shareToken: $shareToken})
         OPTIONAL MATCH (t)-[:BLOCKED_BY]->(b:Task)
         OPTIONAL MATCH (t)-[:HAS_DESCRIPTION]->(d:TaskDescription)
         RETURN u.id AS userId, t, collect(DISTINCT b.id) AS blockedBy,
                collect(DISTINCT d {.description, .savedAt}) AS descriptionHistory`,
        { shareToken }
      );
      if (!result.records.length) return null;
      return recordToTask(result.records[0], result.records[0].get('userId'));
    } finally {
      await session.close();
    }
  }

  async findBlockedBy(taskId: string): Promise<ITask[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (t:Task {id: $taskId})<-[:BLOCKED_BY]-(blocker:Task)
         RETURN '' AS userId, blocker`,
        { taskId }
      );
      return result.records.map(r => recordToTaskSimple(r, 'blocker', r.get('userId')));
    } finally {
      await session.close();
    }
  }

  async findSubtasks(parentId: string): Promise<ITask[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (parent:Task {id: $parentId})-[:PARENT_OF]->(sub:Task)
         RETURN '' AS userId, sub ORDER BY sub.pinned DESC, sub.createdAt DESC`,
        { parentId }
      );
      return result.records.map(r => recordToTaskSimple(r, 'sub', r.get('userId')));
    } finally {
      await session.close();
    }
  }

  async countByStatus(userId: string, groupIds?: string[]): Promise<Record<string, number>> {
    const session = getSession();
    try {
      const matchClauses: string[] = [`(u:User {id: $userId})-[:OWNS]->(t:Task)`];
      if (groupIds?.length) {
        matchClauses.push(`(u:User {id: $userId})-[:MEMBER_OF]->(:Group)<-[:VISIBLE_TO]-(t:Task)`);
      }
      const parts = matchClauses.map(m => `MATCH ${m} RETURN t.status AS status, count(DISTINCT t) AS count`);
      const query = parts.join(' UNION ALL ');
      const result = await session.run(query, { userId });
      const counts: Record<string, number> = { total: 0, pending: 0, in_progress: 0, on_hold: 0, done: 0, abandoned: 0 };
      for (const r of result.records) {
        const s = r.get('status');
        const c = r.get('count').toNumber();
        counts[s] = (counts[s] || 0) + c;
        counts.total += c;
      }
      return counts;
    } finally {
      await session.close();
    }
  }

  async create(data: Partial<ITask>): Promise<ITask> {
    const session = getSession();
    const id = nanoid();
    const shareToken = nanoid(12);
    try {
      await session.executeWrite(tx =>
        tx.run(
          `MATCH (u:User {id: $userId})
           CREATE (t:Task {
             id: $id, title: $title, description: $description,
             type: $type, status: $status, visibility: $visibility,
             shareToken: $shareToken, parentId: $parentId,
             deadline: $deadline, tags: $tags, pinned: $pinned,
             createdAt: datetime(), updatedAt: datetime()
           })
           MERGE (u)-[:OWNS]->(t)
           RETURN t`,
          {
            userId: data.userId, id, title: data.title, description: data.description || '',
            type: data.type || 'task', status: 'pending', visibility: data.visibility || 'private',
            shareToken, parentId: data.parentId || null, deadline: data.deadline || null,
            tags: data.tags || [], pinned: data.pinned || false,
          }
        )
      );
      if (data.blockedBy?.length) {
        for (const b of data.blockedBy) {
          await session.executeWrite(tx =>
            tx.run(
              `MATCH (t:Task {id: $id}), (b:Task {id: $blockedBy})
               MERGE (t)-[:BLOCKED_BY]->(b)`,
              { id, blockedBy: b }
            )
          );
        }
      }
      if (data.groupIds?.length) {
        for (const g of data.groupIds) {
          await session.executeWrite(tx =>
            tx.run(
              `MATCH (t:Task {id: $id}), (g:Group {id: $groupId})
               MERGE (t)-[:VISIBLE_TO]->(g)`,
              { id, groupId: g }
            )
          );
        }
      }
      return (await this.findById(id))!;
    } finally {
      await session.close();
    }
  }

  async update(id: string, data: Partial<ITask>): Promise<ITask | null> {
    const session = getSession();
    try {
      const props: string[] = ['u.updatedAt = datetime()'];
      const params: any = { id };
      const allowed = ['title', 'description', 'status', 'visibility', 'parentId', 'deadline', 'type', 'tags', 'pinned'];
      for (const key of allowed) {
        if ((data as any)[key] !== undefined) {
          props.push(`t.${key} = $${key}`);
          params[key] = (data as any)[key];
        }
      }
      await session.run(
        `MATCH (u:User)-[:OWNS]->(t:Task {id: $id}) SET ${props.join(', ')}`,
        params
      );
      if (data.blockedBy !== undefined) {
        await session.run(
          `MATCH (t:Task {id: $id})-[r:BLOCKED_BY]->() DELETE r`,
          { id }
        );
        for (const b of data.blockedBy) {
          await session.run(
            `MATCH (t:Task {id: $id}), (b:Task {id: $blockedBy}) MERGE (t)-[:BLOCKED_BY]->(b)`,
            { id, blockedBy: b }
          );
        }
      }
      if (data.groupIds !== undefined) {
        await session.run(
          `MATCH (t:Task {id: $id})-[r:VISIBLE_TO]->() DELETE r`,
          { id }
        );
        for (const g of data.groupIds) {
          await session.run(
            `MATCH (t:Task {id: $id}), (g:Group {id: $gid}) MERGE (t)-[:VISIBLE_TO]->(g)`,
            { id, gid: g }
          );
        }
      }
      return this.findById(id);
    } finally {
      await session.close();
    }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:OWNS]->(t:Task {id: $id})
         OPTIONAL MATCH (t)-[:BLOCKED_BY]->()
         OPTIONAL MATCH (t)-[:PARENT_OF]->()
         OPTIONAL MATCH (t)-[:VISIBLE_TO]->()
         OPTIONAL MATCH (t)-[:HAS_DESCRIPTION]->(d:TaskDescription)
         DETACH DELETE t, d`,
        { id, userId }
      );
      // Clean up references from other tasks
      await session.run(
        `MATCH (t:Task)-[r:BLOCKED_BY]->(blocked {id: $id})
         DELETE r`,
        { id }
      );
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally {
      await session.close();
    }
  }

  async findAllBlockedBy(): Promise<Array<{ id: string; blockedBy: string[] }>> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (t:Task)-[:BLOCKED_BY]->(b:Task)
         RETURN t.id AS id, collect(b.id) AS blockedBy`
      );
      return result.records.map(r => ({
        id: r.get('id'),
        blockedBy: r.get('blockedBy'),
      }));
    } finally {
      await session.close();
    }
  }

  async addDescriptionVersion(id: string, description: string): Promise<void> {
    const session = getSession();
    try {
      await session.run(
        `MATCH (t:Task {id: $id})
         CREATE (d:TaskDescription {description: $description, savedAt: datetime()})
         MERGE (t)-[:HAS_DESCRIPTION]->(d)`,
        { id, description }
      );
    } finally {
      await session.close();
    }
  }

  async rollbackDescription(id: string, index: number): Promise<void> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (t:Task {id: $id})-[:HAS_DESCRIPTION]->(d:TaskDescription)
         RETURN d.description, d.savedAt ORDER BY d.savedAt`,
        { id }
      );
      const versions = result.records.map(r => ({
        description: r.get('description'),
        savedAt: new Date(r.get('savedAt')),
      }));
      if (index < 0 || index >= versions.length) return;
      const current = await session.run(
        `MATCH (t:Task {id: $id}) RETURN t.description AS desc`,
        { id }
      );
      const currentDesc = current.records[0]?.get('desc') || '';
      await session.run(
        `MATCH (t:Task {id: $id})
         CREATE (d:TaskDescription {description: $currentDesc, savedAt: datetime()})
         MERGE (t)-[:HAS_DESCRIPTION]->(d)`,
        { id, currentDesc }
      );
      await session.run(
        `MATCH (t:Task {id: $id}) SET t.description = $restored`,
        { id, restored: versions[index].description }
      );
    } finally {
      await session.close();
    }
  }
}

function recordToTaskSimple(record: any, key = 't', userId = ''): ITask {
  const node = record.get(key);
  const props = node.properties || node;
  return {
    id: props.id,
    userId,
    title: props.title,
    description: props.description,
    type: props.type,
    status: props.status,
    visibility: props.visibility,
    shareToken: props.shareToken,
    parentId: props.parentId || undefined,
    deadline: props.deadline ? new Date(props.deadline) : undefined,
    tags: props.tags || [],
    pinned: props.pinned,
    createdAt: new Date(props.createdAt),
    updatedAt: new Date(props.updatedAt),
  };
}

function recordToTask(record: any, userId = ''): ITask {
  const t = record.get('t').properties;
  return {
    id: t.id,
    userId,
    title: t.title,
    description: t.description,
    type: t.type,
    status: t.status,
    visibility: t.visibility,
    shareToken: t.shareToken,
    parentId: t.parentId || undefined,
    deadline: t.deadline ? new Date(t.deadline) : undefined,
    tags: t.tags || [],
    pinned: t.pinned,
    groupIds: record.get('groupIds')?.filter((x: string) => x) || [],
    blockedBy: record.get('blockedBy')?.filter((x: string) => x) || [],
    descriptionHistory: record.get('descriptionHistory')?.filter((d: any) => d.description) || [],
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
  };
}
