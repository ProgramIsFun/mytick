import { NotificationQueue } from './NotificationQueue';
import { DEADLINE_ALERTS } from '../config/alerts';
import { RRule, Frequency, Weekday } from 'rrule';

const FREQ_MAP: Record<string, Frequency> = {
  daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY, yearly: RRule.YEARLY,
};
const DAY_MAP: Record<string, Weekday> = {
  MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH, FR: RRule.FR, SA: RRule.SA, SU: RRule.SU,
};

interface RecurrenceInput {
  freq: string;
  interval: number;
  until?: string | Date;
  count?: number;
  byDay?: string[];
}

function makeRule(recurrence: RecurrenceInput, dtstart: Date): RRule {
  const opts: any = { freq: FREQ_MAP[recurrence.freq], interval: recurrence.interval, dtstart };
  if (recurrence.until) opts.until = new Date(recurrence.until);
  if (recurrence.count) opts.count = recurrence.count;
  if (recurrence.byDay?.length) opts.byweekday = recurrence.byDay.map(d => DAY_MAP[d]);
  return new RRule(opts);
}

export async function scheduleDeadlineAlerts(queue: NotificationQueue, taskId: string, userId: string, deadline: Date | null, recurrence?: RecurrenceInput | null) {
  await queue.cancelByTask(taskId);

  if (!deadline) return;

  let targetDate: Date;

  if (recurrence) {
    const rule = makeRule(recurrence, new Date(deadline));
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
    const rule = makeRule(recurrence, new Date(deadline));
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
