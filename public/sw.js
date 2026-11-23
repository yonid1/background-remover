// Service worker: makes the app installable and lets it work offline after the first use.
//
// - The page itself (navigation) is network-first, so a new version shows up as soon as it's
//   online, with the cached copy as a fallback when offline.
// - The app's own files are cache-first: their names change with every build.
// - The ISNet model and the AI runtime come from CDNs and are cache-first too, so they're
//   downloaded once. (Transformers.js keeps the BiRefNet model files in its own cache.)

const APP_CACHE = 'app-v1';
const CDN_CACHE = 'cdn-v1';
const CDN_HOSTS = ['staticimgly.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      // The page's own script and styles load before this worker is in control, so they're
      // cached here: read them from index.html (their names change with every build).
      const page = await fetch('./', { cache: 'reload' });
      const html = await page.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await cache.put('./', page);
      await cache.addAll(['./manifest.webmanifest', './icon-192.png', './icon-512.png', './icon.svg', ...assets]);
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        const ours = key.startsWith('app-') || key.startsWith('cdn-');
        if (ours && key !== APP_CACHE && key !== CDN_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(request.mode === 'navigate' ? networkFirst(request) : cacheFirst(request, APP_CACHE));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, CDN_CACHE));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put('./', response.clone());
    return response;
  } catch {
    return (await cache.match('./')) ?? Response.error();
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
