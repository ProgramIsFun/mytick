import { NotificationQueue } from './NotificationQueue';
import { DEADLINE_ALERTS } from '../config/alerts';
import { buildRRule } from '../utils/recurrence';

interface RecurrenceInput {
  freq: string;
  interval: number;
  until?: string | Date;
  count?: number;
  byDay?: string[];
}

function makeRule(recurrence: RecurrenceInput, dtstart: Date) {
  return buildRRule(recurrence as any, dtstart);
}

export async function scheduleDeadlineAlerts(queue: NotificationQueue, taskId: string, userId: string, deadline: Date | null, recurrence?: RecurrenceInput | null) {
  await queue.cancelByTask(taskId);

  if (!deadline) return;

  let targetDate: Date;

  if (recurrence) {
    const rule = makeRule(recurrence, new Date(deadline));
    const next = rule?.after(new Date(), true);
    if (!next) return;
    targetDate = next;
  } else {
    targetDate = new Date(deadline);
  }

  const now = Date.now();
  const targetMs = targetDate.getTime();
  if (targetMs <= now) return;

  let prevOccurrenceMs = 0;
  if (recurrence) {
    const rule = makeRule(recurrence, new Date(deadline));
    const prev = rule?.before(targetDate, false);
    if (prev) prevOccurrenceMs = prev.getTime();
  }

  const ops: Promise<void>[] = [];
  for (const alert of DEADLINE_ALERTS) {
    const fireAt = targetMs - alert.ms;
    if (fireAt > now && (!prevOccurrenceMs || fireAt > prevOccurrenceMs)) {
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
