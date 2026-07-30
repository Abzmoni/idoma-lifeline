const CACHE_NAME = 'idoma-lifeline-cache-v1';
const TILES_CACHE_NAME = 'idoma-lifeline-map-tiles';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Pre-cache warning (some files might be generated during build):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== TILES_CACHE_NAME) {
            console.log('SW: Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. Cache-first strategy for Map Tiles (OpenStreetMap)
  if (requestUrl.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILES_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fetch from network and cache
          return fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => {
            // Offline fallback - empty transparent tile or generic cached tile
            return new Response('');
          });
        });
      })
    );
    return;
  }

  // 2. Ignore non-GET requests or backend APIs (handled client-side with IndexedDB fallbacks)
  if (event.request.method !== 'GET' || requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  // 3. Network-First, falling back to cache for standard pages/assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If offline and request is for navigation page, return root /index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
