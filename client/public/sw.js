self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept or cache API, Vite dev modules, or cache-busted dependencies
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.searchParams.has('v') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts')
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/').then((cached) => cached || fetch(event.request))
      )
    );
    return;
  }
});
