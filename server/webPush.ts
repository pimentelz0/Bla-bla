import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { dbGetPushSubscriptionsByUser, dbDeletePushSubscription, dbMarkMessagesAsDelivered } from './supabase';

const VAPID_FILE = path.join(process.cwd(), '.vapid-keys.json');

// Constant stable VAPID keypair to guarantee push subscriptions never get invalidated on server restart
const STABLE_VAPID_KEYS = {
  publicKey: 'BAJTG-SdB_hO5SUEAG3Ua-fXycKHi3MZVk96MDuHn39kUIzUOQEqy7WBRA9NdGHiEM6XbX358slBOagLXUG3xB0',
  privateKey: 'Jg3X-XRYk7TkiSZGhhHRIKXvdo8i4Un6muNdQufRphA',
};

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let vapidKeys: VapidKeys = STABLE_VAPID_KEYS;

try {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  } else if (fs.existsSync(VAPID_FILE)) {
    const raw = fs.readFileSync(VAPID_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.publicKey && parsed.privateKey) {
      vapidKeys = parsed;
    }
  } else {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(STABLE_VAPID_KEYS, null, 2), 'utf-8');
  }
} catch (err) {
  console.warn('Failed to load/save persistent VAPID keys, using stable keypair:', err);
  vapidKeys = STABLE_VAPID_KEYS;
}

webpush.setVapidDetails(
  'mailto:suporte@blabla.chat',
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);

export function getVapidPublicKey(): string {
  return vapidKeys.publicKey;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    conversationId?: string;
    messageId?: string;
    senderId?: string;
    timestamp?: number;
  };
}

/**
 * Sends a real Web Push notification to all registered devices of a user.
 * This wakes up mobile devices (Android / iOS PWA / Desktop) even when the app is completely closed.
 */
export async function sendWebPushToUser(
  userId: string,
  payload: PushPayload,
  broadcastToUser?: (userId: string, data: any) => void,
): Promise<{ sentCount: number; errors: number }> {
  try {
    const subscriptions = await dbGetPushSubscriptionsByUser(userId);
    if (!subscriptions || subscriptions.length === 0) {
      return { sentCount: 0, errors: 0 };
    }

    let sentCount = 0;
    let errors = 0;

    const payloadString = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          await webpush.sendNotification(pushSubscription, payloadString, {
            TTL: 60 * 60 * 24, // 24 hours
            urgency: 'high',
          });

          sentCount++;
        } catch (err: any) {
          errors++;
          // If subscription is invalid or expired, delete it
          if (err.statusCode === 404 || err.statusCode === 410) {
            await dbDeletePushSubscription(sub.endpoint);
          } else {
            console.debug(`WebPush error for user ${userId}:`, err.message || err);
          }
        }
      }),
    );

    // If at least one push was successfully dispatched and we have a messageId, mark it delivered
    if (sentCount > 0 && payload.data?.messageId && payload.data?.senderId) {
      await dbMarkMessagesAsDelivered([payload.data.messageId]);
      if (broadcastToUser) {
        broadcastToUser(payload.data.senderId, {
          type: 'message:delivered',
          payload: {
            message_id: payload.data.messageId,
            conversation_id: payload.data.conversationId,
          },
        });
      }
    }

    return { sentCount, errors };
  } catch (err) {
    console.error(`Failed to send web push to user ${userId}:`, err);
    return { sentCount: 0, errors: 1 };
  }
}
