/**
 * BullMQ + Redis implementation of NotificationQueue.
 *
 * To switch from MongoDB to BullMQ:
 * 1. npm install bullmq ioredis
 * 2. Set REDIS_URL env var (e.g. from Upstash)
 * 3. Change src/queues/index.ts to use this class
 * 4. Remove the cron.schedule() call in src/index.ts (BullMQ handles timing)
 */

/*
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { NotificationQueue, NotificationJob, NotificationHandler } from './NotificationQueue';
import { logger } from '../utils/logger';

const QUEUE_NAME = 'deadline-notifications';

export class RedisNotificationQueue implements NotificationQueue {
  private queue: Queue;
  private connection: IORedis;
  private worker?: Worker;

  constructor() {
    this.connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
  }

  async schedule(job: NotificationJob): Promise<void> {
    const delay = job.fireAt.getTime() - Date.now();
    if (delay <= 0) return;
    await this.queue.add('notify', job, {
      jobId: job.jobId,
      delay,
      removeOnComplete: true,
      removeOnFail: 1000,
    });
    logger.info({ jobId: job.jobId, fireAt: job.fireAt }, 'notification scheduled (Redis)');
  }

  async cancel(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) await job.remove();
  }

  async cancelByTask(taskId: string): Promise<void> {
    // BullMQ doesn't support querying by data field, so use predictable jobId pattern
    const types = ['1day', '1hour'];  // must match DEADLINE_ALERTS
    for (const type of types) {
      const job = await this.queue.getJob(`${taskId}-${type}`);
      if (job) await job.remove();
    }
  }

  startProcessing(handler: NotificationHandler): void {
    this.worker = new Worker(QUEUE_NAME, async (bullJob) => {
      await handler(bullJob.data as NotificationJob);
    }, {
      connection: this.connection,
      concurrency: 5,
    });
    this.worker.on('failed', (job, err) => {
      logger.error({ err, jobId: job?.id }, 'notification job failed');
    });
    logger.info('BullMQ notification worker started');
  }

  async processDue(): Promise<void> {
    // No-op — BullMQ worker handles this automatically
  }

  async shutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.connection.quit();
  }
}
*/

export {};
