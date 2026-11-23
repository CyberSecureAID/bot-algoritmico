/* modules/footprint/motor-core.js
   MOTOR del footprint (cálculo puro, sin DOM ni red). Vive aquí para poder
   probarlo por separado (node) y para servir de respaldo si el Web Worker no
   está disponible. El worker (motor.worker.js) solo lo envuelve.

   Entra: velas + trades individuales ya descargados por el hilo principal.
   Sale: por cada vela, sus celdas por nivel de precio (compra × venta),
   POC, delta, total, imbalances diagonales (apilados) y absorción; más la
   serie CVD acumulada y las divergencias precio/CVD.

   Convención de trade: m (isBuyerMaker) true → VENTA (agresor vendedor, golpea
   el bid); false → COMPRA (agresor comprador, levanta el ask). */

/* Paso "bonito" (1 / 2 / 5 × 10^n) cercano a x. */
export function niceStep(x) {
  if (!(x > 0)) return 1;
  const exp = Math.floor(Math.log10(x));
  const mant = x / Math.pow(10, exp);
  const nice = mant < 1.5 ? 1 : mant < 3.5 ? 2 : mant < 7.5 ? 5 : 10;
  return nice * Math.pow(10, exp);
}

/* Paso por magnitud de precio (~1%). Respaldo si no hay velas. */
export function pasoAuto(precio) { return niceStep((Math.abs(precio) || 1) / 100); }

/* Paso AUTO del footprint: basado en el rango típico de las velas para dar
   ~14 filas por vela (granularidad profesional), no en el precio absoluto. */
export function pasoAutoVelas(velas, trades) {
  const rangos = (velas || []).map((v) => v.h - v.l).filter((r) => r > 0).sort((a, b) => a - b);
  if (rangos.length) return niceStep(rangos[Math.floor(rangos.length / 2)] / 14);
  const refP = (velas && velas.length) ? velas[velas.length - 1].c
    : ((trades && trades.length) ? trades[trades.length - 1].p : 1);
  return pasoAuto(refP);
}

/* Nivel (precio del borde inferior del bin) que contiene a p. */
function nivel(p, paso) { return Math.round(Math.floor(p / paso) * paso * 1e8) / 1e8; }

export function computar(job) {
  const velas = job.candles || [];
  const trades = job.trades || [];
  const imbRatio = job.imbRatio || 3;          // 300%
  const imbStack = job.imbStack || 3;          // 3 seguidos = apilado
  const absorbMult = job.absorbMult || 2.5;

  // Paso de precio (bin). Auto por rango de velas si no lo fija el usuario.
  let paso = +job.binSize;
  if (!paso || paso <= 0) paso = pasoAutoVelas(velas, trades);

  // Índice de velas por tiempo de inicio, para repartir cada trade.
  const idxPorT = new Map();
  velas.forEach((v, i) => idxPorT.set(v.t, i));
  const tfms = job.tfMs || (velas.length > 1 ? (velas[1].t - velas[0].t) : 60e3);
  const inicioVela = (T) => {
    // alineado al epoch como Binance (semanal lo alinea el hilo principal al pasar velas)
    return Math.floor(T / tfms) * tfms;
  };

  // Acumuladores de celdas por vela: Map nivel → {buy, sell}
  const celdas = velas.map(() => new Map());

  for (let k = 0; k < trades.length; k++) {
    const tr = trades[k];
    let i = idxPorT.get(inicioVela(tr.T));
    if (i == null) {
      // trade fuera de la rejilla exacta (semanal u holgura): asigna a la vela cuyo rango lo contiene
      i = buscarVela(velas, tr.T, tfms);
      if (i < 0) continue;
    }
    const mapa = celdas[i];
    const y = nivel(tr.p, paso);
    let c = mapa.get(y);
    if (!c) { c = { buy: 0, sell: 0 }; mapa.set(y, c); }
    if (tr.m) c.sell += tr.q; else c.buy += tr.q;
  }

  let priceMin = Infinity, priceMax = -Infinity, maxCellVol = 0, maxDelta = 0;
  const outVelas = [];
  const cvd = [];
  let acum = 0;

  for (let i = 0; i < velas.length; i++) {
    const v = velas[i];
    const mapa = celdas[i];
    // bins ordenados de menor a mayor precio
    const niveles = [...mapa.keys()].sort((a, b) => a - b);
    const bins = [];
    let buyTot = 0, sellTot = 0, poc = null, pocVol = -1;
    for (const y of niveles) {
      const c = mapa.get(y);
      const vol = c.buy + c.sell;
      buyTot += c.buy; sellTot += c.sell;
      if (vol > pocVol) { pocVol = vol; poc = y; }
      if (vol > maxCellVol) maxCellVol = vol;
      bins.push({ y, buy: c.buy, sell: c.sell, imb: 0, stk: false });
      if (y < priceMin) priceMin = y;
      if (y + paso > priceMax) priceMax = y + paso;
    }

    // ── Imbalances diagonales ──
    // bins[j] contra el bin de ABAJO (j-1) para compra, y el de ARRIBA (j+1) para venta.
    const umbralCelda = maxCellVol * 0.04;   // ignora ruido muy pequeño
    for (let j = 0; j < bins.length; j++) {
      const abajo = bins[j - 1], arriba = bins[j + 1];
      // compra (ask) de este nivel vs venta (bid) del de abajo
      if (bins[j].buy >= umbralCelda) {
        const ref = abajo ? abajo.sell : 0;
        if (ref === 0 ? bins[j].buy >= maxCellVol * 0.12 : bins[j].buy >= imbRatio * ref) bins[j].imb = 1;
      }
      // venta (bid) de este nivel vs compra (ask) del de arriba
      if (bins[j].imb === 0 && bins[j].sell >= umbralCelda) {
        const ref = arriba ? arriba.buy : 0;
        if (ref === 0 ? bins[j].sell >= maxCellVol * 0.12 : bins[j].sell >= imbRatio * ref) bins[j].imb = 2;
      }
    }
    // apilados: 3+ seguidos del mismo lado
    marcarApilados(bins, imbStack);

    const delta = buyTot - sellTot;
    const total = buyTot + sellTot;
    if (Math.abs(delta) > maxDelta) maxDelta = Math.abs(delta);
    acum += delta;
    cvd.push({ t: v.t, v: acum });

    // ── Absorción: un nivel muy cargado cerca de un extremo y cuerpo pequeño ──
    const absorb = detectarAbsorcion(bins, v, pocVol, absorbMult);

    outVelas.push({
      t: v.t, o: v.o, h: v.h, l: v.l, c: v.c,
      bins, poc, delta, total, buyTot, sellTot, absorb
    });
  }

  // encuadre de precio: respeta también los extremos de las velas
  for (const v of velas) { if (v.l < priceMin) priceMin = v.l; if (v.h > priceMax) priceMax = v.h; }
  if (!isFinite(priceMin)) { priceMin = 0; priceMax = 1; }

  const divergencias = detectarDivergencias(outVelas, cvd);

  return {
    binSize: paso, priceMin, priceMax, maxCellVol, maxDelta,
    candles: outVelas, cvd, divergences: divergencias
  };
}

function buscarVela(velas, T, tfms) {
  // búsqueda directa: vela cuyo [t, t+tfms) contiene T
  for (let i = velas.length - 1; i >= 0; i--) { if (T >= velas[i].t && T < velas[i].t + tfms) return i; }
  return -1;
}

function marcarApilados(bins, minRun) {
  let j = 0;
  while (j < bins.length) {
    const d = bins[j].imb;
    if (d === 0) { j++; continue; }
    let k = j;
    while (k < bins.length && bins[k].imb === d) k++;
    if (k - j >= minRun) for (let z = j; z < k; z++) bins[z].stk = true;
    j = k;
  }
}

function detectarAbsorcion(bins, v, pocVol, mult) {
  if (!bins.length) return '';
  const vols = bins.map((b) => b.buy + b.sell);
  const media = vols.reduce((a, x) => a + x, 0) / vols.length || 0;
  if (media <= 0) return '';
  const rango = (v.h - v.l) || 1;
  const cuerpoPeq = Math.abs(v.c - v.o) < rango * 0.34;      // poco avance de precio
  if (!cuerpoPeq) return '';
  // ¿el nivel más cargado está en el tercio superior o inferior?
  let iMax = 0; for (let i = 1; i < bins.length; i++) if (vols[i] > vols[iMax]) iMax = i;
  if (vols[iMax] < mult * media) return '';
  const frac = bins.length > 1 ? iMax / (bins.length - 1) : 0.5;
  if (frac >= 0.66 && bins[iMax].sell >= bins[iMax].buy) return 'sell';   // venta absorbe arriba
  if (frac <= 0.34 && bins[iMax].buy >= bins[iMax].sell) return 'buy';    // compra absorbe abajo
  return '';
}

/* Divergencias precio/CVD sobre pivotes simples (ventana ±2). Marca la más
   reciente de cada tipo para no saturar. */
function detectarDivergencias(velas, cvd) {
  const n = velas.length; const out = [];
  if (n < 7) return out;
  const W = 2;
  const esPivotAlto = (i) => { for (let d = 1; d <= W; d++) if (velas[i].h <= velas[i - d].h || velas[i].h <= velas[i + d].h) return false; return true; };
  const esPivotBajo = (i) => { for (let d = 1; d <= W; d++) if (velas[i].l >= velas[i - d].l || velas[i].l >= velas[i + d].l) return false; return true; };
  const altos = [], bajos = [];
  for (let i = W; i < n - W; i++) { if (esPivotAlto(i)) altos.push(i); if (esPivotBajo(i)) bajos.push(i); }
  // bajista: precio hace alto más alto, CVD hace alto más bajo
  for (let z = altos.length - 1; z >= 1; z--) {
    const a = altos[z], b = altos[z - 1];
    if (velas[a].h > velas[b].h && cvd[a].v < cvd[b].v) { out.push({ t: velas[a].t, tipo: 'bajista' }); break; }
  }
  // alcista: precio hace bajo más bajo, CVD hace bajo más alto
  for (let z = bajos.length - 1; z >= 1; z--) {
    const a = bajos[z], b = bajos[z - 1];
    if (velas[a].l < velas[b].l && cvd[a].v > cvd[b].v) { out.push({ t: velas[a].t, tipo: 'alcista' }); break; }
  }
  return out;
}
