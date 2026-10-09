/* sw.js — caché rápida (cache-first) que respeta las versiones (?v=).
   · Cada archivo se cachea por su URL COMPLETA (incluido el ?v=). Se sirve del
     caché al instante, sin esperar a la red: por eso la carga es rápida.
   · Al subir una versión (?v=13 → ?v=14), la URL cambia, el caché no la tiene,
     y se descarga la nueva UNA vez. Así los cambios se ven sin ralentizar nada.
   · Al cambiar VERSION, se borra todo el caché viejo (las URLs ?v= anteriores).
   · HTML (navegaciones): el service worker NO los toca, para que los navegadores
     de wallets inyecten window.ethereum al cargar la página. */
const VERSION = 'aurex-v462';
const CACHE = 'cc-' + VERSION;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ns = await caches.keys();
    await Promise.all(ns.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // solo nuestro propio dominio
  if (url.origin !== location.origin) return;

  // HTML (navegaciones): no se tocan (para que la wallet inyecte window.ethereum).
  if (req.mode === 'navigate' || req.destination === 'document') return;

  // El resto (JS, CSS, imágenes): CACHE-FIRST.
  // Si está en caché, se sirve al instante (rápido). Si no (p.ej. una versión
  // nueva con ?v= distinto), se va a la red una vez y se guarda.
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
