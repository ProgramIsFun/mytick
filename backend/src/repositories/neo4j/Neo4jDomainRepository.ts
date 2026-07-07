import { nanoid } from 'nanoid';
import { getSession } from '../../neo4j';
import { IDomain, IDomainRepository } from '../interfaces/IDomainRepository';

export class Neo4jDomainRepository implements IDomainRepository {
  async findById(id: string, userId?: string): Promise<IDomain | null> {
    const session = getSession();
    try {
      const where = userId ? 'AND u.id = $userId' : '';
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(d:Domain {id: $id})
         WHERE 1=1 ${where}
         OPTIONAL MATCH (d)-[:REGISTERED_AT]->(ra:Account)
         OPTIONAL MATCH (d)-[:DNS_AT]->(dns:Account)
         OPTIONAL MATCH (d)-[:BELONGS_TO_PROJECT]->(p:Task)
         RETURN d, ra {.id, .name, .provider} AS registrar,
                dns {.id, .name, .provider} AS dnsProvider,
                p {.id, .title} AS project`,
        { id, userId }
      );
      if (!result.records.length) return null;
      return recordToDomain(result.records[0]);
    } finally { await session.close(); }
  }

  async findByUser(userId: string, options?: { tag?: string; search?: string; projectId?: string }): Promise<IDomain[]> {
    const session = getSession();
    try {
      let where = 'WHERE u.id = $userId';
      const params: any = { userId };
      if (options?.search) { where += ' AND toLower(d.name) CONTAINS toLower($search)'; params.search = options.search; }
      if (options?.tag) { where += ' AND $tag IN d.tags'; params.tag = options.tag; }
      if (options?.projectId) { where += ' AND d.projectId = $projectId'; params.projectId = options.projectId; }

      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(d:Domain) ${where}
         OPTIONAL MATCH (d)-[:REGISTERED_AT]->(ra:Account)
         OPTIONAL MATCH (d)-[:DNS_AT]->(dns:Account)
         OPTIONAL MATCH (d)-[:BELONGS_TO_PROJECT]->(p:Task)
         RETURN d, ra {.id, .name, .provider} AS registrar,
                dns {.id, .name, .provider} AS dnsProvider,
                p {.id, .title} AS project
         ORDER BY d.expiryDate`,
        params
      );
      return result.records.map(recordToDomain);
    } finally { await session.close(); }
  }

  async create(data: Partial<IDomain>): Promise<IDomain> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(tx =>
        tx.run(
          `MATCH (u:User {id: $userId})
           CREATE (d:Domain {
             id: $id, name: $name, expiryDate: $expiryDate, autoRenew: $autoRenew,
             nameservers: $nameservers, sslProvider: $sslProvider, notes: $notes,
             tags: $tags, createdAt: datetime(), updatedAt: datetime()
           })
           MERGE (u)-[:OWNS]->(d)`,
          {
            userId: data.userId, id, name: data.name, expiryDate: data.expiryDate || null,
            autoRenew: data.autoRenew || false, nameservers: data.nameservers || [],
            sslProvider: data.sslProvider || '', notes: data.notes || '', tags: data.tags || [],
          }
        )
      );
      if (data.projectId) {
        await session.run(`MATCH (d:Domain {id: $id}), (p:Task {id: $pid}) MERGE (d)-[:BELONGS_TO_PROJECT]->(p)`, { id, pid: data.projectId });
      }
      if (data.registrarAccountId) {
        await session.run(`MATCH (d:Domain {id: $id}), (a:Account {id: $aid}) MERGE (d)-[:REGISTERED_AT]->(a)`, { id, aid: data.registrarAccountId });
      }
      if (data.dnsAccountId) {
        await session.run(`MATCH (d:Domain {id: $id}), (a:Account {id: $aid}) MERGE (d)-[:DNS_AT]->(a)`, { id, aid: data.dnsAccountId });
      }
      return (await this.findById(id))!;
    } finally { await session.close(); }
  }

  async update(id: string, data: Partial<IDomain>): Promise<IDomain | null> {
    const session = getSession();
    try {
      const props: string[] = ['d.updatedAt = datetime()'];
      const params: any = { id };
      const allowed = ['name', 'expiryDate', 'autoRenew', 'nameservers', 'sslProvider', 'notes', 'tags'];
      for (const key of allowed) {
        if ((data as any)[key] !== undefined) { props.push(`d.${key} = $${key}`); params[key] = (data as any)[key]; }
      }
      if (props.length > 1) {
        await session.run(`MATCH (u:User)-[:OWNS]->(d:Domain {id: $id}) SET ${props.join(', ')}`, params);
      }
      const rels = [
        { key: 'projectId', rel: 'BELONGS_TO_PROJECT', label: 'Task' },
        { key: 'registrarAccountId', rel: 'REGISTERED_AT', label: 'Account' },
        { key: 'dnsAccountId', rel: 'DNS_AT', label: 'Account' },
      ];
      for (const r of rels) {
        if ((data as any)[r.key] !== undefined) {
          await session.run(`MATCH (d:Domain {id: $id})-[x:${r.rel}]->() DELETE x`, { id });
          if ((data as any)[r.key]) {
            await session.run(`MATCH (d:Domain {id: $id}), (n:${r.label} {id: $nid}) MERGE (d)-[:${r.rel}]->(n)`, { id, nid: (data as any)[r.key] });
          }
        }
      }
      return this.findById(id);
    } finally { await session.close(); }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(`MATCH (u:User {id: $userId})-[:OWNS]->(d:Domain {id: $id}) DETACH DELETE d`, { id, userId });
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally { await session.close(); }
  }
}

function recordToDomain(record: any): IDomain {
  const d = record.get('d').properties;
  const reg = record.get('registrar');
  const dns = record.get('dnsProvider');
  return {
    id: d.id, userId: '', name: d.name,
    projectId: record.get('project')?.id || undefined,
    registrarAccountId: reg?.id || undefined,
    dnsAccountId: dns?.id || undefined,
    expiryDate: d.expiryDate ? new Date(d.expiryDate) : undefined,
    autoRenew: d.autoRenew, nameservers: d.nameservers || [],
    sslProvider: d.sslProvider, notes: d.notes, tags: d.tags || [],
    createdAt: new Date(d.createdAt), updatedAt: new Date(d.updatedAt),
  };
}
