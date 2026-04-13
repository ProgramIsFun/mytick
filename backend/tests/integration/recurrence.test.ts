import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';
import RecurrenceException from '../../src/models/RecurrenceException';

let token: string;

beforeAll(async () => {
  await setupTestDB();
  ({ token } = await createTestUser('recur@test.com', 'recuruser'));
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('recurring tasks', () => {
  it('should create a recurring task', async () => {
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).post('/api/tasks').set(auth()).send({
      title: 'Pay rent',
      deadline,
      recurrence: { freq: 'monthly', interval: 1 },
    });
    expect(res.status).toBe(201);
    expect(res.body.recurrence).toEqual({ freq: 'monthly', interval: 1 });
  });

  it('should update recurrence on a task', async () => {
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const create = await request(app).post('/api/tasks').set(auth()).send({ title: 'Gym', deadline });
    const res = await request(app).patch(`/api/tasks/${create.body._id}`).set(auth()).send({
      recurrence: { freq: 'weekly', interval: 1 },
    });
    expect(res.status).toBe(200);
    expect(res.body.recurrence).toEqual({ freq: 'weekly', interval: 1 });
  });

  it('should remove recurrence', async () => {
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const create = await request(app).post('/api/tasks').set(auth()).send({
      title: 'Temp recurring', deadline, recurrence: { freq: 'daily', interval: 1 },
    });
    const res = await request(app).patch(`/api/tasks/${create.body._id}`).set(auth()).send({
      recurrence: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.recurrence).toBeNull();
  });
});

describe('GET /tasks/calendar', () => {
  it('should return non-recurring tasks in range', async () => {
    const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await request(app).post('/api/tasks').set(auth()).send({ title: 'One-time', deadline: deadline.toISOString() });

    const from = new Date(Date.now()).toISOString();
    const to = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).get(`/api/tasks/calendar?from=${from}&to=${to}`).set(auth());
    expect(res.status).toBe(200);
    const found = res.body.find((i: any) => i.title === 'One-time');
    expect(found).toBeDefined();
    expect(found.recurring).toBe(false);
  });

  it('should expand recurring tasks into multiple occurrences', async () => {
    // Create a daily task starting today
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    await request(app).post('/api/tasks').set(auth()).send({
      title: 'Daily standup',
      deadline: start.toISOString(),
      recurrence: { freq: 'daily', interval: 1 },
    });

    const from = new Date(start);
    const to = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const res = await request(app).get(`/api/tasks/calendar?from=${from.toISOString()}&to=${to.toISOString()}`).set(auth());
    expect(res.status).toBe(200);
    const standups = res.body.filter((i: any) => i.title === 'Daily standup');
    expect(standups.length).toBeGreaterThanOrEqual(6);
    expect(standups[0].recurring).toBe(true);
  });

  it('should exclude skipped occurrences', async () => {
    const start = new Date();
    start.setHours(14, 0, 0, 0);
    const create = await request(app).post('/api/tasks').set(auth()).send({
      title: 'Skippable', deadline: start.toISOString(), recurrence: { freq: 'daily', interval: 1 },
    });

    // Skip tomorrow's occurrence
    const tomorrow = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    await request(app).post(`/api/tasks/${create.body._id}/occurrences`).set(auth()).send({
      date: tomorrow.toISOString(), status: 'skipped',
    });

    const from = start.toISOString();
    const to = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).get(`/api/tasks/calendar?from=${from}&to=${to}`).set(auth());
    const items = res.body.filter((i: any) => i.title === 'Skippable');
    const dates = items.map((i: any) => new Date(i.date).toDateString());
    expect(dates).not.toContain(tomorrow.toDateString());
  });

  it('should show done status for completed occurrences', async () => {
    const start = new Date();
    start.setHours(16, 0, 0, 0);
    const create = await request(app).post('/api/tasks').set(auth()).send({
      title: 'Completable', deadline: start.toISOString(), recurrence: { freq: 'daily', interval: 1 },
    });

    // Mark today as done
    await request(app).post(`/api/tasks/${create.body._id}/occurrences`).set(auth()).send({
      date: start.toISOString(), status: 'done',
    });

    const from = start.toISOString();
    const to = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).get(`/api/tasks/calendar?from=${from}&to=${to}`).set(auth());
    const items = res.body.filter((i: any) => i.title === 'Completable');
    const todayItem = items.find((i: any) => new Date(i.date).toDateString() === start.toDateString());
    expect(todayItem.status).toBe('done');
    // Tomorrow should still be pending
    const tomorrowItem = items.find((i: any) => new Date(i.date).toDateString() !== start.toDateString());
    expect(tomorrowItem.status).toBe('pending');
  });

  it('should reject missing from/to params', async () => {
    const res = await request(app).get('/api/tasks/calendar').set(auth());
    expect(res.status).toBe(400);
  });
});

describe('occurrence exceptions', () => {
  it('POST /:id/occurrences creates an exception', async () => {
    const start = new Date();
    const create = await request(app).post('/api/tasks').set(auth()).send({
      title: 'Exception test', deadline: start.toISOString(), recurrence: { freq: 'daily', interval: 1 },
    });
    const res = await request(app).post(`/api/tasks/${create.body._id}/occurrences`).set(auth()).send({
      date: start.toISOString(), status: 'done',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
  });

  it('DELETE /:id/occurrences removes an exception', async () => {
    const start = new Date();
    const create = await request(app).post('/api/tasks').set(auth()).send({
      title: 'Revert test', deadline: start.toISOString(), recurrence: { freq: 'daily', interval: 1 },
    });
    await request(app).post(`/api/tasks/${create.body._id}/occurrences`).set(auth()).send({
      date: start.toISOString(), status: 'done',
    });
    const res = await request(app).delete(`/api/tasks/${create.body._id}/occurrences`).set(auth()).send({
      date: start.toISOString(),
    });
    expect(res.status).toBe(200);
    const count = await RecurrenceException.countDocuments({ taskId: create.body._id });
    expect(count).toBe(0);
  });

  it('deleting a task cleans up exceptions', async () => {
    const start = new Date();
    const create = await request(app).post('/api/tasks').set(auth()).send({
      title: 'Cleanup test', deadline: start.toISOString(), recurrence: { freq: 'daily', interval: 1 },
    });
    await request(app).post(`/api/tasks/${create.body._id}/occurrences`).set(auth()).send({
      date: start.toISOString(), status: 'done',
    });
    await request(app).delete(`/api/tasks/${create.body._id}`).set(auth());
    const count = await RecurrenceException.countDocuments({ taskId: create.body._id });
    expect(count).toBe(0);
  });

  it('rejects non-recurring task', async () => {
    const create = await request(app).post('/api/tasks').set(auth()).send({ title: 'Not recurring' });
    const res = await request(app).post(`/api/tasks/${create.body._id}/occurrences`).set(auth()).send({
      date: new Date().toISOString(), status: 'done',
    });
    expect(res.status).toBe(404);
  });
});

describe('recurrence end conditions', () => {
  it('should respect until date — no occurrences after it', async () => {
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const until = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000);
    await request(app).post('/api/tasks').set(auth()).send({
      title: 'Limited daily',
      deadline: start.toISOString(),
      recurrence: { freq: 'daily', interval: 1, until: until.toISOString() },
    });

    const from = start.toISOString();
    const to = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).get(`/api/tasks/calendar?from=${from}&to=${to}`).set(auth());
    const items = res.body.filter((i: any) => i.title === 'Limited daily');
    // Should have at most 4 occurrences (day 0, 1, 2, 3)
    expect(items.length).toBeLessThanOrEqual(4);
  });

  it('should respect count — only N occurrences', async () => {
    const start = new Date();
    start.setHours(11, 0, 0, 0);
    await request(app).post('/api/tasks').set(auth()).send({
      title: 'Count limited',
      deadline: start.toISOString(),
      recurrence: { freq: 'daily', interval: 1, count: 3 },
    });

    const from = start.toISOString();
    const to = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).get(`/api/tasks/calendar?from=${from}&to=${to}`).set(auth());
    const items = res.body.filter((i: any) => i.title === 'Count limited');
    expect(items).toHaveLength(3);
  });

  it('POST /end-series sets until and stops future occurrences', async () => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const create = await request(app).post('/api/tasks').set(auth()).send({
      title: 'End series test',
      deadline: start.toISOString(),
      recurrence: { freq: 'daily', interval: 1 },
    });

    // End series from day 3
    const day3 = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000);
    const endRes = await request(app).post(`/api/tasks/${create.body._id}/end-series`).set(auth()).send({
      date: day3.toISOString(),
    });
    expect(endRes.status).toBe(200);
    expect(endRes.body.recurrence.until).toBeDefined();

    // Calendar should show only days 0, 1, 2
    const from = start.toISOString();
    const to = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const cal = await request(app).get(`/api/tasks/calendar?from=${from}&to=${to}`).set(auth());
    const items = cal.body.filter((i: any) => i.title === 'End series test');
    expect(items.length).toBeLessThanOrEqual(3);
  });

  it('POST /end-series rejects non-recurring task', async () => {
    const create = await request(app).post('/api/tasks').set(auth()).send({ title: 'Not recurring 2' });
    const res = await request(app).post(`/api/tasks/${create.body._id}/end-series`).set(auth()).send({
      date: new Date().toISOString(),
    });
    expect(res.status).toBe(404);
  });
});
