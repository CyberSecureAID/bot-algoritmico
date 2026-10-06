/* sw.js — caché rápida respetando las versiones (?v=).
   · Archivos con ?v= (versión): PRIMERO la red, para que al subir una versión
     nueva se vea al instante, no la copia vieja del caché.
   · Archivos sin versión: stale-while-revalidate (caché rápido + actualiza).
   · HTML (navegaciones): el service worker no los toca, para que los navegadores
     de wallets inyecten window.ethereum al cargar la página. */
const VERSION = 'aurex-v468';
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

  // Archivos CON ?v= (versión): PRIMERO la red. Así, cuando se sube una versión
  // nueva (?v=13), el navegador trae la versión nueva al instante en vez de la
  // copia vieja del caché. Si no hay red, usa el caché como respaldo.
  const tieneVersion = url.search.includes('v=');
  if (tieneVersion) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r && r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()).catch(() => {}); }
        return r;
      } catch (_) {
        return (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  // El resto (sin versión): stale-while-revalidate (caché rápido + actualiza).
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
