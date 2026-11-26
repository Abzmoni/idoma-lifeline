// Replaced by the production build with the exact emitted asset list.
const VERSION = 'lifeline-__BUILD_ID__';
const ASSETS = /* __PRECACHE__ */ ['/', '/index.html', '/manifest.json', '/favicon.svg'];
const TILES = 'lifeline-visited-tiles-v2';
// Google Fonts (text and the Material Symbols icon font). Without these offline, icons render as raw words.
const FONTS = 'lifeline-fonts-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if ((key.startsWith('lifeline-') || key.startsWith('idoma-lifeline-')) && key !== VERSION && key !== TILES && key !== FONTS) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
// A network that is "connected" but not answering makes requests hang rather than fail.
// Give up after a few seconds so saved copies are used instead of a blank map or missing icons.
function fetchWithin(request, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}
// Saved copy first (instant, works offline); refresh it in the background when the network answers.
function savedFirst(event, cacheName, store, fallback) {
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const saved = await cache.match(event.request);
    const network = fetchWithin(event.request, 8000).then(async response => {
      if (response.ok || response.type === 'opaque') await store(cache, response.clone());
      return response;
    });
    if (saved) { event.waitUntil(network.catch(() => {})); return saved; }
    try { return await network; } catch { return fallback(); }
  })());
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  if (/^(?:[abc]\.)?tile\.openstreetmap\.org$/.test(url.hostname)) {
    // Cache viewed tiles only; never bulk download.
    savedFirst(event, TILES, async (cache, response) => {
      await cache.put(event.request, response);
      const keys = await cache.keys();
      if (keys.length > 400) await cache.delete(keys[0]);
    }, () => new Response('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e7e8df"/><text x="24" y="128" fill="#65705e" font-size="13">Map area not saved</text></svg>', { headers: { 'Content-Type': 'image/svg+xml' } }));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // Saved copy first so icons never wait on a slow network; updates arrive in the background.
    savedFirst(event, FONTS, (cache, response) => cache.put(event.request, response), () => Response.error());
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (event.request.mode === 'navigate') return await cache.match('/index.html') || fetch(event.request);
    return await cache.match(event.request) || fetch(event.request);
  })());
});
