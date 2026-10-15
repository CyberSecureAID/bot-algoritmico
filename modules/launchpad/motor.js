/* launchpad/motor.js. Capa de contrato del Launchpad (sellado).
   Habla con el proxy LaunchpadDF y con cada TokenDF. Usa ethers local (sin CDN).
   NO custodia: el usuario firma cada accion. Mismos patrones que los bots:
   RPC resiliente, gas seguro para smart account (EIP-7702), espera por estado. */

import * as ethers from './ethers.min.js';
import * as wallet from './wallet.js';
import { LAUNCHPAD, LAUNCHPAD_IMPL, SCAN, USDT, RPCS, COINGECKO_BNB } from './config.js';

const CERO = '0x0000000000000000000000000000000000000000';

const ABI = [
  'function crearToken(string,string,uint256,uint16,uint8,uint8,bool) returns (address)',
  'function crearPool(address,uint256,address,uint256,uint8) payable',
  'function comprar(address,uint256) payable returns (uint256)',
  'function comprarConToken(address,uint256,uint256) returns (uint256)',
  'function vender(address,uint256,uint256) returns (uint256)',
  'function retirarLiquidez(address)',
  'function precio(address) view returns (uint256)',
  'function cotizarCompra(address,uint256) view returns (uint256)',
  'function cotizarVenta(address,uint256,address) view returns (uint256,uint256,uint256)',
  'function info(address) view returns (address creador,uint16 sueloBps,bool antibot,uint64 creadoEn)',
  'function pools(address) view returns (address quote,uint256 rTok,uint256 rQuote,uint64 abiertoEn,uint64 desbloqueo,bool activo,bool retirado)',
  'function tokensDe(address) view returns (address[])',
  'function esOwner(address) view returns (bool)',
  'function destinos() view returns (address,address,address)',
  'event TokenCreado(address indexed token,address indexed creador,string nombre,string simbolo,uint256 supply,uint16 sueloBps,uint256 vestTotal,uint64 vestDuracion,bool antibot)',
  'event Compra(address indexed token,address indexed wallet,uint256 quoteIn,uint256 tokOut,uint256 precio)',
  'event Venta(address indexed token,address indexed wallet,uint256 tokIn,uint256 quoteOut,uint256 eco,uint256 suelo,uint256 precio)'
];
const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function reserva() view returns (uint256)',
  'function suelo() view returns (uint256)',
  'function activoReserva() view returns (address)',
  'function reclamable() view returns (uint256)',
  'function liberado() view returns (uint256)',
  'function vestTotal() view returns (uint256)',
  'function vestReclamado() view returns (uint256)',
  'function vestInicio() view returns (uint64)',
  'function vestDuracion() view returns (uint64)',
  'function creador() view returns (address)',
  'function sueloBps() view returns (uint16)',
  'function reclamarGoteo()',
  'function burn(uint256)',
  'function redimir(uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)'
];
const ERC20_ABI = ['function approve(address,uint256) returns (bool)', 'function allowance(address,address) view returns (uint256)', 'function balanceOf(address) view returns (uint256)'];

export const hayContrato = () => LAUNCHPAD && LAUNCHPAD !== CERO;
export const esBNB = (q) => !q || q === CERO;
const _iface = new ethers.Interface(ABI);

/* ─────────── Proveedores ─────────── */
function inyectado() {
  try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {}
  if (typeof window !== 'undefined' && window.ethereum) return window.ethereum;
  throw new Error('No wallet');
}
async function firmante() { return new ethers.BrowserProvider(inyectado()).getSigner(); }
let _rpcIdx = 0; const _provCache = {};
function provRPC(i) { const u = RPCS[i % RPCS.length]; if (!_provCache[u]) _provCache[u] = new ethers.JsonRpcProvider(u, 56, { staticNetwork: true }); return _provCache[u]; }
function lector() { return provRPC(_rpcIdx); }

/* Lectura resistente a un contrato cualquiera: rota de RPC si uno falla. */
async function lee(addr, abi, fn, args = []) {
  let err;
  for (let k = 0; k < RPCS.length; k++) {
    try { return await new ethers.Contract(addr, abi, provRPC(_rpcIdx))[fn](...args); }
    catch (e) { err = e; _rpcIdx = (_rpcIdx + 1) % RPCS.length; await new Promise((r) => setTimeout(r, 200)); }
  }
  throw err;
}
const leeLP = (fn, args) => lee(LAUNCHPAD, ABI, fn, args);
/* Pool de una moneda. Un nodo publico atrasado responde activo=false sin error y lee()
   no rota por eso: si el nodo actual dice que no hay pool, se consulta el resto y
   gana el primero que la vea. Solo cuesta llamadas extra cuando no hay pool. */
async function leePool(token) {
  const pl = await leeLP('pools', [token]);
  if (pl.activo) return pl;
  const otros = RPCS.map((_, i) => i).filter((i) => i !== _rpcIdx % RPCS.length);
  const vistas = await Promise.all(otros.map((i) => new ethers.Contract(LAUNCHPAD, ABI, provRPC(i)).pools(token).catch(() => null)));
  for (const v of vistas) if (v && v.activo) return v;
  return pl;
}
const leeTok = (addr, fn, args) => lee(addr, TOKEN_ABI, fn, args);

async function cLP() { return new ethers.Contract(LAUNCHPAD, ABI, await firmante()); }

/* ─────────── Gas seguro (smart account EIP-7702) ─────────── */
async function _esSmart(runner) {
  try { const a = await runner.getAddress(); const c = await lector().getCode(a); return !!(c && c !== '0x'); } catch (_) { return false; }
}
async function gasMargen(contrato, metodo, args = [], overrides = {}) {
  let est = null;
  try { est = await contrato[metodo].estimateGas(...args, overrides); }
  catch (e) {
    const rev = !!(e && (e.code === 'CALL_EXCEPTION' || e.revert || e.reason || /execution reverted/i.test(e.shortMessage || e.message || '')));
    if (rev) throw e; est = null;
  }
  if (est == null) return contrato[metodo](...args, overrides);
  let gasLimit = est * 135n / 100n;
  if (await _esSmart(contrato.runner)) gasLimit = est * 135n / 100n + 150000n;
  return contrato[metodo](...args, { ...overrides, gasLimit });
}
async function gasAprobar(t, spender, monto) {
  let gasLimit;
  try { gasLimit = (await t.approve.estimateGas(spender, monto)) * 160n / 100n; } catch (_) { gasLimit = 120000n; }
  if ((await _esSmart(t.runner)) && gasLimit < 600000n) gasLimit = 600000n;
  return t.approve(spender, monto, { gasLimit });
}
async function esperar(tx) {
  try { if (typeof window !== 'undefined' && window._onTxProcesando) window._onTxProcesando(); } catch (_) {}
  for (let i = 0; i < 6; i++) {
    try {
      const rec = await provRPC(i).waitForTransaction(tx.hash, 1, 20000);
      if (rec) { if (rec.status === 0) throw new Error('The transaction reverted on-chain. Check your balance and gas, and try again.'); return rec; }
    } catch (e) { if (e && /revert|on-chain/i.test(e.message || '')) throw e; }
    await new Promise((r) => setTimeout(r, 1500));
  }
  const rec = await tx.wait(); if (rec && rec.status === 0) throw new Error('The transaction did not complete on-chain.'); return rec;
}
async function esperarEstado(tx, comprobar) {
  const t0 = Date.now();
  const sondeo = (async () => { while (Date.now() - t0 < 180000) { await new Promise((r) => setTimeout(r, 3000)); try { if (await comprobar()) return true; } catch (_) {} } return false; })();
  const recibo = esperar(tx).then(() => true).catch((e) => { if (e && /revert|on-chain/i.test(e.message || '')) throw e; return false; });
  const primero = await Promise.race([recibo, sondeo]);
  if (primero && await comprobar().catch(() => false)) return true;
  if (await sondeo) return true;
  throw new Error('The transaction was not confirmed in time. Check your wallet activity before trying again.');
}

/* Direccion del quote por id ('BNB' o 'USDT'). */
function dirQuote(id) { return id === 'USDT' ? USDT : CERO; }

/* Allowance: aprueba si hace falta (approve a 0 primero para tokens tipo USDT). */
async function asegurarPermiso(tokenAddr, dueno, monto) {
  const t = new ethers.Contract(tokenAddr, ERC20_ABI, await firmante());
  let act = 0n; try { act = await lee(tokenAddr, ERC20_ABI, 'allowance', [dueno, LAUNCHPAD]); } catch (_) {}
  if (act >= monto) return;
  if (act > 0n) { try { await esperar(await gasAprobar(t, LAUNCHPAD, 0n)); } catch (_) {} }
  await esperar(await gasAprobar(t, LAUNCHPAD, monto));
}

/* ─────────── Escrituras ─────────── */
export async function crearToken(p) {
  const bot = await cLP();
  const cuenta = await bot.runner.getAddress();
  const tx = await gasMargen(bot, 'crearToken', [p.nombre, p.simbolo, p.supply, p.sueloBps, p.fundadorPct, p.vestingMeses, p.antibot]);
  const rec = await esperar(tx);
  // Sacar la direccion del token del evento TokenCreado de ESTA wallet.
  let token = null;
  try {
    for (const lg of rec.logs) {
      if (lg.address.toLowerCase() !== LAUNCHPAD.toLowerCase()) continue;
      let pl; try { pl = _iface.parseLog(lg); } catch (_) { continue; }
      if (pl && pl.name === 'TokenCreado' && pl.args.creador.toLowerCase() === cuenta.toLowerCase()) token = pl.args.token;
    }
  } catch (_) {}
  if (!token) { const l = await leeLP('tokensDe', [cuenta]); token = l[l.length - 1]; }
  return token;
}

export async function abrirPool({ token, cantTok, quoteId, cantQuote, candadoMeses }) {
  const cuenta = wallet.cuentaActual();
  await asegurarPermiso(token, cuenta, cantTok);
  const quote = dirQuote(quoteId);
  if (!esBNB(quote)) await asegurarPermiso(quote, cuenta, cantQuote);
  const bot = await cLP();
  const value = esBNB(quote) ? cantQuote : 0n;
  const tx = await gasMargen(bot, 'crearPool', [token, cantTok, quote, cantQuote, candadoMeses], { value });
  return esperarEstado(tx, async () => (await leePool(token)).activo);
}

export async function comprar({ token, quoteId, cantQuote, minOut }) {
  const cuenta = wallet.cuentaActual();
  const bot = await cLP();
  if (quoteId === 'USDT') {
    await asegurarPermiso(USDT, cuenta, cantQuote);
    const tx = await gasMargen(bot, 'comprarConToken', [token, cantQuote, minOut]);
    return esperar(tx);
  }
  const tx = await gasMargen(bot, 'comprar', [token, minOut], { value: cantQuote });
  return esperar(tx);
}
export async function vender({ token, cantTok, minOut }) {
  const cuenta = wallet.cuentaActual();
  await asegurarPermiso(token, cuenta, cantTok);
  const bot = await cLP();
  const tx = await gasMargen(bot, 'vender', [token, cantTok, minOut]);
  return esperar(tx);
}
export async function retirarLiquidez(token) {
  const bot = await cLP();
  const tx = await gasMargen(bot, 'retirarLiquidez', [token]);
  return esperarEstado(tx, async () => { const pl = await leeLP('pools', [token]); return pl.retirado; });
}
export async function reclamarGoteo(token) {
  const t = new ethers.Contract(token, TOKEN_ABI, await firmante());
  const tx = await gasMargen(t, 'reclamarGoteo', []);
  return esperar(tx);
}
export async function redimir(token, cantidad) {
  const t = new ethers.Contract(token, TOKEN_ABI, await firmante());
  const tx = await gasMargen(t, 'redimir', [cantidad]);
  return esperar(tx);
}
export async function quemar(token, cantidad) {
  const t = new ethers.Contract(token, TOKEN_ABI, await firmante());
  const tx = await gasMargen(t, 'burn', [cantidad]);
  return esperar(tx);
}

/* ─────────── Lecturas ─────────── */
export async function cotizarCompra(token, quoteWei) { try { return await leeLP('cotizarCompra', [token, quoteWei]); } catch (_) { return 0n; } }
export async function cotizarVenta(token, tokWei, vendedor) { try { const r = await leeLP('cotizarVenta', [token, tokWei, vendedor || CERO]); return { paraTi: r[0], eco: r[1], suelo: r[2] }; } catch (_) { return { paraTi: 0n, eco: 0n, suelo: 0n }; } }
export async function tokensDe(cuenta) { try { return await leeLP('tokensDe', [cuenta]); } catch (_) { return []; } }
export async function esOwner(cuenta) { try { return await leeLP('esOwner', [cuenta]); } catch (_) { return false; } }
export async function saldoToken(token, cuenta) { try { return await lee(token, ERC20_ABI, 'balanceOf', [cuenta]); } catch (_) { return 0n; } }

/** Todo lo que el panel necesita de un token, leido de la cadena. */
export async function datosToken(addr) {
  const [i, pl] = await Promise.all([leeLP('info', [addr]), leePool(addr)]);
  const [nombre, simbolo, supply] = await Promise.all([
    leeTok(addr, 'name', []).catch(() => ''), leeTok(addr, 'symbol', []).catch(() => ''), leeTok(addr, 'totalSupply', []).catch(() => 0n)
  ]);
  const suelo = i.sueloBps > 0 ? await leeTok(addr, 'reserva', []).then((r) => ({ reserva: r })).catch(() => ({ reserva: 0n })) : { reserva: 0n };
  let vest = { total: 0n, inicio: 0n, dur: 0n, reclamado: 0n, reclamable: 0n };
  try {
    const [vt, vi, vd, vr, rc] = await Promise.all([
      leeTok(addr, 'vestTotal', []), leeTok(addr, 'vestInicio', []), leeTok(addr, 'vestDuracion', []),
      leeTok(addr, 'vestReclamado', []), leeTok(addr, 'reclamable', [])
    ]);
    vest = { total: vt, inicio: vi, dur: vd, reclamado: vr, reclamable: rc };
  } catch (_) {}
  const pool = pl.activo ? { quote: pl.quote, rTok: pl.rTok, rQuote: pl.rQuote, abiertoEn: Number(pl.abiertoEn), desbloqueo: Number(pl.desbloqueo), activo: true, retirado: pl.retirado } : null;
  const precio = pool ? (pl.rTok > 0n ? Number(ethers.formatEther(pl.rQuote)) / Number(ethers.formatEther(pl.rTok)) : 0) : 0;
  return {
    address: addr, nombre, simbolo, supply: Number(ethers.formatEther(supply)), supplyWei: supply,
    creador: i.creador, sueloBps: Number(i.sueloBps), antibot: i.antibot, creadoEn: Number(i.creadoEn),
    pool, precio, moneda: pool ? (esBNB(pool.quote) ? 'BNB' : 'USDT') : 'BNB',
    reservaSuelo: Number(ethers.formatEther(suelo.reserva)), reservaWei: suelo.reserva,
    fundadorPct: vest.total > 0n && supply > 0n ? Math.round(Number(vest.total) / Number(supply) * 100) : 0,
    vestTotal: Number(ethers.formatEther(vest.total)), vestInicio: Number(vest.inicio), vestDur: Number(vest.dur),
    vestReclamado: Number(ethers.formatEther(vest.reclamado)), reclamable: Number(ethers.formatEther(vest.reclamable))
  };
}

/* Operaciones de un token desde los eventos Compra/Venta (sin terceros). */
export async function operaciones(token, max = 80) {
  let latest = 0; try { latest = await lector().getBlockNumber(); } catch (_) {}
  const desde = latest > 400000 ? latest - 400000 : 0;
  const cc = new ethers.Contract(LAUNCHPAD, ABI, provRPC(_rpcIdx));
  let compras = [], ventas = [];
  try { compras = await cc.queryFilter(cc.filters.Compra(token), desde, latest); } catch (_) {}
  try { ventas = await cc.queryFilter(cc.filters.Venta(token), desde, latest); } catch (_) {}
  const fechas = {};
  const bloques = [...new Set([...compras, ...ventas].map((e) => e.blockNumber))];
  await Promise.all(bloques.slice(0, 60).map(async (b) => { try { fechas[b] = (await provRPC(_rpcIdx).getBlock(b)).timestamp * 1000; } catch (_) {} }));
  const ops = [];
  for (const e of compras) { const a = e.args; const q = Number(ethers.formatEther(a.quoteIn)), tk = Number(ethers.formatEther(a.tokOut)); ops.push({ compra: true, cantidad: tk, valor: q, precio: tk > 0 ? q / tk : 0, wallet: _corto(a.wallet), tiempo: fechas[e.blockNumber] || 0, bloque: e.blockNumber }); }
  for (const e of ventas) { const a = e.args; const q = Number(ethers.formatEther(a.quoteOut)) + Number(ethers.formatEther(a.eco)) + Number(ethers.formatEther(a.suelo)); const tk = Number(ethers.formatEther(a.tokIn)); ops.push({ compra: false, cantidad: tk, valor: q, precio: tk > 0 ? q / tk : 0, wallet: _corto(a.wallet), tiempo: fechas[e.blockNumber] || 0, bloque: e.blockNumber }); }
  ops.sort((x, y) => (y.tiempo || y.bloque) - (x.tiempo || x.bloque));
  return ops.slice(0, max);
}
function _corto(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }

/* ─────────── Verificacion automatica en BscScan ───────────
   Cada moneda es un TokenDF, el mismo codigo que ya esta verificado dentro del
   launchpad. Reusamos su Standard JSON verificado y lo reenviamos con la direccion
   de la moneda y SUS argumentos del constructor (leidos exactos del evento). No
   hay que compilar ni entrar a Remix: BscScan recompila el proyecto y lo cuadra. */
let _refVerif = null;   // Standard JSON + version del compilador del launchpad, se pide una vez

function _scanURL(params) {
  const u = new URL(SCAN.api);
  for (const k in params) u.searchParams.set(k, params[k]);
  u.searchParams.set('chainid', String(SCAN.chainId));
  u.searchParams.set('apikey', SCAN.key);
  return u.toString();
}
async function _scanGet(params) { const r = await fetch(_scanURL(params)); return r.json(); }
async function _scanPost(params) {
  const b = new URLSearchParams();
  for (const k in params) b.set(k, params[k]);
  b.set('chainid', String(SCAN.chainId)); b.set('apikey', SCAN.key);
  const r = await fetch(SCAN.api + '?chainid=' + SCAN.chainId, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: b.toString() });
  return r.json();
}

/** true si BscScan ya tiene el codigo fuente verificado de esa direccion. */
export async function verificado(addr) {
  try {
    const j = await _scanGet({ module: 'contract', action: 'getsourcecode', address: addr });
    const r = j && j.result && j.result[0];
    return !!(r && r.SourceCode && r.SourceCode.length > 2 && r.ABI && r.ABI !== 'Contract source code not verified');
  } catch (_) { return false; }
}

/** Standard JSON verificado del launchpad + version del compilador (una sola vez). */
async function _referencia() {
  if (_refVerif) return _refVerif;
  const j = await _scanGet({ module: 'contract', action: 'getsourcecode', address: LAUNCHPAD_IMPL });
  const r = j && j.result && j.result[0];
  if (!r || !r.SourceCode) throw new Error('No se pudo leer el contrato de referencia en BscScan.');
  let src = String(r.SourceCode).trim();
  if (src.startsWith('{{') && src.endsWith('}}')) src = src.slice(1, -1);   // Etherscan envuelve el standard-json en {{ }}
  _refVerif = { source: src, compilador: r.CompilerVersion };
  return _refVerif;
}

/** Argumentos del constructor de un TokenDF, leidos directo de la moneda por RPC.
    (El modulo logs de Etherscan no es gratis en BSC, asi que NO se usa aqui.)
    fabrica es siempre el proxy del launchpad; supply es el totalSupply (exacto
    en una moneda recien creada, que es cuando se verifica). */
async function _ctorArgs(token) {
  const [nombre, simbolo, supply, creador, sueloBps, vestTotal, vestDur] = await Promise.all([
    leeTok(token, 'name', []), leeTok(token, 'symbol', []), leeTok(token, 'totalSupply', []),
    leeTok(token, 'creador', []), leeTok(token, 'sueloBps', []), leeTok(token, 'vestTotal', []), leeTok(token, 'vestDuracion', [])
  ]);
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ['string', 'string', 'uint256', 'address', 'address', 'uint16', 'uint256', 'uint64'],
    [nombre, simbolo, supply, creador, LAUNCHPAD, Number(sueloBps), vestTotal, vestDur]
  ).slice(2);
}

/** Verifica una moneda en BscScan reusando el build ya verificado del launchpad.
    Devuelve 'ya' | 'ok' | 'pendiente' | 'error:...'. Nunca lanza. */
export async function verificar(token) {
  try {
    if (await verificado(token)) return 'ya';
    const { source, compilador } = await _referencia();
    const ctor = await _ctorArgs(token);
    const env = await _scanPost({
      module: 'contract', action: 'verifysourcecode', codeformat: 'solidity-standard-json-input',
      sourceCode: source, contractaddress: token, contractname: SCAN.contrato,
      compilerversion: compilador, constructorArguements: ctor
    });
    if (String(env.status) !== '1') {
      if (/already verified/i.test(env.result || '')) return 'ya';
      return 'error:' + (env.result || 'rechazado');
    }
    const guid = env.result;
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const st = await _scanGet({ module: 'contract', action: 'checkverifystatus', guid });
      const res = String(st.result || '');
      if (/already verified/i.test(res) || /pass|verified/i.test(res)) return 'ok';
      if (/fail/i.test(res)) return 'error:' + res;
    }
    return 'pendiente';
  } catch (e) { return 'error:' + (e && (e.message || e)); }
}

export function parseEther(x) { return ethers.parseEther(String(x)); }
export function fmtEther(x) { return ethers.formatEther(x); }

/* Precio de BNB en USDT (CoinGecko, gratis). Solo para MOSTRAR el panel en USDT.
   Cachea 60 s en memoria y guarda el ultimo valor bueno para usarlo de respaldo si la
   red falla. Devuelve 0 si no hay forma de saberlo (el panel cae a la moneda del par). */
let _bnbUsd = { v: 0, t: 0 };
export async function precioBNBUSDT() {
  const ahora = Date.now();
  if (_bnbUsd.v > 0 && ahora - _bnbUsd.t < 60000) return _bnbUsd.v;
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(COINGECKO_BNB, { signal: ctrl.signal }); clearTimeout(to);
    const j = await r.json(); const v = j && j.binancecoin && Number(j.binancecoin.usd);
    if (v > 0) { _bnbUsd = { v, t: ahora }; try { localStorage.setItem('df-bnbusd', JSON.stringify(_bnbUsd)); } catch (_) {} return v; }
  } catch (_) {}
  if (_bnbUsd.v > 0) return _bnbUsd.v;
  try { const s = JSON.parse(localStorage.getItem('df-bnbusd') || 'null'); if (s && s.v > 0) { _bnbUsd = s; return s.v; } } catch (_) {}
  return 0;
}
export { ethers };
