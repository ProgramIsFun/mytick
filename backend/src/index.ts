import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import dotenv from 'dotenv';
import app from './app';
import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import { initFCM } from './services/fcm';
import { notificationQueue } from './queues';
import { processNotificationJob } from './services/notificationHandler';
import { connectNeo4j, getSession } from './neo4j';

dotenv.config();
validateEnv();

const engine = process.env.DB_ENGINE || 'mongodb';
const PORT = process.env.PORT || 4000;

initFCM();

async function createNeo4jConstraints() {
  const session = getSession();
  const labels = ['User', 'Task', 'Account', 'Group', 'Secret', 'Domain', 'Database', 'Subscription', 'Knowledge', 'Context', 'BackupHistory', 'RecurrenceException', 'PushToken', 'Provider', 'Credential', 'Member'];
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
  if (engine === 'neo4j') {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || '';
    await connectNeo4j(uri, user, password);
    await createNeo4jConstraints();
    logger.info('Neo4j connected');
  } else {
    await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false });
    logger.info('MongoDB connected');
  }

  app.listen(PORT, () => logger.info({ port: PORT }, 'Server running'));

  if (engine !== 'neo4j') {
    const handler = (job: any) => processNotificationJob(job, notificationQueue);
    notificationQueue.startProcessing(handler);
    cron.schedule('* * * * *', () => { notificationQueue.processDue(handler); });
    logger.info('notification processing started');
  }
}

start().catch(err => logger.fatal({ err }, 'Database connection error'));
