/* terminal/auditoria.js. Auditoria de seguridad de un token antes de comprar (modulo sellado).
   Dos fuentes, combinadas:
     1) GoPlus Token Security (misma API publica que ya usa Wallet Shield): honeypot, impuestos de compra
        y venta, mint, propietario oculto, recuperar propiedad, pausable, lista negra, proxy, codigo abierto,
        concentracion de holders, LP bloqueada o quemada, creador.
     2) Lecturas propias en cadena por RPC: hay codigo, owner() renunciado o no, LP quemada (saldo del par
        en las direcciones muertas).
   NO predice si va a subir. Solo informa de lo que el contrato permite HOY. El resultado es un semaforo
   con cada motivo explicado. Funciones puras separadas para poder probarlas sin red. */

import * as ethers from './ethers.min.js';
import { RPCS } from './config.js';

const log = (...a) => { try { console.info('[TERM-AUDIT]', ...a); } catch (_) {} };
const GOPLUS = 'https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=';
const MUERTAS = ['0x000000000000000000000000000000000000dead', '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000001'];

let _rpcIdx = 0; const _prov = {};
function provRPC(i) { const u = RPCS[((i % RPCS.length) + RPCS.length) % RPCS.length]; if (!_prov[u]) _prov[u] = new ethers.JsonRpcProvider(u, 56, { staticNetwork: true }); return _prov[u]; }
async function conRotacion(fn) { let err; for (let k = 0; k < RPCS.length; k++) { const i = _rpcIdx + k; try { return await fn(provRPC(i)); } catch (e) { err = e; _rpcIdx = (i + 1) % RPCS.length; } } throw err; }

const ABI = ['function owner() view returns (address)', 'function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)'];

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
export async function leerCadena(token, par) {
  const out = { hayCodigo: null, owner: null, lpQuemadaPct: null };
  try { const code = await conRotacion((p) => p.getCode(token)); out.hayCodigo = !!(code && code !== '0x'); } catch (_) {}
  try { out.owner = String(await conRotacion((p) => new ethers.Contract(token, ABI, p).owner())); } catch (_) { out.owner = null; }   // sin owner(): no es Ownable
  if (par) {
    try {
      const c = (p) => new ethers.Contract(par, ABI, p);
      const [sup, ...saldos] = await Promise.all([conRotacion((p) => c(p).totalSupply()), ...MUERTAS.map((a) => conRotacion((p) => c(p).balanceOf(a)).catch(() => 0n))]);
      const quemado = saldos.reduce((s, x) => s + x, 0n);
      out.lpQuemadaPct = sup > 0n ? Number((quemado * 10000n) / sup) / 100 : 0;
    } catch (_) {}
  }
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

  if (!gp) {
    const nivel = h.some((x) => x.n === 'bad') ? 'bad' : 'pend';
    h.push({ n: 'info', t: 'Security data not available yet', d: 'The token is too new for the security scanner. Re-check in a few minutes before buying.' });
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
  const hc = num('holder_count'); if (hc != null) datos.holders = hc;
  const cp = num('creator_percent'); if (cp != null) datos.creadorPct = cp * 100;
  const op = num('owner_percent'); if (op != null) datos.ownerPct = op * 100;
  let top10 = null;
  if (Array.isArray(gp.holders)) { top10 = gp.holders.slice(0, 10).reduce((s, x) => s + (parseFloat(x.percent) || 0), 0) * 100; datos.top10Pct = top10; }
  if (cp != null && cp >= 0.2) h.push({ n: 'warn', t: 'Creator holds ' + Math.round(cp * 100) + '%', d: 'A large creator bag can be dumped on buyers.' });
  if (top10 != null && top10 >= 70) h.push({ n: 'warn', t: 'Top 10 hold ' + Math.round(top10) + '%', d: 'Very concentrated supply.' });
  if (hc != null && hc < 20) h.push({ n: 'info', t: 'Only ' + hc + ' holders', d: 'Very early. Thin market.' });

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

  const nivel = h.some((x) => x.n === 'bad') ? 'bad' : (h.some((x) => x.n === 'warn') ? 'warn' : 'ok');
  const titulo = nivel === 'bad' ? 'Do not buy' : nivel === 'warn' ? 'Caution' : 'No red flags in the code';
  // orden: malo, aviso, ok, info
  const peso = { bad: 0, warn: 1, ok: 2, info: 3 }; h.sort((a, b) => peso[a.n] - peso[b.n]);
  return { nivel, titulo, hallazgos: h, datos };
}

/* Auditoria completa de un token. */
export async function auditar(token, par) {
  const [gp, cad] = await Promise.all([leerGoPlus(token), leerCadena(token, par).catch(() => ({}))]);
  const res = evaluar(gp, cad);
  log(token, res.nivel, res.hallazgos.map((x) => x.t));
  return res;
}
