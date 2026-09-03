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
      console.log(`[WebPush] User ${userId} has no registered push subscriptions.`);
      return { sentCount: 0, errors: 0 };
    }

    // Strictly sanitize icon: Data URIs (Base64) exceed the 4KB WebPush RFC limit and are rejected by APNs
    let safeIcon = payload.icon;
    if (!safeIcon || safeIcon.startsWith('data:') || safeIcon.length > 250) {
      safeIcon = '/icon-192.png';
    }

    // Build lightweight, compliant push payload (<3.5KB)
    const safePayload: PushPayload = {
      title: (payload.title || 'Blá Blá').slice(0, 60),
      body: (payload.body || 'Nova mensagem recebida').slice(0, 150),
      icon: safeIcon,
      badge: '/icon-192.png',
      tag: payload.tag ? payload.tag.slice(0, 32) : 'blabla_msg',
      data: {
        conversationId: payload.data?.conversationId || '',
        messageId: payload.data?.messageId || '',
        senderId: payload.data?.senderId || '',
        timestamp: payload.data?.timestamp || Date.now(),
      },
    };

    const payloadString = JSON.stringify(safePayload);

    let sentCount = 0;
    let errors = 0;

    // APNs (Apple) coalescing topic: alphanumeric, max 32 chars
    const apnsTopic = safePayload.tag ? safePayload.tag.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) : undefined;

    const requestOptions: webpush.RequestOptions = {
      TTL: 60 * 60 * 24, // 24 hours
      urgency: 'high',
      topic: apnsTopic,
    };

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

          await webpush.sendNotification(pushSubscription, payloadString, requestOptions);

          sentCount++;
          console.log(`[WebPush] Successfully delivered push to endpoint (${sub.endpoint.slice(0, 45)}...)`);
        } catch (err: any) {
          errors++;
          const statusCode = err.statusCode || err.status;
          console.warn(`[WebPush Error] Status: ${statusCode} - Endpoint: ${sub.endpoint.slice(0, 45)}...`, err.message || err);
          // If subscription is invalid or expired (404 Not Found or 410 Gone), remove it
          if (statusCode === 404 || statusCode === 410) {
            await dbDeletePushSubscription(sub.endpoint);
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
