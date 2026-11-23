/* modules/footprint/analista.js — El analista de Footprint Pro (Jesús).

   Lee el estado REAL del flujo (delta de sesión, CVD, absorción, divergencia,
   momentum de las últimas velas: agotamiento o aceleración, posición en el
   rango, POC e imbalances apilados) y da una lectura de MESA: firme, en presente,
   con sesgo, nivel clave, objetivo e invalidación. Nada de relleno ni de repetir
   la misma frase. Precios limpios (sin .00). Las cifras en vivo van en la fila de
   stats; aquí mando la lectura, que se mantiene estable para poder operarla.

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

export function leerFootprint(agg, meta) {
  if (!agg || !agg.candles || agg.candles.length < 5) return null;
  const cs = agg.candles;
  const par = (meta && meta.par) || '', tf = (meta && meta.tf) || '';
  const bin = (meta && meta.binSize) || agg.binSize || 0;
  const P = (x) => fmtN(x, bin);
  const idx = cs.length, rot = (a) => a[idx % a.length];
  const last = (meta && meta.last) || cs[cs.length - 1].c;

  // Últimas velas CERRADAS (estables). c1 = la más reciente ya cerrada.
  const c1 = cs[cs.length - 2], c2 = cs[cs.length - 3], c3 = cs[cs.length - 4];
  const d1 = Math.sign((c1.c != null ? c1.c : c1.o) - (c1.o != null ? c1.o : c1.c));
  const d2 = Math.sign((c2.c != null ? c2.c : c2.o) - (c2.o != null ? c2.o : c2.c));

  // Flujo de sesión + CVD
  let buyS = 0, sellS = 0; for (const c of cs) { buyS += c.buyTot; sellS += c.sellTot; }
  const deltaS = buyS - sellS;
  const buyPct = (buyS + sellS) > 0 ? Math.round((buyS / (buyS + sellS)) * 100) : 50;
  const cvd = agg.cvd || [];
  const cvdNow = cvd.length ? cvd[cvd.length - 1].v : 0;
  const kBack = Math.min(cvd.length - 1, 10);
  const cvdPrev = cvd.length > kBack ? cvd[cvd.length - 1 - kBack].v : 0;
  const cvdSlope = cvdNow - cvdPrev;
  const escN = Math.max(1e-9, (buyS + sellS) / Math.max(1, cs.length));
  const subeCVD = cvdSlope > escN * 0.4, bajaCVD = cvdSlope < -escN * 0.4;
  const poc = c1.poc != null ? c1.poc : (cs[cs.length - 1].poc != null ? cs[cs.length - 1].poc : last);
  const nivel = poc;
  const recT = new Set(cs.slice(-3).map((c) => c.t));

  // Rango reciente → objetivos y posición
  const win = cs.slice(-24);
  let swHi = -Infinity, swLo = Infinity; for (const c of win) { if (c.h > swHi) swHi = c.h; if (c.l < swLo) swLo = c.l; }
  if (!isFinite(swHi)) swHi = last; if (!isFinite(swLo)) swLo = last;
  const rPos = Math.max(0, Math.min(1, (last - swLo) / Math.max(1e-9, swHi - swLo)));

  // Momentum de las velas cerradas: agotamiento (la presión se encoge) vs
  // aceleración (la presión crece). Es lo que no se ve de un vistazo.
  const a1 = Math.abs(c1.delta), a2 = Math.abs(c2.delta);
  const agotaUp = d1 > 0 && d2 > 0 && c1.delta > 0 && a1 < a2 * 0.6;
  const agotaDn = d1 < 0 && d2 < 0 && c1.delta < 0 && a1 < a2 * 0.6;
  const aceleraUp = d1 > 0 && c1.delta > 0 && a1 > a2 * 1.4 && !bajaCVD;
  const aceleraDn = d1 < 0 && c1.delta < 0 && a1 > a2 * 1.4 && !subeCVD;

  // Fuerza REAL del desequilibrio. No basta el signo del delta: un 51% es ruido, no
  // tendencia. El veredicto de tendencia exige ventaja de verdad en el % de volumen
  // CON el CVD a favor; si no, se dice claro que no hay ventaja y se espera.
  const cvdW = subeCVD ? 1 : bajaCVD ? -1 : 0;
  const sobreValor = last >= nivel;
  const fuerteBuy = buyPct >= 58 && !bajaCVD;      // compra manda de verdad y el CVD no la contradice
  const fuerteSell = buyPct <= 42 && !subeCVD;     // venta manda de verdad y el CVD no la contradice
  const ventajaBuy = buyPct >= 53 && cvdW >= 0;    // ligera ventaja compradora (aún no es tendencia)
  const ventajaSell = buyPct <= 47 && cvdW <= 0;   // ligera ventaja vendedora

  let sr = null, srDist = Infinity;
  for (const s of (agg.stacked || [])) { const mid = (s.yLo + s.yHi) / 2, d = Math.abs(mid - last); if (d < srDist) { srDist = d; sr = s; } }
  const srCerca = sr && last > 0 && srDist / last < 0.012;
  const sb = srCerca && sr.side === 'buy' && P(sr.yLo) !== P(nivel) ? ' / ' + P(sr.yLo) : '';
  const ss = srCerca && sr.side === 'sell' && P(sr.yHi) !== P(nivel) ? ' / ' + P(sr.yHi) : '';

  const cvdTxt = (es) => subeCVD ? (es ? 'el CVD sube' : 'the CVD is rising') : bajaCVD ? (es ? 'el CVD baja' : 'the CVD is falling') : (es ? 'el CVD está plano' : 'the CVD is flat');
  const nums = () => [
    dos(`${par ? par + ' · ' : ''}${tf} · live order flow`, `${par ? par + ' · ' : ''}${tf} · flujo en vivo`),
    dos(`Session delta ${signo(deltaS)} (${buyPct}% buy) · last candle ${signo(c1.delta)}`, `Delta de sesión ${signo(deltaS)} (${buyPct}% compra) · última vela ${signo(c1.delta)}`),
    dos(`CVD ${signo(cvdNow)}, ${cvdSlope >= 0 ? 'rising' : 'falling'} over ${kBack} candles`, `CVD ${signo(cvdNow)}, ${cvdSlope >= 0 ? 'subiendo' : 'bajando'} en ${kBack} velas`),
    dos(`Range ${P(swLo)} to ${P(swHi)} · value at ${P(nivel)}`, `Rango ${P(swLo)} a ${P(swHi)} · valor en ${P(nivel)}`),
    srCerca ? dos(`Nearest stacked ${sr.side === 'buy' ? 'support' : 'resistance'} ${P(sr.yLo)} to ${P(sr.yHi)}`, `${sr.side === 'buy' ? 'Soporte' : 'Resistencia'} apilada ${P(sr.yLo)} a ${P(sr.yHi)}`) : dos('', '')
  ].filter((x) => x.en || x.es);
  const out = (clave, tipo, t, x, h) => ({ clave, tipo, titulo: t, txt: x, hacer: h, detalle: nums() });

  // ── 1) ABSORCIÓN con rechazo (el giro más fiable) ───────────────────
  const absU = (agg.absorciones || []).filter((a) => recT.has(a.t) && (a.strength || 0) >= 0.5).sort((a, b) => (b.strength || 0) - (a.strength || 0));
  if (absU.length) {
    const a = absU[0];
    if (a.side === 'sell') return out('abs-buy-' + a.t, 'compra',
      dos(`Buyer stepped in at ${P(a.price)}`, `Entró un comprador en ${P(a.price)}`),
      dos(`Sellers hit ${P(a.price)} with size and it held: a passive buyer ate the lot and price turned up. That is a floor with money behind it, not a random bounce.`,
        `El vendedor golpeó ${P(a.price)} con tamaño y aguantó: un comprador pasivo se lo comió y el precio giró arriba. Es un piso con dinero detrás, no un rebote cualquiera.`),
      dos(`Long against ${P(a.price)}, target ${P(swHi)}. Wrong on a close below ${P(a.price)}.`, `Largo contra ${P(a.price)}, objetivo ${P(swHi)}. Mal si cierra por debajo de ${P(a.price)}.`));
    return out('abs-sell-' + a.t, 'venta',
      dos(`Seller capped ${P(a.price)}`, `Un vendedor tapó ${P(a.price)}`),
      dos(`Buyers pushed ${P(a.price)} with size and got nothing: a passive seller absorbed them and price rolled back down. That is a ceiling with intent.`,
        `El comprador empujó ${P(a.price)} con tamaño y no sacó nada: un vendedor pasivo lo absorbió y el precio se devolvió abajo. Es un techo con intención.`),
      dos(`Short against ${P(a.price)}, target ${P(swLo)}. Wrong on a close above ${P(a.price)}.`, `Corto contra ${P(a.price)}, objetivo ${P(swLo)}. Mal si cierra por encima de ${P(a.price)}.`));
  }

  // ── 2) DIVERGENCIA precio vs CVD ────────────────────────────────────
  const divU = (agg.divergences || []).filter((d) => recT.has(d.t));
  if (divU.length) {
    const d = divU[divU.length - 1];
    if (d.kind === 'bear') return out('div-bear-' + d.t, 'aviso',
      dos('Higher high, no buyers behind it', 'Máximo más alto sin compradores'),
      dos(`New high on price but the CVD did not confirm. The move up has no real buying under it, it is running on air. These are the highs that get sold.`,
        `Máximo más alto en el precio pero el CVD no lo confirmó. La subida no tiene compra real debajo, va con aire. Son los máximos que se venden.`),
      dos(`Do not chase it. Short on a loss of ${P(nivel)}, target ${P(swLo)}.`, `No lo persigas. Corto al perder ${P(nivel)}, objetivo ${P(swLo)}.`));
    return out('div-bull-' + d.t, 'compra',
      dos('Lower low, no sellers left', 'Mínimo más bajo sin vendedores'),
      dos(`New low on price but the CVD held. There is no fresh selling under the drop, it is exhaustion. This is where the snap back is built.`,
        `Mínimo más bajo en el precio pero el CVD aguantó. No hay venta nueva debajo de la caída, es agotamiento. Aquí se arma el latigazo de vuelta.`),
      dos(`Long on a reclaim of ${P(nivel)}, target ${P(swHi)}. Not on the low.`, `Largo al recuperar ${P(nivel)}, objetivo ${P(swHi)}. No en el mínimo.`));
  }

  // ── 3) AGOTAMIENTO de momentum cerca de un extremo (reversión) ──────
  if (agotaUp && rPos >= 0.6) return out('agota-up', 'aviso',
    dos('The push up is tiring', 'El empuje al alza se cansa'),
    dos(`Price keeps making highs but each candle buys less (${signo(c2.delta)} then ${signo(c1.delta)}). The trend is running out of fuel up here. Chasing now is late.`,
      `El precio sigue haciendo máximos pero cada vela compra menos (${signo(c2.delta)} y luego ${signo(c1.delta)}). La tendencia se queda sin gasolina aquí arriba. Perseguir ahora es tarde.`),
    dos(`No new longs. The short triggers when a candle loses ${P(nivel)} with negative delta, target ${P(swLo)}.`, `No más largos. El corto se activa cuando una vela pierda ${P(nivel)} con delta negativo, objetivo ${P(swLo)}.`));
  if (agotaDn && rPos <= 0.4) return out('agota-dn', 'compra',
    dos('The selloff is drying up', 'La caída se está secando'),
    dos(`Price keeps making lows but each candle sells less (${signo(c2.delta)} then ${signo(c1.delta)}). The sellers are running out down here, the move is tired.`,
      `El precio sigue haciendo mínimos pero cada vela vende menos (${signo(c2.delta)} y luego ${signo(c1.delta)}). El vendedor se está acabando aquí abajo, el movimiento está cansado.`),
    dos(`Long triggers on a reclaim of ${P(nivel)} with positive delta, target ${P(swHi)}.`, `El largo se activa al recuperar ${P(nivel)} con delta positivo, objetivo ${P(swHi)}.`));

  // ── 4) ACELERACIÓN: la presión crece (continuación fuerte) ──────────
  if (aceleraUp && buyPct >= 50) return out('acelera-up', 'tendencia',
    rot([dos('Buyers stepping on the gas', 'El comprador pisa el acelerador'), dos('The buying is building, not fading', 'La compra crece, no se agota')]),
    dos(`The last candle bought MORE than the one before (${signo(c2.delta)} to ${signo(c1.delta)}) and ${cvdTxt(false)}. Pullbacks are shallow and bought fast. Ride it, do not fade it.`,
      `La última vela compró MÁS que la anterior (${signo(c2.delta)} a ${signo(c1.delta)}) y ${cvdTxt(true)}. Las caídas son cortas y se compran rápido. Móntate, no la pelees.`),
    dos(`Buy the dip to ${P(nivel)}${sb}, target ${P(swHi)}. Out if delta flips negative.`, `Compra la caída a ${P(nivel)}${sb}, objetivo ${P(swHi)}. Fuera si el delta se pone negativo.`));
  if (aceleraDn && buyPct <= 50) return out('acelera-dn', 'venta',
    rot([dos('Sellers stepping on the gas', 'El vendedor pisa el acelerador'), dos('The selling is building, not fading', 'La venta crece, no se agota')]),
    dos(`The last candle sold MORE than the one before (${signo(c2.delta)} to ${signo(c1.delta)}) and ${cvdTxt(false)}. Bounces are shallow and sold fast. Ride it short, do not fade it.`,
      `La última vela vendió MÁS que la anterior (${signo(c2.delta)} a ${signo(c1.delta)}) y ${cvdTxt(true)}. Los rebotes son cortos y se venden rápido. Móntate en corto, no la pelees.`),
    dos(`Sell the bounce to ${P(nivel)}${ss}, target ${P(swLo)}. Out if delta flips positive.`, `Vende el rebote a ${P(nivel)}${ss}, objetivo ${P(swLo)}. Fuera si el delta se pone positivo.`));

  // ── 5) CONTROL: tendencia REAL (ventaja fuerte) o solo ligera ventaja ──
  if (fuerteBuy && sobreValor) return out('ctrl-buy-hi', 'tendencia',
    rot([dos('Buyers own this', 'Esto es del comprador'), dos('Clean bid, trend up', 'Demanda limpia, tendencia al alza')]),
    dos(`Buyers are ${buyPct}% of the volume, ${cvdTxt(false)} and price is above value ${P(nivel)}. All three line up, so this is a real trend, not noise. Every dip is getting bought.`,
      `El comprador es el ${buyPct}% del volumen, ${cvdTxt(true)} y el precio está sobre el valor ${P(nivel)}. Las tres coinciden, así que es tendencia real, no ruido. Cada caída se está comprando.`),
    dos(`Buy the dip to ${P(nivel)}${sb}, target ${P(swHi)}. Out if price loses ${P(nivel)} or the CVD rolls over.`, `Compra la caída a ${P(nivel)}${sb}, objetivo ${P(swHi)}. Fuera si pierde ${P(nivel)} o el CVD se da vuelta.`));
  if (fuerteSell && !sobreValor) return out('ctrl-sell-hi', 'venta',
    rot([dos('Sellers own this', 'Esto es del vendedor'), dos('Heavy offer, trend down', 'Oferta pesada, tendencia a la baja')]),
    dos(`Sellers are ${100 - buyPct}% of the volume, ${cvdTxt(false)} and price is below value ${P(nivel)}. All three line up, so this is a real downtrend. Every bounce is getting sold.`,
      `El vendedor es el ${100 - buyPct}% del volumen, ${cvdTxt(true)} y el precio está bajo el valor ${P(nivel)}. Las tres coinciden, así que es tendencia bajista real. Cada rebote se está vendiendo.`),
    dos(`Sell the bounce to ${P(nivel)}${ss}, target ${P(swLo)}. Out if price reclaims ${P(nivel)} or the CVD turns up.`, `Vende el rebote a ${P(nivel)}${ss}, objetivo ${P(swLo)}. Fuera si recupera ${P(nivel)} o el CVD gira arriba.`));
  if (ventajaBuy && !ventajaSell) return out('ctrl-buy-lo', 'vigilar',
    rot([dos('Buyers in front, not in control', 'El comprador va delante, sin control'), dos('Slight long lean', 'Ligera ventaja larga')]),
    dos(`Buyers have a slight edge (${buyPct}%) and ${cvdTxt(false)}, but it is not a clean trend yet. This is a spot to wait for proof, not to chase.`,
      `El comprador tiene una ligera ventaja (${buyPct}%) y ${cvdTxt(true)}, pero todavía no es tendencia limpia. Es momento de esperar confirmación, no de perseguir.`),
    dos(`Long only if a candle holds above ${P(nivel)} with positive delta, target ${P(swHi)}. Stand aside while it stays below.`, `Largo solo si una vela aguanta sobre ${P(nivel)} con delta positivo, objetivo ${P(swHi)}. Fuera mientras siga debajo.`));
  if (ventajaSell && !ventajaBuy) return out('ctrl-sell-lo', 'vigilar',
    rot([dos('Sellers in front, not in control', 'El vendedor va delante, sin control'), dos('Slight short lean', 'Ligera ventaja corta')]),
    dos(`Sellers have a slight edge (${100 - buyPct}%) and ${cvdTxt(false)}, but it is not a clean trend yet. Wait for proof before pressing the short.`,
      `El vendedor tiene una ligera ventaja (${100 - buyPct}%) y ${cvdTxt(true)}, pero todavía no es tendencia limpia. Espera confirmación antes de apretar el corto.`),
    dos(`Short only if a candle holds below ${P(nivel)} with negative delta, target ${P(swLo)}. Stand aside while it stays above.`, `Corto solo si una vela aguanta bajo ${P(nivel)} con delta negativo, objetivo ${P(swLo)}. Fuera mientras siga encima.`));

  // ── 6) Sin control: rotación ────────────────────────────────────────
  return out('ctrl-bal', 'vigilar',
    rot([dos('Chop, trade only the edges', 'Picadillo, opera solo los extremos'), dos('No trend, range in play', 'Sin tendencia, manda el rango')]),
    dos(`Buying and selling are even (${buyPct}% buy) and ${cvdTxt(false)}. Price is rotating between ${P(swLo)} and ${P(swHi)} around value ${P(nivel)}. The middle is where accounts get bled.`,
      `La compra y la venta están parejas (${buyPct}% compra) y ${cvdTxt(true)}. El precio rota entre ${P(swLo)} y ${P(swHi)} alrededor del valor ${P(nivel)}. En el medio es donde se desangran las cuentas.`),
    dos(`Buy ${P(swLo)} with absorption, sell ${P(swHi)} with absorption. Take a side only when the CVD breaks and delta follows.`, `Compra ${P(swLo)} con absorción, vende ${P(swHi)} con absorción. Toma lado solo cuando el CVD rompa y el delta acompañe.`));
}
