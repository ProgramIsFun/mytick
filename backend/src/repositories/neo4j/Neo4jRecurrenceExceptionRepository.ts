import { getSession } from '../../neo4j';
import { IRecurrenceException, IRecurrenceExceptionRepository } from '../interfaces/IRecurrenceExceptionRepository';

function toDomain(r: any): IRecurrenceException {
  return {
    id: r.get('id'),
    taskId: r.get('taskId'),
    date: new Date(r.get('date')),
    status: r.get('status') || 'pending',
    title: r.get('title') || undefined,
    description: r.get('description') || undefined,
    newDate: r.get('newDate') ? new Date(r.get('newDate')) : undefined,
    createdAt: new Date(r.get('createdAt')),
    updatedAt: new Date(r.get('updatedAt')),
  };
}

export class Neo4jRecurrenceExceptionRepository implements IRecurrenceExceptionRepository {
  async findByTaskAndDateRange(taskIds: string[], from: Date, to: Date): Promise<IRecurrenceException[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (t:Task)<-[:EXCEPTION_OF]-(e:RecurrenceException)
         WHERE t.id IN $taskIds AND e.date >= datetime($from) AND e.date <= datetime($to)
         RETURN e.id AS id, t.id AS taskId, e.date AS date, e.status AS status,
                e.title AS title, e.description AS description, e.newDate AS newDate,
                e.createdAt AS createdAt, e.updatedAt AS updatedAt`,
        { taskIds, from: from.toISOString(), to: to.toISOString() }
      );
      return result.records.map(toDomain);
    } finally {
      await session.close();
    }
  }

  async upsert(taskId: string, date: Date, data: Partial<IRecurrenceException>): Promise<IRecurrenceException> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (t:Task {id: $taskId})
         MERGE (e:RecurrenceException {taskId: $taskId, date: datetime($date)})
         ON CREATE SET e.id = randomUUID(), e.status = $status,
           e.title = $title, e.description = $description, e.newDate = $newDate,
           e.createdAt = datetime(), e.updatedAt = datetime()
         ON MATCH SET
           e.status = $status,
           e.title = $title, e.description = $description, e.newDate = $newDate,
           e.updatedAt = datetime()
         MERGE (t)<-[:EXCEPTION_OF]-(e)
         RETURN e.id AS id, $taskId AS taskId, e.date AS date, e.status AS status,
                e.title AS title, e.description AS description, e.newDate AS newDate,
                e.createdAt AS createdAt, e.updatedAt AS updatedAt`,
        {
          taskId,
          date: date.toISOString(),
          status: data.status || 'pending',
          title: data.title ?? null,
          description: data.description ?? null,
          newDate: data.newDate ? data.newDate.toISOString() : null,
        }
      );
      if (!result.records.length) throw new Error('Failed to upsert RecurrenceException');
      return toDomain(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async delete(taskId: string, date: Date): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (e:RecurrenceException {taskId: $taskId, date: datetime($date)})
         DETACH DELETE e`,
        { taskId, date: date.toISOString() }
      );
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally {
      await session.close();
    }
  }

  async deleteByTask(taskId: string, dateFrom?: Date): Promise<number> {
    const session = getSession();
    try {
      const dateFilter = dateFrom ? 'AND e.date >= datetime($dateFrom)' : '';
      const result = await session.run(
        `MATCH (e:RecurrenceException {taskId: $taskId})
         WHERE 1=1 ${dateFilter}
         DETACH DELETE e`,
        { taskId, dateFrom: dateFrom?.toISOString() }
      );
      return result.summary.counters.updates().nodesDeleted || 0;
    } finally {
      await session.close();
    }
  }
}
