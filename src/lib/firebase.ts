import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  getDocFromServer,
} from 'firebase/firestore';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported as isFcmSupported,
  Messaging,
} from 'firebase/messaging';
import firebaseConfigData from '../../firebase-applet-config.json';

// Firebase Client Configuration
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigData.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigData.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigData.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigData.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigData.appId || '',
};

// Initialize Firebase App singleton
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific databaseId if provided
export const db = firebaseConfigData.firestoreDatabaseId
  ? getFirestore(firebaseApp, firebaseConfigData.firestoreDatabaseId)
  : getFirestore(firebaseApp);

// VAPID Public Key for Web Push / FCM
export const FCM_VAPID_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  'BAJTG-SdB_hO5SUEAG3Ua-fXycKHi3MZVk96MDuHn39kUIzUOQEqy7WBRA9NdGHiEM6XbX358slBOagLXUG3xB0';

let messagingInstance: Messaging | null = null;
let messagingChecked = false;

/**
 * Safely retrieves FCM Messaging instance if supported by the current browser/context.
 */
export async function getFcmMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (messagingChecked) return messagingInstance;

  try {
    const supported = await isFcmSupported();
    if (supported) {
      messagingInstance = getMessaging(firebaseApp);
    } else {
      console.warn('[FCM] Firebase Messaging is not supported in this browser environment.');
    }
  } catch (err) {
    console.warn('[FCM] Error checking FCM support:', err);
  }

  messagingChecked = true;
  return messagingInstance;
}

/**
 * Validate connection to Firestore as required by system skill
 */
async function testFirestoreConnection() {
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[FCM] Firestore client is offline. Verify network or rules.');
    }
  }
}
testFirestoreConnection();

/**
 * Request notification permission, register service worker, generate FCM token,
 * and save it to Firestore under `fcm_tokens` linked to the logged-in user.
 * Supports multiple tokens per user (multi-device).
 */
export async function registerFcmTokenForUser(userId: string): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Execução fora do navegador' };
  }

  if (!('Notification' in window)) {
    return { success: false, error: 'Este navegador não suporta notificações' };
  }

  try {
    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: 'Permissão de notificação negada. Ative nas permissões do site.',
      };
    }

    // 2. Ensure Service Worker is registered
    let swReg: ServiceWorkerRegistration | null = null;
    if ('serviceWorker' in navigator) {
      try {
        // Try getting existing registration or register firebase-messaging-sw.js
        swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js') || null;
        if (!swReg) {
          swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        }
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('[FCM] Could not register dedicated firebase-messaging-sw.js, falling back to active worker:', swErr);
        swReg = (await navigator.serviceWorker.getRegistration()) || null;
      }
    }

    // 3. Get FCM Messaging
    const messaging = await getFcmMessaging();
    if (!messaging) {
      return {
        success: false,
        error: 'Firebase Cloud Messaging indisponível neste navegador.',
      };
    }

    // 4. Retrieve FCM Token
    const currentToken = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg || undefined,
    });

    if (!currentToken) {
      return {
        success: false,
        error: 'Não foi possível gerar o token FCM. Verifique a chave VAPID.',
      };
    }

    console.log('[FCM] Generated Device Token:', currentToken.substring(0, 15) + '...');

    // 5. Save Token to Firestore linked to logged-in userId
    // Uses deterministic ID based on user and token suffix to allow multiple devices without collision
    const sanitizedTokenSuffix = btoa(currentToken.slice(-24)).replace(/[^a-zA-Z0-9]/g, '');
    const docId = `token_${userId}_${sanitizedTokenSuffix}`;

    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandaloneMode =
      ('standalone' in window.navigator && Boolean((window.navigator as any).standalone)) ||
      window.matchMedia('(display-mode: standalone)').matches;

    const tokenDocRef = doc(db, 'fcm_tokens', docId);
    await setDoc(
      tokenDocRef,
      {
        token: currentToken,
        userId: userId,
        platform: isIosDevice ? (isStandaloneMode ? 'ios_pwa' : 'ios_safari') : 'web',
        isStandalone: isStandaloneMode,
        userAgent: navigator.userAgent,
        updatedAt: serverTimestamp(),
        lastActive: new Date().toISOString(),
      },
      { merge: true }
    );

    // Save locally for reference
    try {
      localStorage.setItem('fcm_device_token', currentToken);
      localStorage.setItem('fcm_token_updated', Date.now().toString());
    } catch {}

    // 6. Listen for foreground messages
    setupForegroundMessageListener(messaging);

    return {
      success: true,
      token: currentToken,
    };
  } catch (err: any) {
    console.error('[FCM] Error registering token:', err);
    return {
      success: false,
      error: err?.message || 'Erro ao registrar token FCM.',
    };
  }
}

/**
 * Remove token when user logs out or disables notifications
 */
export async function removeFcmToken(userId: string, tokenString?: string): Promise<void> {
  try {
    const token = tokenString || (typeof window !== 'undefined' ? localStorage.getItem('fcm_device_token') : null);
    if (!token) return;

    const sanitizedTokenSuffix = btoa(token.slice(-24)).replace(/[^a-zA-Z0-9]/g, '');
    const docId = `token_${userId}_${sanitizedTokenSuffix}`;
    await deleteDoc(doc(db, 'fcm_tokens', docId));

    if (typeof window !== 'undefined') {
      localStorage.removeItem('fcm_device_token');
    }
    console.log('[FCM] Token removed successfully');
  } catch (err) {
    console.warn('[FCM] Error removing token:', err);
  }
}

/**
 * Get count of registered FCM devices for a user from Firestore
 */
export async function getUserFcmTokenCount(userId: string): Promise<number> {
  try {
    const q = query(collection(db, 'fcm_tokens'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.size;
  } catch (err) {
    console.warn('[FCM] Error querying user token count:', err);
    return 0;
  }
}

/**
 * Setup foreground message handler (when app is open and in focus)
 */
let foregroundListenerInitialized = false;
function setupForegroundMessageListener(messaging: Messaging) {
  if (foregroundListenerInitialized) return;
  foregroundListenerInitialized = true;

  onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground message received:', payload);
    const title = payload.notification?.title || payload.data?.title || 'Blá Blá';
    const body = payload.notification?.body || payload.data?.body || 'Nova mensagem recebida';

    // Show native browser notification if user allowed it
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: payload.notification?.icon || '/icon-192.png',
          badge: '/icon-192.png',
          data: payload.data,
        });
      } catch (err) {
        console.debug('[FCM] Native notification fallback:', err);
      }
    }
  });
}
