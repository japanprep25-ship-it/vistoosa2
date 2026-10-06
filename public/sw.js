// Vistoosa Service Worker for PWA Caching & Full Offline Operations
const CACHE_NAME = 'vistoosa-cache-v7';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo_white.png',
  '/logo_transparent.png',
  '/vistoosa-logo.png',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/maskable-icon-512x512.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
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
  // Only handle GET requests for same origin or static assets, skip API requests
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      
      return fetch(event.request).catch(async () => {
        // Offline Fallback for Images and Logo
        if (event.request.destination === 'image' || event.request.url.match(/\.(png|jpg|jpeg|svg|webp|ico)$/i)) {
          const logoFallback = await caches.match('/vistoosa-logo.png') || await caches.match('/icon.svg') || await caches.match('/apple-touch-icon.png');
          if (logoFallback) return logoFallback;
        }
        // Offline Fallback for HTML documents
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
