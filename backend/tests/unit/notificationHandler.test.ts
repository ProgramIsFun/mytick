import { describe, it, beforeAll, afterEach, expect } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../src/models/User';
import Task from '../../src/models/Task';
import ScheduledNotification from '../../src/models/ScheduledNotification';
import { MongoNotificationQueue } from '../../src/queues/MongoNotificationQueue';
import { processNotificationJob } from '../../src/services/notificationHandler';
import { nanoid } from 'nanoid';

// Mock sendPush
const mockSendPush = jest.fn();
jest.mock('../../src/services/fcm', () => ({
  sendPush: (...args: any[]) => mockSendPush(...args),
}));

let mongo: MongoMemoryServer;
let queue: MongoNotificationQueue;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  process.env.JWT_SECRET = 'test-secret';
  queue = new MongoNotificationQueue();
}, 30000);

afterEach(async () => {
  mockSendPush.mockClear();
  await ScheduledNotification.deleteMany({});
  await Task.deleteMany({});
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe('processNotificationJob', () => {
  it('calls sendPush with correct tokens, title, and body', async () => {
    const user = await User.create({
      username: 'pushuser', name: 'Push User',
      providers: [], fcmTokens: ['token-aaa', 'token-bbb'],
    });
    const task = await Task.create({
      userId: user._id, title: 'Submit report',
      deadline: new Date(Date.now() + 60000), shareToken: nanoid(12),
    });

    await processNotificationJob({
      jobId: `${task._id}-1day`,
      userId: user._id.toString(),
      taskId: task._id.toString(),
      alertType: '1day',
      fireAt: new Date(),
    }, queue);

    expect(mockSendPush).toHaveBeenCalledTimes(1);
    expect(mockSendPush).toHaveBeenCalledWith(
      ['token-aaa', 'token-bbb'],
      'Deadline approaching',
      '"Submit report" is due in 1 day',
      { taskId: task._id.toString() },
    );
  });

  it('uses correct label for 1hour alert', async () => {
    const user = await User.create({
      username: 'houruser', name: 'Hour User',
      providers: [], fcmTokens: ['tok'],
    });
    const task = await Task.create({
      userId: user._id, title: 'Call dentist',
      deadline: new Date(Date.now() + 60000), shareToken: nanoid(12),
    });

    await processNotificationJob({
      jobId: `${task._id}-1hour`,
      userId: user._id.toString(),
      taskId: task._id.toString(),
      alertType: '1hour',
      fireAt: new Date(),
    }, queue);

    expect(mockSendPush).toHaveBeenCalledWith(
      ['tok'],
      'Deadline approaching',
      '"Call dentist" is due in 1 hour',
      { taskId: task._id.toString() },
    );
  });

  it('skips if task is done', async () => {
    const user = await User.create({
      username: 'doneuser', name: 'Done User',
      providers: [], fcmTokens: ['tok'],
    });
    const task = await Task.create({
      userId: user._id, title: 'Done task', status: 'done',
      deadline: new Date(), shareToken: nanoid(12),
    });

    await processNotificationJob({
      jobId: `${task._id}-1day`,
      userId: user._id.toString(),
      taskId: task._id.toString(),
      alertType: '1day',
      fireAt: new Date(),
    }, queue);

    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('skips if user not found', async () => {
    const task = await Task.create({
      userId: new mongoose.Types.ObjectId(), title: 'Orphan task',
      deadline: new Date(), shareToken: nanoid(12),
    });

    await processNotificationJob({
      jobId: `${task._id}-1day`,
      userId: new mongoose.Types.ObjectId().toString(),
      taskId: task._id.toString(),
      alertType: '1day',
      fireAt: new Date(),
    }, queue);

    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('sends with empty tokens if user has none', async () => {
    const user = await User.create({
      username: 'notokens', name: 'No Tokens',
      providers: [], fcmTokens: [],
    });
    const task = await Task.create({
      userId: user._id, title: 'No token task',
      deadline: new Date(Date.now() + 60000), shareToken: nanoid(12),
    });

    await processNotificationJob({
      jobId: `${task._id}-1day`,
      userId: user._id.toString(),
      taskId: task._id.toString(),
      alertType: '1day',
      fireAt: new Date(),
    }, queue);

    expect(mockSendPush).toHaveBeenCalledWith(
      [],
      'Deadline approaching',
      '"No token task" is due in 1 day',
      { taskId: task._id.toString() },
    );
  });

  it('reschedules next occurrence for recurring tasks', async () => {
    const user = await User.create({
      username: 'recurnotify', name: 'Recur User',
      providers: [], fcmTokens: ['tok'],
    });
    const task = await Task.create({
      userId: user._id, title: 'Weekly sync',
      deadline: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      recurrence: { freq: 'weekly', interval: 1 },
      shareToken: nanoid(12),
    });

    // No pending notifications for this task
    await processNotificationJob({
      jobId: `${task._id}-1hour`,
      userId: user._id.toString(),
      taskId: task._id.toString(),
      alertType: '1hour',
      fireAt: new Date(),
    }, queue);

    expect(mockSendPush).toHaveBeenCalledTimes(1);

    // Should have rescheduled for next occurrence
    const scheduled = await ScheduledNotification.find({ taskId: task._id });
    expect(scheduled.length).toBeGreaterThan(0);
  });
});
