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

dotenv.config();
validateEnv();

// Rate limiting (not in app.ts so tests aren't rate-limited)
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));

initFCM();

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false })
  .then(() => {
    app.listen(PORT, () => logger.info({ port: PORT }, 'Server running'));

    const handler = (job: any) => processNotificationJob(job, notificationQueue);

    // Let the queue implementation handle processing if it supports it (BullMQ)
    notificationQueue.startProcessing(handler);

    // For MongoDB: poll every minute. For BullMQ: this is a no-op.
    cron.schedule('* * * * *', () => {
      notificationQueue.processDue(handler);
    });

    logger.info('notification processing started');
  })
  .catch(err => logger.fatal({ err }, 'MongoDB connection error'));
