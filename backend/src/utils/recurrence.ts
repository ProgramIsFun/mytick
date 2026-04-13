import { RRule, Frequency } from 'rrule';
import { ITask } from '../models/Task';

const FREQ_MAP: Record<string, Frequency> = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
  yearly: RRule.YEARLY,
};

export function expandOccurrences(task: ITask, from: Date, to: Date): Date[] {
  if (!task.recurrence || !task.deadline) return [];

  const opts: any = {
    freq: FREQ_MAP[task.recurrence.freq],
    interval: task.recurrence.interval,
    dtstart: task.deadline,
  };
  if (task.recurrence.until) opts.until = new Date(task.recurrence.until);
  if (task.recurrence.count) opts.count = task.recurrence.count;

  const rule = new RRule(opts);
  return rule.between(from, to, true);
}
