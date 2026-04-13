import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import { api } from '../api/client';

// Show notifications even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const token = await Notifications.getDevicePushTokenAsync();
  return token.data as string;
}

export function usePushNotifications() {
  const tokenRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Register token
    getExpoPushToken().then(async (token) => {
      if (!token) return;
      tokenRef.current = token;
      try {
        await api.registerFcmToken(token);
      } catch (err) {
        console.log('Failed to register FCM token:', err);
      }
    });

    // Handle notification tap — navigate to task
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const taskId = response.notification.request.content.data?.taskId;
      if (taskId) router.push(`/task/${taskId}`);
    });

    return () => sub.remove();
  }, []);

  // Call this on logout to unregister the token
  const unregister = async () => {
    if (tokenRef.current) {
      try {
        await api.removeFcmToken(tokenRef.current);
      } catch {}
      tokenRef.current = null;
    }
  };

  return { unregister };
}
