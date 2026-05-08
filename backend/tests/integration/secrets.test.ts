import { describe, it, beforeAll, beforeEach, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';
import Secret from '../../src/models/Secret';
import Database from '../../src/models/Database';

let token: string;
let userId: string;

beforeAll(async () => {
  await setupTestDB();
  ({ token, userId } = await createTestUser());
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

afterEach(async () => {
  await Secret.deleteMany({});
  await Database.deleteMany({});
});

describe('Secrets API - /api/secrets', () => {
  describe('POST /api/secrets', () => {
    it('should create a new secret with all fields', async () => {
      const secretData = {
        name: 'MongoDB Production Connection',
        description: 'Connection string for production MongoDB',
        provider: 'bitwarden',
        providerSecretId: 'bw-secret-abc123',
        type: 'connection_string',
        tags: ['production', 'mongodb', 'critical'],
      };

      const res = await request(app)
        .post('/api/secrets')
        .set('Authorization', `Bearer ${token}`)
        .send(secretData)
        .expect(201);

      expect(res.body.name).toBe(secretData.name);
      expect(res.body.description).toBe(secretData.description);
      expect(res.body.provider).toBe(secretData.provider);
      expect(res.body.providerSecretId).toBe(secretData.providerSecretId);
      expect(res.body.type).toBe(secretData.type);
      expect(res.body.tags).toEqual(secretData.tags);
      expect(res.body.usedBy).toEqual([]);
      expect(res.body._id).toBeDefined();
      expect(res.body.userId).toBe(userId);
    });

    it('should create secret with minimal required fields', async () => {
      const res = await request(app)
        .post('/api/secrets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'AWS API Key',
          provider: 'aws_secrets',
          providerSecretId: 'arn:aws:secretsmanager:us-east-1:123:secret:api-key',
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
          providerSecretId: 'test-id',
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
          providerSecretId: 'test-id',
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
          providerSecretId: 'id',
          type: 'api_key',
        })
        .expect(401);
    });
  });

  describe('GET /api/secrets', () => {
    beforeEach(async () => {
      await Secret.create([
        {
          userId,
          name: 'MongoDB Atlas Connection',
          provider: 'bitwarden',
          providerSecretId: 'mongo-prod-123',
          type: 'connection_string',
          tags: ['production', 'mongodb', 'atlas'],
        },
        {
          userId,
          name: 'AWS RDS Password',
          provider: 'aws_secrets',
          providerSecretId: 'arn:aws:secretsmanager:us-east-1:123:secret:rds',
          type: 'password',
          tags: ['aws', 'rds'],
        },
        {
          userId,
          name: 'GitHub Personal Token',
          provider: 'bitwarden',
          providerSecretId: 'gh-token-789',
          type: 'token',
          tags: ['github', 'ci'],
        },
        {
          userId,
          name: 'Stripe API Key',
          provider: '1password',
          providerSecretId: '1pass-stripe-key',
          type: 'api_key',
          tags: ['stripe', 'payment'],
        },
      ]);
    });

    it('should list all secrets for authenticated user', async () => {
      const res = await request(app)
        .get('/api/secrets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(4);
      expect(res.body[0].name).toBe('Stripe API Key'); // Most recent first
    });

    it('should filter secrets by provider (bitwarden)', async () => {
      const res = await request(app)
        .get('/api/secrets?provider=bitwarden')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
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

      expect(res.body).toHaveLength(1);
      expect(res.body[0].type).toBe('connection_string');
    });

    it('should filter secrets by type (api_key)', async () => {
      const res = await request(app)
        .get('/api/secrets?type=api_key')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Stripe API Key');
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
        .get('/api/secrets?search=mongo')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toContain('MongoDB');
    });

    it('should search secrets by name partial match', async () => {
      const res = await request(app)
        .get('/api/secrets?search=API')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(2); // AWS RDS + Stripe API
    });
  });

  describe('GET /api/secrets/:id', () => {
    it('should get a specific secret by ID', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Test Secret Details',
        provider: 'bitwarden',
        providerSecretId: 'test-details-123',
        type: 'password',
        tags: ['test'],
        description: 'Detailed test secret',
      });

      const res = await request(app)
        .get(`/api/secrets/${secret._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.name).toBe('Test Secret Details');
      expect(res.body.description).toBe('Detailed test secret');
      expect(res.body._id).toBe(secret._id.toString());
    });

    it('should return 404 for non-existent secret', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/secrets/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 404 for invalid ObjectId format', async () => {
      await request(app)
        .get('/api/secrets/invalid-id')
        .set('Authorization', `Bearer ${token}`)
        .expect(500); // Mongoose throws error for invalid ObjectId
    });
  });

  describe('PATCH /api/secrets/:id', () => {
    it('should update secret name and description', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Original Name',
        description: 'Original description',
        provider: 'bitwarden',
        providerSecretId: 'test-update-123',
        type: 'password',
        tags: ['old'],
      });

      const res = await request(app)
        .patch(`/api/secrets/${secret._id}`)
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
      const secret = await Secret.create({
        userId,
        name: 'Tag Test',
        provider: 'bitwarden',
        providerSecretId: 'test-tags-123',
        type: 'api_key',
        tags: ['old', 'deprecated'],
      });

      const res = await request(app)
        .patch(`/api/secrets/${secret._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tags: ['new', 'active', 'production'],
        })
        .expect(200);

      expect(res.body.tags).toEqual(['new', 'active', 'production']);
    });

    it('should update providerSecretId (for secret rotation)', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Rotatable Secret',
        provider: 'bitwarden',
        providerSecretId: 'old-secret-id',
        type: 'api_key',
        tags: [],
      });

      const res = await request(app)
        .patch(`/api/secrets/${secret._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          providerSecretId: 'new-rotated-secret-id',
          lastRotatedAt: new Date().toISOString(),
        })
        .expect(200);

      expect(res.body.providerSecretId).toBe('new-rotated-secret-id');
      expect(res.body.lastRotatedAt).toBeDefined();
    });

    it('should not allow updating immutable userId field', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Immutable Test',
        provider: 'bitwarden',
        providerSecretId: 'test-immutable-123',
        type: 'password',
        tags: [],
      });

      await request(app)
        .patch(`/api/secrets/${secret._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: '507f1f77bcf86cd799439011', // Try to change userId
          name: 'Updated Name',
        })
        .expect(200);

      const updated = await Secret.findById(secret._id);
      expect(updated!.userId.toString()).toBe(userId); // Still original userId
      expect(updated!.name).toBe('Updated Name'); // Other fields updated
    });
  });

  describe('DELETE /api/secrets/:id', () => {
    it('should delete a secret with no usage', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Unused Secret',
        provider: 'bitwarden',
        providerSecretId: 'test-delete-123',
        type: 'password',
        tags: [],
        usedBy: [],
      });

      await request(app)
        .delete(`/api/secrets/${secret._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const deleted = await Secret.findById(secret._id);
      expect(deleted).toBeNull();
    });

    it('should prevent deleting a secret in use by one resource', async () => {
      const secret = await Secret.create({
        userId,
        name: 'In Use Secret',
        provider: 'bitwarden',
        providerSecretId: 'test-in-use-123',
        type: 'connection_string',
        tags: [],
        usedBy: [
          {
            collection: 'databases',
            itemId: '507f1f77bcf86cd799439011',
            itemName: 'Production DB',
          },
        ],
      });

      const res = await request(app)
        .delete(`/api/secrets/${secret._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.error).toBe('Secret is in use');
      expect(res.body.usedBy).toHaveLength(1);

      const stillExists = await Secret.findById(secret._id);
      expect(stillExists).not.toBeNull();
    });

    it('should prevent deleting a secret in use by multiple resources', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Widely Used Secret',
        provider: 'bitwarden',
        providerSecretId: 'test-widely-used-123',
        type: 'api_key',
        tags: [],
        usedBy: [
          {
            collection: 'databases',
            itemId: '507f1f77bcf86cd799439011',
            itemName: 'Production DB',
          },
          {
            collection: 'accounts',
            itemId: '507f1f77bcf86cd799439012',
            itemName: 'AWS Account',
          },
          {
            collection: 'tasks',
            itemId: '507f1f77bcf86cd799439013',
            itemName: 'Deploy Task',
          },
        ],
      });

      const res = await request(app)
        .delete(`/api/secrets/${secret._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.usedBy).toHaveLength(3);
    });
  });

  describe('POST /api/secrets/:id/add-usage', () => {
    it('should add usage tracking for a database', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Database Secret',
        provider: 'bitwarden',
        providerSecretId: 'test-usage-123',
        type: 'connection_string',
        tags: [],
        usedBy: [],
      });

      const res = await request(app)
        .post(`/api/secrets/${secret._id}/add-usage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          collection: 'databases',
          itemId: '507f1f77bcf86cd799439011',
          itemName: 'MyTick Production MongoDB',
        })
        .expect(200);

      expect(res.body.usedBy).toHaveLength(1);
      expect(res.body.usedBy[0].collection).toBe('databases');
      expect(res.body.usedBy[0].itemName).toBe('MyTick Production MongoDB');
    });

    it('should add multiple different usages', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Shared Secret',
        provider: 'bitwarden',
        providerSecretId: 'test-multi-usage-123',
        type: 'password',
        tags: [],
        usedBy: [],
      });

      // Add first usage
      await request(app)
        .post(`/api/secrets/${secret._id}/add-usage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          collection: 'databases',
          itemId: '507f1f77bcf86cd799439011',
          itemName: 'DB1',
        })
        .expect(200);

      // Add second usage
      const res = await request(app)
        .post(`/api/secrets/${secret._id}/add-usage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          collection: 'accounts',
          itemId: '507f1f77bcf86cd799439012',
          itemName: 'Account1',
        })
        .expect(200);

      expect(res.body.usedBy).toHaveLength(2);
    });

    it('should not add duplicate usage', async () => {
      const itemId = '507f1f77bcf86cd799439011';
      const secret = await Secret.create({
        userId,
        name: 'No Duplicate Test',
        provider: 'bitwarden',
        providerSecretId: 'test-no-dup-123',
        type: 'api_key',
        tags: [],
        usedBy: [
          {
            collection: 'databases',
            itemId,
            itemName: 'Existing DB',
          },
        ],
      });

      const res = await request(app)
        .post(`/api/secrets/${secret._id}/add-usage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          collection: 'databases',
          itemId,
          itemName: 'Existing DB',
        })
        .expect(200);

      expect(res.body.usedBy).toHaveLength(1); // Still only 1
    });

    it('should require all fields', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Test',
        provider: 'bitwarden',
        providerSecretId: 'test-123',
        type: 'password',
        tags: [],
        usedBy: [],
      });

      await request(app)
        .post(`/api/secrets/${secret._id}/add-usage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          collection: 'databases',
          // Missing itemId and itemName
        })
        .expect(400);
    });
  });

  describe('POST /api/secrets/:id/remove-usage', () => {
    it('should remove usage tracking', async () => {
      const itemId = '507f1f77bcf86cd799439011';
      const secret = await Secret.create({
        userId,
        name: 'Remove Usage Test',
        provider: 'bitwarden',
        providerSecretId: 'test-remove-123',
        type: 'connection_string',
        tags: [],
        usedBy: [
          {
            collection: 'databases',
            itemId,
            itemName: 'To Be Removed',
          },
        ],
      });

      const res = await request(app)
        .post(`/api/secrets/${secret._id}/remove-usage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          collection: 'databases',
          itemId,
        })
        .expect(200);

      expect(res.body.usedBy).toHaveLength(0);
    });

    it('should only remove specific usage', async () => {
      const itemId1 = '507f1f77bcf86cd799439011';
      const itemId2 = '507f1f77bcf86cd799439012';
      const secret = await Secret.create({
        userId,
        name: 'Selective Remove Test',
        provider: 'bitwarden',
        providerSecretId: 'test-selective-123',
        type: 'api_key',
        tags: [],
        usedBy: [
          {
            collection: 'databases',
            itemId: itemId1,
            itemName: 'DB1',
          },
          {
            collection: 'accounts',
            itemId: itemId2,
            itemName: 'Account1',
          },
        ],
      });

      const res = await request(app)
        .post(`/api/secrets/${secret._id}/remove-usage`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          collection: 'databases',
          itemId: itemId1,
        })
        .expect(200);

      expect(res.body.usedBy).toHaveLength(1);
      expect(res.body.usedBy[0].collection).toBe('accounts');
    });
  });

  describe('POST /api/secrets/:id/touch', () => {
    it('should update lastAccessedAt timestamp', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Touch Test',
        provider: 'bitwarden',
        providerSecretId: 'test-touch-123',
        type: 'password',
        tags: [],
        lastAccessedAt: undefined,
      });

      const before = Date.now();
      
      const res = await request(app)
        .post(`/api/secrets/${secret._id}/touch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const after = Date.now();
      const lastAccessed = new Date(res.body.lastAccessedAt).getTime();

      expect(lastAccessed).toBeGreaterThanOrEqual(before - 1000); // 1s tolerance
      expect(lastAccessed).toBeLessThanOrEqual(after + 1000);
    });

    it('should update timestamp on subsequent touches', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Multi Touch Test',
        provider: 'bitwarden',
        providerSecretId: 'test-multi-touch-123',
        type: 'token',
        tags: [],
        lastAccessedAt: new Date('2020-01-01'),
      });

      const firstTouch = await request(app)
        .post(`/api/secrets/${secret._id}/touch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms

      const secondTouch = await request(app)
        .post(`/api/secrets/${secret._id}/touch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const first = new Date(firstTouch.body.lastAccessedAt).getTime();
      const second = new Date(secondTouch.body.lastAccessedAt).getTime();

      expect(second).toBeGreaterThan(first);
    });
  });

  describe('Integration: Secret with Database', () => {
    it('should create database with secretId reference', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Integration Test Secret',
        provider: 'bitwarden',
        providerSecretId: 'bw-integration-123',
        type: 'connection_string',
        tags: [],
        usedBy: [],
      });

      const dbRes = await request(app)
        .post('/api/databases')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Integration Test DB',
          type: 'mongodb',
          secretId: secret._id.toString(),
          backupEnabled: true,
        })
        .expect(201);

      expect(dbRes.body.secretId).toBe(secret._id.toString());
    });

    it('should populate secret in backupable endpoint', async () => {
      const secret = await Secret.create({
        userId,
        name: 'Backupable Test Secret',
        provider: 'bitwarden',
        providerSecretId: 'bw-backupable-123',
        type: 'connection_string',
        tags: [],
        usedBy: [],
      });

      const db = await Database.create({
        userId,
        name: 'Backupable Test DB',
        type: 'mongodb',
        secretId: secret._id,
        backupEnabled: true,
        backupRetentionDays: 30,
        backupFrequency: 'daily',
      });

      const res = await request(app)
        .get('/api/databases/backupable')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].secret).toBeDefined();
      expect(res.body[0].secret.provider).toBe('bitwarden');
      expect(res.body[0].secret.providerSecretId).toBe('bw-backupable-123');
    });
  });
});
