/* sw.js — caché rápida con actualización en segundo plano.
   Estrategia stale-while-revalidate: sirve al instante desde caché (rápido) y
   a la vez descarga la versión nueva en segundo plano para la próxima vez. Los
   HTML van primero por red (para que los cambios de estructura lleguen ya), con
   la caché como respaldo si no hay conexión. Así: carga rápido Y se actualiza. */
const VERSION = 'aurex-v441';
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

  // Las NAVEGACIONES (HTML) NO las toca el service worker: las carga el navegador
  // por su vía normal. Motivo: los navegadores de wallets (Trust, MetaMask)
  // inyectan window.ethereum interceptando la carga del HTML, y si el service
  // worker responde él mismo, esa intercepción no ocurre y la wallet no aparece.
  if (req.mode === 'navigate' || req.destination === 'document') return;

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
