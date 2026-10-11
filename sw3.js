/* Service Worker NETWORK-ONLY — sin cache.
   No cachea NADA: cada peticion va directa a la red, siempre la version fresca
   (respetando el ?v= y el cache HTTP normal del navegador). Se acabo el problema
   de archivos viejos servidos por el Service Worker.
   Se mantiene registrado solo para que la PWA siga siendo instalable
   ("Install app"). Al ACTIVARSE borra TODAS las caches viejas que quedaron de
   las versiones cache-first anteriores. */
const VERSION = 'netonly-1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ns = await caches.keys();
    await Promise.all(ns.map((n) => caches.delete(n)));   // borra TODO el cache viejo
    await self.clients.claim();                            // toma control de inmediato
  })());
});

/* Handler de fetch PASIVO a proposito: NO llamamos a respondWith, asi que el
   navegador resuelve cada peticion por la red (con su cache HTTP y el ?v=).
   Su sola presencia mantiene la instalabilidad de la PWA. Nunca cachea. */
self.addEventListener('fetch', () => {});
