// Replaced by the production build with the exact emitted asset list.
const VERSION = 'lifeline-__BUILD_ID__';
const ASSETS = /* __PRECACHE__ */ ['/', '/index.html', '/manifest.json', '/favicon.svg'];
const TILES = 'lifeline-visited-tiles-v2';
// Google Fonts (text and the Material Symbols icon font). Without these offline, icons render as raw words.
const FONTS = 'lifeline-fonts-v1';
// The offline map file (saved by the page, see src/offlineMap.js). Kept across app updates.
const MAP = 'lifeline-offline-map';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if ((key.startsWith('lifeline-') || key.startsWith('idoma-lifeline-')) && key !== VERSION && key !== TILES && key !== FONTS && key !== MAP) await caches.delete(key);
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
// The map library reads the map file in small byte ranges. Serve those from the saved copy when there is
// one (offline or not: it is faster and costs no data). The file name is dated and never changes, so
// version tags are dropped to keep saved and network copies interchangeable.
let mapFile = null; // { url, blob }
async function savedMap(url) {
  if (mapFile?.url === url) return mapFile.blob;
  const saved = await (await caches.open(MAP)).match(url);
  if (!saved) return null;
  mapFile = { url, blob: await saved.blob() };
  return mapFile.blob;
}
function withoutVersionTags(response) {
  const headers = new Headers(response.headers);
  headers.delete('ETag'); headers.delete('Last-Modified');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
async function mapResponse(request) {
  const url = new URL(request.url); url.search = '';
  const blob = await savedMap(url.href);
  if (!blob) return withoutVersionTags(await fetch(request));
  const range = /bytes=(\d+)-(\d*)/.exec(request.headers.get('Range') || '');
  if (!range) return new Response(blob, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(blob.size), 'Accept-Ranges': 'bytes' } });
  const start = Number(range[1]), end = Math.min(range[2] ? Number(range[2]) : blob.size - 1, blob.size - 1);
  if (start >= blob.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  return new Response(blob.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${start}-${end}/${blob.size}`,
    'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
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
  if (url.pathname.startsWith('/map/') && url.pathname.endsWith('.pmtiles')) { event.respondWith(mapResponse(event.request)); return; }
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (event.request.mode === 'navigate') return await cache.match('/index.html') || fetch(event.request);
    return await cache.match(event.request) || fetch(event.request);
  })());
});
