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

describe('database CRUD', () => {
  let databaseId: string;
  let accountId: string;

  it('should create a database with secretRefs', async () => {
    const res = await request(app).post('/api/databases').set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test MongoDB',
        type: 'mongodb',
        host: 'cluster.example.net',
        port: 27017,
        database: 'testdb',
        secretRefs: [{
          provider: 'bitwarden',
          itemId: 'test-vault-id-123',
          field: 'connectionUri'
        }],
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
    expect(res.body.secretRefs).toHaveLength(1);
    expect(res.body.secretRefs[0]).toMatchObject({
      provider: 'bitwarden',
      itemId: 'test-vault-id-123',
      field: 'connectionUri'
    });
    expect(res.body.backupEnabled).toBe(true);
    databaseId = res.body._id;
  });

  it('should create a database without secretRefs', async () => {
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
    expect(res.body.secretRefs).toEqual([]);
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
        backupEnabled: false,
        secretRefs: [{
          provider: '1password',
          itemId: 'new-item-id'
        }]
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated MongoDB');
    expect(res.body.backupEnabled).toBe(false);
    expect(res.body.secretRefs[0].provider).toBe('1password');
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

describe('database secretRef validation', () => {
  it('should accept all supported secret providers', async () => {
    const providers: Array<'bitwarden' | '1password' | 'lastpass' | 'vault' | 'custom'> = 
      ['bitwarden', '1password', 'lastpass', 'vault', 'custom'];

    for (const provider of providers) {
      const res = await request(app).post('/api/databases').set('Authorization', `Bearer ${token}`)
        .send({
          name: `Test ${provider}`,
          type: 'mongodb',
          secretRefs: [{ provider, itemId: `test-id-${provider}` }]
        });
      expect(res.status).toBe(201);
      expect(res.body.secretRefs[0].provider).toBe(provider);
    }
  });

  it('should accept secretRefs with optional field', async () => {
    const res = await request(app).post('/api/databases').set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test with Field',
        type: 'postgres',
        secretRefs: [{
          provider: 'bitwarden',
          itemId: 'vault-123',
          field: 'password'
        }]
      });
    expect(res.status).toBe(201);
    expect(res.body.secretRefs[0].field).toBe('password');
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
    
    const res = await request(app)
      .post(`/api/databases/${databaseId}/backup-completed`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        backupSize: '245MB',
        s3Key: 'mytick/mongodb/backup-20260506.gz'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Backup timestamp updated');
    expect(res.body.lastBackupAt).toBeTruthy();
    
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
