import { NotificationQueue } from './NotificationQueue';
import { SUBSCRIPTION_ALERTS } from '../config/alerts';

export async function scheduleSubscriptionAlerts(queue: NotificationQueue, subId: string, userId: string, nextDate: Date | null) {
  await queue.cancelByTask(subId);

  if (!nextDate) return;

  const now = Date.now();
  const targetMs = nextDate.getTime();
  if (targetMs <= now) return;

  for (const alert of SUBSCRIPTION_ALERTS) {
    const fireAt = targetMs - alert.ms;
    if (fireAt > now) {
      await queue.schedule({
        jobId: `sub-${subId}-${alert.type}`,
        userId,
        taskId: subId,
        alertType: alert.type,
        fireAt: new Date(fireAt),
      });
    }
  }
}
