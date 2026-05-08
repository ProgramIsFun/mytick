import { describe, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoNotificationQueue } from '../../src/queues/MongoNotificationQueue';
import ScheduledNotification from '../../src/models/ScheduledNotification';

let mongo: MongoMemoryServer;
let queue: MongoNotificationQueue;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  queue = new MongoNotificationQueue();
}, 30000);

afterEach(async () => {
  await ScheduledNotification.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const makeJob = (overrides = {}) => ({
  jobId: 'task1-1day',
  userId: new mongoose.Types.ObjectId().toString(),
  taskId: new mongoose.Types.ObjectId().toString(),
  alertType: '1day',
  fireAt: new Date(Date.now() + 60000),
  ...overrides,
});

describe('MongoNotificationQueue', () => {
  it('schedule creates a document', async () => {
    await queue.schedule(makeJob());
    expect(await ScheduledNotification.countDocuments()).toBe(1);
  });

  it('schedule upserts on same jobId', async () => {
    const job = makeJob();
    await queue.schedule(job);
    await queue.schedule({ ...job, alertType: 'updated' });
    const docs = await ScheduledNotification.find();
    expect(docs).toHaveLength(1);
    expect(docs[0].alertType).toBe('updated');
  });

  it('cancel removes by jobId', async () => {
    await queue.schedule(makeJob({ jobId: 'a' }));
    await queue.schedule(makeJob({ jobId: 'b' }));
    await queue.cancel('a');
    const docs = await ScheduledNotification.find();
    expect(docs).toHaveLength(1);
    expect(docs[0].jobId).toBe('b');
  });

  it('cancelByTask removes all for a task', async () => {
    const taskId = new mongoose.Types.ObjectId().toString();
    await queue.schedule(makeJob({ jobId: 'x-1day', taskId }));
    await queue.schedule(makeJob({ jobId: 'x-1hour', taskId }));
    await queue.schedule(makeJob({ jobId: 'other', taskId: new mongoose.Types.ObjectId().toString() }));
    await queue.cancelByTask(taskId);
    const docs = await ScheduledNotification.find();
    expect(docs).toHaveLength(1);
    expect(docs[0].jobId).toBe('other');
  });

  it('processDue picks up due notifications', async () => {
    await queue.schedule(makeJob({ jobId: 'due', fireAt: new Date(Date.now() - 1000) }));
    await queue.schedule(makeJob({ jobId: 'future', fireAt: new Date(Date.now() + 60000) }));

    const processed: string[] = [];
    await queue.processDue(async (job) => { processed.push(job.jobId); });

    expect(processed).toEqual(['due']);
    const doc = await ScheduledNotification.findOne({ jobId: 'due' });
    expect(doc!.sent).toBe(true);
  });

  it('processDue skips already-sent notifications', async () => {
    await queue.schedule(makeJob({ jobId: 'sent', fireAt: new Date(Date.now() - 1000) }));
    await ScheduledNotification.updateOne({ jobId: 'sent' }, { sent: true });

    const processed: string[] = [];
    await queue.processDue(async (job) => { processed.push(job.jobId); });
    expect(processed).toHaveLength(0);
  });

  it('processDue continues on handler error', async () => {
    await queue.schedule(makeJob({ jobId: 'fail', fireAt: new Date(Date.now() - 1000) }));
    await queue.schedule(makeJob({ jobId: 'ok', fireAt: new Date(Date.now() - 1000) }));

    const processed: string[] = [];
    await queue.processDue(async (job) => {
      if (job.jobId === 'fail') throw new Error('boom');
      processed.push(job.jobId);
    });

    expect(processed).toEqual(['ok']);
    const failDoc = await ScheduledNotification.findOne({ jobId: 'fail' });
    expect(failDoc!.sent).toBe(false);
  });
});
