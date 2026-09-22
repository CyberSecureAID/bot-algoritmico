/* mercado.js — capa de conexión al contrato MercadoTokens (listar/comprar/retirar).
   Habla con el proxy desplegado. Reusa ethers desde el vendor. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';

export const MERCADO = '0x39c48394068299Aa3e3ab114F16bfc3DE11F4112';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const RPCS = ['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc-dataseed1.ninicoin.io','https://bsc-dataseed2.binance.org'];

const ABI = [
  'function listar((address token,string nombre,string simbolo,string logo,uint256 cantidad,uint256 precio)) payable returns (uint256)',
  'function comprar(uint256 id,uint256 cantidadToken) payable',
  'function devolver(uint256 id,uint256 cantidadToken)',
  'function faltaCandado(uint256) view returns (uint256)',
  'function compradoPor(uint256,address) view returns (uint256)',
  'function pagadoPor(uint256,address) view returns (uint256)',
  'function retirarGanancia(uint256 id)',
  'function retirarTokens(uint256 id,uint256 cantidad)',
  'function reponer(uint256 id,uint256 cantidad)',
  'function setPrecio(uint256 id,uint256 precio)',
  'function setLogo(uint256 id,string logo)',
  'function costoListadoBNB() view returns (uint256)',
  'function costoListadoUSD() view returns (uint256)',
  'function owner() view returns (address)',
  'function owner2() view returns (address)',
  'function tarifas() view returns (address)',
  'function totalListados() view returns (uint256)',
  'function listadosDeVendedor(address) view returns (uint256[])',
  'function listadosDeToken(address) view returns (uint256[])',
  'function ver(uint256) view returns (tuple(address vendedor,address token,string nombre,string simbolo,string logo,uint256 precio,uint256 enVenta,uint256 ganancia,uint64 creado,uint64 ultimoRetiro,bool activo))',
  'function pagina(uint256 desde,uint256 hasta) view returns (tuple(address vendedor,address token,string nombre,string simbolo,string logo,uint256 precio,uint256 enVenta,uint256 ganancia,uint64 creado,uint64 ultimoRetiro,bool activo)[])'
];
const ERC20 = [
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)'
];

let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
function inyectado() { try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {} if (window.ethereum) return window.ethereum; throw new Error('No hay wallet'); }
async function firmante() { return new ethers.BrowserProvider(inyectado()).getSigner(); }
function cLee() { return new ethers.Contract(MERCADO, ABI, lector()); }
async function cEscribe() { return new ethers.Contract(MERCADO, ABI, await firmante()); }
async function esperar(tx) { try { return await tx.wait(); } catch (e) { try { const r = await lector().waitForTransaction(tx.hash, 1, 60000); return r; } catch (_) { throw e; } } }

export function esDireccion(s) { return /^0x[0-9a-fA-F]{40}$/.test((s || '').trim()); }

/** ¿Esta wallet lista gratis? (es owner u owner2 del contrato). */
export async function esAdmin(wallet) {
  if (!wallet) return false;
  try {
    const c = cLee();
    const [o1, o2] = await Promise.all([c.owner(), c.owner2()]);
    const w = wallet.toLowerCase();
    if (o1.toLowerCase() === w || o2.toLowerCase() === w) return true;
    // también admins de Tarifas
    try { const tar = await c.tarifas(); if (tar && tar !== '0x0000000000000000000000000000000000000000') {
      const t = new ethers.Contract(tar, ['function esAdmin(address) view returns (bool)'], lector());
      return await t.esAdmin(wallet);
    } } catch (_) {}
    return false;
  } catch (_) { return false; }
}

/** Lee nombre/símbolo/decimales de un token ERC20 (para autocompletar y validar). */
export async function infoToken(addr) {
  const a = ethers.getAddress(addr.trim());
  const t = new ethers.Contract(a, ERC20, lector());
  const [dec] = await Promise.all([t.decimals()]);
  let sym = '', nom = '';
  try { sym = await t.symbol(); } catch (_) {}
  try { nom = await t.name(); } catch (_) {}
  return { address: a, simbolo: String(sym), nombre: String(nom), decimals: Number(dec) };
}

/** Costo de listar en BNB (wei) y en USD (2 dec). */
export async function costoListar() {
  const [bnb, usd] = await Promise.all([cLee().costoListadoBNB(), cLee().costoListadoUSD()]);
  return { bnb, usd: Number(usd) / 100 };
}

/** Aprueba el token para el contrato (para poder enviar la cantidad a la venta). */
export async function aprobar(tokenAddr, montoBI) {
  const t = new ethers.Contract(tokenAddr, ERC20, await firmante());
  const tx = await t.approve(MERCADO, montoBI);
  return esperar(tx);
}
export async function allowance(tokenAddr, duenio) {
  const t = new ethers.Contract(tokenAddr, ERC20, lector());
  return t.allowance(duenio, MERCADO);
}
export async function balanceToken(tokenAddr, duenio) {
  const t = new ethers.Contract(tokenAddr, ERC20, lector());
  return t.balanceOf(duenio);
}

/** Lista un token. precioUSDT18 = precio por 1 token en USDT (18 dec, figurativo→lo pasamos como precio en BNB equivalente NO; ver nota). */
export async function listar({ token, nombre, simbolo, logo, cantidadBI, precioBI, valueBNB }) {
  const c = await cEscribe();
  const tx = await c.listar({ token, nombre, simbolo: simbolo || '', logo: logo || '', cantidad: cantidadBI, precio: precioBI }, { value: valueBNB });
  return esperar(tx);
}
export async function comprar(id, cantidadTokenBI, valueBNB) {
  const c = await cEscribe();
  const tx = await c.comprar(id, cantidadTokenBI, { value: valueBNB });
  return esperar(tx);
}
export async function retirarGanancia(id) { const c = await cEscribe(); return esperar(await c.retirarGanancia(id)); }
export async function retirarTokens(id, cantBI) { const c = await cEscribe(); return esperar(await c.retirarTokens(id, cantBI)); }
export async function reponer(id, cantBI) { const c = await cEscribe(); return esperar(await c.reponer(id, cantBI)); }
export async function setPrecio(id, precioBI) { const c = await cEscribe(); return esperar(await c.setPrecio(id, precioBI)); }
export async function setLogo(id, logo) { const c = await cEscribe(); return esperar(await c.setLogo(id, logo)); }
export async function devolver(id, cantBI) { const c = await cEscribe(); return esperar(await c.devolver(id, cantBI)); }
export async function faltaCandado(id) { return cLee().faltaCandado(id); }
export async function loQueCompre(id, wallet) { return cLee().compradoPor(id, wallet); }
export async function loQuePague(id, wallet) { return cLee().pagadoPor(id, wallet); }

/** Listados de una wallet (ids + datos). */
export async function misListados(duenio) {
  const ids = await cLee().listadosDeVendedor(duenio);
  const arr = [];
  for (const id of ids) { try { const L = await cLee().ver(id); arr.push({ id: Number(id), ...normal(L) }); } catch (_) {} }
  return arr;
}
function normal(L) {
  return {
    vendedor: L.vendedor, token: L.token, nombre: L.nombre, simbolo: L.simbolo, logo: L.logo,
    precio: L.precio, enVenta: L.enVenta, ganancia: L.ganancia,
    creado: Number(L.creado), ultimoRetiro: Number(L.ultimoRetiro), activo: L.activo
  };
}

export const fmt = (wei, dec = 18) => ethers.formatUnits(wei, dec);
export const parse = (v, dec = 18) => ethers.parseUnits(String(v), dec);

/* ─────────── Compra desde el swap ─────────── */
/** Busca listados ACTIVOS de un token (por su contrato). Devuelve los que tienen stock,
    con logo de Firestore, precio, y segundos de protección restantes. */
export async function listadosCompra(tokenAddr) {
  if (!esDireccion(tokenAddr)) return [];
  let ids;
  try { ids = await cLee().listadosDeToken(tokenAddr); } catch (_) { return []; }
  const out = [];
  for (const id of ids) {
    try {
      const L = await cLee().ver(id);
      if (!L.activo || L.enVenta === 0n) continue;
      let falta = 0n;
      try { falta = await cLee().faltaCandado(id); } catch (_) {}
      out.push({
        id: Number(id), token: L.token, nombre: L.nombre, simbolo: L.simbolo,
        precio: L.precio, enVenta: L.enVenta, proteccionSeg: Number(falta)
      });
    } catch (_) {}
  }
  return out;
}

/** Precio en BNB (wei) por comprar `cantidadTokenBI` tokens de un listado. */
export async function costeCompra(id, cantidadTokenBI) {
  const L = await cLee().ver(id);
  const dec = await _decToken(L.token);
  // coste = precio * cantidad / 10^dec
  return (L.precio * cantidadTokenBI) / (10n ** BigInt(dec));
}
async function _decToken(addr) {
  try { const t = new ethers.Contract(addr, ERC20, lector()); return Number(await t.decimals()); } catch (_) { return 18; }
}
