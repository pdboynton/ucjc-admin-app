/* ══════════════════════════════════════════════════════════════
   UCJC ADMIN CONSOLE — Service Worker
   Strategy:
     • App shell (HTML, fonts) → Network-first with cache fallback
     • Static assets (logo, icons) → Cache-first
     • Firebase / Google API calls → Network-only (always fresh)
     • Everything else → Network-first with cache fallback
══════════════════════════════════════════════════════════════ */

const CACHE_NAME    = 'ucjc-admin-v1';
const SHELL_CACHE   = 'ucjc-admin-shell-v1';
const STATIC_CACHE  = 'ucjc-admin-static-v1';

/* Resources to pre-cache on install */
const SHELL_ASSETS = [
  './index.html',
  './admin-manifest.json'
];

const STATIC_ASSETS = [
  './logo.png'
];

/* ── INSTALL ───────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then(cache =>
        cache.addAll(SHELL_ASSETS).catch(err =>
          console.warn('[SW Admin] Shell pre-cache error:', err)
        )
      ),
      caches.open(STATIC_CACHE).then(cache =>
        cache.addAll(STATIC_ASSETS).catch(err =>
          console.warn('[SW Admin] Static pre-cache error:', err)
        )
      )
    ]).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ──────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  const validCaches = [CACHE_NAME, SHELL_CACHE, STATIC_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('ucjc-admin-') && !validCaches.includes(key))
          .map(key => {
            console.log('[SW Admin] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH ─────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* 1. Always skip non-GET requests */
  if (request.method !== 'GET') return;

  /* 2. Network-only for Firebase, Google APIs, and auth flows */
  if (
    url.hostname.includes('firebaseio.com')       ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')     ||
    url.hostname.includes('googleapis.com')       ||
    url.hostname.includes('gstatic.com')          ||
    url.hostname.includes('google.com')           ||
    url.hostname.includes('accounts.google.com')  ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    /* For Google Fonts specifically, try network then fall back to cache */
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
      event.respondWith(networkFirstWithCache(request, CACHE_NAME));
    }
    /* All other Google/Firebase calls: strict network-only */
    return;
  }

  /* 3. Static assets (logo, icons, images) → cache-first */
  if (
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  /* 4. App shell HTML → network-first with cache fallback */
  if (
    request.destination === 'document' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/')
  ) {
    event.respondWith(networkFirstWithCache(request, SHELL_CACHE));
    return;
  }

  /* 5. Everything else → network-first */
  event.respondWith(networkFirstWithCache(request, CACHE_NAME));
});

/* ── STRATEGIES ────────────────────────────────────────────── */

/**
 * Network-first: try network, cache on success,
 * fall back to cache if network fails.
 */
async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    /* If we have no cache and it's a navigation, return the shell */
    if (request.destination === 'document') {
      const shell = await caches.match('./admin.html');
      if (shell) return shell;
    }
    return new Response('Offline — no cached version available.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * Cache-first: serve from cache immediately,
 * update cache in background if network available.
 */
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    /* Background refresh */
    fetch(request).then(res => {
      if (res && res.status === 200) cache.put(request, res);
    }).catch(() => {});
    return cached;
  }
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    return new Response('Asset unavailable offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/* ── PUSH NOTIFICATIONS ────────────────────────────────────── */
self.addEventListener('push', event => {
  let data = { title: 'UCJC Admin', body: 'You have a new admin alert.' };
  try {
    if (event.data) data = event.data.json();
  } catch(e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body:    data.body    || '',
    icon:    './logo.png',
    badge:   './logo.png',
    tag:     data.tag     || 'ucjc-admin-notif',
    data:    data.url     || './admin.html',
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: 'Open Console' },
      { action: 'dismiss', title: 'Dismiss'       }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'UCJC Admin Console',
      options
    )
  );
});

/* ── NOTIFICATION CLICK ────────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data || './admin.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      /* Focus existing open window if possible */
      for (const client of clientList) {
        if (client.url.includes('admin') && 'focus' in client) {
          return client.focus();
        }
      }
      /* Otherwise open a new window */
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

/* ── BACKGROUND SYNC (optional future use) ─────────────────── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-admin-data') {
    event.waitUntil(
      /* Placeholder: could re-try failed Firestore writes here */
      Promise.resolve()
    );
  }
});

console.log('[SW Admin] Service worker loaded —', CACHE_NAME);
