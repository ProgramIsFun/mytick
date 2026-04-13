import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import dotenv from 'dotenv';
import app from './app';
import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import { initFCM, sendPush } from './services/fcm';
import { notificationQueue } from './queues';
import User from './models/User';
import Task from './models/Task';

dotenv.config();
validateEnv();

// Rate limiting (not in app.ts so tests aren't rate-limited)
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));

initFCM();

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false })
  .then(() => {
    app.listen(PORT, () => logger.info({ port: PORT }, 'Server running'));

    // Process due notifications every minute
    cron.schedule('* * * * *', () => {
      notificationQueue.processDue(async (job) => {
        const [user, task] = await Promise.all([
          User.findById(job.userId),
          Task.findById(job.taskId),
        ]);
        if (!user || !task || task.status === 'done') return;

        const label = job.alertType === '1day' ? 'in 1 day' : 'in 1 hour';
        const title = 'Deadline approaching';
        const body = `"${task.title}" is due ${label}`;

        await sendPush(user.fcmTokens || [], title, body, { taskId: job.taskId });
        logger.info({ userId: job.userId, taskTitle: task.title, alertType: job.alertType }, 'deadline alert sent');
      });
    });

    logger.info('notification cron started');
  })
  .catch(err => logger.fatal({ err }, 'MongoDB connection error'));
