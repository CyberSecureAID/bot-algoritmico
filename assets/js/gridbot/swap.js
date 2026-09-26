/* gridbot/swap.js — El swap (intercambio) sobre PancakeSwap V3: modal,
   cotización, balances, importar tokens por dirección, wrap/unwrap y
   ejecución. Sub-app autónoma. Recibe conectarWallet y cargarLogosPrecios
   por initSwap para no crear dependencias circulares con gridbot-ui. */

import * as gb from '../gridbot.js?v=129';
import * as wallet from '../wallet.js?v=125';
import { num, escT, moneda, enCristiano, fmtPrecioUSD, icoInner, modalBusy, modalError, limpiarBusy } from './util.js?v=1';
import { LOGOS, LOGO_ST } from './estado.js?v=1';
import { APP, BASES } from './config.js?v=1';
import { montarListing, inyectarCSS as inyectarListingCSS } from './listing.js?v=13';
import * as mercadoTK from './mercado.js?v=3';
import * as flogosTK from './firebase-logos.js?v=2';

const $ = (id) => document.getElementById(id);
let _conectarWallet = () => {}, _cargarLogosPrecios = () => {};
export function initSwap(conectarWallet, cargarLogosPrecios) { _conectarWallet = conectarWallet; _cargarLogosPrecios = cargarLogosPrecios; }

const WBNB_ADDR = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const WBNB_TOKEN = { id: 'WBNB', simbolo: 'WBNB', nombre: 'Wrapped BNB', address: WBNB_ADDR, decimals: 18, icono: 'W', color: '#F0B90B', cg: 'wbnb' };
function swMon(id) {
  if (id === 'WBNB') return WBNB_TOKEN;
  if (typeof id === 'string' && id.startsWith('0x')) return CUSTOM[id.toLowerCase()] || null;
  return moneda(id);
}
const CUSTOM = {};   // tokens importados por dirección: addrLower -> token
const LISTADOS = {};  // tokens listados en MercadoTokens: addrLower -> {id, precio, proteccionSeg, logo, ...}
let _impToken = 0;   // guarda de carrera para la importación
function swSyncWbnbLogo() { if (LOGOS['BNB'] && !LOGOS['WBNB']) LOGOS['WBNB'] = { img: LOGOS['BNB'].img, price: LOGOS['BNB'].price, chg: LOGOS['BNB'].chg }; }

const SWAP_IDS = [...new Set(['BNB', 'WBNB', 'USDT', 'USDC', ...BASES])];
/* Carga propia de logos/precios (para que el swap funcione en móvil sin depender
   de que gridbot-ui llame initSwap). Llena LOGOS con las imágenes de CoinGecko. */
async function swCargarLogosPropio() {
  if (LOGO_ST.cargando || LOGO_ST.ok) return;
  LOGO_ST.cargando = true;
  try {
    const ids = [...new Set(SWAP_IDS.map((id) => swMon(id)?.cg).filter(Boolean))];
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&per_page=250&price_change_percentage=24h`);
    if (!r.ok) throw new Error('cg');
    const arr = await r.json(); const byCg = {}; arr.forEach((c) => byCg[c.id] = c);
    SWAP_IDS.forEach((id) => { const c = byCg[swMon(id)?.cg]; if (c) LOGOS[id] = { img: c.image, price: c.current_price, chg: c.price_change_percentage_24h }; });
    swSyncWbnbLogo();
    LOGO_ST.ok = true;
    // re-pintar iconos y modal de monedas si están abiertos
    const tf=$('sw-tok-from'), tt=$('sw-tok-to'); if(tf) tf.innerHTML=swTokInner(swMon(S.fromId)); if(tt) tt.innerHTML=swTokInner(swMon(S.toId));
    if (window._cmRepintar) window._cmRepintar();
  } catch (_) {} finally { LOGO_ST.cargando = false; }
}
const S = { fromId: 'BNB', toId: 'USDT', amount: '', out: 0n, minOut: 0n, fee: 0, feeWei: 0n, allow: 0n, balFromWei: 0n, quoting: false, accion: 'swap', maxWei: null };
let _swT = null, _swToken = 0;
const SW_GAS_BUF = 3000000000000000n; // 0.003 BNB de colchón de gas al usar Máx con BNB

let _swCssOk = false;
function swInjectCSS() {
  if (_swCssOk) return; _swCssOk = true;
  const css = `
  #swap-modal{position:fixed;inset:0;z-index:230;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
  @media(max-width:1000px){ #swap-modal.lt-open{align-items:flex-start;padding-top:calc(12px + env(safe-area-inset-top,0px))} }
  #swap-modal .sw-wrap{display:flex;gap:16px;align-items:flex-start;justify-content:center;max-width:100%;flex-wrap:nowrap}
  #swap-modal .lt-slot{display:none;animation:cmPop .24s cubic-bezier(.2,.9,.3,1.2)}
  #swap-modal.lt-open .lt-slot{display:block}
  @media(max-width:1000px){ #swap-modal.lt-open .sw-box{display:none} }
  #swap-modal .sw-listbtn{display:inline-flex !important;align-items:center;gap:6px;background:linear-gradient(180deg,#3ddc84,#22c55e 55%,#16a34a) !important;border:0 !important;color:#052e13 !important;border-radius:100px !important;padding:7px 14px !important;font-size:12px;font-weight:800;cursor:pointer;box-shadow:0 2px 0 #12833f;margin-right:8px;white-space:nowrap;font-family:var(--display)}
  #swap-modal .sw-listbtn svg{stroke:#052e13}
  #swap-modal *{-webkit-tap-highlight-color:transparent}
  #swap-modal .sw-bg{position:absolute;inset:0;background:rgba(3,5,7,.72);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
  #swap-modal .sw-box{position:relative;width:100%;max-width:436px;background:linear-gradient(180deg,#171d25,#0d1117);border:1px solid var(--line);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.65),0 0 0 1px rgba(232,184,75,.06),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden;animation:cmPop .22s cubic-bezier(.2,.9,.3,1.2)}
  #swap-modal .sw-box::after{content:"";position:absolute;inset:0;z-index:0;background-image:url('assets/portada/img/swap-bg.webp');background-size:cover;background-position:center;opacity:.12;filter:saturate(1.05);pointer-events:none}
  #swap-modal .sw-box > *{position:relative;z-index:1}
  #swap-modal .sw-box::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.5}
  #swap-modal .sw-body{padding:2px 18px 20px}
  #swap-modal .sw-cards{position:relative}
  #swap-modal .sw-card{background:rgba(11,14,17,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:16px;padding:13px 15px}
  #swap-modal .sw-card+.sw-card{margin-top:10px}
  #swap-modal .sw-card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  #swap-modal .sw-lbl{font-family:var(--mono);font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.4px}
  #swap-modal .sw-bal{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
  #swap-modal .sw-card-mid{display:flex;align-items:center;gap:10px}
  #swap-modal .sw-amt{flex:1;min-width:0;background:transparent;border:none;outline:none;box-shadow:none;-webkit-appearance:none;appearance:none;color:var(--ink);font-family:var(--display);font-weight:700;font-size:26px;padding:0}
  #swap-modal .sw-amt::placeholder{color:var(--ink-3);opacity:.5}
  #swap-modal input.sw-amt:focus{outline:none;box-shadow:none;border:none;background:transparent}
  #swap-modal .sw-out{flex:1;min-width:0;color:var(--ink);font-family:var(--display);font-weight:700;font-size:26px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #swap-modal .sw-tok{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;background:linear-gradient(180deg,#1b2027,#12161c);border:1px solid var(--gold-soft);border-radius:100px;padding:6px 12px 6px 7px;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.06);transition:filter .12s,transform .08s}
  #swap-modal .sw-tok:hover{filter:brightness(1.12)}
  #swap-modal .sw-tok:active{transform:translateY(2px)}
  #swap-modal .sw-tok b{font-family:var(--display);font-size:15px;color:var(--ink);font-weight:700}
  #swap-modal .sw-tok .sw-chev{color:var(--gold);display:block;flex:0 0 auto}
  #swap-modal .sw-card-bot{display:flex;justify-content:space-between;align-items:center;margin-top:8px;min-height:17px}
  #swap-modal .sw-usd{font-family:var(--mono);font-size:11px;color:var(--ink-3)}
  #swap-modal .sw-max{font-family:var(--mono);font-size:11px;font-weight:700;color:#3a2800;background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);border:1px solid #c79426;border-radius:8px;padding:3px 9px;cursor:pointer;box-shadow:0 2px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4);letter-spacing:.5px}
  #swap-modal .sw-max:active{transform:translateY(2px);box-shadow:0 0 0 #8f6a1a}
  #swap-modal .sw-flip{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:12px;background:linear-gradient(180deg,#232a33,#141a20);border:2px solid #0d1117;color:var(--gold);cursor:pointer;display:grid;place-items:center;box-shadow:0 3px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.08);transition:transform .22s ease,filter .12s;z-index:3}
  #swap-modal .sw-flip:hover{filter:brightness(1.2)}
  #swap-modal .sw-flip:active{transform:translate(-50%,-50%) rotate(180deg)}
  #swap-modal .sw-info{margin:14px 2px 0;display:flex;flex-direction:column;gap:6px}
  #swap-modal .sw-info:empty{display:none}
  #swap-modal .sw-info .r{display:flex;justify-content:space-between;gap:10px;font-family:var(--mono);font-size:11.5px;color:var(--ink-2)}
  #swap-modal .sw-info .r span:first-child{color:var(--ink-3)}
  #swap-modal .sw-go{margin-top:16px;
    background:linear-gradient(180deg,#3ddc84,#22c55e 46%,#16a34a) !important;
    border:1px solid #15803d !important;color:#052e13 !important;
    box-shadow:0 4px 0 #15803d,inset 0 1px 0 rgba(255,255,255,.35) !important;
    text-shadow:0 1px 0 rgba(255,255,255,.2) !important}
  #swap-modal .sw-go:not(:disabled):hover{filter:brightness(1.05)}
  #swap-modal .sw-go:disabled{opacity:.5;cursor:not-allowed;filter:grayscale(.3)}
  #swap-modal .sw-go:not(:disabled):active{transform:translateY(4px);box-shadow:0 1px 0 #15803d,0 3px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.35) !important}
  #coin-modal .cm-import{padding:11px 14px;font-family:var(--mono);font-size:12px;color:var(--ink-3);display:flex;align-items:center;justify-content:center;gap:8px}
  #coin-modal .cm-import.err{color:#ff9090}
  #coin-modal .cm-import.ok{display:block;padding:0}
  #coin-modal .cm-imp-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(232,184,75,.25);border-top-color:var(--gold);animation:brspin .8s linear infinite;flex:0 0 auto}
  #coin-modal .cm-imp-badge{font-family:var(--mono);font-size:11px;font-weight:700;color:#3a2800;background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);border:1px solid #c79426;border-radius:8px;padding:4px 12px;box-shadow:0 2px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.4)}
  #swap-modal .sw-find{margin:0 18px 6px}
  #swap-modal .sw-find-bar{display:flex;align-items:center;gap:9px;padding:9px 12px;background:#0b0e11;border:1px solid var(--line);border-radius:12px;color:var(--ink-3);transition:border-color .14s,box-shadow .14s}
  #swap-modal .sw-find-bar:focus-within{border-color:var(--gold-soft);box-shadow:0 0 0 3px rgba(232,184,75,.08)}
  #swap-modal .sw-find-bar:focus-within svg{display:none}
  #swap-modal .sw-find-bar svg{flex:0 0 auto;opacity:.75}
  #swap-modal input.sw-find-inp{flex:1;min-width:0;background:transparent;border:none;outline:none;box-shadow:none;-webkit-appearance:none;appearance:none;color:var(--ink);font-family:var(--sans);font-size:12.5px}
  #swap-modal input.sw-find-inp:focus{outline:none;box-shadow:none}
  #swap-modal input.sw-find-inp::placeholder{color:var(--ink-3);opacity:.9}
  #swap-modal .sw-find-res{display:none;margin-top:6px;max-height:214px;overflow-y:auto;background:#0d1117;border:1px solid var(--line);border-radius:12px;padding:4px}
  #swap-modal .sw-find-res.open{display:block}
  #swap-modal .sw-find-row{display:flex;align-items:center;gap:11px;width:100%;padding:8px 10px;background:transparent;border:1px solid transparent;border-radius:10px;cursor:pointer;text-align:left;transition:background .12s,border-color .12s}
  #swap-modal .sw-find-row:hover{background:#1b222c;border-color:var(--line)}
  #swap-modal .sw-find-tx{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
  #swap-modal .sw-find-tx b{font-family:var(--display);color:var(--ink);font-size:14px;font-weight:700}
  #swap-modal .sw-find-tx i{font-style:normal;font-family:var(--mono);color:var(--ink-3);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #swap-modal .sw-find-usd{font-family:var(--mono);font-size:11px;color:var(--ink-3);flex:0 0 auto}
  #swap-modal .sw-find-go{margin-left:2px;font-family:var(--mono);font-size:11px;font-weight:700;color:#3a2800;background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426);border:1px solid #c79426;border-radius:7px;padding:3px 10px;flex:0 0 auto}
  #swap-modal .sw-find-msg{padding:10px 12px;font-family:var(--mono);font-size:12px;color:var(--ink-3);display:flex;align-items:center;justify-content:center;gap:8px}
  #swap-modal .sw-find-msg.err{color:#ff9090}
  /* Modal selector de monedas (faltaba su CSS de contenedor; por eso no se veía). */
  #coin-modal{position:fixed;inset:0;z-index:260;display:flex;align-items:center;justify-content:center;padding:16px}
  #coin-modal .coin-modal-bg{position:absolute;inset:0;background:rgba(3,5,7,.72);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
  #coin-modal .coin-modal-box{position:relative;width:100%;max-width:420px;max-height:80vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#171d25,#0d1117);border:1px solid var(--line);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.65),inset 0 1px 0 rgba(255,255,255,.06);overflow:hidden;animation:cmPop .22s cubic-bezier(.2,.9,.3,1.2)}
  #coin-modal .cm-head{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 10px}
  #coin-modal .cm-title{font-family:var(--display);font-weight:700;font-size:16px;color:var(--ink)}
  #coin-modal .cm-x{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--ink-2);display:grid;place-items:center;cursor:pointer;flex:0 0 auto}
  #coin-modal .cm-search{display:flex;align-items:center;gap:9px;margin:0 16px 10px;padding:11px 13px;background:rgba(11,14,17,.72);border:1px solid var(--line);border-radius:12px;color:var(--ink-3)}
  #coin-modal .cm-search input{flex:1;min-width:0;background:none;border:0;outline:none;color:var(--ink);font-family:var(--display);font-size:14px}
  #coin-modal .cm-search input::placeholder{color:var(--ink-3);opacity:.6}
  #coin-modal .cm-list{overflow-y:auto;padding:4px 10px 12px;scrollbar-width:thin}
  #coin-modal .cm-coin{display:flex;align-items:center;gap:11px;padding:10px 10px;border-radius:12px;cursor:pointer;color:var(--ink);width:100%;background:none;border:0;text-align:left}
  #coin-modal .cm-coin:hover,#coin-modal .cm-coin.on{background:rgba(255,255,255,.05)}
  #coin-modal .cm-coin-tx{display:flex;flex-direction:column;gap:1px;min-width:0}
  #coin-modal .cm-coin-tx b{font-family:var(--display);font-size:14px;font-weight:700;color:var(--ink);line-height:1.2}
  #coin-modal .cm-coin-tx i{font-style:normal;font-size:11px;color:var(--ink-3);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}
  #coin-modal .cm-coin-right{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex:0 0 auto}
  #coin-modal .cm-coin-price{font-family:var(--mono);font-size:13px;font-weight:700;color:var(--ink)}
  #coin-modal .cm-coin-chg{font-family:var(--mono);font-size:11px;font-weight:700}
  #coin-modal .cm-coin-chg.pos{color:#34d399}
  #coin-modal .cm-coin-chg.neg{color:#f87171}
  /* Token listado en el buscador: etiqueta de protección (garantía, en verde). */
  #coin-modal .cm-coin-prot{font-family:var(--mono);font-size:10.5px;font-weight:700;color:#34d399}
  #coin-modal .cm-coin-prot.off{color:var(--ink-3)}
  #coin-modal .cm-coin.es-listado{border:1px solid rgba(52,211,153,.2)}
  #coin-modal .cm-coin.es-listado .cm-coin-tx i{color:#39e07a;opacity:.8}
  
  #coin-modal .cm-price-skel{display:inline-block;width:48px;height:11px;border-radius:4px;background:rgba(255,255,255,.08)}
  #coin-modal .cm-import,#coin-modal .cm-empty{padding:14px 12px;font-size:12px;color:var(--ink-3);text-align:center;display:flex;align-items:center;justify-content:center;gap:8px}
  #coin-modal .cm-imp-spin{width:14px;height:14px;border:2px solid var(--ink-3);border-top-color:transparent;border-radius:50%;animation:cmSpin .7s linear infinite}
  @keyframes cmSpin{to{transform:rotate(360deg)}}
  
  /* Icono de moneda: letra de fondo + logo encima cuando carga (mismo patrón que la web). */
  #swap-modal .coin-sel-ico,#coin-modal .cm-coin-ico{position:relative;width:26px;height:26px;border-radius:50%;display:inline-grid;place-items:center;overflow:hidden;background:linear-gradient(180deg,#232b34,#151b22);flex:0 0 auto}
  #swap-modal .coin-sel-ico .ico-fb,#coin-modal .cm-coin-ico .ico-fb{font-family:var(--display);font-weight:800;font-size:12px;color:currentColor;line-height:1}
  #swap-modal .coin-sel-ico img,#coin-modal .cm-coin-ico img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;opacity:0;transition:opacity .15s}
  #swap-modal .coin-sel-ico.conlogo img,#coin-modal .cm-coin-ico.conlogo img{opacity:1}
  #swap-modal .coin-sel-ico.conlogo .ico-fb,#coin-modal .cm-coin-ico.conlogo .ico-fb{opacity:0}
  @media(max-width:560px){#swap-modal .sw-amt,#swap-modal .sw-out{font-size:22px}#swap-modal input.sw-find-inp{font-size:12px}}
  `;
  const st = document.createElement('style'); st.id = 'sw-css'; st.textContent = css; document.head.appendChild(st);
}

function swTokInner(mo) {
  return `<span class="coin-sel-ico" style="color:${mo.color || '#e8b84b'}">${icoInner(mo)}</span><b>${mo.simbolo}</b><svg class="sw-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;
}
function swBal(mo, cuenta) { return (mo.address == null) ? gb.saldoNativoBNB(cuenta) : gb.balanceToken(mo.address, cuenta); }
function swFmt(wei, dec, max = 6) {
  try { const n = Number(gb.fmt(wei, dec)); if (!isFinite(n) || n === 0) return '0';
    if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: Math.min(max, 6) });
    if (n >= 0.0001) return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
    return Number(n.toPrecision(2)).toString();
  } catch (_) { return '0'; }
}
function swUsdVal(id, wei) {
  const p = (LOGOS[id]?.price) || (id === 'WBNB' ? LOGOS['BNB']?.price : null);
  if (!p || !(wei > 0n)) return '';
  const v = Number(gb.fmt(wei, swMon(id).decimals)) * p;
  if (!isFinite(v) || v <= 0) return '';
  return '≈ $' + (v >= 1 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toFixed(4));
}
function swAmountBI() {
  const from = swMon(S.fromId); const s = String(S.amount || '').replace(',', '.');
  if (!s || !(Number(s) > 0)) return 0n;
  // Si el usuario pulsó MAX y no cambió el número, usar el wei EXACTO (sin perder precisión).
  if (S.maxWei != null) return S.maxWei;
  try { return gb.parse(Number(s).toFixed(Math.min(from.decimals, 18)), from.decimals); } catch (_) { return 0n; }
}
// 'wrap' (BNB->WBNB) o 'unwrap' (WBNB->BNB) o null (swap normal)
function swEsWrap() {
  if (S.fromId === 'BNB' && S.toId === 'WBNB') return 'wrap';
  if (S.fromId === 'WBNB' && S.toId === 'BNB') return 'unwrap';
  return null;
}

export function abrirSwap() {
  swInjectCSS(); swSyncWbnbLogo(); swCargarLogosPropio();
  const host = $(APP) || document.body;
  const v = $('swap-modal'); if (v) v.remove();
  const from = swMon(S.fromId), to = swMon(S.toId);
  const x = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const flip = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v13"/><path d="m3 13 4 4 4-4"/><path d="M17 20V7"/><path d="m21 11-4-4-4 4"/></svg>`;
  const el = document.createElement('div');
  el.innerHTML = `<div id="swap-modal">
    <div class="sw-bg" id="sw-bg2" style="position:absolute;inset:0"></div>
    <div class="sw-wrap">
    <div class="sw-bg" id="sw-bg"></div>
    <div class="sw-box">
      <div class="cm-head"><span class="cm-title">Intercambio</span><div style="display:flex;align-items:center"><button class="sw-listbtn" id="sw-listbtn"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>List your token</button><button class="cm-x" id="sw-x" aria-label="Cerrar">${x}</button></div></div>
      <div class="sw-find">
        <div class="sw-find-bar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input id="sw-find-inp" class="sw-find-inp" placeholder="Busca por nombre o pega la dirección de la moneda" autocomplete="off" spellcheck="false">
        </div>
        <div class="sw-find-res" id="sw-find-res"></div>
      </div>
      <div class="sw-body">
        <div class="sw-cards">
          <div class="sw-card">
            <div class="sw-card-top"><span class="sw-lbl">Pagas</span><span class="sw-bal" id="sw-bal-from">—</span></div>
            <div class="sw-card-mid"><input class="sw-amt" id="sw-amt" inputmode="decimal" placeholder="0.0" autocomplete="off"><button class="sw-tok" id="sw-tok-from" type="button">${swTokInner(from)}</button></div>
            <div class="sw-card-bot"><span class="sw-usd" id="sw-usd-from"></span><button class="sw-max" id="sw-max" type="button">MÁX</button></div>
          </div>
          <div class="sw-card">
            <div class="sw-card-top"><span class="sw-lbl">Recibes (estimado)</span><span class="sw-bal" id="sw-bal-to">—</span></div>
            <div class="sw-card-mid"><div class="sw-out" id="sw-out">0.0</div><button class="sw-tok" id="sw-tok-to" type="button">${swTokInner(to)}</button></div>
            <div class="sw-card-bot"><span class="sw-usd" id="sw-usd-to"></span></div>
          </div>
          <button class="sw-flip" id="sw-flip" type="button" aria-label="Invertir">${flip}</button>
        </div>
        <div class="sw-info" id="sw-info"></div>
        <button class="btn-oro3d sw-go" id="sw-go" type="button">Intercambiar</button>
      </div>
    </div>
    <div class="lt-slot" id="lt-slot"></div>
    </div>
  </div>`;
  host.appendChild(el.firstElementChild);
  $('sw-x').onclick = cerrarSwap; $('sw-bg').onclick = cerrarSwap;
  if ($('sw-find-inp')) $('sw-find-inp').addEventListener('input', swFindInput);
  // Precargar un token si se llegó con ?token=CONTRATO (p.ej. desde Wallet Watcher).
  try {
    var _tokParam = new URLSearchParams(location.search).get('token');
    if (_tokParam && /^0x[0-9a-fA-F]{40}$/.test(_tokParam)) {
      var _inp = $('sw-find-inp');
      if (_inp) { _inp.value = _tokParam; setTimeout(function () { swFindInput(); }, 250); }
    }
  } catch (_) {}
  $('sw-amt').addEventListener('input', swInput);
  $('sw-max').onclick = swMax;
  $('sw-flip').onclick = swFlip;
  $('sw-tok-from').onclick = () => abrirSwapCoinModal('from');
  $('sw-tok-to').onclick = () => abrirSwapCoinModal('to');
  $('sw-go').onclick = swEjecutar;
  // botón "List your token": despliega el panel al lado
  const lbtn = $('sw-listbtn');
  if (lbtn) lbtn.onclick = async () => {
    const modal = $('swap-modal');
    const slot = $('lt-slot');
    if (modal.classList.contains('lt-open')) { modal.classList.remove('lt-open'); return; }
    modal.classList.add('lt-open');
    try { inyectarListingCSS(); await montarListing(slot, { back: true, onBack: () => modal.classList.remove('lt-open') }); } catch (e) { console.warn('listing:', e); }
    // Igualar la altura del panel de listar a la del swap (medida real, solo en escritorio).
    try {
      if (window.innerWidth > 1000) {
        const box = document.querySelector('#swap-modal .sw-box');
        const panel = document.getElementById('lt-panel');
        if (box && panel) { const h = box.getBoundingClientRect().height; if (h > 0) panel.style.height = h + 'px'; }
      }
    } catch (_) {}
  };
  $('sw-amt').value = S.amount || '';
  // Reintento de iconos: si los logos aún no cargaron, re-pintar los tokens al llegar.
  (function reintentarIconos(n){
    if (n > 20) return;
    const listo = (LOGOS && (LOGOS[S.fromId] || LOGOS['BNB']));
    if (listo) { const tf=$('sw-tok-from'), tt=$('sw-tok-to'); swSyncWbnbLogo(); if(tf) tf.innerHTML=swTokInner(swMon(S.fromId)); if(tt) tt.innerHTML=swTokInner(swMon(S.toId)); }
    else setTimeout(()=>reintentarIconos(n+1), 250);
  })(0);
  if (!LOGO_ST.ok) { _cargarLogosPrecios(); swCargarLogosPropio(); }
  swCargarTarifa(); swCargarBalances(); swRenderInfo(); swRenderBtn(); setOut();
  if (S.amount) swCotizar();
  setTimeout(() => { const a = $('sw-amt'); if (a) a.focus(); }, 60);
}
function cerrarSwap() {
  const p = $('coin-modal'); if (p && $('scm-list')) { window._cmRepintar = null; p.remove(); }
  const m = $('swap-modal'); if (m) m.remove();
  // Si se llegó a la APP (app.html) con ?abrir=swap, detrás quedan los bots: hay que
  // salir al lobby. En la PORTADA (index.html) detrás está la propia portada, así que
  // solo se quita el modal y no se navega (nada de pestañazo a los bots).
  try {
    const par = new URLSearchParams(location.search);
    const enApp = /app\.html/.test(location.pathname);
    if (par.get('abrir') === 'swap' && enApp) { location.replace('index.html'); }
    // limpiar el ?token/?abrir de la URL sin recargar, para que al cerrar quede limpia la portada
    else if (par.get('abrir') === 'swap') { try { history.replaceState(null, '', location.pathname); } catch (_) {} }
  } catch (_) {}
}

function swInput(e) {
  let val = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
  const parts = val.split('.'); if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
  e.target.value = val; S.amount = val; S.maxWei = null;
  swRenderInfo(); swRenderBtn(); swCotizarDebounced();
}
function swCotizarDebounced() { clearTimeout(_swT); _swT = setTimeout(swCotizar, 350); }

async function swCargarTarifa() { try { S.feeWei = await gb.tarifaSwap(); } catch (_) {} }
async function swCargarBalances() {
  const cuenta = wallet.cuentaActual();
  const from = swMon(S.fromId), to = swMon(S.toId);
  const set = (id, mo, wei) => { const e = $(id); if (e) e.textContent = (wei == null) ? '—' : (swFmt(wei, mo.decimals) + ' ' + mo.simbolo); };
  if (!cuenta) { S.balFromWei = 0n; set('sw-bal-from', from, null); set('sw-bal-to', to, null); swRenderBtn(); return; }
  try {
    const [bf, bt] = await Promise.all([swBal(from, cuenta), swBal(to, cuenta)]);
    S.balFromWei = bf; set('sw-bal-from', from, bf); set('sw-bal-to', to, bt);
  } catch (_) {}
  swRenderBtn();
}

async function swCotizar() {
  const from = swMon(S.fromId), to = swMon(S.toId);
  const amtBI = swAmountBI();
  if (!(amtBI > 0n)) { S.out = 0n; S.minOut = 0n; S.fee = 0; setOut(); swRenderInfo(); swRenderBtn(); return; }
  // WBNB <-> BNB es conversión 1:1 (envolver/desenvolver), sin cotización ni permiso
  if (swEsWrap()) { S.out = amtBI; S.minOut = amtBI; S.fee = 0; S.allow = 0n; S.quoting = false; setOut(); swRenderInfo(); swRenderBtn(); return; }
  // Destino LISTADO en MercadoTokens: el "recibes" se calcula con el precio del listado.
  const to0 = swMon(S.toId);
  const Ld = to0 && to0.id ? LISTADOS[String(to0.id).toLowerCase()] : null;
  if (Ld && (S.fromId === 'BNB' || S.fromId === 'WBNB')) {
    const dec = to0.decimals || 18;
    if (Ld.precio > 0n) {
      let tokens = (amtBI * (10n ** BigInt(dec))) / Ld.precio;
      if (tokens > Ld.enVenta) tokens = Ld.enVenta;
      S.out = tokens; S.minOut = tokens; S.fee = 0; S.allow = 0n; S.quoting = false;
      setOut(); swRenderInfo(); swRenderBtn(); return;
    }
  }
  S.quoting = true; swRenderBtn();
  const token = ++_swToken;
  const cuenta = wallet.cuentaActual();
  try {
    const [r, allow] = await Promise.all([
      gb.cotizarSwap({ inAddr: from.address, outAddr: to.address, amountInBI: amtBI, slippageBps: 50 }),
      (from.address == null || !cuenta) ? Promise.resolve(0n) : gb.allowanceSwap(from.address, cuenta)
    ]);
    if (token !== _swToken) return;
    S.allow = allow;
    if (!r) { S.out = 0n; S.minOut = 0n; S.fee = 0; }
    else { S.out = r.amountOut; S.minOut = r.minOut; S.fee = r.fee; }
  } catch (_) { if (token !== _swToken) return; S.out = 0n; S.minOut = 0n; S.fee = 0; }
  S.quoting = false;
  setOut(); swRenderInfo(); swRenderBtn();
}

function setOut() { const to = swMon(S.toId); const e = $('sw-out'); if (e) e.textContent = S.out > 0n ? swFmt(S.out, to.decimals) : '0.0'; }
function swRenderInfo() {
  const el = $('sw-info'); if (!el) return;
  const from = swMon(S.fromId), to = swMon(S.toId);
  const uf = $('sw-usd-from'); if (uf) uf.textContent = swUsdVal(S.fromId, swAmountBI());
  const ut = $('sw-usd-to'); if (ut) ut.textContent = swUsdVal(S.toId, S.out);
  const rows = [];
  if (S.out > 0n) {
    const inH = Number(gb.fmt(swAmountBI(), from.decimals));
    const outH = Number(gb.fmt(S.out, to.decimals));
    if (swEsWrap()) { rows.push(['Conversión', `1 ${from.simbolo} = 1 ${to.simbolo}`]); }
    else if (inH > 0) { const rate = outH / inH; rows.push(['Precio', `1 ${from.simbolo} ≈ ${num(rate, rate >= 1 ? 4 : 8)} ${to.simbolo}`]); rows.push(['Mínimo que recibes', `${swFmt(S.minOut, to.decimals)} ${to.simbolo}`]); }
  }
  el.innerHTML = rows.map(([a, b]) => `<div class="r"><span>${a}</span><span>${b}</span></div>`).join('');
}
function swRenderBtn() {
  const b = $('sw-go'); if (!b) return;
  const from = swMon(S.fromId);
  const cuenta = wallet.cuentaActual();
  const amt = Number(String(S.amount || '').replace(',', '.'));
  const amtBI = swAmountBI();
  const wrap = swEsWrap();
  let label = 'Intercambiar', dis = false, act = 'swap';
  if (!cuenta) { label = 'Conecta tu wallet'; act = 'connect'; }
  else if (!wallet.esRedCorrecta()) { label = 'Cambia a BNB Chain'; act = 'net'; }
  else if (!(amt > 0)) { label = 'Ingresa un monto'; dis = true; }
  else if (amtBI > S.balFromWei) { label = 'Saldo insuficiente'; dis = true; }
  else if (wrap) { label = 'Convertir'; act = wrap; }
  else if (S.quoting) { label = 'Calculando…'; dis = true; }
  else if (S.out === 0n) { label = 'No route for this pair'; dis = true; }
  else if ((() => { const t = swMon(S.toId); return t && t.id && LISTADOS[String(t.id).toLowerCase()]; })()) {
    // destino listado en MercadoTokens: es una COMPRA (paga con BNB)
    if (S.fromId !== 'BNB' && S.fromId !== 'WBNB') { label = 'Pay with BNB to buy'; dis = true; }
    else { label = 'Buy token'; act = 'buy'; }
  }
  else if (from.address != null && S.allow < amtBI) { label = 'Aprobar y cambiar'; act = 'approve'; }
  else { label = 'Intercambiar'; act = 'swap'; }
  b.textContent = label; b.disabled = dis; S.accion = act;
}

function swMax() {
  const from = swMon(S.fromId);
  if (!(S.balFromWei > 0n)) return;
  let maxWei = S.balFromWei;
  if (from.address == null) { const buf = (S.feeWei || 0n) + SW_GAS_BUF; maxWei = S.balFromWei > buf ? (S.balFromWei - buf) : 0n; }
  const v = Number(gb.fmt(maxWei, from.decimals));
  // mostrar máximo 6 decimales (legible); el wei exacto se usa por dentro.
  S.amount = v > 0 ? (Math.floor(v * 1e6) / 1e6).toString() : '';
  S.maxWei = maxWei;   // wei EXACTO para no perder precisión al reconvertir
  const a = $('sw-amt'); if (a) a.value = S.amount;
  swRenderInfo(); swRenderBtn(); swCotizar();
}
function swFlip() {
  const f = S.fromId; S.fromId = S.toId; S.toId = f;
  S.amount = ''; S.out = 0n; S.minOut = 0n; S.allow = 0n;
  const a = $('sw-amt'); if (a) a.value = '';
  swPintarToks(); swCargarBalances(); setOut(); swRenderInfo(); swRenderBtn();
}
function swPintarToks() {
  swSyncWbnbLogo();
  const tf = $('sw-tok-from'), tt = $('sw-tok-to');
  if (tf) tf.innerHTML = swTokInner(swMon(S.fromId));
  if (tt) tt.innerHTML = swTokInner(swMon(S.toId));
}

function abrirSwapCoinModal(lado) {
  swSyncWbnbLogo();
  const host = $(APP) || document.body;
  const viejo = $('coin-modal'); if (viejo) viejo.remove();
  const searchIco = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`;
  const x = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  const el = document.createElement('div');
  el.innerHTML = `<div class="coin-modal" id="coin-modal" style="z-index:260">
    <div class="coin-modal-bg" id="scm-bg"></div>
    <div class="coin-modal-box">
      <div class="cm-head"><span class="cm-title">Elige la moneda</span><button class="cm-x" id="scm-x" aria-label="Cerrar">${x}</button></div>
      <div class="cm-search">${searchIco}<input id="scm-search" placeholder="Nombre, símbolo o dirección…" autocomplete="off" spellcheck="false"></div>
      <div class="cm-list" id="scm-list"></div>
    </div>
  </div>`;
  host.appendChild(el.firstElementChild);
  let ftxt = '';
  const sel = lado === 'from' ? S.fromId : S.toId;
  const pintar = () => {
    swSyncWbnbLogo();
    const q = ftxt.trim();
    const ql = q.toLowerCase();
    const monedas = SWAP_IDS.map((id) => swMon(id)).filter(Boolean).filter((mo) =>
      !q || (mo.simbolo || '').toLowerCase().includes(ql) || (mo.nombre || '').toLowerCase().includes(ql) || (mo.address || '').toLowerCase() === ql);
    const list = $('scm-list');
    let html = monedas.map((mo) => {
      const on = sel === mo.id; const L = LOGOS[mo.id]; const chg = L && L.chg != null ? L.chg : null;
      return `<button type="button" class="cm-coin${on ? ' on' : ''}" data-id="${mo.id}">
        <span class="cm-coin-ico" style="color:${mo.color || '#e8b84b'}">${icoInner(mo)}</span>
        <span class="cm-coin-tx"><b>${mo.simbolo}</b><i>${mo.nombre}</i></span>
        <span class="cm-coin-right">
          <span class="cm-coin-price">${L ? fmtPrecioUSD(L.price) : ''}</span>
          ${chg != null ? `<span class="cm-coin-chg ${chg >= 0 ? 'pos' : 'neg'}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span>` : ''}
        </span>
      </button>`;
    }).join('');
    // Importar por dirección: si es una dirección válida y no está ya en la lista
    const yaEsta = monedas.length && monedas.some((mo) => (mo.address || '').toLowerCase() === ql);
    if (gb.esDireccion(q) && !yaEsta) {
      html += `<div class="cm-import" id="cm-import"><span class="cm-imp-spin"></span>Buscando token en BNB Chain…</div>`;
      swImportarToken(q, lado);
    } else if (!html) {
      html = `<div class="cm-empty">Sin resultados para "${q}". Pega su dirección para añadirla.</div>`;
    }
    list.innerHTML = html;
    list.querySelectorAll('.cm-coin').forEach((b) => b.onclick = () => swElegir(lado, b.dataset.id));
  };
  window._cmRepintar = pintar; pintar();
  if (!LOGO_ST.ok) { _cargarLogosPrecios(); swCargarLogosPropio(); }
  $('scm-search').addEventListener('input', (e) => { ftxt = e.target.value; pintar(); });
  setTimeout(() => { const s = $('scm-search'); if (s) s.focus(); }, 60);
  const cerrar = () => { window._cmRepintar = null; const m = $('coin-modal'); if (m) m.remove(); };
  $('scm-x').onclick = cerrar; $('scm-bg').onclick = cerrar;
}
function swElegir(lado, id) {
  const m = $('coin-modal'); if (m) m.remove(); window._cmRepintar = null;
  if (lado === 'from') { if (id === S.toId) S.toId = S.fromId; S.fromId = id; }
  else { if (id === S.fromId) S.fromId = S.toId; S.toId = id; }
  S.allow = 0n;
  swPintarToks(); swCargarBalances(); setOut(); swRenderInfo(); swRenderBtn(); swCotizar();
}

// Importa un token por dirección de contrato (lee symbol/name/decimals en cadena)
async function swImportarToken(addr, lado) {
  const key = addr.trim().toLowerCase();
  if (CUSTOM[key]) { swRenderImport(CUSTOM[key], lado); return; }
  const tk = ++_impToken;
  try {
    const info = await gb.infoToken(addr);
    if (tk !== _impToken) return;
    // El nombre y el símbolo los pone quien creó ESE token, no nosotros.
    // Los limpiamos: solo letras, números y unos pocos signos, y cortos.
    const limpio = (v, max) => String(v || '').replace(/[^\p{L}\p{N} ._+\-]/gu, '').trim().slice(0, max);
    const sim = limpio(info.simbolo, 12) || '?';
    const nom = limpio(info.nombre, 40) || sim;
    const t = { id: key, simbolo: sim, nombre: nom, address: info.address, decimals: info.decimals, icono: sim[0], color: '#E8B84B', custom: true };
    CUSTOM[key] = t;
    if (!LOGOS[key]) LOGOS[key] = { img: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${info.address}/logo.png`, price: null, chg: null };
    // ¿Este token está LISTADO en nuestro MercadoTokens? (para comprarlo aquí)
    try {
      const lst = await mercadoTK.listadosCompra(info.address);
      if (tk === _impToken && lst && lst.length > 0) {
        // tomar el listado con más stock (o el primero)
        const L = lst.sort((a,b)=> (b.enVenta>a.enVenta?1:-1))[0];
        LISTADOS[key] = L;
        // logo desde Firestore (si tiene)
        try { const logo = await flogosTK.leerLogo(info.address); if (logo) LOGOS[key] = { img: logo, price: null, chg: null }; } catch (_) {}
        // el nombre/símbolo del listado (que puede estar anclado, ej. USDT.z)
        t.simbolo = L.simbolo || t.simbolo; t.nombre = L.nombre || t.nombre;
      }
    } catch (_) {}
    swRenderImport(t, lado);
  } catch (_) {
    if (tk !== _impToken) return;
    const el = $('cm-import'); if (el) { el.className = 'cm-import err'; el.textContent = 'No es un token válido en BNB Chain.'; }
  }
}
function swRenderImport(t, lado) {
  const el = $('cm-import'); if (!el) return;
  el.className = 'cm-import ok';
  const L = LISTADOS[t.id];
  let right;
  if (L) {
    // token listado en nuestra plataforma: precio + tiempo de protección (garantía)
    const dias = Math.ceil((L.proteccionSeg || 0) / 86400);
    const prot = dias > 0 ? `<span class="cm-coin-prot">Protected · ${dias}d</span>` : `<span class="cm-coin-prot off">Listed</span>`;
    right = `<span class="cm-coin-price">$${fmtPrecioListado(L)}</span>${prot}`;
  } else {
    right = `<span class="cm-imp-badge">Usar</span>`;
  }
  el.innerHTML = `<button type="button" class="cm-coin${L?' es-listado':''}" data-id="${t.id}">
    <span class="cm-coin-ico" style="color:${t.color}">${icoInner(t)}</span>
    <span class="cm-coin-tx"><b>${escT(t.simbolo)}</b><i>${escT(t.nombre)}${L?' · Community listing':''}</i></span>
    <span class="cm-coin-right">${right}</span>
  </button>`;
  const b = el.querySelector('.cm-coin'); if (b) b.onclick = () => swElegir(lado, t.id);
}
/* Precio del token listado en USD (el vendedor lo puso en USD; el contrato guarda en BNB;
   lo mostramos convertido a USD aproximado con el precio de BNB si lo tenemos). */
function fmtPrecioListado(L) {
  // el precio guardado está en BNB (18 dec) por 1 token. Lo pasamos a USD con el precio de BNB.
  const pBNB = LOGOS['BNB'] && LOGOS['BNB'].price ? LOGOS['BNB'].price : 0;
  const precioBNB = Number(gb.fmt(L.precio, 18));
  const usd = pBNB ? precioBNB * pBNB : 0;
  return usd > 0 ? usd.toLocaleString('en-US', {maximumFractionDigits: usd < 1 ? 6 : 2}) : precioBNB.toFixed(8) + ' BNB';
}

/* ---- Barra de búsqueda universal (bajo el título del panel) ---- */
function swFindQ() { const i = $('sw-find-inp'); return i ? i.value.trim() : ''; }
function swFindInput() { swFindRender(swFindQ()); }
function swFindRow(mo) {
  const L = LOGOS[mo.id];
  const precio = L && L.price != null ? `<span class="sw-find-usd">${fmtPrecioUSD(L.price)}</span>` : '';
  return `<button type="button" class="sw-find-row" data-id="${mo.id}">
    <span class="coin-sel-ico" style="color:${mo.color || '#e8b84b'}">${icoInner(mo)}</span>
    <span class="sw-find-tx"><b>${mo.simbolo}</b><i>${mo.nombre}</i></span>
    ${precio}<span class="sw-find-go">Usar</span>
  </button>`;
}
function swFindRender(q) {
  const res = $('sw-find-res'); if (!res) return;
  if (!q) { res.innerHTML = ''; res.classList.remove('open'); return; }
  swSyncWbnbLogo();
  res.classList.add('open');
  const ql = q.toLowerCase();
  const monedas = SWAP_IDS.map((id) => swMon(id)).filter(Boolean).filter((mo) =>
    (mo.simbolo || '').toLowerCase().includes(ql) || (mo.nombre || '').toLowerCase().includes(ql) || (mo.address || '').toLowerCase() === ql);
  let html = monedas.slice(0, 6).map(swFindRow).join('');
  const yaEsta = monedas.some((mo) => (mo.address || '').toLowerCase() === ql);
  if (gb.esDireccion(q) && !yaEsta) {
    if (CUSTOM[ql]) html += swFindRow(CUSTOM[ql]);
    else { html += `<div class="sw-find-msg" id="sw-find-imp"><span class="cm-imp-spin"></span>Buscando en BNB Chain…</div>`; swFindImport(q); }
  } else if (!html) {
    html = `<div class="sw-find-msg">Sin resultados. Prueba con otro nombre o pega su dirección.</div>`;
  }
  res.innerHTML = html;
  res.querySelectorAll('.sw-find-row').forEach((b) => b.onclick = () => swFindPick(b.dataset.id));
}
async function swFindImport(q) {
  const key = q.trim().toLowerCase();
  if (CUSTOM[key]) { if (swFindQ().toLowerCase() === key) swFindRender(swFindQ()); return; }
  const tk = ++_impToken;
  try {
    const info = await gb.infoToken(q);
    if (tk !== _impToken) return;
    CUSTOM[key] = { id: key, simbolo: info.simbolo, nombre: info.nombre, address: info.address, decimals: info.decimals, icono: (info.simbolo || '?')[0], color: '#E8B84B', custom: true };
    if (!LOGOS[key]) LOGOS[key] = { img: `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/${info.address}/logo.png`, price: null, chg: null };
    if (swFindQ().toLowerCase() === key) swFindRender(swFindQ());
  } catch (_) {
    if (tk !== _impToken) return;
    const el = $('sw-find-imp'); if (el) { el.className = 'sw-find-msg err'; el.textContent = 'No es un token válido en BNB Chain.'; }
  }
}
function swFindPick(id) {
  if (id === S.fromId) S.fromId = S.toId;   // evita from=to
  S.toId = id; S.allow = 0n;
  const inp = $('sw-find-inp'); if (inp) inp.value = '';
  const res = $('sw-find-res'); if (res) { res.innerHTML = ''; res.classList.remove('open'); }
  swPintarToks(); swCargarBalances(); setOut(); swRenderInfo(); swRenderBtn(); swCotizar();
}

function swExito(from, to, inWei, outWei) {
  const m = $('colmena-modal'); if (!m) return;
  limpiarBusy();
  const check = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3a2800" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  $('cm-title').textContent = '';
  $('cm-body').innerHTML = `<div style="text-align:center;padding:4px 2px 2px">
    <div style="width:60px;height:60px;margin:0 auto 15px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);box-shadow:0 8px 22px rgba(232,184,75,.38),inset 0 1px 0 rgba(255,255,255,.6)">${check}</div>
    <div style="font-family:var(--display);font-weight:800;font-size:21px;color:var(--gold);margin-bottom:12px;text-shadow:0 1px 2px rgba(0,0,0,.4)">¡Intercambio hecho!</div>
    <div style="font-family:var(--sans);font-size:14.5px;color:var(--ink-2);line-height:1.65">Cambiaste <b style="color:var(--ink)">${swFmt(inWei, from.decimals)} ${from.simbolo}</b><br>por <b style="color:var(--ink)">~${swFmt(outWei, to.decimals)} ${to.simbolo}</b>.<br><span style="color:var(--ink-3);font-size:13px">Ya está en tu wallet.</span></div>
  </div>`;
  const btns = m.querySelector('.m-btns'); btns.style.display = 'flex';
  $('cm-cancel').style.display = 'none';
  const ok = $('cm-ok'); ok.textContent = '¡Listo!'; ok.className = 'btn btn-oro'; ok.onclick = () => m.classList.remove('show');
  m.classList.add('show');
}

async function swEjecutar() {
  const act = S.accion;
  if (act === 'connect') { _conectarWallet(); return; }
  if (act === 'net') { wallet.cambiarARedCorrecta().catch(() => {}); return; }
  const from = swMon(S.fromId), to = swMon(S.toId);
  const amtBI = swAmountBI();
  if (!(amtBI > 0n)) return;
  // ¿El destino es un token LISTADO en nuestra plataforma? → es una COMPRA de MercadoTokens.
  const listadoDestino = to && to.id ? LISTADOS[String(to.id).toLowerCase()] : null;
  if (listadoDestino) { return swComprarListado(from, to, amtBI, listadoDestino); }
  try {
    // Conversión WBNB <-> BNB (una sola firma, sin permiso, 1:1)
    if (act === 'wrap' || act === 'unwrap') {
      modalBusy(act === 'wrap'
        ? 'Convertir BNB en WBNB.<br>Es una sola firma.<br><br>Confirma en tu wallet.'
        : 'Convert WBNB to BNB.<br>Es una sola firma.<br><br>Confirma en tu wallet.');
      if (act === 'wrap') await gb.envolverBNB(amtBI); else await gb.desenvolverBNB(amtBI);
      swExito(from, to, amtBI, amtBI);
      S.amount = ''; S.out = 0n; S.minOut = 0n; const a1 = $('sw-amt'); if (a1) a1.value = '';
      swCargarBalances(); setOut(); swRenderInfo(); swRenderBtn();
      return;
    }
    if (!(S.out > 0n)) { modalError('No hay ruta para este par ahora mismo. Prueba otra moneda o monto.'); return; }
    // Si hace falta permiso, son DOS firmas: permiso + intercambio
    const necesitaPermiso = (act === 'approve');
    if (necesitaPermiso) {
      // Límite de gasto acotado (~$200) para no disparar el aviso de "ilimitado"
      let capBI = amtBI;
      const price = (LOGOS[from.id]?.price) || (from.id === 'WBNB' ? LOGOS['BNB']?.price : null);
      if (price && price > 0) { try { const cb = gb.parse((200 / price).toFixed(Math.min(from.decimals, 18)), from.decimals); if (cb > capBI) capBI = cb; } catch (_) {} }
      modalBusy(`<b>Step 1 of 2 — ${from.simbolo} permission.</b><br>You authorize a spending limit (you can change or revoke it whenever yoieras). Después confirmarás el intercambio.<br><br>Confirma en tu wallet.`);
      await gb.aprobarSwap(from.address, capBI);
      // refrescar cotización/permiso antes del segundo paso
      const cuenta = wallet.cuentaActual();
      try { S.allow = await gb.allowanceSwap(from.address, cuenta); } catch (_) {}
      const r = await gb.cotizarSwap({ inAddr: from.address, outAddr: to.address, amountInBI: amtBI, slippageBps: 50 });
      if (r) { S.out = r.amountOut; S.minOut = r.minOut; S.fee = r.fee; }
      modalBusy('<b>Step 2 of 2 — Confirm the swap.</b><br>Last signature to complete.<br><br>Confirm in your wallet.');
    } else {
      modalBusy('Confirma el intercambio en tu wallet…');
    }
    await gb.ejecutarSwap({ inAddr: from.address, outAddr: to.address, amountInBI: amtBI, minOut: S.minOut, fee: S.fee });
    swExito(from, to, amtBI, S.out);
    S.amount = ''; S.out = 0n; S.minOut = 0n; const a2 = $('sw-amt'); if (a2) a2.value = '';
    swCargarBalances(); setOut(); swRenderInfo(); swRenderBtn();
  } catch (e) {
    console.warn('[Aurex] detalle técnico:', e);
    modalError(enCristiano(e));
  }
}
