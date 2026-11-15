/* modules/orderblock/orderblock.js — "Order Block Liquidity"
   Radar de flujo de liquidez del mercado cripto. Módulo propio y aislado de la
   sección de Análisis (igual que Multichart / Footprint): monta un overlay a
   pantalla completa con un lienzo y corre el motor visual. Los datos son REALES
   y vienen de la capa aislada ./datos.js (Binance SPOT vía feed-shim + CoinGecko).

   Export: abrirOrderBlock()
*/
import * as D from './datos.js?v=3';

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
let LC=null, mChart=null, mSeries=null, mTF='1h', mCoin=null, mKl=[], mVP=null, mRO=null, mRAF=0;

/* ===== estado del modulo ===== */
let ov=null, cv=null, ctx=null, GL=null, glx=null, SB=null, sbx=null, RAF=0, stream=null, booted=false;
let W=0,H=0,DPR=1,PW=0,PH=0,SBW=1,SBH=1, DM=null, split=0.5, T=0, last=0, paused=false;
let COINS=[], green=[], red=[], strands=[], strandsFaint=[], hist=[];
const Z={}, mouse={x:-1,y:-1,on:false}, LOGO={}, EXVOL={}, EXIMG={};
let EXREADY=false, _exporting=false;
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
  const named=COINS.filter(c=>c.sym);
  const pr=(arr,asc)=>arr.sort((a,b)=>((b.major?1:0)-(a.major?1:0))||(asc?a.disp-b.disp:b.disp-a.disp));
  const g=pr(named.filter(c=>c.disp>0),false), r=pr(named.filter(c=>c.disp<0),true);
  const take=arr=>{ let i=0; return COLN.map(n=>{ const s=arr.slice(i,i+n); i+=n; return s; }); };
  green=take(g); red=take(r);
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
  Z.barX0=Math.round(W*0.315); Z.barW=Math.max(44,Math.round(W*0.032)); Z.barX1=Z.barX0+Z.barW;
  Z.vpLeftW=Math.round(W*0.06); Z.clX0=Z.barX1+Math.round(W*0.05);
  DM=null; buildCards(); placeCards(); buildStrands();
}
const PMIN=-4,PMAX=5.4, Y=p=>Z.y1-((p-PMIN)/(PMAX-PMIN))*(Z.y1-Z.y0);
function splitTarget(){ let up=0,w=0; COINS.forEach(c=>{ w+=c.vol; if(c.disp>=0)up+=c.vol; }); return w?clamp(up/w*1.08,0.32,0.8):0.5; }

function placeCards(){
  const ropeY=(Z.y0+Z.y1)/2, gap=8, colGap=Math.round(W*0.011);
  const widths=[Math.round(W*0.10),Math.round(W*0.12),Math.round(W*0.14),Math.round(W*0.165)];
  Z.cardTW=Math.max(210,widths[3]); Z.cardTH=180;   // tamano objetivo del zoom (parejo para todas)
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
  COINS.forEach(c=>{ const up=c.disp>=0, oy=(exchY[c.exch]!=null?exchY[c.exch]:mid)+rnd(-ch*0.34,ch*0.34);
    strands.push({ coin:c, y0:oy, up, exch:c.exch, sec:c.sec, phase:rnd(0,6.28), amp:rnd(4,13), hl:0,
      col:up?VERDE:ROSA, hero:(c.major||c.rank<=24), r:Math.random() }); });
  if(Z.exchOrder.length) for(let k=0;k<48;k++){ const ei=pick(Z.exchOrder), up=Math.random()<0.55;
    const oy=(exchY[ei]!=null?exchY[ei]:mid)+rnd(-ch*0.9,ch*0.9);
    strandsFaint.push({ y0:oy, up, exch:ei, phase:rnd(0,6.28), amp:rnd(5,15), hl:0, col:up?VERDE:ROSA, hero:false, r:Math.random() }); }
}
function strandPath(s){
  const x0=Z.funX0, x1=Z.barX0, N=28, pts=[];
  const divY=Z.y0+(1-split)*(Z.y1-Z.y0);
  const yEnd = s.up ? Z.y0+10 + s.r*(divY-Z.y0-20) : divY+10 + s.r*(Z.y1-divY-20);
  for(let k=0;k<=N;k++){ const t=k/N, x=x0+t*(x1-x0);
    const bulge=Math.sin(t*Math.PI), conv=Math.pow(t,1.6);
    const y = s.y0 + (yEnd-s.y0)*conv + Math.sin(t*4.5+s.phase)*s.amp*bulge;
    pts.push([x,y]); }
  return pts;
}

/* ===== animacion ===== */
function tick(dt){ T+=dt; split+=(splitTarget()-split)*0.02;
  COINS.forEach(c=>{ const o=Math.sin(T*0.5+c.ini)*0.05; const tg=c.pct+o*(c.major?0.4:1);
    c.vel+=(tg-c.disp)*0.012; c.vel*=0.93; c.disp+=c.vel*dt*60; }); }

/* ===== substrato ===== */
function dotMatrix(){ DM=document.createElement('canvas'); DM.width=PW; DM.height=PH;
  const d=DM.getContext('2d'); d.setTransform(DPR,0,0,DPR,0,0);
  const x0=Z.funX0-6,x1=Z.barX1+Z.vpLeftW,y0=Z.y0-6,y1=Z.y1+6,st=14;
  for(let y=y0;y<=y1;y+=st)for(let x=x0;x<=x1;x+=st){ const tr=(x-x0)/(x1-x0);
    d.fillStyle=`rgba(70,135,115,${(0.03+0.045*Math.sin(x*0.03)+0.05*tr).toFixed(3)})`; d.fillRect(x,y,1.5,1.5); } }
function substrate(){ ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,PW,PH);
  if(!DM)dotMatrix(); ctx.drawImage(DM,0,0); ctx.setTransform(DPR,0,0,DPR,0,0);
  [[2,.4],[1,.32],[-1,.3]].forEach(([p,a])=>{ const y=Y(p);
    const g=ctx.createLinearGradient(Z.funX0,0,Z.clX0,0);
    g.addColorStop(0,hexA(AZUL,0)); g.addColorStop(.12,hexA(AZUL,a)); g.addColorStop(.82,hexA(AZUL,a*.6)); g.addColorStop(1,hexA(AZUL,0));
    ctx.strokeStyle=g; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(Z.funX0,y); ctx.lineTo(Z.clX0,y); ctx.stroke(); }); }

/* ===== termometro ===== */
function thermo(g){ const x=Z.railX,w=9,y0=Z.y0,y1=Z.y1,h=y1-y0,r=w/2;
  let up=0; COINS.forEach(c=>{ if(c.disp>=0.3)up++; }); const lvl=COINS.length?up/COINS.length:0.5;
  g.save(); rr(g,x,y0,w,h,r); g.clip();
  const gr=g.createLinearGradient(0,y1,0,y0); gr.addColorStop(0,ROSA); gr.addColorStop(.5,'#d8b23a'); gr.addColorStop(.62,'#8fe07a'); gr.addColorStop(1,VERDE);
  g.fillStyle=gr; g.fillRect(x,y0,w,h);
  g.fillStyle='rgba(4,8,12,.6)'; g.fillRect(x,y0,w,(1-lvl)*h); g.restore();
  rr(g,x,y0,w,h,r); g.strokeStyle='rgba(180,210,230,.22)'; g.lineWidth=1; g.stroke();
  const ly=y1-lvl*h; g.fillStyle='#fff'; g.beginPath(); g.arc(x+w/2,ly,3,0,7); g.fill(); }

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
      g.globalAlpha=0.9*(0.6+0.4*s.hl); g.fillStyle=s.col; g.beginPath(); g.arc(qx,qy,s.hero?2.1:1.6,0,7); g.fill(); } };
  strandsFaint.forEach(s=>paint(s,true)); strands.forEach(s=>paint(s,false)); g.globalAlpha=1; }

/* ===== filtro central ===== */
function filterBar(g){
  const x0=Z.barX0,x1=Z.barX1,y0=Z.y0,y1=Z.y1,h=y1-y0,bw=x1-x0;
  const divY=y0+(1-split)*h;
  g.fillStyle=hexA(VERDE,0.14); g.fillRect(x0,y0,bw,divY-y0);
  g.fillStyle=hexA(ROSA,0.14); g.fillRect(x0,divY,bw,y1-divY);
  const sorted=COINS.slice().sort((a,b)=>b.disp-a.disp), n=sorted.length||1, lh=h/n;
  for(let i=0;i<sorted.length;i++){ const c=sorted[i], y=y0+i*lh, up=(y<divY);
    const len=bw*clamp(0.72+0.26*Math.sin(c.ini*5+i*0.7),0.42,1);
    g.fillStyle=up?VERDE:ROSA; g.globalAlpha=up?0.55:0.5; g.fillRect(x0,y,len,Math.max(0.8,lh*0.66)); }
  g.globalAlpha=1;
  g.fillStyle='rgba(255,255,255,.5)';
  for(let k=0;k<6;k++){ const yy=y0+((k*53+(T*8))%h); g.globalAlpha=.22+.18*Math.sin(T+k); g.beginPath(); g.arc(x0+bw*(0.3+0.5*((k*0.37)%1)),yy,1.1,0,7); g.fill(); }
  g.globalAlpha=1;
  g.strokeStyle='rgba(255,255,255,.92)'; g.lineWidth=2; g.beginPath(); g.moveTo(x0,y0); g.lineTo(x0,y1); g.stroke();
  g.beginPath(); g.moveTo(x0,divY); g.lineTo(x1+4,divY); g.stroke();
  const gH=Math.min(60,(divY-y0)*0.42), rH=Math.min(60,(y1-divY)*0.5);
  const gY=y0+12+(0.5+0.4*Math.sin(T*0.5))*Math.max(0,(divY-y0)-gH-24);
  const rY=divY+12+(0.5+0.4*Math.sin(T*0.5+2))*Math.max(0,(y1-divY)-rH-24);
  gate(g,x0,gY,bw,gH,VHI); gate(g,x0,rY,bw,rH,RHI);
  Z.gateG={x:x0,y:gY,w:bw,h:gH}; Z.gateR={x:x0,y:rY,w:bw,h:rH};
  cornerMarks(g,x0-7,y0-7,bw+14,h+14,18,hexA(VERDE,.55),1.6);
  g.font='600 13px "IBM Plex Mono",monospace'; g.fillStyle='rgba(220,235,245,.8)'; g.textAlign='center';
  g.fillText(String(COINS.length||0),(x0+x1)/2,y1+17); g.textAlign='left';
  Z.divY=divY;
}
function gate(g,x,y,w,h,hi){
  const rows=Math.max(5,Math.round(h/5));
  for(let r=0;r<rows;r++){ const yy=y+2+r*(h-4)/rows, len=w*(0.55+0.45*Math.abs(Math.sin(T*2+r*0.8)));
    g.fillStyle=hi; g.globalAlpha=0.5+0.45*Math.abs(Math.sin(T*2+r*0.6)); g.fillRect(x+1,yy,len,Math.max(1.4,(h-4)/rows-1.4)); }
  g.globalAlpha=1; cornerMarks(g,x-5,y-5,w+10,h+10,13,'#ffffff',1.8);
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
function logoExch(g,ei,x,y,chip){ const img=EXIMG[ei];
  if(!_exporting&&img&&img.complete&&img.naturalWidth){ g.save(); rr(g,x,y,chip,chip,chip*0.3); g.clip(); g.fillStyle='#0b1118'; g.fillRect(x,y,chip,chip); try{g.drawImage(img,x,y,chip,chip);}catch(_){} g.restore(); return; }
  const e=EXCH[ei], lg=g.createLinearGradient(x,y,x+chip,y+chip); lg.addColorStop(0,hexA(e[2],1)); lg.addColorStop(1,hexA(e[2],.55));
  g.fillStyle=lg; rr(g,x,y,chip,chip,chip*0.3); g.fill();
  g.fillStyle='#06100b'; g.font=`800 ${chip*0.4}px "Saira Condensed",sans-serif`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(e[1],x+chip/2,y+chip/2+0.5); g.textAlign='left'; g.textBaseline='alphabetic'; }
function exchangeCards(g){ const order=Z.exchOrder||[], n=order.length, gap=5, tot=Z.y1-Z.y0, ch=(tot-gap*Math.max(0,n-1))/Math.max(1,n);
  let net=0,wv=0,maxv=0; COINS.forEach(c=>{ net+=c.disp*c.vol; wv+=c.vol; }); net=wv?net/wv:0;
  order.forEach(ei=>{ if((EXVOL[ei]||0)>maxv)maxv=EXVOL[ei]||0; });
  const col=net>=0?VERDE:ROSA;                 // color por direccion real del mercado
  order.forEach((ei,i)=>{ const e=EXCH[ei], x=Z.secX, y=Z.y0+i*(ch+gap), w=Z.secW;
    rr(g,x,y,w,ch,6); g.fillStyle='rgba(11,18,26,.85)'; g.fill(); g.strokeStyle=hexA(col,.26); g.lineWidth=1; g.stroke();
    const chip=Math.min(22,ch*0.52), cyh=y+(ch-chip)/2; logoExch(g,ei,x+8,cyh,chip);
    const tx=x+8+chip+9;
    g.fillStyle='#eaf0f6'; g.font='700 14px "Saira Condensed",sans-serif'; g.textAlign='left'; g.fillText(e[0],tx,y+ch*0.44);
    const vol=EXVOL[ei]||0;
    g.fillStyle='rgba(176,187,200,.92)'; g.font='600 11px "IBM Plex Mono",monospace'; g.textAlign='right'; g.fillText(vol?('$'+fmtVol(vol)):'LIVE',x+w-9,y+ch*0.44); g.textAlign='left';
    const frac=maxv?vol/maxv:0, bw2=w-(tx-x)-9, cy=y+ch-10, chh=Math.min(7,ch*0.2);
    g.fillStyle='rgba(255,255,255,.07)'; rr(g,tx,cy,bw2,chh,1.5); g.fill();
    g.fillStyle=col; g.globalAlpha=.9; rr(g,tx,cy,Math.max(2,bw2*frac),chh,1.5); g.fill(); g.globalAlpha=1; }); }

/* ===== tarjeta ===== */
function logoChip(g,c,x,y,chip,col,hi){
  const img=LOGO[c.sym];
  if(!_exporting && img && img.complete && img.naturalWidth){ g.save(); rr(g,x,y,chip,chip,chip*0.3); g.clip();
    g.fillStyle='#0b1118'; g.fillRect(x,y,chip,chip); try{ g.drawImage(img,x,y,chip,chip); }catch(_){}
    g.restore(); g.strokeStyle=hexA(col,.5); g.lineWidth=1; rr(g,x,y,chip,chip,chip*0.3); g.stroke(); return; }
  const lg=g.createLinearGradient(x,y,x+chip,y+chip); lg.addColorStop(0,hi); lg.addColorStop(1,col);
  g.fillStyle=lg; rr(g,x,y,chip,chip,chip*0.3); g.fill();
  g.fillStyle='#04130c'; g.font=`800 ${chip*0.42}px "Saira Condensed",sans-serif`; g.textAlign='center'; g.textBaseline='middle';
  g.fillText((c.sym||'··').slice(0,3),x+chip/2,y+chip/2+0.5); g.textAlign='left'; g.textBaseline='alphabetic';
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
  g.fillStyle=col; g.font=`600 ${fs*0.76}px "IBM Plex Mono",monospace`; g.fillText((c.disp>=0?'+':'')+c.disp.toFixed(2)+'%',tx,y+pad+fs*0.82+fs*0.82);
  const headB=y+pad+chip+6, vx=x+pad, vy=headB, vw=w-pad*2, vh=y+h-pad-7-vy;
  if(vh>16 && c.vp && c.vp.length){ const rows=clamp(Math.round(vh/2.4),12,64), rh=vh/rows, M=c.vp.length, maxv=Math.max.apply(null,c.vp)||1;
    let poc=0,pm=-1; for(let i=0;i<rows;i++){ const vv=c.vp[Math.min(M-1,(i/rows*M)|0)]; if(vv>pm){pm=vv;poc=i;} }
    for(let i=0;i<rows;i++){ const vv=c.vp[Math.min(M-1,(i/rows*M)|0)], ob=Math.abs(i-poc)<=2, len=(vv/maxv)*vw;
      g.fillStyle=ob?hi:col; g.globalAlpha=ob?0.85:0.28; g.fillRect(vx,vy+i*rh,Math.max(1.2,len),Math.max(1,rh*0.5)); } g.globalAlpha=1;
    const lvl=(ry,price,tag,tcol,thi)=>{ if(!(price>0))return; const ly=vy+ry*vh;
      g.strokeStyle=tag?hexA(tcol,.9):'rgba(255,255,255,.9)'; g.setLineDash(tag?[]:[3,3]); g.lineWidth=tag?1.5:1.1;
      g.beginPath(); g.moveTo(vx,ly); g.lineTo(vx+vw,ly); g.stroke(); g.setLineDash([]);
      const t=fmtP(price); g.font='600 10px "IBM Plex Mono",monospace'; const pw=g.measureText(t).width+(tag?18:11);
      rr(g,vx+vw-pw,ly-7,pw,14,3); g.fillStyle='rgba(236,243,249,.96)'; g.fill();
      if(tag){ g.fillStyle=tcol; g.font='800 9px "Saira Condensed",sans-serif'; g.textBaseline='middle'; g.fillText(tag,vx+vw-pw+4,ly); }
      g.fillStyle='#0a1510'; g.font='600 10px "IBM Plex Mono",monospace'; g.textAlign='right'; g.textBaseline='middle'; g.fillText(t,vx+vw-4,ly); g.textAlign='left'; g.textBaseline='alphabetic'; };
    // SELL en la resistencia mas relevante (arriba), BUY en el soporte mas relevante (abajo), precio actual al centro.
    // tarjeta alta o con zoom = 3 niveles; tarjeta corta en reposo = solo precio actual.
    // resistencia = liquidez bajista (▼ rojo); soporte = liquidez alcista (▲ verde); precio actual al centro
    if(vh>=46 || z>0.5){ lvl(0.15,c.res,'▼',ROSA,RHI); lvl(0.5,c.cur,null,null,null); lvl(0.85,c.sup,'▲',VERDE,VHI); }
    else { lvl(0.5,c.cur,null,null,null); }
  }
}
function drawCards(g){ const all=[]; [green,red].forEach(cols=>cols.forEach(col=>col.forEach(c=>all.push(c))));
  let hov=null; for(const c of all){ if((c._z||0)>0.5 && (!hov||c._z>hov._z)) hov=c; }
  for(const c of all){ if(c!==hov) card(g,c); }
  if(hov) card(g,hov); }

/* ===== header ===== */
function header(g){ g.textBaseline='alphabetic'; g.textAlign='left';
  g.fillStyle='rgba(86,103,122,.8)'; g.font='500 12px "IBM Plex Mono",monospace';
  [[5,'+5'],[3,'+3'],[2,'+2'],[1,'+1'],[0,'0'],[-2,'−2']].forEach(([p,t])=>{ const y=Y(p); g.fillText(t,14,y+4);
    g.strokeStyle='rgba(51,66,79,.7)'; g.lineWidth=1; g.beginPath(); g.moveTo(32,y); g.lineTo(40,y); g.stroke(); });
  const d=new Date(),p2=x=>String(x).padStart(2,'0');
  g.textAlign='right'; g.fillStyle='rgba(83,103,122,.65)'; g.font='400 11px "IBM Plex Mono",monospace'; g.fillText(`${d.getUTCFullYear()}-${p2(d.getUTCMonth()+1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`,W-18,H-14); g.textAlign='left'; }

/* ===== hover ===== */
function hover(){ strands.forEach(s=>s.hl=Math.max(0,s.hl-0.08)); COINS.forEach(c=>c._hl=Math.max(0,(c._hl||0)-0.08));
  // zoom de tarjetas (siempre corre: decae aunque no haya cursor)
  const vis=tarjetasVisibles(); let tgt=null;
  if(mouse.on){ for(const c of vis){ if(mouse.x>=c._x&&mouse.x<=c._x+c._w&&mouse.y>=c._y&&mouse.y<=c._y+c._h){ tgt=c; break; } } }
  vis.forEach(c=>{ const to=(c===tgt)?1:0; c._z=(c._z||0)+(to-(c._z||0))*0.2; if(c._z<0.001)c._z=0; });
  if(tgt){ tgt._hl=1; }
  if(!mouse.on)return;
  if(mouse.x>Z.funX0-20&&mouse.x<Z.barX0+30){ let best=null,bd=1e9;
    strands.forEach(s=>{ const pts=strandPath(s); for(let i=0;i<pts.length;i+=4){ const dx=pts[i][0]-mouse.x,dy=pts[i][1]-mouse.y,d=dx*dx+dy*dy; if(d<bd){bd=d;best=s;} } });
    if(best&&bd<1100){ best.hl=1; const ex=best.exch;
      strands.forEach(s=>{ if(s.exch===ex)s.hl=Math.max(s.hl,0.7); });
      [green,red].forEach(cols=>cols.forEach(col=>col.forEach(c=>{ if(c.exch===ex)c._hl=1; }))); } }
}

/* ===== loop ===== */
function renderOnce(){
  substrate();
  glx.setTransform(1,0,0,1,0,0); glx.clearRect(0,0,PW,PH); glx.setTransform(DPR,0,0,DPR,0,0);
  drawStrands(glx); filterBar(glx); clusterThreads(glx); rope(glx);
  ctx.setTransform(1,0,0,1,0,0);
  // glow barato: reduce a la mitad, desenfoque chico y lo re-escala (mucho mas ligero que blur a resolucion completa)
  sbx.setTransform(1,0,0,1,0,0); sbx.clearRect(0,0,SBW,SBH); sbx.imageSmoothingEnabled=true; sbx.drawImage(GL,0,0,PW,PH,0,0,SBW,SBH);
  ctx.save(); ctx.filter='blur(2px)'; ctx.globalAlpha=0.6; ctx.imageSmoothingEnabled=true; ctx.drawImage(SB,0,0,SBW,SBH,0,0,PW,PH); ctx.restore();
  ctx.globalAlpha=1; ctx.drawImage(GL,0,0); ctx.setTransform(DPR,0,0,DPR,0,0);
  thermo(ctx); exchangeCards(ctx); drawCards(ctx); header(ctx);
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
function aplicarTick(map){ for(const c of COINS){ const t=map[c.symbol]; if(t){ c.pct=t.chgPct; c.price=t.price; if(t.volQuote>0)c.vol=t.volQuote; } } }
let _nivBusy=false;
async function refrescarNiveles(){ if(_nivBusy)return; _nivBusy=true;
  try{ const vis=tarjetasVisibles();
    for(const c of vis){ try{ const nv=await D.niveles(c.symbol,'4h'); if(nv){ c.vp=nv.vp.map(p=>p.v); c.vpHi=nv.hi; c.vpLo=nv.lo; c.cur=nv.cur; c.sup=nv.sup; c.res=nv.res; } }catch(_){}
      await new Promise(r=>setTimeout(r,60)); }      // escalonado, no satura la API
  } finally{ _nivBusy=false; }
}
async function cargarLogos(){ let m={}; try{ m=await D.logosPorSimbolo(); }catch(_){ m={}; }
  COINS.forEach(c=>{ const url=m[c.sym]; if(url && !LOGO[c.sym]){ const im=new Image(); im.crossOrigin='anonymous'; im.referrerPolicy='no-referrer'; im.src=url; LOGO[c.sym]=im; } }); }
async function cargarExchanges(){ let list=[]; try{ list=await D.exchanges(); }catch(_){ list=[]; }
  const btc=((COINS.find(c=>c.sym==='BTC')||{}).price)||0;
  EXCH.forEach((e,i)=>{ const first=e[0].toLowerCase().split(' ')[0];
    let best=null; for(const x of list){ const xn=(x.name||'').toLowerCase(); if(xn.indexOf(first)>=0){ if(!best||x.volBtc>best.volBtc)best=x; } }
    if(best){ EXVOL[i]=best.volBtc*(btc||1); if(best.image && !EXIMG[i]){ const im=new Image(); im.crossOrigin='anonymous'; im.referrerPolicy='no-referrer'; im.src=best.image; EXIMG[i]=im; } } });
  EXREADY=true; if(cv) buildStrands(); }

/* ===== estilos + overlay ===== */
const IC={
  back:'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  exp:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>',
  x:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>'
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
  .ob-mchart{position:relative;flex:1 1 auto;min-width:0}
  .ob-mvp{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2}
  .ob-mside{flex:0 0 auto;width:236px;border-left:1px solid #1d242d;padding:12px 13px 16px;overflow:auto;color:#cdd7e2}
  .ob-verdict{font-weight:800;font-size:26px;letter-spacing:.02em;line-height:1}
  .ob-sub{color:#7d8794;font-size:11px;letter-spacing:.13em;text-transform:uppercase;margin:12px 0 6px}
  .ob-sig{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #141b22;font-size:13px}
  .ob-sig b{font-family:'IBM Plex Mono',monospace;font-weight:600}
  @media(max-width:760px){.ob-mside{display:none}}`;
  document.head.appendChild(s);
}

function exportar(){
  // re-render a un lienzo limpio (sin logos cross-origin) para poder exportar, con fondo y marca.
  const oc=ctx,oG=GL,og=glx,oS=SB,os=sbx,oDM=DM;
  const tmp=document.createElement('canvas'); tmp.width=PW; tmp.height=PH;
  const tG=document.createElement('canvas'); tG.width=PW; tG.height=PH;
  const tS=document.createElement('canvas'); tS.width=SBW; tS.height=SBH;
  ctx=tmp.getContext('2d'); GL=tG; glx=tG.getContext('2d'); SB=tS; sbx=tS.getContext('2d'); DM=null;
  _exporting=true; try{ renderOnce(); }catch(_){} _exporting=false;
  ctx=oc; GL=oG; glx=og; SB=oS; sbx=os; DM=oDM;
  let url=null;
  try{
    const out=document.createElement('canvas'); out.width=PW; out.height=PH; const o2=out.getContext('2d');
    const bg=o2.createLinearGradient(0,0,0,PH); bg.addColorStop(0,'#05080f'); bg.addColorStop(.55,'#04060c'); bg.addColorStop(1,'#03050a');
    o2.fillStyle=bg; o2.fillRect(0,0,PW,PH); o2.drawImage(tmp,0,0);
    o2.setTransform(DPR,0,0,DPR,0,0);
    o2.fillStyle='rgba(4,7,13,.55)'; o2.fillRect(0,H-38,W,38);
    const by=H-19; o2.textBaseline='middle';
    o2.fillStyle='#2BF59E'; o2.font='700 15px "Saira Condensed",sans-serif'; o2.textAlign='left'; o2.fillText('● DECFREEDOM',16,by);
    o2.fillStyle='rgba(176,187,200,.9)'; o2.font='600 12px "IBM Plex Mono",monospace'; o2.fillText('decfreedom.com · Order Block Liquidity',150,by);
    const d=new Date(),p2=x=>String(x).padStart(2,'0');
    o2.textAlign='right'; o2.fillStyle='rgba(120,135,150,.9)'; o2.fillText(`${d.getUTCFullYear()}-${p2(d.getUTCMonth()+1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`,W-16,by);
    url=out.toDataURL('image/png');
  }catch(_){}
  if(url){ const a=document.createElement('a'); a.download='order-block-liquidity.png'; a.href=url; a.click(); }
}

export async function abrirOrderBlock(){
  if(document.getElementById('ob-overlay'))return;
  estilos();
  ov=document.createElement('div'); ov.id='ob-overlay';
  ov.innerHTML=`
    <div class="ob-top">
      <button class="ob-back" id="ob-back">${IC.back}Back</button>
      <div class="ob-sp"></div>
      <button class="ob-ico" id="ob-cam" title="Export image">${IC.exp}</button>
    </div>
    <div class="ob-stage" id="ob-stage">
      <canvas id="ob-cv"></canvas>
      <div id="ob-load"><div class="sp"></div><b>LOADING LIQUIDITY…</b></div>
    </div>`;
  document.body.appendChild(ov);
  cv=document.getElementById('ob-cv'); ctx=cv.getContext('2d');
  GL=document.createElement('canvas'); glx=GL.getContext('2d');
  SB=document.createElement('canvas'); sbx=SB.getContext('2d');
  document.getElementById('ob-back').onclick=cerrar;
  document.getElementById('ob-cam').onclick=exportar;
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
  refrescarNiveles();
  Z._nivTimer=setInterval(refrescarNiveles, 70000);
  document.addEventListener('visibilitychange',onVis);
}
function onVis(){ if(document.hidden){ paused=true; if(RAF)cancelAnimationFrame(RAF); RAF=0; }
  else if(paused){ paused=false; last=performance.now(); RAF=requestAnimationFrame(frame); } }
function boot(){ if(booted)return; booted=true; layout(); last=performance.now();
  if(document.fonts&&document.fonts.ready){ document.fonts.ready.then(()=>{DM=null;}); }
  RAF=requestAnimationFrame(frame); }
function onResize(){ if(cv) layout(); }
function onClick(e){ const r=cv.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
  const vis=tarjetasVisibles();
  for(const c of vis){ if(mx>=c._x&&mx<=c._x+c._w&&my>=c._y&&my<=c._y+c._h){ abrirDetalle(c); return; } } }
/* ===== modal de detalle (click en tarjeta): grafico real + perfil de volumen + niveles + tendencia ===== */
function cerrarDetalle(){ try{ if(mRO)mRO.disconnect(); }catch(_){} mRO=null;
  if(mRAF){ cancelAnimationFrame(mRAF); mRAF=0; }
  try{ if(mChart)mChart.remove(); }catch(_){} mChart=mSeries=null; mVP=null; mKl=[]; mCoin=null;
  const w=document.getElementById('ob-mwrap'); if(w)w.remove(); }
async function abrirDetalle(c){
  if(document.getElementById('ob-mwrap'))return;
  mCoin=c; mTF='1h';
  const wrap=document.createElement('div'); wrap.id='ob-mwrap';
  const colc=c._up?'#2BF59E':'#FF4D6E';
  wrap.innerHTML=`<div class="ob-modal">
    <div class="ob-mhead">
      <div class="ob-mlg" id="ob-mlg">${(c.sym||'·').slice(0,3)}</div>
      <span class="nm">${c.sym||''}</span>
      <span class="pc" id="ob-mpc" style="color:${colc}"></span>
      <span class="pr" id="ob-mpr"></span>
      <div class="ob-msp"></div>
      <div class="ob-tf" id="ob-mtf">${['15m','1h','4h','1d'].map(t=>`<button data-tf="${t}" class="${t==='1h'?'on':''}">${t}</button>`).join('')}</div>
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
  const lg=document.getElementById('ob-mlg'), im=LOGO[c.sym]; if(im&&im.src){ lg.style.backgroundImage=`url(${im.src})`; lg.textContent=''; }
  document.getElementById('ob-mpc').textContent=(c.disp>=0?'+':'')+(c.disp||0).toFixed(2)+'%';
  document.getElementById('ob-mpr').textContent='$'+fmtP(c.price||c.cur||0);
  document.getElementById('ob-mtf').querySelectorAll('button').forEach(b=>b.onclick=()=>{ mTF=b.dataset.tf;
    document.getElementById('ob-mtf').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b)); cargarChart(); });
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
  try{ mChart.timeScale().fitContent(); }catch(_){}
  sentimiento(kl);
}
function modalLoop(){ if(!document.getElementById('ob-mwrap')){ mRAF=0; return; } try{ dibujarOverlay(); }catch(_){} mRAF=requestAnimationFrame(modalLoop); }
function dibujarOverlay(){ const cv2=document.getElementById('ob-mvp'), host=document.getElementById('ob-mchart'); if(!cv2||!host||!mSeries||!mVP)return;
  const d=Math.min(2,window.devicePixelRatio||1), w=host.clientWidth, h=host.clientHeight; if(w<10||h<10)return;
  if(cv2.width!==((w*d)|0)||cv2.height!==((h*d)|0)){ cv2.width=w*d; cv2.height=h*d; }
  const x=cv2.getContext('2d'); x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,w,h);
  let axisW=58; try{ axisW=mChart.priceScale('right').width()||58; }catch(_){}
  const plotR=w-axisW-2, T2=performance.now()*0.001, {lo,hi,N,bins,poc,mx}=mVP;
  if(hi>lo){ for(let i=0;i<N;i++){ const price=lo+(i+0.5)/N*(hi-lo); let yy; try{ yy=mSeries.priceToCoordinate(price); }catch(_){ yy=null; } if(yy==null)continue;
    const len=(bins[i]/mx)*(plotR*0.32)*(0.88+0.12*Math.sin(T2*2+i*0.5)), ob=Math.abs(i-poc)<=1, rgb=ob?'196,255,226':'43,245,158';
    const grd=x.createLinearGradient(plotR-len,0,plotR,0); grd.addColorStop(0,`rgba(${rgb},0)`); grd.addColorStop(1,`rgba(${rgb},${ob?.62:.26})`);
    x.fillStyle=grd; x.fillRect(plotR-len,yy-1.8,len,3.4); } }
  const banda=(price,rgb,label)=>{ if(!(price>0))return; let yy; try{ yy=mSeries.priceToCoordinate(price); }catch(_){ yy=null; } if(yy==null)return;
    const pulse=0.5+0.5*Math.sin(T2*2.2), bh=5+3*pulse;
    const g2=x.createLinearGradient(0,yy-bh,0,yy+bh); g2.addColorStop(0,`rgba(${rgb},0)`); g2.addColorStop(.5,`rgba(${rgb},${.3+.22*pulse})`); g2.addColorStop(1,`rgba(${rgb},0)`);
    x.fillStyle=g2; x.fillRect(0,yy-bh,plotR,bh*2);
    x.save(); x.setLineDash([9,7]); x.lineDashOffset=-((T2*34)%16); x.strokeStyle=`rgba(${rgb},${.7+.25*pulse})`; x.lineWidth=2; x.beginPath(); x.moveTo(0,yy); x.lineTo(plotR,yy); x.stroke(); x.restore();
    x.font='800 10px "Saira Condensed",sans-serif'; const tw=x.measureText(label).width+14;
    x.fillStyle=`rgba(${rgb},.95)`; rr(x,8,yy-9,tw,18,4); x.fill();
    x.fillStyle='#08110c'; x.textBaseline='middle'; x.textAlign='left'; x.fillText(label,16,yy+1); x.textBaseline='alphabetic'; };
  banda(mCoin.res,'255,77,110','BEARISH LIQUIDITY');
  banda(mCoin.sup,'43,245,158','BULLISH LIQUIDITY');
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
  side.innerHTML=`<div class="ob-verdict" style="color:${verd[1]}">${verd[0]}</div>
    <div class="ob-sub">Conviction ${conv}% · ${mTF}</div>
    ${row('Trend EMA 9/21/50', strongUp?'Strong up':trendUp?'Up':'Down', sc2(trendUp))}
    ${row('RSI 14', r.toFixed(0), r>=55?'#2BF59E':r<=45?'#FF4D6E':'#d8b23a')}
    ${row('MACD', mh>=0?'Bullish':'Bearish', sc2(mh>=0))}
    ${row('Stochastic', stoch.toFixed(0), stoch>=55?'#2BF59E':stoch<=45?'#FF4D6E':'#d8b23a')}
    ${row('Bollinger %', bb.toFixed(0), bb>=55?'#2BF59E':bb<=45?'#FF4D6E':'#d8b23a')}
    ${row('vs VWAP', aboveV?'Above':'Below', sc2(aboveV))}
    ${row('Volatility ATR', atr.toFixed(2)+'%', '#cdd7e2')}
    ${row('Volume', volUp?'Rising':'Falling', sc2(volUp))}
    <div class="ob-sub">Liquidity levels</div>
    ${row('Bearish liq.', '$'+fmtP(mCoin.res||0), '#FF4D6E')}
    ${row('Price', '$'+fmtP(last), '#cdd7e2')}
    ${row('Bullish liq.', '$'+fmtP(mCoin.sup||0), '#2BF59E')}
    <div class="ob-sub" style="opacity:.55">Not financial advice</div>`;
}
function cerrar(){
  cerrarDetalle();
  if(RAF)cancelAnimationFrame(RAF); RAF=0;
  if(Z._nivTimer){ clearInterval(Z._nivTimer); Z._nivTimer=null; }
  try{ if(stream)stream.cerrar(); }catch(_){} stream=null;
  window.removeEventListener('resize',onResize);
  document.removeEventListener('visibilitychange',onVis); paused=false;
  const o=document.getElementById('ob-overlay'); if(o)o.remove();
  ov=cv=ctx=GL=glx=null; COINS=[]; green=[]; red=[]; strands=[]; strandsFaint=[]; booted=false;
  if(window.__ANALISIS_PAGINA__ && !document.getElementById('an-root')){ try{ location.href=new URL('../../index.html',import.meta.url).href; }catch(_){} }
}
