export interface NotificationJob {
  jobId: string;
  userId: string;
  taskId: string;
  alertType: string;
  fireAt: Date;
}

export interface NotificationQueue {
  schedule(job: NotificationJob): Promise<void>;
  cancel(jobId: string): Promise<void>;
  cancelByTask(taskId: string): Promise<void>;
  processDue(handler: (job: NotificationJob) => Promise<void>): Promise<void>;
}
