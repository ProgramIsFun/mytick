import { NotificationQueue } from './NotificationQueue';

// TODO: Implement Neo4j or Redis notification queue
// For now, export a stub
export const notificationQueue: NotificationQueue = {
  schedule: async () => {},
  cancelByTask: async () => {},
  startProcessing: () => {},
  processDue: async () => {},
} as any;
