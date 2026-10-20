/* terminal/grafico.js. Grafico de precio del token con velas REALES leidas de la cadena (modulo sellado).
   Idea: cada cambio de reservas del par es una operacion, y cada operacion es una vela. El precio sube
   con las compras (vela verde) y baja con las ventas (vela roja). Un token recien creado con 2 o 3
   operaciones muestra 2 o 3 velas: NUNCA se queda vacio esperando a que alguien opere (ese era el fallo
   del grafico de Launchpad).

   Fuente: eventos Sync(reserve0, reserve1) del par de PancakeSwap V2, que el par emite tras CADA
   operacion (compra, venta, anadir o quitar liquidez). De cada Sync sale el precio spot exacto en ese
   momento. La vela i abre en el precio anterior y cierra en el actual. Sin inventar nada.

   Render: TradingView Lightweight Charts (Apache-2.0), la misma libreria del Launchpad, vendorizada
   aqui para respetar el modulo sellado. */
import * as ethers from './ethers.min.js';
import * as LW from './lightweight-charts.mjs';
import { conRotacion, bloqueActual } from './rpc.js';

const TOPIC_SYNC = ethers.id('Sync(uint112,uint112)');
const ABI_PAR = ['function token0() view returns (address)'];
const TRAMO = 1000;               // bloques por getLogs (limite habitual de los RPC publicos)
const MAX_TRAMOS = 12;            // tope de rango hacia atras si no sabemos el bloque de creacion

/* Lee los Sync del par y arma las velas.
   par: direccion del par V2. token: el token. decToken/decQuote: decimales (BNB y USDT = 18).
   bloque: bloque de creacion (para acotar). bnbUsd: precio de BNB. quoteEsUSDT: el par es contra USDT. */
export async function velasDeToken({ par, token, decToken = 18, decQuote = 18, bloque, bnbUsd = 0, quoteEsUSDT = false }) {
  if (!par) return [];
  let token0;
  try { token0 = String(await conRotacion((p) => new ethers.Contract(par, ABI_PAR, p).token0())).toLowerCase(); }
  catch (_) { return []; }
  const tokenEs0 = token0 === String(token).toLowerCase();
  const hasta = await bloqueActual();
  const desde = bloque ? Math.max(0, Number(bloque) - TRAMO) : Math.max(0, hasta - TRAMO * MAX_TRAMOS);

  const trozos = []; for (let b = desde; b <= hasta; b += TRAMO) trozos.push([b, Math.min(hasta, b + TRAMO - 1)]);
  const porTramo = await Promise.all(trozos.map(([a, b]) =>
    conRotacion((p) => p.getLogs({ address: par, topics: [TOPIC_SYNC], fromBlock: a, toBlock: b })).catch(() => [])));
  let logs = []; for (const ls of porTramo) logs = logs.concat(ls);
  if (!logs.length) return [];
  logs.sort((x, y) => (Number(x.blockNumber) - Number(y.blockNumber)) || ((x.logIndex ?? x.index ?? 0) - (y.logIndex ?? y.index ?? 0)));

  // precio = (reservaQuote/10^decQuote) / (reservaToken/10^decToken) = (rQuote/rTok) * 10^(decToken-decQuote)
  const esc = Math.pow(10, decToken - decQuote);
  const factorUsd = quoteEsUSDT ? 1 : (bnbUsd || 0);
  const precios = [];
  for (const l of logs) {
    const d = (l.data || '0x').slice(2);
    if (d.length < 128) continue;
    const r0 = BigInt('0x' + d.slice(0, 64)), r1 = BigInt('0x' + d.slice(64, 128));
    const rTok = tokenEs0 ? r0 : r1, rQuote = tokenEs0 ? r1 : r0;
    if (rTok === 0n) continue;
    const p = (Number(rQuote) / Number(rTok)) * esc * (factorUsd || 1);
    if (p > 0 && isFinite(p)) precios.push({ b: Number(l.blockNumber), p });
  }
  if (!precios.length) return [];

  // Tiempo aproximado por numero de bloque (sin llamadas extra): BSC ~0.75 s por bloque.
  const ahora = Math.floor(Date.now() / 1000);
  const tiempoDe = (b) => ahora - Math.round((hasta - b) * 0.75);
  const velas = []; let tPrev = 0;
  for (let i = 0; i < precios.length; i++) {
    const o = i === 0 ? precios[0].p : precios[i - 1].p;
    const c = precios[i].p;
    let t = tiempoDe(precios[i].b);
    if (t <= tPrev) t = tPrev + 1;     // lightweight-charts exige tiempos estrictamente crecientes
    tPrev = t;
    velas.push({ time: t, open: o, high: Math.max(o, c), low: Math.min(o, c), close: c });
  }
  return velas;
}

/* Precio actual del token en USD, leido de las reservas vivas del par (una sola lectura). */
const ABI_RES = ['function getReserves() view returns (uint112, uint112, uint32)', 'function token0() view returns (address)'];
export async function precioActual({ par, token, decToken = 18, decQuote = 18, bnbUsd = 0, quoteEsUSDT = false }) {
  if (!par) return 0;
  try {
    const c = (p) => new ethers.Contract(par, ABI_RES, p);
    const [res, token0] = await Promise.all([conRotacion((p) => c(p).getReserves()), conRotacion((p) => c(p).token0())]);
    const tokenEs0 = String(token0).toLowerCase() === String(token).toLowerCase();
    const rTok = BigInt(tokenEs0 ? res[0] : res[1]), rQuote = BigInt(tokenEs0 ? res[1] : res[0]);
    if (rTok === 0n) return 0;
    const esc = Math.pow(10, decToken - decQuote);
    const p = (Number(rQuote) / Number(rTok)) * esc * (quoteEsUSDT ? 1 : (bnbUsd || 0));
    return (p > 0 && isFinite(p)) ? p : 0;
  } catch (_) { return 0; }
}

/* Operaciones recientes del par (compras/ventas REALES), para el panel "Recent activity" de la derecha.
   Lee los eventos Swap de PancakeSwap V2: si sale token es compra, si entra token es venta; el otro lado
   es el monto en la moneda del par (BNB o USDT). El trader es el `to` (topic indexado). Nada inventado. */
const TOPIC_SWAP = ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)');
export async function tradesRecientes({ par, token, decQuote = 18, quoteEsUSDT = false, limite = 6 }) {
  if (!par) return [];
  let token0;
  try { token0 = String(await conRotacion((p) => new ethers.Contract(par, ABI_PAR, p).token0())).toLowerCase(); }
  catch (_) { return []; }
  const tokenEs0 = token0 === String(token).toLowerCase();
  const hasta = await bloqueActual();
  const desde = Math.max(0, hasta - TRAMO * 4);
  const trozos = []; for (let b = desde; b <= hasta; b += TRAMO) trozos.push([b, Math.min(hasta, b + TRAMO - 1)]);
  const porTramo = await Promise.all(trozos.map(([a, b]) =>
    conRotacion((p) => p.getLogs({ address: par, topics: [TOPIC_SWAP], fromBlock: a, toBlock: b })).catch(() => [])));
  let logs = []; for (const ls of porTramo) logs = logs.concat(ls);
  if (!logs.length) return [];
  logs.sort((x, y) => (Number(y.blockNumber) - Number(x.blockNumber)) || ((y.logIndex ?? y.index ?? 0) - (x.logIndex ?? x.index ?? 0)));
  const ahora = Math.floor(Date.now() / 1000);
  const escQuote = Math.pow(10, -decQuote);
  const out = [];
  for (const l of logs) {
    const d = (l.data || '0x').slice(2);
    if (d.length < 256) continue;
    const a0In = BigInt('0x' + d.slice(0, 64)), a1In = BigInt('0x' + d.slice(64, 128)), a0Out = BigInt('0x' + d.slice(128, 192)), a1Out = BigInt('0x' + d.slice(192, 256));
    const tokOut = tokenEs0 ? a0Out : a1Out, tokIn = tokenEs0 ? a0In : a1In;
    const quoteIn = tokenEs0 ? a1In : a0In, quoteOut = tokenEs0 ? a1Out : a0Out;
    let tipo, quoteWei;
    if (tokOut > 0n) { tipo = 'buy'; quoteWei = quoteIn; }
    else if (tokIn > 0n) { tipo = 'sell'; quoteWei = quoteOut; }
    else continue;
    const who = (l.topics && l.topics[2]) ? ('0x' + String(l.topics[2]).slice(-40)) : '';
    out.push({ tipo, quoteAmt: Number(quoteWei) * escQuote, moneda: quoteEsUSDT ? 'USDT' : 'BNB', who, time: (ahora - Math.round((hasta - Number(l.blockNumber)) * 0.75)) * 1000 });
    if (out.length >= limite) break;
  }
  return out;
}

/* ── Render ── */
function subCeros(n) { let r = ''; for (const ch of String(n)) r += String.fromCharCode(0x2080 + (ch.charCodeAt(0) - 48)); return r; }
function fmtEje(p) {
  if (!(p > 0) || !isFinite(p)) return '0';
  if (p >= 1) { try { return Number(p.toPrecision(6)).toLocaleString('en-US'); } catch (_) { return String(Number(p.toPrecision(6))); } }
  if (p >= 0.001) return Number(p.toPrecision(4)).toString();
  const e = Math.floor(Math.log10(p)); const ceros = -e - 1;
  const dig = Math.round(p / Math.pow(10, e - 3)).toString().slice(0, 4);
  return '0.0' + subCeros(ceros) + dig;
}

let _chart = null, _serie = null, _ro = null, _cont = null, _lineaEntrada = null, _entradaPrecio = 0, _lineaActual = null, _vol = null;
/* Precio (en las unidades del eje, aqui USD) a la altura Y relativa al contenedor del grafico.
   Lo usa la vista grande para el clic derecho: poner una alerta al precio donde se hizo clic. */
export function precioEnY(y) { try { return (_serie && y != null) ? _serie.coordinateToPrice(y) : null; } catch (_) { return null; } }
/* Marca horizontal en el eje al precio de ENTRADA de una posicion abierta (como TradingView). El eje de
   precios se amplia para que la linea de entrada SIEMPRE quede a la vista, aunque el precio se haya movido. */
export function marcarEntrada(price, etiqueta) {
  limpiarEntrada();
  try {
    if (_serie && price > 0 && isFinite(price)) {
      _entradaPrecio = Number(price);
      _lineaEntrada = _serie.createPriceLine({ price: _entradaPrecio, color: '#E8B84B', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: etiqueta || 'Entry' });
      _serie.applyOptions({ autoscaleInfoProvider: (orig) => { const r = orig && orig(); if (!r || !r.priceRange) return r; const p = _entradaPrecio; return { priceRange: { minValue: Math.min(r.priceRange.minValue, p), maxValue: Math.max(r.priceRange.maxValue, p) }, margins: r.margins }; } });
    }
  } catch (_) {}
}
export function limpiarEntrada() {
  try { if (_serie && _lineaEntrada) _serie.removePriceLine(_lineaEntrada); } catch (_) {}
  try { if (_serie) _serie.applyOptions({ autoscaleInfoProvider: undefined }); } catch (_) {}
  _lineaEntrada = null; _entradaPrecio = 0;
}
/* Linea punteada en el PRECIO ACTUAL (a mercado). Se muestra mientras la compra rapida esta abierta,
   para dejar claro que la entrada se ejecuta aqui y no en el punto donde se hizo clic. */
export function marcarActual(price) {
  limpiarActual();
  try { if (_serie && price > 0 && isFinite(price)) _lineaActual = _serie.createPriceLine({ price: Number(price), color: '#9fb0c0', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'Market' }); } catch (_) {}
}
export function limpiarActual() { try { if (_serie && _lineaActual) _serie.removePriceLine(_lineaActual); } catch (_) {} _lineaActual = null; }
export function destruirGrafico() {
  if (_ro) { try { _ro.disconnect(); } catch (_) {} _ro = null; }
  if (_chart) { try { _chart.remove(); } catch (_) {} }
  _chart = null; _serie = null; _cont = null; _lineaEntrada = null; _entradaPrecio = 0; _lineaActual = null; _vol = null;
}
export function montarGrafico(cont, velas) {
  if (!cont || !Array.isArray(velas) || !velas.length) return false;
  destruirGrafico();
  const lo = Math.min(...velas.map((v) => v.low));
  const minMove = lo >= 1 ? 0.0001 : Math.max(1e-12, Math.pow(10, Math.floor(Math.log10(lo)) - 2));
  const medir = () => ({ w: cont.clientWidth || cont.offsetWidth || 600, h: cont.clientHeight || 220 });
  try {
    const d0 = medir();
    _chart = LW.createChart(cont, {
      width: d0.w, height: d0.h,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8b96a3', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 10, attributionLogo: false },
      grid: { vertLines: { color: 'rgba(255,255,255,.04)' }, horzLines: { color: 'rgba(255,255,255,.04)' } },
      rightPriceScale: { borderColor: '#1c232b', scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: '#1c232b', timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0, vertLine: { color: '#3a434f', width: 1, labelBackgroundColor: '#c79426' }, horzLine: { color: '#3a434f', labelBackgroundColor: '#c79426' } },
      localization: { locale: 'en', priceFormatter: fmtEje },
      handleScale: { axisPressedMouseMove: true }, handleScroll: true
    });
    _serie = _chart.addSeries(LW.CandlestickSeries, { upColor: '#2ebd85', downColor: '#f6465d', borderUpColor: '#2ebd85', borderDownColor: '#f6465d', wickUpColor: '#2ebd85', wickDownColor: '#f6465d', priceFormat: { type: 'custom', formatter: fmtEje, minMove } });
    _serie.setData(velas);
    _cont = cont;
    const ajustar = () => { if (_chart && _cont) { const d = medir(); try { _chart.resize(d.w, d.h); } catch (_) {} } };
    try { _ro = new ResizeObserver(ajustar); _ro.observe(cont); } catch (_) {}
    const ts = _chart.timeScale();
    // Con pocas velas NO estirar (una sola operacion no debe ocupar todo el ancho): ancho fijo y a la derecha.
    if (velas.length > 14) ts.fitContent();
    else { try { ts.applyOptions({ barSpacing: 18, rightOffset: 6 }); ts.scrollToRealTime(); } catch (_) {} }
    requestAnimationFrame(ajustar); setTimeout(ajustar, 140);
    return true;
  } catch (_) { destruirGrafico(); return false; }
}
