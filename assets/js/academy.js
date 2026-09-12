// academy.js — Cripto Cuba Academy: acceso de pago al grupo de formación.
// Módulo independiente. Lo único que necesita de fuera es la wallet.

import * as ethers from './vendor/ethers-6.13.4.min.js?v=125';
import * as wallet from './wallet.js?v=125';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Contrato de la academia (proxy: esta es la dirección que se usa siempre). */
const ACADEMY = '0x96b7c62771FcdB4F9210f9ee70bAe0eA5d7E9721';
const USDT    = '0x55d398326f99059fF775485246999027B3197955';
const RPC     = 'https://bsc-dataseed.binance.org';

const ABI = [
  'function planes(uint8) view returns (uint32 dias, uint32 precioUsd, bool activo)',
  'function costeEnBnb(uint8) view returns (uint256)',
  'function costeEnUsdt(uint8) view returns (uint256)',
  'function comprarConBnb(uint8 plan, string usuarioTelegram) payable',
  'function comprarConUsdt(uint8 plan, string usuarioTelegram)',
  'function estadoDe(string) view returns (uint64 hasta, uint256 quedan)',
  'function tieneAcceso(string) view returns (bool)',
  'function pausado() view returns (bool)'
];
const ABI_ERC20 = [
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function balanceOf(address) view returns (uint256)'
];

/* Enlace del grupo, para dárselo tras el pago. */
const GRUPO = 'https://t.me/CriptoCubaOficial';

let _prov = null;
const lector = () => (_prov ||= new ethers.JsonRpcProvider(RPC, 56, { staticNetwork: true }));
const leer = () => new ethers.Contract(ACADEMY, ABI, lector());
async function firmante() {
  const p = new ethers.BrowserProvider(window.ethereum);
  return p.getSigner();
}

/* Qué incluye cada plan. Lo de dentro es lo que de verdad vende esto. */
const PLANES = [
  { id: 0, nombre: 'Un mes',      etiqueta: 'para probar',   destacado: false },
  { id: 1, nombre: 'Tres meses',  etiqueta: 'el más elegido', destacado: true  },
  { id: 2, nombre: 'Un año',      etiqueta: 'el que sale a cuenta', destacado: false }
];

/* La wallet del dueño ve todo sin pagar. */
const OWNER = '0x97e01a1c430e0cc826aca6e9be643721e45bca7d';

/* Lo que se enseña en la portada: poco, y lo que de verdad diferencia.
   Detallar el temario aquí sería regalar el motivo para pagar. */
const CONTENIDO = [
  'Plan de <b>gestión de riesgo</b>, con software para aplicarlo',
  '<b>17 clases</b> de cero a cien, con examen cada una',
  '<b>20 audiolibros</b> escogidos por un trader con <b>10 años</b> de oficio',
  'Mi estrategia <b>Lógica Estructural Avanzada</b>, en tres fases',
  'Tutoriales de las herramientas de verdad',
  'Ejemplos sobre operaciones reales',
  'Acceso al grupo mientras dure tu plan'
];

/* ══════════════════════════════════════════════════════════════
   LA HOJA DE RUTA
   El orden importa: cada bloque se apoya en el anterior. Por eso
   se enseña como camino, no como lista de contenidos.
   ══════════════════════════════════════════════════════════════ */
const RUTA = [
  {
    n: '01',
    t: 'Plan de gestión de riesgo',
    d: 'Antes de operar un solo dólar. Cómo repartir tu dinero, cuánto arriesgar por operación y cuándo parar.',
    x: 'Incluye un <b>software</b> para aplicarlo sin cuentas a mano.',
    nota: 'Este plan está hecho a medida de nuestra estrategia. No es un plan genérico de internet.',
    items: ['Vídeo explicado paso a paso', 'Software de gestión incluido']
  },
  {
    n: '02',
    t: 'Formación de cero a cien',
    d: '17 clases en vídeo que empiezan por qué es una criptomoneda y terminan en apalancamiento, spread y mercados de futuros.',
    x: '<b>Cada clase tiene su examen</b> de 20 preguntas.',
    nota: 'Regla de la casa: <b>80 puntos o no pasas.</b> Si fallas, el software te explica por qué era verdadero o falso, estudias y repites. Nadie avanza sin entender.',
    items: ['17 clases en vídeo', '20 preguntas por clase', 'Repaso guiado de lo que fallaste']
  },
  {
    n: '03',
    t: 'La biblioteca',
    d: '20 audiolibros escogidos uno a uno por alguien con más de 10 años en trading y criptomonedas. No los escribí yo: los elegí por lo que me sirvieron a mí.',
    x: 'Empieza con una <b>masterclass de economía</b> de 3 horas: 10 títulos sobre la verdad del dinero y el Bitcoin.',
    nota: 'Muchos de estos títulos se venden. Aquí van dentro, y en el orden en que conviene escucharlos.',
    items: ['20 audiolibros seleccionados', 'Masterclass de economía, 3 h', 'Examen para pasar al siguiente']
  },
  {
    n: '04',
    t: 'Las herramientas',
    d: 'Tutoriales de las plataformas que se usan de verdad. Desde abrir la cuenta hasta leer un gráfico sin perderte.',
    x: 'Incluye <b>cómo identificar la dirección del mercado</b> en menos de tres minutos.',
    items: ['Tutoriales de TradingView', 'Leer la dirección del mercado']
  },
  {
    n: '05',
    t: 'La estrategia, en imágenes',
    d: 'Las tres fases aplicadas sobre operaciones reales, con capturas y una guía que explica qué mirar en cada una.',
    items: ['Ejemplos de las tres fases', 'Guía de contexto']
  },
  {
    n: '06',
    t: 'Lógica Estructural Avanzada',
    d: 'Mi estrategia completa. Aquí es donde todo lo anterior encaja.',
    x: 'Tres fases y un <b>repaso especial</b> en medio.',
    fases: [
      { f: 'Fase 1', t: 'Determina la tendencia', d: 'Saber hacia dónde va el mercado antes de tocar nada.' },
      { f: 'Repaso', t: 'Los cimientos', d: 'Vela japonesa, gráfico contra línea, tipos de tendencia y cómo detectar que cambia. Con su software: 80 puntos para seguir.' },
      { f: 'Fase 2', t: 'Zona Swing', d: 'Dónde entrar y por qué ahí y no en otro sitio.' },
      { f: 'Fase 3', t: 'Movimiento en rango', d: 'Cómo se comporta el precio dentro de un rango y cuándo continúa.' }
    ]
  }
];

/* ══════════════════ ABRIR ══════════════════ */
export async function abrirAcademy() {
  estilos();
  const prev = $('ac-overlay'); if (prev) prev.remove();

  const d = document.createElement('div');
  d.id = 'ac-overlay';
  d.innerHTML = `<div class="ac-bg"></div>
    <div class="ac-c">
      <div class="ac-top">
        <div class="ac-eyebrow">Cripto Cuba Academy</div>
        <button class="ac-x" aria-label="Cerrar">✕</button>
      </div>

      <div class="ac-cab">
        <h2 class="ac-t">De cero a operar con criterio</h2>
        <p class="ac-s">Una ruta ordenada, con exámenes para avanzar. No es una carpeta de vídeos sueltos.</p>
      </div>

      <div class="ac-cifras">
        <div class="ac-cif"><b>17</b><span>clases<i>con examen</i></span></div>
        <div class="ac-cif"><b>20</b><span>audiolibros<i>uno a uno</i></span></div>
        <div class="ac-cif"><b>3</b><span>fases<i>de la estrategia</i></span></div>
        <div class="ac-cif"><b>100</b><span>preguntas<i>examen final</i></span></div>
      </div>

      <div class="ac-que">
        <ul class="ac-lista">${CONTENIDO.map((x) => `<li>${x}</li>`).join('')}</ul>
      </div>

      <div class="ac-planes" id="ac-planes"><div class="ac-cargando">Consultando precios…</div></div>

      <div class="ac-ruta-zona" id="ac-ruta-zona"></div>

      <div class="ac-msg" id="ac-msg"></div>
    </div>`;
  document.body.appendChild(d);

  const cerrar = () => { const e = $('ac-overlay'); if (e) e.remove(); };
  d.querySelector('.ac-bg').onclick = cerrar;
  d.querySelector('.ac-x').onclick = cerrar;

  pintarPlanes();
  pintarRuta();
}

/* ══════════════════ ¿PUEDE VER LA RUTA? ══════════════════ */
const CLAVE_USER = 'aurex-academy-user';

function esOwner() {
  const c = wallet.cuentaActual && wallet.cuentaActual();
  return c && String(c).toLowerCase() === OWNER;
}

async function tieneAcceso(usuario) {
  try { return await leer().tieneAcceso(String(usuario).replace(/^@/, '').toLowerCase()); }
  catch (_) { return false; }
}

async function pintarRuta() {
  const box = $('ac-ruta-zona'); if (!box) return;

  // El dueño entra siempre, sin comprobar nada.
  if (esOwner()) { rutaAbierta(box, true); return; }

  // ¿Ya se identificó antes en este navegador?
  let guardado = '';
  try { guardado = localStorage.getItem(CLAVE_USER) || ''; } catch (_) {}
  if (guardado && await tieneAcceso(guardado)) { rutaAbierta(box, false, guardado); return; }

  rutaCerrada(box);
}

/* Cerrada: se ve que hay algo, pero borroso. Eso vende más que ocultarlo. */
function rutaCerrada(box) {
  box.innerHTML = `
    <div class="ac-sec-t">La hoja de ruta</div>
    <p class="ac-sec-s">El orden exacto en que hay que estudiarlo. Cada bloque se apoya en el anterior.</p>

    <div class="ac-ruta-cerrada">
      <div class="ac-ruta-borrosa">${RUTA.map((p) => `
        <div class="ac-paso">
          <div class="ac-paso-n">${p.n}</div>
          <div class="ac-paso-c">
            <div class="ac-paso-t">${p.t}</div>
            <div class="ac-paso-d">${p.d}</div>
          </div>
        </div>`).join('')}</div>
      <div class="ac-candado">
        <div class="ac-candado-i"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
        <div class="ac-candado-t">Solo para miembros</div>
        <div class="ac-candado-s">Elige un plan y tendrás la ruta completa.</div>
        <div class="ac-candado-ya">
          <span>¿Ya eres miembro?</span>
          <div class="ac-ya-in"><span>@</span><input id="ac-ya-user" placeholder="tu usuario de Telegram" autocomplete="off" spellcheck="false"></div>
          <button class="ac-ya-b" id="ac-ya-b">Entrar</button>
          <div class="ac-ya-err" id="ac-ya-err"></div>
        </div>
      </div>
    </div>`;

  const comprobar = async () => {
    const u = ($('ac-ya-user').value || '').trim().replace(/^@/, '').toLowerCase();
    const err = $('ac-ya-err');
    if (u.length < 5) { err.textContent = 'Escribe tu usuario de Telegram.'; return; }
    err.textContent = 'Comprobando…';
    if (await tieneAcceso(u)) {
      try { localStorage.setItem(CLAVE_USER, u); } catch (_) {}
      rutaAbierta($('ac-ruta-zona'), false, u);
    } else {
      err.textContent = 'No me consta que ese usuario tenga acceso activo.';
    }
  };
  $('ac-ya-b').onclick = comprobar;
  $('ac-ya-user').onkeydown = (e) => { if (e.key === 'Enter') comprobar(); };
}

/* ══════════════════════════════════════════════════════════════
   EL PANEL DE APRENDIZAJE
   Con pestañas, no con scroll: 17 clases + 20 audiolibros en una sola
   columna serían tres pantallas de desplazamiento y nadie encontraría
   nada. Así el usuario siempre sabe en qué parte del camino está.
   ══════════════════════════════════════════════════════════════ */
let _RUTA = null;   // se carga una sola vez

async function rutaAbierta(box, owner, usuario) {
  box.innerHTML = `<div class="ac-cargando">Abriendo tu panel…</div>`;
  if (!_RUTA) {
    try { _RUTA = await import('./academy-ruta.js?v=125'); }
    catch (e) { box.innerHTML = `<div class="ac-cargando">No se pudo cargar el panel. Recarga la página.</div>`; return; }
  }
  const R = _RUTA;

  box.innerHTML = `
    <div class="ap-panel">
      <div class="ap-cab">
        <div>
          <div class="ap-cab-t">Tu panel de aprendizaje</div>
          <div class="ap-cab-s">${owner ? 'Entras como dueño' : `Miembro · @${esc(usuario || '')}`}</div>
        </div>
        <a class="ap-grupo" href="${GRUPO}" target="_blank" rel="noopener">Abrir la Academia</a>
      </div>

      <div class="ap-regla">
        <b>Cómo funciona esto</b>
        <div class="ap-pasos3">
          <div><span>1</span>Ves la clase</div>
          <div><span>2</span>Haces el examen</div>
          <div><span>3</span>Sacas <b>80 puntos</b></div>
        </div>
        <p>En la primera vuelta <b>responde aunque no lo sepas</b>. No pasa nada: sirve para ver dónde flojeas. Al terminar tienes la lista de lo que fallaste y un botón <b>«estudiar sobre este tema»</b> que te lo explica. Luego repites.</p>
        <p class="ap-cert"><b>Al aprobar, tu certificado.</b> Baja hasta el final del examen y encontrarás <b>Ver certificado</b>. Te avala <b>XactTrader Academy</b> en la materia que acabas de estudiar.</p>
        <i><b>Vuelve siempre aquí</b> para pasar de una clase a otra. Si te quedas en el grupo bajando de una a otra, pierdes el hilo y no queda constancia de tu avance.</i>
        <i class="ap-honesto"><b>Sé sincero contigo mismo.</b> Puedes saltarte un examen o copiar las respuestas, y nadie se enterará. Pero el día que operes con tu dinero, el mercado no acepta certificados: acepta lo que de verdad sabes.</i>
      </div>

      <div class="ap-tabs" id="ap-tabs">
        ${R.SECCIONES.map((x, i) => `<button class="ap-tab ${i === 0 ? 'on' : ''}" data-sec="${x.id}">
          <span class="ap-tab-n">${x.n}</span>
          <span class="ap-tab-t">${x.t}</span>
          <span class="ap-tab-f"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
        </button>`).join('')}
      </div>

      <div class="ap-cuerpo" id="ap-cuerpo"></div>
    </div>`;

  const ir = (id) => {
    box.querySelectorAll('.ap-tab').forEach((x) => x.classList.toggle('on', x.dataset.sec === id));
    const sec = R.SECCIONES.find((x) => x.id === id);
    const sig = sec && sec.sig ? R.SECCIONES.find((x) => x.id === sec.sig) : null;

    /* El paso siguiente, SIEMPRE visible al final. Sin esto el usuario
       termina una sección, no ve a dónde ir, y da por hecho que ya está
       todo. Es el motivo por el que la gente se quedaba en la primera. */
    $('ap-cuerpo').innerHTML = seccionHTML(id, R) + (sig
      ? `<button class="ap-siguiente" data-ir="${sig.id}">
           <span class="ap-sig-e">Paso ${sig.n} de 5</span>
           <span class="ap-sig-t">${sig.t}</span>
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
         </button>`
      : `<div class="ap-fin">Has recorrido las cinco etapas.<br><b>Ahora toca practicar.</b></div>`);

    const bs = $('ap-cuerpo').querySelector('[data-ir]');
    if (bs) bs.onclick = () => { ir(bs.dataset.ir); box.querySelector('.ap-tabs').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  };
  box.querySelectorAll('[data-sec]').forEach((b) => b.onclick = () => {
    ir(b.dataset.sec);
    $('ap-cuerpo').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  ir('empieza');
}

/* Una fila: título, botón de ver y botón de examen. */
function fila(R, { num, tit, sub, video, examen, destacado }) {
  return `<div class="ap-fila ${destacado ? 'top' : ''}">
    ${num !== undefined ? `<div class="ap-num">${num}</div>` : ''}
    <div class="ap-fila-c">
      <div class="ap-fila-t">${tit}</div>
      ${sub ? `<div class="ap-fila-s">${sub}</div>` : ''}
    </div>
    <div class="ap-fila-b">
      ${video ? `<a class="ap-b ver" href="${video}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="currentColor">${R.ICONOS.play}</svg>Ver</a>` : ''}
      ${examen ? `<a class="ap-b test" href="${examen}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${R.ICONOS.test}</svg>Examen</a>` : ''}
    </div>
  </div>`;
}

function seccionHTML(id, R) {
  const O = R.OTROS;

  if (id === 'empieza') {
    return `
      <div class="ap-intro">Antes de cualquier clase, esto.</div>
      ${fila(R, { num: '0', tit: O.riesgo.t, sub: 'Cómo repartir tu dinero y cuánto arriesgar. Hecho a medida de nuestra estrategia, no es un plan genérico.', video: O.riesgo.v, examen: O.riesgo.e, destacado: true })}
      <div class="ap-aviso">Cuando lo tengas, pasa a <b>Las 17 clases</b>. Van en orden por una razón: cada una se apoya en la anterior.</div>`;
  }

  if (id === 'clases') {
    return `
      <div class="ap-intro">De cero a cien. Cada clase, su examen. <b>80 puntos</b> para pasar.</div>
      ${R.CLASES.map((c) => fila(R, { num: c.n, tit: c.t, video: c.v, examen: R.examenDe(c) })).join('')}
      <div class="ap-aviso">Terminadas las 17, sigue con <b>La estrategia</b>.</div>`;
  }

  if (id === 'estrategia') {
    return `
      <div class="ap-intro">Aquí encaja todo lo anterior. <b>Lógica Estructural Avanzada</b>: tres fases y un repaso en medio.</div>
      ${fila(R, { num: '1', tit: O.fase1.t, video: O.fase1.v, destacado: true })}
      ${fila(R, { tit: O.repaso.t, sub: 'Vela japonesa, gráfico contra línea, tipos de tendencia y cómo detectar que cambia. Con examen: 80 puntos para seguir.', video: O.repaso.v, examen: O.repaso.e })}
      ${fila(R, { num: '2', tit: O.fase2.t, video: O.fase2.v, destacado: true })}
      ${fila(R, { num: '3', tit: O.fase3.t, video: O.fase3.v, destacado: true })}

      <div class="ap-sub">Ejemplos sobre operaciones reales</div>
      ${fila(R, { tit: O.ej1.t, video: O.ej1.v })}
      ${fila(R, { tit: O.ej2.t, video: O.ej2.v })}
      ${fila(R, { tit: O.ej3.t, video: O.ej3.v })}
      ${fila(R, { tit: O.contexto.t, sub: 'Qué mirar en cada ejemplo.', video: O.contexto.v })}`;
  }

  if (id === 'audios') {
    return `
      <div class="ap-intro">20 audiolibros. El <b>0</b> es la base: escúchalo primero.</div>
      ${fila(R, { num: '0', tit: AUDIO0(R), sub: '10 títulos, 3 horas. La verdad del dinero y el Bitcoin. Tiene su propio examen dentro.', video: R.AUDIOS[0].v, destacado: true })}
      <div class="ap-sub">Y después, en este orden</div>
      <div class="ap-audios">
        ${R.AUDIOS.slice(1).map((a) => `<a class="ap-audio" href="${a.v}" target="_blank" rel="noopener">
          <span class="ap-audio-n">${a.n}</span><span class="ap-audio-t">${a.t}</span>
          <svg viewBox="0 0 24 24" fill="currentColor">${R.ICONOS.play}</svg></a>`).join('')}
      </div>`;
  }

  return `
    <div class="ap-intro">Herramientas y repaso general.</div>
    ${fila(R, { tit: O.tuto1.t, sub: 'Abrir la cuenta y moverte por la plataforma.', video: O.tuto1.v })}
    ${fila(R, { tit: O.tuto2.t, sub: 'Sacarle partido a los gráficos.', video: O.tuto2.v })}
    ${fila(R, { tit: O.direccion.t, sub: 'Leer hacia dónde va el mercado antes de tocar nada.', video: O.direccion.v })}
    ${fila(R, { tit: O.softGen.t, sub: 'Unas 100 preguntas de todo lo estudiado. Para repasar cuando quieras.', examen: O.softGen.e, destacado: true })}
    <div class="ap-aviso">Y recuerda: <b>sé sincero contigo mismo.</b> Aprobar haciendo trampa no engaña a nadie más que a ti.</div>`;
}

const AUDIO0 = (R) => R.AUDIOS[0].t;

function decir(txt, clase = '') {
  const e = $('ac-msg'); if (!e) return;
  e.className = 'ac-msg ' + clase;
  e.innerHTML = txt;
  if (txt) setTimeout(() => { if (e.innerHTML === txt) { e.innerHTML = ''; e.className = 'ac-msg'; } }, 12000);
}

/* ══════════════════ PLANES ══════════════════ */
async function pintarPlanes() {
  const box = $('ac-planes'); if (!box) return;
  try {
    const c = leer();
    /* Los tres planes, uno detrás de otro y con reintento. Antes iban los
       tres a la vez y si UNA sola consulta fallaba —cosa habitual en los
       servidores públicos— se caía todo y salía "no pudimos consultar los
       precios". Los precios son fijos y están en el contrato: no hay
       motivo para no mostrarlos. */
    const datos = [];
    for (const p of PLANES) {
      let info = null;
      for (let i = 0; i < 3 && !info; i++) {
        try { info = await c.planes(p.id); }
        catch (_) { await new Promise((r) => setTimeout(r, 400)); }
      }
      // Si el contrato no responde, se usan los precios acordados. Mejor
      // enseñar el precio correcto que un mensaje de error.
      const respaldo = [{ dias: 30, usd: 10 }, { dias: 90, usd: 20 }, { dias: 365, usd: 50 }][p.id] || { dias: 30, usd: 10 };
      let bnb = 0n;
      try { bnb = await c.costeEnBnb(p.id); } catch (_) {}
      datos.push(info
        ? { ...p, dias: Number(info.dias), usd: Number(info.precioUsd) / 100, activo: info.activo, bnb }
        : { ...p, dias: respaldo.dias, usd: respaldo.usd, activo: true, bnb });
    }

    const mensual = datos[0]?.usd || 10;
    box.innerHTML = datos.filter((p) => p.activo).map((p) => {
      const porMes = p.usd / (p.dias / 30);
      const ahorro = p.dias > 30 ? Math.round((1 - porMes / mensual) * 100) : 0;
      return `<button class="ac-plan ${p.destacado ? 'top' : ''}" data-plan="${p.id}">
        ${p.destacado ? '<span class="ac-badge">el más elegido</span>' : ''}
        <div class="ac-plan-n">${p.nombre}</div>
        <div class="ac-plan-p"><b>${p.usd}</b><span>USD</span></div>
        <div class="ac-plan-d">${p.dias} días de acceso</div>
        ${ahorro > 0
          ? `<div class="ac-plan-ah">Sale a ${porMes.toFixed(2)} al mes · ahorras un ${ahorro}%</div>`
          : `<div class="ac-plan-ah neutro">${p.etiqueta}</div>`}
        <span class="ac-plan-b">Elegir</span>
      </button>`;
    }).join('');

    box.querySelectorAll('[data-plan]').forEach((b) => b.onclick = () => pedirDatos(Number(b.dataset.plan), datos));
  } catch (e) {
    box.innerHTML = `<div class="ac-cargando">No pudimos consultar los precios ahora mismo.<br>Revisa tu conexión y vuelve a abrir.</div>`;
  }
}

/* ══════════════════════════════════════════════════════════════
   VALIDAR EL USUARIO DE TELEGRAM
   Lo más delicado del flujo: si alguien escribe mal su usuario, paga
   igual pero el bot no lo reconoce y no puede entrar. Y el dinero ya
   está en la blockchain, así que no hay vuelta atrás.

   Reglas reales de Telegram (comprobadas):
     · de 5 a 32 caracteres (los usuarios NFT admiten 4)
     · solo a-z, A-Z, 0-9 y guion bajo
     · empieza por LETRA, nunca por número ni guion bajo
     · no termina en guion bajo, ni lleva dos seguidos
     · no distingue mayúsculas: Pepe y pepe son el mismo

   Cada fallo devuelve un motivo CONCRETO. Decirle a alguien qué tiene
   mal es la diferencia entre que lo corrija o que se rinda.
   ══════════════════════════════════════════════════════════════ */
function revisarUsuario(bruto) {
  let u = String(bruto || '').trim();

  // Pegó el enlace entero en vez del usuario
  const enlace = u.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:@)?([A-Za-z0-9_]+)/i);
  if (enlace) u = enlace[1];

  u = u.replace(/^@+/, '');            // quita una o varias arrobas

  if (!u) return { error: 'Escribe tu usuario de Telegram.' };
  if (/@/.test(u)) return { error: 'Sobra una arroba. Escribe solo el usuario, sin @.' };
  if (/^\+?\d[\d\s-]{6,}$/.test(u)) return { error: 'Eso parece un número de teléfono. Necesito tu <b>usuario</b>, el que empieza por @.' };
  if (/\s/.test(u)) return { error: 'Un usuario de Telegram no lleva espacios.' };
  if (/[\u00E1\u00E9\u00ED\u00F3\u00FA\u00FC\u00F1\u00C1\u00C9\u00CD\u00D3\u00DA\u00DC\u00D1]/.test(u)) return { error: 'No se admiten tildes ni la ñ. Solo letras sin acento, números y guion bajo.' };
  if (/-/.test(u)) return { error: 'El guion normal (-) no vale. Telegram solo admite el guion bajo (_).' };
  if (/[^A-Za-z0-9_]/.test(u)) return { error: 'Solo se admiten letras, números y guion bajo (_).' };
  if (u.length < 4) return { error: 'Muy corto: tiene ' + u.length + ' caracteres y Telegram pide al menos 5.' };
  if (u.length > 32) return { error: 'Muy largo: tiene ' + u.length + ' caracteres y el máximo de Telegram son 32.' };
  if (/^[0-9]/.test(u)) return { error: 'Un usuario de Telegram empieza por letra, nunca por número.' };
  if (/^_/.test(u)) return { error: 'No puede empezar por guion bajo.' };
  if (/_$/.test(u)) return { error: 'No puede terminar en guion bajo.' };
  if (/__/.test(u)) return { error: 'No puede llevar dos guiones bajos seguidos.' };

  // 4 caracteres: solo los usuarios NFT. Se admite, pero se avisa.
  const aviso = u.length === 4
    ? 'Cuatro caracteres solo lo tienen los usuarios NFT. Si el tuyo es normal, revísalo.'
    : null;

  return { ok: u.toLowerCase(), mostrar: u, aviso: aviso };
}

/* ══════════════════ USUARIO Y PAGO ══════════════════ */
function pedirDatos(planId, datos) {
  const p = datos.find((x) => x.id === planId); if (!p) return;
  const prev = $('ac-pago'); if (prev) prev.remove();

  const d = document.createElement('div');
  d.id = 'ac-pago';
  d.innerHTML = `<div class="ap-bg"></div>
    <div class="ap-c">
      <button class="ap-x" aria-label="Volver">✕</button>
      <div class="ap-t">${p.nombre} · ${p.usd} USD</div>
      <div class="ap-s">Tendrás acceso al grupo durante <b>${p.dias} días</b>.</div>

      <label class="ap-lab">Tu usuario de Telegram
        <div class="ap-in"><span>@</span><input id="ap-user" placeholder="tuusuario" autocomplete="off" spellcheck="false"></div>
        <span class="ap-pista">Sin la arroba. Lo encuentras en Telegram → Ajustes → Nombre de usuario.<br><b>Es el que usaremos para dejarte entrar</b>, así que revísalo bien.</span>
      </label>

      <div class="ap-err" id="ap-err"></div>

      <div class="ap-como">¿Con qué quieres pagar?</div>
      <div class="ap-pagos">
        <button class="ap-b" data-pago="usdt">
          <b>USDT</b><span>${p.usd}.00</span>
        </button>
        <button class="ap-b" data-pago="bnb">
          <b>BNB</b><span>${p.bnb > 0n ? Number(ethers.formatEther(p.bnb)).toFixed(5) : '—'}</span>
        </button>
      </div>
      <div class="ap-n">El pago va directo al contrato. Si pagas en BNB y el precio se mueve, lo que sobre se te devuelve en el acto.</div>
    </div>`;
  document.body.appendChild(d);

  const cerrar = () => { const e = $('ac-pago'); if (e) e.remove(); };
  d.querySelector('.ap-bg').onclick = cerrar;
  d.querySelector('.ap-x').onclick = cerrar;

  const err = $('ap-err');
  const campo = $('ap-user');

  /* Revisa mientras escribe: mejor avisar antes que después de pagar. */
  const revisar = (silencioso) => {
    const r = revisarUsuario(campo.value);
    if (r.error) {
      if (!silencioso) { err.className = 'ap-err mal'; err.innerHTML = r.error; }
      return null;
    }
    err.className = 'ap-err' + (r.aviso ? ' aviso' : ' ok');
    err.innerHTML = r.aviso || `Se registrará como <b>@${esc(r.mostrar)}</b>`;
    return r;
  };
  campo.oninput = () => revisar(campo.value.length < 3);

  d.querySelectorAll('[data-pago]').forEach((b) => b.onclick = () => {
    const r = revisar(false);
    if (!r) { campo.focus(); return; }
    confirmarUsuario(p, r, b.dataset.pago, cerrar);
  });
}

/* ══════════════════════════════════════════════════════════════
   ÚLTIMA PARADA ANTES DE PAGAR
   El usuario ve su nombre GRANDE y tiene que confirmar que es correcto.
   Aquí se le dice claro que no hay reembolso: el pago va a un contrato
   en la blockchain, y de ahí nadie lo saca. Vale más un segundo de
   fricción ahora que un problema irreparable después.
   ══════════════════════════════════════════════════════════════ */
function confirmarUsuario(plan, r, moneda, cerrarAnterior) {
  const d = document.createElement('div');
  d.id = 'ac-conf';
  d.innerHTML = `<div class="acf-bg"></div>
    <div class="acf-c">
      <div class="acf-t">Revisa tu usuario</div>
      <p class="acf-s">Es con este nombre con el que te dejaremos entrar. <b>Si está mal, no podremos reconocerte.</b></p>

      <div class="acf-user">@${esc(r.mostrar)}</div>

      <label class="acf-check">
        <input type="checkbox" id="acf-ok">
        <span>He comprobado que <b>ese es exactamente</b> mi usuario de Telegram</span>
      </label>

      <div class="acf-aviso">
        <b>Sin reembolso.</b> El pago va directo a un contrato en la blockchain. Ni yo ni nadie puede devolvértelo.
        <i>¿Cómo comprobarlo? En Telegram: Ajustes → Nombre de usuario. O abre <b>t.me/${esc(r.mostrar)}</b> y mira si eres tú.</i>
      </div>

      <div class="acf-acts">
        <button class="acf-b gris" id="acf-no">Volver y corregir</button>
        <button class="acf-b" id="acf-si" disabled>Pagar ${plan.usd} USD</button>
      </div>
    </div>`;
  document.body.appendChild(d);

  const q = () => d.remove();
  d.querySelector('.acf-bg').onclick = q;
  $('acf-no').onclick = q;
  $('acf-ok').onchange = (e) => { $('acf-si').disabled = !e.target.checked; };
  $('acf-si').onclick = () => {
    q();
    if (cerrarAnterior) cerrarAnterior();
    pagar(plan, r.ok, moneda);
  };
}

async function pagar(plan, usuario, moneda) {
  try {
    const cuenta = wallet.cuentaActual && wallet.cuentaActual();
    if (!cuenta) { decir('Conecta tu wallet primero, arriba a la derecha.', 'mal'); return; }

    const s = await firmante();
    const c = new ethers.Contract(ACADEMY, ABI, s);

    if (moneda === 'usdt') {
      const coste = await leer().costeEnUsdt(plan.id);
      const t = new ethers.Contract(USDT, ABI_ERC20, s);

      const saldo = await t.balanceOf(cuenta);
      if (saldo < coste) {
        decir(`No te alcanza el USDT: hacen falta ${plan.usd}.00 y tienes ${Number(ethers.formatUnits(saldo, 18)).toFixed(2)}.`, 'mal');
        return;
      }

      const permiso = await t.allowance(cuenta, ACADEMY);
      if (permiso < coste) {
        decir('<b>Paso 1 de 2 — Permiso.</b><br>Autorizas el cobro exacto de este plan. Confirma en tu wallet.', 'info');
        const tx1 = await t.approve(ACADEMY, coste);
        await tx1.wait();
      }
      decir('<b>Paso 2 de 2 — Pago.</b><br>Confirma en tu wallet.', 'info');
      const tx = await c.comprarConUsdt(plan.id, usuario);
      await tx.wait();
    } else {
      const coste = await leer().costeEnBnb(plan.id);
      const saldo = await lector().getBalance(cuenta);
      if (saldo < coste) {
        decir(`No te alcanza el BNB: hacen falta ${Number(ethers.formatEther(coste)).toFixed(5)} y tienes ${Number(ethers.formatEther(saldo)).toFixed(5)}.`, 'mal');
        return;
      }
      decir('Confirma el pago en tu wallet.', 'info');
      const tx = await c.comprarConBnb(plan.id, usuario, { value: coste });
      await tx.wait();
    }

    exito(usuario, plan);
  } catch (e) {
    const m = String(e?.shortMessage || e?.reason || e?.message || e);
    decir(/reject|denied|cancel/i.test(m) ? 'Cancelaste el pago.' : 'No se pudo completar: ' + esc(m.slice(0, 120)), 'mal');
  }
}

/* ══════════════════ DESPUÉS DE PAGAR ══════════════════ */
async function exito(usuario, plan) {
  let hasta = '';
  try {
    const st = await leer().estadoDe(usuario);
    hasta = new Date(Number(st.hasta) * 1000).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch (_) {}

  const d = document.createElement('div');
  d.id = 'ac-ok';
  d.innerHTML = `<div class="ao-bg"></div>
    <div class="ao-c">
      <div class="ao-ico"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg></div>
      <div class="ao-t">Ya está</div>
      <div class="ao-s"><b>@${esc(usuario)}</b> tiene acceso al grupo${hasta ? ` hasta el <b>${hasta}</b>` : ''}.</div>

      <div class="ao-pasos">
        <div class="ao-p"><span>1</span>Entra al grupo con el botón de abajo</div>
        <div class="ao-p"><span>2</span>Pide unirte con <b>esa misma cuenta</b> de Telegram</div>
        <div class="ao-p"><span>3</span>Se te acepta solo, en menos de un minuto</div>
      </div>

      <a class="ao-b" href="${GRUPO}" target="_blank" rel="noopener">Entrar al grupo</a>
      <button class="ao-b gris" id="ao-cerrar">Cerrar</button>
      <div class="ao-n">Si te acercas al final, renueva desde aquí: <b>los días que te queden se suman</b>, no se pierden.</div>
    </div>`;
  document.body.appendChild(d);
  const q = () => { d.remove(); const o = $('ac-overlay'); if (o) o.remove(); };
  d.querySelector('.ao-bg').onclick = q;
  $('ao-cerrar').onclick = q;
}

/* ══════════════════ CONSULTAR MI ACCESO ══════════════════ */
export async function miAcceso(usuario) {
  try {
    const st = await leer().estadoDe(String(usuario).replace(/^@/, '').toLowerCase());
    return { hasta: Number(st.hasta), quedan: Number(st.quedan) };
  } catch (_) { return null; }
}

/* ══════════════════ ESTILOS ══════════════════ */
function estilos() {
  if ($('ac-css')) return;
  const s = document.createElement('style'); s.id = 'ac-css';
  s.textContent = `
  #ac-overlay{position:fixed;inset:0;z-index:9800;display:flex;align-items:center;justify-content:center;padding:18px}
  #ac-overlay .ac-bg{position:absolute;inset:0;background:rgba(3,5,8,.9);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
  #ac-overlay .ac-c{position:relative;width:100%;max-width:840px;max-height:calc(100vh - 36px);overflow-y:auto;
    background:linear-gradient(180deg,rgba(20,25,34,.82),rgba(11,14,18,.88));border:1px solid var(--gold-soft,#C9A84B);border-radius:22px;padding:32px 30px}
  #ac-overlay .ac-c::after{content:"";position:fixed;inset:0;z-index:0;background-image:url('assets/portada/img/swap-bg.webp');background-size:cover;background-position:center;opacity:.10;filter:saturate(1.05);pointer-events:none;}
  #ac-overlay .ac-c > *{position:relative;z-index:1}
  /* La X va en su esquina, pero SIN empujar el texto a un lado: por eso
     va posicionada y el título queda centrado de verdad. */
  #ac-overlay .ac-top{position:relative;display:flex;align-items:center;justify-content:center;
    min-height:38px;margin-bottom:12px}
  #ac-overlay .ac-top .ac-eyebrow{text-align:center}
  #ac-overlay .ac-x{position:absolute;top:0;right:0;flex:0 0 auto;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;padding:0;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer;font-size:15px}
  #ac-overlay .ac-cab{text-align:center;margin-bottom:24px}
  #ac-overlay .ac-eyebrow{font-family:var(--mono,monospace);font-size:10px;color:var(--gold,#E8B84B);text-transform:uppercase;letter-spacing:2.2px}
  #ac-overlay .ac-t{font-family:var(--display,sans-serif);font-weight:800;font-size:30px;color:#eaecef;margin:9px 0 10px;line-height:1.15}
  #ac-overlay .ac-s{font-family:var(--sans,sans-serif);font-size:14px;color:#8b96a3;line-height:1.6;max-width:52ch;margin:0 auto}
  #ac-overlay .ac-que{padding:20px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid #2b3139}
  #ac-overlay .ac-que-t{font-family:var(--mono,monospace);font-size:9.5px;color:#7d8794;text-transform:uppercase;letter-spacing:1.1px;margin-bottom:14px}
  #ac-overlay .ac-lista{list-style:none;margin:0;padding:0}
  #ac-overlay .ac-lista li{position:relative;padding-left:24px;margin-bottom:12px;font-family:var(--sans,sans-serif);font-size:13px;color:#b7bdc6;line-height:1.55}
  #ac-overlay .ac-lista li:last-child{margin-bottom:0}
  #ac-overlay .ac-lista li b{color:#eaecef}
  #ac-overlay .ac-lista li:before{content:'';position:absolute;left:0;top:6px;width:13px;height:8px;border-left:2px solid var(--gold,#E8B84B);border-bottom:2px solid var(--gold,#E8B84B);transform:rotate(-45deg)}
  /* TRES COLUMNAS. Cada plan en vertical, como se comparan los precios
     en cualquier sitio: de un vistazo se ve qué da cada uno. */
  #ac-overlay .ac-planes{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:24px 0 8px;align-items:stretch}
  #ac-overlay .ac-plan{position:relative;display:flex;flex-direction:column;text-align:center;padding:26px 18px 20px;
    border-radius:18px;border:1px solid #2b3139;background:linear-gradient(180deg,#1a212b,#0e1218);
    cursor:pointer;color:var(--ink,#eaecef);transition:border-color .16s ease,transform .16s ease}
  #ac-overlay .ac-plan:hover{border-color:var(--gold-soft,#C9A84B);transform:translateY(-2px)}
  #ac-overlay .ac-plan.top{border-color:var(--gold,#E8B84B);background:linear-gradient(180deg,rgba(232,184,75,.13),rgba(232,184,75,.03))}
  #ac-overlay .ac-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:3px 11px;border-radius:20px;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800;
    font-family:var(--mono,monospace);font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px}
  #ac-overlay .ac-plan-n{font-family:var(--display,sans-serif);font-weight:800;font-size:17px;color:#eaecef}
  #ac-overlay .ac-plan-p{display:flex;align-items:baseline;justify-content:center;gap:6px;margin:10px 0 4px}
  #ac-overlay .ac-plan-p b{font-family:var(--display,sans-serif);font-size:38px;color:var(--gold,#E8B84B);line-height:1}
  #ac-overlay .ac-plan-p span{font-family:var(--mono,monospace);font-size:12px;color:#7d8794}
  #ac-overlay .ac-plan-d{font-family:var(--mono,monospace);font-size:11px;color:#7d8794}
  #ac-overlay .ac-plan-ah{margin-top:9px;flex:1;font-family:var(--sans,sans-serif);font-size:12px;color:var(--neon-lit,#2ee86a)}
  #ac-overlay .ac-plan-ah.neutro{color:#7d8794}
  #ac-overlay .ac-plan-b{display:block;margin-top:16px;padding:9px 20px;border-radius:11px;
    border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:13px}
  #ac-overlay .ac-cargando{font-family:var(--mono,monospace);font-size:12px;color:#7d8794;text-align:center;padding:40px 10px;line-height:1.7}
  #ac-overlay .ac-msg{font-family:var(--mono,monospace);font-size:12px;text-align:center;margin-top:18px;min-height:18px;line-height:1.6}
  #ac-overlay .ac-msg.ok{color:var(--neon-lit,#2ee86a)}
  #ac-overlay .ac-msg.mal{color:var(--rojo,#f6465d)}
  #ac-overlay .ac-msg.info{color:var(--gold,#E8B84B)}

  #ac-pago{position:fixed;inset:0;z-index:9810;display:flex;align-items:center;justify-content:center;padding:18px}
  #ac-pago .ap-bg{position:absolute;inset:0;background:rgba(3,5,8,.92)}
  #ac-pago .ap-c{position:relative;width:100%;max-width:400px;max-height:calc(100vh - 36px);overflow-y:auto;
    background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:26px 22px}
  #ac-pago .ap-x{position:absolute;top:13px;right:13px;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;padding:0;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer}
  #ac-pago .ap-t{font-family:var(--display,sans-serif);font-weight:800;font-size:19px;color:var(--gold,#E8B84B);padding-right:36px}
  #ac-pago .ap-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;margin:7px 0 20px}
  #ac-pago .ap-s b{color:#eaecef}
  #ac-pago .ap-lab{display:block;font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.8px}
  #ac-pago .ap-in{display:flex;align-items:center;margin-top:7px;border-radius:12px;border:1px solid #2b3139;background:#0b0e12;overflow:hidden}
  #ac-pago .ap-in span{padding:0 3px 0 13px;font-family:var(--mono,monospace);font-size:16px;color:#6b7681}
  #ac-pago .ap-in input{flex:1;min-width:0;padding:13px 13px 13px 2px;border:none;background:transparent;color:#eaecef;
    font-family:var(--mono,monospace);font-size:15px;text-transform:none;letter-spacing:0}
  #ac-pago .ap-in input:focus{outline:none}
  #ac-pago .ap-in:focus-within{border-color:var(--gold-soft,#C9A84B)}
  #ac-pago .ap-pista{display:block;margin-top:7px;font-family:var(--sans,sans-serif);font-size:11.5px;color:#6b7681;
    text-transform:none;letter-spacing:0;line-height:1.5}
  #ac-pago .ap-pista b{color:var(--gold,#E8B84B)}
  #ac-pago .ap-err{font-family:var(--sans,sans-serif);font-size:12px;color:var(--rojo,#f6465d);min-height:17px;margin:9px 0 4px}
  #ac-pago .ap-como{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;text-transform:uppercase;letter-spacing:.8px;margin-bottom:9px}
  #ac-pago .ap-pagos{display:flex;gap:9px}
  #ac-pago .ap-b{flex:1;padding:15px 11px;border-radius:13px;border:1px solid #3a424c;background:linear-gradient(180deg,#1b2027,#0d1117);
    color:#eaecef;cursor:pointer;min-height:64px;transition:border-color .15s ease}
  #ac-pago .ap-b:hover{border-color:var(--gold-soft,#C9A84B)}
  #ac-pago .ap-b b{display:block;font-family:var(--display,sans-serif);font-size:15px}
  #ac-pago .ap-b span{display:block;font-family:var(--mono,monospace);font-size:12px;color:var(--gold,#E8B84B);margin-top:3px}
  #ac-pago .ap-n{font-family:var(--sans,sans-serif);font-size:11px;color:#6b7681;line-height:1.5;margin-top:14px}

  #ac-conf{position:fixed;inset:0;z-index:9815;display:flex;align-items:center;justify-content:center;padding:18px}
  #ac-conf .acf-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
  #ac-conf .acf-c{position:relative;width:100%;max-width:390px;max-height:calc(100vh - 36px);overflow-y:auto;text-align:center;
    background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:26px 20px}
  #ac-conf .acf-t{font-family:var(--display,sans-serif);font-weight:800;font-size:20px;color:var(--gold,#E8B84B)}
  #ac-conf .acf-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.6;margin:9px 0 16px}
  #ac-conf .acf-s b{color:#eaecef}
  #ac-conf .acf-user{padding:16px 12px;border-radius:14px;background:rgba(232,184,75,.09);border:1px solid rgba(232,184,75,.35);
    font-family:var(--mono,monospace);font-size:20px;font-weight:700;color:var(--gold,#E8B84B);
    word-break:break-all;line-height:1.3;margin-bottom:16px}
  #ac-conf .acf-check{display:flex;align-items:flex-start;gap:11px;text-align:left;padding:13px;border-radius:12px;
    background:rgba(255,255,255,.03);border:1px solid #2b3139;cursor:pointer;margin-bottom:14px}
  #ac-conf .acf-check input{width:20px;height:20px;flex:0 0 auto;margin-top:1px;accent-color:var(--gold,#E8B84B);cursor:pointer}
  #ac-conf .acf-check span{font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.5}
  #ac-conf .acf-check b{color:#eaecef}
  #ac-conf .acf-aviso{text-align:left;padding:13px;border-radius:12px;background:rgba(246,70,93,.07);
    border:1px solid rgba(246,70,93,.28);font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.6;margin-bottom:18px}
  #ac-conf .acf-aviso b{color:var(--rojo,#f6465d)}
  #ac-conf .acf-aviso i{display:block;font-style:normal;margin-top:9px;padding-top:9px;
    border-top:1px solid rgba(246,70,93,.2);font-size:11.5px;color:#7d8794}
  #ac-conf .acf-aviso i b{color:var(--gold,#E8B84B)}
  #ac-conf .acf-acts{display:flex;flex-direction:column;gap:9px}
  #ac-conf .acf-b{width:100%;min-height:48px;padding:13px;border-radius:12px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a}
  #ac-conf .acf-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:#b7bdc6;box-shadow:0 3px 0 rgba(0,0,0,.4)}
  #ac-conf .acf-b:disabled{opacity:.4;cursor:default;box-shadow:none}
  #ac-conf .acf-b:active:not(:disabled){transform:translateY(2px)}
  #ac-pago .ap-err.mal{color:var(--rojo,#f6465d)}
  #ac-pago .ap-err.ok{color:var(--neon-lit,#2ee86a)}
  #ac-pago .ap-err.aviso{color:var(--gold,#E8B84B)}

  #ac-ok{position:fixed;inset:0;z-index:9820;display:flex;align-items:center;justify-content:center;padding:18px}
  #ac-ok .ao-bg{position:absolute;inset:0;background:rgba(3,5,8,.93)}
  #ac-ok .ao-c{position:relative;width:100%;max-width:390px;max-height:calc(100vh - 36px);overflow-y:auto;text-align:center;
    background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--neon-lit,#2ee86a);border-radius:20px;padding:30px 22px 22px}
  #ac-ok .ao-ico{width:62px;height:62px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;
    background:rgba(46,232,106,.13);border:1px solid rgba(46,232,106,.45);color:var(--neon-lit,#2ee86a)}
  #ac-ok .ao-t{font-family:var(--display,sans-serif);font-weight:800;font-size:24px;color:var(--neon-lit,#2ee86a)}
  #ac-ok .ao-s{font-family:var(--sans,sans-serif);font-size:13.5px;color:#8b96a3;margin:8px 0 20px;line-height:1.6}
  #ac-ok .ao-s b{color:#eaecef}
  #ac-ok .ao-pasos{text-align:left;margin-bottom:20px}
  #ac-ok .ao-p{display:flex;gap:11px;align-items:flex-start;margin-bottom:10px;font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.5}
  #ac-ok .ao-p b{color:#eaecef}
  #ac-ok .ao-p span{flex:0 0 auto;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;
    background:rgba(46,232,106,.16);border:1px solid rgba(46,232,106,.4);color:var(--neon-lit,#2ee86a);
    font-family:var(--display,sans-serif);font-weight:800;font-size:11px}
  #ac-ok .ao-b{display:block;width:100%;padding:14px;border-radius:12px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;text-decoration:none;
    font-family:var(--display,sans-serif);font-weight:800;font-size:14.5px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a;margin-bottom:9px}
  #ac-ok .ao-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:#b7bdc6;box-shadow:0 3px 0 rgba(0,0,0,.4)}
  #ac-ok .ao-n{font-family:var(--sans,sans-serif);font-size:11px;color:#6b7681;line-height:1.5;margin-top:12px}
  #ac-ok .ao-n b{color:var(--ink-3,#7d8794)}

  /* ── LA HOJA DE RUTA ── */
  #ac-overlay .ac-sec-t{font-family:var(--display,sans-serif);font-weight:800;font-size:22px;color:#eaecef;margin:34px 0 6px;text-align:center}
  #ac-overlay .ac-sec-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;text-align:center;margin:0 auto 20px;max-width:54ch;line-height:1.6}
  #ac-overlay .ac-ruta{display:flex;flex-direction:column;gap:11px}
  #ac-overlay .ac-paso{display:flex;gap:16px;padding:18px;border-radius:15px;background:rgba(255,255,255,.025);border:1px solid #2b3139}
  #ac-overlay .ac-paso-n{flex:0 0 auto;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;
    background:rgba(232,184,75,.12);border:1px solid rgba(232,184,75,.32);color:var(--gold,#E8B84B);
    font-family:var(--display,sans-serif);font-weight:800;font-size:14px}
  #ac-overlay .ac-paso-c{flex:1;min-width:0}
  #ac-overlay .ac-paso-t{font-family:var(--display,sans-serif);font-weight:800;font-size:16.5px;color:#eaecef}
  #ac-overlay .ac-paso-d{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.6;margin-top:5px}
  #ac-overlay .ac-paso-x{font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.55;margin-top:7px}
  #ac-overlay .ac-paso-x b{color:var(--gold,#E8B84B)}
  #ac-overlay .ac-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}
  #ac-overlay .ac-chips span{padding:5px 11px;border-radius:20px;background:rgba(255,255,255,.04);border:1px solid #3a424c;
    font-family:var(--mono,monospace);font-size:10.5px;color:#8b96a3}
  #ac-overlay .ac-paso-nota{margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(232,184,75,.07);
    border-left:2px solid var(--gold-soft,#C9A84B);font-family:var(--sans,sans-serif);font-size:12px;color:#b7bdc6;line-height:1.55}
  #ac-overlay .ac-paso-nota b{color:var(--gold,#E8B84B)}
  #ac-overlay .ac-fases{margin-top:13px;display:flex;flex-direction:column;gap:8px}
  #ac-overlay .ac-fase{display:flex;gap:11px;align-items:flex-start;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.03)}
  #ac-overlay .ac-fase-n{flex:0 0 auto;padding:3px 9px;border-radius:6px;background:rgba(232,184,75,.14);color:var(--gold,#E8B84B);
    font-family:var(--mono,monospace);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:1px}
  #ac-overlay .ac-fase b{display:block;font-family:var(--display,sans-serif);font-size:13.5px;color:#eaecef}
  #ac-overlay .ac-fase em{display:block;font-style:normal;font-family:var(--sans,sans-serif);font-size:12px;color:#7d8794;margin-top:3px;line-height:1.5}

  /* Cerrada: se intuye lo que hay, pero no se lee. */
  #ac-overlay .ac-ruta-cerrada{position:relative;border-radius:18px;overflow:hidden}
  #ac-overlay .ac-ruta-borrosa{filter:blur(7px);opacity:.4;pointer-events:none;user-select:none;max-height:430px;overflow:hidden}
  #ac-overlay .ac-candado{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;padding:26px 22px;background:linear-gradient(180deg,rgba(11,14,18,.55),rgba(11,14,18,.9))}
  #ac-overlay .ac-candado-i{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;margin-bottom:13px;
    background:rgba(232,184,75,.12);border:1px solid rgba(232,184,75,.4);color:var(--gold,#E8B84B)}
  #ac-overlay .ac-candado-t{font-family:var(--display,sans-serif);font-weight:800;font-size:19px;color:#eaecef}
  #ac-overlay .ac-candado-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;margin:8px 0 20px;max-width:40ch;line-height:1.6}
  #ac-overlay .ac-candado-ya{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;
    padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid #3a424c;max-width:100%}
  #ac-overlay .ac-candado-ya > span{font-family:var(--sans,sans-serif);font-size:12.5px;color:#7d8794;width:100%}
  #ac-overlay .ac-ya-in{display:flex;align-items:center;border-radius:10px;border:1px solid #2b3139;background:#0b0e12;overflow:hidden}
  #ac-overlay .ac-ya-in span{padding:0 2px 0 11px;font-family:var(--mono,monospace);font-size:14px;color:#6b7681}
  #ac-overlay .ac-ya-in input{width:190px;max-width:46vw;padding:11px 11px 11px 2px;border:none;background:transparent;color:#eaecef;
    font-family:var(--mono,monospace);font-size:13.5px}
  #ac-overlay .ac-ya-in input:focus{outline:none}
  #ac-overlay .ac-ya-b{padding:11px 19px;border-radius:10px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:13px;cursor:pointer;min-height:42px}
  #ac-overlay .ac-ya-err{width:100%;font-family:var(--sans,sans-serif);font-size:11.5px;color:var(--gold,#E8B84B);min-height:15px}
  #ac-overlay .ac-abierto{display:inline-block;padding:6px 14px;border-radius:20px;margin:0 auto 18px;
    background:rgba(46,232,106,.1);border:1px solid rgba(46,232,106,.35);color:var(--neon-lit,#2ee86a);
    font-family:var(--mono,monospace);font-size:11px}
  #ac-overlay .ac-ruta-zona{text-align:center}
  #ac-overlay .ac-ruta-zona .ac-ruta{text-align:left}
  #ac-overlay .ac-grupo-b{display:inline-block;margin-top:20px;padding:14px 30px;border-radius:13px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;text-decoration:none;
    font-family:var(--display,sans-serif);font-weight:800;font-size:14.5px;box-shadow:0 4px 0 #8f6a1a}

  #ac-overlay .ac-cifras{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:22px 0 16px}
  #ac-overlay .ac-cif{text-align:center;padding:16px 10px;border-radius:14px;
    background:linear-gradient(180deg,rgba(232,184,75,.09),rgba(232,184,75,.015));border:1px solid rgba(232,184,75,.22)}
  #ac-overlay .ac-cif b{display:block;font-family:var(--display,sans-serif);font-size:30px;color:var(--gold,#E8B84B);line-height:1}
  #ac-overlay .ac-cif span{display:block;font-family:var(--display,sans-serif);font-weight:700;font-size:13px;color:#eaecef;margin-top:7px;line-height:1.25}
  #ac-overlay .ac-cif i{display:block;font-style:normal;font-family:var(--sans,sans-serif);font-size:10.5px;color:#7d8794;margin-top:3px;line-height:1.3}
  @media(max-width:700px){
    #ac-overlay .ac-cifras{grid-template-columns:repeat(2,1fr);gap:8px}
    #ac-overlay .ac-cif{padding:13px 8px}
    #ac-overlay .ac-cif b{font-size:25px}
  }

  /* ══════════ PANEL DE APRENDIZAJE ══════════ */
  #ac-overlay .ap-panel{text-align:left}
  #ac-overlay .ap-cab{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;
    padding:18px 20px;border-radius:16px;background:linear-gradient(135deg,rgba(232,184,75,.11),rgba(232,184,75,.02));
    border:1px solid rgba(232,184,75,.28);margin-bottom:14px}
  #ac-overlay .ap-cab-t{font-family:var(--display,sans-serif);font-weight:800;font-size:19px;color:#eaecef}
  #ac-overlay .ap-cab-s{font-family:var(--mono,monospace);font-size:11px;color:var(--gold,#E8B84B);margin-top:4px}
  #ac-overlay .ap-grupo{flex:0 0 auto;padding:10px 18px;border-radius:11px;border:1px solid #c79426;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;text-decoration:none;
    font-family:var(--display,sans-serif);font-weight:800;font-size:12.5px;min-height:42px;display:inline-flex;align-items:center}
  #ac-overlay .ap-regla{padding:15px 17px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid #2b3139;
    font-family:var(--sans,sans-serif);font-size:12.5px;color:#8b96a3;line-height:1.65;margin-bottom:16px}
  #ac-overlay .ap-regla b{color:#eaecef}
  #ac-overlay .ap-regla > b:first-child{display:block;font-family:var(--display,sans-serif);font-size:14px;color:var(--gold,#E8B84B);margin-bottom:6px}
  #ac-overlay .ap-regla i{display:block;font-style:normal;margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.07);font-size:12px;color:#7d8794}
  #ac-overlay .ap-regla i b{color:#b7bdc6}

  /* ══════ LAS CINCO ETAPAS ══════
     En el escritorio son pestañas en fila. En el móvil se convierten en
     una LISTA vertical, que es como se lee un camino de verdad: una
     debajo de otra, con su número, su nombre completo y una flecha. */
  #ac-overlay .ap-tabs{display:flex;gap:5px;padding:5px;border-radius:14px;background:#0b0e12;
    border:1px solid #2b3139;margin-bottom:16px}
  #ac-overlay .ap-tab{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;
    min-height:46px;padding:0 10px;border:none;border-radius:11px;background:transparent;color:#8b96a3;
    font-family:var(--display,sans-serif);font-weight:700;font-size:11.5px;cursor:pointer;
    transition:background .15s ease,color .15s ease;min-width:0}
  #ac-overlay .ap-tab-f{display:none}
  #ac-overlay .ap-tab-n{flex:0 0 auto;width:20px;height:20px;border-radius:6px;display:grid;place-items:center;
    background:rgba(255,255,255,.07);font-family:var(--mono,monospace);font-size:10.5px;font-weight:700}
  #ac-overlay .ap-tab.on .ap-tab-n{background:rgba(58,40,0,.22);color:#3a2800}
  #ac-overlay .ap-tab-t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  #ac-overlay .ap-tab.on{background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800}
  #ac-overlay .ap-tab:not(.on):hover{background:rgba(255,255,255,.05);color:#b7bdc6}

  /* El paso siguiente: grande y al final. Es lo que evita que el usuario
     crea que ya ha visto todo y se marche en la primera sección. */
  #ac-overlay .ap-siguiente{display:flex;align-items:center;gap:13px;width:100%;margin-top:22px;padding:17px 20px;
    border-radius:15px;border:1px solid rgba(232,184,75,.4);background:linear-gradient(135deg,rgba(232,184,75,.13),rgba(232,184,75,.03));
    color:#eaecef;cursor:pointer;text-align:left;transition:border-color .16s ease,transform .16s ease}
  #ac-overlay .ap-siguiente:hover{border-color:var(--gold,#E8B84B);transform:translateX(3px)}
  #ac-overlay .ap-sig-e{flex:0 0 auto;font-family:var(--mono,monospace);font-size:9.5px;color:var(--gold,#E8B84B);
    text-transform:uppercase;letter-spacing:1px;padding:5px 10px;border-radius:20px;background:rgba(232,184,75,.14)}
  #ac-overlay .ap-sig-t{flex:1;font-family:var(--display,sans-serif);font-weight:800;font-size:16px}
  #ac-overlay .ap-siguiente svg{width:19px;height:19px;flex:0 0 auto;color:var(--gold,#E8B84B)}
  #ac-overlay .ap-fin{margin-top:22px;padding:20px;border-radius:15px;text-align:center;
    background:rgba(46,232,106,.07);border:1px solid rgba(46,232,106,.3);
    font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.7}
  #ac-overlay .ap-fin b{font-family:var(--display,sans-serif);font-size:15px;color:var(--neon-lit,#2ee86a)}
  /* Los tres pasos de la regla, en fila */
  /* Los tres del mismo ancho SIEMPRE (1fr cada uno). Con flex, el que
     tenía más texto se comía el espacio de los otros y se descuadraba. */
  #ac-overlay .ap-pasos3{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:11px 0 12px}
  #ac-overlay .ap-pasos3 > div{display:flex;align-items:center;gap:9px;padding:11px 12px;min-width:0;
    border-radius:11px;background:rgba(255,255,255,.035);font-family:var(--sans,sans-serif);
    font-size:12.5px;color:#b7bdc6;line-height:1.35}
  #ac-overlay .ap-pasos3 > div b{color:var(--gold,#E8B84B);white-space:nowrap}
  #ac-overlay .ap-pasos3 span{flex:0 0 auto;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;
    background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800;
    font-family:var(--display,sans-serif);font-weight:800;font-size:11px}
  #ac-overlay .ap-regla p{margin:0 0 9px;font-family:var(--sans,sans-serif);font-size:12.5px;color:#8b96a3;line-height:1.65}
  #ac-overlay .ap-cert{padding:11px 13px;border-radius:11px;background:rgba(46,232,106,.07);border:1px solid rgba(46,232,106,.25)}
  #ac-overlay .ap-cert b{color:var(--neon-lit,#2ee86a)}
  #ac-overlay .ap-honesto{border-top-color:rgba(232,184,75,.22)}
  #ac-overlay .ap-honesto b{color:var(--gold,#E8B84B)}
  #ac-overlay .ap-intro{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.6;margin-bottom:14px}
  #ac-overlay .ap-intro b{color:var(--gold,#E8B84B)}
  #ac-overlay .ap-sub{font-family:var(--mono,monospace);font-size:9.5px;color:#7d8794;text-transform:uppercase;
    letter-spacing:1.1px;margin:22px 0 11px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,.07)}
  #ac-overlay .ap-aviso{margin-top:16px;padding:12px 14px;border-radius:11px;background:rgba(232,184,75,.07);
    border-left:2px solid var(--gold-soft,#C9A84B);font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.6}
  #ac-overlay .ap-aviso b{color:var(--gold,#E8B84B)}

  #ac-overlay .ap-fila{display:flex;align-items:center;gap:13px;padding:13px 15px;border-radius:13px;
    background:rgba(255,255,255,.025);border:1px solid #2b3139;margin-bottom:8px}
  #ac-overlay .ap-fila.top{border-color:rgba(232,184,75,.35);background:rgba(232,184,75,.055)}
  #ac-overlay .ap-num{flex:0 0 auto;width:32px;height:32px;border-radius:10px;display:grid;place-items:center;
    background:rgba(232,184,75,.13);border:1px solid rgba(232,184,75,.3);color:var(--gold,#E8B84B);
    font-family:var(--display,sans-serif);font-weight:800;font-size:13px}
  #ac-overlay .ap-fila-c{flex:1;min-width:0}
  #ac-overlay .ap-fila-t{font-family:var(--display,sans-serif);font-weight:700;font-size:14px;color:#eaecef;line-height:1.35}
  #ac-overlay .ap-fila-s{font-family:var(--sans,sans-serif);font-size:12px;color:#7d8794;line-height:1.5;margin-top:4px}
  #ac-overlay .ap-fila-b{flex:0 0 auto;display:flex;gap:7px}
  #ac-overlay .ap-b{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:10px;
    text-decoration:none;font-family:var(--display,sans-serif);font-weight:700;font-size:12px;min-height:40px;white-space:nowrap}
  #ac-overlay .ap-b svg{width:13px;height:13px;flex:0 0 auto}
  #ac-overlay .ap-b.ver{border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800}
  #ac-overlay .ap-b.test{border:1px solid rgba(46,232,106,.4);background:rgba(46,232,106,.09);color:var(--neon-lit,#2ee86a)}
  #ac-overlay .ap-b.test:hover{background:rgba(46,232,106,.16)}

  #ac-overlay .ap-audios{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}
  #ac-overlay .ap-audio{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:11px;
    background:rgba(255,255,255,.025);border:1px solid #2b3139;text-decoration:none;color:#b7bdc6;min-height:48px;
    transition:border-color .15s ease,background .15s ease}
  #ac-overlay .ap-audio:hover{border-color:var(--gold-soft,#C9A84B);background:rgba(232,184,75,.06)}
  #ac-overlay .ap-audio-n{flex:0 0 auto;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;
    background:rgba(255,255,255,.05);color:#7d8794;font-family:var(--mono,monospace);font-size:11px;font-weight:700}
  #ac-overlay .ap-audio-t{flex:1;min-width:0;font-family:var(--sans,sans-serif);font-size:12.5px;line-height:1.35}
  #ac-overlay .ap-audio svg{width:12px;height:12px;flex:0 0 auto;color:var(--gold,#E8B84B);opacity:.7}

  @media(max-width:700px){
    /* ══════ LAS ETAPAS EN MÓVIL: UNA LISTA ══════
       Cinco pestañas en 360px no caben: o se recortan, o se amontonan en
       tres líneas cada una, o hay que deslizar a ciegas. Como lista
       vertical cada etapa se lee entera y se ve el camino de un vistazo. */
    #ac-overlay .ap-tabs{display:flex;flex-direction:column;gap:6px;padding:0;background:transparent;border:none}
    #ac-overlay .ap-tab{width:100%;flex:0 0 auto;flex-direction:row;justify-content:flex-start;align-items:center;
      gap:12px;min-height:54px;padding:0 14px;border-radius:12px;
      background:rgba(255,255,255,.03);border:1px solid #2b3139;font-size:13.5px}
    #ac-overlay .ap-tab-n{width:26px;height:26px;font-size:12px;flex:0 0 auto}
    #ac-overlay .ap-tab-t{flex:1;text-align:left;white-space:normal;font-size:13.5px;line-height:1.25;overflow:visible}
    #ac-overlay .ap-tab-f{display:grid;place-items:center;width:18px;height:18px;flex:0 0 auto;opacity:.4}
    #ac-overlay .ap-tab-f svg{width:15px;height:15px}
    #ac-overlay .ap-tab.on{border-color:#c79426;box-shadow:0 3px 0 #8f6a1a}
    #ac-overlay .ap-tab.on .ap-tab-f{opacity:.7}
    #ac-overlay .ap-siguiente{flex-wrap:wrap;gap:9px;padding:15px 16px}
    #ac-overlay .ap-sig-t{flex:1 1 100%;font-size:15px;order:2}
    #ac-overlay .ap-siguiente svg{order:3}
    #ac-overlay .ap-pasos3{grid-template-columns:1fr;gap:7px}
    #ac-overlay .ap-audios{grid-template-columns:1fr}
    #ac-overlay .ap-fila{flex-wrap:wrap}
    #ac-overlay .ap-fila-c{flex:1 1 100%;order:1}
    #ac-overlay .ap-num{order:0}
    #ac-overlay .ap-fila-b{flex:1 1 100%;order:2;margin-top:4px}
    #ac-overlay .ap-b{flex:1;justify-content:center}
    #ac-overlay .ap-cab{flex-direction:column;align-items:stretch}
    #ac-overlay .ap-grupo{justify-content:center}
    /* ══════ LAS ETAPAS EN MÓVIL: UNA LISTA, NO PESTAÑAS ══════
       Cinco pestañas en 360px no caben de ninguna forma: o se recortan,
       o se amontonan, o hay que deslizar a ciegas. Como lista vertical
       cada etapa tiene su sitio, se lee entera y se ve el camino. */
    #ac-overlay .ap-tabs{display:flex;flex-direction:column;gap:6px;padding:6px;background:transparent;border:none}
    #ac-overlay .ap-tab{width:100%;justify-content:flex-start;gap:12px;min-height:52px;padding:0 14px;
      border-radius:12px;background:rgba(255,255,255,.03);border:1px solid #2b3139;font-size:13.5px}
    #ac-overlay .ap-tab-n{width:26px;height:26px;font-size:12px}
    #ac-overlay .ap-tab-t{flex:1;text-align:left;white-space:normal;line-height:1.25}
    #ac-overlay .ap-tab-f{display:grid;place-items:center;width:18px;height:18px;flex:0 0 auto;opacity:.45}
    #ac-overlay .ap-tab-f svg{width:15px;height:15px}
    #ac-overlay .ap-tab.on{border-color:#c79426;box-shadow:0 3px 0 #8f6a1a}
    #ac-overlay .ap-tab.on .ap-tab-f{opacity:.75}
  }

  @media(max-width:860px){
    #ac-overlay .ac-planes{grid-template-columns:1fr;gap:11px}
    /* AQUÍ ESTABA EL FALLO: en móvil ponía todo a la izquierda. Se veía
       como si el diseño se hubiera roto. Los planes van centrados en
       cualquier pantalla, igual que en el escritorio. */
    #ac-overlay .ac-plan{padding:20px 16px}
    #ac-overlay .ac-c{padding:26px 18px}
    #ac-overlay .ac-t{font-size:25px}
  }
  @media(max-width:560px){
    /* ══════ MÓVIL: menos texto, más camino ══════
       En una pantalla de 360px, tres párrafos antes de llegar a lo útil
       hacen que el usuario se pierda antes de empezar. Se recorta lo
       decorativo y se deja lo que sirve. */
    #ac-overlay{padding:8px}
    #ac-overlay .ac-c{padding:16px 13px;border-radius:16px;max-height:calc(100vh - 16px)}
    #ac-overlay .ac-eyebrow{font-size:9px;letter-spacing:1.6px}
    #ac-overlay .ac-cab{margin-bottom:18px}
    #ac-overlay .ac-t{font-size:20px;line-height:1.2}
    #ac-overlay .ac-s{font-size:12.5px;line-height:1.55}
    #ac-overlay .ac-cifras{gap:7px;margin:16px 0 14px}
    #ac-overlay .ac-cif{padding:12px 7px;border-radius:12px}
    #ac-overlay .ac-cif b{font-size:23px}
    #ac-overlay .ac-cif span{font-size:11.5px;margin-top:5px}
    #ac-overlay .ac-cif i{font-size:9.5px}
    #ac-overlay .ac-que{padding:14px}
    #ac-overlay .ac-lista li{font-size:12.5px;padding-left:21px;margin-bottom:10px}
    #ac-overlay .ac-plan{padding:18px 15px}
    #ac-overlay .ac-plan-p b{font-size:29px}
    #ac-overlay .ac-sec-t{font-size:19px;margin-top:26px}
    #ac-overlay .ac-sec-s{font-size:12.5px;margin-bottom:16px}
    #ac-pago .ap-pagos{flex-direction:column}

    /* Panel: todo más compacto */
    #ac-overlay .ap-cab{padding:14px 15px;margin-bottom:11px}
    #ac-overlay .ap-cab-t{font-size:17px}
    #ac-overlay .ap-regla{padding:13px 14px;margin-bottom:13px}
    #ac-overlay .ap-regla > b:first-child{font-size:13.5px}
    #ac-overlay .ap-regla p,#ac-overlay .ap-regla i{font-size:12px}
    #ac-overlay .ap-fila{padding:12px 13px;gap:11px}
    #ac-overlay .ap-fila-t{font-size:13.5px}
    #ac-overlay .ap-fila-s{font-size:11.5px}
    #ac-overlay .ap-num{width:29px;height:29px;font-size:12px}
    #ac-overlay .ap-intro{font-size:12.5px}
    #ac-overlay .ap-audio-t{font-size:12px}
  }

  /* ══════ LAS BARRAS DE DESPLAZAMIENTO ══════
     Por defecto el navegador pinta una barra gris del sistema, con sus
     flechas, que no pega nada con el resto. Aquí va una fina y discreta. */
  #ac-overlay .ac-c{scrollbar-width:thin;scrollbar-color:rgba(232,184,75,.35) transparent}
  #ac-overlay .ac-c::-webkit-scrollbar{width:7px}
  #ac-overlay .ac-c::-webkit-scrollbar-track{background:transparent}
  #ac-overlay .ac-c::-webkit-scrollbar-thumb{background:rgba(232,184,75,.3);border-radius:20px}
  #ac-overlay .ac-c::-webkit-scrollbar-thumb:hover{background:rgba(232,184,75,.5)}
  #ac-pago .ap-c,#ac-ok .ao-c{scrollbar-width:thin;scrollbar-color:rgba(232,184,75,.35) transparent}
  #ac-pago .ap-c::-webkit-scrollbar,#ac-ok .ao-c::-webkit-scrollbar{width:7px}
  #ac-pago .ap-c::-webkit-scrollbar-thumb,#ac-ok .ao-c::-webkit-scrollbar-thumb{background:rgba(232,184,75,.3);border-radius:20px}
  @media(prefers-reduced-motion:reduce){#ac-overlay .ac-plan{transition:none}}`;
  document.head.appendChild(s);
}
