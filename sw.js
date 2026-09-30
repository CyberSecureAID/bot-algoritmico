/* sw.js — SERVICE WORKER DE AUTODESTRUCCIÓN
   El service worker anterior cacheaba de forma agresiva y servía versiones
   viejas del sitio aunque se borrara el caché del navegador, porque él vive
   aparte. Este lo reemplaza: al instalarse, borra TODOS los cachés, se
   desregistra a sí mismo y recarga las pestañas. Después, el navegador va
   siempre directo a la red, sin intermediario que sirva copias viejas. */

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      // borrar TODOS los cachés que existan
      const nombres = await caches.keys();
      await Promise.all(nombres.map((n) => caches.delete(n)));
    } catch (_) {}
    try {
      // tomar control de las pestañas abiertas
      await self.clients.claim();
      // recargar cada pestaña una vez, para que traigan todo fresco
      const clientes = await self.clients.matchAll({ type: 'window' });
      clientes.forEach((c) => { try { c.navigate(c.url); } catch (_) {} });
    } catch (_) {}
    try {
      // desregistrarse a sí mismo: a partir de ahora no hay service worker
      await self.registration.unregister();
    } catch (_) {}
  })());
});

// Mientras exista, NO cachea nada: todo va directo a la red.
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => new Response('', { status: 504 })));
});
