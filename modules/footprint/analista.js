/* modules/footprint/analista.js — El analista de Footprint Pro (Jesús).

   Lee el flujo de órdenes REAL (delta de la kline + ticks en vivo, CVD, POC,
   absorción con rechazo, imbalances apilados, posición en el rango) y da una
   lectura de MESA: sesgo con convicción, nivel clave, objetivo e invalidación,
   y el escenario. Nada ambiguo ni de relleno. Precios limpios (sin .00 inútil).

   Bilingüe { en, es }, varía el fraseo, cita solo precios que existen.
   Español SIN guiones (regla del proyecto). */

const dos = (en, es) => ({ en, es });
function fmtN(x, bin) {
  if (!isFinite(x)) return '0';
  let d;
  if (bin && bin > 0) d = Math.max(0, Math.min(8, Math.ceil(-Math.log10(bin))));
  else { const a = Math.abs(x); d = a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6; }
  return x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtV(v) { const a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v.toFixed(2); }
const signo = (x) => (x >= 0 ? '+' : '−') + fmtV(Math.abs(x));

/**
 * @param agg  { candles, cvd, divergences, absorciones, stacked, binSize }
 * @param meta { par, tf, last, binSize }
 * @returns { clave, tipo, titulo, txt, hacer, detalle } o null
 */
export function leerFootprint(agg, meta) {
  if (!agg || !agg.candles || agg.candles.length < 4) return null;
  const cs = agg.candles;
  const ult = cs[cs.length - 1];
  const par = (meta && meta.par) || '';
  const tf = (meta && meta.tf) || '';
  const last = (meta && meta.last) || ult.c;
  const bin = (meta && meta.binSize) || agg.binSize || 0;
  const P = (x) => fmtN(x, bin);                 // precio limpio, sin .00 de más
  const idx = cs.length, pick = (a) => a[idx % a.length];

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
  const nivel = poc != null ? poc : last;
  const recT = new Set(cs.slice(-3).map((c) => c.t));

  // Rango reciente → objetivos reales (techo / piso) y dónde está el precio.
  const win = cs.slice(-24);
  let swHi = -Infinity, swLo = Infinity; for (const c of win) { if (c.h > swHi) swHi = c.h; if (c.l < swLo) swLo = c.l; }
  if (!isFinite(swHi)) swHi = last; if (!isFinite(swLo)) swLo = last;
  const ancho = Math.max(1e-9, swHi - swLo);
  const rPos = Math.max(0, Math.min(1, (last - swLo) / ancho));   // 0 = piso, 1 = techo
  const lastWin = Math.sign(ult.delta), sesWin = Math.sign(deltaS), cvdWin = subeCVD ? 1 : bajaCVD ? -1 : 0;
  const acBuy = (sesWin > 0) + (cvdWin > 0) + (lastWin > 0), acSell = (sesWin < 0) + (cvdWin < 0) + (lastWin < 0);

  // Zona de imbalances apilados MÁS CERCANA (soporte/resistencia real)
  let sr = null, srDist = Infinity;
  for (const s of (agg.stacked || [])) { const mid = (s.yLo + s.yHi) / 2, d = Math.abs(mid - last); if (d < srDist) { srDist = d; sr = s; } }
  const srCerca = sr && last > 0 && srDist / last < 0.012;

  const nums = () => [
    dos(`${par ? par + ' · ' : ''}${tf} · live order flow`, `${par ? par + ' · ' : ''}${tf} · flujo en vivo`),
    dos(`Last candle delta ${signo(ult.delta)} · session ${signo(deltaS)} (${buyPct}% buy)`, `Delta de la última vela ${signo(ult.delta)} · sesión ${signo(deltaS)} (${buyPct}% compra)`),
    dos(`CVD ${signo(cvdNow)}, ${cvdSlope >= 0 ? 'rising' : 'falling'} over ${kBack} candles`, `CVD ${signo(cvdNow)}, ${cvdSlope >= 0 ? 'subiendo' : 'bajando'} en ${kBack} velas`),
    dos(`Range ${P(swLo)} to ${P(swHi)} · value at ${P(nivel)}`, `Rango ${P(swLo)} a ${P(swHi)} · valor en ${P(nivel)}`),
    srCerca ? dos(`Nearest stacked ${sr.side === 'buy' ? 'support' : 'resistance'} ${P(sr.yLo)} to ${P(sr.yHi)}`, `${sr.side === 'buy' ? 'Soporte' : 'Resistencia'} apilada ${P(sr.yLo)} a ${P(sr.yHi)}`) : dos('', ''),
    dos('Source: live Binance aggressive buy vs sell (taker flow).', 'Fuente: compra vs venta agresiva en vivo de Binance (flujo taker).')
  ].filter((x) => x.en || x.es);

  // ── 1) ABSORCIÓN con rechazo: giro con convicción ───────────────────
  const absU = (agg.absorciones || []).filter((a) => recT.has(a.t) && (a.strength || 0) >= 0.5).sort((a, b) => (b.strength || 0) - (a.strength || 0));
  if (absU.length) {
    const a = absU[0];
    if (a.side === 'sell') return {
      clave: 'abs-buy-' + a.t, tipo: 'compra',
      titulo: dos(`Buyers defended ${P(a.price)}`, `El comprador defendió ${P(a.price)}`),
      txt: dos(`Sellers threw real size at ${P(a.price)} and it did not break: a passive buyer ate all of it and price closed back up. That is a floor put there on purpose, not a dip. The path of least resistance is up toward ${P(swHi)}.`,
        `El vendedor tiró tamaño de verdad en ${P(a.price)} y no rompió: un comprador pasivo se lo comió todo y el precio cerró de vuelta arriba. Eso es un piso puesto a propósito, no una caída cualquiera. El camino de menor resistencia es al alza hacia ${P(swHi)}.`),
      hacer: dos(`Long against ${P(a.price)}, target ${P(swHi)}, out on a close below ${P(a.price)}.`, `Largo contra ${P(a.price)}, objetivo ${P(swHi)}, fuera si cierra por debajo de ${P(a.price)}.`),
      detalle: nums()
    };
    return {
      clave: 'abs-sell-' + a.t, tipo: 'venta',
      titulo: dos(`Sellers defended ${P(a.price)}`, `El vendedor defendió ${P(a.price)}`),
      txt: dos(`Buyers threw real size at ${P(a.price)} and got nothing: a passive seller absorbed them and price closed back down. That is a ceiling with intent. The path of least resistance is down toward ${P(swLo)}.`,
        `El comprador tiró tamaño de verdad en ${P(a.price)} y no consiguió nada: un vendedor pasivo los absorbió y el precio cerró de vuelta abajo. Eso es un techo con intención. El camino de menor resistencia es a la baja hacia ${P(swLo)}.`),
      hacer: dos(`Short against ${P(a.price)}, target ${P(swLo)}, out on a close above ${P(a.price)}.`, `Corto contra ${P(a.price)}, objetivo ${P(swLo)}, fuera si cierra por encima de ${P(a.price)}.`),
      detalle: nums()
    };
  }

  // ── 2) DIVERGENCIA precio vs CVD ────────────────────────────────────
  const divU = (agg.divergences || []).filter((d) => recT.has(d.t));
  if (divU.length) {
    const d = divU[divU.length - 1];
    if (d.kind === 'bear') return {
      clave: 'div-bear-' + d.t, tipo: 'aviso',
      titulo: dos('Hollow rally, no buyers behind it', 'Subida hueca, sin compradores'),
      txt: dos(`New high on price, but the CVD did not confirm: the aggressive buying is not there to back it. This is the kind of push that gets sold. I would trust the downside if ${P(nivel)} goes.`,
        `Nuevo máximo en el precio, pero el CVD no lo confirmó: la compra agresiva no está para sostenerlo. Es de los empujes que terminan vendiéndose. Me creo la bajada si cede ${P(nivel)}.`),
      hacer: dos(`Do not chase the long. Short triggers on a loss of ${P(nivel)}, target ${P(swLo)}.`, `No persigas el largo. El corto se activa al perder ${P(nivel)}, objetivo ${P(swLo)}.`),
      detalle: nums()
    };
    return {
      clave: 'div-bull-' + d.t, tipo: 'compra',
      titulo: dos('Selloff with no sellers left', 'Caída sin vendedores'),
      txt: dos(`New low on price, but the CVD held: there is no fresh aggressive selling behind the drop. Sellers are spent. I would trust the bounce once ${P(nivel)} is reclaimed.`,
        `Nuevo mínimo en el precio, pero el CVD aguantó: no hay venta agresiva nueva detrás de la caída. El vendedor está agotado. Me creo el rebote en cuanto recupere ${P(nivel)}.`),
      hacer: dos(`Long triggers on a reclaim of ${P(nivel)}, target ${P(swHi)}, not on the low.`, `El largo se activa al recuperar ${P(nivel)}, objetivo ${P(swHi)}, no en el mínimo.`),
      detalle: nums()
    };
  }

  // ── 3) TECHO / PISO del rango con flujo a favor: intento de ruptura ──
  if (rPos >= 0.85 && lastWin > 0 && !bajaCVD) return {
    clave: 'brk-up', tipo: 'tendencia',
    titulo: dos(`Buyers pressing the high ${P(swHi)}`, `El comprador aprieta el techo ${P(swHi)}`),
    txt: dos(`Price is right under ${P(swHi)} with buyers still the aggressors (${buyPct}% taker buys, CVD up). A break sticks only if the delta stays positive through it; if it stalls here with no new buying, it is a trap.`,
      `El precio está pegado a ${P(swHi)} y el comprador sigue de agresor (${buyPct}% de compra, CVD arriba). La ruptura aguanta solo si el delta sigue positivo al cruzarlo; si se estanca aquí sin compra nueva, es trampa.`),
    hacer: dos(`Long the break of ${P(swHi)} only while delta stays positive; stand aside if it stalls.`, `Largo a la ruptura de ${P(swHi)} solo mientras el delta siga positivo; afuera si se estanca.`),
    detalle: nums()
  };
  if (rPos <= 0.15 && lastWin < 0 && !subeCVD) return {
    clave: 'brk-dn', tipo: 'venta',
    titulo: dos(`Sellers pressing the low ${P(swLo)}`, `El vendedor aprieta el piso ${P(swLo)}`),
    txt: dos(`Price is right above ${P(swLo)} with sellers the aggressors (${100 - buyPct}% taker sells, CVD down). A breakdown sticks only if delta stays negative through it; if selling dries up here, it is a spring for a bounce.`,
      `El precio está pegado a ${P(swLo)} y el vendedor es el agresor (${100 - buyPct}% de venta, CVD abajo). La ruptura a la baja aguanta solo si el delta sigue negativo al cruzarlo; si la venta se seca aquí, es resorte para un rebote.`),
    hacer: dos(`Short the break of ${P(swLo)} only while delta stays negative; stand aside if selling dries up.`, `Corto a la ruptura de ${P(swLo)} solo mientras el delta siga negativo; afuera si se seca la venta.`),
    detalle: nums()
  };

  // ── 4) TENDENCIA / VENTAJA por acuerdo de señales ───────────────────
  if (acBuy >= 2 && acBuy > acSell) {
    const fuerte = acBuy === 3;
    return {
      clave: 'ctrl-buy-' + (fuerte ? 'hi' : 'lo'), tipo: 'tendencia',
      titulo: fuerte ? pick([dos('Buyers own this', 'Esto es del comprador'), dos('Clean uptrend in the flow', 'Tendencia alcista limpia en el flujo')]) : pick([dos('Buyers have the upper hand', 'El comprador lleva la mano'), dos('Edge is with the longs', 'La ventaja es de los largos')]),
      txt: fuerte
        ? dos(`Delta, CVD and the last candle all pull the same way: ${buyPct}% taker buys and the CVD making highs. This is a trend, not a trade. Stay long while ${P(nivel)} holds and the CVD keeps climbing; room to ${P(swHi)}.`,
          `Delta, CVD y la última vela tiran para el mismo lado: ${buyPct}% de compra y el CVD marcando máximos. Esto es tendencia, no un trade suelto. Quédate largo mientras aguante ${P(nivel)} y el CVD siga subiendo; recorrido hasta ${P(swHi)}.`)
        : dos(`Buyers are the aggressors (${buyPct}% taker buys) and the CVD is firm. Dips into ${P(nivel)} are for buying, not fading. It flips only if the CVD rolls over or delta turns negative.`,
          `El comprador es el agresor (${buyPct}% de compra) y el CVD está firme. Las caídas hacia ${P(nivel)} son para comprar, no para vender. Solo cambia si el CVD se da vuelta o el delta se pone negativo.`),
      hacer: dos(`Buy the dip to ${P(nivel)}${srCerca && sr.side === 'buy' ? ' / ' + P(sr.yLo) : ''}, target ${P(swHi)}. Out if delta turns negative.`, `Compra la caída a ${P(nivel)}${srCerca && sr.side === 'buy' ? ' / ' + P(sr.yLo) : ''}, objetivo ${P(swHi)}. Fuera si el delta se pone negativo.`),
      detalle: nums()
    };
  }
  if (acSell >= 2 && acSell > acBuy) {
    const fuerte = acSell === 3;
    return {
      clave: 'ctrl-sell-' + (fuerte ? 'hi' : 'lo'), tipo: 'venta',
      titulo: fuerte ? pick([dos('Sellers own this', 'Esto es del vendedor'), dos('Clean downtrend in the flow', 'Tendencia bajista limpia en el flujo')]) : pick([dos('Sellers have the upper hand', 'El vendedor lleva la mano'), dos('Edge is with the shorts', 'La ventaja es de los cortos')]),
      txt: fuerte
        ? dos(`Delta, CVD and the last candle all pull the same way: ${100 - buyPct}% taker sells and the CVD making lows. This is a trend, not a trade. Stay short while ${P(nivel)} caps and the CVD keeps falling; room to ${P(swLo)}.`,
          `Delta, CVD y la última vela tiran para el mismo lado: ${100 - buyPct}% de venta y el CVD marcando mínimos. Esto es tendencia, no un trade suelto. Quédate corto mientras ${P(nivel)} tape y el CVD siga bajando; recorrido hasta ${P(swLo)}.`)
        : dos(`Sellers are the aggressors (${100 - buyPct}% taker sells) and the CVD is weak. Bounces into ${P(nivel)} are for selling, not chasing. It flips only if the CVD turns up or delta turns positive.`,
          `El vendedor es el agresor (${100 - buyPct}% de venta) y el CVD está débil. Los rebotes hacia ${P(nivel)} son para vender, no para perseguir. Solo cambia si el CVD gira al alza o el delta se pone positivo.`),
      hacer: dos(`Sell the bounce to ${P(nivel)}${srCerca && sr.side === 'sell' ? ' / ' + P(sr.yHi) : ''}, target ${P(swLo)}. Out if delta turns positive.`, `Vende el rebote a ${P(nivel)}${srCerca && sr.side === 'sell' ? ' / ' + P(sr.yHi) : ''}, objetivo ${P(swLo)}. Fuera si el delta se pone positivo.`),
      detalle: nums()
    };
  }

  // ── 5) Sin control claro: rotación entre piso y techo ───────────────
  return {
    clave: 'ctrl-bal', tipo: 'vigilar',
    titulo: pick([dos('Rotation, trade the edges', 'Rotación, opera los extremos'), dos('No trend, range in play', 'Sin tendencia, manda el rango')]),
    txt: dos(`Buy and sell aggression are even (${buyPct}% buy) and the CVD is flat. Price is rotating between ${P(swLo)} and ${P(swHi)} around value at ${P(nivel)}. There is no trade in the middle; the money is at the edges.`,
      `La compra y la venta están parejas (${buyPct}% compra) y el CVD está plano. El precio rota entre ${P(swLo)} y ${P(swHi)} alrededor del valor en ${P(nivel)}. En el medio no hay trade; el dinero está en los extremos.`),
    hacer: dos(`Buy ${P(swLo)} with absorption, sell ${P(swHi)} with absorption. Take the trend trade only once the CVD breaks and delta follows.`, `Compra ${P(swLo)} con absorción, vende ${P(swHi)} con absorción. El trade de tendencia, solo cuando el CVD rompa y el delta acompañe.`),
    detalle: nums()
  };
}
