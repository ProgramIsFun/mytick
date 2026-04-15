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

describe('task CRUD', () => {
  let taskId: string;

  it('should create a task', async () => {
    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test task' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test task');
    taskId = res.body._id;
  });

  it('should get a task', async () => {
    const res = await request(app).get(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test task');
  });

  it('should update a task', async () => {
    const res = await request(app).patch(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated', status: 'done' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(res.body.status).toBe('done');
  });

  it('should delete a task', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('should reject invalid title', async () => {
    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: '' });
    expect(res.status).toBe(400);
  });
});

describe('task deadline', () => {
  it('should create with deadline', async () => {
    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tax return', deadline: '2026-04-23T10:00:00.000Z' });
    expect(res.status).toBe(201);
    expect(res.body.deadline).toBe('2026-04-23T10:00:00.000Z');
  });

  it('should create without deadline', async () => {
    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'No deadline' });
    expect(res.status).toBe(201);
    expect(res.body.deadline).toBeNull();
  });

  it('should update deadline', async () => {
    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Update me' });
    const res = await request(app).patch(`/api/tasks/${task.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ deadline: '2026-05-01T00:00:00.000Z' });
    expect(res.status).toBe(200);
    expect(res.body.deadline).toBe('2026-05-01T00:00:00.000Z');
  });

  it('should clear deadline with null', async () => {
    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Clear me', deadline: '2026-06-01T00:00:00.000Z' });
    const res = await request(app).patch(`/api/tasks/${task.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ deadline: null });
    expect(res.status).toBe(200);
    expect(res.body.deadline).toBeNull();
  });
});

describe('task cycle detection', () => {
  it('should reject circular dependency A→B→C→A', async () => {
    const a = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'A' });
    const b = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'B' });
    const c = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'C' });

    await request(app).patch(`/api/tasks/${a.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [b.body._id] });
    await request(app).patch(`/api/tasks/${b.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [c.body._id] });

    const res = await request(app).patch(`/api/tasks/${c.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [a.body._id] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Circular dependency detected');
  });

  it('should reject self-reference', async () => {
    const a = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Self' });
    const res = await request(app).patch(`/api/tasks/${a.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [a.body._id] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('A task cannot block itself');
  });

  it('should allow valid dependency chain', async () => {
    const a = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'X' });
    const b = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Y' });
    const res = await request(app).patch(`/api/tasks/${a.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [b.body._id] });
    expect(res.status).toBe(200);
  });
});

describe('task pagination', () => {
  it('should return paginated results', async () => {
    const res = await request(app).get('/api/tasks?page=1&limit=5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tasks');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 5);
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body.tasks.length).toBeLessThanOrEqual(5);
  });
});

describe('task description history', () => {
  it('should save old description on update', async () => {
    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'History test', description: 'original' });
    const res = await request(app).patch(`/api/tasks/${task.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ description: 'updated' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('updated');
    expect(res.body.descriptionHistory).toHaveLength(1);
    expect(res.body.descriptionHistory[0].description).toBe('original');
  });

  it('should not save history if description unchanged', async () => {
    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'No change', description: 'same' });
    const res = await request(app).patch(`/api/tasks/${task.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ description: 'same' });
    expect(res.status).toBe(200);
    expect(res.body.descriptionHistory).toHaveLength(0);
  });

  it('should rollback description', async () => {
    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Rollback test', description: 'v1' });
    await request(app).patch(`/api/tasks/${task.body._id}`).set('Authorization', `Bearer ${token}`)
      .send({ description: 'v2' });
    const res = await request(app).post(`/api/tasks/${task.body._id}/rollback/0`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('v1');
    expect(res.body.descriptionHistory).toHaveLength(2);
  });

  it('should reject invalid rollback index', async () => {
    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad rollback' });
    const res = await request(app).post(`/api/tasks/${task.body._id}/rollback/99`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('task blocking endpoint', () => {
  it('should return tasks blocked by a given task', async () => {
    const blocker = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Blocker' });
    const blocked1 = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Blocked 1', blockedBy: [blocker.body._id] });
    const blocked2 = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Blocked 2', blockedBy: [blocker.body._id] });

    const res = await request(app).get(`/api/tasks/${blocker.body._id}/blocking`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const titles = res.body.map((t: any) => t.title);
    expect(titles).toContain('Blocked 1');
    expect(titles).toContain('Blocked 2');
  });

  it('should return empty for task blocking nothing', async () => {
    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Lonely' });
    const res = await request(app).get(`/api/tasks/${task.body._id}/blocking`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('task visibility and permissions', () => {
  let otherToken: string;

  beforeAll(async () => {
    ({ token: otherToken } = await createTestUser('visibility@test.com', 'visuser'));
  });

  it('should not let other user see private tasks', async () => {
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Private task', visibility: 'private' });
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    const titles = res.body.tasks.map((t: any) => t.title);
    expect(titles).not.toContain('Private task');
  });

  it('should not let other user update my task', async () => {
    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'My task' });
    const res = await request(app).patch(`/api/tasks/${task.body._id}`).set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Hacked' });
    expect(res.status).toBe(404);
  });

  it('should not let other user delete my task', async () => {
    const task = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Undeletable' });
    const res = await request(app).delete(`/api/tasks/${task.body._id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  it('should show public tasks to unauthenticated users via /user/:id', async () => {
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Public visible', visibility: 'public' });
    const res = await request(app).get(`/api/tasks/user/${me.body.id}`);
    expect(res.status).toBe(200);
    const titles = res.body.map((t: any) => t.title);
    expect(titles).toContain('Public visible');
  });
});

describe('task creation with groups', () => {
  it('should reject assigning task to group where user is not editor', async () => {
    const { token: ownerToken } = await createTestUser('groupowner@test.com', 'groupowner');
    const group = await request(app).post('/api/groups').set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Restricted' });

    // Add token user as viewer
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    await request(app).post(`/api/groups/${group.body._id}/members`).set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: me.body.id, role: 'viewer' });

    const res = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`)
      .send({ title: 'Viewer task', groupIds: [group.body._id], visibility: 'group' });
    expect(res.status).toBe(403);
  });
});

describe('admin key auth', () => {
  it('should allow admin key to bypass JWT', async () => {
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const res = await request(app).get('/api/tasks').set('x-admin-key', 'test-admin-key')
      .set('x-admin-user-id', me.body.id);
    expect(res.status).toBe(200);
  });

  it('should reject wrong admin key', async () => {
    const res = await request(app).get('/api/tasks').set('x-admin-key', 'wrong-key')
      .set('x-admin-user-id', 'someid');
    expect(res.status).toBe(401);
  });
});

describe('task status filter', () => {
  beforeAll(async () => {
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Done task' });
    const res = await request(app).get('/api/tasks?limit=1').set('Authorization', `Bearer ${token}`);
    await request(app).patch(`/api/tasks/${res.body.tasks[0]._id}`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'done' });
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'In progress task' });
    const res2 = await request(app).get('/api/tasks?limit=1').set('Authorization', `Bearer ${token}`);
    await request(app).patch(`/api/tasks/${res2.body.tasks[0]._id}`).set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });
  });

  it('should filter by pending', async () => {
    const res = await request(app).get('/api/tasks?status=pending').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks.every((t: any) => t.status === 'pending')).toBe(true);
  });

  it('should filter by done', async () => {
    const res = await request(app).get('/api/tasks?status=done').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);
    expect(res.body.tasks.every((t: any) => t.status === 'done')).toBe(true);
  });

  it('should filter by in_progress', async () => {
    const res = await request(app).get('/api/tasks?status=in_progress').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBeGreaterThanOrEqual(1);
    expect(res.body.tasks.every((t: any) => t.status === 'in_progress')).toBe(true);
  });

  it('should return all when no status filter', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const statuses = new Set(res.body.tasks.map((t: any) => t.status));
    expect(statuses.size).toBeGreaterThanOrEqual(2);
  });
});

describe('root tasks endpoint', () => {
  it('should return only root tasks (not in any blockedBy)', async () => {
    const { token: freshToken } = await createTestUser('roots@test.com', 'rootsuser');
    const parent = await request(app).post('/api/tasks').set('Authorization', `Bearer ${freshToken}`)
      .send({ title: 'Parent' });
    const child = await request(app).post('/api/tasks').set('Authorization', `Bearer ${freshToken}`)
      .send({ title: 'Child', blockedBy: [parent.body._id] });
    const standalone = await request(app).post('/api/tasks').set('Authorization', `Bearer ${freshToken}`)
      .send({ title: 'Standalone' });

    const res = await request(app).get('/api/tasks/roots').set('Authorization', `Bearer ${freshToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.tasks.map((t: any) => t._id);
    expect(ids).toContain(child.body._id);
    expect(ids).toContain(standalone.body._id);
    expect(ids).not.toContain(parent.body._id);
  });

  it('should support status filter', async () => {
    const { token: freshToken } = await createTestUser('roots2@test.com', 'rootsuser2');
    const parent = await request(app).post('/api/tasks').set('Authorization', `Bearer ${freshToken}`)
      .send({ title: 'P' });
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${freshToken}`)
      .send({ title: 'C', blockedBy: [parent.body._id] });

    const res = await request(app).get('/api/tasks/roots?status=pending').set('Authorization', `Bearer ${freshToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks.every((t: any) => t.status === 'pending')).toBe(true);
  });

  it('should not include other users tasks', async () => {
    const { token: t1 } = await createTestUser('roots3@test.com', 'rootsuser3');
    const { token: t2 } = await createTestUser('roots4@test.com', 'rootsuser4');
    await request(app).post('/api/tasks').set('Authorization', `Bearer ${t1}`).send({ title: 'User1 task' });
    const res = await request(app).get('/api/tasks/roots').set('Authorization', `Bearer ${t2}`);
    expect(res.status).toBe(200);
    const titles = res.body.tasks.map((t: any) => t.title);
    expect(titles).not.toContain('User1 task');
  });
});

describe('task count endpoint', () => {
  it('should return counts by status', async () => {
    const res = await request(app).get('/api/tasks/count').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('pending');
    expect(res.body).toHaveProperty('in_progress');
    expect(res.body).toHaveProperty('done');
    expect(res.body.total).toBe(res.body.pending + res.body.in_progress + res.body.done);
  });

  it('should require auth', async () => {
    const res = await request(app).get('/api/tasks/count');
    expect(res.status).toBe(401);
  });
});
