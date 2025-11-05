const CACHE_NAME = 'financeflow-pro-cache-v4'; // Incremented version
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  // It's better not to cache the CDN script itself, but let the browser handle it.
  // Caching opaque responses (like from CDNs) can fill up storage quickly.
  // The main benefit is caching the app shell.
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET') {
        return;
    }
  
    // For navigation requests, always try the network first, then fall back to cache.
    // This ensures users get the latest HTML.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('./index.html'))
        );
        return;
    }

    // For other requests (CSS, JS, images), use a cache-first strategy.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then(networkResponse => {
                // Clone the response to cache it
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    // Only cache successful responses that are not opaque (to avoid storage bloat from CDNs)
                    if (networkResponse.ok && networkResponse.type !== 'opaque') {
                        cache.put(event.request, responseToCache);
                    }
                });
                return networkResponse;
            });
        })
    );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});