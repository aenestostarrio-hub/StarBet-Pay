// StarBetPay - Advanced Progressive Web App Service Worker
const CACHE_NAME = 'starbetpay-cache-v2';
const OFFLINE_URL = '/index.html';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/starbetpay_icon.jpg'
];

// Install Event - Pre-cache necessary files
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).then(() => {
        console.log('[Service Worker] Static assets cached successfully');
      });
    }).catch((err) => {
      console.warn('[Service Worker] Pre-caching warning:', err);
    })
  );
});

// Activate Event - Clean up stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Cleaning old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Hybrid strategy (Network-First with Cache Fallback for dynamic logic, Cache-First for static)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Avoid intercepting non-GET requests, Cloud APIs, or Firebase flows
  if (req.method !== 'GET' || url.pathname.startsWith('/api') || url.hostname.includes('firestore') || url.hostname.includes('firebase')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in background to keep cache warm and updated
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
          }
        }).catch(() => { /* silent handle offline */ });

        return cachedResponse;
      }

      return fetch(req).catch(() => {
        // Safe offline experience
        if (req.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Connexion internet requise pour charger cette ressource.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
        });
      });
    })
  );
});

// Broadcast System Updates for instant UI auto-refresh
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Remote Push Notification Handler (FCM & Firebase Architecture support)
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
    vibrate: [200, 100, 200, 100, 300],
    data: {
      url: payload.url || '/'
    },
    actions: [
      { action: 'open', title: 'Ouvrir l\'application' },
      { action: 'close', title: 'Fermer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// App Notification Interaction Rules
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickUrl = event.notification.data?.url || '/';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      // Focus existing tab if open
      const matchingClient = clientsArr.find((c) => {
        return new URL(c.url).pathname === new URL(clickUrl, self.location.origin).pathname;
      });

      if (matchingClient) {
        return matchingClient.focus();
      }

      // Open fresh window if none open
      if (self.clients.openWindow) {
        return self.clients.openWindow(clickUrl);
      }
    })
  );
});
