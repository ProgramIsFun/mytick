import { describe, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';
import { secretRepo, databaseRepo, accountRepo } from '../../src/repositories';

let token: string;
let userId: string;

beforeAll(async () => {
  await setupTestDB();
  ({ token, userId } = await createTestUser());
}, 120000);

afterAll(async () => {
  await teardownTestDB();
});

describe('Secrets API - /api/secrets', () => {
  describe('POST /api/secrets', () => {
    it('should create a new secret with all fields', async () => {
      const secretData = {
        name: 'MongoDB Production Connection',
        description: 'Connection string for production MongoDB',
        provider: 'bitwarden',
        secretValue: 'bw-secret-abc123',
        type: 'connection_string',
        tags: ['production', 'critical'],
      };

      const res = await request(app)
        .post('/api/secrets')
        .set('Authorization', `Bearer ${token}`)
        .send(secretData)
        .expect(201);

      expect(res.body.name).toBe(secretData.name);
      expect(res.body.description).toBe(secretData.description);
      expect(res.body.provider).toBe(secretData.provider);
      expect(res.body.secretValue).toBe(secretData.secretValue);
      expect(res.body.type).toBe(secretData.type);
      expect(res.body.tags).toEqual(secretData.tags);
      expect(res.body.id).toBeDefined();
      expect(res.body.userId).toBe(userId);
    });


    it('should create secret with minimal required fields', async () => {
      const res = await request(app)
        .post('/api/secrets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'AWS API Key',
          provider: 'custom',
          secretValue: 'arn:aws:secretsmanager:us-east-1:123:secret:api-key',
          type: 'api_key',
        })
        .expect(201);

      expect(res.body.name).toBe('AWS API Key');
      expect(res.body.description).toBe('');
      expect(res.body.tags).toEqual([]);
    });

    it('should reject secret without required name', async () => {
      await request(app)
        .post('/api/secrets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          provider: 'bitwarden',
          secretValue: 'test-id',
          type: 'password',
        })
        .expect(400);
    });

    it('should reject secret without required provider', async () => {
      await request(app)
        .post('/api/secrets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test',
          secretValue: 'test-id',
          type: 'password',
        })
        .expect(400);
    });

    it('should reject unauthenticated requests', async () => {
      await request(app)
        .post('/api/secrets')
        .send({
          name: 'Test',
          provider: 'bitwarden',
          secretValue: 'id',
          type: 'api_key',
        })
        .expect(401);
    });
  });

  describe('GET /api/secrets', () => {
    let secrets: any[];
    beforeAll(async () => {
      secrets = await Promise.all([
        secretRepo.create({
          userId,
          name: 'MongoDB Atlas Connection',
          provider: 'bitwarden',
          secretValue: 'mongo-prod-123',
          type: 'connection_string',
          tags: ['production', 'mongodb', 'atlas'],
        }),
        secretRepo.create({
          userId,
          name: 'AWS RDS Password',
          provider: 'aws_secrets',
          secretValue: 'arn:aws:secretsmanager:us-east-1:123:secret:rds',
          type: 'password',
          tags: ['aws', 'rds'],
        }),
        secretRepo.create({
          userId,
          name: 'GitHub Personal Token',
          provider: 'bitwarden',
          secretValue: 'gh-token-789',
          type: 'token',
          tags: ['github', 'ci'],
        }),
        secretRepo.create({
          userId,
          name: 'Stripe API Key',
          provider: '1password',
          secretValue: '1pass-stripe-key',
          type: 'api_key',
          tags: ['stripe', 'payment'],
        }),
      ]);
    });

    it('should list all secrets for authenticated user', async () => {
      const res = await request(app)
        .get('/api/secrets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(6);
      const names = res.body.map((s: any) => s.name);
      expect(names).toContain('Stripe API Key');
      expect(names).toContain('AWS RDS Password');
      expect(names).toContain('GitHub Personal Token');
      expect(names).toContain('MongoDB Atlas Connection');
      expect(names).toContain('MongoDB Production Connection');
      expect(names).toContain('AWS API Key');
    });

    it('should filter secrets by provider (bitwarden)', async () => {
      const res = await request(app)
        .get('/api/secrets?provider=bitwarden')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(3);
      expect(res.body.every((s: any) => s.provider === 'bitwarden')).toBe(true);
    });

    it('should filter secrets by provider (aws_secrets)', async () => {
      const res = await request(app)
        .get('/api/secrets?provider=aws_secrets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('AWS RDS Password');
    });

    it('should filter secrets by type (connection_string)', async () => {
      const res = await request(app)
        .get('/api/secrets?type=connection_string')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.every((s: any) => s.type === 'connection_string')).toBe(true);
    });

    it('should filter secrets by type (api_key)', async () => {
      const res = await request(app)
        .get('/api/secrets?type=api_key')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.every((s: any) => s.type === 'api_key')).toBe(true);
    });

    it('should filter secrets by tag', async () => {
      const res = await request(app)
        .get('/api/secrets?tag=mongodb')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].tags).toContain('mongodb');
    });

    it('should search secrets by name (case insensitive)', async () => {
      const res = await request(app)
        .get('/api/secrets?search=MongoDB%20Atlas')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toContain('MongoDB Atlas');
    });

    it('should search secrets by name partial match', async () => {
      const res = await request(app)
        .get('/api/secrets?search=Key')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const names = res.body.map((s: any) => s.name);
      expect(names).toContain('Stripe API Key');
    });
  });

  describe('GET /api/secrets/:id', () => {
    it('should get a specific secret by ID', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Test Secret Details',
        provider: 'bitwarden',
        secretValue: 'test-details-123',
        type: 'password',
        tags: ['test'],
        description: 'Detailed test secret',
      });


      const res = await request(app)
        .get(`/api/secrets/${secret.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.name).toBe('Test Secret Details');
      expect(res.body.description).toBe('Detailed test secret');
      expect(res.body.id).toBe(secret.id);
    });

    it('should return 404 for non-existent secret id', async () => {
      const fakeId = 'nonexistent_secret_id_12345';
      await request(app)
        .get(`/api/secrets/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('PATCH /api/secrets/:id', () => {
    it('should update secret name and description', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Original Name',
        description: 'Original description',
        provider: 'bitwarden',
        secretValue: 'test-update-123',
        type: 'password',
        tags: ['old'],
      });

      const res = await request(app)
        .patch(`/api/secrets/${secret.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          description: 'Updated description',
        })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
      expect(res.body.description).toBe('Updated description');
      expect(res.body.provider).toBe('bitwarden'); // Unchanged
    });

    it('should update secret tags', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Tag Test',
        provider: 'bitwarden',
        secretValue: 'test-tags-123',
        type: 'api_key',
        tags: ['old', 'deprecated'],
      });

      const res = await request(app)
        .patch(`/api/secrets/${secret.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tags: ['new', 'active', 'production'],
        })
        .expect(200);

      expect(res.body.tags).toEqual(['new', 'active', 'production']);
    });

    it('should update secretValue (for secret rotation)', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Rotatable Secret',
        provider: 'bitwarden',
        secretValue: 'old-secret-id',
        type: 'api_key',
        tags: [],
      });

      const res = await request(app)
        .patch(`/api/secrets/${secret.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          secretValue: 'new-rotated-secret-id',
          lastRotatedAt: new Date().toISOString(),
        })
        .expect(200);

      expect(res.body.secretValue).toBe('new-rotated-secret-id');
      expect(res.body.lastRotatedAt).toBeDefined();
    });

    it('should not allow updating immutable userId field', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Immutable Test',
        provider: 'bitwarden',
        secretValue: 'test-immutable-123',
        type: 'password',
        tags: [],
      });

      await request(app)
        .patch(`/api/secrets/${secret.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: '507f1f77bcf86cd799439011', // Try to change userId
          name: 'Updated Name',
        })
        .expect(200);

      const updated = await secretRepo.findById(secret.id);
      expect(updated!.userId).toBe(userId); // Still original userId
      expect(updated!.name).toBe('Updated Name'); // Other fields updated
    });
  });

  describe('DELETE /api/secrets/:id', () => {
    it('should delete a secret with no usage', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Unused Secret',
        provider: 'bitwarden',
        secretValue: 'test-delete-123',
        type: 'password',
        tags: [],
      });

      await request(app)
        .delete(`/api/secrets/${secret.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const deleted = await secretRepo.findById(secret.id);
      expect(deleted).toBeNull();
    });

    it('should prevent deleting a secret in use by a database', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'In Use Secret',
        provider: 'bitwarden',
        secretValue: 'test-in-use-123',
        type: 'connection_string',
        tags: [],
      });

      await databaseRepo.create({
        userId,
        name: 'Production DB',
        type: 'mongodb',
        secretId: secret.id,
        backupEnabled: true,
      });

      const res = await request(app)
        .delete(`/api/secrets/${secret.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.error).toBe('Secret is in use');
      expect(res.body.usedBy).toHaveLength(1);
      expect(res.body.usedBy[0].collection).toBe('databases');

      const stillExists = await secretRepo.findById(secret.id);
      expect(stillExists).not.toBeNull();
    });

    it('should prevent deleting a secret in use by multiple resources', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Widely Used Secret',
        provider: 'bitwarden',
        secretValue: 'test-widely-used-123',
        type: 'api_key',
        tags: [],
      });

      await databaseRepo.create({
        userId,
        name: 'Production DB',
        type: 'mongodb',
        secretId: secret.id,
        backupEnabled: true,
      });

      await accountRepo.create({
        userId,
        name: 'AWS Account',
        provider: 'aws',
        credentials: [{ secretId: secret.id, key: 'AWS_KEY' }],
      });

      const res = await request(app)
        .delete(`/api/secrets/${secret.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.usedBy).toHaveLength(2);
    });
  });



  describe('POST /api/secrets/:id/touch', () => {
    it('should update lastAccessedAt timestamp', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Touch Test',
        provider: 'bitwarden',
        secretValue: 'test-touch-123',
        type: 'password',
        tags: [],
        lastAccessedAt: undefined,
      });

      const before = Date.now();
      
      const res = await request(app)
        .post(`/api/secrets/${secret.id}/touch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const after = Date.now();
      const lastAccessed = new Date(res.body.lastAccessedAt).getTime();

      expect(lastAccessed).toBeGreaterThanOrEqual(before - 1000); // 1s tolerance
      expect(lastAccessed).toBeLessThanOrEqual(after + 1000);
    });

    it('should update timestamp on subsequent touches', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Multi Touch Test',
        provider: 'bitwarden',
        secretValue: 'test-multi-touch-123',
        type: 'token',
        tags: [],
        lastAccessedAt: new Date('2020-01-01'),
      });

      const firstTouch = await request(app)
        .post(`/api/secrets/${secret.id}/touch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms

      const secondTouch = await request(app)
        .post(`/api/secrets/${secret.id}/touch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const first = new Date(firstTouch.body.lastAccessedAt).getTime();
      const second = new Date(secondTouch.body.lastAccessedAt).getTime();

      expect(second).toBeGreaterThan(first);
    });
  });

  describe('Integration: Secret with Database', () => {
    it('should create database with secretId reference', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Integration Test Secret',
        provider: 'bitwarden',
        secretValue: 'bw-integration-123',
        type: 'connection_string',
        tags: [],
      });

      const dbRes = await request(app)
        .post('/api/databases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Integration Test DB',
          type: 'mongodb',
          secretId: secret.id,
          backupEnabled: true,
        })
        .expect(201);

      expect(dbRes.body.secretId).toBe(secret.id);
    });

    it('should populate secret in backupable endpoint', async () => {
      const secret = await secretRepo.create({
        userId,
        name: 'Backupable Test Secret',
        provider: 'bitwarden',
        secretValue: 'bw-backupable-123',
        type: 'connection_string',
        tags: [],
      });

      const db = await databaseRepo.create({
        userId,
        name: 'Backupable Test DB',
        type: 'mongodb',
        secretId: secret.id,
        backupEnabled: true,
        backupRetentionDays: 30,
        backupFrequency: 'daily',
      });

      const res = await request(app)
        .get('/api/databases/backupable')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const ourDb = res.body.find((d: any) => d.id === db.id);
      expect(ourDb).toBeDefined();
      expect(ourDb.secretId).toBe(secret.id);
    });
  });
});

