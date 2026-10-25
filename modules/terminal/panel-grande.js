/* terminal/panel-grande.js. Vista grande de la Terminal (modulo sellado: solo archivos de modules/terminal/).
   Es la experiencia de PC: la grafica en grande en el centro, un panel de informacion del token a la
   izquierda y la columna de operar a la derecha (spot: comprar a mercado y alertas, sin apalancamiento,
   sin limit, sin short). En el centro arriba hay un buscador por CONTRATO y un boton que despliega la
   lista de tokens del feed para cargar cualquiera en la grafica SIN abrir otra ventana.
   La ventanita pequena (la ficha) sigue siendo la version de movil. Aqui NO se abre la ficha.

   Esta entrega es el ARMAZON: layout de tres zonas, grafica funcionando, buscador por contrato y
   selector de tokens. La columna de operar (Market / Alert, saldos, Open Alerts, Positions) y el
   clic en la grafica llegan en las siguientes entregas; aqui va su maqueta. */
import * as ethers from './ethers.min.js';
import { resolverContrato, esContrato } from './resolver.js';
import { velasDeToken, montarGrafico, destruirGrafico, precioActual, precioEnY, marcarEntrada, limpiarEntrada, marcarAlertas } from './grafico.js';
import { precioUsdVivo } from './precio.js';
import { historialCreador } from './creador.js';
import { SCAN_URL, WBNB, USDT, SLIPPAGE, PROTECCION, PRESETS_BNB } from './config.js';
import { disclaimerProtect } from './protect.js';
import { abrirCompra, saldoBNB, saldoToken, cotizarCompra, comprar } from './compra.js';
import { listaDe, enVivo, registrarCompra } from './posiciones.js';
import { crearAlerta, alertasDe, listaAlertas, quitarAlerta } from './alertas.js';
import { PASOS, PASOS_TXT } from './auditoria.js';
import * as wallet from './wallet.js';
import { esOwner, estadoSuscripcion, montarCandado, pintarPill, bloquearProtect } from './candado.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const corto = (a) => a ? '…' + String(a).slice(-4) : '';
const cortoDir = (a) => a ? (String(a).slice(0, 6) + '…' + String(a).slice(-4)) : '';

const ICO_BSC = '<svg viewBox="0 0 126.61 126.61" fill="#F3BA2F"><path d="M38.73 53.2 63.3 28.63l24.6 24.6 14.3-14.31L63.3 0 24.42 38.89z"/><path d="M0 63.3l14.3-14.3 14.31 14.3-14.31 14.3z"/><path d="M38.73 73.41 63.3 97.98l24.59-24.58 14.31 14.29-38.9 38.91L24.42 87.7z"/><path d="M98 63.3l14.3-14.3 14.31 14.3-14.31 14.31z"/><path d="M77.83 63.3 63.3 48.77 52.56 59.51l-1.24 1.23-2.54 2.55 14.52 14.53z"/></svg>';
const ICO_COPY = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const ICO_CHECK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>';
const ICO_X = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const ICO_SEM = {
  ok: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
  warn: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  bad: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  pend: '<i class="tg-anillo2"></i>',
  info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
};
const ICO_SEARCH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>';
const ICO_RULER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19 19 5"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="5" r="2.2"/><path d="M8.5 15.5v-3M12 12V9M15.5 8.5v-3" stroke-width="1.6"/></svg>';
const ICO_DL = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>';
const LOGO_BNB = 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png';
const LOGO_USDT = 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png';   // logo real de USDT (CoinGecko)

const LOGO_TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/';
const LOGO_FB = new URL('./img/token-fallback.webp', import.meta.url).href;   // imagen ejemplarizante para tokens sin logo
// Logo de Tron (marca roja). Un token de Tron NUNCA debe salir con el icono de BNB: si TronScan trae su icono
// se usa ese, y si no, este icono rojo que representa la red Tron (nunca un emoji).
const ICO_TRON = '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#EC0928"/><path fill="#fff" d="M24 11.5 8.7 8.8l8 16.4 9-12.1-1.7-1.6zm-1.9 1.3.9.9-2.4 3.2.3-3.8 1.2-.3zm-2.7.2-.4 4.3-3.4-7 3.8.7-.1 2zm-4.9-.8 3 6.2-5-10.3 2 4.1z"/></svg>';
// logo(addr, red, logoUrl): BSC usa TrustWallet + respaldo BNB; Tron usa el icono/logo de TronScan + respaldo Tron.
function logo(addr, red, logoUrl) {
  if (red === 'tron') {
    const img = logoUrl ? `<img class="tg-logo-img" src="${esc(logoUrl)}" alt="" loading="lazy" onload="this.classList.add('on')" onerror="this.remove()">` : '';
    return `<span class="tg-logo"><span class="tg-logo-fb">${ICO_TRON}</span>${img}</span>`;
  }
  let a = ''; try { a = ethers.getAddress(String(addr || '')); } catch (_) {}
  const src = logoUrl || (a ? LOGO_TW + a + '/logo.png' : '');
  const img = src ? `<img class="tg-logo-img" src="${esc(src)}" alt="" loading="lazy" onload="this.classList.add('on')" onerror="this.remove()">` : '';
  return `<span class="tg-logo"><span class="tg-logo-fb">${ICO_BSC}</span>${img}</span>`;
}
function fmtP(p, sig = 4) {
  if (!(p > 0) || !isFinite(p)) return '0';
  if (p >= 0.001) return Number(p.toPrecision(sig)).toString();
  const e = Math.floor(Math.log10(p));
  let dig = Math.round(p / Math.pow(10, e - sig + 1)), ceros = -e - 1;
  if (dig >= Math.pow(10, sig)) { dig = Math.floor(dig / 10); ceros -= 1; }   // el redondeo cruzo una potencia de 10: un cero menos
  return `0.0<sub>${Math.max(0, ceros)}</sub>${String(dig).slice(0, sig)}`;
}
function money(v) { if (!(v > 0)) return '$0'; if (v >= 1e12) return '$' + (v / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T'; if (v >= 1e9) return '$' + (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B'; if (v >= 1e6) return '$' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'; if (v >= 1e3) return '$' + (v / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K'; return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
const pct = (v) => (v == null || !isFinite(v)) ? '0%' : (Math.round(v * 10) / 10) + '%';

/* ── CSS propio (patron del modulo: inyectado, sin tocar el HTML ni terminal.css) ── */
let _css = false;
export function css() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'tm-big-css';
  st.textContent = `
.tm-big{position:fixed;inset:0;z-index:1200;display:flex;flex-direction:column;background:#05070a;color:var(--ink,#eaecef);font-family:var(--display,sans-serif);animation:tgIn .18s ease}
@keyframes tgIn{from{opacity:0}to{opacity:1}}
.tm-big *{box-sizing:border-box}
.tm-big-top{flex:0 0 auto;display:grid;grid-template-columns:272px 1fr 316px;gap:1px;align-items:center;border-bottom:1px solid var(--line,#232b36);background:linear-gradient(180deg,#0b0f14,#070a0e)}
.tg-top-l{display:flex;align-items:center;gap:11px;min-width:0;padding:12px 14px;overflow:hidden}
.tg-top-r{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:12px 14px}
.tg-id{display:flex;align-items:center;gap:11px;min-width:0;flex:1 1 auto;overflow:hidden}
.tg-logo{position:relative;display:inline-flex;width:40px;height:40px;border-radius:50%;overflow:hidden;flex:0 0 auto;background:#0d1117;border:1px solid #1c232b}
.tg-logo-fb,.tg-logo-img{position:absolute;inset:0;width:100%;height:100%}
.tg-logo-fb{display:flex;align-items:center;justify-content:center;padding:9px;background:url('${LOGO_FB}') center/cover no-repeat border-box}
.tg-logo-fb svg{display:none}
.tg-logo-img{object-fit:cover;background:#0d1117;opacity:0;transition:opacity .15s}
.tg-logo-img.on{opacity:1}
.tg-id-tx{min-width:0}
.tg-id-tx b{display:block;font-family:'Chakra Petch',var(--display);font-size:16px;font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-id-tx span{display:block;font-family:var(--mono);font-size:11px;color:var(--ink-3,#7d8794);white-space:nowrap}
.tg-price{display:flex;flex-direction:column;justify-content:center;padding-left:6px;flex:0 1 auto;min-width:0;overflow:hidden}
.tg-price b{font-family:var(--mono);font-size:18px;font-weight:700;line-height:1.05;color:var(--gold,#E8B84B);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.tg-price b sub{font-size:.62em}
.tg-price span{font-family:var(--mono);font-size:10px;color:var(--ink-3,#7d8794);margin-top:3px;letter-spacing:.3px}
.tg-find{display:flex;min-width:0;padding:12px 8px}
.tg-find-in{position:relative;display:flex;align-items:center;flex:1 1 auto;max-width:none;width:100%}
.tg-find-in .tg-ico{position:absolute;left:12px;color:var(--ink-3,#7d8794);display:flex}
.tg-find-in input{width:100%;height:42px;padding:0 14px 0 36px;border-radius:11px;border:1px solid var(--line,#232b36);background:#0b0f14;color:var(--ink,#eaecef);font-family:var(--mono);font-size:12px;outline:none}
.tg-find-in input:focus{border-color:#8f6a1a}
.tg-find-tok{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 15px;border-radius:11px;border:1px solid #8f6a1a;background:linear-gradient(180deg,#1b2027,#0d1117);box-shadow:0 3px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06);color:var(--gold,#E8B84B);font-family:'Chakra Petch',var(--display);font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}
.tg-find-tok:active{transform:translateY(2px);box-shadow:0 1px 0 #060809}
.tg-x{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:11px;border:1px solid var(--line,#232b36);background:#0d1117;color:var(--ink-2,#b7bdc6);font-size:17px;cursor:pointer}
.tg-x:hover{color:#fff;border-color:#3a434f}
.tm-big-main{height:100%;min-height:440px;display:grid;grid-template-columns:272px 1fr 316px;gap:1px;background:var(--line,#232b36)}
.tg-col{background:#05070a;min-height:0;overflow:auto}
.tg-left{padding:14px;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(232,184,75,.3) transparent}
.tg-left::-webkit-scrollbar{width:6px}.tg-left::-webkit-scrollbar-thumb{background:rgba(232,184,75,.3);border-radius:3px}
.tg-chart{background:#070a0e;position:relative;min-height:0}
.tg-chart-cv{position:absolute;inset:0}
.tg-chart-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ink-3,#7d8794);font-family:var(--mono);font-size:13px;pointer-events:none}
.tg-chart-msg[hidden]{display:none}
.tg-wm{position:absolute;left:12px;bottom:4px;height:20px;width:auto;max-width:150px;opacity:.2;pointer-events:none;z-index:3;user-select:none}
.tg-tools{position:absolute;top:8px;left:8px;z-index:4;display:flex;gap:6px}
.tg-tool{width:32px;height:32px;border-radius:9px;border:1px solid var(--line,#232b36);background:rgba(11,15,20,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:var(--ink-2,#b7bdc6);display:grid;place-items:center;cursor:pointer;transition:color .14s,border-color .14s}
.tg-tool svg{width:17px;height:17px}
.tg-tool:hover{color:var(--ink,#eaecef);border-color:#3a434f}
.tg-tool.on{color:var(--gold,#E8B84B);border-color:#8f6a1a;background:linear-gradient(180deg,#1b2027,#0d1117)}
.tg-tf{display:inline-flex;gap:2px;align-items:center;background:rgba(11,15,20,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid var(--line,#232b36);border-radius:9px;padding:2px;height:32px}
.tg-tf button{border:0;background:transparent;color:var(--ink-3,#7d8794);font-family:'Chakra Petch',var(--display);font-weight:600;font-size:11px;padding:4px 8px;border-radius:7px;cursor:pointer;transition:color .13s,background .13s}
.tg-tf button:hover{color:var(--ink,#eaecef)}
.tg-tf button.on{background:rgba(232,184,75,.14);color:var(--gold,#E8B84B)}
.tg-mdcapture{position:absolute;inset:0;z-index:3;cursor:crosshair}
.tg-mdcapture[hidden]{display:none}
.tg-mdbox{position:absolute;z-index:3;pointer-events:none;border:1px dashed var(--gold,#E8B84B);background:rgba(232,184,75,.08);border-radius:2px}
.tg-mdbox[hidden]{display:none}
.tg-mdbox.up{border-color:#2ee86a;background:rgba(46,232,106,.1)}
.tg-mdbox.down{border-color:#ff5c6c;background:rgba(246,70,93,.1)}
.tg-md-lbl{position:absolute;top:-23px;left:-1px;white-space:nowrap;font-family:var(--mono);font-size:11px;font-weight:700;padding:3px 8px;border-radius:7px;background:#0b0f14;border:1px solid var(--line,#232b36);color:var(--ink,#eaecef);box-shadow:0 6px 16px rgba(0,0,0,.5)}
.tg-mdbox.up .tg-md-lbl{color:#2ee86a;border-color:rgba(46,232,106,.4)}
.tg-mdbox.down .tg-md-lbl{color:#ff5c6c;border-color:rgba(246,70,93,.4)}
.tg-right{padding:14px;display:flex;flex-direction:column;gap:12px;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(232,184,75,.3) transparent}
.tg-right::-webkit-scrollbar{width:6px}.tg-right::-webkit-scrollbar-thumb{background:rgba(232,184,75,.3);border-radius:3px}
.tg-sec-t{font-family:var(--mono);font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-3,#7d8794);margin:0 0 10px}
.tg-sec-head{text-align:center;font-size:11px;letter-spacing:2px;color:var(--gold,#E8B84B);margin-bottom:12px}
.tg-kv{display:flex;flex-direction:column;gap:9px}
.tg-kv>div{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px}
.tg-kv>div span{color:var(--ink-3,#7d8794);font-family:var(--mono)}
.tg-kv>div b{font-weight:700;text-align:right;font-family:var(--mono)}
.tg-kv .tg-copyc{display:inline-flex;align-items:center;gap:5px;background:none;border:0;color:var(--gold,#E8B84B);font-family:var(--mono);font-size:12px;cursor:pointer;padding:0}
/* Cross-check: accesos externos utiles antes de comprar. */
.tg-links{display:flex;flex-direction:column;gap:7px}
.tg-link{display:flex;flex-direction:column;gap:1px;padding:9px 11px;border-radius:11px;border:1px solid var(--line,#232b36);background:linear-gradient(180deg,#0d1319,#0a0e13);text-decoration:none;transition:border-color .15s,transform .15s}
.tg-link:hover{border-color:#8f6a1a;transform:translateY(-1px)}
.tg-link b{font-family:'Chakra Petch',var(--display);font-weight:700;font-size:12.5px;color:var(--gold,#E8B84B)}
.tg-link span{font-size:11px;color:var(--ink-3,#7d8794)}
/* Boton grande de descarga del diagnostico completo (debajo de los 9 checks, bien visible) */
.tg-diag-dl{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;margin:12px 0 4px;padding:13px 14px;border-radius:12px;border:1px solid rgba(232,184,75,.4);background:linear-gradient(180deg,rgba(232,184,75,.16),rgba(232,184,75,.07));color:var(--gold,#E8B84B);font:800 13px/1 'Chakra Petch',var(--display,sans-serif);letter-spacing:.04em;cursor:pointer;opacity:.5;pointer-events:none;transition:opacity .25s,transform .15s,box-shadow .2s}
.tg-diag-dl.on{opacity:1;pointer-events:auto;box-shadow:0 0 0 1px rgba(232,184,75,.12),0 8px 22px -12px rgba(232,184,75,.5)}
.tg-diag-dl.on:hover{transform:translateY(-1px);background:linear-gradient(180deg,rgba(232,184,75,.24),rgba(232,184,75,.1))}
.tg-diag-dl:active{transform:translateY(0)}
.tg-diag-dl svg{width:16px;height:16px}
.tg-diag-dl.busy{opacity:.7;pointer-events:none}
/* DecFreedom top picks (reemplaza el Cross-check externo) */
.tg-tops{display:flex;flex-direction:column;gap:7px}
.tg-top{display:flex;align-items:center;gap:10px;width:100%;padding:9px 11px;border-radius:11px;border:1px solid var(--line,#232b36);background:linear-gradient(180deg,#0d1319,#0a0e13);cursor:pointer;text-align:left;transition:border-color .15s,transform .15s}
.tg-top:hover{border-color:#8f6a1a;transform:translateY(-1px)}
.tg-top .tg-logo,.tg-top .tm-logo{flex:0 0 auto}
.tg-top-id{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.tg-top-id b{font-family:'Chakra Petch',var(--display);font-weight:700;font-size:13px;color:var(--ink-1,#eaecef)}
.tg-top-id span{font-size:11px;color:var(--ink-3,#7d8794);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-top-liq{text-align:right;flex:0 0 auto}
.tg-top-liq b{display:block;font-family:'Chakra Petch',var(--display);font-weight:700;font-size:12.5px;color:#3DED8C}
.tg-top-liq span{font-size:10px;color:var(--ink-3,#7d8794)}
.tg-top-empty{padding:11px;border-radius:11px;border:1px dashed var(--line,#232b36);color:var(--ink-3,#7d8794);font-size:11.5px;text-align:center}
/* Historial del creador (defensa de entrada). */
.tg-creador{display:flex;flex-direction:column;gap:7px;padding:10px 11px;border-radius:11px;border:1px solid var(--line,#232b36);background:rgba(11,14,17,.72)}
.tg-creador.ok{border-color:rgba(46,232,106,.3);background:rgba(46,232,106,.06)}
.tg-creador.warn{border-color:rgba(232,184,75,.35);background:rgba(232,184,75,.07)}
.tg-creador.bad{border-color:rgba(246,70,93,.4);background:rgba(246,70,93,.09)}
.tg-cre-v{display:flex;align-items:center;gap:8px}
.tg-cre-v i{width:18px;height:18px;flex:0 0 auto;display:inline-flex}
.tg-cre-v i svg{width:18px;height:18px}
.tg-cre-v b{font-family:'Chakra Petch',var(--display);font-weight:700;font-size:12.5px;line-height:1.2;color:var(--ink,#eaecef)}
.tg-creador.ok .tg-cre-v i{color:#2ee86a}.tg-creador.warn .tg-cre-v i{color:var(--gold,#E8B84B)}.tg-creador.bad .tg-cre-v i{color:#ff7f93}
.tg-cre-list{display:flex;flex-wrap:wrap;gap:5px}
.tg-cre-tok{display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border-radius:7px;border:1px solid var(--line,#232b36);background:#0b0f14;font-family:var(--mono);font-size:10.5px;color:var(--ink-2,#b7bdc6);text-decoration:none}
.tg-cre-tok em{font-style:normal;font-size:9.5px;color:var(--ink-3,#7d8794)}
.tg-cre-tok.muerto{opacity:.74}.tg-cre-tok.muerto em{color:#ff9aa9}
.tg-cre-tok.vivo em{color:#8ef0b0}
.tg-cre-mut{font-family:var(--mono);font-size:11px;color:var(--ink-3,#7d8794)}
/* Check security: lista completa de verificaciones con palomita/cruz. */
.tg-checks{display:flex;flex-direction:column}
.tg-chk{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid rgba(255,255,255,.05);font-size:12px}
.tg-chk:first-child{border-top:0}
.tg-chk>span{display:flex;align-items:center;gap:8px;color:var(--ink-2,#c3c9d2)}
.tg-chk>span i{width:17px;height:17px;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-style:normal}
.tg-chk.ok>span i{color:var(--verde,#2ebd85);background:rgba(46,189,133,.14)}
.tg-chk.no>span i{color:var(--rojo,#f6465d);background:rgba(246,70,93,.14)}
.tg-chk>b{font-family:var(--mono);font-size:11.5px;font-weight:600;color:#eaecef}
.tg-chk.ok>b{color:var(--verde,#2ebd85)}
.tg-chk.no>b{color:#ff9aa9}
.tg-chk.pend>span{color:var(--ink-3,#7d8794)}
.tg-chk>span i svg{width:11px;height:11px;display:block}
/* Escaneo dramatico: cada check arranca con un giro + barra que corre, y se revela resolviendo a check/X. */
.tg-chk-sp{width:17px;height:17px;flex:0 0 auto;box-sizing:border-box;border-radius:50%;border:1.6px solid rgba(232,184,75,.22);border-top-color:var(--gold,#E8B84B);animation:tgSpin .7s linear infinite}
.tg-chk.scan>span{color:var(--ink-3,#7d8794)}
.tg-chk-bar{position:relative;width:52px;height:6px;border-radius:999px;background:rgba(255,255,255,.07);overflow:hidden;flex:0 0 auto}
.tg-chk-bar em{position:absolute;top:0;bottom:0;left:0;width:38%;border-radius:999px;background:linear-gradient(90deg,transparent,var(--gold,#E8B84B),transparent);animation:tgScanBar 1.05s ease-in-out infinite}
@keyframes tgScanBar{0%{transform:translateX(-130%)}100%{transform:translateX(330%)}}
.tg-chk.rev{animation:tgChkRev .36s cubic-bezier(.2,.8,.3,1)}
@keyframes tgChkRev{0%{opacity:0;transform:translateY(5px)}60%{opacity:1}100%{transform:none}}
.tg-chk.rev>span i{animation:tgChkPop .42s ease-out}
@keyframes tgChkPop{0%{transform:scale(.35)}55%{transform:scale(1.2)}100%{transform:scale(1)}}
.tg-sem.ok,.tg-sem.warn,.tg-sem.bad{animation:tgSemPop .5s cubic-bezier(.2,.8,.3,1)}
@keyframes tgSemPop{0%{transform:scale(.96);opacity:.45}100%{transform:none;opacity:1}}
.tg-sem.ok .tg-sem-ico svg,.tg-sem.warn .tg-sem-ico svg,.tg-sem.bad .tg-sem-ico svg{animation:tgChkPop .5s ease-out}
/* Open alerts y Positions SIN scroll propio: el panel derecho entero (.tg-right) es el unico scroll, asi al
   arrastrar la barra derecha se ven TODAS las alertas y TODAS las posiciones de corrido (lo que pidio el usuario:
   "si tengo 10 posiciones, poder hacer scroll y verlas todas, igual que las alertas"). El doble scroll anidado
   de antes atrapaba la rueda dentro de la caja de alertas y dejaba las posiciones fuera de vista. */
#tg-positions{min-height:0}
.tg-sem{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:13px;border:1px solid var(--line,#232b36);background:rgba(11,14,17,.72);margin-bottom:10px}
.tg-sem>div{flex:1 1 auto;min-width:0}
.tg-sem-ico{width:36px;height:36px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;line-height:0;background:rgba(255,255,255,.06);color:var(--ink-2,#b7bdc6)}
.tg-sem-ico svg{width:19px;height:19px;display:block;grid-area:1/1}
.tg-sem-ico .tg-anillo2{grid-area:1/1}
.tg-sem>div>b{display:block;font-family:'Chakra Petch',var(--display);font-weight:700;font-size:14px;color:var(--ink,#eaecef)}
.tg-sem>div>span{display:block;font-size:11.5px;color:var(--ink-3,#7d8794);margin-top:1px}
.tg-sem.ok{border-color:rgba(46,232,106,.35);background:rgba(46,232,106,.08)}.tg-sem.ok .tg-sem-ico{background:rgba(46,232,106,.18);color:#2ee86a}.tg-sem.ok b{color:#8ef0b0}
.tg-sem.warn{border-color:rgba(232,184,75,.4);background:rgba(232,184,75,.08)}.tg-sem.warn .tg-sem-ico{background:rgba(232,184,75,.18);color:var(--gold,#E8B84B)}.tg-sem.warn b{color:#f1cf6a}
.tg-sem.bad{border-color:rgba(246,70,93,.45);background:rgba(246,70,93,.1)}.tg-sem.bad .tg-sem-ico{background:rgba(246,70,93,.2);color:#ff7f93}.tg-sem.bad b{color:#ff9aa9}
.tg-sem.pend .tg-sem-ico{background:rgba(232,184,75,.1)}
.tg-sem.limited{border-color:var(--line,#232b36);background:rgba(255,255,255,.03)}
.tg-sem.limited .tg-sem-ico{background:rgba(255,255,255,.07);color:var(--ink-3,#7d8794)}
.tg-sem.limited>div>b{color:var(--ink-2,#b7bdc6)}
.tg-chk-note{font-family:var(--mono);font-size:11px;line-height:1.5;color:var(--ink-3,#7d8794);padding:8px 2px}
.tg-anillo2{display:block;width:18px;height:18px;border-radius:50%;border:2.5px solid rgba(232,184,75,.18);border-top-color:var(--gold,#E8B84B);animation:tgSpin .8s linear infinite}
.tg-sem .tg-pasos{display:flex;flex-wrap:wrap;align-items:center;gap:0 8px;line-height:16px;min-height:16px;margin-top:3px}
.tg-pasos u{text-decoration:none;display:inline-flex;align-items:center;white-space:nowrap}
.tg-pasos i{display:inline-block;width:10px;height:10px;border-radius:50%;border:1.5px solid rgba(255,255,255,.22);margin-right:4px;box-sizing:border-box;position:relative}
.tg-pasos i.run{border-color:rgba(232,184,75,.25);border-top-color:var(--gold,#E8B84B);animation:tgSpin .8s linear infinite}
.tg-pasos i.ok{border-color:#2ee86a;background:#2ee86a}
.tg-pasos i.ok::after{content:"";position:absolute;left:2px;top:3.5px;width:4px;height:2px;border-left:1.6px solid #0b0e11;border-bottom:1.6px solid #0b0e11;transform:rotate(-45deg)}
.tg-pasos i.fail{border-color:#ff7f93;background:rgba(246,70,93,.45)}
.tg-pasos em{font-style:normal;font-family:var(--mono);font-size:10px;color:var(--ink-3,#7d8794)}
.tg-pasos i.ok+em{color:#8ef0b0}
.tg-tabs2{display:flex;gap:6px}
.tg-tabs2 .t{flex:1 1 0;text-align:center;padding:9px;border-radius:10px;border:1px solid var(--line,#232b36);background:#0b0f14;font-family:'Chakra Petch',var(--display);font-weight:700;font-size:12px;color:var(--ink-2,#b7bdc6);cursor:pointer}
.tg-tabs2 .t.on{color:var(--gold,#E8B84B);border-color:#8f6a1a;background:linear-gradient(180deg,#1b2027,#0d1117)}
.tg-op{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.tg-op[hidden]{display:none}
.tg-mktcap{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:12px;border:1px solid var(--line,#232b36);background:linear-gradient(180deg,#0d1319,#0a0e13)}
.tg-mktcap b{font-family:var(--mono);font-size:19px;font-weight:700;color:var(--gold,#E8B84B);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .tg-mktcap b sub{font-size:.62em}
.tg-mktcap span{flex:0 0 auto;font-family:var(--mono);font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:var(--ink-3,#7d8794)}
.tg-op-lbl{font-family:var(--mono);font-size:11px;color:var(--ink-3,#7d8794)}
.tg-al-set{display:flex;align-items:center;gap:8px;position:relative}
.tg-al-set .tg-al-d{position:absolute;left:12px;color:var(--ink-3,#7d8794);font-family:var(--mono);font-size:13px}
.tg-al-set input{flex:1 1 auto;height:44px;padding:0 12px 0 24px;border-radius:11px;border:1px solid var(--line,#232b36);background:#0b0f14;color:var(--ink,#eaecef);font-family:var(--mono);font-size:14px;outline:none;min-width:0}
.tg-al-set input:focus{border-color:#8f6a1a}
.tg-al-hint{font-size:11px;color:var(--ink-3,#7d8794);line-height:1.5;margin-top:8px}
.tg-al-custom{display:flex;align-items:center;gap:8px;margin-top:8px}
.tg-al-custom .lb{font-family:var(--mono);font-size:11px;color:var(--ink-3,#7d8794);flex:0 0 auto}
.tg-al-custom input{flex:1 1 auto;min-width:0;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--line,#232b36);background:#0b0f14;color:var(--ink,#eaecef);font-family:var(--mono);font-size:13px;outline:none}
.tg-al-custom input:focus{border-color:#8f6a1a}
.tg-al-pctgo{flex:0 0 auto;height:38px;padding:0 14px;border-radius:10px;border:1px solid #8f6a1a;background:linear-gradient(180deg,#1b2027,#0d1117);color:var(--gold,#E8B84B);font-family:'Chakra Petch',var(--display);font-weight:700;font-size:12px;cursor:pointer}
.tg-al-pctgo:active{transform:translateY(1px)}
.tg-al-go{width:100%;height:48px;margin-top:11px;border-radius:12px;border:0;background:linear-gradient(180deg,#E8B84B,#b8862a);color:#1a1205;font-family:'Chakra Petch',var(--display);font-weight:800;font-size:15px;letter-spacing:.3px;cursor:pointer;box-shadow:0 4px 0 #5e4411,inset 0 1px 0 rgba(255,255,255,.3)}
.tg-al-go:active{transform:translateY(3px);box-shadow:0 1px 0 #5e4411}
.tg-al-go:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
.tg-al-presets{display:flex;gap:6px;margin-top:9px}
.tg-al-chip{flex:1;height:36px;border-radius:9px;border:1px solid var(--line,#232b36);background:#0b0f14;color:var(--ink-2,#b7bdc6);font-family:'Chakra Petch',var(--display);font-weight:700;font-size:12.5px;cursor:pointer;transition:border-color .15s,background .15s,transform .1s}
.tg-al-chip.up{color:#8ef0b0}.tg-al-chip.up:hover{border-color:rgba(46,232,106,.5);background:rgba(46,232,106,.1)}
.tg-al-chip.dn{color:#ff9aa9}.tg-al-chip.dn:hover{border-color:rgba(246,70,93,.5);background:rgba(246,70,93,.1)}
.tg-al-chip:active{transform:translateY(1px)}
.tg-mbtn{height:46px;border-radius:12px;border:0;font-family:'Chakra Petch',var(--display);font-weight:700;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.tg-mbtn.buy{background:linear-gradient(180deg,#2ebd85,#1f8f63);color:#04140c;box-shadow:0 4px 0 #0c4d35,inset 0 1px 0 rgba(255,255,255,.2)}
.tg-mbtn.buy:active{transform:translateY(3px);box-shadow:0 1px 0 #0c4d35}
.tg-mbtn.sec{flex:0 0 auto;height:44px;padding:0 16px;background:linear-gradient(180deg,#1b2027,#0d1117);color:var(--gold,#E8B84B);border:1px solid #8f6a1a;box-shadow:0 3px 0 #060809;font-size:13px}
.tg-mbtn.sec:active{transform:translateY(2px);box-shadow:0 1px 0 #060809}
.tg-balrow{display:flex;gap:8px;margin-top:12px}
.tg-bal{flex:1 1 0;display:flex;align-items:center;gap:8px;min-width:0;border:1px solid var(--line,#232b36);background:linear-gradient(180deg,#0d1319,#0a0e13);border-radius:11px;padding:8px 10px}
.tg-bal-ic{width:22px;height:22px;border-radius:50%;flex:0 0 auto;background:#0b0f14}
.tg-bal-tx{min-width:0}
.tg-bal-tx span{display:block;font-family:var(--mono);font-size:9px;letter-spacing:.4px;text-transform:uppercase;color:var(--ink-3,#7d8794)}
.tg-bal-tx b{font-family:var(--mono);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-mt{margin-top:16px}
.tg-alrow{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;border:1px solid var(--line,#232b36);background:#0b0f14;margin-bottom:6px}
.tg-alrow:not(.cur){cursor:pointer}
.tg-alrow:not(.cur):hover{border-color:rgba(232,184,75,.45);background:#0e141b}
.tg-alrow.cur{border-color:rgba(232,184,75,.4);background:#0e141b}
.tg-alsym{flex:0 0 auto;max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800;font-size:12px;letter-spacing:.2px;color:var(--ink,#e8edf2)}
.tg-alrow b{flex:1 1 auto;text-align:right;font-family:var(--mono);font-size:13px}
.tg-alrow em{font-style:normal;font-size:10px;color:var(--verde,#2ee86a);text-transform:uppercase;letter-spacing:.5px}
.tg-alrow.done{border-color:#2e7d52}
.tg-alrow.done .tg-alsym{opacity:.6}
.tg-aldir{width:0;height:0;flex:0 0 auto;border-left:5px solid transparent;border-right:5px solid transparent}
.tg-aldir.up{border-bottom:8px solid var(--verde,#2ee86a)}
.tg-aldir.down{border-top:8px solid var(--rojo,#f6465d)}
.tg-alx{background:none;border:0;color:var(--ink-3,#7d8794);font-size:12px;cursor:pointer;padding:2px 4px;flex:0 0 auto}
.tg-alx:hover{color:var(--rojo,#f6465d)}
.tg-posrow{position:relative;display:flex;align-items:stretch;gap:10px;padding:12px 13px;border-radius:14px;border:1px solid var(--line,#232b36);background:linear-gradient(180deg,#10171f,#0a0e13);margin-bottom:8px;cursor:pointer;border-left:3px solid #3a434f;overflow:hidden;transition:background .12s,transform .1s}
.tg-posrow::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;background:radial-gradient(120% 90% at 50% 120%,rgba(57,214,127,.08),transparent 60%)}
.tg-posrow.down::after{background:radial-gradient(120% 90% at 50% 120%,rgba(246,88,108,.07),transparent 60%)}
.tg-posrow.up{border-left-color:var(--verde,#2ee86a)} .tg-posrow.down{border-left-color:var(--rojo,#f6465d)}
.tg-posrow:hover{background:linear-gradient(180deg,#14202a,#0d1219);transform:translateY(-1px)}
.tg-posrow>*{position:relative;z-index:1}
.tg-posL{flex:0 0 94px;display:flex;align-items:center;gap:8px;min-width:0}
.tg-posL .tg-logo{width:28px;height:28px;flex:0 0 auto} .tg-posL .tg-logo-fb{padding:6px}
.tg-pos-id{min-width:0;display:flex;flex-direction:column;gap:3px}
.tg-pos-id>b{font-size:13px;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-pos-ca{display:inline-flex;align-items:center;gap:3px;max-width:100%;font-family:var(--mono);font-size:9.5px;color:var(--ink-3,#7d8794);background:none;border:0;padding:0;cursor:pointer;white-space:nowrap}
.tg-pos-ca svg{width:11px;height:11px;flex:0 0 auto;opacity:.7}
.tg-pos-ca:hover{color:var(--gold,#E8B84B)}
.tg-posDiv{flex:0 0 1px;align-self:stretch;margin:9px 2px;background:linear-gradient(to bottom,transparent,rgba(255,255,255,.16) 30%,rgba(255,255,255,.16) 70%,transparent)}
.tg-posC{flex:1 1 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0}
.tg-posC .pc{font-family:'Chakra Petch',var(--display);font-weight:800;font-size:26px;line-height:1;letter-spacing:-.5px}
.tg-posC.up .pc{color:#3ddc84;text-shadow:0 2px 4px rgba(0,0,0,.75),0 0 18px rgba(46,232,106,.32)}
.tg-posC.down .pc{color:#ff5c6c;text-shadow:0 2px 4px rgba(0,0,0,.75),0 0 18px rgba(246,70,93,.28)}
.tg-posC .gain{font-family:var(--mono);font-size:11.5px;font-weight:600;margin-top:4px}
.tg-posC.up .gain{color:#3ddc84} .tg-posC.down .gain{color:#ff5c6c}
.tg-posR{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;justify-content:center}
.tg-posR b{font-family:var(--mono);font-size:13px;font-weight:600;color:#eaecef;line-height:1}
.tg-posR span{font-family:var(--mono);font-size:9px;letter-spacing:.5px;text-transform:uppercase;color:var(--ink-3,#7d8794);margin-top:3px}
.tg-soon{font-size:11px;color:var(--ink-3,#7d8794);text-align:center;line-height:1.5;margin-top:2px}
/* ====== Posiciones full-width del OFC: seccion + tarjeta (replica aprobada, prefijo pcd) ====== */
.tm-big-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(232,184,75,.3) transparent}
.tm-big-scroll::-webkit-scrollbar{width:9px}.tm-big-scroll::-webkit-scrollbar-thumb{background:rgba(232,184,75,.3);border-radius:4px}
.tg-posfull{padding:24px 28px 40px;display:flex;flex-direction:column;gap:16px;border-top:1px solid var(--line,#232b36);background:linear-gradient(180deg,#070a0e,#05070a)}
.tg-posfull-h{display:flex;align-items:center;gap:10px}
.tg-posfull-h .ic{width:18px;height:18px;color:var(--gold,#E8B84B);display:inline-flex;flex:0 0 auto}.tg-posfull-h .ic svg{width:100%;height:100%}
.tg-posfull-h b{font-family:'Chakra Petch',var(--display,sans-serif);font-weight:700;font-size:16px;color:#eaecef}
.tg-posfull-h .sub{font-family:var(--mono);font-size:11px;color:var(--ink-3,#7d8794);margin-left:3px}
#tg-positions{display:flex;flex-direction:column;gap:16px}
.pcd{--c:#00F5C0;--c-soft:#1BE8AD;--cr:0,245,192;position:relative;display:flex;align-items:stretch;border-radius:22px;padding:20px 24px;background:linear-gradient(180deg,#070d13,#03080d);border:1px solid rgba(var(--cr),.14);box-shadow:0 20px 50px -30px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.03),inset 0 0 0 1px rgba(var(--cr),.04);overflow:hidden;cursor:pointer;transition:transform .12s,border-color .15s}
.pcd:hover{transform:translateY(-1px);border-color:rgba(var(--cr),.3)}
.pcd::before{content:"";position:absolute;top:0;left:8%;right:8%;height:1px;background:linear-gradient(90deg,transparent,rgba(var(--cr),.5),transparent);opacity:.7}
.pcd.down{--c:#FF385F;--c-soft:#FF5C77;--cr:255,56,95}
.pcd-id{flex:0 0 27%;display:flex;align-items:center;gap:16px;padding-right:20px;min-width:0}
.pcd-logo{position:relative;flex:0 0 auto;width:84px;height:84px;border-radius:50%;padding:4px;background:conic-gradient(from 150deg,rgba(var(--cr),.9),rgba(var(--cr),.25),rgba(var(--cr),.9));box-shadow:0 0 20px -2px rgba(var(--cr),.55),inset 0 0 0 1px rgba(var(--cr),.3)}
.pcd-logo>span{display:block;width:100%;height:100%;border-radius:50%;overflow:hidden;background:#0a1016}
.pcd-logo .tg-logo{width:100%!important;height:100%!important;border-radius:50%}
.pcd-logo img{width:100%;height:100%;object-fit:cover;border-radius:50%}
.pcd-idtx{min-width:0;display:flex;flex-direction:column;gap:5px}
.pcd-nm{display:flex;align-items:center;gap:8px;min-width:0}
.pcd-nm b{flex:0 1 auto;min-width:0;max-width:100%;font-weight:800;font-size:25px;letter-spacing:.3px;color:#F6FBFF;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcd-ext{width:16px;height:16px;flex:0 0 auto;color:#5d6773;display:inline-flex}.pcd-ext svg{width:100%;height:100%}
.pcd-sub{max-width:100%;font-size:14px;color:#8A96A2;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcd-new{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;margin-top:2px;padding:4px 11px 4px 9px;border-radius:999px;font-weight:700;font-size:12.5px;color:var(--c-soft);background:rgba(var(--cr),.08);border:1px solid rgba(var(--cr),.3)}
.pcd-new svg{width:13px;height:13px}
.pcd-pair{display:flex;align-items:center;gap:8px;margin-top:4px;font-size:14px;color:#C3CCD6;font-weight:600}
.pcd-coin{display:inline-flex;align-items:center;gap:6px}
.pcd-cimg{width:18px;height:18px;border-radius:50%;flex:0 0 auto;overflow:hidden;position:relative;background:#0a1016;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.pcd-cimg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pcd-cimg.bnb{background:radial-gradient(circle at 35% 30%,#ffe08a,#FFD050)}
.pcd-cimg.usdt{background:radial-gradient(circle at 35% 30%,#4fd1a5,#26A17B)}
.pcd-cimg .tg-logo{width:100%!important;height:100%!important;border:0;border-radius:50%}
.pcd-arrow{color:#8A96A2;font-size:15px}
.pcd-vdiv{flex:0 0 1px;align-self:stretch;margin:6px 0;background:linear-gradient(to bottom,transparent,rgba(var(--cr),.28) 20%,rgba(var(--cr),.28) 80%,transparent)}
.pcd-stats{flex:0 0 21%;display:flex;flex-direction:column;justify-content:center;gap:11px;padding:0 22px;min-width:0}
.pcd-kv{display:flex;flex-direction:column;gap:3px;min-width:0}
.pcd-kv .lbl{font-size:13px;color:#8A96A2;line-height:1}
.pcd-kv b{font-family:var(--mono);font-size:19px;font-weight:600;color:#F6FBFF;line-height:1.1;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcd-kv b sub{font-size:.62em;vertical-align:-.1em}
.pcd-hdiv{height:1px;background:linear-gradient(90deg,rgba(var(--cr),.28),transparent);margin:2px 0}
.pcd-qty{display:flex;gap:24px}
.pcd-qty .pcd-kv b{font-size:16px}
.pcd-pnl{flex:0 0 24%;display:flex;flex-direction:column;justify-content:space-between;margin:0 2px;padding:16px 20px;border-radius:18px;background:radial-gradient(130% 120% at 30% 10%,rgba(var(--cr),.1),rgba(var(--cr),.02));border:1px solid rgba(var(--cr),.45);box-shadow:0 0 26px -6px rgba(var(--cr),.4),inset 0 0 30px -10px rgba(var(--cr),.3)}
.pcd-pnl-h{align-self:flex-start;display:flex;align-items:center;gap:8px;font-size:18px;font-weight:600;color:var(--c-soft)}
.pcd-pnl-h svg{width:19px;height:19px}
.pcd-pnl-pct{align-self:center;font-weight:800;font-size:56px;line-height:1;letter-spacing:-1.5px;color:var(--c);text-shadow:0 2px 10px rgba(0,0,0,.5),0 0 30px rgba(var(--cr),.45);white-space:nowrap}
.pcd-pnl-usd{align-self:flex-start;font-weight:700;font-size:23px;color:var(--c-soft);letter-spacing:-.3px}
.pcd-right{flex:1 1 auto;position:relative;min-width:0;align-self:stretch;margin-left:28px}
.pcd-right::before{content:"";position:absolute;left:0;top:6%;bottom:6%;width:2px;border-radius:2px;background:linear-gradient(to bottom,transparent,rgba(var(--cr),.7) 13%,rgba(var(--cr),.6) 50%,rgba(var(--cr),.7) 87%,transparent);box-shadow:0 0 10px rgba(var(--cr),.4)}
.pcd-age{position:absolute;top:20px;right:24px;z-index:4;display:inline-flex;align-items:center;gap:9px;padding:7px 13px;border-radius:14px;background:rgba(10,14,20,.78);backdrop-filter:blur(3px);border:1px solid rgba(255,255,255,.07)}
.pcd-age svg{width:16px;height:16px;color:#8A96A2;flex:0 0 auto}
.pcd-age span{display:flex;flex-direction:column;line-height:1.25}
.pcd-age .l{font-size:11px;color:#8A96A2}.pcd-age .v{font-size:13px;color:#F6FBFF;font-weight:600}
.pcd-base{position:absolute;left:0;right:6%;bottom:13%;height:1.5px;border-radius:2px;background:linear-gradient(90deg,rgba(var(--cr),.6),rgba(var(--cr),.22),transparent);box-shadow:0 0 6px rgba(var(--cr),.22)}
.pcd-chart{position:absolute;left:28px;right:6%;top:27%;bottom:13%;overflow:visible}
.pcd-spark-svg{position:absolute;inset:0;width:100%;height:100%}
.pcd-dot-end{position:absolute;right:0;width:11px;height:11px;border-radius:50%;background:radial-gradient(circle at 40% 36%,#fff,var(--c));box-shadow:0 0 11px 2px rgba(var(--cr),.9);transform:translateY(-50%)}
.pcd-status{position:absolute;bottom:0;right:0;display:inline-flex;align-items:center;gap:8px;padding:6px 13px;border-radius:999px;background:rgba(var(--cr),.07);border:1px solid rgba(var(--cr),.2);font-size:13px;font-weight:600;color:#C3CCD6}
.pcd-status i{width:9px;height:9px;border-radius:50%;background:var(--c);box-shadow:0 0 10px 1px rgba(var(--cr),.8);flex:0 0 auto}
@media(max-width:820px){
  .tg-posfull{padding:16px 13px 26px}
  .pcd{flex-wrap:wrap;padding:16px 16px}
  .pcd-id{flex:1 1 100%;order:1;padding-right:0;min-width:0}
  .pcd-age{top:14px;right:14px;padding:6px 11px}
  .pcd-logo{width:60px;height:60px}
  .pcd-idtx{flex:1 1 auto;min-width:0}
  .pcd-nm b{font-size:20px}.pcd-sub{font-size:13px}
  .pcd-nm,.pcd-sub{max-width:calc(100% - 104px)}
  .pcd-pair{flex-wrap:nowrap;white-space:nowrap}
  .pcd-vdiv{display:none}
  .pcd-pnl{flex:1 1 100%;order:2;margin:14px 0 0;padding:14px 18px;min-width:0}
  .pcd-pnl-pct{font-size:clamp(34px,13vw,50px)}
  .pcd-stats{flex:1 1 100%;order:3;display:grid;grid-template-columns:1fr 1fr;gap:15px 14px;padding:16px 0 0;min-width:0}
  .pcd-qty{display:contents}
  .pcd-stats .pcd-kv{align-items:center;text-align:center;width:100%;min-width:0;max-width:100%}
  .pcd-hdiv{display:none}
  .pcd-right{flex:1 1 100%;order:4;margin:14px 0 0;min-height:118px}
}
.tg-pick{position:absolute;top:66px;left:50%;transform:translateX(-50%);width:min(520px,92vw);max-height:62vh;overflow:auto;background:#0b0f14;border:1px solid #2a323d;border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.6);z-index:5;padding:8px}
.tg-pick-h{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 10px;font-family:var(--mono);font-size:11px;color:var(--ink-3,#7d8794)}
.tg-pick-row{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:10px;cursor:pointer}
.tg-pick-row:hover{background:#121823}
.tg-pick-row .tg-logo{width:30px;height:30px}
.tg-pick-row .nm{min-width:0;flex:1 1 auto}
.tg-pick-row .nm b{display:block;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-pick-row .nm span{display:block;font-family:var(--mono);font-size:10px;color:var(--ink-3,#7d8794)}
.tg-pick-row .pr{text-align:right;font-family:var(--mono);font-size:12px;color:var(--gold,#E8B84B);flex:0 0 auto}
.tg-pick-empty{padding:26px 10px;text-align:center;color:var(--ink-3,#7d8794);font-size:12px}
.tg-pick-res{justify-content:flex-start;cursor:default}
.tg-pick-reslbl{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--ink-3,#7d8794)}
.tg-pick-anillo{width:13px;height:13px;flex:0 0 auto;border-radius:50%;border:2px solid rgba(232,184,75,.22);border-top-color:var(--gold,#E8B84B);animation:tgSpin .8s linear infinite}
.tg-anillo{width:34px;height:34px;border-radius:50%;border:3px solid #1c232b;border-top-color:var(--gold,#E8B84B);animation:tgSpin .8s linear infinite}
@keyframes tgSpin{to{transform:rotate(360deg)}}
.tg-ctx{position:fixed;z-index:1300;min-width:206px;background:#0b0f14;border:1px solid #2a323d;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.6);padding:12px;animation:tgIn .12s ease}
.tg-ctx-px{font-family:var(--mono);font-size:17px;font-weight:700;color:var(--gold,#E8B84B)} .tg-ctx-px sub{font-size:.62em}
.tg-ctx-pc{font-family:var(--mono);font-size:12px;margin:3px 0 10px} .tg-ctx-pc.up{color:var(--verde,#2ee86a)} .tg-ctx-pc.down{color:var(--rojo,#f6465d)}
.tg-ctx-pos{font-family:var(--mono);font-size:11px;margin:0 0 10px;padding:7px 9px;border-radius:9px;background:#0e141b;border:1px solid var(--line,#232b36)}
.tg-ctx-pos.up{color:#3ddc84} .tg-ctx-pos.down{color:#ff5c6c}
.tg-ctx-btns{display:flex;gap:7px}
.tg-ctx-b{flex:1 1 0;height:37px;border-radius:10px;border:1px solid;font-family:'Chakra Petch',var(--display);font-weight:700;font-size:13px;cursor:pointer}
.tg-ctx-b.alert{background:linear-gradient(180deg,#1b2027,#0d1117);color:var(--gold,#E8B84B);border-color:#8f6a1a}
.tg-ctx-b.buy{background:linear-gradient(180deg,#2ebd85,#1f8f63);color:#04140c;border-color:#1f8f63}
.tg-ctx-b.sell{background:linear-gradient(180deg,#f6465d,#c42d41);color:#fff;border-color:#c42d41}
.tg-ctx-b:active{transform:translateY(1px)}
.tg-buy-cur{display:flex;gap:7px}
.tg-buy-c{flex:1 1 0;height:38px;border-radius:10px;border:1px solid var(--line,#232b36);background:#0d1117;color:var(--ink-2,#b7bdc6);font-family:'Chakra Petch',var(--display);font-weight:700;font-size:13px;cursor:pointer}
.tg-buy-c.on{color:var(--gold,#E8B84B);border-color:#8f6a1a;background:linear-gradient(180deg,#1b2027,#0d1117)}
.tg-buy-c:disabled{opacity:.4;cursor:not-allowed;font-size:11px}
.tg-buy-amtrow{display:flex;align-items:center;justify-content:space-between;font-family:var(--mono);font-size:11px;color:var(--ink-3,#7d8794)}
.tg-buy-amtrow b{font-size:17px;font-weight:700;color:var(--ink,#eaecef)}
.tg-buy-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:999px;background:#1c232b;margin:2px 0;outline:none}
.tg-buy-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:var(--gold,#E8B84B);border:2px solid #0b0f14;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.tg-buy-slider::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--gold,#E8B84B);border:2px solid #0b0f14;cursor:pointer}
.tg-buy-get{padding:11px;border-radius:11px;background:#0e141b;border:1px solid var(--line,#232b36);font-family:var(--mono);font-size:12px;color:var(--ink-3,#7d8794);text-align:center}
.tg-buy-get b{color:var(--ink,#eaecef);font-size:14px}
.tg-buy-go{width:100%;height:46px;margin-top:2px;border-radius:12px;border:0;background:linear-gradient(180deg,#2ebd85,#1f8f63);color:#04140c;font-family:'Chakra Petch',var(--display);font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 4px 0 #0c4d35,inset 0 1px 0 rgba(255,255,255,.2)}
.tg-buy-go:active{transform:translateY(3px);box-shadow:0 1px 0 #0c4d35}
.tg-buy-go:disabled{opacity:.55;cursor:not-allowed;box-shadow:none;filter:grayscale(.3)}
/* Presets de compra (un toque). */
.tg-buy-presets{display:flex;gap:6px;margin-top:2px}
.tg-buy-presets button{flex:1 1 0;padding:7px 4px;border-radius:9px;border:1px solid var(--line,#232b36);background:#0b0f14;color:var(--ink-2,#b7bdc6);font-family:var(--mono);font-size:11.5px;font-weight:600;cursor:pointer;transition:border-color .13s,color .13s}
.tg-buy-presets button:hover{color:var(--ink,#eaecef)}
.tg-buy-presets button.on{border-color:#8f6a1a;color:var(--gold,#E8B84B);background:linear-gradient(180deg,#1b2027,#0d1117)}
/* Compra protegida (anti sandwich): toggle, medidor de riesgo de bot, slippage y RPC privado. */
.tg-prot{margin-top:4px;border:1px solid var(--line,#232b36);border-radius:11px;background:rgba(11,14,17,.5);padding:9px 10px;display:flex;flex-direction:column;gap:8px}
.tg-prot-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.tg-prot-tog{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
.tg-prot-tog input{position:absolute;opacity:0;width:0;height:0}
.tg-prot-sw{width:34px;height:19px;border-radius:999px;background:#2a323c;position:relative;transition:background .15s;flex:0 0 auto}
.tg-prot-sw::after{content:"";position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:transform .15s}
.tg-prot-tog input:checked+.tg-prot-sw{background:#2ebd85}
.tg-prot-tog input:checked+.tg-prot-sw::after{transform:translateX(15px)}
.tg-prot-tog b{font-family:'Chakra Petch',var(--display);font-weight:700;font-size:12.5px}
.tg-prot-meter{font-family:var(--mono);font-size:11px;font-weight:600}
.tg-prot-meter.ok{color:#2ee86a}.tg-prot-meter.warn{color:var(--gold,#E8B84B)}.tg-prot-meter.bad{color:#ff7f93}
.tg-prot-slip{display:flex;gap:5px}
.tg-prot-slip[hidden]{display:none}
.tg-prot-slip button{flex:1 1 0;padding:5px;border-radius:8px;border:1px solid var(--line,#232b36);background:#0b0f14;color:var(--ink-3,#7d8794);font-family:var(--mono);font-size:11px;cursor:pointer}
.tg-prot-slip button.on{border-color:#8f6a1a;color:var(--gold,#E8B84B);background:linear-gradient(180deg,#1b2027,#0d1117)}
.tg-prot-note{font-family:var(--mono);font-size:10px;line-height:1.45;color:var(--ink-3,#7d8794)}
.tg-buy-msg{font-family:var(--mono);font-size:11.5px;line-height:1.5;text-align:center}
.tg-buy-msg.ok{color:var(--verde,#2ee86a)} .tg-buy-msg.bad{color:var(--rojo,#f6465d)} .tg-buy-msg a{color:var(--gold,#E8B84B)}
/* Sello del Security Check: imagen (verde=seguro, rojo=riesgo) con el % del token y boton de guardar/compartir.
   Sustituye al texto Safe/Caution/Do not buy en el mismo sitio. El % y los textos se dibujan en canvas. */
.tg-sello-wrap{margin-bottom:10px}
.tg-sello{position:relative;border-radius:13px;overflow:hidden;border:1px solid var(--line,#232b36);background:#070a0d;line-height:0;box-shadow:0 3px 16px rgba(0,0,0,.4)}
.tg-sello.ok{border-color:rgba(61,237,140,.42)}
.tg-sello.risk{border-color:rgba(255,67,87,.46)}
.tg-sello-cv{display:block;width:100%;height:auto;opacity:0;transition:opacity .5s ease}
.tg-sello.ready .tg-sello-cv{opacity:1}
.tg-sello-sk{position:absolute;inset:0;display:grid;place-items:center;min-height:120px;color:var(--ink-3,#7d8794)}
.tg-sello.ready .tg-sello-sk{display:none}
.tg-sello-dl{position:absolute;right:7px;bottom:7px;display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(8,11,14,.66);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#eaecef;font:700 10px/1 'Chakra Petch',var(--display,sans-serif);letter-spacing:.02em;cursor:pointer;opacity:0;transition:opacity .3s ease,transform .15s ease,background .15s ease}
.tg-sello.ready .tg-sello-dl{opacity:1}
.tg-sello-dl:hover{background:rgba(18,22,26,.86);transform:translateY(-1px)}
.tg-sello-dl:active{transform:translateY(0)}
.tg-sello-dl:disabled{opacity:0;pointer-events:none}
.tg-sello-dl svg{width:12px;height:12px}
.tg-sello.ok .tg-sello-dl{border-color:rgba(61,237,140,.4)}
.tg-sello.risk .tg-sello-dl{border-color:rgba(255,67,87,.42)}
.tg-sello-cap{margin:7px 3px 0;font:600 11px/1.45 var(--display,sans-serif);color:var(--ink-3,#7d8794);text-align:center}
.tg-sello-cap b{font-weight:800;color:var(--ink-2,#b7bdc6)}
.tg-sello-cap.ok b{color:#3DED8C}
.tg-sello-cap.risk b{color:#ff6475}
@media(max-width:860px){
  .tm-big-top{grid-template-columns:auto minmax(0,1fr) auto}
  .tg-top-l{gap:8px;padding:10px}.tg-find{padding:10px 6px}.tg-top-r{padding:10px;gap:8px}
  .tg-price{display:none}
  .tm-big-main{grid-template-columns:1fr;grid-auto-rows:minmax(0,auto)}
  .tg-left,.tg-right{max-height:none}
  .tg-chart{min-height:300px}
}`;
  document.head.appendChild(st);
}

/* ── Resolver un token por contrato: primero en el feed; si no, por el resolvedor COMPARTIDO (el mismo que
   usa el lobby), que consulta los pares con WBNB y con USDT y se queda con el de MAS liquidez. Antes aqui se
   tomaba el primer par que existiera, por eso tokens como USDT.z (par WBNB muerto) no mostraban grafica. ── */
async function resolver(q, feed) {
  const s = String(q || '').trim(); if (!s) return null;
  const low = s.toLowerCase();
  const f = feed || [];
  // 1) En el feed: por contrato exacto, o por SIMBOLO/NOMBRE (igual que el buscador del lobby). Antes aqui se
  //    hacia ethers.getAddress(), que lanzaba con nombres, simbolos y direcciones Tron -> la busqueda del OFC
  //    solo funcionaba pegando un 0x exacto y jamas llegaba al resolvedor global/Tron. Esa era la causa raiz.
  let hit = f.find((x) => x.token && x.token.toLowerCase() === low);
  if (!hit) { const ex = f.filter((x) => (x.simbolo || '').toLowerCase() === low || (x.nombre || '').toLowerCase() === low); if (ex.length) hit = ex.sort((a, b) => (b.liquidez || 0) - (a.liquidez || 0))[0]; }
  if (!hit) { const pa = f.filter((x) => (x.simbolo || '').toLowerCase().includes(low) || (x.nombre || '').toLowerCase().includes(low)); if (pa.length) hit = pa.sort((a, b) => (b.liquidez || 0) - (a.liquidez || 0))[0]; }
  if (hit) return hit;
  // 2) Un CONTRATO que no esta en el feed (BSC 0x… o Tron T…): resolvedor COMPARTIDO (global y multicadena).
  if (esContrato(s)) return await resolverContrato(s);
  return null;
}

let _ov = null, _cargar = null, _precioUsd = 0, _itActual = null, _ctx = null, _velasRawBig = null, _tfSecBig = 60, _abrirAlerta = false, _chartFuente = 'v2', _posTimer = null;
/* Respaldo de grafica por GeckoTerminal (Tron / tokens sin par V2). Modulo-nivel para que lo use tanto la carga
   del token como el cambio de temporalidad. Guarda contra _itActual para descartar respuestas de otro token. */
async function cargarVelasGecko(it) {
  if (!it) return;
  const msg = $('tg-chart-msg'); if (msg && !(_velasRawBig && _velasRawBig.length)) { msg.hidden = false; msg.innerHTML = '<span class="tg-anillo"></span>'; }
  try {
    const { velasGecko } = await import('./gecko.js');
    const velas = await velasGecko(it.token, it.red, _tfSecBig);
    if (_itActual !== it) return;
    _chartFuente = 'gecko';
    _velasRawBig = (velas && velas.length) ? velas : [];
    renderChartBig();
  } catch (_) { if (_itActual === it) { if (!(_velasRawBig && _velasRawBig.length)) _velasRawBig = []; renderChartBig(); } }
}
export async function abrirGrande(it0, ctx, opts) {
  ctx = ctx || {};
  _ctx = ctx;
  _abrirAlerta = !!(opts && opts.alerta);   // la campanita / "Alerts" abren el OFC directo en la pestaña Alert
  const bnbUsd = () => (ctx.bnbUsd ? ctx.bnbUsd() : 0);
  const feed = () => (ctx.items ? ctx.items() : []);
  css();
  cerrar();
  const ov = document.createElement('div'); ov.id = 'tm-big-ov'; ov.className = 'tm-big'; _ov = ov;
  ov.innerHTML = `
    <div class="tm-big-top">
      <div class="tg-top-l"><div class="tg-id" id="tg-id"></div><div class="tg-price" id="tg-price"></div></div>
      <div class="tg-find"><div class="tg-find-in"><span class="tg-ico">${ICO_SEARCH}</span><input id="tg-find-in" type="text" autocomplete="off" spellcheck="false" placeholder="Search token, symbol or contract (BSC / Tron)…"></div></div>
      <div class="tg-top-r"><div class="tg-sub-pill" id="tg-sub-pill" hidden></div><button class="tg-find-tok" id="tg-find-tok" type="button">Tokens</button><button class="tg-x" id="tg-close" type="button" aria-label="Close">✕</button></div>
    </div>
    <div class="tm-big-scroll">
      <div class="tm-big-main">
        <div class="tg-col tg-left" id="tg-left"></div>
        <div class="tg-col tg-chart"><div class="tg-chart-cv" id="tg-chart-cv"></div><img class="tg-wm" src="../../branding/decfreedomlogohorizontal.webp" onerror="this.onerror=null;this.src='../../assets/img/cco-full.webp'" alt=""><div class="tg-tools"><button class="tg-tool" id="tg-ruler" type="button" title="Measure % and range">${ICO_RULER}</button><div class="tg-tf" id="tg-tf">${[['60', '1m'], ['300', '5m'], ['900', '15m'], ['3600', '1h'], ['14400', '4h'], ['86400', '1d']].map(([s, l]) => `<button data-sec="${s}" type="button"${Number(s) === _tfSecBig ? ' class="on"' : ''}>${l}</button>`).join('')}</div></div><div class="tg-mdcapture" id="tg-mdcap" hidden></div><div class="tg-mdbox" id="tg-mdbox" hidden></div><div class="tg-chart-msg" id="tg-chart-msg"><span class="tg-anillo"></span></div></div>
        <div class="tg-col tg-right" id="tg-right"></div>
      </div>
      <section class="tg-posfull">
        <div class="tg-posfull-h"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-7"/><path d="M14 4h7v7"/></svg></span><b>Your positions</b><span class="sub" id="tg-posfull-sub"></span></div>
        <div id="tg-positions"><div class="tg-soon">Connect your wallet to see your live positions here.</div></div>
      </section>
    </div>`;
  document.body.appendChild(ov);

  $('tg-close').onclick = cerrar;
  document.addEventListener('keydown', onEsc);
  _cargar = cargar;
  // Clic derecho en la grafica: poner una alerta al precio del clic (solo alertas, nunca compra).
  const cvEl = $('tg-chart-cv');
  if (cvEl) cvEl.addEventListener('contextmenu', (e) => {
    if (!_itActual || !_itActual.par) return;
    e.preventDefault();
    const rect = cvEl.getBoundingClientRect();
    let px = null; try { px = precioEnY(e.clientY - rect.top); } catch (_) {}
    if (px != null && px > 0 && isFinite(px)) abrirCtx(e.clientX, e.clientY, Number(px));
  });

  // Regla de medicion (estilo TradingView): un overlay captura el arrastre y mide el % y el rango de precio.
  const ruler = $('tg-ruler'), cap = $('tg-mdcap'), mdbox = $('tg-mdbox');
  let _mdStart = null;
  const dibujarMd = (x2, y2) => {
    if (!_mdStart || !mdbox) return;
    const x1 = _mdStart.x, y1 = _mdStart.y;
    const left = Math.min(x1, x2), top = Math.min(y1, y2), wdt = Math.max(1, Math.abs(x2 - x1)), hgt = Math.max(1, Math.abs(y2 - y1));
    let p1 = 0, p2 = 0; try { p1 = Number(precioEnY(y1)) || 0; p2 = Number(precioEnY(y2)) || 0; } catch (_) {}
    mdbox.className = 'tg-mdbox ' + (p2 >= p1 ? 'up' : 'down');
    mdbox.style.left = left + 'px'; mdbox.style.top = top + 'px'; mdbox.style.width = wdt + 'px'; mdbox.style.height = hgt + 'px';
    if (p1 > 0 && p2 > 0) { const chg = (p2 - p1) / p1 * 100; mdbox.innerHTML = `<span class="tg-md-lbl">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}% · $${fmtTxt(Math.min(p1, p2))} → $${fmtTxt(Math.max(p1, p2))}</span>`; }
    else mdbox.innerHTML = '';
  };
  if (ruler && cap) ruler.onclick = () => { const on = !ruler.classList.contains('on'); ruler.classList.toggle('on', on); cap.hidden = !on; if (!on && mdbox) { mdbox.hidden = true; _mdStart = null; } };
  if (cap) cap.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; e.preventDefault();
    const r = cap.getBoundingClientRect(); _mdStart = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (mdbox) mdbox.hidden = false; dibujarMd(_mdStart.x, _mdStart.y);
    const mv = (ev) => { const rr = cap.getBoundingClientRect(); dibujarMd(ev.clientX - rr.left, ev.clientY - rr.top); };
    const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
  });

  // Temporalidades (mismo set que el grafico del lobby): reagrupan las velas crudas en cubos de tiempo,
  // sin volver a llamar al RPC. Al cambiar, se limpia cualquier medicion de la regla (sus coordenadas cambian).
  const tfBox = $('tg-tf');
  if (tfBox) tfBox.querySelectorAll('button').forEach((b) => { b.onclick = () => {
    _tfSecBig = Number(b.dataset.sec) || 60;
    tfBox.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    if (mdbox) mdbox.hidden = true;
    // V2: reagrupa las velas en cache sin re-llamar. GeckoTerminal: el timeframe es otra consulta, hay que pedirla.
    if (_chartFuente === 'gecko' && _itActual) cargarVelasGecko(_itActual);
    else renderChartBig();
  }; });

  // Selector de tokens del feed (lista estilo New pairs que carga en la grafica).
  const togglePicker = () => {
    { const sr = $('tg-sresults'); if (sr) sr.remove(); }   // cierra resultados de busqueda viva para no solapar
    const prev = $('tg-pick'); if (prev) { prev.remove(); return; }
    const lista = feed().filter((x) => x.par && (x.liquidez > 0 || x.precio > 0))
      .sort((a, b) => ((b.moneda === 'USDT' ? b.liquidez : b.liquidez * bnbUsd()) - (a.moneda === 'USDT' ? a.liquidez : a.liquidez * bnbUsd())));
    const pick = document.createElement('div'); pick.className = 'tg-pick'; pick.id = 'tg-pick';
    const filas = lista.slice(0, 40).map((x) => {
      const pu = x.moneda === 'USDT' ? x.precio : x.precio * bnbUsd();
      return `<div class="tg-pick-row" data-a="${esc(x.token)}">${logo(x.token)}<div class="nm"><b>${esc(x.simbolo || '?')}</b><span>${cortoDir(x.token)}</span></div><div class="pr">${pu > 0 ? '$' + fmtP(pu) : ''}</div></div>`;
    }).join('');
    pick.innerHTML = `<div class="tg-pick-h"><span>Tokens with liquidity · tap to load</span></div>${filas || '<div class="tg-pick-empty">No liquid tokens on the feed yet.</div>'}`;
    ov.querySelector('.tm-big-top').appendChild(pick);
    pick.querySelectorAll('.tg-pick-row').forEach((r) => { r.onclick = () => { const x = lista.find((t) => t.token.toLowerCase() === r.dataset.a.toLowerCase()); pick.remove(); if (x) cargar(x); }; });
  };
  $('tg-find-tok').onclick = togglePicker;

  // ── Busqueda VIVA (igual que el buscador del lobby): al TECLEAR filtra el feed y muestra una lista para
  //    tocar; si el texto es un contrato (BSC 0x… o Tron T…) que no esta en el feed, ofrece resolverlo en
  //    cadena. Antes solo reaccionaba a Enter y sin lista: el usuario tecleaba, no veia NADA y parecia que la
  //    barra estaba muerta. Esa era la causa real de "la busqueda del OFC sigue sin funcionar". ──
  const findIn = $('tg-find-in');
  let _sTmr = null, _sResolN = 0;
  const cerrarRes = () => { const d = $('tg-sresults'); if (d) d.remove(); };
  // Parte interna de una fila de resultado (logo + nombre + precio), sin el <div> contenedor.
  const filaResInner = (x) => {
    const pu = x.precioUsd > 0 ? x.precioUsd : (x.moneda === 'USDT' ? (x.precio || 0) : ((x.precio || 0) * bnbUsd()));
    return `${logo(x.token, x.red, x.logoUrl)}<div class="nm"><b>${esc(x.simbolo || '?')}</b><span>${esc(x.nombre || cortoDir(x.token))}</span></div><div class="pr">${pu > 0 ? '$' + fmtP(pu) : ''}</div>`;
  };
  const filaRes = (x) => `<div class="tg-pick-row" data-a="${esc(x.token)}">${filaResInner(x)}</div>`;
  const cargarRow = (d) => d.querySelectorAll('.tg-pick-row[data-a]').forEach((r) => { r.onclick = () => { const x = feed().find((t) => t.token.toLowerCase() === r.dataset.a.toLowerCase()); if (x) { cerrarRes(); if (findIn) findIn.value = ''; cargar(x); } }; });
  const pintarRes = (q) => {
    const s = String(q || '').trim();
    const prevPick = $('tg-pick'); if (prevPick) prevPick.remove();   // no solapar con el boton Tokens
    if (!s) { cerrarRes(); return; }
    const low = s.toLowerCase(); const f = feed();
    const matches = f.filter((x) => x.token && (x.token.toLowerCase() === low || (x.simbolo || '').toLowerCase().includes(low) || (x.nombre || '').toLowerCase().includes(low)))
      .sort((a, b) => ((b.liquidez || 0) - (a.liquidez || 0))).slice(0, 8);
    const enFeed = f.some((x) => x.token && x.token.toLowerCase() === low);
    const esC = esContrato(s) && !enFeed;   // contrato (BSC/Tron) que no esta en el feed -> hay que resolverlo
    let rows = matches.map(filaRes).join('');
    // Mientras resuelve el contrato mostramos "Looking up…"; NO un boton. Antes salia "Search this contract
    // on-chain" (un mensaje muerto que no mostraba la moneda) -> el usuario pegaba el contrato y no veia su token.
    if (esC) rows += `<div class="tg-pick-row tg-pick-res"><span class="tg-pick-reslbl"><span class="tg-pick-anillo"></span>Looking up ${/^T/.test(s) ? 'Tron' : 'BSC'} contract…</span></div>`;
    if (!rows) rows = `<div class="tg-pick-empty">Type a name/symbol, or paste a full contract (0x… or T…).</div>`;
    let d = $('tg-sresults');
    if (!d) { d = document.createElement('div'); d.className = 'tg-pick'; d.id = 'tg-sresults'; ov.querySelector('.tm-big-top').appendChild(d); }
    d.innerHTML = rows; cargarRow(d);
    if (esC) {
      const mine = ++_sResolN;
      resolverContrato(s).then((it) => {
        const d2 = $('tg-sresults'); if (mine !== _sResolN || !d2) return;   // el usuario siguio tecleando
        const row = d2.querySelector('.tg-pick-res'); if (!row) return;
        if (!it) { row.outerHTML = `<div class="tg-pick-empty">No pair or data found for that contract.</div>`; return; }
        const nuevo = document.createElement('div'); nuevo.className = 'tg-pick-row'; nuevo.innerHTML = filaResInner(it);
        nuevo.onclick = () => { cerrarRes(); if (findIn) findIn.value = ''; cargar(it); };   // carga el token RESUELTO
        row.replaceWith(nuevo);
      }).catch(() => { const d2 = $('tg-sresults'); if (mine === _sResolN && d2) { const row = d2.querySelector('.tg-pick-res'); if (row) row.outerHTML = `<div class="tg-pick-empty">Could not look up that contract.</div>`; } });
    }
  };
  // Pegar un CONTRATO completo (BSC 0x… o Tron T…) lo resuelve y lo CARGA directo en la vista (cabecera +
  // precio + grafica + seguridad). Antes solo lo mostraba en una lista desplegable que se cerraba al tocar
  // fuera (el usuario pegaba y, al dar clic en la grafica, el resultado desaparecia). Ahora no hay nada que
  // tocar: la moneda se carga sola. (El feed por nombre/simbolo sigue con lista desplegable.)
  const cargarContrato = async (s) => {
    const mine = ++_sResolN; cerrarRes();
    const msg = $('tg-chart-msg'); if (msg) { msg.hidden = false; msg.innerHTML = '<span class="tg-anillo"></span>'; }
    let it = await resolverContrato(s).catch(() => null);
    if (!it && ov.isConnected) { await new Promise((r) => setTimeout(r, 900)); it = await resolverContrato(s).catch(() => null); }
    if (mine !== _sResolN || !ov.isConnected) return;   // el usuario siguio tecleando o cerro la vista
    if (it) { if (findIn) findIn.value = ''; cargar(it); }
    else if (msg) { msg.hidden = false; msg.textContent = 'No pair or data found for that contract.'; }
  };
  // Enter: contrato -> carga directo; si hay lista -> primer resultado; si no -> resuelve nombre/simbolo.
  const buscarEnter = async () => {
    const v = (findIn && findIn.value || '').trim(); if (!v) return;
    if (esContrato(v)) { cargarContrato(v); return; }
    const d = $('tg-sresults'); const first = d && d.querySelector('.tg-pick-row[data-a]');
    if (first) { first.click(); return; }
    const msg = $('tg-chart-msg'); if (msg) { msg.hidden = false; msg.innerHTML = '<span class="tg-anillo"></span>'; }
    let it = await resolver(v, feed());
    cerrarRes();
    if (!it) { if (msg && ov.isConnected) { msg.hidden = false; msg.textContent = 'No token found. Paste a full contract (0x… or T…).'; } return; }
    findIn.value = ''; cargar(it);
  };
  if (findIn) {
    findIn.addEventListener('input', () => { clearTimeout(_sTmr); const q = (findIn.value || '').trim(); _sTmr = setTimeout(() => { if (esContrato(q)) cargarContrato(q); else pintarRes(q); }, 220); });
    findIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscarEnter(); } else if (e.key === 'Escape') { cerrarRes(); } });
    findIn.addEventListener('blur', () => setTimeout(cerrarRes, 220));
  }

  // Token inicial: el que se toco, o el de mayor liquidez del feed.
  let inicial = it0;
  if (!inicial) {
    const liq = feed().filter((x) => x.par && (x.liquidez > 0 || x.precio > 0))
      .sort((a, b) => ((b.moneda === 'USDT' ? b.liquidez : b.liquidez * bnbUsd()) - (a.moneda === 'USDT' ? a.liquidez : a.liquidez * bnbUsd())));
    inicial = liq[0] || null;
  }
  if (inicial) cargar(inicial);
  else {
    pintarId(null); pintarPrecio(0); pintarIzq(null, ctx); pintarDer(null, ctx);
    const msg = $('tg-chart-msg'); if (msg) { msg.hidden = false; msg.textContent = 'No token selected. Paste a contract or open the Tokens list.'; }
  }

  // Posiciones full-width: se pintan al abrir y se refrescan SOLAS (polling) para P&L en vivo sin recargar.
  try { derPositions(); } catch (_) {}
  if (_posTimer) clearInterval(_posTimer);
  _posTimer = setInterval(() => { if (_ov && _ov.isConnected) { try { derPositions(); } catch (_) {} } else if (_posTimer) { clearInterval(_posTimer); _posTimer = null; } }, 18000);

  // ── carga de un token en toda la vista ──
  async function cargar(it) {
    if (!ov.isConnected) return;
    _itActual = it; pintarId(it);
    // Token SIN par (Launchpad/four.meme que pudo graduar a un par de PancakeSwap): resuelve su par real como
    // hace el buscador, para que la MISMA moneda no salga "muerta" ($0 / sin grafico / sin seguridad) al abrirla
    // desde el feed cuando por el buscador aparece viva. Si de verdad no hay par, se queda como estaba.
    if (!it.par && it.token) {
      const res = await resolverContrato(it.token).catch(() => null);
      if (!ov.isConnected || _itActual !== it) return;
      if (res && res.par) { it = { ...it, ...res }; _itActual = it; pintarId(it); }
    }
    // LOGO: si el token no trae logo (verificado pero sin entrada en TrustWallet), se pide a GeckoTerminal
    // (/info image_url) y se repinta el identificador cuando llega. Asi deja de salir el escudo generico.
    if (!it.logoUrl && it.token) {
      const itLogo = it;
      import('./gecko.js').then(({ infoGecko }) => infoGecko(it.token, it.red)).then((inf) => {
        if (inf && inf.imageUrl && _itActual === itLogo) { itLogo.logoUrl = inf.imageUrl; pintarId(itLogo); }
      }).catch(() => {});
    }
    pintarDer(it, ctx);
    const msg = $('tg-chart-msg');
    try { destruirGrafico(); } catch (_) {}
    const graf = it.graficable !== false && !!it.par;   // par V2 -> metodo Sync; si no, GeckoTerminal (Tron/V3/otras)
    _chartFuente = graf ? 'v2' : 'gecko';
    // Siembra con las velas del lobby (solo el metodo V2): el grafico aparece al instante y se conserva si el
    // refetch falla. Asi la misma moneda que tiene grafico abajo lo tiene tambien en Open Full Chart.
    const sembradas = (graf && ctx && typeof ctx.velasDe === 'function') ? ctx.velasDe(it.token) : null;
    _velasRawBig = (sembradas && sembradas.length) ? sembradas : null;
    if (_velasRawBig) renderChartBig();
    else if (msg) { msg.hidden = false; msg.innerHTML = '<span class="tg-anillo"></span>'; }
    // precio en vivo
    precioUsdVivo(it, bnbUsd())
      .then((p) => { if (ov.isConnected) pintarPrecio(p); }).catch(() => {});
    pintarIzq(it, ctx);
    if (!graf) { cargarVelasGecko(it); return; }   // Tron / sin par V2: la grafica viene de GeckoTerminal
    // Par V2: velas crudas (una por operacion) reagrupadas al timeframe. Reintento unico ante fallo de getLogs;
    // si tras el reintento no hay Sync, cae a GeckoTerminal (asi un token con poca actividad on-chain pero con
    // grafico en GeckoTerminal tambien se dibuja, en vez de quedarse en "No trades yet").
    const pedir = async (reintentar) => {
      try {
        const velas = await velasDeToken({ par: it.par, token: it.token, decToken: it.decimales || 18, decQuote: 18, bloque: it.bloque, bnbUsd: bnbUsd(), quoteEsUSDT: it.moneda === 'USDT' });
        if (!ov.isConnected || _itActual !== it) return;
        if (velas && velas.length) { _chartFuente = 'v2'; _velasRawBig = velas; renderChartBig(); }
        else if (reintentar && it.par) { setTimeout(() => { if (ov.isConnected && _itActual === it) pedir(false); }, 1300); }
        else if (!(_velasRawBig && _velasRawBig.length)) { cargarVelasGecko(it); }   // sin Sync: respaldo GeckoTerminal
      } catch (_) {
        if (reintentar && it.par) { setTimeout(() => { if (ov.isConnected && _itActual === it) pedir(false); }, 1300); }
        else if (!(_velasRawBig && _velasRawBig.length)) { cargarVelasGecko(it); }
      }
    };
    pedir(true);
  }

  function pintarId(it) {
    const idEl = $('tg-id'); if (!idEl) return;
    if (!it) { idEl.innerHTML = ''; return; }
    const sub = it.red === 'tron' ? 'Tron network' : it.fuente === 'launchpad' ? 'DecFreedom Launchpad' : it.fuente === 'fourmeme' ? 'four.meme' : (it.moneda || 'BNB') + ' pair';
    idEl.innerHTML = `${logo(it.token, it.red, it.logoUrl)}<div class="tg-id-tx"><b title="${esc(it.nombre || '')}">${esc(it.nombre || 'Token')}</b><span>${esc(it.simbolo || '?')} · ${sub}</span></div>`;
  }
  function pintarPrecio(p) {
    _precioUsd = p || 0;
    const ai = document.getElementById('tg-al-price'); if (ai && p > 0 && !ai.value) ai.placeholder = fmtTxt(p);
    const el = $('tg-price'); if (!el) return;
    el.innerHTML = `<b>${p > 0 ? '$' + fmtP(p, 5) : '$0'}</b><span>LIVE PRICE</span>`;
    const mp = document.getElementById('tg-mkt-price'); if (mp) mp.innerHTML = p > 0 ? '$' + fmtP(p, 5) : '$0';
  }
}

/* Las 3 monedas MEJOR posicionadas del Terminal por liquidez real (proxy solido de solidez: una pool profunda
   es dificil de manipular y de rugear). Excluye la moneda abierta. Reemplaza al viejo "Cross-check" de enlaces
   externos: ahora son NUESTRAS mejores monedas y cada una abre su propio Open Full Chart. */
function topDecFreedom(ctx, exclToken) {
  const bnb = ctx && ctx.bnbUsd ? ctx.bnbUsd() : 0;
  const feed = (ctx && ctx.items ? ctx.items() : []) || [];
  const low = (s) => String(s || '').toLowerCase();
  const ex = low(exclToken), seen = new Set(), out = [];
  const scored = feed
    .filter((t) => t && t.token && low(t.token) !== ex && t.operable !== false)
    .map((t) => ({ t, liq: (t.moneda === 'USDT' ? t.liquidez : t.liquidez * bnb) || 0 }))
    .filter((x) => x.liq > 0)
    .sort((a, b) => b.liq - a.liq);
  for (const x of scored) { const k = low(x.t.token); if (seen.has(k)) continue; seen.add(k); out.push(x); if (out.length >= 3) break; }
  return out;
}
/* ── Panel izquierdo: informacion del token (facts al momento + seguridad por la cache de auditoria) ── */
/* Candado: decide si la columna de seguridad se muestra REAL (owner o suscrito) o BLOQUEADA (señuelo + CTA, sin
   ejecutar la auditoria autentica). Owner: desbloqueo inmediato (sync). Resto: bloqueado ya, y se confirma la
   suscripcion EN CADENA; si esta activa, se desbloquea sin recargar. */
function pintarIzq(it, ctx) {
  const host = $('tg-left'); if (!host) return;
  if (!it) { host.innerHTML = `<div class="tg-sec-t">Token info</div><div class="tg-kv"><div><span>Pick a token to see its info</span></div></div>`; refrescarPill(ctx); return; }
  const w = (wallet.cuentaActual && wallet.cuentaActual()) || null;
  if (esOwner(w)) { pintarIzqReal(it, ctx); refrescarPill(ctx); return; }   // owner: todo desbloqueado (para probar)
  // Bloqueado por defecto: el señuelo se pinta, la auditoria REAL no se ejecuta (nada real entra al DOM).
  montarCandado(host, { bnbUsd: ctx && ctx.bnbUsd ? ctx.bnbUsd() : 0, onDesbloquear: () => { if (_itActual === it) { pintarIzqReal(it, ctx); desbloquearProtectUI(); refrescarPill(ctx); } } });
  refrescarPill(ctx);
  estadoSuscripcion(w).then((sub) => { if (_itActual === it && sub && sub.activa) { pintarIzqReal(it, ctx); desbloquearProtectUI(); refrescarPill(ctx); } });
}
/* Quita el candado del boton Protect (tras pagar o si ya hay suscripcion), sin re-renderizar el formulario. */
function desbloquearProtectUI() { const el = $('tg-prot'); if (el) { const l = el.querySelector('.tg-prot-lock'); if (l) l.remove(); el.classList.remove('tg-prot-locked'); } }
/* Actualiza la pastilla del encabezado (wallet + tiempo de suscripcion). */
function refrescarPill(ctx) {
  const host = $('tg-sub-pill'); if (!host) return;
  const w = (wallet.cuentaActual && wallet.cuentaActual()) || null;
  if (!w) { pintarPill(host, null, null); return; }
  if (esOwner(w)) { pintarPill(host, { owner: true, activa: true }, w); return; }
  pintarPill(host, { activa: false }, w);
  estadoSuscripcion(w).then((sub) => pintarPill(host, sub, w)).catch(() => {});
}
function pintarIzqReal(it, ctx) {
  const host = $('tg-left'); if (!host) return;
  if (!it) { host.innerHTML = `<div class="tg-sec-t">Token info</div><div class="tg-kv"><div><span>Pick a token to see its info</span></div></div>`; return; }
  const bnbUsd = ctx && ctx.bnbUsd ? ctx.bnbUsd() : 0;
  const liqUsd = it.moneda === 'USDT' ? it.liquidez : it.liquidez * bnbUsd;
  const tops = topDecFreedom(ctx, it.token);
  host.innerHTML = `
    <div class="tg-sec-t tg-sec-head">Security check</div>
    <div class="tg-sem pend" id="tg-sem">${semPendBig()}</div>
    <div class="tg-checks" id="tg-checks">${checksScan()}</div>
    <button class="tg-diag-dl" id="tg-diag-dl" type="button" disabled>${ICO_DL}<span>Download full diagnosis</span></button>
    <div class="tg-sec-t tg-mt">Creator track record</div>
    <div class="tg-creador" id="tg-creador"><span class="tm-sk" style="width:60%"></span></div>
    <div class="tg-sec-t tg-mt">Token info</div>
    <div class="tg-kv">
      <div><span>Liquidity</span><b>${liqUsd > 0 ? money(liqUsd) : (it.par ? '$0' : 'Pool')}</b></div>
      <div><span>Pair</span><b>${esc(it.moneda || 'BNB')}</b></div>
      <div><span>Holders</span><b id="tg-k-hold"><span class="tm-sk" style="width:36px"></span></b></div>
      <div><span>Top 10</span><b id="tg-k-top"><span class="tm-sk" style="width:36px"></span></b></div>
      <div><span>Creator</span><b id="tg-k-cre"><span class="tm-sk" style="width:36px"></span></b></div>
      <div><span>Buy / Sell tax</span><b id="tg-k-tax"><span class="tm-sk" style="width:36px"></span></b></div>
      <div><span>LP secured</span><b id="tg-k-lp"><span class="tm-sk" style="width:36px"></span></b></div>
      <div><span>Contract</span><b><button class="tg-copyc" type="button" id="tg-k-copy">${corto(it.token)} ${ICO_COPY}</button></b></div>
      <div><span>Explorer</span><b><a class="tg-copyc" href="${SCAN_URL}/token/${esc(it.token)}" target="_blank" rel="noopener">BscScan</a></b></div>
    </div>
    <div class="tg-sec-t tg-mt">DecFreedom top picks</div>
    <div class="tg-tops" id="tg-tops">${tops.length ? tops.map((x) => `<button class="tg-top" type="button" data-a="${esc(x.t.token)}">${logo(x.t.token, x.t.red, x.t.logoUrl)}<div class="tg-top-id"><b>${esc(x.t.simbolo || '?')}</b><span>${esc((x.t.nombre || x.t.simbolo || '').slice(0, 20))}</span></div><div class="tg-top-liq"><b>${money(x.liq)}</b><span>liquidity</span></div></button>`).join('') : `<div class="tg-top-empty">Open the Terminal lobby to rank its deepest, safest tokens here.</div>`}</div>`;
  host.querySelectorAll('#tg-tops .tg-top[data-a]').forEach((b) => { b.onclick = () => { const x = (ctx && ctx.items ? ctx.items() : []).find((t) => t && t.token && t.token.toLowerCase() === b.dataset.a.toLowerCase()); if (x && _cargar) _cargar(x); }; });
  const cp = $('tg-k-copy'); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(it.token); const o = cp.innerHTML; cp.textContent = 'copied'; setTimeout(() => { if (cp.isConnected) cp.innerHTML = o; }, 1200); } catch (_) {} };
  // Verificacion en tiempo real: los pasos (code, owner, scan, lp, holders) se encienden segun llega cada
  // resultado, igual que la ficha emergente; al terminar, el semaforo y la lista detallada de checks.
  if (ctx && ctx.auditarCache) {   // BSC (con o SIN par: Launchpad) y Tron: el analizador SIEMPRE se dispara
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    const alPaso = (id, e) => { const el = host.querySelector('#tg-sem .tg-pasos i[data-p="' + id + '"]'); if (el) el.className = e; };
    // Rellena Token info con lo que traiga la auditoria. final=true cierra los campos que sigan vacios.
    const rellenar = (r, final) => {
      if (!r || !$('tg-left') || _itActual !== it) return;
      const d = r.datos || {};
      if (d.holders != null) set('tg-k-hold', (d.holdersEstimado ? '~' : '') + Number(d.holders).toLocaleString('en-US') + (d.txs != null ? ' (' + Number(d.txs).toLocaleString('en-US') + ' txs)' : ''));
      else if (final) set('tg-k-hold', '0');
      if (d.top10Pct != null) set('tg-k-top', pct(d.top10Pct)); else if (final) set('tg-k-top', '0%');
      const cre = d.creador || it.creador || '';
      const creEl = $('tg-k-cre');
      if (creEl && cre) { creEl.innerHTML = `<button class="tg-copyc" type="button">${corto(cre)}${d.creadorPct != null ? ' ' + pct(d.creadorPct) : ''} ${ICO_COPY}</button>`; const cb = creEl.querySelector('button'); if (cb) cb.onclick = () => { try { navigator.clipboard.writeText(cre); const o = cb.innerHTML; cb.textContent = 'copied'; setTimeout(() => { if (cb.isConnected) cb.innerHTML = o; }, 1200); } catch (_) {} }; }
      else if (creEl && final) set('tg-k-cre', d.creadorPct != null ? pct(d.creadorPct) : '0%');
      set('tg-k-tax', pct(d.buyTax || 0) + ' / ' + pct(d.sellTax || 0));
      if (d.lpAsegurada != null) set('tg-k-lp', pct(d.lpAsegurada)); else if (final) set('tg-k-lp', '0%');
    };
    let cascada = false, creadorPedido = false, verdictoListo = false, lastR = null;
    const reveler = (r) => {
      if (!$('tg-sem') || _itActual !== it) return;
      lastR = r;   // guarda el resultado mas completo que haya llegado
      if (cascada) { refrescarChecks(r); if (verdictoListo) pintaSemBig(r, it); return; }   // ya se animo: refresca sin re-animar
      cascada = true;
      const ch = $('tg-checks'); const dur = ch ? revelarChecks(ch, r) : 0;   // cascada dramatica; el veredicto cierra la escena
      setTimeout(() => { if ($('tg-sem') && _itActual === it) { verdictoListo = true; pintaSemBig(lastR || r, it); } }, dur + 160);
    };
    const verCreador = (r) => { if (creadorPedido) return; const cre = (r && r.datos && r.datos.creador) || it.creador; if (!cre) return; creadorPedido = true; historialCreadorBig(it, cre); };
    if (it.red === 'tron') {
      // TRON: sin RPC de Tron, el analisis viene de GoPlus(tron) + TronScan. Asi un token de Tron sale con su
      // Security Check real en vez de quedarse en "Not a PancakeSwap pair".
      for (const id of PASOS) alPaso(id, id === 'scanner' ? 'run' : 'na');
      import('./auditoria.js').then(({ auditarTron }) => auditarTron(it.token, it)).then((r) => {
        if (_itActual !== it) return; alPaso('scanner', 'ok'); rellenar(r, true); reveler(r); verCreador(r);
        if (!creadorPedido) { const el = $('tg-creador'); if (el && _itActual === it) { el.className = 'tg-creador'; el.innerHTML = '<span class="tg-cre-mut">Unknown creator</span>'; } }
      }).catch(() => { if (!cascada) { pintaSemBig({ nivel: 'pend', titulo: 'Check unavailable' }, it); const ch = $('tg-checks'); if (ch) ch.innerHTML = `<div class="tg-chk pend"><span>Security check unavailable</span><b></b></div>`; } });
    } else {
      // BSC (con o sin par): on-chain propio + GoPlus. Pass 1 rapido (veredicto en segundos) y Pass 2 completo.
      ctx.auditarCache(it, alPaso, false).then((r) => { rellenar(r, false); reveler(r); verCreador(r); }).catch(() => {});
      ctx.auditarCache(it, alPaso, true).then((r) => {
        rellenar(r, true); reveler(r); verCreador(r);
        if (!creadorPedido) { const el = $('tg-creador'); if (el && _itActual === it) { el.className = 'tg-creador'; el.innerHTML = '<span class="tg-cre-mut">Unknown creator</span>'; } }
      }).catch(() => { if (!cascada) { pintaSemBig({ nivel: 'pend', titulo: 'Check unavailable' }, it); const ch = $('tg-checks'); if (ch) ch.innerHTML = `<div class="tg-chk pend"><span>Security check unavailable</span><b></b></div>`; } });
    }
  } else {
    ['tg-k-hold', 'tg-k-top', 'tg-k-cre', 'tg-k-tax', 'tg-k-lp'].forEach((id) => { const e = $(id); if (e) e.textContent = '0'; });
    const sem = $('tg-sem'); if (sem) { sem.className = 'tg-sem pend'; sem.innerHTML = `<span class="tg-sem-ico">${ICO_SEM.pend}</span><div><b>Security check unavailable</b><span>Reopen this token to retry</span></div>`; }
    const ch = $('tg-checks'); if (ch) ch.innerHTML = `<div class="tg-chk pend"><span>No data to verify</span><b></b></div>`;
  }
}
/* Semaforo inicial con los pasos de verificacion (se encienden en vivo) y resultado final, como la ficha. */
function semPendBig() {
  return `<span class="tg-sem-ico">${ICO_SEM.pend}</span><div><b>Checking security</b><span class="tg-pasos">${PASOS.map((id) => `<u><i data-p="${id}"></i><em>${PASOS_TXT[id]}</em></u>`).join('')}</span></div>`;
}
function pintaSemBig(r, it) {
  const sem = $('tg-sem'); if (!sem) return;
  const niv = r && r.nivel ? r.nivel : 'pend';
  // ¿Hay ALGUN dato real? (GoPlus, honeypot.is, Tron/TronScan o lectura en cadena). Con que haya uno, se pinta
  // el SELLO con su %: el usuario exige que SIEMPRE salga el analisis dramatico, nunca el parrafo plano.
  const hayDato = !!(r && ((r.datos && (r.datos.holders != null || r.datos.checks || r.datos.lpAsegurada != null)) || ((r.hallazgos || []).some((h) => h.n === 'ok' || h.n === 'warn' || h.n === 'bad'))));
  if (niv === 'pend' && !hayDato) {
    // Caso extremo: NINGUNA fuente publica respondio todavia. No es "sin resultado para siempre": es "aun
    // analizando". Estado claro y estatico (sin spinner infinito) para que nunca parezca congelado.
    sem.className = 'tg-sem limited'; delete sem.dataset.sello;
    sem.innerHTML = `<span class="tg-sem-ico">${ICO_SEM.info}</span><div><b>Still analyzing…</b><span>No public source has answered yet. Reopen the token to retry.</span></div>`;
    return;
  }
  // Veredicto (o datos de cadena) listos -> SELLO visual descargable. El escudo (verde sec-safe / rojo sec-risk),
  // el numero y la etiqueta los decide bandaSeguridad A PARTIR DEL PUNTAJE, para que jamas se contradigan.
  const it0 = it || _itActual;
  const p = scorePct(r);
  const band = bandaSeguridad(p, r);
  const kind = band.kind;
  const parcial = niv === 'pend';   // hay datos de cadena pero el escaner aun no: sello con nota de "parcial"
  const firma = (it0 && it0.token ? it0.token : '') + '|' + kind + '|' + p + (parcial ? '|p' : '');
  if (sem.dataset.sello === firma) return;   // ya dibujado para este token/veredicto: no repetir
  sem.dataset.sello = firma;
  sem.className = 'tg-sello-wrap';
  sem.innerHTML = selloMarkup(kind, p, niv, r, band, parcial);
  const cv = sem.querySelector('.tg-sello-cv');
  if (cv) dibujarSello(cv, kind, p, it0, niv, r, band);
  wireSelloDescarga(sem, it0, r, band, p);
}
/* Puntaje de seguridad REAL del token (0-100, MAS ALTO = MAS SEGURO). Es la fraccion PONDERADA de las
   comprobaciones que SI tienen dato, ponderada ademas por CONFIANZA (cuanta de la seguridad total se pudo
   medir). Asi se acaba la discordancia que tenia el usuario:
     · ANTES: se sumaban pesos y se CLAVABA el numero dentro de la banda del veredicto ([45,70] para 'warn').
       Resultado: 1 falla, 2 fallas o 7 aprobados -> TODOS daban 70%, y un token con MAS fallas podia mostrar
       MENOS % que uno con menos (porque ambos chocaban contra el mismo techo). Sin sentido.
     · AHORA: es monotono. Cada falla baja el numero de verdad; mas fallas => menor puntaje, SIEMPRE. Dos tokens
       se pueden comparar: el peor siempre tiene menor % y (abajo) escudo mas rojo.
   Los "asesinos" mandan por encima de todo: no-vendible (honeypot) pone techo 12 pase lo que pase, e impostor
   casi 0. Si no hay checks de GoPlus, puntua con lo leido en cadena. NUNCA devuelve vacio: siempre un numero. */
const SELLO_PESOS = { sellable: 26, lpSecured: 15, lowTax: 12, verified: 10, notConcentrated: 10, renounced: 8, notMintable: 8, noPause: 6, noBlacklist: 5 };
const SELLO_TOTAL = 100;   // suma de todos los pesos (cobertura completa)
function scorePct(r) {
  if (r && r.impostor) return 3;                       // scam que imita un estable mayor: casi 0, jamas 99%
  if (r && r.peligroCreador) return 6;                 // wallet creador ligado a honeypots/robos/sanciones: casi 0
  const c = r && r.datos && r.datos.checks;
  if (c) {
    let got = 0, tot = 0;
    for (const k in SELLO_PESOS) { if (c[k] === undefined) continue; tot += SELLO_PESOS[k]; if (c[k]) got += SELLO_PESOS[k]; }
    if (tot) {
      // conf = fraccion de la seguridad total que de verdad se midio. Con cobertura parcial el numero se mezcla
      // con un neutro (50) para no gritar "100%" por un solo check bueno ni "0%" por un solo check malo.
      const conf = tot / SELLO_TOTAL;
      let s = Math.round(50 * (1 - conf) + (got / tot) * 100 * conf);
      if (c.sellable === false) s = Math.min(s, 12);   // no se puede vender: techo de honeypot, pase lo que pase
      return Math.max(2, Math.min(99, s));
    }
  }
  return scoreCadena(r);
}
/* Puntaje con SOLO lo leido en cadena (sin GoPlus): LP, propiedad, concentracion, bolsa del creador, verificado.
   Mezcla por confianza igual que arriba. Si no hay ni una senal, mapea el nivel del veredicto (ultimo recurso)
   para no inventar un numero. Asi la seccion SIEMPRE muestra un %, nunca el parrafo. */
function scoreCadena(r) {
  const d = (r && r.datos) || {}, hall = (r && r.hallazgos) || [];
  const sen = [];
  if (d.lpAsegurada != null) sen.push([20, d.lpAsegurada >= 90]);
  if (hall.some((x) => /renounced/i.test(x.t))) sen.push([10, true]);
  else if (hall.some((x) => x.n === 'warn' && /owner/i.test(x.t))) sen.push([10, false]);
  if (d.top10Pct != null) sen.push([12, d.top10Pct < 70]);
  if (d.creadorPct != null) sen.push([10, d.creadorPct < 20]);
  if (hall.some((x) => x.n === 'ok' && /verified/i.test(x.t))) sen.push([8, true]);
  else if (hall.some((x) => /not verified|source not/i.test(x.t))) sen.push([8, false]);
  if (!sen.length) { const niv = r && r.nivel; return niv === 'ok' ? 85 : niv === 'warn' ? 58 : niv === 'bad' ? 18 : 50; }
  let got = 0, tot = 0; for (const [w, ok] of sen) { tot += w; if (ok) got += w; }
  const conf = Math.min(1, tot / 60);                  // 60 = cobertura "suficiente" leyendo solo cadena
  return Math.max(2, Math.min(99, Math.round(50 * (1 - conf) + (got / tot) * 100 * conf)));
}
/* Banda visual del puntaje: etiqueta, color y QUE escudo (verde sec-safe / rojo sec-risk). TODO sigue al
   PUNTAJE, no al nivel: color, numero y etiqueta jamas se contradicen. Verde desde 70; por debajo, rojo. Los
   asesinos (honeypot/impostor) fuerzan rojo con su etiqueta propia aunque el numero quedara alto por otra via. */
function bandaSeguridad(p, r) {
  // Vocabulario APROBADO por el usuario (el de siempre): LOOKS SAFE / TRADE WITH CAUTION / DO NOT BUY. Nada de
  // "SOLID/STRONG". Lo unico nuevo es que el COLOR y QUE escudo (verde ≥70 / rojo <70) siguen al PUNTAJE.
  if (r && r.impostor) return { kind: 'risk', etq: 'DO NOT BUY', vshort: 'Fake token', col: '#FF4357', glow: 'rgba(255,67,87,.5)' };
  if (r && r.peligroCreador) return { kind: 'risk', etq: 'DO NOT BUY', vshort: 'Bad creator', col: '#FF4357', glow: 'rgba(255,67,87,.5)' };
  if (r && r.datos && r.datos.checks && r.datos.checks.sellable === false) return { kind: 'risk', etq: 'DO NOT BUY', vshort: 'Honeypot', col: '#FF4357', glow: 'rgba(255,67,87,.5)' };
  // El COLOR del % sigue al ESCUDO: verde (sec-safe) -> % verde; rojo (sec-risk) -> % ROJO (nada de amarillo).
  if (p >= 70) return { kind: 'ok', etq: 'LOOKS SAFE', vshort: 'Looks safe', col: '#3DED8C', glow: 'rgba(61,237,140,.55)' };
  if (p >= 40) return { kind: 'risk', etq: 'TRADE WITH CAUTION', vshort: 'Caution', col: '#FF4357', glow: 'rgba(255,67,87,.5)' };
  return { kind: 'risk', etq: 'DO NOT BUY', vshort: 'Do not buy', col: '#FF4357', glow: 'rgba(255,67,87,.5)' };
}
const SELLO_BG = { ok: new URL('./img/sec-safe.webp', import.meta.url).href, risk: new URL('./img/sec-risk.webp', import.meta.url).href };
function selloMarkup(kind, p, niv, r, band, parcial) {
  // Leyenda nitida DEBAJO de la imagen. El boton de descarga YA NO va en la esquina del escudo: ahora es un
  // boton grande al final de TODO el diagnostico (mas visible). Aqui solo queda el escudo + la leyenda legible.
  const imp = r && r.impostor;
  const vshort = (band && band.vshort) || (imp ? ('Fake ' + imp) : 'Checking');
  // Sin guiones ni puntos medios en toda la leyenda (el usuario los odia): frases con punto y coma normales.
  const cap = imp
    ? `Impersonates <b>${esc(imp)}</b>. This is NOT the official ${esc(imp)} contract. Likely a scam.`
    : (parcial ? 'live on-chain score of this token, not of DecFreedom'
               : 'security score of this token (higher is safer), not of DecFreedom');
  return `<div class="tg-sello ${kind}"><canvas class="tg-sello-cv"></canvas><div class="tg-sello-sk"><i class="tg-anillo2"></i></div></div><p class="tg-sello-cap ${kind}"><b>${p}% ${esc(vshort)}.</b> ${cap}</p>`;
}
/* Cache (promesa) para no recargar el fondo en cada repintado del sello. */
const _selloImgCache = {};
function cargarImg(url, cross) {
  if (_selloImgCache[url]) return _selloImgCache[url];
  const pr = new Promise((res, rej) => { const im = new Image(); if (cross) im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => { delete _selloImgCache[url]; rej(new Error('img')); }; im.src = url; });
  _selloImgCache[url] = pr; return pr;
}
/* Logo real de la moneda (Trust Wallet / CoinGecko) con CORS para poder dibujarlo en el canvas descargable.
   Si no hay logo, se rechaza y NO se dibuja icono: nada de circulo con iniciales, nada de logo de Binance. */
function cargarLogoTok(it) {
  let a = ''; try { a = ethers.getAddress(String((it && it.token) || '')); } catch (_) { return Promise.reject(); }
  if (!a) return Promise.reject();
  if (a.toLowerCase() === WBNB.toLowerCase()) return cargarImg(LOGO_BNB, true);
  if (a.toLowerCase() === USDT.toLowerCase()) return cargarImg(LOGO_USDT, true);
  return cargarImg(LOGO_TW + a + '/logo.png', true);
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
/* Dibuja el sello a resolucion nativa de la imagen (listo para descargar/compartir). El escudo (izquierda)
   se deja INTACTO: representa la seguridad del token, no se le encima nada. En el recuadro HUD (derecha) va
   el % gigante; encima, en la banda vacia, el icono y el simbolo de la MONEDA; debajo, el texto que aclara
   que el porcentaje es de ESE token, no de DecFreedom; y abajo-izquierda, la marca decfreedom.com. */
/* Compone el escudo SOBRE el fondo ya dibujado en el rectangulo [X,Y,W,H]: arriba (en la banda vacia, nunca
   sobre el dibujo del escudo que esta a la IZQUIERDA) el logo+simbolo; en el recuadro HUD de la derecha el %
   gigante; bajo el % la etiqueta; dos lineas aclaratorias; y abajo-izquierda la marca decfreedom.com. Todo en
   proporciones RELATIVAS al rectangulo, asi el escudo se ve IDENTICO en pantalla y en la imagen descargable
   (misma composicion, solo cambia el tamano). */
function componerEscudo(ctx, X, Y, W, H, p, band, it, ic) {
  const col = band.col, glow = band.glow, cx = X + W * 0.79, cxCoin = X + W * 0.75;
  const sym = ((it && it.simbolo) ? String(it.simbolo) : 'TOKEN').toUpperCase().replace(/\s+/g, '').slice(0, 12);
  let fS = Math.round(H * 0.075); ctx.font = `800 ${fS}px "Chakra Petch", Arial, sans-serif`;
  let symW = ctx.measureText(sym).width;
  const icoSz = ic ? Math.round(H * 0.12) : 0, gap = ic ? Math.round(W * 0.012) : 0, maxGrp = W * 0.34;
  while (icoSz + gap + symW > maxGrp && fS > 20) { fS -= 4; ctx.font = `800 ${fS}px "Chakra Petch", Arial, sans-serif`; symW = ctx.measureText(sym).width; }
  const grpW = icoSz + gap + symW, rowY = Y + H * 0.125, rightMax = X + W * 0.955;
  let gx = cxCoin - grpW / 2; if (gx + grpW > rightMax) gx = rightMax - grpW;
  if (ic) {
    const iy = rowY - icoSz / 2; rrect(ctx, gx, iy, icoSz, icoSz, icoSz * 0.28);
    ctx.save(); ctx.clip(); ctx.drawImage(ic, gx, iy, icoSz, icoSz); ctx.restore();
    ctx.lineWidth = Math.max(2, H * 0.004); ctx.strokeStyle = 'rgba(255,255,255,.32)'; rrect(ctx, gx, iy, icoSz, icoSz, icoSz * 0.28); ctx.stroke();
    gx += icoSz + gap;
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.72)'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#FFFFFF'; ctx.font = `800 ${fS}px "Chakra Petch", Arial, sans-serif`; ctx.fillText(sym, gx, rowY);
  // SOLO el % dentro del recuadro HUD, CENTRADO y solo. NADA debajo: ni palabra (LOOKS SAFE/etc.) ni lineas ni
  // guiones. El usuario lo quiere limpio, con el porcentaje centrado como estaba "perfecto". La etiqueta y la
  // aclaracion "de este token, no de DecFreedom" viven FUERA del escudo (en la leyenda y en el pie).
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.shadowColor = glow; ctx.shadowBlur = W * 0.024;
  let pf = Math.round(H * 0.3); const maxP = W * 0.33, ptxt = p + '%';
  ctx.font = `800 ${pf}px "Chakra Petch", Arial, sans-serif`;
  while (ctx.measureText(ptxt).width > maxP && pf > 40) { pf -= 6; ctx.font = `800 ${pf}px "Chakra Petch", Arial, sans-serif`; }
  ctx.fillText(ptxt, cx, Y + H * 0.46);
  // Marca decfreedom.com abajo-izquierda
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,.88)'; ctx.shadowBlur = 9;
  ctx.font = `800 ${Math.round(H * 0.042)}px "Chakra Petch", Arial, sans-serif`;
  const bx = X + W * 0.035, by = Y + H * 0.945; ctx.fillStyle = '#FFFFFF'; ctx.fillText('DecFreedom', bx, by);
  const bw = ctx.measureText('DecFreedom').width; ctx.fillStyle = col; ctx.fillText('.com', bx + bw, by);
  ctx.shadowBlur = 0;
}
async function dibujarSello(cv, kind, p, it, niv, r, band) {
  band = band || bandaSeguridad(p, r);
  try {
    const bg = await cargarImg(kind === 'ok' ? SELLO_BG.ok : SELLO_BG.risk, true);
    if (!cv.isConnected || (it && _itActual !== it)) return;
    const W = bg.naturalWidth || 1672, H = bg.naturalHeight || 941;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H); ctx.drawImage(bg, 0, 0, W, H);
    let ic = null; try { ic = await cargarLogoTok(it); } catch (_) { ic = null; }
    if (!cv.isConnected || (it && _itActual !== it)) return;
    componerEscudo(ctx, 0, 0, W, H, p, band, it, ic);
    const wrap = cv.closest('.tg-sello'); if (wrap) wrap.classList.add('ready');
    const dbtn = $('tg-diag-dl'); if (dbtn) { dbtn.disabled = false; dbtn.classList.add('on'); }   // habilita la descarga del diagnostico completo
  } catch (e) {
    const sem = $('tg-sem'); if (sem) { delete sem.dataset.sello; sem.className = 'tg-sem ' + (band.kind === 'ok' ? 'ok' : 'bad'); sem.innerHTML = `<span class="tg-sem-ico">${ICO_SEM[niv] || ICO_SEM.info}</span><div><b>${p}% ${esc(band.vshort)}</b><span>Security score of this token, not of DecFreedom.</span></div>`; }
    const dbtn = $('tg-diag-dl'); if (dbtn) { dbtn.disabled = false; dbtn.classList.add('on'); }
  }
}
/* Descarga el DIAGNOSTICO COMPLETO (no solo el escudito): el boton grande del fondo construye en un canvas
   propio toda la seccion — encabezado centrado, moneda, escudo + %, los 9 checks con ✓/✗, resumen y nuestra
   marca — a alta resolucion y SIN la barra de scroll (es un canvas, no una captura del HTML). */
function wireSelloDescarga(sem, it, r, band, p) {
  const btn = $('tg-diag-dl'); if (!btn) return;
  btn.onclick = async () => {
    if (btn.classList.contains('busy')) return;
    const o = btn.innerHTML; btn.classList.add('busy'); btn.innerHTML = `${ICO_DL}<span>Rendering…</span>`;
    try {
      const canvas = await dibujarDiagnostico(r, it, band, p);
      canvas.toBlob((blob) => {
        if (blob) { const sym = ((it && it.simbolo) ? String(it.simbolo) : 'token').replace(/[^\w-]/g, '').slice(0, 20) || 'token'; bajarBlob(blob, `DecFreedom-${sym}-diagnosis.png`); }
        btn.classList.remove('busy'); btn.innerHTML = o;
      }, 'image/png');
    } catch (_) { btn.classList.remove('busy'); btn.innerHTML = o; }
  };
}
function bajarBlob(blob, fn) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = fn; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 1500); }

/* Texto centrado con interletrado manual (canvas no tiene letter-spacing). */
function drawSpaced(ctx, txt, cx, y, sp) {
  let w = 0; for (const ch of txt) w += ctx.measureText(ch).width + sp; w -= sp;
  const prev = ctx.textAlign; ctx.textAlign = 'left'; let x = cx - w / 2;
  for (const ch of txt) { ctx.fillText(ch, x, y); x += ctx.measureText(ch).width + sp; }
  ctx.textAlign = prev;
}
/* Insignia ✓ (verde) o ✗ (roja) dibujada a mano (sin SVG) para cada check del diagnostico. */
function badge(ctx, x, y, r, ok) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ok ? 'rgba(61,237,140,.15)' : 'rgba(255,67,87,.15)'; ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = ok ? '#3DED8C' : '#FF4357'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (ok) { ctx.moveTo(x - r * 0.42, y + r * 0.02); ctx.lineTo(x - r * 0.08, y + r * 0.34); ctx.lineTo(x + r * 0.46, y - r * 0.34); }
  else { ctx.moveTo(x - r * 0.32, y - r * 0.32); ctx.lineTo(x + r * 0.32, y + r * 0.32); ctx.moveTo(x + r * 0.32, y - r * 0.32); ctx.lineTo(x - r * 0.32, y + r * 0.32); }
  ctx.stroke(); ctx.restore();
}
/* Construye el canvas del diagnostico COMPLETO del token y lo devuelve (PNG de alta calidad para compartir).
   Encabezado centrado -> escudo COMPLETO (sin recortar, misma composicion que en pantalla) -> 9 checks ->
   resumen -> pie. SC=2 = imagen nitida. Alto dinamico segun cuantos checks/datos haya. */
async function dibujarDiagnostico(r, it, band, p) {
  const SC = 2, Wc = 1120, pad = 44;
  const c = r && r.datos && r.datos.checks, d = (r && r.datos) || {};
  const rows = [];
  if (c) { for (const def of CHECKS_DEF) { const ok = !!c[def.k]; let val = ''; try { val = def.v(c, d); } catch (_) {} rows.push({ ok, t: def.t, v: val }); } }
  else { for (const h of ((r && r.hallazgos) || [])) { if (h.n === 'info') continue; rows.push({ ok: h.n === 'ok', t: h.t, v: '' }); if (rows.length >= 9) break; } if (!rows.length) rows.push({ ok: false, t: 'Analysis', v: (r && r.titulo) || '' }); }
  const sumItems = [];
  if (d.holders != null) sumItems.push(['Holders', Number(d.holders).toLocaleString('en-US')]);
  if (d.top10Pct != null) sumItems.push(['Top 10', Math.round(d.top10Pct) + '%']);
  if (d.buyTax != null || d.sellTax != null) sumItems.push(['Buy / Sell', Math.round(d.buyTax || 0) + '/' + Math.round(d.sellTax || 0) + '%']);
  if (d.lpAsegurada != null) sumItems.push(['LP secured', Math.round(d.lpAsegurada) + '%']);
  if (d.creador) sumItems.push(['Creator', corto(d.creador)]);
  const headerH = 118;
  const heroW = Wc - pad * 2, heroH = Math.round(heroW * (941 / 1672));   // escudo COMPLETO, mismo aspecto, SIN recorte
  const rowH = 60, listH = rows.length * rowH + 16, sumH = sumItems.length ? 112 : 0, footH = 118;
  const Hc = headerH + heroH + 20 + listH + sumH + footH;
  const cv = document.createElement('canvas'); cv.width = Wc * SC; cv.height = Hc * SC;
  const ctx = cv.getContext('2d'); ctx.scale(SC, SC);
  const g = ctx.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, '#0C1014'); g.addColorStop(1, '#080A0D');
  ctx.fillStyle = g; ctx.fillRect(0, 0, Wc, Hc);
  ctx.strokeStyle = band.kind === 'ok' ? 'rgba(61,237,140,.25)' : 'rgba(255,67,87,.22)'; ctx.lineWidth = 2; rrect(ctx, 6, 6, Wc - 12, Hc - 12, 20); ctx.stroke();
  // Encabezado CENTRADO (el nombre de la moneda NO se repite aqui: ya va en el escudo, para no duplicarlo)
  let y = 38; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#E8B84B'; ctx.font = `700 22px "Chakra Petch", Arial, sans-serif`; drawSpaced(ctx, 'SECURITY CHECK', Wc / 2, y + 6, 6);
  ctx.fillStyle = 'rgba(173,182,194,.8)'; ctx.font = `500 14px Arial, sans-serif`; ctx.fillText('DecFreedom token security diagnosis', Wc / 2, y + 34);
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, y + 56); ctx.lineTo(Wc - pad, y + 56); ctx.stroke();
  y = headerH;
  // Escudo COMPLETO (sin recortar): el rect ya tiene el aspecto 1672:941, asi que la imagen entra entera; la
  // composicion (%, simbolo, etiqueta) es la MISMA funcion que en pantalla, para que se vea identico y perfecto.
  let ic = null; try { ic = await cargarLogoTok(it); } catch (_) { ic = null; }
  const hx = pad, hy = y, hw = heroW, hh = heroH;
  try {
    const bg = await cargarImg(band.kind === 'ok' ? SELLO_BG.ok : SELLO_BG.risk, true);
    ctx.save(); rrect(ctx, hx, hy, hw, hh, 16); ctx.clip();
    ctx.drawImage(bg, hx, hy, hw, hh);
    ctx.restore();
    componerEscudo(ctx, hx, hy, hw, hh, p, band, it, ic);
  } catch (_) {
    // Respaldo si la imagen no carga: panel plano con % centrado (sin recorte ni montajes raros).
    ctx.fillStyle = band.kind === 'ok' ? 'rgba(61,237,140,.08)' : 'rgba(255,67,87,.08)'; rrect(ctx, hx, hy, hw, hh, 16); ctx.fill();
    ctx.strokeStyle = band.col; ctx.lineWidth = 2; rrect(ctx, hx, hy, hw, hh, 16); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = band.col; ctx.font = `800 ${Math.round(hh * 0.4)}px "Chakra Petch", Arial, sans-serif`; ctx.fillText(p + '%', Wc / 2, hy + hh * 0.42);
    ctx.font = `700 ${Math.round(hh * 0.1)}px "Chakra Petch", Arial, sans-serif`; ctx.fillText(band.etq, Wc / 2, hy + hh * 0.72);
  }
  y = headerH + heroH + 20;
  // Lista de checks
  ctx.shadowBlur = 0;
  for (const row of rows) {
    const cyc = y + rowH / 2;
    badge(ctx, pad + 18, cyc, 14, !!row.ok);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#D7DCE3'; ctx.font = `600 19px Arial, sans-serif`; ctx.fillText(row.t, pad + 48, cyc);
    if (row.v) { ctx.textAlign = 'right'; ctx.fillStyle = row.ok ? '#6BE89A' : '#FF6475'; ctx.font = `700 18px "Chakra Petch", Arial, sans-serif`; ctx.fillText(String(row.v), Wc - pad - 4, cyc); }
    ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad + 48, y + rowH); ctx.lineTo(Wc - pad - 4, y + rowH); ctx.stroke();
    y += rowH;
  }
  y += 16;
  // Tiles de resumen
  if (sumItems.length) {
    const n = sumItems.length, gapx = 12, tw = (Wc - pad * 2 - gapx * (n - 1)) / n, th = 84;
    for (let i = 0; i < n; i++) {
      const tx = pad + i * (tw + gapx);
      ctx.fillStyle = 'rgba(255,255,255,.035)'; rrect(ctx, tx, y, tw, th, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; rrect(ctx, tx, y, tw, th, 12); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(125,135,148,.95)'; ctx.font = `600 11px Arial, sans-serif`; ctx.fillText(sumItems[i][0].toUpperCase(), tx + 13, y + 28);
      ctx.fillStyle = '#EAECF1'; ctx.font = `800 19px "Chakra Petch", Arial, sans-serif`; ctx.fillText(String(sumItems[i][1]), tx + 13, y + 58);
    }
    y += th + 24;
  }
  // Pie: nuestra marca (sello) + aclaracion + fecha
  ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(Wc - pad, y); ctx.stroke();
  const fy = y + 42; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF'; ctx.font = `800 26px "Chakra Petch", Arial, sans-serif`; ctx.fillText('DecFreedom', pad, fy);
  const dw2 = ctx.measureText('DecFreedom').width; ctx.fillStyle = band.col; ctx.fillText('.com', pad + dw2, fy);
  ctx.fillStyle = 'rgba(173,182,194,.82)'; ctx.font = `500 13px Arial, sans-serif`; ctx.fillText('Security diagnosis of this token, not a rating of DecFreedom', pad, fy + 26);
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(125,135,148,.85)'; ctx.font = `500 13px Arial, sans-serif`; ctx.fillText(new Date().toISOString().slice(0, 10), Wc - pad, fy + 26);
  return cv;
}

/* Las 9 verificaciones (dato real de la auditoria). Se pintan primero "escaneando" (barra que corre) y
   luego se revelan una a una, en cascada, resolviendo a palomita verde o X roja: procedimiento dramatico. */
const CHECKS_DEF = [
  { k: 'sellable', t: 'No honeypot', v: (c) => c.sellable ? 'Sellable' : 'Risky' },
  { k: 'lpSecured', t: 'Liquidity burned', v: (c, d) => d.lpAsegurada != null ? pct(d.lpAsegurada) : (c.lpSecured ? 'Yes' : 'No') },
  { k: 'renounced', t: 'Ownership renounced', v: (c) => c.renounced ? 'Yes' : 'No' },
  { k: 'lowTax', t: 'Low taxes', v: (c, d) => pct(d.buyTax || 0) + ' / ' + pct(d.sellTax || 0) },
  { k: 'notMintable', t: 'Not mintable', v: (c) => c.notMintable ? 'Yes' : 'Mintable' },
  { k: 'noPause', t: 'Not pausable', v: (c) => c.noPause ? 'Yes' : 'Pausable' },
  { k: 'noBlacklist', t: 'No blacklist', v: (c) => c.noBlacklist ? 'Yes' : 'Risk' },
  { k: 'notConcentrated', t: 'Distribution', v: (c, d) => d.top10Pct != null ? 'Top 10 ' + pct(d.top10Pct) : (c.notConcentrated ? 'Healthy' : 'Concentrated') },
  { k: 'verified', t: 'Verified source', v: (c) => c.verified ? 'Yes' : 'No' }
];
const CHK_STEP = 150, CHK_DELAY = 260;
function checksScan() {
  return CHECKS_DEF.map((c) => `<div class="tg-chk scan"><span><i class="tg-chk-sp"></i>${c.t}</span><b class="tg-chk-bar"><em></em></b></div>`).join('');
}
/* Cuando GoPlus aun no indexo el token, en vez de NO mostrar nada (el usuario lo vio en monedas de Binance
   reconocidas con Token info completo), revela los hallazgos leidos EN CADENA (propiedad renunciada, liquidez
   quemada, concentracion del top 10, creador, snipers, bundle) como checks reales. Honeypot e impuestos siguen
   necesitando el escaner, y eso se dice en la nota. animar=true hace la cascada; false repinta sin animar. */
function pintarOnchain(host, r, animar) {
  const onchain = ((r && r.hallazgos) || []).filter((x) => x && (x.n === 'ok' || x.n === 'warn' || x.n === 'bad'));
  // SIN coletilla de "scanner no indexado" (el usuario la odia con razon): el diagnostico son los hallazgos
  // REALES de cadena, cada uno con su motivo. Nada de parrafos pidiendo disculpas por el escaner.
  if (!onchain.length) { host.innerHTML = `<div class="tg-chk-note">Live on-chain analysis. Reopen the token if nothing appears.</div>`; return 0; }
  // El texto del hallazgo ("Top 10 hold 70%", "Owner still in control") YA es el veredicto; antes cada fila
  // repetia ademas la palabra "Caution" en la columna derecha -> salia "Caution / Caution / Caution". Se quita:
  // el icono (check verde / X roja) y el color de la fila ya dicen si es bueno o un riesgo.
  const fila = (x) => { const ok = x.n === 'ok'; return `<div class="tg-chk rev ${ok ? 'ok' : 'no'}"><span><i>${ok ? ICO_CHECK : ICO_X}</i>${esc(x.t)}</span><b></b></div>`; };
  if (!animar) { host.innerHTML = onchain.map(fila).join(''); return 0; }
  host.innerHTML = onchain.map(() => `<div class="tg-chk scan"><span><i class="tg-chk-sp"></i></span><b class="tg-chk-bar"><em></em></b></div>`).join('');
  const rows = host.querySelectorAll('.tg-chk');
  rows.forEach((row, i) => {
    setTimeout(() => {
      if (!row.isConnected) return; const x = onchain[i]; if (!x) return; const ok = x.n === 'ok';
      row.className = 'tg-chk rev ' + (ok ? 'ok' : 'no');
      row.innerHTML = `<span><i>${ok ? ICO_CHECK : ICO_X}</i>${esc(x.t)}</span><b></b>`;
    }, CHK_STEP * i + CHK_DELAY);
  });
  return CHK_STEP * rows.length + CHK_DELAY;
}
/* Revela cada check con retardo escalonado. Devuelve cuanto dura toda la cascada (ms). */
function revelarChecks(host, r) {
  const c = (r && r.datos && r.datos.checks) ? r.datos.checks : null;
  const d = (r && r.datos) ? r.datos : {};
  const rows = host.querySelectorAll('.tg-chk');
  // IMPOSTOR: muestra los hallazgos (que empiezan por "Impersonates USDT", rojo) en vez de las casillas verdes
  // de GoPlus, que para un fake USDT confunden ("no es honeypot" da igual si se hace pasar por Tether).
  if (r && r.impostor) { return pintarOnchain(host, r, true); }
  if (!c) { return pintarOnchain(host, r, true); }
  rows.forEach((row, i) => {
    setTimeout(() => {
      if (!row.isConnected) return;
      const def = CHECKS_DEF[i]; const ok = !!c[def.k];
      row.className = 'tg-chk rev ' + (ok ? 'ok' : 'no');
      row.innerHTML = `<span><i>${ok ? ICO_CHECK : ICO_X}</i>${def.t}</span><b>${def.v(c, d)}</b>`;
    }, CHK_STEP * i + CHK_DELAY);
  });
  return CHK_STEP * rows.length + CHK_DELAY;
}
/* Refresca valor y color de los checks ya revelados con el resultado completo, SIN volver a animar
   (lo usa el segundo paso de la auditoria para afinar Distribution y demas sin repetir la cascada). */
function refrescarChecks(r) {
  const c = (r && r.datos && r.datos.checks) ? r.datos.checks : null;
  const d = (r && r.datos) ? r.datos : {};
  const ch = $('tg-checks'); if (!ch) return;
  if (r && r.impostor) { pintarOnchain(ch, r, false); return; }
  if (!c) { pintarOnchain(ch, r, false); return; }   // sin escaner: repinta los hallazgos en cadena (pass 2 trae mas)
  ch.querySelectorAll('.tg-chk').forEach((row, i) => {
    if (!row.isConnected) return; const def = CHECKS_DEF[i]; if (!def) return;
    const ok = !!c[def.k];
    row.className = 'tg-chk rev ' + (ok ? 'ok' : 'no');
    row.innerHTML = `<span><i>${ok ? ICO_CHECK : ICO_X}</i>${def.t}</span><b>${def.v(c, d)}</b>`;
  });
}
/* Historial del creador: pide el resumen (BscScan + DexScreener, sin servidor) y lo pinta en Security. */
function historialCreadorBig(it, creador) {
  const host = $('tg-creador'); if (!host) return;
  historialCreador(creador, it.token).then((h) => {
    const el = $('tg-creador'); if (!el || _itActual !== it) return;
    if (!h) { el.className = 'tg-creador'; el.innerHTML = '<span class="tg-cre-mut">Creator history unavailable</span>'; return; }
    const niv = h.nivel === 'bad' ? 'bad' : (h.nivel === 'warn' ? 'warn' : 'ok');
    el.className = 'tg-creador ' + niv;
    const lista = (h.tokens && h.tokens.length) ? `<div class="tg-cre-list">${h.tokens.slice(0, 6).map((t) => `<a class="tg-cre-tok ${t.estado}" href="${SCAN_URL}/token/${t.addr}" target="_blank" rel="noopener" title="${esc(t.addr)}">${esc(t.simbolo || corto(t.addr))}<em>${t.liq >= 1000 ? '$' + Math.round(t.liq / 1000) + 'k' : (t.liq > 0 ? '$' + Math.round(t.liq) : 'dead')}</em></a>`).join('')}</div>` : '';
    el.innerHTML = `<div class="tg-cre-v"><i>${ICO_SEM[niv] || ICO_SEM.pend}</i><b>${esc(h.texto)}</b></div>${lista}`;
  }).catch(() => { const el = $('tg-creador'); if (el) { el.className = 'tg-creador'; el.innerHTML = '<span class="tg-cre-mut">Creator history unavailable</span>'; } });
}

/* ── Panel derecho: area de operar (spot). Market (compra a mercado por el flujo probado abrirCompra),
   Alert (alerta de precio, reusa alertas.js), saldos, Open Alerts y Positions (reusan compra/posiciones). ── */
function pintarDer(it, ctx) {
  const host = $('tg-right'); if (!host) return;
  if (!it) { host.innerHTML = `<div class="tg-sec-t">Trade</div><div class="tg-soon" style="margin-top:4px">Pick a token to buy, set a price alert and see your live positions.</div>`; return; }
  const oper = it.operable !== false;   // Tron (y BSC sin ruta de swap) NO son operables: solo alertas, Market bloqueado
  host.innerHTML = `
    <div class="tg-tabs2" id="tg-op-tabs"><button type="button" class="t${oper ? ' on' : ''}" data-op="market"${oper ? '' : ' disabled title="Not tradable here yet"'}>Market</button><button type="button" class="t${oper ? '' : ' on'}" data-op="alert">Alert</button></div>
    <div class="tg-op" id="tg-op-market"${oper ? '' : ' hidden'}></div>
    <div class="tg-op" id="tg-op-alert"${oper ? ' hidden' : ''}>
      <label class="tg-op-lbl">Alert me when the price reaches</label>
      <div class="tg-al-set"><span class="tg-al-d">$</span><input id="tg-al-price" type="text" inputmode="decimal" autocomplete="off" placeholder="0.0"></div>
      <div class="tg-al-presets" id="tg-al-presets"></div>
      <div class="tg-al-custom"><span class="lb">or move</span><input id="tg-al-pct" type="text" inputmode="decimal" autocomplete="off" placeholder="e.g. 35 or -15"><button class="tg-al-pctgo" id="tg-al-pctgo" type="button">Apply %</button></div>
      <div class="tg-al-hint" id="tg-al-hint">Tap a move, type a target or a %. You get a notification when it is hit — it is not an order and never touches your funds.</div>
      <button class="tg-al-go" id="tg-al-set" type="button">Set price alert</button>
    </div>
    <div class="tg-balrow" id="tg-balrow"></div>
    <div class="tg-sec-t tg-mt">Open alerts</div>
    <div id="tg-openalerts"><div class="tg-soon">No alerts yet.</div></div>`;
  host.querySelectorAll('#tg-op-tabs button').forEach((b) => { b.onclick = () => {
    if (b.disabled) return;
    host.querySelectorAll('#tg-op-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    const m = b.dataset.op, mk = $('tg-op-market'), al = $('tg-op-alert'); if (mk) mk.hidden = m !== 'market'; if (al) al.hidden = m !== 'alert';
  }; });
  if (oper) montarMercado(it);
  else { const mk = $('tg-op-market'); if (mk) mk.innerHTML = `<div class="tg-soon">${it.red === 'tron' ? 'Tron token — trading is not available here yet. You can still set price alerts below.' : 'Not tradable here yet. You can still set price alerts.'}</div>`; }
  const setA = $('tg-al-set'), inA = $('tg-al-price'), pctIn = $('tg-al-pct'), pctGo = $('tg-al-pctgo');
  if (inA) inA.placeholder = precioGrafBig() > 0 ? fmtTxt(precioGrafBig()) : '0.0';
  const sim = esc(it.simbolo || 'it');
  // Rellena el objetivo a partir de un % de movimiento sobre el precio del GRAFICO (lo que ve el usuario), para
  // que nunca tenga que escribir un precio con doce ceros ni calcularlo a mano. Deja el numero en el campo listo.
  const aplicarMov = (pc) => {
    const ref = precioGrafBig(), h = $('tg-al-hint');
    if (!(ref > 0)) { if (h) h.textContent = 'Waiting for the live price…'; return; }
    if (!isFinite(pc) || pc === 0) { if (pctIn) pctIn.focus(); return; }
    const tgt = ref * (1 + pc / 100);
    if (inA) inA.value = fmtTxt(tgt);
    if (h) h.innerHTML = `Notify when ${sim} ${pc > 0 ? 'rises' : 'drops'} ${Math.abs(pc)}% to <b>$${fmtP(tgt, 5)}</b>. Tap “Set price alert”.`;
  };
  let _ponerBusy = false;
  const poner = async () => {
    if (_ponerBusy) return;
    const v = parseFloat(String(inA.value).replace(/[, $]/g, '')); if (!(v > 0)) { inA.focus(); return; }
    const h = $('tg-al-hint');
    // Valida contra el precio EN VIVO (la MISMA fuente que vigila la alerta), no contra el cierre del grafico.
    // Asi la direccion y el objetivo concuerdan con lo que disparara la alerta. Si el objetivo YA esta alcanzado
    // (igual o pasado el precio actual) NO se crea: se avisa. Esa descoordinacion era la causa del "se disparo
    // nada mas ponerla" (la alerta se creaba ya cumplida porque el precio vivo difiere del cierre del grafico).
    _ponerBusy = true; if (setA) { setA.disabled = true; setA.textContent = 'Checking price…'; }
    let ref = 0; try { ref = await precioUsdVivo(it, bnbUsd()); } catch (_) {}
    if (!(ref > 0)) ref = precioGrafBig();
    _ponerBusy = false; if (setA) { setA.disabled = false; setA.textContent = 'Set price alert'; }
    if (ref > 0) {
      const dirUp = v > ref * 1.0005, dirDn = v < ref * 0.9995;
      if (!dirUp && !dirDn) { if (h) h.innerHTML = `That target is the current price (<b>$${fmtP(ref, 5)}</b>). Pick one a bit above or below.`; return; }
      const dir = dirUp ? 'up' : 'down';
      crearAlerta(it, v, dir); inA.value = ''; if (pctIn) pctIn.value = '';
      if (h) h.innerHTML = `Alert set at <b>$${fmtP(v, 5)}</b>. ${dir === 'up' ? 'Notifies when the price RISES to it.' : 'Notifies when the price FALLS to it.'}`;
    } else {
      const dir = v >= precioGrafBig() ? 'up' : 'down';   // sin precio en vivo: cae al cierre del grafico
      crearAlerta(it, v, dir); inA.value = ''; if (pctIn) pctIn.value = '';
      if (h) h.innerHTML = `Alert set at <b>$${fmtP(v, 5)}</b>.`;
    }
    derOpenAlerts(it);
  };
  if (setA && inA) { setA.onclick = poner; inA.onkeydown = (e) => { if (e.key === 'Enter') poner(); }; }
  if (pctGo && pctIn) { const go = () => { const pc = parseFloat(String(pctIn.value).replace(/[%\s]/g, '').replace(',', '.')); aplicarMov(pc); }; pctGo.onclick = go; pctIn.onkeydown = (e) => { if (e.key === 'Enter') go(); }; }
  // Presets rapidos: ± sobre el precio del grafico. Rojo = baja (comprar barato), verde = sube (vender caro).
  const presets = $('tg-al-presets');
  if (presets) {
    presets.innerHTML = [-20, -10, 10, 20].map((p) => `<button class="tg-al-chip ${p < 0 ? 'dn' : 'up'}" type="button" data-pct="${p}">${p > 0 ? '+' : ''}${p}%</button>`).join('');
    presets.querySelectorAll('.tg-al-chip').forEach((b) => b.onclick = () => aplicarMov(Number(b.dataset.pct)));
  }
  derBalances(it); derOpenAlerts(it); derPositions();
  if (_abrirAlerta) { _abrirAlerta = false; const ab = host.querySelector('#tg-op-tabs button[data-op="alert"]'); if (ab) ab.click(); }
}
/* Pasa el precio a texto plano para un <input> o un canvas (sin <sub>). fmtP devuelve "0.0<sub>n</sub>dig",
   donde el bloque "0.0<sub>n</sub>" entero significa "0." + n ceros (p.ej. 0.0<sub>3</sub>1732 = 0.0001732).
   Hay que sustituir TODO ese bloque, no solo el <sub>: si se dejaba el "0.0" literal y ademas se expandia el
   subindice, salia un cero de mas (0.00001732) y el numero quedaba 10x mas pequeno -> la alerta se creaba 10x
   por debajo del precio y aparecia debajo de la vela. Esa era la causa raiz de esa incongruencia. */
function fmtTxt(p) { return String(fmtP(p, 5)).replace(/0\.0<sub>(\d+)<\/sub>/, (m, z) => '0.' + '0'.repeat(+z)); }
/* Precio que se VE en el grafico ahora mismo (cierre de la ultima vela). Las alertas y los presets se calculan
   sobre ESTE precio, no sobre _precioUsd, para que un +20% quede SIEMPRE por encima de las velas dibujadas y
   nunca caiga por debajo del precio actual (era la incongruencia que reporto el usuario). Si no hay velas, usa
   el precio en vivo. */
function precioGrafBig() {
  try { if (Array.isArray(_velasRawBig) && _velasRawBig.length) { const v = _velasRawBig[_velasRawBig.length - 1]; if (v && v.close > 0 && isFinite(v.close)) return v.close; } } catch (_) {}
  return (_precioUsd > 0 && isFinite(_precioUsd)) ? _precioUsd : 0;
}

function derBalances(it) {
  const host = $('tg-balrow'); if (!host) return;
  const c = wallet.cuentaActual();
  if (!c) { host.innerHTML = `<button class="tg-mbtn sec" id="tg-conn" type="button">Connect wallet</button>`; const b = $('tg-conn'); if (b) b.onclick = async () => { try { await wallet.conectar(); } catch (_) {} if (_itActual) pintarDer(_itActual, _ctx); }; return; }
  host.innerHTML = `<div class="tg-bal"><img class="tg-bal-ic" src="${LOGO_BNB}" alt="" onerror="this.remove()"><div class="tg-bal-tx"><span>Wallet</span><b id="tg-bal-bnb">…</b></div></div><div class="tg-bal"><img class="tg-bal-ic" src="${LOGO_USDT}" alt="" onerror="this.remove()"><div class="tg-bal-tx"><span>USDT</span><b id="tg-bal-usdt">…</b></div></div>`;
  saldoBNB(c).then((w) => { const e = $('tg-bal-bnb'); if (e) e.textContent = (+ethers.formatEther(w)).toFixed(4); }).catch(() => {});
  saldoToken(USDT, c).then((w) => { const e = $('tg-bal-usdt'); if (e) e.textContent = (+ethers.formatUnits(w, 18)).toFixed(2); }).catch(() => {});
}

/* Marca en la grafica las alertas (no disparadas) de este token: verde=sube, rojo=baja. */
function marcarAlertasBig(it) {
  try { if (!it) { marcarAlertas([]); return; } marcarAlertas(alertasDe(it.token).filter((a) => !a.disparada).map((a) => ({ price: a.objetivo, dir: a.dir, title: (a.dir === 'up' ? '▲ ' : '▼ ') + 'Alert $' + fmtTxt(a.objetivo) }))); } catch (_) {}
}
/* Open alerts: muestra TODAS tus alertas (de cualquier token), no solo las del token abierto. Antes filtraba por
   it.token, asi que una alerta puesta en una moneda "desaparecia" al abrir otra y solo se veia en el lobby
   (History/Verifications): esa era la causa de "la alerta no sale". Ahora cada alerta que creas, en BSC o Tron,
   aparece aqui con su simbolo; la del token abierto va resaltada y marcada en la grafica. Tocar una de OTRO token
   la abre en el OFC. El ✕ la cancela siempre. */
function derOpenAlerts(it) {
  const host = $('tg-openalerts'); if (!host) return;
  marcarAlertasBig(it);
  const todas = listaAlertas();
  if (!todas.length) { host.innerHTML = `<div class="tg-soon">No alerts yet. Set one above and every alert you create, on any token, shows here.</div>`; return; }
  const actual = (it && it.token) ? String(it.token).toLowerCase() : '';
  host.innerHTML = todas.map((a) => {
    const mismo = actual && String(a.token).toLowerCase() === actual;
    const red = a.red === 'tron' ? 'TRON' : 'BSC';
    return `<div class="tg-alrow ${a.disparada ? 'done' : ''}${mismo ? ' cur' : ''}" data-id="${esc(a.id)}"${mismo ? '' : ' title="Open ' + esc(a.simbolo || 'token') + '"'}><span class="tg-aldir ${a.dir}"></span><span class="tg-alsym" data-net="${red}">${esc(a.simbolo || '?')}</span><b>$${fmtP(a.objetivo)}</b>${a.disparada ? '<em>hit</em>' : ''}<button class="tg-alx" data-id="${esc(a.id)}" type="button" aria-label="Remove alert">✕</button></div>`;
  }).join('');
  host.querySelectorAll('.tg-alx').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); quitarAlerta(b.dataset.id); derOpenAlerts(_itActual); }; });
  // Tocar una alerta de OTRO token la abre en el OFC (misma ventana), usando el cargador del modulo.
  host.querySelectorAll('.tg-alrow:not(.cur)').forEach((row) => { row.onclick = () => {
    const a = listaAlertas().find((x) => x.id === row.dataset.id); if (!a || !_cargar) return;
    try { _cargar({ token: a.token, simbolo: a.simbolo, par: a.par || null, moneda: a.moneda || 'BNB', decimales: a.decimales || 18, red: a.red || 'bsc', fuentePrecio: a.fuentePrecio || 'v2', operable: a.red !== 'tron' }); } catch (_) {}
  }; });
}
/* Lo llama el vigilante (terminal.js) cuando una alerta se dispara, para refrescar Open Alerts del OFC si esta
   abierto: la alerta pasa a 'hit' pero SIGUE con su boton de cancelar, sin tener que reabrir la pestaña. */
export function refrescarAlertasOFC() { try { if (_ov && _ov.isConnected && _itActual) derOpenAlerts(_itActual); } catch (_) {} }

/* ── Tarjeta de posicion (replica aprobada) para la seccion full-width del OFC. Datos REALES de enVivo. ── */
const PC_CLK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const PC_EXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6"/><path d="M15 9l-6 6"/></svg>';
const PC_FLAME = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3-1 4-2 6s0 4 0 4-3-1-3-4c0 0-3 2-3 6a8 8 0 0 0 16 0c0-5-5-6-5-10 0 0-1 1-3-2z"/></svg>';
const PC_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>';
const PC_DN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 7l10 10"/><path d="M16 17H7V8"/></svg>';
const PC_SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
/* % compacto sin decimales: <=999 entero, luego K/M/B/T... (max ~7 chars). Nunca desborda la capsula. */
function pctCompact(v) {
  if (v == null || !isFinite(v)) return '0%';
  const sg = v < 0 ? '-' : '+'; let a = Math.abs(v);
  if (a < 1000) return sg + Math.round(a) + '%';
  let u = 0; while (a >= 1000 && u < PC_SUF.length - 1) { a /= 1000; u++; }
  let s = a < 10 ? (Math.round(a * 10) / 10).toFixed(1).replace(/\.0$/, '') : String(Math.round(a));
  if (s === '1000') { s = '1'; u++; }
  return sg + s + (PC_SUF[u] || '') + '%';
}
function haceP(ms) { if (!ms) return '—'; const s = Math.max(0, Math.floor((Date.now() - ms) / 1000)); if (s < 60) return s + 's'; const m = Math.floor(s / 60); if (m < 60) return m + 'm'; const h = Math.floor(m / 60); if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; }
function qtyP(n) { n = Number(n) || 0; if (n < 1e6) return n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 4 : 0 }); const U = [['T', 1e12], ['B', 1e9], ['M', 1e6]]; for (const [s, v] of U) { if (n >= v) { const x = n / v; return (x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : Math.round(x)) + s; } } return String(Math.round(n)); }
function invP(n) { n = Number(n) || 0; return n < 1000 ? '$' + n.toFixed(2) : money(n); }
let _pcSpkN = 0;
/* sparkline figurativa (alta frecuencia): sube en ganancia, baja en perdida. NO usa datos de mercado. */
function pcSpark(up) {
  const N = 60, W = 100, pts = [];
  for (let i = 0; i < N; i++) { const t = i / (N - 1); const trend = up ? (90 - t * 79) : (11 + t * 79); const noise = Math.sin(i * 0.38 + 0.5) * 5.4 + Math.sin(i * 0.9) * 3 + Math.sin(i * 1.9 + 1.2) * 1.9 + Math.sin(i * 4.3 + 0.4) * 1.2 + Math.sin(i * 8.7) * 0.7; pts.push(Math.max(7, Math.min(93, trend + noise))); }
  let d = 'M0,' + pts[0].toFixed(2); for (let i = 1; i < N; i++) d += ' L' + (i * (W / (N - 1))).toFixed(2) + ',' + pts[i].toFixed(2);
  const area = d + ' L100,100 L0,100 Z', ly = pts[N - 1], c = up ? '#00F5C0' : '#FF385F', id = 'pcspk' + (_pcSpkN++);
  return `<svg class="pcd-spark-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".38"/><stop offset=".7" stop-color="${c}" stop-opacity=".07"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${c}" stroke-width="1.7" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 0 2.5px ${c})"/></svg><span class="pcd-dot-end" style="top:${ly.toFixed(1)}%"></span>`;
}
export function tarjetaPos(d) {
  const up = d.pnlUsd >= 0;
  const sym = esc(d.simbolo || '?'), nombre = esc(d.nombre || d.simbolo || 'Token');
  const pay = d.moneda === 'USDT' ? 'USDT' : 'BNB', payCls = pay.toLowerCase();
  const entry = d.entradaUsd > 0 ? '$' + fmtP(d.entradaUsd) : '—', cur = d.precioUsd > 0 ? '$' + fmtP(d.precioUsd) : '—';
  const nuevo = d.abierta && (Date.now() - d.abierta < 86400000);
  return `<div class="pcd ${up ? 'up' : 'down'}" data-a="${esc(d.token)}">
    <div class="pcd-age">${PC_CLK}<span><span class="l">Token Age</span><span class="v">${haceP(d.abierta)} ago</span></span></div>
    <div class="pcd-id">
      <div class="pcd-logo"><span>${logo(d.token, d.red, d.logoUrl)}</span></div>
      <div class="pcd-idtx">
        <div class="pcd-nm"><b title="${nombre}">${sym}</b><a class="pcd-ext" href="${SCAN_URL}/token/${esc(d.token)}" target="_blank" rel="noopener" aria-label="View on explorer">${PC_EXT}</a></div>
        <span class="pcd-sub">${nombre}</span>
        ${nuevo ? `<span class="pcd-new">${PC_FLAME}New</span>` : ''}
        <div class="pcd-pair"><span class="pcd-coin"><span class="pcd-cimg ${payCls}"><img src="${pay === 'USDT' ? LOGO_USDT : LOGO_BNB}" alt="" loading="lazy" onerror="this.remove()"></span>${pay}</span><span class="pcd-arrow">→</span><span class="pcd-coin"><span class="pcd-cimg pcd-cimg-tok">${logo(d.token, d.red, d.logoUrl)}</span>${sym}</span></div>
      </div>
    </div>
    <div class="pcd-vdiv"></div>
    <div class="pcd-stats">
      <div class="pcd-kv"><span class="lbl">Entry Price</span><b>${entry}</b></div>
      <div class="pcd-kv"><span class="lbl">Current Price</span><b class="pcd-cur">${cur}</b></div>
      <div class="pcd-hdiv"></div>
      <div class="pcd-qty"><div class="pcd-kv"><span class="lbl">Quantity</span><b>${qtyP(d.cant)}</b></div><div class="pcd-kv"><span class="lbl">Invested</span><b>${invP(d.costoUsd)}</b></div></div>
    </div>
    <div class="pcd-vdiv"></div>
    <div class="pcd-pnl">
      <div class="pcd-pnl-h">${up ? PC_UP : PC_DN}P&L</div>
      <div class="pcd-pnl-pct">${pctCompact(d.pnlPct)}</div>
      <div class="pcd-pnl-usd">${d.pnlUsd >= 0 ? '+' : '-'}${invP(Math.abs(d.pnlUsd))}</div>
    </div>
    <div class="pcd-right">
      <span class="pcd-base"></span>
      <div class="pcd-chart">${pcSpark(up)}</div>
      <div class="pcd-status"><i></i>Position Active</div>
    </div>
  </div>`;
}
/* Posiciones REALES del usuario (todas), en tarjetas full-width. Se refresca sola por polling (ver abrirGrande). */
async function derPositions() {
  const host = $('tg-positions'); if (!host) return;
  const sub = $('tg-posfull-sub');
  const c = wallet.cuentaActual();
  if (!c) { host.innerHTML = `<div class="tg-soon">Connect your wallet to see your live positions here.</div>`; if (sub) sub.textContent = ''; return; }
  const lista = listaDe(c);
  if (!lista.length) { host.innerHTML = `<div class="tg-soon">No positions yet. Buy a token here and it shows up with live profit.</div>`; if (sub) sub.textContent = ''; return; }
  if (!host.querySelector('.pcd')) host.innerHTML = `<div class="tg-soon">Reading your positions on chain…</div>`;
  const bnb = (_ctx && _ctx.bnbUsd) ? _ctx.bnbUsd() : 0;
  const datos = (await Promise.all(lista.map((p) => enVivo(c, p, bnb).catch(() => null)))).filter((d) => d && d.cant > 0);
  if (!$('tg-positions')) return;
  if (!datos.length) { host.innerHTML = `<div class="tg-soon">No open positions right now.</div>`; if (sub) sub.textContent = ''; return; }
  datos.sort((a, b) => b.valorUsd - a.valorUsd);
  if (sub) sub.textContent = datos.length + ' open · live';
  host.innerHTML = datos.map((d) => tarjetaPos(d)).join('');
  host.querySelectorAll('.pcd').forEach((r) => { r.onclick = (e) => { if (e.target.closest('.pcd-ext')) return; const d = datos.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (d && _cargar) _cargar({ token: d.token, par: d.par, quote: d.quote || null, moneda: d.moneda || 'BNB', simbolo: d.simbolo, nombre: d.nombre || d.simbolo, decimales: d.decimales || 18, fuente: 'pancake', tiempo: 0, bloque: 0, liquidez: 0, precio: 0, creador: '' }); }; });
}

/* ── Marca la entrada de la posicion abierta de este token en la grafica (si la hay) ── */
/* Reagrupa las velas por-operacion en cubos de 'seg' segundos (OHLC real por cubo), igual que el lobby. */
function agruparBig(velas, seg) {
  if (!Array.isArray(velas) || !velas.length) return [];
  if (!seg || seg <= 0) return velas.slice();
  const m = new Map();
  for (const v of velas) {
    const k = Math.floor(v.time / seg) * seg;
    const e = m.get(k);
    if (!e) m.set(k, { time: k, open: v.open, high: v.high, low: v.low, close: v.close });
    else { if (v.high > e.high) e.high = v.high; if (v.low < e.low) e.low = v.low; e.close = v.close; }
  }
  return [...m.values()].sort((a, b) => a.time - b.time);
}
/* Monta el grafico del Full Chart desde las velas crudas en cache, reagrupadas al timeframe activo. */
function renderChartBig() {
  const cv = $('tg-chart-cv'), msg = $('tg-chart-msg'); if (!cv) return;
  if (_velasRawBig == null) { if (msg) { msg.hidden = false; msg.innerHTML = '<span class="tg-anillo"></span>'; } return; }
  // GeckoTerminal ya entrega las velas al timeframe pedido: NO se reagrupan. El metodo V2 (eventos Sync) si.
  const velas = _chartFuente === 'gecko' ? _velasRawBig : agruparBig(_velasRawBig, _tfSecBig);
  if (velas.length) { if (msg) msg.hidden = true; montarGrafico(cv, velas); marcarEntradaDe(_itActual); marcarAlertasBig(_itActual); }
  else { try { destruirGrafico(); } catch (_) {} if (msg) { msg.hidden = false; msg.textContent = _chartFuente === 'gecko' ? 'No chart data for this token yet' : 'No trades yet'; } }
}
function marcarEntradaDe(it) {
  try {
    if (!it || !it.par) { limpiarEntrada(); return; }
    const c = wallet.cuentaActual(); if (!c) { limpiarEntrada(); return; }
    const pos = listaDe(c).find((p) => p.token && p.token.toLowerCase() === it.token.toLowerCase());
    if (!pos) { limpiarEntrada(); return; }
    const dec = pos.decimales || 18;
    const amt = Number(ethers.formatUnits(BigInt(pos.cantidad || '0'), dec));
    if (!(amt > 0) || !(pos.costoUsd > 0)) { limpiarEntrada(); return; }
    const entry = pos.costoUsd / amt;
    if (entry > 0) marcarEntrada(entry, 'Entry $' + fmtTxt(entry));
  } catch (_) {}
}
/* Posicion guardada de este token con su ganancia aproximada al precio actual, o null. */
function posicionDe(it) {
  try {
    const c = wallet.cuentaActual(); if (!c) return null;
    const pos = listaDe(c).find((p) => p.token && p.token.toLowerCase() === it.token.toLowerCase());
    if (!pos) return null;
    const dec = pos.decimales || 18;
    const amt = Number(ethers.formatUnits(BigInt(pos.cantidad || '0'), dec));
    if (!(amt > 0)) return null;
    const pnl = amt * (_precioUsd || 0) - (pos.costoUsd || 0);
    const pnlPct = (pos.costoUsd > 0) ? pnl / pos.costoUsd * 100 : 0;
    return { pnl, pnlPct };
  } catch (_) { return null; }
}
function openBuyOrSell(it, modo) {
  if (modo === 'buy') { const t = document.querySelector('#tg-op-tabs button[data-op="market"]'); if (t) t.click(); try { const sl = $('tg-buy-sl'); if (sl) { sl.scrollIntoView({ block: 'nearest' }); sl.focus(); } } catch (_) {} return; }
  const aud = _ctx && _ctx.auditoriaDe ? _ctx.auditoriaDe(it) : null;
  const go = () => { try { abrirCompra(it, aud, 'sell'); } catch (_) {} };
  if (!wallet.cuentaActual()) { wallet.conectar().then(go).catch(go); } else go();
}
function numCorto(n) { n = Number(n) || 0; if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K'; if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); return n.toLocaleString('en-US', { maximumFractionDigits: 6 }); }

/* Compra a mercado INCRUSTADA en la pestaña Market (sin ventana emergente): moneda, monto por barra,
   lo que recibes y Confirm buy. Reusa las primitivas probadas de compra.js (cotizar, comprar) y paga con BNB. */
let _buyTk = 0;
function montarMercado(it) {
  const host = $('tg-op-market'); if (!host || !it) return;
  const quote = it.moneda === 'USDT' ? USDT : WBNB;
  const sym = esc(it.simbolo || 'TOKEN');
  const dec = it.decimales || 18;
  const bnbUsd = _ctx && _ctx.bnbUsd ? _ctx.bnbUsd() : 0;
  let balance = 0n, prc = 0, cot = null, cotPara = 0n, ocupado = false, protegido = false, slipBps = PROTECCION.slipProtegido, _presetWei = null;
  let gas = 0n; try { gas = ethers.parseEther('0.003'); } catch (_) {}
  host.innerHTML = `
    <div class="tg-mktcap"><b id="tg-mkt-price">${_precioUsd > 0 ? '$' + fmtP(_precioUsd, 5) : '$0'}</b><span>Market price</span></div>
    <div class="tg-buy-cur"><button class="tg-buy-c on" type="button">BNB</button><button class="tg-buy-c" type="button" disabled title="Needs a contract update">USDT soon</button></div>
    <div class="tg-buy-amtrow"><span>Amount · buys ${sym} at market</span><span id="tg-buy-bal">Balance …</span></div>
    <input class="tg-buy-slider" id="tg-buy-sl" type="range" min="0" max="100" value="0" aria-label="Amount">
    <div class="tg-buy-amtrow"><b id="tg-buy-val">0 BNB</b><span id="tg-buy-usd"></span></div>
    <div class="tg-buy-presets" id="tg-buy-presets">${PRESETS_BNB.map((v) => `<button type="button" data-v="${v}">${v}</button>`).join('')}</div>
    <div class="tg-buy-get">You get <b id="tg-buy-out">0</b> ${sym}</div>
    <div class="tg-prot" id="tg-prot">
      <div class="tg-prot-row"><label class="tg-prot-tog"><input type="checkbox" id="tg-prot-on"><span class="tg-prot-sw"></span><b>Protected</b></label><span class="tg-prot-meter ok" id="tg-prot-meter"></span></div>
      <div class="tg-prot-slip" id="tg-prot-slip" hidden>${PROTECCION.opciones.map((b) => `<button type="button" data-b="${b}"${b === PROTECCION.slipProtegido ? ' class="on"' : ''}>${b / 100}%</button>`).join('')}</div>
      <div class="tg-prot-note">Your order reverts here before it fills at a bad price. Nothing leaves to anyone.</div>
    </div>
    <button class="tg-buy-go" id="tg-buy-go" type="button">Confirm buy</button>
    <div class="tg-buy-msg" id="tg-buy-msg"></div>`;
  const sl = $('tg-buy-sl'), valEl = $('tg-buy-val'), usdEl = $('tg-buy-usd'), outEl = $('tg-buy-out'), balEl = $('tg-buy-bal'), go = $('tg-buy-go'), msg = $('tg-buy-msg');
  const vivo = () => $('tg-buy-go') === go;   // el form sigue montado (no se recargo con otro token)
  const maxWei = () => (balance > gas ? balance - gas : 0n);
  // Monto a comprar: si hay preset activo manda el preset (acotado al maximo); si no, el % del slider.
  const montoWei = () => { if (_presetWei != null) { const mx = maxWei(); return _presetWei > mx ? mx : _presetWei; } return maxWei() * BigInt(prc) / 100n; };
  const estado = () => {
    if (ocupado) return;
    if (!wallet.cuentaActual()) { go.disabled = false; go.textContent = 'Connect wallet'; return; }
    const w = montoWei();
    if (!(w > 0n)) { go.disabled = true; go.textContent = 'Enter an amount'; return; }
    if (!cot || cotPara !== w) { go.disabled = true; go.textContent = 'Getting price…'; return; }
    if (!(cot.tokOut > 0n)) { go.disabled = true; go.textContent = 'No liquidity'; return; }
    go.disabled = false; go.textContent = 'Confirm buy';
  };
  const pintar = () => {
    const w = montoWei();
    valEl.textContent = (+ethers.formatEther(w)).toFixed(4) + ' BNB';
    usdEl.textContent = (bnbUsd > 0 && w > 0n) ? '~$' + fmtTxt(Number(ethers.formatEther(w)) * bnbUsd) : '';
    if (cot && cotPara === w && w > 0n) outEl.textContent = numCorto(Number(ethers.formatUnits(cot.tokOut, dec)));
    else outEl.textContent = w > 0n ? '…' : '0';
    estado();
  };
  // Medidor de proteccion: cuanto puede sacar un bot (= slippage). Protegido oculta el selector y fija lo seguro.
  const pintarProt = () => {
    const m = $('tg-prot-meter'), slipBox = $('tg-prot-slip');
    if (slipBox) slipBox.hidden = protegido;
    const pn = slipBps / 100; const cls = slipBps <= 300 ? 'ok' : slipBps <= 1000 ? 'warn' : 'bad';
    if (m) { m.className = 'tg-prot-meter ' + cls; m.textContent = 'Bot can take ≤ ' + (Number.isInteger(pn) ? pn : pn.toFixed(1)) + '%'; }
  };
  let _t = null;
  const cotizar = async () => {
    const w = montoWei(); if (!(w > 0n)) { cot = null; cotPara = 0n; pintar(); return; }
    const tk = ++_buyTk;
    try { const r = await cotizarCompra(it.token, quote, w); if (tk !== _buyTk || !vivo()) return; cot = r; cotPara = w; }
    catch (_) { if (tk !== _buyTk) return; cot = { tokOut: 0n, comision: 0n }; cotPara = w; }
    pintar();
  };
  if (sl) sl.addEventListener('input', () => { prc = Number(sl.value) || 0; _presetWei = null; const pb = $('tg-buy-presets'); if (pb) pb.querySelectorAll('button').forEach((x) => x.classList.remove('on')); cot = null; pintar(); clearTimeout(_t); _t = setTimeout(cotizar, 300); });
  // Presets de compra (un toque): fijan el monto EXACTO en BNB, acotado al maximo disponible.
  const presetBox = $('tg-buy-presets');
  if (presetBox) presetBox.querySelectorAll('button').forEach((b) => { b.onclick = () => {
    let wei = 0n; try { wei = ethers.parseEther(String(parseFloat(b.dataset.v) || 0)); } catch (_) {}
    if (!(wei > 0n)) return;
    const mx = maxWei(); _presetWei = wei > mx ? mx : wei;
    if (sl) sl.value = mx > 0n ? Math.min(100, Math.round(Number(_presetWei * 100n / mx))) : 0;
    presetBox.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    cot = null; pintar(); clearTimeout(_t); _t = setTimeout(cotizar, 300);
  }; });
  const cargarSaldo = async () => {
    const c = wallet.cuentaActual(); if (!c) { balEl.textContent = 'Connect wallet'; estado(); return; }
    try { balance = await saldoBNB(c); } catch (_) { balance = 0n; }
    if (vivo()) { balEl.textContent = 'Balance ' + (+ethers.formatEther(balance)).toFixed(4) + ' BNB'; pintar(); }
  };
  cargarSaldo();
  // Compra protegida: toggle (ON = slippage seguro), selector al apagarlo, y "maxima proteccion" (RPC privado).
  // Protected OFF por default. Al activarlo sale el disclaimer (suma 1%, total 2%); si cancela, vuelve a OFF.
  const protOn = $('tg-prot-on'); if (protOn) protOn.onchange = () => {
    if (protOn.checked) {
      disclaimerProtect((ok) => {
        if (!$('tg-prot-on')) return;
        if (ok) { protegido = true; slipBps = PROTECCION.slipProtegido; } else { protOn.checked = false; protegido = false; }
        pintarProt();
      });
    } else { protegido = false; pintarProt(); }
  };
  const protSlip = $('tg-prot-slip'); if (protSlip) protSlip.querySelectorAll('button').forEach((b) => { b.onclick = () => { slipBps = Number(b.dataset.b) || PROTECCION.slipProtegido; protSlip.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); pintarProt(); }; });
  pintarProt();
  // CANDADO de Protect: Protect va INCLUIDO en el plan (ya no suma 1% extra). Sin suscripcion (y sin ser owner)
  // se bloquea el boton (borroso + candado); tocarlo abre el modal de pago. Owner o suscrito: libre.
  (function gatearProtect() {
    const protEl = $('tg-prot'); if (!protEl) return;
    const w = (wallet.cuentaActual && wallet.cuentaActual()) || null;
    if (esOwner(w)) return;
    // Scope de montarMercado: aqui NO existe `ctx` (monta recibe solo `it`). Se usan `bnbUsd` (numero local) y
    // `_ctx` (el ctx a nivel de modulo). Este era el bug: `ctx is not defined` rompia pintarDer y con el toda la carga.
    bloquearProtect(protEl, { bnbUsd, onDesbloquear: () => { desbloquearProtectUI(); pintarIzqReal(it, _ctx); refrescarPill(_ctx); } });
    estadoSuscripcion(w).then((sub) => { if (sub && sub.activa) desbloquearProtectUI(); }).catch(() => {});
  })();
  go.onclick = async () => {
    if (!wallet.cuentaActual()) { try { await wallet.conectar(); } catch (_) {} cargarSaldo(); try { derBalances(it); } catch (_) {} return; }
    const w = montoWei(); if (!(w > 0n) || !cot || cotPara !== w || !(cot.tokOut > 0n)) return;
    const slip = BigInt(slipBps); const minOut = cot.tokOut - cot.tokOut * slip / 10000n;
    ocupado = true; go.disabled = true; go.textContent = 'Confirm in your wallet…'; if (sl) sl.disabled = true; msg.className = 'tg-buy-msg'; msg.textContent = '';
    try {
      const cuenta = wallet.cuentaActual();
      const balAntes = await saldoToken(it.token, cuenta).catch(() => 0n);
      const rc = await comprar({ token: it.token, quote, bnbWei: w, minOut });
      const balDespues = await saldoToken(it.token, cuenta).catch(() => 0n);
      const recibido = balDespues > balAntes ? balDespues - balAntes : 0n;
      try { registrarCompra(cuenta, it, recibido, w, bnbUsd); } catch (_) {}
      ocupado = false; if (sl) { sl.disabled = false; sl.value = 0; } prc = 0; cot = null; cotPara = 0n;
      if (vivo()) { go.textContent = 'Bought'; msg.className = 'tg-buy-msg ok'; msg.innerHTML = 'Done. The ' + sym + ' is in your wallet. <a href="' + SCAN_URL + '/tx/' + esc(rc.hash) + '" target="_blank" rel="noopener">View</a>'; }
      try { if (_itActual && _itActual.token.toLowerCase() === it.token.toLowerCase()) marcarEntradaDe(_itActual); } catch (_) {}
      try { derPositions(); derBalances(it); } catch (_) {}
      setTimeout(() => { if (vivo()) { msg.textContent = ''; msg.className = 'tg-buy-msg'; pintar(); } }, 3200);
    } catch (e) {
      ocupado = false; if (sl) sl.disabled = false;
      const m = ((e && (e.reason || e.shortMessage || e.message)) || '').toLowerCase();
      msg.className = 'tg-buy-msg bad';
      msg.textContent = (m.includes('rejected') || m.includes('denied') || m.includes('4001')) ? 'You cancelled.'
        : m.includes('insufficient') ? 'Not enough BNB for the swap and gas.'
        : (m.includes('slippage') || m.includes('insufficient_output')) ? 'Price moved too much. Lower the amount or try again.'
        : 'The transaction could not be completed.';
      estado();
    }
  };
}

/* ── Clic derecho en la grafica: debajo del precio, solo alerta; encima, alerta y (segun tengas o no la
   moneda) vender o comprar, a mercado. La compra y la venta usan el flujo probado abrirCompra. ── */
function abrirCtx(x, y, px) {
  cerrarCtx();
  const it = _itActual; if (!it) return;
  const cur = _precioUsd > 0 ? _precioUsd : 0;
  const diff = cur > 0 ? (px - cur) / cur * 100 : 0;
  const up = px >= cur;
  const pos = posicionDe(it);
  const el = document.createElement('div'); el.className = 'tg-ctx'; el.id = 'tg-ctx';
  let html = `<div class="tg-ctx-px">$${fmtP(px, 5)}</div><div class="tg-ctx-pc ${up ? 'up' : 'down'}">${cur > 0 ? (up ? '+' : '-') + pct(Math.abs(diff)) + (up ? ' above market' : ' below market') : 'Set a price alert'}</div>`;
  if (pos) html += `<div class="tg-ctx-pos ${pos.pnl >= 0 ? 'up' : 'down'}">Position ${pos.pnl >= 0 ? '+' : '-'}$${fmtTxt(Math.abs(pos.pnl))} · ${pos.pnl >= 0 ? '+' : '-'}${pct(Math.abs(pos.pnlPct))} now</div>`;
  html += `<div class="tg-ctx-btns"><button class="tg-ctx-b alert" type="button">Set alert</button>`;
  if (up && pos) html += `<button class="tg-ctx-b sell" type="button">Sell</button>`;
  else if (up && !pos) html += `<button class="tg-ctx-b buy" type="button">Buy</button>`;
  html += `</div>`;
  el.innerHTML = html;
  document.body.appendChild(el);
  const w = el.offsetWidth || 200, h = el.offsetHeight || 110;
  let left = x + 8, top = y + 8;
  if (left + w > window.innerWidth) left = x - w - 8;
  if (top + h > window.innerHeight) top = y - h - 8;
  el.style.left = Math.max(6, left) + 'px'; el.style.top = Math.max(6, top) + 'px';
  el.querySelector('.tg-ctx-b.alert').onclick = () => { try { crearAlerta(it, px, up ? 'up' : 'down'); } catch (_) {} cerrarCtx(); try { derOpenAlerts(it); } catch (_) {} };
  const bBuy = el.querySelector('.tg-ctx-b.buy'); if (bBuy) bBuy.onclick = () => { cerrarCtx(); openBuyOrSell(it, 'buy'); };
  const bSell = el.querySelector('.tg-ctx-b.sell'); if (bSell) bSell.onclick = () => { cerrarCtx(); openBuyOrSell(it, 'sell'); };
  setTimeout(() => { document.addEventListener('mousedown', ctxFuera, true); document.addEventListener('keydown', ctxEsc, true); }, 0);
}
function ctxFuera(e) { const el = document.getElementById('tg-ctx'); if (el && !el.contains(e.target)) cerrarCtx(); }
function ctxEsc(e) { if (e.key === 'Escape') { e.stopPropagation(); cerrarCtx(); } }
function cerrarCtx() {
  const el = document.getElementById('tg-ctx'); if (el) { try { el.remove(); } catch (_) {} }
  document.removeEventListener('mousedown', ctxFuera, true); document.removeEventListener('keydown', ctxEsc, true);
}

function onEsc(e) { if (e.key === 'Escape') cerrar(); }
export function cerrar() {
  cerrarCtx();
  document.removeEventListener('keydown', onEsc);
  try { destruirGrafico(); } catch (_) {}
  const ov = $('tm-big-ov'); if (ov) { try { ov.remove(); } catch (_) {} }
  if (_posTimer) { clearInterval(_posTimer); _posTimer = null; }
  _ov = null; _cargar = null; _itActual = null;
}
