// IMPORTANT: Set DB_ENGINE to neo4j BEFORE importing any app modules
// This ensures repositories are initialized with Neo4j implementations
process.env.DB_ENGINE = 'neo4j';
process.env.NEO4J_URI = process.env.NEO4J_TEST_URI || 'bolt://localhost:7687';
process.env.NEO4J_USER = process.env.NEO4J_TEST_USER || 'neo4j';
process.env.NEO4J_PASSWORD = process.env.NEO4J_TEST_PASSWORD || 'mytick123';
process.env.JWT_SECRET = 'test-secret';
process.env.ADMIN_API_KEY = 'test-admin-key';
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import neo4j, { Driver } from 'neo4j-driver';
import request from 'supertest';
import app from '../src/app';
import { connectNeo4j, closeNeo4j } from '../src/neo4j';

let driver: Driver | null = null;

export async function setupTestDB() {
  const uri = process.env.NEO4J_URI!;
  const user = process.env.NEO4J_USER!;
  const password = process.env.NEO4J_PASSWORD!;

  // SAFETY: Prevent running tests against production/cloud Neo4j
  if (uri.includes('neo4j.io') || uri.includes('aura') || uri.includes('cloud')) {
    throw new Error(
      '❌ SAFETY CHECK FAILED: Cannot run tests against cloud/production Neo4j!\n' +
      `   URI: ${uri}\n` +
      '   Tests will DELETE ALL DATA. Use local Neo4j only.\n' +
      '   Expected: bolt://localhost:7687\n' +
      '   To fix: Start local Neo4j with `docker start mytick-neo4j`'
    );
  }

  // Additional safety: Only allow localhost
  if (!uri.includes('localhost') && !uri.includes('127.0.0.1')) {
    throw new Error(
      '❌ SAFETY CHECK FAILED: Tests can only run against localhost!\n' +
      `   URI: ${uri}\n` +
      '   Tests will DELETE ALL DATA. Use local Neo4j only.\n' +
      '   Expected: bolt://localhost:7687'
    );
  }

  // Connect to Neo4j for app
  driver = await connectNeo4j(uri, user, password);

  // Clean up any existing test data
  const session = driver.session();
  try {
    await session.run('MATCH (n) DETACH DELETE n');
  } finally {
    await session.close();
  }
}

export async function teardownTestDB() {
  if (driver) {
    const session = driver.session();
    try {
      await session.run('MATCH (n) DETACH DELETE n');
    } finally {
      await session.close();
    }
  }
  await closeNeo4j();
  driver = null;
}

export async function createTestUser(email = 'test@test.com', username = 'testuser') {
  const res = await request(app).post('/api/auth/register').send({
    email, password: 'password123', name: 'Test User', username,
  });
  return { token: res.body.token, user: res.body.user, userId: res.body.user.id };
}

export async function cleanBackupHistory() {
  if (!driver) throw new Error('Driver not initialized. Call setupTestDB() first.');
  const session = driver.session();
  try {
    await session.run('MATCH (h:BackupHistory) DETACH DELETE h');
  } finally {
    await session.close();
  }
}

export { app };
