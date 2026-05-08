import { describe, it, beforeAll, afterAll } from '@jest/globals';
import { setupTestDB, teardownTestDB } from '../helpers';
import BackupHistory from '../../src/models/BackupHistory';
import Database from '../../src/models/Database';
import User from '../../src/models/User';
import { Types } from 'mongoose';

let userId: Types.ObjectId;
let databaseId: Types.ObjectId;

beforeAll(async () => {
  await setupTestDB();
  
  // Create test user
  const user = await User.create({
    email: 'test@example.com',
    username: 'testuser',
    name: 'Test User',
    providers: [{ type: 'local', providerId: 'test@example.com', passwordHash: 'hash' }]
  });
  userId = user._id;

  // Create test database
  const db = await Database.create({
    userId,
    name: 'Test DB',
    type: 'mongodb',
    backupEnabled: true
  });
  databaseId = db._id;
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

describe('BackupHistory Model', () => {
  it('should create backup history record with all fields', async () => {
    const startedAt = new Date(Date.now() - 120000);
    const completedAt = new Date();

    const backup = await BackupHistory.create({
      databaseId,
      userId,
      status: 'success',
      startedAt,
      completedAt,
      durationMs: 120000,
      sizeBytes: 1048576,
      s3Path: 'backups/test.gz',
      s3Bucket: 'nexus-backups',
      metadata: {
        collections: 10,
        documents: 5000
      },
      triggeredBy: 'scheduled',
      lambdaRequestId: 'lambda-123'
    });

    expect(backup._id).toBeTruthy();
    expect(backup.databaseId.toString()).toBe(databaseId.toString());
    expect(backup.status).toBe('success');
    expect(backup.durationMs).toBe(120000);
    expect(backup.sizeBytes).toBe(1048576);
    expect(backup.s3Path).toBe('backups/test.gz');
    expect(backup.metadata.collections).toBe(10);
    expect(backup.triggeredBy).toBe('scheduled');
  });

  it('should create failed backup with error message', async () => {
    const backup = await BackupHistory.create({
      databaseId,
      userId,
      status: 'failed',
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 5000,
      sizeBytes: 0,
      s3Path: '',
      s3Bucket: 'nexus-backups',
      errorMessage: 'Connection timeout',
      metadata: {},
      triggeredBy: 'manual'
    });

    expect(backup.status).toBe('failed');
    expect(backup.errorMessage).toBe('Connection timeout');
    expect(backup.sizeBytes).toBe(0);
    expect(backup.triggeredBy).toBe('manual');
  });

  it('should have default values for optional fields', async () => {
    const backup = await BackupHistory.create({
      databaseId,
      userId,
      status: 'success',
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 10000,
      s3Path: 'test.gz',
      s3Bucket: 'test-bucket'
    });

    expect(backup.sizeBytes).toBe(0);
    expect(backup.metadata).toEqual({});
    expect(backup.triggeredBy).toBe('scheduled');
  });

  it('should query backups by database', async () => {
    // Create multiple backups
    await BackupHistory.create({
      databaseId,
      userId,
      status: 'success',
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 10000,
      s3Path: 'backup1.gz',
      s3Bucket: 'test'
    });

    await BackupHistory.create({
      databaseId,
      userId,
      status: 'success',
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 15000,
      s3Path: 'backup2.gz',
      s3Bucket: 'test'
    });

    const backups = await BackupHistory.find({ databaseId }).sort({ completedAt: -1 });
    expect(backups.length).toBeGreaterThanOrEqual(2);
  });

  it('should query backups by status', async () => {
    await BackupHistory.create({
      databaseId,
      userId,
      status: 'failed',
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 5000,
      sizeBytes: 0,
      s3Path: '',
      s3Bucket: 'test',
      errorMessage: 'Test error'
    });

    const failedBackups = await BackupHistory.find({ status: 'failed' });
    expect(failedBackups.length).toBeGreaterThanOrEqual(1);
    expect(failedBackups.every(b => b.status === 'failed')).toBe(true);
  });

  it('should query backups by user', async () => {
    const backups = await BackupHistory.find({ userId });
    expect(backups.length).toBeGreaterThanOrEqual(1);
    expect(backups.every(b => b.userId.toString() === userId.toString())).toBe(true);
  });

  it('should have timestamps', async () => {
    const backup = await BackupHistory.create({
      databaseId,
      userId,
      status: 'success',
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 10000,
      s3Path: 'test.gz',
      s3Bucket: 'test'
    });

    expect(backup.createdAt).toBeTruthy();
    expect(backup.updatedAt).toBeTruthy();
  });

  it('should support all status types', async () => {
    const statuses: Array<'success' | 'failed' | 'partial'> = ['success', 'failed', 'partial'];

    for (const status of statuses) {
      const backup = await BackupHistory.create({
        databaseId,
        userId,
        status,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 10000,
        s3Path: 'test.gz',
        s3Bucket: 'test'
      });

      expect(backup.status).toBe(status);
    }
  });

  it('should store complex metadata', async () => {
    const backup = await BackupHistory.create({
      databaseId,
      userId,
      status: 'success',
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 30000,
      sizeBytes: 5242880,
      s3Path: 'backup.gz',
      s3Bucket: 'test',
      metadata: {
        collections: 15,
        documents: 100000,
        indexes: 25,
        avgDocSize: 52,
        customField: 'custom value'
      }
    });

    expect(backup.metadata.collections).toBe(15);
    expect(backup.metadata.documents).toBe(100000);
    expect(backup.metadata.customField).toBe('custom value');
  });
});
