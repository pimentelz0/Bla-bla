import { initializeApp, cert, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getMessaging, Messaging, MulticastMessage } from 'firebase-admin/messaging';
import firebaseConfigData from '../firebase-applet-config.json';

let adminApp: App | null = null;

export function getFirebaseAdmin(): { db: Firestore | null; messaging: Messaging | null } {
  if (adminApp) {
    try {
      return {
        db: firebaseConfigData.firestoreDatabaseId
          ? getFirestore(adminApp, firebaseConfigData.firestoreDatabaseId)
          : getFirestore(adminApp),
        messaging: getMessaging(adminApp),
      };
    } catch {
      return { db: null, messaging: null };
    }
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfigData.projectId || 'upbeat-potential-nc9s2';
    
    // Check if service account JSON provided in environment
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_KEY;
    
    const existingApps = getApps();
    const appName = 'fcm_admin_app';
    const foundApp = existingApps.find((a) => a.name === appName);

    if (foundApp) {
      adminApp = foundApp;
    } else if (serviceAccountJson) {
      try {
        const certObj = JSON.parse(serviceAccountJson);
        adminApp = initializeApp(
          {
            credential: cert(certObj),
            projectId,
          },
          appName
        );
      } catch (certErr) {
        console.warn('[FCM_ADMIN] Could not parse FIREBASE_SERVICE_ACCOUNT json, using project ID:', certErr);
        adminApp = initializeApp({ projectId }, appName);
      }
    } else {
      adminApp = initializeApp({ projectId }, appName);
    }

    return {
      db: firebaseConfigData.firestoreDatabaseId
        ? getFirestore(adminApp, firebaseConfigData.firestoreDatabaseId)
        : getFirestore(adminApp),
      messaging: getMessaging(adminApp),
    };
  } catch (err) {
    console.warn('[FCM_ADMIN] Firebase Admin initialization note:', err);
    return { db: null, messaging: null };
  }
}

export interface FcmPushResult {
  sentCount: number;
  errors: number;
  details?: any;
}

/**
 * Sends an FCM push notification to all active devices registered for target user.
 * Automatically cleans up invalid/expired tokens in Firestore.
 */
export async function sendFcmPushToUser(
  userId: string,
  notification: {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    data?: Record<string, any>;
  }
): Promise<FcmPushResult> {
  const { db, messaging } = getFirebaseAdmin();
  if (!db || !messaging) {
    return { sentCount: 0, errors: 0 };
  }

  try {
    // 1. Fetch tokens from Firestore
    const snapshot = await db.collection('fcm_tokens').where('userId', '==', userId).get();
    if (snapshot.empty) {
      return { sentCount: 0, errors: 0 };
    }

    const tokenDocs = snapshot.docs;
    const tokens = tokenDocs.map((doc) => doc.data().token).filter(Boolean);

    if (tokens.length === 0) {
      return { sentCount: 0, errors: 0 };
    }

    console.log(`[FCM_SERVER] Sending FCM push to ${tokens.length} token(s) for user ${userId}`);

    const clickUrl =
      notification.data?.url ||
      (notification.data?.conversationId
        ? `/?chat=${encodeURIComponent(notification.data.conversationId)}`
        : '/');

    const multicastMessage: MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        ...(notification.data || {}),
        url: clickUrl,
        click_action: clickUrl,
        chatId: notification.data?.conversationId || '',
      },
      webpush: {
        fcmOptions: {
          link: clickUrl,
        },
        headers: {
          Urgency: 'high',
        },
        notification: {
          title: notification.title,
          body: notification.body,
          icon: notification.icon || '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [300, 100, 300, 100, 300],
          tag: notification.tag || 'blabla_chat',
          renotify: true,
          requireInteraction: true,
          data: {
            url: clickUrl,
            chatId: notification.data?.conversationId || '',
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(multicastMessage);
    console.log(`[FCM_SERVER] Sent: ${response.successCount} succeeded, ${response.failureCount} failed`);

    // Clean up expired or unregistered tokens
    if (response.failureCount > 0) {
      const batch = db.batch();
      let deleteCount = 0;

      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errCode = resp.error.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            const badDoc = tokenDocs[idx];
            if (badDoc) {
              batch.delete(badDoc.ref);
              deleteCount++;
            }
          }
        }
      });

      if (deleteCount > 0) {
        await batch.commit();
        console.log(`[FCM_SERVER] Removed ${deleteCount} expired FCM token(s) from Firestore.`);
      }
    }

    return {
      sentCount: response.successCount,
      errors: response.failureCount,
    };
  } catch (err: any) {
    console.warn('[FCM_SERVER] Error sending push to user:', err?.message || err);
    return { sentCount: 0, errors: 1 };
  }
}

/**
 * Also optionally writes the message to Firestore collection `messages`
 * which triggers the Firebase Cloud Function if deployed!
 */
export async function mirrorMessageToFirestore(msg: {
  id: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  content: string;
  chatId: string;
  createdAt: string;
}) {
  const { db } = getFirebaseAdmin();
  if (!db) return;

  try {
    await db.collection('messages').doc(msg.id).set({
      senderId: msg.senderId,
      senderName: msg.senderName || 'Blá Blá',
      recipientId: msg.recipientId,
      content: msg.content,
      chatId: msg.chatId,
      createdAt: msg.createdAt,
      timestamp: Date.now(),
    });
    console.log(`[FCM_MIRROR] Mirrored message ${msg.id} to Firestore collection 'messages'`);
  } catch (err) {
    console.debug('[FCM_MIRROR] Could not mirror to Firestore:', err);
  }
}
