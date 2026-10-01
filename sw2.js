/* sw.js — caché rápida con actualización en segundo plano.
   Estrategia stale-while-revalidate: sirve al instante desde caché (rápido) y
   a la vez descarga la versión nueva en segundo plano para la próxima vez. Los
   HTML van primero por red (para que los cambios de estructura lleguen ya), con
   la caché como respaldo si no hay conexión. Así: carga rápido Y se actualiza. */
const VERSION = 'aurex-v439';
const CACHE = 'cc-' + VERSION;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // borrar cachés de versiones anteriores
    const ns = await caches.keys();
    await Promise.all(ns.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // solo cacheamos lo de nuestro propio dominio
  if (url.origin !== location.origin) return;

  // Los documentos HTML: primero red (cambios llegan ya), caché como respaldo.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, r.clone()).catch(() => {});
        return r;
      } catch (_) {
        return (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  // El resto (JS, CSS, imágenes): stale-while-revalidate.
  // Sirve de caché al instante (rápido) y actualiza en segundo plano.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const red = fetch(req).then((r) => {
      if (r && r.ok) cache.put(req, r.clone()).catch(() => {});
      return r;
    }).catch(() => null);
    return cached || (await red) || Response.error();
  })());
});
