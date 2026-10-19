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
import { conRotacion } from './rpc.js';
import { velasDeToken, montarGrafico, destruirGrafico, precioActual, precioEnY, marcarEntrada, limpiarEntrada } from './grafico.js';
import { SCAN_URL, FACTORY, WBNB, USDT } from './config.js';
import { abrirCompra, saldoBNB, saldoToken } from './compra.js';
import { listaDe, enVivo } from './posiciones.js';
import { crearAlerta, alertasDe, quitarAlerta } from './alertas.js';
import * as wallet from './wallet.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ZERO = '0x0000000000000000000000000000000000000000';
const corto = (a) => a ? '…' + String(a).slice(-4) : '';
const cortoDir = (a) => a ? (String(a).slice(0, 6) + '…' + String(a).slice(-4)) : '';

const ICO_BSC = '<svg viewBox="0 0 126.61 126.61" fill="#F3BA2F"><path d="M38.73 53.2 63.3 28.63l24.6 24.6 14.3-14.31L63.3 0 24.42 38.89z"/><path d="M0 63.3l14.3-14.3 14.31 14.3-14.31 14.3z"/><path d="M38.73 73.41 63.3 97.98l24.59-24.58 14.31 14.29-38.9 38.91L24.42 87.7z"/><path d="M98 63.3l14.3-14.3 14.31 14.3-14.31 14.31z"/><path d="M77.83 63.3 63.3 48.77 52.56 59.51l-1.24 1.23-2.54 2.55 14.52 14.53z"/></svg>';
const ICO_COPY = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const ICO_SEARCH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>';
const LOGO_BNB = 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png';
const LOGO_USDT = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/0x55d398326f99059fF775485246999027B3197955/logo.png';

const LOGO_TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/assets/';
function logo(addr) {
  let a = ''; try { a = ethers.getAddress(String(addr || '')); } catch (_) {}
  const img = a ? `<img class="tg-logo-img" src="${LOGO_TW}${a}/logo.png" alt="" loading="lazy" onerror="this.remove()">` : '';
  return `<span class="tg-logo"><span class="tg-logo-fb">${ICO_BSC}</span>${img}</span>`;
}
function fmtP(p, sig = 4) {
  if (!(p > 0) || !isFinite(p)) return '0';
  if (p >= 0.001) return Number(p.toPrecision(sig)).toString();
  const e = Math.floor(Math.log10(p)); const ceros = -e - 1;
  const dig = Math.round(p / Math.pow(10, e - sig + 1)).toString().slice(0, sig);
  return `0.0<sub>${ceros}</sub>${dig}`;
}
function money(v) { if (!(v > 0)) return '$0'; if (v >= 1e6) return '$' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'; if (v >= 1e3) return '$' + (v / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K'; return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
const pct = (v) => (v == null || !isFinite(v)) ? '0%' : (Math.round(v * 10) / 10) + '%';

/* ── CSS propio (patron del modulo: inyectado, sin tocar el HTML ni terminal.css) ── */
let _css = false;
function css() {
  if (_css) return; _css = true;
  const st = document.createElement('style'); st.id = 'tm-big-css';
  st.textContent = `
.tm-big{position:fixed;inset:0;z-index:1200;display:flex;flex-direction:column;background:#05070a;color:var(--ink,#eaecef);font-family:var(--display,sans-serif);animation:tgIn .18s ease}
@keyframes tgIn{from{opacity:0}to{opacity:1}}
.tm-big *{box-sizing:border-box}
.tm-big-top{flex:0 0 auto;display:flex;align-items:center;gap:16px;padding:12px 16px;border-bottom:1px solid var(--line,#232b36);background:linear-gradient(180deg,#0b0f14,#070a0e)}
.tg-id{display:flex;align-items:center;gap:11px;min-width:0}
.tg-logo{position:relative;display:inline-flex;width:40px;height:40px;border-radius:50%;overflow:hidden;flex:0 0 auto;background:#0d1117;border:1px solid #1c232b}
.tg-logo-fb,.tg-logo-img{position:absolute;inset:0;width:100%;height:100%}
.tg-logo-fb{display:flex;align-items:center;justify-content:center;padding:9px}
.tg-logo-img{object-fit:cover;background:#0d1117}
.tg-id-tx{min-width:0}
.tg-id-tx b{display:block;font-family:'Chakra Petch',var(--display);font-size:16px;font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-id-tx span{display:block;font-family:var(--mono);font-size:11px;color:var(--ink-3,#7d8794);white-space:nowrap}
.tg-price{display:flex;flex-direction:column;justify-content:center;padding-left:6px}
.tg-price b{font-family:var(--mono);font-size:22px;font-weight:700;line-height:1;color:var(--gold,#E8B84B)}
.tg-price b sub{font-size:.62em}
.tg-price span{font-family:var(--mono);font-size:10px;color:var(--ink-3,#7d8794);margin-top:3px;letter-spacing:.3px}
.tg-find{flex:1 1 auto;display:flex;gap:10px;min-width:0}
.tg-find-in{position:relative;display:flex;align-items:center;flex:1 1 auto;max-width:none;width:100%}
.tg-find-in .tg-ico{position:absolute;left:12px;color:var(--ink-3,#7d8794);display:flex}
.tg-find-in input{width:100%;height:42px;padding:0 14px 0 36px;border-radius:11px;border:1px solid var(--line,#232b36);background:#0b0f14;color:var(--ink,#eaecef);font-family:var(--mono);font-size:12px;outline:none}
.tg-find-in input:focus{border-color:#8f6a1a}
.tg-find-tok{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 15px;border-radius:11px;border:1px solid #8f6a1a;background:linear-gradient(180deg,#1b2027,#0d1117);box-shadow:0 3px 0 #060809,inset 0 1px 0 rgba(255,255,255,.06);color:var(--gold,#E8B84B);font-family:'Chakra Petch',var(--display);font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}
.tg-find-tok:active{transform:translateY(2px);box-shadow:0 1px 0 #060809}
.tg-x{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:11px;border:1px solid var(--line,#232b36);background:#0d1117;color:var(--ink-2,#b7bdc6);font-size:17px;cursor:pointer}
.tg-x:hover{color:#fff;border-color:#3a434f}
.tm-big-main{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:272px 1fr 316px;gap:1px;background:var(--line,#232b36)}
.tg-col{background:#05070a;min-height:0;overflow:auto}
.tg-left{padding:14px}
.tg-chart{background:#070a0e;position:relative;min-height:0}
.tg-chart-cv{position:absolute;inset:0}
.tg-chart-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ink-3,#7d8794);font-family:var(--mono);font-size:13px;pointer-events:none}
.tg-chart-msg[hidden]{display:none}
.tg-right{padding:14px;display:flex;flex-direction:column;gap:12px}
.tg-sec-t{font-family:var(--mono);font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:var(--ink-3,#7d8794);margin:0 0 10px}
.tg-kv{display:flex;flex-direction:column;gap:9px}
.tg-kv>div{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px}
.tg-kv>div span{color:var(--ink-3,#7d8794);font-family:var(--mono)}
.tg-kv>div b{font-weight:700;text-align:right;font-family:var(--mono)}
.tg-kv .tg-copyc{display:inline-flex;align-items:center;gap:5px;background:none;border:0;color:var(--gold,#E8B84B);font-family:var(--mono);font-size:12px;cursor:pointer;padding:0}
.tg-sem{display:flex;align-items:center;gap:9px;padding:10px;border-radius:11px;border:1px solid var(--line,#232b36);background:#0b0f14;margin-bottom:14px}
.tg-sem i{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:#7d8794}
.tg-sem.ok i{background:var(--verde,#2ee86a)} .tg-sem.warn i{background:#f1cf6a} .tg-sem.bad i{background:var(--rojo,#f6465d)} .tg-sem.pend i{background:#7d8794}
.tg-sem b{font-size:12.5px;font-weight:700} .tg-sem span{display:block;font-size:11px;color:var(--ink-3,#7d8794)}
.tg-tabs2{display:flex;gap:6px}
.tg-tabs2 .t{flex:1 1 0;text-align:center;padding:9px;border-radius:10px;border:1px solid var(--line,#232b36);background:#0b0f14;font-family:'Chakra Petch',var(--display);font-weight:700;font-size:12px;color:var(--ink-2,#b7bdc6);cursor:pointer}
.tg-tabs2 .t.on{color:var(--gold,#E8B84B);border-color:#8f6a1a;background:linear-gradient(180deg,#1b2027,#0d1117)}
.tg-op{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.tg-op[hidden]{display:none}
.tg-mktcap{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:12px;border:1px solid var(--line,#232b36);background:linear-gradient(180deg,#0d1319,#0a0e13)}
.tg-mktcap b{font-family:var(--mono);font-size:20px;font-weight:700;color:var(--gold,#E8B84B)} .tg-mktcap b sub{font-size:.62em}
.tg-mktcap span{font-family:var(--mono);font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:var(--ink-3,#7d8794)}
.tg-op-lbl{font-family:var(--mono);font-size:11px;color:var(--ink-3,#7d8794)}
.tg-al-set{display:flex;align-items:center;gap:8px;position:relative}
.tg-al-set .tg-al-d{position:absolute;left:12px;color:var(--ink-3,#7d8794);font-family:var(--mono);font-size:13px}
.tg-al-set input{flex:1 1 auto;height:44px;padding:0 12px 0 24px;border-radius:11px;border:1px solid var(--line,#232b36);background:#0b0f14;color:var(--ink,#eaecef);font-family:var(--mono);font-size:14px;outline:none;min-width:0}
.tg-al-set input:focus{border-color:#8f6a1a}
.tg-al-hint{font-size:11px;color:var(--ink-3,#7d8794);line-height:1.5}
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
.tg-alrow b{flex:1 1 auto;font-family:var(--mono);font-size:13px}
.tg-alrow em{font-style:normal;font-size:10px;color:var(--verde,#2ee86a);text-transform:uppercase;letter-spacing:.5px}
.tg-alrow.done{border-color:#2e7d52}
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
@media(max-width:860px){
  .tm-big-main{grid-template-columns:1fr;grid-auto-rows:minmax(0,auto)}
  .tg-left,.tg-right{max-height:none}
  .tg-chart{min-height:300px}
}`;
  document.head.appendChild(st);
}

/* ── Resolver un token por contrato: primero en el feed; si no, por la fabrica de PancakeSwap ── */
async function resolver(addr, feed) {
  let dir; try { dir = ethers.getAddress(String(addr || '').trim()); } catch (_) { return null; }
  const hit = (feed || []).find((x) => x.token && x.token.toLowerCase() === dir.toLowerCase());
  if (hit) return hit;
  const facI = ['function getPair(address,address) view returns (address)'];
  const ercI = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)', 'function name() view returns (string)'];
  let par = null, moneda = 'BNB', quoteEsUSDT = false;
  const pBNB = await conRotacion((p) => new ethers.Contract(FACTORY, facI, p).getPair(dir, WBNB)).catch(() => null);
  if (pBNB && pBNB !== ZERO) { par = pBNB; }
  else {
    const pU = await conRotacion((p) => new ethers.Contract(FACTORY, facI, p).getPair(dir, USDT)).catch(() => null);
    if (pU && pU !== ZERO) { par = pU; moneda = 'USDT'; quoteEsUSDT = true; }
  }
  if (!par) return null;
  const [dec, sym, nom] = await Promise.all([
    conRotacion((p) => new ethers.Contract(dir, ercI, p).decimals()).catch(() => 18),
    conRotacion((p) => new ethers.Contract(dir, ercI, p).symbol()).catch(() => '?'),
    conRotacion((p) => new ethers.Contract(dir, ercI, p).name()).catch(() => 'Token')
  ]);
  return { token: dir, par, quote: null, moneda, simbolo: String(sym || '?'), nombre: String(nom || 'Token'), decimales: Number(dec) || 18, fuente: 'pancake', tiempo: 0, liquidez: 0, precio: 0, bloque: 0, creador: '' };
}

let _ov = null, _cargar = null, _precioUsd = 0, _itActual = null, _ctx = null;
export async function abrirGrande(it0, ctx) {
  ctx = ctx || {};
  _ctx = ctx;
  const bnbUsd = () => (ctx.bnbUsd ? ctx.bnbUsd() : 0);
  const feed = () => (ctx.items ? ctx.items() : []);
  css();
  cerrar();
  const ov = document.createElement('div'); ov.id = 'tm-big-ov'; ov.className = 'tm-big'; _ov = ov;
  ov.innerHTML = `
    <div class="tm-big-top">
      <div class="tg-id" id="tg-id"></div>
      <div class="tg-price" id="tg-price"></div>
      <div class="tg-find">
        <div class="tg-find-in"><span class="tg-ico">${ICO_SEARCH}</span><input id="tg-find-in" type="text" autocomplete="off" spellcheck="false" placeholder="Paste a token contract 0x…"></div>
        <button class="tg-find-tok" id="tg-find-tok" type="button">Tokens</button>
      </div>
      <button class="tg-x" id="tg-close" type="button" aria-label="Close">✕</button>
    </div>
    <div class="tm-big-main">
      <div class="tg-col tg-left" id="tg-left"></div>
      <div class="tg-col tg-chart"><div class="tg-chart-cv" id="tg-chart-cv"></div><div class="tg-chart-msg" id="tg-chart-msg"><span class="tg-anillo"></span></div></div>
      <div class="tg-col tg-right" id="tg-right"></div>
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

  // Selector de tokens del feed (lista estilo New pairs que carga en la grafica).
  const togglePicker = () => {
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

  // Buscar por contrato.
  const buscar = async () => {
    const v = ($('tg-find-in').value || '').trim(); if (!v) return;
    const msg = $('tg-chart-msg'); if (msg) { msg.hidden = false; msg.innerHTML = '<span class="tg-anillo"></span>'; }
    const it = await resolver(v, feed());
    if (!it) { if (msg) { msg.hidden = false; msg.textContent = 'No PancakeSwap pair found for that contract.'; } return; }
    $('tg-find-in').value = '';
    cargar(it);
  };
  $('tg-find-in').onkeydown = (e) => { if (e.key === 'Enter') buscar(); };

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

  // ── carga de un token en toda la vista ──
  async function cargar(it) {
    if (!ov.isConnected) return;
    _itActual = it; pintarId(it); pintarDer(it, ctx);
    const cv = $('tg-chart-cv'), msg = $('tg-chart-msg');
    if (msg) { msg.hidden = false; msg.innerHTML = '<span class="tg-anillo"></span>'; }
    try { destruirGrafico(); } catch (_) {}
    // precio en vivo
    precioActual({ par: it.par, token: it.token, decToken: it.decimales || 18, decQuote: 18, bnbUsd: bnbUsd(), quoteEsUSDT: it.moneda === 'USDT' })
      .then((p) => { if (ov.isConnected) pintarPrecio(p); }).catch(() => {});
    pintarIzq(it, ctx);
    // grafica
    try {
      const velas = await velasDeToken({ par: it.par, token: it.token, decToken: it.decimales || 18, decQuote: 18, bloque: it.bloque, bnbUsd: bnbUsd(), quoteEsUSDT: it.moneda === 'USDT' });
      if (!ov.isConnected) return;
      if (velas && velas.length && cv) { if (msg) msg.hidden = true; montarGrafico(cv, velas); marcarEntradaDe(it); }
      else if (msg) { msg.hidden = false; msg.textContent = 'No trades yet'; }
    } catch (_) { if (msg && ov.isConnected) { msg.hidden = false; msg.textContent = 'Chart unavailable'; } }
  }

  function pintarId(it) {
    const idEl = $('tg-id'); if (!idEl) return;
    if (!it) { idEl.innerHTML = ''; return; }
    const sub = it.fuente === 'launchpad' ? 'DecFreedom Launchpad' : it.fuente === 'fourmeme' ? 'four.meme' : (it.moneda || 'BNB') + ' pair';
    idEl.innerHTML = `${logo(it.token)}<div class="tg-id-tx"><b title="${esc(it.nombre || '')}">${esc(it.nombre || 'Token')}</b><span>${esc(it.simbolo || '?')} · ${sub}</span></div>`;
  }
  function pintarPrecio(p) {
    _precioUsd = p || 0;
    const el = $('tg-price'); if (!el) return;
    el.innerHTML = `<b>${p > 0 ? '$' + fmtP(p, 5) : '$0'}</b><span>LIVE PRICE</span>`;
    const mp = document.getElementById('tg-mkt-price'); if (mp) mp.innerHTML = p > 0 ? '$' + fmtP(p, 5) : '$0';
  }
}

/* ── Panel izquierdo: informacion del token (facts al momento + seguridad por la cache de auditoria) ── */
function pintarIzq(it, ctx) {
  const host = $('tg-left'); if (!host) return;
  if (!it) { host.innerHTML = `<div class="tg-sec-t">Token info</div><div class="tg-kv"><div><span>Pick a token to see its info</span></div></div>`; return; }
  const bnbUsd = ctx && ctx.bnbUsd ? ctx.bnbUsd() : 0;
  const liqUsd = it.moneda === 'USDT' ? it.liquidez : it.liquidez * bnbUsd;
  host.innerHTML = `
    <div class="tg-sem pend" id="tg-sem"><i></i><div><b>Checking security</b><span>Reading the contract…</span></div></div>
    <div class="tg-sec-t">Token info</div>
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
    </div>`;
  const cp = $('tg-k-copy'); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(it.token); const o = cp.innerHTML; cp.textContent = 'copied'; setTimeout(() => { if (cp.isConnected) cp.innerHTML = o; }, 1200); } catch (_) {} };
  // seguridad (reutiliza la cache de auditoria de la Terminal)
  if (ctx && ctx.auditarCache && it.par) {
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    ctx.auditarCache(it, null, false).then((r) => {
      if (!$('tg-left') || !r) return;
      const d = r.datos || {};
      const sem = $('tg-sem');
      const TXT = { ok: 'Safe to trade', warn: 'Trade with caution', bad: 'Do not buy', pend: 'Checking security' };
      if (sem) { sem.className = 'tg-sem ' + (r.nivel || 'pend'); sem.querySelector('b').textContent = TXT[r.nivel] || 'Checked'; sem.querySelector('span').textContent = r.nivel === 'ok' ? 'No red flags in the contract' : (r.titulo || ''); }
      set('tg-k-hold', (d.holders != null ? Number(d.holders).toLocaleString('en-US') : '0') + (d.txs != null ? ' · ' + Number(d.txs).toLocaleString('en-US') + ' txs' : ''));
      set('tg-k-top', d.top10Pct != null ? pct(d.top10Pct) : '0%');
      const cre = d.creador || it.creador || '';
      set('tg-k-cre', (cre ? corto(cre) : '') + (d.creadorPct != null ? (cre ? ' ' : '') + pct(d.creadorPct) : (cre ? '' : '0%')));
      set('tg-k-tax', pct(d.buyTax || 0) + ' / ' + pct(d.sellTax || 0));
      set('tg-k-lp', d.lpAsegurada != null ? pct(d.lpAsegurada) : '0%');
    }).catch(() => {});
  } else {
    ['tg-k-hold', 'tg-k-top', 'tg-k-cre', 'tg-k-tax', 'tg-k-lp'].forEach((id) => { const e = $(id); if (e) e.textContent = '0'; });
    const sem = $('tg-sem'); if (sem) { sem.className = 'tg-sem pend'; sem.querySelector('b').textContent = 'Not a PancakeSwap pair'; sem.querySelector('span').textContent = 'Security check runs on pair tokens'; }
  }
}

/* ── Panel derecho: area de operar (spot). Market (compra a mercado por el flujo probado abrirCompra),
   Alert (alerta de precio, reusa alertas.js), saldos, Open Alerts y Positions (reusan compra/posiciones). ── */
function pintarDer(it, ctx) {
  const host = $('tg-right'); if (!host) return;
  if (!it) { host.innerHTML = `<div class="tg-sec-t">Trade</div><div class="tg-soon" style="margin-top:4px">Pick a token to buy, set a price alert and see your live positions.</div>`; return; }
  host.innerHTML = `
    <div class="tg-tabs2" id="tg-op-tabs"><button type="button" class="t on" data-op="market">Market</button><button type="button" class="t" data-op="alert">Alert</button></div>
    <div class="tg-op" id="tg-op-market">
      <div class="tg-mktcap"><b id="tg-mkt-price">${_precioUsd > 0 ? '$' + fmtP(_precioUsd, 5) : '$0'}</b><span>Market price</span></div>
      <button class="tg-mbtn buy" id="tg-openlong" type="button">Open Long</button>
      <div class="tg-soon">Buys at market (pays with BNB). Your keys, your coins.</div>
    </div>
    <div class="tg-op" id="tg-op-alert" hidden>
      <label class="tg-op-lbl">Alert me at price</label>
      <div class="tg-al-set"><span class="tg-al-d">$</span><input id="tg-al-price" type="text" inputmode="decimal" autocomplete="off" placeholder="0.0"><button class="tg-mbtn sec" id="tg-al-set" type="button">Set</button></div>
      <div class="tg-al-hint" id="tg-al-hint">You get a browser notification when the price is hit. It is not an order and never touches your funds.</div>
    </div>
    <div class="tg-balrow" id="tg-balrow"></div>
    <div class="tg-sec-t tg-mt">Open alerts</div>
    <div id="tg-openalerts"><div class="tg-soon">No alerts yet.</div></div>
    <div class="tg-sec-t tg-mt">Positions</div>
    <div id="tg-positions"><div class="tg-soon">No positions yet.</div></div>`;
  host.querySelectorAll('#tg-op-tabs button').forEach((b) => { b.onclick = () => {
    host.querySelectorAll('#tg-op-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    const m = b.dataset.op, mk = $('tg-op-market'), al = $('tg-op-alert'); if (mk) mk.hidden = m !== 'market'; if (al) al.hidden = m !== 'alert';
  }; });
  const ol = $('tg-openlong');
  if (ol) ol.onclick = async () => {
    if (!wallet.cuentaActual()) { try { await wallet.conectar(); } catch (_) {} derBalances(it); derPositions(it); return; }
    const aud = ctx && ctx.auditoriaDe ? ctx.auditoriaDe(it) : null;
    try { abrirCompra(it, aud); } catch (_) {}
  };
  const setA = $('tg-al-set'), inA = $('tg-al-price');
  const poner = () => {
    const v = parseFloat(String(inA.value).replace(/[, $]/g, '')); if (!(v > 0)) { inA.focus(); return; }
    const ref = _precioUsd > 0 ? _precioUsd : 0; const dir = ref > 0 ? (v >= ref ? 'up' : 'down') : 'up';
    crearAlerta(it, v, dir); inA.value = '';
    const h = $('tg-al-hint'); if (h) h.textContent = 'Alert set at $' + fmtTxt(v) + '. ' + (dir === 'up' ? 'Notifies when the price rises to it.' : 'Notifies when the price falls to it.');
    derOpenAlerts(it);
  };
  if (setA && inA) { setA.onclick = poner; inA.onkeydown = (e) => { if (e.key === 'Enter') poner(); }; }
  derBalances(it); derOpenAlerts(it); derPositions(it);
}
function fmtTxt(p) { return String(fmtP(p, 5)).replace(/<sub>(\d+)<\/sub>/, (m, z) => '0'.repeat(+z)); }

function derBalances(it) {
  const host = $('tg-balrow'); if (!host) return;
  const c = wallet.cuentaActual();
  if (!c) { host.innerHTML = `<button class="tg-mbtn sec" id="tg-conn" type="button">Connect wallet</button>`; const b = $('tg-conn'); if (b) b.onclick = async () => { try { await wallet.conectar(); } catch (_) {} if (_itActual) pintarDer(_itActual, _ctx); }; return; }
  host.innerHTML = `<div class="tg-bal"><img class="tg-bal-ic" src="${LOGO_BNB}" alt="" onerror="this.remove()"><div class="tg-bal-tx"><span>Wallet</span><b id="tg-bal-bnb">…</b></div></div><div class="tg-bal"><img class="tg-bal-ic" src="${LOGO_USDT}" alt="" onerror="this.remove()"><div class="tg-bal-tx"><span>USDT</span><b id="tg-bal-usdt">…</b></div></div>`;
  saldoBNB(c).then((w) => { const e = $('tg-bal-bnb'); if (e) e.textContent = (+ethers.formatEther(w)).toFixed(4); }).catch(() => {});
  saldoToken(USDT, c).then((w) => { const e = $('tg-bal-usdt'); if (e) e.textContent = (+ethers.formatUnits(w, 18)).toFixed(2); }).catch(() => {});
}

function derOpenAlerts(it) {
  const host = $('tg-openalerts'); if (!host) return;
  const l = alertasDe(it.token);
  if (!l.length) { host.innerHTML = `<div class="tg-soon">No alerts for this token.</div>`; return; }
  host.innerHTML = l.map((a) => `<div class="tg-alrow ${a.disparada ? 'done' : ''}"><span class="tg-aldir ${a.dir}"></span><b>$${fmtP(a.objetivo)}</b>${a.disparada ? '<em>hit</em>' : ''}<button class="tg-alx" data-id="${esc(a.id)}" type="button" aria-label="Remove">✕</button></div>`).join('');
  host.querySelectorAll('.tg-alx').forEach((b) => { b.onclick = () => { quitarAlerta(b.dataset.id); derOpenAlerts(it); }; });
}

async function derPositions(it) {
  const host = $('tg-positions'); if (!host) return;
  const c = wallet.cuentaActual();
  if (!c) { host.innerHTML = `<div class="tg-soon">Connect your wallet to see positions.</div>`; return; }
  const lista = listaDe(c);
  if (!lista.length) { host.innerHTML = `<div class="tg-soon">No positions yet. Buy a token here and it shows with live profit.</div>`; return; }
  host.innerHTML = `<div class="tg-soon">Reading on chain…</div>`;
  const bnb = (_ctx && _ctx.bnbUsd) ? _ctx.bnbUsd() : 0;
  const datos = (await Promise.all(lista.map((p) => enVivo(c, p, bnb).catch(() => null)))).filter((d) => d && d.cant > 0);
  if (!$('tg-positions')) return;
  if (!datos.length) { host.innerHTML = `<div class="tg-soon">No open positions right now.</div>`; return; }
  datos.sort((a, b) => b.valorUsd - a.valorUsd);
  const sg = (v) => v >= 0 ? '+' : '-';
  host.innerHTML = datos.map((d) => {
    const up = d.pnlUsd >= 0;
    return `<div class="tg-posrow ${up ? 'up' : 'down'}" data-a="${esc(d.token)}">
      <div class="tg-posL">${logo(d.token)}<div class="tg-pos-id"><b title="${esc(d.simbolo || '?')}">${esc(d.simbolo || '?')}</b><button class="tg-pos-ca" data-ca="${esc(d.token)}" type="button" title="Copy contract">${corto(d.token)}${ICO_COPY}</button></div></div>
      <span class="tg-posDiv"></span>
      <div class="tg-posC ${up ? 'up' : 'down'}"><div class="pc">${sg(d.pnlPct)}${pct(Math.abs(d.pnlPct))}</div><div class="gain">${sg(d.pnlUsd)}${money(Math.abs(d.pnlUsd))}</div></div>
      <div class="tg-posR"><b>${money(d.valorUsd)}</b><span>value</span></div>
    </div>`;
  }).join('');
  host.querySelectorAll('.tg-posrow').forEach((r) => { r.onclick = (e) => { if (e.target.closest('.tg-pos-ca')) return; const d = datos.find((x) => x.token.toLowerCase() === r.dataset.a.toLowerCase()); if (d && _cargar) _cargar({ token: d.token, par: d.par, quote: d.quote || null, moneda: d.moneda || 'BNB', simbolo: d.simbolo, nombre: d.nombre || d.simbolo, decimales: d.decimales || 18, fuente: 'pancake', tiempo: 0, bloque: 0, liquidez: 0, precio: 0, creador: '' }); }; });
  host.querySelectorAll('.tg-pos-ca').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const ca = b.dataset.ca; try { navigator.clipboard.writeText(ca); } catch (_) {} const inp = $('tg-find-in'); if (inp) inp.value = ca; const o = b.innerHTML; b.textContent = 'copied'; setTimeout(() => { if (b.isConnected) b.innerHTML = o; }, 1100); }; });
}

/* ── Marca la entrada de la posicion abierta de este token en la grafica (si la hay) ── */
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
  const aud = _ctx && _ctx.auditoriaDe ? _ctx.auditoriaDe(it) : null;
  const go = () => { try { abrirCompra(it, aud, modo); } catch (_) {} };
  if (!wallet.cuentaActual()) { wallet.conectar().then(go).catch(go); } else go();
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
  _ov = null; _cargar = null; _itActual = null;
}
