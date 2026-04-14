import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA4I_DbmS9czeZDLeB80gacLnt1pR5UeOI',
  authDomain: 'mytick-cbcf0.firebaseapp.com',
  projectId: 'mytick-cbcf0',
  storageBucket: 'mytick-cbcf0.firebasestorage.app',
  messagingSenderId: '516718261323',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:516718261323:web:b24089355cfec4424809ce',
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BNaAw5Td5PuR2YAJdZ4OZr3AhvrOVDXwfTudxe4AnCpNxSYpNpSr5WMAXbnHsFstcm2m4nWw5y9w_zkH72eQYvQ',
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
