import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app';

let mongo: MongoMemoryServer;
let token: string;
let taskA: string;
let taskB: string;
let taskC: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_API_KEY = 'test-admin-key';

  // Register a user
  const res = await request(app).post('/api/auth/register').send({
    email: 'test@test.com', password: 'password123', name: 'Test', username: 'testuser',
  });
  token = res.body.token;
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe('blockedBy cycle detection', () => {
  it('should create 3 tasks', async () => {
    const a = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Task A' });
    const b = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Task B' });
    const c = await request(app).post('/api/tasks').set('Authorization', `Bearer ${token}`).send({ title: 'Task C' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(c.status).toBe(201);
    taskA = a.body._id;
    taskB = b.body._id;
    taskC = c.body._id;
  });

  it('should allow A blocked by B', async () => {
    const res = await request(app).patch(`/api/tasks/${taskA}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [taskB] });
    expect(res.status).toBe(200);
    expect(res.body.blockedBy).toContain(taskB);
  });

  it('should allow B blocked by C', async () => {
    const res = await request(app).patch(`/api/tasks/${taskB}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [taskC] });
    expect(res.status).toBe(200);
  });

  it('should reject C blocked by A (creates cycle A→B→C→A)', async () => {
    const res = await request(app).patch(`/api/tasks/${taskC}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [taskA] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Circular dependency detected');
  });

  it('should reject self-reference', async () => {
    const res = await request(app).patch(`/api/tasks/${taskA}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [taskA] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('A task cannot block itself');
  });

  it('should allow removing the cycle-causing dependency', async () => {
    const res = await request(app).patch(`/api/tasks/${taskC}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [] });
    expect(res.status).toBe(200);
    expect(res.body.blockedBy).toEqual([]);
  });

  it('should now allow C blocked by A after B→C link removed', async () => {
    // First remove B→C
    await request(app).patch(`/api/tasks/${taskB}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [] });
    // Now C→A should be fine (no chain back to C)
    const res = await request(app).patch(`/api/tasks/${taskC}`).set('Authorization', `Bearer ${token}`)
      .send({ blockedBy: [taskA] });
    expect(res.status).toBe(200);
  });
});
