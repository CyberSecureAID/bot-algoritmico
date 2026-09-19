/* ══════════════════════════════════════════════════════════════════════
   aportar.js — Staking (web). Conectado a los contratos reales.
   ══════════════════════════════════════════════════════════════════════
   Modelo GMX: quien aporta liquidez es la contraparte de quien opera en
   futuros. Enriquecido sobre la estructura anterior (tabs Stake/Unstake,
   plazos, aviso honesto), añadiendo:
   · Selector de las monedas aceptadas con logo y valor en USD (oráculo).
   · Opción "holdear en tu moneda" o "conservar en USDT".
   · Panel del usuario: capital total / en uso (trabajando) / disponible,
     participación en USD, ganancia por valorización, recompensas por cobrar.
   · Explicación clara de de dónde salen las ganancias.
   El rendimiento es variable y se dice claro. Nadie pierde su capital: se
   devuelve en la misma moneda que se depositó.
   ══════════════════════════════════════════════════════════════════════ */

import * as ethers from './vendor/ethers-6.13.4.min.js?v=126';
import * as wallet from './wallet.js?v=126';

/*──────────── Contratos desplegados (BSC) ────────────*/
const STAKING = '0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4';
const ORACULO = '0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3';
const PANEL   = '0xE620D5BD60F70CCdFa4493F3a5B794d1BBEbf8d2';
const USDT    = '0x55d398326f99059fF775485246999027B3197955';

const RPCS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
  'https://rpc.ankr.com/bsc'
];
let _rpc = 0;
const lector = () => new ethers.JsonRpcProvider(RPCS[_rpc++ % RPCS.length], 56, { staticNetwork: true });
async function firmante() { const bp = new ethers.BrowserProvider(window.ethereum); return bp.getSigner(); }

/*──────────── ABIs (solo lo que usamos) ────────────*/
const ERC20 = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];
const ABI_STK = [
  'function stake(address token,uint256 monto,uint40 plazo,bool holdMoneda) returns (uint256)',
  'function unstake(uint256 id)',
  'function reclamarTodo()',
  'function tokenPermitido(address) view returns (bool)',
  'function plazos(uint256) view returns (uint40)',
  'function numPlazos() view returns (uint256)',
  'function depositosDe(address) view returns (tuple(address token,uint256 monto,uint256 valorUSD,uint40 cuando,uint40 vence,bool holdMoneda,bool retirado)[])'
];
const ABI_ORAC = [
  'function precioUSD(address) view returns (uint256)',
  'function valorUSD(address,uint256) view returns (uint256)',
  'function aceptado(address) view returns (bool)'
];
const ABI_PANEL = [
  'function posicionUsuario(address) view returns (tuple(uint256 pesoReal,uint256 pesoAsignado,uint256 valorActualUSD,int256 gananciaValoriza,uint256 porcentaje,uint256 numDepositos,uint256 numActivos))',
  'function capitalDeUsuario(address) view returns (tuple(address token,string simbolo,uint8 decimales,uint256 total,uint256 enUso,uint256 disponible,uint256 valorUSD)[])',
  'function recompensasDe(address) view returns (tuple(address token,string simbolo,uint256 pendiente)[])',
  'function global() view returns (tuple(uint256 tvlUSD,uint256 realUSD,uint256 asignadoUSD,uint256 numStakers))'
];

/*──────────── Monedas aceptadas (las 30 configuradas) ────────────*/
/* Orden de importancia. El logo se resuelve por CoinGecko id. */
const MONEDAS = [
  { s: 'USDT',  a: USDT, cg: 'tether' },
  { s: 'BTCB',  a: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', cg: 'bitcoin' },
  { s: 'ETH',   a: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', cg: 'ethereum' },
  { s: 'BNB',   a: '0x0000000000000000000000000000000000000000', cg: 'binancecoin' },
  { s: 'USDC',  a: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', cg: 'usd-coin' },
  { s: 'XRP',   a: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', cg: 'ripple' },
  { s: 'DOGE',  a: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', cg: 'dogecoin' },
  { s: 'CAKE',  a: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', cg: 'pancakeswap-token' },
  { s: 'LINK',  a: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', cg: 'chainlink' },
  { s: 'DOT',   a: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', cg: 'polkadot' },
  { s: 'TRX',   a: '0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3', cg: 'tron' },
  { s: 'ADA',   a: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', cg: 'cardano' },
  { s: 'AVAX',  a: '0x1CE0c2827e2eF14D5C4f29a091d735A204794041', cg: 'avalanche-2' },
  { s: 'LTC',   a: '0x4338665CBB7B2485A8855A139b75D5e34AB0DB94', cg: 'litecoin' },
  { s: 'BCH',   a: '0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf', cg: 'bitcoin-cash' },
  { s: 'ATOM',  a: '0x0Eb3a705fc54725037CC9e008bDede697f62F335', cg: 'cosmos' },
  { s: 'FIL',   a: '0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153', cg: 'filecoin' },
  { s: 'NEAR',  a: '0x1Fa4a73a3F0133f0025378af00236f3aBDEE5D63', cg: 'near' },
  { s: 'UNI',   a: '0xBf5140A22578168FD562DCcF235E5D43A02ce9B1', cg: 'uniswap' },
  { s: 'AAVE',  a: '0xfb6115445Bff7b52FeB98650C87f44907E58f802', cg: 'aave' },
  { s: 'XVS',   a: '0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63', cg: 'venus' },
  { s: 'INJ',   a: '0xa2B726B1145A4773F68593CF171187d8EBe4d495', cg: 'injective-protocol' },
  { s: 'SXP',   a: '0x47BEAd2563dCBf3bF2c9407fEa4dC236fAbA485A', cg: 'swipe' },
  { s: 'YFI',   a: '0x88f1A5ae2A3BF98AEAF342D26B30a79438c9142e', cg: 'yearn-finance' },
  { s: 'ALPHA', a: '0xa1faa113cbE53436Df28FF0aEe54275c13B40975', cg: 'alpha-finance' },
  { s: 'FLOKI', a: '0xfb5B838b6cfEEdC2873aB27866079AC55363D37E', cg: 'floki' },
  { s: 'BabyDoge', a: '0xc748673057861a797275CD8A068AbB95A902e8de', cg: 'baby-doge-coin' },
  { s: 'DAI',   a: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', cg: 'dai' },
  { s: 'XTZ',   a: '0x16939ef78684453bfDFb47825F8a5F714f12623a', cg: 'tezos' },
  { s: 'BAT',   a: '0x101d82428437127bF1608F699CD651e6Abf9766E', cg: 'basic-attention-token' }
];

const PLAZOS_DEF = [
  { seg: 30 * 86400,  etiqueta: '30 días' },
  { seg: 90 * 86400,  etiqueta: '3 meses' },
  { seg: 180 * 86400, etiqueta: '6 meses' },
  { seg: 365 * 86400, etiqueta: '1 año'   }
];

/*──────────── Estado del módulo ────────────*/
let _modo = 'stake';           // stake | unstake
let _moneda = MONEDAS[0];
let _plazo = PLAZOS_DEF[0];
let _hold = true;              // true = holdear en su moneda ; false = conservar en USDT
let _cssPuesto = false;
const _logoCache = {};

/*──────────── Utilidades ────────────*/
const $ = (id) => document.getElementById(id);
const fmtUSD = (n) => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const cuenta = () => wallet.cuentaActual();
function logoDe(m) {
  if (_logoCache[m.cg]) return _logoCache[m.cg];
  return `https://assets.coingecko.com/coins/images/1/small/placeholder.png`;
}
async function precargarLogos() {
  try {
    const ids = MONEDAS.map((m) => m.cg).join(',');
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`);
    const d = await r.json();
    d.forEach((c) => { _logoCache[c.id] = c.image; });
  } catch (_) { /* si CoinGecko falla, se muestran iniciales */ }
}

/*──────────── Estilos ────────────*/
function estilos() {
  if (_cssPuesto) return; _cssPuesto = true;
  const s = document.createElement('style');
  s.textContent = `
  #stk-wrap{max-width:960px;margin:0 auto;padding:8px 0 40px}
  #stk-wrap .stk-head{margin-bottom:18px}
  #stk-wrap .stk-tit{font-family:var(--display);font-weight:800;font-size:26px;color:#eef1f6;letter-spacing:-.02em}
  #stk-wrap .stk-sub{color:var(--ink-3,#94a1b2);font-size:14px;margin-top:4px}
  #stk-wrap .stk-grid{display:grid;grid-template-columns:1fr 340px;gap:18px;align-items:start}
  @media(max-width:820px){#stk-wrap .stk-grid{grid-template-columns:1fr}}
  #stk-wrap .stk-card{background:rgba(10,14,19,.6);border:1px solid var(--line,#232a33);border-radius:16px;padding:18px}
  #stk-wrap .stk-tabs{display:flex;gap:8px;margin-bottom:16px}
  #stk-wrap .stk-tabs button{flex:1;padding:11px;border-radius:10px;border:1px solid var(--line,#232a33);
    background:rgba(10,14,19,.5);color:var(--ink-3,#94a1b2);font-weight:700;cursor:pointer;font-size:14px}
  #stk-wrap .stk-tabs button.on{border-color:var(--gold,#e8b84b);background:rgba(232,184,75,.1);color:#eef1f6}
  #stk-wrap .stk-lbl{font-size:12px;color:var(--ink-3,#94a1b2);margin:0 2px 7px}
  #stk-wrap .stk-sel{display:flex;align-items:center;gap:10px;background:rgba(10,14,19,.5);
    border:1px solid var(--line,#232a33);border-radius:12px;padding:12px 14px;cursor:pointer;margin-bottom:14px}
  #stk-wrap .stk-sel:hover{border-color:var(--gold-soft,#7a6220)}
  #stk-wrap .stk-sel img{width:26px;height:26px;border-radius:50%;background:#1a2129}
  #stk-wrap .stk-sel .ini{width:26px;height:26px;border-radius:50%;background:#1a2129;display:grid;place-items:center;
    font-size:11px;font-weight:700;color:#cfd6df}
  #stk-wrap .stk-sel b{font-family:var(--display);font-weight:700;color:#eef1f6;font-size:15px}
  #stk-wrap .stk-sel .chev{margin-left:auto;color:var(--ink-3,#94a1b2)}
  #stk-wrap .stk-amt{display:flex;align-items:center;gap:8px;background:rgba(10,14,19,.5);
    border:1px solid var(--line,#232a33);border-radius:12px;padding:4px 14px;margin-bottom:6px}
  #stk-wrap .stk-amt input{flex:1;background:transparent;border:0;color:#eef1f6;font-family:var(--mono);
    font-size:22px;padding:12px 0;outline:none;min-width:0}
  #stk-wrap .stk-amt .max{font-size:11px;font-weight:700;color:var(--gold,#e8b84b);cursor:pointer;
    border:1px solid var(--gold-soft,#7a6220);border-radius:7px;padding:5px 9px}
  #stk-wrap .stk-usd{font-family:var(--mono);font-size:12px;color:var(--ink-3,#94a1b2);margin:0 2px 16px}
  #stk-wrap .stk-plazos{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
  #stk-wrap .stk-plazo{flex:1;min-width:78px;background:rgba(10,14,19,.5);border:1px solid var(--line,#232a33);
    border-radius:10px;padding:12px 6px;text-align:center;cursor:pointer}
  #stk-wrap .stk-plazo.on{border-color:var(--gold,#e8b84b);background:rgba(232,184,75,.1)}
  #stk-wrap .stk-plazo b{display:block;font-family:var(--display);font-weight:700;font-size:14px;color:#eef1f6}
  #stk-wrap .stk-plazo em{display:block;font-style:normal;font-family:var(--mono);font-size:9px;color:var(--ink-3,#94a1b2);margin-top:2px}
  #stk-wrap .stk-hold{display:flex;gap:8px;margin-bottom:16px}
  #stk-wrap .stk-hold button{flex:1;padding:11px 8px;border-radius:10px;border:1px solid var(--line,#232a33);
    background:rgba(10,14,19,.5);color:var(--ink-3,#94a1b2);cursor:pointer;text-align:left}
  #stk-wrap .stk-hold button.on{border-color:var(--gold,#e8b84b);background:rgba(232,184,75,.08)}
  #stk-wrap .stk-hold button b{display:block;font-size:13px;color:#eef1f6;font-weight:700}
  #stk-wrap .stk-hold button span{display:block;font-size:10px;color:var(--ink-3,#94a1b2);margin-top:2px;line-height:1.35}
  #stk-wrap .stk-go{width:100%;padding:15px;border-radius:12px;border:0;background:var(--gold,#e8b84b);
    color:#0a0e13;font-family:var(--display);font-weight:800;font-size:15px;cursor:pointer;margin-top:4px}
  #stk-wrap .stk-go:disabled{opacity:.5;cursor:default}
  #stk-wrap .stk-side .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line,#232a33)}
  #stk-wrap .stk-side .row:last-child{border-bottom:0}
  #stk-wrap .stk-side .k{font-size:12px;color:var(--ink-3,#94a1b2)}
  #stk-wrap .stk-side .v{font-family:var(--mono);font-size:13px;color:#eef1f6}
  #stk-wrap .stk-side .v.up{color:#3fd07f} #stk-wrap .stk-side .v.dn{color:#ff6b6b}
  #stk-wrap .stk-side h4{font-family:var(--display);font-size:14px;color:#eef1f6;margin:0 0 10px}
  #stk-wrap .stk-bar{height:7px;border-radius:4px;background:rgba(255,255,255,.06);overflow:hidden;margin:6px 0 2px}
  #stk-wrap .stk-bar i{display:block;height:100%;background:var(--gold,#e8b84b)}
  #stk-wrap .stk-mini{font-size:10px;color:var(--ink-3,#94a1b2)}
  #stk-wrap .stk-how{margin-top:18px}
  #stk-wrap .stk-how .stk-step{display:flex;gap:12px;margin-bottom:12px}
  #stk-wrap .stk-how .n{width:24px;height:24px;flex:none;border-radius:50%;border:1px solid var(--gold-soft,#7a6220);
    display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--gold,#e8b84b)}
  #stk-wrap .stk-how b{display:block;font-size:13px;color:#eef1f6}
  #stk-wrap .stk-how span{display:block;font-size:12px;color:var(--ink-3,#94a1b2);margin-top:2px;line-height:1.45}
  #stk-wrap .stk-disc{background:rgba(255,107,107,.06);border:1px solid rgba(255,107,107,.25);border-radius:12px;
    padding:14px;font-size:12px;color:#cfd6df;line-height:1.5;margin-top:16px}
  #stk-wrap .stk-empty{text-align:center;color:var(--ink-3,#94a1b2);font-size:13px;padding:22px 0}
  /* selector emergente */
  #stk-picker{position:fixed;inset:0;z-index:9500;display:none;align-items:center;justify-content:center;
    background:rgba(3,5,8,.78);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);padding:18px}
  #stk-picker .box{width:100%;max-width:420px;max-height:76vh;background:#0d1319;border:1px solid var(--line,#232a33);
    border-radius:16px;padding:14px;display:flex;flex-direction:column}
  #stk-picker .box h4{font-family:var(--display);font-size:16px;color:#eef1f6;margin:2px 2px 12px}
  #stk-picker .list{overflow-y:auto;-webkit-overflow-scrolling:touch}
  #stk-picker .it{display:flex;align-items:center;gap:11px;padding:11px 8px;border-radius:10px;cursor:pointer}
  #stk-picker .it:hover{background:rgba(255,255,255,.04)}
  #stk-picker .it img,#stk-picker .it .ini{width:30px;height:30px;border-radius:50%;background:#1a2129}
  #stk-picker .it .ini{display:grid;place-items:center;font-size:12px;font-weight:700;color:#cfd6df}
  #stk-picker .it b{font-family:var(--display);color:#eef1f6;font-size:15px}
  #stk-picker .it .px{margin-left:auto;font-family:var(--mono);font-size:12px;color:var(--ink-3,#94a1b2)}
  `;
  document.head.appendChild(s);
}

/*──────────── Selector de moneda (picker) ────────────*/
function iniHTML(m) {
  const url = _logoCache[m.cg];
  return url ? `<img src="${url}" alt="">` : `<span class="ini">${m.s.slice(0, 3)}</span>`;
}
function abrirPicker() {
  let p = $('stk-picker');
  if (!p) { p = document.createElement('div'); p.id = 'stk-picker'; document.body.appendChild(p); }
  p.innerHTML = `<div class="box"><h4>Elige la moneda</h4><div class="list">${
    MONEDAS.map((m) => `<div class="it" data-s="${m.s}">${iniHTML(m)}<b>${m.s}</b><span class="px" id="px-${m.s}"></span></div>`).join('')
  }</div></div>`;
  p.style.display = 'flex';
  p.onclick = (e) => { if (e.target === p) p.style.display = 'none'; };
  p.querySelectorAll('.it').forEach((el) => el.onclick = () => {
    _moneda = MONEDAS.find((m) => m.s === el.getAttribute('data-s'));
    p.style.display = 'none'; pintarPanel(); refrescarUSD();
  });
  // precios en el picker
  const oc = new ethers.Contract(ORACULO, ABI_ORAC, lector());
  MONEDAS.forEach(async (m) => {
    try { const px = await oc.precioUSD(m.a); const e = $('px-' + m.s); if (e) e.textContent = fmtUSD(Number(ethers.formatUnits(px, 18))); } catch (_) {}
  });
}

/*──────────── Montaje ────────────*/
export function montarAportar(cont) {
  estilos();
  cont.innerHTML = `
  <div id="stk-wrap">
    <div class="stk-head">
      <div class="stk-tit">Staking</div>
      <div class="stk-sub">Aporta liquidez y gana una parte de todo lo que genera la plataforma. Tu capital reposa en la moneda que elijas y se te devuelve en esa misma moneda.</div>
    </div>
    <div class="stk-grid">
      <div>
        <div class="stk-card">
          <div class="stk-tabs">
            <button class="on" data-modo="stake">Stake</button>
            <button data-modo="unstake">Unstake</button>
          </div>
          <div id="stk-panel"></div>
        </div>
        <div class="stk-card stk-how">
          <h4 style="font-family:var(--display);color:#eef1f6;margin:0 0 14px">Cómo generan ingresos tus fondos</h4>
          <div class="stk-step"><span class="n">1</span><div><b>Aportas la moneda que quieras</b><span>Tu capital queda en un contrato público que solo tú controlas. Nadie de la plataforma lo toca.</span></div></div>
          <div class="stk-step"><span class="n">2</span><div><b>Tu liquidez respalda las operaciones de futuros</b><span>Cuando alguien opera con apalancamiento, usa tu liquidez como respaldo. Tú ganas una parte de sus comisiones.</span></div></div>
          <div class="stk-step"><span class="n">3</span><div><b>Cobras el 20% de toda la plataforma y el 50% de futuros</b><span>Repartido según cuánto has aportado. El del millón cobra más que el del dólar, en proporción exacta.</span></div></div>
          <div class="stk-step"><span class="n">4</span><div><b>Retiras al vencer el plazo, en tu misma moneda</b><span>Si aportaste 1 BTC, retiras 1 BTC más lo ganado. Tu capital nunca se convierte sin tu permiso.</span></div></div>
        </div>
        <div class="stk-disc">
          <b>Aviso importante.</b> El rendimiento es variable: depende de cuánta gente opere. Si hay mucha actividad, ganas más; si hay poca, puedes ganar poco o nada durante ese periodo. Tu aporte queda bloqueado durante el plazo elegido y no se puede retirar antes. Aporta solo lo que puedas permitirte inmovilizar.
        </div>
      </div>
      <div class="stk-card stk-side" id="stk-side"></div>
    </div>
  </div>`;

  cont.querySelectorAll('.stk-tabs button').forEach((b) => b.onclick = () => {
    _modo = b.getAttribute('data-modo');
    cont.querySelectorAll('.stk-tabs button').forEach((x) => x.classList.toggle('on', x === b));
    pintarPanel();
  });

  pintarPanel();
  pintarResumen();
  precargarLogos().then(() => { pintarPanel(); });
  if (wallet.alCambiar) wallet.alCambiar(() => { pintarPanel(); pintarResumen(); });
}

/*──────────── Panel central (stake / unstake) ────────────*/
function pintarPanel() {
  const panel = $('stk-panel'); if (!panel) return;
  if (_modo === 'stake') {
    panel.innerHTML = `
      <div class="stk-lbl">Moneda a aportar</div>
      <div class="stk-sel" id="stk-sel">${iniHTML(_moneda)}<b>${_moneda.s}</b><span class="chev">▾</span></div>
      <div class="stk-lbl">Cantidad</div>
      <div class="stk-amt"><input id="stk-in" inputmode="decimal" placeholder="0.00"><span class="max" id="stk-max">MAX</span></div>
      <div class="stk-usd" id="stk-usd">≈ $0.00</div>
      <div class="stk-lbl">Plazo de bloqueo</div>
      <div class="stk-plazos" id="stk-plazos">
        ${PLAZOS_DEF.map((p, i) => `<div class="stk-plazo${p === _plazo ? ' on' : (i === 0 && !_plazo ? ' on' : '')}" data-i="${i}"><b>${p.etiqueta}</b><em>bloqueado</em></div>`).join('')}
      </div>
      <div class="stk-lbl">¿En qué moneda quieres que repose tu capital?</div>
      <div class="stk-hold" id="stk-hold">
        <button class="${_hold ? 'on' : ''}" data-hold="1"><b>Holdear en ${_moneda.s}</b><span>Ganas también si sube de precio. Riesgo si baja.</span></button>
        <button class="${!_hold ? 'on' : ''}" data-hold="0"><b>Conservar en USDT</b><span>Estable, sin riesgo de precio. No ganas por subida.</span></button>
      </div>
      <button class="stk-go" id="stk-go" type="button">Stake</button>`;
    $('stk-sel').onclick = abrirPicker;
    $('stk-max').onclick = ponerMax;
    $('stk-in').oninput = refrescarUSD;
    panel.querySelectorAll('.stk-plazo').forEach((el) => el.onclick = () => {
      _plazo = PLAZOS_DEF[+el.getAttribute('data-i')];
      panel.querySelectorAll('.stk-plazo').forEach((x) => x.classList.remove('on')); el.classList.add('on');
    });
    panel.querySelectorAll('.stk-hold button').forEach((el) => el.onclick = () => {
      _hold = el.getAttribute('data-hold') === '1';
      panel.querySelectorAll('.stk-hold button').forEach((x) => x.classList.remove('on')); el.classList.add('on');
    });
    $('stk-go').onclick = hacerStake;
    if (!_plazo) _plazo = PLAZOS_DEF[0];
  } else {
    panel.innerHTML = `<div class="stk-lbl">Tus aportes</div><div id="stk-deps"><div class="stk-empty">Cargando…</div></div>
      <div class="stk-disc" style="margin-top:12px">Solo puedes retirar el aporte cuyo plazo ya haya vencido. Se devuelve en la misma moneda que depositaste, menos la comisión de retiro.</div>`;
    cargarDepositos();
  }
}

/*──────────── Acciones ────────────*/
async function refrescarUSD() {
  const inp = $('stk-in'); const out = $('stk-usd'); if (!inp || !out) return;
  const v = parseFloat(inp.value || '0'); if (!v) { out.textContent = '≈ $0.00'; return; }
  try {
    const oc = new ethers.Contract(ORACULO, ABI_ORAC, lector());
    const px = await oc.precioUSD(_moneda.a);
    out.textContent = '≈ ' + fmtUSD(v * Number(ethers.formatUnits(px, 18)));
  } catch (_) { out.textContent = '≈ —'; }
}
async function ponerMax() {
  if (!cuenta()) return;
  try {
    let bal;
    if (_moneda.a === '0x0000000000000000000000000000000000000000') {
      bal = await lector().getBalance(cuenta());
    } else {
      const t = new ethers.Contract(_moneda.a, ERC20, lector());
      bal = await t.balanceOf(cuenta());
    }
    $('stk-in').value = ethers.formatUnits(bal, 18);
    refrescarUSD();
  } catch (_) {}
}
async function hacerStake() {
  if (!cuenta()) { try { await wallet.conectar(); } catch (_) {} if (!cuenta()) return; }
  const v = parseFloat(($('stk-in') || {}).value || '0');
  if (!v) return;
  const btn = $('stk-go'); btn.disabled = true; btn.textContent = 'Confirma en tu wallet…';
  try {
    const monto = ethers.parseUnits(String(v), 18);
    const signer = await firmante();
    const esBNB = _moneda.a === '0x0000000000000000000000000000000000000000';
    if (!esBNB) {
      const t = new ethers.Contract(_moneda.a, ERC20, signer);
      const alw = await t.allowance(cuenta(), STAKING);
      if (alw < monto) { const tx = await t.approve(STAKING, monto); await tx.wait(); }
    }
    const stk = new ethers.Contract(STAKING, ABI_STK, signer);
    const tx = await stk.stake(_moneda.a, monto, _plazo.seg, _hold, esBNB ? { value: monto } : {});
    btn.textContent = 'Procesando…';
    await tx.wait();
    btn.textContent = '¡Aportado!';
    $('stk-in').value = ''; refrescarUSD(); pintarResumen();
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Stake'; }, 2500);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Stake';
  }
}
async function cargarDepositos() {
  const cont = $('stk-deps'); if (!cont) return;
  if (!cuenta()) { cont.innerHTML = '<div class="stk-empty">Conecta tu wallet para ver tus aportes.</div>'; return; }
  try {
    const stk = new ethers.Contract(STAKING, ABI_STK, lector());
    const deps = await stk.depositosDe(cuenta());
    const vivos = deps.map((d, i) => ({ d, i })).filter((x) => !x.d.retirado);
    if (!vivos.length) { cont.innerHTML = '<div class="stk-empty">Todavía no tienes aportes activos.</div>'; return; }
    const ahora = Math.floor(Date.now() / 1000);
    cont.innerHTML = vivos.map(({ d, i }) => {
      const m = MONEDAS.find((x) => x.a.toLowerCase() === d.token.toLowerCase());
      const vencido = ahora >= Number(d.vence);
      const cant = ethers.formatUnits(d.monto, 18);
      const fecha = new Date(Number(d.vence) * 1000).toLocaleDateString();
      return `<div class="stk-sel" style="cursor:default">
        ${m ? iniHTML(m) : '<span class="ini">?</span>'}
        <div><b>${(+cant).toLocaleString('en-US',{maximumFractionDigits:6})} ${m ? m.s : ''}</b>
        <div class="stk-mini">${vencido ? 'Disponible para retirar' : 'Se desbloquea el ' + fecha}</div></div>
        <button class="max" data-i="${i}" ${vencido ? '' : 'disabled style="opacity:.4"'}>Unstake</button>
      </div>`;
    }).join('');
    cont.querySelectorAll('button[data-i]').forEach((b) => b.onclick = () => hacerUnstake(+b.getAttribute('data-i'), b));
  } catch (_) { cont.innerHTML = '<div class="stk-empty">No se pudo leer tus aportes ahora.</div>'; }
}
async function hacerUnstake(id, btn) {
  btn.disabled = true; btn.textContent = 'Firma…';
  try {
    const stk = new ethers.Contract(STAKING, ABI_STK, await firmante());
    const tx = await stk.unstake(id); await tx.wait();
    cargarDepositos(); pintarResumen();
  } catch (_) { btn.disabled = false; btn.textContent = 'Unstake'; }
}

/*──────────── Panel lateral (resumen del usuario, en vivo) ────────────*/
async function pintarResumen() {
  const side = $('stk-side'); if (!side) return;
  if (!cuenta()) {
    side.innerHTML = `<h4>Tu resumen</h4><div class="stk-empty">Conecta tu wallet para ver tu posición.</div>`;
    return;
  }
  side.innerHTML = `<h4>Tu resumen</h4><div class="stk-empty">Cargando…</div>`;
  try {
    const p = new ethers.Contract(PANEL, ABI_PANEL, lector());
    const pos = await p.posicionUsuario(cuenta());
    const cap = await p.capitalDeUsuario(cuenta());
    const rec = await p.recompensasDe(cuenta());
    const real = Number(ethers.formatUnits(pos.pesoReal, 18));
    const valAhora = Number(ethers.formatUnits(pos.valorActualUSD, 18));
    const gan = Number(ethers.formatUnits(pos.gananciaValoriza, 18));
    const pct = Number(pos.porcentaje) / 1e4;
    let totalEnUso = 0n, totalCap = 0n;
    cap.forEach((c) => { totalEnUso += c.enUso; totalCap += c.total; });
    const enUsoUSD = cap.reduce((a, c) => a + (Number(c.total) ? Number(ethers.formatUnits(c.valorUSD, 18)) * Number(c.enUso) / Number(c.total) : 0), 0);
    const pendientes = rec.filter((r) => r.pendiente > 0n);
    side.innerHTML = `
      <h4>Tu resumen</h4>
      <div class="row"><span class="k">Tu capital</span><span class="v">${fmtUSD(real)}</span></div>
      <div class="row"><span class="k">Valor ahora</span><span class="v ${gan >= 0 ? 'up' : 'dn'}">${fmtUSD(valAhora)}</span></div>
      <div class="row"><span class="k">Ganancia por valorización</span><span class="v ${gan >= 0 ? 'up' : 'dn'}">${gan >= 0 ? '+' : ''}${fmtUSD(gan)}</span></div>
      <div class="row"><span class="k">Tu participación</span><span class="v">${pct.toFixed(4)}%</span></div>
      <div style="margin:14px 0 4px" class="stk-lbl">En uso (trabajando) vs disponible</div>
      <div class="stk-bar"><i style="width:${real ? Math.min(100, enUsoUSD / real * 100) : 0}%"></i></div>
      <div class="stk-mini">${fmtUSD(enUsoUSD)} generando ingresos · ${fmtUSD(Math.max(0, real - enUsoUSD))} disponible</div>
      ${pendientes.length ? `
        <div style="margin:16px 0 8px" class="stk-lbl">Recompensas por cobrar</div>
        ${pendientes.map((r) => `<div class="row"><span class="k">${r.simbolo}</span><span class="v up">${(+ethers.formatUnits(r.pendiente,18)).toLocaleString('en-US',{maximumFractionDigits:6})}</span></div>`).join('')}
        <button class="stk-go" id="stk-claim" style="margin-top:12px">Cobrar recompensas</button>
      ` : `<div class="stk-mini" style="margin-top:14px">Aún no tienes recompensas por cobrar. Se acumulan a medida que la gente opera.</div>`}`;
    const cl = $('stk-claim');
    if (cl) cl.onclick = async () => {
      cl.disabled = true; cl.textContent = 'Firma…';
      try { const stk = new ethers.Contract(STAKING, ABI_STK, await firmante()); const tx = await stk.reclamarTodo(); await tx.wait(); pintarResumen(); }
      catch (_) { cl.disabled = false; cl.textContent = 'Cobrar recompensas'; }
    };
  } catch (_) {
    side.innerHTML = `<h4>Tu resumen</h4><div class="stk-empty">No se pudo leer tu posición ahora.</div>`;
  }
}


/*──────────── Apertura como overlay (para el hero / servicios) ────────────*/
export function abrirAportar() {
  estilos();
  const prev = document.getElementById('stk-overlay'); if (prev) prev.remove();
  const d = document.createElement('div');
  d.id = 'stk-overlay';
  d.style.cssText = 'position:fixed;inset:0;z-index:9600;background:#05070a;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(40px + env(safe-area-inset-bottom,0px))';
  d.innerHTML = '<button id="stk-ov-x" aria-label="Cerrar" style="position:fixed;right:16px;top:calc(14px + env(safe-area-inset-top,0px));z-index:2;width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid var(--line,#232a33);color:#cfd6df;font-size:16px;cursor:pointer">✕</button><div id="stk-mount"></div>';
  document.body.appendChild(d);
  document.getElementById('stk-ov-x').onclick = () => d.remove();
  montarAportar(document.getElementById('stk-mount'));
}
