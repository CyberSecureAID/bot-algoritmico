/* sw3.js — caché rápida (cache-first) SIN interrumpir la carga.
   · No usa skipWaiting ni clients.claim: el service worker nuevo se instala en
     silencio y toma el control en la SIGUIENTE carga, sin interrumpir la actual.
     Así se evita la pantalla blanca que causaba tomar control a mitad de carga.
   · Cada archivo se cachea por su URL completa (con ?v=). Se sirve del caché al
     instante (rápido). Una versión nueva (?v= distinto) se descarga una vez.
   · Al activarse, borra el caché de versiones anteriores.
   · HTML (navegaciones): NO se tocan, para que la wallet inyecte window.ethereum. */
const VERSION = 'aurex-v445';
const CACHE = 'cc-' + VERSION;

self.addEventListener('install', () => {
  // NO skipWaiting: esperamos a que las pestañas viejas se cierren. Sin interrupción.
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ns = await caches.keys();
    await Promise.all(ns.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    // NO clients.claim: no tomamos control de la página en curso.
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // HTML (navegaciones): no se tocan (la wallet inyecta window.ethereum al cargar).
  if (req.mode === 'navigate' || req.destination === 'document') return;

  // Resto (JS, CSS, imágenes): cache-first.
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
