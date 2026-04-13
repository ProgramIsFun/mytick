import User from '../models/User';
import Task from '../models/Task';
import ScheduledNotification from '../models/ScheduledNotification';
import { NotificationQueue } from '../queues/NotificationQueue';
import { NotificationJob } from '../queues/NotificationQueue';
import { scheduleDeadlineAlerts } from '../queues/scheduleAlerts';
import { DEADLINE_ALERTS } from '../config/alerts';
import { sendPush } from './fcm';
import { logger } from '../utils/logger';

export async function processNotificationJob(job: NotificationJob, queue: NotificationQueue) {
  const [user, task] = await Promise.all([
    User.findById(job.userId),
    Task.findById(job.taskId),
  ]);
  if (!user || !task || task.status === 'done') return;

  const label = DEADLINE_ALERTS.find(a => a.type === job.alertType)?.label || job.alertType;
  const title = 'Deadline approaching';
  const body = `"${task.title}" is due ${label}`;

  await sendPush(user.fcmTokens || [], title, body, { taskId: job.taskId });
  logger.info({ userId: job.userId, taskTitle: task.title, alertType: job.alertType }, 'deadline alert sent');

  if (task.recurrence) {
    const pending = await ScheduledNotification.countDocuments({ taskId: job.taskId, sent: false });
    if (pending === 0) {
      await scheduleDeadlineAlerts(queue, task._id.toString(), task.userId.toString(), task.deadline, task.recurrence);
    }
  }
}
