import { describe, it, beforeAll, afterAll } from '@jest/globals';
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
      .send({ name: 'Firebase Main', provider: 'firebase', credentials: [{ vaultId: 'vault-123', key: 'API_KEY' }] });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Firebase Main');
    expect(res.body.provider).toBe('firebase');
    expect(res.body.credentials).toHaveLength(1);
    expect(res.body.credentials[0].vaultId).toBe('vault-123');
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
      .send({ name: 'Firebase Renamed', credentials: [{ vaultId: 'vault-789', key: 'NEW_KEY' }] });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Firebase Renamed');
    expect(res.body.credentials[0].vaultId).toBe('vault-789');
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

describe('account hierarchy', () => {
  let rootAccountId: string;
  let subAccount1Id: string;
  let subAccount2Id: string;

  it('should create a root account', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'AWS Root', provider: 'aws', url: 'https://console.aws.amazon.com' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('AWS Root');
    expect(res.body.parentAccountId).toBeNull();
    rootAccountId = res.body._id;
  });

  it('should create a sub-account', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'IAM Developer', provider: 'aws', parentAccountId: rootAccountId, username: 'dev-user' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('IAM Developer');
    expect(res.body.parentAccountId).toBe(rootAccountId);
    subAccount1Id = res.body._id;
  });

  it('should create another sub-account', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'IAM Production', provider: 'aws', parentAccountId: rootAccountId, username: 'prod-user' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('IAM Production');
    expect(res.body.parentAccountId).toBe(rootAccountId);
    subAccount2Id = res.body._id;
  });

  it('should get sub-accounts of root account', async () => {
    const res = await request(app).get(`/api/accounts/${rootAccountId}/sub-accounts`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.some((a: any) => a._id === subAccount1Id)).toBe(true);
    expect(res.body.some((a: any) => a._id === subAccount2Id)).toBe(true);
  });

  it('should update sub-account parent', async () => {
    const res = await request(app).patch(`/api/accounts/${subAccount1Id}`).set('Authorization', `Bearer ${token}`)
      .send({ parentAccountId: null });
    expect(res.status).toBe(200);
    expect(res.body.parentAccountId).toBeNull();
  });

  it('should not return removed sub-account', async () => {
    const res = await request(app).get(`/api/accounts/${rootAccountId}/sub-accounts`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]._id).toBe(subAccount2Id);
  });

  it('should delete root account', async () => {
    const res = await request(app).delete(`/api/accounts/${rootAccountId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('sub-accounts should still exist after parent deletion', async () => {
    const res = await request(app).get(`/api/accounts/${subAccount2Id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(subAccount2Id);
  });
});
