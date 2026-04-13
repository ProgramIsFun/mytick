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

  const rule = new RRule({
    freq: FREQ_MAP[task.recurrence.freq],
    interval: task.recurrence.interval,
    dtstart: task.deadline,
  });

  return rule.between(from, to, true);
}
