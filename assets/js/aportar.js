/* ══════════════════════════════════════════════════════════════════════
   aportar.js — Staking. Diseño corporativo (según el mockup del owner).
   Banner + 4 stats + panel de stake con planes APR + columna derecha
   (Your position / Claim + performance chart + latest activity).
   En inglés. Sin sidebar, sin premium. Selector con BNB y USDT primero.
   Botones centrados. Conectado a los contratos reales. Web y móvil.
   ══════════════════════════════════════════════════════════════════════ */

import * as ethers from './vendor/ethers-6.13.4.min.js?v=128';
import * as wallet from './wallet.js?v=128';

const STAKING='0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4';
const ORACULO='0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3';
const PANEL='0xE620D5BD60F70CCdFa4493F3a5B794d1BBEbf8d2';
const RPCS=['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc-dataseed1.ninicoin.io','https://rpc.ankr.com/bsc'];
const lector=()=>new ethers.JsonRpcProvider(RPCS[Math.floor(Math.random()*RPCS.length)],56,{staticNetwork:true});
async function firmante(){return new ethers.BrowserProvider(window.ethereum).getSigner();}

const ERC20=['function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)','function balanceOf(address) view returns (uint256)'];
const ABI_STK=['function stake(address token,uint256 monto,uint40 plazo,bool holdMoneda) returns (uint256)','function unstake(uint256 id)','function reclamarTodo()','function depositosDe(address) view returns (tuple(address token,uint256 monto,uint256 valorUSD,uint40 cuando,uint40 vence,bool holdMoneda,bool retirado)[])'];
const ABI_ORAC=['function precioUSD(address) view returns (uint256)'];
const ABI_PANEL=['function posicionUsuario(address) view returns (tuple(uint256 pesoReal,uint256 pesoAsignado,uint256 valorActualUSD,int256 gananciaValoriza,uint256 porcentaje,uint256 numDepositos,uint256 numActivos))','function capitalDeUsuario(address) view returns (tuple(address token,string simbolo,uint8 decimales,uint256 total,uint256 enUso,uint256 disponible,uint256 valorUSD)[])','function recompensasDe(address) view returns (tuple(address token,string simbolo,uint256 pendiente)[])','function global() view returns (tuple(uint256 tvlUSD,uint256 realUSD,uint256 asignadoUSD,uint256 numStakers))'];

/* Prioridad de activos: BNB y USDT arriba. El picker agrupa el resto. */
const PRIMARIOS=['BNB','USDT'];
const MONEDAS=[
  {s:'BNB',a:'0x0000000000000000000000000000000000000000',cg:'binancecoin'},
  {s:'USDT',a:'0x55d398326f99059fF775485246999027B3197955',cg:'tether'},
  {s:'BTCB',a:'0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',cg:'bitcoin'},
  {s:'ETH',a:'0x2170Ed0880ac9A755fd29B2688956BD959F933F8',cg:'ethereum'},
  {s:'USDC',a:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',cg:'usd-coin'},
  {s:'XRP',a:'0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE',cg:'ripple'},
  {s:'DOGE',a:'0xbA2aE424d960c26247Dd6c32edC70B295c744C43',cg:'dogecoin'},
  {s:'CAKE',a:'0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',cg:'pancakeswap-token'},
  {s:'LINK',a:'0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD',cg:'chainlink'},
  {s:'DOT',a:'0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402',cg:'polkadot'},
  {s:'TRX',a:'0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3',cg:'tron'},
  {s:'ADA',a:'0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47',cg:'cardano'},
  {s:'AVAX',a:'0x1CE0c2827e2eF14D5C4f29a091d735A204794041',cg:'avalanche-2'},
  {s:'LTC',a:'0x4338665CBB7B2485A8855A139b75D5e34AB0DB94',cg:'litecoin'},
  {s:'BCH',a:'0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf',cg:'bitcoin-cash'},
  {s:'ATOM',a:'0x0Eb3a705fc54725037CC9e008bDede697f62F335',cg:'cosmos'},
  {s:'FIL',a:'0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153',cg:'filecoin'},
  {s:'NEAR',a:'0x1Fa4a73a3F0133f0025378af00236f3aBDEE5D63',cg:'near'},
  {s:'UNI',a:'0xBf5140A22578168FD562DCcF235E5D43A02ce9B1',cg:'uniswap'},
  {s:'AAVE',a:'0xfb6115445Bff7b52FeB98650C87f44907E58f802',cg:'aave'},
  {s:'XVS',a:'0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63',cg:'venus'},
  {s:'INJ',a:'0xa2B726B1145A4773F68593CF171187d8EBe4d495',cg:'injective-protocol'},
  {s:'SXP',a:'0x47BEAd2563dCBf3bF2c9407fEa4dC236fAbA485A',cg:'swipe'},
  {s:'YFI',a:'0x88f1A5ae2A3BF98AEAF342D26B30a79438c9142e',cg:'yearn-finance'},
  {s:'ALPHA',a:'0xa1faa113cbE53436Df28FF0aEe54275c13B40975',cg:'alpha-finance'},
  {s:'FLOKI',a:'0xfb5B838b6cfEEdC2873aB27866079AC55363D37E',cg:'floki'},
  {s:'BabyDoge',a:'0xc748673057861a797275CD8A068AbB95A902e8de',cg:'baby-doge-coin'},
  {s:'DAI',a:'0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',cg:'dai'},
  {s:'XTZ',a:'0x16939ef78684453bfDFb47825F8a5F714f12623a',cg:'tezos'},
  {s:'BAT',a:'0x101d82428437127bF1608F699CD651e6Abf9766E',cg:'basic-attention-token'}
];
const ESTABLES={USDT:1,USDC:1,DAI:1};
/* Planes: días de bloqueo. El APR es referencial (variable real). */
const PLANES=[
  {seg:30*86400, n:'30D', apr:'12.8%', min:'50', pop:true},
  {seg:90*86400, n:'90D', apr:'16.4%', min:'100'},
  {seg:180*86400,n:'180D',apr:'20.7%', min:'500'},
  {seg:365*86400,n:'1Y',  apr:'28.9%', min:'1,000'}
];

let _modo='stake',_moneda=MONEDAS[0],_plan=PLANES[0],_hold=true,_css=false;
const _logo={};
const $=(id)=>document.getElementById(id);
const cuenta=()=>wallet.cuentaActual();
const usd=(n)=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const num=(n,d=4)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
const corta=(a)=>a?a.slice(0,6)+'…'+a.slice(-4):'';
function logoImg(m,sz){const u=_logo[m.cg];return u?`<img src="${u}" style="width:${sz}px;height:${sz}px;border-radius:50%" alt="">`:`<span style="width:${sz}px;height:${sz}px;border-radius:50%;background:#1a2129;display:grid;place-items:center;font-size:${Math.round(sz*0.36)}px;font-weight:700;color:#cfd6df">${m.s.slice(0,3)}</span>`;}
async function cargarLogos(){try{const r=await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${MONEDAS.map(m=>m.cg).join(',')}`);(await r.json()).forEach(c=>_logo[c.id]=c.image);}catch(_){}}

function estilos(){
  if(_css)return;_css=true;
  const s=document.createElement('style');s.textContent=`
  #sk{--bg:#070b10;--card:#0d141b;--card2:#0b1118;--line:#1b2530;--line2:#2a3742;--gold:#E8B84B;--goldd:#c79426;--ink:#f3f6fa;--ink2:#aab6c4;--ink3:#69788a;--up:#34d399;--dn:#f87171;
    color:var(--ink);font-feature-settings:'tnum'}
  #sk .mono{font-variant-numeric:tabular-nums}
  #sk .topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 2px 16px}
  #sk .back{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);color:var(--ink2);border-radius:11px;padding:9px 14px;font-weight:600;font-size:13px;cursor:pointer}
  #sk .who{display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:8px 12px;font-size:13px;font-weight:600;color:var(--ink)}
  #sk .who .dot{width:8px;height:8px;border-radius:50%;background:var(--up)}
  #sk .banner{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:20px;padding:30px 28px;margin-bottom:16px;background:
     radial-gradient(120% 160% at 85% 30%, rgba(232,184,75,.16), transparent 55%),
     linear-gradient(120deg,#0f1620,#0a0f16)}
  #sk .banner:before{content:'';position:absolute;right:-40px;top:50%;transform:translateY(-50%);width:230px;height:230px;border-radius:50%;
     background:radial-gradient(circle at 40% 40%, rgba(232,184,75,.55), rgba(232,184,75,.05) 60%, transparent 70%);filter:blur(6px)}
  #sk .banner .tag{width:5px;height:44px;background:linear-gradient(180deg,#f7db8d,var(--gold));border-radius:3px;position:absolute;left:0;top:30px}
  #sk .banner h1{font-family:var(--display,inherit);font-weight:800;font-size:40px;letter-spacing:-.03em;margin:0 0 8px;position:relative}
  #sk .banner .lead{font-size:15px;color:var(--ink);font-weight:600;margin:0 0 8px}
  #sk .banner p{font-size:13px;color:var(--ink2);margin:0;max-width:460px;line-height:1.5;position:relative}
  #sk .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px}
  #sk .stat{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:16px;padding:18px}
  #sk .stat .h{display:flex;align-items:center;gap:10px;color:var(--ink2);font-size:12.5px}
  #sk .stat .ic{width:34px;height:34px;border-radius:10px;background:rgba(232,184,75,.1);display:grid;place-items:center;color:var(--gold);flex:none}
  #sk .stat .v{font-size:22px;font-weight:800;margin-top:12px;letter-spacing:-.02em}
  #sk .stat .d{font-size:11.5px;color:var(--up);margin-top:5px}
  #sk .grid{display:grid;grid-template-columns:1fr 372px;gap:16px;align-items:start}
  #sk .panel{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:20px;padding:22px}
  #sk .tabs{display:flex;background:var(--card2);border:1px solid var(--line);border-radius:13px;padding:5px;margin-bottom:22px}
  #sk .tabs button{flex:1;padding:11px;border:0;background:none;border-radius:9px;color:var(--ink3);font-weight:700;font-size:14px;cursor:pointer;transition:.15s}
  #sk .tabs button.on{background:linear-gradient(180deg,#f7db8d,var(--gold) 60%,var(--goldd));color:#241900}
  #sk .lbl{font-size:12px;color:var(--ink3);margin:0 2px 9px}
  #sk .row2{display:grid;grid-template-columns:200px 1fr;gap:14px;margin-bottom:22px}
  #sk .sel{display:flex;align-items:center;gap:10px;background:var(--card2);border:1px solid var(--line2);border-radius:13px;padding:13px 15px;cursor:pointer;transition:.15s}
  #sk .sel:hover{border-color:var(--gold)} #sk .sel b{font-weight:700;font-size:15px} #sk .sel .chev{margin-left:auto;color:var(--ink3);font-size:11px}
  #sk .amt{display:flex;align-items:center;gap:10px;background:var(--card2);border:1px solid var(--line2);border-radius:13px;padding:0 15px}
  #sk .amt input{flex:1;min-width:0;background:none;border:0;color:var(--ink);font-size:24px;font-weight:700;padding:13px 0;outline:none;font-variant-numeric:tabular-nums}
  #sk .amt input::placeholder{color:var(--ink3)} #sk .amt .u{font-size:13px;color:var(--ink3)} #sk .amt .max{font-size:11px;font-weight:800;color:var(--gold);cursor:pointer}
  #sk .avail{font-size:12px;color:var(--ink3);margin:-14px 2px 20px}
  #sk .plans{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  #sk .plan{position:relative;background:var(--card2);border:1px solid var(--line2);border-radius:14px;padding:16px 14px;cursor:pointer;transition:.15s}
  #sk .plan:hover{border-color:var(--line2)} #sk .plan.on{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
  #sk .plan .d{font-weight:800;font-size:16px} #sk .plan .apr{color:var(--gold);font-weight:800;font-size:20px;margin:8px 0 3px} #sk .plan .ap{font-size:10px;color:var(--ink3)} #sk .plan .mn{font-size:11px;color:var(--ink3);margin-top:8px}
  #sk .plan .pop{position:absolute;top:-9px;right:10px;background:var(--gold);color:#241900;font-size:9px;font-weight:800;padding:3px 8px;border-radius:6px}
  #sk .opts{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px}
  #sk .opt{background:var(--card2);border:1px solid var(--line2);border-radius:13px;padding:14px;cursor:pointer;transition:.15s}
  #sk .opt.on{border-color:var(--gold);background:rgba(232,184,75,.05)}
  #sk .opt .t{display:flex;align-items:center;gap:8px} #sk .opt .dt{width:14px;height:14px;border-radius:50%;border:2px solid var(--line2);flex:none}
  #sk .opt.on .dt{border-color:var(--gold);background:radial-gradient(circle,var(--gold) 40%,transparent 46%)}
  #sk .opt b{font-size:13px} #sk .opt p{font-size:11px;color:var(--ink3);margin:6px 0 0;line-height:1.4}
  #sk .cta{width:100%;padding:16px;border:0;border-radius:14px;background:linear-gradient(180deg,#f7db8d,var(--gold) 60%,var(--goldd));color:#241900;font-weight:800;font-size:16px;cursor:pointer;transition:.15s}
  #sk .cta:hover{filter:brightness(1.05)} #sk .cta:disabled{opacity:.55;cursor:default}
  /* columna derecha */
  #sk .side{display:flex;flex-direction:column;gap:16px}
  #sk .box{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:18px;padding:20px}
  #sk .box .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px} #sk .box .hd h3{font-size:14px;font-weight:700;margin:0} #sk .box .hd .mut{font-size:12px;color:var(--ink3)}
  #sk .pos .coin{display:flex;align-items:center;gap:10px;margin-bottom:16px} #sk .pos .coin b{font-size:15px}
  #sk .pos .two{display:flex;justify-content:space-between}
  #sk .pos .two .k{font-size:11px;color:var(--ink3)} #sk .pos .two .v{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums} #sk .pos .two .v.g{color:var(--up)}
  #sk .pos .rw{display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}
  #sk .pos .rw .k{font-size:11px;color:var(--ink3)} #sk .pos .rw .v{font-size:17px;font-weight:800;font-variant-numeric:tabular-nums}
  #sk .claim{background:none;border:1px solid var(--gold);color:var(--gold);border-radius:10px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer}
  #sk .claim:disabled{opacity:.5}
  #sk svg.spark{width:100%;height:88px;display:block}
  #sk .rng{display:flex;gap:6px} #sk .rng button{font-size:11px;color:var(--ink3);background:none;border:1px solid var(--line);border-radius:7px;padding:4px 9px;cursor:pointer} #sk .rng button.on{border-color:var(--gold);color:var(--gold)}
  #sk .mv{display:flex;align-items:center;gap:11px;padding:11px 0;border-top:1px solid var(--line)} #sk .mv:first-child{border-top:0}
  #sk .mv .mi{width:32px;height:32px;border-radius:9px;background:rgba(52,211,153,.1);color:var(--up);display:grid;place-items:center;flex:none}
  #sk .mv .mi.out{background:rgba(105,120,138,.14);color:var(--ink2)}
  #sk .mv .mt{flex:1;min-width:0} #sk .mv .mt b{font-size:12.5px;display:block} #sk .mv .mt span{font-size:10.5px;color:var(--ink3)}
  #sk .mv .ma{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums} #sk .mv .ma.up{color:var(--up)} #sk .mv .ma.dn{color:var(--ink2)}
  #sk .empty{text-align:center;color:var(--ink3);font-size:12.5px;padding:20px 0}
  #sk .dep{display:flex;align-items:center;gap:12px;background:var(--card2);border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:10px}
  #sk .dep .i2{flex:1;min-width:0} #sk .dep .i2 b{font-size:15px;font-variant-numeric:tabular-nums} #sk .dep .i2 span{display:block;font-size:11px;color:var(--ink3);margin-top:2px}
  #sk .dep button{padding:9px 15px;border:1px solid var(--line2);background:none;color:var(--ink);border-radius:10px;font-weight:700;font-size:13px;cursor:pointer} #sk .dep button.rdy{border-color:var(--gold);color:var(--gold)} #sk .dep button:disabled{opacity:.35}
  /* responsive: móvil apila y stats 2x2 */
  @media(max-width:960px){ #sk .grid{grid-template-columns:1fr} #sk .banner h1{font-size:32px} }
  @media(max-width:640px){ #sk .stats{grid-template-columns:repeat(2,1fr)} #sk .plans{grid-template-columns:repeat(2,1fr)} #sk .row2{grid-template-columns:1fr;gap:10px} #sk .opts{grid-template-columns:1fr} #sk .banner{padding:24px 20px} #sk .banner h1{font-size:28px} }
  #sk-pick{position:fixed;inset:0;z-index:9700;display:none;align-items:center;justify-content:center;background:rgba(3,5,8,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);padding:18px}
  #sk-pick .bx{width:100%;max-width:430px;max-height:78vh;background:#0d141b;border:1px solid #2a3742;border-radius:18px;padding:16px;display:flex;flex-direction:column}
  #sk-pick h4{font-size:16px;margin:2px 2px 6px} #sk-pick .grp{font-size:11px;color:#69788a;margin:12px 2px 4px;text-transform:uppercase;letter-spacing:.06em} #sk-pick .list{overflow-y:auto}
  #sk-pick .it{display:flex;align-items:center;gap:12px;padding:11px 8px;border-radius:11px;cursor:pointer} #sk-pick .it:hover{background:rgba(255,255,255,.04)}
  #sk-pick .it b{font-size:15px} #sk-pick .it .px{margin-left:auto;font-size:13px;color:#69788a;font-variant-numeric:tabular-nums}
  `;
  document.head.appendChild(s);
}

const IC={
  coins:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
  users:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>',
  pct:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  lock:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
};

export function montarAportar(cont){
  estilos();
  cont.innerHTML=`
  <div id="sk">
    <div class="topbar">
      <button class="back" id="sk-back">← Back</button>
      <div class="who" id="sk-who"><span class="dot"></span><span id="sk-who-tx">Not connected</span></div>
    </div>
    <div class="banner">
      <span class="tag"></span>
      <h1>Staking</h1>
      <div class="lead">Lock your assets, earn passive income.</div>
      <p>Provide liquidity and earn a share of everything the platform generates. Your capital rests in the coin you choose and is returned in that same coin.</p>
    </div>
    <div class="stats">
      <div class="stat"><div class="h"><span class="ic">${IC.coins}</span>Total staked</div><div class="v mono" id="sk-tvl">—</div><div class="d" id="sk-tvld">Platform-wide</div></div>
      <div class="stat"><div class="h"><span class="ic">${IC.users}</span>Active stakers</div><div class="v mono" id="sk-users">—</div><div class="d">Providers</div></div>
      <div class="stat"><div class="h"><span class="ic">${IC.pct}</span>Avg. APR</div><div class="v" id="sk-apr">—</div><div class="d">Variable</div></div>
      <div class="stat"><div class="h"><span class="ic">${IC.lock}</span>Value locked</div><div class="v mono" id="sk-locked">—</div><div class="d">In contracts</div></div>
    </div>
    <div class="grid">
      <div class="panel">
        <div class="tabs"><button class="on" data-m="stake">Stake</button><button data-m="unstake">Unstake</button></div>
        <div id="sk-body"></div>
      </div>
      <div class="side">
        <div class="box pos" id="sk-pos"></div>
        <div class="box" id="sk-chart">
          <div class="hd"><h3>Performance</h3><div class="rng"><button class="on">30D</button></div></div>
          <svg class="spark" id="sk-spark" viewBox="0 0 300 88" preserveAspectRatio="none"></svg>
        </div>
        <div class="box" id="sk-act">
          <div class="hd"><h3>Latest activity</h3></div>
          <div id="sk-mvs"><div class="empty">No activity yet.</div></div>
        </div>
      </div>
    </div>
  </div>`;
  $('sk-back').onclick=()=>{ const ov=document.getElementById('sk-overlay'); if(ov) ov.remove(); const om=document.getElementById('alm-stk'); if(om) om.remove(); };
  cont.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{_modo=b.dataset.m;cont.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));body();});
  body(); global(); pos(); spark(); who();
  cargarLogos().then(()=>{body();pos();});
  if(wallet.alCambiar) wallet.alCambiar(()=>{who();body();pos();});
}
function who(){ const w=$('sk-who-tx'); if(!w)return; if(cuenta()){ w.textContent=corta(cuenta()); } else { w.textContent='Not connected'; } }

function body(){
  const b=$('sk-body'); if(!b)return;
  if(_modo==='stake'){
    b.innerHTML=`
      <div class="row2">
        <div><div class="lbl">Asset</div><div class="sel" id="sk-sel">${logoImg(_moneda,24)}<b>${_moneda.s}</b><span class="chev">▼</span></div></div>
        <div><div class="lbl">Amount</div><div class="amt"><input id="sk-in" inputmode="decimal" placeholder="0.00"><span class="u">${_moneda.s}</span><span class="max" id="sk-max">MAX</span></div></div>
      </div>
      <div class="avail" id="sk-usd">$0.00 &nbsp;·&nbsp; <span id="sk-bal">Balance: 0.00</span></div>
      <div class="lbl">Lock plan</div>
      <div class="plans">${PLANES.map((p,i)=>`<div class="plan${p===_plan?' on':''}" data-i="${i}">${p.pop?'<span class="pop">Popular</span>':''}<div class="d">${p.n}</div><div class="apr">${p.apr}</div><div class="ap">Est. APR</div><div class="mn">Min. ${p.min} ${_moneda.s}</div></div>`).join('')}</div>
      <div class="lbl">Hold your capital as</div>
      <div class="opts">
        <div class="opt${_hold?' on':''}" data-h="1"><div class="t"><span class="dt"></span><b>Keep in ${_moneda.s}</b></div><p>You also gain if the price rises. You bear price risk if it falls.</p></div>
        <div class="opt${!_hold?' on':''}" data-h="0"><div class="t"><span class="dt"></span><b>Convert to USDT</b></div><p>Stable value, no price risk. You don't gain from price moves.</p></div>
      </div>
      <button class="cta" id="sk-go">Stake</button>`;
    $('sk-sel').onclick=picker; $('sk-max').onclick=max; $('sk-in').oninput=refUSD;
    b.querySelectorAll('.plan').forEach(el=>el.onclick=()=>{_plan=PLANES[+el.dataset.i];b.querySelectorAll('.plan').forEach(x=>x.classList.remove('on'));el.classList.add('on');});
    b.querySelectorAll('.opt').forEach(el=>el.onclick=()=>{_hold=el.dataset.h==='1';b.querySelectorAll('.opt').forEach(x=>x.classList.remove('on'));el.classList.add('on');});
    $('sk-go').onclick=stake; balance();
  } else {
    b.innerHTML=`<div id="sk-deps"><div class="empty">Loading…</div></div><div class="avail" style="margin:14px 2px 0">You can withdraw a deposit once its lock ends. Returned in the same coin, minus the withdrawal fee.</div>`;
    deps();
  }
}
async function refUSD(){const i=$('sk-in'),o=$('sk-usd');if(!i||!o)return;const v=parseFloat(i.value||'0');const bal=$('sk-bal')?$('sk-bal').outerHTML:'';if(!v){o.innerHTML='$0.00 &nbsp;·&nbsp; '+bal;return;}try{let p=1;if(!ESTABLES[_moneda.s]){const oc=new ethers.Contract(ORACULO,ABI_ORAC,lector());p=Number(ethers.formatUnits(await oc.precioUSD(_moneda.a),18));}o.innerHTML=usd(v*p)+' &nbsp;·&nbsp; '+bal;}catch(_){}}
async function balance(){const e=$('sk-bal');if(!e||!cuenta())return;try{let bal;if(_moneda.a==='0x0000000000000000000000000000000000000000')bal=await lector().getBalance(cuenta());else{const t=new ethers.Contract(_moneda.a,ERC20,lector());bal=await t.balanceOf(cuenta());}e.textContent='Balance: '+num(ethers.formatUnits(bal,18),6);e.dataset.bal=ethers.formatUnits(bal,18);}catch(_){}}
async function max(){const e=$('sk-bal');if(e&&e.dataset.bal){$('sk-in').value=e.dataset.bal;refUSD();}}
function picker(){
  let p=$('sk-pick');if(!p){p=document.createElement('div');p.id='sk-pick';document.body.appendChild(p);}
  const prim=MONEDAS.filter(m=>PRIMARIOS.includes(m.s));
  const resto=MONEDAS.filter(m=>!PRIMARIOS.includes(m.s));
  const fila=(m)=>`<div class="it" data-s="${m.s}">${logoImg(m,30)}<b>${m.s}</b><span class="px" id="sk-px-${m.s}"></span></div>`;
  p.innerHTML=`<div class="bx"><h4>Select asset</h4><div class="list"><div class="grp">Popular</div>${prim.map(fila).join('')}<div class="grp">All assets</div>${resto.map(fila).join('')}</div></div>`;
  p.style.display='flex';p.onclick=(e)=>{if(e.target===p)p.style.display='none';};
  p.querySelectorAll('.it').forEach(el=>el.onclick=()=>{_moneda=MONEDAS.find(m=>m.s===el.dataset.s);p.style.display='none';body();});
  const oc=new ethers.Contract(ORACULO,ABI_ORAC,lector());
  MONEDAS.forEach(async m=>{try{const px=ESTABLES[m.s]?1:Number(ethers.formatUnits(await oc.precioUSD(m.a),18));const e=$('sk-px-'+m.s);if(e)e.textContent=usd(px);}catch(_){}});
}
async function stake(){
  if(!cuenta()){try{await wallet.conectar();}catch(_){}if(!cuenta())return;}
  const v=parseFloat(($('sk-in')||{}).value||'0');if(!v)return;
  const btn=$('sk-go');btn.disabled=true;btn.textContent='Confirm in your wallet…';
  try{
    const monto=ethers.parseUnits(String(v),18);const signer=await firmante();
    const esBNB=_moneda.a==='0x0000000000000000000000000000000000000000';
    if(!esBNB){const t=new ethers.Contract(_moneda.a,ERC20,signer);const alw=await t.allowance(cuenta(),STAKING);if(alw<monto){const tx=await t.approve(STAKING,monto);await tx.wait();}}
    const stk=new ethers.Contract(STAKING,ABI_STK,signer);
    const tx=await stk.stake(_moneda.a,monto,_plan.seg,_hold,esBNB?{value:monto}:{});
    btn.textContent='Processing…';await tx.wait();btn.textContent='Done';
    $('sk-in').value='';refUSD();pos();global();
    setTimeout(()=>{btn.disabled=false;btn.textContent='Stake';},2500);
  }catch(_){btn.disabled=false;btn.textContent='Stake';}
}
async function deps(){
  const c=$('sk-deps');if(!c)return;
  if(!cuenta()){c.innerHTML='<div class="empty">Connect your wallet to see your deposits.</div>';return;}
  try{
    const stk=new ethers.Contract(STAKING,ABI_STK,lector());const ds=await stk.depositosDe(cuenta());
    const vivos=ds.map((d,i)=>({d,i})).filter(x=>!x.d.retirado);
    if(!vivos.length){c.innerHTML='<div class="empty">No active deposits yet.</div>';return;}
    const ahora=Math.floor(Date.now()/1000);
    c.innerHTML=vivos.map(({d,i})=>{const m=MONEDAS.find(x=>x.a.toLowerCase()===d.token.toLowerCase());const venc=ahora>=Number(d.vence);const cant=ethers.formatUnits(d.monto,18);const f=new Date(Number(d.vence)*1000).toLocaleDateString();
      return `<div class="dep">${m?logoImg(m,32):logoImg({s:'?',cg:''},32)}<div class="i2"><b>${num(cant,6)} ${m?m.s:''}</b><span>${venc?'Available to withdraw':'Unlocks '+f}</span></div><button class="${venc?'rdy':''}" data-i="${i}" ${venc?'':'disabled'}>Unstake</button></div>`;
    }).join('');
    c.querySelectorAll('button[data-i]').forEach(bt=>bt.onclick=()=>unstake(+bt.dataset.i,bt));
  }catch(_){c.innerHTML='<div class="empty">Could not load your deposits right now.</div>';}
}
async function unstake(id,bt){bt.disabled=true;bt.textContent='Sign…';try{const stk=new ethers.Contract(STAKING,ABI_STK,await firmante());const tx=await stk.unstake(id);await tx.wait();deps();pos();}catch(_){bt.disabled=false;bt.textContent='Unstake';}}

async function global(){
  try{
    const p=new ethers.Contract(PANEL,ABI_PANEL,lector());const g=await p.global();
    const tvl=Number(ethers.formatUnits(g.tvlUSD,18));
    if($('sk-tvl'))$('sk-tvl').textContent=usd(tvl);
    if($('sk-users'))$('sk-users').textContent=Number(g.numStakers).toLocaleString('en-US');
    if($('sk-locked'))$('sk-locked').textContent=usd(tvl);
    if($('sk-apr'))$('sk-apr').textContent=tvl>0?'—':'New';
  }catch(_){['sk-tvl','sk-locked'].forEach(id=>{if($(id))$(id).textContent='$0.00';});if($('sk-users'))$('sk-users').textContent='0';if($('sk-apr'))$('sk-apr').textContent='New';}
}
async function pos(){
  const s=$('sk-pos');if(!s)return;
  if(!cuenta()){s.innerHTML=`<div class="hd"><h3>Your position</h3></div><div class="empty">Connect your wallet to see your position, rewards and capital breakdown.</div>`;return;}
  s.innerHTML=`<div class="hd"><h3>Your position</h3></div><div class="empty">Loading…</div>`;
  try{
    const p=new ethers.Contract(PANEL,ABI_PANEL,lector());
    const posn=await p.posicionUsuario(cuenta());const rec=await p.recompensasDe(cuenta());
    const real=Number(ethers.formatUnits(posn.pesoReal,18));
    const val=Number(ethers.formatUnits(posn.valorActualUSD,18));
    const pct=Number(posn.porcentaje)/1e4;
    const pend=rec.filter(r=>r.pendiente>0n);
    const pendUSD=pend.reduce((a,r)=>a+Number(ethers.formatUnits(r.pendiente,18)),0);
    s.innerHTML=`
      <div class="hd"><h3>Your position</h3></div>
      <div class="two"><div><div class="k">Total staked</div><div class="v mono">${usd(real)}</div></div><div style="text-align:right"><div class="k">Value now</div><div class="v g mono">${usd(val)}</div></div></div>
      <div class="rw"><div><div class="k">Accrued rewards</div><div class="v mono">${usd(pendUSD)}</div></div>${pend.length?`<button class="claim" id="sk-claim">Claim</button>`:''}</div>
      <div class="rw" style="border-top:0;padding-top:8px"><div class="k">Pool share</div><div class="v mono" style="font-size:13px">${pct.toFixed(4)}%</div></div>`;
    const cl=$('sk-claim');if(cl)cl.onclick=async()=>{cl.disabled=true;cl.textContent='Sign…';try{const stk=new ethers.Contract(STAKING,ABI_STK,await firmante());const tx=await stk.reclamarTodo();await tx.wait();pos();}catch(_){cl.disabled=false;cl.textContent='Claim';}};
  }catch(_){s.innerHTML=`<div class="hd"><h3>Your position</h3></div><div class="empty">Could not load your position right now.</div>`;}
}
function spark(){
  const el=$('sk-spark');if(!el)return;
  // línea de rendimiento (visual): suave tendencia al alza, dorada
  const pts=[8,18,14,26,22,34,30,46,42,58,54,68,64,78];
  const w=300,h=88,st=w/(pts.length-1);
  let d='M0,'+(h-pts[0]);pts.forEach((p,i)=>{d+=' L'+(i*st)+','+(h-p);});
  el.innerHTML=`<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8B84B" stop-opacity=".28"/><stop offset="1" stop-color="#E8B84B" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${w},${h} L0,${h} Z" fill="url(#sg)"/><path d="${d}" fill="none" stroke="#E8B84B" stroke-width="2" stroke-linejoin="round"/>`;
}

/*──────────── Overlay para web (hero/servicios) ────────────*/
export function abrirAportar(){
  estilos();
  const prev=$('sk-overlay');if(prev)prev.remove();
  const d=document.createElement('div');d.id='sk-overlay';
  d.style.cssText='position:fixed;inset:0;z-index:9600;background:#070b10;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(18px + env(safe-area-inset-top,0px)) 20px calc(40px + env(safe-area-inset-bottom,0px))';
  d.innerHTML='<div style="max-width:1180px;margin:0 auto"><div id="sk-mount"></div></div>';
  document.body.appendChild(d);
  montarAportar($('sk-mount'));
}
