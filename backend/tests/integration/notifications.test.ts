import { describe, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';
import { userRepo } from '../../src/repositories';

let token: string;
let userId: string;

beforeAll(async () => {
  await setupTestDB();
  const u = await createTestUser('noti@test.com', 'notiuser');
  token = u.token;
  userId = u.user.id;
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('FCM token endpoints', () => {
  it('POST /auth/fcm-token registers a token', async () => {
    const res = await request(app).post('/api/auth/fcm-token').set(auth()).send({ fcmToken: 'token-abc' });
    expect(res.status).toBe(200);
    const user = await userRepo.findById(userId);
    expect(user!.fcmTokens).toContain('token-abc');
  });

  it('POST /auth/fcm-token deduplicates', async () => {
    await request(app).post('/api/auth/fcm-token').set(auth()).send({ fcmToken: 'dup-token' });
    await request(app).post('/api/auth/fcm-token').set(auth()).send({ fcmToken: 'dup-token' });
    const user = await userRepo.findById(userId);
    expect(user!.fcmTokens.filter(t => t === 'dup-token')).toHaveLength(1);
  });

  it('DELETE /auth/fcm-token removes a token', async () => {
    await request(app).post('/api/auth/fcm-token').set(auth()).send({ fcmToken: 'remove-me' });
    const res = await request(app).delete('/api/auth/fcm-token').set(auth()).send({ fcmToken: 'remove-me' });
    expect(res.status).toBe(200);
    const user = await userRepo.findById(userId);
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
