import { describe, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';

let token: string;
let accountId: string;

beforeAll(async () => {
  await setupTestDB();
  ({ token } = await createTestUser());
  const acc = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Namecheap', provider: 'custom' });
  accountId = acc.body._id;
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

describe('domain CRUD', () => {
  let domainId: string;

  it('should create a domain', async () => {
    const res = await request(app).post('/api/domains').set('Authorization', `Bearer ${token}`)
      .send({ name: 'mytick.app', registrarAccountId: accountId, expiryDate: '2027-04-20T00:00:00.000Z', autoRenew: true, nameservers: ['ns1.namecheap.com', 'ns2.namecheap.com'] });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('mytick.app');
    expect(res.body.autoRenew).toBe(true);
    expect(res.body.nameservers).toHaveLength(2);
    domainId = res.body._id;
  });

  it('should require name', async () => {
    const res = await request(app).post('/api/domains').set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should list domains', async () => {
    const res = await request(app).get('/api/domains').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should get domain with populated accounts', async () => {
    const res = await request(app).get(`/api/domains/${domainId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.registrarAccountId.name).toBe('Namecheap');
  });

  it('should search domains', async () => {
    const res = await request(app).get('/api/domains?q=mytick').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('should update domain', async () => {
    const res = await request(app).patch(`/api/domains/${domainId}`).set('Authorization', `Bearer ${token}`)
      .send({ sslProvider: "Let's Encrypt", notes: 'Primary domain' });
    expect(res.status).toBe(200);
    expect(res.body.sslProvider).toBe("Let's Encrypt");
  });

  it('should delete domain', async () => {
    const res = await request(app).delete(`/api/domains/${domainId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('domain isolation', () => {
  it('should not see other users domains', async () => {
    const { token: otherToken } = await createTestUser('other-dom@test.com', 'otherdom');
    await request(app).post('/api/domains').set('Authorization', `Bearer ${token}`)
      .send({ name: 'secret.dev' });
    const res = await request(app).get('/api/domains').set('Authorization', `Bearer ${otherToken}`);
    expect(res.body.every((d: any) => d.name !== 'secret.dev')).toBe(true);
  });
});
