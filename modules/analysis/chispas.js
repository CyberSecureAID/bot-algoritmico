/* Partículas compartidas: las MISMAS de la portada / Terminal / Bots.
   Copia para el módulo de Análisis (cada módulo lleva la suya, sellado).
   Única diferencia con la original: devuelve un controlador { parar, remedir }
   y se auto-detiene si su canvas deja de estar en el DOM, para no dejar bucles
   vivos al cerrar el overlay. La lógica y el aspecto son idénticos. */
export function brasas(lienzo) {
  const g = lienzo.getContext('2d', { alpha: true });
  if (!g) return { parar() {}, remedir() {} };

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const densidad = Number(lienzo.dataset.n || 90);
  const tono = lienzo.dataset.tono || '246,214,150';

  let an = 0, al = 0, chispas = [], vivo = false, lazo = 0, antes = 0;
  let scrAntes = window.scrollY || 0;
  let sprite = null;
  const SP = 24;

  const entre = (a, b) => a + Math.random() * (b - a);

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
    if (!lienzo.isConnected) { parar(); return; }   // el overlay se cerró: no dejar el bucle vivo
    const ahora = ms / 1000;
    const dt = Math.min(0.05, ahora - antes || 0.016);
    antes = ahora;

    const scrAhora = window.scrollY || 0;
    const desliz = scrAhora - scrAntes;
    scrAntes = scrAhora;

    g.clearRect(0, 0, an, al);
    g.globalCompositeOperation = 'lighter';

    for (let i = 0; i < chispas.length; i++) {
      const m = chispas[i];
      m.t += dt;
      m.y -= m.v * dt;
      m.y += desliz * m.prof;

      if (m.y < -14) { chispas[i] = nacer(true); continue; }
      if (m.y > al + 24) { chispas[i] = nacer(false); chispas[i].y = -12; continue; }

      const x = m.x + Math.sin(m.t * m.f) * m.amp;
      const y = m.y;

      const borde = Math.min(1, y / (al * 0.18), (al - y) / (al * 0.1));
      if (borde <= 0) continue;

      const pulso = m.brasa ? 0.6 + 0.4 * Math.sin(m.t * m.pf * 3) : 1;
      const alfa = m.a * borde * pulso;
      if (alfa <= 0.006) continue;

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
  const onResize = () => { clearTimeout(espera); espera = setTimeout(medir, 260); };
  window.addEventListener('resize', onResize, { passive: true });
  const onVis = () => (document.hidden ? parar() : arrancar());
  document.addEventListener('visibilitychange', onVis);

  arrancar();

  return {
    parar() { parar(); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); },
    remedir: medir
  };
}
