import ScheduledNotification from '../models/ScheduledNotification';
import { NotificationQueue, NotificationJob, NotificationHandler } from './NotificationQueue';
import { logger } from '../utils/logger';

export class MongoNotificationQueue implements NotificationQueue {
  async schedule(job: NotificationJob): Promise<void> {
    await ScheduledNotification.findOneAndUpdate(
      { jobId: job.jobId },
      { userId: job.userId, taskId: job.taskId, alertType: job.alertType, fireAt: job.fireAt, sent: false },
      { upsert: true },
    );
    logger.info({ jobId: job.jobId, fireAt: job.fireAt }, 'notification scheduled');
  }

  async cancel(jobId: string): Promise<void> {
    await ScheduledNotification.deleteOne({ jobId });
  }

  async cancelByTask(taskId: string): Promise<void> {
    const result = await ScheduledNotification.deleteMany({ taskId });
    if (result.deletedCount) {
      logger.info({ taskId, deleted: result.deletedCount }, 'notifications cancelled');
    }
  }

  startProcessing(_handler: NotificationHandler): void {
    // No-op for MongoDB — cron calls processDue() externally
  }

  async processDue(handler: NotificationHandler): Promise<void> {
    const due = await ScheduledNotification.find({ fireAt: { $lte: new Date() }, sent: false });
    for (const doc of due) {
      try {
        await handler({
          jobId: doc.jobId,
          userId: doc.userId.toString(),
          taskId: doc.taskId.toString(),
          alertType: doc.alertType,
          fireAt: doc.fireAt,
        });
        doc.sent = true;
        await doc.save();
      } catch (err) {
        logger.error({ err, jobId: doc.jobId }, 'failed to process notification');
      }
    }
  }
}
