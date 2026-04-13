import { NotificationQueue, NotificationJob } from '../../src/queues/NotificationQueue';
import { scheduleDeadlineAlerts } from '../../src/queues/scheduleAlerts';

class MockQueue implements NotificationQueue {
  jobs: NotificationJob[] = [];
  cancelledTasks: string[] = [];

  async schedule(job: NotificationJob) { this.jobs.push(job); }
  async cancel(jobId: string) { this.jobs = this.jobs.filter(j => j.jobId !== jobId); }
  async cancelByTask(taskId: string) {
    this.cancelledTasks.push(taskId);
    this.jobs = this.jobs.filter(j => j.taskId !== taskId);
  }
  async processDue() {}
  startProcessing() {}
}

describe('scheduleDeadlineAlerts', () => {
  let queue: MockQueue;
  const taskId = 'task123';
  const userId = 'user123';

  beforeEach(() => { queue = new MockQueue(); });

  it('schedules 2 alerts when deadline is far in the future', async () => {
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await scheduleDeadlineAlerts(queue, taskId, userId, deadline);
    expect(queue.jobs).toHaveLength(2);
    expect(queue.jobs.map(j => j.alertType).sort()).toEqual(['1day', '1hour']);
  });

  it('schedules only 1hour alert when deadline is <24h away', async () => {
    const deadline = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await scheduleDeadlineAlerts(queue, taskId, userId, deadline);
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0].alertType).toBe('1hour');
  });

  it('schedules nothing when deadline is <1h away', async () => {
    const deadline = new Date(Date.now() + 30 * 60 * 1000);
    await scheduleDeadlineAlerts(queue, taskId, userId, deadline);
    expect(queue.jobs).toHaveLength(0);
  });

  it('schedules nothing when deadline is in the past', async () => {
    const deadline = new Date(Date.now() - 60 * 1000);
    await scheduleDeadlineAlerts(queue, taskId, userId, deadline);
    expect(queue.jobs).toHaveLength(0);
  });

  it('cancels existing alerts when deadline is null', async () => {
    await scheduleDeadlineAlerts(queue, taskId, userId, null);
    expect(queue.cancelledTasks).toContain(taskId);
    expect(queue.jobs).toHaveLength(0);
  });

  it('uses correct jobId format', async () => {
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await scheduleDeadlineAlerts(queue, taskId, userId, deadline);
    expect(queue.jobs.map(j => j.jobId).sort()).toEqual(['task123-1day', 'task123-1hour']);
  });

  it('sets correct fireAt times', async () => {
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await scheduleDeadlineAlerts(queue, taskId, userId, deadline);
    const dayJob = queue.jobs.find(j => j.alertType === '1day')!;
    const hourJob = queue.jobs.find(j => j.alertType === '1hour')!;
    const deadlineMs = deadline.getTime();
    expect(dayJob.fireAt.getTime()).toBe(deadlineMs - 24 * 60 * 60 * 1000);
    expect(hourJob.fireAt.getTime()).toBe(deadlineMs - 60 * 60 * 1000);
  });
});

describe('scheduleDeadlineAlerts with recurrence', () => {
  let queue: MockQueue;
  const taskId = 'task456';
  const userId = 'user456';

  beforeEach(() => { queue = new MockQueue(); });

  it('schedules alerts for the next occurrence of a weekly task', async () => {
    // Start date in the past, next occurrence should be in the future
    // Use a start time that's at a future hour today to ensure next occurrence is upcoming
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000); // 1 week ago + 2h offset
    await scheduleDeadlineAlerts(queue, taskId, userId, start, { freq: 'weekly', interval: 1 });
    expect(queue.jobs.length).toBeGreaterThan(0);
    for (const job of queue.jobs) {
      expect(job.fireAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('skips alerts that overlap with previous occurrence (daily task, 1day alert)', async () => {
    // Daily task — 1day alert would fire before the previous occurrence
    const start = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3h from now (so next occurrence is tomorrow +3h)
    await scheduleDeadlineAlerts(queue, taskId, userId, start, { freq: 'daily', interval: 1 });
    const dayAlert = queue.jobs.find(j => j.alertType === '1day');
    expect(dayAlert).toBeUndefined();
  });

  it('allows 1hour alert for daily task', async () => {
    // Daily task starting 3h from now — 1hour alert fires 2h from now, which is after previous occurrence (now-21h)
    const start = new Date(Date.now() + 3 * 60 * 60 * 1000);
    await scheduleDeadlineAlerts(queue, taskId, userId, start, { freq: 'daily', interval: 1 });
    const hourAlert = queue.jobs.find(j => j.alertType === '1hour');
    expect(hourAlert).toBeDefined();
  });

  it('schedules both alerts for monthly task', async () => {
    const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    await scheduleDeadlineAlerts(queue, taskId, userId, start, { freq: 'monthly', interval: 1 });
    expect(queue.jobs).toHaveLength(2);
  });
});
