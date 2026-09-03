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

// Handle push events (Wakes up mobile device when app is completely closed)
self.addEventListener('push', (event) => {
  let title = 'Blá Blá';
  let body = 'Nova mensagem recebida';
  let icon = '/icon-192.png';
  let tag = 'blabla_msg';
  let data = {};

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.title) title = payload.title;
      if (payload.body) body = payload.body;
      if (payload.icon) icon = payload.icon;
      if (payload.data) data = payload.data;
      if (payload.tag) tag = payload.tag;
      else if (data?.conversationId) tag = `chat_${data.conversationId}`;
    } catch (e) {
      try {
        body = event.data.text() || body;
      } catch (textErr) {}
    }
  }

  const options = {
    body,
    icon,
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag,
    renotify: true,
    data,
  };

  const showPromise = self.registration.showNotification(title, options).catch((err) => {
    console.error('ServiceWorker showNotification primary failed, retrying with fallback:', err);
    return self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icon-192.png',
    });
  });

  if (data?.messageId) {
    const ackPromise = fetch('/api/messages/delivered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: data.messageId,
        conversationId: data.conversationId,
      }),
    }).catch(() => {});

    event.waitUntil(Promise.all([showPromise, ackPromise]));
  } else {
    event.waitUntil(showPromise);
  }
});
