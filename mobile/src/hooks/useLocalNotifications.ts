import * as Notifications from 'expo-notifications';
import { api } from '../api/client';

/**
 * Schedule local deadline reminders for all tasks.
 * Call this after tasks are loaded or synced.
 * Cancels all existing deadline reminders first to avoid duplicates.
 */
export async function scheduleDeadlineReminders() {
  // Cancel all previously scheduled deadline notifications
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of existing) {
    if (n.content.data?.type === 'deadline') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  try {
    const res = await api.getTasks(1);
    const tasks = res.tasks || res;

    const now = Date.now();
    const alerts = [
      { ms: 60 * 60 * 1000, label: '1 hour' },
      { ms: 24 * 60 * 60 * 1000, label: '1 day' },
    ];

    for (const task of tasks) {
      if (!task.deadline || task.status === 'done') continue;
      const deadlineMs = new Date(task.deadline).getTime();

      for (const alert of alerts) {
        const triggerMs = deadlineMs - alert.ms;
        if (triggerMs <= now) continue; // already passed

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏰ Due in ${alert.label}`,
            body: task.title,
            data: { taskId: task._id, type: 'deadline' },
            sound: true,
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerMs) },
        });
      }
    }
  } catch (err) {
    console.log('Failed to schedule deadline reminders:', err);
  }
}
