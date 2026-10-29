/* niveles/imagen.js — Exporta la gráfica actual como PNG (con marca de
   agua, par y temporalidad). Extraído de niveles.js; ahora recibe par y
   tf por parámetro en vez de leer las variables del módulo. */

import { N } from './estado.js?v=1';
import { fmt, redondeado } from './util.js?v=1';

const $ = (id) => document.getElementById(id);
const nombreTend = (d) => ({ alcista: 'bullish', bajista: 'bearish', lateral: 'sideways', indefinida: 'undefined' }[d] || d);

export function guardarImagen(par, tf) {
  const cv = $('nv-cv'); if (!cv) return;

  /* ══════════════════════════════════════════════════════════
     LA IMAGEN PARA COMPARTIR

     [MEJORADO] Antes solo salía el lienzo del gráfico. Ahora se
     compone la pieza completa: cabecera con el par y el precio,
     las píldoras del análisis, la gráfica y la franja de marca.

     Es la publicidad de la herramienta: quien la reciba tiene que
     ver qué es y de dónde salió.
     ══════════════════════════════════════════════════════════ */
  const marca = document.querySelector('.nv-marca');
  const antes = marca ? marca.style.display : null;
  if (marca) marca.style.display = 'none';
  const devolver = () => { if (marca) marca.style.display = antes || ''; };

  try {
    const e2 = cv.width / cv.clientWidth;
    const W = cv.width;
    const hCab = 66 * e2;          // cabecera
    const hAna = N.mensajes && N.mensajes.length ? 78 * e2 : 0;
    const hPie = 82 * e2;          // franja de marca
    const out = document.createElement('canvas');
    out.width = W;
    out.height = hCab + cv.height + hAna + hPie;
    const g = out.getContext('2d');

    g.fillStyle = '#0b0f16';
    g.fillRect(0, 0, out.width, out.height);

    /* ── Cabecera: par, marco y precio ── */
    g.fillStyle = '#0a0d13';
    g.fillRect(0, 0, W, hCab);
    g.fillStyle = 'rgba(255,255,255,.06)';
    g.fillRect(0, hCab - 1, W, 1);

    g.textAlign = 'left';
    g.fillStyle = '#eaecef';
    g.font = `800 ${23 * e2}px system-ui,sans-serif`;
    g.fillText(par, 20 * e2, 40 * e2);

    const anchoPar = g.measureText(par).width;
    g.font = `700 ${13 * e2}px ui-monospace,monospace`;
    g.fillStyle = '#7d8794';
    g.fillText(tf.toUpperCase(), 20 * e2 + anchoPar + 12 * e2, 40 * e2);

    // La tendencia
    const t = N.tendencia || { dir: 'lateral' };
    const colT = t.dir === 'alcista' ? '#3ee88a' : t.dir === 'bajista' ? '#ff6b7a' : '#9aa5b1';
    const etT = (N.rango ? 'IN RANGE' : nombreTend(t.dir).toUpperCase());
    g.font = `700 ${11 * e2}px ui-monospace,monospace`;
    const wT = g.measureText(etT).width + 20 * e2;
    const xT2 = 20 * e2 + anchoPar + 60 * e2;
    g.fillStyle = colT + '28';
    redondeado(g, xT2, 22 * e2, wT, 22 * e2, 6 * e2); g.fill();
    g.fillStyle = colT;
    g.fillText(etT, xT2 + 10 * e2, 37 * e2);

    // El precio, a la derecha
    g.textAlign = 'right';
    g.fillStyle = '#E8B84B';
    g.font = `800 ${23 * e2}px system-ui,sans-serif`;
    g.fillText(fmt(N.precio), W - 20 * e2, 40 * e2);

    /* ── El gráfico ── */
    g.drawImage(cv, 0, hCab);

    /* ── Las lecturas del análisis ── */
    if (hAna > 0) {
      const yA = hCab + cv.height;
      g.fillStyle = '#0d1219';
      g.fillRect(0, yA, W, hAna);
      g.fillStyle = 'rgba(255,255,255,.06)';
      g.fillRect(0, yA, W, 1);

      g.textAlign = 'left';
      g.fillStyle = '#5c6672';
      g.font = `${10 * e2}px ui-monospace,monospace`;
      g.fillText('ANALYSIS', 20 * e2, yA + 20 * e2);

      let x = 20 * e2;
      N.mensajes.slice(0, 3).forEach((m, i) => {
        const et = { compra: 'BUY', venta: 'SELL', vigilar: 'WATCH',
                     aviso: 'WAIT', tendencia: 'TREND', contexto: 'CONTEXT' }[m.tipo] || '';
        const c = m.tipo === 'compra' ? '#2ee86a' : m.tipo === 'venta' ? '#f6465d' : '#E8B84B';
        const txt = `${i + 1}  ${et}  ·  ${m.titulo}`;
        g.font = `700 ${12 * e2}px system-ui,sans-serif`;
        const w = g.measureText(txt).width + 26 * e2;
        if (x + w > W - 20 * e2) return;
        g.fillStyle = c + '22';
        redondeado(g, x, yA + 32 * e2, w, 30 * e2, 8 * e2); g.fill();
        g.strokeStyle = c + '77'; g.lineWidth = 1.5 * e2;
        redondeado(g, x, yA + 32 * e2, w, 30 * e2, 8 * e2); g.stroke();
        g.fillStyle = c;
        g.fillText(txt, x + 13 * e2, yA + 52 * e2);
        x += w + 10 * e2;
      });
    }

    /* ── La franja de marca ── */
    const yB = hCab + cv.height + hAna;
    g.fillStyle = '#0b0e12';
    g.fillRect(0, yB, W, hPie);
    g.fillStyle = 'rgba(232,184,75,.4)';
    g.fillRect(0, yB, W, 2 * e2);

    const textos = (wLogo) => {
      const x0 = wLogo ? 20 * e2 + wLogo + 18 * e2 : 20 * e2;
      g.textAlign = 'left';
      g.fillStyle = '#E8B84B';
      g.font = `800 ${20 * e2}px system-ui,sans-serif`;
      g.fillText('Smart Pools', x0, yB + 36 * e2);
      g.font = `700 ${14 * e2}px ui-monospace,monospace`;
      g.fillStyle = '#C9A84B';
      g.fillText('decfreedom.com', x0, yB + 58 * e2);

      g.textAlign = 'right';
      g.fillStyle = '#6b7681';
      g.font = `${11 * e2}px ui-monospace,monospace`;
      g.fillText('Automated analysis · not financial advice', W - 20 * e2, yB + 36 * e2);
      g.fillText(new Date().toLocaleString('en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        W - 20 * e2, yB + 58 * e2);
      g.textAlign = 'left';
    };

    const bajar = () => out.toBlob((blob) => {
      devolver();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `decfreedom-smartpools-${par}-${tf}-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');

    const logo = new Image();
    let hecho = false;
    const una = (w) => { if (hecho) return; hecho = true; textos(w); bajar(); };
    logo.onload = () => {
      try {
        const alto = 54 * e2;
        const ancho = Math.round(logo.width * (alto / logo.height));
        g.drawImage(logo, 20 * e2, yB + (hPie - alto) / 2, ancho, alto);
        una(ancho);
      } catch (_) { una(0); }
    };
    logo.onerror = () => una(0);
    setTimeout(() => una(0), 1600);
    logo.src = 'assets/img/cco-marca.png';
  } catch (_) { devolver(); }
}
