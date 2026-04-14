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

type PushProvider = 'fcm' | 'huawei' | 'apns';

async function detectPushProvider(): Promise<PushProvider> {
  if (Platform.OS === 'ios') return 'apns';
  // On Android, try to detect Huawei (no Google Play Services)
  try {
    // getDevicePushTokenAsync will fail on Huawei without Google Play Services
    // In that case, we'd fall back to Huawei Push Kit
    // For now, detect via device brand
    const brand = (Device.brand || '').toLowerCase();
    if (brand === 'huawei' || brand === 'honor') {
      // TODO: When Huawei Push Kit is integrated, return 'huawei'
      // For now, still try FCM — some Huawei devices have Google services
      return 'fcm';
    }
  } catch {}
  return 'fcm';
}

async function getPushToken(): Promise<{ token: string; provider: PushProvider } | null> {
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

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const provider = await detectPushProvider();

  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    return { token: tokenData.data as string, provider };
  } catch (err) {
    console.log(`Failed to get push token (${provider}):`, err);
    // TODO: If FCM fails on Huawei, try Huawei Push Kit here
    return null;
  }
}

export function usePushNotifications() {
  const tokenRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Register token with provider detection
    getPushToken().then(async (result) => {
      if (!result) return;
      tokenRef.current = result.token;
      try {
        await api.registerFcmToken(result.token, result.provider, `${Device.brand || ''} ${Device.modelName || ''} ${Platform.OS}`);
      } catch (err) {
        console.log('Failed to register push token:', err);
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
