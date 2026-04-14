import { useEffect, useRef } from 'react';
import { requestNotificationPermission, onForegroundMessage } from '../firebase';
import { api } from '../api/client';

export function usePushNotifications() {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    requestNotificationPermission().then(async (fcmToken) => {
      if (!fcmToken) return;
      tokenRef.current = fcmToken;
      try {
        await api.registerFcmToken(fcmToken);
      } catch (err) {
        console.log('Failed to register FCM token:', err);
      }
    });

    const unsub = onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (title && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.svg' });
      }
    });

    return () => unsub();
  }, []);

  const unregister = async () => {
    if (tokenRef.current) {
      try { await api.removeFcmToken(tokenRef.current); } catch {}
      tokenRef.current = null;
    }
  };

  return { unregister };
}
