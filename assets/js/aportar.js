/* ══════════════════════════════════════════════════════════════════════
   aportar.js. Staking. Layout de 2 columnas (72/28) que llena la pantalla,
   según el mockup del owner. Cabe sin scroll vertical en desktop.
   Izquierda: banner + stats + panel de stake. Derecha: posición + gráfica +
   actividad. En inglés. Sin sidebar/premium. Overlay a 100vw (no se colapsa).
   ══════════════════════════════════════════════════════════════════════ */

import * as ethers from './vendor/ethers-6.13.4.min.js?v=129';
import * as wallet from './wallet.js?v=129';

const STAKING='0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4';
const ORACULO='0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3';
const PANEL='0xE620D5BD60F70CCdFa4493F3a5B794d1BBEbf8d2';
const RPCS=['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc-dataseed1.ninicoin.io','https://rpc.ankr.com/bsc'];
const lector=()=>new ethers.JsonRpcProvider(RPCS[Math.floor(Math.random()*RPCS.length)],56,{staticNetwork:true});
async function firmante(){return new ethers.BrowserProvider(window.ethereum).getSigner();}

const ERC20=['function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)','function balanceOf(address) view returns (uint256)'];
const ABI_STK=['function stake(address token,uint256 monto,uint40 plazo,bool holdMoneda) returns (uint256)','function unstake(uint256 id)','function reclamarTodo()','function depositosDe(address) view returns (tuple(address token,uint256 monto,uint256 valorUSD,uint40 cuando,uint40 vence,bool holdMoneda,bool retirado)[])'];
const ABI_ORAC=['function precioUSD(address) view returns (uint256)'];
const ABI_PANEL=['function posicionUsuario(address) view returns (tuple(uint256 pesoReal,uint256 pesoAsignado,uint256 valorActualUSD,int256 gananciaValoriza,uint256 porcentaje,uint256 numDepositos,uint256 numActivos))','function recompensasDe(address) view returns (tuple(address token,string simbolo,uint256 pendiente)[])'];

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
const PLANES=[
  {seg:30*86400,n:'30D',apr:'12.8%',min:'50'},
  {seg:90*86400,n:'90D',apr:'16.4%',min:'100'},
  {seg:180*86400,n:'180D',apr:'20.7%',min:'500'},
  {seg:365*86400,n:'1Y',apr:'28.9%',min:'1,000',pop:true}
];

let _modo='stake',_moneda=MONEDAS[0],_plan=PLANES[3],_hold=true,_css=false;
let _ultCripto='BNB',_ultStable='USDT';
function _moneda_cripto(){return MONEDAS.find(m=>m.s===_ultCripto)||MONEDAS[0];}
function _moneda_stable(){return MONEDAS.find(m=>m.s===_ultStable)||MONEDAS.find(m=>m.s==='USDT');}
const _logo={};
const $=(id)=>document.getElementById(id);
const cuenta=()=>wallet.cuentaActual();
const usd=(n)=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const num=(n,d=4)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
const corta=(a)=>a?a.slice(0,6)+'…'+a.slice(-4):'';
function logoImg(m,sz){const u=_logo[m.cg];return u?`<img src="${u}" style="width:${sz}px;height:${sz}px;border-radius:50%" alt="">`:`<span style="width:${sz}px;height:${sz}px;border-radius:50%;background:#1a2129;display:grid;place-items:center;font-size:${Math.round(sz*0.36)}px;font-weight:700;color:#cfd6df">${m.s.slice(0,3)}</span>`;}
async function cargarLogos(){try{const r=await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${MONEDAS.map(m=>m.cg).join(',')}`);(await r.json()).forEach(c=>_logo[c.id]=c.image);}catch(_){}}

const IC={
  coins:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
  gift:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
  trend:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  pct:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>'
};

function estilos(){
  if(_css)return;_css=true;
  const s=document.createElement('style');s.textContent=`
  #sk,#sk *{box-sizing:border-box}
  #sk-overlay::backdrop{background:rgba(5,7,10,.4)}
  @media(max-width:820px){ #sk-overlay{background:rgba(5,7,10,.94) !important} }
  .sk-wrap{box-sizing:border-box;max-width:1320px;margin:0 auto;width:100%;padding:64px 20px 40px}
  @media(max-width:620px){ .sk-wrap{padding:58px 12px 34px} }
  #sk{max-width:920px;margin:0 auto;--card:#0e151ccc;--card2:#0b1118cc;--line:#202b37;--line2:#2c3946;--gold:#E8B84B;--goldd:#c79426;--ink:#f3f6fa;--ink2:#aab6c4;--ink3:#6b7684;--up:#34d399;--dn:#f87171;
    width:100%;color:var(--ink);font-feature-settings:'tnum'}
  #sk .mono{font-variant-numeric:tabular-nums}
  #sk .cols{display:flex;flex-direction:column;gap:14px}
  #sk .L{display:flex;flex-direction:column;gap:14px;min-width:0;max-width:100%}
  #sk .R{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;min-width:0;max-width:100%}
  @media(max-width:820px){ #sk .R{grid-template-columns:1fr} }
  #sk .banner{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:18px;padding:22px 24px;
    background:radial-gradient(120% 150% at 88% 40%, rgba(232,184,75,.18), transparent 55%), linear-gradient(120deg,#111a25dd,#0b111add)}
  #sk .banner .bgimg{position:absolute;right:0;top:0;bottom:0;width:52%;background-image:url('assets/portada/img/staking-coin.webp');background-size:cover;background-position:center;opacity:1;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 35%);mask-image:linear-gradient(90deg,transparent 0,#000 35%);pointer-events:none}
  @media(max-width:620px){ #sk .banner .bgimg{width:60%;opacity:.35} }
  #sk .banner .tag{position:absolute;left:0;top:22px;width:5px;height:40px;background:linear-gradient(180deg,#f7db8d,var(--gold));border-radius:3px}
  #sk .banner h1{font-family:var(--display,inherit);font-weight:800;font-size:30px;letter-spacing:-.03em;margin:0 0 5px}
  #sk .banner .lead{font-size:14px;color:var(--ink);font-weight:600;margin:0 0 6px}
  #sk .banner p{font-size:12.5px;color:var(--ink2);margin:0;max-width:520px;line-height:1.45}
  #sk .banner .pshort{display:none}
  @media(max-width:620px){ #sk .banner .plong{display:none} #sk .banner .pshort{display:block} }
  #sk .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  #sk .stat{max-width:100%;background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:14px;padding:14px}
  #sk .stat .h{display:flex;align-items:center;gap:9px;color:var(--ink2);font-size:12px;min-width:0}
  #sk .stat .h .sm{display:none}
  @media(max-width:620px){ #sk .stat .h .lg{display:none} #sk .stat .h .sm{display:inline} #sk .stat .h{font-size:11.5px;gap:7px} }
  #sk .stat .ic{width:30px;height:30px;border-radius:9px;background:rgba(232,184,75,.1);display:grid;place-items:center;color:var(--gold);flex:none}
  #sk .stat .v{font-size:19px;font-weight:800;margin-top:9px;letter-spacing:-.02em}
  #sk .stat .d{font-size:11px;color:var(--up);margin-top:3px}
  #sk .panel{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:18px;padding:18px;min-width:0}
  #sk .tabs{display:flex;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:4px;margin:0 auto 18px;max-width:320px}
  #sk .tabs button{flex:1;padding:9px;border:0;background:none;border-radius:9px;color:var(--ink3);font-weight:700;font-size:13px;cursor:pointer}
  #sk .tabs button.on{background:linear-gradient(180deg,#f7db8d,var(--gold) 60%,var(--goldd));color:#241900}
  #sk .lbl{font-size:11.5px;color:var(--ink3);margin:0 2px 7px}
  #sk .row2{display:grid;grid-template-columns:minmax(0,260px) minmax(0,1fr);gap:12px;margin-bottom:6px}
  #sk .row2>*{min-width:0}
  #sk .asset2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  #sk .a2{display:flex;align-items:center;gap:7px;background:var(--card2);border:1px solid var(--line2);border-radius:12px;padding:0 11px;min-height:46px;cursor:pointer;color:var(--ink)}
  #sk .a2.on{border-color:var(--gold)} #sk .a2 b{font-weight:700;font-size:14px} #sk .a2 .chev{margin-left:auto;color:var(--ink3);font-size:10px}
  #sk .sel{display:flex;align-items:center;gap:9px;background:var(--card2);border:1px solid var(--line2);border-radius:12px;padding:12px 13px;cursor:pointer}
  #sk .sel:hover{border-color:var(--gold)} #sk .sel b{font-weight:700;font-size:14px} #sk .sel .chev{margin-left:auto;color:var(--ink3);font-size:11px}
  #sk .amt{display:flex;align-items:center;gap:9px;background:var(--card2);border:1px solid var(--line2);border-radius:12px;padding:0 14px;min-width:0;min-height:46px}
  #sk .amt input{flex:1;min-width:0;width:100%;background:none;border:0;color:var(--ink);font-size:17px;font-weight:700;padding:0;outline:none;font-variant-numeric:tabular-nums}
  #sk .amt input::placeholder{color:var(--ink3)} #sk .amt .u{font-size:12px;color:var(--ink3)} #sk .amt .max{font-size:10px;font-weight:800;color:var(--gold);cursor:pointer}
  #sk .amtsub{display:flex;justify-content:space-between;align-items:center;margin:7px 2px 0;font-size:11px;color:var(--ink3)}
  #sk .avail{font-size:11.5px;color:var(--ink3);margin:0 2px 16px}
  #sk .plans{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}
  #sk .plan{position:relative;background:var(--card2);border:1px solid var(--line2);border-radius:12px;padding:14px 12px;cursor:pointer}
  #sk .plan.on{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
  #sk .plan .d{font-weight:800;font-size:15px} #sk .plan .apr{color:var(--gold);font-weight:800;font-size:18px;margin:7px 0 2px} #sk .plan .ap{font-size:9px;color:var(--ink3)} #sk .plan .mn{font-size:10px;color:var(--ink3);margin-top:7px}
  #sk .plan .pop{position:absolute;top:-8px;right:9px;background:var(--gold);color:#241900;font-size:9px;font-weight:800;padding:2px 7px;border-radius:6px}
  #sk .opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
  #sk .opt{background:var(--card2);border:1px solid var(--line2);border-radius:12px;padding:12px;cursor:pointer}
  #sk .opt.on{border-color:var(--gold);background:rgba(232,184,75,.05)}
  #sk .opt .t{display:flex;align-items:center;gap:8px} #sk .opt .dt{width:13px;height:13px;border-radius:50%;border:2px solid var(--line2);flex:none}
  #sk .opt.on .dt{border-color:var(--gold);background:radial-gradient(circle,var(--gold) 40%,transparent 46%)}
  #sk .opt b{font-size:12.5px} #sk .opt p{font-size:10.5px;color:var(--ink3);margin:5px 0 0;line-height:1.35}
  #sk .cta{width:100%;padding:15px;border:0;border-radius:13px;background:linear-gradient(180deg,#f7db8d,var(--gold) 60%,var(--goldd));color:#241900;font-weight:800;font-size:15px;cursor:pointer}
  #sk .cta:disabled{opacity:.55;cursor:default}
  #sk .box{max-width:100%;background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:16px;padding:18px;min-width:0}
  #sk .box .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px} #sk .box .hd h3{font-size:13px;font-weight:700;margin:0} #sk .box .hd .rng button{font-size:11px;color:var(--gold);background:none;border:1px solid var(--gold);border-radius:7px;padding:3px 8px}
  #sk .pos .two{display:flex;justify-content:space-between;gap:10px} #sk .pos .two .k{font-size:11px;color:var(--ink3)} #sk .pos .two .v{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums} #sk .pos .two .v.g{color:var(--up)}
  #sk .pos .rw{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)} #sk .pos .rw .k{font-size:11px;color:var(--ink3)} #sk .pos .rw .v{font-size:16px;font-weight:800;font-variant-numeric:tabular-nums}
  #sk .claim{background:none;border:1px solid var(--gold);color:var(--gold);border-radius:9px;padding:7px 14px;font-weight:700;font-size:12px;cursor:pointer} #sk .claim:disabled{opacity:.5}
  #sk svg.spark{width:100%;height:80px;display:block}
  #sk .waitp{text-align:center;color:var(--ink3);font-size:12px;padding:26px 0}
  #sk .mv{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)} #sk .mv:first-child{border-top:0}
  #sk .mv .mi{width:30px;height:30px;border-radius:8px;background:rgba(52,211,153,.1);color:var(--up);display:grid;place-items:center;flex:none}
  #sk .mv .mt{flex:1;min-width:0} #sk .mv .mt b{font-size:12px;display:block} #sk .mv .mt span{font-size:10px;color:var(--ink3)}
  #sk .mv .ma{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--up)}
  #sk .bnrtop{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  @media(max-width:620px){ #sk .bnrtop{flex-direction:column-reverse;align-items:flex-start;gap:10px} #sk .bnrtop .who{align-self:flex-start} }
  #sk .howbtn{background:linear-gradient(180deg,#f7db8d,var(--gold) 60%,var(--goldd));border:0;color:#241900;border-radius:10px;padding:8px 15px;font-size:12.5px;font-weight:800;cursor:pointer;box-shadow:0 2px 8px rgba(232,184,75,.25)}
  #sk .who{display:inline-flex;align-items:center;gap:7px;background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:7px 11px;font-size:12px;font-weight:600}
  #sk .who .dot{width:7px;height:7px;border-radius:50%;background:var(--up)}
  #sk .ibtn{width:15px;height:15px;border-radius:50%;border:1px solid rgba(150,165,180,.28);background:none;color:rgba(150,165,180,.45);font-size:9px;font-style:italic;font-weight:700;cursor:pointer;line-height:1;padding:0;margin-left:5px;vertical-align:middle;opacity:.7}
  #sk .ibtn:hover{border-color:var(--gold);color:var(--gold)}
  #sk-tip{margin:auto;padding:0;border:0;max-width:420px;width:calc(100vw - 36px);background:transparent}
  #sk-tip::backdrop{background:rgba(3,5,8,.72);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}
  #sk-tip .tbx{position:relative;background:#0e151c;border:1px solid #2c3946;border-radius:16px;padding:48px 22px 24px;max-height:80vh;overflow-y:auto}
  #sk-tip .tbx p{margin:0;font-size:13px;line-height:1.6;color:#d4dbe4}
  #sk-tip .tx{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid #2c3946;color:#aab6c4;cursor:pointer;z-index:2}
  #sk .how{grid-column:1/-1}
  #sk .howgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
  @media(max-width:820px){ #sk .howgrid{grid-template-columns:1fr} }
  #sk .hc b{display:block;font-size:13px;margin-bottom:6px} #sk .hc p{margin:0;font-size:11.5px;color:var(--ink2);line-height:1.5}
  #sk .empty{text-align:center;color:var(--ink3);font-size:12px;padding:18px 0}
  #sk .dep{display:flex;align-items:center;gap:11px;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:9px}
  #sk .dep .i2{flex:1;min-width:0} #sk .dep .i2 b{font-size:14px;font-variant-numeric:tabular-nums} #sk .dep .i2 span{display:block;font-size:10px;color:var(--ink3);margin-top:2px}
  #sk .dep button{padding:8px 14px;border:1px solid var(--line2);background:none;color:var(--ink);border-radius:9px;font-weight:700;font-size:12px;cursor:pointer} #sk .dep button.rdy{border-color:var(--gold);color:var(--gold)} #sk .dep button:disabled{opacity:.35}
  /* móvil: apila en 1 columna, stats 2x2 */

  @media(max-width:620px){ #sk .stats{grid-template-columns:repeat(2,minmax(0,1fr))} #sk .plans{grid-template-columns:repeat(2,minmax(0,1fr))} #sk .row2{grid-template-columns:minmax(0,1fr)} #sk .opts{grid-template-columns:1fr} #sk .banner h1{font-size:25px} }
  #sk-pick{margin:auto;padding:0;border:0;max-width:420px;width:calc(100vw - 40px);max-height:76vh;background:transparent;overflow:visible}
  #sk-pick::backdrop{background:rgba(3,5,8,.72);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}
  #sk-pick .bx{width:100%;max-width:420px;max-height:78vh;background:#0e151c;border:1px solid #2c3946;border-radius:16px;padding:16px;display:flex;flex-direction:column}
  #sk-pick h4{font-size:15px;margin:2px 2px 4px;color:#f3f6fa} #sk-pick .grp{font-size:10px;color:#6b7684;margin:11px 2px 3px;text-transform:uppercase;letter-spacing:.06em} #sk-pick .list{overflow-y:auto}
  #sk-pick .it{display:flex;align-items:center;gap:11px;padding:10px 8px;border-radius:10px;cursor:pointer;color:#f3f6fa} #sk-pick .it:hover{background:rgba(255,255,255,.04)}
  #sk-pick .it b{font-size:14px} #sk-pick .it .px{margin-left:auto;font-size:12px;color:#6b7684;font-variant-numeric:tabular-nums}
  `;
  document.head.appendChild(s);
}


const COMO_TEXTO = [
  '<b>How our staking works, and why your capital is safe</b>',
  '',
  'Most platforms pair two coins and pay you from trading fees on that pair. We work differently. Here your capital is the liquidity that powers our Futures market, and that is where the returns come from. Read this carefully, because it explains exactly where every dollar you earn comes from and why you can never lose your deposit.',
  '',
  '<b>What happens when you stake</b>',
  'You deposit any coin you want. It rests in a public, verified contract that only you control with your signature. No one on the platform can move it. When you withdraw at the end of your lock period, you receive the exact same coin and amount you put in, plus everything you earned.',
  '',
  '<b>How a trader uses your liquidity (LONG)</b>',
  'Imagine a trader opens a long position with 10 dollars at 100x leverage. That is 1,000 dollars of exposure. The platform borrows 1,000 dollars of liquidity from the pool and buys the coin at the entry price. That purchased coin is the backing of the position. If the price rises 1 percent, the position is worth 1,010 dollars: the 1,000 returns to the pool and the trader keeps 10 dollars of profit, which came from the market rising, not from anyone else. If the price falls, the trader loses their own 10 dollars first, and that loss tops up exactly what the loan lost, so the pool is made whole. When the loss reaches the trader margin, the position is liquidated and closed.',
  '',
  '<b>How a SHORT works</b>',
  'A short is the mirror image, and this is the key detail: a short is backed by the coin itself, not by USDT. The pool lends the coin and it is sold immediately at the entry price. If the price falls, the coin is bought back cheaper to return it to the pool, and the difference is the trader profit. If the price rises, the trader own margin covers the difference. Either way the pool gets its coin back in full. This is why the coins people stake decide what can be traded: to allow shorts of a coin, that coin must exist in the pool.',
  '',
  '<b>Why you never lose your capital</b>',
  'In both directions, a trader profit comes from the market moving, and a trader loss tops up the loan. Leverage is always kept proportional to the available liquidity, so a trader maximum loss can never exceed what the loan lost. Your principal is always returned whole, in the same coin.',
  '',
  '<b>How much you earn</b>',
  'Every position that opens and closes pays a fee, and while a position stays open it pays a funding fee. All of these are split fifty fifty between the people who provide liquidity and the platform. When a position is liquidated, seventy five percent tops up the liquidity used and the remaining twenty five percent is also split fifty fifty. On top of that, everyone who stakes receives twenty percent of everything the whole platform generates across every service, plus fifty percent of everything Futures generates. It is all shared in proportion to how much each person provides: someone who stakes one million earns a million times more than someone who stakes one dollar, to the cent.',
  '',
  '<b>And if the price of your coin moves</b>',
  'You choose how your capital rests. Keep it in your coin and you also gain if that coin rises in price (shown as price gain), or convert it to USDT to stay stable with no price risk. Your staking rewards are earned either way.'
].join('<br>');
const TIPS={
  asset:'Choose which coin you want to stake. The left button holds the main coins (BNB, BTC, ETH and more). The right button holds stablecoins (USDT, USDC, DAI). You can stake any of them.',
  amount:'Type how much you want to stake. Use MAX to stake your full wallet balance of the selected coin. Your balance is shown on the right.',
  keep:'Your capital stays in the coin you deposited. If that coin rises in price, you also gain from that rise. If it falls, your value in dollars falls too. You still earn your staking rewards on top.',
  convert:'Your value is fixed in USDT the moment you stake. It stays stable no matter what the market does, so you carry no price risk. You still earn your staking rewards, but you do not gain if the coin rises.',
  cap:'This is the total value you have staked, measured in US dollars at the moment you deposited. It is your share of the pool.',
  rew:'These are the rewards you have earned and can claim at any time. They grow as people use the platform. You can claim them without touching your staked capital.',
  y1:'An estimate of what your current stake could earn in one year at the recent level of activity. It is only a reference, not a promise. Real rewards depend on how much people trade.',

  hold:'Choose how your capital rests. "Keep in your coin": if you deposit BNB it stays BNB. you also gain if its price rises (and bear the risk if it falls). "Convert to USDT": your value is fixed in USDT. stable, no price risk, but you do not gain from price moves. Either way, you can only withdraw at the end of the lock period.',
  como:'Your liquidity backs the platform\'s trading. When someone trades futures with leverage, your funds are the counterpart that makes it possible. you never lose your capital, because a trader\'s profit comes from the market move, and a trader\'s loss tops up the loan. You earn from fees: on every open, close and funding the fee is split 50/50 with the platform; on a liquidation, 75% tops up the liquidity and the remaining 25% is split 50/50. In total, stakers receive 20% of everything the whole platform generates, plus 50% of everything futures generates. shared by how much you provide. Your coin is returned in the same coin you deposited.',
  apr:'The APR is an estimate based on recent activity, not a fixed promise. Real rewards depend on how much people trade. More activity means more rewards; quiet periods mean less.',
  plan:'Longer lock periods earn a higher estimated APR. Your funds stay locked until the period ends; you cannot withdraw before maturity.'
};
function tip(clave){
  const prev=document.getElementById('sk-tip');if(prev)prev.remove();
  const dg=document.createElement('dialog');dg.id='sk-tip';
  dg.innerHTML=`<div class="tbx"><button class="tx" aria-label="Close">✕</button><p>${TIPS[clave]||''}</p></div>`;
  document.body.appendChild(dg);
  if(dg.showModal)dg.showModal();else dg.setAttribute('open','');
  const cerrar=()=>{try{dg.close();}catch(_){}dg.remove();};
  dg.querySelector('.tx').onclick=cerrar;
  dg.addEventListener('click',(e)=>{if(e.target===dg)cerrar();});
  dg.addEventListener('cancel',(e)=>{e.preventDefault();cerrar();});
}
const iBtn=(clave)=>`<button class="ibtn" data-tip="${clave}" aria-label="Info" type="button">i</button>`;

export function montarAportar(cont){
  estilos();
  cont.innerHTML=`
  <div id="sk">
    <div class="cols">
      <div class="L">
        <div class="banner">
          <span class="tag"></span>
          <div class="bgimg"></div>
          <div class="bnrtop" style="justify-content:space-between;align-items:flex-start">
            <div>
              <h1>Staking</h1>
              <div class="lead">Lock your assets, earn passive income.</div>
              <p class="plong">Provide liquidity and earn a share of everything the platform generates. Your capital rests in the coin you choose and is returned in that same coin.</p><p class="pshort">Earn a share of all platform activity. Your capital stays in your coin.</p>
            </div>
            <div style="margin-left:auto;flex:none"><button class="howbtn" id="sk-howbtn">How it works</button></div>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><div class="h"><span class="ic">${IC.coins}</span>Your capital ${iBtn('cap')}</div><div class="v mono" id="sk-mycap">$0.00</div><div class="d">Staked by you</div></div>
          <div class="stat"><div class="h"><span class="ic">${IC.gift}</span><span class="lg">Accrued rewards</span><span class="sm">Rewards</span> ${iBtn('rew')}</div><div class="v mono" id="sk-myrew">$0.00</div><div class="d">Ready to claim</div></div>
          <div class="stat"><div class="h"><span class="ic">${IC.trend}</span><span class="lg">Est. in 1 year</span><span class="sm">Est. 1yr</span> ${iBtn('y1')}</div><div class="v mono" id="sk-my1y" style="font-size:13px;color:var(--ink3)">Waiting for data</div><div class="d">At current activity</div></div>
          <div class="stat"><div class="h"><span class="ic">${IC.pct}</span>Est. APR ${iBtn('apr')}</div><div class="v" id="sk-apr">Variable</div><div class="d">Based on activity</div></div>
        </div>
        <div class="panel">
          <div class="tabs"><button class="on" data-m="stake">Stake</button><button data-m="unstake">Unstake</button></div>
          <div id="sk-body"></div>
        </div>
      </div>
      <div class="R">
        <div class="box pos" id="sk-pos"></div>
        <div class="box"><div class="hd"><h3>Performance</h3><div class="rng"><button>30D</button></div></div><svg class="spark" id="sk-spark" viewBox="0 0 300 80" preserveAspectRatio="none"></svg></div>
        <div class="box"><div class="hd"><h3>Latest activity</h3></div><div id="sk-mvs"><div class="empty">No activity yet.</div></div></div>
      </div>
      
    </div>
  </div>`;
  cont.addEventListener('click',(e)=>{const ib=e.target.closest&&e.target.closest('.ibtn');if(ib){tip(ib.dataset.tip);}const hb=e.target.closest&&e.target.closest('#sk-howbtn');if(hb){tip('como');}});
  cont.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{_modo=b.dataset.m;cont.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));body();});
  body(); stats(); pos(); spark();
  cargarLogos().then(()=>{body();pos();});
  if(wallet.alCambiar) wallet.alCambiar(()=>{body();pos();stats();});
}

function body(){
  const b=$('sk-body');if(!b)return;
  if(_modo==='stake'){
    b.innerHTML=`
      <div class="row2">
        <div><div class="lbl">Asset ${iBtn('asset')}</div>
          <div class="asset2">
            <button class="a2 ${!ESTABLES[_moneda.s]?'on':''}" id="sk-a-cripto">${logoImg(_moneda_cripto(),20)}<b>${_moneda_cripto().s}</b><span class="chev">▼</span></button>
            <button class="a2 ${ESTABLES[_moneda.s]?'on':''}" id="sk-a-stable">${logoImg(_moneda_stable(),20)}<b>${_moneda_stable().s}</b><span class="chev">▼</span></button>
          </div>
        </div>
        <div><div class="lbl">Amount ${iBtn('amount')}</div><div class="amt"><input id="sk-in" inputmode="decimal" placeholder="0.00"><span class="max" id="sk-max">MAX</span></div><div class="amtsub"><span id="sk-usd">$0.00</span><span class="bal2" id="sk-bal">Balance: 0.00</span></div></div>
      </div>
      <div class="lbl">Lock plan ${iBtn('plan')}</div>
      <div class="plans">${PLANES.map((p,i)=>`<div class="plan${p===_plan?' on':''}" data-i="${i}">${p.pop?'<span class="pop">Popular</span>':''}<div class="d">${p.n}</div><div class="apr">${p.apr}</div><div class="ap">Est. APR</div><div class="mn">Min. ${p.min} ${_moneda.s}</div></div>`).join('')}</div>
      <div class="lbl">Hold your capital as ${iBtn('hold')}</div>
      <div class="opts">
        <div class="opt${_hold?' on':''}" data-h="1"><div class="t"><span class="dt"></span><b>Keep in ${_moneda.s}</b> ${iBtn('keep')}</div><p>You also gain if the price rises. You bear price risk if it falls.</p></div>
        <div class="opt${!_hold?' on':''}" data-h="0"><div class="t"><span class="dt"></span><b>Convert to USDT</b> ${iBtn('convert')}</div><p>Stable value, no price risk. You don't gain from price moves.</p></div>
      </div>
      <button class="cta" id="sk-go" disabled>Stake</button>`;
    $('sk-a-cripto').onclick=()=>picker('cripto');$('sk-a-stable').onclick=()=>picker('stable');$('sk-max').onclick=max;$('sk-in').oninput=()=>{refUSD();validarStake();};
    b.querySelectorAll('.plan').forEach(el=>el.onclick=()=>{_plan=PLANES[+el.dataset.i];b.querySelectorAll('.plan').forEach(x=>x.classList.remove('on'));el.classList.add('on');});
    b.querySelectorAll('.opt').forEach(el=>el.onclick=()=>{_hold=el.dataset.h==='1';b.querySelectorAll('.opt').forEach(x=>x.classList.remove('on'));el.classList.add('on');});
    $('sk-go').onclick=stake;balance().then(()=>validarStake());validarStake();
  } else {
    b.innerHTML=`<div class="tabs" style="visibility:hidden;height:0;margin:0;padding:0;border:0"></div><div id="sk-deps"><div class="empty">Loading…</div></div><div class="avail" style="margin:14px 2px 0;text-align:center">You can withdraw a deposit once its lock period ends. It is returned in the same coin, minus the withdrawal fee.</div>`;
    deps();
  }
}
async function refUSD(){const i=$('sk-in'),o=$('sk-usd');if(!i||!o)return;const v=parseFloat(i.value||'0');if(!v){o.textContent='$0.00';return;}try{let p=1;if(!ESTABLES[_moneda.s]){const oc=new ethers.Contract(ORACULO,ABI_ORAC,lector());p=Number(ethers.formatUnits(await oc.precioUSD(_moneda.a),18));}o.textContent=usd(v*p);}catch(_){}}
async function balance(){const e=$('sk-bal');if(!e||!cuenta())return;try{let bal;if(_moneda.a==='0x0000000000000000000000000000000000000000')bal=await lector().getBalance(cuenta());else{const t=new ethers.Contract(_moneda.a,ERC20,lector());bal=await t.balanceOf(cuenta());}e.textContent='Balance: '+num(ethers.formatUnits(bal,18),4);e.dataset.bal=ethers.formatUnits(bal,18);}catch(_){}}
async function max(){const e=$('sk-bal');if(e&&e.dataset.bal){$('sk-in').value=e.dataset.bal;refUSD();}}
function picker(grupo){
  const prev=$('sk-pick');if(prev)prev.remove();
  const dg=document.createElement('dialog');dg.id='sk-pick';
  // grupo 'stable' → USDT, USDC, DAI ; grupo 'cripto' → el resto
  const lista = grupo==='stable' ? MONEDAS.filter(m=>ESTABLES[m.s]) : MONEDAS.filter(m=>!ESTABLES[m.s]);
  const fila=(m)=>`<div class="it" data-s="${m.s}">${logoImg(m,28)}<b>${m.s}</b><span class="px" id="sk-px-${m.s}"></span></div>`;
  dg.innerHTML=`<div class="bx"><h4>${grupo==='stable'?'Stablecoins':'Select a coin'}</h4><div class="list">${lista.map(fila).join('')}</div></div>`;
  document.body.appendChild(dg);
  if(dg.showModal)dg.showModal();else dg.setAttribute('open','');
  const cerrar=()=>{try{dg.close();}catch(_){}dg.remove();};
  dg.addEventListener('click',(e)=>{if(e.target===dg)cerrar();});
  dg.addEventListener('cancel',(e)=>{e.preventDefault();cerrar();});
  dg.querySelectorAll('.it').forEach(el=>el.onclick=()=>{
    const m=MONEDAS.find(x=>x.s===el.dataset.s);_moneda=m;
    if(ESTABLES[m.s])_ultStable=m.s;else _ultCripto=m.s;
    cerrar();body();
  });
  const oc=new ethers.Contract(ORACULO,ABI_ORAC,lector());
  lista.forEach(async m=>{try{const px=ESTABLES[m.s]?1:Number(ethers.formatUnits(await oc.precioUSD(m.a),18));const e=$('sk-px-'+m.s);if(e)e.textContent=usd(px);}catch(_){}});
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
    $('sk-in').value='';refUSD();pos();stats();
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
      return `<div class="dep">${m?logoImg(m,30):logoImg({s:'?',cg:''},30)}<div class="i2"><b>${num(cant,6)} ${m?m.s:''}</b><span>${venc?'Available to withdraw':'Unlocks '+f}</span></div><button class="${venc?'rdy':''}" data-i="${i}" ${venc?'':'disabled'}>Unstake</button></div>`;
    }).join('');
    c.querySelectorAll('button[data-i]').forEach(bt=>bt.onclick=()=>unstake(+bt.dataset.i,bt));
  }catch(_){c.innerHTML='<div class="empty">Could not load your deposits right now.</div>';}
}
async function unstake(id,bt){bt.disabled=true;bt.textContent='Sign…';try{const stk=new ethers.Contract(STAKING,ABI_STK,await firmante());const tx=await stk.unstake(id);await tx.wait();deps();pos();stats();}catch(_){bt.disabled=false;bt.textContent='Unstake';}}

async function stats(){
  if(!cuenta()){['sk-mycap','sk-myrew'].forEach(id=>{if($(id))$(id).textContent='$0.00';});if($('sk-my1y'))$('sk-my1y').textContent='Waiting for data';return;}
  try{
    const p=new ethers.Contract(PANEL,ABI_PANEL,lector());
    const posn=await p.posicionUsuario(cuenta());const rec=await p.recompensasDe(cuenta());
    const real=Number(ethers.formatUnits(posn.pesoReal,18));
    const rew=rec.filter(r=>r.pendiente>0n).reduce((a,r)=>a+Number(ethers.formatUnits(r.pendiente,18)),0);
    if($('sk-mycap'))$('sk-mycap').textContent=usd(real);
    if($('sk-myrew'))$('sk-myrew').textContent=usd(rew);
    if($('sk-my1y'))$('sk-my1y').textContent='Waiting for data';
  }catch(_){}
}
async function pos(){
  const s=$('sk-pos');if(!s)return;
  if(!cuenta()){s.innerHTML=`<div class="hd"><h3>Your position</h3></div><div class="empty">Connect your wallet to see your position, rewards and capital breakdown.</div>`;return;}
  s.innerHTML=`<div class="hd"><h3>Your position</h3></div><div class="empty">Loading…</div>`;
  try{
    const p=new ethers.Contract(PANEL,ABI_PANEL,lector());
    const posn=await p.posicionUsuario(cuenta());const rec=await p.recompensasDe(cuenta());
    const real=Number(ethers.formatUnits(posn.pesoReal,18));const val=Number(ethers.formatUnits(posn.valorActualUSD,18));const pct=Number(posn.porcentaje)/1e4;
    const pend=rec.filter(r=>r.pendiente>0n);const pendUSD=pend.reduce((a,r)=>a+Number(ethers.formatUnits(r.pendiente,18)),0);
    s.innerHTML=`
      <div class="hd"><h3>Your position</h3></div>
      <div class="two"><div><div class="k">Your stake</div><div class="v mono">${usd(real)}</div></div><div style="text-align:right"><div class="k">Value now</div><div class="v g mono">${usd(val)}</div></div></div>
      <div class="rw"><div><div class="k">Accrued rewards</div><div class="v mono">${usd(pendUSD)}</div></div>${pend.length?`<button class="claim" id="sk-claim">Claim</button>`:''}</div>
      <div class="rw" style="border-top:0;padding-top:6px"><div class="k">Pool share</div><div class="v mono" style="font-size:13px">${pct.toFixed(4)}%</div></div>`;
    const cl=$('sk-claim');if(cl)cl.onclick=async()=>{cl.disabled=true;cl.textContent='Sign…';try{const stk=new ethers.Contract(STAKING,ABI_STK,await firmante());const tx=await stk.reclamarTodo();await tx.wait();pos();stats();}catch(_){cl.disabled=false;cl.textContent='Claim';}};
  }catch(_){s.innerHTML=`<div class="hd"><h3>Your position</h3></div><div class="empty">Could not load your position right now.</div>`;}
}
function spark(){
  // Sin datos reales todavía: mostrar estado de espera, no una gráfica inventada.
  const el=$('sk-spark');if(!el)return;
  const cont=el.parentElement;
  if(cont){ const svg=cont.querySelector('svg'); if(svg) svg.remove();
    if(!cont.querySelector('.waitp')){ const d=document.createElement('div'); d.className='waitp'; d.textContent='Waiting for your account data'; cont.appendChild(d); } }
}

/*──────────── Overlay a 100vw (no colapsa dentro de contenedores) ────────────*/

function validarStake(){
  const btn=$('sk-go');if(!btn)return;
  const v=parseFloat(($('sk-in')||{}).value||'0');
  const balEl=$('sk-bal');const bal=balEl&&balEl.dataset.bal?parseFloat(balEl.dataset.bal):0;
  const ok = v>0 && (!cuenta()||v<=bal);
  btn.disabled=!ok;
}

export function abrirAportar(){
  estilos();
  const prev=document.getElementById('sk-overlay');if(prev)prev.remove();
  // <dialog> con showModal() escapa a nivel de ventana SIEMPRE, aunque un
  // ancestro tenga transform/filter (que atraparía a un position:fixed normal).
  const dg=document.createElement('dialog');dg.id='sk-overlay';
  dg.style.cssText='margin:0;padding:0;border:0;max-width:100vw;max-height:100vh;width:100vw;height:100vh;background:rgba(5,7,10,.55);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;color:inherit';
  dg.innerHTML=`<button id="sk-x" aria-label="Close" style="position:fixed;top:16px;right:18px;z-index:2;width:38px;height:38px;border-radius:11px;background:rgba(14,21,28,.9);border:1px solid #202b37;color:#aab6c4;font-size:16px;cursor:pointer">✕</button><div class="sk-wrap"><div id="sk-mount" style="width:100%"></div></div>`;
  document.body.appendChild(dg);
  if(dg.showModal) dg.showModal(); else dg.setAttribute('open','');
  const cerrar=()=>{ try{dg.close();}catch(_){} dg.remove(); };
  document.getElementById('sk-x').onclick=cerrar;
  dg.addEventListener('cancel',(e)=>{e.preventDefault();cerrar();}); // ESC cierra
  montarAportar(document.getElementById('sk-mount'));
}
