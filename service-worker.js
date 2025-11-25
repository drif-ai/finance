const CACHE_NAME = 'financeflow-pro-cache-v4';
const BASE = '/finance/';

const urlsToCache = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Opened cache and caching app shell');
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(BASE + 'index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(networkResponse => {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          if (networkResponse.ok && networkResponse.type !== 'opaque') {
            cache.put(event.request, clone);
          }
        });
        return networkResponse;
      });
    })
  );
});

self.addEventListener('activate', event => {
  const whitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.map(name => {
          if (!whitelist.includes(name)) {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      )
    )
  );
});
