// Blá Blá - Service Worker for WhatsApp-like Push & System Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle direct messages from app (e.g. test notification when app is minimized/locked)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title || 'Blá Blá', {
      body: options?.body || 'Nova mensagem recebida',
      icon: options?.icon || '/icon-192.png',
      badge: '/icon-192.png',
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
      if (payload.icon && !payload.icon.startsWith('data:')) icon = payload.icon;
      if (payload.data) data = payload.data;
      if (payload.tag) tag = payload.tag;
      else if (data?.conversationId) tag = `chat_${data.conversationId}`;
    } catch (e) {
      try {
        body = event.data.text() || body;
      } catch (textErr) {}
    }
  }

  // Mobile & iOS Safari friendly options (No unsupported requireInteraction or vibrate inside SW)
  const options = {
    body,
    icon,
    badge: '/icon-192.png',
    tag,
    renotify: true,
    data,
  };

  // Apple APNs requires immediate presentation. Never delay or block showNotification!
  const showPromise = self.registration.showNotification(title, options).catch((err) => {
    console.error('ServiceWorker showNotification failed, retrying with fallback:', err);
    return self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icon-192.png',
    });
  });

  // Background ACK without delaying notification presentation
  if (data?.messageId) {
    fetch('/api/messages/delivered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: data.messageId,
        conversationId: data.conversationId,
      }),
    }).catch(() => {});
  }

  event.waitUntil(showPromise);
});

// Notification click handler: opens the app in the corresponding conversation
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const chatId = data.chatId || data.conversationId || '';
  const targetUrl = chatId ? `/?chat=${encodeURIComponent(chatId)}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and tell the app to open the chat
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (chatId) {
            client.postMessage({
              type: 'OPEN_CONVERSATION',
              conversationId: chatId,
              chatId,
              data,
            });
          }
          return client;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

