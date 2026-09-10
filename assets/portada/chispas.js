/* Partículas compartidas: portada y pantalla de bots usan la misma.
   Extraído de portada.js sin cambiar la lógica. */
export function brasas(lienzo) {
  const g = lienzo.getContext('2d', { alpha: true });
  if (!g) return;

  /* ── Chispas ────────────────────────────────────────────────────────
     Puntos nítidos con un halo corto, subiendo despacio y balanceándose.
     Sin haces de luz: los quité porque ensuciaban las fotos.

     Rápido porque no se desenfoca nada en vivo: la chispa se dibuja UNA
     vez en una miniatura con su halo ya hecho, y en cada fotograma solo
     se copia y se escala. Copiar es baratísimo; desenfocar en cada cuadro
     era lo que hacía el scroll a tirones.
     ─────────────────────────────────────────────────────────────────── */

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const densidad = Number(lienzo.dataset.n || 90);
  const tono = lienzo.dataset.tono || '246,214,150';

  let an = 0, al = 0, chispas = [], vivo = false, lazo = 0, antes = 0;
  let scrAntes = window.scrollY || 0;
  let sprite = null;
  const SP = 24;

  const entre = (a, b) => a + Math.random() * (b - a);

  // Tres profundidades: [radio, velocidad, alfa]
  // [radio, velocidad, alfa, profundidad]
  const PLANOS = [
    { r: [0.45, 0.85], v: [3, 7],   a: [0.16, 0.34], p: 0.12 },
    { r: [0.70, 1.20], v: [7, 14],  a: [0.28, 0.55], p: 0.38 },
    { r: [1.10, 1.80], v: [12, 24], a: [0.45, 0.85], p: 0.85 }
  ];

  function nacer(abajo) {
    const d = Math.random();
    const p = PLANOS[d < 0.48 ? 0 : d < 0.83 ? 1 : 2];
    return {
      x: Math.random() * an,
      y: abajo ? al + 12 : Math.random() * al,
      r: entre(p.r[0], p.r[1]),
      v: entre(p.v[0], p.v[1]),
      a: entre(p.a[0], p.a[1]),
      prof: p.p,
      f: 0.25 + Math.random() * 0.7,
      amp: 5 + Math.random() * 20,
      pf: 0.6 + Math.random() * 1.8,
      t: Math.random() * 100,
      brasa: Math.random() < 0.2
    };
  }

  /* El núcleo ocupa la cuarta parte del sprite: por eso se ve como una
     chispa con brillo y no como una mancha de polvo. */
  function hacerSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = SP * 2;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(SP, SP, 0, SP, SP, SP);
    gr.addColorStop(0.00, 'rgba(255,246,225,1)');
    gr.addColorStop(0.22, 'rgba(' + tono + ',.95)');
    gr.addColorStop(0.34, 'rgba(' + tono + ',.34)');
    gr.addColorStop(0.62, 'rgba(' + tono + ',.07)');
    gr.addColorStop(1.00, 'rgba(' + tono + ',0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, SP * 2, SP * 2);
    sprite = c;
  }

  function medir() {
    // El canvas es position:fixed inset:0 => ocupa la ventana entera.
    // Se usa innerWidth/innerHeight y NO getBoundingClientRect, que al
    // arrancar (layout sin terminar) devolvia 0x0 y dejaba las particulas
    // apiñadas en la esquina superior izquierda.
    an = Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 1));
    al = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 1));
    lienzo.width = Math.round(an * dpr);
    lienzo.height = Math.round(al * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(densidad * Math.min(1.3, an / 1000));
    chispas = Array.from({ length: n }, () => nacer(false));
    if (!sprite) hacerSprite();
  }

  function paso(ms) {
    if (!vivo) return;
    const ahora = ms / 1000;
    const dt = Math.min(0.05, ahora - antes || 0.016);
    antes = ahora;

    // Cuánto se ha movido la página desde el fotograma anterior.
    const scrAhora = window.scrollY || 0;
    const desliz = scrAhora - scrAntes;
    scrAntes = scrAhora;

    g.clearRect(0, 0, an, al);
    g.globalCompositeOperation = 'lighter';

    for (let i = 0; i < chispas.length; i++) {
      const m = chispas[i];
      m.t += dt;
      m.y -= m.v * dt;
      m.y += desliz * m.prof;            // acompaña al scroll según su plano

      // Al salir por arriba o por abajo, vuelve a entrar por el lado
      // contrario: así el campo nunca se vacía por mucho que subas o bajes.
      if (m.y < -14) { chispas[i] = nacer(true); continue; }
      if (m.y > al + 24) { chispas[i] = nacer(false); chispas[i].y = -12; continue; }

      const x = m.x + Math.sin(m.t * m.f) * m.amp;
      const y = m.y;

      const borde = Math.min(1, y / (al * 0.18), (al - y) / (al * 0.1));
      if (borde <= 0) continue;

      const pulso = m.brasa ? 0.6 + 0.4 * Math.sin(m.t * m.pf * 3) : 1;
      const alfa = m.a * borde * pulso;
      if (alfa <= 0.006) continue;

      // Escala 3.2: halo corto y núcleo bien definido.
      const d = m.r * 3.2;
      g.globalAlpha = Math.min(1, alfa);
      g.drawImage(sprite, x - d, y - d, d * 2, d * 2);
    }

    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    lazo = requestAnimationFrame(paso);
  }

  const arrancar = () => { if (vivo) return; vivo = true; antes = performance.now() / 1000; lazo = requestAnimationFrame(paso); };
  const parar = () => { vivo = false; cancelAnimationFrame(lazo); };

  medir();

  let espera;
  window.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(medir, 260); }, { passive: true });
  // Remedida inmediata bajo demanda (cuando el layout ya tiene tamaño).
  brasas._remedir = medir;

  arrancar();
  document.addEventListener('visibilitychange', () => (document.hidden ? parar() : arrancar()));
}

