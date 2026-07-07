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
import { connectNeo4j } from './neo4j';

dotenv.config();
validateEnv();

const engine = process.env.DB_ENGINE || 'mongodb';
const PORT = process.env.PORT || 4000;

initFCM();

async function start() {
  if (engine === 'neo4j') {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || '';
    await connectNeo4j(uri, user, password);
    logger.info('Neo4j connected');
  } else {
    await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false });
    logger.info('MongoDB connected');
  }

  app.listen(PORT, () => logger.info({ port: PORT }, 'Server running'));

  const handler = (job: any) => processNotificationJob(job, notificationQueue);
  notificationQueue.startProcessing(handler);
  cron.schedule('* * * * *', () => { notificationQueue.processDue(handler); });
  logger.info('notification processing started');
}

start().catch(err => logger.fatal({ err }, 'Database connection error'));
