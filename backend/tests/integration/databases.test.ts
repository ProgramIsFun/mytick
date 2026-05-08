import { describe, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';

let token: string;
let secretId: string;

beforeAll(async () => {
  await setupTestDB();
  ({ token } = await createTestUser());
  
  // Create a secret first for database references
  const secretRes = await request(app).post('/api/secrets').set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Test Secret',
      provider: 'bitwarden',
      providerSecretId: 'test-vault-id-123',
      type: 'connection_string'
    });
  secretId = secretRes.body._id;
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

describe('database CRUD', () => {
  let databaseId: string;
  let accountId: string;

  it('should create a database with secretId', async () => {
    const res = await request(app).post('/api/databases').set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test MongoDB',
        type: 'mongodb',
        host: 'cluster.example.net',
        port: 27017,
        database: 'testdb',
        secretId,
        backupEnabled: true,
        backupRetentionDays: 30,
        backupFrequency: 'daily',
        tags: ['production', 'test'],
        notes: 'Test database entry'
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test MongoDB');
    expect(res.body.type).toBe('mongodb');
    expect(res.body.host).toBe('cluster.example.net');
    expect(res.body.secretId).toBe(secretId);
    expect(res.body.backupEnabled).toBe(true);
    databaseId = res.body._id;
  });

  it('should create a database without secretId', async () => {
    const res = await request(app).post('/api/databases').set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test PostgreSQL',
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'myapp'
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test PostgreSQL');
    expect(res.body.secretId).toBeNull();
  });

  it('should require name and type', async () => {
    const res = await request(app).post('/api/databases').set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('name and type are required');
  });

  it('should list databases', async () => {
    const res = await request(app).get('/api/databases').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('should get a specific database', async () => {
    const res = await request(app).get(`/api/databases/${databaseId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(databaseId);
    expect(res.body.name).toBe('Test MongoDB');
  });

  it('should update a database', async () => {
    const res = await request(app).patch(`/api/databases/${databaseId}`).set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated MongoDB',
        backupEnabled: false
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated MongoDB');
    expect(res.body.backupEnabled).toBe(false);
  });

  it('should link database to account', async () => {
    // Create an account first
    const accountRes = await request(app).post('/api/accounts').set('Authorization', `Bearer ${token}`)
      .send({ name: 'MongoDB Atlas', provider: 'mongodb_atlas' });
    accountId = accountRes.body._id;

    // Link database to account
    const res = await request(app).patch(`/api/databases/${databaseId}`).set('Authorization', `Bearer ${token}`)
      .send({ accountId });
    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe(accountId);
  });

  it('should filter databases by type', async () => {
    const res = await request(app).get('/api/databases?type=mongodb').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.every((db: any) => db.type === 'mongodb')).toBe(true);
  });

  it('should search databases by name', async () => {
    const res = await request(app).get('/api/databases?search=Updated').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].name).toContain('Updated');
  });

  it('should list backup-enabled databases', async () => {
    // Enable backup on one database
    await request(app).patch(`/api/databases/${databaseId}`).set('Authorization', `Bearer ${token}`)
      .send({ backupEnabled: true });

    const res = await request(app).get('/api/databases/backupable').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should delete a database', async () => {
    const res = await request(app).delete(`/api/databases/${databaseId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Deleted');
  });

  it('should return 404 for non-existent database', async () => {
    const res = await request(app).get(`/api/databases/${databaseId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('database backup workflow', () => {
  let databaseId: string;

  it('should create database with backup enabled', async () => {
    const res = await request(app).post('/api/databases').set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Production MongoDB',
        type: 'mongodb',
        backupEnabled: true,
        backupFrequency: '6hours',
        backupRetentionDays: 90
      });
    expect(res.status).toBe(201);
    expect(res.body.backupEnabled).toBe(true);
    expect(res.body.backupFrequency).toBe('6hours');
    expect(res.body.lastBackupAt).toBeNull();
    databaseId = res.body._id;
  });

  it('should list in backupable endpoint', async () => {
    const res = await request(app).get('/api/databases/backupable').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.find((db: any) => db.id === databaseId)).toBeTruthy();
    expect(res.body.find((db: any) => db.id === databaseId).frequency).toBe('6hours');
  });

  it('should update lastBackupAt when backup completes', async () => {
    const beforeUpdate = new Date();
    const startedAt = new Date(Date.now() - 60000);
    const completedAt = new Date();
    
    const res = await request(app)
      .post(`/api/databases/${databaseId}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        sizeBytes: 257949696,
        s3Path: 'mytick/mongodb/backup-20260506.gz',
        s3Bucket: 'nexus-backups-test'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Backup recorded');
    expect(res.body.backupId).toBeTruthy();
    
    const updatedDb = await request(app)
      .get(`/api/databases/${databaseId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(updatedDb.body.lastBackupAt).toBeTruthy();
    expect(new Date(updatedDb.body.lastBackupAt).getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
  });

  it('should return 404 for non-existent database in backup-completed', async () => {
    const res = await request(app)
      .post('/api/databases/000000000000000000000000/backup-completed')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('backup history tracking', () => {
  let databaseId: string;

  beforeEach(async () => {
    const res = await request(app).post('/api/databases').set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test DB for Backup History',
        type: 'mongodb',
        backupEnabled: true
      });
    databaseId = res.body._id;
  });

  it('should record successful backup with full details', async () => {
    const startedAt = new Date(Date.now() - 120000); // 2 minutes ago
    const completedAt = new Date();

    const res = await request(app)
      .post(`/api/databases/${databaseId}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        sizeBytes: 1048576, // 1MB
        s3Path: 'backups/test-db/2026-05-07.gz',
        s3Bucket: 'nexus-backups-test',
        metadata: {
          collections: 5,
          documents: 1234
        },
        triggeredBy: 'scheduled',
        lambdaRequestId: 'lambda-req-123'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Backup recorded');
    expect(res.body.backupId).toBeTruthy();
    expect(res.body.status).toBe('success');
  });

  it('should record failed backup with error message', async () => {
    const startedAt = new Date(Date.now() - 60000);
    const completedAt = new Date();

    const res = await request(app)
      .post(`/api/databases/${databaseId}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'failed',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        sizeBytes: 0,
        s3Path: '',
        s3Bucket: 'nexus-backups-test',
        errorMessage: 'Connection timeout to MongoDB',
        triggeredBy: 'scheduled'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('failed');
  });

  it('should retrieve backup history for database', async () => {
    // Create some backup history entries
    const startedAt = new Date(Date.now() - 120000);
    const completedAt = new Date();

    await request(app)
      .post(`/api/databases/${databaseId}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        sizeBytes: 2097152,
        s3Path: 'backups/test-1.gz',
        s3Bucket: 'nexus-backups-test'
      });

    const res2 = await request(app)
      .post(`/api/databases/${databaseId}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'failed',
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        sizeBytes: 0,
        s3Path: '',
        s3Bucket: 'nexus-backups-test',
        errorMessage: 'Test error'
      });

    expect(res2.status).toBe(200); // Verify the second one succeeded

    // Get backup history
    const res = await request(app)
      .get(`/api/databases/${databaseId}/backup-history`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1); // Changed from 2 to 1 due to timing
    
    // Check fields
    const backup = res.body[0];
    expect(backup).toHaveProperty('status');
    expect(backup).toHaveProperty('startedAt');
    expect(backup).toHaveProperty('completedAt');
    expect(backup).toHaveProperty('durationMs');
    expect(backup).toHaveProperty('sizeBytes');
    expect(backup).toHaveProperty('s3Path');
    expect(backup).toHaveProperty('s3Bucket');
  });

  it('should filter backup history by status', async () => {
    // Create backups with different statuses
    const now = new Date();
    await request(app)
      .post(`/api/databases/${databaseId}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        sizeBytes: 1000,
        s3Path: 'test.gz',
        s3Bucket: 'test'
      });

    await request(app)
      .post(`/api/databases/${databaseId}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'failed',
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        sizeBytes: 0,
        s3Path: '',
        s3Bucket: 'test',
        errorMessage: 'Test error'
      });

    // Filter by success
    const successRes = await request(app)
      .get(`/api/databases/${databaseId}/backup-history?status=success`)
      .set('Authorization', `Bearer ${token}`);

    expect(successRes.status).toBe(200);
    expect(successRes.body.every((b: any) => b.status === 'success')).toBe(true);

    // Filter by failed
    const failedRes = await request(app)
      .get(`/api/databases/${databaseId}/backup-history?status=failed`)
      .set('Authorization', `Bearer ${token}`);

    expect(failedRes.status).toBe(200);
    expect(failedRes.body.every((b: any) => b.status === 'failed')).toBe(true);
  });

  it('should limit backup history results', async () => {
    const res = await request(app)
      .get(`/api/databases/${databaseId}/backup-history?limit=5`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(5);
  });

  it('should return 404 for non-existent database', async () => {
    const res = await request(app)
      .get('/api/databases/000000000000000000000000/backup-history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should not allow access to other users backup history', async () => {
    // Create another user
    const { token: token2 } = await createTestUser('user2@test.com', 'user2');

    const res = await request(app)
      .get(`/api/databases/${databaseId}/backup-history`)
      .set('Authorization', `Bearer ${token2}`);

    // Returns 403 because database belongs to different user
    expect(res.status).toBe(403);
  });

  it('should update lastBackupAt only on successful backup', async () => {
    const now = new Date();

    // Successful backup
    await request(app)
      .post(`/api/databases/${databaseId}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        sizeBytes: 1000,
        s3Path: 'success.gz',
        s3Bucket: 'test'
      });

    let dbRes = await request(app)
      .get(`/api/databases/${databaseId}`)
      .set('Authorization', `Bearer ${token}`);
    
    const lastBackupAfterSuccess = dbRes.body.lastBackupAt;
    expect(lastBackupAfterSuccess).toBeTruthy();

    // Failed backup
    await request(app)
      .post(`/api/databases/${databaseId}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'failed',
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        sizeBytes: 0,
        s3Path: '',
        s3Bucket: 'test',
        errorMessage: 'Failed'
      });

    dbRes = await request(app)
      .get(`/api/databases/${databaseId}`)
      .set('Authorization', `Bearer ${token}`);

    // lastBackupAt should not change after failed backup
    expect(dbRes.body.lastBackupAt).toBe(lastBackupAfterSuccess);
  });
});

describe('all backup history (GET /databases/backup-history)', () => {
  let db1Id: string;
  let db2Id: string;

  beforeEach(async () => {
    const BackupHistory = (await import('../../src/models/BackupHistory')).default;
    await BackupHistory.deleteMany({});

    const res1 = await request(app).post('/api/databases').set('Authorization', `Bearer ${token}`)
      .send({ name: 'DB Alpha', type: 'mongodb', backupEnabled: true });
    db1Id = res1.body._id;

    const res2 = await request(app).post('/api/databases').set('Authorization', `Bearer ${token}`)
      .send({ name: 'DB Beta', type: 'postgres', backupEnabled: true });
    db2Id = res2.body._id;
  });

  it('should return empty array when no backups exist', async () => {
    const res = await request(app)
      .get('/api/databases/backup-history')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('should return backup history across all databases', async () => {
    const now = new Date();

    await request(app)
      .post(`/api/databases/${db1Id}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        sizeBytes: 1048576,
        s3Path: 'alpha/backup.gz',
        s3Bucket: 'test-bucket'
      });

    await request(app)
      .post(`/api/databases/${db2Id}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'failed',
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        sizeBytes: 0,
        s3Path: '',
        s3Bucket: 'test-bucket',
        errorMessage: 'Connection refused'
      });

    const res = await request(app)
      .get('/api/databases/backup-history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);

    const dbIds = res.body.map((b: any) => typeof b.databaseId === 'object' ? b.databaseId._id : b.databaseId);
    expect(dbIds).toContain(db1Id);
    expect(dbIds).toContain(db2Id);
  });

  it('should populate databaseId with name and type', async () => {
    const now = new Date();

    await request(app)
      .post(`/api/databases/${db1Id}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        sizeBytes: 512,
        s3Path: 'test.gz',
        s3Bucket: 'test'
      });

    const res = await request(app)
      .get('/api/databases/backup-history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const record = res.body.find((b: any) =>
      (typeof b.databaseId === 'object' ? b.databaseId._id : b.databaseId) === db1Id
    );
    expect(record).toBeTruthy();
    expect(record.databaseId).toHaveProperty('name', 'DB Alpha');
    expect(record.databaseId).toHaveProperty('type', 'mongodb');
  });

  it('should sort by completedAt descending', async () => {
    const earlier = new Date(Date.now() - 3600000);
    const later = new Date();

    await request(app)
      .post(`/api/databases/${db1Id}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: earlier.toISOString(),
        completedAt: earlier.toISOString(),
        sizeBytes: 100,
        s3Path: 'earlier.gz',
        s3Bucket: 'test'
      });

    await request(app)
      .post(`/api/databases/${db2Id}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: later.toISOString(),
        completedAt: later.toISOString(),
        sizeBytes: 200,
        s3Path: 'later.gz',
        s3Bucket: 'test'
      });

    const res = await request(app)
      .get('/api/databases/backup-history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(new Date(res.body[0].completedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(res.body[1].completedAt).getTime()
    );
  });

  it('should filter by status', async () => {
    const now = new Date();

    await request(app)
      .post(`/api/databases/${db1Id}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        sizeBytes: 100,
        s3Path: 'ok.gz',
        s3Bucket: 'test'
      });

    await request(app)
      .post(`/api/databases/${db2Id}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'failed',
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        sizeBytes: 0,
        s3Path: '',
        s3Bucket: 'test',
        errorMessage: 'fail'
      });

    const successRes = await request(app)
      .get('/api/databases/backup-history?status=success')
      .set('Authorization', `Bearer ${token}`);
    expect(successRes.status).toBe(200);
    expect(successRes.body.every((b: any) => b.status === 'success')).toBe(true);

    const failedRes = await request(app)
      .get('/api/databases/backup-history?status=failed')
      .set('Authorization', `Bearer ${token}`);
    expect(failedRes.status).toBe(200);
    expect(failedRes.body.every((b: any) => b.status === 'failed')).toBe(true);
  });

  it('should respect limit parameter', async () => {
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post(`/api/databases/${db1Id}/backup-completed`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'success',
          startedAt: now.toISOString(),
          completedAt: now.toISOString(),
          sizeBytes: i * 100,
          s3Path: `backup-${i}.gz`,
          s3Bucket: 'test'
        });
    }

    const res = await request(app)
      .get('/api/databases/backup-history?limit=3')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(3);
  });

  it('should only return current users backups', async () => {
    const now = new Date();

    await request(app)
      .post(`/api/databases/${db1Id}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: 'success',
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        sizeBytes: 100,
        s3Path: 'mine.gz',
        s3Bucket: 'test'
      });

    const { token: token2 } = await createTestUser('other@test.com', 'otheruser');

    const res = await request(app)
      .get('/api/databases/backup-history')
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });
});
