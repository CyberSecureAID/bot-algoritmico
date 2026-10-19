/* terminal/auditoria.js. Auditoria de seguridad de un token antes de comprar (modulo sellado).
   Dos fuentes, combinadas:
     1) GoPlus Token Security (misma API publica que ya usa Wallet Shield): honeypot, impuestos de compra
        y venta, mint, propietario oculto, recuperar propiedad, pausable, lista negra, proxy, codigo abierto,
        LP bloqueada. GoPlus tarda minutos u horas en indexar un token nuevo: sus holders y creador llegan
        tarde o vacios (0 holders, creador 100 %). Por eso NO se usan para esas cifras.
     2) Lecturas propias en cadena por RPC (lo mismo que ve BscScan): hay codigo, owner() renunciado o no,
        LP quemada (saldo del par en las direcciones muertas), creador (quien envio la tx de creacion),
        holders, top 10 y bolsa del creador reconstruidos a partir de los eventos Transfer del token.
   Cada lectura es un paso con su propio tope de tiempo y avisa por alPaso(id, estado) para que la ficha
   enseñe el progreso.
   NO predice si va a subir. Solo informa de lo que el contrato permite HOY. El resultado es un semaforo
   con cada motivo explicado. Funciones puras separadas para poder probarlas sin red. */

import * as ethers from './ethers.min.js';
import { conRotacion, conTiempo } from './rpc.js';

const log = (...a) => { try { console.info('[TERM-AUDIT]', ...a); } catch (_) {} };
const GOPLUS = 'https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=';
const MUERTAS = ['0x000000000000000000000000000000000000dead', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001'];

const ABI = ['function owner() view returns (address)', 'function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)'];
const TOPIC_TRANSFER = ethers.id('Transfer(address,address,uint256)');
const TRAMO = 1000;          // bloques por eth_getLogs (limite habitual de los RPC publicos)
const MAX_TRAMOS = 12;       // hacia atras desde el bloque de creacion si aun faltan transferencias
export const PASOS = ['code', 'owner', 'scanner', 'lp', 'holders'];
export const PASOS_TXT = { code: 'Code', owner: 'Owner', scanner: 'Scan', lp: 'LP', holders: 'Holders' };

/* ── 1) GoPlus ── */
export async function leerGoPlus(token) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(GOPLUS + encodeURIComponent(String(token).toLowerCase()), { signal: ctl.signal });
    const j = await r.json();
    const d = j && j.result && j.result[String(token).toLowerCase()];
    return d || null;      // null = GoPlus aun no tiene datos (tokens de hace segundos)
  } catch (e) { log('goplus fallo', e && e.message); return null; }
  finally { clearTimeout(t); }
}

/* ── 2) Lecturas propias ── */
const topicAddr = (a) => ethers.zeroPadValue(ethers.getAddress(a), 32);
const addrTopic = (t) => ethers.getAddress('0x' + String(t).slice(-40));

/* Holders reales a partir de los eventos Transfer del token. Reconstruye el saldo de cada direccion
   (entradas menos salidas) desde antes de la primera transferencia hasta hoy. Si al terminar los saldos
   no cuadran con totalSupply, amplia la ventana hacia atras (el token pudo desplegarse antes del par). */
const CERO = '0x0000000000000000000000000000000000000000';
const MAX_MOVS = 8000;   // tope de seguridad; un token nuevo tiene pocas transferencias
export async function leerHolders(token, desdeBloque, hasta, par) {
  const saldos = new Map(); const txs = new Set(); const movs = [];
  let primero = null;
  const leerTramo = async (ini, fin) => {
    const logs = await conRotacion((p) => p.getLogs({ address: token, topics: [TOPIC_TRANSFER], fromBlock: ini, toBlock: fin }));
    for (const l of logs) {
      if (!l.topics || l.topics.length < 3) continue;
      const de = addrTopic(l.topics[1]).toLowerCase(), a = addrTopic(l.topics[2]).toLowerCase();
      const v = BigInt(l.data === '0x' ? 0 : l.data);
      saldos.set(de, (saldos.get(de) || 0n) - v); saldos.set(a, (saldos.get(a) || 0n) + v); txs.add(l.transactionHash);
      if (movs.length < MAX_MOVS) movs.push({ b: Number(l.blockNumber), de, a, v });
      if (primero == null || l.blockNumber < primero) primero = l.blockNumber;
    }
    return logs.length;
  };
  const sup = await conRotacion((p) => new ethers.Contract(token, ABI, p).totalSupply());
  let ini = Math.max(0, desdeBloque - TRAMO), fin = hasta;
  // Tramo inicial: desde algo antes del bloque de creacion hasta hoy, en trozos paralelos.
  const trozos = []; for (let b = ini; b <= fin; b += TRAMO) trozos.push([b, Math.min(fin, b + TRAMO - 1)]);
  await Promise.all(trozos.map(([a, b]) => leerTramo(a, b)));
  const cuadra = () => { let s = 0n; for (const [, v] of saldos) if (v > 0n) s += v; return sup === 0n || (s >= sup && s - sup <= sup / 1000n) || (s <= sup && sup - s <= sup / 1000n); };
  for (let k = 0; k < MAX_TRAMOS && !cuadra() && ini > 0; k++) { const nIni = Math.max(0, ini - TRAMO); await leerTramo(nIni, ini - 1); ini = nIni; }
  const parL = String(par || '').toLowerCase();
  const quitar = new Set([...MUERTAS, parL]);
  const lista = [...saldos].filter(([a, v]) => v > 0n && !quitar.has(a)).sort((x, y) => (y[1] > x[1] ? 1 : y[1] < x[1] ? -1 : 0));
  const pctDe = (v) => sup > 0n ? Number((v * 10000n) / sup) / 100 : 0;
  const saldoDe = (a) => { const v = saldos.get(a); return v && v > 0n ? v : 0n; };

  // ── Inteligencia (de los mismos movimientos) ──
  // Mint: la primera transferencia desde la direccion cero. Su receptor suele ser el creador.
  const mintMov = movs.filter((m) => m.de === CERO).sort((a, b) => a.b - b.b)[0] || null;
  const mintTo = mintMov ? mintMov.a : null;
  const mintBlock = mintMov ? mintMov.b : null;
  // Primer bloque de trading: el bloque mas temprano con una compra desde el par.
  let bloqueTrade = null;
  if (parL) for (const m of movs) if (m.de === parL && (bloqueTrade == null || m.b < bloqueTrade)) bloqueTrade = m.b;
  // Snipers: wallets que compraron al par en ese primer bloque de trading (y que aun tienen saldo).
  const snipSet = new Set();
  if (bloqueTrade != null) for (const m of movs) if (m.de === parL && m.b === bloqueTrade && !quitar.has(m.a)) snipSet.add(m.a);
  let snipPct = 0n; for (const a of snipSet) snipPct += saldoDe(a);
  // Bundle (wallets conectadas): recibieron tokens directo del creador (no por el par) o en el bloque del mint.
  const bundleSet = new Set();
  for (const m of movs) {
    if (quitar.has(m.a) || m.a === mintTo) continue;
    const delCreador = mintTo && m.de === mintTo && m.de !== parL;
    const enMint = mintBlock != null && m.b === mintBlock && m.de !== CERO && m.de !== parL;
    if (delCreador || enMint) bundleSet.add(m.a);
  }
  let bundlePct = 0n; for (const a of bundleSet) bundlePct += saldoDe(a);
  const etiqueta = (a) => a === mintTo ? 'creator' : (snipSet.has(a) ? 'sniper' : (bundleSet.has(a) ? 'bundle' : ''));
  const topHolders = lista.slice(0, 10).map(([a, v]) => ({ addr: a, pct: pctDe(v), tag: etiqueta(a) }));

  return {
    completo: cuadra(), holders: lista.length, txs: txs.size,
    top10Pct: pctDe(lista.slice(0, 10).reduce((s, [, v]) => s + v, 0n)),
    saldos, supply: sup, pctDe, primerBloque: primero, mintTo,
    topHolders,
    snipers: snipSet.size, snipersPct: pctDe(snipPct),
    bundle: bundleSet.size, bundlePct: pctDe(bundlePct)
  };
}

/* Lecturas propias, paso a paso. it: fila del feed (tx de creacion, bloque, creador si la fuente lo da). */
export async function leerCadena(token, par, it = {}, alPaso = () => {}, conHolders = true) {
  const out = { hayCodigo: null, owner: null, lpQuemadaPct: null, creador: it.creador || null, holders: null, txs: null, top10Pct: null, creadorPct: null, holdersCompleto: null, topHolders: null, snipers: null, snipersPct: null, bundle: null, bundlePct: null };
  const paso = async (id, ms, fn) => { alPaso(id, 'run'); try { await conTiempo(fn(), ms); alPaso(id, 'ok'); } catch (e) { log('paso', id, 'fallo', e && e.message); alPaso(id, 'fail'); } };
  const tCode = paso('code', 10000, async () => { const code = await conRotacion((p) => p.getCode(token)); out.hayCodigo = !!(code && code !== '0x'); });
  const tOwner = paso('owner', 10000, async () => { try { out.owner = String(await conRotacion((p) => new ethers.Contract(token, ABI, p).owner())); } catch (_) { out.owner = null; } });   // sin owner(): no es Ownable
  const tLp = paso('lp', 12000, async () => {
    if (!par) return;
    const c = (p) => new ethers.Contract(par, ABI, p);
    const [sup, ...saldos] = await Promise.all([conRotacion((p) => c(p).totalSupply()), ...MUERTAS.map((a) => conRotacion((p) => c(p).balanceOf(a)).catch(() => 0n))]);
    const quemado = saldos.reduce((s, x) => s + x, 0n);
    out.lpQuemadaPct = sup > 0n ? Number((quemado * 10000n) / sup) / 100 : 0;
  });
  const leerCreador = async () => {
    // Creador: quien envio la tx que creo el par o el token (lo que BscScan llama "Creator").
    if (!out.creador && it.tx) { try { const tx = await conRotacion((p) => p.getTransaction(it.tx)); if (tx && tx.from) out.creador = String(tx.from); } catch (_) {} }
  };
  const tHold = !conHolders
    ? paso('holders', 12000, async () => {
      // Version ligera (lista y filtros): creador y su bolsa con dos lecturas, sin reconstruir holders.
      await leerCreador(); if (!out.creador) return;
      const c = (p) => new ethers.Contract(token, ABI, p);
      const [sup, v] = await Promise.all([conRotacion((p) => c(p).totalSupply()), conRotacion((p) => c(p).balanceOf(out.creador))]);
      out.creadorPct = sup > 0n ? Number((v * 10000n) / sup) / 100 : 0;
    })
    : paso('holders', 25000, async () => {
      await leerCreador();
      const hasta = await conRotacion((p) => p.getBlockNumber());
      const desde = it.bloque ? Number(it.bloque) : Math.max(0, hasta - TRAMO * 4);
      const h = await leerHolders(token, desde, hasta, par);
      out.holders = h.holders; out.txs = h.txs; out.top10Pct = h.top10Pct; out.holdersCompleto = h.completo;
      out.topHolders = h.topHolders; out.snipers = h.snipers; out.snipersPct = h.snipersPct; out.bundle = h.bundle; out.bundlePct = h.bundlePct;
      if (!out.creador && h.mintTo) out.creador = h.mintTo;
      if (!out.creador && h.primerBloque != null) {
        // Sin tx de creacion: el creador es quien recibio la primera transferencia (el mint).
        const logs = await conRotacion((p) => p.getLogs({ address: token, topics: [TOPIC_TRANSFER], fromBlock: h.primerBloque, toBlock: h.primerBloque }));
        if (logs.length && logs[0].topics.length >= 3) out.creador = addrTopic(logs[0].topics[2]);
      }
      if (out.creador) {
        let v = h.saldos.get(out.creador.toLowerCase());
        if (v == null || !h.completo) { try { v = await conRotacion((p) => new ethers.Contract(token, ABI, p).balanceOf(out.creador)); } catch (_) {} }
        if (v != null) out.creadorPct = h.pctDe(v > 0n ? v : 0n);
      }
    });
  await Promise.all([tCode, tOwner, tLp, tHold]);
  return out;
}

/* ── 3) Veredicto (funcion pura) ──
   gp: respuesta de GoPlus o null. cad: lecturas propias. Devuelve {nivel, titulo, hallazgos[], datos}.
   nivel: 'bad' (no compres), 'warn' (riesgos reales, decide tu), 'ok' (sin banderas en el codigo), 'pend' (sin datos aun). */
export function evaluar(gp, cad) {
  const h = [];           // {n:'bad'|'warn'|'ok'|'info', t:texto, d:detalle}
  const f = (k) => gp && gp[k] != null ? String(gp[k]) : '';
  const si = (k) => f(k) === '1';
  const num = (k) => { const v = parseFloat(f(k)); return isFinite(v) ? v : null; };
  const datos = {};

  // Codigo y propietario (propio)
  if (cad && cad.hayCodigo === false) h.push({ n: 'bad', t: 'No contract code', d: 'This address has no code. It is not a token.' });
  const ownerMuerto = cad && cad.owner && MUERTAS.includes(cad.owner.toLowerCase());
  if (cad && cad.owner) {
    if (ownerMuerto) h.push({ n: 'ok', t: 'Ownership renounced', d: 'No one can change the contract rules anymore.' });
    else h.push({ n: 'warn', t: 'Owner still in control', d: 'The owner wallet can still call privileged functions.' });
  }
  if (cad && cad.lpQuemadaPct != null) { datos.lpQuemada = cad.lpQuemadaPct; }

  // Distribucion leida en cadena (lo que ve BscScan). GoPlus solo rellena lo que falte.
  const hcC = cad && cad.holders != null ? cad.holders : null;
  const cpC = cad && cad.creadorPct != null ? cad.creadorPct / 100 : null;
  const t10C = cad && cad.top10Pct != null ? cad.top10Pct : null;
  if (cad && cad.creador) datos.creador = cad.creador;
  if (cad && cad.txs != null) datos.txs = cad.txs;
  if (hcC != null) datos.holders = hcC;
  if (cpC != null) datos.creadorPct = cpC * 100;
  if (t10C != null) datos.top10Pct = t10C;
  // Inteligencia leida en cadena: top holders, snipers (primer bloque de trading) y bundle (wallets conectadas).
  if (cad && cad.topHolders) datos.topHolders = cad.topHolders;
  if (cad && cad.snipers != null) { datos.snipers = cad.snipers; datos.snipersPct = cad.snipersPct; }
  if (cad && cad.bundle != null) { datos.bundle = cad.bundle; datos.bundlePct = cad.bundlePct; }
  const avisoReparto = () => {
    if (cad && cad.snipers > 0 && cad.snipersPct >= 10) h.push({ n: 'warn', t: cad.snipers + ' snipers hold ' + Math.round(cad.snipersPct) + '%', d: 'Wallets that bought in the very first block can dump on later buyers.' });
    if (cad && cad.bundle >= 3 && cad.bundlePct >= 15) h.push({ n: 'warn', t: cad.bundle + ' connected wallets hold ' + Math.round(cad.bundlePct) + '%', d: 'Several wallets funded by the creator or bought in the same block (possible bundle).' });
  };

  if (!gp) {
    const nivel = h.some((x) => x.n === 'bad') ? 'bad' : 'pend';
    if (cpC != null && cpC >= 0.2) h.push({ n: 'warn', t: 'Creator holds ' + Math.round(cpC * 100) + '%', d: 'A large creator bag can be dumped on buyers.' });
    if (t10C != null && t10C >= 70) h.push({ n: 'warn', t: 'Top 10 hold ' + Math.round(t10C) + '%', d: 'Very concentrated supply.' });
    if (datos.lpQuemada != null) { datos.lpAsegurada = datos.lpQuemada; if (datos.lpQuemada >= 90) h.push({ n: 'ok', t: 'Liquidity burned (' + Math.round(datos.lpQuemada) + '%)', d: 'The pool cannot be pulled.' }); else h.push({ n: 'warn', t: 'Liquidity not burned', d: 'The creator can remove the pool at any time (rug pull).' }); }
    avisoReparto();
    h.push({ n: 'info', t: 'Scanner data not available yet', d: 'Honeypot and tax checks need the security scanner, which has not indexed this token yet. Holders, creator and liquidity above are read from the chain.' });
    return { nivel, titulo: nivel === 'bad' ? 'Do not buy' : 'Checking', hallazgos: h, datos };
  }

  // Venta
  if (si('is_honeypot')) h.push({ n: 'bad', t: 'Honeypot', d: 'The sell simulation fails: you can buy but you cannot sell.' });
  if (si('cannot_sell_all')) h.push({ n: 'bad', t: 'Cannot sell all', d: 'The contract blocks selling your full balance.' });
  if (si('cannot_buy')) h.push({ n: 'bad', t: 'Cannot buy', d: 'The contract blocks buying right now.' });
  const bt = num('buy_tax'), st = num('sell_tax');
  if (bt != null) datos.buyTax = bt * 100;
  if (st != null) datos.sellTax = st * 100;
  if (st != null && st >= 0.5) h.push({ n: 'bad', t: 'Sell tax ' + Math.round(st * 100) + '%', d: 'Half or more of what you sell is taken.' });
  else if ((st != null && st >= 0.1) || (bt != null && bt >= 0.1)) h.push({ n: 'warn', t: 'High taxes', d: 'Buy ' + (bt != null ? Math.round(bt * 100) : '?') + '% / sell ' + (st != null ? Math.round(st * 100) : '?') + '%.' });
  else if (bt != null || st != null) h.push({ n: 'ok', t: 'Low taxes', d: 'Buy ' + (bt != null ? Math.round(bt * 100) : 0) + '% / sell ' + (st != null ? Math.round(st * 100) : 0) + '%.' });
  if (si('slippage_modifiable')) h.push({ n: 'warn', t: 'Taxes can be changed', d: 'The owner can raise buy or sell tax at any time.' });
  if (si('trading_cooldown')) h.push({ n: 'warn', t: 'Trading cooldown', d: 'The contract limits how often you can trade.' });

  // Control del propietario
  if (si('hidden_owner')) h.push({ n: 'bad', t: 'Hidden owner', d: 'Ownership looks renounced but a hidden owner keeps control.' });
  if (si('can_take_back_ownership')) h.push({ n: 'bad', t: 'Can take back ownership', d: 'Renounced ownership can be recovered.' });
  if (si('selfdestruct')) h.push({ n: 'bad', t: 'Self destruct', d: 'The contract can be destroyed and the token wiped.' });
  if (si('is_mintable')) h.push({ n: 'warn', t: 'Mintable', d: 'More tokens can be created, diluting holders.' });
  if (si('transfer_pausable')) h.push({ n: 'warn', t: 'Transfers can be paused', d: 'The owner can freeze all trading.' });
  if (si('is_blacklisted')) h.push({ n: 'warn', t: 'Blacklist function', d: 'Specific wallets can be blocked from selling.' });
  if (si('is_whitelisted')) h.push({ n: 'info', t: 'Whitelist function', d: 'Some wallets may be exempt from limits or taxes.' });
  if (si('external_call')) h.push({ n: 'warn', t: 'External calls', d: 'Transfers call another contract; behavior can change.' });
  if (si('is_proxy')) h.push({ n: 'warn', t: 'Upgradeable proxy', d: 'The code can be replaced later.' });
  if (f('is_open_source') === '0') h.push({ n: 'warn', t: 'Source not verified', d: 'The code cannot be read on BscScan.' });
  else if (si('is_open_source')) h.push({ n: 'ok', t: 'Source verified', d: 'The code is public on BscScan.' });
  if (si('is_anti_whale')) h.push({ n: 'info', t: 'Anti whale limits', d: 'Max buy or max wallet limits apply.' });

  // Distribucion
  // GoPlus con holder_count 0 no ha indexado las transferencias: su creador 100 % y top 10 son humo.
  const gpIndexado = num('holder_count') > 0;
  const hc = hcC != null ? hcC : (gpIndexado ? num('holder_count') : null); if (hc != null) datos.holders = hc;
  const cp = cpC != null ? cpC : (gpIndexado ? num('creator_percent') : null); if (cp != null) datos.creadorPct = cp * 100;
  if (!datos.creador && f('creator_address')) datos.creador = f('creator_address');
  const op = num('owner_percent'); if (op != null) datos.ownerPct = op * 100;
  let top10 = t10C;
  if (top10 == null && gpIndexado && Array.isArray(gp.holders)) top10 = gp.holders.slice(0, 10).reduce((s, x) => s + (parseFloat(x.percent) || 0), 0) * 100;
  if (top10 != null) datos.top10Pct = top10;
  if (cp != null && cp >= 0.2) h.push({ n: 'warn', t: 'Creator holds ' + Math.round(cp * 100) + '%', d: 'A large creator bag can be dumped on buyers.' });
  if (top10 != null && top10 >= 70) h.push({ n: 'warn', t: 'Top 10 hold ' + Math.round(top10) + '%', d: 'Very concentrated supply.' });
  if (hc != null && hc < 20) h.push({ n: 'info', t: 'Only ' + hc + ' holders', d: 'Very early. Thin market.' });
  avisoReparto();

  // Liquidez
  let lpLock = 0, lpTotal = 0;
  if (Array.isArray(gp.lp_holders)) for (const x of gp.lp_holders) { const pc = parseFloat(x.percent) || 0; lpTotal += pc; if (String(x.is_locked) === '1' || MUERTAS.includes(String(x.address || '').toLowerCase())) lpLock += pc; }
  const quemada = datos.lpQuemada != null ? datos.lpQuemada : null;
  const asegurada = Math.max(lpLock * 100, quemada || 0);
  if (lpTotal > 0 || quemada != null) {
    datos.lpAsegurada = asegurada;
    if (asegurada >= 90) h.push({ n: 'ok', t: 'Liquidity burned or locked (' + Math.round(asegurada) + '%)', d: 'The pool cannot be pulled.' });
    else if (asegurada >= 50) h.push({ n: 'warn', t: 'Liquidity partly secured (' + Math.round(asegurada) + '%)', d: 'Part of the pool can still be withdrawn.' });
    else h.push({ n: 'warn', t: 'Liquidity not locked', d: 'The creator can remove the pool at any time (rug pull).' });
  }
  if (si('fake_token')) h.push({ n: 'bad', t: 'Fake token', d: 'Imitates a known token.' });
  if (si('is_airdrop_scam')) h.push({ n: 'bad', t: 'Airdrop scam pattern', d: 'Flagged as an airdrop scam.' });
  if (si('honeypot_with_same_creator')) h.push({ n: 'warn', t: 'Creator made honeypots before', d: 'Same creator deployed honeypot tokens.' });

  // Comprobaciones sueltas (true/false) para los filtros personalizados de la lista. Solo con datos de GoPlus.
  datos.checks = {
    sellable: !si('is_honeypot') && !si('cannot_sell_all') && !si('cannot_buy'),
    lowTax: (bt == null || bt < 0.1) && (st == null || st < 0.1),
    notMintable: !si('is_mintable'),
    noPause: !si('transfer_pausable'),
    noBlacklist: !si('is_blacklisted'),
    verified: si('is_open_source'),
    renounced: !!ownerMuerto && !si('hidden_owner') && !si('can_take_back_ownership'),
    lpSecured: asegurada >= 90,
    creatorSmall: cp == null || cp < 0.2,
    notConcentrated: top10 == null || top10 < 70
  };
  const nivel = h.some((x) => x.n === 'bad') ? 'bad' : (h.some((x) => x.n === 'warn') ? 'warn' : 'ok');
  const titulo = nivel === 'bad' ? 'Do not buy' : nivel === 'warn' ? 'Caution' : 'No red flags in the code';
  // orden: malo, aviso, ok, info
  const peso = { bad: 0, warn: 1, ok: 2, info: 3 }; h.sort((a, b) => peso[a.n] - peso[b.n]);
  return { nivel, titulo, hallazgos: h, datos };
}

/* Auditoria completa de un token. alPaso(id, 'run'|'ok'|'fail') por cada paso de PASOS.
   Topes por paso y global de 25 s: aunque un RPC o GoPlus no respondan, la ficha siempre recibe un resultado. */
export async function auditar(token, par, it = {}, alPaso = () => {}, conHolders = true) {
  const gpP = (async () => { alPaso('scanner', 'run'); const g = await conTiempo(leerGoPlus(token), 12000).catch(() => null); alPaso('scanner', g ? 'ok' : 'fail'); return g; })();
  const [gp, cad] = await Promise.all([gpP, conTiempo(leerCadena(token, par, it, alPaso, conHolders), 26000).catch(() => ({}))]);
  const res = evaluar(gp, cad); res.completo = !!conHolders;
  log(token, res.nivel, res.hallazgos.map((x) => x.t));
  return res;
}
