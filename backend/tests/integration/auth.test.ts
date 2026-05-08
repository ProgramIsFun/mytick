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

describe('POST /api/auth/register', () => {
  it('should reject duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test@test.com', password: 'password123', name: 'Dup', username: 'dup',
    });
    expect(res.status).toBe(409);
  });

  it('should reject duplicate username', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@test.com', password: 'password123', name: 'New', username: 'testuser',
    });
    expect(res.status).toBe(409);
  });

  it('should reject reserved username', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'admin@test.com', password: 'password123', name: 'Admin', username: 'admin',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username is reserved');
  });

  it('should reject short password', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'short@test.com', password: '123', name: 'Short', username: 'shortpw',
    });
    expect(res.status).toBe(400);
  });

  it('should reject invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'notanemail', password: 'password123', name: 'Bad', username: 'bademail',
    });
    expect(res.status).toBe(400);
  });

  it('should reject invalid username format', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'fmt@test.com', password: 'password123', name: 'Fmt', username: '-invalid',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('should login with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@test.com', password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('username', 'testuser');
  });

  it('should reject wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@test.com', password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('should reject non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.com', password: 'password123',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('should return current user', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', 'test@test.com');
    expect(res.body).toHaveProperty('username', 'testuser');
  });

  it('should reject without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should reject invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/auth/me', () => {
  it('should update username', async () => {
    const res = await request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ username: 'newname' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('newname');
  });

  it('should update display name', async () => {
    const res = await request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Display Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Display Name');
  });

  it('should reject reserved username', async () => {
    const res = await request(app).patch('/api/auth/me').set('Authorization', `Bearer ${token}`)
      .send({ username: 'settings' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username is reserved');
  });
});

describe('GET /api/auth/lookup', () => {
  it('should return user with admin key', async () => {
    const res = await request(app).get('/api/auth/lookup?email=test@test.com')
      .set('x-admin-key', 'test-admin-key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  it('should reject without admin key', async () => {
    const res = await request(app).get('/api/auth/lookup?email=test@test.com');
    expect(res.status).toBe(403);
  });

  it('should 404 for unknown email', async () => {
    const res = await request(app).get('/api/auth/lookup?email=nobody@test.com')
      .set('x-admin-key', 'test-admin-key');
    expect(res.status).toBe(404);
  });
});
