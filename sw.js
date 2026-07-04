/* UCJC Admin — service worker
   Intentionally minimal: this console always wants live Firestore
   data, so we only cache the static app shell (this file's own
   host document) for fast repeat loads / basic offline resilience,
   and let every Firebase/Google Calendar network request pass
   straight through uncached. */
const CACHE_NAME = 'ucjc-admin-shell-v2';
const SHELL_URLS = ['/', '/index.html', '/manifest.json', '/logo.png', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin navigations/static shell files; everything
  // else (Firestore, Auth, Google Calendar, Chart.js CDN) goes straight
  // to the network so the dashboard is never looking at stale data.
  if (url.origin !== self.location.origin) return;
  if (!SHELL_URLS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return resp;
      })
    ).catch(() => caches.match('/index.html'))
  );
});
