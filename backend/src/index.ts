import dotenv from 'dotenv';
import app from './app';
import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import { initFCM } from './services/fcm';
import { connectNeo4j, getSession } from './neo4j';

dotenv.config();
validateEnv();

const PORT = process.env.PORT || 4000;

initFCM();

async function createNeo4jConstraints() {
  const session = getSession();
  const labels = ['User', 'Task', 'Account', 'Group', 'Secret', 'Domain', 'Database', 'Subscription', 'Knowledge', 'Context', 'BackupHistory', 'RecurrenceException', 'PushToken', 'Provider', 'Credential', 'Member', 'Repo'];
  for (const label of labels) {
    try {
      await session.run(`CREATE CONSTRAINT IF NOT EXISTS FOR (n:${label}) REQUIRE n.id IS UNIQUE`);
      logger.info({ label }, 'Neo4j constraint created');
    } catch (err) {
      logger.warn({ err, label }, 'Failed to create Neo4j constraint');
    }
  }
  await session.close();
}

async function start() {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || '';
  await connectNeo4j(uri, user, password);
  await createNeo4jConstraints();
  logger.info('Neo4j connected');

  app.listen(PORT, () => logger.info({ port: PORT }, 'Server running'));

  // Note: Notification queue disabled for now - needs Neo4j implementation
  // const handler = (job: any) => processNotificationJob(job, notificationQueue);
  // notificationQueue.startProcessing(handler);
  // cron.schedule('* * * * *', () => { notificationQueue.processDue(handler); });
  // logger.info('notification processing started');
}

start().catch(err => logger.fatal({ err }, 'Database connection error'));
