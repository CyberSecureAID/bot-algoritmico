// orden.js — Poner órdenes desde el gráfico
//
// QUÉ HACE
//
// El usuario hace clic derecho (o mantiene pulsado en el móvil) en
// cualquier punto del gráfico y pone una orden a ese precio exacto.
//
//   · Por ENCIMA del precio actual → vender (roja)
//   · Por DEBAJO del precio actual → comprar (verde)
//
// DOS FORMAS DE OPERAR, a elección del usuario:
//
//   ORDEN REAL   — se crea en el contrato con un solo nivel. El
//                  keeper la vigila y la ejecuta sola al llegar el
//                  precio. Consume gas, pero no hay que estar
//                  delante.
//
//   AVISO        — se guarda en el navegador y avisa cuando el
//                  precio llega. No cuesta gas, pero hay que
//                  confirmar a mano.
//
// NO HACE FALTA TOCAR EL CONTRATO
//
// `crearRejilla` con un solo nivel ES una orden limit: espera un
// precio, ejecuta y el keeper la vigila. Se reutiliza lo que ya
// está desplegado y probado, sin riesgo de actualizar el proxy.

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CLAVE_AVISOS = 'cco-ordenes-aviso';
/* Órdenes REALES puestas desde el gráfico. Antes vivían solo en memoria
   (_puestas), así que la marca desaparecía al cambiar de moneda o
   recargar, aunque el bot siguiera vivo en el contrato. Ahora se guardan
   aquí, igual que los avisos, y se vuelven a pintar al reentrar al activo. */
const CLAVE_ORDENES = 'cco-ordenes-grafico';

/* ══════════════════════════════════════════════════════════════
   EQUIVALENCIAS DE SÍMBOLO

   El gráfico usa los nombres de Binance (BTC, ETH…), pero en BNB
   Chain algunos tokens se llaman distinto: Bitcoin es BTCB,
   Ethereum es ETH envuelto, y así.

   Esto es GENÉRICO: una sola tabla para todas las monedas y todas
   las secciones. No hay nada escrito a medida de ninguna.
   ══════════════════════════════════════════════════════════════ */
const EQUIV = {
  BTC: 'BTCB',        // Bitcoin en BNB Chain es BTCB
  WBTC: 'BTCB',
  WETH: 'ETH',
  WBNB: 'BNB',
  MATIC: 'MATIC',
  POL: 'MATIC'
};

/** Busca la moneda en tokens.js, probando todas las variantes. */
function buscarMoneda(MONEDAS, simb) {
  if (!simb) return null;
  const s = String(simb).toUpperCase();
  /* 1. Tal cual. 2. Por su equivalente en BNB Chain. 3. Por el
     campo `simbolo`, que puede no coincidir con la clave. */
  return MONEDAS[s]
      || (EQUIV[s] && MONEDAS[EQUIV[s]])
      || Object.values(MONEDAS).find((m) => String(m.simbolo).toUpperCase() === s)
      || Object.values(MONEDAS).find((m) => String(m.simbolo).toUpperCase() === EQUIV[s])
      || null;
}

let _tr = null;
try { import('./idioma.js?v=127').then((m) => { _tr = m; }).catch(() => {}); } catch (_) {}
const T = (t) => { try { return _tr ? _tr.t(t) : t; } catch (_) { return t; } };

const fmt = (p) => {
  if (!(p > 0)) return '—';
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.01) return p.toFixed(6);
  return p.toFixed(8);
};

/* ══════════════════════════════════════════════════════════════
   ENGANCHAR UN GRÁFICO

   Se llama desde cada herramienta pasándole su lienzo y una
   función que traduzca la posición del ratón a un precio.

     conectar({
       canvas,                  // el lienzo del gráfico
       precioEn: (y) => precio, // qué precio hay a esa altura
       precioActual: () => n,   // el precio de mercado ahora
       par: () => 'BTC',        // qué se está mirando
       simbolo: () => 'BTCUSDT'
     })
   ══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   LO QUE HAY PUESTO

   Se junta todo —órdenes y alertas— para que las tres herramientas
   lo pinten igual. Las alertas se leen del almacenamiento, así
   sobreviven a recargar la página.
   ══════════════════════════════════════════════════════════════ */
const _puestas = [];
let _ultimoBotId = 0;                 // de la última orden creada
let _ultimoPar = { base: '', quote: '' };

/* ── Persistencia de las órdenes del gráfico ── */
function leerOrdenesGuardadas() {
  try { return JSON.parse(localStorage.getItem(CLAVE_ORDENES) || '[]'); } catch (_) { return []; }
}
function guardarOrdenGrafico(o) {
  try {
    const l = leerOrdenesGuardadas().filter((x) => x.id !== o.id);
    l.push(o);
    localStorage.setItem(CLAVE_ORDENES, JSON.stringify(l.slice(-60)));
  } catch (_) {}
}
function quitarOrdenGrafico(id) {
  try {
    localStorage.setItem(CLAVE_ORDENES, JSON.stringify(leerOrdenesGuardadas().filter((x) => x.id !== id)));
  } catch (_) {}
}
/* Al cargar el módulo se recuperan las órdenes reales guardadas para que
   se vuelvan a pintar en cuanto se abra su gráfico. */
leerOrdenesGuardadas().forEach((o) => {
  if (!_puestas.some((p) => p.id === o.id)) _puestas.push(o);
});

export function ordenesPuestas() {
  // Se lee SIEMPRE del almacenamiento (no de la lista en memoria): así el
  // contador y la ventana muestran el número real aunque otro módulo haya
  // guardado órdenes en otra instancia. Antes mostraba siempre "1" por eso.
  const guardadas = leerOrdenesGuardadas();
  const idsG = new Set(guardadas.map((x) => x.id));
  const enMemoria = _puestas.filter((x) => x.modo !== 'aviso' && !idsG.has(x.id));
  const alertas = leerAvisos().map((a) => ({ ...a, modo: 'aviso' }));
  return [...guardadas.filter((x) => x.modo !== 'aviso'), ...enMemoria, ...alertas];
}

/** Cancela una alerta o una orden real por su identificador. */
export function cancelar(id) {
  quitarAviso(id);
  quitarOrdenGrafico(id);
  const i = _puestas.findIndex((x) => x.id === id);
  if (i >= 0) _puestas.splice(i, 1);
}

/** Cierra cualquier ficha abierta: al cambiar de moneda o marco. */
export function cerrarFichas() { cerrarTodo(); }

export function conectar(cfg) {
  if (!cfg || !cfg.canvas) return;
  const cv = cfg.canvas;
  if (cv.dataset.ordenLista) return;
  cv.dataset.ordenLista = '1';
  estilos();

  /* En escritorio: clic derecho */
  cv.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    abrirMenu(e.clientX, e.clientY, cfg, e);
  });

  /* En el móvil no hay clic derecho: se mantiene pulsado medio
     segundo. Si el dedo se mueve, se cancela — es que estaba
     arrastrando el gráfico. */
  let temp = null, x0 = 0, y0 = 0, movido = false;
  cv.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { clearTimeout(temp); return; }
    const t = e.touches[0];
    x0 = t.clientX; y0 = t.clientY; movido = false;
    clearTimeout(temp);
    temp = setTimeout(() => {
      if (movido) return;
      try { if (navigator.vibrate) navigator.vibrate(18); } catch (_) {}
      abrirMenu(x0, y0, cfg, null);
    }, 500);
  }, { passive: true });

  cv.addEventListener('touchmove', (e) => {
    if (!e.touches.length) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - x0) > 9 || Math.abs(t.clientY - y0) > 9) {
      movido = true; clearTimeout(temp);
    }
  }, { passive: true });

  cv.addEventListener('touchend', () => clearTimeout(temp), { passive: true });
  cv.addEventListener('touchcancel', () => clearTimeout(temp), { passive: true });

  arrancarVigilante();
  if (cfg.repintar) _repintarOrd = cfg.repintar;   // para refrescar el gráfico al completarse una orden
  arrancarVigilanteOrdenes();
}

/* ══════════════════════════════════════════════════════════════
   EL MENÚ — primer paso
   ══════════════════════════════════════════════════════════════ */
function abrirMenu(cx, cy, cfg, ev) {
  cerrarTodo();
  const cv = cfg.canvas;
  const r = cv.getBoundingClientRect();
  const y = cy - r.top;
  const precio = cfg.precioEn(y);
  const actual = cfg.precioActual();
  /* Si el gráfico aún no tiene datos, se dice en vez de no hacer
     nada: el usuario pensaba que el clic derecho estaba roto. */
  if (!(precio > 0) || !(actual > 0)) {
    const t = document.createElement('div');
    t.className = 'od-toast';
    t.innerHTML = `<span class="od-t-ic">◔</span>
      <div><b>${esc(T('Un momento'))}</b>
      <span>${esc(T('El gráfico todavía se está cargando. Inténtalo en unos segundos.'))}</span></div>
      <button type="button" class="od-t-x">✕</button>`;
    document.body.appendChild(t);
    t.querySelector('.od-t-x').onclick = () => t.remove();
    setTimeout(() => { if (t.parentNode) t.remove(); }, 4000);
    return;
  }

  /* Encima del precio actual = vender. Debajo = comprar. */
  const vender = precio > actual;
  const dist = ((precio - actual) / actual) * 100;

  const d = document.createElement('div');
  d.className = 'od-menu ' + (vender ? 'vender' : 'comprar');
  d.innerHTML = `
    <div class="od-m-cab">
      <span class="od-m-ic">${vender ? '▼' : '▲'}</span>
      <div class="od-m-tx">
        <b>${esc(T(vender ? 'Vender aquí' : 'Comprar aquí'))}</b>
        <span>${fmt(precio)}</span>
      </div>
      <!-- El porcentaje es lo que el usuario busca al hacer clic:
           va grande y arriba a la derecha. -->
      <div class="od-m-pct">
        <b>${dist >= 0 ? '+' : ''}${dist.toFixed(1)}%</b>
        <span>${esc(T(vender ? 'Ganancia' : 'Descuento'))}</span>
      </div>
    </div>
    <div class="od-m-acc">
      <button class="od-m-b" type="button">${esc(T('Establecer posición'))}</button>
      <button class="od-m-alert" type="button" title="${esc(T('Pon una alerta de precio en este nivel'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg><span>${esc(T('Alerta'))}</span></button>
    </div>`;
  document.body.appendChild(d);
  colocar(d, cx, cy);

  d.querySelector('.od-m-b').onclick = (e) => {
    e.stopPropagation();
    d.remove();
    abrirFicha(cx, cy, cfg, precio, vender);
  };
  /* Alerta de precio en UN clic: crea el MISMO aviso que la ficha en modo
     "Solo avisarme" (sin pasos ni gas). El vigilante que ya está en marcha
     lo recoge y pintar() lo dibuja en dorado sobre el mapa. Real, no
     provisional. El contrato/Cloudflare no interviene en una alerta. */
  d.querySelector('.od-m-alert').onclick = (e) => {
    e.stopPropagation();
    guardarAviso({
      par: cfg.par ? cfg.par() : '',
      simbolo: cfg.simbolo ? cfg.simbolo() : '',
      precio, cant: 0, vender, sl: 0, cuando: Date.now()
    });
    d.remove();
    if (cfg.repintar) cfg.repintar();
    toastAlerta(vender, precio);
  };
  d.addEventListener('click', (e) => e.stopPropagation());
  setTimeout(() => document.addEventListener('click', cerrarTodo, { once: true }), 10);
}

/* ══════════════════════════════════════════════════════════════
   LA FICHA — cantidad, modo y confirmación
   ══════════════════════════════════════════════════════════════ */
function abrirFicha(cx, cy, cfg, precio, vender) {
  cerrarTodo();
  const par = cfg.par ? cfg.par() : '';
  const actual = cfg.precioActual();
  const dist = ((precio - actual) / actual) * 100;

  const d = document.createElement('div');
  d.className = 'od-ficha ' + (vender ? 'vender' : 'comprar');
  d.innerHTML = `
    <button class="od-x" type="button" aria-label="Cerrar">✕</button>

    <div class="od-cab">
      <span class="od-ic">${vender ? '▼' : '▲'}</span>
      <div class="od-tit">
        <b>${esc(T(vender ? 'Orden de venta' : 'Orden de compra'))}</b>
        <span>${esc(par)} · ${fmt(precio)}</span>
      </div>

      <!-- El porcentaje es el dato que decide: va grande y en verde,
           porque tanto el descuento al comprar como la ganancia al
           vender son buenas noticias. -->
      <div class="od-pct-grande">
        <b>${dist >= 0 ? '+' : ''}${dist.toFixed(1)}%</b>
        <span>${esc(T(vender ? 'De ganancia' : 'De descuento'))}</span>
      </div>
    </div>

    <div class="od-dist">
      ${esc(T('Precio ahora'))}: ${fmt(actual)}
      <span class="od-saldo">${esc(T('Leyendo tu saldo…'))}</span>
    </div>

    <!-- Cuánto -->
    <div class="od-campo od-cantidad">
      <label>${esc(T(vender ? 'Cantidad a vender' : 'Cantidad a comprar'))}</label>
      <div class="od-inp-fila">
        <input class="od-inp" id="od-cant" type="text" inputmode="decimal"
               placeholder="0.00" autocomplete="off">
        <span class="od-unidad">${esc(vender ? par : 'USDT')}</span>
      </div>
      <input class="od-rango" id="od-rango" type="range" min="0" max="100" value="0" step="1">
      <div class="od-pcts">
        ${[25, 50, 75, 100].map((p) => `<button class="od-pct" type="button" data-pct="${p}">${p}%</button>`).join('')}
      </div>
    </div>

    <!-- Cómo se ejecuta -->
    <div class="od-campo">
      <label>${esc(T('Cómo quieres que funcione'))}</label>
      <div class="od-modos">
        <button class="od-modo on" type="button" data-modo="real">
          <b>${esc(T('Orden automática'))}</b>
          <span>${esc(T('Se ejecuta sola al llegar el precio. Consume gas.'))}</span>
        </button>
        <button class="od-modo" type="button" data-modo="aviso">
          <b>${esc(T('Solo avisarme'))}</b>
          <span>${esc(T('Te avisa y confirmas tú. No cuesta gas.'))}</span>
        </button>
      </div>
    </div>

    <!-- Protección: solo tiene sentido al comprar. Si vendes, ya
         estás saliendo: no hay nada que proteger. -->
    ${!vender ? `<div class="od-campo od-opcional">
      <button class="od-toggle" id="od-sl-t" type="button">
        <span>${esc(T('Añadir stop'))} <em>(${esc(T('opcional'))})</em></span>
        <i class="od-fl">▾</i>
      </button>
      <div class="od-sl" id="od-sl">
        <div class="od-inp-fila">
          <input class="od-inp" id="od-slp" type="text" inputmode="decimal"
                 placeholder="${fmt(vender ? precio * 1.03 : precio * 0.97)}" autocomplete="off">
          <span class="od-unidad">USDT</span>
        </div>
        <div class="od-nota">${esc(T('Opcional. Si tras comprar el precio cae hasta aquí, se vende para limitar la pérdida.'))}</div>
      </div>
    </div>` : ''}

    <div class="od-resumen" id="od-res"></div>

    <button class="od-confirmar" id="od-ok" type="button" disabled>
      ${esc(T(vender ? 'Poner orden de venta' : 'Poner orden de compra'))}
    </button>
    <div class="od-aviso">${esc(T('Opera bajo tu propio riesgo. Nada garantiza que el precio llegue.'))}</div>`;

  document.body.appendChild(d);
  colocar(d, cx, cy, true);
  d.addEventListener('click', (e) => e.stopPropagation());

  /* Si la ficha crece (al escribir aparece el resumen), se recoloca
     para que el botón nunca quede fuera de la pantalla. */
  try {
    const vigilante = new ResizeObserver(() => colocar(d, cx, cy, true));
    vigilante.observe(d);
    d._obs = vigilante;
  } catch (_) {}

  const inp = $('od-cant'), rango = $('od-rango'), ok = $('od-ok'), res = $('od-res');

  /* Cifras legibles: nunca por encima del saldo y con los decimales
     justos. Antes salían ocho decimales y cantidades imposibles. */
  function recorta(v) {
    const x = saldo > 0 ? Math.min(v, saldo) : v;
    if (x >= 1000) return x.toFixed(2);
    if (x >= 1) return x.toFixed(4);
    if (x >= 0.0001) return x.toFixed(6);
    return x.toFixed(8);
  }
  let modo = 'real';
  let saldo = 0;
  let _tokens = null;

  /* ══════════════════════════════════════════════════════════
     EL SALDO REAL

     Se lee de la wallet a través de `tokens.js`, que ya tiene el
     mapa de direcciones y decimales de las 31 monedas.

     Para vender hace falta la moneda; para comprar, USDT. Si no
     hay saldo, se dice claramente en vez de dejar la ficha muerta.
     ══════════════════════════════════════════════════════════ */
  (async () => {
    try {
      const tk = await import('./tokens.js?v=125');
      const gb = await import('./gridbot.js?v=125');
      const w = await import('./wallet.js?v=125');
      /* [CORREGIDO] Se llamaba a `w.cuenta()`, que no existe: la
         función es `cuentaActual()`. Por eso siempre decía que la
         wallet estaba desconectada aunque estuviera conectada. */
      /* Primero el estado del módulo; si aún no se ha poblado, se
         pregunta directamente al proveedor. Así no se dice "conecta
         tu wallet" a alguien que la tiene conectada. */
      let cuenta = (w.cuentaActual && w.cuentaActual()) || null;
      if (!cuenta && window.ethereum) {
        try {
          const cs = await window.ethereum.request({ method: 'eth_accounts' });
          if (cs && cs.length) cuenta = cs[0];
        } catch (_) {}
      }

      const simb = vender ? par : 'USDT';
      const mon = buscarMoneda(tk.MONEDAS, simb);
      _tokens = { mon, monQuote: tk.MONEDAS.USDT };

      if (!cuenta) { sinSaldo(T('Conecta tu wallet para poder operar.')); return; }
      /* [CORREGIDO] BNB tiene `address: null` porque es la moneda
         NATIVA de la red, no un token. Exigir dirección hacía que
         fallara justo con la moneda principal. `saldoParaMostrar`
         ya distingue entre nativa y token. */
      if (!mon) {
        sinSaldo(T('Esta moneda no se puede operar todavía desde aquí.'));
        return;
      }

      /* [CORREGIDO] Dos fallos aquí:
         1. `esBNB()` compara con la dirección de WBNB, así que
            pasarle null hacía que intentara leer un token
            inexistente y reventaba.
         2. El saldo viene en wei (BigInt). Hacer Number() directo
            daba cifras astronómicas con decimales infinitos.
         Ahora se pasa WBNB para la nativa y se convierte bien. */
      const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
      const dir = mon.address || WBNB;
      const bruto = await gb.saldoParaMostrar(dir, cuenta);
      const dec = mon.decimals ?? 18;
      saldo = Number(bruto) / Math.pow(10, dec);
      if (!isFinite(saldo)) saldo = 0;

      if (!(saldo > 0)) {
        sinSaldo(vender
          ? `${T('No tienes')} ${par} ${T('en tu wallet, así que no hay nada que vender. Primero tendrías que comprarlo.')}`
          : `${T('No tienes USDT en BNB Chain. Necesitas USDT para poder comprar.')}`);
        return;
      }

      const et = d.querySelector('.od-saldo');
      if (et) et.innerHTML = `${esc(T('Disponible'))}: <b>${recorta(saldo)} ${esc(simb)}</b>`;
    } catch (er) {
      /* [CORREGIDO] Si falla la LECTURA del saldo se bloqueaba el
         botón para siempre, aunque el usuario tuviera fondos de
         sobra. No poder leer no es lo mismo que no tener: se avisa
         pero se deja continuar. El contrato validará al firmar. */
      const et = d.querySelector('.od-saldo');
      if (et) {
        et.className = 'od-saldo alerta';
        et.textContent = T('No hemos podido leer tu saldo ahora mismo. Puedes continuar: se comprobará al firmar.');
      }
      console.warn('[CCO] saldo:', er);
    }
  })();

  /** Cuando no hay con qué operar, se dice y se bloquea. */
  function sinSaldo(motivo) {
    const et = d.querySelector('.od-saldo');
    if (et) { et.className = 'od-saldo alerta'; et.textContent = motivo; }
    ok.disabled = true;
    ok.classList.add('bloqueado');
  }

  const refrescar = () => {
    let cant = parseFloat(String(inp.value).replace(',', '.')) || 0;
    /* Nunca por encima de lo que hay: evita firmas que van a fallar */
    if (saldo > 0 && cant > saldo) { cant = saldo; inp.value = recorta(saldo); }
    /* Un aviso no mueve dinero: no hace falta saldo ni cantidad. */
    /* Bloqueado solo si de verdad no hay saldo (0 confirmado), no
       cuando simplemente no se ha podido leer. */
    ok.disabled = modo === 'aviso' ? false : (!(cant > 0) || ok.classList.contains('bloqueado'));
    if (modo === 'aviso') {
      res.innerHTML = `
        <div class="od-r-fila"><span>${esc(T('Te avisaremos cuando'))} ${esc(par)}</span><b>${
          esc(T(vender ? 'suba a' : 'baje a'))} ${fmt(precio)}</b></div>
        <div class="od-r-fila"><span>${esc(T('Desde el precio actual'))}</span><b>${
          dist >= 0 ? '+' : ''}${dist.toFixed(2)}%</b></div>`;
      res.classList.add('lleno');
      return;
    }
    if (cant > 0) {
      const total = vender ? cant * precio : cant / precio;
      res.innerHTML = `
        <div class="od-r-fila"><span>${esc(T('Precio de la orden'))}</span><b>${fmt(precio)}</b></div>
        <div class="od-r-fila"><span>${esc(T(vender ? 'Recibirás' : 'Comprarás'))}</span><b>${
          vender ? fmt(total) + ' USDT' : total.toFixed(6) + ' ' + esc(par)}</b></div>
        <div class="od-r-fila"><span>${esc(T('Se ejecuta'))}</span><b>${
          esc(T(modo === 'real' ? 'automáticamente' : 'con tu confirmación'))}</b></div>`;
      res.classList.add('lleno');
    } else { res.innerHTML = ''; res.classList.remove('lleno'); }
  };

  inp.addEventListener('input', () => {
    // Solo números y un punto decimal
    inp.value = inp.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    refrescar();
  });
  rango.addEventListener('input', () => {
    if (saldo > 0) { inp.value = recorta(saldo * (rango.value / 100)); refrescar(); }
  });


  d.querySelectorAll('[data-pct]').forEach((b) => b.onclick = () => {
    rango.value = b.dataset.pct;
    if (saldo > 0) { inp.value = recorta(saldo * (b.dataset.pct / 100)); refrescar(); }
    else { /* Sin saldo leído, el porcentaje no puede calcularse */ }
    d.querySelectorAll('[data-pct]').forEach((x) => x.classList.toggle('on', x === b));
  });
  d.querySelectorAll('[data-modo]').forEach((b) => b.onclick = () => {
    modo = b.dataset.modo;
    d.querySelectorAll('[data-modo]').forEach((x) => x.classList.toggle('on', x === b));
    /* El botón dice lo que va a pasar: no es lo mismo poner una
       orden que activar un aviso. */
    ok.textContent = modo === 'aviso'
      ? T('Activar aviso')
      : T(vender ? 'Poner orden de venta' : 'Poner orden de compra');
    ok.classList.toggle('aviso', modo === 'aviso');
    /* Un aviso no mueve dinero: sobra la cantidad y el stop. La
       ficha se encoge y deja solo lo que importa. */
    d.classList.toggle('solo-aviso', modo === 'aviso');
    refrescar();
  });
  /* [CORREGIDO] En las ventas no hay bloque de stop, así que esta
     línea lanzaba un error que dejaba la X sin enganchar. Por eso
     la X funcionaba al comprar y no al vender. */
  const slT = $('od-sl-t');
  if (slT) slT.onclick = () => {
    const c = d.querySelector('.od-opcional');
    if (c) c.classList.toggle('abierto');
  };
  /* [CORREGIDO] La X no cerraba porque el clic se paraba antes de
     llegar. Ahora cierra su propia ficha directamente. */
  const cerrarEsta = (ev) => {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    d.remove();
  };
  const btnX = d.querySelector('.od-x');
  btnX.addEventListener('click', cerrarEsta, true);
  btnX.addEventListener('pointerdown', (ev) => ev.stopPropagation(), true);
  btnX.addEventListener('touchend', cerrarEsta, true);
  /* Y si se cambia de moneda o de marco, la ficha se va sola: no
     tiene sentido dejar una orden de BTC abierta mirando BNB. */
  d._cerrar = cerrarEsta;

  ok.onclick = async () => {
    const cant = parseFloat(String(inp.value).replace(',', '.')) || 0;
    if (modo !== 'aviso' && !(cant > 0)) return;
    const elSl = $('od-slp');
    const sl = elSl ? (parseFloat(String(elSl.value).replace(',', '.')) || 0) : 0;
    ok.disabled = true;
    try {
      if (modo === 'aviso') {
        const id = guardarAviso({
          par, simbolo: cfg.simbolo ? cfg.simbolo() : '', precio,
          cant: cant || 0, vender, sl: 0, cuando: Date.now()
        });
        if (cfg.repintar) cfg.repintar();
        exito(d, T('Aviso puesto'), T('Te avisaremos cuando el precio llegue a') + ' ' + fmt(precio));
      } else {
        /* [CORREGIDO] Los pasos se escribían dentro del botón y lo
           estiraban hasta deformar la ficha. Ahora van en su propia
           ventana, que además explica qué está pasando. */
        abrirPasos(vender);
        await ponerOrdenReal({
          cfg, precio, cant, vender, sl,
          alPaso: (t) => pintarPaso(t)
        });
        cerrarPasos();
        exito(d, T('Orden puesta'), T('Se ejecutará sola cuando el precio llegue a') + ' ' + fmt(precio));
      }
      /* Se guarda para pintarla en el gráfico con su propia marca,
         distinta de las señales del asistente. */
      const registro = {
        precio, cant, vender, modo,
        par, simbolo: cfg.simbolo ? cfg.simbolo() : '',
        botId: _ultimoBotId,          // para poder cancelarla en el contrato
        base: _ultimoPar.base, quote: _ultimoPar.quote,
        id: 'ord-' + _ultimoBotId,
        cuando: Date.now()
      };
      _puestas.push(registro);
      /* Las órdenes REALES (no los avisos) se persisten para que la marca
         no desaparezca al cambiar de moneda o recargar. El bot ya vive en
         el contrato; esto solo recuerda dónde pintarla. */
      if (modo !== 'aviso') guardarOrdenGrafico(registro);
      if (cfg.alPoner) cfg.alPoner({ precio, cant, vender, modo });
      if (cfg.repintar) cfg.repintar();
    } catch (er) {
      cerrarPasos();
      ok.disabled = false;
      ok.textContent = modo === 'aviso' ? T('Activar aviso')
        : T(vender ? 'Poner orden de venta' : 'Poner orden de compra');
      /* [CORREGIDO] Antes se tragaba el error real y salía siempre
         "no se puede poner la orden", que no dice nada. Ahora se
         traduce a lenguaje claro y, si no se reconoce, se muestra
         tal cual: es la única forma de saber qué pasa. */
      const m = String((er && (er.reason || er.shortMessage || er.message)) || er);
      console.warn('[CCO] orden:', er);
      let txt;
      if (/user rejected|denied|4001/i.test(m)) txt = T('Cancelaste la firma.');
      else if (/suscrip/i.test(m)) txt = m;
      else if (/pool/i.test(m)) txt = T('Esta moneda no tiene mercado en PancakeSwap. Prueba con otra.');
      else if (/insufficient|saldo|balance/i.test(m)) txt = T('No tienes saldo suficiente para esta orden.');
      else if (/objetivo|target/i.test(m)) txt = m;
      else if (/precio del par|no se pudo leer/i.test(m)) txt = T('No se pudo leer el precio de este par ahora mismo.');
      else if (/gas/i.test(m)) txt = T('Te falta gas. Añade BNB desde tu perfil.');
      else txt = m.slice(0, 160);
      fallo(d, txt);
    }
  };

  setTimeout(() => { try { inp.focus(); } catch (_) {} }, 80);
}

/* ══════════════════════════════════════════════════════════════
   PONER LA ORDEN EN EL CONTRATO

   Una rejilla de UN SOLO NIVEL es exactamente una orden limit: el
   keeper la vigila y la ejecuta al llegar el precio. Se reutiliza
   lo que ya está desplegado.
   ══════════════════════════════════════════════════════════════ */
async function ponerOrdenReal({ cfg, precio, cant, vender, sl, alPaso }) {
  const gb = await import('./gridbot.js?v=125');
  const tk = await import('./tokens.js?v=125');
  const w  = await import('./wallet.js?v=125');

  /* ══════════════════════════════════════════════════════════
     [REESCRITO] Antes se montaba la configuración a mano y la
     transacción fallaba siempre.

     El motivo: crear una orden en el contrato necesita CUATRO
     pasos, y solo se hacía el último.

       1. Suscripción activa
       2. Envolver BNB a WBNB si se va a vender BNB
       3. APROBAR el token — sin esto la transacción revierte
       4. Crear la orden

     Ahora se usa la misma maquinaria que los bots que ya
     funcionan: `construirConfigCashOut` para vender (que es
     literalmente una orden limit de venta) y `construirConfigDCA`
     para comprar. Nada montado a mano.
     ══════════════════════════════════════════════════════════ */
  const par = cfg.par ? cfg.par() : '';
  const base = buscarMoneda(tk.MONEDAS, par);
  const quote = tk.MONEDAS.USDT;
  if (!base) throw new Error(T('Esta moneda no se puede operar todavía desde aquí.'));

  const cuenta = (w.cuentaActual && w.cuentaActual()) || null;
  if (!cuenta) throw new Error(T('Conecta tu wallet para poder operar.'));

  const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  const dirBase = base.address || WBNB;
  const decBase = base.decimals ?? 18;
  const decQuote = quote.decimals ?? 18;
  const paso = (t) => { if (alPaso) alPaso(t); };

  /* ── 1. Suscripción y gas: sin esto la orden nace muerta ── */
  paso(T('Comprobando tu suscripción…'));
  const activo = await gb.estaActivo(cuenta).catch(() => false);
  if (!activo) {
    throw new Error(T('Necesitas la suscripción activa para poner órdenes. Actívala desde tu perfil.'));
  }
  const gas = await gb.gasSaldo(cuenta).catch(() => 0n);
  if (!gas || gas <= 0n) {
    throw new Error(T('Necesitas gas para que el bot ejecute la orden. Añádelo desde tu perfil.'));
  }

  const p = {
    base: dirBase, quote: quote.address,
    decBase, decQuote,
    slippageBps: 50
  };

  if (vender) {
    /* ── VENDER: es un Cash Out de un solo objetivo ──
       El contrato exige que el objetivo esté por encima del precio
       actual. Se comprueba antes de firmar nada. */
    const ahora = cfg.precioActual ? cfg.precioActual() : 0;
    if (ahora > 0 && precio <= ahora) {
      throw new Error(T('Para vender, el precio tiene que estar por encima del actual.'));
    }
    paso(T('Preparando la orden con el precio real…'));
    const conf = await gb.construirConfigCashOut({
      ...p,
      cantidadBase: cant,
      targetPrice: precio
    });
    conf.botId = Date.now();
    _ultimoBotId = conf.botId;
    _ultimoPar = { base: dirBase, quote: quote.address };

    /* ── 2. Si se vende BNB, hay que envolverlo primero ── */
    if (gb.esBNB(dirBase)) {
      const wb = await gb.balanceToken(dirBase, cuenta);
      const wbH = Number(gb.fmt(wb, decBase));
      if (cant > wbH + 1e-12) {
        paso(T('Convirtiendo tu BNB a WBNB… firma en tu wallet.'));
        await gb.envolverBNB(unidades(gb, (cant - wbH) * 1.001, decBase));
      }
    }

    /* ── 3. El permiso: sin esto la transacción revierte ── */
    const necesita = unidades(gb, cant * 3, decBase);
    const permiso = await gb.allowance(dirBase, cuenta);
    if (permiso < necesita) {
      paso(T('Dando permiso para vender… firma en tu wallet.'));
      await gb.aprobarToken(dirBase, necesita);
    }

    /* ── 4. Crear la orden ── */
    paso(T('Creando tu orden… firma en tu wallet.'));
    await gb.crearRejilla(conf);
  } else {
    /* ── COMPRAR: una compra programada de una sola vez ── */
    paso(T('Preparando la orden con el precio real…'));
    const conf = await gb.construirConfigDCA({
      ...p,
      montoQuote: cant,
      intervalo: 60,
      comprasMax: 1
    });
    conf.botId = Date.now();
    _ultimoBotId = conf.botId;
    _ultimoPar = { base: dirBase, quote: quote.address };
    /* CLAVE: el DCA (modo 3) compra por TIEMPO a mercado. Lo pasamos a modo 0
       (grid) con UN nivel de compra a tu precio exacto (estado 1): así el keeper
       solo entra cuando el precio BAJA a tu objetivo, nunca a mercado. */
    conf.modo = 0;
    conf.niveles = [{
      minOutCompra: unidades(gb, cant / precio, decBase),
      minOutVenta: 0n,
      estado: 1
    }];
    /* El contrato exige ordenBase > 0 para modo 0 (aunque en una compra no se
       usa). Le ponemos la base que esperas comprar, solo para pasar el requisito
       de creación; no provoca ninguna compra ni cobro al crear la orden. */
    conf.ordenBase = unidades(gb, cant / precio, decBase);
    conf.slippageBps = conf.slippageBps || 50;   // holgura para el swap, no para el disparo

    const necesita = unidades(gb, cant * 3, decQuote);
    const permiso = await gb.allowance(quote.address, cuenta);
    if (permiso < necesita) {
      paso(T('Dando permiso para usar tu USDT… firma en tu wallet.'));
      await gb.aprobarToken(quote.address, necesita);
    }

    paso(T('Creando tu orden… firma en tu wallet.'));
    await gb.crearRejilla(conf);
  }

  /* Se avisa al keeper para que empiece a vigilar el precio.
     [CORREGIDO] Antes se importaba worker.js, que no resuelve sus
     dependencias y lanzaba un error que abortaba todo justo tras
     crear la orden. Se llama directamente, como hace gridbot-ui. */
  try {
    const KEEPER = 'https://bolita-keeper-bot.yamicelanvivesqui.workers.dev';
    fetch(`${KEEPER}/registrar?u=${cuenta}`, { mode: 'cors' }).catch(() => {});
  } catch (_) {}

  /* ── Metadato local del bot, igual que hacen los bots normales ──
     Sin esto, la página de "Mis bots" no sabía el objetivo (lo lee de
     'bot-pares') y mostraba "sin fijar", aunque el objetivo SÍ está en el
     contrato. Se guarda el precio objetivo real (el del clic) y una marca
     `desdeGrafico` para poder identificarla como orden puesta desde la
     gráfica, no como un Cash Out configurado a mano. */
  try {
    const clave = gb.claveBot(cuenta, dirBase, quote.address, _ultimoBotId);
    const store = JSON.parse(localStorage.getItem('bot-pares') || '{}');
    store[clave] = {
      base: dirBase, quote: quote.address,
      targetPrice: precio,
      entry: (cfg.precioActual ? cfg.precioActual() : 0) || 0,
      tipo: vender ? 'cash' : 'dca',
      desdeGrafico: true,
      creadoLocal: Date.now(),
      botId: _ultimoBotId
    };
    localStorage.setItem('bot-pares', JSON.stringify(store));
    const cer = JSON.parse(localStorage.getItem('bot-cerradas') || '{}');
    delete cer[clave]; localStorage.setItem('bot-cerradas', JSON.stringify(cer));
  } catch (_) {}
}

/** Pasa una cantidad humana a las unidades del token. */
function unidades(gb, valor, dec) {
  try {
    if (gb.aBI) return gb.aBI(valor, dec);
  } catch (_) {}
  const s = Number(valor).toFixed(Math.min(dec, 18));
  const [ent, frac = ''] = s.split('.');
  const rell = (frac + '0'.repeat(dec)).slice(0, dec);
  return BigInt(ent + rell);
}

/* ══════════════════════════════════════════════════════════════
   LOS AVISOS — sin gas, se guardan en el navegador
   ══════════════════════════════════════════════════════════════ */
function leerAvisos() {
  try { return JSON.parse(localStorage.getItem(CLAVE_AVISOS) || '[]'); } catch (_) { return []; }
}
function guardarAviso(a) {
  try {
    const l = leerAvisos();
    const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    l.push({ ...a, id });
    localStorage.setItem(CLAVE_AVISOS, JSON.stringify(l.slice(-40)));
    return id;
  } catch (_) { return null; }
}
export function quitarAviso(id) {
  try {
    localStorage.setItem(CLAVE_AVISOS, JSON.stringify(leerAvisos().filter((x) => x.id !== id)));
  } catch (_) {}
}
export const avisos = () => leerAvisos();

/** ¿Se puede operar esta moneda desde el gráfico? */
export async function sePuedeOperar(simb) {
  try {
    const tk = await import('./tokens.js?v=125');
    return !!buscarMoneda(tk.MONEDAS, simb);
  } catch (_) { return false; }
}

/** Todos los símbolos operables, con sus equivalencias. */
export async function simbolosOperables() {
  try {
    const tk = await import('./tokens.js?v=125');
    const out = new Set();
    Object.values(tk.MONEDAS).forEach((m) => out.add(String(m.simbolo).toUpperCase()));
    Object.keys(tk.MONEDAS).forEach((k) => out.add(k.toUpperCase()));
    /* Los alias también cuentan: si BTCB está, BTC se puede operar. */
    Object.entries(EQUIV).forEach(([a, b]) => {
      if (out.has(b.toUpperCase())) out.add(a.toUpperCase());
    });
    return out;
  } catch (_) { return new Set(); }
}

let _vigila = null;
/* ══════════════════════════════════════════════════════════════
   ÓRDENES COMPLETADAS — aviso con sonido y ficha que queda
   Revisa on-chain si una orden ya se ejecutó (el contrato la marca
   inactiva). Cuando ocurre: suena, sale una ficha con lo ocurrido
   (queda hasta que el usuario la cierra) y se repinta el gráfico.
   ══════════════════════════════════════════════════════════════ */
export async function sincronizarOrdenes(cuenta) {
  const ords = leerOrdenesGuardadas();
  if (!cuenta || !ords.length) return [];
  let gb; try { gb = await import('./gridbot.js?v=125'); } catch (_) { return []; }
  const hechas = [];
  for (const o of ords) {
    if (!(o && o.base && o.quote && o.botId != null)) continue;
    try {
      const clave = gb.claveBot(cuenta, o.base, o.quote, o.botId);
      const R = await gb.resumenK(clave);
      if (R && R.activa === false) {
        quitarOrdenGrafico(o.id);
        const i = _puestas.findIndex((x) => x.id === o.id);
        if (i >= 0) _puestas.splice(i, 1);
        hechas.push(o);
      }
    } catch (_) {}
  }
  return hechas;
}

let _repintarOrd = null;
let _vigOrd = null;
function arrancarVigilanteOrdenes() {
  if (_vigOrd) return;
  _vigOrd = setInterval(async () => {
    try {
      if (!leerOrdenesGuardadas().length) return;
      const w = await import('./wallet.js?v=125');
      const cuenta = (w.cuentaActual && w.cuentaActual()) || null;
      if (!cuenta) return;
      const hechas = await sincronizarOrdenes(cuenta);
      if (hechas.length) {
        hechas.forEach(avisarOrdenHecha);
        if (_repintarOrd) { try { _repintarOrd(); } catch (_) {} }
      }
    } catch (_) {}
  }, 12000);
}

/* Sonido característico: un doble "ding" ascendente, bien audible. */
function sonarHecho() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [660, 990].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = ac.currentTime + i * 0.14;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.5, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + 0.47);
    });
  } catch (_) {}
}

/* Ficha persistente: se queda hasta que el usuario toca la X (deja constancia). */
function avisarOrdenHecha(o) {
  sonarHecho();
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${o.par || ''} ${o.vender ? 'VENTA' : 'COMPRA'} completada`, {
        body: `${o.cant} a ${fmt(o.precio)}`, icon: 'assets/img/aurex-192.png'
      });
    }
  } catch (_) {}
  const previas = document.querySelectorAll('.od-hecha').length;
  const t = document.createElement('div');
  t.className = 'od-toast od-hecha ' + (o.vender ? 'vender' : 'comprar');
  t.style.bottom = (20 + previas * 70) + 'px';
  t.innerHTML = `
    <span class="od-t-ic">✔</span>
    <div style="flex:1">
      <b>${o.vender ? 'VENTA' : 'COMPRA'} completada</b>
      <span>${esc(String(o.cant))} · ${esc(o.par || '')} a ${esc(fmt(o.precio))}</span>
    </div>
    <button class="od-t-x" aria-label="Cerrar" style="background:none;border:0;color:#8b95a1;font-size:16px;cursor:pointer;padding:0 4px">✕</button>`;
  document.body.appendChild(t);
  t.querySelector('.od-t-x').onclick = () => t.remove();
}

function arrancarVigilante() {
  if (_vigila) return;
  _vigila = setInterval(async () => {
    const lista = leerAvisos();
    if (!lista.length) return;
    /* Se agrupan por símbolo para pedir un solo precio de cada uno */
    const simbolos = [...new Set(lista.map((x) => x.simbolo).filter(Boolean))];
    for (const s of simbolos) {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${s}`);
        if (!r.ok) continue;
        const j = await r.json();
        const p = Number(j.price);
        lista.filter((x) => x.simbolo === s).forEach((a) => {
          const llegado = a.vender ? p >= a.precio : p <= a.precio;
          if (llegado) { sonar(a, p); quitarAviso(a.id); }
        });
      } catch (_) {}
    }
  }, 30000);
}

function sonar(a, precioAhora) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${a.par} ${a.vender ? '▼' : '▲'} ${fmt(a.precio)}`, {
        body: T('El precio ha llegado a tu nivel. Abre CriptoCuba para confirmar la orden.'),
        icon: 'assets/img/aurex-192.png'
      });
    }
  } catch (_) {}

  const t = document.createElement('div');
  t.className = 'od-toast ' + (a.vender ? 'vender' : 'comprar');
  t.innerHTML = `
    <span class="od-t-ic">${a.vender ? '▼' : '▲'}</span>
    <div>
      <b>${esc(a.par)} ${esc(T('llegó a'))} ${fmt(a.precio)}</b>
      <span>${esc(T('Tu aviso se ha cumplido. Precio ahora:'))} ${fmt(precioAhora)}</span>
    </div>
    <button type="button" class="od-t-x">✕</button>`;
  document.body.appendChild(t);
  t.querySelector('.od-t-x').onclick = () => t.remove();
  setTimeout(() => { if (t.parentNode) t.remove(); }, 15000);
}

/* Confirmación breve al poner una alerta de precio con un clic.
   Mismo lenguaje visual que el aviso que salta cuando el precio llega. */
function toastAlerta(vender, precio) {
  const t = document.createElement('div');
  t.className = 'od-toast ' + (vender ? 'vender' : 'comprar');
  t.innerHTML = `
    <span class="od-t-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></span>
    <div>
      <b>${esc(T('Alerta puesta'))}</b>
      <span>${esc(T('Te avisaremos cuando el precio llegue a'))} ${fmt(precio)}</span>
    </div>
    <button type="button" class="od-t-x">✕</button>`;
  document.body.appendChild(t);
  t.querySelector('.od-t-x').onclick = () => t.remove();
  setTimeout(() => { if (t.parentNode) t.remove(); }, 6000);
}

/* ══════════════════════════════════════════════════════════════
   PINTAR LAS ÓRDENES SOBRE EL GRÁFICO

   Uno solo para las tres herramientas: así se ven idénticas en
   todas y se arregla en un sitio.

   Deliberadamente distintas de las líneas de análisis: llevan
   franja rayada, etiqueta con relieve y su botón de cancelar.
   ══════════════════════════════════════════════════════════════ */
export function pintar(g, opciones) {
  const { x1, y1, Y, pMin, pMax, simbolo } = opciones;
  const lista = ordenesPuestas().filter((o) => !simbolo || o.simbolo === simbolo);
  const zonas = [];
  if (!lista.length) return zonas;

  const H = y1 || 600;
  let usadosArriba = 0, usadosAbajo = 0;

  lista.forEach((o) => {
    const esAlerta = o.modo === 'aviso';
    const col = esAlerta ? '#E8B84B' : (o.vender ? '#f6465d' : '#2ee86a');

    /* ── La orden queda FUERA de la vista (otra temporalidad u otro zoom) ──
       No se omite: se deja un marcador en el borde apuntando hacia ella,
       con su precio, para que nunca parezca que "desapareció". Así la
       experiencia es consistente en todas las temporalidades. */
    if (!(o.precio >= pMin && o.precio <= pMax)) {
      const arriba = o.precio > pMax;                 // por encima → borde superior
      const fila = arriba ? usadosArriba++ : usadosAbajo++;
      const yB = arriba ? 10 + fila * 26 : H - 22 - fila * 26;
      const flecha = arriba ? '▲' : '▼';
      const tipo = esAlerta ? 'ALERTA' : (o.vender ? 'VENTA' : 'COMPRA');
      const et = `${flecha} ${tipo}  ${fmt(o.precio)}`;
      g.font = 'bold 10px ui-monospace,monospace';
      const w = g.measureText(et).width + 22;
      const xE = x1 - w - 8;
      g.save();
      g.globalAlpha = 0.96;
      g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 7; g.shadowOffsetY = 2;
      g.fillStyle = col;
      redondeadoOd(g, xE, yB, w, 20, 7); g.fill();
      g.restore();
      g.fillStyle = esAlerta ? '#2a1c00' : (o.vender ? '#2a0509' : '#04210f');
      g.textAlign = 'left';
      g.fillText(et, xE + 11, yB + 14);
      return;   // sin botón de cancelar aquí: acércala a la vista para cancelarla
    }

    const y = Y(o.precio);
    /* Franja rayada: nada en la gráfica se ve así, no hay confusión */
    g.save();
    g.beginPath(); g.rect(0, y - 9, x1, 18); g.clip();
    g.fillStyle = col + '14';
    g.fillRect(0, y - 9, x1, 18);
    g.strokeStyle = col + '30';
    g.lineWidth = 1.5;
    for (let xx = -20; xx < x1 + 20; xx += 9) {
      g.beginPath(); g.moveTo(xx, y + 10); g.lineTo(xx + 10, y - 10); g.stroke();
    }
    g.restore();

    // La línea, gruesa y sólida
    g.strokeStyle = col;
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke();

    /* La etiqueta: dice qué es, no se parece a nada más */
    const tipo = esAlerta ? 'ALERTA' : (o.vender ? 'VENTA' : 'COMPRA');
    const et = `${tipo}  ${fmt(o.precio)}`;
    g.font = 'bold 11px ui-monospace,monospace';
    const w = g.measureText(et).width + 30;
    const xE = x1 - w - 42;

    // Sombra para despegarla del fondo
    g.save();
    g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; g.shadowOffsetY = 2;
    g.fillStyle = col;
    redondeadoOd(g, xE, y - 13, w, 26, 8); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(232,184,75,.85)'; g.lineWidth = 1.4;
    redondeadoOd(g, xE, y - 13, w, 26, 8); g.stroke();

    g.fillStyle = esAlerta ? '#2a1c00' : (o.vender ? '#2a0509' : '#04210f');
    g.textAlign = 'left';
    g.fillText(et, xE + 13, y + 4);

    /* El botón de cancelar, a su derecha */
    const xB = x1 - 34;
    g.fillStyle = 'rgba(11,15,22,.92)';
    redondeadoOd(g, xB, y - 13, 26, 26, 8); g.fill();
    g.strokeStyle = col + 'aa'; g.lineWidth = 1.4;
    redondeadoOd(g, xB, y - 13, 26, 26, 8); g.stroke();
    g.strokeStyle = col; g.lineWidth = 1.8; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(xB + 9, y - 4); g.lineTo(xB + 17, y + 4);
    g.moveTo(xB + 17, y - 4); g.lineTo(xB + 9, y + 4);
    g.stroke();
    g.lineCap = 'butt';

    // Dónde se puede pulsar para cancelar
    zonas.push({ x: xB, y: y - 13, w: 26, h: 26, orden: o });
  });

  return zonas;
}

function redondeadoOd(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

/** Engancha el clic de cancelar en un lienzo. */
export function clicCancelar(cv, dameZonas, repintar) {
  if (cv.dataset.odCancel) return;
  cv.dataset.odCancel = '1';

  /* La manita al pasar por encima de la X: si no cambia el cursor,
     nadie sabe que ahí se puede pulsar. */
  cv.addEventListener('mousemove', (e) => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const encima = (dameZonas() || []).some((q) =>
      x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (encima) cv.style.cursor = 'pointer';
    else if (cv.style.cursor === 'pointer') cv.style.cursor = 'crosshair';
  });

  const mirar = (cx, cy) => {
    const r = cv.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    const z = (dameZonas() || []).find((q) =>
      x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (z) { pedirCancelar(z.orden, repintar); return true; }
    return false;
  };
  cv.addEventListener('click', (e) => { if (mirar(e.clientX, e.clientY)) { e.stopPropagation(); } }, true);
}

/* ══════════════════════════════════════════════════════════════
   LA VENTANA DE PASOS

   Crear una orden lleva varias firmas. En vez de meter el texto en
   el botón (que lo estiraba y rompía la ficha), se enseña aquí
   qué está pasando en cada momento.
   ══════════════════════════════════════════════════════════════ */
function abrirPasos(vender) {
  cerrarPasos();
  const d = document.createElement('div');
  d.id = 'od-pasos';
  d.innerHTML = `<div class="od-p-fondo"></div>
    <div class="od-p-caja ${vender ? 'vender' : 'comprar'}">
      <div class="od-p-spin"></div>
      <b id="od-p-tx">${esc(T('Preparando…'))}</b>
      <span>${esc(T('Cada firma es un paso. No cierres esta ventana.'))}</span>
    </div>`;
  document.body.appendChild(d);
}

function pintarPaso(t) {
  const el = $('od-p-tx');
  if (el) el.textContent = t;
}

function cerrarPasos() {
  const d = $('od-pasos');
  if (d) d.remove();
}

/* ══════════════════════════════════════════════════════════════
   CANCELAR — con confirmación, que es dinero
   ══════════════════════════════════════════════════════════════ */
export function pedirCancelar(orden, alCancelar) {
  cerrarTodo();
  const esAlerta = orden.modo === 'aviso';
  const d = document.createElement('div');
  d.className = 'od-confirmar-box';
  d.innerHTML = `<div class="od-cb-fondo"></div>
    <div class="od-cb-caja ${orden.vender ? 'vender' : 'comprar'}">
      <div class="od-cb-ic">${esAlerta ? '◔' : '◆'}</div>
      <b>${esc(T(esAlerta ? '¿Cancelar esta alerta?' : '¿Cancelar esta orden?'))}</b>
      <span>${esc(orden.par)} · ${esc(T(orden.vender ? 'Venta' : 'Compra'))} ${esc(T('en'))} ${fmt(orden.precio)}</span>
      <div class="od-cb-acts">
        <button class="od-cb-no" type="button">${esc(T('No, dejarla'))}</button>
        <button class="od-cb-si" type="button">${esc(T('Sí, cancelar'))}</button>
      </div>
    </div>`;
  document.body.appendChild(d);
  const q = () => d.remove();
  d.querySelector('.od-cb-fondo').onclick = q;
  d.querySelector('.od-cb-no').onclick = q;
  d.querySelector('.od-cb-si').onclick = async () => {
    /* [CORREGIDO] Cancelar una orden REAL toca el contrato y
       necesita firma: antes se borraba solo de la pantalla y la
       orden seguía viva en la blockchain. Las alertas sí son
       locales y no llevan firma. */
    if (esAlerta) {
      cancelar(orden.id);
      q();
      if (alCancelar) alCancelar();
      return;
    }
    const si = d.querySelector('.od-cb-si');
    si.disabled = true;
    si.textContent = T('Firma en tu wallet…');
    try {
      const gb = await import('./gridbot.js?v=125');
      const w = await import('./wallet.js?v=125');
      const cuenta = (w.cuentaActual && w.cuentaActual()) || null;
      if (!cuenta) throw new Error(T('Conecta tu wallet.'));
      /* El contrato cancela por par de tokens, que es lo que se
         guardó al crear la orden. */
      if (!orden.base || !orden.quote) {
        throw new Error(T('Esta orden hay que cerrarla desde tus bots, en el panel principal.'));
      }
      await gb.cancelarRejilla(orden.base, orden.quote);
      cancelar(orden.id);
      q();
      if (alCancelar) alCancelar();
    } catch (er) {
      si.disabled = false;
      si.textContent = T('Sí, cancelar');
      const m = String((er && (er.reason || er.message)) || er);
      const av = d.querySelector('.od-cb-caja > span');
      if (av) {
        av.style.color = '#ff6b7a';
        av.textContent = /user rejected|denied|4001/i.test(m)
          ? T('Cancelaste la firma.') : m.slice(0, 120);
      }
    }
  };
}

/* ══════════════════════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════════════════════ */
function colocar(el, cx, cy, grande) {
  const m = 10;
  const w = el.offsetWidth || (grande ? 320 : 210);
  const h = el.offsetHeight || (grande ? 420 : 130);
  let x = cx + 8, y = cy + 8;

  if (x + w > window.innerWidth - m) x = cx - w - 8;
  x = Math.max(m, Math.min(x, window.innerWidth - w - m));

  /* Nunca por debajo del borde: el botón de confirmar tiene que
     verse siempre, que es lo que el usuario va a pulsar. */
  if (y + h > window.innerHeight - m) y = window.innerHeight - h - m;
  y = Math.max(m, y);

  el.style.left = x + 'px';
  el.style.top = y + 'px';
}

function cerrarTodo() {
  document.querySelectorAll('.od-menu, .od-ficha').forEach((x) => x.remove());
}

function exito(d, titulo, texto) {
  d.innerHTML = `<div class="od-fin ok">
    <div class="od-fin-ic">✓</div>
    <b>${esc(titulo)}</b>
    <span>${esc(texto)}</span>
    <button class="od-confirmar" type="button">${esc(T('Entendido'))}</button>
  </div>`;
  d.querySelector('button').onclick = cerrarTodo;
  setTimeout(cerrarTodo, 6000);
}

function fallo(d, texto) {
  const prev = d.querySelector('.od-error');
  if (prev) prev.remove();
  const e = document.createElement('div');
  e.className = 'od-error';
  e.textContent = texto;
  const ok = d.querySelector('.od-confirmar');
  if (ok) ok.parentNode.insertBefore(e, ok);
}

/* ══════════════════════════════════════════════════════════════
   ESTILOS
   ══════════════════════════════════════════════════════════════ */
function estilos() {
  if ($('od-css')) return;
  const s = document.createElement('style'); s.id = 'od-css';
  s.textContent = `
  .od-menu,.od-ficha{position:fixed;z-index:9860;
    background:linear-gradient(165deg,rgba(22,28,38,.99),rgba(11,15,22,.99));
    border:1.5px solid #3a424c;border-radius:14px;
    box-shadow:0 18px 50px rgba(0,0,0,.8);animation:odEntra .18s ease both}
  @keyframes odEntra{from{opacity:0;transform:scale(.95) translateY(-6px)}to{opacity:1;transform:none}}
  .od-menu.comprar,.od-ficha.comprar{border-color:rgba(46,232,106,.55)}
  .od-menu.vender,.od-ficha.vender{border-color:rgba(246,70,93,.55)}

  /* El menú del clic derecho */
  .od-menu{width:262px;padding:13px}
  .od-m-cab{display:flex;align-items:flex-start;gap:9px;margin-bottom:10px}
  .od-m-tx{flex:1;min-width:0}
  /* El porcentaje, grande arriba a la derecha */
  .od-m-pct{flex:0 0 auto;text-align:right}
  /* Más específico que la regla general del encabezado, que lo
     estaba pisando y dejaba el porcentaje en 13px. */
  .od-menu .od-m-cab .od-m-pct b{display:block;font-family:var(--display,sans-serif);
    font-weight:800;font-size:32px !important;line-height:1;color:#2ee86a !important;
    text-shadow:0 0 18px rgba(46,232,106,.35)}
  .od-m-pct span{display:block;font-family:var(--sans,sans-serif);font-size:10px;
    font-weight:600;color:#3ee88a;margin-top:2px}
  .od-m-ic{font-size:14px}
  .od-menu.comprar .od-m-ic{color:#2ee86a}
  .od-menu.vender .od-m-ic{color:#f6465d}
  .od-m-cab b{display:block;font-family:var(--display,sans-serif);font-weight:800;
    font-size:13px;color:#eaecef;line-height:1.2}
  .od-m-cab span{display:block;font-family:var(--mono,monospace);font-size:13px;
    color:var(--gold,#E8B84B);font-weight:700}

  .od-m-b{width:100%;min-height:38px;border-radius:9px;cursor:pointer;
    font-family:var(--display,sans-serif);font-weight:800;font-size:12.5px;border:none}
  .od-menu.comprar .od-m-b{background:linear-gradient(180deg,#4dffa0,#1fc96e);color:#04210f}
  .od-menu.vender .od-m-b{background:linear-gradient(180deg,#ff8a95,#e03546);color:#2a0509}
  /* Dos acciones del MISMO tamaño: Establecer posición + Alerta (un clic).
     La alerta lleva el color de la zona (rojo encima del precio, verde
     debajo), igual que el otro botón; el icono de campana la distingue. */
  .od-m-acc{display:flex;gap:7px;align-items:stretch}
  .od-m-acc .od-m-b{flex:1;width:auto}
  .od-m-alert{flex:1;min-height:38px;border-radius:9px;cursor:pointer;border:none;
    display:inline-flex;align-items:center;justify-content:center;gap:5px;line-height:1.1;
    font-family:var(--display,sans-serif);font-weight:800;font-size:12px}
  .od-m-alert svg{width:14px;height:14px;flex:0 0 auto}
  .od-menu.comprar .od-m-alert{background:linear-gradient(180deg,#4dffa0,#1fc96e);color:#04210f}
  .od-menu.vender .od-m-alert{background:linear-gradient(180deg,#ff8a95,#e03546);color:#2a0509}

  /* La ficha */
  /* [CORREGIDO] Al escribir la cantidad aparecía el resumen y la
     ficha crecía hasta salirse por abajo, ocultando el botón.
     Ahora se ancla al borde inferior con su propio scroll. */
  .od-ficha{width:min(330px, calc(100vw - 20px));
    max-height:min(78vh, calc(100vh - 24px));
    overflow-y:auto;overscroll-behavior:contain;padding:15px}
  /* [CORREGIDO] En las ventas el porcentaje se montaba encima de la
     X y se comía el clic. Ahora la X va por encima de todo y el
     porcentaje deja su sitio libre. */
  .od-x{position:absolute;top:11px;right:11px;width:32px;height:32px;border-radius:9px;
    display:grid;place-items:center;padding:0;cursor:pointer;font-size:13px;z-index:20;
    background:rgba(255,255,255,.08);border:1px solid #3a424c;color:#b7bdc6}
  .od-x:hover{background:rgba(255,255,255,.14);color:#eaecef}
  .od-cab{display:flex;align-items:center;gap:10px;margin-bottom:6px;padding-right:44px}
  .od-ic{font-size:17px}
  .od-ficha.comprar .od-ic{color:#2ee86a}
  .od-ficha.vender .od-ic{color:#f6465d}
  .od-tit b{display:block;font-family:var(--display,sans-serif);font-weight:800;
    font-size:15px;color:#eaecef;line-height:1.2}
  .od-tit span{display:block;font-family:var(--mono,monospace);font-size:13px;
    color:var(--gold,#E8B84B);font-weight:700;margin-top:1px}
  /* El porcentaje: el dato que decide, bien visible */
  .od-pct-grande{margin-left:auto;text-align:right;flex:0 0 auto;margin-top:22px}
  .od-pct-grande b{display:block;font-family:var(--display,sans-serif);font-weight:800;
    font-size:25px;line-height:1;color:#2ee86a !important}
  .od-pct-grande span{display:block;font-family:var(--sans,sans-serif);font-size:10px;
    color:#3ee88a;margin-top:2px}
  .od-dist{font-family:var(--mono,monospace);font-size:10px;color:#7d8794;margin-bottom:13px}
  .od-saldo{display:block;margin-top:5px;font-family:var(--mono,monospace);font-size:10.5px;color:#8b96a3}
  .od-saldo b{color:#eaecef}
  .od-saldo.alerta{padding:8px 10px;margin-top:7px;border-radius:8px;
    background:rgba(232,184,75,.1);border:1px solid rgba(232,184,75,.3);
    font-family:var(--sans,sans-serif);font-size:11px;color:var(--gold,#E8B84B);line-height:1.45}

  .od-campo{margin-bottom:13px}
  .od-campo label{display:block;font-family:var(--mono,monospace);font-size:9px;
    color:#5c6672;text-transform:uppercase;letter-spacing:1.1px;margin-bottom:6px}
  .od-inp-fila{display:flex;align-items:center;gap:8px;padding:0 11px;border-radius:10px;
    background:#0b0e12;border:1px solid #2b3139}
  .od-inp-fila:focus-within{border-color:var(--gold-soft,#C9A84B)}
  .od-inp{flex:1;min-width:0;background:transparent;border:none;outline:none;
    color:#eaecef;font-family:var(--mono,monospace);font-size:15px;font-weight:700;
    padding:11px 0;min-height:44px}
  /* Sin las flechitas de incremento */
  .od-inp::-webkit-outer-spin-button,.od-inp::-webkit-inner-spin-button{
    -webkit-appearance:none;margin:0}
  .od-inp[type=number]{-moz-appearance:textfield}
  .od-unidad{font-family:var(--mono,monospace);font-size:11px;color:#7d8794;flex:0 0 auto}

  .od-rango{width:100%;margin:13px 0 14px;height:4px;border-radius:3px;
    -webkit-appearance:none;appearance:none;background:#2b3139;cursor:pointer}
  .od-rango::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;
    border-radius:50%;background:var(--gold,#E8B84B);cursor:pointer;
    box-shadow:0 2px 6px rgba(0,0,0,.5)}
  .od-rango::-moz-range-thumb{width:17px;height:17px;border:none;border-radius:50%;
    background:var(--gold,#E8B84B);cursor:pointer}
  .od-pcts{display:flex;gap:5px}
  .od-pct{flex:1;min-height:30px;border-radius:7px;cursor:pointer;
    background:rgba(255,255,255,.04);border:1px solid #2b3139;color:#8b96a3;
    font-family:var(--mono,monospace);font-size:10px;font-weight:700}
  .od-pct.on,.od-pct:hover{border-color:var(--gold-soft,#C9A84B);color:var(--gold,#E8B84B)}

  .od-modos{display:flex;flex-direction:column;gap:6px}
  .od-modo{text-align:left;padding:10px 12px;border-radius:10px;cursor:pointer;
    background:rgba(255,255,255,.03);border:1px solid #2b3139}
  .od-modo.on{background:rgba(232,184,75,.1);border-color:var(--gold,#E8B84B)}
  .od-modo b{display:block;font-family:var(--display,sans-serif);font-weight:700;
    font-size:12.5px;color:#eaecef;margin-bottom:2px}
  .od-modo.on b{color:var(--gold,#E8B84B)}
  .od-modo span{display:block;font-family:var(--sans,sans-serif);font-size:10.5px;
    color:#7d8794;line-height:1.4}

  .od-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;
    min-height:38px;padding:0 12px;border-radius:9px;cursor:pointer;
    background:rgba(255,255,255,.03);border:1px solid #2b3139;color:#b7bdc6;
    font-family:var(--sans,sans-serif);font-size:12px}
  .od-toggle span em{font-style:normal;color:#7d8794;font-size:11px}
  .od-toggle .od-fl{font-style:normal;font-size:10px;color:#5c6672;transition:transform .2s}
  .od-opcional.abierto .od-fl{transform:rotate(180deg)}
  .od-sl{display:none;margin-top:8px}
  .od-opcional.abierto .od-sl{display:block}
  .od-nota{margin-top:6px;font-family:var(--sans,sans-serif);font-size:10.5px;
    color:#7d8794;line-height:1.45}

  .od-resumen{display:none;margin-bottom:12px;padding:11px;border-radius:10px;
    background:rgba(0,0,0,.35);border:1px solid #232a33}
  .od-resumen.lleno{display:block}
  .od-r-fila{display:flex;justify-content:space-between;gap:9px;padding:3px 0}
  .od-r-fila span{font-family:var(--sans,sans-serif);font-size:11.5px;color:#8b96a3}
  .od-r-fila b{font-family:var(--mono,monospace);font-size:12px;color:#eaecef}

  .od-confirmar{width:100%;min-height:46px;border-radius:11px;cursor:pointer;border:none;
    font-family:var(--display,sans-serif);font-weight:800;font-size:14px}
  .od-ficha.comprar .od-confirmar{background:linear-gradient(180deg,#4dffa0,#1fc96e);
    color:#04210f;box-shadow:0 4px 0 #157a44}
  .od-ficha.vender .od-confirmar{background:linear-gradient(180deg,#ff8a95,#e03546);
    color:#2a0509;box-shadow:0 4px 0 #8f1f2b}
  .od-confirmar.aviso{background:linear-gradient(180deg,#f7db8d,#E8B84B 50%,#c79426) !important;
    color:#3a2800 !important;box-shadow:0 4px 0 #8f6a1a !important}
  .od-confirmar:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
  .od-aviso{margin-top:9px;text-align:center;font-family:var(--sans,sans-serif);
    font-size:10px;color:#5c6672;line-height:1.4}
  .od-error{margin-bottom:9px;padding:9px 11px;border-radius:9px;
    background:rgba(246,70,93,.12);border:1px solid rgba(246,70,93,.35);
    font-family:var(--sans,sans-serif);font-size:11.5px;color:#ff6b7a}

  /* En modo aviso sobran la cantidad y el stop */
  .od-ficha.solo-aviso .od-cantidad,
  .od-ficha.solo-aviso .od-opcional{display:none}

  .od-fin{text-align:center;padding:14px 4px}
  .od-fin-ic{width:52px;height:52px;margin:0 auto 12px;border-radius:50%;
    display:grid;place-items:center;font-size:25px;
    background:rgba(46,232,106,.15);color:#2ee86a;border:2px solid rgba(46,232,106,.5)}
  .od-fin b{display:block;font-family:var(--display,sans-serif);font-weight:800;
    font-size:16px;color:#eaecef;margin-bottom:6px}
  .od-fin span{display:block;font-family:var(--sans,sans-serif);font-size:12px;
    color:#8b96a3;line-height:1.5;margin-bottom:14px}

  /* El aviso cuando el precio llega */
  .od-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:20px;z-index:9880;
    display:flex;align-items:center;gap:11px;max-width:calc(100vw - 24px);
    padding:12px 14px;border-radius:13px;
    background:linear-gradient(165deg,rgba(22,28,38,.99),rgba(11,15,22,.99));
    border:1.5px solid #3a424c;box-shadow:0 14px 44px rgba(0,0,0,.8);
    animation:odSube .3s ease both}
  @keyframes odSube{from{opacity:0;transform:translateX(-50%) translateY(14px)}
                    to{opacity:1;transform:translateX(-50%)}}
  .od-toast.comprar{border-color:rgba(46,232,106,.55)}
  .od-toast.vender{border-color:rgba(246,70,93,.55)}
  .od-t-ic{font-size:16px;flex:0 0 auto}
  .od-t-ic svg{width:16px;height:16px;display:block}
  .od-toast.comprar .od-t-ic{color:#2ee86a}
  .od-toast.vender .od-t-ic{color:#f6465d}
  .od-toast b{display:block;font-family:var(--display,sans-serif);font-weight:800;
    font-size:13px;color:#eaecef}
  .od-toast span{display:block;font-family:var(--sans,sans-serif);font-size:11px;color:#8b96a3}
  .od-t-x{width:26px;height:26px;flex:0 0 auto;border-radius:7px;cursor:pointer;
    display:grid;place-items:center;padding:0;font-size:11px;
    background:rgba(255,255,255,.06);border:1px solid #3a424c;color:#8b96a3}

  /* La ventana de pasos: no cabía en el botón */
  #od-pasos{position:fixed;inset:0;z-index:9910;display:flex;
    align-items:center;justify-content:center;padding:16px}
  .od-p-fondo{position:absolute;inset:0;background:rgba(3,5,8,.88)}
  .od-p-caja{position:relative;width:100%;max-width:320px;padding:26px 22px;
    border-radius:18px;text-align:center;
    background:linear-gradient(165deg,rgba(22,28,38,.99),rgba(11,15,22,.99));
    border:1.5px solid #3a424c;box-shadow:0 20px 60px rgba(0,0,0,.85)}
  .od-p-caja.comprar{border-color:rgba(46,232,106,.5)}
  .od-p-caja.vender{border-color:rgba(246,70,93,.5)}
  .od-p-spin{width:38px;height:38px;margin:0 auto 15px;border-radius:50%;
    border:2.5px solid rgba(232,184,75,.16);border-top-color:var(--gold,#E8B84B);
    animation:odGira .85s linear infinite}
  @keyframes odGira{to{transform:rotate(360deg)}}
  .od-p-caja b{display:block;font-family:var(--display,sans-serif);font-weight:800;
    font-size:15px;color:#eaecef;margin-bottom:7px;line-height:1.35}
  .od-p-caja span{display:block;font-family:var(--sans,sans-serif);font-size:11.5px;
    color:#8b96a3;line-height:1.5}

  /* La ventana de confirmar cancelación */
  .od-confirmar-box{position:fixed;inset:0;z-index:9900;display:flex;
    align-items:center;justify-content:center;padding:16px}
  .od-cb-fondo{position:absolute;inset:0;background:rgba(3,5,8,.86)}
  .od-cb-caja{position:relative;width:100%;max-width:330px;padding:22px 20px;
    border-radius:18px;text-align:center;
    background:linear-gradient(165deg,rgba(22,28,38,.99),rgba(11,15,22,.99));
    border:1.5px solid #3a424c;box-shadow:0 20px 60px rgba(0,0,0,.85);
    animation:odEntra .2s ease both}
  .od-cb-caja.comprar{border-color:rgba(46,232,106,.5)}
  .od-cb-caja.vender{border-color:rgba(246,70,93,.5)}
  .od-cb-ic{width:48px;height:48px;margin:0 auto 13px;border-radius:50%;
    display:grid;place-items:center;font-size:21px;
    background:rgba(232,184,75,.14);color:var(--gold,#E8B84B);
    border:2px solid rgba(232,184,75,.4)}
  .od-cb-caja b{display:block;font-family:var(--display,sans-serif);font-weight:800;
    font-size:16px;color:#eaecef;margin-bottom:6px}
  .od-cb-caja > span{display:block;font-family:var(--mono,monospace);font-size:12px;
    color:#8b96a3;margin-bottom:18px}
  .od-cb-acts{display:flex;gap:8px}
  .od-cb-no,.od-cb-si{flex:1;min-height:44px;border-radius:11px;cursor:pointer;
    font-family:var(--display,sans-serif);font-weight:700;font-size:13px}
  .od-cb-no{background:transparent;border:1px solid #3a424c;color:#b7bdc6}
  .od-cb-si{border:none;background:linear-gradient(180deg,#ff8a95,#e03546);
    color:#2a0509;font-weight:800;box-shadow:0 3px 0 #8f1f2b}

  @media(max-width:560px){
    /* En el móvil la ficha va abajo, a lo ancho */
    .od-ficha{position:fixed !important;left:8px !important;right:8px !important;
      top:auto !important;bottom:10px !important;width:auto !important;
      max-height:min(76dvh, 600px);
      display:flex;flex-direction:column;padding-bottom:0}
    /* [CORREGIDO] El botón quedaba bajo el borde al crecer la ficha.
       Ahora el contenido hace scroll y el botón se queda pegado
       abajo, siempre visible. */
    .od-ficha .od-confirmar{position:sticky;bottom:0;flex:0 0 auto;
      margin-top:auto;z-index:5}
    .od-ficha .od-aviso{flex:0 0 auto;padding-bottom:13px;
      background:rgba(11,15,22,.96)}
    .od-menu{width:196px}
  }`;
  document.head.appendChild(s);
}
