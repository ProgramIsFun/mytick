import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectNeo4j, getSession, closeNeo4j } from '../neo4j';
import { logger } from '../utils/logger';
import UserModel from '../models/User';
import TaskModel from '../models/Task';
import AccountModel from '../models/Account';
import GroupModel from '../models/Group';
import SecretModel from '../models/Secret';
import DomainModel from '../models/Domain';
import DatabaseModel from '../models/Database';
import SubscriptionModel from '../models/Subscription';
import KnowledgeModel from '../models/Knowledge';
import ContextModel from '../models/Context';
import BackupHistoryModel from '../models/BackupHistory';
import RecurrenceExceptionModel from '../models/RecurrenceException';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mytick';
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || '';

function dt(d: any): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d;
  if (d instanceof Date) return d.toISOString();
  if (typeof d.toISOString === 'function') return d.toISOString();
  return String(d);
}

async function migrate() {
  logger.info('Starting MongoDB to Neo4j migration');

  await mongoose.connect(MONGODB_URI);
  logger.info('MongoDB connected');

  await connectNeo4j(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD);
  logger.info('Neo4j connected');

  try {
    await migrateUsers();
    await migrateGroups();
    await migrateSecrets();
    await migrateTasks();
    await migrateAccounts();
    await migrateDomains();
    await migrateDatabases();
    await migrateSubscriptions();
    await migrateKnowledge();
    await migrateContexts();
    await migrateBackupHistories();
    await migrateRecurrenceExceptions();
    logger.info('Migration complete');
  } finally {
    await mongoose.disconnect();
    await closeNeo4j();
  }
}

async function runBatch(stmts: { cypher: string; params: Record<string, any> }[], batchSize = 200) {
  const session = getSession();
  try {
    for (let i = 0; i < stmts.length; i += batchSize) {
      const batch = stmts.slice(i, i + batchSize);
      await session.executeWrite(async tx => {
        for (const stmt of batch) {
          await tx.run(stmt.cypher, stmt.params);
        }
      });
    }
  } finally {
    await session.close();
  }
}

async function migrateUsers() {
  logger.info('Migrating users...');
  const users = await UserModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const u of users) {
    const id = u._id.toString();
    stmts.push({
      cypher: `MERGE (n:User {id: $id})
        ON CREATE SET n.email = $email, n.username = $username, n.name = $name,
          n.createdAt = datetime($createdAt), n.updatedAt = datetime($updatedAt)
        ON MATCH SET n.email = $email, n.username = $username, n.name = $name,
          n.updatedAt = datetime($updatedAt)`,
      params: {
        id, email: u.email || null, username: u.username, name: u.name,
        createdAt: dt(u.createdAt), updatedAt: dt(u.updatedAt),
      },
    });
    for (const p of u.providers || []) {
      stmts.push({
        cypher: `MATCH (n:User {id: $userId})
          MERGE (p:AuthProvider {type: $type, providerId: $providerId})
          ON CREATE SET p.passwordHash = $passwordHash
          MERGE (n)-[:HAS_PROVIDER]->(p)`,
        params: { userId: id, type: p.type, providerId: p.providerId, passwordHash: p.passwordHash || null },
      });
    }
    for (const t of u.pushTokens || []) {
      stmts.push({
        cypher: `MATCH (n:User {id: $userId})
          MERGE (t:PushToken {token: $token})
          ON CREATE SET t.provider = $provider, t.device = $device, t.registeredAt = datetime($registeredAt)
          MERGE (n)-[:HAS_TOKEN]->(t)`,
        params: { userId: id, token: t.token, provider: t.provider, device: t.device || '', registeredAt: dt(t.registeredAt) },
      });
    }
  }
  await runBatch(stmts);
  logger.info({ count: users.length }, 'Users migrated');
}

async function migrateTasks() {
  logger.info('Migrating tasks...');
  const tasks = await TaskModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const t of tasks) {
    const id = t._id.toString();
    stmts.push({
      cypher: `MERGE (n:Task {id: $id})
        ON CREATE SET n.userId = $userId, n.title = $title, n.description = $description,
          n.type = $type, n.status = $status, n.visibility = $visibility,
          n.shareToken = $shareToken, n.parentId = $parentId,
          n.deadline = $deadline, n.tags = $tags, n.pinned = $pinned,
          n.createdAt = datetime($createdAt), n.updatedAt = datetime($updatedAt)
        ON MATCH SET n.title = $title, n.description = $description,
          n.status = $status, n.tags = $tags, n.updatedAt = datetime($updatedAt)`,
      params: {
        id, userId: t.userId.toString(), title: t.title,
        description: t.description || '', type: t.type, status: t.status,
        visibility: t.visibility, shareToken: t.shareToken,
        parentId: t.parentId ? t.parentId.toString() : null,
        deadline: dt(t.deadline), tags: t.tags || [],
        pinned: t.pinned || false, createdAt: dt(t.createdAt), updatedAt: dt(t.updatedAt),
      },
    });
    stmts.push({
      cypher: `MATCH (n:User {id: $userId}), (t:Task {id: $taskId}) MERGE (n)-[:OWNS]->(t)`,
      params: { userId: t.userId.toString(), taskId: id },
    });
    if (t.recurrence) {
      const recObj: any = {
        freq: t.recurrence.freq,
        interval: t.recurrence.interval,
      };
      if (t.recurrence.until) recObj.until = dt(t.recurrence.until);
      if (t.recurrence.count) recObj.count = t.recurrence.count;
      if (t.recurrence.byDay?.length) recObj.byDay = t.recurrence.byDay;
      
      stmts.push({
        cypher: `MATCH (n:Task {id: $id})
          SET n.recurrence = $recurrence`,
        params: {
          id,
          recurrence: JSON.stringify(recObj),
        },
      });
    }
    if (t.metadata) {
      stmts.push({
        cypher: `MATCH (n:Task {id: $id}) SET n.metadata = $metadata`,
        params: { id, metadata: JSON.stringify(t.metadata) },
      });
    }
    for (const b of t.blockedBy || []) {
      stmts.push({
        cypher: `MATCH (t:Task {id: $tid}), (b:Task {id: $bid}) MERGE (t)-[:BLOCKED_BY]->(b)`,
        params: { tid: id, bid: b.toString() },
      });
    }
    for (const g of t.groupIds || []) {
      stmts.push({
        cypher: `MATCH (n:Task {id: $tid}), (g:Group {id: $gid}) MERGE (n)-[:VISIBLE_TO]->(g)`,
        params: { tid: id, gid: g.toString() },
      });
    }
    for (const dv of t.descriptionHistory || []) {
      stmts.push({
        cypher: `MATCH (n:Task {id: $id})
          CREATE (d:TaskDescription {description: $desc, savedAt: datetime($savedAt)})
          MERGE (n)-[:HAS_DESCRIPTION]->(d)`,
        params: { id, desc: dv.description, savedAt: dt(dv.savedAt) },
      });
    }
  }
  await runBatch(stmts);
  logger.info({ count: tasks.length }, 'Tasks migrated');
}

async function migrateAccounts() {
  logger.info('Migrating accounts...');
  const accounts = await AccountModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const a of accounts) {
    const id = a._id.toString();
    stmts.push({
      cypher: `MERGE (n:Account {id: $id})
        ON CREATE SET n.name = $name, n.provider = $provider,
          n.url = $url, n.username = $username, n.notes = $notes,
          n.tags = $tags, n.createdAt = datetime($createdAt), n.updatedAt = datetime($updatedAt)
        ON MATCH SET n.name = $name, n.provider = $provider, n.updatedAt = datetime($updatedAt)`,
      params: {
        id, name: a.name, provider: a.provider, url: a.url || '',
        username: a.username || '', notes: a.notes || '', tags: a.tags || [],
        createdAt: dt(a.createdAt), updatedAt: dt(a.updatedAt),
      },
    });
    stmts.push({
      cypher: `MATCH (n:User {id: $userId}), (a:Account {id: $accountId}) MERGE (n)-[:OWNS]->(a)`,
      params: { userId: a.userId.toString(), accountId: id },
    });
    if (a.parentAccountId) {
      stmts.push({
        cypher: `MATCH (parent:Account {id: $parentId}), (n:Account {id: $id}) MERGE (parent)-[:PARENT_OF]->(n)`,
        params: { id, parentId: a.parentAccountId.toString() },
      });
    }
    for (const cred of a.credentials || []) {
      stmts.push({
        cypher: `MATCH (n:Account {id: $id}), (s:Secret {id: $secretId})
          MERGE (n)-[:HAS_CREDENTIAL {key: $key}]->(s)`,
        params: { id, secretId: cred.secretId.toString(), key: cred.key },
      });
    }
  }
  await runBatch(stmts);
  logger.info({ count: accounts.length }, 'Accounts migrated');
}

async function migrateGroups() {
  logger.info('Migrating groups...');
  const groups = await GroupModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const g of groups) {
    const id = g._id.toString();
    stmts.push({
      cypher: `MERGE (n:Group {id: $id})
        ON CREATE SET n.name = $name, n.createdAt = datetime($createdAt)
        ON MATCH SET n.name = $name`,
      params: { id, name: g.name, createdAt: dt(g.createdAt) },
    });
    stmts.push({
      cypher: `MATCH (n:User {id: $ownerId}), (g:Group {id: $groupId}) MERGE (n)-[:OWNS]->(g)`,
      params: { ownerId: g.ownerId.toString(), groupId: id },
    });
    for (const m of g.members || []) {
      stmts.push({
        cypher: `MATCH (g:Group {id: $groupId}), (n:User {id: $userId})
          MERGE (g)-[r:HAS_MEMBER]->(n) SET r.role = $role`,
        params: { groupId: id, userId: m.userId.toString(), role: m.role || 'viewer' },
      });
    }
  }
  await runBatch(stmts);
  logger.info({ count: groups.length }, 'Groups migrated');
}

async function migrateSecrets() {
  logger.info('Migrating secrets...');
  const secrets = await SecretModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const s of secrets) {
    const id = s._id.toString();
    stmts.push({
      cypher: `MERGE (n:Secret {id: $id})
        ON CREATE SET n.name = $name, n.description = $description,
          n.type = $type, n.provider = $provider,
          n.providerSecretId = $providerSecretId, n.tags = $tags,
          n.expiresAt = datetime($expiresAt), n.lastRotatedAt = datetime($lastRotatedAt),
          n.lastAccessedAt = datetime($lastAccessedAt),
          n.createdAt = datetime($createdAt), n.updatedAt = datetime($updatedAt)
        ON MATCH SET n.name = $name, n.updatedAt = datetime($updatedAt)`,
      params: {
        id, name: s.name, description: s.description || '', type: s.type,
        provider: s.provider, providerSecretId: s.providerSecretId,
        tags: s.tags || [], expiresAt: dt(s.expiresAt),
        lastRotatedAt: dt(s.lastRotatedAt), lastAccessedAt: dt(s.lastAccessedAt),
        createdAt: dt(s.createdAt), updatedAt: dt(s.updatedAt),
      },
    });
    stmts.push({
      cypher: `MATCH (n:User {id: $userId}), (s:Secret {id: $secretId}) MERGE (n)-[:OWNS]->(s)`,
      params: { userId: s.userId.toString(), secretId: id },
    });
  }
  await runBatch(stmts);
  logger.info({ count: secrets.length }, 'Secrets migrated');
}

async function migrateDomains() {
  logger.info('Migrating domains...');
  const domains = await DomainModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const d of domains) {
    const id = d._id.toString();
    stmts.push({
      cypher: `MERGE (n:Domain {id: $id})
        ON CREATE SET n.name = $name, n.expiryDate = datetime($expiryDate),
          n.autoRenew = $autoRenew, n.nameservers = $nameservers,
          n.sslProvider = $sslProvider, n.notes = $notes, n.tags = $tags,
          n.createdAt = datetime($createdAt), n.updatedAt = datetime($updatedAt)
        ON MATCH SET n.name = $name, n.updatedAt = datetime($updatedAt)`,
      params: {
        id, name: d.name, expiryDate: dt(d.expiryDate),
        autoRenew: d.autoRenew || false, nameservers: d.nameservers || [],
        sslProvider: d.sslProvider || '', notes: d.notes || '', tags: d.tags || [],
        createdAt: dt(d.createdAt), updatedAt: dt(d.updatedAt),
      },
    });
    stmts.push({
      cypher: `MATCH (n:User {id: $userId}), (d:Domain {id: $domainId}) MERGE (n)-[:OWNS]->(d)`,
      params: { userId: d.userId.toString(), domainId: id },
    });
    if (d.projectId) {
      stmts.push({
        cypher: `MATCH (n:Domain {id: $id}), (p:Task {id: $pid}) MERGE (n)-[:BELONGS_TO_PROJECT]->(p)`,
        params: { id, pid: d.projectId.toString() },
      });
    }
    if (d.registrarAccountId) {
      stmts.push({
        cypher: `MATCH (n:Domain {id: $id}), (a:Account {id: $aid}) MERGE (n)-[:REGISTERED_AT]->(a)`,
        params: { id, aid: d.registrarAccountId.toString() },
      });
    }
    if (d.dnsAccountId) {
      stmts.push({
        cypher: `MATCH (n:Domain {id: $id}), (a:Account {id: $aid}) MERGE (n)-[:DNS_AT]->(a)`,
        params: { id, aid: d.dnsAccountId.toString() },
      });
    }
  }
  await runBatch(stmts);
  logger.info({ count: domains.length }, 'Domains migrated');
}

async function migrateDatabases() {
  logger.info('Migrating databases...');
  const databases = await DatabaseModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const d of databases) {
    const id = d._id.toString();
    stmts.push({
      cypher: `MERGE (n:Database {id: $id})
        ON CREATE SET n.name = $name, n.type = $type, n.host = $host,
          n.port = $port, n.databaseName = $databaseName,
          n.backupEnabled = $backupEnabled,
          n.backupRetentionDays = $backupRetentionDays,
          n.backupFrequency = $backupFrequency,
          n.lastBackupAt = datetime($lastBackupAt), n.tags = $tags, n.notes = $notes,
          n.createdAt = datetime($createdAt), n.updatedAt = datetime($updatedAt)
        ON MATCH SET n.name = $name, n.updatedAt = datetime($updatedAt)`,
      params: {
        id, name: d.name, type: d.type, host: d.host || '', port: d.port || null,
        databaseName: d.database || '', backupEnabled: d.backupEnabled || false,
        backupRetentionDays: d.backupRetentionDays || 30,
        backupFrequency: d.backupFrequency || 'daily',
        lastBackupAt: dt(d.lastBackupAt), tags: d.tags || [], notes: d.notes || '',
        createdAt: dt(d.createdAt), updatedAt: dt(d.updatedAt),
      },
    });
    stmts.push({
      cypher: `MATCH (n:User {id: $userId}), (d:Database {id: $dbId}) MERGE (n)-[:OWNS]->(d)`,
      params: { userId: d.userId.toString(), dbId: id },
    });
    if (d.secretId) {
      stmts.push({
        cypher: `MATCH (n:Database {id: $id}), (s:Secret {id: $sid}) MERGE (n)-[:USES_SECRET]->(s)`,
        params: { id, sid: d.secretId.toString() },
      });
    }
    if (d.accountId) {
      stmts.push({
        cypher: `MATCH (n:Database {id: $id}), (a:Account {id: $aid}) MERGE (n)-[:MANAGED_BY]->(a)`,
        params: { id, aid: d.accountId.toString() },
      });
    }
  }
  await runBatch(stmts);
  logger.info({ count: databases.length }, 'Databases migrated');
}

async function migrateSubscriptions() {
  logger.info('Migrating subscriptions...');
  const subs = await SubscriptionModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const s of subs) {
    const id = s._id.toString();
    stmts.push({
      cypher: `MERGE (n:Subscription {id: $id})
        ON CREATE SET n.name = $name, n.provider = $provider, n.amount = $amount,
          n.currency = $currency, n.billingCycle = $billingCycle,
          n.nextBillingDate = datetime($nextBillingDate), n.expiryDate = datetime($expiryDate),
          n.autoRenew = $autoRenew, n.status = $status, n.category = $category,
          n.paymentMethod = $paymentMethod, n.url = $url, n.notes = $notes,
          n.tags = $tags, n.createdAt = datetime($createdAt), n.updatedAt = datetime($updatedAt)
        ON MATCH SET n.name = $name, n.updatedAt = datetime($updatedAt)`,
      params: {
        id, name: s.name, provider: s.provider, amount: s.amount,
        currency: s.currency || 'USD', billingCycle: s.billingCycle,
        nextBillingDate: dt(s.nextBillingDate), expiryDate: dt(s.expiryDate),
        autoRenew: s.autoRenew ?? false, status: s.status || 'active',
        category: s.category || '', paymentMethod: s.paymentMethod || '',
        url: s.url || '', notes: s.notes || '', tags: s.tags || [],
        createdAt: dt(s.createdAt), updatedAt: dt(s.updatedAt),
      },
    });
    stmts.push({
      cypher: `MATCH (n:User {id: $userId}), (s:Subscription {id: $subId}) MERGE (n)-[:OWNS]->(s)`,
      params: { userId: s.userId.toString(), subId: id },
    });
  }
  await runBatch(stmts);
  logger.info({ count: subs.length }, 'Subscriptions migrated');
}

async function migrateKnowledge() {
  logger.info('Migrating knowledge...');
  const entries = await KnowledgeModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const k of entries) {
    const id = k._id.toString();
    stmts.push({
      cypher: `MERGE (n:Knowledge {id: $id})
        ON CREATE SET n.content = $content, n.createdAt = datetime($createdAt), n.updatedAt = datetime($updatedAt)
        ON MATCH SET n.content = $content, n.updatedAt = datetime($updatedAt)`,
      params: { id, content: k.content, createdAt: dt(k.createdAt), updatedAt: dt(k.updatedAt) },
    });
    stmts.push({
      cypher: `MATCH (n:User {id: $userId}), (k:Knowledge {id: $kid}) MERGE (n)-[:OWNS]->(k)`,
      params: { userId: k.userId.toString(), kid: id },
    });
  }
  await runBatch(stmts);
  logger.info({ count: entries.length }, 'Knowledge migrated');
}

async function migrateContexts() {
  logger.info('Migrating contexts...');
  const contexts = await ContextModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const c of contexts) {
    const id = c.key;
    stmts.push({
      cypher: `MERGE (n:Context {id: $id})
        ON CREATE SET n.key = $key, n.value = $value, n.updatedAt = datetime($updatedAt)
        ON MATCH SET n.value = $value, n.updatedAt = datetime($updatedAt)`,
      params: { id, key: c.key, value: c.value, updatedAt: dt(c.updatedAt) },
    });
    stmts.push({
      cypher: `MATCH (n:User {id: $userId}), (c:Context {id: $cid}) MERGE (n)-[:OWNS]->(c)`,
      params: { userId: c.userId.toString(), cid: id },
    });
  }
  await runBatch(stmts);
  logger.info({ count: contexts.length }, 'Contexts migrated');
}

async function migrateBackupHistories() {
  logger.info('Migrating backup histories...');
  const histories = await BackupHistoryModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const h of histories) {
    const id = h._id.toString();
    stmts.push({
      cypher: `MERGE (n:BackupHistory {id: $id})
        ON CREATE SET n.status = $status, n.startedAt = datetime($startedAt),
          n.completedAt = datetime($completedAt), n.durationMs = $durationMs,
          n.sizeBytes = $sizeBytes, n.s3Path = $s3Path, n.s3Bucket = $s3Bucket,
          n.errorMessage = $errorMessage, n.metadata = $metadata,
          n.triggeredBy = $triggeredBy, n.lambdaRequestId = $lambdaRequestId,
          n.createdAt = datetime($createdAt), n.updatedAt = datetime($updatedAt)
        ON MATCH SET n.status = $status, n.updatedAt = datetime($updatedAt)`,
      params: {
        id, status: h.status, startedAt: dt(h.startedAt), completedAt: dt(h.completedAt),
        durationMs: h.durationMs, sizeBytes: h.sizeBytes || 0,
        s3Path: h.s3Path || '', s3Bucket: h.s3Bucket || '',
        errorMessage: h.errorMessage || null, metadata: JSON.stringify(h.metadata || {}),
        triggeredBy: h.triggeredBy || 'scheduled',
        lambdaRequestId: h.lambdaRequestId || null,
        createdAt: dt(h.createdAt), updatedAt: dt(h.updatedAt),
      },
    });
    stmts.push({
      cypher: `MATCH (h:BackupHistory {id: $hid}), (d:Database {id: $did}) MERGE (h)-[:BACKUP_OF]->(d)`,
      params: { hid: id, did: h.databaseId.toString() },
    });
  }
  await runBatch(stmts);
  logger.info({ count: histories.length }, 'Backup histories migrated');
}

async function migrateRecurrenceExceptions() {
  logger.info('Migrating recurrence exceptions...');
  const exceptions = await RecurrenceExceptionModel.find().lean();
  const stmts: { cypher: string; params: Record<string, any> }[] = [];
  for (const e of exceptions) {
    const id = e._id.toString();
    stmts.push({
      cypher: `MERGE (n:RecurrenceException {id: $id})
        ON CREATE SET n.date = datetime($date), n.status = $status,
          n.title = $title, n.description = $description, n.newDate = datetime($newDate),
          n.createdAt = datetime($createdAt)
        ON MATCH SET n.status = $status`,
      params: {
        id, date: dt(e.date), status: e.status || 'pending',
        title: e.title || null, description: e.description || null,
        newDate: dt(e.newDate), createdAt: dt(e.createdAt),
      },
    });
    stmts.push({
      cypher: `MATCH (t:Task {id: $taskId}), (n:RecurrenceException {id: $rid}) MERGE (t)-[:HAS_EXCEPTION]->(n)`,
      params: { taskId: e.taskId.toString(), rid: id },
    });
  }
  await runBatch(stmts);
  logger.info({ count: exceptions.length }, 'Recurrence exceptions migrated');
}

migrate().catch(err => {
  logger.fatal({ err }, 'Migration failed');
  process.exit(1);
});
