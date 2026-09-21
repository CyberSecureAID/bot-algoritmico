/**
 * WALLET
 * ======
 *
 * Conexión EIP-1193 / EIP-6963: MetaMask, Trust, Rabby, OKX, Phantom en modo
 * EVM y cualquier otra que inyecte proveedor. Sin librerías.
 *
 * Hace tres cosas:
 *   1. Conectar y DESCONECTAR a voluntad
 *   2. Leer el saldo de la moneda nativa y de cualquier token ERC-20
 *   3. Detectar cuáles de las monedas admitidas tiene el usuario
 *
 * La desconexión es local: las wallets no permiten que una web revoque su
 * propio permiso. Lo que se hace es olvidar la cuenta y dejar de escuchar,
 * que a efectos del usuario es exactamente desconectarse.
 */

import { RED, LISTA_MONEDAS, desdeBase } from './tokens.js';
import * as ethers from './vendor/ethers-6.13.4.min.js?v=126';

const CLAVE_SALIDA = 'bolita.desconectado';

const est = {
  proveedor: null,
  cuenta: null,
  chainId: null,
  oyentes: new Set(),
  manejadores: null
};

/* ================================================================== */
/* Detección                                                           */
/* ================================================================== */

const proveedores6963 = [];
const CLAVE_PREF = 'aurex-wallet';

/* ══════════════ WalletConnect ══════════════
   Sirve cuando NO hay wallet dentro del navegador: la app instalada en el
   teléfono, o un ordenador sin extensión. El usuario aprueba en su wallet
   (que se abre encima) o escanea un QR, y vuelve aquí con la sesión lista.
   La librería pesa, así que se carga SOLO al pulsar conectar.            */
const WC_PROJECT_ID = 'd71edd60ffa5f29b2c6e1b366797bc2f';
let _wcProv = null, _wcCargando = null;

function cargarWC() {
  if (window['@walletconnect/ethereum-provider']) return Promise.resolve(true);
  if (_wcCargando) return _wcCargando;
  _wcCargando = new Promise((res) => {
    // La librería espera variables que en el navegador no existen.
    window.global = window.global || window;
    window.process = window.process || { env: {}, version: '', nextTick: (f) => setTimeout(f, 0) };
    window.Buffer = window.Buffer || undefined;
    const base = new URL('./', import.meta.url);
    const traer = (archivo) => new Promise((ok) => {
      const sc = document.createElement('script');
      sc.src = new URL('vendor/' + archivo, base).href;
      sc.async = true;
      sc.onload = () => ok(true);
      sc.onerror = () => ok(false);
      document.head.appendChild(sc);
    });
    // El generador de QR hace falta para el ordenador (en el móvil no molesta).
    Promise.all([traer('walletconnect.umd.js?v=125'), traer('qrcode.js?v=125')])
      .then(() => res(!!window['@walletconnect/ethereum-provider']));
    setTimeout(() => res(!!window['@walletconnect/ethereum-provider']), 25000);   // conexiones lentas
  });
  return _wcCargando;
}

/** Abre esta misma página DENTRO del navegador de MetaMask o Trust.
 *  Es la vía que nunca falla en el móvil: allí la wallet está inyectada y
 *  conecta al instante. No necesita librerías ni servidores intermedios. */
export function abrirEnWalletMovil(cual) {
  const limpia = (location.host + location.pathname).replace(/\/$/, '');
  const destinos = {
    metamask: 'https://metamask.app.link/dapp/' + limpia,
    trust: 'https://link.trustwallet.com/open_url?coin_id=20000714&url=' + encodeURIComponent(location.href),
    safepal: 'https://link.safepal.io/dapp?url=' + encodeURIComponent(location.href)
  };
  const url = destinos[cual] || destinos.metamask;
  location.href = url;
}

/** ¿Estamos en un móvil? */
export function esMovil() {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** ¿Merece la pena ofrecer WalletConnect? (no hay wallet dentro del navegador) */
export function necesitaWalletConnect() {
  return !window.ethereum && proveedores6963.length === 0;
}

/** Conecta por WalletConnect con NUESTRA propia ventana.
 *  No usamos el modal de la librería porque necesita un paquete extra que
 *  no incluimos: sin él la petición se quedaba sin interfaz y se reiniciaba
 *  sola ("Connection request reset"). Así controlamos todo nosotros:
 *  en el móvil abrimos la wallet directamente, en el ordenador mostramos un QR. */
export async function conectarWalletConnect() {
  if (!(await cargarWC())) {
    throw new Error('WC_CARGA: no se pudo descargar la pieza de conexión. Revisa tu conexión e inténtalo otra vez.');
  }
  const ns = window['@walletconnect/ethereum-provider'];
  const EthereumProvider = ns && (ns.EthereumProvider || ns.default);
  if (!EthereumProvider) throw new Error('WC_LIB: la pieza de conexión no se cargó bien. Recarga la app.');

  // Sesión nueva cada vez: evita restos de intentos anteriores.
  if (_wcProv) { try { await _wcProv.disconnect(); } catch (_) {} _wcProv = null; }

  try {
    _wcProv = await EthereumProvider.init({
      projectId: WC_PROJECT_ID,
      chains: [56],
      optionalChains: [56],
      showQrModal: false,                 // la ventana la ponemos nosotros
      rpcMap: { 56: 'https://bsc-dataseed.binance.org' },
      metadata: {
        name: 'Cripto Cuba Oficial',
        description: 'Bots que compran barato y venden caro por ti, en tu propia wallet.',
        url: location.origin + location.pathname.replace(/[^/]*$/, ''),
        icons: [location.origin + location.pathname.replace(/[^/]*$/, '') + 'assets/img/apple-touch-icon.png']
      }
    });
  } catch (e) { throw new Error('WC_INIT: ' + (e?.message || e)); }

  // Cuando la librería nos da el enlace, abrimos nuestra ventana.
  let cerrarVentana = null;
  const alTenerEnlace = (uri) => { cerrarVentana = ventanaWC(uri); };
  _wcProv.on('display_uri', alTenerEnlace);

  try {
    await _wcProv.connect();
  } catch (e) {
    const m = String(e?.message || e || '');
    if (cerrarVentana) cerrarVentana();
    if (/reject|denied|cancel|closed|rejected/i.test(m)) throw new Error('Cancelaste la conexión en tu wallet.');
    throw new Error('WC_CONN: ' + m);
  } finally {
    try { _wcProv.off('display_uri', alTenerEnlace); } catch (_) {}
  }
  if (cerrarVentana) cerrarVentana();

  const cuentas = _wcProv.accounts || [];
  if (!cuentas.length) throw new Error('SIN_CUENTAS');

  est.proveedor = _wcProv;
  est.cuenta = cuentas[0];
  est.chainId = '0x38';
  est.info = { name: 'WalletConnect', icon: '' };
  engancharEventos(_wcProv);
  guardarPref('walletconnect');
  try { localStorage.removeItem(CLAVE_SALIDA); } catch (_) {}
  avisar();
  return est.cuenta;
}

/* Nuestra ventana: botones de wallet en el móvil, QR en el ordenador. */
function ventanaWC(uri) {
  const movil = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  const enlaces = [
    { n: 'MetaMask', u: 'metamask://wc?uri=' + encodeURIComponent(uri), alt: 'https://metamask.app.link/wc?uri=' + encodeURIComponent(uri) },
    { n: 'Trust Wallet', u: 'trust://wc?uri=' + encodeURIComponent(uri), alt: 'https://link.trustwallet.com/wc?uri=' + encodeURIComponent(uri) },
    { n: 'SafePal', u: 'safepalwallet://wc?uri=' + encodeURIComponent(uri), alt: 'https://link.safepal.io/wc?uri=' + encodeURIComponent(uri) },
    { n: 'Otra wallet', u: 'wc://wc?uri=' + encodeURIComponent(uri), alt: uri }
  ];

  estilosWC();
  const d = document.createElement('div');
  d.id = 'wcbox';
  d.innerHTML = `<div class="wcb-bg"></div>
    <div class="wcb-c">
      <button class="wcb-x" aria-label="Cerrar">✕</button>
      <div class="wcb-t">Conecta tu wallet</div>
      <div class="wcb-s">${movil ? 'Toca tu wallet: se abrirá para que apruebes y volverás aquí.' : 'Escanea este código con la wallet de tu teléfono.'}</div>
      ${movil
        ? `<div class="wcb-l">${enlaces.map((e) => `<a class="wcb-b" href="${e.u}" data-alt="${e.alt}">${e.n}</a>`).join('')}</div>`
        : `<div class="wcb-qr" id="wcb-qr"></div>
           <button class="wcb-copiar" id="wcb-copiar">Copiar enlace</button>`}
    </div>`;
  document.body.appendChild(d);

  const cerrar = () => { const e = document.getElementById('wcbox'); if (e) e.remove(); };
  d.querySelector('.wcb-bg').onclick = cerrar;
  d.querySelector('.wcb-x').onclick = cerrar;

  if (movil) {
    // Si el enlace directo no abre nada, probamos el enlace universal.
    d.querySelectorAll('.wcb-b').forEach((a) => a.addEventListener('click', () => {
      const alt = a.getAttribute('data-alt');
      setTimeout(() => { if (!document.hidden && alt) location.href = alt; }, 1200);
    }));
  } else {
    try {
      const qr = window.qrcode(0, 'L');
      qr.addData(uri); qr.make();
      document.getElementById('wcb-qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    } catch (_) {
      document.getElementById('wcb-qr').innerHTML = '<div class="wcb-nqr">No se pudo dibujar el código. Usa "Copiar enlace" y pégalo en tu wallet.</div>';
    }
    const cp = document.getElementById('wcb-copiar');
    if (cp) cp.onclick = async () => {
      try { await navigator.clipboard.writeText(uri); cp.textContent = '¡Copiado!'; setTimeout(() => { cp.textContent = 'Copiar enlace'; }, 1500); } catch (_) {}
    };
  }
  return cerrar;
}

function estilosWC() {
  if (document.getElementById('wcbox-css')) return;
  const s = document.createElement('style'); s.id = 'wcbox-css';
  s.textContent = `
  #wcbox{position:fixed;inset:0;z-index:9900;display:flex;align-items:center;justify-content:center;padding:18px}
  #wcbox .wcb-bg{position:absolute;inset:0;background:rgba(3,5,8,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  #wcbox .wcb-c{position:relative;width:100%;max-width:360px;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid #C9A84B;border-radius:20px;padding:24px 20px;box-shadow:0 30px 90px rgba(0,0,0,.8);text-align:center}
  #wcbox .wcb-x{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer;font-size:14px}
  #wcbox .wcb-t{font-family:'Chakra Petch',sans-serif;font-weight:800;font-size:20px;color:#E8B84B}
  #wcbox .wcb-s{font-size:13px;color:#8b96a3;line-height:1.55;margin:7px 0 18px}
  #wcbox .wcb-l{display:flex;flex-direction:column;gap:9px}
  #wcbox .wcb-b{display:block;padding:15px;border-radius:13px;border:1px solid #3a424c;background:linear-gradient(180deg,#1b2027,#0d1117);color:#eaecef;font-family:'Chakra Petch',sans-serif;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 3px 0 rgba(0,0,0,.4)}
  #wcbox .wcb-b:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.4)}
  #wcbox .wcb-qr{background:#fff;border-radius:14px;padding:12px;display:grid;place-items:center}
  #wcbox .wcb-qr svg{width:100%;height:auto;max-width:240px;display:block}
  #wcbox .wcb-nqr{color:#333;font-size:12px;padding:20px;line-height:1.5}
  #wcbox .wcb-copiar{width:100%;margin-top:12px;padding:12px;border-radius:11px;border:1px solid #3a424c;background:transparent;color:#E8B84B;font-family:'Chakra Petch',sans-serif;font-weight:700;font-size:13px;cursor:pointer}`;
  document.head.appendChild(s);
}

const idDe = (d) => String(d?.info?.rdns || d?.info?.uuid || d?.info?.name || '').toLowerCase();
const prefGuardada = () => { try { return localStorage.getItem(CLAVE_PREF) || ''; } catch (_) { return ''; } };
const guardarPref = (id) => { try { id ? localStorage.setItem(CLAVE_PREF, id) : localStorage.removeItem(CLAVE_PREF); } catch (_) {} };
if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', (e) => {
    if (!proveedores6963.some((p) => p.info?.uuid === e.detail.info?.uuid)) {
      proveedores6963.push(e.detail);
    }
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
}

export function proveedorActivo() { return detectar(); }
function detectar() {
  if (est.proveedor) return est.proveedor;

  // Si el usuario eligió una wallet a mano, esa manda.
  const pref = prefGuardada();
  if (pref) {
    const elegida = proveedores6963.find((d) => idDe(d) === pref);
    if (elegida?.provider) return elegida.provider;
  }

  // Preferimos MetaMask de verdad. Las wallets integradas del navegador
  // (p. ej. la de Brave) se anuncian aunque no estén configuradas y no responden.
  const esBrave = (p) => !!(p && (p.isBraveWallet || p.isBrave));
  const esMM = (p) => !!(p && p.isMetaMask && !esBrave(p));

  const mm = proveedores6963.find((d) => esMM(d.provider)
    || String(d?.info?.rdns || '').toLowerCase() === 'io.metamask');
  if (mm?.provider) return mm.provider;

  const eth = window.ethereum;
  if (eth?.providers?.length) {
    const m = eth.providers.find(esMM);
    if (m) return m;
  }
  if (esMM(eth)) return eth;

  const otra = proveedores6963.find((d) => !esBrave(d.provider));
  if (otra?.provider) return otra.provider;
  if (proveedores6963.length > 0) return proveedores6963[0].provider;
  return eth ?? null;
}







export const hayWallet = () => Boolean(detectar());

/** Por qué no se puede conectar, para poder decírselo al usuario. */
export function diagnostico() {
  if (detectar()) return { ok: true };

  const ua = navigator.userAgent || '';
  const movil = /Android|iPhone|iPad|iPod/i.test(ua);

  return {
    ok: false,
    movil,
    motivo: movil
      ? 'En el móvil hay que abrir la página DENTRO del navegador de la wallet (MetaMask, Trust…), no en Chrome ni Safari.'
      : 'No se detectó ninguna wallet. Instala MetaMask, Rabby o Trust Wallet y recarga la página.'
  };
}
export const cuentaActual = () => est.cuenta;
export const chainActual = () => est.chainId;
export const esRedCorrecta = () => est.chainId === RED.chainIdHex;

/** Nombre e icono de la wallet conectada (para mostrar su logo). */
export function walletInfo() {
  return est.info ?? null;
}

/**
 * Si la wallet no llegó por EIP-6963, adivinar cuál es por las banderas que
 * inyecta en el proveedor (isMetaMask, isTrust, isPhantom, etc.).
 */
function adivinarInfo(prov) {
  if (!prov) return null;
  if (prov.isTrust || prov.isTrustWallet) return { name: 'Trust Wallet', clave: 'trust' };
  if (prov.isPhantom) return { name: 'Phantom', clave: 'phantom' };
  if (prov.isCoinbaseWallet) return { name: 'Coinbase Wallet', clave: 'coinbase' };
  if (prov.isBinance) return { name: 'Binance Wallet', clave: 'binance' };
  if (prov.isRabby) return { name: 'Rabby', clave: 'rabby' };
  if (prov.isMetaMask) return { name: 'MetaMask', clave: 'metamask' };
  return { name: 'Wallet', clave: 'generica' };
}

/* Checksum EIP-55: devuelve la dirección con las mayúsculas/minúsculas correctas
   (idéntica a la que muestra Trust Wallet u otras wallets). Es la MISMA dirección
   que en minúsculas —las direcciones EVM no distinguen mayúsculas—, pero mostrarla
   con checksum le da confianza al usuario y protege contra erratas. Usa ethers (ya
   global en el sitio); si no estuviera, devuelve la dirección tal cual sin romper. */
export function checksum(dir) {
  try {
    if (dir && ethers && ethers.getAddress) return ethers.getAddress(dir);
  } catch (_) { /* dirección no estándar: se deja como viene */ }
  return dir;
}

export function abreviar(dir) {
  const d = checksum(dir);
  return d ? d.slice(0, 6) + '…' + d.slice(-4) : '';
}

export function alCambiar(cb) {
  est.oyentes.add(cb);
  return () => est.oyentes.delete(cb);
}

function avisar() {
  for (const cb of est.oyentes) {
    try { cb({ cuenta: est.cuenta, chainId: est.chainId }); } catch { /* nada */ }
  }
}

/* ================================================================== */
/* Conectar y desconectar                                              */
/* ================================================================== */

function engancharEventos(prov) {
  soltarEventos();

  const onCuentas = (nuevas) => {
    est.cuenta = nuevas?.[0] ?? null;
    if (!est.cuenta) localStorage.setItem(CLAVE_SALIDA, '1');
    avisar();
  };
  const onCadena = (id) => { est.chainId = id; avisar(); };

  prov.on?.('accountsChanged', onCuentas);
  prov.on?.('chainChanged', onCadena);
  est.manejadores = { prov, onCuentas, onCadena };
}

function soltarEventos() {
  if (!est.manejadores) return;
  const { prov, onCuentas, onCadena } = est.manejadores;
  prov.removeListener?.('accountsChanged', onCuentas);
  prov.removeListener?.('chainChanged', onCadena);
  est.manejadores = null;
}




/** Wallets que el navegador ofrece (con su logo oficial, que envía la propia wallet). */
export function walletsDisponibles() {
  return proveedores6963.map((d) => ({
    id: idDe(d),
    nombre: d?.info?.name || 'Wallet',
    icono: d?.info?.icon || '',
    activa: est.proveedor === d.provider
  }));
}

/** Conecta con la wallet que el usuario eligió y la recuerda para la próxima. */
export async function conectarCon(id) {
  const d = proveedores6963.find((x) => idDe(x) === String(id).toLowerCase());
  if (!d) throw new Error('NO_WALLET');
  guardarPref(idDe(d));
  est.proveedor = d.provider;
  est.info = d.info;
  est.cuenta = null;
  return conectar();
}

/** Vuelve a la elección automática. */
export function olvidarWallet() { guardarPref(''); }

export async function conectar() {
  const prov = detectar();
  if (!prov) throw new Error('NO_WALLET');

  est.proveedor = prov;

  // Guardar la info del proveedor (nombre e icono) si vino por EIP-6963
  const encontrado = proveedores6963.find((p) => p.provider === prov);
  est.info = encontrado?.info ?? adivinarInfo(prov);

  const cuentas = await prov.request({ method: 'eth_requestAccounts' });
  if (!cuentas?.length) throw new Error('SIN_CUENTAS');

  est.cuenta = cuentas[0];
  est.chainId = await prov.request({ method: 'eth_chainId' });

  engancharEventos(prov);
  localStorage.removeItem(CLAVE_SALIDA);   // vuelve a reconectar sola
  avisar();

  return est.cuenta;
}



/**
 * Desconecta. Olvida la cuenta, suelta los eventos y borra la sesión, para
 * que al recargar no vuelva a entrar sola.
 *
 * Si la wallet admite revocar permisos (MetaMask lo hace), se le pide también,
 * pero no se depende de ello: da igual si lo rechaza.
 */
export async function desconectar() {
  const prov = est.proveedor;

  if (prov?.request) {
    try {
      await prov.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }]
      });
    } catch { /* la wallet no lo admite: seguimos igual */ }
  }

  soltarEventos();
  est.cuenta = null;
  est.chainId = null;
  est.proveedor = null;
  localStorage.setItem(CLAVE_SALIDA, '1');  // no reconectar sola
  avisar();
}

/**
 * Reconecta sola si la wallet ya tiene permiso concedido, SALVO que el
 * usuario se haya desconectado a mano. Así vuelve el comportamiento de
 * antes sin romper el botón de desconectar.
 */
export async function reconectarSiProcede() {
  if (localStorage.getItem(CLAVE_SALIDA) === '1') return null;

  const prov = detectar();
  if (!prov) return null;

  try {
    const cuentas = await prov.request({ method: 'eth_accounts' });
    if (cuentas?.length) {
      est.proveedor = prov;
      est.cuenta = cuentas[0];
      est.chainId = await prov.request({ method: 'eth_chainId' });
      engancharEventos(prov);
      avisar();
      return est.cuenta;
    }
  } catch { /* nada */ }

  return null;
}



export async function cambiarARedCorrecta() {
  const prov = est.proveedor ?? detectar();
  if (!prov) throw new Error('NO_WALLET');

  try {
    await prov.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: RED.chainIdHex }]
    });
  } catch (err) {
    if (err?.code === 4902) {
      await prov.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: RED.chainIdHex,
          chainName: RED.nombre,
          nativeCurrency: RED.moneda,
          rpcUrls: [RED.rpc],
          blockExplorerUrls: [RED.explorador]
        }]
      });
    } else throw err;
  }
}

/* ================================================================== */
/* Saldos                                                              */
/* ================================================================== */

/** Selector de balanceOf(address) = 0x70a08231 */
const SEL_BALANCE = '0x70a08231';

async function llamar(metodo, params) {
  const prov = est.proveedor ?? detectar();
  if (!prov) throw new Error('NO_WALLET');
  return prov.request({ method: metodo, params });
}

/** Saldo de una moneda concreta, ya en unidades decimales. */
export async function saldoDe(moneda, cuenta = est.cuenta) {
  if (!cuenta) return null;

  try {
    if (moneda.address === null) {
      const hex = await llamar('eth_getBalance', [cuenta, 'latest']);
      return desdeBase(hex, moneda.decimals);
    }

    const data = SEL_BALANCE + cuenta.slice(2).toLowerCase().padStart(64, '0');
    const hex = await llamar('eth_call', [{ to: moneda.address, data }, 'latest']);

    if (!hex || hex === '0x') return 0;
    return desdeBase(hex, moneda.decimals);
  } catch {
    return null;
  }
}

/**
 * Lee el saldo de TODAS las monedas admitidas.
 * Con esto la interfaz puede marcar cuáles tiene el usuario de verdad.
 *
 * @returns {Promise<Record<string, number|null>>}
 */
export async function saldosTodas(cuenta = est.cuenta) {
  if (!cuenta) return {};

  const pares = await Promise.all(
    LISTA_MONEDAS.map(async (m) => [m.id, await saldoDe(m, cuenta)])
  );

  return Object.fromEntries(pares);
}
