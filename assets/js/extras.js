// extras.js — Tres cosas que suman: instalar la app, compartir el resultado
// como imagen, y animar los números. Módulo independiente, sin librerías.

const $ = (id) => document.getElementById(id);
const num = (n, d = 2) => Number(n).toLocaleString('es', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ══════════════ 1) INSTALAR LA APP ══════════════ */
/* Nada de banners que tapan la pantalla: el usuario abre el panel cuando
   quiere, desde el botón "Instalar" del menú. */
let _instalador = null;

export function iniciarInstalacion() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); _instalador = e; marcarBoton(true); });
  window.addEventListener('appinstalled', () => { _instalador = null; marcarBoton(false); cerrarPanel(); });
  // Si ya está instalada, el botón sobra.
  if (yaInstalada()) marcarBoton(false);
}

function yaInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function marcarBoton(listo) {
  const b = $('c-instalar');
  if (!b) return;
  if (yaInstalada()) { b.style.display = 'none'; return; }
  b.classList.toggle('listo', !!listo);
}
function cerrarPanel() { const p = $('inst-panel'); if (p) p.remove(); }

/** Panel desplegable bajo el botón "Instalar". */
/** En el móvil el botón comparte el enlace de CriptoCuba; en el ordenador, instala. */
export async function compartirEnlace() {
  const url = location.origin + location.pathname.replace(/[^/]*$/, '');
  const texto = 'Bots de trading en cripto sin custodia.\n\n' +
    'CriptoCuba te deja usar bots (Smart Grid, Accumulator, Cash Out y DCA) con tu dinero SIEMPRE en tu propia wallet. ' +
    'Sin registro, sin KYC y sin dejar tus fondos en manos de nadie.\n\n' + url;
  try {
    if (navigator.share) { await navigator.share({ title: 'Cripto Cuba Oficial', text: texto }); return true; }
  } catch (_) { return false; }
  try { await navigator.clipboard.writeText(texto); avisoCopiado(); return true; } catch (_) {}
  return false;
}

function avisoCopiado() {
  estilos();
  const d = document.createElement('div');
  d.id = 'cop-av';
  d.textContent = 'Enlace copiado. Pégalo donde quieras.';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2600);
}

/* ══════════════════════════════════════════════════════════════
   INSTALACIÓN DIRECTA (añadida para la portada)
   Dispara la instalación de la PWA sin ninguna ventana intermedia.
   - Si el navegador ya ofreció instalar (tenemos _instalador), llama a
     prompt() directamente: aparece el diálogo nativo del sistema.
   - Si aún no lo ofrece o ya está instalada, comparte el enlace, que es
     lo útil en ese caso (y lo que hace la app en el móvil).
   No modifica nada del flujo anterior: panelInstalar y las ventanas
   siguen intactas por si se usan en otro sitio.
   ══════════════════════════════════════════════════════════════ */
/* Permite entregar el evento beforeinstallprompt capturado por la portada,
   por si llegó antes de que este módulo se cargara. */
export function registrarInstalador(e) { if (e) _instalador = e; }

export async function instalarAhora() {
  // Escritorio: instala directamente con el diálogo nativo del navegador.
  if (_instalador) {
    _instalador.prompt();
    try { await _instalador.userChoice; } catch (_) {}
    _instalador = null;
    return true;
  }
  // Teléfono: la instalación no pasa por prompt(); se comparte el enlace,
  // que es lo útil ahí (el usuario lo abre e instala desde su navegador).
  if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) { return compartirEnlace(); }
  // Ya instalada: no hay nada que hacer.
  if (yaInstalada()) { return true; }
  // Escritorio sin evento disponible (Firefox, o criterios no cumplidos):
  // se abre el panel con instrucciones, en vez de compartir en silencio.
  ventanaInstrucciones();
  return false;
}

export function panelInstalar(ancla) {
  // En el teléfono no ofrecemos instalar: compartimos el enlace, que es lo útil.
  if (/android|iphone|ipad|ipod/i.test(navigator.userAgent)) { compartirEnlace(); return; }
  estilos();
  if ($('inst-panel')) { cerrarPanel(); return; }

  const puede = !!_instalador;
  const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const movil = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  const d = document.createElement('div');
  d.id = 'inst-panel';
  d.innerHTML = `<div class="ip-bg"></div>
    <div class="ip-c">
      <div class="ip-top">
        <img class="ip-ico" src="assets/img/cco-192.png" alt="">
        <div><b>Cripto Cuba</b><span>Bots de trading en tu wallet</span></div>
      </div>
      <button class="ip-b" id="ip-si">Instalar</button>
      <div class="ip-n" id="ip-nota">Se abre al instante, con su icono y a pantalla completa.</div>
      ${!movil ? `<div class="ip-sep"></div>
        <div class="ip-n">Y en tu teléfono: escanea este código.</div>
        <div class="ip-qr" id="ip-qr"></div>` : ''}
    </div>`;
  document.body.appendChild(d);

  const r = ancla ? ancla.getBoundingClientRect() : { bottom: 60, right: window.innerWidth - 14 };
  const c = d.querySelector('.ip-c');
  c.style.top = (r.bottom + 8) + 'px';
  c.style.right = Math.max(10, window.innerWidth - r.right) + 'px';

  d.querySelector('.ip-bg').onclick = cerrarPanel;
  const si = $('ip-si');
  if (si) si.onclick = async () => {
    if (_instalador) { cerrarPanel(); ventanaPreInstalar(); return; }
    // El navegador no nos deja instalarla desde aquí: explicamos cómo, solo entonces.
    const nota = $('ip-nota');
    if (!nota) return;
    nota.className = 'ip-pasos';
    // En vez de un muro de texto, un botón que abre instrucciones con dibujos.
    si.textContent = 'Ya está instalada';
    si.disabled = true;
    nota.className = 'ip-n';
    nota.innerHTML = '';
    if (!movil && !$('ip-comor')) {
      si.insertAdjacentHTML('afterend', '<button class="ip-b sec" id="ip-comor">Cómo instalarla</button>');
      $('ip-comor').onclick = () => { cerrarPanel(); ventanaInstrucciones(); };
    }
  };

  const qr = $('ip-qr');
  if (qr) dibujarQR(qr);
}

/** Nuestra ventana antes de instalar: presentación bonita con el logo.
 *  Al aceptar aparece la del navegador, que es obligatoria y no se puede
 *  sustituir: es el propio sistema quien pide la confirmación final. */
export function ventanaPreInstalar() {
  estilos();
  const prev = $('inst-pre'); if (prev) prev.remove();
  const d = document.createElement('div');
  d.id = 'inst-pre';
  d.innerHTML = `<div class="pi-bg"></div>
    <div class="pi-c">
      <img class="pi-ico" src="assets/img/cco-512.png" alt="">
      <div class="pi-t">Instalar CriptoCuba</div>
      <div class="pi-s">Se abrirá en su propia ventana, con su icono, sin barras del navegador y arranca al instante.</div>
      <div class="pi-vent">
        <span>✓ Se abre como una aplicación</span>
        <span>✓ Funciona aunque la red vaya lenta</span>
        <span>✓ No ocupa casi espacio</span>
      </div>
      <div class="pi-acts">
        <button class="pi-b gris" id="pi-no">Ahora no</button>
        <button class="pi-b" id="pi-si">Instalar</button>
      </div>
      <div class="pi-n">Tu navegador te pedirá una confirmación final.</div>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => { const e = $('inst-pre'); if (e) e.remove(); };
  d.querySelector('.pi-bg').onclick = cerrar;
  $('pi-no').onclick = cerrar;
  $('pi-si').onclick = async () => {
    cerrar();
    if (!_instalador) return;
    _instalador.prompt();
    try { await _instalador.userChoice; } catch (_) {}
    _instalador = null;
  };
}

/** Ventana con instrucciones visuales, distintas según el navegador. */
export function ventanaInstrucciones() {
  estilos();
  const prev = $('inst-guia'); if (prev) prev.remove();
  const ua = navigator.userAgent;
  const esBrave = !!navigator.brave || /Brave/i.test(ua);
  const esEdge = /Edg\//.test(ua);
  const esChrome = /Chrome/.test(ua) && !esEdge && !esBrave;
  const nav = esBrave ? 'Brave' : esChrome ? 'Chrome' : esEdge ? 'Edge' : 'tu navegador';

  // Dibujo de la barra del navegador señalando dónde está el icono.
  const barra = (tipo) => `
    <svg viewBox="0 0 420 62" class="gi-svg">
      <rect x="0" y="0" width="420" height="62" rx="10" fill="#1b2027" stroke="#2b3139"/>
      <rect x="14" y="17" width="300" height="28" rx="14" fill="#0b0e12" stroke="#2b3139"/>
      <text x="30" y="36" fill="#7d8794" font-family="monospace" font-size="11">cybersecureaid.github.io</text>
      ${tipo === 'chrome'
        ? `<rect x="322" y="19" width="66" height="24" rx="12" fill="#1a73e8"/>
           <circle cx="334" cy="31" r="6" fill="#E8B84B"/>
           <text x="344" y="35" fill="#fff" font-family="system-ui" font-size="9">Abrir…</text>
           <circle cx="322" cy="31" r="21" fill="none" stroke="#E8B84B" stroke-width="2.5" stroke-dasharray="4 3"><animate attributeName="r" values="21;25;21" dur="1.6s" repeatCount="indefinite"/></circle>`
        : `<rect x="352" y="21" width="20" height="20" rx="4" fill="none" stroke="#b7bdc6" stroke-width="1.8"/>
           <path d="M357 36 L367 26 M367 26 h-5 M367 26 v5" stroke="#b7bdc6" stroke-width="1.8" fill="none" stroke-linecap="round"/>
           <circle cx="362" cy="31" r="19" fill="none" stroke="#E8B84B" stroke-width="2.5" stroke-dasharray="4 3"><animate attributeName="r" values="19;23;19" dur="1.6s" repeatCount="indefinite"/></circle>`}
    </svg>`;

  const d = document.createElement('div');
  d.id = 'inst-guia';
  d.innerHTML = `<div class="gi-bg"></div>
    <div class="gi-c">
      <button class="gi-x" aria-label="Cerrar">✕</button>
      <div class="gi-t">Instalar CriptoCuba en tu equipo</div>
      <div class="gi-s">Estás usando <b>${nav}</b>. Sigue estos pasos.</div>

      <div class="gi-paso">
        <div class="gi-num">1</div>
        <div class="gi-txt">
          <b>Mira arriba, a la derecha de la barra de búsqueda</b>
          <span>${esChrome
            ? 'Verás una píldora azul que dice «Abrir en la app», con el icono de CriptoCuba.'
            : 'Verás un cuadradito con una flecha que apunta hacia arriba.'}</span>
        </div>
      </div>
      ${barra(esChrome ? 'chrome' : 'brave')}

      <div class="gi-paso">
        <div class="gi-num">2</div>
        <div class="gi-txt"><b>Haz clic ahí</b><span>Se abrirá CriptoCuba como una aplicación, en su propia ventana.</span></div>
      </div>

      <div class="gi-paso">
        <div class="gi-num">3</div>
        <div class="gi-txt">
          <b>Déjala fija en la barra de tareas</b>
          <span>Con CriptoCuba ya abierta, busca su icono abajo en la barra de tareas de Windows, haz <b>clic derecho</b> y elige <b>«Anclar a la barra de tareas»</b>. Así la tendrás siempre a un clic.</span>
        </div>
      </div>

      <div class="gi-nota">Si no ves ese icono, es que CriptoCuba ya está instalada. Búscala en tu menú de inicio.</div>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => d.remove();
  d.querySelector('.gi-bg').onclick = cerrar;
  d.querySelector('.gi-x').onclick = cerrar;
}

/* QR de la web, para instalarla en el teléfono desde el ordenador. */
async function dibujarQR(cont) {
  const url = location.origin + location.pathname.replace(/[^/]*$/, '');
  const pinta = () => {
    try {
      const q = window.qrcode(0, 'M');
      q.addData(url); q.make();
      cont.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (_) { cont.innerHTML = `<div class="ip-nqr">${url}</div>`; }
  };
  if (window.qrcode) return pinta();
  const sc = document.createElement('script');
  sc.src = 'assets/js/vendor/qrcode.js?v=125';
  sc.onload = pinta;
  sc.onerror = () => { cont.innerHTML = `<div class="ip-nqr">${url}</div>`; };
  document.head.appendChild(sc);
}

/* ══════════════ 2) COMPARTIR EL RESULTADO COMO IMAGEN ══════════════ */
/* Dibujamos la tarjeta a mano: sale más limpia y no pesa nada. */

function redondeado(x, r, w, h, rad) {
  x.beginPath();
  x.moveTo(rad, 0); x.lineTo(w - rad, 0); x.quadraticCurveTo(w, 0, w, rad);
  x.lineTo(w, h - rad); x.quadraticCurveTo(w, h, w - rad, h);
  x.lineTo(rad, h); x.quadraticCurveTo(0, h, 0, h - rad);
  x.lineTo(0, rad); x.quadraticCurveTo(0, 0, rad, 0); x.closePath();
}

/** Dibuja la tarjeta del bot y devuelve el canvas. */
export function tarjetaResultado({ par, tipo, ganancia, moneda, dias, vueltas, invertido, pct }) {
  const W = 1080, H = 1080, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');

  // Fondo
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#141a24'); g.addColorStop(0.5, '#0e1219'); g.addColorStop(1, '#0b0e11');
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  // Halo dorado
  const halo = x.createRadialGradient(W * 0.8, H * 0.18, 10, W * 0.8, H * 0.18, W * 0.7);
  halo.addColorStop(0, 'rgba(232,184,75,.16)'); halo.addColorStop(1, 'transparent');
  x.fillStyle = halo; x.fillRect(0, 0, W, H);

  // Marco
  x.save(); x.translate(52, 52); redondeado(x, 0, W - 104, H - 104, 40);
  x.strokeStyle = 'rgba(232,184,75,.34)'; x.lineWidth = 2; x.stroke(); x.restore();

  const cx = W / 2;
  const positivo = Number(ganancia) >= 0;

  // Marca
  x.textAlign = 'center';
  x.fillStyle = '#E8B84B'; x.font = 'bold 46px system-ui, sans-serif';
  x.fillText('AUREX', cx, 160);
  x.fillStyle = '#6b7681'; x.font = '20px ui-monospace, monospace';
  x.fillText('BOTS EN TU PROPIA WALLET', cx, 196);

  // Par y tipo
  x.fillStyle = '#eaecef'; x.font = 'bold 68px system-ui, sans-serif';
  x.fillText(par || '', cx, 330);
  x.fillStyle = '#8b96a3'; x.font = '26px system-ui, sans-serif';
  x.fillText(tipo || '', cx, 374);

  // Ganancia
  x.fillStyle = '#7d8794'; x.font = '24px ui-monospace, monospace';
  x.fillText('GANANCIA', cx, 470);
  x.fillStyle = positivo ? '#2ee86a' : '#f6465d';
  x.font = 'bold 132px system-ui, sans-serif';
  x.fillText(`${positivo ? '+' : ''}${num(ganancia, 2)}`, cx, 590);
  x.fillStyle = '#8b96a3'; x.font = '30px ui-monospace, monospace';
  x.fillText(moneda || '', cx, 634);

  if (pct !== undefined && isFinite(pct)) {
    x.fillStyle = positivo ? 'rgba(46,232,106,.16)' : 'rgba(246,70,93,.16)';
    redondeado(x, 0, 0, 0, 0);
    const txt = `${positivo ? '+' : ''}${num(pct, 2)}%`;
    x.font = 'bold 34px system-ui, sans-serif';
    const w = x.measureText(txt).width + 56;
    x.save(); x.translate(cx - w / 2, 668); redondeado(x, 0, w, 60, 30);
    x.fillStyle = positivo ? 'rgba(46,232,106,.14)' : 'rgba(246,70,93,.14)'; x.fill();
    x.strokeStyle = positivo ? 'rgba(46,232,106,.45)' : 'rgba(246,70,93,.45)'; x.lineWidth = 2; x.stroke();
    x.restore();
    x.fillStyle = positivo ? '#2ee86a' : '#f6465d';
    x.fillText(txt, cx, 710);
  }

  // Tres datos
  const datos = [
    ['DÍAS ACTIVO', String(dias ?? '—')],
    ['VUELTAS', String(vueltas ?? '—')],
    ['INVERTIDO', invertido != null ? num(invertido, 2) : '—']
  ];
  const anchoCol = (W - 220) / 3;
  datos.forEach((d, i) => {
    const px = 110 + anchoCol * i + anchoCol / 2;
    x.fillStyle = '#6b7681'; x.font = '20px ui-monospace, monospace';
    x.fillText(d[0], px, 830);
    x.fillStyle = '#eaecef'; x.font = 'bold 44px system-ui, sans-serif';
    x.fillText(d[1], px, 884);
  });

  // Línea y pie
  x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(140, 940); x.lineTo(W - 140, 940); x.stroke();
  x.fillStyle = '#8b96a3'; x.font = '26px system-ui, sans-serif';
  x.fillText('cybersecureaid.github.io/bot-algoritmico', cx, 990);
  x.fillStyle = '#5f6a75'; x.font = '19px ui-monospace, monospace';
  x.fillText('Sin custodia · sin KYC · tu dinero en tu wallet', cx, 1024);

  return c;
}

/** Abre el menú de compartir del teléfono (o descarga si no lo hay). */
export async function compartirResultado(datos) {
  estilos();
  const c = tarjetaResultado(datos);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png', 0.95));
  if (!blob) return false;
  const archivo = new File([blob], 'aurex.png', { type: 'image/png' });

  const movil = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  if (movil && navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({
        files: [archivo],
        title: 'Mi bot en CriptoCuba',
        text: `${datos.par} · ${Number(datos.ganancia) >= 0 ? '+' : ''}${num(datos.ganancia, 2)} ${datos.moneda}`
      });
      return true;
    } catch (_) { return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `aurex-${(datos.par || 'bot').replace('/', '-')}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return true;
}

/* ══════════════ HISTORIAL EN EXCEL ══════════════
   Un archivo CSV que abre Excel, Google Sheets o cualquier hoja de cálculo,
   con todas las operaciones que ha cerrado el bot. */

const esc_ = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fecha_ = (seg) => seg ? new Date(seg * 1000).toLocaleString('es', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
}) : '—';

/* Explicación de cada bot, para que quien reciba el archivo lo entienda. */
const COMO_FUNCIONA = {
  grid: ['Smart Grid',
    'Reparte tu dinero en varias cuadrículas dentro de un rango de precio. Compra en cada cuadrícula cuando el precio baja hasta ella y vende cuando sube a la siguiente. Cada par compra-venta completo es una vuelta, y deja una pequeña ganancia. El bot solo vende si la ganancia cubre la comisión de red y deja beneficio.'],
  acum: ['Accumulator',
    'Compra poco a poco mientras el precio baja, y compra más cuanto más barato está. Así rebaja tu precio medio de entrada. No vende por partes: espera a que TODA tu posición esté en el porcentaje de ganancia que fijaste, y entonces vende de golpe.'],
  cash: ['Cash Out',
    'Vigila el precio y vende tu posición completa cuando alcanza el objetivo que marcaste (Take Profit). Sirve para asegurar una ganancia sin estar pendiente del mercado.'],
  dca: ['DCA',
    'Compra una cantidad fija cada cierto tiempo, sin importar el precio. Al comprar caro y barato alternadamente, tu precio medio se suaviza y reduces el riesgo de entrar todo en un mal momento.']
};

/** Descarga el historial del bot como hoja de cálculo con formato. */
export function descargarHistorial(d) {
  const ops = d.operaciones || [];
  const compras = ops.filter((o) => o.compra);
  const ventas = ops.filter((o) => !o.compra);
  const info = COMO_FUNCIONA[d.claseBot] || [d.tipo || 'Bot', ''];
  const mon = d.moneda || '', bas = d.base || '';
  const nEs = (v, dec = 8) => String(Number(v ?? 0).toFixed(dec)).replace('.', ',');

  const G = '#C9A84B', VERDE = '#0f7a3d', ROJO = '#a3243a';
  const th = `background:#12161c;color:${G};font-weight:bold;border:1px solid #2b3139;padding:6px 9px;font-size:11pt`;
  const td = 'border:1px solid #d5d9de;padding:5px 9px;font-size:11pt';

  const filaOp = (o, i) => {
    const cant = Number(o.cantidad ?? 0), pr = Number(o.precio ?? 0);
    const col = o.compra ? VERDE : ROJO;
    const fondo = o.compra ? '#eaf7ef' : '#fdeef1';
    return `<tr>
      <td style="${td};text-align:center">${i + 1}</td>
      <td style="${td};background:${fondo};color:${col};font-weight:bold">${o.compra ? 'COMPRA' : 'VENTA'}</td>
      <td style="${td};text-align:right">${nEs(pr)}</td>
      <td style="${td};text-align:right">${cant ? nEs(cant) : ''}</td>
      <td style="${td};text-align:right">${cant ? nEs(cant * pr, 4) : ''}</td>
      <td style="${td};text-align:center;color:#7d8794">${o.bloque ?? ''}</td>
    </tr>`;
  };

  // El DCA merece su propio calendario de compras.
  const bloqueDCA = (d.claseBot === 'dca' && compras.length)
    ? `<tr><td colspan="6" style="height:16px"></td></tr>
       <tr><td colspan="6" style="${th};font-size:12pt">CALENDARIO DE COMPRAS</td></tr>
       <tr>
         <td style="${th}">#</td><td style="${th}" colspan="2">Precio (${esc_(mon)})</td>
         <td style="${th}">Cantidad (${esc_(bas)})</td><td style="${th}" colspan="2">Coste (${esc_(mon)})</td>
       </tr>
       ${compras.map((o, i) => `<tr>
         <td style="${td};text-align:center">${i + 1}</td>
         <td style="${td};text-align:right" colspan="2">${nEs(o.precio)}</td>
         <td style="${td};text-align:right">${nEs(o.cantidad ?? 0)}</td>
         <td style="${td};text-align:right" colspan="2">${nEs(Number(o.cantidad ?? 0) * Number(o.precio ?? 0), 4)}</td>
       </tr>`).join('')}` : '';

  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
    <x:Name>Historial</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
    </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
    </head><body>
    <table cellspacing="0" cellpadding="0" style="font-family:Calibri,Arial,sans-serif;border-collapse:collapse">
      <colgroup><col width="55"><col width="95"><col width="150"><col width="150"><col width="150"><col width="110"></colgroup>

      <tr><td colspan="6" style="background:#0b0e11;color:${G};font-size:22pt;font-weight:bold;padding:14px 12px;letter-spacing:2px">AUREX FINANCE</td></tr>
      <tr><td colspan="6" style="background:#0b0e11;color:#8b96a3;font-size:10pt;padding:0 12px 12px">Bots de trading en tu propia wallet · sin custodia</td></tr>
      <tr><td colspan="6" style="height:10px"></td></tr>

      <tr><td colspan="6" style="${th};font-size:14pt">HISTORIAL DEL BOT</td></tr>
      <tr><td style="${td};font-weight:bold" colspan="2">Par</td><td style="${td}" colspan="4">${esc_(d.par)}</td></tr>
      <tr><td style="${td};font-weight:bold" colspan="2">Tipo de bot</td><td style="${td}" colspan="4">${esc_(info[0])}</td></tr>
      <tr><td style="${td};font-weight:bold" colspan="2">Bot creado el</td><td style="${td}" colspan="4">${fecha_(d.creado)}</td></tr>
      <tr><td style="${td};font-weight:bold" colspan="2">Informe generado</td><td style="${td}" colspan="4">${new Date().toLocaleString('es')}</td></tr>
      <tr><td style="${td};font-weight:bold" colspan="2">Operaciones cerradas</td><td style="${td}" colspan="4">${ops.length}  (${compras.length} compras · ${ventas.length} ventas)</td></tr>
      <tr><td style="${td};font-weight:bold" colspan="2">Vueltas completas</td><td style="${td}" colspan="4">${d.ciclos ?? 0}</td></tr>
      <tr><td style="${td};font-weight:bold" colspan="2">Invertido</td><td style="${td}" colspan="4">${nEs(d.invertido, 2)} ${esc_(mon)}</td></tr>
      <tr><td style="${td};font-weight:bold" colspan="2">Resultado</td><td style="${td};color:${Number(d.ganancia) >= 0 ? VERDE : ROJO};font-weight:bold" colspan="4">${Number(d.ganancia) >= 0 ? '+' : ''}${nEs(d.ganancia, 2)} ${esc_(mon)}</td></tr>

      <tr><td colspan="6" style="height:14px"></td></tr>
      <tr><td colspan="6" style="${th};font-size:12pt">CÓMO FUNCIONA ESTE BOT</td></tr>
      <tr><td colspan="6" style="${td};background:#f7f8fa;color:#333">${esc_(info[1])}</td></tr>

      <tr><td colspan="6" style="height:14px"></td></tr>
      <tr><td colspan="6" style="${th};font-size:12pt">OPERACIONES CONCLUIDAS</td></tr>
      <tr>
        <td style="${th};text-align:center">#</td>
        <td style="${th}">Tipo</td>
        <td style="${th};text-align:right">Precio (${esc_(mon)})</td>
        <td style="${th};text-align:right">Cantidad (${esc_(bas)})</td>
        <td style="${th};text-align:right">Total (${esc_(mon)})</td>
        <td style="${th};text-align:center">Bloque</td>
      </tr>
      ${ops.length
        ? ops.map(filaOp).join('')
        : `<tr><td colspan="6" style="${td};background:#fff8e6;color:#8a6d1f;text-align:center">Este bot todavía no ha cerrado ninguna operación.<br>En cuanto el precio alcance una de tus cuadrículas, aparecerá aquí.</td></tr>`}
      ${bloqueDCA}

      <tr><td colspan="6" style="height:18px"></td></tr>
      <tr><td colspan="6" style="color:#8b96a3;font-size:9pt;padding:8px 10px;border-top:1px solid #d5d9de">Datos leídos directamente de la blockchain (BNB Smart Chain). CriptoCuba no custodia fondos.<br>cybersecureaid.github.io/bot-algoritmico</td></tr>
    </table></body></html>`;

  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `aurex-${String(d.par || 'bot').replace('/', '-')}-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return ops.length;
}

/** Aviso antes de descargar, para que nadie se sorprenda. */
export function avisoHistorial(alAceptar) {
  estilos();
  const d = document.createElement('div');
  d.id = 'hist-av';
  d.innerHTML = `<div class="ha-bg"></div>
    <div class="ha-c">
      <div class="ha-t">Descargar tu historial</div>
      <div class="ha-s">Se guarda una hoja de cálculo con <b>todas las operaciones que el bot ha cerrado</b>: compras, ventas, precios y cantidades.<br><br>Si aún no ha cerrado ninguna, el archivo se descargará vacío, indicándolo.</div>
      <div class="ha-acts"><button class="ha-b gris" data-no>Volver</button><button class="ha-b" data-si>Descargar</button></div>
    </div>`;
  document.body.appendChild(d);
  const cerrar = () => d.remove();
  d.querySelector('.ha-bg').onclick = cerrar;
  d.querySelector('[data-no]').onclick = cerrar;
  d.querySelector('[data-si]').onclick = () => { cerrar(); alAceptar(); };
}

/* ══════════════ 3) NÚMEROS QUE SUBEN CONTANDO ══════════════ */
export function contar(el, hasta, { dec = 2, ms = 900, prefijo = '', sufijo = '' } = {}) {
  if (!el) return;
  const fin = Number(hasta);
  if (!isFinite(fin)) return;
  const ini = Number(String(el.textContent || '').replace(/[^\d.-]/g, '')) || 0;
  if (Math.abs(fin - ini) < Math.pow(10, -dec)) return;
  const t0 = performance.now();
  const suave = (t) => 1 - Math.pow(1 - t, 3);
  const paso = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const v = ini + (fin - ini) * suave(k);
    el.textContent = prefijo + num(v, dec) + sufijo;
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

/** Anima todos los elementos con data-contar cuando aparecen en pantalla. */
export function animarVisibles(raiz) {
  const els = [...(raiz || document).querySelectorAll('[data-contar]')].filter((e) => !e.dataset.hecho);
  if (els.length === 0) return;
  const io = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      const el = e.target; el.dataset.hecho = '1';
      contar(el, el.dataset.contar, {
        dec: Number(el.dataset.dec ?? 2),
        prefijo: el.dataset.prefijo || '',
        sufijo: el.dataset.sufijo || ''
      });
      io.unobserve(el);
    }
  }, { threshold: 0.4 });
  els.forEach((e) => io.observe(e));
}

/* ── Estilos ── */
function estilos() {
  if ($('extras-css')) return;
  const s = document.createElement('style'); s.id = 'extras-css';
  s.textContent = `
  #colmena-app .c-loteria.listo{color:var(--gold)}
  #inst-panel{position:fixed;inset:0;z-index:9700}
  #inst-panel .ip-bg{position:absolute;inset:0}
  #inst-panel .ip-c{position:absolute;width:288px;max-width:calc(100vw - 20px);background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:16px;padding:16px;box-shadow:0 22px 60px rgba(0,0,0,.75);animation:ipIn .16s ease both}
  @keyframes ipIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
  #inst-panel .ip-top{display:flex;align-items:center;gap:11px;margin-bottom:14px}
  #inst-panel .ip-ico{width:44px;height:44px;border-radius:12px;flex:0 0 auto;background:#0b0e11}
  #inst-panel .ip-top b{display:block;font-family:var(--display,sans-serif);font-weight:800;font-size:16px;color:#eaecef}
  #inst-panel .ip-top span{display:block;font-family:var(--sans,sans-serif);font-size:11.5px;color:#7d8794;margin-top:1px}
  #inst-panel .ip-b{width:100%;padding:13px;border-radius:12px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;font-family:var(--display,sans-serif);font-weight:800;font-size:14.5px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a;min-height:46px}
  #inst-panel .ip-b:active{transform:translateY(3px);box-shadow:0 1px 0 #8f6a1a}
  #inst-panel .ip-b:disabled{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:#7d8794;box-shadow:none;font-size:11.5px;cursor:default}
  #inst-panel .ip-n{font-family:var(--sans,sans-serif);font-size:11.5px;color:#7d8794;line-height:1.5;margin-top:10px;text-align:center}
  #inst-panel .ip-pasos{display:flex;flex-direction:column;gap:9px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08)}
  #inst-panel .ip-p{display:flex;align-items:flex-start;gap:9px;font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6;line-height:1.5;text-align:left}
  #inst-panel .ip-p b{color:var(--gold,#E8B84B)}
  #inst-panel .ip-p span{flex:0 0 auto;margin-top:1px;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800;font-family:var(--display,sans-serif);font-weight:800;font-size:11px}
  #inst-panel .ip-sep{height:1px;background:rgba(255,255,255,.08);margin:14px 0 10px}
  #inst-panel .ip-b.sec{margin-top:9px;background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:var(--gold,#E8B84B);box-shadow:0 3px 0 rgba(0,0,0,.4);font-size:13px}
  #inst-panel .ip-b.sec:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.4)}
  /* El panel nunca se sale de la pantalla: si no cabe, se desplaza */
  #inst-panel .ip-c{max-height:calc(100vh - 90px);overflow-y:auto}
  #inst-panel .ip-qr{background:#fff;border-radius:12px;padding:9px;margin-top:10px}
  #inst-panel .ip-qr svg{width:100%;height:auto;display:block}
  #inst-panel .ip-nqr{color:#333;font-size:9.5px;word-break:break-all;padding:8px}
  .btn-compartir{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 15px;border-radius:11px;border:1px solid #3a424c;background:linear-gradient(180deg,#1b2027,#0d1117);color:var(--gold,#E8B84B);font-family:var(--display,sans-serif);font-weight:700;font-size:12.5px;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.4);min-height:40px}
  .btn-compartir:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.4)}
  #inst-guia{position:fixed;inset:0;z-index:9860;display:flex;align-items:center;justify-content:center;padding:18px}
  #inst-guia .gi-bg{position:absolute;inset:0;background:rgba(3,5,8,.88);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
  #inst-guia .gi-c{position:relative;width:100%;max-width:480px;max-height:calc(100vh - 40px);overflow-y:auto;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:20px;padding:26px 22px 22px;box-shadow:0 30px 90px rgba(0,0,0,.8)}
  #inst-guia .gi-x{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;line-height:1;background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#b7bdc6;cursor:pointer;font-size:14px;padding:0}
  #inst-guia .gi-x:hover{color:#eaecef;border-color:var(--gold-soft,#C9A84B)}
  #inst-guia .gi-t{font-family:var(--display,sans-serif);font-weight:800;font-size:21px;color:var(--gold,#E8B84B);padding-right:40px}
  #inst-guia .gi-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;margin:6px 0 18px}
  #inst-guia .gi-s b{color:#eaecef}
  #inst-guia .gi-paso{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}
  #inst-guia .gi-num{flex:0 0 auto;width:27px;height:27px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 55%,#c79426);color:#3a2800;font-family:var(--display,sans-serif);font-weight:800;font-size:13px}
  #inst-guia .gi-txt b{display:block;font-family:var(--display,sans-serif);font-weight:800;font-size:14.5px;color:#eaecef;line-height:1.35}
  #inst-guia .gi-txt span{display:block;font-family:var(--sans,sans-serif);font-size:12.5px;color:#8b96a3;line-height:1.55;margin-top:3px}
  #inst-guia .gi-txt span b{display:inline;font-size:12.5px;color:var(--gold-soft,#C9A84B)}
  #inst-guia .gi-svg{width:100%;height:auto;display:block;margin:2px 0 18px;border-radius:10px}
  #inst-guia .gi-nota{margin-top:6px;padding:11px 13px;border-radius:11px;background:rgba(255,255,255,.03);border:1px dashed #3a424c;font-family:var(--sans,sans-serif);font-size:11.5px;color:#7d8794;line-height:1.5;text-align:center}
  #inst-pre{position:fixed;inset:0;z-index:9870;display:flex;align-items:center;justify-content:center;padding:18px}
  #inst-pre .pi-bg{position:absolute;inset:0;background:rgba(3,5,8,.88);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px)}
  #inst-pre .pi-c{position:relative;width:100%;max-width:360px;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:22px;padding:28px 22px 20px;box-shadow:0 30px 90px rgba(0,0,0,.82);text-align:center}
  #inst-pre .pi-ico{width:92px;height:92px;object-fit:contain;filter:drop-shadow(0 8px 22px rgba(232,184,75,.28))}
  #inst-pre .pi-t{font-family:var(--display,sans-serif);font-weight:800;font-size:23px;color:var(--gold,#E8B84B);margin-top:12px}
  #inst-pre .pi-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.55;margin:8px 0 16px}
  #inst-pre .pi-vent{display:flex;flex-direction:column;gap:7px;text-align:left;margin-bottom:18px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid #2b3139}
  #inst-pre .pi-vent span{font-family:var(--sans,sans-serif);font-size:12.5px;color:#b7bdc6}
  #inst-pre .pi-acts{display:flex;gap:9px}
  #inst-pre .pi-b{flex:1;padding:13px;border-radius:12px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;font-family:var(--display,sans-serif);font-weight:800;font-size:14.5px;cursor:pointer;box-shadow:0 4px 0 #8f6a1a;min-height:47px}
  #inst-pre .pi-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:#b7bdc6;box-shadow:0 3px 0 rgba(0,0,0,.4)}
  #inst-pre .pi-b:active{transform:translateY(2px)}
  #inst-pre .pi-n{font-family:var(--mono,monospace);font-size:10px;color:#6b7681;margin-top:12px}
  #cop-av{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9950;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);color:#eaecef;font-family:var(--sans,sans-serif);font-size:13px;padding:12px 18px;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.7)}
  #hist-av{position:fixed;inset:0;z-index:9850;display:flex;align-items:center;justify-content:center;padding:18px}
  #hist-av .ha-bg{position:absolute;inset:0;background:rgba(3,5,8,.84);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px)}
  #hist-av .ha-c{position:relative;width:100%;max-width:380px;background:linear-gradient(180deg,#161b22,#0b0e12);border:1px solid var(--gold-soft,#C9A84B);border-radius:18px;padding:22px}
  #hist-av .ha-t{font-family:var(--display,sans-serif);font-weight:800;font-size:19px;color:var(--gold,#E8B84B);text-align:center}
  #hist-av .ha-s{font-family:var(--sans,sans-serif);font-size:13px;color:#8b96a3;line-height:1.6;margin:10px 0 18px}
  #hist-av .ha-s b{color:#eaecef}
  #hist-av .ha-acts{display:flex;gap:9px}
  #hist-av .ha-b{flex:1;padding:13px;border-radius:11px;border:1px solid #c79426;background:linear-gradient(180deg,#f7db8d,var(--gold,#E8B84B) 45%,#c79426);color:#3a2800;font-family:var(--display,sans-serif);font-weight:800;font-size:13.5px;cursor:pointer;box-shadow:0 3px 0 #8f6a1a;min-height:46px}
  #hist-av .ha-b.gris{background:linear-gradient(180deg,#1b2027,#0d1117);border-color:#3a424c;color:#b7bdc6;box-shadow:0 3px 0 rgba(0,0,0,.4)}`;
  document.head.appendChild(s);
}
