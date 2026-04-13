export interface NotificationJob {
  jobId: string;
  userId: string;
  taskId: string;
  alertType: string;
  fireAt: Date;
}

export type NotificationHandler = (job: NotificationJob) => Promise<void>;

export interface NotificationQueue {
  schedule(job: NotificationJob): Promise<void>;
  cancel(jobId: string): Promise<void>;
  cancelByTask(taskId: string): Promise<void>;
  // Start processing due jobs. MongoDB polls, BullMQ listens.
  startProcessing(handler: NotificationHandler): void;
  // One-shot poll for due jobs (used by MongoDB impl, no-op for BullMQ)
  processDue(handler: NotificationHandler): Promise<void>;
  shutdown?(): Promise<void>;
}
