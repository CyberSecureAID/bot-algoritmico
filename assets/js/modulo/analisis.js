/* analisis.js. Entrada y selector del Analisis Profesional.
   ──────────────────────────────────────────────────────────────────────────
   Compuerta de acceso: pregunta al contrato (tieneAcceso). Si el usuario ya
   tiene acceso (owner, plan pagado o prueba activa) abre el selector de los
   tres servicios directamente, SIN cobro. Si no, abre la ventana de cobro y,
   al quedar con acceso, muestra el selector. Misma estetica que el cobro:
   pantalla completa sobre la pagina actual, sin navegar ni desconectar wallet.

   Uso:
     import { abrirAnalisis } from './modulo/analisis.js';
     abrirAnalisis(origen, wallet, ethers);
       origen: 'hero' | 'futuros'.
*/

import { abrirCobroAnalisis, tieneAccesoAnalisis } from './analisis-pro.js?v=1';

const BANNER = 'assets/portada/img/header.webp';

const SERVICIOS = [
  {
    id: 'pools', abre: 'pools', nombre: 'Liquidity Pools',
    img: 'assets/img/serv-pools.webp',
    lema: 'Where the money is trapped',
    desc: 'A real time liquidation map. We reconstruct the volume resting inside every block of orders and project the exact price zones where leveraged positions are waiting to be swept. Price is drawn toward that trapped liquidity, and we show you where it sits before it moves.'
  },
  {
    id: 'hair', abre: 'heat', nombre: 'Hair Pools',
    img: 'assets/img/serv-libro.webp',
    lema: 'See what the big players do',
    desc: 'The order book lies. Most large resting orders are bluffs that vanish on approach. We watch every wall over time and separate the real committed capital from the theater, so you know which levels truly hold and which are there to deceive you.'
  },
  {
    id: 'smart', abre: 'levels', nombre: 'Smart Levels',
    img: 'assets/img/serv-tres.webp',
    lema: 'Where to buy and where to sell',
    desc: 'Market structure, read and drawn for you. The engine maps the precise levels of entry and exit from live structure and explains, at each moment, why. Not lagging lines, but the structural map that price is actually respecting.'
  }
];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Punto de entrada: decide cobro o selector segun el acceso real del contrato.
export async function abrirAnalisis(origen, wallet, ethers) {
  let acceso = false;
  try { acceso = await tieneAccesoAnalisis(wallet, ethers); } catch (_) {}
  if (acceso) return abrirSelector(origen, wallet, ethers);
  return abrirCobroAnalisis(origen, wallet, ethers, () => abrirSelector(origen, wallet, ethers));
}

// Abre una herramienta spot reusando los modulos de la web (sin duplicar logica).
async function abrirTool(abre) {
  const base = new URL('../', import.meta.url).href;   // => assets/js/
  if (abre === 'pools')  return (await import(base + 'liquidity.js?v=126')).abrirPools();
  if (abre === 'heat')   return (await import(base + 'muros.js?v=127')).abrirMuros();
  if (abre === 'levels') return (await import(base + 'niveles.js?v=127')).abrirNiveles();
}

export function abrirSelector(origen, wallet, ethers) {
  const prev = document.getElementById('an-sel'); if (prev) prev.remove();

  const ov = document.createElement('div');
  ov.id = 'an-sel';
  ov.style.visibility = 'hidden';   // anti-flash: se revela ya montada

  const card = (s) => `
    <button class="an-serv" data-abre="${esc(s.abre)}">
      <div class="an-img" data-img="${esc(s.img)}"><span class="an-ini">${esc(s.nombre[0])}</span></div>
      <div class="an-nom">${esc(s.nombre)}</div>
      <div class="an-lema">${esc(s.lema)}</div>
      <div class="an-open">Open</div>
    </button>`;

  const detalle = (s) => `
    <div class="an-det-item">
      <div class="an-det-n">${esc(s.nombre)}</div>
      <div class="an-det-d">${esc(s.desc)}</div>
    </div>`;

  ov.innerHTML = `
    <div class="an-banner"></div>
    <div class="an-bar">
      <button class="an-back" id="an-back">\u2190 Back</button>
      <div class="an-bar-t">Professional <span>Analysis</span></div>
    </div>
    <div class="an-in">
      <h1 class="an-title">Choose your <span class="g">tool</span></h1>
      <p class="an-sub">Your access is active. Load any of the three on the chart.</p>
      <div class="an-servs">${SERVICIOS.map(card).join('')}</div>
      <button class="an-more" id="an-more">Service details</button>
      <div class="an-det" id="an-det" hidden>${SERVICIOS.map(detalle).join('')}</div>
    </div>
    <style>
      #an-sel{position:fixed;inset:0;z-index:40000;height:100dvh;max-height:100dvh;display:flex;flex-direction:column;color:#eaecef;background:#05070a;font-family:var(--display,'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif)}
      #an-sel::before{content:'';position:fixed;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.80),rgba(3,5,8,.94));z-index:0;pointer-events:none}
      #an-sel .an-banner{position:fixed;top:0;left:0;right:0;height:300px;z-index:0;pointer-events:none;opacity:.8;background:url('${BANNER}') center top/cover no-repeat;-webkit-mask-image:linear-gradient(180deg,#000 0,#000 45%,transparent 100%);mask-image:linear-gradient(180deg,#000 0,#000 45%,transparent 100%)}
      #an-sel *{box-sizing:border-box}
      #an-sel .an-bar{position:relative;z-index:5;display:flex;align-items:center;gap:14px;padding:calc(12px + env(safe-area-inset-top,0px)) 18px 12px;background:rgba(5,7,9,.4);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border-bottom:1px solid #1c232b}
      #an-sel .an-back{display:inline-flex;align-items:center;gap:7px;background:rgba(255,255,255,.04);border:1px solid #29313b;color:#a7b0bb;border-radius:10px;padding:9px 14px;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:600}
      #an-sel .an-back:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
      #an-sel .an-bar-t{font-size:15px;font-weight:800;letter-spacing:.2px}
      #an-sel .an-bar-t span{color:var(--gold,#E8B84B)}
      #an-sel .an-in{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;position:relative;z-index:1;width:100%;max-width:900px;margin:0 auto;padding:18px 18px calc(44px + env(safe-area-inset-bottom,0px));text-align:center}
      #an-sel .an-in::-webkit-scrollbar{width:0;height:0;display:none}
      #an-sel .an-title{font-size:clamp(23px,4.2vw,36px);font-weight:900;letter-spacing:-.5px;margin:6px 0 8px;text-shadow:0 2px 0 rgba(0,0,0,.4),0 5px 14px rgba(0,0,0,.55)}
      #an-sel .an-title .g{color:var(--gold,#E8B84B);text-shadow:0 2px 0 rgba(120,80,0,.5),0 6px 18px rgba(232,184,75,.25)}
      #an-sel .an-sub{font-size:13.5px;color:#9aa6b2;line-height:1.55;max-width:520px;margin:0 auto 24px}
      #an-sel .an-servs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:820px;margin:0 auto 10px}
      #an-sel .an-serv{display:flex;flex-direction:column;text-align:center;font-family:inherit;background:linear-gradient(135deg,rgba(20,26,33,.92),rgba(10,14,18,.94));border:1px solid #232b36;border-radius:16px;padding:0 0 18px;overflow:hidden;cursor:pointer;transition:border-color .14s,box-shadow .14s,transform .14s}
      #an-sel .an-serv:hover{border-color:var(--gold,#E8B84B);box-shadow:0 14px 38px rgba(232,184,75,.14);transform:translateY(-2px)}
      #an-sel .an-img{position:relative;width:100%;aspect-ratio:16/10;background:#0e1319 center/cover no-repeat;border-bottom:1px solid #1c232b;display:grid;place-items:center}
      #an-sel .an-img.con .an-ini{display:none}
      #an-sel .an-ini{font-size:34px;font-weight:900;color:#2b3340}
      #an-sel .an-nom{font-size:16px;font-weight:800;color:#eaecef;margin:14px 14px 3px}
      #an-sel .an-lema{font-size:12px;color:#8b96a3;margin:0 14px 12px}
      #an-sel .an-open{margin:0 14px;text-align:center;font-size:12.5px;font-weight:800;color:var(--gold,#E8B84B);border:1px solid rgba(232,184,75,.4);border-radius:10px;padding:9px;background:rgba(232,184,75,.06)}
      #an-sel .an-more{background:rgba(255,255,255,.03);border:1px solid #29313b;color:#c4ccd4;font-family:inherit;font-weight:700;font-size:13px;padding:11px 20px;border-radius:11px;cursor:pointer;margin:16px auto 0}
      #an-sel .an-more:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}
      #an-sel .an-det{max-width:720px;margin:16px auto 0;text-align:left;display:grid;gap:12px}
      #an-sel .an-det[hidden]{display:none}
      #an-sel .an-det-item{background:linear-gradient(135deg,rgba(20,26,33,.9),rgba(10,14,18,.92));border:1px solid #232b36;border-radius:14px;padding:16px 18px}
      #an-sel .an-det-n{font-size:14.5px;font-weight:800;color:var(--gold,#E8B84B);margin-bottom:6px}
      #an-sel .an-det-d{font-size:13px;line-height:1.6;color:#c4ccd4}
      @media(max-width:640px){
        #an-sel .an-servs{grid-template-columns:1fr;max-width:420px}
      }
    </style>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => { ov.style.visibility = 'visible'; });

  const $ = (sel) => ov.querySelector(sel);
  const cerrar = () => { try { ov.remove(); } catch (_) {} };
  $('#an-back').onclick = cerrar;

  // cargar las imagenes si existen; si no, queda la inicial
  ov.querySelectorAll('.an-img[data-img]').forEach((el) => {
    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url(${el.dataset.img})`; el.classList.add('con'); };
    img.src = el.dataset.img;
  });

  const more = $('#an-more');
  more.onclick = () => { const d = $('#an-det'); d.hidden = !d.hidden; more.textContent = d.hidden ? 'Service details' : 'Hide details'; };

  ov.querySelectorAll('.an-serv').forEach((b) => b.onclick = async () => {
    cerrar();
    try { await abrirTool(b.dataset.abre); } catch (_) {}
  });
}
