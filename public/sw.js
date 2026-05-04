
// RetroBliss Service Worker for Push Notifications & PWA
const CACHE_NAME = 'retrobliss-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'RetroBliss', body: 'You have a new notification' };
  try {
    data = event.data ? event.data.json() : data;
  } catch (e) {
    data.body = event.data ? event.data.text() : data.body;
  }

  const options = {
    body: data.body,
    icon: '/retrobliss-icon.jpg',
    badge: '/retrobliss-icon.jpg',
    vibrate: [200, 100, 200, 100, 200],
    data: data,
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    tag: data.tag || 'retrobliss-notification',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (windowClients.length > 0) {
        return windowClients[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
