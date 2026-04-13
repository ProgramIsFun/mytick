import { NotificationQueue, NotificationJob } from './NotificationQueue';

const ALERTS = [
  { type: '1day', ms: 24 * 60 * 60 * 1000 },
  { type: '1hour', ms: 60 * 60 * 1000 },
];

export async function scheduleDeadlineAlerts(queue: NotificationQueue, taskId: string, userId: string, deadline: Date | null) {
  // Cancel existing alerts first
  await queue.cancelByTask(taskId);

  if (!deadline) return;

  const deadlineMs = new Date(deadline).getTime();
  const now = Date.now();

  const ops: Promise<void>[] = [];
  for (const alert of ALERTS) {
    const fireAt = deadlineMs - alert.ms;
    if (fireAt > now) {
      ops.push(queue.schedule({
        jobId: `${taskId}-${alert.type}`,
        userId,
        taskId,
        alertType: alert.type,
        fireAt: new Date(fireAt),
      }));
    }
  }

  await Promise.all(ops);
}
