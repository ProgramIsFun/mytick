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
}

describe('scheduleDeadlineAlerts', () => {
  let queue: MockQueue;
  const taskId = 'task123';
  const userId = 'user123';

  beforeEach(() => { queue = new MockQueue(); });

  it('schedules 2 alerts when deadline is far in the future', async () => {
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h from now
    await scheduleDeadlineAlerts(queue, taskId, userId, deadline);
    expect(queue.jobs).toHaveLength(2);
    expect(queue.jobs.map(j => j.alertType).sort()).toEqual(['1day', '1hour']);
  });

  it('schedules only 1hour alert when deadline is <24h away', async () => {
    const deadline = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h from now
    await scheduleDeadlineAlerts(queue, taskId, userId, deadline);
    expect(queue.jobs).toHaveLength(1);
    expect(queue.jobs[0].alertType).toBe('1hour');
  });

  it('schedules nothing when deadline is <1h away', async () => {
    const deadline = new Date(Date.now() + 30 * 60 * 1000); // 30min from now
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
