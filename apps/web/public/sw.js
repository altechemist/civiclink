/* CivicLink service worker (FR-34): installable app shell that opens without a connection.
 * Navigations: network-first, falling back to the cached shell. Hashed build assets: cache-first.
 * Map tiles (NFR-13): stale-while-revalidate in a separate, size-capped cache, so maps of areas already
 * viewed still show offline. The API and Firebase are never cached here (Firestore keeps its own offline cache). */
const VERSION = 'civiclink-v2';
const TILES = 'civiclink-tiles-v1';
const MAX_TILES = 400; // about 10 MB of 256 px PNG tiles
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Removes the oldest tiles once the cache is over its cap (Cache keys keep insertion order). */
async function trimTiles() {
  const cache = await caches.open(TILES);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_TILES)).map((k) => cache.delete(k)));
}

function tile(event) {
  const req = event.request;
  event.respondWith(
    caches.open(TILES).then(async (cache) => {
      const hit = await cache.match(req);
      const refresh = fetch(req)
        .then(async (res) => {
          // Only CORS (non-opaque) responses are stored: opaque ones cost several MB of quota each.
          if (res.ok && res.type === 'cors') {
            await cache.put(req, res.clone());
            await trimTiles();
          }
          return res;
        })
        .catch(() => hit || Response.error());
      if (hit) {
        event.waitUntil(refresh);
        return hit;
      }
      return refresh;
    }),
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method === 'GET' && url.hostname.endsWith('tile.openstreetmap.org')) return tile(event);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

/* FR-24 web push. The server sends data-only FCM messages ({title, body, link}); this worker shows
 * them, so no Firebase script has to be loaded here. Clicking opens (or focuses) the linked screen. */
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const data = payload.data || payload;
  const title = data.title || 'CivicLink';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.link || 'civiclink',
      data: { link: data.link || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const existing = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (existing) {
        existing.navigate(link);
        return existing.focus();
      }
      return self.clients.openWindow(link);
    }),
  );
});
