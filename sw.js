/* sw.js — Service worker mínimo SIN caché.
   Tras los problemas de versiones viejas servidas desde caché, este sw no
   guarda nada: todo va siempre directo a la red. Así los cambios que se suban
   se ven siempre, sin trucos. Se puede añadir caché más adelante, con cuidado. */
const VERSION = 'aurex-v424-nocache';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try { const ns = await caches.keys(); await Promise.all(ns.map(n => caches.delete(n))); } catch (_) {}
    try { await self.clients.claim(); } catch (_) {}
  })());
});
self.addEventListener('fetch', (e) => {
  // todo directo a la red; si no hay red, intenta caché (vacío casi siempre)
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
