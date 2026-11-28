/* indicadores.js — Matemática de los indicadores de Catalyst.
 *
 * Fórmulas ESTÁNDAR, idénticas a las de cualquier plataforma seria (TC2000
 * incluido) para medias y Bollinger. El Worden Stochastics es propio de TC2000;
 * aquí va una aproximación muy cercana (estocástico suavizado con línea de señal).
 *
 * Todas reciben un array de velas [{time,open,high,low,close,volume}] y devuelven
 * arrays alineados por índice ({time,value}), con null donde aún no hay datos
 * suficientes (lightweight-charts los ignora y no dibuja esos puntos).
 */

/* Media móvil simple de `p` periodos sobre el cierre. */
export function sma(velas, p) {
  const out = []; let suma = 0;
  for (let i = 0; i < velas.length; i++) {
    suma += velas[i].close;
    if (i >= p) suma -= velas[i - p].close;
    out.push(i >= p - 1 ? { time: velas[i].time, value: suma / p } : { time: velas[i].time, value: null });
  }
  return out;
}

/* Bollinger: media de `p` (por defecto 20) ± `k` desviaciones (por defecto 2).
   Devuelve { media, alta, baja }. */
export function bollinger(velas, p = 20, k = 2) {
  const media = [], alta = [], baja = [];
  for (let i = 0; i < velas.length; i++) {
    if (i < p - 1) {
      const t = velas[i].time;
      media.push({ time: t, value: null }); alta.push({ time: t, value: null }); baja.push({ time: t, value: null });
      continue;
    }
    let s = 0; for (let j = i - p + 1; j <= i; j++) s += velas[j].close;
    const m = s / p;
    let v = 0; for (let j = i - p + 1; j <= i; j++) { const d = velas[j].close - m; v += d * d; }
    const sd = Math.sqrt(v / p);
    const t = velas[i].time;
    media.push({ time: t, value: m });
    alta.push({ time: t, value: m + k * sd });
    baja.push({ time: t, value: m - k * sd });
  }
  return { media, alta, baja };
}

/* Estocástico tipo Worden: %K sobre `n` (14), suavizado `s` (3), y una línea
   de señal (la "línea roja") %D = media de %K sobre `d` (3). Valores 0..100. */
export function worden(velas, n = 14, s = 3, d = 3) {
  const kCrudo = [];
  for (let i = 0; i < velas.length; i++) {
    if (i < n - 1) { kCrudo.push(null); continue; }
    let hi = -Infinity, lo = Infinity;
    for (let j = i - n + 1; j <= i; j++) { if (velas[j].high > hi) hi = velas[j].high; if (velas[j].low < lo) lo = velas[j].low; }
    const rango = hi - lo;
    kCrudo.push(rango === 0 ? 50 : ((velas[i].close - lo) / rango) * 100);
  }
  const suav = (arr, per) => arr.map((_, i) => {
    let sum = 0, c = 0;
    for (let j = i - per + 1; j <= i; j++) { if (j >= 0 && arr[j] != null) { sum += arr[j]; c++; } }
    return c === per ? sum / c : null;
  });
  const k = suav(kCrudo, s);           // %K suavizado (línea principal)
  const señal = suav(k.map((x) => (x == null ? null : x)), d); // %D (línea roja / señal)
  return {
    k: velas.map((v, i) => ({ time: v.time, value: k[i] })),
    señal: velas.map((v, i) => ({ time: v.time, value: señal[i] }))
  };
}

/* Tendencia por cruce de medias, para los textos de cada estrategia.
   Devuelve 'alcista' | 'bajista' | 'plana' comparando dos medias en la última vela. */
export function tendenciaCruce(velas, corta, larga) {
  const a = sma(velas, corta), b = sma(velas, larga);
  const va = a[a.length - 1] && a[a.length - 1].value;
  const vb = b[b.length - 1] && b[b.length - 1].value;
  if (va == null || vb == null) return 'plana';
  const dif = (va - vb) / vb;
  if (dif > 0.0008) return 'alcista';
  if (dif < -0.0008) return 'bajista';
  return 'plana';
}
