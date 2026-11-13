/* modules/footprint/analista.js — El analista de Footprint Pro (Jesús).

   Lee el flujo de órdenes REAL (delta de la kline + ticks en vivo, CVD, POC,
   absorción con rechazo, imbalances apilados) y devuelve una lectura de mesa:
   sesgo claro, fuerza, nivel clave y qué lo invalida. Lenguaje simple, bilingüe
   { en, es }, sin repetir siempre lo mismo (varía el fraseo) y citando solo
   precios que existen (POC, nivel de valor, zona apilada cercana).

   Nada inventado: cada frase sale de lo que el motor calculó sobre datos reales.
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
 * @param agg  { candles, cvd, divergences, absorciones, stacked }
 * @param meta { par, tf, last }
 * @returns { clave, tipo, titulo, txt, hacer, detalle } o null
 */
export function leerFootprint(agg, meta) {
  if (!agg || !agg.candles || agg.candles.length < 4) return null;
  const cs = agg.candles;
  const ult = cs[cs.length - 1];
  const par = (meta && meta.par) || '';
  const tf = (meta && meta.tf) || '';
  const last = (meta && meta.last) || ult.c;
  const idx = cs.length;                       // varía el fraseo, no repite igual
  const pick = (a) => a[idx % a.length];

  // ── Flujo REAL de la sesión ─────────────────────────────────────────
  let buyS = 0, sellS = 0; for (const c of cs) { buyS += c.buyTot; sellS += c.sellTot; }
  const deltaS = buyS - sellS;
  const buyPct = (buyS + sellS) > 0 ? Math.round((buyS / (buyS + sellS)) * 100) : 50;
  const cvd = agg.cvd || [];
  const cvdNow = cvd.length ? cvd[cvd.length - 1].v : 0;
  const kBack = Math.min(cvd.length - 1, 10);
  const cvdPrev = cvd.length > kBack ? cvd[cvd.length - 1 - kBack].v : 0;
  const cvdSlope = cvdNow - cvdPrev;
  const escala = Math.max(1e-9, (buyS + sellS) / Math.max(1, cs.length));
  const subeCVD = cvdSlope > escala * 0.4, bajaCVD = cvdSlope < -escala * 0.4;
  const poc = ult.poc != null ? ult.poc : (cs[cs.length - 2] || ult).poc;
  const nivel = poc != null ? poc : last;      // nivel clave a citar (siempre real)
  const recT = new Set(cs.slice(-3).map((c) => c.t));

  // Zona de imbalances apilados MÁS CERCANA al precio (soporte/resistencia real)
  let sr = null, srDist = Infinity;
  for (const s of (agg.stacked || [])) { const mid = (s.yLo + s.yHi) / 2, d = Math.abs(mid - last); if (d < srDist) { srDist = d; sr = s; } }
  const srCerca = sr && last > 0 && srDist / last < 0.012;

  const posTxt = (es) => {
    if (poc == null) return es ? 'El precio no tiene un valor claro todavía' : 'Price has no clear value yet';
    if (last > poc) return es ? `el precio trabaja por encima del valor (${fmtN(poc)})` : `price is working above value (${fmtN(poc)})`;
    if (last < poc) return es ? `el precio trabaja por debajo del valor (${fmtN(poc)})` : `price is working below value (${fmtN(poc)})`;
    return es ? `el precio está justo en el valor (${fmtN(poc)})` : `price is sitting right at value (${fmtN(poc)})`;
  };

  const nums = () => [
    dos(`${par ? par + ' · ' : ''}${tf} · live order flow`, `${par ? par + ' · ' : ''}${tf} · flujo en vivo`),
    dos(`Last candle delta ${signo(ult.delta)} · session ${signo(deltaS)} (${buyPct}% buy)`, `Delta de la última vela ${signo(ult.delta)} · sesión ${signo(deltaS)} (${buyPct}% compra)`),
    dos(`CVD ${signo(cvdNow)}, ${cvdSlope >= 0 ? 'rising' : 'falling'} over ${kBack} candles`, `CVD ${signo(cvdNow)}, ${cvdSlope >= 0 ? 'subiendo' : 'bajando'} en ${kBack} velas`),
    poc != null ? dos(`Point of control (value) at ${fmtN(poc)}`, `Punto de control (valor) en ${fmtN(poc)}`) : dos('', ''),
    srCerca ? dos(`Nearest stacked ${sr.side === 'buy' ? 'support' : 'resistance'} ${fmtN(sr.yLo)} to ${fmtN(sr.yHi)}`, `${sr.side === 'buy' ? 'Soporte' : 'Resistencia'} apilada más cercana ${fmtN(sr.yLo)} a ${fmtN(sr.yHi)}`) : dos('', ''),
    dos('Source: live Binance aggressive buy vs sell (taker flow).', 'Fuente: compra vs venta agresiva en vivo de Binance (flujo taker).')
  ].filter((x) => x.en || x.es);

  // ── 1) ABSORCIÓN con rechazo (lo más accionable) ────────────────────
  const absU = (agg.absorciones || []).filter((a) => recT.has(a.t) && (a.strength || 0) >= 0.5).sort((a, b) => (b.strength || 0) - (a.strength || 0));
  if (absU.length) {
    const a = absU[0];
    if (a.side === 'sell') {   // venta agresiva absorbida y cierre arriba → alcista
      return {
        clave: 'abs-buy-' + a.t, tipo: 'compra',
        titulo: dos(`Buyers absorbed the selling at ${fmtN(a.price)}`, `Los compradores absorbieron la venta en ${fmtN(a.price)}`),
        txt: dos(`Heavy aggressive selling hit ${fmtN(a.price)} and price refused to break: a large passive buyer soaked it up and the candle closed back up. Sellers spent real size for nothing, and that is a floor with intent behind it.`,
          `Entró venta agresiva fuerte en ${fmtN(a.price)} y el precio se negó a romper: un comprador grande la absorbió y la vela cerró de vuelta arriba. El vendedor gastó tamaño de verdad para nada, y eso es un piso con intención detrás.`),
        hacer: dos(`Longs make sense leaning on ${fmtN(a.price)} with a stop just below. A close under it means the buyer gave up and the read is wrong.`,
          `Los largos tienen sentido apoyados en ${fmtN(a.price)} con stop justo por debajo. Un cierre por debajo significa que el comprador soltó y la lectura falló.`),
        detalle: nums()
      };
    }
    return {   // compra agresiva absorbida y cierre abajo → bajista
      clave: 'abs-sell-' + a.t, tipo: 'venta',
      titulo: dos(`Sellers capped the buying at ${fmtN(a.price)}`, `Los vendedores taparon la compra en ${fmtN(a.price)}`),
      txt: dos(`Aggressive buyers pushed into ${fmtN(a.price)} and got stuffed: a large passive seller absorbed them and price closed back down. Buyers spent real size and got nowhere, and that is a ceiling with intent.`,
        `Los compradores agresivos empujaron en ${fmtN(a.price)} y los frenaron: un vendedor grande los absorbió y el precio cerró de vuelta abajo. El comprador gastó tamaño de verdad y no avanzó, y eso es un techo con intención.`),
      hacer: dos(`Shorts make sense against ${fmtN(a.price)} with a stop just above. A close above it invalidates the idea.`,
        `Los cortos tienen sentido contra ${fmtN(a.price)} con stop justo por encima. Un cierre por encima invalida la idea.`),
      detalle: nums()
    };
  }

  // ── 2) DIVERGENCIA precio vs CVD ────────────────────────────────────
  const divU = (agg.divergences || []).filter((d) => recT.has(d.t));
  if (divU.length) {
    const d = divU[divU.length - 1];
    if (d.kind === 'bear') return {
      clave: 'div-bear-' + d.t, tipo: 'aviso',
      titulo: dos('Rally with no buyers behind it', 'Subida sin compradores detrás'),
      txt: dos(`Price just printed a higher high but the CVD did not follow: the push up is not backed by aggressive buying, thin flow is carrying it. Moves like this are the ones that fail.`,
        `El precio marcó un máximo más alto pero el CVD no acompañó: el empuje al alza no tiene compra agresiva detrás, lo lleva un flujo flojo. Los movimientos así son los que fallan.`),
      hacer: dos(`Do not chase longs up here. Losing ${fmtN(nivel)} is the tell that the pullback has started.`,
        `No persigas largos aquí arriba. Perder ${fmtN(nivel)} es la señal de que arrancó el retroceso.`),
      detalle: nums()
    };
    return {
      clave: 'div-bull-' + d.t, tipo: 'compra',
      titulo: dos('Selloff running out of sellers', 'La caída se queda sin vendedores'),
      txt: dos(`Price just printed a lower low but the CVD held: the drop has no fresh aggressive selling behind it. Sellers are exhausting into the low, and that is where bounces get built.`,
        `El precio marcó un mínimo más bajo pero el CVD aguantó: la caída no tiene venta agresiva nueva detrás. El vendedor se agota en el mínimo, y ahí es donde se arman los rebotes.`),
      hacer: dos(`Look for the long on a reclaim of ${fmtN(nivel)}, not on the new low itself.`,
        `Busca el largo en la recuperación de ${fmtN(nivel)}, no en el nuevo mínimo.`),
      detalle: nums()
    };
  }

  // ── 3) CONTROL por acuerdo de señales (delta sesión + CVD + última vela) ──
  const lastWin = Math.sign(ult.delta), sesWin = Math.sign(deltaS), cvdWin = subeCVD ? 1 : bajaCVD ? -1 : 0;
  const acBuy = (sesWin > 0) + (cvdWin > 0) + (lastWin > 0), acSell = (sesWin < 0) + (cvdWin < 0) + (lastWin < 0);
  if (acBuy >= 2 && acBuy > acSell) {
    const fuerte = acBuy === 3;
    return {
      clave: 'ctrl-buy-' + (fuerte ? 'hi' : 'lo'), tipo: 'tendencia',
      titulo: fuerte ? pick([dos('Buyers in control', 'Manda el comprador'), dos('Order flow is long', 'El flujo es comprador'), dos('Aggressive buyers driving', 'Empujan los compradores agresivos')])
        : pick([dos('Buyers have the edge', 'El comprador lleva ventaja'), dos('Flow leans long', 'El flujo se inclina largo')]),
      txt: dos(`${buyPct}% of the aggressive volume is lifting the ask and the CVD ${subeCVD ? 'is rising' : 'is holding up'}, so ${posTxt(false)}. ${fuerte ? 'Delta, CVD and the last candle all agree: this is real demand, not noise.' : 'The lean is up, though not every read confirms it yet.'} Dips are being bought.`,
        `El ${buyPct}% del volumen agresivo levanta la oferta y el CVD ${subeCVD ? 'sube' : 'aguanta'}, así que ${posTxt(true)}. ${fuerte ? 'Delta, CVD y la última vela coinciden: es demanda real, no ruido.' : 'La inclinación es alcista, aunque aún no la confirman todas las señales.'} Las caídas se están comprando.`),
      hacer: dos(`Favor longs; buy the pullback toward ${fmtN(nivel)}${srCerca && sr.side === 'buy' ? ' and the stacked support ' + fmtN(sr.yLo) : ''}. Step aside if the CVD rolls over or delta turns negative.`,
        `Favorece largos; compra el retroceso hacia ${fmtN(nivel)}${srCerca && sr.side === 'buy' ? ' y el soporte apilado ' + fmtN(sr.yLo) : ''}. Hazte a un lado si el CVD se da vuelta o el delta se pone negativo.`),
      detalle: nums()
    };
  }
  if (acSell >= 2 && acSell > acBuy) {
    const fuerte = acSell === 3;
    return {
      clave: 'ctrl-sell-' + (fuerte ? 'hi' : 'lo'), tipo: 'venta',
      titulo: fuerte ? pick([dos('Sellers in control', 'Manda el vendedor'), dos('Order flow is short', 'El flujo es vendedor'), dos('Aggressive sellers driving', 'Empujan los vendedores agresivos')])
        : pick([dos('Sellers have the edge', 'El vendedor lleva ventaja'), dos('Flow leans short', 'El flujo se inclina corto')]),
      txt: dos(`${100 - buyPct}% of the aggressive volume is hitting the bid and the CVD ${bajaCVD ? 'is falling' : 'is heavy'}, so ${posTxt(false)}. ${fuerte ? 'Delta, CVD and the last candle all agree: this is real supply, not noise.' : 'The lean is down, though not every read confirms it yet.'} Bounces are being sold.`,
        `El ${100 - buyPct}% del volumen agresivo golpea la demanda y el CVD ${bajaCVD ? 'baja' : 'pesa'}, así que ${posTxt(true)}. ${fuerte ? 'Delta, CVD y la última vela coinciden: es oferta real, no ruido.' : 'La inclinación es bajista, aunque aún no la confirman todas las señales.'} Los rebotes se están vendiendo.`),
      hacer: dos(`Favor shorts; sell the bounce toward ${fmtN(nivel)}${srCerca && sr.side === 'sell' ? ' and the stacked resistance ' + fmtN(sr.yHi) : ''}. Step aside if the CVD turns up or delta turns positive.`,
        `Favorece cortos; vende el rebote hacia ${fmtN(nivel)}${srCerca && sr.side === 'sell' ? ' y la resistencia apilada ' + fmtN(sr.yHi) : ''}. Hazte a un lado si el CVD gira al alza o el delta se pone positivo.`),
      detalle: nums()
    };
  }

  // ── 4) Sin control claro: rotación alrededor del valor ──────────────
  return {
    clave: 'ctrl-bal', tipo: 'vigilar',
    titulo: pick([dos('No one is in control', 'Nadie manda'), dos('Balanced, two sided flow', 'Flujo parejo, de ida y vuelta')]),
    txt: dos(`Aggressive buying and selling are close (${buyPct}% buy) and the CVD is flat, so ${posTxt(false)}. This is rotation around value, not a trend, and forcing a direction here is how you get chopped up.`,
      `La compra y la venta agresivas están parejas (${buyPct}% compra) y el CVD está plano, así que ${posTxt(true)}. Esto es rotación alrededor del valor, no una tendencia, y forzar una dirección aquí es como te barren.`),
    hacer: dos(`Trade the edges: buy absorption at the lows, sell absorption at the highs. Wait for the CVD to break and delta to follow before taking a side.`,
      `Opera los extremos: compra la absorción en los mínimos, vende la absorción en los máximos. Espera a que el CVD rompa y el delta acompañe antes de tomar lado.`),
    detalle: nums()
  };
}
