import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import dotenv from 'dotenv';
import app from './app';
import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import { initFCM, sendPush } from './services/fcm';
import { notificationQueue } from './queues';
import { scheduleDeadlineAlerts } from './queues/scheduleAlerts';
import { DEADLINE_ALERTS } from './config/alerts';
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

        const label = DEADLINE_ALERTS.find(a => a.type === job.alertType)?.label || job.alertType;
        const title = 'Deadline approaching';
        const body = `"${task.title}" is due ${label}`;

        await sendPush(user.fcmTokens || [], title, body, { taskId: job.taskId });
        logger.info({ userId: job.userId, taskTitle: task.title, alertType: job.alertType }, 'deadline alert sent');

        // For recurring tasks, schedule alerts for the next occurrence after all alerts for this one are sent
        if (task.recurrence) {
          const pending = await import('./models/ScheduledNotification').then(m => m.default.countDocuments({ taskId: job.taskId, sent: false }));
          if (pending === 0) {
            await scheduleDeadlineAlerts(notificationQueue, task._id.toString(), task.userId.toString(), task.deadline, task.recurrence);
          }
        }
      });
    });

    logger.info('notification cron started');
  })
  .catch(err => logger.fatal({ err }, 'MongoDB connection error'));
