/* sw-alertas.js — Service Worker de la app instalable "DecFreedom Alerts" (Terminal).
   Alcance: modules/terminal/ (no toca los SW de la raiz). NETWORK-ONLY: no cachea NADA (igual que sw.js
   de la raiz), solo existe para que la PWA sea instalable y para mostrar notificaciones en movil via
   registration.showNotification (el constructor new Notification() falla en Android/Chrome).
   Incluye push/notificationclick: hoy el push no se usa (no hay servidor), pero queda listo para cuando
   exista un backend de avisos con la app cerrada. */
const VERSION = 'df-alertas-netonly-1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/* Pass-through: nunca cachea; la red manda siempre (evita servir modulos viejos). */
self.addEventListener('fetch', () => { /* no-op: deja que el navegador haga la peticion normal */ });

/* Abrir/enfocar la app al tocar una notificacion. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const url = new URL('./alertas.html', self.registration.scope).href;
    const todas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of todas) { if (c.url.indexOf('alertas.html') >= 0 && 'focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

/* Push (futuro backend): muestra la notificacion que mande el servidor. Sin backend, no se dispara. */
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text ? e.data.text() : '' }; }
  const title = d.title || 'DecFreedom Alerts';
  const opts = { body: d.body || '', tag: d.tag || 'df-alert', icon: d.icon || '../../assets/img/cco-192.png', badge: d.badge || '../../assets/img/cco-192.png', data: d.data || {} };
  e.waitUntil(self.registration.showNotification(title, opts));
});
