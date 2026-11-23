/* modules/spot/keeper-spot.js — Puente entre el Spot y el KEEPER de Cloudflare.
   ──────────────────────────────────────────────────────────────────────────────
   Hasta ahora, el TP/SL/limite se "disparaba" LOCAL en motor.js->onPrecio(), solo
   mientras el navegador estaba abierto y sin ejecutar nada on chain. Este modulo
   conecta esas ordenes al keeper real (el Worker de Cloudflare), que vigila el
   precio del lado del servidor y CIERRA de verdad cuando toca, aunque no haya
   ninguna pestana abierta.

   Alcance de HOY: lado de CIERRE (TP, SL y limite de cierre) sobre posiciones REALES
   (las que ya tienen id on chain, p.chainId). La apertura por limite y el "set
   position" de Analisis son lado de apertura: necesitan la extension del contrato
   (Fase B) y se cablean despues.

   No custodial: el keeper solo puede cerrar respetando el piso (floorOut) que fija
   el usuario; nunca puede mandar los fondos a otra wallet. El registro de una orden
   lo AUTORIZA el dueno con su firma (gratis, sin gas); el keeper la verifica contra
   el dueno real de la posicion on chain. */

import { SPOT_ADDR, firmarMensaje, cuentaFirmante, crearLimiteSpot, cancelarLimiteSpot, ordenLimiteInfo } from './contrato.js?v=12';

/* Direccion FIJA del keeper (Worker de Cloudflare). Vive aparte del repo: tocar el
   repo no la cambia. El front solo la LLAMA. */
export const KEEPER_URL = 'https://decfreedom-keeper.yamicelanvivesqui.workers.dev';

const ahora = () => Math.floor(Date.now() / 1000);

/* Simbolo de Binance para vigilar el precio (ej. BTC -> BTCUSDT). El keeper lee el
   precio del espejo de Binance con este simbolo. */
export function simboloBinance(par) {
  // Una posicion del motor trae la MONEDA en `par.par` (ej. 'BTC'); un objeto de par la
  // trae en .simbolo/.coin/.id. OJO: nunca usar el id interno de la posicion (p.id = 'o...').
  const raw = (par && typeof par === 'object') ? (par.par || par.simbolo || par.coin || par.id) : par;
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!c) return '';
  return c.endsWith('USDT') ? c : c + 'USDT';
}

/* Mensaje canonico que firma el dueno (DEBE ser identico, caracter por caracter, al
   que reconstruye el worker en mensajeOrden()). */
function mensajeOrden(o, ts) {
  return [
    'DecFreedom keeper',
    'accion: registrar',
    `id: ${o.id}`,
    `simbolo: ${o.simbolo}`,
    `lado: ${o.lado}`,
    `tp: ${o.tp == null ? '' : o.tp}`,
    `sl: ${o.sl == null ? '' : o.sl}`,
    `trail: ${o.trailing && o.trailing.pct ? o.trailing.pct : ''}`,
    `ts: ${ts}`,
  ].join('\n');
}
function mensajeCancelar(id, ts) { return `DecFreedom keeper\naccion: cancelar\nid: ${id}\nts: ${ts}`; }
/* Mensaje canonico que firma el dueno para autorizar vigilar una orden LIMITE (abrir). DEBE ser
   identico, caracter por caracter, al que reconstruye el worker en mensajeLimite(). */
function mensajeLimite(o, ts) {
  return [
    'DecFreedom keeper',
    'accion: abrir-limite',
    `id: ${o.id}`,
    `simbolo: ${o.simbolo}`,
    `lado: ${o.lado}`,
    `objetivo: ${o.objetivo}`,
    `cruce: ${o.cruce}`,
    `ts: ${ts}`,
  ].join('\n');
}

async function postJSON(ruta, cuerpo) {
  const r = await fetch(KEEPER_URL + ruta, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  let j = null; try { j = await r.json(); } catch (_) {}
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
  return j;
}

/* Registra (o actualiza) el TP/SL de una posicion REAL en el keeper.
   pos = objeto del motor con: chainId (id on chain), par, lado, tp, sl.
   Fija primero el piso on chain (setFloor, firma del usuario) y luego manda la orden
   firmada al keeper. Devuelve la orden guardada o lanza con un mensaje claro. */
export async function armarOrden(pos) {
  if (!pos || pos.chainId == null) throw new Error('La posicion aun no esta confirmada on chain.');
  const simbolo = simboloBinance(pos);
  if (!simbolo) throw new Error('No se pudo determinar el simbolo del par.');
  const hayTrail = !!(pos.trailing && Number(pos.trailing.pct) > 0);
  if (pos.tp == null && pos.sl == null && !hayTrail) throw new Error('Pon al menos un TP, un SL o un trailing.');
  const esShort = String(pos.lado) === 'short';

  // Orden firmada por el dueno (gratis, sin gas) y enviada al keeper. El keeper cierra
  // con su anti slippage del 1% (igual que un cierre manual). El piso on chain (floorOut),
  // que ademas blinda contra una llave de keeper comprometida, es el siguiente endurecimiento.
  const cuenta = await cuentaFirmante();   // direccion del firmante activo
  const o = {
    id: Number(pos.chainId), seccion: 'spot', simbolo,
    lado: esShort ? 'short' : 'long',
    tp: pos.tp != null ? Number(pos.tp) : null,
    sl: pos.sl != null ? Number(pos.sl) : null,
    trailing: hayTrail ? { pct: Number(pos.trailing.pct) } : null,
    slippageBps: 100, deadlineSeg: 300, dueno: String(cuenta).toLowerCase(),
  };
  const ts = ahora();
  const firma = await firmarMensaje(mensajeOrden(o, ts));
  return await postJSON('/orden', { ...o, ts, firma });
}

/* Cancela la orden automatica de una posicion (cuando se cierra a mano o se quita el TP/SL).
   PROPAGA el fallo: quien la llama decide si avisar (quitar un SL que sigue activo es peligroso)
   o tragarselo (al cerrar a mano, si la cancelacion falla no pasa nada: el keeper vera la
   posicion cerrada y no hara nada). */
export async function cancelarOrden(chainId) {
  if (chainId == null) return;
  const ts = ahora();
  const firma = await firmarMensaje(mensajeCancelar(Number(chainId), ts));
  await postJSON('/cancelar', { id: Number(chainId), ts, firma });
}

/* ── FASE B · lado de ABRIR ──
   Registra en el keeper una orden LIMITE que ya existe on chain (el usuario llamo crearLimite y
   aprobo el USDT). Con la firma del dueno, el keeper la vigila y, cuando el precio cruza el
   objetivo, llama ejecutarLimite (abre la posicion a nombre del usuario, respetando su piso).
   cruce: 'abajo' = disparar si precio <= objetivo (compra en caida); 'arriba' = si precio >= objetivo. */
export async function armarLimite({ id, simbolo, lado, objetivo, cruce, slippageBps = 100, deadlineSeg = 300 }) {
  if (id == null) throw new Error('La orden limite aun no tiene id on chain.');
  const o = {
    id: Number(id), accion: 'abrir', seccion: 'spot', simbolo: String(simbolo || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    lado: String(lado) === 'short' ? 'short' : 'long',
    objetivo: Number(objetivo), cruce: cruce === 'arriba' ? 'arriba' : 'abajo',
    slippageBps, deadlineSeg, dueno: String(await cuentaFirmante()).toLowerCase(),
  };
  const ts = ahora();
  const firma = await firmarMensaje(mensajeLimite(o, ts));
  return await postJSON('/orden', { ...o, ts, firma });
}

/* Cancela en el keeper la vigilancia de una orden limite (accion 'abrir', su propio espacio). */
export async function cancelarLimiteKeeper(id) {
  if (id == null) return;
  const ts = ahora();
  const firma = await firmarMensaje(mensajeCancelar(Number(id), ts));
  await postJSON('/cancelar', { id: Number(id), accion: 'abrir', ts, firma });
}

/* ── Orquestacion de ordenes limite de Spot (COMPARTIDA por Spot web y Spot movil) ──
   Un solo flujo para poner/cancelar/listar una orden limite on chain. La LOGICA (contrato +
   worker) vive aqui; cada front (web/movil) solo la DIBUJA a su manera. Se guarda un registro
   local para pintarla al instante, pero la verdad vive on chain (reconciliarLimites la ajusta). */
const LS_LIM = 'sp-limites-v1';
function _leerLim() { try { const l = JSON.parse(localStorage.getItem(LS_LIM) || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } }
function _guardarLim(l) { try { localStorage.setItem(LS_LIM, JSON.stringify((l || []).slice(-100))); } catch (_) {} }

/* Pone una orden LIMITE: 1) la crea on chain (crearLimite: deposita la orden, aprueba el USDT y
   cobra la comision de gas) y saca su id; 2) la arma en el keeper (firma del dueno, sin gas) para
   que la dispare cuando el precio llegue. cruce se deduce del precio actual: objetivo por debajo =
   compra en caida ('abajo'); por encima = ruptura ('arriba'). Devuelve el registro local. */
export async function ponerLimiteSpot({ par, lado, montoUsdt, objetivo, simbolo, markActual = 0, slippageBps = 100 }) {
  const cruce = (markActual > 0 && markActual >= Number(objetivo)) ? 'abajo' : 'arriba';
  const env = await crearLimiteSpot({ par, lado, montoUsdt, objetivo, slippageBps });     // on chain, espera el id
  if (env.id == null) throw new Error('La orden se creó on-chain pero no se pudo leer su id. Reabre Spot para sincronizar.');
  const sim = simboloBinance(par) || String(simbolo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');   // el simbolo de Binance (BTC -> BTCUSDT), en mayusculas
  await armarLimite({ id: env.id, simbolo: sim, lado, objetivo, cruce, slippageBps });     // keeper (firma, sin gas)
  const lim = { id: env.id, par: (par && (par.id || par.coin)) || '', simbolo: sim, lado: String(lado) === 'short' ? 'short' : 'long',
    amount: Number(montoUsdt), objetivo: Number(objetivo), cruce, estado: 'armada', t: Date.now() };
  const l = _leerLim(); l.push(lim); _guardarLim(l);
  return lim;
}

/* Cancela una orden limite: on chain (libera la autorizacion) + en el keeper (deja de vigilarla) +
   la quita del registro local. */
export async function cancelarLimiteSpotFull(id) {
  await cancelarLimiteSpot(id);
  try { await cancelarLimiteKeeper(id); } catch (_) {}
  _guardarLim(_leerLim().filter((x) => String(x.id) !== String(id)));
}

/* Lista el registro local de ordenes limite (rapido, para pintar). */
export function listarLimites() { return _leerLim(); }

/* ── Sincroniza las posiciones ABIERTAS on chain con el motor local (COMPARTIDA web/movil) ──
   Anade al motor las posiciones REALES que faltan: las que abre el keeper al disparar una orden
   limite (ejecutarLimite), o abiertas desde otro dispositivo. Asi dejan de ser invisibles y se
   pueden cerrar. Es ADITIVA y a prueba de duplicados (dedupe por chainId). NO corre si hay una
   apertura local en vuelo (pend), para no duplicar una posicion que esta por confirmar. Devuelve
   true si anadio algo. M = motor (la MISMA instancia que usa el front). */
export async function sincronizarPosiciones(M) {
  try {
    if (!M || !M.posiciones || !M.abrirMercado) return false;
    const locales = M.posiciones();
    if (locales.some((p) => p.pend)) return false;              // apertura en vuelo: esperar a que confirme
    const yaChain = new Set(locales.filter((p) => p.chainId != null).map((p) => Number(p.chainId)));
    const C = await import('./contrato.js?v=12');
    const det = await C.posicionesAbiertasDetalle();
    let cambio = false;
    for (const d of det) {
      if (!d || yaChain.has(Number(d.chainId))) continue;
      if (!(d.entrada > 0) || !(d.amount > 0)) continue;
      const r = M.abrirMercado(d.parId, d.simbolo, d.lado, d.amount, d.entrada, null, null, d.chainId, false);
      if (r && r.ok) { yaChain.add(Number(d.chainId)); cambio = true; }
    }
    return cambio;
  } catch (_) { return false; }
}

/* Reconcilia el registro local contra la cadena: quita las que ya NO estan activas (ejecutadas o
   canceladas). Devuelve la lista viva. Se llama al abrir la vista y con throttle, no en bucle. */
export async function reconciliarLimites() {
  const l = _leerLim(); if (!l.length) return l;
  let cambio = false; const vivos = [];
  for (const o of l) {
    try { const info = await ordenLimiteInfo(o.id); if (info && !info.activa) { cambio = true; } else { vivos.push(o); } }
    catch (_) { vivos.push(o); }   // sin lectura: se deja y se revisa luego
  }
  if (cambio) _guardarLim(vivos);
  return vivos;
}

/* Estado de las ordenes del usuario en el keeper (para pintar "armada / disparada" y
   confirmar que el vigilante esta vivo). NO se llama en bucle: solo al abrir la vista
   o tras una accion. */
export async function estadoKeeper(cuenta) {
  try {
    const q = cuenta ? ('?dueno=' + encodeURIComponent(String(cuenta).toLowerCase())) : '';
    const r = await fetch(KEEPER_URL + '/estado' + q);
    const j = await r.json();
    return (j && j.ok) ? j : null;
  } catch (_) { return null; }
}

/* Salud del keeper (una llamada ligera; util para un indicador "en linea"). */
export async function keeperVivo() {
  try { const r = await fetch(KEEPER_URL + '/salud'); const j = await r.json(); return !!(j && j.ok); }
  catch (_) { return false; }
}

export { SPOT_ADDR };
