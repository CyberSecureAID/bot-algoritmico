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
   /* Black glass window with a GOLD 3D bevel (gold frame, gold raised base) and a
      real drop shadow. Near-black fill keeps the contracts readable. */
   +'.cc-panel{position:relative;background:rgba(9,10,13,.92);border:1px solid #5c4a1e;border-radius:16px;padding:12px;'
   +'-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);'
   +'box-shadow:inset 0 1px 0 rgba(247,219,141,.18),0 26px 54px rgba(0,0,0,.62),0 6px 0 #8f6a1a}'
   +'.cc-scroll{overflow:auto;padding:16px 7px;'
   +'-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%);'
   +'mask-image:linear-gradient(to bottom,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%)}'
   +'.cc-scroll::-webkit-scrollbar{width:7px}'
   +'.cc-scroll::-webkit-scrollbar-track{background:transparent}'
   +'.cc-scroll::-webkit-scrollbar-thumb{background:rgba(232,184,75,.32);border-radius:9px}'
   +'.cc-card{background:rgba(0,0,0,.3)!important;border:1px solid rgba(232,184,75,.15)!important;border-radius:12px;padding:12px 14px;margin-bottom:10px}'
   +'.cc-card:last-child{margin-bottom:0}'
   +'.cc-name{display:flex;align-items:center;gap:9px;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:14.5px;color:#eaecef;margin-bottom:3px}'
   +'.cc-dot{width:9px;height:9px;border-radius:50%;flex:none}'
   +'.cc-row{display:flex;align-items:center;gap:9px;margin-top:7px}'
   +'.cc-tag{flex:none;width:42px;font-size:11px;color:#79838f;font-weight:600;letter-spacing:.02em;font-family:"Plus Jakarta Sans",system-ui,sans-serif}'
   +'.cc-addr{flex:1;min-width:0;font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-size:10.5px;color:#a7b0bb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
   +'.cc-btns{flex:none;display:flex;gap:6px}'
   +'.cc-btn{font-family:"Plus Jakarta Sans",system-ui,sans-serif!important;font-size:10.5px!important;font-weight:600!important;'
   +'border:1px solid rgba(232,184,75,.42)!important;background:rgba(232,184,75,.08)!important;color:#E8B84B!important;'
   +'border-radius:7px!important;padding:4px 10px!important;cursor:pointer;white-space:nowrap;text-decoration:none!important;'
   +'display:inline-flex!important;align-items:center;line-height:1;box-shadow:inset 0 1px 0 rgba(255,255,255,.06);transition:background .15s,border-color .15s}'
   +'.cc-btn:hover{background:rgba(232,184,75,.2)!important;border-color:rgba(232,184,75,.7)!important}'
   +'.cc-gold-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:13.5px;letter-spacing:.2px;white-space:nowrap;height:44px;padding:0 24px;border-radius:10px;cursor:pointer;border:1px solid #c79426;color:#241900!important;background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);box-shadow:0 4px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5);text-shadow:0 1px 0 rgba(255,255,255,.28);text-decoration:none;transition:filter .16s,transform .09s,box-shadow .09s}'
   +'.cc-gold-btn:hover{filter:brightness(1.06)}'
   +'.cc-gold-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}'
   +'.cc-gold-btn svg{width:16px;height:16px;flex:none}'
   +'.cc-net{display:block;width:100%;height:auto;touch-action:none;cursor:default}'
   +'.cc-dep-wrap{display:inline-block;justify-self:end}'
   +'.cc-dep{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 20px;cursor:pointer;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:13.5px;letter-spacing:.2px;white-space:nowrap;border:1px solid #c79426;border-radius:10px;color:#241900;background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);box-shadow:0 4px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5);text-shadow:0 1px 0 rgba(255,255,255,.28);transition:filter .16s,transform .09s,box-shadow .09s}'
   +'.cc-dep:hover{filter:brightness(1.06)}'
   +'.cc-dep:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}'
   +'.cc-dep .cc-dep-lbl{color:#14532d;font-weight:800;font-size:10px;letter-spacing:.1em}'
   +'.cc-dep-sm{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;cursor:pointer;background:linear-gradient(180deg,rgba(20,24,30,.92),rgba(10,12,16,.94));border:1px solid #5c4a1e;border-radius:8px;color:#c7cdd4;font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-size:11px;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(247,219,141,.1);transition:border-color .15s}'
   +'.cc-dep-sm:hover{border-color:#8f6a1a}'
   +'.cc-dep-sm .cc-dep-lbl{color:#2ebd85;font-weight:700;font-size:9px;letter-spacing:.09em}'
   +'.cc-dep-dot{width:9px;height:9px;border-radius:50%;background:#16a34a;flex:none;animation:ccPulse 1.7s infinite}'
   +'.cc-dep-sm .cc-dep-dot{width:8px;height:8px}'
   +'@keyframes ccPulse{0%{box-shadow:0 0 0 0 rgba(22,163,74,.55)}70%{box-shadow:0 0 0 7px rgba(22,163,74,0)}100%{box-shadow:0 0 0 0 rgba(22,163,74,0)}}'
   +'.cc-dep-sha{font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace}.cc-dep-sha b{color:inherit}'
   +'.cc-dep-sm .cc-dep-sha b{color:#E8B84B}'
   +'.cc-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}'
   +'.cc-modal[hidden]{display:none}'
   +'.cc-modal-box{position:relative;width:100%;max-width:470px;max-height:86vh;overflow:auto;background:linear-gradient(180deg,#0c0e12,#070809);border:1px solid #5c4a1e;border-radius:16px;padding:20px 22px;box-shadow:0 30px 70px rgba(0,0,0,.7),inset 0 1px 0 rgba(247,219,141,.14),0 6px 0 #352810;font-family:"Plus Jakarta Sans",system-ui,sans-serif;text-align:left;scrollbar-width:thin;scrollbar-color:rgba(232,184,75,.5) transparent}'
   +'.cc-modal-box::-webkit-scrollbar{width:8px}'
   +'.cc-modal-box::-webkit-scrollbar-track{background:transparent;margin:10px 0}'
   +'.cc-modal-box::-webkit-scrollbar-thumb{background:rgba(232,184,75,.34);border-radius:9px}'
   +'.cc-modal-box::-webkit-scrollbar-thumb:hover{background:rgba(232,184,75,.5)}'
   +'.cc-modal-x{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:8px;border:1px solid #2a2f37;background:rgba(255,255,255,.04);color:#a7b0bb;font-size:19px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}'
   +'.cc-modal-x:hover{color:#E8B84B;border-color:#8f6a1a}'
   +'.cc-modal-h{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:15px;color:#E8B84B;display:flex;align-items:center;gap:8px;margin-bottom:3px}'
   +'.cc-modal-sub{font-size:11px;color:#79838f;font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;margin-bottom:14px}'
   +'.cc-modal-sub b{color:#2ebd85;font-weight:600}'
   +'.cc-dep-r{display:flex;justify-content:space-between;gap:14px;font-size:12px;padding:7px 0;border-top:1px solid rgba(255,255,255,.055)}'
   +'.cc-dep-k{color:#79838f;flex:none}'
   +'.cc-dep-v{color:#d4dae1;text-align:right;font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;word-break:break-all;min-width:0}'
   +'.cc-dep-v a{color:#E8B84B}'
   +'.cc-dep-view{display:block;margin-top:16px;text-align:center;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:12.5px;color:#241900;text-decoration:none;border:1px solid #c79426;border-radius:10px;padding:10px;background:linear-gradient(180deg,#f7db8d,#E8B84B 46%,#c79426);box-shadow:0 3px 0 #8f6a1a,inset 0 1px 0 rgba(255,255,255,.5)}'
   +'.cc-dep-view:hover{filter:brightness(1.06)}';
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

  function csvCell(v){v=(v==null?'':String(v));return '"'+v.replace(/"/g,'""')+'"';}
  function downloadCSV(){
    var D=window.CONTRATOS||[];
    var head=['Contract','Category','Proxy address','Implementation address','Proxy on BscScan','Implementation on BscScan','Network'];
    var lines=[head.map(csvCell).join(',')];
    D.forEach(function(c){lines.push([c.nombre,c.cat,c.proxy,(c.impl||''),bs(c.proxy),(c.impl?bs(c.impl):''),'BNB Smart Chain (chainId 56)'].map(csvCell).join(','));});
    var blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='criptocuba-contracts.csv';document.body.appendChild(a);a.click();
    setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(a.href);},120);
  }
  /* ── Live deployment widget: reads the public GitHub API (commit + repo +
       languages), caches briefly, never hard-fails, shown in a centered modal. ── */
  var REPO='CyberSecureAID/bot-algoritmico';
  var _gh=null,_ghP=null,_modal=null,_clk=null;
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function ghFetch(){
    if(_gh) return Promise.resolve(_gh);
    if(_ghP) return _ghP;
    try{var raw=localStorage.getItem('cc_gh');if(raw){var c=JSON.parse(raw);if(c&&(Date.now()-c.t)<90000){_gh=c.d;return Promise.resolve(c.d);}}}catch(_){}
    var get=function(u){return fetch('https://api.github.com/repos/'+REPO+u).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});};
    _ghP=Promise.all([get('/commits/main'),get(''),get('/languages')]).then(function(res){
      var cm=res[0],rp=res[1],lg=res[2];
      if(!cm||!cm.sha) return null;
      var msg=(cm.commit&&cm.commit.message)?cm.commit.message.split(String.fromCharCode(10))[0]:'';
      var ver=(cm.commit&&cm.commit.verification)?cm.commit.verification.verified:false;
      var langs='';
      if(lg&&typeof lg==='object'){langs=Object.keys(lg).sort(function(a,b){return lg[b]-lg[a];}).join(' · ');}
      var d={sha:cm.sha,short:cm.sha.slice(0,7),url:cm.html_url,msg:msg,verified:!!ver,
        author:(cm.commit&&cm.commit.author)?cm.commit.author.name:'',
        date:(cm.commit&&cm.commit.author)?cm.commit.author.date:'',
        committed:(cm.commit&&cm.commit.committer)?cm.commit.committer.date:'',
        branch:rp?rp.default_branch:'main',desc:rp?rp.description:'',
        repoCreated:rp?rp.created_at:'',repoPushed:rp?rp.pushed_at:'',
        visibility:rp?(rp.visibility||(rp.private?'private':'public')):'',
        license:(rp&&rp.license)?(rp.license.spdx_id||rp.license.name):'',
        langs:langs||(rp?rp.language:''),size:rp?rp.size:null,issues:rp?rp.open_issues_count:null};
      _gh=d;try{localStorage.setItem('cc_gh',JSON.stringify({t:Date.now(),d:d}));}catch(_){}
      return d;
    }).catch(function(){return null;});
    return _ghP;
  }
  function fmtDT(iso){if(!iso)return '—';var dt=new Date(iso);if(isNaN(dt.getTime()))return '—';return dt.toISOString().slice(0,10)+' '+dt.toISOString().slice(11,16)+' UTC';}
  function ensureModal(){
    if(_modal) return _modal;
    var ov=document.createElement('div');ov.className='cc-modal';ov.setAttribute('hidden','');
    ov.innerHTML='<div class="cc-modal-box"><button class="cc-modal-x" type="button" aria-label="Close">×</button><div class="cc-modal-h"><span class="cc-dep-dot"></span>Live deployment</div><div class="cc-modal-sub">GitHub Pages · now <b id="cc-clock">—</b></div><div id="cc-modal-body"></div></div>';
    document.body.appendChild(ov);
    function close(){ov.setAttribute('hidden','');if(_clk){clearInterval(_clk);_clk=null;}}
    ov.querySelector('.cc-modal-x').addEventListener('click',close);
    ov.addEventListener('click',function(e){if(e.target===ov)close();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!ov.hasAttribute('hidden'))close();});
    _modal={ov:ov,body:ov.querySelector('#cc-modal-body'),clock:ov.querySelector('#cc-clock'),close:close};
    return _modal;
  }
  function tick(el){if(el)el.textContent=new Date().toISOString().slice(11,19)+' UTC';}
  function openModal(){
    var m=ensureModal(),repoUrl='https://github.com/'+REPO;
    m.ov.removeAttribute('hidden');
    tick(m.clock);if(_clk)clearInterval(_clk);_clk=setInterval(function(){tick(m.clock);},1000);
    m.body.innerHTML='<div class="cc-dep-r"><span class="cc-dep-k">Loading from GitHub…</span><span class="cc-dep-v"></span></div>';
    ghFetch().then(function(d){
      if(!d){m.body.innerHTML='<div class="cc-dep-r"><span class="cc-dep-k">Source</span><span class="cc-dep-v"><a href="'+repoUrl+'" target="_blank" rel="noopener">'+REPO+'</a></span></div><a class="cc-dep-view" href="'+repoUrl+'/commits/main" target="_blank" rel="noopener">View latest commit on GitHub →</a>';return;}
      function row(k,v){return '<div class="cc-dep-r"><span class="cc-dep-k">'+k+'</span><span class="cc-dep-v">'+v+'</span></div>';}
      var h='';
      h+=row('Repository','<a href="'+repoUrl+'" target="_blank" rel="noopener">'+esc(REPO)+'</a>');
      if(d.desc)h+=row('Description',esc(d.desc));
      h+=row('Branch',esc(d.branch||'main'));
      h+=row('Deployed commit','<a href="'+esc(d.url||repoUrl)+'" target="_blank" rel="noopener">'+esc(d.short)+'</a>');
      if(d.msg)h+=row('Message',esc(d.msg));
      if(d.author)h+=row('Author',esc(d.author));
      h+=row('Committed',fmtDT(d.committed||d.date));
      if(d.verified)h+=row('Signature','&#10003; Verified');
      if(d.repoPushed)h+=row('Last push',fmtDT(d.repoPushed));
      if(d.repoCreated)h+=row('Repo created',esc((d.repoCreated||'').slice(0,10)));
      if(d.visibility)h+=row('Visibility',esc(d.visibility));
      if(d.license)h+=row('License',esc(d.license));
      if(d.langs)h+=row('Languages',esc(d.langs));
      if(d.size!=null)h+=row('Repo size',(d.size>1024?(d.size/1024).toFixed(1)+' MB':d.size+' KB'));
      if(d.issues!=null)h+=row('Open issues',String(d.issues));
      h+='<a class="cc-dep-view" href="'+esc(d.url||repoUrl)+'" target="_blank" rel="noopener">View this commit on GitHub →</a>';
      m.body.innerHTML=h;
    });
  }
  function mountCommit(el,variant){
    if(!el) return;
    var cls=(variant==='compact')?'cc-dep-sm':'cc-dep';
    el.innerHTML='<button class="'+cls+'" type="button"><span class="cc-dep-dot"></span><span class="cc-dep-lbl">LIVE</span><span class="cc-dep-sha">main @ <b>…</b></span></button>';
    var btn=el.querySelector('button'),shaB=el.querySelector('.cc-dep-sha b');
    btn.addEventListener('click',function(e){e.stopPropagation();openModal();});
    ghFetch().then(function(d){shaB.textContent=d?d.short:'GitHub';});
  }

  window.CCView={renderList:renderList,renderBrain:renderBrain,downloadCSV:downloadCSV,mountCommit:mountCommit};
})();
