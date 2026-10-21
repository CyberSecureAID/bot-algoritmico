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
import { BSCSCAN_API, BSCSCAN_V2 } from './config.js';

/* ── BscScan (Etherscan V2) ── Datos AUTORITATIVOS, los MISMOS que muestra BscScan, para que nuestro Security
   Check jamas sea incongruente con el explorador. Gratis (la key ya esta en config), CORS abierto, 5 req/s.
   Dos cosas que solo el explorador da bien:
     · getcontractcreation -> creador real + BLOQUE de creacion. El bloque es la pieza que faltaba: ancla el
       escaneo de holders al nacimiento del token, asi un token nuevo (IBVM: 4 holders) los muestra TODOS en
       vez de 0 (antes solo miraba ~4000 bloques hacia atras y perdia la historia).
     · getsourcecode -> si el contrato esta VERIFICADO (igual que BscScan). Fin del "verified: No" en contratos
       que si estan verificados. */
export async function bscScanInfo(token) {
  const base = BSCSCAN_V2 + '?chainid=56&apikey=' + BSCSCAN_API;
  const get = async (q) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 9000); try { const r = await fetch(base + q, { signal: c.signal }); if (!r.ok) return null; return await r.json(); } finally { clearTimeout(t); } };
  const [cre, src] = await Promise.all([
    get('&module=contract&action=getcontractcreation&contractaddresses=' + token).catch(() => null),
    get('&module=contract&action=getsourcecode&address=' + token).catch(() => null)
  ]);
  const out = {};
  if (cre && Array.isArray(cre.result) && cre.result[0]) {
    const c0 = cre.result[0];
    if (c0.contractCreator) out.creador = c0.contractCreator;
    if (c0.txHash) out.txCreacion = c0.txHash;
    if (c0.blockNumber != null && c0.blockNumber !== '') out.bloque = Number(c0.blockNumber);
  }
  if (src && Array.isArray(src.result) && src.result[0]) {
    const s = src.result[0];
    // Verificado si la ABI NO es el texto de "no verificado" (el campo status miente: es "1" aun sin verificar).
    out.verificado = !!(s.ABI && s.ABI !== 'Contract source code not verified');
    if (s.ContractName) out.nombre = s.ContractName;
    out.esProxy = s.Proxy === '1';
    if (s.Implementation) out.impl = s.Implementation;
  }
  return out;
}

const log = (...a) => { try { console.info('[TERM-AUDIT]', ...a); } catch (_) {} };
const GOPLUS = 'https://api.gopluslabs.io/api/v1/token_security/';   // + chain_id ('56' BSC, 'tron' Tron)
const MUERTAS = ['0x000000000000000000000000000000000000dead', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001'];

/* Contratos OFICIALES de los estables mayores (los unicos legitimos). Cualquier token cuyo SIMBOLO imite a uno
   de estos pero cuyo contrato NO sea el oficial es un IMPOSTOR (scam que se hace pasar por USDT/USDC/etc.). Asi
   el Security Check deja de dar 99% a un USDT.z falso sin bloquear a ciegas por el nombre: compara la direccion. */
const OFICIALES = {
  USDT: { bsc: '0x55d398326f99059ff775485246999027b3197955', tron: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
  USDC: { bsc: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', tron: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8' },
  BUSD: { bsc: '0xe9e7cea3dedca5984780bafc599bd69add087d56' },
  DAI: { bsc: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3' },
  TUSD: { bsc: '0x14016e85a25aeb13065688cafb43044c2ef86784' }
};
/* Devuelve el simbolo mayor que imita (p.ej. 'USDT') si el token es impostor, o null si es legitimo. */
export function tokenImpostor(simbolo, address, red) {
  const s = String(simbolo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');   // "USDT.z" -> "USDTZ"
  if (!s) return null;
  const tron = red === 'tron';
  for (const base in OFICIALES) {
    if (s === base || (s.startsWith(base) && s.length > base.length)) {       // imita a `base`
      const of = OFICIALES[base][tron ? 'tron' : 'bsc']; if (!of) continue;
      const real = tron ? (String(address) === of) : (String(address || '').toLowerCase() === of);
      if (!real) return base;                                                 // imita pero NO es el oficial -> impostor
    }
  }
  return null;
}

const ABI = ['function owner() view returns (address)', 'function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)'];
const TOPIC_TRANSFER = ethers.id('Transfer(address,address,uint256)');
const TRAMO = 1000;          // bloques por eth_getLogs (limite habitual de los RPC publicos)
const MAX_TRAMOS = 12;       // hacia atras desde el bloque de creacion si aun faltan transferencias
export const PASOS = ['code', 'owner', 'scanner', 'lp', 'holders'];
export const PASOS_TXT = { code: 'Code', owner: 'Owner', scanner: 'Scan', lp: 'LP', holders: 'Holders' };

/* ── 1) GoPlus ──
   CAUSA RAIZ del "siempre Partial check": GoPlus EMPEZO a bloquear las peticiones del navegador. Cuando el
   fetch lleva el header Origin (toda peticion cross-origin del navegador lo lleva) responde 403 Forbidden, asi
   que la llamada DIRECTA desde la web fallaba SIEMPRE -> gp=null -> todos los tokens caian a 'pend', incluso
   monedas que GoPlus SI tiene indexadas (USDT.z devuelve code:1 con 67868 holders si se pide sin Origin).
   Por eso "antes funcionaba" y de un dia para otro dejo de funcionar: no fue el codigo, fue su politica.
   Solucion: ir por proxies CORS en cascada (el mismo patron ya probado que usa tron.js). El directo se intenta
   primero por si GoPlus deja de bloquear; el primer proxy que responda gana. */
const GP_PROXIES = [
  (u) => u,
  (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
  (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  (u) => 'https://thingproxy.freeboard.io/fetch/' + u
];
export async function leerGoPlus(token, chain = '56') {
  const addr = String(token);
  const url = GOPLUS + chain + '?contract_addresses=' + encodeURIComponent(addr);
  const pedir = async (prox) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(prox(url), { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); const res = j && j.result; if (!res) return null;
      return res[addr] || res[addr.toLowerCase()] || null;   // EVM: clave en minuscula; Tron: base58 tal cual
    } finally { clearTimeout(t); }
  };
  for (let i = 0; i < GP_PROXIES.length; i++) {
    try { const a = await pedir(GP_PROXIES[i]); if (a) return a; } catch (e) { log('goplus via ' + i, e && e.message); }
  }
  return null;
}
/* honeypot.is: SEGUNDA fuente para BSC. SIMULA una compra y una venta reales (detecta bloqueos de venta que el
   analisis estatico no ve). CORS abierto (*), sin key, sin proxy. Si GoPlus no responde, esta SI da veredicto,
   para que el Security Check casi nunca se quede sin resultado. Solo BSC/EVM (es un simulador). */
export async function leerHoneypotIs(token) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 9000);
    const r = await fetch('https://api.honeypot.is/v2/IsHoneypot?address=' + encodeURIComponent(token) + '&chainID=56', { signal: c.signal });
    clearTimeout(t); if (!r.ok) return null; return await r.json();
  } catch (e) { log('honeypot.is', e && e.message); return null; }
}
/* Traduce la respuesta de honeypot.is al formato de campos de GoPlus para que evaluar() la use igual. */
function hpComoGp(hp) {
  if (!hp || !hp.honeypotResult) return null;
  const sim = hp.simulationResult || {}, code = hp.contractCode || {}, tk = hp.token || {};
  const g = { is_honeypot: hp.honeypotResult.isHoneypot ? '1' : '0', is_open_source: code.openSource ? '1' : '0', is_proxy: code.isProxy ? '1' : '0' };
  if (tk.symbol) g.token_symbol = tk.symbol; if (tk.name) g.token_name = tk.name;
  if (tk.totalHolders != null) g.holder_count = String(tk.totalHolders);
  if (sim.buyTax != null) g.buy_tax = String(Number(sim.buyTax) / 100);
  if (sim.sellTax != null) g.sell_tax = String(Number(sim.sellTax) / 100);
  if (hp.honeypotResult.isHoneypot) g.cannot_sell_all = '1';
  return g;
}
/* FUSIONA GoPlus + honeypot.is en un solo objeto. Clave para no dar FALSOS NEGATIVOS: si GoPlus esta obsoleto
   (p.ej. dice que un contrato VERIFICADO en BscScan no tiene codigo abierto, como pasa con tokens de fabricas
   tipo SmartDeFi), pero honeypot.is confirma lo contrario, gana la senal POSITIVA. honeypot/impuestos: si
   cualquiera marca peligro, se marca (seguridad). Lo que falte en una fuente lo rellena la otra. */
function fusionarGp(gp, hp) {
  if (!gp) return hp; if (!hp) return gp;
  const m = { ...gp };
  if (gp.is_open_source !== '1' && hp.is_open_source === '1') m.is_open_source = '1';   // verificado si CUALQUIERA lo dice
  if (hp.is_honeypot === '1') { m.is_honeypot = '1'; m.cannot_sell_all = '1'; }           // peligro si cualquiera lo dice
  if ((m.holder_count == null || m.holder_count === '0') && hp.holder_count) m.holder_count = hp.holder_count;
  if (!m.creator_address && hp.creator_address) m.creator_address = hp.creator_address;
  if (m.buy_tax == null && hp.buy_tax != null) m.buy_tax = hp.buy_tax;
  if (m.sell_tax == null && hp.sell_tax != null) m.sell_tax = hp.sell_tax;
  if (!m.token_symbol && hp.token_symbol) m.token_symbol = hp.token_symbol;
  return m;
}
/* ── Reputacion del WALLET creador/propietario (GoPlus address_security) ──
   Esto es lo que tienen Token Sniffer / De.Fi / Quick Intel y nosotros NO teniamos: una base de datos de actores
   maliciosos. No analiza el contrato, analiza AL WALLET que lo hizo: ¿ha estado ligado a honeypots, phishing,
   robos, lavado, sanciones, mezcladores? Un contrato "limpio" hecho por un estafador reincidente es una trampa,
   y esto lo caza. Misma API keyless de GoPlus, por el mismo cascade de proxies (cubre BSC chain '56' y 'tron'). */
const ADDRSEC = 'https://api.gopluslabs.io/api/v1/address_security/';
export async function leerAddressSecurity(addr, chain = '56') {
  const a = String(addr || '').trim(); if (!a || a === '0x0000000000000000000000000000000000000000') return null;
  const url = ADDRSEC + encodeURIComponent(a) + '?chain_id=' + chain;
  const pedir = async (prox) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try { const r = await fetch(prox(url), { signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); return (j && j.result) || null; }
    finally { clearTimeout(t); }
  };
  for (let i = 0; i < GP_PROXIES.length; i++) { try { const s = await pedir(GP_PROXIES[i]); if (s) return s; } catch (e) { log('addrsec via ' + i, e && e.message); } }
  return null;
}
// Banderas del wallet -> hallazgo (nivel, titulo, detalle). bad = delito grave; warn = sospecha.
const WALLET_FLAGS = {
  honeypot_related_address: ['bad', 'Creator tied to honeypots', 'The wallet that created this token is linked to known honeypot tokens.'],
  phishing_activities: ['bad', 'Creator tied to phishing', 'The creator wallet has known phishing activity.'],
  stealing_attack: ['bad', 'Creator tied to theft', 'The creator wallet is linked to token-stealing attacks.'],
  cybercrime: ['bad', 'Creator tied to cybercrime', 'The creator wallet is linked to cybercrime.'],
  money_laundering: ['bad', 'Creator tied to laundering', 'The creator wallet is linked to money laundering.'],
  financial_crime: ['bad', 'Creator tied to financial crime', 'The creator wallet is linked to financial crime.'],
  sanctioned: ['bad', 'Creator wallet sanctioned', 'The creator wallet is on a sanctions list.'],
  blackmail_activities: ['warn', 'Creator tied to blackmail', 'The creator wallet is linked to blackmail activity.'],
  darkweb_transactions: ['warn', 'Creator tied to darkweb', 'The creator wallet has darkweb-linked transactions.'],
  mixer: ['warn', 'Creator used a mixer', 'The creator wallet funnelled funds through a mixer (hides origin).'],
  fake_kyc: ['warn', 'Creator tied to fake KYC', 'The creator wallet is linked to fake KYC services.'],
  malicious_mining_activities: ['warn', 'Creator tied to malicious mining', 'The creator wallet is linked to malicious mining.'],
  blacklist_doubt: ['warn', 'Creator wallet on a blacklist', 'The creator wallet appears on third-party blacklists.']
};
function riesgosWallet(sec) {
  const out = []; if (!sec) return out;
  for (const k in WALLET_FLAGS) { if (String(sec[k]) === '1') { const [n, t, d] = WALLET_FLAGS[k]; out.push({ n, t, d }); } }
  const nmc = parseInt(sec.number_of_malicious_contracts_created, 10);
  if (nmc > 0) out.push({ n: 'bad', t: 'Creator made ' + nmc + ' malicious contract' + (nmc > 1 ? 's' : ''), d: 'This wallet has deployed malicious contracts before. A clean-looking token from a repeat offender is a red flag.' });
  return out;
}
/* Añade al resultado la reputacion del creador. Un hallazgo 'bad' del wallet hunde el veredicto a 'bad' y marca
   res.peligroCreador (para que el % y el escudo tambien bajen, no solo el texto). chain: '56' BSC, 'tron' Tron. */
async function anadirReputacionCreador(res, chain) {
  try {
    const wallet = (res && res.datos && res.datos.creador) || '';
    if (!wallet) return;
    const sec = await conTiempo(leerAddressSecurity(wallet, chain), 9000).catch(() => null);
    const rr = riesgosWallet(sec);
    if (!rr.length) return;
    res.hallazgos = rr.concat(res.hallazgos || []);
    if (rr.some((x) => x.n === 'bad')) { res.nivel = 'bad'; res.titulo = 'Do not buy'; res.peligroCreador = true; }
    else if (res.nivel === 'ok') { res.nivel = 'warn'; }
  } catch (_) {}
}
/* Auditoria de un token TRON: no hay RPC de Tron aqui, asi que se combina GoPlus (chain 'tron': honeypot, lista
   negra, mint, pausable, propietario) con TronScan (holders, creador, verificado). Devuelve el MISMO formato que
   evaluar() para que el sello, los checks y el veredicto se pinten igual que en BSC. Asi una moneda de Tron deja
   de quedarse en "Not a PancakeSwap pair": sale con su Security Check real. */
export async function auditarTron(token, it = {}) {
  let gp = null, ts = null, tg = null;
  try { gp = await leerGoPlus(token, 'tron'); } catch (_) {}
  // TronScan (holders/verificado/creador) + TronGrid (on-chain: existe/creador/verificado) en PARALELO. Son las
  // dos fuentes publicas de Tron; con que UNA responda, el token sale con veredicto real (nunca "sin datos").
  try { const m = await import('./tron.js'); const [a, b] = await Promise.all([m.seguridadTron(token).catch(() => null), m.tronGridContrato(token).catch(() => null)]); ts = a; tg = b; } catch (_) {}
  // Combina ambas: lo que falte en una lo rellena la otra. holders solo los da TronScan; existencia/creador/
  // verificado los confirma TronGrid leyendo la cadena directamente.
  const info = {};
  if (ts) { if (ts.holders != null) info.holders = ts.holders; if (ts.creador) info.creador = ts.creador; if (ts.verificado) info.verificado = true; }
  if (tg) { if (info.creador == null && tg.creador) info.creador = tg.creador; if (tg.verificado) info.verificado = true; }
  const hayTron = !!(ts || tg);
  const cad = {};
  if (info.holders != null) cad.holders = info.holders;
  if (info.creador) cad.creador = info.creador;
  const res = evaluar(gp, cad); res.completo = true; res.red = 'tron';
  // Sin GoPlus-tron, evaluar() cae a 'pend'. Pero si TronScan o TronGrid dieron datos publicos NO se deja al
  // usuario sin resultado: veredicto real con ellos. Verificado + base amplia de holders = buena senal; sin
  // verificar = precaucion. Asi un token de Tron SIEMPRE sale con algo, nunca el parrafo del escaner.
  if (!gp && hayTron) {
    res.hallazgos = res.hallazgos.filter((x) => !(x.n === 'info' && /scanner/i.test(x.t)));
    if (info.verificado) res.hallazgos.push({ n: 'ok', t: 'Source verified on-chain', d: 'The contract source is public and verified on Tron.' });
    else res.hallazgos.unshift({ n: 'warn', t: 'Source not verified', d: 'The contract source is not public on Tron. Trade with caution.' });
    if (info.holders >= 1000) res.hallazgos.push({ n: 'ok', t: Number(info.holders).toLocaleString('en-US') + ' holders', d: 'A wide holder base, consistent with a real, traded token.' });
    else if (info.holders > 0 && info.holders < 20) res.hallazgos.push({ n: 'info', t: 'Only ' + info.holders + ' holders', d: 'Very early. Thin market.' });
    if (!res.datos) res.datos = {};
    res.datos.checks = { verified: !!info.verificado };
    res.nivel = res.hallazgos.some((x) => x.n === 'bad') ? 'bad' : res.hallazgos.some((x) => x.n === 'warn') ? 'warn' : 'ok';
    res.titulo = res.nivel === 'bad' ? 'Do not buy' : res.nivel === 'warn' ? 'Caution' : 'No red flags found';
  }
  if (info.verificado) { if (!res.datos) res.datos = {}; if (!res.datos.checks) res.datos.checks = {}; res.datos.checks.verified = true; }
  try {
    const imp = tokenImpostor(it.simbolo || (gp && gp.token_symbol), token, 'tron');
    if (imp) { res.impostor = imp; res.nivel = 'bad'; res.titulo = 'Fake ' + imp + ', do not buy'; res.hallazgos.unshift({ n: 'bad', t: 'Impersonates ' + imp, d: 'The symbol mimics ' + imp + ' but this is NOT the official ' + imp + ' contract. Almost certainly a scam token made to pass as ' + imp + '.' }); }
  } catch (_) {}
  await anadirReputacionCreador(res, 'tron');   // reputacion del wallet creador tambien en Tron
  return res;
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
  const out = { hayCodigo: null, owner: null, lpQuemadaPct: null, creador: it.creador || null, holders: null, txs: null, top10Pct: null, creadorPct: null, holdersCompleto: null, topHolders: null, snipers: null, snipersPct: null, bundle: null, bundlePct: null, verificado: null, nombre: null };
  // BscScan solo en el analisis COMPLETO (OFC / ficha): ahi importa la precision. En el pase ligero del feed
  // (decenas de tokens) no se llama, para no gastar el rate-limit (5/s) en filas que no lo necesitan.
  const bscP = conHolders ? bscScanInfo(token).catch(() => null) : Promise.resolve(null);
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
  const aplicarBsc = (bsc) => { if (!bsc) return; if (!out.creador && bsc.creador) out.creador = bsc.creador; if (bsc.verificado != null) out.verificado = bsc.verificado; if (bsc.nombre && !out.nombre) out.nombre = bsc.nombre; };
  const tHold = !conHolders
    ? paso('holders', 12000, async () => {
      // Version ligera (lista y filtros): creador y su bolsa con dos lecturas, sin reconstruir holders.
      await leerCreador(); aplicarBsc(await bscP);
      if (!out.creador) return;
      const c = (p) => new ethers.Contract(token, ABI, p);
      const [sup, v] = await Promise.all([conRotacion((p) => c(p).totalSupply()), conRotacion((p) => c(p).balanceOf(out.creador))]);
      out.creadorPct = sup > 0n ? Number((v * 10000n) / sup) / 100 : 0;
    })
    : paso('holders', 25000, async () => {
      await leerCreador();
      const bsc = await bscP; aplicarBsc(bsc);
      const hasta = await conRotacion((p) => p.getBlockNumber());
      // Ancla el escaneo en el BLOQUE DE CREACION real (BscScan). Asi se barre toda la historia del token y
      // un token nuevo con pocas tx (IBVM) muestra TODOS sus holders, no 0. Sin ese dato, respaldo a la ventana.
      const desde = it.bloque ? Number(it.bloque) : (bsc && bsc.bloque != null ? bsc.bloque : Math.max(0, hasta - TRAMO * 4));
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
    if (cpC != null && cpC >= 0.2) h.push({ n: 'warn', t: 'Creator holds ' + Math.round(cpC * 100) + '%', d: 'A large creator bag can be dumped on buyers.' });
    if (t10C != null && t10C >= 70) h.push({ n: 'warn', t: 'Top 10 hold ' + Math.round(t10C) + '%', d: 'Very concentrated supply.' });
    if (datos.lpQuemada != null) { datos.lpAsegurada = datos.lpQuemada; if (datos.lpQuemada >= 90) h.push({ n: 'ok', t: 'Liquidity burned (' + Math.round(datos.lpQuemada) + '%)', d: 'The pool cannot be pulled.' }); else h.push({ n: 'warn', t: 'Liquidity not burned', d: 'The creator can remove the pool at any time (rug pull).' }); }
    // Verificado por BscScan (autoritativo): aunque GoPlus no respondiera, si BscScan dice verificado lo decimos.
    if (cad && cad.verificado === true) h.push({ n: 'ok', t: 'Source verified', d: 'The code is public and verified on BscScan.' });
    else if (cad && cad.verificado === false) h.push({ n: 'warn', t: 'Source not verified', d: 'The code is not verified on BscScan.' });
    avisoReparto();
    // Veredicto con lo leido EN CADENA aunque el escaner (honeypot/impuestos) no respondiera. Si hay banderas
    // (propiedad, LP, concentracion, snipers), DIAGNOSTICA (warn/bad) en vez de quedarte en "pendiente": el
    // usuario tenia razon, con esos datos SE PUEDE dar un veredicto. Si la cadena esta limpia pero NO se pudo
    // comprobar honeypot/impuestos, si queda 'pend' (no se puede AFIRMAR que es segura sin esa parte).
    const nivel = h.some((x) => x.n === 'bad') ? 'bad' : (h.some((x) => x.n === 'warn') ? 'warn' : 'pend');
    // NADA de parrafo "scanner no disponible": el diagnostico son los hallazgos REALES de cadena (propiedad, LP,
    // concentracion, snipers), cada uno con su motivo. El usuario odia esa coletilla; aqui no se añade.
    return { nivel, titulo: nivel === 'bad' ? 'Do not buy' : nivel === 'warn' ? 'On-chain risks found' : 'Checking', hallazgos: h, datos };
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
  // Verificado: BscScan manda (autoritativo). Si BscScan dice verificado, lo es, aunque GoPlus este obsoleto.
  const verif = (cad && cad.verificado === true) || si('is_open_source');
  if (verif) h.push({ n: 'ok', t: 'Source verified', d: 'The code is public and verified on BscScan.' });
  else if (cad && cad.verificado === false) h.push({ n: 'warn', t: 'Source not verified', d: 'The code is not verified on BscScan.' });
  else if (f('is_open_source') === '0') h.push({ n: 'warn', t: 'Source not verified', d: 'The code cannot be read on BscScan.' });
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
    verified: (cad && cad.verificado === true) || si('is_open_source'),
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
  alPaso('scanner', 'run');
  // DOS escaneres en paralelo para BSC: GoPlus (estatico, muchas banderas) y honeypot.is (simula compra+venta).
  // Si GoPlus no responde, honeypot.is da el veredicto -> el Security Check casi nunca se queda sin resultado.
  const gpP = conTiempo(leerGoPlus(token), 12000).catch(() => null);
  const hpP = conTiempo(leerHoneypotIs(token), 10000).catch(() => null);
  const cadP = conTiempo(leerCadena(token, par, it, alPaso, conHolders), 26000).catch(() => ({}));
  const [gp, hp, cad] = await Promise.all([gpP, hpP, cadP]);
  const gpUsar = fusionarGp(gp, hpComoGp(hp));   // GoPlus + honeypot.is fusionados: gana la senal positiva, se rellenan huecos
  alPaso('scanner', gpUsar ? 'ok' : 'fail');
  const res = evaluar(gpUsar, cad); res.completo = !!conHolders;
  if (hp && hp.honeypotResult && hp.honeypotResult.isHoneypot) { res.nivel = 'bad'; if (!res.hallazgos.some((x) => /honeypot/i.test(x.t))) res.hallazgos.unshift({ n: 'bad', t: 'Honeypot (sell simulation failed)', d: 'A real buy+sell simulation shows you could buy but NOT sell. Do not trade it.' }); }
  // IMPOSTOR: un token cuyo simbolo imita a un estable mayor pero su contrato NO es el oficial es un scam, por
  // mucho que GoPlus diga que el contrato no es honeypot. Fuerza veredicto 'bad' y lo pone como primer hallazgo.
  try {
    const imp = tokenImpostor(it.simbolo || (gpUsar && gpUsar.token_symbol), token, it.red);
    if (imp) {
      res.impostor = imp; res.nivel = 'bad'; res.titulo = 'Fake ' + imp + ', do not buy';
      res.hallazgos.unshift({ n: 'bad', t: 'Impersonates ' + imp, d: 'The symbol mimics ' + imp + ' but this is NOT the official ' + imp + ' contract. Almost certainly a scam token made to pass as ' + imp + '. Do not trade it.' });
    }
  } catch (_) {}
  if (conHolders) await anadirReputacionCreador(res, '56');   // reputacion del wallet creador (solo en el pase completo)
  // Holders: BscScan NO da el conteo gratis (es de pago). Si la reconstruccion on-chain no cuadro (token grande,
  // ventana corta), se complementa con la estimacion de GeckoTerminal, MARCADA como estimada (honesto: no se
  // inventa, se dice "~"). Asi nunca mostramos 0 ni menos que los demas cuando de verdad hay holders.
  if (conHolders) {
    try {
      const d = res.datos || {};
      const incompleto = d.holders == null || d.holders === 0 || (cad && cad.holdersCompleto === false);
      if (incompleto) {
        const { infoGecko } = await import('./gecko.js');
        const inf = await conTiempo(infoGecko(token, it.red || 'bsc'), 8000).catch(() => null);
        if (inf && inf.holders != null && (d.holders == null || inf.holders > d.holders)) { d.holders = inf.holders; d.holdersEstimado = true; res.datos = d; }
      }
    } catch (_) {}
  }
  log(token, res.nivel, res.hallazgos.map((x) => x.t));
  return res;
}
