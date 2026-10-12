// grafica.js — Gráfica real de velas con las cuadrículas del bot dibujadas encima.
// Módulo independiente. Usa Lightweight Charts (de TradingView, código abierto)
// alojado en NUESTRO repo, y las velas reales de Binance.
//
// POR QUÉ ASÍ Y NO CON EL WIDGET DE TRADINGVIEW
//   El widget gratuito va dentro de un marco cerrado: no se le puede dibujar
//   nada ni saber su zoom. Con esta librería las líneas quedan PEGADAS al precio:
//   al mover o hacer zoom, las cuadrículas y tu precio de entrada se mueven con
//   las velas, que es justo lo que hace falta para no perder la referencia.

import { createChart, LineStyle } from './vendor/lightweight-charts.mjs';

const $ = (id) => document.getElementById(id);

/* Pares que Binance sirve (la inmensa mayoría de lo que se opera en BSC). */
const ALIAS = { WBNB: 'BNB', BTCB: 'BTC', WETH: 'ETH', BSCUSD: 'USDT', 'BSC-USD': 'USDT' };
const norm = (s) => ALIAS[String(s || '').toUpperCase()] || String(s || '').toUpperCase();

/** Símbolo de Binance para el par. null si no lo tiene. */
export function simboloBinance(simB, simQ) {
  const b = norm(simB), q = norm(simQ);
  if (!b || !q || b === q) return null;
  if (q === 'USDT' || q === 'BUSD' || q === 'USDC' || q === 'BNB' || q === 'BTC') {
    return b + (q === 'BUSD' || q === 'USDC' ? 'USDT' : q);
  }
  return null;
}

let _n = 0;
const _pendientes = [];

/** HTML del bloque. La gráfica se dibuja luego con pintar(). */
export function bloqueGrafica({ simB, simQ, pmin, pmax, niveles, precio, precioMedio, decQ, tipo, objetivoBps, compras, operaciones, creado, rango }) {
  const sym = simboloBinance(simB, simQ);
  const id = 'lwc' + (++_n);
  _pendientes.push({ id, sym, pmin, pmax, niveles: niveles || [], precio, precioMedio, decQ, simB, simQ, tipo, objetivoBps, compras: compras || [], operaciones: operaciones || [], creado: creado || 0, rango: rango !== false });

  if (!sym) {
    return `<div class="lwbox sin" id="${id}"><div class="lw-sin">
      <b>${String(simB || '')}/${String(simQ || '')}</b>
      <span>Esta moneda no cotiza en Binance, así que no hay velas públicas. Abajo tienes tus cuadrículas con sus precios exactos.</span>
    </div></div>
    <div class="lw-pie">Tus cuadrículas salen del contrato: son las de verdad</div>`;
  }
  return `<div class="lwbox" id="${id}"><div class="lw-cargando">Cargando gráfica…</div></div>
    <div class="lw-pie" id="${id}-pie">Velas reales de <b>${norm(simB)}/${norm(simQ)}</b> · las líneas son <b>tus cuadrículas</b> y se mueven con el gráfico</div>`;
}

/* ── Estilos ── */
function estilos() {
  if ($('lwc-css')) return;
  const s = document.createElement('style'); s.id = 'lwc-css';
  s.textContent = `
  .lwbox{position:relative;width:100%;height:340px;border-radius:14px;overflow:hidden;background:#0b0e12;border:1px solid var(--line,#2b3139)}
  .lwbox.sin{height:auto;min-height:120px;display:flex;align-items:center;justify-content:center}
  .lw-cargando{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ink-3,#7d8794);font-family:var(--mono,monospace);font-size:11px}
  .lw-sin{padding:18px;text-align:center}
  .lw-sin b{display:block;font-family:var(--display,sans-serif);font-size:16px;color:var(--gold,#E8B84B)}
  .lw-sin span{display:block;font-family:var(--sans,sans-serif);font-size:11.5px;color:var(--ink-3,#7d8794);margin-top:6px;line-height:1.55;max-width:330px}
  .lw-pie{padding:8px 10px 2px;font-family:var(--mono,monospace);font-size:9.5px;color:#8b96a3;text-align:center;line-height:1.5}
  .lw-pie b{color:var(--gold-soft,#C9A84B)}
  .lw-tf{display:flex;gap:5px;justify-content:center;margin-top:8px}
  .lw-tf button{padding:5px 11px;border-radius:8px;border:1px solid var(--line,#2b3139);background:rgba(255,255,255,.04);color:var(--ink-3,#7d8794);font-family:var(--mono,monospace);font-size:10px;cursor:pointer;min-height:30px}
  .lw-tf button.on{background:rgba(232,184,75,.14);border-color:rgba(232,184,75,.45);color:var(--gold,#E8B84B)}
  @media(max-width:560px){.lwbox{height:280px}.lw-pie{font-size:8.5px}}`;
  document.head.appendChild(s);
}

/* Decimales según el tamaño del precio: 556.49 y no 556.4994673215 */
function decimales(p) {
  const v = Math.abs(Number(p) || 0);
  if (v >= 100) return 2;          // 592.00, no 592.0000: las tachuelas eran enormes
  if (v >= 10) return 3;
  if (v >= 1) return 4;
  if (v >= 0.01) return 5;
  if (v >= 0.0001) return 7;
  return 9;
}

/* Velas de Binance */
async function velas(sym, intervalo = '1h', limite = 300) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${intervalo}&limit=${limite}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('binance ' + r.status);
  const d = await r.json();
  return d.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: +k[1], high: +k[2], low: +k[3], close: +k[4]
  }));
}

/** Dibuja las gráficas pendientes que ya estén en pantalla. */
export async function pintar(raiz) {
  estilos();
  const cola = _pendientes.splice(0, _pendientes.length);
  for (const g of cola) {
    const host = (raiz || document).querySelector('#' + g.id) || $(g.id);
    if (!host || host.dataset.listo) continue;
    if (!g.sym) { host.dataset.listo = '1'; continue; }
    host.dataset.listo = '1';
    try { await montar(host, g); }
    catch (e) {
      host.innerHTML = `<div class="lw-cargando">No se pudo cargar la gráfica.<br>Vuelve a intentarlo en un momento.</div>`;
    }
  }
}

async function montar(host, g) {
  const dec = decimales(g.pmax || g.precio || 1);
  const datos = await velas(g.sym, '1d', 300);
  host.innerHTML = '';

  const chart = createChart(host, {
    layout: { background: { color: '#0b0e12' }, textColor: '#8b96a3', fontSize: 10 },
    grid: { vertLines: { color: 'rgba(255,255,255,.04)' }, horzLines: { color: 'rgba(255,255,255,.04)' } },
    rightPriceScale: { borderColor: '#2b3139', scaleMargins: { top: 0.16, bottom: 0.16 } },
    timeScale: { borderColor: '#2b3139', timeVisible: true, secondsVisible: false },
    crosshair: { mode: 0 },
    handleScroll: true, handleScale: true,
    localization: { locale: 'es', priceFormatter: (p) => Number(p).toFixed(dec) }
  });

  // Todas las líneas que vamos a pintar (cuadrículas, entrada, objetivo).
  // La escala tiene que INCLUIRLAS: si no, quedan fuera de la vista y parece
  // que la línea se despega de su etiqueta. Era justo lo que pasaba.
  const preciosLinea = [];
  (g.niveles || []).forEach((nv) => { const p = Number(nv.precio); if (p > 0) preciosLinea.push(p); });
  (g.compras || []).forEach((p) => { if (Number(p) > 0) preciosLinea.push(Number(p)); });
  if (g.precioMedio > 0) preciosLinea.push(Number(g.precioMedio));
  if (g.tipo === 'acum' && g.precioMedio > 0 && g.objetivoBps > 0) {
    preciosLinea.push(Number(g.precioMedio) * (1 + Number(g.objetivoBps) / 10000));
  }

  const velasSerie = chart.addCandlestickSeries({
    upColor: '#2ee86a', downColor: '#f6465d',
    borderUpColor: '#2ee86a', borderDownColor: '#f6465d',
    wickUpColor: '#2ee86a', wickDownColor: '#f6465d',
    priceFormat: { type: 'price', precision: dec, minMove: Math.pow(10, -dec) },
    // La escala se estira para que quepan las velas Y todas nuestras líneas.
    autoscaleInfoProvider: (original) => {
      const base = original();
      if (preciosLinea.length === 0) return base;
      // Incluimos las líneas, pero SIN aplastar las velas: si alguna está muy
      // lejos (p. ej. un objetivo de venta muy alto), estiramos como mucho el
      // doble del recorrido de las velas. Antes el gráfico se quedaba plano.
      let min = Math.min(...preciosLinea), max = Math.max(...preciosLinea);
      if (base && base.priceRange) {
        const vMin = base.priceRange.minValue, vMax = base.priceRange.maxValue;
        const alto = Math.max(vMax - vMin, Math.abs(vMax) * 0.005);
        const tope = alto * 2.2;                       // hasta aquí estiramos
        min = Math.max(Math.min(min, vMin), vMin - tope);
        max = Math.min(Math.max(max, vMax), vMax + tope);
      }
      const aire = (max - min) * 0.05 || Math.abs(max) * 0.01;
      return { priceRange: { minValue: min - aire, maxValue: max + aire } };
    }
  });
  velasSerie.setData(datos);

  /* ══════════ MARCAS EN SU PRECIO EXACTO ══════════
     OJO: las "marcas" normales de esta librería se colocan por TIEMPO, encima
     o debajo de la vela, NO en un precio concreto. Si se usan para señalar un
     precio, la marca no coincide con su línea horizontal y el gráfico miente.
     Por eso usamos puntos de una serie de precio: van a la coordenada exacta
     (momento + precio), así que SIEMPRE caen sobre su línea.               */
  const puntos = (datosPuntos, color, radio) => {
    if (!datosPuntos.length) return null;
    try {
      const ser = chart.addLineSeries({
        color, lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: radio,
        lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        autoscaleInfoProvider: () => null           // no toca la escala
      });
      ser.setData(datosPuntos);
      return ser;
    } catch (_) { return null; }
  };
  // Un mismo momento no puede repetirse en una serie: nos quedamos con el último.
  const limpiar = (arr) => {
    const m = new Map();
    arr.filter((x) => x && x.time > 0 && isFinite(x.value) && x.value > 0)
       .forEach((x) => m.set(x.time, x));
    return [...m.values()].sort((a, b) => a.time - b.time);
  };

  const ops = (g.operaciones || []).filter((o) => o && o.tiempo > 0 && Number(o.precio) > 0);
  puntos(limpiar(ops.filter((o) => o.compra).map((o) => ({ time: Math.floor(o.tiempo), value: Number(o.precio) }))), '#2ee86a', 4);
  puntos(limpiar(ops.filter((o) => !o.compra).map((o) => ({ time: Math.floor(o.tiempo), value: Number(o.precio) }))), '#f6465d', 4);

  // El punto de entrada va EXACTAMENTE en su precio, el mismo de la línea dorada.
  const precioEntrada = Number(g.precioMedio) > 0 ? Number(g.precioMedio) : 0;
  if (g.creado > 0 && precioEntrada > 0) {
    puntos([{ time: Math.floor(g.creado), value: precioEntrada }], '#E8B84B', 5);
  }

  /* Las flechas de compra/venta SÍ van encima y debajo de la vela, que es lo
     habitual en cualquier gráfico de trading: ahí no señalan un precio, marcan
     el momento. Y el precio exacto lo da el punto de arriba. */
  const marcas = [];
  for (const o of ops) {
    marcas.push({
      time: Math.floor(o.tiempo),
      position: o.compra ? 'belowBar' : 'aboveBar',
      color: o.compra ? '#2ee86a' : '#f6465d',
      shape: o.compra ? 'arrowUp' : 'arrowDown',
      text: (o.compra ? 'compró ' : 'vendió ') + Number(o.precio).toFixed(dec)
    });
  }
  if (marcas.length) {
    marcas.sort((a, b) => a.time - b.time);
    try { velasSerie.setMarkers(marcas); } catch (_) {}
  }

  /* Nota: aquí hubo una "banda del rango" con un área dorada translúcida.
     Se quitó: el relleno bajaba hasta el suelo del gráfico y se veía como un
     rectángulo amarillo raro que no explicaba nada. El rango ya se entiende
     por las líneas de las cuadrículas, que es lo que el usuario mira. */

  if (marcas.length) {
    marcas.sort((a, b) => a.time - b.time);
    try { velasSerie.setMarkers(marcas); } catch (_) {}
  }

  // ── Las cuadrículas: pegadas al precio, se mueven con el gráfico ──
  const esCash = g.tipo === 'cash';
  for (const nv of g.niveles) {
    const compra = nv.estado === 1;
    const espera = nv.estado !== 1 && nv.estado !== 2;
    // En Cash Out la venta ES el objetivo de ganancia: se llama Take Profit y va en verde.
    const tp = esCash && !compra && !espera;
    velasSerie.createPriceLine({
      price: Number(nv.precio),
      color: compra ? 'rgba(46,232,106,.85)' : (espera ? 'rgba(255,255,255,.28)' : (tp ? '#34d97b' : 'rgba(246,70,93,.8)')),
      lineWidth: tp ? 2 : 1,
      lineStyle: tp ? LineStyle.Solid : LineStyle.Dashed,
      axisLabelVisible: true,
      title: compra ? 'compra' : (espera ? '' : (tp ? 'Take Profit' : 'vende'))
    });
  }

  // ── DCA: los precios a los que ya compró ──
  for (const pc of (g.compras || [])) {
    velasSerie.createPriceLine({
      price: Number(pc),
      color: 'rgba(77,159,255,.7)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: 'compró'
    });
  }

  // ── Acumulador: dónde vende TODO de golpe (tu objetivo de salida) ──
  if (g.tipo === 'acum' && g.precioMedio > 0 && g.objetivoBps > 0) {
    const pct = Number(g.objetivoBps) / 100;                 // 500 bps = 5%
    const salida = Number(g.precioMedio) * (1 + pct / 100);
    velasSerie.createPriceLine({
      price: salida,
      color: '#34d97b',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `vende todo (+${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%)`
    });
  }

  // ── Tu precio de entrada: la línea dorada, la referencia que no se pierde ──
  if (g.precioMedio > 0) {
    velasSerie.createPriceLine({
      price: Number(g.precioMedio),
      color: '#E8B84B',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: 'tu entrada'
    });
  }

  // Encaje inicial: que se vean las cuadrículas y algo de historia.
  chart.timeScale().fitContent();
  const ro = new ResizeObserver(() => chart.applyOptions({ width: host.clientWidth, height: host.clientHeight }));
  ro.observe(host);
  chart.applyOptions({ width: host.clientWidth, height: host.clientHeight });

  // Botones de temporalidad
  const pie = $(g.id + '-pie');
  if (pie && !pie.dataset.tf) {
    pie.dataset.tf = '1';
    const tf = document.createElement('div');
    tf.className = 'lw-tf';
    tf.innerHTML = ['1h', '4h', '1d', '1w'].map((t) => `<button data-tf="${t}" class="${t === '1d' ? 'on' : ''}">${t}</button>`).join('');
    pie.after(tf);
    tf.querySelectorAll('[data-tf]').forEach((b) => b.onclick = async () => {
      tf.querySelectorAll('[data-tf]').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      try {
        velasSerie.setData(await velas(g.sym, b.getAttribute('data-tf'), 300));
        chart.timeScale().fitContent();
      } catch (_) {}
    });
  }
}
