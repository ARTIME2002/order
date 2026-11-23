/* ARTIME service worker - app shell + catalog + images work offline after first visit */
const VER = 'artime-v6';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'customer.js', 'manifest.webmanifest', 'icons/icon-192.png'];
const IMG_CACHE = VER + '-img';
const MAX_IMGS = 300;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => !k.startsWith(VER)).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_IMGS) for (const k of keys.slice(0, keys.length - MAX_IMGS)) await cache.delete(k);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('admin')) return;            // never touch the admin panel

  // Catalog data: network first, cached copy when offline
  if (url.pathname.endsWith('/catalog')) {
    e.respondWith(fetch(req).then(r => {
      const copy = r.clone(); caches.open(VER).then(c => c.put(req, copy)); return r;
    }).catch(() => caches.match(req)));
    return;
  }
  // Photos + PDF library: cache first
  if (/\.(jpe?g|png|webp|gif|svg)$/i.test(url.pathname) || url.hostname === 'cdnjs.cloudflare.com') {
    e.respondWith(caches.open(IMG_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r && (r.ok || r.type === 'opaque')) { c.put(req, r.clone()); trim(c); }
        return r;
      } catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  // App files: network first (always latest), cached copy only when offline
  if (url.origin === location.origin) {
    e.respondWith(caches.open(VER).then(async c => {
      try {
        const r = await fetch(req.url, { cache: 'no-cache' });
        if (r && r.ok) c.put(req, r.clone());
        return r;
      } catch (err) {
        return (await c.match(req, { ignoreSearch: true })) || Response.error();
      }
    }));
  }
});
