/* ══════════════════════════════════════════════════════════════
   sp500/grafica.js — Motor de grafica propio (un solo lienzo) para
   TD SEQUENTIAL.

   NADA de velo montado encima. Igual que Smart Pools: un unico canvas
   y una funcion dibujar() que, en cada gesto, recalcula la MISMA
   transformacion (paso para el tiempo, Y para el precio) y repinta las
   velas y la cuenta JUNTAS. Por eso, al estirar, encoger, mover o hacer
   zoom, las cuentas, las lineas TDST y el umbral se mueven clavados.

   Dibuja: las cuentas de Setup (1 a 9) y Countdown (1 a 13) sobre cada
   vela, las lineas TDST (soporte/resistencia), los giros en 9 y 13, y
   la LINEA DE UMBRAL que la proxima vela debe cerrar para avanzar la
   cuenta (anti standby).
   ══════════════════════════════════════════════════════════════ */

import { etHora, etFecha, etMin, APERTURA } from './motor.js?v=3';

function redondeado(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
const fmt = (p) => (p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 2 }) : (p || 0).toFixed(2));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const COL = {
  bg: '#0b0f16', up: '#26a69a', down: '#ef5350',
  gold: '#E8B84B', goldRGB: '232,184,75',
  buy: '#2ee86a', buyRGB: '46,232,106',
  sell: '#ff5b6e', sellRGB: '255,91,110',
  cd: '#36d6c6', cdRGB: '54,214,198',
  res: '#ff9f43', sup: '#54a0ff',
  tinta: '#eaecef', dim: '#79838f', eje: '#4a525c'
};
const REL = { close_below: 'below', close_above: 'above', close_leq_low: 'at or below', close_geq_high: 'at or above', flip: 'below' };

export function crearChart(cv, cont) {
  const S = {
    velas: [], td: null, precio: 0, tf: '1d', diaria: true,
    fuente: '', cruz: null,
    vista: { desde: 0, ancho: 80, zoomY: 1, offsetY: 0 },
    _geo: null
  };
  // La marca de agua va como <img> en la esquina inferior izquierda (en sp500.js),
  // igual que Liquidity, Heard y Smart Pools. Aqui no se dibuja nada al centro.

  function numEt(g, x, y, txt, color, destacado) {
    if (destacado) {
      g.font = '800 11px "Chakra Petch", system-ui, sans-serif';
      const w = g.measureText(txt).width + 9;
      g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6;
      g.fillStyle = 'rgba(12,16,23,.92)'; redondeado(g, x - w / 2, y - 8, w, 16, 5); g.fill(); g.restore();
      g.strokeStyle = color; g.lineWidth = 1.3; redondeado(g, x - w / 2, y - 8, w, 16, 5); g.stroke();
      g.fillStyle = color; g.textAlign = 'center'; g.fillText(txt, x, y + 3.6);
    } else {
      g.font = 'bold 9px "IBM Plex Mono", ui-monospace, monospace';
      g.fillStyle = color; g.textAlign = 'center'; g.fillText(txt, x, y + 3);
    }
    g.textAlign = 'left';
  }

  function dibujar() {
    const W = cont.clientWidth, H = cont.clientHeight;
    if (W < 40 || H < 40) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.textBaseline = 'alphabetic';
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);

    const total = S.velas.length;
    if (!total) return;
    const td = S.td || { bars: [], signals: [], tdstLineas: [], vivo: {} };

    const mDer = 60, mAba = 24;
    const x1 = W - mDer, y1 = H - mAba;
    const ancho = Math.max(24, Math.min(total, S.vista.ancho));
    const huecoMax = Math.floor(ancho * 0.18);
    const desp = Math.max(-huecoMax, Math.min(S.vista.desde, Math.max(0, total - ancho)));
    S.vista.desde = desp;
    const fin = total - desp;
    const primero = Math.max(0, fin - ancho);
    const vis = S.velas.slice(primero, Math.min(total, fin));
    if (!vis.length) return;
    const paso = x1 / ancho;
    const idxVis = (i) => (i - primero) * paso + paso / 2;


    // Rango vertical
    let alto = -Infinity, bajo = Infinity;
    for (const v of vis) { if (v.h > alto) alto = v.h; if (v.l < bajo) bajo = v.l; }
    const viv = td.vivo || {};
    [viv.tdstRes, viv.tdstSup, viv.siguiente && viv.siguiente.umbral].forEach((p) => { if (p != null && isFinite(p)) { if (p > alto) alto = p; if (p < bajo) bajo = p; } });
    if (!isFinite(alto) || !isFinite(bajo)) return;
    const rangoBase = (alto - bajo) || 1;
    const despY = ((S.vista.offsetY || 0) / Math.max(1, y1)) * rangoBase;
    const centro = (alto + bajo) / 2 + despY;
    const semi = (rangoBase / 2) * (S.vista.zoomY || 1);
    const pad = semi * 0.14 || 1;
    const pMax = centro + semi + pad, pMin = centro - semi - pad;
    const Y = (p) => y1 - y1 * ((p - pMin) / Math.max(1e-9, pMax - pMin));
    S._geo = { x1, y1, paso, pMin, pMax, Y, primero, fin, ancho };

    const now = performance.now();
    const pulso = 0.5 + 0.5 * Math.sin(now / 420);
    const dash = (now / 55) % 14;

    // Rejilla
    g.strokeStyle = 'rgba(255,255,255,.03)'; g.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const y = (y1 / 6) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); }

    // ── Lineas TDST ──
    const tdstLinea = (nivel, color, etq) => {
      if (nivel == null || !isFinite(nivel)) return;
      const y = Y(nivel); if (y < 2 || y > y1 - 2) return;
      g.strokeStyle = color + '88'; g.lineWidth = 1.2; g.setLineDash([2, 4]);
      g.beginPath(); g.moveTo(0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]);
      g.font = 'bold 8px "IBM Plex Mono", ui-monospace, monospace';
      const t = etq + ' ' + fmt(nivel); const w = g.measureText(t).width + 10;
      g.fillStyle = 'rgba(12,16,23,.9)'; redondeado(g, 4, y - 15, w, 13, 3); g.fill();
      g.fillStyle = color; g.textAlign = 'left'; g.fillText(t, 9, y - 5);
    };
    tdstLinea(viv.tdstRes, COL.res, 'TDST RES');
    tdstLinea(viv.tdstSup, COL.sup, 'TDST SUP');

    // ── Velas ──
    const cuerpo = Math.max(1.4, paso * 0.62);
    vis.forEach((v, i) => {
      const x = i * paso + paso / 2;
      const col = v.c >= v.o ? COL.up : COL.down;
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = Math.max(1, paso * 0.1);
      g.beginPath(); g.moveTo(x, Y(v.h)); g.lineTo(x, Y(v.l)); g.stroke();
      const yA = Y(Math.max(v.o, v.c)), yB = Y(Math.min(v.o, v.c));
      g.fillRect(x - cuerpo / 2, yA, cuerpo, Math.max(1.2, yB - yA));
    });

    // ── Cuentas TD (Setup 1 a 9, Countdown 1 a 13) ──
    const verNum = paso >= 7;
    vis.forEach((v, li) => {
      const i = primero + li; const b = td.bars[i]; if (!b) return;
      const x = li * paso + paso / 2;   // indice LOCAL: las cuentas quedan clavadas a su vela, no flotan
      if (b.setup && (verNum || b.setup.n === 9)) {
        const buyS = b.setup.dir === 'buy';
        const col = buyS ? COL.buy : COL.sell;
        const y = buyS ? Y(v.l) + 15 : Y(v.h) - 12;
        numEt(g, x, y, String(b.setup.n), col, b.setup.n === 9);
      }
      if (b.countdown && (verNum || b.countdown.n === 13)) {
        const buyC = b.countdown.dir === 'buy';
        const y = buyC ? Y(v.l) + 30 : Y(v.h) - 27;
        numEt(g, x, y, b.countdown.deferred ? '12+' : String(b.countdown.n), COL.cd, b.countdown.n === 13);
      }
      // flecha de giro en 9 y 13
      if (b.nine || b.thirteen) {
        const buyS = b.setup ? b.setup.dir === 'buy' : (b.countdown ? b.countdown.dir === 'buy' : true);
        const col = buyS ? COL.buy : COL.sell;
        const up = buyS;
        const yb = up ? Y(v.l) + (b.thirteen ? 44 : 30) : Y(v.h) - (b.thirteen ? 42 : 28);
        g.fillStyle = col; g.beginPath();
        if (up) { g.moveTo(x, yb - 6); g.lineTo(x - 5, yb + 2); g.lineTo(x + 5, yb + 2); }
        else { g.moveTo(x, yb + 6); g.lineTo(x - 5, yb - 2); g.lineTo(x + 5, yb - 2); }
        g.closePath(); g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
      }
    });

    // ── UMBRAL de la proxima vela (anti standby) ──
    const sg = viv.siguiente;
    if (sg && sg.umbral != null && isFinite(sg.umbral)) {
      const y = Y(sg.umbral);
      if (y > 2 && y < y1 - 2) {
        const col = sg.que === 'countdown' ? COL.cd : sg.que === 'setup' ? (sg.dir === 'buy' ? COL.buy : COL.sell) : COL.gold;
        const x0 = x1 * 0.5;
        g.save(); g.strokeStyle = col; g.globalAlpha = 0.5 + pulso * 0.4; g.lineWidth = 1.4; g.setLineDash([6, 4]); g.lineDashOffset = -dash;
        g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]); g.restore();
        // pildora con la instruccion
        let txt;
        if (sg.que === 'setup') txt = (sg.dir === 'buy' ? 'BUY' : 'SELL') + ' SETUP ' + sg.n + '/9 ' + String.fromCharCode(183) + ' next close ' + REL[sg.relacion] + ' ' + fmt(sg.umbral);
        else if (sg.que === 'countdown') txt = (sg.dir === 'buy' ? 'BUY' : 'SELL') + ' COUNTDOWN ' + sg.n + '/13 ' + String.fromCharCode(183) + ' next close ' + REL[sg.relacion] + ' ' + fmt(sg.umbral);
        else txt = 'NO COUNT ' + String.fromCharCode(183) + ' a close below ' + fmt(sg.umbral) + ' starts a buy setup';
        g.font = '800 9.5px "Chakra Petch", system-ui, sans-serif';
        const w = g.measureText(txt).width + 20, ph = 20;
        const px = clamp(x1 - w - 4, 4, x1 - w - 4), py = clamp(y - ph - 6, 4, y1 - ph - 4);
        g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 9;
        g.fillStyle = 'rgba(12,16,23,.96)'; redondeado(g, px, py, w, ph, 9); g.fill(); g.restore();
        g.strokeStyle = col; g.lineWidth = 1.1; redondeado(g, px, py, w, ph, 9); g.stroke();
        g.fillStyle = col; g.beginPath(); g.arc(px + 11, py + ph / 2, 3 + pulso * 0.9, 0, 6.283); g.fill();
        g.fillStyle = col; g.textAlign = 'left'; g.fillText(txt, px + 20, py + ph / 2 + 3.4);
      }
    }

    // ── Precio actual ──
    const yP = Y(S.precio);
    if (yP > 0 && yP < y1) { g.strokeStyle = `rgba(${COL.goldRGB},.8)`; g.setLineDash([5, 4]); g.lineWidth = 1.1; g.beginPath(); g.moveTo(0, yP); g.lineTo(x1, yP); g.stroke(); g.setLineDash([]); }

    // ── Escala de precios ──
    g.fillStyle = 'rgba(11,15,22,.96)'; g.fillRect(x1, 0, mDer, H);
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(x1 + .5, 0); g.lineTo(x1 + .5, H); g.stroke();
    g.font = '10px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'left';
    for (let i = 0; i <= 6; i++) { const p = pMin + (pMax - pMin) * (i / 6); const y = Y(p); if (Math.abs(y - yP) < 13) continue; g.fillStyle = COL.eje; g.fillText(fmt(p), x1 + 7, y + 3.4); }
    if (yP > 0 && yP < y1) { g.fillStyle = COL.gold; redondeado(g, x1 + 2, yP - 9, mDer - 5, 18, 4); g.fill(); g.fillStyle = '#2a1c00'; g.font = 'bold 10px "IBM Plex Mono", ui-monospace, monospace'; g.fillText(fmt(S.precio), x1 + 6, yP + 3.5); }

    // ── Cruz ──
    if (S.cruz && S.cruz.x >= 0 && S.cruz.x < x1 && S.cruz.y >= 0 && S.cruz.y < y1) {
      const cx = S.cruz.x, cy = S.cruz.y;
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, y1); g.stroke();
      g.beginPath(); g.moveTo(0, cy); g.lineTo(x1, cy); g.stroke(); g.setLineDash([]);
      const pC = pMin + (pMax - pMin) * ((y1 - cy) / y1);
      g.fillStyle = '#2b3139'; redondeado(g, x1 + 2, cy - 9, mDer - 5, 18, 4); g.fill();
      g.fillStyle = '#eaecef'; g.font = 'bold 10px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'left'; g.fillText(fmt(pC), x1 + 6, cy + 3.4);
      const iV = Math.floor(cx / paso); const vC = vis[iV];
      if (vC) { const et = S.diaria ? etFecha(vC.t) : etHora(vC.t); g.font = '10px "IBM Plex Mono", ui-monospace, monospace'; const w = g.measureText(et).width + 14; g.fillStyle = '#2b3139'; redondeado(g, clamp(cx - w / 2, 2, x1 - w - 2), y1 + 3, w, 18, 4); g.fill(); g.fillStyle = '#eaecef'; g.textAlign = 'center'; g.fillText(et, clamp(cx, w / 2 + 2, x1 - w / 2 - 2), y1 + 16); g.textAlign = 'left'; }
    }

    // ── Eje de fechas/horas ──
    g.fillStyle = 'rgba(11,15,22,.96)'; g.fillRect(0, y1, W, mAba);
    g.font = '9px "IBM Plex Mono", ui-monospace, monospace'; g.textAlign = 'center';
    if (S.diaria) {
      const cada = Math.max(1, Math.floor(vis.length / 8));
      vis.forEach((v, i) => { if (i % cada) return; const x = i * paso + paso / 2; if (x > x1 - 20) return; g.fillStyle = COL.eje; g.fillText(etFecha(v.t), x, y1 + 16); });
    } else {
      let diaPrev = null; const cada = Math.max(1, Math.floor(vis.length / 9));
      vis.forEach((v, i) => { const x = i * paso + paso / 2; if (x > x1 - 20) return; const esAp = etMin(v.t) === APERTURA; const dayId = Math.floor(v.t / 86400000); const nuevo = diaPrev !== null && dayId !== diaPrev; if (esAp || nuevo) { g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - paso / 2, 0); g.lineTo(x - paso / 2, y1); g.stroke(); g.fillStyle = COL.dim; g.fillText(etFecha(v.t), x, y1 + 16); } else if (i % cada === 0) { g.fillStyle = COL.eje; g.fillText(etHora(v.t), x, y1 + 16); } diaPrev = dayId; });
    }
    g.textAlign = 'left';
  }

  /* ══ GESTOS ══ */
  let pend = false;
  const refrescar = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; dibujar(); }); };
  const zoomX = (f) => { S.vista.ancho = Math.max(24, Math.min(600, Math.round(S.vista.ancho * f))); refrescar(); };
  const zoomY = (f) => { S.vista.zoomY = Math.max(0.3, Math.min(5, (S.vista.zoomY || 1) * f)); refrescar(); };
  const enEscala = (x) => x > cv.clientWidth - 64;
  const loc = (e, t) => { const r = cv.getBoundingClientRect(); const s = t || e; return { x: s.clientX - r.left, y: s.clientY - r.top }; };
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = loc(e); if (enEscala(p.x)) zoomY(e.deltaY > 0 ? 1.12 : 0.9); else zoomX(e.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });
  let arr = false, ax = 0, ay = 0, modo = 'libre';
  cv.addEventListener('mousedown', (e) => { if (e.button !== 0) return; const p = loc(e); modo = enEscala(p.x) ? 'y' : 'libre'; arr = true; ax = e.clientX; ay = e.clientY; cv.style.cursor = modo === 'y' ? 'ns-resize' : 'grabbing'; });
  cv.addEventListener('mousemove', (e) => { const p = loc(e); if (!arr) { S.cruz = { x: Math.round(p.x), y: Math.round(p.y) }; cv.style.cursor = enEscala(p.x) ? 'ns-resize' : 'crosshair'; refrescar(); } });
  cv.addEventListener('mouseleave', () => { S.cruz = null; refrescar(); });
  window.addEventListener('mousemove', (e) => {
    if (!arr) return;
    if (modo === 'y') { const dy = e.clientY - ay; if (Math.abs(dy) > 2) { zoomY(1 + dy * 0.004); ay = e.clientY; } return; }
    let cambio = false; const paso = (cv.clientWidth - 60) / S.vista.ancho;
    const d = Math.round((e.clientX - ax) / Math.max(1, paso));
    if (d !== 0) { const tope = Math.max(0, S.velas.length - S.vista.ancho) + Math.floor(S.vista.ancho * 0.6); const suelo = -Math.floor(S.vista.ancho * 0.6); S.vista.desde = Math.max(suelo, Math.min(tope, S.vista.desde + d)); ax = e.clientX; cambio = true; }
    const dy = e.clientY - ay; if (Math.abs(dy) > 1) { S.vista.offsetY = (S.vista.offsetY || 0) + dy; ay = e.clientY; cambio = true; }
    if (cambio) refrescar();
  });
  window.addEventListener('mouseup', () => { if (arr) { arr = false; cv.style.cursor = 'crosshair'; } });
  cv.addEventListener('dblclick', () => { S.vista.ancho = window.innerWidth < 760 ? 55 : 80; S.vista.desde = 0; S.vista.zoomY = 1; S.vista.offsetY = 0; refrescar(); });
  let d0 = 0, dy0 = 0, tx = 0, tarr = false;
  cv.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { tx = e.touches[0].clientX; tarr = true; } else if (e.touches.length === 2) { tarr = false; d0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); dy0 = Math.abs(e.touches[0].clientY - e.touches[1].clientY); } }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && tarr) { e.preventDefault(); const paso = (cv.clientWidth - 60) / S.vista.ancho; const d = Math.round((e.touches[0].clientX - tx) / Math.max(1, paso)); if (d !== 0) { const tope = Math.max(0, S.velas.length - S.vista.ancho) + Math.floor(S.vista.ancho * 0.6); const suelo = -Math.floor(S.vista.ancho * 0.6); S.vista.desde = Math.max(suelo, Math.min(tope, S.vista.desde + d)); tx = e.touches[0].clientX; refrescar(); } }
    else if (e.touches.length === 2 && d0 > 0) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const dy = Math.abs(e.touches[0].clientY - e.touches[1].clientY); if (dy > dy0 * 1.3 || dy0 > dy * 1.3) { zoomY(dy0 / Math.max(1, dy)); dy0 = dy; } else if (Math.abs(d - d0) > 8) { zoomX(d0 / d); } d0 = d; }
  }, { passive: false });
  cv.addEventListener('touchend', () => { tarr = false; d0 = 0; });
  const ro = new ResizeObserver(() => dibujar());
  ro.observe(cont);
  cv.style.cursor = 'crosshair';
  return { S, dibujar, refrescar, destruir() { try { ro.disconnect(); } catch (_) {} } };
}
