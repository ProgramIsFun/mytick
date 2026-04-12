import request from 'supertest';
import { setupTestDB, teardownTestDB, createTestUser, app } from '../helpers';

let token: string;
let userId: string;

beforeAll(async () => {
  await setupTestDB();
  const { token: t, user } = await createTestUser();
  token = t;
  userId = user.id;
}, 30000);

afterAll(async () => {
  await teardownTestDB();
});

describe('group CRUD', () => {
  let groupId: string;

  it('should create a group', async () => {
    const res = await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Group' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Group');
    expect(res.body.members).toHaveLength(1);
    expect(res.body.members[0].role).toBe('editor');
    groupId = res.body._id;
  });

  it('should list groups', async () => {
    const res = await request(app).get('/api/groups').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject empty group name', async () => {
    const res = await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('should delete a group', async () => {
    const res = await request(app).delete(`/api/groups/${groupId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('group members', () => {
  let groupId: string;
  let otherToken: string;
  let otherUserId: string;

  beforeAll(async () => {
    const group = await request(app).post('/api/groups').set('Authorization', `Bearer ${token}`)
      .send({ name: 'Member Test' });
    groupId = group.body._id;

    const { token: t, user } = await createTestUser('other@test.com', 'otheruser');
    otherToken = t;
    otherUserId = user.id;
  });

  it('should add member by email', async () => {
    const res = await request(app).post(`/api/groups/${groupId}/members`).set('Authorization', `Bearer ${token}`)
      .send({ email: 'other@test.com', role: 'viewer' });
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);
  });

  it('should reject duplicate member', async () => {
    const res = await request(app).post(`/api/groups/${groupId}/members`).set('Authorization', `Bearer ${token}`)
      .send({ email: 'other@test.com' });
    expect(res.status).toBe(409);
  });

  it('should not allow non-owner to add members', async () => {
    const res = await request(app).post(`/api/groups/${groupId}/members`).set('Authorization', `Bearer ${otherToken}`)
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(404);
  });

  it('should remove member', async () => {
    const res = await request(app).delete(`/api/groups/${groupId}/members/${otherUserId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(1);
  });

  it('should not allow non-owner to delete group', async () => {
    const res = await request(app).delete(`/api/groups/${groupId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });
});
