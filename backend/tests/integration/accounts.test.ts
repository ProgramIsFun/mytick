import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';

let token: string;

beforeAll(async () => {
  await setupTestDB();
  ({ token } = await createTestUser());
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

describe('account CRUD', () => {
  let accountId: string;

  it('should create an account', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Firebase Main', provider: 'firebase', vaultId: 'vault-123', loginVaultId: 'vault-456' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Firebase Main');
    expect(res.body.provider).toBe('firebase');
    expect(res.body.vaultId).toBe('vault-123');
    expect(res.body.loginVaultId).toBe('vault-456');
    accountId = res.body._id;
  });

  it('should require name and provider', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should list accounts', async () => {
    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should get account by id', async () => {
    const res = await request(app).get(`/api/accounts/${accountId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Firebase Main');
  });

  it('should update account', async () => {
    const res = await request(app).patch(`/api/accounts/${accountId}`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Firebase Renamed', vaultId: 'vault-789' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Firebase Renamed');
    expect(res.body.vaultId).toBe('vault-789');
  });

  it('should delete account', async () => {
    const res = await request(app).delete(`/api/accounts/${accountId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('should not find deleted account', async () => {
    const res = await request(app).get(`/api/accounts/${accountId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('account isolation', () => {
  it('should not see other users accounts', async () => {
    const { token: otherToken } = await createTestUser('other-acc@test.com', 'otheracc');
    await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Account', provider: 'aws' });
    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${otherToken}`);
    expect(res.body.every((a: any) => a.name !== 'My Account')).toBe(true);
  });
});
