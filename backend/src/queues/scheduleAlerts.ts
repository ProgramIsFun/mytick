import { NotificationQueue, NotificationJob } from './NotificationQueue';
import { DEADLINE_ALERTS } from '../config/alerts';

export async function scheduleDeadlineAlerts(queue: NotificationQueue, taskId: string, userId: string, deadline: Date | null) {
  await queue.cancelByTask(taskId);

  if (!deadline) return;

  const deadlineMs = new Date(deadline).getTime();
  const now = Date.now();

  const ops: Promise<void>[] = [];
  for (const alert of DEADLINE_ALERTS) {
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
