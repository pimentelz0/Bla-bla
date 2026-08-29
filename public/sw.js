// Blá Blá - Service Worker for WhatsApp-like Push & System Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const conversationId = event.notification.data?.conversationId;
  const targetUrl = conversationId ? `/?chat=${conversationId}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post a message to open conversation
      for (const client of clientList) {
        if ('focus' in client) {
          if (conversationId) {
            client.postMessage({
              type: 'OPEN_CONVERSATION',
              conversationId: conversationId,
            });
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});

// Handle direct messages from app (e.g. test notification when app is minimized/locked)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title || 'Blá Blá', {
      body: options?.body || 'Nova mensagem recebida',
      icon: options?.icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: options?.tag || 'blabla-msg',
      renotify: true,
      data: options?.data || {},
    });
  } else if (event.data?.type === 'SCHEDULE_NOTIFICATION') {
    const delay = event.data.delayMs || 5000;
    const { title, options } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title || 'Blá Blá', {
        body: options?.body || 'Nova mensagem recebida',
        icon: options?.icon || '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: options?.tag || 'blabla-msg',
        renotify: true,
        data: options?.data || {},
      });
    }, delay);
  }
});

// Handle push events if configured
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'Blá Blá';
    const options = {
      body: payload.body || 'Nova mensagem recebida',
      icon: payload.icon || '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: payload.tag || 'blabla-message',
      renotify: true,
      data: payload.data || {},
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error in push event handler:', err);
  }
});
