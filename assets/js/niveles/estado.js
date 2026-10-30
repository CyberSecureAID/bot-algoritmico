/* niveles/estado.js — Estado compartido de Smart Levels.
   El objeto N lo leen y mutan todos los módulos. Nunca se reasigna
   (solo se hace N.algo = ...), por eso funciona igual importado que local. */

export const N = {
  velas: [],
  precio: 0,
  niveles: [],        // los que se dibujan
  tendencia: null,
  rango: null,        // si está lateral
  verEstructura: true, // Faro (indicador 'estructura') ENCENDIDO por defecto: representa la sección
  verPerfil: true,    // perfil de liquidez (barras) ENCENDIDO por defecto; toggle en la barra superior
  verTendencia: true, // líneas de tendencia (corto + mayor) ENCENDIDAS por defecto; toggle en la barra superior
  mensajes: [],       // lo que dice el asistente
  vista: { desde: 0, ancho: 90, zoomY: 1 },
  cargando: true,
  error: null,
  _geo: null,         // geometría del último render (antes era la variable _geo)
  par: 'BTC',         // par actual (antes _par)
  tf: '1h',           // temporalidad actual (antes _tf)
  trazo: 0,           // 0 a 1: cuánto se ha dibujado la tendencia (antes _trazo)
  od: null,           // módulo de órdenes (antes _od)
  zonasOd: [],        // zonas donde se puede pulsar para cancelar (antes _zonasOd)
  cerrarFichas: null  // cierra órdenes abiertas al cambiar de par (antes _cerrarFichas)
};
