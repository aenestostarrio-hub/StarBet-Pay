// StarBetPay - Progressive Web App Service Worker
const CACHE_NAME = 'starbetpay-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/starbetpay_icon.jpg'
];

// Perform install and cache elementary files
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Elementary caching bypassed in dev mode:', err);
      });
    })
  );
});

// Activate handler
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Custom fetch event handler (passing through for normal server/cloud routes)
self.addEventListener('fetch', (event) => {
  // Pass through everything to ensure Firebase and local REST APIs run cleanly
  return;
});

// LISTEN TO INCOMING REMOTE PUSH NOTIFICATIONS
self.addEventListener('push', (event) => {
  let payload = {
    title: 'StarBetPay 🌟',
    body: 'Nouvelle notification importante de StarBetPay !',
    icon: '/starbetpay_icon.jpg',
    url: '/'
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (err) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/starbetpay_icon.jpg',
    badge: '/starbetpay_icon.jpg',
    vibrate: [150, 100, 150],
    data: {
      url: payload.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// HANDLE NOTIFICATION CLICK ACTION
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      // If a window is already open, focus it
      const matchingClient = clientsArr.find((c) => {
        return new URL(c.url).pathname === new URL(clickUrl, self.location.origin).pathname;
      });

      if (matchingClient) {
        return matchingClient.focus();
      }

      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(clickUrl);
      }
    })
  );
});
