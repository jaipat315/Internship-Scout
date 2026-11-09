const CACHE = 'scout-static-v4';
const ASSETS = ['./','./index.html','./assets/style.css','./assets/app.js','./assets/icon.svg','./data/listings.js','./assets/cloud-config.js','./assets/cloud.js','./manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(Promise.all([
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('scout-static-') && key !== CACHE).map(key => caches.delete(key)))),
  self.clients.claim()
])));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/assets/app.js') || url.pathname.endsWith('/assets/cloud.js') || url.pathname.endsWith('/assets/cloud-config.js') || url.pathname.endsWith('/assets/style.css') || url.pathname.endsWith('/data/listings.json') || url.pathname.endsWith('/data/latest_digest.json') || url.pathname.endsWith('/data/listings.js'))) {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
