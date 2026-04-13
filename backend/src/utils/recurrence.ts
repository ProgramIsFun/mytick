import { RRule, Frequency, Weekday } from 'rrule';
import { ITask } from '../models/Task';

const FREQ_MAP: Record<string, Frequency> = {
  daily: RRule.DAILY,
  weekly: RRule.WEEKLY,
  monthly: RRule.MONTHLY,
  yearly: RRule.YEARLY,
};

const DAY_MAP: Record<string, Weekday> = {
  MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH,
  FR: RRule.FR, SA: RRule.SA, SU: RRule.SU,
};

export function buildRRule(recurrence: ITask['recurrence'], dtstart: Date): RRule | null {
  if (!recurrence) return null;

  const opts: any = {
    freq: FREQ_MAP[recurrence.freq],
    interval: recurrence.interval,
    dtstart,
  };
  if (recurrence.until) opts.until = new Date(recurrence.until);
  if (recurrence.count) opts.count = recurrence.count;
  if (recurrence.byDay?.length) opts.byweekday = recurrence.byDay.map(d => DAY_MAP[d]);

  return new RRule(opts);
}

export function expandOccurrences(task: ITask, from: Date, to: Date): Date[] {
  if (!task.recurrence || !task.deadline) return [];
  const rule = buildRRule(task.recurrence, task.deadline);
  return rule ? rule.between(from, to, true) : [];
}
