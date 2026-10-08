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
   +'.cc-dep-wrap{position:relative;display:inline-block;justify-self:end}'
   +'.cc-dep{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px;cursor:pointer;background:linear-gradient(180deg,rgba(20,24,30,.92),rgba(10,12,16,.94));border:1px solid #5c4a1e;border-radius:9px;color:#c7cdd4;font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;font-size:11.5px;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(247,219,141,.1);transition:border-color .15s}'
   +'.cc-dep:hover{border-color:#8f6a1a}'
   +'.cc-dep-dot{width:8px;height:8px;border-radius:50%;background:#2ebd85;flex:none;animation:ccPulse 1.8s infinite}'
   +'@keyframes ccPulse{0%{box-shadow:0 0 0 0 rgba(46,189,133,.6)}70%{box-shadow:0 0 0 7px rgba(46,189,133,0)}100%{box-shadow:0 0 0 0 rgba(46,189,133,0)}}'
   +'.cc-dep-lbl{color:#2ebd85;font-weight:700;font-size:9.5px;letter-spacing:.09em}'
   +'.cc-dep-sha{color:#a7b0bb}.cc-dep-sha b{color:#E8B84B}'
   +'.cc-dep-pop{position:absolute;z-index:200;top:calc(100% + 8px);left:0;min-width:264px;max-width:344px;background:rgba(9,10,13,.98);border:1px solid #5c4a1e;border-radius:12px;padding:12px 14px;box-shadow:0 20px 50px rgba(0,0,0,.6);text-align:left}'
   +'.cc-dep-pop--right{left:auto;right:0}'
   +'.cc-dep-pop[hidden]{display:none}'
   +'.cc-dep-h{font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:12px;color:#E8B84B;margin-bottom:8px;display:flex;align-items:center;gap:7px}'
   +'.cc-dep-r{display:flex;justify-content:space-between;gap:12px;font-size:11px;padding:4px 0;border-top:1px solid rgba(255,255,255,.05)}'
   +'.cc-dep-k{color:#79838f;flex:none}'
   +'.cc-dep-v{color:#cdd3da;text-align:right;font-family:"IBM Plex Mono",ui-monospace,Menlo,monospace;word-break:break-all;min-width:0}'
   +'.cc-dep-v a{color:#E8B84B}'
   +'.cc-dep-view{display:block;margin-top:10px;text-align:center;font-family:"Chakra Petch",system-ui,sans-serif;font-weight:700;font-size:11.5px;color:#E8B84B;text-decoration:none;border:1px solid rgba(232,184,75,.4);border-radius:8px;padding:7px;background:rgba(232,184,75,.07)}'
   +'.cc-dep-view:hover{background:rgba(232,184,75,.15)}'
   +'@media(max-width:560px){.cc-dep-lbl{display:none}.cc-dep{padding:0 10px;font-size:10.5px}.cc-dep-pop{min-width:224px}}';

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
  /* ── Live deployment widget: reads everything useful from the public GitHub
       API (commit + repo), caches briefly, and never hard-fails. ── */
  var REPO='CyberSecureAID/bot-algoritmico';
  var _gh=null,_ghP=null;
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function ghFetch(){
    if(_gh) return Promise.resolve(_gh);
    if(_ghP) return _ghP;
    try{var raw=localStorage.getItem('cc_gh');if(raw){var c=JSON.parse(raw);if(c&&(Date.now()-c.t)<90000){_gh=c.d;return Promise.resolve(c.d);}}}catch(_){}
    _ghP=Promise.all([
      fetch('https://api.github.com/repos/'+REPO+'/commits/main').then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      fetch('https://api.github.com/repos/'+REPO).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
    ]).then(function(res){
      var cm=res[0],rp=res[1];
      if(!cm||!cm.sha) return null;
      var msg=(cm.commit&&cm.commit.message)?cm.commit.message.split(String.fromCharCode(10))[0]:'';
      var d={sha:cm.sha,short:cm.sha.slice(0,7),url:cm.html_url,msg:msg,
        author:(cm.commit&&cm.commit.author)?cm.commit.author.name:'',
        date:(cm.commit&&cm.commit.author)?cm.commit.author.date:'',
        branch:rp?rp.default_branch:'main',
        repoCreated:rp?rp.created_at:'',repoPushed:rp?rp.pushed_at:'',
        visibility:rp?(rp.visibility||(rp.private?'private':'public')):'',
        license:(rp&&rp.license)?(rp.license.spdx_id||rp.license.name):'',lang:rp?rp.language:''};
      _gh=d;try{localStorage.setItem('cc_gh',JSON.stringify({t:Date.now(),d:d}));}catch(_){}
      return d;
    }).catch(function(){return null;});
    return _ghP;
  }
  function fmtDT(iso){if(!iso)return '—';var dt=new Date(iso);if(isNaN(dt.getTime()))return '—';return dt.toISOString().slice(0,10)+' '+dt.toISOString().slice(11,16)+' UTC';}
  function mountCommit(el,align){
    if(!el) return;
    var popCls=(align==='right')?'cc-dep-pop cc-dep-pop--right':'cc-dep-pop';
    el.innerHTML='<button class="cc-dep" type="button" aria-expanded="false"><span class="cc-dep-dot"></span><span class="cc-dep-lbl">LIVE</span><span class="cc-dep-sha">main @ <b>…</b></span></button><div class="'+popCls+'" hidden></div>';
    var btn=el.querySelector('.cc-dep'),pop=el.querySelector('.cc-dep-pop'),shaB=el.querySelector('.cc-dep-sha b');
    btn.addEventListener('click',function(e){e.stopPropagation();if(pop.hasAttribute('hidden')){pop.removeAttribute('hidden');btn.setAttribute('aria-expanded','true');}else{pop.setAttribute('hidden','');btn.setAttribute('aria-expanded','false');}});
    document.addEventListener('click',function(ev){if(!el.contains(ev.target)){pop.setAttribute('hidden','');btn.setAttribute('aria-expanded','false');}});
    var repoUrl='https://github.com/'+REPO;
    ghFetch().then(function(d){
      if(!d){shaB.textContent='GitHub';pop.innerHTML='<div class="cc-dep-h"><span class="cc-dep-dot"></span>Deployment</div><div class="cc-dep-r"><span class="cc-dep-k">Source</span><span class="cc-dep-v"><a href="'+repoUrl+'" target="_blank" rel="noopener">'+REPO+'</a></span></div><a class="cc-dep-view" href="'+repoUrl+'/commits/main" target="_blank" rel="noopener">View latest commit on GitHub →</a>';return;}
      shaB.textContent=d.short;
      function row(k,v){return '<div class="cc-dep-r"><span class="cc-dep-k">'+k+'</span><span class="cc-dep-v">'+v+'</span></div>';}
      var h='<div class="cc-dep-h"><span class="cc-dep-dot"></span>Live deployment · GitHub Pages</div>';
      h+=row('Branch',esc(d.branch||'main'));
      h+=row('Commit','<a href="'+esc(d.url||repoUrl)+'" target="_blank" rel="noopener">'+esc(d.short)+'</a>');
      h+=row('Committed',fmtDT(d.date));
      if(d.msg)h+=row('Message',esc(d.msg));
      if(d.author)h+=row('Author',esc(d.author));
      if(d.repoPushed)h+=row('Last push',fmtDT(d.repoPushed));
      if(d.repoCreated)h+=row('Repo created',esc((d.repoCreated||'').slice(0,10)));
      if(d.visibility)h+=row('Visibility',esc(d.visibility));
      if(d.license)h+=row('License',esc(d.license));
      if(d.lang)h+=row('Language',esc(d.lang));
      h+='<a class="cc-dep-view" href="'+esc(d.url||repoUrl)+'" target="_blank" rel="noopener">View this commit on GitHub →</a>';
      pop.innerHTML=h;
    });
  }

  window.CCView={renderList:renderList,renderBrain:renderBrain,downloadCSV:downloadCSV,mountCommit:mountCommit};
})();
