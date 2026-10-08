/* ──────────────────────────────────────────────────────────────────────────
   Shared contracts view: renders the verifiable address list AND the animated
   contract-network brain. Used by transparency.html (full page) and by the
   Transparency section of the lobby (index.html). Reads window.CONTRATOS.
   All asset paths are ABSOLUTE so it works from any folder depth.
   ────────────────────────────────────────────────────────────────────────── */
(function(){
  if(window.CCView) return;
  var LOGO='/assets/portada/red/';
  var COL={core:"#9B93F0",oracle:"#EF9F27",trade:"#22B184",p2p:"#4D97E8",shield:"#7FB52E",fut:"#E86A3C",stake:"#DE6A92"};
  var bs=function(a){return "https://bscscan.com/address/"+a+"#code";};

  /* Shared styles (literal colors + !important so no host stylesheet overrides them). */
  var css=''
   /* 3D gold-beveled window that holds the cards: warm-dark fill, gold rim,
      real drop shadow (not glow) and a raised 3D base, like the site buttons. */
   +'.cc-panel{position:relative;background:linear-gradient(180deg,#16130b,#0b0906);border-radius:16px;padding:12px;'
   +'box-shadow:inset 0 1px 0 rgba(247,219,141,.2),inset 0 0 0 1px rgba(201,148,38,.3),0 24px 50px rgba(0,0,0,.6),0 6px 0 #352810}'
   +'.cc-scroll{overflow:auto;padding:16px 7px;'
   +'-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%);'
   +'mask-image:linear-gradient(to bottom,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%)}'
   +'.cc-scroll::-webkit-scrollbar{width:7px}'
   +'.cc-scroll::-webkit-scrollbar-track{background:transparent}'
   +'.cc-scroll::-webkit-scrollbar-thumb{background:rgba(232,184,75,.32);border-radius:9px}'
   /* cards */
   +'.cc-card{background:rgba(26,21,10,.55)!important;border:1px solid #2a2415!important;border-radius:12px;padding:12px 14px;margin-bottom:10px}'
   +'.cc-card:last-child{margin-bottom:0}'
   +'.cc-name{display:flex;align-items:center;gap:9px;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:14.5px;color:#f1e3c4;margin-bottom:3px}'
   +'.cc-dot{width:9px;height:9px;border-radius:50%;flex:none}'
   +'.cc-row{display:flex;align-items:center;gap:9px;margin-top:7px}'
   +'.cc-tag{flex:none;width:42px;font-size:11px;color:#8a7b5c;font-weight:600;letter-spacing:.02em;font-family:"Plus Jakarta Sans",system-ui,sans-serif}'
   +'.cc-addr{flex:1;min-width:0;font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-size:10.5px;color:#b6ab93;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
   +'.cc-btns{flex:none;display:flex;gap:6px}'
   /* buttons: forced gold-outline pills, consistent in every context */
   +'.cc-btn{font-family:"Plus Jakarta Sans",system-ui,sans-serif!important;font-size:10.5px!important;font-weight:600!important;'
   +'border:1px solid rgba(232,184,75,.42)!important;background:rgba(232,184,75,.08)!important;color:#E8B84B!important;'
   +'border-radius:7px!important;padding:4px 10px!important;cursor:pointer;white-space:nowrap;text-decoration:none!important;'
   +'display:inline-flex!important;align-items:center;line-height:1;box-shadow:inset 0 1px 0 rgba(255,255,255,.06);transition:background .15s,border-color .15s}'
   +'.cc-btn:hover{background:rgba(232,184,75,.2)!important;border-color:rgba(232,184,75,.7)!important}'
   +'.cc-net{display:block;width:100%;height:auto;touch-action:none;cursor:default}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  /* ── List: name + the two addresses, each on ONE aligned line ── */
  function row(tag,addr){
    return '<div class="cc-row"><span class="cc-tag">'+tag+'</span>'
      +'<span class="cc-addr" title="'+addr+'">'+addr+'</span>'
      +'<span class="cc-btns"><button class="cc-btn" data-cp="'+addr+'">Copy</button>'
      +'<a class="cc-btn" href="'+bs(addr)+'" target="_blank" rel="noopener">BscScan</a></span></div>';
  }
  function renderList(el){
    var D=window.CONTRATOS||[],html="";
    D.forEach(function(c){
      html+='<div class="cc-card"><div class="cc-name"><span class="cc-dot" style="background:'+(COL[c.cat]||'#888')+'"></span>'+c.nombre+'</div>';
      html+=row('Proxy',c.proxy);
      if(c.impl)html+=row('Impl',c.impl);
      html+='</div>';
    });
    el.innerHTML=html;
    el.addEventListener("click",function(e){var b=e.target.closest("[data-cp]");if(!b)return;try{navigator.clipboard.writeText(b.getAttribute("data-cp"));var t=b.textContent;b.textContent="Copied";setTimeout(function(){b.textContent=t;},1200);}catch(_){}});
  }

  /* ── Brain: logical 720x500, shown as a responsive box (width:100%;height:auto).
       Circle slightly widened (RD=200) and labels on near-vertical nodes aligned
       sideways, so the two bottom names (OraculoPrecios / OracleGuard) separate.
       Draw order: brain (back, floating) -> dotted lines (middle) -> logos (front). ── */
  function renderBrain(cv){
    var D=window.CONTRATOS||[];
    var ctx=cv.getContext("2d");
    if(!cv.classList.contains("cc-net"))cv.classList.add("cc-net");
    var W=720,H=500,dpr=Math.min(window.devicePixelRatio||1,2);
    cv.width=W*dpr;cv.height=H*dpr;ctx.scale(dpr,dpr);
    var cx=W/2,cy=H/2,RNODE=24,RHUB=44,M=30,RD=200;
    var ring=D.filter(function(c){return !c.hub;});
    var byId={},arr=[],imgs={};
    D.forEach(function(c){imgs[c.logo]=new Image();imgs[c.logo].src=LOGO+c.logo+".webp";});
    var brain=new Image();brain.src=LOGO+"cerebro.webp";
    var k=0;
    D.forEach(function(c){var n={id:c.id,cat:c.cat,hub:!!c.hub,logo:c.logo,url:bs(c.proxy),hs:1,free:false,x:cx,y:cy,holdUntil:0};
      if(n.hub){n.tx=cx;n.ty=cy;n.ang=0;}else{var i=k++;var a=-Math.PI/2+i*(2*Math.PI/ring.length);n.ang=a;n.tx=cx+RD*Math.cos(a);n.ty=cy+RD*Math.sin(a);n.delay=i*0.03;}
      byId[c.id]=n;arr.push(n);});
    var E=[];D.forEach(function(c){(c.conecta||[]).forEach(function(t){if(byId[t])E.push([c.id,t]);});});
    var mp={x:-999,y:-999},over=false,drag=null,offx=0,offy=0,moved=false,t0=performance.now();
    function toC(ev){var r=cv.getBoundingClientRect();var e=ev.touches?ev.touches[0]:ev;return{x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)};}
    function cX(v){return Math.max(M,Math.min(W-M,v));}
    function cY(v){return Math.max(M,Math.min(H-M,v));}
    function pick(p){var best=1e9,hit=null;arr.forEach(function(n){var rr=(n.hub?RHUB:RNODE)*n.hs+6;var d=Math.hypot(n.x-p.x,n.y-p.y);if(d<rr&&d<best){best=d;hit=n;}});return hit;}
    cv.addEventListener("mousemove",function(ev){mp=toC(ev);over=true;if(drag&&!drag.hub){drag.x=cX(mp.x+offx);drag.y=cY(mp.y+offy);moved=true;}});
    cv.addEventListener("mouseleave",function(){over=false;});
    function down(ev){var p=toC(ev);var n=pick(p);if(n){moved=false;if(!n.hub){drag=n;n.free=true;offx=n.x-p.x;offy=n.y-p.y;cv.style.cursor="grabbing";}else{drag=n;offx=0;offy=0;}}}
    function up(){if(drag){if(!moved&&drag.url)window.open(drag.url,"_blank","noopener");if(!drag.hub)drag.holdUntil=performance.now()+2800;drag=null;cv.style.cursor="default";}}
    cv.addEventListener("mousedown",down);window.addEventListener("mouseup",up);
    cv.addEventListener("touchstart",function(e){down(e);},{passive:true});
    cv.addEventListener("touchmove",function(e){mp=toC(e);if(drag&&!drag.hub){drag.x=cX(mp.x+offx);drag.y=cY(mp.y+offy);moved=true;}},{passive:true});
    cv.addEventListener("touchend",up);
    function ease(x){return 1-Math.pow(1-Math.max(0,Math.min(1,x)),3);}
    function logo(n,r){var im=imgs[n.logo];if(im&&im.complete&&im.naturalWidth){ctx.drawImage(im,n.x-r,n.y-r,r*2,r*2);}else{ctx.beginPath();ctx.arc(n.x,n.y,r,0,7);ctx.fillStyle="rgba(232,184,75,.15)";ctx.fill();}}
    function draw(now){
      var T=(now-t0)/1000;
      arr.forEach(function(n){var bp=n.hub?1:ease((T-n.delay)/1.1);var hx=cx+(n.tx-cx)*bp,hy=cy+(n.ty-cy)*bp;
        if(drag===n){}else if(n.free){if(now<n.holdUntil){}else{n.x+=(hx-n.x)*0.08;n.y+=(hy-n.y)*0.08;if(Math.hypot(hx-n.x,hy-n.y)<1.5)n.free=false;}}else{n.x=hx;n.y=hy;}
        n.op=n.hub?Math.min(1,T/0.5):bp;});
      var act=drag&&!drag.hub?drag:(over?pick(mp):null);if(!drag)cv.style.cursor=act?"pointer":"default";
      arr.forEach(function(n){var isA=act&&act.id===n.id;n.hs+=((isA?1.4:1)-n.hs)*0.22;});
      ctx.clearRect(0,0,W,H);var ga=Math.min(1,T/0.5);
      if(brain.complete&&brain.naturalWidth){
        var fx=Math.sin(now/1700)*5, fy=Math.sin(now/1250+1.3)*8, fsc=1+Math.sin(now/2100)*0.02;
        var bsz=RD*1.52*fsc;ctx.globalAlpha=0.92*ga;ctx.drawImage(brain,cx+fx-bsz/2,cy+fy-bsz/2,bsz,bsz);
      }
      var ph=now/26;
      E.forEach(function(e){var a=byId[e[0]],b=byId[e[1]];var op=Math.min(a.op,b.op);if(op<0.02)return;var hot=act&&(e[0]===act.id||e[1]===act.id);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=COL[a.cat];ctx.globalAlpha=(act?(hot?0.98:0.1):0.52)*op;ctx.lineWidth=hot?2.8:1.4;ctx.setLineDash([3,8]);ctx.lineDashOffset=-ph;ctx.stroke();});
      ctx.setLineDash([]);ctx.globalAlpha=1;
      arr.forEach(function(n){if(n.hub)return;var isA=act&&act.id===n.id;var r=RNODE*n.hs;ctx.globalAlpha=n.op;logo(n,r);
        if(isA){ctx.beginPath();ctx.arc(n.x,n.y,r+2,0,7);ctx.lineWidth=2;ctx.strokeStyle="#E8B84B";ctx.stroke();}
        ctx.save();ctx.globalAlpha=n.op;ctx.fillStyle="#E8B84B";ctx.font="600 14px 'Plus Jakarta Sans',system-ui,sans-serif";ctx.shadowColor="rgba(0,0,0,.78)";ctx.shadowBlur=4;ctx.shadowOffsetY=1;var la=n.ang,c=Math.cos(la);ctx.textAlign=c>0.15?"left":(c<-0.15?"right":"center");ctx.textBaseline="middle";ctx.fillText(byIdName(n.id),n.x+c*(r+10),n.y+Math.sin(la)*(r+16));ctx.restore();});
      var hub=byId.tarifas;if(hub){ctx.globalAlpha=hub.op;logo(hub,RHUB*hub.hs);
        if(act&&act.id==="tarifas"){ctx.beginPath();ctx.arc(hub.x,hub.y,RHUB*hub.hs+2,0,7);ctx.lineWidth=2;ctx.strokeStyle="#E8B84B";ctx.stroke();}
        ctx.save();ctx.globalAlpha=hub.op;ctx.fillStyle="#E8B84B";ctx.font="700 16px 'Plus Jakarta Sans',system-ui,sans-serif";ctx.textAlign="center";ctx.textBaseline="top";ctx.shadowColor="rgba(0,0,0,.82)";ctx.shadowBlur=5;ctx.shadowOffsetY=1;ctx.fillText("Tarifas",hub.x,hub.y+RHUB*hub.hs+5);ctx.restore();}
      requestAnimationFrame(draw);
    }
    function byIdName(id){var c=D.find(function(x){return x.id===id;});return c?c.nombre:id;}
    requestAnimationFrame(draw);
  }

  window.CCView={renderList:renderList,renderBrain:renderBrain};
})();
