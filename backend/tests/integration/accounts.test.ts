import { describe, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';
import { secretRepo } from '../../src/repositories';

let token: string;
let secretId: string;
let userId: string;
let extraSecretIds: string[] = [];

beforeAll(async () => {
  await setupTestDB();
  const { token: t, userId: uid } = await createTestUser();
  token = t;
  userId = uid;
  const secret = await secretRepo.create({
    userId,
    name: 'Test Secret',
    provider: 'bitwarden',
    secretValue: 'test-cred',
    type: 'api_key',
  });
  secretId = secret.id;

  const secretNames = ['AWS Access Key', 'GitHub Token', 'Stripe Key', 'SendGrid Key', 'Slack Bot Token'];
  for (const name of secretNames) {
    const s = await secretRepo.create({
      userId,
      name,
      provider: 'bitwarden',
      secretValue: `val-${name.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'api_key',
    });
    extraSecretIds.push(s.id);
  }
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

describe('account CRUD', () => {
  let accountId: string;

  it('should create an account', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Firebase Main', provider: 'firebase', credentials: [{ secretId, key: 'API_KEY' }] });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Firebase Main');
    expect(res.body.provider).toBe('firebase');
    expect(res.body.credentials).toHaveLength(1);
    expect(res.body.credentials[0].secretId).toBe(secretId);
    expect(res.body.credentials[0].key).toBe('API_KEY');
    accountId = res.body.id;
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

  it('should get account by id with credentials', async () => {
    const res = await request(app).get(`/api/accounts/${accountId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Firebase Main');
    expect(res.body.credentials).toHaveLength(1);
    expect(res.body.credentials[0].secretId).toBe(secretId);
    expect(res.body.credentials[0].key).toBe('API_KEY');
  });

  it('should list accounts with credentials', async () => {
    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const acct = res.body.find((a: any) => a.id === accountId);
    expect(acct).toBeDefined();
    expect(acct.credentials).toHaveLength(1);
    expect(acct.credentials[0].secretId).toBe(secretId);
    expect(acct.credentials[0].key).toBe('API_KEY');
  });

  it('should update account', async () => {
    const res = await request(app).patch(`/api/accounts/${accountId}`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Firebase Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Firebase Renamed');
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
    rootAccountId = res.body.id;
  });

  it('should create a sub-account', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'IAM Developer', provider: 'aws', parentAccountId: rootAccountId, username: 'dev-user' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('IAM Developer');
    expect(res.body.parentAccountId).toBe(rootAccountId);
    subAccount1Id = res.body.id;
  });

  it('should create another sub-account', async () => {
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'IAM Production', provider: 'aws', parentAccountId: rootAccountId, username: 'prod-user' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('IAM Production');
    expect(res.body.parentAccountId).toBe(rootAccountId);
    subAccount2Id = res.body.id;
  });

  it('should get sub-accounts of root account', async () => {
    const res = await request(app).get(`/api/accounts/${rootAccountId}/sub-accounts`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.some((a: any) => a.id === subAccount1Id)).toBe(true);
    expect(res.body.some((a: any) => a.id === subAccount2Id)).toBe(true);
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
    expect(res.body[0].id).toBe(subAccount2Id);
  });

  it('should delete root account', async () => {
    const res = await request(app).delete(`/api/accounts/${rootAccountId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('sub-accounts should still exist after parent deletion', async () => {
    const res = await request(app).get(`/api/accounts/${subAccount2Id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(subAccount2Id);
  });
});

describe('account with multiple credentials', () => {
  let multiCredAccountId: string;
  const credKeys = ['API_KEY', 'ACCESS_KEY', 'SECRET_TOKEN', 'OAUTH_TOKEN', 'WEBHOOK_SECRET'];

  it('should create account with 5 credentials', async () => {
    const allSecretIds = [secretId, ...extraSecretIds];
    const credentials = credKeys.map((key, i) => ({ key, secretId: allSecretIds[i] }));
    const res = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Multi Cred Account', provider: 'aws', credentials });
    expect(res.status).toBe(201);
    expect(res.body.credentials).toHaveLength(5);
    multiCredAccountId = res.body.id;
  });

  it('should return all 5 credentials on GET by id', async () => {
    const res = await request(app).get(`/api/accounts/${multiCredAccountId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.credentials).toHaveLength(5);
    const returnedKeys = res.body.credentials.map((c: any) => c.key).sort();
    expect(returnedKeys).toEqual([...credKeys].sort());
    res.body.credentials.forEach((c: any) => {
      expect(c.secretId).toBeDefined();
      expect(typeof c.key).toBe('string');
    });
  });

  it('should return all 5 credentials on list', async () => {
    const res = await request(app).get('/api/accounts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const acct = res.body.find((a: any) => a.id === multiCredAccountId);
    expect(acct).toBeDefined();
    expect(acct.credentials).toHaveLength(5);
    const returnedKeys = acct.credentials.map((c: any) => c.key).sort();
    expect(returnedKeys).toEqual([...credKeys].sort());
  });

  it('should not change credentials on scalar-only PATCH', async () => {
    const res = await request(app).patch(`/api/accounts/${multiCredAccountId}`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Multi Cred' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Multi Cred');
    expect(res.body.credentials).toHaveLength(5);
    const returnedKeys = res.body.credentials.map((c: any) => c.key).sort();
    expect(returnedKeys).toEqual([...credKeys].sort());
  });
});

