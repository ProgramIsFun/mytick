import { logger } from '../utils/logger';

let messaging: any = null;

export function initFCM() {
  const cred = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!cred) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT not set — FCM disabled');
    return;
  }
  try {
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(cred);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    messaging = admin.messaging();
    logger.info('FCM initialized');
  } catch (err) {
    logger.error({ err }, 'FCM init failed');
  }
}

export async function sendPush(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<void> {
  if (!messaging || !tokens.length) {
    logger.info({ title, body, tokens: tokens.length }, 'FCM skip (no messaging or tokens)');
    return;
  }
  try {
    const res = await messaging.sendEachForMulticast({ tokens, notification: { title, body }, data });
    logger.info({ success: res.successCount, failure: res.failureCount }, 'FCM sent');
    if (res.failureCount > 0) {
      res.responses.forEach((r: any, i: number) => {
        if (!r.success) logger.warn({ token: tokens[i]?.slice(0, 20) + '...', error: r.error?.message }, 'FCM token failed');
      });
    }
  } catch (err) {
    logger.error({ err }, 'FCM send failed');
  }
}
