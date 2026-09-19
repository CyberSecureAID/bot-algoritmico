/* ══════════════════════════════════════════════════════════════════════
   aportar.js — Staking (web). Rediseño institucional.
   Look: dark, cifras grandes primero (estilo Lido/Aave/GMX), monospace en
   números, acentos dorados, tarjetas espaciadas. Todo en inglés (el sistema
   de idioma traduce a español si el usuario lo elige). Conectado a los
   contratos reales. Sin símbolos de código a la vista.
   ══════════════════════════════════════════════════════════════════════ */

import * as ethers from './vendor/ethers-6.13.4.min.js?v=127';
import * as wallet from './wallet.js?v=127';

const STAKING = '0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4';
const ORACULO = '0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3';
const PANEL   = '0xE620D5BD60F70CCdFa4493F3a5B794d1BBEbf8d2';

const RPCS = ['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc-dataseed1.ninicoin.io','https://rpc.ankr.com/bsc'];
const lector = () => new ethers.JsonRpcProvider(RPCS[Math.floor(Math.random()*RPCS.length)], 56, { staticNetwork: true });
async function firmante() { return new ethers.BrowserProvider(window.ethereum).getSigner(); }

const ERC20 = ['function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)','function balanceOf(address) view returns (uint256)'];
const ABI_STK = [
  'function stake(address token,uint256 monto,uint40 plazo,bool holdMoneda) returns (uint256)',
  'function unstake(uint256 id)','function reclamarTodo()',
  'function depositosDe(address) view returns (tuple(address token,uint256 monto,uint256 valorUSD,uint40 cuando,uint40 vence,bool holdMoneda,bool retirado)[])'
];
const ABI_ORAC = ['function precioUSD(address) view returns (uint256)'];
const ABI_PANEL = [
  'function posicionUsuario(address) view returns (tuple(uint256 pesoReal,uint256 pesoAsignado,uint256 valorActualUSD,int256 gananciaValoriza,uint256 porcentaje,uint256 numDepositos,uint256 numActivos))',
  'function capitalDeUsuario(address) view returns (tuple(address token,string simbolo,uint8 decimales,uint256 total,uint256 enUso,uint256 disponible,uint256 valorUSD)[])',
  'function recompensasDe(address) view returns (tuple(address token,string simbolo,uint256 pendiente)[])',
  'function global() view returns (tuple(uint256 tvlUSD,uint256 realUSD,uint256 asignadoUSD,uint256 numStakers))'
];

const MONEDAS = [
  { s:'USDT', a:'0x55d398326f99059fF775485246999027B3197955', cg:'tether' },
  { s:'BTCB', a:'0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', cg:'bitcoin' },
  { s:'ETH',  a:'0x2170Ed0880ac9A755fd29B2688956BD959F933F8', cg:'ethereum' },
  { s:'BNB',  a:'0x0000000000000000000000000000000000000000', cg:'binancecoin' },
  { s:'USDC', a:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', cg:'usd-coin' },
  { s:'XRP',  a:'0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', cg:'ripple' },
  { s:'DOGE', a:'0xbA2aE424d960c26247Dd6c32edC70B295c744C43', cg:'dogecoin' },
  { s:'CAKE', a:'0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', cg:'pancakeswap-token' },
  { s:'LINK', a:'0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', cg:'chainlink' },
  { s:'DOT',  a:'0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', cg:'polkadot' },
  { s:'TRX',  a:'0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3', cg:'tron' },
  { s:'ADA',  a:'0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', cg:'cardano' },
  { s:'AVAX', a:'0x1CE0c2827e2eF14D5C4f29a091d735A204794041', cg:'avalanche-2' },
  { s:'LTC',  a:'0x4338665CBB7B2485A8855A139b75D5e34AB0DB94', cg:'litecoin' },
  { s:'BCH',  a:'0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf', cg:'bitcoin-cash' },
  { s:'ATOM', a:'0x0Eb3a705fc54725037CC9e008bDede697f62F335', cg:'cosmos' },
  { s:'FIL',  a:'0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153', cg:'filecoin' },
  { s:'NEAR', a:'0x1Fa4a73a3F0133f0025378af00236f3aBDEE5D63', cg:'near' },
  { s:'UNI',  a:'0xBf5140A22578168FD562DCcF235E5D43A02ce9B1', cg:'uniswap' },
  { s:'AAVE', a:'0xfb6115445Bff7b52FeB98650C87f44907E58f802', cg:'aave' },
  { s:'XVS',  a:'0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63', cg:'venus' },
  { s:'INJ',  a:'0xa2B726B1145A4773F68593CF171187d8EBe4d495', cg:'injective-protocol' },
  { s:'SXP',  a:'0x47BEAd2563dCBf3bF2c9407fEa4dC236fAbA485A', cg:'swipe' },
  { s:'YFI',  a:'0x88f1A5ae2A3BF98AEAF342D26B30a79438c9142e', cg:'yearn-finance' },
  { s:'ALPHA',a:'0xa1faa113cbE53436Df28FF0aEe54275c13B40975', cg:'alpha-finance' },
  { s:'FLOKI',a:'0xfb5B838b6cfEEdC2873aB27866079AC55363D37E', cg:'floki' },
  { s:'BabyDoge', a:'0xc748673057861a797275CD8A068AbB95A902e8de', cg:'baby-doge-coin' },
  { s:'DAI',  a:'0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', cg:'dai' },
  { s:'XTZ',  a:'0x16939ef78684453bfDFb47825F8a5F714f12623a', cg:'tezos' },
  { s:'BAT',  a:'0x101d82428437127bF1608F699CD651e6Abf9766E', cg:'basic-attention-token' }
];
const ESTABLES = { USDT:1, USDC:1, DAI:1 };
const PLAZOS = [
  { seg:30*86400,  n:'30D',  full:'30 days' },
  { seg:90*86400,  n:'90D',  full:'90 days' },
  { seg:180*86400, n:'180D', full:'180 days' },
  { seg:365*86400, n:'1Y',   full:'1 year' }
];

let _modo='stake', _moneda=MONEDAS[0], _plazo=PLAZOS[0], _hold=true, _css=false;
const _logo={};
const $=(id)=>document.getElementById(id);
const cuenta=()=>wallet.cuentaActual();
const usd=(n)=>'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const num=(n,d=4)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
function logoImg(m,sz){ const u=_logo[m.cg]; return u?`<img src="${u}" style="width:${sz}px;height:${sz}px;border-radius:50%" alt="">`:`<span style="width:${sz}px;height:${sz}px;border-radius:50%;background:#1a2129;display:grid;place-items:center;font-size:${sz*0.4}px;font-weight:700;color:#cfd6df">${m.s.slice(0,3)}</span>`; }
async function cargarLogos(){ try{ const r=await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${MONEDAS.map(m=>m.cg).join(',')}`); (await r.json()).forEach(c=>_logo[c.id]=c.image); }catch(_){}}

function estilos(){
  if(_css) return; _css=true;
  const s=document.createElement('style'); s.textContent=`
  #st{--bg:#05070a;--card:#0c1116;--card2:#0a0e13;--line:#1c232c;--line2:#2a323d;--gold:#E8B84B;--ink:#eef1f6;--ink2:#aeb8c4;--ink3:#6b7684;--up:#34d399;--dn:#f87171;
    max-width:1080px;margin:0 auto;padding:8px 0 60px;color:var(--ink);font-feature-settings:'tnum'}
  #st .mono{font-variant-numeric:tabular-nums;font-family:ui-monospace,'SF Mono',Menlo,monospace}
  #st .hero{margin-bottom:22px}
  #st .hero h1{font-family:var(--display,inherit);font-weight:800;font-size:30px;letter-spacing:-.03em;margin:0}
  #st .hero p{color:var(--ink2);font-size:14px;margin:6px 0 0;max-width:560px;line-height:1.5}
  #st .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
  @media(max-width:720px){#st .stats{grid-template-columns:repeat(2,1fr)}}
  #st .stat{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:16px;padding:18px}
  #st .stat .lbl{font-size:11px;color:var(--ink3);text-transform:uppercase;letter-spacing:.08em}
  #st .stat .val{font-size:26px;font-weight:800;margin-top:8px;letter-spacing:-.02em}
  #st .stat .val.gold{color:var(--gold)}
  #st .stat .sub{font-size:11px;color:var(--ink3);margin-top:3px}
  #st .cols{display:grid;grid-template-columns:1fr 380px;gap:18px;align-items:start}
  @media(max-width:900px){#st .cols{grid-template-columns:1fr}}
  #st .panel{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:20px;padding:22px}
  #st .tabs{display:inline-flex;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:4px;margin-bottom:22px}
  #st .tabs button{padding:9px 22px;border:0;background:none;border-radius:9px;color:var(--ink3);font-weight:700;font-size:14px;cursor:pointer;transition:.15s}
  #st .tabs button.on{background:var(--gold);color:#0a0e13}
  #st .field{margin-bottom:18px}
  #st .field .top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
  #st .field .top .l{font-size:12px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em}
  #st .field .top .r{font-size:12px;color:var(--ink3)}
  #st .selrow{display:flex;gap:12px}
  #st .sel{flex:none;display:flex;align-items:center;gap:9px;background:var(--card2);border:1px solid var(--line2);border-radius:14px;padding:0 16px;cursor:pointer;transition:.15s}
  #st .sel:hover{border-color:var(--gold)}
  #st .sel b{font-weight:700;font-size:16px}
  #st .sel .chev{color:var(--ink3);font-size:11px}
  #st .amtbox{flex:1;min-width:0;display:flex;align-items:center;gap:10px;background:var(--card2);border:1px solid var(--line2);border-radius:14px;padding:0 16px}
  #st .amtbox input{flex:1;min-width:0;background:none;border:0;color:var(--ink);font-size:28px;font-weight:700;padding:16px 0;outline:none;font-variant-numeric:tabular-nums}
  #st .amtbox input::placeholder{color:var(--ink3)}
  #st .amtbox .max{font-size:11px;font-weight:800;color:var(--gold);cursor:pointer;letter-spacing:.05em}
  #st .valline{display:flex;justify-content:space-between;margin-top:9px;font-size:13px}
  #st .valline .v{color:var(--ink2);font-variant-numeric:tabular-nums}
  #st .valline .bal{color:var(--ink3)}
  #st .segs{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  #st .seg{background:var(--card2);border:1px solid var(--line2);border-radius:12px;padding:13px 6px;text-align:center;cursor:pointer;transition:.15s}
  #st .seg:hover{border-color:var(--line2)}
  #st .seg.on{border-color:var(--gold);background:rgba(232,184,75,.08)}
  #st .seg b{display:block;font-weight:800;font-size:15px}
  #st .seg span{display:block;font-size:10px;color:var(--ink3);margin-top:3px}
  #st .opts{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  #st .opt{background:var(--card2);border:1px solid var(--line2);border-radius:14px;padding:14px;cursor:pointer;transition:.15s}
  #st .opt.on{border-color:var(--gold);background:rgba(232,184,75,.06)}
  #st .opt .h{display:flex;align-items:center;gap:8px} #st .opt .dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--line2);flex:none}
  #st .opt.on .dot{border-color:var(--gold);background:radial-gradient(circle,var(--gold) 40%,transparent 46%)}
  #st .opt b{font-size:13px;font-weight:700} #st .opt p{font-size:11px;color:var(--ink3);margin:6px 0 0;line-height:1.45}
  #st .cta{width:100%;padding:17px;border:0;border-radius:14px;background:var(--gold);color:#0a0e13;font-weight:800;font-size:16px;cursor:pointer;margin-top:22px;transition:.15s}
  #st .cta:hover{filter:brightness(1.06)} #st .cta:disabled{opacity:.5;cursor:default}
  #st .side .box{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:18px;padding:20px;margin-bottom:14px}
  #st .side h3{font-size:13px;color:var(--ink3);text-transform:uppercase;letter-spacing:.07em;margin:0 0 16px}
  #st .side .big{font-size:30px;font-weight:800;letter-spacing:-.02em}
  #st .side .r{display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line)}
  #st .side .r .k{font-size:13px;color:var(--ink2)} #st .side .r .v{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}
  #st .side .v.up{color:var(--up)} #st .side .v.dn{color:var(--dn)}
  #st .bar{height:8px;border-radius:5px;background:rgba(255,255,255,.05);overflow:hidden;margin:14px 0 8px}
  #st .bar i{display:block;height:100%;background:linear-gradient(90deg,#f7db8d,var(--gold))}
  #st .barlbl{display:flex;justify-content:space-between;font-size:11px;color:var(--ink3)}
  #st .side .cta{margin-top:16px;padding:13px;font-size:14px}
  #st .info{background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:16px;margin-top:16px}
  #st .info .row{display:flex;gap:12px;padding:9px 0}
  #st .info .n{width:22px;height:22px;flex:none;border-radius:6px;background:rgba(232,184,75,.12);color:var(--gold);display:grid;place-items:center;font-size:11px;font-weight:800}
  #st .info b{display:block;font-size:12.5px} #st .info p{margin:2px 0 0;font-size:11.5px;color:var(--ink3);line-height:1.4}
  #st .note{font-size:11px;color:var(--ink3);margin-top:14px;line-height:1.5;text-align:center}
  #st .dep{display:flex;align-items:center;gap:12px;background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:10px}
  #st .dep .info2{flex:1;min-width:0} #st .dep .info2 b{font-size:15px;font-variant-numeric:tabular-nums} #st .dep .info2 span{display:block;font-size:11px;color:var(--ink3);margin-top:2px}
  #st .dep button{padding:9px 16px;border:1px solid var(--line2);background:none;color:var(--ink);border-radius:10px;font-weight:700;font-size:13px;cursor:pointer}
  #st .dep button:disabled{opacity:.35;cursor:default} #st .dep button.rdy{border-color:var(--gold);color:var(--gold)}
  #st .empty{text-align:center;color:var(--ink3);font-size:13px;padding:26px 0}
  #st-pick{position:fixed;inset:0;z-index:9700;display:none;align-items:center;justify-content:center;background:rgba(3,5,8,.8);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);padding:18px}
  #st-pick .box{width:100%;max-width:420px;max-height:78vh;background:#0c1116;border:1px solid var(--line2,#2a323d);border-radius:18px;padding:16px;display:flex;flex-direction:column}
  #st-pick h4{font-size:16px;margin:2px 2px 14px} #st-pick .list{overflow-y:auto}
  #st-pick .it{display:flex;align-items:center;gap:12px;padding:12px 8px;border-radius:12px;cursor:pointer}
  #st-pick .it:hover{background:rgba(255,255,255,.04)} #st-pick .it b{font-size:15px} #st-pick .it .px{margin-left:auto;font-size:13px;color:#6b7684;font-variant-numeric:tabular-nums}
  `;
  document.head.appendChild(s);
}

export function montarAportar(cont){
  estilos();
  cont.innerHTML=`
  <div id="st">
    <div class="hero">
      <h1>Staking</h1>
      <p>Provide liquidity and earn a share of everything the platform generates. Your capital rests in the coin you choose and is returned in that same coin.</p>
    </div>
    <div class="stats">
      <div class="stat"><div class="lbl">Est. APR</div><div class="val gold" id="st-apr">—</div><div class="sub">Variable, based on activity</div></div>
      <div class="stat"><div class="lbl">Total value locked</div><div class="val mono" id="st-tvl">—</div><div class="sub" id="st-tvls">—</div></div>
      <div class="stat"><div class="lbl">Your position</div><div class="val mono" id="st-mypos">—</div><div class="sub" id="st-mysub">Not connected</div></div>
      <div class="stat"><div class="lbl">Stakers</div><div class="val mono" id="st-nst">—</div><div class="sub">Active providers</div></div>
    </div>
    <div class="cols">
      <div class="panel">
        <div class="tabs"><button class="on" data-m="stake">Stake</button><button data-m="unstake">Unstake</button></div>
        <div id="st-body"></div>
      </div>
      <div class="side" id="st-side"></div>
    </div>
  </div>`;
  cont.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{_modo=b.dataset.m;cont.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));body();});
  body(); side(); global();
  cargarLogos().then(()=>{body();});
  if(wallet.alCambiar) wallet.alCambiar(()=>{body();side();});
}

function body(){
  const b=$('st-body'); if(!b) return;
  if(_modo==='stake'){
    b.innerHTML=`
      <div class="field">
        <div class="top"><span class="l">Amount</span><span class="r" id="st-bal"></span></div>
        <div class="selrow">
          <div class="sel" id="st-sel">${logoImg(_moneda,24)}<b>${_moneda.s}</b><span class="chev">▼</span></div>
          <div class="amtbox"><input id="st-in" inputmode="decimal" placeholder="0.00"><span class="max" id="st-max">MAX</span></div>
        </div>
        <div class="valline"><span class="v" id="st-usd">$0.00</span></div>
      </div>
      <div class="field">
        <div class="top"><span class="l">Lock period</span></div>
        <div class="segs">${PLAZOS.map((p,i)=>`<div class="seg${p===_plazo?' on':''}" data-i="${i}"><b>${p.n}</b><span>locked</span></div>`).join('')}</div>
      </div>
      <div class="field">
        <div class="top"><span class="l">Hold your capital as</span></div>
        <div class="opts">
          <div class="opt${_hold?' on':''}" data-h="1"><div class="h"><span class="dot"></span><b>Keep in ${_moneda.s}</b></div><p>You also gain if the price rises. You bear price risk if it falls.</p></div>
          <div class="opt${!_hold?' on':''}" data-h="0"><div class="h"><span class="dot"></span><b>Convert to USDT</b></div><p>Stable value, no price risk. You don't gain from price moves.</p></div>
        </div>
      </div>
      <button class="cta" id="st-go">Stake ${_moneda.s}</button>
      <div class="info">
        <div class="row"><span class="n">1</span><div><b>Your capital stays yours</b><p>It sits in a public contract only you control. No one on the platform can touch it.</p></div></div>
        <div class="row"><span class="n">2</span><div><b>Your liquidity backs the trades</b><p>When someone trades with leverage, your liquidity is the backstop. You earn part of their fees.</p></div></div>
        <div class="row"><span class="n">3</span><div><b>You earn 20% of the platform and 50% of futures</b><p>Split by how much you provide. Withdraw at maturity in your same coin.</p></div></div>
      </div>
      <div class="note">Rewards are variable and depend on trading activity. Your deposit is locked for the chosen period. Only stake what you can lock up.</div>`;
    $('st-sel').onclick=picker; $('st-max').onclick=max; $('st-in').oninput=refUSD;
    b.querySelectorAll('.seg').forEach(el=>el.onclick=()=>{_plazo=PLAZOS[+el.dataset.i];b.querySelectorAll('.seg').forEach(x=>x.classList.remove('on'));el.classList.add('on');});
    b.querySelectorAll('.opt').forEach(el=>el.onclick=()=>{_hold=el.dataset.h==='1';b.querySelectorAll('.opt').forEach(x=>x.classList.remove('on'));el.classList.add('on');});
    $('st-go').onclick=stake; balance();
  } else {
    b.innerHTML=`<div id="st-deps"><div class="empty">Loading…</div></div>
      <div class="note" style="text-align:left;margin-top:8px">You can only withdraw a deposit once its lock period has ended. It is returned in the same coin you deposited, minus the withdrawal fee.</div>`;
    deps();
  }
}

async function refUSD(){ const i=$('st-in'),o=$('st-usd'); if(!i||!o)return; const v=parseFloat(i.value||'0'); if(!v){o.textContent='$0.00';return;} try{ if(ESTABLES[_moneda.s]){o.textContent=usd(v);return;} const oc=new ethers.Contract(ORACULO,ABI_ORAC,lector()); const px=await oc.precioUSD(_moneda.a); o.textContent=usd(v*Number(ethers.formatUnits(px,18))); }catch(_){o.textContent='—';} }
async function balance(){ const e=$('st-bal'); if(!e||!cuenta())return; try{ let bal; if(_moneda.a==='0x0000000000000000000000000000000000000000') bal=await lector().getBalance(cuenta()); else { const t=new ethers.Contract(_moneda.a,ERC20,lector()); bal=await t.balanceOf(cuenta()); } e.textContent='Balance: '+num(ethers.formatUnits(bal,18),6)+' '+_moneda.s; e.dataset.bal=ethers.formatUnits(bal,18); }catch(_){}}
async function max(){ const e=$('st-bal'); if(e&&e.dataset.bal){ $('st-in').value=e.dataset.bal; refUSD(); } }
function picker(){
  let p=$('st-pick'); if(!p){p=document.createElement('div');p.id='st-pick';document.body.appendChild(p);}
  p.innerHTML=`<div class="box"><h4>Select a coin</h4><div class="list">${MONEDAS.map(m=>`<div class="it" data-s="${m.s}">${logoImg(m,30)}<b>${m.s}</b><span class="px" id="pk-${m.s}"></span></div>`).join('')}</div></div>`;
  p.style.display='flex'; p.onclick=(e)=>{if(e.target===p)p.style.display='none';};
  p.querySelectorAll('.it').forEach(el=>el.onclick=()=>{_moneda=MONEDAS.find(m=>m.s===el.dataset.s);p.style.display='none';body();});
  const oc=new ethers.Contract(ORACULO,ABI_ORAC,lector());
  MONEDAS.forEach(async m=>{ try{ const px=ESTABLES[m.s]?1:Number(ethers.formatUnits(await oc.precioUSD(m.a),18)); const e=$('pk-'+m.s); if(e)e.textContent=usd(px); }catch(_){}});
}
async function stake(){
  if(!cuenta()){try{await wallet.conectar();}catch(_){}if(!cuenta())return;}
  const v=parseFloat(($('st-in')||{}).value||'0'); if(!v)return;
  const btn=$('st-go'); btn.disabled=true; btn.textContent='Confirm in your wallet…';
  try{
    const monto=ethers.parseUnits(String(v),18); const signer=await firmante();
    const esBNB=_moneda.a==='0x0000000000000000000000000000000000000000';
    if(!esBNB){ const t=new ethers.Contract(_moneda.a,ERC20,signer); const alw=await t.allowance(cuenta(),STAKING); if(alw<monto){const tx=await t.approve(STAKING,monto);await tx.wait();} }
    const stk=new ethers.Contract(STAKING,ABI_STK,signer);
    const tx=await stk.stake(_moneda.a,monto,_plazo.seg,_hold, esBNB?{value:monto}:{});
    btn.textContent='Processing…'; await tx.wait(); btn.textContent='Done';
    $('st-in').value=''; refUSD(); side(); global();
    setTimeout(()=>{btn.disabled=false;btn.textContent='Stake '+_moneda.s;},2500);
  }catch(_){ btn.disabled=false; btn.textContent='Stake '+_moneda.s; }
}
async function deps(){
  const c=$('st-deps'); if(!c)return;
  if(!cuenta()){c.innerHTML='<div class="empty">Connect your wallet to see your deposits.</div>';return;}
  try{
    const stk=new ethers.Contract(STAKING,ABI_STK,lector()); const ds=await stk.depositosDe(cuenta());
    const vivos=ds.map((d,i)=>({d,i})).filter(x=>!x.d.retirado);
    if(!vivos.length){c.innerHTML='<div class="empty">No active deposits yet.</div>';return;}
    const ahora=Math.floor(Date.now()/1000);
    c.innerHTML=vivos.map(({d,i})=>{ const m=MONEDAS.find(x=>x.a.toLowerCase()===d.token.toLowerCase()); const venc=ahora>=Number(d.vence); const cant=ethers.formatUnits(d.monto,18); const f=new Date(Number(d.vence)*1000).toLocaleDateString();
      return `<div class="dep">${m?logoImg(m,32):logoImg({s:'?',cg:''},32)}<div class="info2"><b>${num(cant,6)} ${m?m.s:''}</b><span>${venc?'Available to withdraw':'Unlocks '+f}</span></div><button class="${venc?'rdy':''}" data-i="${i}" ${venc?'':'disabled'}>Unstake</button></div>`;
    }).join('');
    c.querySelectorAll('button[data-i]').forEach(bt=>bt.onclick=()=>unstake(+bt.dataset.i,bt));
  }catch(_){c.innerHTML='<div class="empty">Could not load your deposits right now.</div>';}
}
async function unstake(id,bt){ bt.disabled=true; bt.textContent='Sign…'; try{ const stk=new ethers.Contract(STAKING,ABI_STK,await firmante()); const tx=await stk.unstake(id); await tx.wait(); deps(); side(); }catch(_){bt.disabled=false;bt.textContent='Unstake';} }

async function global(){
  try{
    const p=new ethers.Contract(PANEL,ABI_PANEL,lector()); const g=await p.global();
    const tvl=Number(ethers.formatUnits(g.tvlUSD,18));
    if($('st-tvl')) $('st-tvl').textContent=usd(tvl);
    if($('st-tvls')) $('st-tvls').textContent=Number(g.numStakers)+' stakers';
    if($('st-nst')) $('st-nst').textContent=Number(g.numStakers);
    if($('st-apr')) $('st-apr').textContent = tvl>0 ? '—' : 'New';
  }catch(_){ if($('st-tvl'))$('st-tvl').textContent='$0.00'; if($('st-nst'))$('st-nst').textContent='0'; if($('st-apr'))$('st-apr').textContent='New'; }
}
async function side(){
  const s=$('st-side'); if(!s)return;
  if(!cuenta()){ s.innerHTML=`<div class="box"><h3>Your position</h3><div class="empty">Connect your wallet to see your position, rewards and capital breakdown.</div></div>`; if($('st-mypos'))$('st-mypos').textContent='—'; return; }
  s.innerHTML=`<div class="box"><h3>Your position</h3><div class="empty">Loading…</div></div>`;
  try{
    const p=new ethers.Contract(PANEL,ABI_PANEL,lector());
    const pos=await p.posicionUsuario(cuenta());
    const cap=await p.capitalDeUsuario(cuenta());
    const rec=await p.recompensasDe(cuenta());
    const real=Number(ethers.formatUnits(pos.pesoReal,18));
    const valAhora=Number(ethers.formatUnits(pos.valorActualUSD,18));
    const gan=Number(ethers.formatUnits(pos.gananciaValoriza,18));
    const pct=Number(pos.porcentaje)/1e4;
    let enUsoUSD=0; cap.forEach(c=>{ const t=Number(c.total); if(t) enUsoUSD += Number(ethers.formatUnits(c.valorUSD,18))*Number(c.enUso)/t; });
    const pend=rec.filter(r=>r.pendiente>0n);
    if($('st-mypos')) $('st-mypos').textContent=usd(real);
    if($('st-mysub')) $('st-mysub').textContent=pct.toFixed(3)+'% of pool';
    s.innerHTML=`
      <div class="box">
        <h3>Your position</h3>
        <div class="big mono">${usd(real)}</div>
        <div class="r"><span class="k">Value now</span><span class="v mono ${gan>=0?'up':'dn'}">${usd(valAhora)}</span></div>
        <div class="r"><span class="k">Price gain</span><span class="v mono ${gan>=0?'up':'dn'}">${gan>=0?'+':''}${usd(gan)}</span></div>
        <div class="r"><span class="k">Pool share</span><span class="v mono">${pct.toFixed(4)}%</span></div>
        <div class="bar"><i style="width:${real?Math.min(100,enUsoUSD/real*100):0}%"></i></div>
        <div class="barlbl"><span>${usd(enUsoUSD)} working</span><span>${usd(Math.max(0,real-enUsoUSD))} available</span></div>
      </div>
      <div class="box">
        <h3>Rewards</h3>
        ${pend.length? pend.map(r=>`<div class="r"><span class="k">${r.simbolo}</span><span class="v mono up">${num(ethers.formatUnits(r.pendiente,18),6)}</span></div>`).join('')+`<button class="cta" id="st-claim">Claim rewards</button>`
          : `<div class="empty" style="padding:14px 0">No rewards yet. They accrue as people trade.</div>`}
      </div>`;
    const cl=$('st-claim'); if(cl) cl.onclick=async()=>{ cl.disabled=true;cl.textContent='Sign…'; try{ const stk=new ethers.Contract(STAKING,ABI_STK,await firmante()); const tx=await stk.reclamarTodo(); await tx.wait(); side(); }catch(_){cl.disabled=false;cl.textContent='Claim rewards';} };
  }catch(_){ s.innerHTML=`<div class="box"><h3>Your position</h3><div class="empty">Could not load your position right now.</div></div>`; }
}

/*──────────── Apertura como overlay (para el hero / servicios) ────────────*/
export function abrirAportar(){
  estilos();
  const prev=$('st-overlay'); if(prev) prev.remove();
  const d=document.createElement('div'); d.id='st-overlay';
  d.style.cssText='position:fixed;inset:0;z-index:9600;background:#05070a;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(20px + env(safe-area-inset-top,0px)) 20px calc(40px + env(safe-area-inset-bottom,0px))';
  d.innerHTML='<div style="max-width:1080px;margin:0 auto 14px;display:flex;justify-content:flex-end"><button id="st-ov-x" style="width:38px;height:38px;border-radius:11px;background:rgba(255,255,255,.05);border:1px solid #1c232c;color:#aeb8c4;font-size:16px;cursor:pointer">✕</button></div><div id="st-mount"></div>';
  document.body.appendChild(d);
  $('st-ov-x').onclick=()=>d.remove();
  montarAportar($('st-mount'));
}
