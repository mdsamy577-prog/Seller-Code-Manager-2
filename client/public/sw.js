const CACHE_NAME = 'seller-code-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll warning (non-fatal):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept API requests, authentication, non-GET methods, or dev tools
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.searchParams.has('v') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts')
  ) {
    return;
  }

  // HTML Page Navigation: Network-first with offline fallback to cached SPA shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If valid response, update cache in background
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const rootFallback = await caches.match('/index.html') || await caches.match('/');
          if (rootFallback) return rootFallback;
          return new Response('Offline - No connection available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Static Assets (Images, Icons, Fonts, Bundles): Cache-first with network fallback
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Return cached asset, fetch update in background (stale-while-revalidate)
          fetch(event.request)
            .then((fresh) => {
              if (fresh && fresh.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, fresh));
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});
