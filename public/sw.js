// Vistoosa Robust Service Worker for Mobile PWA & Offline Stability
const CACHE_NAME = 'vistoosa-mobile-v10';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip API requests and non-GET requests entirely
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // For HTML navigation, JS, or CSS bundles, use Network-First with cache fallback
  // This prevents mobile browsers from getting stuck in an infinite reload loop due to stale chunk hashes after deployments
  if (event.request.mode === 'navigate' || url.pathname.match(/\.(js|css|html)$/)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/');
          }
        })
    );
    return;
  }

  // For images and static static assets, use Cache-First with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(async () => {
        if (event.request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico)$/i)) {
          return caches.match('/vistoosa-logo.png') || caches.match('/icon.svg');
        }
      });
    })
  );
});
