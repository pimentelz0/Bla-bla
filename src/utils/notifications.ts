// Web & Mobile Notification & Audio Chime Helper for WhatsApp-like alerts

let audioCtx: AudioContext | null = null;

export function isInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    ('standalone' in window.navigator && Boolean((window.navigator as any).standalone)) ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

// Register service worker if supported
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.debug('Service Worker registered successfully for notifications:', reg.scope);
        })
        .catch((err) => {
          console.debug('Service Worker registration skipped or failed:', err);
        });
    });
  }
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

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  try {
    const perm = await Notification.requestPermission();
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
  if (!isNotificationSupported()) {
    return false;
  }

  // If permission not requested yet, ask now
  if (getNotificationPermission() === 'default') {
    const newPerm = await requestNotificationPermission();
    if (newPerm !== 'granted') return false;
  }

  if (getNotificationPermission() !== 'granted') {
    return false;
  }

  const notificationTag = options.tag || (options.conversationId ? `chat_${options.conversationId}` : 'blabla_chat');
  const iconUrl = options.icon || '/icon-192.png';

  // Haptic feedback (Vibration)
  try {
    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      window.navigator.vibrate([200, 100, 200]);
    }
  } catch {
    // ignore
  }

  // 1. Try Service Worker showNotification first (Works in background & mobile status bar)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
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
        return true;
      }
    } catch (err) {
      console.debug('Service Worker showNotification fallback to window.Notification:', err);
    }
  }

  // 2. Direct Window Notification fallback
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
      }, 7000);

      return true;
    } catch (err) {
      console.warn('Could not display window notification:', err);
    }
  }

  return false;
}

/**
 * Schedules a notification to be shown in X milliseconds.
 * Gives the user time to lock screen or minimize app so they can see the notification in system status bar.
 */
export async function scheduleBackgroundNotification(title: string, options: NotificationOptions, delayMs = 5000): Promise<boolean> {
  if (!isNotificationSupported()) {
    return false;
  }

  if (getNotificationPermission() === 'default') {
    const newPerm = await requestNotificationPermission();
    if (newPerm !== 'granted') return false;
  }

  if (getNotificationPermission() !== 'granted') {
    return false;
  }

  const notificationTag = options.tag || (options.conversationId ? `chat_${options.conversationId}` : 'blabla_chat');
  const iconUrl = options.icon || '/icon-192.png';

  // Send schedule command to Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({
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
