import { describe, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';
import { secretRepo, envFileRepo, envVarRepo } from '../../src/repositories';

let token: string;
let userId: string;
let repoId: string;
let secretId: string;
let directSecretId: string;

beforeAll(async () => {
  await setupTestDB();
  ({ token, userId } = await createTestUser());

  // Create a repo via API (needed as parent for env files)
  const repoRes = await request(app)
    .post('/api/repos')
    .set('Authorization', `Bearer ${token}`)
    .send({ url: 'https://github.com/test/env-test-repo' });
  repoId = repoRes.body.id;

  // Create a vault-referenced secret
  const sec = await secretRepo.create({
    userId,
    name: 'BW DB Password',
    provider: 'bitwarden',
    secretValue: 'bw-item-id-abc',
    type: 'password',
    tags: ['db'],
  });
  secretId = sec.id;

  // Create a direct secret — server encrypts it automatically when provider=direct
  process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const directSec = await request(app)
    .post('/api/secrets')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Direct API Key',
      provider: 'direct',
      secretValue: 'my-super-secret-db-password',
      type: 'api_key',
      tags: ['direct'],
    });
  directSecretId = directSec.body.id;
}, 120000);

afterAll(async () => {
  await teardownTestDB();
});

// ── EnvFile CRUD ────────────────────────────────────────────────────────────

describe('EnvFile CRUD', () => {
  let envFileId: string;

  describe('POST /api/env-files', () => {
    it('should create an env file', async () => {
      const res = await request(app)
        .post('/api/env-files')
        .set('Authorization', `Bearer ${token}`)
        .send({ repoId, path: '.env' });

      expect(res.status).toBe(201);
      expect(res.body.path).toBe('.env');
      expect(res.body.repoId).toBe(repoId);
      expect(res.body.id).toBeDefined();
      envFileId = res.body.id;
    });

    it('should create a nested env file', async () => {
      const res = await request(app)
        .post('/api/env-files')
        .set('Authorization', `Bearer ${token}`)
        .send({ repoId, path: 'backend/.env.local' });

      expect(res.status).toBe(201);
      expect(res.body.path).toBe('backend/.env.local');
    });

    it('should reject without repoId', async () => {
      const res = await request(app)
        .post('/api/env-files')
        .set('Authorization', `Bearer ${token}`)
        .send({ path: '.env' });

      expect(res.status).toBe(400);
    });

    it('should reject without path', async () => {
      const res = await request(app)
        .post('/api/env-files')
        .set('Authorization', `Bearer ${token}`)
        .send({ repoId });

      expect(res.status).toBe(400);
    });

    it('should reject unauthenticated', async () => {
      const res = await request(app)
        .post('/api/env-files')
        .send({ repoId, path: '.env' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/env-files', () => {
    it('should list all env files for user', async () => {
      const res = await request(app)
        .get('/api/env-files')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/env-files/:id', () => {
    it('should get env file by id', async () => {
      const res = await request(app)
        .get(`/api/env-files/${envFileId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(envFileId);
      expect(res.body.path).toBe('.env');
    });

    it('should return 404 for non-existent id', async () => {
      const res = await request(app)
        .get('/api/env-files/nonexistent_123')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/env-files/:id', () => {
    it('should update path', async () => {
      const res = await request(app)
        .patch(`/api/env-files/${envFileId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ path: '.env.production' });

      expect(res.status).toBe(200);
      expect(res.body.path).toBe('.env.production');
    });

    it('should return 404 for non-existent id', async () => {
      const res = await request(app)
        .patch('/api/env-files/nonexistent_123')
        .set('Authorization', `Bearer ${token}`)
        .send({ path: '.env' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/env-files/:id', () => {
    it('should delete an env file', async () => {
      const res = await request(app)
        .delete(`/api/env-files/${envFileId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('should return 404 after deletion', async () => {
      const res = await request(app)
        .get(`/api/env-files/${envFileId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});

// ── EnvVar CRUD ─────────────────────────────────────────────────────────────

describe('EnvVar CRUD via /api/env-files/:id/vars', () => {
  let envFileId: string;
  let envVarId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/env-files')
      .set('Authorization', `Bearer ${token}`)
      .send({ repoId, path: 'vars-test/.env' });
    envFileId = res.body.id;
  });

  describe('POST /api/env-files/:id/vars', () => {
    it('should create a plain env var', async () => {
      const res = await request(app)
        .post(`/api/env-files/${envFileId}/vars`)
        .set('Authorization', `Bearer ${token}`)
        .send({ envFileId, key: 'PORT', value: '3000', order: 0 });

      expect(res.status).toBe(201);
      expect(res.body.key).toBe('PORT');
      expect(res.body.value).toBe('3000');
      expect(res.body.isSecret).toBe(false);
      envVarId = res.body.id;
    });

    it('should create a secret-linked env var', async () => {
      const res = await request(app)
        .post(`/api/env-files/${envFileId}/vars`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          envFileId,
          key: 'DB_PASSWORD',
          isSecret: true,
          secretId,
          comment: 'Database password from Bitwarden',
          order: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.key).toBe('DB_PASSWORD');
      expect(res.body.isSecret).toBe(true);
      expect(res.body.secretId).toBe(secretId);
      expect(res.body.comment).toBe('Database password from Bitwarden');
    });

    it('should create a commented env var', async () => {
      const res = await request(app)
        .post(`/api/env-files/${envFileId}/vars`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          envFileId,
          key: 'LOG_LEVEL',
          value: 'debug',
          comment: 'Set to info in production',
          order: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.comment).toBe('Set to info in production');
    });

    it('should reject without key', async () => {
      const res = await request(app)
        .post(`/api/env-files/${envFileId}/vars`)
        .set('Authorization', `Bearer ${token}`)
        .send({ envFileId, value: 'x' });

      expect(res.status).toBe(400);
    });

    it('should reject with invalid envFileId in URL', async () => {
      const res = await request(app)
        .post('/api/env-files/nonexistent/vars')
        .set('Authorization', `Bearer ${token}`)
        .send({ envFileId, key: 'X' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/env-files/:id/vars', () => {
    it('should list all env vars for file', async () => {
      const res = await request(app)
        .get(`/api/env-files/${envFileId}/vars`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(3);
    });
  });

  describe('PATCH /api/env-files/:envFileId/vars/:varId', () => {
    it('should update env var value', async () => {
      const res = await request(app)
        .patch(`/api/env-files/${envFileId}/vars/${envVarId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '4000' });

      expect(res.status).toBe(200);
      expect(res.body.value).toBe('4000');
    });

    it('should update env var key', async () => {
      const res = await request(app)
        .patch(`/api/env-files/${envFileId}/vars/${envVarId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ key: 'SERVER_PORT' });

      expect(res.status).toBe(200);
      expect(res.body.key).toBe('SERVER_PORT');
    });
  });

  describe('DELETE /api/env-files/:envFileId/vars/:varId', () => {
    it('should delete an env var', async () => {
      const res = await request(app)
        .delete(`/api/env-files/${envFileId}/vars/${envVarId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('should have one fewer var after deletion', async () => {
      const res = await request(app)
        .get(`/api/env-files/${envFileId}/vars`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.length).toBe(2);
    });
  });
});

// ── Env Reconstruction ──────────────────────────────────────────────────────

describe('Env Reconstruction', () => {
  let envFileId: string;

  beforeAll(async () => {
    const fileRes = await request(app)
      .post('/api/env-files')
      .set('Authorization', `Bearer ${token}`)
      .send({ repoId, path: '.env.reconstruct' });
    envFileId = fileRes.body.id;

    // Create env vars in order
    await request(app)
      .post(`/api/env-files/${envFileId}/vars`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envFileId, key: 'APP_NAME', value: 'my-app', order: 0 });

    await request(app)
      .post(`/api/env-files/${envFileId}/vars`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envFileId, key: 'APP_VERSION', value: '1.0.0', comment: 'Current version', order: 1 });

    await request(app)
      .post(`/api/env-files/${envFileId}/vars`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envFileId, key: 'DB_PASS', isSecret: true, secretId, order: 2 });

    await request(app)
      .post(`/api/env-files/${envFileId}/vars`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envFileId, key: 'API_KEY', isSecret: true, secretId: directSecretId, order: 3 });
  });

  describe('GET /api/env-reconstruct/:id', () => {
    it('should reconstruct a single env file', async () => {
      const res = await request(app)
        .get(`/api/env-reconstruct/${envFileId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.path).toBe('.env.reconstruct');
      expect(res.body.envFileId).toBe(envFileId);
      expect(res.body.repoId).toBe(repoId);
      expect(res.body.content).toContain('APP_NAME=my-app');
      expect(res.body.content).toContain('# Current version');
      expect(res.body.content).toContain('APP_VERSION=1.0.0');
    });

    it('should resolve direct secrets via decryption', async () => {
      const res = await request(app)
        .get(`/api/env-reconstruct/${envFileId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.content).toContain('API_KEY=my-super-secret-db-password');
    });

    it('should use placeholder for vault secrets', async () => {
      const res = await request(app)
        .get(`/api/env-reconstruct/${envFileId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.content).toContain('DB_PASS=[bitwarden:BW DB Password]');
    });

    it('should respect env var ordering', async () => {
      const res = await request(app)
        .get(`/api/env-reconstruct/${envFileId}`)
        .set('Authorization', `Bearer ${token}`);

      const lines = res.body.content.split('\n');
      const appNameIdx = lines.findIndex((l: string) => l.startsWith('APP_NAME='));
      const appVersionIdx = lines.findIndex((l: string) => l.startsWith('APP_VERSION='));
      const dbPassIdx = lines.findIndex((l: string) => l.startsWith('DB_PASS='));
      const apiKeyIdx = lines.findIndex((l: string) => l.startsWith('API_KEY='));

      expect(appNameIdx).toBeLessThan(appVersionIdx);
      expect(appVersionIdx).toBeLessThan(dbPassIdx);
      expect(dbPassIdx).toBeLessThan(apiKeyIdx);
    });

    it('should include comments above their vars', async () => {
      const res = await request(app)
        .get(`/api/env-reconstruct/${envFileId}`)
        .set('Authorization', `Bearer ${token}`);

      const lines = res.body.content.split('\n');
      const commentIdx = lines.findIndex((l: string) => l === '# Current version');
      const versionIdx = lines.findIndex((l: string) => l.startsWith('APP_VERSION='));
      expect(commentIdx).toBe(versionIdx - 1);
    });

    it('should return 404 for non-existent env file', async () => {
      const res = await request(app)
        .get('/api/env-reconstruct/nonexistent_123')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/env-reconstruct (all files)', () => {
    it('should reconstruct all env files for user', async () => {
      const res = await request(app)
        .get('/api/env-reconstruct')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const ours = res.body.find((f: any) => f.envFileId === envFileId);
      expect(ours).toBeDefined();
      expect(ours.path).toBe('.env.reconstruct');
      expect(ours.content).toContain('APP_NAME=my-app');
    });
  });
});

// ── Cascade Delete ──────────────────────────────────────────────────────────

describe('Cascade delete', () => {
  it('should delete env file and its env vars', async () => {
    // Create a file with vars
    const fileRes = await request(app)
      .post('/api/env-files')
      .set('Authorization', `Bearer ${token}`)
      .send({ repoId, path: '.env.cascade-test' });
    const fid = fileRes.body.id;

    await request(app)
      .post(`/api/env-files/${fid}/vars`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envFileId: fid, key: 'X', value: '1', order: 0 });

    await request(app)
      .post(`/api/env-files/${fid}/vars`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envFileId: fid, key: 'Y', value: '2', order: 1 });

    // Verify vars exist
    const varsRes = await request(app)
      .get(`/api/env-files/${fid}/vars`)
      .set('Authorization', `Bearer ${token}`);
    expect(varsRes.body.length).toBe(2);

    // Delete the env file
    const delRes = await request(app)
      .delete(`/api/env-files/${fid}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);

    // Verify vars are gone
    const varsAfter = await request(app)
      .get(`/api/env-files/${fid}/vars`)
      .set('Authorization', `Bearer ${token}`);
    expect(varsAfter.status).toBe(404);
  });
});

// ── Repo Env Files Raw ─────────────────────────────────────────────────────

describe('GET /api/repos/:repoId/env-files/raw', () => {
  let rawRepoId: string;
  let rawEnvFileId: string;

  beforeAll(async () => {
    const repoRes = await request(app)
      .post('/api/repos')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://github.com/test/raw-test-repo' });
    rawRepoId = repoRes.body.id;

    const fileRes = await request(app)
      .post('/api/env-files')
      .set('Authorization', `Bearer ${token}`)
      .send({ repoId: rawRepoId, path: '.env' });
    rawEnvFileId = fileRes.body.id;

    await request(app)
      .post(`/api/env-files/${rawEnvFileId}/vars`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envFileId: rawEnvFileId, key: 'HOST', value: 'localhost', order: 0 });

    await request(app)
      .post(`/api/env-files/${rawEnvFileId}/vars`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envFileId: rawEnvFileId, key: 'SECRET_KEY', isSecret: true, secretId: directSecretId, order: 1 });

    await request(app)
      .post(`/api/env-files/${rawEnvFileId}/vars`)
      .set('Authorization', `Bearer ${token}`)
      .send({ envFileId: rawEnvFileId, key: 'BW_SECRET', isSecret: true, secretId, order: 2 });
  });

  it('should return assembled env files for a repo', async () => {
    const res = await request(app)
      .get(`/api/repos/${rawRepoId}/env-files/raw`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.files).toBeDefined();
    expect(res.body.files.length).toBeGreaterThanOrEqual(1);

    const envFile = res.body.files.find((f: any) => f.envFileId === rawEnvFileId);
    expect(envFile).toBeDefined();
    expect(envFile.path).toBe('.env');
    expect(envFile.content).toContain('HOST=localhost');
    expect(envFile.content).toContain('my-super-secret-db-password');
    expect(envFile.content).toContain('[bitwarden:BW DB Password]');
  });

  it('should return 404 for non-existent repo', async () => {
    const res = await request(app)
      .get('/api/repos/nonexistent_123/env-files/raw')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return empty files array for repo with no env files', async () => {
    const repoRes = await request(app)
      .post('/api/repos')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://github.com/test/empty-repo' });

    const res = await request(app)
      .get(`/api/repos/${repoRes.body.id}/env-files/raw`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.files).toEqual([]);
  });

  it('should reject unauthenticated request', async () => {
    const res = await request(app)
      .get(`/api/repos/${rawRepoId}/env-files/raw`);

    expect(res.status).toBe(401);
  });
});
