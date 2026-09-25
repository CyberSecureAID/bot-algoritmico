/* shield-sim.js — Simulador "What happens if I sign this?" (REAL, no placeholder).
   El usuario pega la dirección de un contrato (y opcionalmente el spender que le
   pide permiso). El módulo LEE la cadena de verdad: identifica si es un token,
   lee su símbolo/decimales, revisa el allowance actual, comprueba si el spender
   es uno de NUESTROS contratos (seguro) o desconocido, y explica en lenguaje
   claro qué significa y el nivel de riesgo. Todo con lecturas on-chain reales. */
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from '../wallet.js?v=125';
import { NUESTROS } from './shield-datos.js?v=1';

const RPCS = ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io', 'https://bsc-dataseed1.ninicoin.io'];
const ABI = [
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function owner() view returns (address)'
];
let _rpc;
function lector() { if (!_rpc) _rpc = new ethers.JsonRpcProvider(RPCS[0], 56, { staticNetwork: true }); return _rpc; }

export function esDireccion(s) { return /^0x[0-9a-fA-F]{40}$/.test((s || '').trim()); }

/* Analiza un contrato (token) y, opcionalmente, un spender que pide permiso.
   Devuelve un informe con veredicto y explicación en lenguaje claro. */
export async function analizar(contrato, spender) {
  const prov = lector();
  const out = { contrato, spender: spender || null, hallazgos: [], veredicto: 'unknown', titulo: '', resumen: '' };

  // 1. ¿el contrato tiene código? (no una wallet normal)
  let code = '0x';
  try { code = await prov.getCode(contrato); } catch (_) {}
  if (code === '0x' || code === '0x0') {
    out.veredicto = 'warn'; out.titulo = 'Not a contract';
    out.resumen = 'This address has no contract code — it looks like a normal wallet, not a token or dApp. Be careful: you should not be granting permissions to a plain address.';
    out.hallazgos.push({ tipo: 'warn', t: 'No contract code found' });
    return out;
  }

  // 2. leer datos del token
  const c = new ethers.Contract(contrato, ABI, prov);
  let sym = '', nom = '', dec = 18, supply = 0n, esToken = false;
  try { sym = await c.symbol(); esToken = true; } catch (_) {}
  try { nom = await c.name(); } catch (_) {}
  try { dec = Number(await c.decimals()); } catch (_) {}
  try { supply = await c.totalSupply(); } catch (_) {}

  if (esToken) {
    out.hallazgos.push({ tipo: 'ok', t: `Token detected: ${sym}${nom ? ' · ' + nom : ''}` });
  } else {
    out.hallazgos.push({ tipo: 'info', t: 'This is a contract, but not a standard token (could be a dApp or router)' });
  }

  // 3. si hay spender, analizar el permiso
  if (spender && esDireccion(spender)) {
    const spLower = spender.toLowerCase();
    if (NUESTROS[spLower]) {
      out.veredicto = 'safe'; out.titulo = 'Safe · Cripto Cuba';
      out.resumen = `This permission is for ${NUESTROS[spLower]}, one of our own verified contracts. It is safe and needed to use our platform.`;
      out.hallazgos.push({ tipo: 'ok', t: `Spender is a trusted Cripto Cuba contract` });
      return out;
    }
    // spender desconocido: leer el allowance actual del usuario (si está conectado)
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    let allow = null;
    if (cuenta && esToken) {
      try { allow = await c.allowance(cuenta, spender); } catch (_) {}
    }
    // ¿el spender tiene código? (un spender que es EOA es MUY sospechoso)
    let spCode = '0x';
    try { spCode = await prov.getCode(spender); } catch (_) {}
    if (spCode === '0x' || spCode === '0x0') {
      out.veredicto = 'danger'; out.titulo = 'High risk';
      out.resumen = 'The spender is a plain wallet address, not a contract. Legitimate dApps are contracts. Granting token permission to a plain address is a classic scam pattern — do NOT sign this.';
      out.hallazgos.push({ tipo: 'bad', t: 'Spender is a plain wallet, not a contract (red flag)' });
      return out;
    }
    // spender es contrato desconocido
    out.veredicto = 'warn'; out.titulo = 'Unknown contract';
    out.hallazgos.push({ tipo: 'warn', t: 'Spender is a contract we don\'t recognize' });
    if (allow !== null) {
      const MAX = (2n ** 256n) - 1n;
      if (allow > MAX / 2n) out.hallazgos.push({ tipo: 'bad', t: 'You already gave it UNLIMITED allowance' });
      else if (allow > 0n) out.hallazgos.push({ tipo: 'warn', t: `Current allowance: ${ethers.formatUnits(allow, dec)} ${sym}` });
      else out.hallazgos.push({ tipo: 'ok', t: 'No active allowance yet' });
    }
    out.resumen = 'We can\'t verify this spender. Only sign if you fully trust the site asking for it. If the site asks for unlimited access, that is a warning sign.';
    return out;
  }

  // 4. sin spender: solo info del contrato
  out.veredicto = esToken ? 'info' : 'warn';
  out.titulo = esToken ? `${sym} token` : 'Unknown contract';
  out.resumen = esToken
    ? `This is the ${sym} token contract${nom ? ' (' + nom + ')' : ''}. To check a permission, also paste the spender address that is asking for access.`
    : 'This is a contract but not a standard token. Paste the spender address too if a site is asking you to approve something.';
  return out;
}
