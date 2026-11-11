const CACHE_VERSION = 'habistride-v2.0.0-1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './src/main.js',
  './src/app.js',
  './src/constants.js',
  './src/dates.js',
  './src/backup.js',
  './src/demo.js',
  './src/ics.js',
  './src/icons.js',
  './src/schedule.js',
  './src/schema.js',
  './src/stats.js',
  './src/storage.js',
  './src/store.js',
  './src/toast.js',
  './src/views/today.js',
  './src/views/calendar.js',
  './src/views/insights.js',
  './src/dialogs/confirm.js',
  './src/dialogs/day.js',
  './src/dialogs/habit.js',
  './src/dialogs/onboarding.js',
  './src/dialogs/settings.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          const navCopy = request.mode === 'navigate' ? response.clone() : null;
          event.waitUntil(
            caches.open(CACHE_VERSION).then(cache => {
              const writes = [cache.put(request, copy)];
              if (navCopy) writes.push(cache.put('./index.html', navCopy));
              return Promise.all(writes);
            })
          );
          return response;
        }

        return caches.match(request).then(cached => cached || response);
      })
      .catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('./index.html').then(response => response || caches.match('./'));
        }
        return caches.match(request);
      })
  );
});
