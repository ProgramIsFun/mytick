import { useEffect, useRef } from 'react';
import { api } from '../api/client';
import { STORAGE_TOKEN_KEY } from '../constants/storage';

const ALERTS = [
  { label: '1 day', ms: 24 * 60 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
];

export function useDeadlineAlerts() {
  const notified = useRef(new Set<string>());

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (!localStorage.getItem(STORAGE_TOKEN_KEY)) return;
    if (Notification.permission === 'default') Notification.requestPermission();

    const check = async () => {
      if (Notification.permission !== 'granted') return;
      try {
        const res = await api.getTasks(1, 100);
        const tasks = res.tasks || [];
        const now = Date.now();

        for (const task of tasks) {
          if (!task.deadline || task.status === 'done') continue;
          const deadline = new Date(task.deadline).getTime();
          const remaining = deadline - now;

          for (const alert of ALERTS) {
            const key = `${task._id}-${alert.label}`;
            if (notified.current.has(key)) continue;
            if (remaining > 0 && remaining <= alert.ms) {
              new Notification(`⏰ ${task.title}`, {
                body: `Due in ${alert.label}`,
                tag: key,
              });
              notified.current.add(key);
            }
          }
        }
      } catch {}
    };

    check();
    const interval = setInterval(check, 60_000); // check every minute
    return () => clearInterval(interval);
  }, []);
}
