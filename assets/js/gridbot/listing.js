/* listing.js — Panel "List your token" que se despliega al lado del Swap.
   Dos vistas: formulario (aún no listó) y lista de tokens listados (ya listó).
   Estilo idéntico al swap (mismo fondo, dorado, glass). Web y base para móvil. */
import * as mercado from './mercado.js?v=3';
import * as flogos from './firebase-logos.js?v=2';
import * as wallet from '../wallet.js?v=125';
import * as ethers from '../vendor/ethers-6.13.4.min.js?v=125';

const $ = (id) => document.getElementById(id);
let _css = false;

/* ─────────── CSS (mismo lenguaje visual del swap) ─────────── */
function inyectarCSS() {
  if (_css) return; _css = true;
  const s = document.createElement('style'); s.id = 'lt-css';
  s.textContent = `
  #lt-panel{position:relative;width:100%;max-width:720px;display:flex;flex-direction:column;background:linear-gradient(180deg,#171d25,#0d1117);border:1px solid var(--line);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.65),0 0 0 1px rgba(232,184,75,.06),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden}
  #lt-panel::after{content:"";position:absolute;inset:0;z-index:0;background-image:url('assets/portada/img/swap-bg.webp');background-size:cover;background-position:center;opacity:.12;filter:saturate(1.05);pointer-events:none}
  #lt-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.5}
  #lt-panel > *{position:relative;z-index:1}
  .lt-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 18px 8px}
  .lt-head-l{display:flex;align-items:center;gap:10px}
  .lt-back{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--ink-2);display:grid;place-items:center;cursor:pointer;flex:none}
  .lt-back:hover{border-color:var(--gold-soft);color:var(--gold)}
  .lt-title{font-family:var(--display);font-weight:700;font-size:18px;color:var(--ink)}
  .lt-how{display:inline-flex !important;align-items:center;gap:5px;background:rgba(232,184,75,.1) !important;border:1px solid var(--gold-soft) !important;color:var(--gold) !important;border-radius:10px !important;padding:6px 11px !important;font-size:11.5px;font-weight:700;cursor:pointer;font-family:var(--display);white-space:nowrap}
  .lt-how svg{stroke:var(--gold)}
  .lt-body{padding:0 18px 14px;flex:1;display:flex;flex-direction:column;justify-content:center;overflow-y:auto}
  .lt-grid{display:grid;grid-template-columns:112px 1fr;gap:13px;margin-bottom:10px}
  @media(max-width:560px){ .lt-grid{grid-template-columns:1fr;gap:12px} }
  /* dropzone imagen */
  .lt-drop{border:1.5px dashed var(--line);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 10px;cursor:pointer;text-align:center;background:rgba(11,14,17,.5);transition:.15s;min-height:132px}
  .lt-drop:hover{border-color:var(--gold-soft)}
  .lt-drop .lt-av{width:52px;height:52px;border-radius:50%;background:linear-gradient(180deg,#232b34,#151b22);display:grid;place-items:center;position:relative;color:var(--ink-3)}
  .lt-drop .lt-plus{position:absolute;right:-3px;bottom:-3px;width:22px;height:22px;border-radius:50%;background:linear-gradient(180deg,#f7db8d,var(--gold) 60%,#c79426);color:#241900;display:grid;place-content:center;font-weight:800;font-size:16px;line-height:0;border:2px solid #0d1117}
  .lt-drop img{width:52px;height:52px;border-radius:50%;object-fit:cover;border:1px solid var(--gold-soft)}
  .lt-drop b{font-size:12.5px;color:var(--ink-2)}
  .lt-drop span{font-size:10.5px;color:var(--ink-3)}
  .lt-fields{display:flex;flex-direction:column;gap:9px}
  .lt-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:560px){ .lt-two{grid-template-columns:1fr} }
  .lt-f label{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--ink-3);margin:0 2px 6px}
  .lt-req{color:var(--gold);font-weight:700}
  .lt-i{width:14px;height:14px;border-radius:50%;border:1px solid rgba(150,165,180,.28);background:none;color:rgba(150,165,180,.45);font-size:9px;font-style:italic;font-weight:700;cursor:pointer;display:inline-grid;place-items:center;padding:0;opacity:.7}
  .lt-i:hover{border-color:var(--gold) !important;color:var(--gold) !important;opacity:1 !important}
  .lt-inp{width:100%;box-sizing:border-box;background:rgba(11,14,17,.72);border:1px solid var(--line);border-radius:11px;padding:9px 12px;color:var(--ink);font-family:var(--display);font-size:14px;outline:none}
  .lt-inp:focus{border-color:var(--gold-soft) !important;background:rgba(11,14,17,.72) !important;color:var(--ink) !important}
  .lt-inp:-webkit-autofill,.lt-inp:-webkit-autofill:hover,.lt-inp:-webkit-autofill:focus{
    -webkit-text-fill-color:var(--ink) !important;
    -webkit-box-shadow:0 0 0 1000px rgba(11,14,17,.95) inset !important;
    caret-color:var(--ink) !important;transition:background-color 9999s ease-in-out 0s}
  .lt-inp::placeholder{color:var(--ink-3);opacity:.6}
  .lt-price-wrap{display:flex;gap:8px;align-items:stretch}
  .lt-price-wrap .lt-inp{flex:1 1 auto;min-width:60px}
  .lt-bnbtag{display:inline-flex;align-items:center;gap:4px;background:rgba(11,14,17,.72);border:1px solid var(--line);border-radius:12px;padding:0 8px;font-size:10.5px;font-weight:600;color:var(--ink-3);white-space:nowrap;flex:0 0 auto}
  .lt-bnbtag img{width:15px;height:15px}
  .lt-bnbtag img{width:18px;height:18px}
  /* opción de impacto */
  .lt-imp{margin-bottom:10px}
  .lt-imp-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .lt-opt{background:rgba(11,14,17,.6);border:1px solid var(--line);border-radius:11px;padding:9px 12px;cursor:pointer}
  .lt-opt.on{border-color:var(--gold);background:rgba(232,184,75,.05)}
  .lt-opt .lt-opt-t{display:flex;align-items:center;gap:7px}
  .lt-opt .lt-dot{width:13px;height:13px;border-radius:50%;border:2px solid var(--line);flex:none}
  .lt-opt.on .lt-dot{border-color:var(--gold);background:radial-gradient(circle,var(--gold) 40%,transparent 46%)}
  .lt-opt b{font-size:12.5px;color:var(--ink)} .lt-opt p{font-size:10.5px;color:var(--ink-3);margin:5px 0 0;line-height:1.35}
 .lt-imp-slider.show{display:block}
  .lt-cta:disabled{opacity:.5;cursor:default;box-shadow:none;filter:grayscale(.3)}
  .lt-cta{width:100%;margin-top:0;padding:12px;border-radius:14px;cursor:pointer;font-family:var(--display);font-weight:800;font-size:15px;
    background:linear-gradient(180deg,#3ddc84,#22c55e 46%,#16a34a) !important;
    border:1px solid #15803d !important;color:#052e13 !important;
    box-shadow:0 4px 0 #15803d,inset 0 1px 0 rgba(255,255,255,.35) !important;
    text-shadow:0 1px 0 rgba(255,255,255,.2) !important}
  .lt-cta:not(:disabled):hover{filter:brightness(1.05)}
  .lt-cta:not(:disabled):active{transform:translateY(4px);box-shadow:0 1px 0 #15803d,0 3px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.35) !important}
  .lt-cta:disabled{opacity:.5;cursor:not-allowed;filter:grayscale(.3)}
  .lt-msg{font-size:12px;color:#f8b34b;background:rgba(248,179,75,.08);border:1px solid rgba(248,179,75,.25);border-radius:10px;padding:10px 12px;margin-bottom:10px;text-align:center;display:none}
  /* lista de tokens listados */
  .lt-list{display:flex;flex-direction:column;gap:12px}
  .lt-card{background:rgba(11,14,17,.6);border:1px solid var(--line);border-radius:16px;padding:14px}
  .lt-card-top{display:flex;align-items:center;gap:12px;margin-bottom:12px}
  .lt-card-logo{width:46px;height:46px;border-radius:50%;object-fit:cover;flex:none;border:1px solid var(--gold-soft)}
  .lt-card-logo.ph{background:linear-gradient(180deg,#232b34,#151b22);display:grid;place-items:center;color:var(--ink-3);font-weight:800;font-size:15px}
  .lt-card-info{flex:1;min-width:0}
  .lt-card-name{display:flex;align-items:center;gap:8px}
  .lt-card-name b{font-size:15px;color:var(--ink)} .lt-card-sym{font-size:12px;color:var(--ink-3)}
  .lt-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(46,232,106,.14);color:#39e07a;border:1px solid rgba(46,232,106,.4);border-radius:100px;padding:2px 9px;font-size:10.5px;font-weight:700}
  .lt-badge .lt-bdot{width:6px;height:6px;border-radius:50%;background:#39e07a}
  .lt-contract{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ink-3);margin-top:3px;font-family:var(--mono)}
  .lt-copy{background:none;border:0;color:var(--ink-3);cursor:pointer;padding:2px}
  .lt-copy:hover{color:var(--gold)}
  .lt-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .lt-stat{background:rgba(8,11,15,.6);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
  .lt-stat .lt-sl{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--ink-3)}
  .lt-stat .lt-sv{font-size:15px;font-weight:800;color:var(--ink);margin-top:5px;font-variant-numeric:tabular-nums}
  .lt-card-foot{margin-top:12px;display:flex;gap:8px}
  .lt-card-foot .lt-mini{flex:1;padding:10px;border-radius:11px;border:1px solid var(--gold-soft);background:rgba(232,184,75,.06);color:var(--gold);font-weight:700;font-size:12.5px;cursor:pointer}
  .lt-card-foot .lt-mini.green{border-color:rgba(46,232,106,.4);background:rgba(46,232,106,.1);color:#39e07a}
  .lt-del{width:100%;margin-top:8px;padding:9px;border-radius:10px;border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.06);color:#f87171;font-weight:700;font-size:12px;cursor:pointer;font-family:var(--display)}
  .lt-del:hover{background:rgba(248,113,113,.12)}
  .lt-empty{text-align:center;color:var(--ink-3);font-size:12.5px;padding:30px 10px}
  /* tooltip info */
  #lt-tip::backdrop{background:rgba(3,5,8,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  #lt-tip .lt-tbx{max-width:440px;width:100%;background:#0e151c;border:1px solid #2c3946;border-radius:16px;padding:24px 22px;position:relative;max-height:82vh;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}
  #lt-tip .lt-tbx::-webkit-scrollbar{display:none;width:0}
  #lt-tip .lt-tbx p{margin:0;font-size:13px;line-height:1.6;color:#d4dbe4}
  #lt-tip .lt-tbx > p:first-child{padding-right:34px}
  #lt-tip .lt-tx{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid #2c3946;color:#aab6c4;cursor:pointer;z-index:2;font-size:13px}
  @media(max-width:560px){
    .lt-drop{flex-direction:row !important;justify-content:flex-start;gap:12px;min-height:0 !important;padding:12px 14px !important;text-align:left}
    .lt-drop .lt-av{width:44px !important;height:44px !important}
    .lt-drop img{width:44px !important;height:44px !important}
    .lt-drop b{font-size:12.5px}
    .lt-drop span{font-size:10px}
  }
  @media(max-width:560px){
    .lt-head{padding:14px 14px 8px;flex-wrap:nowrap;gap:8px}
    .lt-title{font-size:16px}
    .lt-how{padding:5px 9px !important;font-size:11px;border-radius:9px !important}
    .lt-head-l{min-width:0;flex:1}
    .lt-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  }
  `;
  document.head.appendChild(s);
}

export { inyectarCSS };

/* ─────────── Textos de info (EN; el sistema los traduce a ES si el usuario cambia idioma) ─────────── */
const TIPS = {
  name: 'The public name of your token, shown to buyers. Required. Buyers can find your token by this name.',
  contract: 'The BNB Smart Chain contract address of your token (0x...). Required. This is the real token buyers will receive when they buy.',
  symbol: 'The short ticker of your token (e.g. SHIB). Optional. Helps buyers find and recognize it.',
  price: 'The price of ONE token, in US dollars. Buyers pay the equivalent in BNB at the moment of purchase. Example: if you set 2, each token costs the equivalent of $2 in BNB.',
  image: 'Upload a logo for your token (JPG, PNG, SVG, up to 2MB). It is automatically compressed to a small size without losing color or shape. Only for new tokens without an official logo.',
  impact: 'Choose how the price behaves as people buy. "Fixed price": every purchase pays the same price. "Price impact": the price rises as more of your supply is sold, so early buyers pay less. Buyers can only buy here, not sell here.'
};

/* ─────────── Reductor de imagen: redimensiona a ~64px y comprime a WebP a color ─────────── */
function reducirImagen(file, maxPx = 128) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('no es imagen'));
    if (file.size > 2 * 1024 * 1024) return reject(new Error('máx 2MB'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const escala = Math.min(1, maxPx / Math.max(width, height));
      width = Math.round(width * escala); height = Math.round(height * escala);
      const cv = document.createElement('canvas'); cv.width = width; cv.height = height;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      // WebP a color; si el navegador no lo soporta, usa JPEG. Re-comprime si sale grande.
      let q = 0.82;
      let dataUrl = cv.toDataURL('image/webp', q);
      if (dataUrl.indexOf('image/webp') < 0) dataUrl = cv.toDataURL('image/jpeg', q); // fallback
      // si pesa demasiado (por detalle), bajar calidad hasta caber bajo ~80KB
      while (dataUrl.length > 80000 && q > 0.4) { q -= 0.15; dataUrl = cv.toDataURL(dataUrl.indexOf('webp') >= 0 ? 'image/webp' : 'image/jpeg', q); }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no se pudo leer')); };
    img.src = url;
  });
}

/* Estado del formulario */
const F = { logo: '', tokenInfo: null, impacto: false, impactoBps: 500 };

const ICO = {
  img: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="m21 15-5-5L5 21"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  price: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  sold: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
  rem: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
  earn: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'
};
const BNB_LOGO = 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png';


/* Contenedor de tooltip como <dialog> (top layer): sale por ENCIMA de todo,
   incluso del listing en móvil (que también es un dialog). */
function _tipDialog(htmlInterno) {
  const prev = document.getElementById('lt-tip'); if (prev) { try { prev.close(); } catch (_) {} prev.remove(); }
  const dg = document.createElement('dialog'); dg.id = 'lt-tip';
  dg.style.cssText = 'margin:auto;padding:0;border:0;max-width:440px;width:calc(100vw - 36px);background:transparent;overflow:visible';
  dg.innerHTML = htmlInterno;
  document.body.appendChild(dg);
  if (dg.showModal) dg.showModal(); else dg.setAttribute('open', '');
  const cerrar = () => { try { dg.close(); } catch (_) {} dg.remove(); };
  dg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
  dg.addEventListener('click', (e) => { if (e.target === dg) cerrar(); });
  return { dg, cerrar };
}

function tip(clave) {
  const { cerrar } = _tipDialog(`<div class="lt-tbx"><button class="lt-tx" aria-label="Close">✕</button><p>${TIPS[clave] || ''}</p></div>`);
  const x = document.querySelector('#lt-tip .lt-tx'); if (x) x.onclick = cerrar;
}

/* ─────────── Render del formulario (aún no listó, o quiere listar otro) ─────────── */
function htmlFormulario() {
  const iBtn = (c) => `<button class="lt-i" data-tip="${c}" type="button">i</button>`;
  return `
  <div class="lt-grid">
    <div class="lt-drop" id="lt-drop">
      <div class="lt-av" id="lt-av">${ICO.img}<span class="lt-plus"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></div>
      <b>Upload token image</b>
      <span>JPG, PNG, SVG (max 2MB)</span>
      <input type="file" id="lt-file" accept="image/*" style="display:none">
    </div>
    <div class="lt-fields">
      <div class="lt-two">
        <div class="lt-f"><label>Token Name <span class="lt-req">*</span> ${iBtn('name')}</label><input class="lt-inp" id="lt-name" placeholder="Enter token name" autocomplete="off"></div>
        <div class="lt-f"><label>Token Contract <span class="lt-req">*</span> ${iBtn('contract')}</label><input class="lt-inp" id="lt-contract" placeholder="0x... (contract address)" autocomplete="off" spellcheck="false"></div>
      </div>
      <div class="lt-two">
        <div class="lt-f"><label>Token Symbol ${iBtn('symbol')}</label><input class="lt-inp" id="lt-symbol" placeholder="e.g. $ABC" autocomplete="off"></div>
        <div class="lt-f"><label>Token Price (USD) <span class="lt-req">*</span> ${iBtn('price')}</label>
          <div class="lt-price-wrap"><input class="lt-inp" id="lt-price" inputmode="decimal" placeholder="0.00"><span class="lt-bnbtag"><img src="${BNB_LOGO}" alt="">Paid in BNB</span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="lt-f" style="margin-bottom:4px"><label>How many tokens do you list for sale? <span class="lt-req">*</span></label><input class="lt-inp" id="lt-amount" inputmode="decimal" placeholder="e.g. 1000000"></div>
  <div class="lt-imp">
    <div class="lt-f"><label>Price behaviour ${iBtn('impact')}</label></div>
    <div class="lt-imp-row">
      <div class="lt-opt on" id="lt-fixed" data-imp="0"><div class="lt-opt-t"><span class="lt-dot"></span><b>Fixed price</b></div><p>Every purchase pays the same price you set.</p></div>
      <div class="lt-opt" id="lt-impact" data-imp="1"><div class="lt-opt-t"><span class="lt-dot"></span><b>Price impact</b></div><p>Price rises as more of your supply is sold.</p></div>
    </div>

  </div>
  <div class="lt-msg" id="lt-form-msg"></div>
  <button class="lt-cta" id="lt-list-btn" disabled>List Token</button>`;
}

/* ─────────── Render de la lista de tokens listados (ya listó) ─────────── */
function htmlLista(items) {
  if (!items.length) return `<div class="lt-empty">You haven't listed any token yet.</div>`;
  return `<div class="lt-list">${items.map(cardListado).join('')}</div>`;
}
function cardListado(L) {
  const corta = (a) => a ? a.slice(0, 6) + '…' + a.slice(-4) : '';
  const dec = 18;
  const enVenta = Number(mercado.fmt(L.enVenta, dec));
  const gan = Number(mercado.fmt(L.ganancia, 18));
  const logo = L.logo ? `<img class="lt-card-logo" src="${L.logo}" alt="">` : `<div class="lt-card-logo ph">${(L.simbolo || L.nombre || '?').slice(0, 3)}</div>`;
  return `
  <div class="lt-card" data-id="${L.id}">
    <div class="lt-card-top">
      ${logo}
      <div class="lt-card-info">
        <div class="lt-card-name"><b>${esc(L.nombre)}</b><span class="lt-badge"><span class="lt-bdot"></span>Listed</span></div>
        <div class="lt-card-sym">${L.simbolo ? esc(L.simbolo) : ''}</div>
        <div class="lt-contract">${corta(L.token)}<button class="lt-copy" data-copy="${L.token}" title="Copy">${ICO.copy}</button></div>
      </div>
    </div>
    <div class="lt-stats">
      <div class="lt-stat"><div class="lt-sl">${ICO.rem} Tokens remaining</div><div class="lt-sv">${enVenta.toLocaleString('en-US', {maximumFractionDigits:4})}</div></div>
      <div class="lt-stat"><div class="lt-sl">${ICO.earn} Earnings</div><div class="lt-sv">${gan.toLocaleString('en-US', {maximumFractionDigits:6})} BNB</div></div>
    </div>
    <div class="lt-card-foot">
      <button class="lt-mini green" data-claim="${L.id}">Withdraw earnings</button>
      <button class="lt-mini" data-withdraw="${L.id}">Withdraw tokens</button>
    </div>
    <button class="lt-del" data-del="${L.id}">Delete listing</button>
  </div>`;
}
function esc(s) { return String(s || '').replace(/[<>&"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c])); }

export { htmlFormulario, htmlLista, reducirImagen, tip, F };

/* ═══════════════════════ Montaje y lógica del panel ═══════════════════════ */

const cuenta = () => { try { return wallet.cuentaActual(); } catch (_) { return null; } };

/** Monta el panel dentro de un contenedor dado. Detecta si la wallet ya listó. */
export async function montarListing(cont, opts = {}) {
  inyectarCSS();
  cont.innerHTML = `
  <div id="lt-panel">
    <div class="lt-head">
      <div class="lt-head-l">
        ${opts.back ? `<button class="lt-back" id="lt-back" aria-label="Back"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg></button>` : ''}
        <span class="lt-title" id="lt-title">List Your Token</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="lt-how" id="lt-how">How it works</button>
        <button class="lt-how" id="lt-toggle" style="display:none">My tokens</button>
      </div>
    </div>
    <div class="lt-body" id="lt-body"></div>
  </div>`;
  // eventos de cabecera
  const back = $('lt-back'); if (back && opts.onBack) back.onclick = opts.onBack;
  $('lt-how').onclick = () => tipComo();
  cont.addEventListener('click', (e) => {
    const ib = e.target.closest && e.target.closest('.lt-i'); if (ib) { tip(ib.dataset.tip); return; }
    const cp = e.target.closest && e.target.closest('.lt-copy'); if (cp) { copiar(cp.dataset.copy); return; }
    const cl = e.target.closest && e.target.closest('[data-claim]'); if (cl) { accionClaim(+cl.dataset.claim); return; }
    const wd = e.target.closest && e.target.closest('[data-withdraw]'); if (wd) { accionWithdraw(+wd.dataset.withdraw); return; }
    const dl = e.target.closest && e.target.closest('[data-del]'); if (dl) { accionDelete(+dl.dataset.del); return; }
  });
  await refrescar();
}

/** Decide qué vista mostrar: formulario o lista de listados. */
async function refrescar() {
  const body = $('lt-body'); if (!body) return;
  const c = cuenta();
  const toggle = $('lt-toggle');
  if (!c) { body.innerHTML = htmlFormulario(); wireFormulario(); if (toggle) toggle.style.display = 'none'; return; }
  let mis = [];
  try { mis = await mercado.misListados(c); } catch (_) {}
  const activos = mis.filter(m => m.activo);
  // Cargar los logos desde Firestore para los tokens que no traen logo on-chain.
  try {
    const addrs = activos.map(m => m.token);
    const logos = await flogos.leerLogos(addrs);
    activos.forEach(m => { if (!m.logo) { const l = logos[m.token.toLowerCase()]; if (l) m.logo = l; } });
  } catch (_) {}
  _misTokens = activos;
  if (activos.length > 0) {
    verLista();
  } else {
    if (toggle) toggle.style.display = 'none';
    $('lt-title').textContent = 'List Your Token';
    body.innerHTML = htmlFormulario(); wireFormulario();
  }
}
let _misTokens = [];
/* Ver la lista de mis tokens listados. */
function verLista() {
  const body = $('lt-body'); const toggle = $('lt-toggle'); if (!body) return;
  $('lt-title').textContent = 'Your Listed Token' + (_misTokens.length > 1 ? 's' : '');
  if (toggle) toggle.style.display = 'none';  // ya estás viendo la lista
  body.innerHTML = htmlLista(_misTokens) + `<button class="lt-cta" id="lt-add" style="margin-top:14px">List another token</button>`;
  $('lt-add').onclick = () => verFormulario();
}
/* Ver el formulario para listar otro (con botón "My tokens" para volver). */
function verFormulario() {
  const body = $('lt-body'); const toggle = $('lt-toggle'); if (!body) return;
  $('lt-title').textContent = 'List Your Token';
  if (toggle && _misTokens.length > 0) { toggle.style.display = 'inline-flex'; toggle.onclick = () => verLista(); }
  body.innerHTML = htmlFormulario(); wireFormulario();
}

/* ─────────── Eventos del formulario ─────────── */
function wireFormulario() {
  F.logo = ''; F.tokenInfo = null; F.impacto = false; F.impactoBps = 500;
  const drop = $('lt-drop'), file = $('lt-file');
  if (drop && file) {
    drop.onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      try {
        const dataUrl = await reducirImagen(f);
        F.logo = dataUrl;
        $('lt-av').outerHTML = `<img id="lt-av" src="${dataUrl}" alt="">`;
      } catch (err) { formMsg('Image: ' + err.message); }
    };
  }
  // contrato → autocompletar nombre/símbolo
  const cAddr = $('lt-contract');
  if (cAddr) cAddr.onblur = async () => {
    const v = cAddr.value.trim();
    if (!mercado.esDireccion(v)) return;
    try {
      const info = await mercado.infoToken(v);
      F.tokenInfo = info;
      if ($('lt-name') && !$('lt-name').value) $('lt-name').value = info.nombre || '';
      if ($('lt-symbol') && !$('lt-symbol').value) $('lt-symbol').value = info.simbolo || '';
      validar();
    } catch (_) { formMsg('Could not read that contract. Check the address.'); F.tokenInfo = null; }
  };
  // opciones de impacto
  const fixed = $('lt-fixed'), impact = $('lt-impact');
  if (fixed && impact) {
    fixed.onclick = () => { F.impacto = false; fixed.classList.add('on'); impact.classList.remove('on'); };
    impact.onclick = () => { F.impacto = true; impact.classList.add('on'); fixed.classList.remove('on'); };
  }

  // validación en vivo
  ['lt-name','lt-contract','lt-price','lt-amount'].forEach(id => { const e = $(id); if (e) e.oninput = validar; });
  $('lt-list-btn').onclick = listar;
  validar();
}

function validar() {
  const btn = $('lt-list-btn'); if (!btn) return;
  const nombre = ($('lt-name') || {}).value || '';
  const addr = ($('lt-contract') || {}).value || '';
  const precio = parseFloat(($('lt-price') || {}).value || '0');
  const cant = parseFloat(($('lt-amount') || {}).value || '0');
  const completo = nombre.trim() && mercado.esDireccion(addr) && precio > 0 && cant > 0;
  // Solo mostramos MENSAJE para errores reales, no por campos aún vacíos.
  let err = '';
  if (addr && !mercado.esDireccion(addr)) err = 'That contract address is not valid.';
  else if (addr && CONOCIDOS.has(addr.toLowerCase())) err = 'This is an established token and cannot be listed here. Only new tokens are allowed.';
  formMsg(err);
  btn.disabled = !completo || !!err;
}
function formMsg(t) { const m = $('lt-form-msg'); if (!m) return; if (t) { m.textContent = t; m.style.display = 'block'; } else m.style.display = 'none'; }

/* Lista negra de contratos conocidos (anti-estafa). Ampliable. */
const CONOCIDOS = new Set([
  '0x55d398326f99059ff775485246999027b3197955', // USDT
  '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c', // BTCB
  '0x2170ed0880ac9a755fd29b2688956bd959f933f8', // ETH
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', // WBNB
  '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', // DAI
  '0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe', // XRP
  '0xba2ae424d960c26247dd6c32edc70b295c744c43', // DOGE
  '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', // CAKE
  '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd', // LINK
  '0x7083609fce4d1d8dc0c979aab8c869ea2c873402', // DOT
  '0xce7de646e7208a4ef112cb6ed5038fa6cc6b12e3', // TRX
  '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47', // ADA
  '0x1ce0c2827e2ef14d5c4f29a091d735a204794041', // AVAX
  '0x4338665cbb7b2485a8855a139b75d5e34ab0db94', // LTC
  '0x8ff795a6f4d97e7887c79bea79aba5cc76444adf', // BCH
  '0xc748673057861a797275cd8a068abb95a902e8de'  // BabyDoge
]);

/* ─────────── Acción: LISTAR ─────────── */
async function listar() {
  if (!cuenta()) { try { await wallet.conectar?.(); } catch (_) {} if (!cuenta()) return; }
  const btn = $('lt-list-btn'); btn.disabled = true; btn.textContent = 'Preparing…';
  try {
    const addr = ethers.getAddress($('lt-contract').value.trim());
    const nombre = $('lt-name').value.trim();
    const simbolo = ($('lt-symbol').value || '').trim();
    const precioUSD = parseFloat($('lt-price').value);
    const cantHuman = $('lt-amount').value.trim();
    // info del token (decimales)
    let dec = 18; if (F.tokenInfo && F.tokenInfo.decimals != null) dec = F.tokenInfo.decimals; else { try { dec = (await mercado.infoToken(addr)).decimals; } catch (_) {} }
    const cantidadBI = mercado.parse(cantHuman, dec);
    const precioBNB = await precioUSDaBNB(precioUSD);       // precio por token en BNB (18 dec)
    // ¿La wallet lista gratis? (owner/admin no paga los $25).
    const admin = await mercado.esAdmin(cuenta());
    const { bnb: costoBNB } = await mercado.costoListar();  // costo de listar ($25 en BNB)
    const valueBNB = admin ? 0n : costoBNB;                 // admin => 0; usuario => $25
    // aprobar el token
    btn.textContent = 'Approve token…';
    const alw = await mercado.allowance(addr, cuenta());
    if (alw < cantidadBI) { await mercado.aprobar(addr, cantidadBI); }
    // listar. El logo NO va on-chain (va a Firestore).
    btn.textContent = 'Confirm listing…';
    await mercado.listar({ token: addr, nombre, simbolo, logo: '', cantidadBI, precioBI: precioBNB, valueBNB });
    // Guardar el logo comprimido en Firestore (si el usuario subió uno).
    if (F.logo) { try { await flogos.guardarLogo(addr, F.logo); } catch (_) {} }
    btn.textContent = 'Listed';
    await refrescar();
  } catch (e) { btn.disabled = false; btn.textContent = 'List Token'; formMsg(traducirError(e)); }
}

/* Convierte un precio en USD a BNB (18 dec) usando el oráculo del sistema. */
async function precioUSDaBNB(usd) {
  // usamos el oráculo vía un contrato mínimo. Reusamos el RPC de mercado.js.
  const orac = new ethers.Contract('0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3', ['function precioUSD(address) view returns (uint256)'], new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org', 56, { staticNetwork: true }));
  const pBNB = await orac.precioUSD('0x0000000000000000000000000000000000000000'); // USD por 1 BNB (18 dec)
  if (pBNB === 0n) throw new Error('No price feed');
  // precio del token en BNB = usd / precioBNB
  return (mercado.parse(String(usd), 18) * (10n ** 18n)) / pBNB;
}

/* ─────────── Acciones de la lista ─────────── */
async function accionClaim(id) {
  try {
    const falta = await mercado.faltaCandado(id);
    if (falta > 0n) { const dias = Math.ceil(Number(falta) / 86400); alertBonito(`Your earnings are protected for ${dias} more day(s). This safety lock lasts 30 days from listing, to protect buyers. After that you can withdraw freely.`); return; }
    await mercado.retirarGanancia(id); await refrescar();
  } catch (e) { alertBonito(traducirError(e)); }
}
async function accionDelete(id) {
  confirmar(
    'Delete this listing?',
    'Your remaining tokens will be sent back to your wallet and the listing will be removed. If you still have earnings, withdraw them first.',
    async () => {
      try {
        const L = await mercado.misListados(cuenta());
        const item = L.find(x => x.id === id); if (!item) return;
        // si hay ganancia disponible y el candado ya pasó, avisamos que primero retire
        if (item.ganancia > 0n) {
          const falta = await mercado.faltaCandado(id);
          if (falta > 0n) { const dias = Math.ceil(Number(falta)/86400); alertBonito(`You still have earnings, but they are locked for ${dias} more day(s). You can delete the listing after withdrawing them.`); return; }
          alertBonito('You still have earnings on this listing. Please withdraw your earnings first, then delete.'); return;
        }
        if (item.enVenta > 0n) { await mercado.retirarTokens(id, item.enVenta); }
        await refrescar();
      } catch (e) { alertBonito(traducirError(e)); }
    }
  );
}
async function accionWithdraw(id) {
  try {
    const L = await mercado.misListados(cuenta());
    const item = L.find(x => x.id === id); if (!item) return;
    await mercado.retirarTokens(id, item.enVenta); await refrescar();
  } catch (e) { alertBonito(traducirError(e)); }
}

/* ─────────── Utilidades ─────────── */
function copiar(t) { try { navigator.clipboard.writeText(t); } catch (_) {} }
function traducirError(e) {
  const m = (e && (e.reason || e.message) || '').toLowerCase();
  if (m.includes('user rejected') || m.includes('denied')) return 'You cancelled the transaction.';
  if (m.includes('bloqueados')) return 'Earnings are locked for 30 days after listing.';
  if (m.includes('insufficient') || m.includes('exceeds balance')) return 'Not enough BNB in your wallet.';
  return 'Something went wrong. Please try again.';
}
function tipComo() {
  const html = `<div class="lt-tbx"><button class="lt-tx" aria-label="Close">✕</button><div style="font-size:13px;line-height:1.65;color:#d4dbe4">
    <div style="font-family:var(--display);font-weight:800;font-size:18px;color:#f3f6fa;margin:0 0 14px;text-align:center">List your token, your way</div>
    <p style="margin:0 0 14px">Created a token on BNB Smart Chain? You can put it up for sale here at the price you choose, even if it has no liquidity anywhere else. Buyers find it by name, symbol or contract, and pay you in BNB.</p>
    <div style="font-weight:700;color:var(--gold);margin-bottom:6px">How it works</div>
    <p style="margin:0 0 14px">Enter your token name, contract and the price you want per token. Send the amount you want to sell to the contract, and your listing goes live. When someone buys, they receive your real token and your earnings build up in BNB, ready to withdraw.</p>
    <div style="font-weight:700;color:var(--gold);margin-bottom:6px">What it costs</div>
    <p style="margin:0 0 14px">Listing costs $25, paid once in BNB. When you withdraw your earnings, a 5% fee applies. Nothing else.</p>
    <div style="font-weight:700;color:var(--gold);margin-bottom:6px">Why buying here is safe</div>
    <p style="margin:0 0 14px">Two protections guard every buyer. First, anyone who buys can return their tokens and get their BNB back, and only the same wallet that bought can do it. Second, your earnings stay locked for 30 days after you list, shown by a visible countdown, so buyers always have time and a way out. This is what makes an open marketplace trustworthy.</p>
    <div style="font-weight:700;color:var(--gold);margin-bottom:6px">Good to know</div>
    <p style="margin:0">These tokens are only swapped here, never traded in Futures or Spot. The platform does not endorse any listed token; each buyer decides for themselves.</p>
  </div></div>`;
  const { cerrar } = _tipDialog(html);
  const x = document.querySelector('#lt-tip .lt-tx'); if (x) x.onclick = cerrar;
}

function confirmar(titulo, texto, onSi) {
  const html = `<div class="lt-tbx"><button class="lt-tx" aria-label="Close">✕</button>
    <div style="font-family:var(--display);font-weight:800;font-size:17px;color:#f3f6fa;margin:6px 0 10px;text-align:center">${titulo}</div>
    <p style="margin:0 0 18px;text-align:center">${texto}</p>
    <div style="display:flex;gap:10px">
      <button id="lt-cf-no" style="flex:1;padding:12px;border-radius:11px;border:1px solid #2c3946;background:rgba(255,255,255,.04);color:#aab6c4;font-weight:700;cursor:pointer;font-family:var(--display)">Cancel</button>
      <button id="lt-cf-si" style="flex:1;padding:12px;border-radius:11px;border:1px solid rgba(248,113,113,.4);background:rgba(248,113,113,.12);color:#f87171;font-weight:800;cursor:pointer;font-family:var(--display)">Delete</button>
    </div></div>`;
  const { cerrar } = _tipDialog(html);
  document.querySelector('#lt-tip .lt-tx').onclick = cerrar;
  document.getElementById('lt-cf-no').onclick = cerrar;
  document.getElementById('lt-cf-si').onclick = () => { cerrar(); onSi(); };
}
function alertBonito(txt) {
  const { cerrar } = _tipDialog(`<div class="lt-tbx"><button class="lt-tx" aria-label="Close">✕</button><p>${txt}</p></div>`);
  const x = document.querySelector('#lt-tip .lt-tx'); if (x) x.onclick = cerrar;
}

/* ═══════════ Abrir el listado a pantalla completa (móvil, acceso directo) ═══════════ */
export function abrirListingMovil() {
  inyectarCSS();
  const prev = document.getElementById('lt-movil'); if (prev) prev.remove();
  const dg = document.createElement('dialog'); dg.id = 'lt-movil';
  dg.style.cssText = 'margin:0;padding:0;border:0;max-width:100vw;max-height:100vh;width:100vw;height:100vh;background:rgba(5,7,10,.96);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;color:inherit';
  dg.innerHTML = '<button id="lt-movil-x" aria-label="Close" style="position:fixed;top:calc(14px + env(safe-area-inset-top,0px));right:16px;z-index:5;width:36px;height:36px;border-radius:10px;background:rgba(14,21,28,.9);border:1px solid #202b37;color:#aab6c4;font-size:15px">✕</button><div style="box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;padding:calc(58px + env(safe-area-inset-top,0px)) 12px calc(70px + env(safe-area-inset-bottom,0px))"><div id="lt-movil-mount" style="width:100%"></div></div>';
  document.body.appendChild(dg);
  if (dg.showModal) dg.showModal(); else dg.setAttribute('open', '');
  const cerrar = () => { try { dg.close(); } catch (_) {} dg.remove(); };
  document.getElementById('lt-movil-x').onclick = cerrar;
  dg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
  montarListing(document.getElementById('lt-movil-mount'), {});
}
