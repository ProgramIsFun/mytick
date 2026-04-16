import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';

let token: string;
let accountId: string;

beforeAll(async () => {
  await setupTestDB();
  ({ token } = await createTestUser());
  const acc = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test DB', provider: 'mongodb_atlas', vaultId: 'v-1' });
  accountId = acc.body._id;
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

describe('project CRUD', () => {
  let projectId: string;

  it('should create a project', async () => {
    const res = await request(app).post('/api/projects').set('Authorization', `Bearer ${token}`)
      .send({
        name: 'MyTick',
        description: 'Task management app',
        repoUrl: 'https://github.com/ProgramIsFun/mytick',
        localPath: '/Users/me/mytick',
        services: [{
          accountId,
          role: 'database',
          mappings: [{ target: 'backend/.env', envVar: 'MONGODB_URI', vaultField: 'uri' }],
        }],
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('MyTick');
    expect(res.body.services).toHaveLength(1);
    expect(res.body.services[0].accountId).toBe(accountId);
    projectId = res.body._id;
  });

  it('should require name', async () => {
    const res = await request(app).post('/api/projects').set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should create project without services', async () => {
    const res = await request(app).post('/api/projects').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Empty Project' });
    expect(res.status).toBe(201);
    expect(res.body.services).toEqual([]);
  });

  it('should list projects', async () => {
    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('should get project with populated accounts', async () => {
    const res = await request(app).get(`/api/projects/${projectId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.services[0].accountId.name).toBe('Test DB');
    expect(res.body.services[0].accountId.provider).toBe('mongodb_atlas');
  });

  it('should update project', async () => {
    const res = await request(app).patch(`/api/projects/${projectId}`).set('Authorization', `Bearer ${token}`)
      .send({ name: 'MyTick Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('MyTick Renamed');
  });

  it('should find projects by account', async () => {
    const res = await request(app).get(`/api/projects/by-account/${accountId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should delete project', async () => {
    const res = await request(app).delete(`/api/projects/${projectId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('project isolation', () => {
  it('should not see other users projects', async () => {
    const { token: otherToken } = await createTestUser('other-proj@test.com', 'otherproj');
    await request(app).post('/api/projects').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Secret Project' });
    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${otherToken}`);
    expect(res.body.every((p: any) => p.name !== 'Secret Project')).toBe(true);
  });
});
