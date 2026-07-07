import { nanoid } from 'nanoid';
import { getSession } from '../../neo4j';
import { IUser, IUserRepository, IAuthProvider, IPushToken } from '../interfaces/IUserRepository';

export class Neo4jUserRepository implements IUserRepository {
  async findAll(): Promise<IUser[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User)
         OPTIONAL MATCH (u)-[:HAS_PROVIDER]->(p:AuthProvider)
         OPTIONAL MATCH (u)-[:HAS_TOKEN]->(t:PushToken)
         RETURN u, collect(DISTINCT p {.type, .providerId, .passwordHash}) AS providers,
                collect(DISTINCT t {.token, .provider, .device, .registeredAt}) AS pushTokens`
      );
      return result.records.map(recordToUser);
    } finally {
      await session.close();
    }
  }

  private async findUser(label: string, paramKey: string, paramVal: string): Promise<IUser | null> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {${label}: $${paramKey}})
         OPTIONAL MATCH (u)-[:HAS_PROVIDER]->(p:AuthProvider)
         OPTIONAL MATCH (u)-[:HAS_TOKEN]->(t:PushToken)
         RETURN u, collect(DISTINCT p {.type, .providerId, .passwordHash}) AS providers,
                collect(DISTINCT t {.token, .provider, .device, .registeredAt}) AS pushTokens`,
        { [paramKey]: paramVal }
      );
      if (!result.records.length) return null;
      return recordToUser(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async findById(id: string): Promise<IUser | null> {
    return this.findUser('id', 'id', id);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.findUser('email', 'email', email);
  }

  async findByUsername(username: string): Promise<IUser | null> {
    return this.findUser('username', 'username', username.toLowerCase());
  }

  async findByIdentity(providerType: string, providerId: string): Promise<IUser | null> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User)-[:HAS_PROVIDER]->(p:AuthProvider {type: $providerType, providerId: $providerId})
         OPTIONAL MATCH (u)-[:HAS_TOKEN]->(t:PushToken)
         RETURN u, collect(DISTINCT p {.type, .providerId, .passwordHash}) AS providers,
                collect(DISTINCT t {.token, .provider, .device, .registeredAt}) AS pushTokens`,
        { providerType, providerId }
      );
      if (!result.records.length) return null;
      return recordToUser(result.records[0]);
    } finally {
      await session.close();
    }
  }

  async create(data: Partial<IUser> & { providers?: IAuthProvider[] }): Promise<IUser> {
    const session = getSession();
    const id = nanoid();
    try {
      await session.executeWrite(tx =>
        tx.run(
          `CREATE (u:User {
            id: $id, email: $email, username: $username, name: $name,
            createdAt: datetime(), updatedAt: datetime()
          })
          RETURN u`,
          { id, email: data.email || null, username: data.username, name: data.name }
        )
      );
      if (data.providers?.length) {
        for (const p of data.providers) {
          await session.executeWrite(tx =>
            tx.run(
              `MATCH (u:User {id: $id})
               MERGE (p:AuthProvider {type: $type, providerId: $providerId})
               ON CREATE SET p.passwordHash = $passwordHash
               MERGE (u)-[:HAS_PROVIDER]->(p)`,
              { id, type: p.type, providerId: p.providerId, passwordHash: p.passwordHash || null }
            )
          );
        }
      }
      return (await this.findById(id))!;
    } finally {
      await session.close();
    }
  }

  async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    const session = getSession();
    try {
      const setClauses: string[] = ['u.updatedAt = datetime()'];
      const params: any = { id };
      if (data.email !== undefined) { setClauses.push('u.email = $email'); params.email = data.email; }
      if (data.username !== undefined) { setClauses.push('u.username = $username'); params.username = data.username; }
      if (data.name !== undefined) { setClauses.push('u.name = $name'); params.name = data.name; }
      await session.run(
        `MATCH (u:User {id: $id}) SET ${setClauses.join(', ')}`,
        params
      );
      return this.findById(id);
    } finally {
      await session.close();
    }
  }

  async addPushToken(userId: string, token: IPushToken): Promise<void> {
    const session = getSession();
    try {
      await session.run(
        `MATCH (u:User {id: $userId})
         MERGE (t:PushToken {token: $token})
         ON CREATE SET t.provider = $provider, t.device = $device, t.registeredAt = datetime()
         MERGE (u)-[:HAS_TOKEN]->(t)`,
        { userId, token: token.token, provider: token.provider, device: token.device || '' }
      );
    } finally {
      await session.close();
    }
  }

  async removePushToken(userId: string, token: string): Promise<void> {
    const session = getSession();
    try {
      await session.run(
        `MATCH (u:User {id: $userId})-[r:HAS_TOKEN]->(t:PushToken {token: $token})
         DELETE r, t`,
        { userId, token }
      );
    } finally {
      await session.close();
    }
  }

  async getPushTokens(userId: string): Promise<IPushToken[]> {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:HAS_TOKEN]->(t:PushToken)
         RETURN t.token AS token, t.provider AS provider, t.device AS device, t.registeredAt AS registeredAt`,
        { userId }
      );
      return result.records.map(r => ({
        token: r.get('token'),
        provider: r.get('provider'),
        device: r.get('device') || '',
        registeredAt: new Date(r.get('registeredAt')),
      }));
    } finally {
      await session.close();
    }
  }

  async addProvider(userId: string, provider: IAuthProvider): Promise<void> {
    const session = getSession();
    try {
      await session.run(
        `MATCH (u:User {id: $userId})
         MERGE (p:AuthProvider {type: $type, providerId: $providerId})
         ON CREATE SET p.passwordHash = $passwordHash
         MERGE (u)-[:HAS_PROVIDER]->(p)`,
        { userId, type: provider.type, providerId: provider.providerId, passwordHash: provider.passwordHash || null }
      );
    } finally {
      await session.close();
    }
  }
}

function recordToUser(record: any): IUser {
  const u = record.get('u').properties;
  const providers: IAuthProvider[] = (record.get('providers') || [])
    .filter((p: any) => p?.type)
    .map((p: any) => ({ type: p.type, providerId: p.providerId, passwordHash: p.passwordHash }));
  const pushTokens: IPushToken[] = (record.get('pushTokens') || [])
    .filter((t: any) => t?.token)
    .map((t: any) => ({ token: t.token, provider: t.provider, device: t.device, registeredAt: new Date(t.registeredAt) }));
  return {
    id: u.id,
    email: u.email || undefined,
    username: u.username,
    name: u.name,
    providers,
    pushTokens,
    fcmTokens: pushTokens.filter(t => t.provider === 'fcm').map(t => t.token),
    createdAt: new Date(u.createdAt),
    updatedAt: new Date(u.updatedAt),
  };
}
