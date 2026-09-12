/* sw.js — Hace que Aurex abra aunque la conexión esté mala o caída.
 *
 * QUÉ HACE Y QUÉ NO
 *   · Guarda una copia de la app (pantalla, código, imágenes) en el teléfono.
 *     Así abre al instante y funciona aunque la red vaya fatal.
 *   · NUNCA guarda datos de la blockchain, precios ni saldos: eso se pide
 *     siempre fresco. Nadie va a ver un saldo viejo por culpa de esto.
 *   · Si hay versión nueva, se descarga sola y se aplica al recargar.
 */

const VERSION = 'aurex-v210';
const APP = [
  './',
  './index.html',              // la portada
  './app.html',                // la app
  './futuros.html',            // sección futuros
  './aportar.html',            // sección aportar liquidez
  './manifest-aurex.webmanifest'
  // El resto (JS, CSS, vendor) se cachea al vuelo con su URL versionada
  // real cuando la página los pide. Así nunca se guarda una versión que ya
  // no existe, que era lo que dejaba servir archivos viejos.
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    // Uno a uno: si falta alguno, no tumba la instalación entera.
    await Promise.all(APP.map((u) => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Fuera TODO lo guardado de versiones anteriores.
    const claves = await caches.keys();
    await Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();

    /* Avisar a las pestañas de que hay versión nueva ACTIVA. La página
       decide si recargar (app.html lo hace una sola vez). Así basta una
       recarga en vez de dos, y sin el pestañazo del viejo p.navigate():
       es la página quien controla el momento, no el SW a la fuerza. */
    const clientes = await self.clients.matchAll({ type: 'window' });
    clientes.forEach((c) => c.postMessage({ tipo: 'sw-activado', version: VERSION }));
  })());
});

/* Nada de esto se guarda: siempre tiene que venir fresco. */
const NUNCA_GUARDAR = [
  'api.binance.com', 'bsc-dataseed', 'rpc.ankr', 'publicnode', '1rpc.io',
  'defibit.io', 'ninicoin.io', 'coingecko', 'nominatim', 'workers.dev',
  'bscscan', 'pancakeswap'
];

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (NUNCA_GUARDAR.some((d) => url.hostname.includes(d))) return;   // va directo a la red
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* La página: primero la red (para traer novedades), y si falla, la copia
     guardada. Ahora hay DOS páginas —la portada en './' y la app en
     './app.html'— así que cada una guarda la suya. Antes todo se guardaba
     bajo './index.html' y con dos páginas eso haría que una pisara a la
     otra: sin conexión se abriría la equivocada. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        const c = await caches.open(VERSION);
        c.put(req, r.clone()).catch(() => {});
        return r;
      } catch (_) {
        return (await caches.match(req))
            || (await caches.match('./app.html'))
            || (await caches.match('./index.html'))
            || Response.error();
      }
    })());
    return;
  }

  // El resto (código, imágenes de la app): PRIMERO la red, y si falla, la
  // copia guardada. Antes era al revés (caché primero) y con archivos
  // versionados eso servía piezas de versiones distintas mezcladas -> la
  // app cargaba rota. Network-first garantiza que siempre se ve lo último;
  // la caché queda solo como respaldo para cuando no hay conexión.
  e.respondWith((async () => {
    try {
      const r = await fetch(req);
      if (r && r.ok && r.type === 'basic') {
        caches.open(VERSION).then((c) => c.put(req, r.clone())).catch(() => {});
      }
      return r;
    } catch (_) {
      const guardada = await caches.match(req);
      return guardada || Response.error();
    }
  })());
});
