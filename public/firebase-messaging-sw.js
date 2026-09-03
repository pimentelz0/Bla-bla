// Firebase Messaging Service Worker
// Listens for push events and displays notifications in the background (even when the app is completely closed)

importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBACnytlZIBbxRI58dSHDhHEngCzMDoa3g",
  authDomain: "upbeat-potential-nc9s2.firebaseapp.com",
  projectId: "upbeat-potential-nc9s2",
  storageBucket: "upbeat-potential-nc9s2.firebasestorage.app",
  messagingSenderId: "652406372028",
  appId: "1:652406372028:web:e1b840a05062540d0ec2b9",
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const title = payload.notification?.title || payload.data?.title || 'Blá Blá';
    const body = payload.notification?.body || payload.data?.body || 'Nova mensagem recebida';
    const icon = payload.notification?.icon || payload.data?.icon || '/icon-192.png';
    const tag = payload.data?.tag || payload.data?.chatId ? `chat_${payload.data.chatId}` : 'blabla_msg';

    const notificationOptions = {
      body,
      icon,
      badge: '/icon-192.png',
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: {
        ...(payload.data || {}),
        url: payload.data?.url || (payload.data?.chatId ? `/?chat=${encodeURIComponent(payload.data.chatId)}` : '/'),
        chatId: payload.data?.chatId || payload.data?.senderId,
      },
    };

    return self.registration.showNotification(title, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Firebase compat init note:', err);
}

// Direct push listener fallback for raw Web Push or custom FCM payloads
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const raw = event.data.json();
    const title = raw.notification?.title || raw.data?.title || raw.title || 'Blá Blá';
    const body = raw.notification?.body || raw.data?.body || raw.body || 'Nova mensagem';
    const icon = raw.notification?.icon || raw.data?.icon || raw.icon || '/icon-192.png';
    const tag = raw.data?.tag || raw.tag || (raw.data?.chatId ? `chat_${raw.data.chatId}` : 'fcm_push');

    const options = {
      body,
      icon,
      badge: '/icon-192.png',
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: {
        ...(raw.data || raw),
        url: raw.data?.url || (raw.data?.chatId ? `/?chat=${encodeURIComponent(raw.data.chatId)}` : '/'),
        chatId: raw.data?.chatId || raw.data?.senderId,
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Blá Blá', {
        body: text || 'Nova mensagem',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      })
    );
  }
});

// Click handler on notification: opens the app in the corresponding conversation
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const chatId = data.chatId || data.conversationId || data.userId || '';
  const targetUrl = data.url || (chatId ? `/?chat=${encodeURIComponent(chatId)}` : '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and tell it to navigate to the chat
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (chatId) {
            client.postMessage({
              type: 'OPEN_CHAT',
              chatId,
              data,
            });
          }
          return client;
        }
      }
      // If no tab is open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
