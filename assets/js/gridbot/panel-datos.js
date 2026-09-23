/* panel-datos.js — Capa de datos del panel admin. Lee de los contratos desplegados.
   Verificación de owner ON-CHAIN: si la wallet no es owner, no devuelve nada. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';
import * as fperfil from '../firebase-perfil.js?v=1';

// Direcciones oficiales (proxies)
export const DIR = {
  contabilidad: '0x7FdE85E0bD53208F380980cfE317A9D4982434Ab',
  tarifas:      '0x068729CBB708713266FFdE2374e51db2B063FD7C',
  staking:      '0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4',
  gridbot:      '0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B',
  mercado:      '0x39c48394068299Aa3e3ab114F16bfc3DE11F4112',
  oraculo:      '0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3'
};
const RPCS = ['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc-dataseed1.ninicoin.io'];

const ABI_CONTA = [
  'function owner() view returns (address)',
  'function ownerPendiente() view returns (address)',
  'function resumen() view returns (uint256 generado, uint256 aStaking, uint256 aOwners, uint256 operaciones, uint256 wallets)',
  'function verMes(uint256) view returns (uint256 generado, uint256 operaciones, uint256 walletsNuevas)',
  'function verServicio(bytes32) view returns (uint256 generado, uint256 operaciones)',
  'function gananciaDeOwner(address) view returns (uint256)',
  'function mesActual() view returns (uint256)',
  'function bloqueada(address) view returns (bool)',
  'function bloquear(address,bool)',
  'function bloquearVarias(address[],bool)',
  'function setReportador(address,bool)',
  'function walletsUnicas() view returns (uint256)',
  'event WalletNueva(address indexed wallet, uint40 cuando)',
  'event Actividad(address indexed wallet, bytes32 indexed servicio, uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD, uint256 mes)'
];
const ABI_TARIFAS = ['function esAdmin(address) view returns (bool)'];

let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
function inyectado() { try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {} if (window.ethereum) return window.ethereum; throw new Error('sin wallet'); }
async function firmante() { return new ethers.BrowserProvider(inyectado()).getSigner(); }
const conta = () => new ethers.Contract(DIR.contabilidad, ABI_CONTA, lector());
async function contaW() { return new ethers.Contract(DIR.contabilidad, ABI_CONTA, await firmante()); }
// Lector con la wallet del owner (para funciones soloOwner: resumen, verMes, etc.).
async function contaLeeOwner() {
  try { const p = new ethers.BrowserProvider(inyectado()); return new ethers.Contract(DIR.contabilidad, ABI_CONTA, await p.getSigner()); }
  catch (_) { return conta(); }
}

/* ── Verificación de owner ON-CHAIN. Devuelve true solo si la wallet es owner/admin. ── */
export async function esOwner(cuenta) {
  if (!cuenta) return false;
  try {
    const c = conta();
    const o = await c.owner();
    if (o.toLowerCase() === cuenta.toLowerCase()) return true;
    // también admins de Tarifas
    try {
      const t = new ethers.Contract(DIR.tarifas, ABI_TARIFAS, lector());
      if (await t.esAdmin(cuenta)) return true;
    } catch (_) {}
    return false;
  } catch (_) { return false; }
}

export const fmtUSD = (wei) => Number(ethers.formatUnits(wei || 0n, 18));
export const hashServicio = (nombre) => ethers.id(nombre);

/* ── Resumen general (KPIs) ── */
export async function resumenGeneral() {
  const c = await contaLeeOwner();
  const [r, mesN] = await Promise.all([c.resumen(), c.mesActual()]);
  let mesData = { generado: 0n, operaciones: 0n, walletsNuevas: 0n };
  try { const m = await c.verMes(mesN); mesData = { generado: m[0], operaciones: m[1], walletsNuevas: m[2] }; } catch (_) {}
  return {
    generadoTotal: fmtUSD(r[0]), aStaking: fmtUSD(r[1]), aOwners: fmtUSD(r[2]),
    operaciones: Number(r[3]), wallets: Number(r[4]),
    mesGenerado: fmtUSD(mesData.generado), mesOperaciones: Number(mesData.operaciones), mesWalletsNuevas: Number(mesData.walletsNuevas),
    mes: Number(mesN)
  };
}

/* ── Datos por servicio ── */
export async function porServicio() {
  const c = await contaLeeOwner();
  const nombres = ['gridbot', 'swap', 'mercadotokens', 'futuros', 'academy', 'prizepool', 'bridge'];
  const out = [];
  for (const n of nombres) {
    try { const s = await c.verServicio(ethers.id(n)); if (s[1] > 0n || s[0] > 0n) out.push({ nombre: n, generado: fmtUSD(s[0]), operaciones: Number(s[1]) }); }
    catch (_) {}
  }
  return out;
}

/* ── Bloquear / desbloquear wallet ── */
export async function bloquearWallet(addr, v) {
  const c = await contaW();
  const tx = await c.bloquear(addr, v);
  return tx.wait();
}
export async function estaBloqueada(addr) { try { return await conta().bloqueada(addr); } catch (_) { return false; } }

/* ── Perfil (nombre + foto) de una wallet, para identificarla ── */
export async function perfilDe(addr) { return fperfil.leerPerfil(addr); }

/* ── Lista de wallets (leída de los eventos WalletNueva). Sin coste, sin límite. ── */
export async function listaWallets(maxBloques = 0) {
  const c = conta();
  try {
    // queryFilter del evento WalletNueva (todas). Si la red limita el rango, se puede paginar.
    const filtro = c.filters.WalletNueva();
    const eventos = await c.queryFilter(filtro, 0, 'latest');
    // más nuevas primero
    const arr = eventos.map(ev => ({
      wallet: ev.args.wallet,
      cuando: Number(ev.args.cuando),
      bloque: ev.blockNumber
    })).reverse();
    return arr;
  } catch (e) {
    // algunos RPC públicos limitan queryFilter a rangos cortos; devolvemos vacío si falla.
    return [];
  }
}

/* ── Enriquecer wallets con su perfil (foto/nombre) y estado de bloqueo ── */
export async function walletsConPerfil(lista) {
  const out = [];
  for (const w of lista) {
    let perfil = { nombre: '', foto: '' };
    try { perfil = await fperfil.leerPerfil(w.wallet); } catch (_) {}
    let bloqueada = false;
    try { bloqueada = await conta().bloqueada(w.wallet); } catch (_) {}
    out.push({ ...w, nombre: perfil.nombre, foto: perfil.foto, bloqueada });
  }
  return out;
}

/* ═══════════ Control de servicios (Services + Security) ═══════════ */
const ABI_MERCADO = [
  'function costoListadoUSD() view returns (uint256)',
  'function comisionRetiroBps() view returns (uint256)',
  'function maxLiquidezUSD() view returns (uint256)',
  'function pausado() view returns (bool)',
  'function owner() view returns (address)',
  'function setCostoListado(uint256)',
  'function setComisionRetiro(uint256)',
  'function setMaxLiquidez(uint256)',
  'function setPausado(bool)'
];
const ABI_GRIDBOT = [
  'function feeBps() view returns (uint256)',
  'function stakingBps() view returns (uint256)',
  'function costoBotUSD() view returns (uint256)',
  'function maxBots() view returns (uint256)',
  'function pausado() view returns (bool)',
  'function owner() view returns (address)',
  'function setComision(uint256,uint256)',
  'function setCostoBot(uint256)',
  'function setPausado(bool)'
];
const ABI_TARIFAS_FULL = [
  'function esAdmin(address) view returns (bool)',
  'function stakingBps() view returns (uint256)',
  'function unstakeBps() view returns (uint256)'
];

async function ctrW(dir, abi) { return new ethers.Contract(dir, abi, await firmante()); }
function ctrR(dir, abi) { return new ethers.Contract(dir, abi, lector()); }

/* ── FINANCE: ganancia por owner + totales ── */
export async function finanzas() {
  const c = await contaLeeOwner();
  const [r, o1, o2] = await Promise.all([
    c.resumen(),
    (async () => { try { const oo = await c.owner(); return { addr: oo, monto: fmtUSD(await c.gananciaDeOwner(oo)) }; } catch (_) { return null; } })(),
    (async () => { try { const oo2 = await new ethers.Contract(DIR.mercado, ['function owner2() view returns (address)'], lector()).owner2(); if (oo2 && oo2 !== '0x0000000000000000000000000000000000000000') return { addr: oo2, monto: fmtUSD(await c.gananciaDeOwner(oo2)) }; } catch (_) {} return null; })()
  ]);
  return {
    generado: fmtUSD(r[0]), aStaking: fmtUSD(r[1]), aOwners: fmtUSD(r[2]),
    owner1: o1, owner2: o2
  };
}

/* ── SERVICES: leer parámetros de cada servicio ── */
export async function paramsServicios() {
  const out = {};
  // MercadoTokens
  try {
    const m = ctrR(DIR.mercado, ABI_MERCADO);
    const [costo, com, maxLiq, pau] = await Promise.all([m.costoListadoUSD(), m.comisionRetiroBps(), m.maxLiquidezUSD(), m.pausado()]);
    out.mercado = { costoListado: Number(costo)/100, comisionRetiro: Number(com)/100, maxLiquidez: fmtUSD(maxLiq), pausado: pau };
  } catch (_) { out.mercado = null; }
  // GridBot
  try {
    const g = ctrR(DIR.gridbot, ABI_GRIDBOT);
    const [fee, stk, costoBot, maxB, pau] = await Promise.all([g.feeBps(), g.stakingBps(), g.costoBotUSD(), g.maxBots(), g.pausado()]);
    out.gridbot = { feeSwap: Number(fee)/100, stakingBps: Number(stk)/100, costoBot: Number(costoBot)/100, maxBots: Number(maxB), pausado: pau };
  } catch (_) { out.gridbot = null; }
  return out;
}

/* ── SERVICES: cambiar parámetros (cada uno firma en su contrato) ── */
export async function setMercadoCosto(usd) { const c = await ctrW(DIR.mercado, ABI_MERCADO); return (await c.setCostoListado(Math.round(usd*100))).wait(); }
export async function setMercadoComision(pct) { const c = await ctrW(DIR.mercado, ABI_MERCADO); return (await c.setComisionRetiro(Math.round(pct*100))).wait(); }
export async function setGridbotCostoBot(usd) { const c = await ctrW(DIR.gridbot, ABI_GRIDBOT); return (await c.setCostoBot(Math.round(usd*100))).wait(); }
export async function setGridbotComision(feePct, stakingPct) { const c = await ctrW(DIR.gridbot, ABI_GRIDBOT); return (await c.setComision(Math.round(feePct*100), Math.round(stakingPct*100))).wait(); }

/* ── SECURITY: pausar / reanudar cada servicio ── */
export async function pausarServicio(cual, v) {
  const dir = cual === 'mercado' ? DIR.mercado : DIR.gridbot;
  const abi = cual === 'mercado' ? ABI_MERCADO : ABI_GRIDBOT;
  const c = await ctrW(dir, abi);
  return (await c.setPausado(v)).wait();
}
export async function estadoPausa() {
  const out = {};
  try { out.mercado = await ctrR(DIR.mercado, ABI_MERCADO).pausado(); } catch (_) { out.mercado = null; }
  try { out.gridbot = await ctrR(DIR.gridbot, ABI_GRIDBOT).pausado(); } catch (_) { out.gridbot = null; }
  return out;
}
