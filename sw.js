const CACHE_NAME = 'chromechat-release-img';

const BASE = self.location.pathname.replace(/\/sw\.js$/, '');

const ASSETS = [
    BASE + '/',
    BASE + '/index.html',
    BASE + '/styles.css',
    BASE + '/manifest.json',
    BASE + '/404.html',
    BASE + '/icons/icon.svg',
    BASE + '/icons/dinosaur.svg',
    BASE + '/icons/chromeChatLogo.svg',
    BASE + '/icons/copyIcon.svg',
    BASE + '/icons/fileIcon.svg',
    BASE + '/icons/documentIcon.svg',
    BASE + '/icons/downloadIcon.svg',
    BASE + '/highlight.min.css',
    BASE + '/js/lib/marked.umd.js',
    BASE + '/js/lib/highlight.min.js',
    BASE + '/js/lib/purify.min.js',
    BASE + '/js/lib/pdf.min.mjs',
    BASE + '/js/lib/pdf.worker.min.mjs',
    BASE + '/js/main.js',
    BASE + '/js/model.js',
    BASE + '/js/send.js',
    BASE + '/js/render.js',
    BASE + '/js/chat.js',
    BASE + '/js/files.js',
    BASE + '/js/ui.js',
    BASE + '/js/state.js',
    BASE + '/js/dom.js',
    BASE + '/js/db.js',
    BASE + '/js/settings.js',
    BASE + '/js/portability.js',
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (k) { return k !== CACHE_NAME; })
                    .map(function (k) { return caches.delete(k); })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', function (event) {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) return cached;

            return fetch(event.request).then(function (response) {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(function () {
                if (event.request.destination === 'document') {
                    return caches.match(BASE + '/index.html');
                }
            });
        })
    );
});
