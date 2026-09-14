/* Service worker template. The build writes dist/sw.js from this file; edit here, not in dist. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `shell-${VERSION}`;

const scoped = (path) => new URL(path, self.registration.scope).href;
const PRECACHE_URLS = new Set(PRECACHE.map(scoped));
const APP_ROOT = scoped('./');

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    [...PRECACHE_URLS].map(async (url) => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error(`Precache failed for ${url}`);
      // A redirected response cannot answer a navigation, so store a clean copy.
      const clean = response.redirected
        ? new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers })
        : response;
      await cache.put(url, clean);
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('shell-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Only the app's own files are served from cache. Model traffic and every other origin go straight to the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Cache first: the shell opens instantly and works offline. A new deploy ships a new sw.js, which refreshes the cache.
    event.respondWith(caches.match(APP_ROOT).then((hit) => hit || fetch(request)));
    return;
  }

  const key = url.origin + url.pathname;
  if (!PRECACHE_URLS.has(key)) return;
  event.respondWith(caches.match(key).then((hit) => hit || fetch(request)));
});
