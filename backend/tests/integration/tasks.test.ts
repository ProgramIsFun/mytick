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
