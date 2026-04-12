import dotenv from 'dotenv';
import { logger } from './utils/logger';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:4000/api';
const ADMIN_KEY = process.env.ADMIN_API_KEY!;
const CHECK_INTERVAL = 60_000;

const ALERTS = [
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
];

const notified = new Set<string>();

async function api(path: string, userId?: string) {
  const headers: Record<string, string> = { 'x-admin-key': ADMIN_KEY };
  if (userId) headers['x-admin-user-id'] = userId;
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

async function sendNotification(userId: string, taskTitle: string, alertLabel: string) {
  // TODO: Replace with FCM, email, or push service
  logger.info({ userId, taskTitle, alertLabel }, 'DEADLINE ALERT');
}

async function checkDeadlines() {
  try {
    const users = await api('/auth/users');
    const now = Date.now();

    for (const user of users) {
      const res = await api(`/tasks?limit=100`, user.id);
      const tasks = res.tasks || res;

      for (const task of tasks) {
        if (!task.deadline || task.status === 'done') continue;
        const remaining = new Date(task.deadline).getTime() - now;

        for (const alert of ALERTS) {
          const key = `${task._id}-${alert.label}`;
          if (notified.has(key)) continue;
          if (remaining > 0 && remaining <= alert.ms) {
            await sendNotification(user.id, task.title, alert.label);
            notified.add(key);
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'deadline check failed');
  }
}

logger.info({ interval: CHECK_INTERVAL, apiUrl: API_URL }, 'notification worker started');
checkDeadlines();
setInterval(checkDeadlines, CHECK_INTERVAL);
