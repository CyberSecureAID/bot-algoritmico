/* analisis-pro.js — Ventana de cobro del Análisis Profesional (reutilizable).
   ──────────────────────────────────────────────────────────────────────────
   Se invoca desde el hero y desde futuros SIN navegar a otra página (ventana
   emergente), para no desconectar la wallet ni pestañear. Lee el precio del
   contrato AnalisisPro (NUNCA fijo). Pago en BNB o USDT. Prueba gratis 10 min.
   El acceso lo decide el contrato (tieneAcceso): el frontend solo consulta.

   Uso:
     import { abrirCobroAnalisis, tieneAccesoAnalisis, segundosAnalisis } from './modulo/analisis-pro.js';
     abrirCobroAnalisis(origen, wallet, ethers, onPagado);
       origen: 'hero' | 'futuros' (cambia el mensaje).
       onPagado(): callback cuando el usuario queda con acceso (pagó o prueba).
*/

const ANALISIS_ADDR = '0x8e04ACEc37aE1D8fA6239d4407a73316bFC97469';
const USDT_ADDR     = '0x55d398326f99059fF775485246999027B3197955';
const IMG = 'assets/portada/img/analisis-pro.webp';   // imagen (candado/escudo) que sube el usuario

const ABI = [
  'function tieneAcceso(address wallet) view returns (bool)',
  'function segundosRestantes(address wallet) view returns (uint256)',
  'function precioMesUSD() view returns (uint256)',
  'function precioAnioUSD() view returns (uint256)',
  'function precioToken(uint8 plan,address token) view returns (uint256)',
  'function comprarAcceso(uint8 plan,address token) payable',
  'function pruebaGratis()',
  'function pruebaUsada(address) view returns (bool)',
  'function esOwner(address) view returns (bool)'
];
const ABI_USDT = [
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

function _prov(wallet, ethers) {
  const p = (wallet.proveedorActivo && wallet.proveedorActivo()) || window.ethereum;
  return new ethers.BrowserProvider(p);
}
async function _signer(wallet, ethers) { return (await _prov(wallet, ethers)).getSigner(); }

// ¿la wallet tiene acceso ahora? (lo decide el contrato)
export async function tieneAccesoAnalisis(wallet, ethers) {
  try {
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    if (!cuenta) return false;
    const c = new (ethers.Contract)(ANALISIS_ADDR, ABI, _prov(wallet, ethers));
    return await c.tieneAcceso(cuenta);
  } catch (_) { return false; }
}
export async function segundosAnalisis(wallet, ethers) {
  try {
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    if (!cuenta) return 0;
    const c = new (ethers.Contract)(ANALISIS_ADDR, ABI, _prov(wallet, ethers));
    return Number(await c.segundosRestantes(cuenta));
  } catch (_) { return 0; }
}

function _fmtUSD(usd2) { return '$' + (Number(usd2) / 100).toFixed(0); }

export async function abrirCobroAnalisis(origen, wallet, ethers, onPagado) {
  // quitar una ventana previa si existe
  const prev = document.getElementById('ap-cobro'); if (prev) prev.remove();

  const esHero = origen === 'hero';
  const introHero =
    'This is institutional-grade order-flow analysis. Our engine reads the real volume trapped inside every block of orders and the live book to map where capital is committed and where price is likely to react, with Liquidity Pools and Hair Pools built from genuine market data rather than lagging indicators. The read is verifiable on the chart itself, high-frequency, and tuned for traders who make decisions on probability, not noise.';
  const introFut =
    'Load professional order-flow analysis directly onto your futures chart. Liquidity Pools and Hair Pools overlay the exact zones where capital is committed and where price tends to react, computed from real volume and the live book. It is the same institutional read, now inside the chart you trade.';
  const nota = esHero
    ? 'From here, the tools apply to spot trading. For futures, open the Futures area and load Professional Analysis there.'
    : 'Once active, the overlays appear on your futures chart. You can toggle them on or off at any time.';

  // leer el precio del contrato (NUNCA fijo)
  let pMes = '20', pAnio = '100', yaUso = false, esOwner = false;
  try {
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    const c = new (ethers.Contract)(ANALISIS_ADDR, ABI, _prov(wallet, ethers));
    const [m, a] = await Promise.all([c.precioMesUSD(), c.precioAnioUSD()]);
    pMes = _fmtUSD(m); pAnio = _fmtUSD(a);
    if (cuenta) { try { yaUso = await c.pruebaUsada(cuenta); } catch (_) {} try { esOwner = await c.esOwner(cuenta); } catch (_) {} }
  } catch (_) {}

  const ov = document.createElement('div');
  ov.id = 'ap-cobro';
  ov.style.cssText = 'position:fixed;inset:0;z-index:40000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.68);backdrop-filter:blur(3px)';
  ov.innerHTML = `
    <div style="max-width:420px;width:100%;background:linear-gradient(180deg,#141a22,#0d1117);border:1px solid #2b3340;border-radius:18px;overflow:hidden;color:#eaecef;font-family:sans-serif">
      <div style="height:132px;background:#0e1319 center/cover no-repeat;background-image:url('${IMG}');border-bottom:1px solid #222a33"></div>
      <div style="padding:22px 22px 20px">
        <div style="font-size:19px;font-weight:800;color:#E8B84B;letter-spacing:.01em;margin-bottom:3px">Professional Analysis</div>
        <div style="font-size:10.5px;font-weight:800;letter-spacing:.16em;color:#8b96a3;margin-bottom:14px">ORDER-FLOW INTELLIGENCE</div>
        <p style="font-size:13px;line-height:1.6;margin:0 0 11px">${esHero ? introHero : introFut}</p>
        <p style="font-size:12px;line-height:1.55;margin:0 0 16px;color:#9aa6b2">${nota}</p>

        <div id="ap-planes" style="display:flex;gap:10px;margin-bottom:14px">
          <button class="ap-plan" data-plan="0" style="flex:1;text-align:left;background:#161c24;border:1px solid #2b3340;border-radius:11px;padding:12px;cursor:pointer">
            <div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:#8b96a3">MONTHLY</div>
            <div style="font-size:20px;font-weight:800;color:#eaecef" id="ap-pm">${pMes}</div>
            <div style="font-size:10.5px;color:#8b96a3">per month</div>
          </button>
          <button class="ap-plan" data-plan="1" style="flex:1;text-align:left;background:rgba(232,184,75,.08);border:1px solid rgba(232,184,75,.45);border-radius:11px;padding:12px;cursor:pointer;position:relative">
            <div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:#E8B84B">ANNUAL</div>
            <div style="font-size:20px;font-weight:800;color:#eaecef" id="ap-pa">${pAnio}</div>
            <div style="font-size:10.5px;color:#8b96a3">per year</div>
          </button>
        </div>

        <div id="ap-pay" style="display:flex;gap:10px;margin-bottom:10px">
          <button id="ap-usdt" style="flex:1;background:#1b222c;border:1px solid #2b3340;border-radius:10px;padding:12px;color:#eaecef;font-weight:800;cursor:pointer">Pay with USDT</button>
          <button id="ap-bnb" style="flex:1;background:#1b222c;border:1px solid #2b3340;border-radius:10px;padding:12px;color:#eaecef;font-weight:800;cursor:pointer">Pay with BNB</button>
        </div>

        <button id="ap-trial" style="width:100%;background:transparent;border:1px dashed #3a434f;border-radius:10px;padding:11px;color:${yaUso ? '#5a636d' : '#E8B84B'};font-weight:700;cursor:${yaUso ? 'default' : 'pointer'};margin-bottom:12px" ${yaUso ? 'disabled' : ''}>
          ${yaUso ? 'Free trial already used' : 'Try free for 10 minutes'}
        </button>

        <div style="display:flex;justify-content:flex-end">
          <button id="ap-close" style="background:none;border:none;color:#8b96a3;font-weight:700;cursor:pointer;font-size:13px">Close</button>
        </div>
        <div id="ap-msg" style="font-size:12px;color:#8b96a3;text-align:center;margin-top:8px;min-height:16px"></div>
      </div>
    </div>`;
  document.body.appendChild(ov);

  let planSel = 1;   // anual por defecto (el resaltado)
  const marcarPlan = () => ov.querySelectorAll('.ap-plan').forEach((b) => {
    const on = +b.dataset.plan === planSel;
    b.style.borderColor = on ? 'rgba(232,184,75,.6)' : '#2b3340';
    b.style.background = on ? 'rgba(232,184,75,.08)' : '#161c24';
  });
  marcarPlan();
  ov.querySelectorAll('.ap-plan').forEach((b) => b.onclick = () => { planSel = +b.dataset.plan; marcarPlan(); });

  const msg = (t) => { const e = ov.querySelector('#ap-msg'); if (e) e.textContent = t || ''; };
  const cerrar = () => { try { ov.remove(); } catch (_) {} };
  ov.querySelector('#ap-close').onclick = cerrar;

  // si ya es owner, avisar y dejar entrar
  if (esOwner) { msg('Owner access — no payment needed.'); }

  // PAGO en USDT
  ov.querySelector('#ap-usdt').onclick = async () => {
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    if (!cuenta) { msg('Connect your wallet first.'); return; }
    try {
      msg('Confirm in your wallet…');
      const signer = await _signer(wallet, ethers);
      const c = new (ethers.Contract)(ANALISIS_ADDR, ABI, signer);
      const costo = await c.precioToken(planSel, USDT_ADDR);
      const usdt = new (ethers.Contract)(USDT_ADDR, ABI_USDT, signer);
      const perm = await usdt.allowance(cuenta, ANALISIS_ADDR);
      if (perm < costo) { msg('Approving USDT…'); await (await usdt.approve(ANALISIS_ADDR, costo)).wait(); }
      msg('Processing payment…');
      await (await c.comprarAcceso(planSel, USDT_ADDR)).wait();
      msg('Access granted.');
      cerrar(); if (onPagado) onPagado();
    } catch (e) { msg('Payment failed: ' + (e && e.shortMessage ? e.shortMessage : 'cancelled')); }
  };

  // PAGO en BNB
  ov.querySelector('#ap-bnb').onclick = async () => {
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    if (!cuenta) { msg('Connect your wallet first.'); return; }
    try {
      msg('Confirm in your wallet…');
      const signer = await _signer(wallet, ethers);
      const c = new (ethers.Contract)(ANALISIS_ADDR, ABI, signer);
      const costo = await c.precioToken(planSel, '0x0000000000000000000000000000000000000000');
      msg('Processing payment…');
      await (await c.comprarAcceso(planSel, '0x0000000000000000000000000000000000000000', { value: costo })).wait();
      msg('Access granted.');
      cerrar(); if (onPagado) onPagado();
    } catch (e) { msg('Payment failed: ' + (e && e.shortMessage ? e.shortMessage : 'cancelled')); }
  };

  // PRUEBA GRATIS 10 MIN
  ov.querySelector('#ap-trial').onclick = async () => {
    if (yaUso) return;
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    if (!cuenta) { msg('Connect your wallet first.'); return; }
    try {
      msg('Confirm in your wallet…');
      const signer = await _signer(wallet, ethers);
      const c = new (ethers.Contract)(ANALISIS_ADDR, ABI, signer);
      await (await c.pruebaGratis()).wait();
      msg('10-minute trial started.');
      cerrar(); if (onPagado) onPagado();
    } catch (e) { msg('Could not start trial: ' + (e && e.shortMessage ? e.shortMessage : 'already used')); }
  };
}
