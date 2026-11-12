/* modules/footprint/analista.js — El analista de Footprint Pro (Jesús).

   Lee el flujo de órdenes (footprint) y devuelve una lectura profesional en
   lenguaje simple: absorción, divergencias, imbalances apilados y quién manda
   por delta/CVD. Mismo formato bilingüe { en, es } y la misma forma de salida
   que el analista de VWAP Pro (vwap-analista.js), para reutilizar su píldora.

   Nada inventado: cada frase sale de lo que el motor ya calculó sobre trades
   reales. Siempre da una lectura (el flujo siempre dice algo); nunca "no hay nada".

   Español SIN guiones (regla del proyecto). */

const dos = (en, es) => ({ en, es });
function fmtN(x) {
  if (!isFinite(x)) return '0';
  const a = Math.abs(x);
  const d = a >= 1000 ? 2 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtV(v) { const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v.toFixed(2); }
const signo = (x) => (x >= 0 ? '+' : '−') + fmtV(Math.abs(x));

/**
 * @param agg  salida del motor: { candles, cvd, divergences, absorciones, stacked }
 * @param meta { par, tf, last }
 * @returns { clave, tipo, titulo, txt, hacer, detalle } o null
 */
export function leerFootprint(agg, meta) {
  if (!agg || !agg.candles || agg.candles.length < 3) return null;
  const cs = agg.candles;
  const ult = cs[cs.length - 1];
  const par = (meta && meta.par) || '';
  const tf = (meta && meta.tf) || '';
  const last = (meta && meta.last) || ult.c;

  // Delta de sesión (lo visible) y pendiente del CVD
  let buyS = 0, sellS = 0; for (const c of cs) { buyS += c.buyTot; sellS += c.sellTot; }
  const deltaS = buyS - sellS;
  const cvd = agg.cvd || [];
  const cvdNow = cvd.length ? cvd[cvd.length - 1].v : 0;
  const kBack = Math.min(cvd.length - 1, 8);
  const cvdPrev = cvd.length > kBack ? cvd[cvd.length - 1 - kBack].v : 0;
  const cvdSlope = cvdNow - cvdPrev;
  const escala = Math.max(1e-9, (buyS + sellS) / Math.max(1, cs.length));
  const subeCVD = cvdSlope > escala * 0.5, bajaCVD = cvdSlope < -escala * 0.5;

  const detalleBase = () => [
    dos(`${par ? par + ' · ' : ''}${tf ? tf + ' · ' : ''}live order flow read`, `${par ? par + ' · ' : ''}${tf ? tf + ' · ' : ''}lectura del flujo en vivo`),
    dos(`Last candle delta: ${signo(ult.delta)} (buy ${fmtV(ult.buyTot)} · sell ${fmtV(ult.sellTot)})`, `Delta de la última vela: ${signo(ult.delta)} (compra ${fmtV(ult.buyTot)} · venta ${fmtV(ult.sellTot)})`),
    dos(`Session delta: ${signo(deltaS)}`, `Delta de la sesión: ${signo(deltaS)}`),
    dos(`CVD: ${fmtV(cvdNow)} (${cvdSlope >= 0 ? 'rising' : 'falling'} over ${kBack} candles)`, `CVD: ${fmtV(cvdNow)} (${cvdSlope >= 0 ? 'subiendo' : 'bajando'} en ${kBack} velas)`),
    ult.poc != null ? dos(`Last POC (control): ${fmtN(ult.poc)}`, `POC de la última vela (control): ${fmtN(ult.poc)}`) : dos('', ''),
    dos('Footprint reads who is aggressive: buyers lift the ask, sellers hit the bid.', 'El footprint lee quién es agresor: el comprador levanta la oferta, el vendedor golpea la demanda.')
  ].filter((x) => x.en || x.es);

  // ── 1) ABSORCIÓN en la última vela (lo más accionable) ──────────────
  const absU = (agg.absorciones || []).filter((a) => a.t === ult.t && (a.strength || 0) >= 0.45);   // solo absorciones claras, no cualquier ruido
  if (absU.length) {
    const a = absU[0];
    if (a.side === 'sell') {   // venta agresiva absorbida, el precio no bajó → comprador grande
      return {
        clave: 'abs-buy-' + ult.t, tipo: 'compra',
        titulo: dos(`Buyer absorption at ${fmtN(a.price)}`, `Absorción compradora en ${fmtN(a.price)}`),
        txt: dos(`Heavy aggressive selling hit this level and price did NOT drop: a large passive buyer is absorbing it at ${fmtN(a.price)}. Sellers are spending size and getting nothing. While that floor holds, downside is capped.`,
          `Entró venta agresiva fuerte en este nivel y el precio NO bajó: hay un comprador grande absorbiéndola en ${fmtN(a.price)}. El vendedor gasta tamaño y no consigue nada. Mientras ese piso aguante, la caída está tapada.`),
        hacer: dos(`Look for longs leaning on ${fmtN(a.price)}, stop just below. The read invalidates if price closes clearly under it.`,
          `Busca largos apoyados en ${fmtN(a.price)}, stop justo por debajo. La lectura se invalida si el precio cierra claramente por debajo.`),
        detalle: detalleBase()
      };
    }
    return {                   // compra agresiva absorbida, el precio no subió → vendedor grande
      clave: 'abs-sell-' + ult.t, tipo: 'venta',
      titulo: dos(`Seller absorption at ${fmtN(a.price)}`, `Absorción vendedora en ${fmtN(a.price)}`),
      txt: dos(`Heavy aggressive buying hit this level and price did NOT rise: a large passive seller is capping it at ${fmtN(a.price)}. Buyers are spending size and getting nowhere. While that ceiling holds, upside is capped.`,
        `Entró compra agresiva fuerte en este nivel y el precio NO subió: hay un vendedor grande tapando en ${fmtN(a.price)}. El comprador gasta tamaño y no avanza. Mientras ese techo aguante, la subida está tapada.`),
      hacer: dos(`Look for shorts against ${fmtN(a.price)}, stop just above. The read invalidates if price closes clearly over it.`,
        `Busca cortos contra ${fmtN(a.price)}, stop justo por encima. La lectura se invalida si el precio cierra claramente por encima.`),
      detalle: detalleBase()
    };
  }

  // ── 2) DIVERGENCIA reciente precio vs CVD ───────────────────────────
  const divU = (agg.divergences || []).filter((d) => d.t === ult.t || d.t === (cs[cs.length - 2] || {}).t);
  if (divU.length) {
    const d = divU[divU.length - 1];
    if (d.kind === 'bear') return {
      clave: 'div-bear-' + d.t, tipo: 'aviso',
      titulo: dos('Bearish CVD divergence', 'Divergencia bajista en el CVD'),
      txt: dos(`Price printed a higher high but the CVD did not follow: the push up has no aggressive buying behind it. That is a hollow rally, the kind that fails.`,
        `El precio marcó un máximo más alto pero el CVD no acompañó: el empuje al alza no tiene compra agresiva detrás. Es una subida hueca, de las que fallan.`),
      hacer: dos(`Be careful chasing longs here. Losing the last POC ${ult.poc != null ? 'at ' + fmtN(ult.poc) + ' ' : ''}confirms the turn.`,
        `Cuidado con perseguir largos aquí. Perder el último POC ${ult.poc != null ? 'en ' + fmtN(ult.poc) + ' ' : ''}confirma el giro.`),
      detalle: detalleBase()
    };
    return {
      clave: 'div-bull-' + d.t, tipo: 'compra',
      titulo: dos('Bullish CVD divergence', 'Divergencia alcista en el CVD'),
      txt: dos(`Price printed a lower low but the CVD held up: the drop has no aggressive selling behind it. Sellers are exhausting, a bounce is building.`,
        `El precio marcó un mínimo más bajo pero el CVD aguantó: la caída no tiene venta agresiva detrás. El vendedor se está agotando, se arma un rebote.`),
      hacer: dos(`Look for longs on the reclaim${ult.poc != null ? ' of ' + fmtN(ult.poc) : ''}, not on the new low.`,
        `Busca largos en la recuperación${ult.poc != null ? ' de ' + fmtN(ult.poc) : ''}, no en el nuevo mínimo.`),
      detalle: detalleBase()
    };
  }

  // ── 3) ZONA DE IMBALANCES APILADOS recién formada ───────────────────
  const stkU = (agg.stacked || []).filter((s) => s.fromT === ult.t || s.fromT === (cs[cs.length - 2] || {}).t);
  if (stkU.length) {
    const s = stkU[stkU.length - 1];
    if (s.side === 'buy') return {
      clave: 'stk-buy-' + s.fromT + '-' + Math.round(s.yLo), tipo: 'tendencia',
      titulo: dos(`Stacked buy imbalances ${fmtN(s.yLo)} to ${fmtN(s.yHi)}`, `Imbalances de compra apilados ${fmtN(s.yLo)} a ${fmtN(s.yHi)}`),
      txt: dos(`Three or more stacked buy imbalances: a wall of aggressive buying ran through ${fmtN(s.yLo)} to ${fmtN(s.yHi)}. Those levels work as support from here, and the line extends right as a reference.`,
        `Tres o más imbalances de compra apilados: una pared de compra agresiva pasó por ${fmtN(s.yLo)} a ${fmtN(s.yHi)}. Esos niveles funcionan como soporte desde aquí, y la línea se extiende a la derecha como referencia.`),
      hacer: dos(`Favor longs while ${fmtN(s.yLo)} holds; losing the zone flips it to resistance.`,
        `Favorece largos mientras aguante ${fmtN(s.yLo)}; perder la zona la convierte en resistencia.`),
      detalle: detalleBase()
    };
    return {
      clave: 'stk-sell-' + s.fromT + '-' + Math.round(s.yHi), tipo: 'venta',
      titulo: dos(`Stacked sell imbalances ${fmtN(s.yLo)} to ${fmtN(s.yHi)}`, `Imbalances de venta apilados ${fmtN(s.yLo)} a ${fmtN(s.yHi)}`),
      txt: dos(`Three or more stacked sell imbalances: a wall of aggressive selling ran through ${fmtN(s.yLo)} to ${fmtN(s.yHi)}. Those levels work as resistance from here, extended right as a reference.`,
        `Tres o más imbalances de venta apilados: una pared de venta agresiva pasó por ${fmtN(s.yLo)} a ${fmtN(s.yHi)}. Esos niveles funcionan como resistencia desde aquí, extendidos a la derecha como referencia.`),
      hacer: dos(`Favor shorts while ${fmtN(s.yHi)} caps; reclaiming the zone flips it to support.`,
        `Favorece cortos mientras ${fmtN(s.yHi)} tape; recuperar la zona la convierte en soporte.`),
      detalle: detalleBase()
    };
  }

  // ── 4) POR DEFECTO: quién manda por delta/CVD ───────────────────────
  if (subeCVD && deltaS > 0) return {
    clave: 'ctrl-buy', tipo: 'tendencia',
    titulo: dos('Buyers in control', 'Manda el comprador'),
    txt: dos(`The cumulative delta is rising and aggressive buying dominates the session (${signo(deltaS)}). The flow is on the buy side: pullbacks are being bought.`,
      `El delta acumulado sube y la compra agresiva domina la sesión (${signo(deltaS)}). El flujo está del lado comprador: las caídas se están comprando.`),
    hacer: dos(`Favor the long side and buy dips toward the last POC${ult.poc != null ? ' ' + fmtN(ult.poc) : ''}; stand aside if the CVD rolls over.`,
      `Favorece el lado largo y compra retrocesos hacia el último POC${ult.poc != null ? ' ' + fmtN(ult.poc) : ''}; hazte a un lado si el CVD se da vuelta.`),
    detalle: detalleBase()
  };
  if (bajaCVD && deltaS < 0) return {
    clave: 'ctrl-sell', tipo: 'venta',
    titulo: dos('Sellers in control', 'Manda el vendedor'),
    txt: dos(`The cumulative delta is falling and aggressive selling dominates the session (${signo(deltaS)}). The flow is on the sell side: bounces are being sold.`,
      `El delta acumulado baja y la venta agresiva domina la sesión (${signo(deltaS)}). El flujo está del lado vendedor: los rebotes se están vendiendo.`),
    hacer: dos(`Favor the short side and sell bounces toward the last POC${ult.poc != null ? ' ' + fmtN(ult.poc) : ''}; stand aside if the CVD turns up.`,
      `Favorece el lado corto y vende rebotes hacia el último POC${ult.poc != null ? ' ' + fmtN(ult.poc) : ''}; hazte a un lado si el CVD gira al alza.`),
    detalle: detalleBase()
  };
  return {
    clave: 'ctrl-bal', tipo: 'vigilar',
    titulo: dos('Balanced flow', 'Flujo equilibrado'),
    txt: dos(`Buy and sell aggression are roughly matched and the CVD is flat: no one is in control. This is rotation around value, not a trend.`,
      `La compra y la venta agresivas están parejas y el CVD está plano: nadie manda. Esto es rotación alrededor del valor, no una tendencia.`),
    hacer: dos(`Trade the edges, not the middle: buy absorption at the lows, sell absorption at the highs. Wait for a delta or absorption signal before committing.`,
      `Opera los extremos, no el medio: compra la absorción en los mínimos, vende la absorción en los máximos. Espera una señal de delta o absorción antes de comprometerte.`),
    detalle: detalleBase()
  };
}
