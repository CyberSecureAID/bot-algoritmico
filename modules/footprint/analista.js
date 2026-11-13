/* modules/footprint/analista.js — El analista de Footprint Pro (Jesús).

   NO es un texto fijo: lee lo que está pasando AHORA (la vela en formación, su
   delta en vivo, el momentum de las últimas velas, el CVD, la posición en el
   rango, absorción y divergencias) y arma una lectura de mesa distinta según el
   estado real. Vocabulario variado (nada de repetir "agresor"), con nivel clave,
   objetivo e invalidación. Precios limpios (sin .00 inútil).

   Bilingüe { en, es }. Español SIN guiones (regla del proyecto). */

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
const EN = (o) => (o && o.en) || '', ES = (o) => (o && o.es) || '';

export function leerFootprint(agg, meta) {
  if (!agg || !agg.candles || agg.candles.length < 4) return null;
  const cs = agg.candles;
  const ult = cs[cs.length - 1];                 // vela EN FORMACIÓN
  const prev = cs[cs.length - 2] || ult;
  const par = (meta && meta.par) || '';
  const tf = (meta && meta.tf) || '';
  const last = (meta && meta.last) || ult.c;
  const bin = (meta && meta.binSize) || agg.binSize || 0;
  const P = (x) => fmtN(x, bin);
  const idx = cs.length, rot = (a) => a[idx % a.length];   // rota el fraseo según avanza el tiempo

  // ── Sesión ──
  let buyS = 0, sellS = 0; for (const c of cs) { buyS += c.buyTot; sellS += c.sellTot; }
  const deltaS = buyS - sellS;
  const buyPct = (buyS + sellS) > 0 ? Math.round((buyS / (buyS + sellS)) * 100) : 50;
  const cvd = agg.cvd || [];
  const cvdNow = cvd.length ? cvd[cvd.length - 1].v : 0;
  const kBack = Math.min(cvd.length - 1, 10);
  const cvdPrev = cvd.length > kBack ? cvd[cvd.length - 1 - kBack].v : 0;
  const cvdSlope = cvdNow - cvdPrev;
  const esc = Math.max(1e-9, (buyS + sellS) / Math.max(1, cs.length));
  const subeCVD = cvdSlope > esc * 0.4, bajaCVD = cvdSlope < -esc * 0.4;
  const poc = ult.poc != null ? ult.poc : prev.poc;
  const nivel = poc != null ? poc : last;
  const recT = new Set(cs.slice(-3).map((c) => c.t));

  // ── Vela EN FORMACIÓN (lo que está pasando ahora mismo) ──
  const lDelta = ult.delta, lDir = Math.sign((ult.c != null ? ult.c : ult.o) - (ult.o != null ? ult.o : ult.c));
  const lBuyPct = ult.total > 0 ? Math.round((ult.buyTot / ult.total) * 100) : 50;
  const vivaCompra = dos(
    `on this candle buyers have ${signo(lDelta)} through it (${lBuyPct}% of the flow)`,
    `en esta vela el comprador lleva ${signo(lDelta)} metido (${lBuyPct}% del flujo)`);
  const vivaVenta = dos(
    `on this candle sellers have ${signo(lDelta)} through it (${100 - lBuyPct}% of the flow)`,
    `en esta vela el vendedor lleva ${signo(lDelta)} metido (${100 - lBuyPct}% del flujo)`);
  const vivaPareja = dos(`this candle is a coin flip so far (${lBuyPct}% buys)`, `esta vela va pareja por ahora (${lBuyPct}% compra)`);
  const viva = lDelta > 0 ? vivaCompra : lDelta < 0 ? vivaVenta : vivaPareja;

  // ── Momentum de las últimas velas cerradas ──
  const rec = cs.slice(-4, -1);
  let up = 0, dn = 0; for (const c of rec) { if (c.delta > 0) up++; else if (c.delta < 0) dn++; }
  const mom = up >= 2 ? dos('the last few candles closed positive too', 'las últimas velas también cerraron en positivo')
    : dn >= 2 ? dos('the last few candles closed negative too', 'las últimas velas también cerraron en negativo')
      : dos('the last few candles have been a tug of war', 'las últimas velas han sido un tira y afloja');

  // ── Rango reciente → objetivos y posición ──
  const win = cs.slice(-24);
  let swHi = -Infinity, swLo = Infinity; for (const c of win) { if (c.h > swHi) swHi = c.h; if (c.l < swLo) swLo = c.l; }
  if (!isFinite(swHi)) swHi = last; if (!isFinite(swLo)) swLo = last;
  const rPos = Math.max(0, Math.min(1, (last - swLo) / Math.max(1e-9, swHi - swLo)));
  const cvdW = subeCVD ? 1 : bajaCVD ? -1 : 0;
  const acBuy = (Math.sign(deltaS) > 0) + (cvdW > 0) + (Math.sign(ult.delta) > 0);
  const acSell = (Math.sign(deltaS) < 0) + (cvdW < 0) + (Math.sign(ult.delta) < 0);

  let sr = null, srDist = Infinity;
  for (const s of (agg.stacked || [])) { const mid = (s.yLo + s.yHi) / 2, d = Math.abs(mid - last); if (d < srDist) { srDist = d; sr = s; } }
  const srCerca = sr && last > 0 && srDist / last < 0.012;

  const cvdFrase = (es) => subeCVD ? (es ? 'el CVD sigue subiendo' : 'the CVD is still climbing') : bajaCVD ? (es ? 'el CVD sigue cayendo' : 'the CVD keeps falling') : (es ? 'el CVD está plano' : 'the CVD is flat');
  const pos = (es) => poc == null ? (es ? 'sin un valor claro aún' : 'with no clear value yet') : last > poc ? (es ? `por encima del valor ${P(poc)}` : `above value ${P(poc)}`) : last < poc ? (es ? `por debajo del valor ${P(poc)}` : `below value ${P(poc)}`) : (es ? `justo en el valor ${P(poc)}` : `right at value ${P(poc)}`);

  const nums = () => [
    dos(`${par ? par + ' · ' : ''}${tf} · live order flow`, `${par ? par + ' · ' : ''}${tf} · flujo en vivo`),
    dos(`This candle ${signo(lDelta)} · session ${signo(deltaS)} (${buyPct}% buy)`, `Esta vela ${signo(lDelta)} · sesión ${signo(deltaS)} (${buyPct}% compra)`),
    dos(`CVD ${signo(cvdNow)}, ${cvdSlope >= 0 ? 'rising' : 'falling'} over ${kBack} candles`, `CVD ${signo(cvdNow)}, ${cvdSlope >= 0 ? 'subiendo' : 'bajando'} en ${kBack} velas`),
    dos(`Range ${P(swLo)} to ${P(swHi)} · value at ${P(nivel)}`, `Rango ${P(swLo)} a ${P(swHi)} · valor en ${P(nivel)}`),
    srCerca ? dos(`Nearest stacked ${sr.side === 'buy' ? 'support' : 'resistance'} ${P(sr.yLo)} to ${P(sr.yHi)}`, `${sr.side === 'buy' ? 'Soporte' : 'Resistencia'} apilada ${P(sr.yLo)} a ${P(sr.yHi)}`) : dos('', ''),
    dos('Source: live Binance buy vs sell (taker flow).', 'Fuente: compra vs venta en vivo de Binance (flujo taker).')
  ].filter((x) => x.en || x.es);

  const out = (clave, tipo, titulo, txt, hacer) => ({ clave, tipo, titulo, txt, hacer, detalle: nums() });
  const frase = (en, es) => dos(en, es);

  // ── 1) ABSORCIÓN con rechazo ────────────────────────────────────────
  const absU = (agg.absorciones || []).filter((a) => recT.has(a.t) && (a.strength || 0) >= 0.5).sort((a, b) => (b.strength || 0) - (a.strength || 0));
  if (absU.length) {
    const a = absU[0];
    if (a.side === 'sell') return out('abs-buy-' + a.t, 'compra',
      rot([dos(`A buyer defended ${P(a.price)}`, `Un comprador defendió ${P(a.price)}`), dos(`The selling got eaten at ${P(a.price)}`, `La venta se la comieron en ${P(a.price)}`)]),
      frase(`Sellers threw size at ${P(a.price)} and it did not give: someone sat on the bid and soaked all of it, and price closed back up. That is a floor put there on purpose. ${EN(viva)}.`,
        `El vendedor tiró tamaño en ${P(a.price)} y no cedió: alguien se puso en la demanda y lo absorbió todo, y el precio cerró de vuelta arriba. Es un piso puesto a propósito. ${ES(viva)}.`),
      frase(`Long against ${P(a.price)}, target ${P(swHi)}, out on a close below ${P(a.price)}.`, `Largo contra ${P(a.price)}, objetivo ${P(swHi)}, fuera si cierra por debajo de ${P(a.price)}.`));
    return out('abs-sell-' + a.t, 'venta',
      rot([dos(`A seller defended ${P(a.price)}`, `Un vendedor defendió ${P(a.price)}`), dos(`The buying got capped at ${P(a.price)}`, `La compra se topó en ${P(a.price)}`)]),
      frase(`Buyers threw size at ${P(a.price)} and got nothing: someone sat on the offer and absorbed them, and price closed back down. That is a ceiling with intent. ${EN(viva)}.`,
        `El comprador tiró tamaño en ${P(a.price)} y no consiguió nada: alguien se puso en la oferta y los absorbió, y el precio cerró de vuelta abajo. Es un techo con intención. ${ES(viva)}.`),
      frase(`Short against ${P(a.price)}, target ${P(swLo)}, out on a close above ${P(a.price)}.`, `Corto contra ${P(a.price)}, objetivo ${P(swLo)}, fuera si cierra por encima de ${P(a.price)}.`));
  }

  // ── 2) DIVERGENCIA precio vs CVD ────────────────────────────────────
  const divU = (agg.divergences || []).filter((d) => recT.has(d.t));
  if (divU.length) {
    const d = divU[divU.length - 1];
    if (d.kind === 'bear') return out('div-bear-' + d.t, 'aviso',
      dos('New high, but nobody is buying it', 'Nuevo máximo, pero nadie lo compra'),
      frase(`Price made a higher high and the CVD did not go with it: there is no real buying under this push, it is running on fumes. ${EN(viva)}. I trust the downside once ${P(nivel)} cracks.`,
        `El precio hizo un máximo más alto y el CVD no lo acompañó: no hay compra real debajo de este empuje, va con lo justo. ${ES(viva)}. Me creo la bajada en cuanto ceda ${P(nivel)}.`),
      frase(`Do not chase it up. Short on a loss of ${P(nivel)}, target ${P(swLo)}.`, `No lo persigas arriba. Corto al perder ${P(nivel)}, objetivo ${P(swLo)}.`));
    return out('div-bull-' + d.t, 'compra',
      dos('New low, but the sellers are gone', 'Nuevo mínimo, pero ya no hay vendedores'),
      frase(`Price made a lower low and the CVD held: there is no fresh selling under the drop, it is exhaustion. ${EN(viva)}. I trust the bounce once ${P(nivel)} is back.`,
        `El precio hizo un mínimo más bajo y el CVD aguantó: no hay venta nueva debajo de la caída, es agotamiento. ${ES(viva)}. Me creo el rebote en cuanto vuelva ${P(nivel)}.`),
      frase(`Long on a reclaim of ${P(nivel)}, target ${P(swHi)}, not on the low.`, `Largo al recuperar ${P(nivel)}, objetivo ${P(swHi)}, no en el mínimo.`));
  }

  // ── 3) Techo / piso del rango con el flujo a favor ──────────────────
  if (rPos >= 0.85 && lDir > 0 && !bajaCVD) return out('brk-up', 'tendencia',
    dos(`Testing the high ${P(swHi)}`, `Probando el techo ${P(swHi)}`),
    frase(`Price is right under ${P(swHi)} and ${EN(viva)}. A break only sticks if the buying keeps coming through it; if it stalls here with nothing new, it is a trap for late longs.`,
      `El precio está pegado a ${P(swHi)} y ${ES(viva)}. La ruptura solo aguanta si la compra sigue entrando al cruzarlo; si se estanca aquí sin nada nuevo, es trampa para los largos tardíos.`),
    frase(`Long the break of ${P(swHi)} only while the delta stays positive; stand aside if it stalls.`, `Largo a la ruptura de ${P(swHi)} solo mientras el delta siga positivo; afuera si se estanca.`));
  if (rPos <= 0.15 && lDir < 0 && !subeCVD) return out('brk-dn', 'venta',
    dos(`Testing the low ${P(swLo)}`, `Probando el piso ${P(swLo)}`),
    frase(`Price is right above ${P(swLo)} and ${EN(viva)}. A breakdown only sticks if the selling keeps coming through it; if it dries up here, it is a spring for a bounce.`,
      `El precio está pegado a ${P(swLo)} y ${ES(viva)}. La ruptura a la baja solo aguanta si la venta sigue entrando al cruzarlo; si se seca aquí, es resorte para un rebote.`),
    frase(`Short the break of ${P(swLo)} only while the delta stays negative; stand aside if selling dries up.`, `Corto a la ruptura de ${P(swLo)} solo mientras el delta siga negativo; afuera si se seca la venta.`));

  // ── 4) Tendencia / ventaja (grounded en la vela viva + momentum) ────
  if (acBuy >= 2 && acBuy > acSell) {
    const fuerte = acBuy === 3;
    return out('ctrl-buy-' + (fuerte ? 'hi' : 'lo'), 'tendencia',
      fuerte ? rot([dos('Buyers own this', 'Esto es del comprador'), dos('Demand keeps winning', 'La demanda sigue ganando'), dos('One sided, to the upside', 'De un solo lado, al alza')])
        : rot([dos('Buyers in front', 'El comprador al frente'), dos('The bid keeps getting defended', 'La demanda se sigue defendiendo'), dos('Edge is with the longs', 'La ventaja es de los largos')]),
      fuerte
        ? frase(`${cap(EN(viva))}, ${EN(mom)}, and ${cvdFrase(false)}: price is ${pos(false)} and demand is simply not letting go. This is a trend to ride, not fade.`,
          `${cap(ES(viva))}, ${ES(mom)} y ${cvdFrase(true)}: el precio está ${pos(true)} y la demanda no suelta. Es una tendencia para montarse, no para pelearla.`)
        : frase(`${cap(EN(viva))} and ${cvdFrase(false)}, with price ${pos(false)}. The buyers have the better hand; the dips keep getting bought rather than sold.`,
          `${cap(ES(viva))} y ${cvdFrase(true)}, con el precio ${pos(true)}. El comprador lleva la mejor mano; las caídas se compran en vez de venderse.`),
      frase(`Buy the dip to ${P(nivel)}${srCerca && sr.side === 'buy' ? ' / ' + P(sr.yLo) : ''}, target ${P(swHi)}. Out if the delta flips negative and ${P(nivel)} goes.`,
        `Compra la caída a ${P(nivel)}${srCerca && sr.side === 'buy' ? ' / ' + P(sr.yLo) : ''}, objetivo ${P(swHi)}. Fuera si el delta se pone negativo y cede ${P(nivel)}.`));
  }
  if (acSell >= 2 && acSell > acBuy) {
    const fuerte = acSell === 3;
    return out('ctrl-sell-' + (fuerte ? 'hi' : 'lo'), 'venta',
      fuerte ? rot([dos('Sellers own this', 'Esto es del vendedor'), dos('Supply keeps winning', 'La oferta sigue ganando'), dos('One sided, to the downside', 'De un solo lado, a la baja')])
        : rot([dos('Sellers in front', 'El vendedor al frente'), dos('The offer keeps getting defended', 'La oferta se sigue defendiendo'), dos('Edge is with the shorts', 'La ventaja es de los cortos')]),
      fuerte
        ? frase(`${cap(EN(viva))}, ${EN(mom)}, and ${cvdFrase(false)}: price is ${pos(false)} and supply is not letting go. This is a trend to ride short, not fade.`,
          `${cap(ES(viva))}, ${ES(mom)} y ${cvdFrase(true)}: el precio está ${pos(true)} y la oferta no suelta. Es una tendencia para montarse en corto, no para pelearla.`)
        : frase(`${cap(EN(viva))} and ${cvdFrase(false)}, with price ${pos(false)}. The sellers have the better hand; the bounces keep getting sold rather than bought.`,
          `${cap(ES(viva))} y ${cvdFrase(true)}, con el precio ${pos(true)}. El vendedor lleva la mejor mano; los rebotes se venden en vez de comprarse.`),
      frase(`Sell the bounce to ${P(nivel)}${srCerca && sr.side === 'sell' ? ' / ' + P(sr.yHi) : ''}, target ${P(swLo)}. Out if the delta flips positive and ${P(nivel)} goes.`,
        `Vende el rebote a ${P(nivel)}${srCerca && sr.side === 'sell' ? ' / ' + P(sr.yHi) : ''}, objetivo ${P(swLo)}. Fuera si el delta se pone positivo y cede ${P(nivel)}.`));
  }

  // ── 5) Sin control claro: rotación ──────────────────────────────────
  return out('ctrl-bal', 'vigilar',
    rot([dos('Chop, no trade in the middle', 'Lateral, sin trade en el medio'), dos('Two sided, trade the edges', 'De ida y vuelta, opera los extremos')]),
    frase(`Buying and selling are trading blows (${buyPct}% buy), ${cvdFrase(false)} and ${EN(viva)}. Price is rotating between ${P(swLo)} and ${P(swHi)}; the middle is a chop zone.`,
      `La compra y la venta se están dando golpes (${buyPct}% compra), ${cvdFrase(true)} y ${ES(viva)}. El precio rota entre ${P(swLo)} y ${P(swHi)}; el medio es zona de picadillo.`),
    frase(`Buy ${P(swLo)} on absorption, sell ${P(swHi)} on absorption. Take a side only once the CVD breaks and the delta follows.`,
      `Compra ${P(swLo)} con absorción, vende ${P(swHi)} con absorción. Toma lado solo cuando el CVD rompa y el delta acompañe.`));
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
