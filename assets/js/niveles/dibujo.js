/* niveles/dibujo.js — Herramientas de dibujo de Smart Levels.
   Convierte coordenadas (tiempo/precio <-> pixeles) y pinta cada
   herramienta del usuario (líneas, fibonacci, posiciones, texto,
   marcadores, regla…). Extraído de niveles.js sin cambiar la lógica. */

import { N } from './estado.js?v=1';
import { fmt, redondeado, _hex2rgb } from './util.js?v=1';

export const DIB_FIBS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
export const _tfMs = () => {
  const v = N.velas;
  if (!v || v.length < 2) return 3600000;
  return (v[v.length - 1].t - v[v.length - 2].t) || 3600000;
};
// dato (t,p) → pantalla (x,y)
export function dibAxy(pt) {
  const g = N._geo; if (!g || !N.velas.length) return { x: 0, y: 0 };
  const i = (pt.t - N.velas[0].t) / _tfMs();
  const pri = g.fin - g.ancho;
  return { x: (i - pri) * g.paso + g.paso / 2, y: g.Y(pt.p) };
}
// pantalla (x,y) → dato (t,p), con imán opcional al OHLC de la vela
export function dibXYa(x, y, iman) {
  const g = N._geo; if (!g || !N.velas.length) return { t: 0, p: 0 };
  const pri = g.fin - g.ancho;
  const iF = (x - g.paso / 2) / g.paso + pri;
  if (iman && N.imant) {
    const i = Math.max(0, Math.min(N.velas.length - 1, Math.round(iF)));
    const v = N.velas[i];
    let p = v.c, best = Infinity;
    [v.o, v.h, v.l, v.c].forEach((c) => { const dd = Math.abs(g.Y(c) - y); if (dd < best) { best = dd; p = c; } });
    if (best <= 18) return { t: N.velas[0].t + i * _tfMs(), p };
  }
  return { t: N.velas[0].t + iF * _tfMs(), p: g.pMin + (g.pMax - g.pMin) * ((g.y1 - y) / g.y1) };
}

function dibujarUno(g, d, x1, y1, sel) {
  const col = d.color || '#22d3ee';
  const rgb = d.rgb || '34,211,238';
  const gr = d.grosor || 2;
  const dash = d.punteado ? [7, 5] : [];
  const A = d.pts[0] ? dibAxy(d.pts[0]) : null;
  const B = d.pts[1] ? dibAxy(d.pts[1]) : null;
  g.lineJoin = 'round'; g.lineCap = 'round'; g.textAlign = 'left';
  const anclas = (arr) => { if (!sel) return; arr.forEach((P) => { g.fillStyle = '#fff'; g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(P.x, P.y, 4.5, 0, 6.283); g.fill(); g.stroke(); }); };

  if (d.tipo === 'linea' || d.tipo === 'flecha') {
    if (!A || !B) return;
    g.shadowColor = `rgba(${rgb},.55)`; g.shadowBlur = 6;
    g.strokeStyle = col; g.lineWidth = gr; g.setLineDash(dash);
    g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
    g.setLineDash([]); g.shadowBlur = 0;
    if (d.tipo === 'flecha') {
      const ang = Math.atan2(B.y - A.y, B.x - A.x), h = 8 + gr * 2;
      g.fillStyle = col; g.beginPath(); g.moveTo(B.x, B.y);
      g.lineTo(B.x - h * Math.cos(ang - 0.42), B.y - h * Math.sin(ang - 0.42));
      g.lineTo(B.x - h * Math.cos(ang + 0.42), B.y - h * Math.sin(ang + 0.42));
      g.closePath(); g.fill();
      anclas([A, B]);
    } else {
      [A, B].forEach((P) => { g.fillStyle = col; g.beginPath(); g.arc(P.x, P.y, 3, 0, 6.283); g.fill(); });
      anclas([A, B]);
    }
  } else if (d.tipo === 'rayo') {
    if (!A) return;
    g.strokeStyle = col; g.lineWidth = gr; g.setLineDash(d.punteado === false ? [] : [7, 4]);
    g.beginPath(); g.moveTo(0, A.y); g.lineTo(x1, A.y); g.stroke(); g.setLineDash([]);
    g.font = 'bold 9px ui-monospace,monospace';
    const et = fmt(d.pts[0].p); const tw = g.measureText(et).width + 10;
    g.fillStyle = col; redondeado(g, x1 - tw - 2, A.y - 8, tw, 16, 4); g.fill();
    g.fillStyle = '#04121a'; g.fillText(et, x1 - tw + 3, A.y + 3.5);
    anclas([{ x: A.x, y: A.y }]);
  } else if (d.tipo === 'vert') {
    if (!A) return;
    g.strokeStyle = col; g.lineWidth = gr; g.setLineDash(d.punteado === false ? [] : [7, 4]);
    g.beginPath(); g.moveTo(A.x, 0); g.lineTo(A.x, y1); g.stroke(); g.setLineDash([]);
    anclas([{ x: A.x, y: A.y }]);
  } else if (d.tipo === 'rect') {
    if (!A || !B) return;
    const x = Math.min(A.x, B.x), y = Math.min(A.y, B.y), w = Math.abs(B.x - A.x), h = Math.abs(B.y - A.y);
    g.fillStyle = `rgba(${rgb},.10)`; g.fillRect(x, y, w, h);
    g.strokeStyle = col; g.lineWidth = gr; g.setLineDash(dash); g.strokeRect(x, y, w, h); g.setLineDash([]);
    anclas([A, B]);
  } else if (d.tipo === 'fib') {
    if (!A || !B) return;
    const p0 = d.pts[0].p, p1 = d.pts[1].p;
    const niveles = d.niveles || DIB_FIBS;
    const x = Math.min(A.x, B.x), w = Math.abs(B.x - A.x) || (x1 - x);
    niveles.forEach((f, k) => {
      const pf = p0 + (p1 - p0) * f, yf = N._geo.Y(pf);
      const cc = d.colores ? (d.colores[k] || col) : `hsl(${18 + k * 33},82%,62%)`;
      g.strokeStyle = cc; g.lineWidth = 1.2; g.globalAlpha = d.intensidad || 1;
      g.beginPath(); g.moveTo(x, yf); g.lineTo(x + w, yf); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = cc; g.font = '8.5px ui-monospace,monospace';
      g.fillText(`${(f * 100).toFixed(1)}%  ${fmt(pf)}`, x + 4, yf - 3);
    });
    g.strokeStyle = `rgba(${rgb},.5)`; g.lineWidth = 1;
    g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(A.x, B.y); g.stroke();
    anclas([A, B]);
  } else if (d.tipo === 'brush') {
    if (d.pts.length < 2) { if (A) { g.fillStyle = col; g.beginPath(); g.arc(A.x, A.y, gr * 0.7, 0, 6.283); g.fill(); } return; }
    g.shadowColor = `rgba(${rgb},.4)`; g.shadowBlur = 4;
    g.strokeStyle = col; g.lineWidth = gr + 0.4; g.beginPath();
    d.pts.forEach((pt, k) => { const P = dibAxy(pt); if (k === 0) g.moveTo(P.x, P.y); else g.lineTo(P.x, P.y); });
    g.stroke(); g.shadowBlur = 0;
  } else if (d.tipo === 'marca') {
    if (!A) return;
    const rr = Math.max(13, d.tam ? d.tam + 6 : 15);
    // relleno translúcido del color + borde sólido del mismo color (se ve llamativo sin tapar)
    g.save();
    g.shadowColor = `rgba(${rgb},.5)`; g.shadowBlur = 8;
    g.fillStyle = `rgba(${rgb},.32)`; g.beginPath(); g.arc(A.x, A.y, rr, 0, 6.283); g.fill();
    g.restore();
    g.strokeStyle = col; g.lineWidth = 2.4; g.beginPath(); g.arc(A.x, A.y, rr, 0, 6.283); g.stroke();
    // número dentro, siempre legible: relleno del color + halo oscuro de contraste
    const nn = String(d._n || 1);
    g.font = `900 ${Math.round(rr * 1.2)}px "Chakra Petch", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = Math.max(3, rr * 0.34);
    g.strokeStyle = 'rgba(11,15,22,.92)'; g.strokeText(nn, A.x, A.y + rr * 0.06);
    g.fillStyle = col; g.fillText(nn, A.x, A.y + rr * 0.06);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    if (sel) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(A.x, A.y, rr + 4, 0, 6.283); g.stroke(); }
  } else if (d.tipo === 'texto') {
    if (!A) return;
    const fs = d.tam || 13;
    g.font = `bold ${fs}px "Plus Jakarta Sans", system-ui, sans-serif`;
    const tw = g.measureText(d.txt || '…').width;
    const bh = fs + 10, by = A.y - Math.round(fs * 0.82);
    d._w = tw + 14; d._fs = fs;
    g.fillStyle = 'rgba(11,15,22,.82)'; redondeado(g, A.x - 5, by, tw + 14, bh, 6); g.fill();
    g.strokeStyle = `rgba(${rgb},.55)`; g.lineWidth = 1; redondeado(g, A.x - 5, by, tw + 14, bh, 6); g.stroke();
    g.fillStyle = col; g.textAlign = 'left'; g.fillText(d.txt || '…', A.x + 2, A.y + Math.round(fs * 0.30));
    if (sel) { g.strokeStyle = '#fff'; g.lineWidth = 1.4; redondeado(g, A.x - 5, by, tw + 14, bh, 6); g.stroke(); }
  } else if (d.tipo === 'regla') {
    if (!A || !B) return;
    const alza = d.pts[1].p >= d.pts[0].p;
    const cc = alza ? '#2ee86a' : '#ff3b52', crgb = alza ? '46,232,106' : '255,59,82';
    const x = Math.min(A.x, B.x), y = Math.min(A.y, B.y), w = Math.abs(B.x - A.x), h = Math.abs(B.y - A.y);
    g.fillStyle = `rgba(${crgb},.12)`; g.fillRect(x, y, w, h);
    g.strokeStyle = cc; g.lineWidth = 1.4; g.setLineDash([5, 4]); g.strokeRect(x, y, w, h); g.setLineDash([]);
    g.strokeStyle = cc; g.lineWidth = 1.6; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
    anclas([A, B]);
    // ── Datos DENTRO de la proyección: pegados al extremo, tarjeta bonita ──
    const dp = ((d.pts[1].p - d.pts[0].p) / d.pts[0].p) * 100;
    const velas = Math.abs(Math.round((d.pts[1].t - d.pts[0].t) / _tfMs()));
    const dias = Math.abs(d.pts[1].t - d.pts[0].t) / 86400000;
    const tTxt = dias >= 1 ? `${dias.toFixed(dias < 10 ? 1 : 0)} d` : `${Math.round(dias * 24)} h`;
    tarjetaMedida(g, x, y, w, h, alza, cc, crgb, `${dp >= 0 ? '+' : ''}${dp.toFixed(2)}%`,
      [['VELAS', String(velas)], ['TIEMPO', tTxt]], x1, y1);
  } else if (d.tipo === 'poslarga' || d.tipo === 'poscorta') {
    if (!A || !B) return;
    const largo = d.tipo === 'poslarga';
    const pe = d.pts[0].p;
    const pT = (d.pTarget != null) ? d.pTarget : pe * (largo ? 1.01 : 0.99);
    const pS = (d.pStop != null) ? d.pStop : pe - (pT - pe) * 0.5;
    const ye = A.y, yt = N._geo.Y(pT), ys = N._geo.Y(pS);
    const x = Math.min(A.x, B.x), w = Math.abs(B.x - A.x) || 130;
    const gr = d.grosor || 2, inten = d.intensidad != null ? d.intensidad : 1;
    const cT = d.cTarget || '#2ee86a', cE = d.cEntry || '#eaecef', cS = d.cStop || '#ff3b52';
    const rgbT = _hex2rgb(cT), rgbS = _hex2rgb(cS);
    // zonas de ganancia/riesgo (intensidad ajustable)
    g.fillStyle = `rgba(${rgbT},${(0.16 * inten).toFixed(3)})`; g.fillRect(x, Math.min(ye, yt), w, Math.abs(yt - ye));
    g.fillStyle = `rgba(${rgbS},${(0.16 * inten).toFixed(3)})`; g.fillRect(x, Math.min(ye, ys), w, Math.abs(ys - ye));
    // 3 líneas: objetivo, entrada, stop (color y grosor propios)
    [[cT, yt], [cE, ye], [cS, ys]].forEach((r) => {
      g.strokeStyle = r[0]; g.lineWidth = sel ? gr + 0.6 : gr; g.beginPath(); g.moveTo(x, r[1]); g.lineTo(x + w, r[1]); g.stroke();
      if (sel) { g.fillStyle = '#fff'; g.strokeStyle = r[0]; g.lineWidth = 2; [x, x + w].forEach((xx) => { g.beginPath(); g.arc(xx, r[1], 4, 0, 6.283); g.fill(); g.stroke(); }); }
    });
    d._pos = { x, w, yt, ye, ys };   // referencia para editar bordes (arrastre horizontal)
    const gPct = ((pT - pe) / pe) * 100, rPct = ((pS - pe) / pe) * 100;
    const rr = Math.abs(rPct) > 0 ? Math.abs(gPct / rPct) : 0;
    const acc = largo ? '#2ee86a' : '#ff3b52', accRGB = largo ? '46,232,106' : '255,59,82';

    // ── Mini-cuadro cuando está oculta (clic para volver a mostrar) ──
    if (d.oculto) {
      const mp = _anclaTarjeta(d.cardPos, x, w, yt, ye, ys, 20, 20, x1, y1);
      g.save(); g.shadowColor = `rgba(${accRGB},.55)`; g.shadowBlur = 9;
      g.fillStyle = acc; redondeado(g, mp.cx, mp.cy, 20, 20, 6); g.fill(); g.restore();
      g.fillStyle = '#0b0f16'; g.font = '800 12px "Chakra Petch",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(largo ? 'L' : 'S', mp.cx + 10, mp.cy + 10.5); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      d._miniBtn = { x: mp.cx, y: mp.cy, w: 20, h: 20 }; d._hideBtn = d._arrL = d._arrR = null;
      g.shadowBlur = 0; g.globalAlpha = 1; return;
    }
    d._miniBtn = null;

    // ── Tarjeta de presentación ──
    const cw = 226, ch = 140;
    const cyMid = (Math.min(yt, ye, ys) + Math.max(yt, ye, ys)) / 2;
    const ap = _anclaTarjeta(d.cardPos, x, w, yt, ye, ys, cw, ch, x1, y1);
    const cx = ap.cx, cy = ap.cy;
    g.save(); g.shadowColor = 'rgba(0,0,0,.62)'; g.shadowBlur = 22;
    g.fillStyle = 'rgba(12,16,23,.97)'; redondeado(g, cx, cy, cw, ch, 16); g.fill(); g.restore();
    g.strokeStyle = `rgba(${accRGB},.45)`; g.lineWidth = 1.2; redondeado(g, cx, cy, cw, ch, 16); g.stroke();
    g.fillStyle = acc; redondeado(g, cx, cy + 14, 4, ch - 28, 2); g.fill();
    g.textAlign = 'left';
    g.fillStyle = acc; g.font = '800 11px "Chakra Petch", system-ui, sans-serif';
    g.fillText(largo ? 'POSICIÓN LARGA' : 'POSICIÓN CORTA', cx + 16, cy + 23);
    // botón Hide (arriba a la derecha)
    const hb = { x: cx + cw - 30, y: cy + 10, w: 20, h: 16 };
    g.fillStyle = 'rgba(255,255,255,.07)'; redondeado(g, hb.x, hb.y, hb.w, hb.h, 5); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(hb.x + 5, hb.y + 8); g.lineTo(hb.x + 15, hb.y + 8); g.stroke();   // icono "–" (hide)
    d._hideBtn = hb;
    const colX = cx + 16;
    // TAKE PROFIT
    g.fillStyle = '#79838f'; g.font = 'bold 9px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillText('TAKE PROFIT', colX, cy + 46);
    g.save(); g.shadowColor = 'rgba(46,232,106,.65)'; g.shadowBlur = 14;
    g.fillStyle = cT; g.font = '800 29px "Chakra Petch", system-ui, sans-serif';
    g.fillText(`+${Math.abs(gPct).toFixed(2)}%`, colX, cy + 75); g.restore();
    // STOP LOSS (rojo intenso)
    g.fillStyle = '#79838f'; g.font = 'bold 9px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillText('STOP LOSS', colX, cy + 99);
    g.save(); g.shadowColor = `rgba(${rgbS},.65)`; g.shadowBlur = 14;
    g.fillStyle = cS; g.font = '800 25px "Chakra Petch", system-ui, sans-serif';
    g.fillText(`−${Math.abs(rPct).toFixed(2)}%`, colX, cy + 125); g.restore();
    // R:R a la derecha, divisor bien separado del número
    const rx = cx + cw - 42, divX = cx + cw - 78;
    g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(divX, cy + 40); g.lineTo(divX, cy + ch - 34); g.stroke();
    g.textAlign = 'center';
    g.fillStyle = '#79838f'; g.font = 'bold 9px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillText('R : R', rx, cy + 58);
    g.save(); g.shadowColor = 'rgba(232,184,75,.55)'; g.shadowBlur = 12;
    g.fillStyle = '#E8B84B'; g.font = '800 30px "Chakra Petch", system-ui, sans-serif';
    g.fillText(rr.toFixed(1), rx, cy + 90); g.restore();
    // flechas ← → debajo del R:R para reubicar la tarjeta
    const ay2 = cy + ch - 20;
    const alF = { x: rx - 24, y: ay2 - 9, w: 18, h: 18 }, arF = { x: rx + 6, y: ay2 - 9, w: 18, h: 18 };
    [[alF, -1], [arF, 1]].forEach((f) => {
      g.fillStyle = 'rgba(255,255,255,.06)'; redondeado(g, f[0].x, f[0].y, 18, 18, 5); g.fill();
      g.strokeStyle = '#aeb6bf'; g.lineWidth = 1.6; g.beginPath();
      const mx = f[0].x + 9, my = f[0].y + 9;
      if (f[1] < 0) { g.moveTo(mx + 3, my - 4); g.lineTo(mx - 3, my); g.lineTo(mx + 3, my + 4); }
      else { g.moveTo(mx - 3, my - 4); g.lineTo(mx + 3, my); g.lineTo(mx - 3, my + 4); }
      g.stroke();
    });
    d._arrL = alF; d._arrR = arF;
    g.textAlign = 'left';
  }
  g.shadowBlur = 0; g.globalAlpha = 1;
}

/* Ancla de la tarjeta/mini según el lado elegido (der/izq/arriba/abajo) */
function _anclaTarjeta(pos, x, w, yt, ye, ys, cw, ch, x1, y1) {
  const yTop = Math.min(yt, ye, ys), yBot = Math.max(yt, ye, ys), cyMid = (yTop + yBot) / 2;
  let cx, cy;
  pos = pos || 'der';
  if (pos === 'izq') { cx = x - cw - 12; cy = cyMid - ch / 2; }
  else if (pos === 'arriba') { cx = x + w / 2 - cw / 2; cy = yTop - ch - 10; }
  else if (pos === 'abajo') { cx = x + w / 2 - cw / 2; cy = yBot + 10; }
  else { cx = x + w + 12; cy = cyMid - ch / 2; }   // 'der' por defecto
  cx = Math.max(4, Math.min(x1 - cw - 4, cx));
  cy = Math.max(4, Math.min(y1 - ch - 4, cy));
  return { cx, cy };
}

/* Tarjeta de la regla, pegada a la proyección (arriba si sube, abajo si baja) */
function tarjetaMedida(g, x, y, w, h, alza, cc, crgb, pct, pills, x1, y1) {
  const cw = 194, chh = 86;
  let cx = x + w / 2 - cw / 2; cx = Math.max(4, Math.min(x1 - cw - 4, cx));
  let cy = alza ? y - chh - 8 : y + h + 8;
  if (cy < 4) cy = y + h + 8; if (cy + chh > y1 - 4) cy = Math.max(4, y - chh - 8);
  g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 20;
  g.fillStyle = 'rgba(12,16,23,.97)'; redondeado(g, cx, cy, cw, chh, 15); g.fill(); g.restore();
  g.strokeStyle = `rgba(${crgb},.5)`; g.lineWidth = 1.2; redondeado(g, cx, cy, cw, chh, 15); g.stroke();
  g.fillStyle = cc; redondeado(g, cx, cy + 13, 4, chh - 26, 2); g.fill();   // franja de acento
  // Porcentaje ENORME con luz del color
  g.save();
  g.shadowColor = `rgba(${crgb},.8)`; g.shadowBlur = 16;
  g.fillStyle = cc; g.font = '800 44px "Chakra Petch", system-ui, sans-serif'; g.textAlign = 'left';
  g.fillText(pct, cx + 16, cy + 50); g.restore();
  // Pastillas de velas / tiempo, con la etiqueta y el valor bien separados
  let px = cx + 16; const py = cy + 60;
  pills.forEach((p) => {
    g.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
    const wLab = (() => { g.font = 'bold 8px "Plus Jakarta Sans", system-ui, sans-serif'; return g.measureText(p[0]).width; })();
    g.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
    const wVal = g.measureText(p[1]).width;
    const wv = wLab + wVal + 28;   // etiqueta + separación + valor + margen
    g.fillStyle = 'rgba(255,255,255,.06)'; redondeado(g, px, py, wv, 22, 7); g.fill();
    g.textAlign = 'left';
    g.fillStyle = '#79838f'; g.font = 'bold 8px "Plus Jakarta Sans", system-ui, sans-serif';
    g.fillText(p[0], px + 10, py + 14.5);
    g.fillStyle = '#eef2f6'; g.font = 'bold 13px "Plus Jakarta Sans", system-ui, sans-serif';
    g.fillText(p[1], px + 10 + wLab + 8, py + 15);
    px += wv + 8;
  });
}

export function dibujarHerramientas(g, x1, y1) {
  const lista = N.dibujos || [];
  if (!lista.length && !N.dib && !N.gomaBox) return;
  g.save();
  g.beginPath(); g.rect(0, 0, x1, y1); g.clip();
  let _mk = 0; lista.forEach((d) => { if (d.tipo === 'marca') d._n = ++_mk; });
  lista.forEach((d, i) => dibujarUno(g, d, x1, y1, i === N.sel));
  if (N.dib) dibujarUno(g, N.dib, x1, y1, false);
  if (N.gomaBox) {
    const b = N.gomaBox;
    g.fillStyle = 'rgba(255,59,82,.12)'; g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    g.strokeStyle = 'rgba(255,80,100,.9)'; g.lineWidth = 1.4; g.setLineDash([6, 4]);
    g.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.setLineDash([]);
  }
  g.restore();
  g.textAlign = 'left';
}

/* Persistencia de los dibujos del usuario en localStorage, por par. */
export function guardarDib() {
  try {
    const m = JSON.parse(localStorage.getItem('cco-dibujos') || '{}');
    m[N.par] = N.dibujos || [];
    localStorage.setItem('cco-dibujos', JSON.stringify(m));
  } catch (_) {}
}
export function cargarDib() {
  try {
    const m = JSON.parse(localStorage.getItem('cco-dibujos') || '{}');
    N.dibujos = Array.isArray(m[N.par]) ? m[N.par] : [];
  } catch (_) { N.dibujos = []; }
}
