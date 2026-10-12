/* shield-pago.js: Puente con los contratos de Wallet Shield (cobro de acceso).
   Verifica si la wallet tiene acceso pagado, muestra el precio en BNB, y ejecuta
   la compra ($5/30 días) llamando a comprarAcceso. También expone el gas faucet. */
import * as ethers from './ethers.min.js';
import * as wallet from './wallet.js';

// Contratos desplegados (proxy)
export const WALLETSHIELD = '0x24E34b95dBd7786b0d11E00e7FA256A8763B6D05';
export const GASFAUCET    = '0x71763E9Ad60d3D2Baa833496F8b4f8eeD497B65F';
const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io'];

const ABI_SHIELD = [
  'function tieneAcceso(address) view returns (bool)',
  'function precioBNB() view returns (uint256)',
  'function precioUSD_() view returns (uint256)',
  'function expiraEn(address) view returns (uint40)',
  'function esOwner(address) view returns (bool)',
  'function comprarAcceso() payable',
  // lista negra comunitaria (v2)
  'function consultarBSC(address) view returns (uint32 n,bool veto,bool prot,bool reportada)',
  'function consultarTron(string) view returns (uint32 n,bool veto,bool prot,bool reportada)',
  'function claveBSC(address) pure returns (bytes32)',
  'function claveTron(string) pure returns (bytes32)',
  'function yaReporto(bytes32,address) view returns (bool)',
  'function reportarBSC(address)',
  'function reportarTron(string)',
  // errores personalizados: con ellos en el ABI ethers pone el nombre en e.reason / e.revert.name
  'error SinAcceso()', 'error DireccionProtegida()', 'error YaReportada()', 'error EnPausa()', 'error ParametroInvalido()', 'error PagoInsuficiente()'
];
const ABI_FAUCET = [
  'function puedeReclamar(address) view returns (bool)',
  'function proximoReclamo(address) view returns (uint256)',
  'function montoFaucetWei() view returns (uint256)',
  'function saldoPozo() view returns (uint256)',
  'function reclamarFaucet()'
];

let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }
function inyectado() { try { const p = wallet.proveedorActivo && wallet.proveedorActivo(); if (p) return p; } catch (_) {} if (window.ethereum) return window.ethereum; throw new Error('no wallet'); }
async function firmante() { return new ethers.BrowserProvider(inyectado()).getSigner(); }

/* Envio con gas estimado + margen (igual que en el swap). Sin gasLimit, MetaMask estima por su
   cuenta y con smart account (Delegation Manager) se queda corta: aviso de fallo y reintento. */
async function _esSmart(runner) {
  try { const a = await runner.getAddress(); const code = await lector().getCode(a); return !!(code && code !== '0x'); } catch (_) { return false; }
}
async function enviar(c, metodo, args, overrides = {}) {
  let est = null;
  try { est = await c[metodo].estimateGas(...args, overrides); }
  catch (e) {
    const esRevert = !!(e && (e.code === 'CALL_EXCEPTION' || e.revert || e.reason || /execution reverted/i.test(e.shortMessage || e.message || '')));
    if (esRevert) throw e;
  }
  if (est == null) return c[metodo](...args, overrides);
  let gasLimit = est * 135n / 100n;
  if (await _esSmart(c.runner)) gasLimit += 150000n;
  return c[metodo](...args, { ...overrides, gasLimit });
}

/* ── ¿La wallet tiene acceso activo? (owners siempre sí) ── */
export async function tieneAcceso(cuenta) {
  if (!cuenta) return false;
  try { const c = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, lector()); return await c.tieneAcceso(cuenta); }
  catch (_) { return false; }
}

/* ── Info para la pantalla de pago: precio en BNB y USD, si es owner, cuándo expira ── */
export async function infoAcceso(cuenta) {
  const out = { precioBNB: 0n, precioBNBtxt: '...', precioUSD: '5', esOwner: false, expira: 0, tiene: false };
  try {
    const c = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, lector());
    const [pBNB, pUSD, owner, exp, tiene] = await Promise.all([
      c.precioBNB().catch(() => 0n),
      c.precioUSD_().catch(() => 500n),
      c.esOwner(cuenta).catch(() => false),
      c.expiraEn(cuenta).catch(() => 0),
      c.tieneAcceso(cuenta).catch(() => false)
    ]);
    out.precioBNB = pBNB;
    out.precioBNBtxt = pBNB > 0n ? Number(ethers.formatEther(pBNB)).toLocaleString(undefined, { maximumFractionDigits: 5 }) : '...';
    out.precioUSD = (Number(pUSD) / 100).toFixed(2);
    out.esOwner = owner;
    out.expira = Number(exp) * 1000;
    out.tiene = tiene;
  } catch (_) {}
  return out;
}

/* Espera a que una transaccion surta efecto COMPROBANDO EL ESTADO en el contrato, no solo el
   hash. Con smart accounts MetaMask puede reemplazar la transaccion por otra con hash distinto:
   tx.wait() se quedaba esperando un hash que nunca se mina y la pantalla quedaba congelada aunque
   el pago ya estaba hecho. Ahora: carrera entre el recibo y un sondeo del estado cada 3 s, hasta
   3 minutos. Si el estado no cambia en ese tiempo, se lanza error. */
async function esperarEstado(tx, comprobar) {
  const inicio = Date.now();
  const sondeo = (async () => {
    while (Date.now() - inicio < 180000) {
      await new Promise((r) => setTimeout(r, 3000));
      try { if (await comprobar()) return true; } catch (_) {}
    }
    return false;
  })();
  const recibo = tx.wait().then(() => true).catch(() => false);
  const primero = await Promise.race([recibo, sondeo]);
  if (primero && await comprobar().catch(() => false)) return true;
  // el recibo llego pero el estado aun no se ve (nodo atrasado) o fallo el recibo: seguir sondeando
  if (await sondeo) return true;
  throw new Error('La transaccion no se confirmo a tiempo');
}

/* ── Comprar 30 días de acceso (paga en BNB). La firma el usuario. ── */
export async function comprarAcceso() {
  const signer = await firmante();
  const cuenta = await signer.getAddress();
  const lect = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, lector());
  const antes = Number(await lect.expiraEn(cuenta).catch(() => 0));
  const c = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, signer);
  const precio = await c.precioBNB();
  const tx = await enviar(c, 'comprarAcceso', [], { value: precio });
  return esperarEstado(tx, async () => Number(await lect.expiraEn(cuenta)) > antes);
}

/* ── Estado de la suscripcion, leido del contrato en el momento (sin cache). Devuelve
   { esOwner, expira (segundos unix), ahora (timestamp del ultimo bloque) } o null si no se pudo leer. ── */
export async function estadoSuscripcion(cuenta) {
  if (!cuenta) return null;
  try {
    const c = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, lector());
    const [owner, exp, bloque] = await Promise.all([c.esOwner(cuenta), c.expiraEn(cuenta), lector().getBlock('latest').catch(() => null)]);
    return { esOwner: !!owner, expira: Number(exp), ahora: Number(bloque && bloque.timestamp) || Math.floor(Date.now() / 1000) };
  } catch (_) { return null; }
}

/* ── Gas Faucet: info y reclamo ── */
export async function infoFaucet(cuenta) {
  const out = { puede: false, proximo: 0, monto: '0', montoWei: 0n, pozo: '0' };
  try {
    const c = new ethers.Contract(GASFAUCET, ABI_FAUCET, lector());
    const [puede, prox, monto, pozo] = await Promise.all([
      c.puedeReclamar(cuenta).catch(() => false),
      c.proximoReclamo(cuenta).catch(() => 0),
      c.montoFaucetWei().catch(() => 0n),
      c.saldoPozo().catch(() => 0n)
    ]);
    out.puede = puede;
    out.proximo = Number(prox) * 1000;
    out.montoWei = monto;
    out.monto = Number(ethers.formatEther(monto)).toLocaleString(undefined, { maximumFractionDigits: 6 });
    out.pozo = Number(ethers.formatEther(pozo)).toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch (_) {}
  return out;
}

export async function reclamarFaucet() {
  const signer = await firmante();
  const cuenta = await signer.getAddress();
  const lect = new ethers.Contract(GASFAUCET, ABI_FAUCET, lector());
  const c = new ethers.Contract(GASFAUCET, ABI_FAUCET, signer);
  const tx = await enviar(c, 'reclamarFaucet', []);
  return esperarEstado(tx, async () => !(await lect.puedeReclamar(cuenta)));
}

/* ── Lista negra comunitaria ── */
export function esTron(addr) { return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr || ''); }
export function esBSC(addr) { return /^0x[0-9a-fA-F]{40}$/.test(addr || ''); }

/** Estado de una direccion en la lista: { n, veto, prot, reportada, yaReporte } (null si no se pudo leer). */
export async function consultarLista(addr, cuenta) {
  try {
    const c = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, lector());
    let r, clave;
    if (esTron(addr)) { r = await c.consultarTron(addr); clave = await c.claveTron(addr); }
    else if (esBSC(addr)) { r = await c.consultarBSC(addr); clave = await c.claveBSC(addr); }
    else return null;
    let ya = false;
    if (cuenta) { try { ya = await c.yaReporto(clave, cuenta); } catch (_) {} }
    return { n: Number(r.n), veto: !!r.veto, prot: !!r.prot, reportada: !!r.reportada, yaReporte: ya };
  } catch (_) { return null; }
}

/** Reportar una direccion (requiere acceso activo). Una vez por wallet y direccion. */
export async function reportarLista(addr) {
  const c = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, await firmante());
  const tx = esTron(addr) ? await enviar(c, 'reportarTron', [addr]) : await enviar(c, 'reportarBSC', [addr]);
  const cuenta = await c.runner.getAddress();
  const lect = new ethers.Contract(WALLETSHIELD, ABI_SHIELD, lector());
  const clave = esTron(addr) ? await lect.claveTron(addr) : await lect.claveBSC(addr);
  return esperarEstado(tx, async () => lect.yaReporto(clave, cuenta));
}
