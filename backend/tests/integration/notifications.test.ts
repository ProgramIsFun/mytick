import { describe, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';
import User from '../../src/models/User';
import ScheduledNotification from '../../src/models/ScheduledNotification';

let token: string;
let userId: string;

beforeAll(async () => {
  await setupTestDB();
  const u = await createTestUser('noti@test.com', 'notiuser');
  token = u.token;
  userId = u.user.id;
}, 30000);

afterEach(async () => {
  await ScheduledNotification.deleteMany({});
});

afterAll(async () => {
  await teardownTestDB();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('FCM token endpoints', () => {
  it('POST /auth/fcm-token registers a token', async () => {
    const res = await request(app).post('/api/auth/fcm-token').set(auth()).send({ fcmToken: 'token-abc' });
    expect(res.status).toBe(200);
    const user = await User.findById(userId);
    expect(user!.fcmTokens).toContain('token-abc');
  });

  it('POST /auth/fcm-token deduplicates', async () => {
    await request(app).post('/api/auth/fcm-token').set(auth()).send({ fcmToken: 'dup-token' });
    await request(app).post('/api/auth/fcm-token').set(auth()).send({ fcmToken: 'dup-token' });
    const user = await User.findById(userId);
    expect(user!.fcmTokens.filter(t => t === 'dup-token')).toHaveLength(1);
  });

  it('DELETE /auth/fcm-token removes a token', async () => {
    await request(app).post('/api/auth/fcm-token').set(auth()).send({ fcmToken: 'remove-me' });
    const res = await request(app).delete('/api/auth/fcm-token').set(auth()).send({ fcmToken: 'remove-me' });
    expect(res.status).toBe(200);
    const user = await User.findById(userId);
    expect(user!.fcmTokens).not.toContain('remove-me');
  });

  it('POST /auth/fcm-token rejects missing token', async () => {
    const res = await request(app).post('/api/auth/fcm-token').set(auth()).send({});
    expect(res.status).toBe(400);
  });

  it('POST /auth/fcm-token rejects unauthenticated', async () => {
    const res = await request(app).post('/api/auth/fcm-token').send({ fcmToken: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('task deadline → notification scheduling', () => {
  it('creating a task with deadline schedules notifications', async () => {
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const res = await request(app).post('/api/tasks').set(auth()).send({ title: 'Deadline task', deadline });
    expect(res.status).toBe(201);
    const notifs = await ScheduledNotification.find({ taskId: res.body._id });
    expect(notifs).toHaveLength(2);
  });

  it('creating a task without deadline schedules nothing', async () => {
    const res = await request(app).post('/api/tasks').set(auth()).send({ title: 'No deadline' });
    expect(res.status).toBe(201);
    const notifs = await ScheduledNotification.find({ taskId: res.body._id });
    expect(notifs).toHaveLength(0);
  });

  it('updating deadline reschedules notifications', async () => {
    const deadline1 = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const create = await request(app).post('/api/tasks').set(auth()).send({ title: 'Reschedule', deadline: deadline1 });
    const taskId = create.body._id;

    const deadline2 = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    await request(app).patch(`/api/tasks/${taskId}`).set(auth()).send({ deadline: deadline2 });

    const notifs = await ScheduledNotification.find({ taskId });
    expect(notifs).toHaveLength(2);
    // fireAt should reflect the new deadline
    const dayNotif = notifs.find(n => n.alertType === '1day')!;
    const expected = new Date(deadline2).getTime() - 24 * 60 * 60 * 1000;
    expect(dayNotif.fireAt.getTime()).toBe(expected);
  });

  it('marking task done cancels notifications', async () => {
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const create = await request(app).post('/api/tasks').set(auth()).send({ title: 'Done task', deadline });
    const taskId = create.body._id;

    await request(app).patch(`/api/tasks/${taskId}`).set(auth()).send({ status: 'done' });
    const notifs = await ScheduledNotification.find({ taskId });
    expect(notifs).toHaveLength(0);
  });

  it('deleting a task cancels notifications', async () => {
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const create = await request(app).post('/api/tasks').set(auth()).send({ title: 'Delete me', deadline });
    const taskId = create.body._id;

    await request(app).delete(`/api/tasks/${taskId}`).set(auth());
    const notifs = await ScheduledNotification.find({ taskId });
    expect(notifs).toHaveLength(0);
  });

  it('removing deadline cancels notifications', async () => {
    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const create = await request(app).post('/api/tasks').set(auth()).send({ title: 'Remove deadline', deadline });
    const taskId = create.body._id;

    await request(app).patch(`/api/tasks/${taskId}`).set(auth()).send({ deadline: null });
    const notifs = await ScheduledNotification.find({ taskId });
    expect(notifs).toHaveLength(0);
  });
});
