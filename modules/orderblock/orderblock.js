/* modules/orderblock/orderblock.js — "Order Block Liquidity"
   Radar de flujo de liquidez del mercado cripto. Módulo propio y aislado de la
   sección de Análisis (igual que Multichart / Footprint): monta un overlay a
   pantalla completa con un lienzo y corre el motor visual. Los datos son REALES
   y vienen de la capa aislada ./datos.js (Binance SPOT vía feed-shim + CoinGecko).

   Export: abrirOrderBlock()
*/
import * as D from './datos.js?v=9';
/* Reutilizamos la infraestructura YA probada de la plataforma: caché compartida de
   logos (misma que Multichart/VWAP Pro), velas y stream en vivo, y el catálogo PARES/TFS. */
import { logos as sharedLogos, PARES as SP, TFS, velas as velasReal, streamVelas } from '../trading-demo/datos.js?v=2';
const PARMAP={}, NAME={}; try{ SP.forEach(p=>{ if(p.cg)PARMAP[p.id]=p.cg; NAME[p.id]=p.n||p.id; }); }catch(_){}
const EXTOKEN={ Uniswap:'UNI', PancakeSwap:'CAKE', Curve:'CRV', Raydium:'RAY', KuCoin:'KCS', OKX:'OKB', Bitget:'BGB', Binance:'BNB' };
const _symUrl={};

/* ===== paleta (medida de la referencia) ===== */
const VERDE='#2BF59E', VHI='#C4FFE2', ROSA='#FF4D6E', RHI='#FFC0CE', AZUL='#2191D9';
const EXCH=[['Binance','BN','#F3BA2F'],['Coinbase','CB','#2A7CF6'],['Uniswap','UNI','#FF5DA2'],
            ['PancakeSwap','CK','#33C3C9'],['OKX','OK','#D4DCE4'],['Bybit','BY','#F7A600'],
            ['Kraken','KR','#8A66F7'],['Bitget','BG','#00E5C3'],['Raydium','RY','#5AC4FF'],
            ['Curve','CV','#FF5D5D'],['KuCoin','KC','#26D07C']];
const COLN=[6,5,4,3];
/* libreria de velas (la misma vendida que usan Multichart / Footprint) para el modal de detalle */
const LIB=new URL('../trading-demo/vendor/lightweight-charts.standalone.production.js', import.meta.url).href;
function lib(){ return window.LightweightCharts?Promise.resolve(window.LightweightCharts):new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=LIB; s.onload=()=>res(window.LightweightCharts); s.onerror=rej; document.head.appendChild(s); }); }
let LC=null, mChart=null, mSeries=null, mTF='1d', mCoin=null, mKl=[], mVP=null, mRO=null, mRAF=0, mStream=null, mMenuDoc=null, mSR=[];
let mDepthStream=null, mHeat=[], mHeatMax=1, mMode='vp';   // heatmap de profundidad tipo Bookmap (modal)
function onModalDepth(d){ if(!d||!d.bids.length||!d.asks.length)return;
  mHeat.push({bids:d.bids.slice(0,20),asks:d.asks.slice(0,20)}); if(mHeat.length>70)mHeat.shift();
  for(const b of d.bids)if(b[1]>mHeatMax)mHeatMax=b[1]; for(const a of d.asks)if(a[1]>mHeatMax)mHeatMax=a[1]; mHeatMax*=0.999; }

/* ===== estado del modulo ===== */
let ov=null, cv=null, ctx=null, GL=null, glx=null, SB=null, sbx=null, RAF=0, stream=null, booted=false;
let W=0,H=0,DPR=1,PW=0,PH=0,SBW=1,SBH=1, DM=null, split=0.5, T=0, last=0, paused=false;
let flowLive=0.5; const _prevPx={};   // flujo direccional en vivo (mueve la línea blanca de forma orgánica y REAL)
let tradeStream=null, _takBuy=0, _takSell=0;   // aggTrades: pulsos de ballenas + presión real compra/venta
let depthStream=null; const book={bids:[],asks:[],bidVol:0,askVol:0,mid:0};   // libro de órdenes REAL de BTC
let chainStream=null, _tapeCool=0, _chainCool=0;   // cinta de ballenas (trades + on-chain) y su ritmo
let flowItems=[];   // historial del rectángulo de FLUJO (lo que ya salió de los dos slots)
let buyLatest=null, sellLatest=null;   // alerta más nueva encasillada en cada cuadrado (compra / venta)
let _soundOn=false;   // sonido de alerta: DESACTIVADO por defecto
function onChainWhale(m){ if(!m||!(m.amount>0))return; const now=performance.now(); if(now-_chainCool<1500)return; _chainCool=now;
  const f=m.from||'', t2=m.to||'', dst=t2||f;    // guardo from y to completos: la ficha muestra ...4 + copiar + explorador
  flowPush({cls:'chain',label:'ON-CHAIN',coin:'BTC',sym:'BTC',size:m.amount.toFixed(1)+' BTC',usd:(book.mid?m.amount*book.mid:0),src:'On-chain BTC',
    from:f,fromShort:f?f.slice(-4):'----',to:t2,toShort:t2?t2.slice(-4):'----',fullFrom:f,fullTo:t2,addr:dst?dst.slice(-4):'----',fullAddr:dst,up:true,col:'33,145,217'}); }
let liqStream=null, _liqCool=0;
function onLiq(l){ if(!l||!(l.usd>=30000))return; const now=performance.now(); if(now-_liqCool<800)return; _liqCool=now;
  // LONG liquidada = venta forzada (bajista -> SELL FLOW); SHORT = compra forzada (alcista -> BUY FLOW)
  const sym=l.symbol.replace('USDT','');
  flowPush({cls:'liq',label:l.longLiq?'LIQ LONG':'LIQ SHORT',coin:sym,sym:sym,size:'$'+fmtVol(l.usd),usd:l.usd,src:'Bybit Perps',up:!l.longLiq,col:'232,184,75'}); }
async function refrescarPulso(){ const p=document.getElementById('ob-pulse'); if(!p)return;
  let fng=null,gl=null; try{ fng=await D.fearGreed(); }catch(_){} try{ gl=await D.globalMkt(); }catch(_){}
  const fcol=v=>v>=75?'#2BF59E':v>=55?'#9fe06a':v>=45?'#E8B84B':v>=25?'#ff9f43':'#FF4D6E'; let html='';
  if(fng)html+=`<span class="ob-fng"><span class="k">FEAR / GREED</span><span class="ob-fngdot" style="background:${fcol(fng.value)}"></span><span class="v">${fng.value}</span> ${fng.label}</span>`;
  if(gl){ const c=gl.chg>=0?'#2BF59E':'#FF4D6E'; html+=`<span class="mcap"><span class="k">MCAP</span><span class="v">$${fmtVol(gl.mcap)}</span> <span style="color:${c}">${gl.chg>=0?'+':''}${gl.chg.toFixed(1)}%</span></span><span class="dom"><span class="k">BTC.D</span><span class="v">${gl.btcDom.toFixed(1)}%</span></span>`; }
  if(html)p.innerHTML=html; }
function onDepth(d){ if(!d||!d.bids.length||!d.asks.length)return; book.bids=d.bids; book.asks=d.asks;
  let bv=0,av=0; for(const b of d.bids)bv+=b[0]*b[1]; for(const a of d.asks)av+=a[0]*a[1]; book.bidVol=bv; book.askVol=av; book.mid=(d.bids[0][0]+d.asks[0][0])/2; }
let COINS=[], green=[], red=[], strands=[], strandsFaint=[], hist=[];
const Z={}, mouse={x:-1,y:-1,on:false}, LOGO={}, EXVOL={}, EXIMG={}, EXMETA={};
/* Iconos de moneda: spothq en GitHub (POR TICKER, con CORS -> no ensucia el canvas y SÍ carga),
   igual que Multichart/Heat Pool. Respaldo a la URL de CoinGecko (sin CORS: se pinta igual,
   el export ya excluye logos). Esta es la razón por la que ahora sí aparecen. */
const SPOT='https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/';
// logo POR DEFECTO: la MISMA imagen ejemplarizante que usa el Terminal para los tokens sin logo
const DEF_URL=new URL('../terminal/img/token-fallback.webp', import.meta.url).href;
// Cadena de respaldos con CORS. im._alt = lista de URLs a probar en orden si la actual falla.
// Siempre termina en el logo por defecto, así ninguna moneda queda sin logo.
const _imgCache={};
function imgChain(first, alt){ if(_imgCache[first])return _imgCache[first];     // misma imagen reutilizada: sin parpadeo
  const im=new Image(); im.referrerPolicy='no-referrer'; im.crossOrigin='anonymous'; im._alt=alt||[]; im._i=0;
  im.onerror=function(){ if(im._i>=im._alt.length){ im.onerror=null; return; } im.src=im._alt[im._i++]; };
  im.src=first; _imgCache[first]=im; return im; }
// moneda: spothq (por ticker) -> CoinGecko (respaldo) -> logo por defecto
function imgLogo(ticker, cgUrl){ const alt=[]; if(cgUrl)alt.push(cgUrl); alt.push(DEF_URL); return imgChain(SPOT+String(ticker||'').toLowerCase()+'.png', alt); }
// exchange: marca real (CoinGecko) -> icono de su token (spothq) -> logo por defecto
function imgExch(ei, brandUrl){ const tk=EXTOKEN[EXCH[ei][0]], alt=[]; if(tk)alt.push(SPOT+tk.toLowerCase()+'.png'); alt.push(DEF_URL); return imgChain(brandUrl||DEF_URL, alt); }
let EXREADY=false, _exporting=false;
// logo de la página para la marca del export (mismo que usa Multichart)
const BRAND_URL=new URL('../../assets/img/cco-marca.png', import.meta.url).href;
let BRAND_IMG=null; (function(){ const im=new Image(); im.onload=()=>{ BRAND_IMG=im; }; im.src=BRAND_URL; })();
const fmtVol=v=>v>=1e9?(v/1e9).toFixed(1)+'B':v>=1e6?(v/1e6).toFixed(0)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v.toFixed(0);

/* ===== utilidades ===== */
const rnd=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>v<a?a:v>b?b:v, pick=a=>a[(Math.random()*a.length)|0];
function rr(g,x,y,w,h,r){ r=Math.max(0,Math.min(r,w/2,h/2)); g.beginPath();
  g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function cornerMarks(g,x,y,w,h,len,col,lw){ g.strokeStyle=col; g.lineWidth=lw; g.lineCap='round';
  [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(([cx,cy,sx,sy])=>{
    g.beginPath(); g.moveTo(cx,cy+sy*len); g.lineTo(cx,cy); g.lineTo(cx+sx*len,cy); g.stroke(); }); }
function hexA(h,a){ const n=parseInt(h.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
const fmtP=p=>p>=1000?Math.round(p).toLocaleString('en-US'):(p>=1?p.toFixed(2):p.toFixed(p>=0.1?4:6));

/* ===== agregados ===== */
function aggSectors(){ const m={}; COINS.forEach(c=>{ const s=c.sec||'Otros'; (m[s]=m[s]||{s,sum:0,w:0,up:0,n:0});
    const o=m[s]; o.sum+=c.disp*c.vol; o.w+=c.vol; o.n++; if(c.disp>0)o.up++; });
  return Object.values(m).filter(o=>o.n>0).map(o=>({s:o.s,pct:o.w?o.sum/o.w:0,up:o.up,n:o.n})).sort((a,b)=>b.pct-a.pct); }
function liveExch(i){ let sum=0,w=0,up=0,n=0; COINS.forEach(c=>{ if(c.exch!==i)return; sum+=c.disp*c.vol; w+=c.vol; n++; if(c.disp>0)up++; });
  return {i,name:EXCH[i][0],ab:EXCH[i][1],col:EXCH[i][2],pct:w?sum/w:0,up,n}; }
function aggExchanges(){ const a=[]; for(let i=0;i<EXCH.length;i++){ const o=liveExch(i); if(o.n)a.push(o); } return a.sort((x,y)=>y.pct-x.pct); }

/* ===== cascada de tarjetas ===== */
function buildCards(){
  const prev=new Set(tarjetasVisibles().map(c=>c.sym));   // quiénes se ven AHORA (antes de rebarajar)
  const named=COINS.filter(c=>c.sym);
  const pr=(arr,asc)=>arr.sort((a,b)=>((b.major?1:0)-(a.major?1:0))||(asc?a.disp-b.disp:b.disp-a.disp));
  const g=pr(named.filter(c=>c.disp>0),false), r=pr(named.filter(c=>c.disp<0),true);
  const take=arr=>{ let i=0; return COLN.map(n=>{ const s=arr.slice(i,i+n); i+=n; return s; }); };
  green=take(g); red=take(r);
  // las monedas que ENTRAN nuevas (oportunidades que afloran del flujo) aparecen con fundido
  tarjetasVisibles().forEach(c=>{ if(!prev.has(c.sym)) c._appear=0; else if(c._appear==null) c._appear=1; });
}
function tarjetasVisibles(){ const out=[]; [green,red].forEach(cols=>cols.forEach(col=>col.forEach(c=>out.push(c)))); return out; }

/* ===== layout ===== */
function layout(){
  const r=cv.getBoundingClientRect(); W=r.width; H=r.height; DPR=Math.min(1.25,window.devicePixelRatio||1);
  PW=Math.round(W*DPR); PH=Math.round(H*DPR); cv.width=PW; cv.height=PH; GL.width=PW; GL.height=PH;
  SBW=Math.max(1,Math.round(PW/2)); SBH=Math.max(1,Math.round(PH/2)); SB.width=SBW; SB.height=SBH;
  Z.y0=Math.round(H*0.075); Z.y1=Math.round(H*0.93);
  Z.railX=44; Z.secX=70; Z.secW=Math.round(clamp(W*0.125,210,300));
  Z.funX0=Z.secX+Z.secW;
  // RECTÁNGULO DE FLUJO (clon del central) a la izquierda del libro de órdenes, un poco más ancho.
  Z.flowW=Math.max(118,Math.round(W*0.076)); Z.flowX0=Z.funX0+Math.round(W*0.075); Z.flowX1=Z.flowX0+Z.flowW;
  // Libro de órdenes: corrido a la derecha para dejar el hueco del rectángulo de flujo.
  Z.barX0=Z.flowX1+Math.round(W*0.072); Z.barW=Math.max(44,Math.round(W*0.032)); Z.barX1=Z.barX0+Z.barW;
  Z.vpLeftW=Math.round(W*0.05); Z.clX0=Z.barX1+Math.round(W*0.042);
  DM=null; buildCards(); placeCards(); buildStrands(); colocarFlow();
}
const PMIN=-4,PMAX=5.4, Y=p=>Z.y1-((p-PMIN)/(PMAX-PMIN))*(Z.y1-Z.y0);
// fracción de PRESIÓN COMPRADORA real (volumen que sube / volumen total). Sin sesgo:
// mercado equilibrado -> línea al centro; que suba o baje según el flujo real.
function splitTarget(){ let up=0,w=0; COINS.forEach(c=>{ w+=c.vol; if(c.disp>=0)up+=c.vol; });
  const breadth=w?clamp(up/w,0.12,0.88):0.5;
  // la línea blanca combina TRES señales reales: amplitud de mercado, flujo de taker en vivo
  // y el desbalance del libro de órdenes (liquidez en reposo). Se mueve orgánicamente.
  const tv=book.bidVol+book.askVol;
  if(tv>0){ const bi=clamp(book.bidVol/tv,0.1,0.9); return clamp(breadth*0.38+flowLive*0.34+bi*0.28,0.18,0.82); }
  return clamp(breadth*0.6+flowLive*0.4,0.18,0.82); }

function placeCards(){
  const ropeY=(Z.y0+Z.y1)/2, gap=8, colGap=Math.round(W*0.0105);
  // tarjetas ~20% más cortas (dejan sitio al rectángulo de flujo) y corridas a la derecha
  const widths=[Math.round(W*0.084),Math.round(W*0.101),Math.round(W*0.118),Math.round(W*0.139)];
  Z.cardTW=Math.max(196,widths[3]); Z.cardTH=180;   // tamano objetivo del zoom (parejo para todas)
  let x=Z.clX0;
  for(let ci=0;ci<4;ci++){ const w=widths[ci], col=green[ci]||[], n=col.length;
    const bottom=ropeY-16, top=Z.y0+4, ch=Math.min((bottom-top-(n-1)*gap)/Math.max(1,n), ci>=2?180:138);
    col.forEach((c,i)=>{ c._w=w; c._h=ch; c._x=x; c._y=bottom-(n-i)*(ch+gap)+gap; c._ci=ci; c._up=true; });
    x+=w+colGap; }
  x=Z.clX0;
  for(let ci=0;ci<4;ci++){ const w=widths[ci], col=red[ci]||[], n=col.length;
    const top=ropeY+16, bottom=Z.y1-4, ch=Math.min((bottom-top-(n-1)*gap)/Math.max(1,n), ci>=2?180:138);
    col.forEach((c,i)=>{ c._w=w; c._h=ch; c._x=x; c._y=top+i*(ch+gap); c._ci=ci; c._up=false; });
    x+=w+colGap; }
  Z.ropeY=ropeY;
}

/* ===== hilos ===== */
function buildStrands(){
  strands=[]; strandsFaint=[];
  const idxs=EXCH.map((_,i)=>i);
  const order=EXREADY? idxs.slice().sort((a,b)=>(EXVOL[b]||0)-(EXVOL[a]||0)) : idxs;
  const n=order.length, gap=5, tot=Z.y1-Z.y0, ch=(tot-gap*Math.max(0,n-1))/Math.max(1,n);
  const exchY={}; order.forEach((ei,i)=>exchY[ei]=Z.y0+i*(ch+gap)+ch/2);
  Z.exchY=exchY; Z.exchCH=ch; Z.exchOrder=order;
  const mid=(Z.y0+Z.y1)/2;
  // arranque SIEMPRE pegado a la fila de su exchange y dentro del panel (sin líneas sueltas)
  COINS.forEach(c=>{ const up=c.disp>=0, oy=clamp((exchY[c.exch]!=null?exchY[c.exch]:mid)+rnd(-ch*0.3,ch*0.3),Z.y0+5,Z.y1-5);
    strands.push({ coin:c, y0:oy, up, exch:c.exch, sec:c.sec, phase:rnd(0,6.28), amp:rnd(4,13), hl:0,
      col:up?VERDE:ROSA, hero:(c.major||c.rank<=24), r:Math.random(), _wp:-1, _wcool:0 }); });
  // líneas tenues: su proporción verde/rojo sigue la presión real del mercado (no 55% fijo)
  if(Z.exchOrder.length) for(let k=0;k<40;k++){ const ei=pick(Z.exchOrder), up=Math.random()<split;
    const oy=clamp((exchY[ei]!=null?exchY[ei]:mid)+rnd(-ch*0.4,ch*0.4),Z.y0+5,Z.y1-5);
    strandsFaint.push({ y0:oy, up, exch:ei, phase:rnd(0,6.28), amp:rnd(5,15), hl:0, col:up?VERDE:ROSA, hero:false, r:Math.random() }); }
}
function strandPath(s){
  // Curva bezier cúbica con controles a media x (misma dinámica NATURAL que el lado derecho,
  // rectángulo -> tarjetas). Antes usaba una convergencia potencia + seno que deformaba las
  // líneas al pegarse a la cara blanca (efecto "transformación libre"). Esto lo elimina.
  const x0=Z.funX0, x1=Z.flowX0, N=28, pts=[], mx=x0+(x1-x0)*0.5;
  const divY=Z.y0+split*(Z.y1-Z.y0);
  const yEnd = s.up ? Z.y0+12 + s.r*(divY-Z.y0-24) : divY+12 + s.r*(Z.y1-divY-24);
  const drift=Math.sin(T*0.5+s.phase)*2.0;            // leve vida, nunca deforma (cero en los extremos)
  for(let k=0;k<=N;k++){ const t=k/N, it=1-t, x=x0+t*(x1-x0);
    const y = it*it*it*s.y0 + 3*it*it*t*s.y0 + 3*it*t*t*yEnd + t*t*t*yEnd + drift*Math.sin(t*Math.PI);
    pts.push([x,y]); }
  return pts;
}

/* ===== animacion ===== */
function tick(dt){ T+=dt; split+=(splitTarget()-split)*0.045;   // responde al flujo real, visible pero suave
  // El % mostrado SOLO sigue al % real (c.pct lo actualiza el ticker en vivo). Sin
  // oscilacion inventada: si el mercado no se mueve, la tarjeta no se mueve.
  const f=1-Math.pow(0.86,dt*60);
  COINS.forEach(c=>{ c.disp+=(c.pct-c.disp)*f; if(Math.abs(c.pct-c.disp)<0.001)c.disp=c.pct; });
  // presión de TAKER real (aggTrades): ventana rodante (~3s) -> alimenta la línea blanca
  const dec=Math.pow(0.5,dt/3); _takBuy*=dec; _takSell*=dec;
  const tt=_takBuy+_takSell; if(tt>500){ flowLive+=((_takBuy/tt)-flowLive)*(1-Math.pow(0.5,dt/0.8)); } }

/* ===== substrato ===== */
function dotMatrix(){ DM=document.createElement('canvas'); DM.width=PW; DM.height=PH;
  const d=DM.getContext('2d'); d.setTransform(DPR,0,0,DPR,0,0);
  const x0=Z.funX0-6,x1=Z.barX1+Z.vpLeftW,y0=Z.y0-6,y1=Z.y1+6,st=14;
  for(let y=y0;y<=y1;y+=st)for(let x=x0;x<=x1;x+=st){ const tr=(x-x0)/(x1-x0);
    d.fillStyle=`rgba(70,135,115,${(0.03+0.045*Math.sin(x*0.03)+0.05*tr).toFixed(3)})`; d.fillRect(x,y,1.5,1.5); } }
function substrate(){ ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,PW,PH);
  if(!DM)dotMatrix(); ctx.drawImage(DM,0,0); ctx.setTransform(DPR,0,0,DPR,0,0); }

/* ===== termometro ===== */
// Termómetro = AMPLITUD DE MERCADO real: fracción de monedas subiendo. Dato útil (riesgo on/off).
function thermo(g){ const x=Z.railX,w=9,y0=Z.y0,y1=Z.y1,h=y1-y0,r=w/2;
  let up=0; COINS.forEach(c=>{ if(c.disp>=0.3)up++; }); const lvl=COINS.length?up/COINS.length:0.5;
  g.save(); rr(g,x,y0,w,h,r); g.clip();
  const gr=g.createLinearGradient(0,y1,0,y0); gr.addColorStop(0,ROSA); gr.addColorStop(.5,'#d8b23a'); gr.addColorStop(.62,'#8fe07a'); gr.addColorStop(1,VERDE);
  g.fillStyle=gr; g.fillRect(x,y0,w,h);
  g.fillStyle='rgba(4,8,12,.62)'; g.fillRect(x,y0,w,(1-lvl)*h); g.restore();
  rr(g,x,y0,w,h,r); g.strokeStyle='rgba(180,210,230,.22)'; g.lineWidth=1; g.stroke();
  [0.25,0.5,0.75].forEach(f=>{ const yy=y1-f*h; g.strokeStyle='rgba(200,215,230,.22)'; g.lineWidth=1; g.beginPath(); g.moveTo(x-3,yy); g.lineTo(x,yy); g.stroke(); });
  const ly=y1-lvl*h; g.fillStyle='#fff'; g.beginPath(); g.arc(x+w/2,ly,3.4,0,7); g.fill();
  // rótulo vertical: dice qué es y su valor real, para que no parezca relleno
  g.save(); g.translate(x-6,y0+h/2); g.rotate(-Math.PI/2); g.textAlign='center'; g.textBaseline='middle';
    g.fillStyle='#cfdae7'; g.font='800 12px "IBM Plex Mono",monospace'; g.fillText(Math.round(lvl*100)+'%   MARKET BREADTH   '+up+'/'+(COINS.length||0)+' UP',0,0);
  g.restore(); g.textAlign='left'; g.textBaseline='alphabetic'; }

/* ===== hilos (cinta con cuerpo + pulsos) ===== */
function ribbon(g,pts,wExit,wEntry,col,alpha){
  const N=pts.length, top=new Array(N), bot=new Array(N);
  for(let i=0;i<N;i++){ const t=i/(N-1), w=(wExit*Math.pow(1-t,1.7)+wEntry*Math.pow(t,2.2)+0.35)*0.5;
    const p=pts[i], pa=pts[Math.max(0,i-1)], pb=pts[Math.min(N-1,i+1)];
    let dx=pb[0]-pa[0], dy=pb[1]-pa[1]; const L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L;
    top[i]=[p[0]+nx*w,p[1]+ny*w]; bot[i]=[p[0]-nx*w,p[1]-ny*w]; }
  g.beginPath(); g.moveTo(top[0][0],top[0][1]);
  for(let i=1;i<N;i++)g.lineTo(top[i][0],top[i][1]);
  for(let i=N-1;i>=0;i--)g.lineTo(bot[i][0],bot[i][1]);
  g.closePath(); g.fillStyle=col; g.globalAlpha=alpha; g.fill();
}
function drawStrands(g){
  const paint=(s,faint)=>{ const pts=strandPath(s);
    if(faint){ g.beginPath(); g.moveTo(pts[0][0],pts[0][1]);
      for(let i=1;i<pts.length-1;i++){ const xc=(pts[i][0]+pts[i+1][0])/2,yc=(pts[i][1]+pts[i+1][1])/2; g.quadraticCurveTo(pts[i][0],pts[i][1],xc,yc); }
      g.strokeStyle=s.col; g.globalAlpha=0.09; g.lineWidth=0.8; g.lineCap='round'; g.stroke(); }
    else if(s.hero){ ribbon(g,pts,4.2,2.1,s.col,0.5+0.35*s.hl); }
    else{ g.beginPath(); g.moveTo(pts[0][0],pts[0][1]);
      for(let i=1;i<pts.length-1;i++){ const xc=(pts[i][0]+pts[i+1][0])/2,yc=(pts[i][1]+pts[i+1][1])/2; g.quadraticCurveTo(pts[i][0],pts[i][1],xc,yc); }
      g.strokeStyle=s.col; g.globalAlpha=0.26+0.35*s.hl; g.lineWidth=1.1+s.hl; g.lineCap='round'; g.stroke(); }
    if(!faint){ const pp=((T*0.17+s.phase*0.12)%1+1)%1, fp=pp*(pts.length-1), i0=fp|0, fr=fp-i0, a=pts[i0], bb=pts[Math.min(pts.length-1,i0+1)];
      const qx=a[0]+(bb[0]-a[0])*fr, qy=a[1]+(bb[1]-a[1])*fr;      // interpolado = fluido (no por fotograma)
      g.globalAlpha=0.9*(0.6+0.4*s.hl); g.fillStyle=s.col; g.beginPath(); g.arc(qx,qy,s.hero?2.1:1.6,0,7); g.fill(); }
    // PULSO DE BALLENA: una operación grande real viaja por el hilo de su moneda
    if(!faint && s._wp>=0){ s._wp+=0.026; if(s._wp>1){ s._wp=-1; }
      else { const fp=s._wp*(pts.length-1), i0=fp|0, fr=fp-i0, a=pts[i0], bb=pts[Math.min(pts.length-1,i0+1)];
        const wx=a[0]+(bb[0]-a[0])*fr, wy=a[1]+(bb[1]-a[1])*fr, wc=s._wbuy?'43,245,158':'255,77,110', rad=3+3.4*(s._wmag||1);
        g.save(); g.globalAlpha=0.95; g.shadowColor=`rgba(${wc},0.95)`; g.shadowBlur=16; g.fillStyle=`rgba(${wc},1)`; g.beginPath(); g.arc(wx,wy,rad,0,7); g.fill(); g.restore(); } } };
  strandsFaint.forEach(s=>paint(s,true)); strands.forEach(s=>paint(s,false)); g.globalAlpha=1; }

/* ===== filtro central ===== */
function filterBar(g){
  const x0=Z.barX0,x1=Z.barX1,y0=Z.y0,y1=Z.y1,h=y1-y0,bw=x1-x0;
  // verde arriba = presión compradora (su alto = fracción real de compra). Antes estaba
  // invertido, por eso el verde salía perpetuo. Ahora la línea sube/baja con el flujo real.
  const divY=y0+split*h;
  g.fillStyle=hexA(VERDE,0.14); g.fillRect(x0,y0,bw,divY-y0);
  g.fillStyle=hexA(ROSA,0.14); g.fillRect(x0,divY,bw,y1-divY);
  const haveBook=book.bids.length>=3 && book.asks.length>=3;
  if(haveBook){
    // LIBRO DE ÓRDENES REAL (BTC): bids = zona verde (arriba), asks = zona roja (abajo).
    // Barras GRANDES y legibles con la CANTIDAD real escrita dentro, en tiempo real.
    let mq=0; for(const b of book.bids)if(b[1]>mq)mq=b[1]; for(const a of book.asks)if(a[1]>mq)mq=a[1]; mq=mq||1;
    const gzone=divY-y0, rzone=y1-divY;
    const nb=Math.max(3,Math.min(book.bids.length,Math.floor(gzone/17)));
    const na=Math.max(3,Math.min(book.asks.length,Math.floor(rzone/17)));
    const bh=gzone/nb, ah=rzone/na, showN=Math.min(bh,ah)>=12.5;
    g.textBaseline='middle'; g.font='700 11px "IBM Plex Mono",monospace';
    for(let i=0;i<nb;i++){ const q=book.bids[i][1], y=divY-(i+1)*bh, len=Math.max(bw*0.22,bw*clamp(Math.pow(q/mq,0.78),0.1,1)), nr=1-i/nb;
      g.fillStyle=VERDE; g.globalAlpha=0.24+0.42*nr; g.fillRect(x0,y+1,len,bh-2); g.globalAlpha=1;
      if(showN){ g.fillStyle=`rgba(238,255,247,${(0.62+0.38*nr).toFixed(2)})`; g.textAlign='left'; g.fillText(q.toFixed(2),x0+5,y+bh/2); } }
    for(let i=0;i<na;i++){ const q=book.asks[i][1], y=divY+i*ah, len=Math.max(bw*0.22,bw*clamp(Math.pow(q/mq,0.78),0.1,1)), nr=1-i/na;
      g.fillStyle=ROSA; g.globalAlpha=0.24+0.42*nr; g.fillRect(x0,y+1,len,ah-2); g.globalAlpha=1;
      if(showN){ g.fillStyle=`rgba(255,118,140,${(0.72+0.28*nr).toFixed(2)})`; g.textAlign='left'; g.fillText(q.toFixed(2),x0+5,y+ah/2); } }
    g.textBaseline='alphabetic'; g.textAlign='left';
  } else {
    const sorted=COINS.slice().sort((a,b)=>b.disp-a.disp), n=sorted.length||1, lh=h/n;
    for(let i=0;i<sorted.length;i++){ const c=sorted[i], y=y0+i*lh, up=(y<divY);
      const len=bw*clamp(0.72+0.26*Math.sin(c.ini*5+i*0.7),0.42,1);
      g.fillStyle=up?VERDE:ROSA; g.globalAlpha=up?0.55:0.5; g.fillRect(x0,y,len,Math.max(0.8,lh*0.66)); }
    g.globalAlpha=1;
  }
  g.fillStyle='rgba(255,255,255,.5)';
  for(let k=0;k<6;k++){ const yy=y0+((k*53+(T*8))%h); g.globalAlpha=.22+.18*Math.sin(T+k); g.beginPath(); g.arc(x0+bw*(0.3+0.5*((k*0.37)%1)),yy,1.1,0,7); g.fill(); }
  g.globalAlpha=1;
  g.strokeStyle='rgba(255,255,255,.92)'; g.lineWidth=2; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x0,y1); g.stroke();
  g.beginPath(); g.moveTo(x0,divY); g.lineTo(x1+4,divY); g.stroke();
  // cuadrados que respetan SIEMPRE ≥18px con la línea blanca divisoria (nunca la cruzan)
  const gH=Math.min(52,(divY-y0)*0.38), rH=Math.min(52,(y1-divY)*0.38);
  const gY=y0+16+(0.5+0.4*Math.sin(T*0.5))*Math.max(0,(divY-y0)-gH-34);
  const rY=divY+18+(0.5+0.4*Math.sin(T*0.5+2))*Math.max(0,(y1-divY)-rH-34);
  gate(g,x0,gY,bw,gH,VHI); gate(g,x0,rY,bw,rH,RHI);
  Z.gateG={x:x0,y:gY,w:bw,h:gH}; Z.gateR={x:x0,y:rY,w:bw,h:rH};
  cornerMarks(g,x0-7,y0-7,bw+14,h+14,18,hexA(VERDE,.55),1.6);
  if(haveBook){ g.textAlign='center'; g.textBaseline='alphabetic';
    g.font='700 9px "Saira Condensed",sans-serif'; g.fillStyle='rgba(150,165,180,.85)'; g.fillText('LIVE ORDER BOOK · BTC '+(book.mid?('$'+fmtP(book.mid)):''),(x0+x1)/2,y0-12);
    // desbalance del LIBRO movido ARRIBA (antes abajo, se cortaba en el navegador)
    const tvv=book.bidVol+book.askVol, bidp=tvv?Math.round(book.bidVol/tvv*100):50;
    g.font='700 8.5px "Saira Condensed",sans-serif'; g.fillStyle='rgba(130,145,160,.8)'; g.fillText('BID '+bidp+'%  ·  ASK '+(100-bidp)+'%',(x0+x1)/2,y0-25); g.textAlign='left'; }
  g.font='600 13px "IBM Plex Mono",monospace'; g.fillStyle='rgba(220,235,245,.8)'; g.textAlign='center';
  g.fillText(String(COINS.length||0),(x0+x1)/2,y1+17);
  // presión de TAKER en vivo (compra agresiva vs venta agresiva), dato real del order flow
  const cx=(x0+x1)/2, bp=Math.round(clamp(flowLive,0,1)*100);
  g.font='800 10px "Saira Condensed",sans-serif';
  g.textAlign='right'; g.fillStyle=VERDE; g.fillText('BUY '+bp+'%', cx-4, y1+33);
  g.fillStyle='rgba(120,135,150,.7)'; g.textAlign='center'; g.fillText('·', cx, y1+33);
  g.textAlign='left'; g.fillStyle=ROSA; g.fillText('SELL '+(100-bp)+'%', cx+4, y1+33);
  g.textAlign='left';
  Z.divY=divY;
}
function gate(g,x,y,w,h,hi){
  const rows=Math.max(5,Math.round(h/5));
  for(let r=0;r<rows;r++){ const yy=y+2+r*(h-4)/rows, len=w*(0.55+0.45*Math.abs(Math.sin(T*2+r*0.8)));
    g.fillStyle=hi; g.globalAlpha=0.5+0.45*Math.abs(Math.sin(T*2+r*0.6)); g.fillRect(x+1,yy,len,Math.max(1.4,(h-4)/rows-1.4)); }
  g.globalAlpha=1; cornerMarks(g,x-5,y-5,w+10,h+10,13,'#ffffff',1.8);
}

/* ===== rectángulo de FLUJO (clon del central, a su izquierda) ===== */
function flowBar(g){
  const x0=Z.flowX0,x1=Z.flowX1,y0=Z.y0,y1=Z.y1,h=y1-y0,bw=x1-x0;
  const divY=y0+split*h, fg=flowGeom();
  // zonas base
  g.fillStyle=hexA(VERDE,0.07); g.fillRect(x0,y0,bw,divY-y0);
  g.fillStyle=hexA(ROSA,0.07); g.fillRect(x0,divY,bw,y1-divY);
  // VOLUMEN de fondo (segundo plano transparente), muy bajo para NO tapar las tarjetas
  g.save(); rr(g,x0,y0,bw,h,10); g.clip();
  const rows=Math.floor(h/14);
  for(let r=0;r<rows;r++){ const yy=y0+r*14, upz=(yy<divY), col=upz?VERDE:ROSA;
    const len=bw*(0.26+0.46*Math.abs(Math.sin(T*1.0+r*0.5)));
    g.fillStyle=hexA(col,0.045); g.fillRect(x0,yy+1,len,12); }
  g.restore();
  // borde blanco izquierdo + línea blanca divisoria GRUESA (igual que el Live Order Book)
  g.strokeStyle='rgba(255,255,255,.92)'; g.lineWidth=2; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x0,y1); g.stroke();
  g.beginPath(); g.moveTo(x0,divY); g.lineTo(x1,divY); g.stroke();
  // dos cuadrados FIJOS: solo marco (esquinas) + brillo al entrar alerta. La tarjeta va DENTRO (DOM).
  flowGate(g,fg.x-3,fg.buyY,fg.w+6,fg.sqH,VERDE,Z.flowShineG);
  flowGate(g,fg.x-3,fg.sellY,fg.w+6,fg.sqH,ROSA,Z.flowShineR);
  Z.flowGateG={x:fg.x-3,y:fg.buyY,w:fg.w+6,h:fg.sqH}; Z.flowGateR={x:fg.x-3,y:fg.sellY,w:fg.w+6,h:fg.sqH};
  cornerMarks(g,x0-7,y0-7,bw+14,h+14,18,hexA(VERDE,.5),1.6);
  // título arriba del rectángulo (antes vivía en la franja superior que se quitó)
  g.font='800 10px "Saira Condensed",sans-serif'; g.fillStyle='rgba(150,165,180,.9)'; g.textAlign='center'; g.textBaseline='alphabetic';
  g.fillText('WHALE FLOW',(x0+x1)/2,y0-12); g.textAlign='left';
  Z.flowDivY=divY;
}
function flowGate(g,x,y,w,h,base,shineT){
  // SOLO marco de esquinas + brillo al entrar una alerta. Sin volumen dentro (ahí va la tarjeta en DOM).
  const dt=shineT?(performance.now()-shineT):1e9;
  if(dt<950){ const k=1-dt/950; g.save(); g.shadowColor=hexA(base,.9); g.shadowBlur=22*k;
    rr(g,x,y,w,h,6); g.strokeStyle=hexA(base,0.3+0.5*k); g.lineWidth=1.1+1.8*k; g.stroke(); g.restore(); }
  cornerMarks(g,x-4,y-4,w+8,h+8,13,'#ffffff',1.7);
}
/* ===== enlaces cuadrado -> cuadrado (flujo -> libro): ensanchan y vuelven a cerrar ===== */
function linkRects(g){
  Z.linkPulses=Z.linkPulses||[];
  // MUCHAS ramificaciones (no una sola cinta): salen de la boca del cuadrado del flujo,
  // se ensanchan y se vuelven a cerrar hasta morir en la boca del cuadrado del libro.
  const pairs=[[Z.flowGateG,Z.gateG,VERDE],[Z.flowGateR,Z.gateR,ROSA]];
  pairs.forEach(([a,b,col])=>{ if(!a||!b)return;
    const ax=a.x+a.w, ay=a.y+a.h/2, bx=b.x, by=b.y+b.h/2, mx=ax+(bx-ax)*0.5, K=24, half=(K-1)/2;
    for(let j=0;j<K;j++){ const sp=j-half;
      const y0=ay+sp*1.25, y1=by+sp*1.25;                         // SALE y LLEGA fina (convergida en la boca del cuadrado)
      const cy=(y0+y1)/2 + sp*4.6;                                 // se ABRE ancha en el medio y se vuelve a CERRAR
      g.strokeStyle=hexA(col,0.1+0.1*(1-Math.abs(sp)/half)); g.lineWidth=0.6; g.lineCap='round';
      g.beginPath(); g.moveTo(ax,y0); g.bezierCurveTo(mx,cy,mx,cy,bx,y1); g.stroke();
      if(j%4===0){ const t=((T*0.3+j*0.1)%1+1)%1, it=1-t;
        const px=it*it*it*ax+3*it*it*t*mx+3*it*t*t*mx+t*t*t*bx, py=it*it*it*y0+3*it*it*t*cy+3*it*t*t*cy+t*t*t*y1;
        g.globalAlpha=0.55; g.fillStyle=col; g.beginPath(); g.arc(px,py,1.2,0,7); g.fill(); g.globalAlpha=1; } }
  });
  // continuidad de la línea blanca entre rectángulos: MISMO grosor + un punto en cada boca
  if(Z.flowDivY!=null){ const yd=Z.flowDivY; g.save(); g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=2; g.lineCap='round';
    g.beginPath(); g.moveTo(Z.flowX1,yd); g.lineTo(Z.barX0,yd); g.stroke();
    g.fillStyle='#fff'; g.beginPath(); g.arc(Z.flowX1,yd,3,0,7); g.fill(); g.beginPath(); g.arc(Z.barX0,yd,3,0,7); g.fill(); g.restore(); }
  // pulsos de EVENTO reales (ballenas/liq/on-chain): viajan flujo -> libro por el cuadrado que corresponde
  for(let i=Z.linkPulses.length-1;i>=0;i--){ const pu=Z.linkPulses[i]; pu.t+=0.03; if(pu.t>1){ Z.linkPulses.splice(i,1); continue; }
    const a=pu.up?Z.flowGateG:Z.flowGateR, b=pu.up?Z.gateG:Z.gateR; if(!a||!b)continue;
    const ax=a.x+a.w, ay=a.y+a.h/2, bx=b.x, by=b.y+b.h/2, mx=ax+(bx-ax)*0.5, t=pu.t, it=1-t;
    const x=it*it*it*ax+3*it*it*t*mx+3*it*t*t*mx+t*t*t*bx, y=it*it*it*ay+3*it*it*t*ay+3*it*t*t*by+t*t*t*by;
    g.save(); g.globalAlpha=0.95; g.shadowColor=`rgba(${pu.col},.95)`; g.shadowBlur=15; g.fillStyle=`rgba(${pu.col},1)`; g.beginPath(); g.arc(x,y,3.3,0,7); g.fill(); g.restore(); }
}

/* ===== cuerda blanca ===== */
function rope(g){ const x0=Z.barX1+5, y0=Z.divY, xm=Z.clX0-10, y1=Z.ropeY, xEnd=W-24;
  g.strokeStyle='rgba(255,255,255,.92)'; g.lineWidth=2.4; g.lineCap='round';
  const mx=(x0+xm)*0.5; g.beginPath(); g.moveTo(x0,y0); g.bezierCurveTo(mx,y0,mx,y1,xm,y1); g.lineTo(xEnd,y1); g.stroke();
  g.fillStyle='#fff'; g.beginPath(); g.arc(x0,y0,3.4,0,7); g.fill(); g.beginPath(); g.arc(xEnd,y1,4.4,0,7); g.fill(); }

/* ===== horquillas ===== */
function clusterThreads(g){
  const bez=(ax,ay,bx,by,col,a,lw,ph)=>{ const mx=ax+(bx-ax)*0.5;
    g.strokeStyle=col; g.globalAlpha=a; g.lineWidth=lw; g.lineCap='round';
    g.beginPath(); g.moveTo(ax,ay); g.bezierCurveTo(mx,ay,mx,by,bx,by); g.stroke();
    const t=((T*0.3+ph)%1+1)%1, it=1-t;
    const px=it*it*it*ax+3*it*it*t*mx+3*it*t*t*mx+t*t*t*bx, py=it*it*it*ay+3*it*it*t*ay+3*it*t*t*by+t*t*t*by;
    g.globalAlpha=0.9; g.fillStyle=col; g.beginPath(); g.arc(px,py,1.9,0,7); g.fill(); };
  [[green,VERDE,Z.gateG],[red,ROSA,Z.gateR]].forEach(([cols,col,gt])=>{
    if(!gt)return;
    const targets=[...(cols[0]||[]),...(cols[1]||[])];
    targets.forEach((c,i)=>{ const baseAy=gt.y+(targets.length>1?i/(targets.length-1):0.5)*gt.h, k=2+(c.id%3);
      for(let j=0;j<k;j++){ const ay=clamp(baseAy+(j-(k-1)/2)*5,gt.y,gt.y+gt.h), by=c._y+c._h/2+(j-(k-1)/2)*6;
        bez(gt.x+gt.w, ay, c._x, by, col, 0.34+0.4*(c._hl||0), 1.3+1.6*(c._hl||0), c.id*0.11+j*0.19+0.03); } });
    for(let ci=1;ci<3;ci++){ const par=cols[ci]||[], ch=cols[ci+1]||[];
      ch.forEach(k=>{ let bp=null,bd=1e9; par.forEach(p=>{ let d=Math.abs((p._y+p._h/2)-(k._y+k._h/2)); if(p.sec===k.sec)d-=500; if(d<bd){bd=d;bp=p;} });
        if(bp)for(let j=0;j<2;j++){ const off=(j-0.5)*6;
          bez(bp._x+bp._w,bp._y+bp._h/2+off,k._x,k._y+k._h/2+off,col,0.42+0.4*(k._hl||0),1.6+2*(k._hl||0),k.id*0.15+j*0.3+0.05); } }); }
  });
  g.globalAlpha=1;
}

/* ===== panel de exchanges ===== */
function logoExch(g,ei,x,y,chip){ const img=EXIMG[ei], cx=x+chip/2, cy=y+chip/2, r=chip/2;
  if(!_exporting&&img&&img.complete&&img.naturalWidth){ g.save(); g.beginPath(); g.arc(cx,cy,r,0,7); g.closePath(); g.clip(); g.fillStyle='#0b1118'; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill(); try{g.drawImage(img,x,y,chip,chip);}catch(_){} g.restore(); return; }
  const e=EXCH[ei], lg=g.createLinearGradient(x,y,x+chip,y+chip); lg.addColorStop(0,hexA(e[2],1)); lg.addColorStop(1,hexA(e[2],.55));
  g.fillStyle=lg; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill();
  g.fillStyle='#06100b'; g.font=`800 ${chip*0.4}px "Saira Condensed",sans-serif`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(e[1],cx,cy+0.5); g.textAlign='left'; g.textBaseline='alphabetic'; }
function exchangeCards(g){ const order=Z.exchOrder||[], n=order.length, gap=5, tot=Z.y1-Z.y0, ch=(tot-gap*Math.max(0,n-1))/Math.max(1,n);
  let net=0,wv=0,maxv=0; COINS.forEach(c=>{ net+=c.disp*c.vol; wv+=c.vol; }); net=wv?net/wv:0;
  order.forEach(ei=>{ if((EXVOL[ei]||0)>maxv)maxv=EXVOL[ei]||0; });
  const col=net>=0?VERDE:ROSA;                 // color por direccion real del mercado
  g.fillStyle='rgba(140,155,170,.85)'; g.font='700 10px "Saira Condensed",sans-serif'; g.textAlign='left'; g.textBaseline='alphabetic';
  g.fillText('LIQUIDITY SOURCES · 24H VOLUME', Z.secX, Z.y0-7);   // rótulo claro: son volúmenes 24h
  order.forEach((ei,i)=>{ const e=EXCH[ei], x=Z.secX, y=Z.y0+i*(ch+gap), w=Z.secW;
    rr(g,x,y,w,ch,6); g.fillStyle='rgba(11,18,26,.85)'; g.fill(); g.strokeStyle=hexA(col,.26); g.lineWidth=1; g.stroke();
    const ez=(Z.exZoom&&Z.exZoom[ei])||0;
    if(ez>0.01){ g.save(); g.shadowColor=hexA(col,.5); g.shadowBlur=14*ez; rr(g,x,y,w,ch,6); g.strokeStyle=hexA(col,0.5+0.45*ez); g.lineWidth=1+1.6*ez; g.stroke(); g.restore(); }
    const chip=Math.min(22,ch*0.52), cyh=y+(ch-chip)/2; logoExch(g,ei,x+8,cyh,chip);
    const tx=x+8+chip+9;
    g.fillStyle='#eaf0f6'; g.font='700 14px "Saira Condensed",sans-serif'; g.textAlign='left'; g.fillText(e[0],tx,y+ch*0.44);
    const vol=EXVOL[ei]||0, vtxt=vol?('$'+fmtVol(vol)):'—';
    g.font='600 11px "IBM Plex Mono",monospace'; g.textAlign='right'; g.fillStyle='rgba(188,199,212,.95)'; g.fillText(vtxt,x+w-9,y+ch*0.44);
    const vw=g.measureText(vtxt).width; g.font='600 9px "Saira Condensed",sans-serif'; g.fillStyle='rgba(118,132,146,.85)'; g.fillText('24h',x+w-9-vw-6,y+ch*0.44); g.textAlign='left';
    const frac=maxv?vol/maxv:0, bw2=w-(tx-x)-9, cy=y+ch-10, chh=Math.min(7,ch*0.2), fbw=Math.max(2,bw2*frac);
    g.fillStyle='rgba(255,255,255,.07)'; rr(g,tx,cy,bw2,chh,1.5); g.fill();
    g.fillStyle=col; g.globalAlpha=.85; rr(g,tx,cy,fbw,chh,1.5); g.fill(); g.globalAlpha=1;
    // brillo que fluye por la barra: señala actividad en vivo sin falsear el valor (24h real)
    g.save(); rr(g,tx,cy,fbw,chh,1.5); g.clip(); const sx=tx+((T*55+ei*37)%(fbw+46))-23;
    const sg=g.createLinearGradient(sx-14,0,sx+14,0); sg.addColorStop(0,'rgba(255,255,255,0)'); sg.addColorStop(.5,'rgba(255,255,255,.38)'); sg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=sg; g.fillRect(tx,cy,fbw,chh); g.restore();
    // actividad en vivo: partículas de liquidez fluyendo por la fila (siempre en movimiento)
    const span=w-18; for(let d=0;d<3;d++){ const fx=x+9+((T*30+ei*41+d*(span/3))%span), aa=0.12+0.16*Math.sin(T*2.4+d*2+ei);
      if(aa>0){ g.fillStyle=hexA(col,aa); g.beginPath(); g.arc(fx,y+ch*0.5,1.5,0,7); g.fill(); } }
    g.globalAlpha=1; }); }
/* tarjeta emergente del exchange al pasar el cursor: datos REALES (CoinGecko) útiles para un trader */
function exchPopup(g){ const ei=Z.exHover; if(ei==null||ei<0)return; const order=Z.exchOrder||[], idx=order.indexOf(ei); if(idx<0)return;
  const e=EXCH[ei], m=EXMETA[ei]||{}, gap=5, tot=Z.y1-Z.y0, n=order.length, ch=(tot-gap*Math.max(0,n-1))/Math.max(1,n);
  const ry=Z.y0+idx*(ch+gap);
  const pw=218, ph=152, px=Z.secX+Z.secW+12, py=clamp(ry-8,Z.y0,Math.max(Z.y0,H-ph-8));
  g.save(); g.shadowColor='rgba(0,0,0,.6)'; g.shadowBlur=24; rr(g,px,py,pw,ph,12); g.fillStyle='rgba(12,18,26,.985)'; g.fill(); g.restore();
  rr(g,px,py,pw,ph,12); g.strokeStyle=hexA(AZUL,.5); g.lineWidth=1.2; g.stroke();
  cornerMarks(g,px,py,pw,ph,12,hexA(AZUL,.6),1.4);
  const chip=30, cyh=py+14; logoExch(g,ei,px+14,cyh,chip);
  g.textBaseline='alphabetic'; g.textAlign='left';
  g.fillStyle='#eef4fb'; g.font='800 17px "Saira Condensed",sans-serif'; g.fillText(e[0],px+14+chip+10,py+26);
  g.fillStyle='rgba(125,135,148,.9)'; g.font='600 9px "Saira Condensed",sans-serif'; g.fillText(m.src?('DEX · 24H VOLUME · '+String(m.src).toUpperCase()):'EXCHANGE · 24H DATA',px+14+chip+10,py+39);
  const rows=[['24h Volume', m.volUsd? '$'+fmtVol(m.volUsd):'—'], ['Trust rank', m.rank? '#'+m.rank:'—'], ['Trust score', m.trust? m.trust+' / 10':'—'], ['Established', m.year? String(m.year):'—'], ['Country', m.country||'—']];
  let yy=py+62; rows.forEach(([k,v])=>{ g.strokeStyle='rgba(255,255,255,.05)'; g.lineWidth=1; g.beginPath(); g.moveTo(px+14,yy+5); g.lineTo(px+pw-14,yy+5); g.stroke();
    g.fillStyle='rgba(150,162,175,.92)'; g.font='600 12px "Saira Condensed",sans-serif'; g.textAlign='left'; g.fillText(k,px+14,yy);
    g.fillStyle='#e6edf4'; g.font='600 12px "IBM Plex Mono",monospace'; g.textAlign='right'; g.fillText(v,px+pw-14,yy); yy+=18; }); g.textAlign='left'; }

/* ===== tarjeta ===== */
function logoChip(g,c,x,y,chip,col,hi){
  const img=LOGO[c.sym], cx=x+chip/2, cy=y+chip/2, r=chip/2;
  if(!_exporting && img && img.complete && img.naturalWidth){ g.save(); g.beginPath(); g.arc(cx,cy,r,0,7); g.closePath(); g.clip();
    g.fillStyle='#0b1118'; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill(); try{ g.drawImage(img,x,y,chip,chip); }catch(_){}
    g.restore(); g.strokeStyle=hexA(col,.5); g.lineWidth=1; g.beginPath(); g.arc(cx,cy,r,0,7); g.stroke(); return; }
  // placeholder NEUTRAL (nunca verde/rojo): un logo que aún no carga no debe teñirse del color de la tarjeta
  const lg=g.createLinearGradient(x,y,x+chip,y+chip); lg.addColorStop(0,'#2a3340'); lg.addColorStop(1,'#141a22');
  g.fillStyle=lg; g.beginPath(); g.arc(cx,cy,r,0,7); g.fill();
  g.strokeStyle='rgba(255,255,255,.14)'; g.lineWidth=1; g.beginPath(); g.arc(cx,cy,r,0,7); g.stroke();
  g.fillStyle='rgba(205,215,228,.82)'; g.font=`800 ${chip*0.4}px "Saira Condensed",sans-serif`; g.textAlign='center'; g.textBaseline='middle';
  g.fillText((c.sym||'··').slice(0,3),cx,cy+0.5); g.textAlign='left'; g.textBaseline='alphabetic';
}
function card(g,c){ const up=c._up, col=up?VERDE:ROSA, hi=up?VHI:RHI, hl=c._hl||0, ci=c._ci, rad=ci>=2?10:5, z=c._z||0;
  // zoom PAREJO: toda tarjeta crece hacia un tamano objetivo comun (grande y legible)
  const TW=Z.cardTW||220, TH=Z.cardTH||176;
  const w=c._w+(Math.max(c._w,TW)-c._w)*z, h=c._h+(Math.max(c._h,TH)-c._h)*z;
  const cx=c._x+c._w/2, cy=c._y+c._h/2;
  let x=cx-w/2, y=cy-h/2; x=clamp(x,6,W-w-6); y=clamp(y,(Z.y0||8)-14,H-h-8);
  if(z>0.01){ g.save(); g.shadowColor=hexA(col,.45); g.shadowBlur=16*z; rr(g,x,y,w,h,rad); g.fillStyle='rgba(6,12,10,.98)'; g.fill(); g.restore(); }
  rr(g,x,y,w,h,rad);
  const bg=g.createLinearGradient(0,y,0,y+h);
  bg.addColorStop(0,up?'rgba(10,40,29,.96)':'rgba(44,13,21,.96)'); bg.addColorStop(1,up?'rgba(5,17,13,.98)':'rgba(22,8,12,.98)');
  g.fillStyle=bg; g.fill();
  const em=Math.max(hl,z);
  g.strokeStyle=hexA(col,0.45+0.5*em); g.lineWidth=1.1+em; rr(g,x,y,w,h,rad); g.stroke();
  cornerMarks(g,x,y,w,h,8,hexA(col,0.5+0.45*em),1.2);
  const pad=Math.max(7,w*0.045);
  const chip=clamp(h*0.2,14,24); logoChip(g,c,x+pad,y+pad,chip,col,hi);
  const tx=x+pad+chip+8, fs=clamp(h*0.14,12,ci>=2?20:15);
  g.fillStyle='#eef5fb'; g.font=`700 ${fs}px "Saira Condensed",sans-serif`; g.fillText(c.sym||'—',tx,y+pad+fs*0.82);
  g.fillStyle=col; g.font=`600 ${fs*0.76}px "IBM Plex Mono",monospace`; g.textAlign='left'; g.fillText((c.disp>=0?'+':'')+c.disp.toFixed(2)+'%',tx,y+pad+fs*0.82+fs*0.82);
  // precio actual a la derecha del encabezado
  const pr=c.price||c.cur||0; if(pr>0){ g.fillStyle='#cdd7e2'; g.font=`600 ${clamp(fs*0.72,10,14)}px "IBM Plex Mono",monospace`; g.textAlign='right'; g.fillText('$'+fmtP(pr),x+w-pad,y+pad+fs*0.82); g.textAlign='left'; }
  const vx=x+pad, vy=y+pad+chip+8, vw=w-pad*2, vh=y+h-pad-7-vy;
  // etiqueta de OPORTUNIDAD (dato real): rompe resistencia, recupera soporte o momentum fuerte.
  const zoomed=(z>0.35 && c._mini && c._mini.length>=2);
  if(!zoomed && vh>14){ let bdg=null;
    if(c.res>0 && c.price>c.res) bdg=['BREAKOUT','43,245,158'];
    else if(c.sup>0 && c.price>0 && c.price<=c.sup*1.012 && c.disp>=0) bdg=['RECLAIM','33,145,217'];
    else if(c.disp>=8) bdg=['MOMENTUM','196,255,226'];
    if(bdg){ g.font='800 11px "Saira Condensed",sans-serif'; const tw=g.measureText(bdg[0]).width, pw=tw+18, ph=19;
      g.fillStyle=`rgba(${bdg[1]},.18)`; rr(g,vx,vy,pw,ph,6); g.fill(); g.strokeStyle=`rgba(${bdg[1]},.7)`; g.lineWidth=1; rr(g,vx,vy,pw,ph,6); g.stroke();
      g.fillStyle=`rgba(${bdg[1]},1)`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(bdg[0],vx+pw/2,vy+ph/2+0.5); g.textAlign='left'; g.textBaseline='alphabetic'; } }
  // cuerpo: la mini gráfica diaria cuando hay zoom (precargada -> sin parpadeo). En reposo, limpio.
  if(z>0.35 && vh>16 && c._mini && c._mini.length>=2){
    const data=c._mini.slice(-46); let mlo=Infinity,mhi=-Infinity;
    data.forEach(k=>{ if(k.low<mlo)mlo=k.low; if(k.high>mhi)mhi=k.high; });
    if(mhi>mlo){ const n=data.length, cw=vw/n, bw=Math.max(1,cw*0.6), yOf=p=>vy+vh-((p-mlo)/(mhi-mlo))*vh;
      for(let i=0;i<n;i++){ const k=data[i], u2=k.close>=k.open, cc=u2?VERDE:ROSA, cx2=vx+i*cw+cw/2;
        g.strokeStyle=cc; g.globalAlpha=.85; g.lineWidth=1; g.beginPath(); g.moveTo(cx2,yOf(k.high)); g.lineTo(cx2,yOf(k.low)); g.stroke();
        const oy=yOf(k.open),cyy=yOf(k.close),bt=Math.min(oy,cyy),bh2=Math.max(1,Math.abs(cyy-oy)); g.fillStyle=cc; g.globalAlpha=u2?.9:.82; g.fillRect(cx2-bw/2,bt,bw,bh2); }
      g.globalAlpha=1;
      const mlvl=(price,tcol,tg)=>{ if(!(price>0)||price<mlo||price>mhi)return; const ly=yOf(price);
        g.strokeStyle=hexA(tcol,.85); g.setLineDash([3,3]); g.lineWidth=1; g.beginPath(); g.moveTo(vx,ly); g.lineTo(vx+vw,ly); g.stroke(); g.setLineDash([]);
        const t=fmtP(price); g.font='600 10px "IBM Plex Mono",monospace'; const pw=g.measureText(t).width+16; rr(g,vx+vw-pw,ly-7,pw,14,3); g.fillStyle='rgba(236,243,249,.96)'; g.fill();
        g.fillStyle=tcol; g.font='800 9px "Saira Condensed",sans-serif'; g.textBaseline='middle'; g.fillText(tg,vx+vw-pw+3,ly);
        g.fillStyle='#0a1510'; g.font='600 10px "IBM Plex Mono",monospace'; g.textAlign='right'; g.fillText(t,vx+vw-4,ly); g.textAlign='left'; g.textBaseline='alphabetic'; };
      if(c.res>0) mlvl(c.res,ROSA,'▼'); if(c.sup>0) mlvl(c.sup,VERDE,'▲');
    }
  }
  // fundido de entrada: la moneda nueva emerge del fondo en vez de aparecer de golpe
  const ap=(c._appear==null?1:c._appear); if(ap<1){ g.fillStyle=`rgba(5,7,11,${(1-ap).toFixed(3)})`; rr(g,x,y,w,h,rad); g.fill(); }
}
function drawCards(g){ const all=[]; [green,red].forEach(cols=>cols.forEach(col=>col.forEach(c=>all.push(c))));
  let hov=null; for(const c of all){ if((c._z||0)>0.5 && (!hov||c._z>hov._z)) hov=c; }
  for(const c of all){ if(c!==hov) card(g,c); }
  if(hov) card(g,hov); }

/* ===== header ===== */
function header(g){ g.textBaseline='alphabetic'; g.textAlign='left';
  // (los números de escala +5/+3/… se quitaron: chocaban con el rótulo del termómetro)
  const d=new Date(),p2=x=>String(x).padStart(2,'0');
  g.textAlign='right'; g.fillStyle='rgba(83,103,122,.65)'; g.font='400 11px "IBM Plex Mono",monospace'; g.fillText(`${d.getUTCFullYear()}-${p2(d.getUTCMonth()+1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`,W-18,H-14); g.textAlign='left'; }

/* ===== hover ===== */
function hover(){ strands.forEach(s=>s.hl=Math.max(0,s.hl-0.08)); COINS.forEach(c=>c._hl=Math.max(0,(c._hl||0)-0.08));
  // zoom de tarjetas (siempre corre: decae aunque no haya cursor)
  const vis=tarjetasVisibles(); let tgt=null;
  vis.forEach(c=>{ if(c._appear==null)c._appear=1; else if(c._appear<1)c._appear=Math.min(1,c._appear+0.035); });   // fundido de entrada
  if(mouse.on){ for(const c of vis){ if(mouse.x>=c._x&&mouse.x<=c._x+c._w&&mouse.y>=c._y&&mouse.y<=c._y+c._h){ tgt=c; break; } } }
  vis.forEach(c=>{ const to=(c===tgt)?1:0; c._z=(c._z||0)+(to-(c._z||0))*0.2; if(c._z<0.001)c._z=0; });
  if(tgt){ tgt._hl=1;
    if(!tgt._mini && !tgt._miniBusy){ tgt._miniBusy=true;      // velas diarias REALES para la mini gráfica del hover
      D.velas(tgt.symbol,'1d',46).then(k=>{ tgt._mini=(k&&k.length)?k:[]; }).catch(()=>{ tgt._mini=[]; }); } }
  // hover sobre el panel de exchanges (zoom de la fila + tarjeta de info real)
  Z.exZoom=Z.exZoom||{}; Z.exHover=-1;
  { const order=Z.exchOrder||[], nn=order.length, gp=5, tt=Z.y1-Z.y0, chh=(tt-gp*Math.max(0,nn-1))/Math.max(1,nn);
    if(mouse.on && mouse.x>=Z.secX && mouse.x<=Z.secX+Z.secW){ for(let i=0;i<nn;i++){ const yy=Z.y0+i*(chh+gp); if(mouse.y>=yy&&mouse.y<=yy+chh){ Z.exHover=order[i]; break; } } }
    order.forEach(ei=>{ const to=(ei===Z.exHover)?1:0; Z.exZoom[ei]=(Z.exZoom[ei]||0)+(to-(Z.exZoom[ei]||0))*0.2; if(Z.exZoom[ei]<0.001)Z.exZoom[ei]=0; }); }
  if(!mouse.on)return;
  if(mouse.x>Z.funX0-20&&mouse.x<Z.flowX0+30){ let best=null,bd=1e9;
    strands.forEach(s=>{ const pts=strandPath(s); for(let i=0;i<pts.length;i+=4){ const dx=pts[i][0]-mouse.x,dy=pts[i][1]-mouse.y,d=dx*dx+dy*dy; if(d<bd){bd=d;best=s;} } });
    if(best&&bd<1100){ best.hl=1; const ex=best.exch;
      strands.forEach(s=>{ if(s.exch===ex)s.hl=Math.max(s.hl,0.7); });
      [green,red].forEach(cols=>cols.forEach(col=>col.forEach(c=>{ if(c.exch===ex)c._hl=1; }))); } }
}

/* ===== loop ===== */
function renderOnce(){
  substrate();
  glx.setTransform(1,0,0,1,0,0); glx.clearRect(0,0,PW,PH); glx.setTransform(DPR,0,0,DPR,0,0);
  drawStrands(glx); flowBar(glx); linkRects(glx); filterBar(glx); clusterThreads(glx); rope(glx);
  ctx.setTransform(1,0,0,1,0,0);
  // glow barato: reduce a la mitad, desenfoque chico y lo re-escala (mucho mas ligero que blur a resolucion completa)
  sbx.setTransform(1,0,0,1,0,0); sbx.clearRect(0,0,SBW,SBH); sbx.imageSmoothingEnabled=true; sbx.drawImage(GL,0,0,PW,PH,0,0,SBW,SBH);
  ctx.save(); ctx.filter='blur(2px)'; ctx.globalAlpha=0.6; ctx.imageSmoothingEnabled=true; ctx.drawImage(SB,0,0,SBW,SBH,0,0,PW,PH); ctx.restore();
  ctx.globalAlpha=1; ctx.drawImage(GL,0,0); ctx.setTransform(DPR,0,0,DPR,0,0);
  thermo(ctx); exchangeCards(ctx); drawCards(ctx); header(ctx); syncExPopup();
}
function frame(now){ const dt=Math.min(0.05,(now-last)/1000||0.016); last=now; tick(dt); hover(); renderOnce(); RAF=requestAnimationFrame(frame); }

/* ===== datos reales ===== */
function synthVP(pct){ const M=24, v=[], cen=M*(0.5-clamp(pct,-8,8)/26);
  for(let i=0;i<M;i++){ const d=(i-cen)/(M*0.22); v.push(Math.exp(-d*d)*(0.5+Math.random()*0.5)+Math.random()*0.1); } return v; }
async function cargarUniverso(){
  let u=[]; try{ u=await D.universo(200); }catch(_){ u=[]; }
  COINS=u.map((x,idx)=>({ id:idx, symbol:x.symbol, sym:x.sym, sec:x.sector, exch:idx%EXCH.length, major:x.major,
    pct:x.chgPct, disp:x.chgPct, vel:0, rank:0, vol:x.volQuote, price:x.price, cur:x.price,
    res:x.price*1.05, sup:x.price*0.95, vp:synthVP(x.chgPct), vpHi:0, vpLo:0, ini:Math.random()*6.28 }));
  COINS.slice().sort((a,b)=>Math.abs(b.pct)-Math.abs(a.pct)).forEach((c,i)=>c.rank=i+1);
}
function aplicarTick(map){ let upW=0,dnW=0;
  for(const c of COINS){ const t=map[c.symbol]; if(t){
    const prev=_prevPx[c.symbol]; if(prev!=null){ const w=c.vol||1; if(t.price>prev)upW+=w; else if(t.price<prev)dnW+=w; }
    _prevPx[c.symbol]=t.price;
    c.pct=t.chgPct; c.price=t.price; if(t.volQuote>0)c.vol=t.volQuote; } }
  const tw=upW+dnW; if(tw>0){ flowLive+=((upW/tw)-flowLive)*0.25; } }  // flujo direccional de respaldo
// aggTrade: suma presión de taker (compra/venta real) y dispara un PULSO cuando entra una ballena
const UMBRAL_BALLENA=60000;   // una operación agresiva de ~$60k o más
function onTrade(t){ if(!t)return; if(t.buy)_takBuy+=t.quote; else _takSell+=t.quote;
  if(t.quote>=UMBRAL_BALLENA){ const now=performance.now();
    for(const s of strands){ if(s.coin&&s.coin.symbol===t.symbol){ if(now-(s._wcool||0)<450)break; s._wcool=now; s._wp=0; s.hl=1; s._wbuy=t.buy; s._wmag=clamp(t.quote/250000,0.5,1.8);
      // la MISMA ballena que viaja por el hilo SE REGISTRA en el WHALE FLOW (historial tocable, ya no se pierde)
      if(t.quote>=120000){ const sym=t.symbol.replace('USDT',''); flowPush({cls:t.buy?'buy':'sell',label:t.buy?'BIG BUY':'BIG SELL',coin:sym,sym:sym,size:'$'+fmtVol(t.quote),usd:t.quote,src:'Binance Spot',up:!!t.buy,col:t.buy?'43,245,158':'255,77,110'}); }
      break; } } } }
let _nivBusy=false;
async function refrescarNiveles(){ if(_nivBusy)return; _nivBusy=true;
  try{ const vis=tarjetasVisibles();
    for(const c of vis){ try{ const nv=await D.niveles(c.symbol,'4h'); if(nv){ c.vp=nv.vp.map(p=>p.v); c.vpHi=nv.hi; c.vpLo=nv.lo; c.cur=nv.cur; c.sup=nv.sup; c.res=nv.res; } }catch(_){}
      await new Promise(r=>setTimeout(r,60)); }      // escalonado, no satura la API
  } finally{ _nivBusy=false; }
}
let _miniBusy=false;
// precarga las velas diarias de las tarjetas visibles para que la mini gráfica del hover
// aparezca al instante (sin el parpadeo del perfil de volumen).
async function precargarMinis(){ if(_miniBusy)return; _miniBusy=true;
  try{ const vis=tarjetasVisibles();
    for(const c of vis){ if(c._mini)continue; try{ const k=await D.velas(c.symbol,'1d',46); c._mini=(k&&k.length)?k:[]; }catch(_){ c._mini=c._mini||[]; }
      await new Promise(r=>setTimeout(r,45)); }
  } finally{ _miniBusy=false; }
}
async function cargarLogos(){
  let cg={}, m={};
  try{ cg=await sharedLogos(); }catch(_){ cg={}; }
  try{ m=await D.logosPorSimbolo(); }catch(_){ m={}; }
  COINS.forEach(c=>{ if(!_symUrl[c.sym]){ const u=(PARMAP[c.sym]&&cg[PARMAP[c.sym]])||m[c.sym]; if(u)_symUrl[c.sym]=u; } });
  Object.values(EXTOKEN).forEach(sym=>{ if(!_symUrl[sym]){ const u=(PARMAP[sym]&&cg[PARMAP[sym]])||m[sym]; if(u)_symUrl[sym]=u; } });
  COINS.forEach(c=>{ if(!LOGO[c.sym]) LOGO[c.sym]=imgLogo(c.sym,_symUrl[c.sym]); });   // spothq por ticker + respaldo CoinGecko
  EXCH.forEach((e,i)=>{ if(EXIMG[i])return; const tk=EXTOKEN[e[0]]; if(tk) EXIMG[i]=imgLogo(tk,_symUrl[tk]); }); }  // DEX -> icono del token
async function cargarExchanges(){ let list=[]; try{ list=await D.exchanges(); }catch(_){ list=[]; }
  const btc=((COINS.find(c=>c.sym==='BTC')||{}).price)||0;
  EXCH.forEach((e,i)=>{ const first=e[0].toLowerCase().split(' ')[0];
    let best=null; for(const x of list){ const xn=(x.name||'').toLowerCase(); if(xn.indexOf(first)>=0){ if(!best||x.volBtc>best.volBtc)best=x; } }
    if(best){ EXVOL[i]=best.volBtc*(btc||1); EXMETA[i]={rank:best.rank,trust:best.trust,year:best.year,country:best.country,volUsd:EXVOL[i]}; }
    if(!EXIMG[i]){ if(best&&best.image){ EXIMG[i]=imgExch(i,best.image); }        // marca real del exchange (CORS)
      else { const tk=EXTOKEN[e[0]]; if(tk) EXIMG[i]=imgLogo(tk,_symUrl[tk]); } } });  // DEX -> icono de su token
  // Volumen 24h REAL de los DEX desde DefiLlama (más fiel que CoinGecko). Respaldo: CoinGecko.
  try{ const dv=await D.dexVol(); if(dv&&Object.keys(dv).length){ EXCH.forEach((e,i)=>{ const first=e[0].toLowerCase().split(' ')[0];
    let best=0; for(const k in dv){ if(k.indexOf(first)>=0 && dv[k]>best)best=dv[k]; }
    if(best>0){ EXVOL[i]=best; EXMETA[i]=EXMETA[i]||{}; EXMETA[i].volUsd=best; EXMETA[i].src='DefiLlama'; } }); } }catch(_){}
  EXREADY=true; if(cv) buildStrands(); }

/* ===== estilos + overlay ===== */
const IC={
  back:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  exp:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>',
  x:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  full:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  search:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  info:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.6" r="0.6" fill="currentColor"/></svg>',
  sndOff:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l4 4M21 9l-4 4"/></svg>',
  sndOn:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19.5 6a9 9 0 0 1 0 12"/></svg>'
};
function estilos(){
  if(!document.getElementById('obliq-font')){ const l=document.createElement('link'); l.id='obliq-font'; l.rel='stylesheet';
    l.href='https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap'; document.head.appendChild(l); }
  if(document.getElementById('obliq-css'))return;
  const s=document.createElement('style'); s.id='obliq-css'; s.textContent=`
  #ob-overlay{position:fixed;inset:0;z-index:9000;display:flex;flex-direction:column;background:
     radial-gradient(120% 70% at 58% 6%, rgba(16,38,52,.28), rgba(3,6,11,0) 55%),
     radial-gradient(80% 80% at 52% 122%, rgba(9,24,20,.4), rgba(3,5,10,0) 60%),
     linear-gradient(180deg,#05080f 0%,#04060c 55%,#03050a 100%);overflow:hidden;font-family:'Saira Condensed','Arial Narrow',system-ui,sans-serif}
  .ob-top{display:flex;align-items:center;gap:8px;flex:0 0 auto;padding:8px 12px;background:linear-gradient(180deg,#141922,#0d1117);border-bottom:1px solid #2b3139}
  .ob-back{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 13px 0 10px;border-radius:9px;border:1px solid #2b3139;
    background:rgba(255,255,255,.04);color:#b7bdc6;cursor:pointer;font-family:'Saira Condensed',sans-serif;font-weight:700;font-size:13px}
  .ob-back svg{display:block}
  .ob-back:hover{border-color:#C9A84B;color:#E8B84B}
  .ob-brand{display:inline-flex;align-items:center;gap:8px;margin-left:4px;color:#d7deea;font-weight:700;font-size:15px;letter-spacing:.05em;text-transform:uppercase}
  .ob-brand .d{width:7px;height:7px;border-radius:50%;background:#2BF59E;box-shadow:0 0 9px #2BF59E}
  .ob-brand small{color:#5c6773;font-weight:500;font-size:11px;letter-spacing:.14em}
  .ob-sp{flex:1 1 auto}
  .ob-ico{width:38px;height:36px;border-radius:9px;display:grid;place-items:center;cursor:pointer;border:1px solid #2b3139;background:rgba(255,255,255,.04);color:#b7bdc6}
  .ob-ico svg{display:block}
  .ob-ico:hover{border-color:#C9A84B;color:#E8B84B}
  .ob-search{position:relative;display:flex;align-items:center;gap:7px;height:36px;padding:0 12px;border-radius:9px;border:1px solid #2b3139;background:rgba(255,255,255,.04);color:#7d8794;min-width:210px;max-width:320px;flex:0 1 300px}
  .ob-search:focus-within{border-color:#C9A84B;color:#E8B84B}
  .ob-search svg{flex:0 0 auto}
  .ob-search input{flex:1 1 auto;min-width:0;background:transparent;border:0;outline:0;color:#eaf0f6;font:600 13px 'IBM Plex Mono',monospace}
  .ob-search input::placeholder{color:#5c6773;font-weight:500}
  .ob-sug{position:absolute;top:42px;left:0;right:0;z-index:50;display:none;max-height:320px;overflow:auto;border-radius:11px;border:1px solid #2b3139;background:#0d1117;box-shadow:0 22px 50px rgba(0,0,0,.6)}
  .ob-sug.open{display:block}
  .ob-sugi{display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04)}
  .ob-sugi:hover,.ob-sugi.on{background:rgba(232,184,75,.1)}
  .ob-sugi .ic{width:22px;height:22px;border-radius:50%;background-size:cover;background-position:center;flex:0 0 auto;background-color:#1a2230}
  .ob-sugi .sy{color:#eaf0f6;font:700 13px 'Saira Condensed',sans-serif}
  .ob-sugi .nm{color:#7d8794;font:500 12px 'Saira Condensed',sans-serif;flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .ob-sugi .pc{font:600 12px 'IBM Plex Mono',monospace}
  .ob-info-ov{position:fixed;inset:0;z-index:9500;display:grid;place-items:center;background:rgba(3,5,10,.74);backdrop-filter:blur(3px);animation:obfade .2s}
  .ob-info-card{width:min(92vw,560px);max-height:88vh;overflow:auto;border-radius:18px;border:1px solid #2b3139;background:linear-gradient(180deg,#0c1119,#070b12);box-shadow:0 30px 90px rgba(0,0,0,.6);padding:26px 26px 22px}
  .ob-info-card h2{margin:0;font:800 23px 'Saira Condensed',sans-serif;letter-spacing:.01em;color:#eef4fb}
  .ob-info-card .tag{display:inline-block;margin:10px 0 14px;padding:4px 10px;border-radius:999px;border:1px solid rgba(232,184,75,.4);color:#E8B84B;font:700 10.5px 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase}
  .ob-info-card p{margin:0 0 13px;color:#b9c4d0;font-size:13.5px;line-height:1.6}
  .ob-info-card .feat{display:flex;gap:10px;margin:0 0 10px;color:#cdd7e2;font-size:13px;line-height:1.5}
  .ob-info-card .feat b{color:#2BF59E;font-weight:700}
  .ob-info-x{float:right;margin:-6px -6px 0 0;width:34px;height:34px;border-radius:9px;border:1px solid #2b3139;background:rgba(255,255,255,.04);color:#b7bdc6;cursor:pointer;display:grid;place-items:center}
  .ob-info-x:hover{border-color:#FF4D6E;color:#fff}
  @media(max-width:620px){
    .ob-top{gap:6px;padding:7px 9px}
    .ob-search{min-width:0;flex:1 1 auto;padding:0 9px;gap:6px}
    .ob-search input{font-size:12px}
    .ob-back{padding:0 10px;font-size:0}
    .ob-back svg{width:17px;height:17px}
    .ob-info-card{padding:20px 18px 18px}
  }
  /* pulso de mercado, ahora en la barra superior (Fear&Greed / MCAP / BTC.D) */
  .ob-pulse{flex:0 0 auto;display:flex;align-items:center;gap:13px;font:700 11px 'IBM Plex Mono',monospace;color:#9aa6b2;margin-right:2px}
  .ob-pulse .k{color:#6b7784;font:800 9px 'Saira Condensed',sans-serif;letter-spacing:.1em;margin-right:4px}
  .ob-pulse .v{color:#eef4fb}
  .ob-fng{display:inline-flex;align-items:center;gap:6px}
  .ob-fngdot{width:9px;height:9px;border-radius:50%}
  @media(max-width:1040px){ .ob-pulse .mcap,.ob-pulse .dom{display:none} }
  @media(max-width:780px){ .ob-pulse{display:none} }
  /* ===== feed de FLUJO dentro del rectángulo (ballenas / liquidaciones / on-chain) ===== */
  .ob-flow{position:absolute;z-index:4;pointer-events:none;display:flex;flex-direction:column}
  .ob-flowlist{display:flex;flex-direction:column;gap:5px;width:100%;height:100%;overflow-y:auto;overflow-x:hidden;pointer-events:auto;
    mask-image:linear-gradient(180deg,#000 0,#000 90%,transparent);-webkit-mask-image:linear-gradient(180deg,#000 0,#000 90%,transparent)}
  .ob-fl{pointer-events:auto;cursor:pointer;flex:0 0 auto;border-left:2px solid #2b3139;background:rgba(9,14,21,.6);border-radius:5px;padding:4px 7px;
    box-shadow:0 3px 11px rgba(0,0,0,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:obflin .34s ease;transition:transform .12s ease,border-color .12s ease}
  .ob-fl:hover{transform:translateX(2px);border-color:rgba(232,184,75,.65)}
  @keyframes obflin{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
  .ob-fl .fl-top{display:flex;align-items:center;gap:5px;font:800 9.5px 'Saira Condensed',sans-serif;letter-spacing:.04em;white-space:nowrap}
  .ob-fl .dot{width:6px;height:6px;border-radius:50%;flex:0 0 auto}
  .ob-fl .cn{color:#8a97a4;font-weight:700;margin-left:auto}
  .ob-fl .fl-sz{font:600 11px 'IBM Plex Mono',monospace;color:#eef4fb;margin-top:1px;line-height:1.15}
  .ob-fl.buy{border-left-color:#2BF59E} .ob-fl.buy .dot{background:#2BF59E;box-shadow:0 0 6px #2BF59E} .ob-fl.buy b{color:#9effc9}
  .ob-fl.sell{border-left-color:#FF4D6E} .ob-fl.sell .dot{background:#FF4D6E;box-shadow:0 0 6px #FF4D6E} .ob-fl.sell b{color:#ffb3c0}
  .ob-fl.liq{border-left-color:#E8B84B} .ob-fl.liq .dot{background:#E8B84B;box-shadow:0 0 6px #E8B84B} .ob-fl.liq b{color:#ffd98a}
  .ob-fl.chain{border-left-color:#2191D9} .ob-fl.chain .dot{background:#2191D9;box-shadow:0 0 6px #2191D9} .ob-fl.chain b{color:#bfe0ff}
  .ob-fl.fresh{box-shadow:0 0 0 1px rgba(255,255,255,.16),0 7px 18px rgba(0,0,0,.5)}
  /* ficha técnica al pasar el cursor (logo, from->to, cantidad, origen, copiar, explorador) */
  .ob-flowcard{position:absolute;z-index:8;opacity:0;pointer-events:none;width:236px;padding:12px 13px;border-radius:12px;
    background:rgba(12,18,26,.985);border:1px solid #243041;box-shadow:0 18px 46px rgba(0,0,0,.62);transition:opacity .14s ease}
  .ob-flowcard .fc-head{display:flex;align-items:center;gap:10px;margin-bottom:9px}
  .ob-flowcard .fc-logo{width:34px;height:34px;border-radius:50%;flex:0 0 auto;background:#0b1118 center/cover no-repeat;border:1px solid rgba(255,255,255,.1);display:grid;place-items:center;font:800 12px 'Saira Condensed',sans-serif;color:#cdd7e2}
  .ob-flowcard .fc-coin{font:800 18px 'Saira Condensed',sans-serif;color:#eef4fb;letter-spacing:.02em}
  .ob-flowcard .fc-type{font:700 9.5px 'Saira Condensed',sans-serif;letter-spacing:.09em;color:#8a97a4}
  .ob-flowcard .fc-type.buy{color:#9effc9} .ob-flowcard .fc-type.sell{color:#ffb3c0} .ob-flowcard .fc-type.liq{color:#ffd98a} .ob-flowcard .fc-type.chain{color:#bfe0ff}
  .ob-flowcard .fc-amt{font:700 16px 'IBM Plex Mono',monospace;color:#fff;margin-bottom:6px}
  .ob-flowcard .fc-rows{display:flex;flex-direction:column}
  .ob-flowcard .fc-row,.ob-flowcard .fc-adr{display:flex;align-items:center;gap:8px;padding:4px 0;border-top:1px solid rgba(255,255,255,.055);font:600 11.5px 'Saira Condensed',sans-serif}
  .ob-flowcard .fc-row>span,.ob-flowcard .fc-adr>span{color:#8a97a4;flex:0 0 auto;white-space:nowrap}
  .ob-flowcard .fc-row>b{margin-left:auto;color:#e6edf4;font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:11px;white-space:nowrap;text-align:right}
  .ob-flowcard .fc-adr code{color:#cfe0ee;font:600 11.5px 'IBM Plex Mono',monospace;margin-right:auto;white-space:nowrap}
  .ob-flowcard .fc-b{cursor:pointer;width:22px;height:20px;display:grid;place-items:center;border:1px solid #2b3139;border-radius:5px;background:rgba(255,255,255,.05);color:#aeb9c6;font-size:11px;flex:0 0 auto}
  .ob-flowcard .fc-adr .fc-b+.fc-b{margin-left:5px}
  .ob-flowcard .fc-b:hover{border-color:#C9A84B;color:#E8B84B}
  .ob-flowcard .fc-read{margin-top:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,.08)}
  .ob-flowcard .fc-read>span{display:block;font:800 8px 'Saira Condensed',sans-serif;letter-spacing:.16em;color:#6b7784;margin-bottom:3px;text-transform:uppercase}
  .ob-flowcard .fc-read>p{margin:0;font:600 11.5px 'Saira Condensed',sans-serif;color:#c7d2de;line-height:1.32}
  /* popup de exchange (DOM, POR DELANTE del feed, con sombra) */
  .ob-expop{position:absolute;z-index:7;opacity:0;pointer-events:none;width:220px;padding:12px 13px;border-radius:12px;
    background:rgba(12,18,26,.985);border:1px solid rgba(33,145,217,.5);box-shadow:0 16px 42px rgba(0,0,0,.62);transition:opacity .12s ease}
  .ob-expop .xp-h{display:flex;align-items:center;gap:10px;margin-bottom:9px}
  .ob-expop .xp-logo{width:30px;height:30px;border-radius:50%;flex:0 0 auto;background:#0b1118 center/cover no-repeat;border:1px solid rgba(255,255,255,.1);display:grid;place-items:center;font:800 11px 'Saira Condensed',sans-serif;color:#cdd7e2}
  .ob-expop .xp-n{font:800 17px 'Saira Condensed',sans-serif;color:#eef4fb}
  .ob-expop .xp-s{font:700 9px 'Saira Condensed',sans-serif;letter-spacing:.07em;color:#7d8794}
  .ob-expop .xp-r{display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-top:1px solid rgba(255,255,255,.05);font:600 12px 'Saira Condensed',sans-serif;color:#9aa6b2}
  .ob-expop .xp-r b{color:#e6edf4;font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:12px}
  /* slots: cuadrado de arriba (compra) y de abajo (venta) que encasillan la alerta más nueva */
  .ob-slot{position:absolute;z-index:5;pointer-events:auto;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 9px;border-radius:7px;overflow:hidden;
    background:rgba(9,14,21,.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);transition:box-shadow .2s ease}
  .ob-slot.empty{background:rgba(9,14,21,.38)}
  .ob-slot .sl-empty{font:800 8.5px 'Saira Condensed',sans-serif;letter-spacing:.2em;color:#55606c;text-transform:uppercase}
  .ob-slot .sl-logo{width:24px;height:24px;border-radius:50%;flex:0 0 auto;background:#0b1118 center/cover no-repeat;border:1px solid rgba(255,255,255,.12);display:grid;place-items:center;font:800 9px 'Saira Condensed',sans-serif;color:#cdd7e2}
  .ob-slot .sl-mid{flex:0 1 auto;min-width:0;display:flex;flex-direction:column;justify-content:center;line-height:1.12;overflow:hidden}
  .ob-slot .sl-lbl{font:800 9.5px 'Saira Condensed',sans-serif;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ob-slot .sl-tk{font:700 8.5px 'Saira Condensed',sans-serif;color:#8a97a4;white-space:nowrap}
  .ob-slot .sl-a{flex:0 0 auto;font:700 12px 'IBM Plex Mono',monospace;color:#fff;white-space:nowrap}
  .ob-slot.buy{box-shadow:inset 0 0 0 1px rgba(43,245,158,.3)} .ob-slot.buy .sl-lbl{color:#9effc9}
  .ob-slot.sell{box-shadow:inset 0 0 0 1px rgba(255,77,110,.3)} .ob-slot.sell .sl-lbl{color:#ffb3c0}
  .ob-slot.buy.lit{animation:litbuy .8s ease} .ob-slot.sell.lit{animation:litsell .8s ease}
  @keyframes litbuy{0%{box-shadow:inset 0 0 0 1px rgba(43,245,158,.95),0 0 26px rgba(43,245,158,.55)}100%{box-shadow:inset 0 0 0 1px rgba(43,245,158,.3)}}
  @keyframes litsell{0%{box-shadow:inset 0 0 0 1px rgba(255,77,110,.95),0 0 26px rgba(255,77,110,.55)}100%{box-shadow:inset 0 0 0 1px rgba(255,77,110,.3)}}
  /* ficha automática al llegar alerta (arriba=compra, abajo=venta) + badge de lado */
  .ob-af{z-index:9}
  .ob-flowcard .fc-ht{min-width:0}
  .ob-flowcard .fc-side{margin-left:auto;flex:0 0 auto;font:800 9px 'Saira Condensed',sans-serif;letter-spacing:.06em;padding:2px 7px;border-radius:5px}
  .ob-flowcard .fc-side.u{color:#04130c;background:#2BF59E} .ob-flowcard .fc-side.d{color:#1a0509;background:#FF4D6E}
  /* botón de sonido (al lado de la búsqueda), apagado por defecto */
  .ob-snd.on{color:#E8B84B;border-color:rgba(232,184,75,.5)}
  .ob-stage{position:relative;flex:1 1 auto;min-height:0}
  #ob-overlay canvas#ob-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
  #ob-load{position:absolute;inset:0;z-index:6;display:grid;place-items:center;background:#05080f}
  #ob-load .sp{width:34px;height:34px;border-radius:50%;border:3px solid rgba(43,245,158,.2);border-top-color:#2BF59E;animation:obspin .7s linear infinite}
  #ob-load b{position:absolute;margin-top:62px;color:#7d8794;font:600 12px 'Saira Condensed',sans-serif;letter-spacing:.14em}
  @keyframes obspin{to{transform:rotate(360deg)}}
  #ob-mwrap{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:rgba(2,5,10,.62);backdrop-filter:blur(3px);animation:obfade .16s ease}
  @keyframes obfade{from{opacity:0}to{opacity:1}}
  #ob-mwrap .ob-modal{width:min(96vw,1180px);height:min(90vh,720px);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;
    background:linear-gradient(180deg,#0b1119,#070b12);border:1px solid #2b3139;box-shadow:0 30px 90px rgba(0,0,0,.6),0 0 0 1px rgba(43,245,158,.14);animation:obpop .22s cubic-bezier(.2,1.1,.3,1)}
  #ob-mwrap .ob-modal:fullscreen{width:100vw;height:100vh;max-width:none;max-height:none;border-radius:0}
  #ob-mwrap .ob-modal:-webkit-full-screen{width:100vw;height:100vh;max-width:none;max-height:none;border-radius:0}
  @keyframes obpop{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
  .ob-mhead{display:flex;align-items:center;gap:9px;padding:10px 13px;border-bottom:1px solid #1d242d;flex:0 0 auto}
  .ob-mlg{width:28px;height:28px;border-radius:50%;background:#131a22 center/cover no-repeat;flex:0 0 auto;display:grid;place-items:center;font:800 11px 'Saira Condensed',sans-serif;color:#9fe9c6;border:1px solid #2b3139}
  .ob-mhead .nm{font-weight:800;font-size:20px;letter-spacing:.02em;color:#eef4fb}
  .ob-mhead .pc,.ob-mhead .pr{font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:14px}
  .ob-mhead .pr{color:#cdd7e2}
  .ob-msp{flex:1 1 auto}
  .ob-tf{display:flex;gap:4px}
  .ob-tf button{min-width:40px;height:30px;border-radius:7px;border:1px solid #2b3139;background:#12161c;color:#aeb9c6;font:700 12px 'IBM Plex Mono',monospace;cursor:pointer}
  .ob-tf button.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;border-color:#c79426}
  .ob-mx{width:32px;height:30px;border-radius:7px;border:1px solid #2b3139;background:#12161c;color:#aeb9c6;cursor:pointer;display:grid;place-items:center}
  .ob-mx:hover{color:#fff;border-color:#FF4D6E}
  .ob-mbody{flex:1 1 auto;display:flex;min-height:0}
  .ob-mchart{position:relative;flex:1 1 auto;min-width:0;cursor:crosshair}
  .ob-mvp{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}
  .ob-tfwrap{position:relative;flex:0 0 auto}
  .ob-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:8px;border:1px solid #2b3139;background:#12161c;color:#cdd7e2;font:700 12px 'IBM Plex Mono',monospace;cursor:pointer}
  .ob-chip:hover{border-color:#C9A84B;color:#E8B84B}
  .ob-chev{font-style:normal;font-size:10px;opacity:.7}
  .ob-tfmenu{position:absolute;top:36px;left:0;z-index:40;display:none;grid-template-columns:repeat(3,1fr);gap:4px;padding:6px;border-radius:10px;border:1px solid #2b3139;background:#0d1117;box-shadow:0 18px 40px rgba(0,0,0,.5);min-width:156px}
  .ob-tfmenu.open{display:grid}
  .ob-tfi{height:28px;border-radius:6px;border:1px solid #232b36;background:#12161c;color:#aeb9c6;font:700 11px 'IBM Plex Mono',monospace;cursor:pointer}
  .ob-tfi:hover{border-color:#3a4654;color:#eaf0f6}
  .ob-tfi.on{background:linear-gradient(180deg,#f7db8d,#E8B84B 55%,#c79426);color:#3a2800;border-color:#c79426}
  .ob-mside{flex:0 0 auto;width:236px;border-left:1px solid #1d242d;padding:12px 13px 16px;overflow:auto;color:#cdd7e2}
  .ob-verdict{font-weight:800;font-size:26px;letter-spacing:.02em;line-height:1}
  .ob-convbar{height:5px;border-radius:3px;background:rgba(255,255,255,.08);margin:7px 0 11px;overflow:hidden}
  .ob-convbar i{display:block;height:100%;border-radius:3px;transition:width .4s ease}
  .ob-read{font-size:12.5px;line-height:1.5;color:#b9c4d0;font-weight:500;margin:0 0 13px;border-left:2px solid rgba(255,255,255,.12);padding-left:9px}
  .ob-sub{color:#7d8794;font-size:11px;letter-spacing:.13em;text-transform:uppercase;margin:12px 0 6px}
  .ob-sig{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #141b22;font-size:13px}
  .ob-sig b{font-family:'IBM Plex Mono',monospace;font-weight:600}
  @media(max-width:760px){.ob-mside{display:none}}`;
  document.head.appendChild(s);
}

/* ===== FEED de flujo: DOM encima del rectángulo; chip compacto + ficha técnica al hover ===== */
/* ===== FEED de flujo: dos slots (compra/venta) encasillan la alerta más nueva; feed = historial ===== */
function flowGeom(){ const y0=Z.y0,y1=Z.y1,h=y1-y0, sqH=clamp(h*0.11,46,58), ext=7;
  // los cuadrados SOBRESALEN del rectángulo (como los del Live Order Book) para ganar espacio
  return { sqH, buyY:y0+15, sellY:y1-15-sqH, x:Z.flowX0-ext, w:Z.flowW+2*ext }; }
function colocarFlow(){ if(Z.flowX0==null)return; const fg=flowGeom();
  const sb=document.getElementById('ob-slotbuy'), ss=document.getElementById('ob-slotsell'), fl=document.getElementById('ob-flow');
  if(sb){ sb.style.left=fg.x+'px'; sb.style.top=fg.buyY+'px'; sb.style.width=fg.w+'px'; sb.style.height=fg.sqH+'px'; }
  if(ss){ ss.style.left=fg.x+'px'; ss.style.top=fg.sellY+'px'; ss.style.width=fg.w+'px'; ss.style.height=fg.sqH+'px'; }
  if(fl){ const top=fg.buyY+fg.sqH+10, bot=fg.sellY-10; fl.style.left=(Z.flowX0+7)+'px'; fl.style.top=top+'px'; fl.style.width=(Z.flowW-14)+'px'; fl.style.height=Math.max(50,bot-top)+'px'; } }
let _flowId=0, _sndCool=0;
function flowPush(ev){ ev.id=++_flowId; ev.t=ev.t||Date.now();
  const co=COINS.find(c=>c.sym===ev.coin); if(co){ if(!ev.price)ev.price=co.price; ev.vol24h=co.vol; }
  if(ev.cls==='chain'&&!ev.usd&&book.mid) ev.usd=(parseFloat(ev.size)||0)*book.mid;
  ev.big = ev.cls==='chain' ? (ev.usd>=1.0e7) : ev.cls==='liq' ? (ev.usd>=150000) : (ev.usd>=400000);
  // el cuadrado de su lado ENCASILLA la alerta nueva; la anterior BAJA al historial (feed)
  if(ev.up){ if(buyLatest)flowItems.unshift(buyLatest); buyLatest=ev; Z.flowShineG=performance.now(); }
  else{ if(sellLatest)flowItems.unshift(sellLatest); sellLatest=ev; Z.flowShineR=performance.now(); }
  if(flowItems.length>40)flowItems.pop();
  renderSlots(); renderFlowList();
  (Z.linkPulses=Z.linkPulses||[]).push({t:0,up:!!ev.up,col:ev.col||'43,245,158'}); if(Z.linkPulses.length>40)Z.linkPulses.shift();
  // al llegar una alerta sensacional: su ficha técnica sale al lado unos segundos (y suena si está activado)
  if(ev.big){ autoFicha(ev); const now=performance.now(); if(_soundOn && now-_sndCool>700){ _sndCool=now; beep(ev.up); } }
}
function slotHTML(e){ if(!e)return `<div class="sl-empty">· waiting ·</div>`;
  const im=LOGO[e.sym]; const logo=(im&&im.src)?`<span class="sl-logo" style="background-image:url('${im.src}')"></span>`:`<span class="sl-logo sl-ph">${(e.coin||'·').slice(0,3)}</span>`;
  return `${logo}<div class="sl-mid"><b class="sl-lbl">${e.label}</b><span class="sl-tk">${e.coin}</span></div><div class="sl-a">${e.size}</div>`; }
function renderSlots(){ const b=document.getElementById('ob-slotbuy'), s=document.getElementById('ob-slotsell');
  if(b){ b.className='ob-slot buy'+(buyLatest?'':' empty'); b.innerHTML=slotHTML(buyLatest); if(buyLatest){ b.dataset.fid=buyLatest.id; b.classList.remove('lit'); void b.offsetWidth; b.classList.add('lit'); } }
  if(s){ s.className='ob-slot sell'+(sellLatest?'':' empty'); s.innerHTML=slotHTML(sellLatest); if(sellLatest){ s.dataset.fid=sellLatest.id; s.classList.remove('lit'); void s.offsetWidth; s.classList.add('lit'); } } }
function renderFlowList(){ const L=document.getElementById('ob-flowlist'); if(!L)return;
  L.innerHTML=flowItems.map((e,i)=>`<div class="ob-fl ${e.cls}${i===0?' fresh':''}" data-fid="${e.id}"><div class="fl-top"><i class="dot"></i><b>${e.label}</b><span class="cn">${e.coin}</span></div><div class="fl-sz">${e.size}</div></div>`).join(''); }
function beep(up){ try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return; const ac=beep._ac||(beep._ac=new AC());
  const o=ac.createOscillator(), g=ac.createGain(); o.connect(g); g.connect(ac.destination); o.type='sine';
  const t=ac.currentTime, f=up?770:560; o.frequency.setValueAtTime(f,t); o.frequency.exponentialRampToValueAtTime(f*1.5,t+0.07);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.11,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.2);
  o.start(t); o.stop(t+0.22); }catch(_){} }
function fichaHTML(e){ const im=LOGO[e.sym]||null;
  const logo=(im&&im.src)?`<span class="fc-logo" style="background-image:url('${im.src}')"></span>`:`<span class="fc-logo fc-ph">${(e.coin||'·').slice(0,3)}</span>`;
  let tm=''; try{ tm=new Date(e.t||Date.now()).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); }catch(_){}
  const px=e.price?('$'+fmtP(e.price)):null, impact=(e.usd&&e.vol24h)?(e.usd/e.vol24h*100):null;
  const imp=impact!=null?((impact<0.1?'<0.1':impact>99?'>99':impact.toFixed(impact<1?2:1))+'% · 24h'):null;
  const R=[]; let reading;
  if(e.cls==='chain'){
    R.push(['Value', e.usd?('$'+fmtVol(e.usd)):'—']);
    R.push(['From', `<code>…${e.fromShort||'----'}</code><button class="fc-b" data-copy="${e.fullFrom||''}" title="Copiar">⧉</button>`, 1]);
    R.push(['To', `<code>…${e.toShort||'----'}</code><button class="fc-b" data-copy="${e.fullTo||''}" title="Copiar">⧉</button><button class="fc-b" data-exp="${e.fullTo||e.fullFrom||''}" title="Ver en la cadena">↗</button>`, 1]);
    reading='Large on-chain transfer · watch exchange inflow or accumulation';
  } else if(e.cls==='liq'){
    if(px)R.push(['Price', px]);
    R.push(['Event', e.label==='LIQ LONG'?'Long liquidated':'Short liquidated']);
    if(imp)R.push(['Impact', imp]);
    reading=e.label==='LIQ LONG'?'Forced selling · downside cascade risk':'Forced buying · potential short squeeze';
  } else {
    if(px)R.push(['Price', px]);
    if(imp)R.push(['Impact', imp]);
    R.push(['Venue', e.src||'—']);
    reading=e.up?'Aggressive buy · lifting the offers':'Aggressive sell · hitting the bids';
  }
  const rows=R.map(r=> r[2]? `<div class="fc-adr"><span>${r[0]}</span>${r[1]}</div>` : `<div class="fc-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  return `<div class="fc-head">${logo}<div class="fc-ht"><div class="fc-coin">${e.coin}</div><div class="fc-type ${e.cls}">${e.label}${tm?(' · '+tm):''}</div></div><span class="fc-side ${e.up?'u':'d'}">${e.up?'BUY':'SELL'}</span></div>`+
    `<div class="fc-amt">${e.size}</div><div class="fc-rows">${rows}</div>`+
    `<div class="fc-read"><span>Reading</span><p>${reading}</p></div>`;
}
function fichaEvent(fid){ if(buyLatest&&String(buyLatest.id)===String(fid))return buyLatest; if(sellLatest&&String(sellLatest.id)===String(fid))return sellLatest; return flowItems.find(x=>String(x.id)===String(fid)); }
function autoFicha(ev){ const el=document.getElementById(ev.up?'ob-afbuy':'ob-afsell'); if(!el)return; const fg=flowGeom();
  el.innerHTML=fichaHTML(ev); el.style.left=(Z.flowX1+16)+'px'; el.style.opacity='1'; el.style.pointerEvents='auto';
  requestAnimationFrame(()=>{ const hh=el.offsetHeight||150, st=document.getElementById('ob-stage'), sw=st?st.getBoundingClientRect().width:W;
    if(Z.flowX1+16+el.offsetWidth>sw-8) el.style.left=Math.max(8,Z.flowX0-el.offsetWidth-14)+'px';
    el.style.top=(ev.up?Math.max(8,fg.buyY):Math.max(8,fg.sellY+fg.sqH-hh))+'px'; });
  clearTimeout(el._t); el._t=setTimeout(()=>{ el.style.opacity='0'; el.style.pointerEvents='none'; }, 1100); }
function wireFlow(){ const L=document.getElementById('ob-flowlist'), card=document.getElementById('ob-flowcard'), stage=document.getElementById('ob-stage'); if(!L||!card||!stage)return;
  let hideT=null; const hide=()=>{ card.style.opacity='0'; card.style.pointerEvents='none'; };
  const show=(fid,chip)=>{ const e=fichaEvent(fid); if(!e)return; card.innerHTML=fichaHTML(e);
    const cr=chip.getBoundingClientRect(), sr=stage.getBoundingClientRect(); card.style.opacity='1'; card.style.pointerEvents='auto';
    let left=cr.right-sr.left+8, top=cr.top-sr.top-4; card.style.left=left+'px'; card.style.top=top+'px';
    requestAnimationFrame(()=>{ const cw=card.offsetWidth, ch=card.offsetHeight;
      if(left+cw>sr.width-8) card.style.left=Math.max(8,(cr.left-sr.left)-cw-8)+'px';
      if(top+ch>sr.height-8) card.style.top=Math.max(8,sr.height-ch-8)+'px'; }); };
  const over=e=>{ const chip=e.target.closest('.ob-fl')||e.target.closest('.ob-slot'); if(!chip||!chip.dataset.fid)return; if(hideT){clearTimeout(hideT);hideT=null;} show(chip.dataset.fid,chip); };
  const out=e=>{ const to=e.relatedTarget; if(to&&to.closest&&(to.closest('#ob-flowcard')||to.closest('.ob-fl')||to.closest('.ob-slot')))return; hideT=setTimeout(hide,240); };
  L.addEventListener('mouseover',over); L.addEventListener('mouseout',out);
  ['ob-slotbuy','ob-slotsell'].forEach(id=>{ const s=document.getElementById(id); if(s){ s.addEventListener('mouseover',over); s.addEventListener('mouseout',out); } });
  card.addEventListener('mouseenter',()=>{ if(hideT){clearTimeout(hideT);hideT=null;} }); card.addEventListener('mouseleave',hide);
  const copyExp=e=>{ const cb=e.target.closest('[data-copy]');
    if(cb){ try{ if(cb.dataset.copy){ navigator.clipboard.writeText(cb.dataset.copy); cb.textContent='✓'; setTimeout(()=>{ cb.textContent='⧉'; },1200); } }catch(_){} return; }
    const xb=e.target.closest('[data-exp]'); if(xb&&xb.dataset.exp){ try{ window.open('https://www.blockchain.com/explorer/addresses/btc/'+encodeURIComponent(xb.dataset.exp),'_blank','noopener'); }catch(_){} } };
  [card,document.getElementById('ob-afbuy'),document.getElementById('ob-afsell')].forEach(el=>{ if(el)el.addEventListener('click',copyExp); }); }
/* popup de exchange en DOM (sale POR DELANTE del feed, con sombra) */
function syncExPopup(){ const el=document.getElementById('ob-expop'); if(!el)return; const ei=Z.exHover;
  if(ei==null||ei<0){ if(el._on){ el._on=false; el.style.opacity='0'; } el._ei=-2; return; }
  const order=Z.exchOrder||[], idx=order.indexOf(ei); if(idx<0){ el.style.opacity='0'; return; }
  if(el._ei!==ei){ el._ei=ei; const e=EXCH[ei], m=EXMETA[ei]||{}, img=EXIMG[ei];
    const logo=(img&&img.src)?`<span class="xp-logo" style="background-image:url('${img.src}')"></span>`:`<span class="xp-logo xp-ph">${e[1]}</span>`;
    const rows=[['24h Volume', m.volUsd?'$'+fmtVol(m.volUsd):'—'],['Trust rank',m.rank?'#'+m.rank:'—'],['Trust score',m.trust?m.trust+' / 10':'—'],['Established',m.year?String(m.year):'—'],['Country',m.country||'—']];
    el.innerHTML=`<div class="xp-h">${logo}<div><div class="xp-n">${e[0]}</div><div class="xp-s">${m.src?('DEX · '+String(m.src).toUpperCase()):'EXCHANGE · 24H DATA'}</div></div></div>`+rows.map(r=>`<div class="xp-r"><span>${r[0]}</span><b>${r[1]}</b></div>`).join(''); }
  const gap=5, tot=Z.y1-Z.y0, n=order.length, ch=(tot-gap*Math.max(0,n-1))/Math.max(1,n), ry=Z.y0+idx*(ch+gap);
  const ph=el.offsetHeight||150, py=clamp(ry-8,Z.y0,Math.max(Z.y0,H-ph-8));
  el.style.left=(Z.secX+Z.secW+12)+'px'; el.style.top=py+'px'; el.style.opacity='1'; el._on=true; }
/* ===== búsqueda: abrir CUALQUIER moneda (esté o no en la cascada) ===== */
function wireBuscador(){
  const inp=document.getElementById('ob-q'), sug=document.getElementById('ob-sug'); if(!inp||!sug)return;
  let items=[], sel=-1;
  const build=qr=>{ const q=qr.trim().toUpperCase(); if(!q){ sug.classList.remove('open'); sug.innerHTML=''; items=[]; return; }
    const seen={}, out=[];
    COINS.forEach(c=>{ if(seen[c.sym])return; const nm=(NAME[c.sym]||'').toUpperCase(); if(c.sym.indexOf(q)>=0||nm.indexOf(q)>=0){ seen[c.sym]=1; out.push({sym:c.sym,symbol:c.symbol,nm:NAME[c.sym]||c.sym,coin:c}); } });
    try{ SP.forEach(p=>{ if(seen[p.id])return; const nm=(p.n||'').toUpperCase(); if(p.id.indexOf(q)>=0||nm.indexOf(q)>=0){ seen[p.id]=1; out.push({sym:p.id,symbol:p.s||(p.id+'USDT'),nm:p.n||p.id,coin:null}); } }); }catch(_){}
    items=out.slice(0,10); sel=-1;
    sug.innerHTML=items.map((it,i)=>{ const u=_symUrl[it.sym]||(SPOT+it.sym.toLowerCase()+'.png'); const pc=it.coin?((it.coin.disp>=0?'+':'')+(it.coin.disp||0).toFixed(1)+'%'):''; const pcc=(it.coin&&it.coin.disp<0)?'#FF4D6E':'#2BF59E';
      return `<div class="ob-sugi" data-i="${i}"><i class="ic" style="background-image:url(${u})"></i><span class="sy">${it.sym}</span><span class="nm">${it.nm}</span><span class="pc" style="color:${pcc}">${pc}</span></div>`; }).join('');
    sug.classList.add('open'); };
  const abrir=it=>{ if(!it)return; sug.classList.remove('open'); inp.value=''; inp.blur();
    const c=it.coin||{sym:it.sym,symbol:it.symbol,price:0,cur:0,disp:0,_up:true,res:0,sup:0}; abrirDetalle(c); };
  inp.oninput=()=>build(inp.value);
  inp.onkeydown=e=>{ if(e.key==='ArrowDown')sel=Math.min(items.length-1,sel+1); else if(e.key==='ArrowUp')sel=Math.max(0,sel-1);
    else if(e.key==='Enter'){ abrir(items[sel<0?0:sel]); return; } else if(e.key==='Escape'){ sug.classList.remove('open'); return; } else return;
    sug.querySelectorAll('.ob-sugi').forEach((el,i)=>el.classList.toggle('on',i===sel)); e.preventDefault(); };
  sug.onclick=e=>{ const d=e.target.closest('.ob-sugi'); if(d)abrir(items[+d.dataset.i]); };
  document.addEventListener('click',e=>{ if(!e.target.closest('.ob-search'))sug.classList.remove('open'); });
}
/* ===== panel "qué es esto": lectura corporativa de alta frecuencia ===== */
function abrirInfo(){ if(document.getElementById('ob-info-ov'))return;
  const o2=document.createElement('div'); o2.className='ob-info-ov'; o2.id='ob-info-ov';
  o2.innerHTML=`<div class="ob-info-card">
    <button class="ob-info-x" id="ob-info-x">${IC.x}</button>
    <span class="tag">High-Frequency Liquidity Radar</span>
    <h2>Order Block Liquidity</h2>
    <p>A corporate-grade, high-frequency system that reads the crypto market in real time. It tracks where liquidity enters across the top exchanges and DEXs and routes it, live, into the assets moving right now, so you see order flow forming as it happens.</p>
    <div class="feat"><b>›</b><span>Live tick-by-tick order flow and market breadth from Binance spot.</span></div>
    <div class="feat"><b>›</b><span>Real support and resistance zones from swing pivots, scored by how many times price tested each level.</span></div>
    <div class="feat"><b>›</b><span>Institutional volume profile on every asset: POC, value area and liquidity nodes.</span></div>
    <div class="feat"><b>›</b><span>24h exchange and DEX volume, plus a full momentum and structure read on any coin.</span></div>
    <p style="opacity:.6;font-size:12px;margin-top:4px">Search any coin in the top bar to open its real-time read. For information only, not financial advice.</p>
  </div>`;
  (document.getElementById('ob-stage')||document.body).appendChild(o2);
  o2.addEventListener('mousedown',e=>{ if(e.target===o2)o2.remove(); });
  document.getElementById('ob-info-x').onclick=()=>o2.remove();
}
// Compone la foto. sinLogos=false dibuja los logos (CORS); si algo contaminara el lienzo,
// toDataURL lanza y se reintenta con sinLogos=true (letras). La marca es el logo de la página.
function componerExport(sinLogos){
  const oc=ctx,oG=GL,og=glx,oS=SB,os=sbx,oDM=DM;
  const tmp=document.createElement('canvas'); tmp.width=PW; tmp.height=PH;
  const tG=document.createElement('canvas'); tG.width=PW; tG.height=PH;
  const tS=document.createElement('canvas'); tS.width=SBW; tS.height=SBH;
  ctx=tmp.getContext('2d'); GL=tG; glx=tG.getContext('2d'); SB=tS; sbx=tS.getContext('2d'); DM=null;
  _exporting=sinLogos; try{ renderOnce(); }catch(_){} _exporting=false;
  ctx=oc; GL=oG; glx=og; SB=oS; sbx=os; DM=oDM;
  try{
    const out=document.createElement('canvas'); out.width=PW; out.height=PH; const o2=out.getContext('2d');
    const bg=o2.createLinearGradient(0,0,0,PH); bg.addColorStop(0,'#05080f'); bg.addColorStop(.55,'#04060c'); bg.addColorStop(1,'#03050a');
    o2.fillStyle=bg; o2.fillRect(0,0,PW,PH); o2.drawImage(tmp,0,0);
    o2.setTransform(DPR,0,0,DPR,0,0);
    o2.fillStyle='rgba(4,7,13,.55)'; o2.fillRect(0,H-40,W,40);
    const by=H-20; o2.textBaseline='middle';
    if(BRAND_IMG && BRAND_IMG.complete && BRAND_IMG.naturalWidth){ const bh=22, bw=bh*(BRAND_IMG.naturalWidth/BRAND_IMG.naturalHeight); o2.drawImage(BRAND_IMG,16,by-bh/2,bw,bh); }
    else { o2.fillStyle='#E8B84B'; o2.font='800 16px "Saira Condensed",sans-serif'; o2.textAlign='left'; o2.fillText('DECFREEDOM',16,by); }
    const d=new Date(),p2=x=>String(x).padStart(2,'0');
    o2.textAlign='right'; o2.fillStyle='rgba(120,135,150,.9)'; o2.font='600 12px "IBM Plex Mono",monospace'; o2.fillText(`${d.getUTCFullYear()}-${p2(d.getUTCMonth()+1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`,W-16,by);
    return out.toDataURL('image/png');
  }catch(_){ return null; }
}
function exportar(){
  const url=componerExport(false) || componerExport(true);   // con logos; respaldo con letras si algo contamina
  if(url){ const a=document.createElement('a'); a.download='order-block-liquidity.png'; a.href=url; a.click(); }
}

export async function abrirOrderBlock(){
  if(document.getElementById('ob-overlay'))return;
  estilos();
  ov=document.createElement('div'); ov.id='ob-overlay';
  ov.innerHTML=`
    <div class="ob-top">
      <button class="ob-back" id="ob-back">${IC.back}Back</button>
      <div class="ob-search">${IC.search}<input id="ob-q" type="text" placeholder="Search any coin to analyze…" autocomplete="off" spellcheck="false"><div class="ob-sug" id="ob-sug"></div></div>
      <button class="ob-ico ob-snd" id="ob-snd" title="Alert sound: off">${IC.sndOff}</button>
      <div class="ob-sp"></div>
      <div class="ob-pulse" id="ob-pulse"></div>
      <button class="ob-ico" id="ob-info" title="What is this">${IC.info}</button>
      <button class="ob-ico" id="ob-cam" title="Export image">${IC.exp}</button>
    </div>
    <div class="ob-stage" id="ob-stage">
      <canvas id="ob-cv"></canvas>
      <div class="ob-flow" id="ob-flow"><div class="ob-flowlist" id="ob-flowlist"></div></div>
      <div class="ob-slot buy empty" id="ob-slotbuy"></div>
      <div class="ob-slot sell empty" id="ob-slotsell"></div>
      <div class="ob-flowcard ob-af" id="ob-afbuy"></div>
      <div class="ob-flowcard ob-af" id="ob-afsell"></div>
      <div class="ob-flowcard" id="ob-flowcard"></div>
      <div class="ob-expop" id="ob-expop"></div>
      <div id="ob-load"><div class="sp"></div><b>LOADING LIQUIDITY…</b></div>
    </div>`;
  document.body.appendChild(ov);
  cv=document.getElementById('ob-cv'); ctx=cv.getContext('2d');
  GL=document.createElement('canvas'); glx=GL.getContext('2d');
  SB=document.createElement('canvas'); sbx=SB.getContext('2d');
  document.getElementById('ob-back').onclick=cerrar;
  document.getElementById('ob-cam').onclick=exportar;
  document.getElementById('ob-info').onclick=abrirInfo;
  wireBuscador(); wireFlow();
  const sndBtn=document.getElementById('ob-snd');
  if(sndBtn) sndBtn.onclick=()=>{ _soundOn=!_soundOn; sndBtn.classList.toggle('on',_soundOn); sndBtn.innerHTML=_soundOn?IC.sndOn:IC.sndOff; sndBtn.title='Alert sound: '+(_soundOn?'on':'off');
    if(_soundOn){ try{ const AC=window.AudioContext||window.webkitAudioContext; if(AC){ if(!beep._ac)beep._ac=new AC(); if(beep._ac.resume)beep._ac.resume(); } beep(true); }catch(_){} } };
  cv.addEventListener('mousemove',e=>{ const r=cv.getBoundingClientRect(); mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; mouse.on=true; });
  cv.addEventListener('mouseleave',()=>mouse.on=false);
  cv.addEventListener('click',onClick);
  window.addEventListener('resize',onResize);

  await cargarUniverso();
  const l=document.getElementById('ob-load'); if(l)l.remove();
  if(!COINS.length){ const m=document.createElement('div'); m.style.cssText='position:absolute;inset:0;display:grid;place-items:center;color:#a7b0bb;font:600 14px sans-serif;text-align:center;padding:24px';
    m.textContent='No se pudieron cargar los datos de mercado. Revisa la conexión y reintenta.'; (document.getElementById('ob-stage')||ov).appendChild(m); return; }

  booted=false; boot();
  cargarLogos(); cargarExchanges();
  try{ stream=D.streamMini(aplicarTick); }catch(_){}
  try{ tradeStream=D.streamTrades(COINS.slice(0,18).map(c=>c.symbol), onTrade); }catch(_){}   // ballenas + flujo real
  try{ depthStream=D.streamDepth('BTCUSDT', onDepth); }catch(_){}   // libro de órdenes real (referencia del mercado)
  try{ chainStream=D.streamChainWhales(onChainWhale, 50); }catch(_){}   // ballenas on-chain de BTC (origen -> destino)
  try{ liqStream=D.streamLiquidations(COINS.slice(0,15).map(c=>c.symbol), onLiq); }catch(_){}   // liquidaciones en vivo (Bybit)
  refrescarPulso(); Z._pulsoTimer=setInterval(refrescarPulso, 90000);   // Fear & Greed + mercado global
  refrescarNiveles(); precargarMinis();
  Z._nivTimer=setInterval(refrescarNiveles, 70000);
  // el mercado se mira en vivo: cada poco re-selecciona qué monedas entran en la cascada,
  // así afloran oportunidades nuevas (no se queda rígido). Respeta hover y modal abiertos.
  Z._cardTimer=setInterval(()=>{ if(!ov||!cv)return; if(document.getElementById('ob-mwrap'))return; if(mouse.on)return; buildCards(); placeCards(); precargarMinis(); }, 9000);
  document.addEventListener('visibilitychange',onVis);
}
function onVis(){ if(document.hidden){ paused=true; if(RAF)cancelAnimationFrame(RAF); RAF=0; }
  else if(paused){ paused=false; if(!document.getElementById('ob-mwrap')){ last=performance.now(); RAF=requestAnimationFrame(frame); } } }
function boot(){ if(booted)return; booted=true; layout(); last=performance.now();
  if(document.fonts&&document.fonts.ready){ document.fonts.ready.then(()=>{DM=null;}); }
  RAF=requestAnimationFrame(frame); }
function onResize(){ if(cv) layout(); }
function onClick(e){ const r=cv.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
  const vis=tarjetasVisibles();
  for(const c of vis){ if(mx>=c._x&&mx<=c._x+c._w&&my>=c._y&&my<=c._y+c._h){
    // ilumina la RUTA real del hilo (su exchange -> su tarjeta) y lanza un pulso, luego abre
    const ex=c.exch; strands.forEach(s=>{ if(s.coin===c){ s.hl=1; s._wp=0; s._wbuy=c.disp>=0; s._wmag=1.3; } else if(s.exch===ex){ s.hl=Math.max(s.hl,0.6); } });
    setTimeout(()=>abrirDetalle(c), 230); return; } } }
/* ===== modal de detalle (click en tarjeta): grafico real + perfil de volumen + niveles + tendencia ===== */
function cerrarDetalle(){ try{ if(mRO)mRO.disconnect(); }catch(_){} mRO=null;
  if(mRAF){ cancelAnimationFrame(mRAF); mRAF=0; }
  try{ if(mStream)mStream.cerrar(); }catch(_){} mStream=null;
  try{ if(mDepthStream)mDepthStream.cerrar(); }catch(_){} mDepthStream=null; mHeat=[]; mMode='vp';
  if(mMenuDoc){ document.removeEventListener('click',mMenuDoc); mMenuDoc=null; }
  try{ if(mChart)mChart.remove(); }catch(_){} mChart=mSeries=null; mVP=null; mKl=[]; mCoin=null; mSR=[];
  const w=document.getElementById('ob-mwrap'); if(w)w.remove();
  if(ov&&cv&&!RAF&&!paused){ last=performance.now(); RAF=requestAnimationFrame(frame); } }   // reanuda el radar al cerrar el modal
async function abrirDetalle(c){
  if(document.getElementById('ob-mwrap'))return;
  if(RAF){ cancelAnimationFrame(RAF); RAF=0; }   // congela el radar detrás del modal: toda la CPU va al gráfico (fluido, sin lag)
  mCoin=c; mTF='1d';
  const wrap=document.createElement('div'); wrap.id='ob-mwrap';
  const colc=c._up?'#2BF59E':'#FF4D6E';
  wrap.innerHTML=`<div class="ob-modal">
    <div class="ob-mhead">
      <div class="ob-mlg" id="ob-mlg">${(c.sym||'·').slice(0,3)}</div>
      <span class="nm">${c.sym||''}</span>
      <span class="pc" id="ob-mpc" style="color:${colc}"></span>
      <span class="pr" id="ob-mpr"></span>
      <div class="ob-tfwrap"><button class="ob-chip" id="ob-tfchip"></button><div class="ob-tfmenu" id="ob-tfmenu"></div></div>
      <div class="ob-msp"></div>
      <button class="ob-mx" id="ob-mfs" title="Fullscreen">${IC.full}</button>
      <button class="ob-mx" id="ob-mx" title="Close">${IC.x}</button>
    </div>
    <div class="ob-mbody">
      <div class="ob-mchart" id="ob-mchart"><canvas class="ob-mvp" id="ob-mvp"></canvas></div>
      <div class="ob-mside" id="ob-mside"></div>
    </div>
  </div>`;
  (document.getElementById('ob-stage')||ov).appendChild(wrap);
  wrap.addEventListener('mousedown',e=>{ if(e.target===wrap)cerrarDetalle(); });
  document.getElementById('ob-mx').onclick=cerrarDetalle;
  // pantalla completa de la ventana emergente (mismo gesto que VWAP Pro / Multichart)
  const modalEl=wrap.querySelector('.ob-modal'), fsBtn=document.getElementById('ob-mfs');
  fsBtn.onclick=()=>{ try{ if(document.fullscreenElement||document.webkitFullscreenElement){ (document.exitFullscreen||document.webkitExitFullscreen).call(document); }
    else { (modalEl.requestFullscreen||modalEl.webkitRequestFullscreen).call(modalEl); } }catch(_){} };
  const lg=document.getElementById('ob-mlg'), im=LOGO[c.sym]; if(im&&im.src){ lg.style.backgroundImage=`url(${im.src})`; lg.textContent=''; }
  document.getElementById('ob-mpc').textContent=(c.disp>=0?'+':'')+(c.disp||0).toFixed(2)+'%';
  document.getElementById('ob-mpr').textContent='$'+fmtP(c.price||c.cur||0);
  // temporalidades a la IZQUIERDA, estilo plataforma (chip + menú), igual que el resto de herramientas
  const OBTFS=[['15m','15M'],['30m','30M'],['1h','1H'],['4h','4H'],['1d','1D'],['1w','1W']];
  const chip=document.getElementById('ob-tfchip'), menu=document.getElementById('ob-tfmenu');
  const lblOf=id=>(OBTFS.find(t=>t[0]===id)||['','1D'])[1];
  const pintarChip=()=>{ chip.innerHTML=lblOf(mTF)+' <em class="ob-chev">▾</em>'; };
  menu.innerHTML=OBTFS.map(([id,lb])=>`<button class="ob-tfi ${id===mTF?'on':''}" data-tf="${id}">${lb}</button>`).join('');
  pintarChip();
  chip.onclick=e=>{ e.stopPropagation(); menu.classList.toggle('open'); };
  mMenuDoc=()=>menu.classList.remove('open'); document.addEventListener('click',mMenuDoc);
  menu.querySelectorAll('button').forEach(b=>b.onclick=()=>{ mTF=b.dataset.tf;
    menu.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); pintarChip(); menu.classList.remove('open'); cargarChart(); });
  try{ LC=await lib(); }catch(_){ const h=document.getElementById('ob-mchart'); if(h)h.innerHTML='<div style="display:grid;place-items:center;height:100%;color:#7d8794;font-family:sans-serif">No se pudo cargar el grafico.</div>'; return; }
  crearChart(); cargarChart();
}
function crearChart(){ const host=document.getElementById('ob-mchart'); if(!host||!LC)return;
  mChart=LC.createChart(host,{ layout:{background:{type:'solid',color:'transparent'},textColor:'#8ea0b2',fontFamily:'IBM Plex Mono, monospace',attributionLogo:false},
    rightPriceScale:{borderColor:'#1d242d',scaleMargins:{top:0.08,bottom:0.08}}, timeScale:{borderColor:'#1d242d',timeVisible:true,secondsVisible:false},
    grid:{vertLines:{color:'rgba(40,52,62,.3)'},horzLines:{color:'rgba(40,52,62,.3)'}}, crosshair:{mode:0},
    width:host.clientWidth, height:host.clientHeight });
  const opt={ upColor:'#2BF59E',downColor:'#FF4D6E',borderVisible:false,wickUpColor:'#2BF59E',wickDownColor:'#FF4D6E' };
  mSeries = mChart.addCandlestickSeries ? mChart.addCandlestickSeries(opt) : mChart.addSeries(LC.CandlestickSeries,opt);
  mRO=new ResizeObserver(()=>{ if(mChart&&host)mChart.applyOptions({width:host.clientWidth,height:host.clientHeight}); }); mRO.observe(host);
  if(!mRAF) mRAF=requestAnimationFrame(modalLoop);
}
async function cargarChart(){ if(!mSeries||!mCoin)return;
  const kl=await D.velas(mCoin.symbol,mTF,240); if(!kl.length||!mSeries)return; mKl=kl; mSeries.setData(kl);
  let lo=Infinity,hi=-Infinity; kl.forEach(k=>{ if(k.low<lo)lo=k.low; if(k.high>hi)hi=k.high; });
  const N=54,bins=new Array(N).fill(0); if(hi>lo) kl.forEach(k=>{ const tp=(k.high+k.low+k.close)/3; let b=((tp-lo)/(hi-lo)*N)|0; b=b<0?0:b>=N?N-1:b; bins[b]+=k.volume; });
  let poc=0,pm=-1; bins.forEach((v,i)=>{ if(v>pm){pm=v;poc=i;} });
  mVP={lo,hi,N,bins,poc,mx:Math.max.apply(null,bins)||1};
  mVP.cur=kl[kl.length-1].close;
  mSR=calcSR(kl);     // zonas de soporte/resistencia REALES (pivotes de swing agrupados por toques)
  try{ mChart.timeScale().fitContent(); }catch(_){}
  sentimiento(kl);
  // velas EN VIVO: la vela en formación se actualiza en cada tick (fluido, como Footprint Pro)
  if(mStream){ try{ mStream.cerrar(); }catch(_){} mStream=null; }
  const sym=mCoin.symbol, tf=mTF;
  try{ mStream=streamVelas(sym,tf,k=>{ if(!mSeries||mTF!==tf||!mCoin||mCoin.symbol!==sym)return;
    try{ mSeries.update({ time:Math.floor(k.t/1000), open:+k.o, high:+k.h, low:+k.l, close:+k.c }); }catch(_){}
    const pr=document.getElementById('ob-mpr'); if(pr)pr.textContent='$'+fmtP(+k.c); }); }catch(_){}
}
// Paleta de calor por escalones (misma lógica que el mapa de Liquidity Pools):
// azul = poco volumen, verde = medio, amarillo = alto, naranja/rojo = los muros de liquidez.
const VP_HEAT=[[0.20,[12,44,104]],[0.40,[30,74,168]],[0.58,[56,130,220]],[0.76,[8,190,12]],[0.89,[228,229,5]],[0.96,[255,132,0]],[1.01,[255,40,40]]];
function heatC(v){ v=clamp(v,0,1); for(const e of VP_HEAT) if(v<=e[0]) return e[1]; return [255,40,40]; }
function modalLoop(){ if(!document.getElementById('ob-mwrap')){ mRAF=0; return; } try{ dibujarOverlay(); }catch(_){} mRAF=requestAnimationFrame(modalLoop); }
function dibujarOverlay(){ const cv2=document.getElementById('ob-mvp'), host=document.getElementById('ob-mchart'); if(!cv2||!host||!mSeries||!mVP)return;
  const d=Math.min(2,window.devicePixelRatio||1), w=host.clientWidth, h=host.clientHeight; if(w<10||h<10)return;
  if(cv2.width!==((w*d)|0)||cv2.height!==((h*d)|0)){ cv2.width=w*d; cv2.height=h*d; }
  const x=cv2.getContext('2d'); x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,w,h);
  let axisW=58; try{ axisW=mChart.priceScale('right').width()||58; }catch(_){}
  const plotR=w-axisW-2, T2=performance.now()*0.001, {lo,hi,N,bins,poc,mx}=mVP;
  if(hi>lo){
    // PERFIL DE VOLUMEN profesional: longitud de barra = volumen real en ese nivel, con
    // contraste alto -> los HVN (mucha liquidez) sobresalen y los LVN (poca) casi no se ven.
    // Value Area 70% en caja, POC/VAH/VAL con líneas de referencia. Estructura, no brocha.
    const yLo=mSeries.priceToCoordinate(lo), yHi=mSeries.priceToCoordinate(hi);
    const barH=(yLo!=null&&yHi!=null)?Math.max(2,(yLo-yHi)/N):3;
    const maxW=plotR*0.30;
    const pAt=i=>lo+(i+0.5)/N*(hi-lo);
    // Value Area: se expande desde el POC sumando el vecino de mayor volumen hasta el 70%
    let tot=0; for(let i=0;i<N;i++)tot+=bins[i]; tot=tot||1;
    let lv=poc, hv=poc, acc=bins[poc]||0, guard=0;
    while(acc<tot*0.7 && (lv>0||hv<N-1) && guard++<N*2){ const bel=lv>0?bins[lv-1]:-1, abo=hv<N-1?bins[hv+1]:-1; if(abo>=bel){ hv++; acc+=bins[hv]; } else { lv--; acc+=bins[lv]; } }
    let yVAL=null,yVAH=null,yPOC=null; try{ yVAL=mSeries.priceToCoordinate(pAt(lv)); yVAH=mSeries.priceToCoordinate(pAt(hv)); yPOC=mSeries.priceToCoordinate(pAt(poc)); }catch(_){}
    if(yVAL!=null&&yVAH!=null){ x.fillStyle='rgba(232,184,75,.055)'; x.fillRect(plotR-maxW-3,Math.min(yVAL,yVAH),maxW+3,Math.abs(yVAL-yVAH)); }
    for(let i=0;i<N;i++){ let yy; try{ yy=mSeries.priceToCoordinate(pAt(i)); }catch(_){ yy=null; } if(yy==null)continue;
      const v=bins[i]/mx; if(v<=0.004)continue; const len=Math.max(1.5,Math.pow(v,0.82)*maxW);
      const isPoc=(i===poc), inVA=(i>=lv&&i<=hv);
      const r=isPoc?255:inVA?43:72, gg=isPoc?190:inVA?245:104, bb=isPoc?70:inVA?158:148, al=isPoc?0.98:inVA?0.72:0.3;
      const grd=x.createLinearGradient(plotR-len,0,plotR,0); grd.addColorStop(0,`rgba(${r},${gg},${bb},0.05)`); grd.addColorStop(1,`rgba(${r},${gg},${bb},${al})`);
      x.fillStyle=grd; x.fillRect(plotR-len,yy-barH/2,len,Math.max(1.2,barH-0.5)); }
    const refLine=(yv,txt,colr,solid)=>{ if(yv==null)return; x.save(); x.setLineDash(solid?[]:[3,3]); x.strokeStyle=colr; x.lineWidth=solid?1.5:1; x.beginPath(); x.moveTo(plotR-maxW-3,yv); x.lineTo(plotR,yv); x.stroke(); x.restore();
      x.font='800 9px "IBM Plex Mono",monospace'; x.fillStyle=colr; x.textAlign='left'; x.textBaseline='middle'; x.fillText(txt,plotR-maxW-1,yv-6); x.textBaseline='alphabetic'; };
    refLine(yVAH,'VAH','rgba(130,200,255,.75)',false);
    refLine(yVAL,'VAL','rgba(130,200,255,.75)',false);
    refLine(yPOC,'POC','rgba(255,190,70,.98)',true);
  }
  // ZONAS de soporte/resistencia reales. Relleno SUAVE delimitado EXACTO al rango real de
  // la zona, y TRES líneas punteadas: borde superior + central (el nivel) + borde inferior.
  // Las dos de los bordes marcan la amplitud/veracidad de la zona. Etiqueta con nº de toques.
  const pulse=0.5+0.5*Math.sin(T2*2.2);
  (mSR||[]).forEach(z=>{ let yH,yL,yC; try{ yH=mSeries.priceToCoordinate(z.hi); yL=mSeries.priceToCoordinate(z.lo); yC=mSeries.priceToCoordinate(z.c); }catch(_){ return; }
    if(yH==null||yL==null||yC==null)return;
    const rgb=z.kind==='res'?'255,77,110':'43,245,158';
    const top=Math.min(yH,yL), bot=Math.max(yH,yL), bh=Math.max(1.5,bot-top);
    const g2=x.createLinearGradient(0,top,0,bot); g2.addColorStop(0,`rgba(${rgb},0.02)`); g2.addColorStop(.5,`rgba(${rgb},${.07+.03*pulse})`); g2.addColorStop(1,`rgba(${rgb},0.02)`);
    x.fillStyle=g2; x.fillRect(0,top,plotR,bh);
    x.save(); x.setLineDash([7,6]); x.lineDashOffset=-((T2*24)%13);
    x.strokeStyle=`rgba(${rgb},0.32)`; x.lineWidth=1; x.beginPath(); x.moveTo(0,top); x.lineTo(plotR,top); x.moveTo(0,bot); x.lineTo(plotR,bot); x.stroke();
    x.strokeStyle=`rgba(${rgb},${.7+.14*pulse})`; x.lineWidth=1.6; x.beginPath(); x.moveTo(0,yC); x.lineTo(plotR,yC); x.stroke(); x.restore();
    // etiqueta legible: tag, precio y nº de toques, en mono, con sombra para separar del fondo
    const lab=`${z.tag||''}  ${fmtP(z.c)}  ·  ${z.touches} touches`;
    x.font='700 11px "IBM Plex Mono",monospace'; const tw=x.measureText(lab).width+20;
    x.save(); x.shadowColor='rgba(0,0,0,.45)'; x.shadowBlur=6; x.fillStyle=`rgba(${rgb},.97)`; rr(x,8,yC-10,tw,21,6); x.fill(); x.restore();
    x.fillStyle='#0a1510'; x.textBaseline='middle'; x.textAlign='left'; x.fillText(lab,18,yC+1); x.textBaseline='alphabetic'; });
}
/* ===== Soporte / Resistencia REAL (no líneas al azar) =====
   Detecta pivotes de swing (máximos/mínimos locales donde el precio reaccionó),
   agrupa los que están al mismo nivel en ZONAS y las puntúa por nº de toques,
   recencia y volumen. Son los niveles que un trader dibujaría a mano: donde el
   precio rebotó varias veces. Devuelve las zonas más fuertes arriba y abajo. */
function calcSR(kl){
  const n=kl.length; if(n<24)return [];
  const K=clamp(Math.round(n/40),2,6);                 // ventana de pivote adaptativa
  let atr=0; for(let i=1;i<n;i++)atr+=Math.abs(kl[i].high-kl[i].low); atr/=Math.max(1,n-1);
  const last=kl[n-1].close, tol=Math.max(atr*0.75,last*0.005);   // dos pivotes son el mismo nivel si están a < tol
  const piv=[];
  for(let i=K;i<n-K;i++){ let ph=true,pl=true;
    for(let j=i-K;j<=i+K;j++){ if(j===i)continue; if(kl[j].high>kl[i].high)ph=false; if(kl[j].low<kl[i].low)pl=false; }
    if(ph)piv.push({p:kl[i].high,i,v:kl[i].volume});
    if(pl)piv.push({p:kl[i].low,i,v:kl[i].volume}); }
  if(piv.length<2)return [];
  piv.sort((a,b)=>a.p-b.p);
  const zonas=[];
  piv.forEach(pv=>{ let z=null; for(const zz of zonas){ if(Math.abs(zz.c-pv.p)<=tol){ z=zz; break; } }
    if(!z){ z={c:pv.p,lo:pv.p,hi:pv.p,touches:0,last:0,sump:0,vol:0}; zonas.push(z); }
    z.touches++; z.lo=Math.min(z.lo,pv.p); z.hi=Math.max(z.hi,pv.p); z.last=Math.max(z.last,pv.i); z.sump+=pv.p; z.vol+=pv.v; z.c=z.sump/z.touches; });
  zonas.forEach(z=>{ z.score=z.touches*3 + (z.last/n)*2.5; z.kind=(z.c>=last)?'res':'sup'; z.dist=Math.abs(z.c-last)/last*100; });
  const res=zonas.filter(z=>z.kind==='res'&&z.touches>=1).sort((a,b)=>b.score-a.score).slice(0,2);
  const sup=zonas.filter(z=>z.kind==='sup'&&z.touches>=1).sort((a,b)=>b.score-a.score).slice(0,2);
  // etiqueta por cercanía (R1 el más cercano al precio, R2 el siguiente; igual S1/S2)
  res.sort((a,b)=>a.c-b.c).forEach((z,i)=>z.tag='R'+(i+1));
  sup.sort((a,b)=>b.c-a.c).forEach((z,i)=>z.tag='S'+(i+1));
  return [...res,...sup];
}
function emaArr(a,p){ const k=2/(p+1); let e=a[0]; for(let i=1;i<a.length;i++)e=a[i]*k+e*(1-k); return e; }
function emaFull(a,p){ const k=2/(p+1); let e=a[0]; const o=[e]; for(let i=1;i<a.length;i++){ e=a[i]*k+e*(1-k); o.push(e); } return o; }
function rsiCalc(cl,p=14){ if(cl.length<p+1)return 50; let g=0,l=0; for(let i=cl.length-p;i<cl.length;i++){ const dd=cl[i]-cl[i-1]; if(dd>=0)g+=dd; else l-=dd; } if(l===0)return 100; const rs=(g/p)/(l/p); return 100-100/(1+rs); }
function sentimiento(kl){ const side=document.getElementById('ob-mside'); if(!side)return;
  const cl=kl.map(k=>k.close), hi=kl.map(k=>k.high), lo=kl.map(k=>k.low), vol=kl.map(k=>k.volume), last=cl[cl.length-1];
  const e9=emaArr(cl,9),e21=emaArr(cl,21),e50=emaArr(cl,50); const trendUp=e9>e21, strongUp=e9>e21&&e21>e50;
  const r=rsiCalc(cl,14);
  const m12=emaFull(cl,12), m26=emaFull(cl,26), macd=m12.map((v,i)=>v-m26[i]), sig=emaFull(macd,9), mh=macd[macd.length-1]-sig[sig.length-1];
  let hh=-Infinity,ll=Infinity; for(let i=Math.max(0,cl.length-14);i<cl.length;i++){ if(hi[i]>hh)hh=hi[i]; if(lo[i]<ll)ll=lo[i]; } const stoch=hh>ll?(last-ll)/(hh-ll)*100:50;
  let pv=0,v=0; kl.slice(-60).forEach(k=>{ const tp=(k.high+k.low+k.close)/3; pv+=tp*k.volume; v+=k.volume; }); const vwap=v?pv/v:last, aboveV=last>=vwap;
  let atr=0,cnt=0; for(let i=Math.max(1,cl.length-14);i<cl.length;i++){ atr+=Math.max(hi[i]-lo[i],Math.abs(hi[i]-cl[i-1]),Math.abs(lo[i]-cl[i-1])); cnt++; } atr=cnt?atr/cnt/last*100:0;
  const v1=vol.slice(-10).reduce((a,b)=>a+b,0), v2=vol.slice(-20,-10).reduce((a,b)=>a+b,0)||1, volUp=v1>=v2;
  const m20=cl.slice(-20).reduce((a,b)=>a+b,0)/Math.min(20,cl.length); let sd=0; cl.slice(-20).forEach(c=>sd+=(c-m20)*(c-m20)); sd=Math.sqrt(sd/Math.min(20,cl.length)); const bb=sd?clamp(((last-m20)/(2*sd))*50+50,0,100):50;
  let sc=(strongUp?2:trendUp?1:-1)+(r>=55?1:r<=45?-1:0)+(mh>=0?1:-1)+(aboveV?1:-1)+(stoch>=55?1:stoch<=45?-1:0);
  const verd=sc>=3?['BULLISH','#2BF59E']:sc<=-3?['BEARISH','#FF4D6E']:['NEUTRAL','#d8b23a'], conv=Math.round(clamp(50+sc*8,5,96));
  const row=(k,val,c)=>`<div class="ob-sig"><span>${k}</span><b style="color:${c||'#cdd7e2'}">${val}</b></div>`, sc2=b=>b?'#2BF59E':'#FF4D6E';
  const resZ=(mSR||[]).filter(z=>z.kind==='res').sort((a,b)=>a.c-b.c);
  const supZ=(mSR||[]).filter(z=>z.kind==='sup').sort((a,b)=>b.c-a.c);
  const lvlRow=z=>{ const cc=z.kind==='res'?'#FF4D6E':'#2BF59E'; return `<div class="ob-sig"><span>${z.tag} · ${z.touches} ${z.touches>1?'touches':'touch'}</span><b style="color:${cc}">$${fmtP(z.c)} <small style="color:#7d8794;font-weight:500">${z.dist.toFixed(1)}%</small></b></div>`; };
  const nivHTML=(mSR&&mSR.length)?(resZ.map(lvlRow).join('')+`<div class="ob-sig"><span>Price now</span><b style="color:#eef4fb">$${fmtP(last)}</b></div>`+supZ.map(lvlRow).join('')):`<div class="ob-sig"><span>Building zones…</span><b style="color:#7d8794">—</b></div>`;
  // resumen en lenguaje claro: qué dice el conjunto, fácil de seguir para un trader
  const nearRes=resZ[0], nearSup=supZ[0];
  const dir=verd[0]==='BULLISH'?'Buyers in control':verd[0]==='BEARISH'?'Sellers in control':'Balanced tape';
  const momo=r>=70?' Momentum overbought,':r<=30?' Momentum oversold,':'';
  const watch=(verd[0]==='BEARISH'&&nearSup)?`watch support ${fmtP(nearSup.c)} (${nearSup.touches}× touched).`
            :(verd[0]==='BULLISH'&&nearRes)?`watch resistance ${fmtP(nearRes.c)} (${nearRes.touches}× touched).`
            :(nearRes&&nearSup)?`range ${fmtP(nearSup.c)} to ${fmtP(nearRes.c)}.`:'';
  const resumen=`${dir}, price ${aboveV?'above':'below'} VWAP.${momo} ${watch}`.replace(/\s+/g,' ').trim();
  side.innerHTML=`<div class="ob-verdict" style="color:${verd[1]}">${verd[0]}</div>
    <div class="ob-sub">Conviction ${conv}% · ${mTF}</div>
    <div class="ob-convbar"><i style="width:${conv}%;background:${verd[1]}"></i></div>
    <div class="ob-read">${resumen}</div>
    <div class="ob-sub">Momentum</div>
    ${row('Trend EMA 9/21/50', strongUp?'Strong up':trendUp?'Up':'Down', sc2(trendUp))}
    ${row('RSI 14', r.toFixed(0), r>=55?'#2BF59E':r<=45?'#FF4D6E':'#d8b23a')}
    ${row('MACD', mh>=0?'Bullish':'Bearish', sc2(mh>=0))}
    ${row('Stochastic', stoch.toFixed(0), stoch>=55?'#2BF59E':stoch<=45?'#FF4D6E':'#d8b23a')}
    <div class="ob-sub">Structure</div>
    ${row('vs VWAP', aboveV?'Above':'Below', sc2(aboveV))}
    ${row('Bollinger %', bb.toFixed(0), bb>=55?'#2BF59E':bb<=45?'#FF4D6E':'#d8b23a')}
    ${row('Volatility ATR', atr.toFixed(2)+'%', '#cdd7e2')}
    ${row('Volume', volUp?'Rising':'Falling', sc2(volUp))}
    <div class="ob-sub">Key liquidity levels</div>
    ${nivHTML}
    <div class="ob-sub" style="opacity:.55">Swing pivot zones · ${mTF} · not financial advice</div>`;
}
function cerrar(){
  cerrarDetalle();
  if(RAF)cancelAnimationFrame(RAF); RAF=0;
  if(Z._nivTimer){ clearInterval(Z._nivTimer); Z._nivTimer=null; }
  if(Z._cardTimer){ clearInterval(Z._cardTimer); Z._cardTimer=null; }
  try{ if(stream)stream.cerrar(); }catch(_){} stream=null;
  try{ if(tradeStream)tradeStream.cerrar(); }catch(_){} tradeStream=null;
  try{ if(depthStream)depthStream.cerrar(); }catch(_){} depthStream=null;
  try{ if(chainStream)chainStream.cerrar(); }catch(_){} chainStream=null;
  try{ if(liqStream)liqStream.cerrar(); }catch(_){} liqStream=null;
  if(Z._pulsoTimer){ clearInterval(Z._pulsoTimer); Z._pulsoTimer=null; }
  window.removeEventListener('resize',onResize);
  document.removeEventListener('visibilitychange',onVis); paused=false;
  const o=document.getElementById('ob-overlay'); if(o)o.remove();
  ov=cv=ctx=GL=glx=null; COINS=[]; green=[]; red=[]; strands=[]; strandsFaint=[]; booted=false;
  if(window.__ANALISIS_PAGINA__ && !document.getElementById('an-root')){ try{ location.href=new URL('../../index.html',import.meta.url).href; }catch(_){} }
}
