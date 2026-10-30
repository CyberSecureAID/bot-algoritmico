/* niveles/panel.js — Panel del indicador Marea (cápsula/tablero con el
   estado del ciclo y la confluencia). Recibe el contexto y los datos ya
   calculados. Extraído de niveles.js sin cambiar la lógica. */

import { N } from './estado.js?v=1';
import { fmt, redondeado } from './util.js?v=1';

export function panelMarea(g, MA, x1, W) {
  const P = MA.panel;
  const oro = '#E8B84B', oroSuave = 'rgba(232,184,75,.55)';
  const verde = '#2ee86a', rojo = '#FF0000';
  const apagado = '#39414b';

  const movil = x1 < 430;
  const PW = Math.min(movil ? 206 : 218, Math.max(148, x1 - (movil ? 18 : 16)));
  const px = Math.max(8, x1 - PW - 10);
  const py = 12;
  const pad = movil ? 11 : 13;
  const cx0 = px + pad;                 // margen izquierdo del contenido
  const anchoInt = PW - pad * 2;

  // Dirección dominante (la de más confluencia) y su estado
  const dom = P.long.pct >= P.short.pct ? 'long' : 'short';
  const D = dom === 'long' ? P.long : P.short;
  const colDom = dom === 'long' ? verde : rojo;

  // Chip de estado
  let chip, chipCol, chipTinta;
  if (MA.finde) { chip = 'FIN DE SEMANA'; chipCol = '#8b96a3'; chipTinta = '#0b0f16'; }
  else if (MA.lateral) { chip = MA.motivoLateral === 'banda' ? 'SIN RECORRIDO' : 'LATERAL'; chipCol = '#C9A84B'; chipTinta = '#2a1c00'; }
  else if (P.color === 1) { chip = 'LADO COMPRADOR'; chipCol = verde; chipTinta = '#04210f'; }
  else { chip = 'LADO VENDEDOR'; chipCol = rojo; chipTinta = '#FFD400'; }

  // ── Modo COLAPSADO: cápsula rectangular con solo "◈ MAREA · <estado>" ──
  if (N.mareaMin) {
    g.textBaseline = 'middle';
    g.font = 'bold 11px ui-monospace,monospace'; const w1 = g.measureText('◈ MAREA').width;
    g.font = 'bold 9px ui-monospace,monospace'; const w2 = g.measureText(chip).width;
    const capW = 14 + w1 + 10 + w2 + 26, capH = 26, capX = x1 - capW - 10, capY = 12;
    g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 14; g.shadowOffsetY = 4;
    const gr = g.createLinearGradient(0, capY, 0, capY + capH);
    gr.addColorStop(0, 'rgba(22,27,34,.97)'); gr.addColorStop(1, 'rgba(11,14,20,.97)');
    g.fillStyle = gr; redondeado(g, capX, capY, capW, capH, 9); g.fill(); g.restore();
    g.strokeStyle = oroSuave; g.lineWidth = 1.1; redondeado(g, capX, capY, capW, capH, 9); g.stroke();
    g.textAlign = 'left';
    g.fillStyle = oro; g.font = 'bold 11px ui-monospace,monospace'; g.fillText('◈ MAREA', capX + 12, capY + capH / 2 + 0.5);
    g.fillStyle = chipCol; g.font = 'bold 9px ui-monospace,monospace'; g.fillText('· ' + chip, capX + 12 + w1 + 6, capY + capH / 2 + 0.5);
    g.strokeStyle = '#8b96a3'; g.lineWidth = 1.6; const cvx = capX + capW - 14, cvy = capY + capH / 2;
    g.beginPath(); g.moveTo(cvx - 3, cvy - 2); g.lineTo(cvx, cvy + 2); g.lineTo(cvx + 3, cvy - 2); g.stroke();
    g.textBaseline = 'alphabetic';
    N._mareaBtn = { x: capX, y: capY, w: capW, h: capH };
    N._panelBox = { x: capX, y: capY, w: capW, h: capH };   // la línea solo evita la cápsula, no el panel entero
    return;
  }

  // Alto dinámico
  const yHead = py + pad + 4;
  const yRing = yHead + 20;
  const RING = movil ? 25 : 30;         // radio del anillo (menor en móvil)
  const ringB = yRing + RING * 2 + 16;  // fin del bloque de confluencia
  const yBars = ringB + 4;
  const PH = (yBars - py) + 2 * 40 + 22;   // 40 por barra (pct+barra+falta) + zona de pie

  // ── Fondo: negro con un degradado sutil y borde dorado ──
  g.save();
  g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 18; g.shadowOffsetY = 5;
  const grad = g.createLinearGradient(0, py, 0, py + PH);
  grad.addColorStop(0, 'rgba(22,27,34,.96)');
  grad.addColorStop(1, 'rgba(11,14,20,.96)');
  g.fillStyle = grad;
  redondeado(g, px, py, PW, PH, 13); g.fill();
  g.restore();
  g.strokeStyle = oroSuave; g.lineWidth = 1.2;
  redondeado(g, px, py, PW, PH, 13); g.stroke();

  // Marcas de esquina tipo instrumento (look "caro")
  g.strokeStyle = oro; g.lineWidth = 1.4;
  const mc = 9, off = 6;
  const esquina = (ex, ey, dx, dy) => {
    g.beginPath();
    g.moveTo(ex + dx * off, ey + dy * off + dy * mc);
    g.lineTo(ex + dx * off, ey + dy * off);
    g.lineTo(ex + dx * off + dx * mc, ey + dy * off);
    g.stroke();
  };
  esquina(px, py, 1, 1); esquina(px + PW, py, -1, 1);
  esquina(px, py + PH, 1, -1); esquina(px + PW, py + PH, -1, -1);

  // ── Cabecera: marca + chip de estado ──
  g.textAlign = 'left';
  g.font = 'bold 11px ui-monospace,monospace';
  g.fillStyle = oro;
  g.fillText('◈ MAREA', cx0, yHead);
  // chevron para colapsar (junto al título)
  { const tw = g.measureText('◈ MAREA').width; g.strokeStyle = '#8b96a3'; g.lineWidth = 1.6; const cvx = cx0 + tw + 9, cvy = yHead - 3; g.beginPath(); g.moveTo(cvx - 3, cvy - 2); g.lineTo(cvx, cvy + 2); g.lineTo(cvx + 3, cvy - 2); g.stroke(); N._mareaBtn = { x: px, y: py, w: tw + 26, h: 24 }; }
  // chip a la derecha
  g.font = 'bold 8px ui-monospace,monospace';
  const cw = g.measureText(chip).width + 12;
  const chx = px + PW - pad - cw, chy = yHead - 10;
  g.fillStyle = chipCol;
  redondeado(g, chx, chy, cw, 15, 4); g.fill();
  g.fillStyle = chipTinta;
  g.fillText(chip, chx + 6, chy + 10.5);

  // Línea divisoria fina
  g.strokeStyle = 'rgba(232,184,75,.22)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx0, yHead + 8); g.lineTo(px + PW - pad, yHead + 8); g.stroke();

  // ── Anillo de CONFLUENCIA (5 segmentos) ──
  const cx = cx0 + RING + 2;
  const cy = yRing + RING;
  const score = D.cumplidos;            // 0..5 de la dirección dominante
  const seg = (Math.PI * 2) / 5;
  const gap = 0.16;
  for (let i = 0; i < 5; i++) {
    const a0 = -Math.PI / 2 + i * seg + gap / 2;
    const a1 = -Math.PI / 2 + (i + 1) * seg - gap / 2;
    g.beginPath();
    g.arc(cx, cy, RING - 4, a0, a1);
    g.lineWidth = 6; g.lineCap = 'round';
    const encendido = i < score;        // siempre según la confluencia real
    g.strokeStyle = encendido ? colDom : 'rgba(255,255,255,.09)';
    if (encendido) { g.shadowColor = colDom; g.shadowBlur = 8; } else { g.shadowBlur = 0; }
    g.stroke();
  }
  g.shadowBlur = 0; g.lineCap = 'butt';
  // Centro del anillo: solo el número de confluencia
  g.textAlign = 'center';
  g.fillStyle = score > 0 ? '#f2f4f6' : '#5a636e';
  g.font = 'bold ' + (RING >= 28 ? 22 : 18) + 'px ui-monospace,monospace';
  g.fillText(String(score), cx, cy + (RING >= 28 ? 6 : 5));
  // Etiqueta bajo el anillo: la dirección con más confluencia
  g.font = 'bold 8px ui-monospace,monospace';
  g.fillStyle = colDom;
  g.fillText(dom === 'long' ? 'CONFLUENCIA ▲' : 'CONFLUENCIA ▼', cx, cy + RING + 8);

  // ── Sensores de los indicadores internos ──
  const sx = cx + RING + 12;
  const sw = px + PW - pad - sx;
  const met = D.met;
  const sensores = [
    { et: 'HA',  ok: met.giroHA,     val: (P.color === 1 ? 'verde' : 'roja') + ' ×' + P.runLen },
    { et: 'ADX', ok: met.fuerza,     val: P.adx.toFixed(0) + (P.diMas >= P.diMenos ? ' ▲' : ' ▼') },
    { et: 'VOL', ok: met.volumen,    val: (P.volRel > 0 ? P.volRel.toFixed(1) : '0.0') + '×' },
    { et: 'EST', ok: met.ruptura,    val: met.ruptura ? 'rota' : 'intacta' },
    { et: 'CIC', ok: met.cicloPrevio, val: 'ciclo ×' + P.runLen }
  ];
  const sh = ((RING * 2) - 2) / 5;      // reparte la altura del anillo
  g.textAlign = 'left';
  sensores.forEach((s, i) => {
    const yy = yRing + i * sh + sh / 2;
    // lucecita: encendida en dorado si el confirmador se cumple
    const on = s.ok;
    g.beginPath(); g.arc(sx + 4, yy, 3.2, 0, Math.PI * 2);
    if (on) { g.fillStyle = oro; g.shadowColor = oro; g.shadowBlur = 7; }
    else { g.fillStyle = apagado; g.shadowBlur = 0; }
    g.fill(); g.shadowBlur = 0;
    // etiqueta
    g.font = 'bold 8.5px ui-monospace,monospace';
    g.fillStyle = on ? '#eaecef' : '#7d8794';
    g.fillText(s.et, sx + 12, yy + 3);
    // valor a la derecha
    g.textAlign = 'right';
    g.fillStyle = on ? '#aeb6bf' : '#6b7480';
    g.font = '8.5px ui-monospace,monospace';
    g.fillText(s.val, px + PW - pad, yy + 3);
    g.textAlign = 'left';
  });

  // ── Barras LONG / SHORT ──
  let y = yBars;
  const fila = (etq, dato, color, alc) => {
    g.font = 'bold 10px ui-monospace,monospace';
    g.fillStyle = color;
    g.fillText(etq, cx0, y + 9);
    g.textAlign = 'right';
    g.fillStyle = '#eaecef';
    g.fillText(dato.pct + '%', px + PW - pad, y + 9);
    g.textAlign = 'left';
    y += 14;
    // barra con degradado — siempre con su color
    const bh = 6;
    g.fillStyle = 'rgba(255,255,255,.07)';
    redondeado(g, cx0, y, anchoInt, bh, 3); g.fill();
    const rell = Math.max(0, Math.min(1, dato.pct / 100)) * anchoInt;
    if (rell > 2) {
      const gb = g.createLinearGradient(cx0, 0, cx0 + rell, 0);
      gb.addColorStop(0, alc ? 'rgba(46,232,106,.55)' : 'rgba(255,60,80,.55)');
      gb.addColorStop(1, color);
      g.fillStyle = gb;
      redondeado(g, cx0, y, rell, bh, 3); g.fill();
    }
    y += bh + 5;
    // cuánto falta
    g.font = '8.5px ui-monospace,monospace';
    g.fillStyle = '#7d8794';
    let txt;
    if (MA.finde) txt = 'en pausa hasta el lunes';
    else if (dato.falta <= 0) txt = alc ? 'nivel ya superado' : 'nivel ya perdido';
    else txt = `${alc ? 'supera' : 'pierde'} ${fmt(dato.nivel)} (${alc ? '+' : '−'}${dato.falta.toFixed(2)}%)`;
    g.fillText(txt, cx0, y + 6);
    y += 15;
  };
  fila('LONG', P.long, verde, true);
  fila('SHORT', P.short, rojo, false);

  // ── Pie ──
  g.font = '7px ui-monospace,monospace';
  g.fillStyle = '#4a525c';
  g.fillText('confluencia de requisitos, no predicción', cx0, py + PH - 9);

  // Guardamos el recuadro del panel para colocar las marcas PRÓX sin que
  // el panel las tape (se dibujan después, ya sabiendo dónde está).
  N._panelBox = { x: px, y: py, w: PW, h: PH };
}
