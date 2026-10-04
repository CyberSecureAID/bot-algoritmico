/* analisis-pro.js. Ventana de cobro del Análisis Profesional (reutilizable).
   ──────────────────────────────────────────────────────────────────────────
   Misma estética que Wallet Shield: pantalla completa sobre la página actual
   (no navega, no desconecta la wallet, no pestañea), imagen candado/escudo
   transparente, y tres planes en tarjetas. Lee el precio del contrato
   AnalisisPro (nunca fijo). Pago en BNB o USDT a elección del usuario. Prueba
   gratis de 10 minutos, una sola vez por wallet, válida para los tres
   servicios. El acceso lo decide el contrato (tieneAcceso); el frontend solo
   consulta.

   Uso:
     import { abrirCobroAnalisis, tieneAccesoAnalisis, segundosAnalisis } from './modulo/analisis-pro.js';
     abrirCobroAnalisis(origen, wallet, ethers, onPagado);
       origen: 'hero' | 'futuros' (cambia el mensaje: spot o futuros apalancado).
       onPagado(): callback cuando el usuario queda con acceso (pagó o prueba).
*/

const ANALISIS_ADDR = '0x8e04ACEc37aE1D8fA6239d4407a73316bFC97469';
const USDT_ADDR     = '0x55d398326f99059fF775485246999027B3197955';
const BNB_ADDR      = '0x0000000000000000000000000000000000000000';
const IMG    = 'assets/portada/img/analisis-pro.webp';   // candado/escudo transparente
const BANNER = 'assets/portada/img/header.webp';          // marmol dorado superior

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
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function abrirCobroAnalisis(origen, wallet, ethers, onPagado) {
  const prev = document.getElementById('ap-cobro'); if (prev) prev.remove();

  const esHero = origen === 'hero';

  const intro = esHero
    ? 'Institutional grade order flow, read from the market itself. The engine reconstructs the real volume resting behind every block of orders and follows the live book in real time, mapping where capital is committed and where price is likely to turn. Liquidity Pools and Hair Pools are built from genuine flow, not lagging indicators, and every level is verifiable on the chart. Fast, precise, and made for traders who act on evidence.'
    : 'Bring institutional order flow onto the chart you already trade. Liquidity Pools and Hair Pools overlay the exact zones where capital is committed and where price tends to react, computed live from real volume and the order book, on your current chart and timeframe, with full leverage in play. The same read the desks use, now inside your futures workspace.';

  // Precios del contrato (nunca fijos); si falla la lectura, respaldo 20 / 100.
  let pMes = '$20', pAnio = '$100', yaUso = false;
  try {
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    const c = new (ethers.Contract)(ANALISIS_ADDR, ABI, _prov(wallet, ethers));
    const [m, a] = await Promise.all([c.precioMesUSD(), c.precioAnioUSD()]);
    pMes = _fmtUSD(m); pAnio = _fmtUSD(a);
    if (cuenta) { try { yaUso = await c.pruebaUsada(cuenta); } catch (_) {} }
  } catch (_) {}

  const PLANES = [
    { id: 'free', plan: null, nombre: 'Free',    amt: 'Free', unidad: '10 minutes, once', detalle: 'Full access to all three tools for a single session of ten minutes. One time per wallet.', free: true },
    { id: 'mes',  plan: 0,    nombre: 'Monthly', amt: pMes,   unidad: 'per month',         detalle: 'Unlimited access to Liquidity Pools, Hair Pools and Smart Levels.' },
    { id: 'anio', plan: 1,    nombre: 'Annual',  amt: pAnio,  unidad: 'per year',          detalle: 'Twelve months for the price of five. Our most chosen plan.', top: true }
  ];

  const ov = document.createElement('div');
  ov.id = 'ap-cobro';
  ov.style.visibility = 'hidden';   // anti-flash: se revela ya montada

  const tarjeta = (p) => `
    <button class="ap-plan ${p.top ? 'top' : ''}" data-plan="${p.id}">
      ${p.top ? '<span class="ap-badge">Most popular</span>' : ''}
      <div class="ap-plan-n">${esc(p.nombre)}</div>
      <div class="ap-plan-price"><span class="ap-plan-amt">${esc(p.amt)}</span></div>
      <div class="ap-plan-u">${esc(p.unidad)}</div>
      <div class="ap-plan-d">${esc(p.detalle)}</div>
      <div class="ap-plan-pick">Select</div>
    </button>`;

  ov.innerHTML = `
    <div class="ap-banner"></div>
    <div class="ap-bar">
      <button class="ap-back" id="ap-back">\u2190 Back</button>
      <div class="ap-bar-t">Professional <span>Analysis</span></div>
    </div>
    <div class="ap-in">
      <img class="ap-hero" src="${IMG}" alt="">
      <h1 class="ap-title">Trade with the <span class="g">real</span> order flow</h1>
      <p class="ap-intro">${intro}</p>

      <div class="ap-planes">${PLANES.map(tarjeta).join('')}</div>

      <div class="ap-pay" id="ap-pay">
        <span class="ap-pay-lbl">Pay in</span>
        <div class="ap-seg">
          <button class="ap-cur on" data-cur="usdt">USDT</button>
          <button class="ap-cur" data-cur="bnb">BNB</button>
        </div>
      </div>

      <button class="ap-cta" id="ap-cta">Continue</button>
      <div class="ap-msg" id="ap-msg"></div>
    </div>
    <style>
      #ap-cobro{position:fixed;inset:0;z-index:40000;height:100dvh;max-height:100dvh;display:flex;flex-direction:column;color:#eaecef;background:#05070a;font-family:var(--display,'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif)}
      #ap-cobro::before{content:'';position:fixed;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.80),rgba(3,5,8,.94));z-index:0;pointer-events:none}
      #ap-cobro .ap-banner{position:fixed;top:0;left:0;right:0;height:300px;z-index:0;pointer-events:none;opacity:.8;background:url('${BANNER}') center top/cover no-repeat;-webkit-mask-image:linear-gradient(180deg,#000 0,#000 45%,transparent 100%);mask-image:linear-gradient(180deg,#000 0,#000 45%,transparent 100%)}
      #ap-cobro *{box-sizing:border-box}
      #ap-cobro .ap-bar{position:relative;z-index:5;display:flex;align-items:center;gap:14px;padding:calc(12px + env(safe-area-inset-top,0px)) 18px 12px;background:rgba(5,7,9,.4);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid #1c232b}
      #ap-cobro .ap-back{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.04);border:1px solid #29313b;color:#a7b0bb;border-radius:10px;padding:9px 14px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600}
      #ap-cobro .ap-back:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
      #ap-cobro .ap-bar-t{font-size:15px;font-weight:800;letter-spacing:.2px}
      #ap-cobro .ap-bar-t span{color:var(--gold,#E8B84B)}
      #ap-cobro .ap-in{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;position:relative;z-index:1;width:100%;max-width:880px;margin:0 auto;padding:16px 18px calc(44px + env(safe-area-inset-bottom,0px));text-align:center}
      #ap-cobro .ap-in::-webkit-scrollbar{width:0;height:0;display:none}
      #ap-cobro .ap-hero{display:block;margin:4px auto 6px;max-width:235px;width:52%;height:auto;filter:drop-shadow(0 14px 26px rgba(0,0,0,.55))}
      #ap-cobro .ap-title{font-size:clamp(23px,4.2vw,36px);font-weight:900;letter-spacing:-.5px;margin:0 0 12px;text-shadow:0 2px 0 rgba(0,0,0,.4),0 5px 14px rgba(0,0,0,.55)}
      #ap-cobro .ap-title .g{color:var(--gold,#E8B84B);text-shadow:0 2px 0 rgba(120,80,0,.5),0 6px 18px rgba(232,184,75,.25)}
      #ap-cobro .ap-intro{font-size:14px;color:#c9d2dc;line-height:1.6;max-width:630px;margin:0 auto 18px}
      #ap-cobro .ap-planes{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:760px;margin:0 auto 20px;text-align:center}
      #ap-cobro .ap-plan{position:relative;display:flex;flex-direction:column;text-align:center;font-family:inherit;background:linear-gradient(135deg,rgba(20,26,33,.92),rgba(10,14,18,.94));border:1px solid #232b36;border-radius:16px;padding:22px 18px 18px;cursor:pointer;transition:border-color .14s,box-shadow .14s}
      #ap-cobro .ap-plan:hover{border-color:#3a4552}
      #ap-cobro .ap-plan.top{border-color:rgba(232,184,75,.42)}
      #ap-cobro .ap-plan.sel{border-color:var(--gold,#E8B84B);box-shadow:0 12px 36px rgba(232,184,75,.14)}
      #ap-cobro .ap-badge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:linear-gradient(180deg,#f4d089,#E8B84B 60%,#cf9f2e);color:#241900;font-size:9.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;padding:4px 12px;border-radius:100px;white-space:nowrap;box-shadow:0 3px 10px rgba(232,184,75,.3)}
      #ap-cobro .ap-plan-n{font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#a7b0bb;margin-bottom:10px}
      #ap-cobro .ap-plan-price{display:flex;align-items:baseline;justify-content:center;gap:4px;margin-bottom:2px}
      #ap-cobro .ap-plan-amt{font-size:36px;font-weight:900;line-height:1;color:#E8B84B;background:linear-gradient(180deg,#fdeeb0 0%,#e9c468 33%,#d8a736 58%,#ad7b20 82%,#edcd79 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))}
      #ap-cobro .ap-plan-u{font-size:11.5px;color:#8b96a3;margin-bottom:13px}
      #ap-cobro .ap-plan-d{font-size:12.5px;line-height:1.5;color:#c4ccd4;flex:1}
      #ap-cobro .ap-plan-pick{margin-top:15px;text-align:center;font-size:12px;font-weight:800;color:#8b96a3;border:1px solid #2b3340;border-radius:10px;padding:9px}
      #ap-cobro .ap-plan.sel .ap-plan-pick{color:var(--gold,#E8B84B);border-color:rgba(232,184,75,.55);background:rgba(232,184,75,.08)}
      #ap-cobro .ap-pay{display:flex;align-items:center;justify-content:center;gap:12px;margin:0 auto 20px}
      #ap-cobro .ap-pay-lbl{font-size:12.5px;color:#8b96a3;font-weight:700}
      #ap-cobro .ap-seg{display:inline-flex;background:#10151c;border:1px solid #2b3340;border-radius:11px;padding:3px;gap:3px}
      #ap-cobro .ap-cur{background:transparent;border:none;color:#9aa6b2;font-weight:800;font-size:13px;padding:8px 20px;border-radius:8px;cursor:pointer}
      #ap-cobro .ap-cur.on{background:#1f2730;color:#eaecef}
      #ap-cobro .ap-cta{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-width:230px;padding:15px 40px;border:1px solid var(--gold-md,#cf9f2e);border-radius:13px;background:linear-gradient(180deg,#f4d089,#E8B84B 55%,#cf9f2e);color:#241900;font-family:inherit;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 5px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4)}
      #ap-cobro .ap-cta:active{transform:translateY(3px);box-shadow:0 2px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4)}
      #ap-cobro .ap-msg{font-size:13px;color:#9aa6b2;margin-top:14px;min-height:18px}
      @media(max-width:640px){
        #ap-cobro .ap-planes{grid-template-columns:1fr;max-width:400px;gap:11px}
        #ap-cobro .ap-plan{padding:18px 16px 16px}
        #ap-cobro .ap-cta{width:100%;max-width:400px}
      }
    </style>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => { ov.style.visibility = 'visible'; });

  const $ = (sel) => ov.querySelector(sel);
  let planSel = 'anio';   // anual por defecto (el recomendado)
  let curSel  = 'usdt';

  const pintarPlan = () => ov.querySelectorAll('.ap-plan').forEach((b) => {
    const on = b.dataset.plan === planSel;
    b.classList.toggle('sel', on);
    const pick = b.querySelector('.ap-plan-pick');
    if (pick) pick.textContent = on ? 'Selected' : 'Select';
  });
  const pintarCur = () => ov.querySelectorAll('.ap-cur').forEach((b) => b.classList.toggle('on', b.dataset.cur === curSel));
  const refrescarPago = () => { $('#ap-pay').style.display = (planSel === 'free') ? 'none' : 'flex'; };
  const etiquetaCTA = () => {
    if (planSel === 'free') return yaUso ? 'Free session already used' : 'Start free session';
    const p = PLANES.find((x) => x.id === planSel);
    return 'Pay ' + p.amt + ' with ' + curSel.toUpperCase();
  };
  const pintarCTA = () => {
    const btn = $('#ap-cta');
    btn.textContent = etiquetaCTA();
    const bloq = (planSel === 'free' && yaUso);
    btn.style.opacity = bloq ? '.55' : '';
    btn.style.cursor = bloq ? 'default' : 'pointer';
  };
  const refrescar = () => { pintarPlan(); pintarCur(); refrescarPago(); pintarCTA(); };
  refrescar();

  const msg = (t) => { const e = $('#ap-msg'); if (e) e.textContent = t || ''; };
  const cerrar = () => { try { ov.remove(); } catch (_) {} };
  $('#ap-back').onclick = cerrar;

  ov.querySelectorAll('.ap-plan').forEach((b) => b.onclick = () => { planSel = b.dataset.plan; refrescar(); });
  ov.querySelectorAll('.ap-cur').forEach((b) => b.onclick = () => { curSel = b.dataset.cur; refrescar(); });

  async function comprar(planNum) {
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    if (!cuenta) { msg('Connect your wallet first.'); return; }
    try {
      msg('Confirm in your wallet.');
      const signer = await _signer(wallet, ethers);
      const c = new (ethers.Contract)(ANALISIS_ADDR, ABI, signer);
      if (curSel === 'usdt') {
        const costo = await c.precioToken(planNum, USDT_ADDR);
        const usdt = new (ethers.Contract)(USDT_ADDR, ABI_USDT, signer);
        const perm = await usdt.allowance(cuenta, ANALISIS_ADDR);
        if (perm < costo) { msg('Approving USDT.'); await (await usdt.approve(ANALISIS_ADDR, costo)).wait(); }
        msg('Processing payment.');
        await (await c.comprarAcceso(planNum, USDT_ADDR)).wait();
      } else {
        const costo = await c.precioToken(planNum, BNB_ADDR);
        msg('Processing payment.');
        await (await c.comprarAcceso(planNum, BNB_ADDR, { value: costo })).wait();
      }
      msg('Access granted.');
      cerrar(); if (onPagado) onPagado();
    } catch (e) { msg('Payment failed: ' + (e && e.shortMessage ? e.shortMessage : 'cancelled')); }
  }

  async function prueba() {
    if (yaUso) return;
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    if (!cuenta) { msg('Connect your wallet first.'); return; }
    try {
      msg('Confirm in your wallet.');
      const signer = await _signer(wallet, ethers);
      const c = new (ethers.Contract)(ANALISIS_ADDR, ABI, signer);
      await (await c.pruebaGratis()).wait();
      msg('Your free session has started.');
      cerrar(); if (onPagado) onPagado();
    } catch (e) { msg('Could not start session: ' + (e && e.shortMessage ? e.shortMessage : 'already used')); }
  }

  $('#ap-cta').onclick = () => {
    if (planSel === 'free') return prueba();
    const p = PLANES.find((x) => x.id === planSel);
    return comprar(p.plan);
  };
}
