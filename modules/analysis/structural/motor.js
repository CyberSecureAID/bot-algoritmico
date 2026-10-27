/* ══════════════════════════════════════════════════════════════
   structural/motor.js — Motor de la herramienta "Structural Logic".

   Port FIEL de las partes ACTIVAS del indicador Pine original
   ([ExagTrader] Structural logic V:1.0). Solo lo que estaba encendido:

     1) Pivotes (ta.pivothigh / ta.pivotlow con izquierda=derecha=period,
        sobre el CIERRE — en el Pine srcI por defecto es 'Close Body').
     2) Línea de RESISTENCIA: une dos máximos pivote DESCENDENTES
        (newUp = pivot high con valor menor que el anterior). Se proyecta.
     3) Línea de SOPORTE: une dos mínimos pivote ASCENDENTES
        (newLo = pivot low con valor mayor que el anterior). Se proyecta.
     4) Señal LONG: el cierre ROMPE hacia arriba la resistencia proyectada
        (close[-1] < linea[-1] y close > linea).  (Pine: breakUpper)
        Señal SHORT: el cierre rompe hacia abajo el soporte. (Pine: breakLower)
     5) Lectura MTF de RSI (Wilder, 14) + Estocástico (%K, 14).

   NO se porta lo que el autor dejó transparente/apagado: zigzag,
   etiquetas S1–S3/R1–R3, panel viejo y tabla de contacto.

   Este archivo es PURO (sin DOM): se puede probar en node.
   ══════════════════════════════════════════════════════════════ */

export const PERIODO = 10;   // gr5 period = 10 (Período de línea de tendencia)

/* ---------- Pivotes sobre el cierre ----------
   Un máximo pivote está en el centro c si close[c] es estrictamente
   mayor que los `period` cierres a cada lado. Se CONFIRMA `period`
   barras después (igual que Pine, sin mirar al futuro). */
export function pivotes(velas, period = PERIODO) {
  const n = velas.length, H = [], L = [];
  for (let c = period; c < n - period; c++) {
    const v = velas[c].c;
    let esH = true, esL = true;
    for (let k = 1; k <= period; k++) {
      if (!(v > velas[c - k].c) || !(v > velas[c + k].c)) esH = false;
      if (!(v < velas[c - k].c) || !(v < velas[c + k].c)) esL = false;
      if (!esH && !esL) break;
    }
    if (esH) H.push({ bar: c, price: v, conf: c + period });
    if (esL) L.push({ bar: c, price: v, conf: c + period });
  }
  return { H, L };
}

/* Valor de una línea {x1,y1,x2,y2} proyectada al índice de barra b. */
export function valorLinea(ln, b) {
  const dx = (ln.x2 - ln.x1) || 1;
  return ln.y2 + ((ln.y2 - ln.y1) / dx) * (b - ln.x2);
}

/* ---------- RSI de Wilder (14), serie alineada a las velas ---------- */
export function rsi(velas, periodo = 14) {
  const n = velas.length, out = new Array(n).fill(NaN);
  if (n < periodo + 1) return out;
  let g = 0, p = 0;
  for (let i = 1; i <= periodo; i++) { const d = velas[i].c - velas[i - 1].c; g += Math.max(0, d); p += Math.max(0, -d); }
  g /= periodo; p /= periodo;
  out[periodo] = p === 0 ? 100 : 100 - 100 / (1 + g / p);
  for (let i = periodo + 1; i < n; i++) {
    const d = velas[i].c - velas[i - 1].c;
    g = (g * (periodo - 1) + Math.max(0, d)) / periodo;
    p = (p * (periodo - 1) + Math.max(0, -d)) / periodo;
    out[i] = p === 0 ? 100 : 100 - 100 / (1 + g / p);
  }
  return out;
}

/* ---------- EMA (media exponencial), serie causal (solo pasado) ---------- */
export function ema(velas, periodo = 50) {
  const n = velas.length, out = new Array(n).fill(NaN);
  if (!n) return out;
  const k = 2 / (periodo + 1); let e = velas[0].c; out[0] = e;
  for (let i = 1; i < n; i++) { e = velas[i].c * k + e * (1 - k); out[i] = e; }
  return out;
}

/* ---------- ATR (rango verdadero medio), para stops por volatilidad ---------- */
export function atr(velas, periodo = 14) {
  const n = velas.length, out = new Array(n).fill(NaN);
  if (n < 2) return out;
  const tr = (i) => Math.max(velas[i].h - velas[i].l, Math.abs(velas[i].h - velas[i - 1].c), Math.abs(velas[i].l - velas[i - 1].c));
  let a = 0; const m = Math.min(periodo, n - 1);
  for (let i = 1; i <= m; i++) a += tr(i);
  a /= m; out[m] = a;
  for (let i = m + 1; i < n; i++) { a = (a * (periodo - 1) + tr(i)) / periodo; out[i] = a; }
  return out;
}

/* ---------- Estocástico %K (14), último valor ---------- */
export function stoch(velas, periodo = 14) {
  const n = velas.length;
  if (n < periodo) return NaN;
  let hi = -Infinity, lo = Infinity;
  for (let i = n - periodo; i < n; i++) { if (velas[i].h > hi) hi = velas[i].h; if (velas[i].l < lo) lo = velas[i].l; }
  if (hi === lo) return 50;
  return (100 * (velas[n - 1].c - lo)) / (hi - lo);
}

/* ---------- Reagrupar velas a una temporalidad mayor (factor x) ---------- */
export function reagrupar(velas, factor) {
  if (factor <= 1) return velas.slice();
  const out = [];
  for (let i = 0; i < velas.length; i += factor) {
    const g = velas.slice(i, i + factor);
    if (!g.length) break;
    let h = -Infinity, l = Infinity, v = 0;
    for (const x of g) { if (x.h > h) h = x.h; if (x.l < l) l = x.l; v += x.v || 0; }
    out.push({ t: g[0].t, o: g[0].o, h, l, c: g[g.length - 1].c, v });
  }
  return out;
}

const estadoMom = (x) => (x >= 80 ? 'sobrecompra' : x <= 20 ? 'sobreventa' : 'estable');

/* Lectura de momento en varias temporalidades (reagrupando la serie base). */
export function momentoMTF(velas, factores = [1, 4, 12]) {
  return factores.map((f) => {
    const s = reagrupar(velas, f);
    const r = rsi(s), rl = r.length ? r[r.length - 1] : NaN;
    const k = stoch(s);
    return { factor: f, barras: s.length, rsi: rl, stoch: k, rsiEstado: estadoMom(rl), stochEstado: estadoMom(k) };
  });
}

/* ══════════════════════════════════════════════════════════════
   Análisis completo de una serie de velas.
   Devuelve las líneas activas, TODAS las señales históricas, el
   sesgo estructural actual y lo necesario para dibujar.
   ══════════════════════════════════════════════════════════════ */
export function analizar(velas, opts = {}) {
  const period = opts.period || PERIODO;
  const n = velas.length;
  const { H, L } = pivotes(velas, period);

  // Eventos de línea: cada vez que un pivote nuevo es "peor" que el previo
  // en la dirección que define la tendencia rota del indicador.
  const upEv = [], loEv = [];   // up = resistencia (máximos descendentes), lo = soporte (mínimos ascendentes)
  for (let i = 1; i < H.length; i++) {
    if (H[i].price < H[i - 1].price) upEv.push({ conf: H[i].conf, line: { x1: H[i - 1].bar, y1: H[i - 1].price, x2: H[i].bar, y2: H[i].price } });
  }
  for (let i = 1; i < L.length; i++) {
    if (L[i].price > L[i - 1].price) loEv.push({ conf: L[i].conf, line: { x1: L[i - 1].bar, y1: L[i - 1].price, x2: L[i].bar, y2: L[i].price } });
  }

  // Barrido barra a barra con la línea ACTIVA en cada momento (sin lookahead).
  let ui = 0, li = 0, curU = null, curL = null;
  const senales = [];
  for (let b = 0; b < n; b++) {
    while (ui < upEv.length && upEv[ui].conf <= b) { curU = upEv[ui].line; ui++; }
    while (li < loEv.length && loEv[li].conf <= b) { curL = loEv[li].line; li++; }
    if (b > 0 && curU) {
      const a = valorLinea(curU, b - 1), q = valorLinea(curU, b);
      if (velas[b - 1].c < a && velas[b].c > q) senales.push({ bar: b, t: velas[b].t, price: velas[b].c, tipo: 'LONG', nivel: q });
    }
    if (b > 0 && curL) {
      const a = valorLinea(curL, b - 1), q = valorLinea(curL, b);
      if (velas[b - 1].c > a && velas[b].c < q) senales.push({ bar: b, t: velas[b].t, price: velas[b].c, tipo: 'SHORT', nivel: q });
    }
  }

  // Flips crudos: UNA señal por giro de estructura (no cada micro-ruptura).
  const flipsCrudos = [];
  let dir = null;
  for (const s of senales) { if (s.tipo !== dir) { flipsCrudos.push(s); dir = s.tipo; } }
  // Filtro de TENDENCIA (causal, no repinta): solo LONG con el cierre sobre la
  // EMA lenta y SHORT por debajo. Quita los giros a contratendencia (el whipsaw
  // que hace perder). opts.filtro = 'trend' (por defecto) | 'none'.
  const filtro = opts.filtro || 'trend';
  const te = ema(velas, opts.emaLen || 50);
  const flips = (filtro === 'trend')
    ? flipsCrudos.filter((s) => (s.tipo === 'LONG' ? velas[s.bar].c >= te[s.bar] : velas[s.bar].c <= te[s.bar]))
    : flipsCrudos.slice();
  const ultima = flips.length ? flips[flips.length - 1] : null;
  const precio = n ? velas[n - 1].c : 0;

  // Sesgo estructural actual, en lenguaje de la herramienta.
  let sesgo = 'rango';
  if (ultima) {
    if (ultima.tipo === 'LONG' && precio >= ultima.nivel) sesgo = 'alcista';
    else if (ultima.tipo === 'SHORT' && precio <= ultima.nivel) sesgo = 'bajista';
    else sesgo = 'mixto';
  }

  // Niveles proyectados de las líneas activas al último índice (para el panel).
  const resistenciaHoy = curU ? valorLinea(curU, n - 1) : null;
  const soporteHoy = curL ? valorLinea(curL, n - 1) : null;

  return {
    period, n, precio,
    pivotsH: H, pivotsL: L,
    resistencia: curU, soporte: curL,
    resistenciaHoy, soporteHoy,
    senales, flips, flipsCrudos, ultima, sesgo,
    valorLinea
  };
}

/* ══════════════════════════════════════════════════════════════
   backtest — mide el sistema como se operaría de verdad, SIN mirar al
   futuro: entra en el cierre de cada señal, con el stop en el nivel roto
   (si el precio vuelve a cruzarlo, la idea quedó invalidada), y sale al
   giro opuesto. Devuelve win rate, profit factor, expectativa en R y la
   lista de operaciones para auditar una por una.
   R = resultado / riesgo. Expectativa > 0 en R = sistema con ventaja.
   ══════════════════════════════════════════════════════════════ */
export function backtest(velas, opts = {}) {
  const E = analizar(velas, opts);
  const flips = E.flips;
  const at = atr(velas, opts.atr || 14);
  const kStop = opts.kStop || 1.5;              // stop = 1.5 x ATR (riesgo por volatilidad real)
  const trades = [];
  for (let i = 0; i < flips.length; i++) {
    const s = flips[i], esLong = s.tipo === 'LONG';
    const entry = s.price;
    const a = isFinite(at[s.bar]) && at[s.bar] > 0 ? at[s.bar] : entry * 0.01;
    const risk = kStop * a;
    const next = flips[i + 1];
    const exitBar = next ? next.bar : velas.length - 1;
    if (exitBar <= s.bar) continue;
    const exit = velas[exitBar].c;
    const move = esLong ? (exit - entry) : (entry - exit);
    trades.push({ tipo: s.tipo, bar: s.bar, entry, exit, R: move / risk, retPct: (move / entry) * 100, barras: exitBar - s.bar });
  }
  const n = trades.length;
  const wins = trades.filter((t) => t.retPct > 0), losses = trades.filter((t) => t.retPct <= 0);
  const sumWinPct = wins.reduce((a, t) => a + t.retPct, 0), sumLossPct = Math.abs(losses.reduce((a, t) => a + t.retPct, 0));
  const sumR = trades.reduce((a, t) => a + t.R, 0);
  let eq = 1; for (const t of trades) eq *= (1 + t.retPct / 100);   // retorno compuesto (reversión siempre en mercado)
  const avgWinPct = wins.length ? sumWinPct / wins.length : 0, avgLossPct = losses.length ? sumLossPct / losses.length : 0;
  return {
    n, ganados: wins.length, perdidos: losses.length,
    winRate: n ? (wins.length / n) * 100 : 0,
    pf: sumLossPct > 0 ? sumWinPct / sumLossPct : (sumWinPct > 0 ? Infinity : 0),
    expectativaR: n ? sumR / n : 0,
    retornoTotal: (eq - 1) * 100,
    avgWinPct, avgLossPct,
    avgRR: avgLossPct > 0 ? avgWinPct / avgLossPct : 0,
    trades
  };
}
