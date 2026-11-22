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

import { SPOT_ADDR, firmarMensaje, cuentaFirmante } from './contrato.js?v=8';

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

/* Cancela la orden automatica de una posicion (cuando se cierra a mano o se quita el TP/SL). */
export async function cancelarOrden(chainId) {
  if (chainId == null) return;
  const ts = ahora();
  const firma = await firmarMensaje(mensajeCancelar(Number(chainId), ts));
  try { await postJSON('/cancelar', { id: Number(chainId), ts, firma }); } catch (_) {}
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
