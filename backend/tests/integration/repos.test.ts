import { describe, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';
import { taskRepo } from '../../src/repositories';

let token: string;
let userId: string;
let taskId: string;
let repoId: string;

beforeAll(async () => {
  await setupTestDB();
  const { token: t, userId: uid } = await createTestUser();
  token = t;
  userId = uid;
  const task = await taskRepo.create({ userId, title: 'Test Task' } as any);
  taskId = task.id;
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

describe('repo CRUD', () => {
  it('should create a repo', async () => {
    const res = await request(app).post('/api/repos').set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://github.com/test/repo' });
    expect(res.status).toBe(201);
    expect(res.body.url).toBe('https://github.com/test/repo');
    expect(res.body.id).toBeDefined();
    repoId = res.body.id;
  });

  it('should require url', async () => {
    const res = await request(app).post('/api/repos').set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should deduplicate by url', async () => {
    const res = await request(app).post('/api/repos').set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://github.com/test/repo' });
    expect(res.status).toBe(409);
  });

  it('should list repos', async () => {
    const res = await request(app).get('/api/repos').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should get repo by id', async () => {
    const res = await request(app).get(`/api/repos/${repoId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(repoId);
  });

  it('should delete repo', async () => {
    const res = await request(app).delete(`/api/repos/${repoId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('should not find deleted repo', async () => {
    const res = await request(app).get(`/api/repos/${repoId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('task-repo relationships', () => {
  let repoAId: string;
  let repoBId: string;

  beforeAll(async () => {
    const rA = await request(app).post('/api/repos').set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://github.com/test/repo-a' });
    repoAId = rA.body.id;
    const rB = await request(app).post('/api/repos').set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://github.com/test/repo-b' });
    repoBId = rB.body.id;
  });

  it('should link repo to task', async () => {
    const res = await request(app).post(`/api/tasks/${taskId}/repos`).set('Authorization', `Bearer ${token}`)
      .send({ repoId: repoAId });
    expect(res.status).toBe(200);
  });

  it('should get repos for task', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}/repos`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toBe(repoAId);
  });

  it('should get tasks for repo', async () => {
    const res = await request(app).get(`/api/repos/${repoAId}/tasks`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe(taskId);
  });

  it('should link second repo to task', async () => {
    const res = await request(app).post(`/api/tasks/${taskId}/repos`).set('Authorization', `Bearer ${token}`)
      .send({ repoId: repoBId });
    expect(res.status).toBe(200);
  });

  it('should have both repos for task', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}/repos`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('should unlink repo from task', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}/repos/${repoAId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('should have only one repo after unlink', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}/repos`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toBe(repoBId);
  });
});

describe('repo isolation', () => {
  it('should not see other users repos', async () => {
    const { token: otherToken } = await createTestUser('other-repo@test.com', 'otherrepo');
    await request(app).post('/api/repos').set('Authorization', `Bearer ${otherToken}`)
      .send({ url: 'https://github.com/other/user-repo' });
    const res = await request(app).get('/api/repos').set('Authorization', `Bearer ${token}`);
    expect(res.body.every((r: any) => !r.url.includes('other/user-repo'))).toBe(true);
  });
});
