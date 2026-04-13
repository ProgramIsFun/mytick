import { MongoNotificationQueue } from './MongoNotificationQueue';
import { NotificationQueue } from './NotificationQueue';

// Swap this to RedisNotificationQueue later
export const notificationQueue: NotificationQueue = new MongoNotificationQueue();
