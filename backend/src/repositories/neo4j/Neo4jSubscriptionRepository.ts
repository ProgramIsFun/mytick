import { nanoid } from 'nanoid';
import { getSession } from '../../neo4j';
import { ISubscription, ISubscriptionRepository } from '../interfaces/ISubscriptionRepository';

export class Neo4jSubscriptionRepository implements ISubscriptionRepository {
  async findById(id: string, userId?: string): Promise<ISubscription | null> {
    const session = getSession();
    try {
      const where = userId ? 'AND u.id = $userId' : '';
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(s:Subscription {id: $id}) WHERE 1=1 ${where} RETURN s`,
        { id, userId }
      );
      if (!result.records.length) return null;
      return recordToSub(result.records[0]);
    } finally { await session.close(); }
  }

  async findByUser(userId: string, options?: { status?: string; category?: string; tag?: string; search?: string }): Promise<ISubscription[]> {
    const session = getSession();
    try {
      let where = 'WHERE u.id = $userId';
      const params: any = { userId };
      if (options?.status) { where += ' AND s.status = $status'; params.status = options.status; }
      if (options?.category) { where += ' AND s.category = $category'; params.category = options.category; }
      if (options?.tag) { where += ' AND $tag IN s.tags'; params.tag = options.tag; }
      if (options?.search) { where += ' AND toLower(s.name) CONTAINS toLower($search)'; params.search = options.search; }
      const result = await session.run(
        `MATCH (u:User)-[:OWNS]->(s:Subscription) ${where} RETURN s ORDER BY s.nextBillingDate`,
        params
      );
      return result.records.map(recordToSub);
    } finally { await session.close(); }
  }

  async findActiveByUser(userId: string): Promise<ISubscription[]> {
    return this.findByUser(userId, { status: 'active' });
  }

  async create(data: Partial<ISubscription>): Promise<ISubscription> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(tx =>
        tx.run(
          `MATCH (u:User {id: $userId})
           CREATE (s:Subscription {
             id: $id, name: $name, provider: $provider, amount: $amount,
             currency: $currency, billingCycle: $billingCycle,
             nextBillingDate: $nextBillingDate, expiryDate: $expiryDate,
             autoRenew: $autoRenew, status: $status, category: $category,
             paymentMethod: $paymentMethod, url: $url, notes: $notes,
             tags: $tags, createdAt: datetime(), updatedAt: datetime()
           })
           MERGE (u)-[:OWNS]->(s)`,
          {
            userId: data.userId, id, name: data.name, provider: data.provider, amount: data.amount,
            currency: data.currency || 'USD', billingCycle: data.billingCycle,
            nextBillingDate: data.nextBillingDate || null, expiryDate: data.expiryDate || null,
            autoRenew: data.autoRenew ?? false, status: data.status || 'active',
            category: data.category || '', paymentMethod: data.paymentMethod || '',
            url: data.url || '', notes: data.notes || '', tags: data.tags || [],
          }
        )
      );
      return (await this.findById(id))!;
    } finally { await session.close(); }
  }

  async update(id: string, data: Partial<ISubscription>): Promise<ISubscription | null> {
    const session = getSession();
    try {
      const props: string[] = ['s.updatedAt = datetime()'];
      const params: any = { id };
      const allowed = ['name', 'provider', 'amount', 'currency', 'billingCycle', 'nextBillingDate', 'expiryDate', 'autoRenew', 'status', 'category', 'paymentMethod', 'url', 'notes', 'tags'];
      for (const key of allowed) {
        if ((data as any)[key] !== undefined) { props.push(`s.${key} = $${key}`); params[key] = (data as any)[key]; }
      }
      if (props.length > 1) {
        await session.run(`MATCH (u:User)-[:OWNS]->(s:Subscription {id: $id}) SET ${props.join(', ')}`, params);
      }
      return this.findById(id);
    } finally { await session.close(); }
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const session = getSession();
    try {
      const result = await session.run(`MATCH (u:User {id: $userId})-[:OWNS]->(s:Subscription {id: $id}) DETACH DELETE s`, { id, userId });
      return result.summary.counters.updates().nodesDeleted > 0;
    } finally { await session.close(); }
  }
}

function recordToSub(record: any): ISubscription {
  const s = record.get('s').properties;
  return {
    id: s.id, userId: '', name: s.name, provider: s.provider, amount: s.amount.toNumber ? s.amount.toNumber() : s.amount,
    currency: s.currency, billingCycle: s.billingCycle, nextBillingDate: s.nextBillingDate ? new Date(s.nextBillingDate) : null,
    expiryDate: s.expiryDate ? new Date(s.expiryDate) : null, autoRenew: s.autoRenew, status: s.status,
    category: s.category, paymentMethod: s.paymentMethod, url: s.url, notes: s.notes,
    tags: s.tags || [], createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt),
  };
}
