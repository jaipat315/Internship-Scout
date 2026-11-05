const CACHE = 'scout-static-v1';
const ASSETS = ['./','./index.html','./assets/style.css','./assets/app.js','./assets/icon.svg','./data/listings.js','./manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/data/listings.json') || url.pathname.endsWith('/data/latest_digest.json') || url.pathname.endsWith('/data/listings.js')) {
    event.respondWith(fetch(event.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return r;}).catch(()=>caches.match(event.request))); return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached || fetch(event.request)));
});
