import { NotificationQueue } from './NotificationQueue';
import { DEADLINE_ALERTS } from '../config/alerts';
import { RRule, Frequency } from 'rrule';

const FREQ_MAP: Record<string, Frequency> = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
  yearly: RRule.YEARLY,
};

export async function scheduleDeadlineAlerts(queue: NotificationQueue, taskId: string, userId: string, deadline: Date | null, recurrence?: { freq: string; interval: number; until?: string | Date; count?: number } | null) {
  await queue.cancelByTask(taskId);

  if (!deadline) return;

  let targetDate: Date;

  if (recurrence) {
    const opts: any = {
      freq: FREQ_MAP[recurrence.freq],
      interval: recurrence.interval,
      dtstart: new Date(deadline),
    };
    if (recurrence.until) opts.until = new Date(recurrence.until);
    if (recurrence.count) opts.count = recurrence.count;

    const rule = new RRule(opts);
    const next = rule.after(new Date(), true);
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
    const opts: any = {
      freq: FREQ_MAP[recurrence.freq],
      interval: recurrence.interval,
      dtstart: new Date(deadline),
    };
    if (recurrence.until) opts.until = new Date(recurrence.until);
    if (recurrence.count) opts.count = recurrence.count;

    const rule = new RRule(opts);
    const prev = rule.before(targetDate, false);
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
