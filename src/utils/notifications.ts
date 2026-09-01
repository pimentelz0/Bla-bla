// Web & Mobile Notification & Audio Chime Helper for WhatsApp-like alerts

import { api } from '../services/api';

let audioCtx: AudioContext | null = null;

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    ('standalone' in window.navigator && Boolean((window.navigator as any).standalone)) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

// Register service worker immediately and return the registration
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.debug('Service Worker registered successfully:', reg.scope);
    return reg;
  } catch (err) {
    console.debug('Service Worker registration skipped or failed:', err);
    return null;
  }
}

// Auto-register immediately on script evaluation
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerServiceWorker();
}

// Unlock audio context on first user interaction (touch or click anywhere)
export function initAudioUnlock() {
  if (typeof window === 'undefined') return;

  const unlock = () => {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
        }
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    } catch {}
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };

  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

// WhatsApp-like crisp, melodic two-tone chime
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;

    // Primary bright tone (A5 880Hz -> E6 1318.5Hz)
    const osc1 = audioCtx.createOscillator();
    // Warm harmonic tone (1760Hz -> 2093Hz)
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    // WhatsApp melodic pitch progression
    osc1.frequency.setValueAtTime(950, now);
    osc1.frequency.exponentialRampToValueAtTime(1420, now + 0.08);

    osc2.frequency.setValueAtTime(1420, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1900, now + 0.16);

    // Dynamic envelope for a rounded, crisp pop chime
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.45, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.25, now + 0.09);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now + 0.07);

    osc1.stop(now + 0.14);
    osc2.stop(now + 0.38);
  } catch (err) {
    console.debug('Notification audio play skipped:', err);
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && ('Notification' in window || 'serviceWorker' in navigator);
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null | undefined): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export interface PushStatusInfo {
  supported: boolean;
  permission: NotificationPermission;
  serviceWorkerRegistered: boolean;
  subscribedToServer: boolean;
  endpoint?: string;
  isIosBrowser: boolean;
  isStandalonePwa: boolean;
}

let lastSyncedEndpoint = '';
let lastSyncedUserId = '';

export async function checkPushSubscriptionStatus(): Promise<PushStatusInfo> {
  const isIos = isIOS();
  const standalone = isStandalone();
  const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const permission = getNotificationPermission();

  let swRegistered = false;
  let subscribed = false;
  let endpoint: string | undefined;

  if (supported && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        swRegistered = true;
        if (reg.pushManager) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            subscribed = true;
            endpoint = sub.endpoint;
          }
        }
      }
    } catch {}
  }

  return {
    supported,
    permission,
    serviceWorkerRegistered: swRegistered,
    subscribedToServer: subscribed,
    endpoint,
    isIosBrowser: isIos,
    isStandalonePwa: standalone,
  };
}

/**
 * Centrally synchronize the device PushSubscription with the backend for the current authenticated user.
 * Idempotent, safe, and guarantees subscription is attached to the authenticated userId in Supabase.
 */
export async function syncWebPushSubscription(userId?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    return false;
  }

  try {
    // 1. Ensure Service Worker registration is ready
    let targetReg: ServiceWorkerRegistration | null = null;
    try {
      targetReg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
    } catch {}

    if (!targetReg) {
      targetReg = await navigator.serviceWorker.getRegistration();
    }

    if (!targetReg) {
      targetReg = await registerServiceWorker();
    }

    if (!targetReg || !targetReg.pushManager) {
      console.debug('[Push] PushManager not available in this context');
      return false;
    }

    // 2. Fetch VAPID public key from backend
    const vapidKey = await api.getVapidPublicKey();
    if (!vapidKey) {
      console.warn('[Push] Failed to retrieve VAPID public key from server');
      return false;
    }

    const convertedKey = urlBase64ToUint8Array(vapidKey);

    // 3. Inspect existing subscription
    let sub = await targetReg.pushManager.getSubscription();

    if (sub) {
      try {
        const rawKey = sub.options?.applicationServerKey;
        if (rawKey) {
          const keyArray = new Uint8Array(rawKey);
          let match = keyArray.length === convertedKey.length;
          if (match) {
            for (let i = 0; i < keyArray.length; i++) {
              if (keyArray[i] !== convertedKey[i]) {
                match = false;
                break;
              }
            }
          }
          if (!match) {
            console.log('[Push] VAPID key mismatch in existing subscription, renewing...');
            await sub.unsubscribe();
            sub = null;
          }
        }
      } catch {
        try {
          await sub.unsubscribe();
        } catch {}
        sub = null;
      }
    }

    // 4. Create new push subscription if needed
    if (!sub) {
      sub = await targetReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    if (sub) {
      const p256dhKey = sub.getKey ? arrayBufferToBase64(sub.getKey('p256dh')) : (sub.toJSON()?.keys?.p256dh || '');
      const authKey = sub.getKey ? arrayBufferToBase64(sub.getKey('auth')) : (sub.toJSON()?.keys?.auth || '');

      const payload = {
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime || null,
        keys: {
          p256dh: p256dhKey,
          auth: authKey,
        },
      };

      // 5. Send to backend with authentication token
      await api.savePushSubscription(payload);

      console.log('[Push] Permission: granted');
      console.log('[Push] Subscription: exists');
      console.log('[Push] Sync: success');

      lastSyncedEndpoint = sub.endpoint;
      if (userId) {
        lastSyncedUserId = userId;
      }
      return true;
    }
  } catch (err: any) {
    console.warn('[Push] Subscription sync initial attempt note, trying fresh reset:', err?.message || err);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.pushManager) {
        const oldSub = await reg.pushManager.getSubscription();
        if (oldSub) {
          await oldSub.unsubscribe().catch(() => {});
        }
        const vapidKey = await api.getVapidPublicKey();
        if (vapidKey) {
          const convertedKey = urlBase64ToUint8Array(vapidKey);
          const freshSub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey,
          });
          if (freshSub) {
            const p256dhKey = freshSub.getKey ? arrayBufferToBase64(freshSub.getKey('p256dh')) : (freshSub.toJSON()?.keys?.p256dh || '');
            const authKey = freshSub.getKey ? arrayBufferToBase64(freshSub.getKey('auth')) : (freshSub.toJSON()?.keys?.auth || '');

            await api.savePushSubscription({
              endpoint: freshSub.endpoint,
              expirationTime: freshSub.expirationTime || null,
              keys: {
                p256dh: p256dhKey,
                auth: authKey,
              },
            });
            console.log('[Push] Permission: granted');
            console.log('[Push] Subscription: exists');
            console.log('[Push] Sync: success');
            lastSyncedEndpoint = freshSub.endpoint;
            if (userId) {
              lastSyncedUserId = userId;
            }
            return true;
          }
        }
      }
    } catch (retryErr) {
      console.error('[Push] Push subscription sync failed:', retryErr);
    }
  }
  return false;
}

export async function subscribeUserToWebPush(userId?: string): Promise<boolean> {
  return await syncWebPushSubscription(userId);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      subscribeUserToWebPush().catch(() => {});
    }
    return perm;
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return 'denied';
  }
}

export interface NotificationOptions {
  body: string;
  icon?: string;
  conversationId?: string;
  tag?: string;
  onClick?: () => void;
}

/**
 * Sends a native system notification to the status bar (Android/Windows/Mac/Linux/iOS PWA)
 */
export async function sendBrowserNotification(title: string, options: NotificationOptions): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const notificationTag = options.tag || (options.conversationId ? `chat_${options.conversationId}` : 'blabla_chat');
  const iconUrl = options.icon || '/icon-192.png';

  // Haptic feedback (Vibration)
  try {
    if (window.navigator?.vibrate) {
      window.navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // ignore
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }

  let sent = false;

  // Layer 1: Fast dispatch to active Service Worker controller
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options: {
          body: options.body,
          icon: iconUrl,
          tag: notificationTag,
          data: {
            conversationId: options.conversationId,
            timestamp: Date.now(),
          },
        },
      });
      sent = true;
    } catch (e) {
      console.debug('SW controller postMessage error:', e);
    }
  }

  // Layer 2: Service Worker registration showNotification (Works in background & mobile status bar)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
      ]);
      const targetReg = reg || (await navigator.serviceWorker.getRegistration());
      if (targetReg && targetReg.showNotification) {
        await targetReg.showNotification(title, {
          body: options.body,
          icon: iconUrl,
          badge: '/icon-192.png',
          tag: notificationTag,
          renotify: true,
          vibrate: [200, 100, 200],
          data: {
            conversationId: options.conversationId,
            timestamp: Date.now(),
          },
        } as any);
        sent = true;
        return true;
      }
    } catch (err) {
      console.debug('Service Worker showNotification error:', err);
    }
  }

  // Layer 3: Direct Window Notification fallback
  if ('Notification' in window) {
    try {
      const notif = new Notification(title, {
        body: options.body,
        icon: iconUrl,
        badge: '/icon-192.png',
        tag: notificationTag,
        renotify: true,
      } as any);

      notif.onclick = () => {
        window.focus();
        if (options.onClick) {
          options.onClick();
        }
        notif.close();
      };

      setTimeout(() => {
        try {
          notif.close();
        } catch {}
      }, 8000);

      return true;
    } catch (err) {
      console.warn('Could not display window notification:', err);
    }
  }

  return sent;
}

/**
 * Schedules a notification to be shown in X milliseconds.
 * Gives the user time to lock screen or minimize app so they can see the notification in system status bar.
 */
export async function scheduleBackgroundNotification(title: string, options: NotificationOptions, delayMs = 5000): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return false;
  }

  const notificationTag = options.tag || (options.conversationId ? `chat_${options.conversationId}` : 'blabla_chat');
  const iconUrl = options.icon || '/icon-192.png';

  // Send schedule command to Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
      ]);
      const targetReg = reg || (await navigator.serviceWorker.getRegistration());
      if (targetReg?.active) {
        targetReg.active.postMessage({
          type: 'SCHEDULE_NOTIFICATION',
          delayMs,
          title,
          options: {
            body: options.body,
            icon: iconUrl,
            tag: notificationTag,
            data: { conversationId: options.conversationId },
          },
        });
        return true;
      }
    } catch (err) {
      console.debug('Could not send message to service worker:', err);
    }
  }

  // Fallback setTimeout
  setTimeout(() => {
    sendBrowserNotification(title, options);
  }, delayMs);

  return true;
}

// Update Title with Unread Count & Badge
export function updateAppBadgeAndTitle(unreadCount: number, previewSender?: string) {
  if (typeof document === 'undefined') return;

  if (unreadCount > 0) {
    if (previewSender) {
      document.title = `(${unreadCount}) 💬 @${previewSender} - Blá Blá`;
    } else {
      document.title = `(${unreadCount}) Blá Blá • Mensagens`;
    }

    if ('setAppBadge' in navigator) {
      (navigator as any).setAppBadge(unreadCount).catch(() => {});
    }
  } else {
    document.title = 'Blá Blá - Mensagens';
    if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }
}
