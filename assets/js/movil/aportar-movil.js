import * as ethers from '../vendor/ethers-6.13.4.min.js?v=126';
import * as wallet from '../wallet.js?v=126';

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
  { s: 'BATDG', a: '0xc748673057861a797275CD8A068AbB95A902e8de', cg: 'baby-doge-coin' },
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


/*──────────── Estado ────────────*/
let _modo = 'stake';
let _moneda = MONEDAS[0];
let _plazo = PLAZOS_DEF[0];
let _hold = true;
const $ = (id) => document.getElementById(id);
const cuenta = () => wallet.cuentaActual();
const fmtUSD = (n) => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const _logoCache = {};
function iniHTML(m){ const u=_logoCache[m.cg]; return u?`<img src="${u}" alt="">`:`<span class="ini">${m.s.slice(0,3)}</span>`; }
async function precargarLogos(){ try{ const ids=MONEDAS.map(m=>m.cg).join(','); const r=await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`); const d=await r.json(); d.forEach(c=>{_logoCache[c.id]=c.image;}); }catch(_){}}

let _css=false;
function estilos(){
  if(_css) return; _css=true;
  const s=document.createElement('style'); s.textContent=`
  .alm{position:fixed;inset:0;z-index:500;background:#0a0d12;display:flex;flex-direction:column;color:#eef1f6;
    --gold:#E8B84B;--ink3:#7d8794;--ink4:#4a5561;--line:#232b36;
    padding-top:env(safe-area-inset-top,0px)}
  .alm .alm-head{display:flex;align-items:center;justify-content:center;position:relative;padding:16px 14px;border-bottom:1px solid var(--line)}
  .alm .alm-x{position:absolute;right:14px;top:50%;transform:translateY(-50%);width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:#7d8794;display:grid;place-items:center;font-size:15px}
  .alm .alm-h{font-weight:800;font-size:18px}
  .alm .alm-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 14px calc(40px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:13px}
  .alm .alm-sub{font-size:12.5px;color:var(--ink3);text-align:center;line-height:1.4}
  .alm .alm-mine{display:flex;gap:9px}
  .alm .alm-mine .m{flex:1;background:rgba(16,20,26,.62);border:1px solid var(--line);border-radius:13px;padding:12px 11px}
  .alm .alm-mine .m b{display:block;font-weight:800;font-size:15px}
  .alm .alm-mine .m b.gold{color:var(--gold)}
  .alm .alm-mine .m b.up{color:#3fd07f} .alm .alm-mine .m b.dn{color:#ff6b6b}
  .alm .alm-mine .m span{display:block;font-size:9px;color:var(--ink3);text-transform:uppercase;letter-spacing:.05em;margin-top:3px}
  .alm .alm-tabs{display:flex;background:rgba(10,14,19,.55);border:1px solid var(--line);border-radius:12px;padding:4px}
  .alm .alm-tabs button{flex:1;height:38px;border:none;background:none;border-radius:9px;font-weight:700;font-size:14px;color:var(--ink3)}
  .alm .alm-tabs button.on{color:#241900;background:linear-gradient(180deg,#f7db8d,var(--gold) 55%,#c79426)}
  .alm .alm-card{background:rgba(11,14,17,.66);border:1px solid var(--line);border-radius:14px;padding:14px}
  .alm .alm-lbl{font-size:10.5px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
  .alm .alm-sel{display:flex;align-items:center;gap:10px;background:rgba(10,14,19,.5);border:1px solid var(--line);border-radius:12px;padding:11px 13px;margin-bottom:12px}
  .alm .alm-sel img,.alm .alm-sel .ini{width:26px;height:26px;border-radius:50%;background:#1a2129}
  .alm .alm-sel .ini{display:grid;place-items:center;font-size:11px;font-weight:700;color:#cfd6df}
  .alm .alm-sel b{font-weight:700;font-size:15px} .alm .alm-sel .chev{margin-left:auto;color:var(--ink3)}
  .alm .alm-amt-row{display:flex;align-items:center;gap:10px}
  .alm .alm-amt{flex:1;min-width:0;background:none;border:none;outline:none;color:#eef1f6;font-weight:700;font-size:26px}
  .alm .alm-amt::placeholder{color:var(--ink4)}
  .alm .alm-max{font-size:10px;font-weight:700;color:var(--gold);border:1px solid var(--gold);border-radius:7px;padding:5px 8px;background:none}
  .alm .alm-usd{font-size:11px;color:var(--ink3);margin-top:6px}
  .alm .alm-plazos{display:flex;gap:7px;flex-wrap:wrap}
  .alm .alm-plazo{flex:1;min-width:64px;background:rgba(10,14,19,.5);border:1px solid var(--line);border-radius:10px;padding:10px 4px;text-align:center}
  .alm .alm-plazo.on{border-color:var(--gold);background:rgba(232,184,75,.1)}
  .alm .alm-plazo b{display:block;font-weight:700;font-size:13px} .alm .alm-plazo em{display:block;font-style:normal;font-size:9px;color:var(--ink3);margin-top:2px}
  .alm .alm-hold{display:flex;gap:8px;margin-top:12px}
  .alm .alm-hold button{flex:1;padding:10px 8px;border-radius:10px;border:1px solid var(--line);background:rgba(10,14,19,.5);color:var(--ink3);text-align:left}
  .alm .alm-hold button.on{border-color:var(--gold);background:rgba(232,184,75,.08)}
  .alm .alm-hold button b{display:block;font-size:12px;color:#eef1f6} .alm .alm-hold button span{display:block;font-size:9px;color:var(--ink3);margin-top:2px;line-height:1.3}
  .alm .alm-go{width:100%;padding:14px;border-radius:12px;border:0;background:var(--gold);color:#0a0e13;font-weight:800;font-size:15px;margin-top:14px}
  .alm .alm-go:disabled{opacity:.5}
  .alm .alm-how{margin-top:4px} .alm .alm-step{display:flex;gap:11px;margin-bottom:11px}
  .alm .alm-step .n{width:22px;height:22px;flex:none;border-radius:50%;border:1px solid var(--gold);display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--gold)}
  .alm .alm-step b{display:block;font-size:12.5px} .alm .alm-step span{display:block;font-size:11px;color:var(--ink3);margin-top:2px;line-height:1.4}
  .alm .alm-disc{background:rgba(255,107,107,.06);border:1px solid rgba(255,107,107,.25);border-radius:12px;padding:13px;font-size:11.5px;color:#cfd6df;line-height:1.5}
  .alm .alm-empty{text-align:center;color:var(--ink3);font-size:12.5px;padding:18px 0}
  .alm-pick{position:fixed;inset:0;z-index:600;display:none;align-items:flex-end;background:rgba(3,5,8,.78);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}
  .alm-pick .box{width:100%;max-height:74vh;background:#0d1319;border-top:1px solid var(--line);border-radius:18px 18px 0 0;padding:16px 14px calc(16px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column}
  .alm-pick .box h4{font-size:16px;margin:2px 2px 12px} .alm-pick .list{overflow-y:auto;-webkit-overflow-scrolling:touch}
  .alm-pick .it{display:flex;align-items:center;gap:11px;padding:11px 6px;border-radius:10px}
  .alm-pick .it img,.alm-pick .it .ini{width:30px;height:30px;border-radius:50%;background:#1a2129}
  .alm-pick .it .ini{display:grid;place-items:center;font-size:12px;font-weight:700;color:#cfd6df}
  .alm-pick .it b{font-size:15px} .alm-pick .it .px{margin-left:auto;font-size:12px;color:var(--ink3)}
  `;
  document.head.appendChild(s);
}

const RPCS2 = RPCS;
const lector2 = lector;
async function firmante2(){ const bp=new ethers.BrowserProvider(window.ethereum); return bp.getSigner(); }

export function abrirAportarMovil(){
  estilos();
  const prev=$('alm'); if(prev) prev.remove();
  const d=document.createElement('div'); d.className='alm'; d.id='alm';
  d.innerHTML=`
    <div class="alm-head"><div class="alm-h">Staking</div><button class="alm-x" id="alm-x">✕</button></div>
    <div class="alm-body">
      <div class="alm-sub">Aporta liquidez y gana parte de todo lo que genera la plataforma. Tu capital reposa en tu moneda y se te devuelve igual.</div>
      <div class="alm-mine" id="alm-mine">
        <div class="m"><b id="alm-cap">$0.00</b><span>Tu capital</span></div>
        <div class="m"><b class="gold" id="alm-gan">$0.00</b><span>Valorización</span></div>
      </div>
      <div class="alm-tabs"><button class="on" data-modo="stake">Stake</button><button data-modo="unstake">Unstake</button></div>
      <div id="alm-panel"></div>
      <div class="alm-card alm-how">
        <div class="alm-lbl" style="margin-bottom:12px">Cómo generan ingresos tus fondos</div>
        <div class="alm-step"><span class="n">1</span><div><b>Aportas la moneda que quieras</b><span>Queda en un contrato público que solo tú controlas.</span></div></div>
        <div class="alm-step"><span class="n">2</span><div><b>Tu liquidez respalda los futuros</b><span>Ganas parte de las comisiones de quien opera.</span></div></div>
        <div class="alm-step"><span class="n">3</span><div><b>Cobras 20% de la plataforma y 50% de futuros</b><span>Según cuánto aportaste.</span></div></div>
        <div class="alm-step"><span class="n">4</span><div><b>Retiras al vencer, en tu misma moneda</b><span>1 BTC aportado = 1 BTC de vuelta más lo ganado.</span></div></div>
      </div>
      <div class="alm-disc"><b>Aviso.</b> El rendimiento es variable: depende de cuánta gente opere. Tu aporte se bloquea durante el plazo. Aporta solo lo que puedas inmovilizar.</div>
    </div>`;
  document.body.appendChild(d);
  $('alm-x').onclick=()=>d.remove();
  d.querySelectorAll('.alm-tabs button').forEach(b=>b.onclick=()=>{ _modo=b.dataset.modo; d.querySelectorAll('.alm-tabs button').forEach(x=>x.classList.toggle('on',x===b)); pintar(); });
  pintar(); resumen();
  precargarLogos().then(()=>pintar());
  if(wallet.alCambiar) wallet.alCambiar(()=>{ pintar(); resumen(); });

  function pintar(){
    const p=$('alm-panel'); if(!p) return;
    if(_modo==='stake'){
      p.innerHTML=`
        <div class="alm-lbl">Moneda a aportar</div>
        <div class="alm-sel" id="alm-sel">${iniHTML(_moneda)}<b>${_moneda.s}</b><span class="chev">▾</span></div>
        <div class="alm-card">
          <div class="alm-lbl">Cantidad</div>
          <div class="alm-amt-row"><input class="alm-amt" id="alm-in" inputmode="decimal" placeholder="0.00"><button class="alm-max" id="alm-max">MÁX</button></div>
          <div class="alm-usd" id="alm-usd">≈ $0.00</div>
        </div>
        <div class="alm-lbl" style="margin:12px 2px 8px">Plazo de bloqueo</div>
        <div class="alm-plazos">${PLAZOS_DEF.map((x,i)=>`<div class="alm-plazo${x===_plazo?' on':''}" data-i="${i}"><b>${x.etiqueta.split(' ')[0]}</b><em>${x.etiqueta.split(' ')[1]||''}</em></div>`).join('')}</div>
        <div class="alm-lbl" style="margin:12px 2px 8px">¿En qué moneda reposa tu capital?</div>
        <div class="alm-hold">
          <button class="${_hold?'on':''}" data-h="1"><b>Holdear en ${_moneda.s}</b><span>Ganas si sube. Riesgo si baja.</span></button>
          <button class="${!_hold?'on':''}" data-h="0"><b>Conservar en USDT</b><span>Estable, sin riesgo de precio.</span></button>
        </div>
        <button class="alm-go" id="alm-go">Stake</button>`;
      $('alm-sel').onclick=abrirPick;
      $('alm-max').onclick=max;
      $('alm-in').oninput=usd;
      p.querySelectorAll('.alm-plazo').forEach(el=>el.onclick=()=>{ _plazo=PLAZOS_DEF[+el.dataset.i]; p.querySelectorAll('.alm-plazo').forEach(x=>x.classList.remove('on')); el.classList.add('on'); });
      p.querySelectorAll('.alm-hold button').forEach(el=>el.onclick=()=>{ _hold=el.dataset.h==='1'; p.querySelectorAll('.alm-hold button').forEach(x=>x.classList.remove('on')); el.classList.add('on'); });
      $('alm-go').onclick=stake;
    } else {
      p.innerHTML=`<div class="alm-lbl">Tus aportes</div><div id="alm-deps"><div class="alm-empty">Cargando…</div></div>
        <div class="alm-disc" style="margin-top:10px">Solo puedes retirar el aporte cuyo plazo ya venció. Se devuelve en tu misma moneda.</div>`;
      deps();
    }
  }
  async function usd(){ const i=$('alm-in'),o=$('alm-usd'); if(!i||!o) return; const v=parseFloat(i.value||'0'); if(!v){o.textContent='≈ $0.00';return;} try{ const oc=new ethers.Contract(ORACULO,ABI_ORAC,lector2()); const px=await oc.precioUSD(_moneda.a); o.textContent='≈ '+fmtUSD(v*Number(ethers.formatUnits(px,18))); }catch(_){o.textContent='≈ —';} }
  async function max(){ if(!cuenta())return; try{ let bal; if(_moneda.a==='0x0000000000000000000000000000000000000000'){bal=await lector2().getBalance(cuenta());}else{const t=new ethers.Contract(_moneda.a,ERC20,lector2());bal=await t.balanceOf(cuenta());} $('alm-in').value=ethers.formatUnits(bal,18); usd(); }catch(_){}}
  function abrirPick(){
    let pk=$('alm-pick'); if(!pk){pk=document.createElement('div');pk.id='alm-pick';pk.className='alm-pick';document.body.appendChild(pk);}
    pk.innerHTML=`<div class="box"><h4>Elige la moneda</h4><div class="list">${MONEDAS.map(m=>`<div class="it" data-s="${m.s}">${iniHTML(m)}<b>${m.s}</b><span class="px" id="apx-${m.s}"></span></div>`).join('')}</div></div>`;
    pk.style.display='flex'; pk.onclick=(e)=>{ if(e.target===pk) pk.style.display='none'; };
    pk.querySelectorAll('.it').forEach(el=>el.onclick=()=>{ _moneda=MONEDAS.find(m=>m.s===el.dataset.s); pk.style.display='none'; pintar(); });
    const oc=new ethers.Contract(ORACULO,ABI_ORAC,lector2());
    MONEDAS.forEach(async m=>{ try{ const px=await oc.precioUSD(m.a); const e=$('apx-'+m.s); if(e)e.textContent=fmtUSD(Number(ethers.formatUnits(px,18))); }catch(_){}});
  }
  async function stake(){
    if(!cuenta()){ try{await wallet.conectar();}catch(_){}if(!cuenta())return; }
    const v=parseFloat(($('alm-in')||{}).value||'0'); if(!v)return;
    const b=$('alm-go'); b.disabled=true; b.textContent='Confirma en tu wallet…';
    try{
      const monto=ethers.parseUnits(String(v),18); const signer=await firmante2();
      const esBNB=_moneda.a==='0x0000000000000000000000000000000000000000';
      if(!esBNB){ const t=new ethers.Contract(_moneda.a,ERC20,signer); const alw=await t.allowance(cuenta(),STAKING); if(alw<monto){const tx=await t.approve(STAKING,monto);await tx.wait();} }
      const stk=new ethers.Contract(STAKING,ABI_STK,signer);
      const tx=await stk.stake(_moneda.a,monto,_plazo.seg,_hold, esBNB?{value:monto}:{});
      b.textContent='Procesando…'; await tx.wait(); b.textContent='¡Aportado!';
      $('alm-in').value=''; usd(); resumen();
      setTimeout(()=>{b.disabled=false;b.textContent='Stake';},2500);
    }catch(_){ b.disabled=false; b.textContent='Stake'; }
  }
  async function deps(){
    const c=$('alm-deps'); if(!c)return;
    if(!cuenta()){c.innerHTML='<div class="alm-empty">Conecta tu wallet para ver tus aportes.</div>';return;}
    try{
      const stk=new ethers.Contract(STAKING,ABI_STK,lector2()); const ds=await stk.depositosDe(cuenta());
      const vivos=ds.map((d,i)=>({d,i})).filter(x=>!x.d.retirado);
      if(!vivos.length){c.innerHTML='<div class="alm-empty">Todavía no tienes aportes activos.</div>';return;}
      const ahora=Math.floor(Date.now()/1000);
      c.innerHTML=vivos.map(({d,i})=>{ const m=MONEDAS.find(x=>x.a.toLowerCase()===d.token.toLowerCase()); const venc=ahora>=Number(d.vence); const cant=ethers.formatUnits(d.monto,18); const f=new Date(Number(d.vence)*1000).toLocaleDateString();
        return `<div class="alm-sel">${m?iniHTML(m):'<span class="ini">?</span>'}<div><b>${(+cant).toLocaleString('en-US',{maximumFractionDigits:6})} ${m?m.s:''}</b><div style="font-size:10px;color:var(--ink3)">${venc?'Disponible':'Desbloquea '+f}</div></div><button class="alm-max" data-i="${i}" ${venc?'':'disabled style="opacity:.4"'}>Unstake</button></div>`;
      }).join('');
      c.querySelectorAll('button[data-i]').forEach(bt=>bt.onclick=()=>unstake(+bt.dataset.i,bt));
    }catch(_){c.innerHTML='<div class="alm-empty">No se pudo leer tus aportes ahora.</div>';}
  }
  async function unstake(id,bt){ bt.disabled=true; bt.textContent='Firma…'; try{ const stk=new ethers.Contract(STAKING,ABI_STK,await firmante2()); const tx=await stk.unstake(id); await tx.wait(); deps(); resumen(); }catch(_){bt.disabled=false;bt.textContent='Unstake';} }
  async function resumen(){
    if(!cuenta())return;
    try{
      const p=new ethers.Contract(PANEL,ABI_PANEL,lector2());
      const pos=await p.posicionUsuario(cuenta());
      const real=Number(ethers.formatUnits(pos.pesoReal,18));
      const gan=Number(ethers.formatUnits(pos.gananciaValoriza,18));
      const cap=$('alm-cap'), gEl=$('alm-gan');
      if(cap) cap.textContent=fmtUSD(real);
      if(gEl){ gEl.textContent=(gan>=0?'+':'')+fmtUSD(gan); gEl.className='gold '+(gan>=0?'up':'dn'); }
    }catch(_){}
  }
}
