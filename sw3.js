/* sw3.js — caché rápida (cache-first) que se actualiza sin pantalla blanca.
   · skipWaiting: el service worker nuevo se activa en cuanto se instala, para
     la PRÓXIMA navegación. NO usa clients.claim, así que NO toma control de la
     página que está cargando ahora → no la interrumpe → no hay pantalla blanca.
   · cache-first: sirve del caché al instante (rápido). Una versión nueva (?v=
     distinto) se descarga una vez. Al activarse, borra el caché viejo.
   · HTML (navegaciones): NO se tocan, para que la wallet inyecte window.ethereum. */
const VERSION = 'aurex-v452';
const CACHE = 'cc-' + VERSION;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ns = await caches.keys();
    await Promise.all(ns.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    // NO clients.claim: no interrumpimos la página en curso.
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate' || req.destination === 'document') return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const r = await fetch(req);
      if (r && r.ok) cache.put(req, r.clone()).catch(() => {});
      return r;
    } catch (_) {
      return Response.error();
    }
  })());
});
