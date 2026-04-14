import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';
import User from '../../src/models/User';

let token: string;

beforeAll(async () => {
  await setupTestDB();
  ({ token } = await createTestUser());
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

describe('POST /api/auth/fcm-token', () => {
  it('should register a push token', async () => {
    const res = await request(app)
      .post('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ fcmToken: 'test-token-123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Token registered');

    const user = await User.findOne({ email: 'test@test.com' });
    expect(user!.fcmTokens).toContain('test-token-123');
    expect(user!.pushTokens).toEqual(
      expect.arrayContaining([expect.objectContaining({ token: 'test-token-123', provider: 'fcm' })])
    );
  });

  it('should not duplicate tokens', async () => {
    await request(app)
      .post('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ fcmToken: 'test-token-123' });

    const user = await User.findOne({ email: 'test@test.com' });
    const count = user!.fcmTokens.filter(t => t === 'test-token-123').length;
    expect(count).toBe(1);
  });

  it('should store device info from user-agent', async () => {
    await request(app)
      .post('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .set('User-Agent', 'TestBrowser/1.0')
      .send({ fcmToken: 'token-with-device' });

    const user = await User.findOne({ email: 'test@test.com' });
    const pt = user!.pushTokens.find(t => t.token === 'token-with-device');
    expect(pt).toBeDefined();
    expect(pt!.device).toContain('TestBrowser');
  });

  it('should accept custom provider', async () => {
    await request(app)
      .post('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ fcmToken: 'huawei-token-456', provider: 'huawei', device: 'Huawei P50' });

    const user = await User.findOne({ email: 'test@test.com' });
    const pt = user!.pushTokens.find(t => t.token === 'huawei-token-456');
    expect(pt).toBeDefined();
    expect(pt!.provider).toBe('huawei');
    expect(pt!.device).toBe('Huawei P50');
  });

  it('should reject without auth', async () => {
    const res = await request(app)
      .post('/api/auth/fcm-token')
      .send({ fcmToken: 'no-auth-token' });
    expect(res.status).toBe(401);
  });

  it('should reject without fcmToken', async () => {
    const res = await request(app)
      .post('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/auth/fcm-token', () => {
  it('should remove a token from both schemas', async () => {
    const res = await request(app)
      .delete('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ fcmToken: 'test-token-123' });
    expect(res.status).toBe(200);

    const user = await User.findOne({ email: 'test@test.com' });
    expect(user!.fcmTokens).not.toContain('test-token-123');
    expect(user!.pushTokens.find(t => t.token === 'test-token-123')).toBeUndefined();
  });
});

describe('GET /api/auth/fcm-tokens', () => {
  it('should return push tokens with metadata', async () => {
    const res = await request(app)
      .get('/api/auth/fcm-tokens')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tokens)).toBe(true);
    for (const t of res.body.tokens) {
      expect(t).toHaveProperty('token');
      expect(t).toHaveProperty('provider');
      expect(t).toHaveProperty('device');
    }
  });
});

describe('POST /api/auth/test-push', () => {
  it('should return 400 when no tokens registered', async () => {
    // Create a fresh user with no tokens
    const { token: freshToken } = await createTestUser('fresh@test.com', 'freshuser');
    const res = await request(app)
      .post('/api/auth/test-push')
      .set('Authorization', `Bearer ${freshToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('No push tokens');
  });

  it('should reject without auth', async () => {
    const res = await request(app)
      .post('/api/auth/test-push')
      .send({});
    expect(res.status).toBe(401);
  });
});
