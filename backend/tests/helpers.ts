import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app';

let mongo: MongoMemoryServer | null = null;

export async function setupTestDB() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  process.env.JWT_SECRET = 'test-secret';
  process.env.ADMIN_API_KEY = 'test-admin-key';
}

export async function teardownTestDB() {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
}

export async function createTestUser(email = 'test@test.com', username = 'testuser') {
  const res = await request(app).post('/api/auth/register').send({
    email, password: 'password123', name: 'Test User', username,
  });
  return { token: res.body.token, user: res.body.user, userId: res.body.user.id };
}

export { app };
