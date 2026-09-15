const CACHE = 'pixel-canvas-v9';
const ASSETS = [
    './',
    './index.html',
    './js/app.js',
    './js/storage.js',
    './js/gif-encoder.js',
    './icon.jpeg',
    './manifest.webmanifest'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE).then(function (cache) {
            return cache.addAll(ASSETS);
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.filter(function (key) {
                return key !== CACHE;
            }).map(function (key) {
                return caches.delete(key);
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) return cached;
            return fetch(event.request).then(function (res) {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(function (cache) {
                        cache.put(event.request, copy);
                    });
                }
                return res;
            }).catch(function () {
                return caches.match('./index.html');
            });
        })
    );
});
