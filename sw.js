// sw.js — service worker: кеш оболонки для офлайну (працює лише по http/https).
// VERSION має збігатися з ?v=N в index.html. Підняв число — старий кеш чиститься,
// а js/css підтягуються свіжими (бо змінюється і назва кешу, і URL із ?v=).
var VERSION = '12';
var CACHE = 'farkle-v' + VERSION;
var Q = '?v=' + VERSION;
var ASSETS = [
  './', './index.html', './css/styles.css' + Q,
  './js/scoring.js' + Q, './js/sound.js' + Q, './js/store.js' + Q, './js/i18n.js' + Q,
  './js/net.js' + Q, './js/ai.js' + Q,
  './js/game.js' + Q, './js/ui.js' + Q, './js/tests.js' + Q, './js/main.js' + Q,
  './fonts/farkle-logo.woff2',
  './manifest.webmanifest', './favicon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // Рейтинг — динамічний: завжди з мережі, не кешуємо (інакше показуватиме старе).
  if (e.request.url.indexOf('/api/') !== -1 || e.request.url.indexOf('/data/') !== -1) return;
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { try { c.put(e.request, copy); } catch (err) {} });
        return resp;
      }).catch(function () { return cached; });
    })
  );
});
