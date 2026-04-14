import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'TODO_FILL_ME',
  authDomain: 'mytick-cbcf0.firebaseapp.com',
  projectId: 'mytick-cbcf0',
  storageBucket: 'mytick-cbcf0.firebasestorage.app',
  messagingSenderId: '516718261323',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'TODO_FILL_ME',
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || 'TODO_FILL_ME',
    });
    return token;
  } catch (err) {
    console.error('Failed to get FCM token:', err);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  return onMessage(messaging, callback);
}
