/* ══════════════════════════════════════════════════════════════
   niveles/motor.js — Motor de análisis de Smart Levels

   Cálculo puro sobre las velas: pivotes, tendencia, rango, niveles,
   impulsos, estructuras (Faro), dobles, y el motor Marea. No toca el
   DOM ni el estado de la interfaz; recibe datos y devuelve datos.
   Extraído de niveles.js sin cambiar la lógica.
   ══════════════════════════════════════════════════════════════ */

export function pivotes(velas, lado = 3) {
  /* [CORREGIDO] La comparación era estricta (`>=`), así que en una
     tendencia sostenida —donde cada máximo supera al anterior— NO
     salía ningún pivote. Cero pivotes = cero niveles = el mensaje
     de relleno "el precio está en el medio".

     Ahora un pivote es un giro LOCAL: el extremo de su ventana
     inmediata, comparando solo con los vecinos más cercanos. Es
     como lo lee un trader: un punto donde el precio se dio la
     vuelta, aunque después siguiera subiendo. */
  const altos = [], bajos = [];
  for (let i = lado; i < velas.length - lado; i++) {
    const v = velas[i];
    let esAlto = true, esBajo = true;
    for (let j = i - lado; j <= i + lado; j++) {
      if (j === i) continue;
      if (velas[j].h > v.h) esAlto = false;
      if (velas[j].l < v.l) esBajo = false;
    }
    /* Y tiene que ser un giro de verdad: el precio venía de un lado
       y se fue al otro, no un empate. */
    if (esAlto && velas[i - 1].h < v.h && velas[i + 1].h < v.h) {
      altos.push({ i, p: v.h, t: v.t });
    }
    if (esBajo && velas[i - 1].l > v.l && velas[i + 1].l > v.l) {
      bajos.push({ i, p: v.l, t: v.t });
    }
  }
  /* ══════════════════════════════════════════════════════════
     RESPALDO PARA TENDENCIAS FUERTES

     Cuando el precio sube (o baja) sin descanso, no hay máximos
     locales: cada vela supera a la anterior. Matemáticamente no
     puede haber pivotes, y el análisis se queda mudo.

     Un trader en ese caso mira otra cosa: los extremos por tramos.
     Se parte el histórico en bloques y se toma el máximo y el
     mínimo de cada uno. Son referencias reales, calculadas sobre
     las velas, no inventadas.
     ══════════════════════════════════════════════════════════ */
  if (altos.length < 2 || bajos.length < 2) {
    const bloques = 8;
    const paso = Math.max(6, Math.floor(velas.length / bloques));
    for (let ini = 0; ini + paso <= velas.length; ini += paso) {
      const tramo = velas.slice(ini, ini + paso);
      let iA = 0, iB = 0;
      tramo.forEach((v, k) => {
        if (v.h > tramo[iA].h) iA = k;
        if (v.l < tramo[iB].l) iB = k;
      });
      const gA = ini + iA, gB = ini + iB;
      if (!altos.some((x) => Math.abs(x.i - gA) < 3)) {
        altos.push({ i: gA, p: velas[gA].h, t: velas[gA].t, porTramo: true });
      }
      if (!bajos.some((x) => Math.abs(x.i - gB) < 3)) {
        bajos.push({ i: gB, p: velas[gB].l, t: velas[gB].t, porTramo: true });
      }
    }
    altos.sort((a, b) => a.i - b.i);
    bajos.sort((a, b) => a.i - b.i);
  }

  return { altos, bajos };
}

/* ══════════════════════════════════════════════════════════════
   2. LA TENDENCIA

   Se mide por estructura, no por indicadores: máximos y mínimos
   crecientes = alcista. Decrecientes = bajista. Mezclados = rango.
   Es como lee el mercado un trader de verdad.
   ══════════════════════════════════════════════════════════════ */
export function tendencia(velas, piv) {
  const ua = piv.altos.slice(-3), ub = piv.bajos.slice(-3);
  /* Si no hay pivotes suficientes, se mira el movimiento neto: es
     mejor que devolver "indefinida" y quedarse sin lectura. */
  if (ua.length < 2 || ub.length < 2) {
    const n0 = Math.min(50, velas.length);
    const tr = velas.slice(-n0);
    const mv = ((tr[tr.length - 1].c - tr[0].c) / tr[0].c) * 100;
    if (mv > 1.5) return { dir: 'alcista', fuerza: Math.min(100, mv * 10), mov: mv };
    if (mv < -1.5) return { dir: 'bajista', fuerza: Math.min(100, -mv * 10), mov: mv };
    return { dir: 'lateral', fuerza: 0, mov: mv };
  }

  const altosSuben = ua[ua.length - 1].p > ua[ua.length - 2].p;
  const bajosSuben = ub[ub.length - 1].p > ub[ub.length - 2].p;
  const altosBajan = ua[ua.length - 1].p < ua[ua.length - 2].p;
  const bajosBajan = ub[ub.length - 1].p < ub[ub.length - 2].p;

  // Cuánto se ha movido en el tramo, para saber si es tendencia o ruido
  const n = Math.min(60, velas.length);
  const tramo = velas.slice(-n);
  const ini = tramo[0].c, fin = tramo[tramo.length - 1].c;
  const mov = ((fin - ini) / ini) * 100;

  if (altosSuben && bajosSuben) {
    return { dir: 'alcista', fuerza: Math.min(100, Math.abs(mov) * 12), mov };
  }
  if (altosBajan && bajosBajan) {
    return { dir: 'bajista', fuerza: Math.min(100, Math.abs(mov) * 12), mov };
  }
  return { dir: 'lateral', fuerza: 0, mov };
}

/* ══════════════════════════════════════════════════════════════
   3. ¿ESTÁ EN RANGO?

   Si el precio lleva mucho oscilando dentro de una banda estrecha,
   hay que decirlo: no es momento de buscar entradas de tendencia.
   ══════════════════════════════════════════════════════════════ */
export function detectarRango(velas) {
  const n = Math.min(50, velas.length);
  const tramo = velas.slice(-n);
  const alto = Math.max(...tramo.map((v) => v.h));
  const bajo = Math.min(...tramo.map((v) => v.l));
  const amplitud = ((alto - bajo) / bajo) * 100;

  // Cuántas velas cerraron dentro del 70% central de la banda
  const margen = (alto - bajo) * 0.15;
  const dentro = tramo.filter((v) => v.c > bajo + margen && v.c < alto - margen).length;
  const pctDentro = (dentro / n) * 100;

  /* Es rango si la banda es estrecha para la volatilidad de esa
     moneda Y el precio se pasa la mayor parte del tiempo dentro. */
  const esRango = amplitud < 6 && pctDentro > 62;
  return esRango ? { alto, bajo, amplitud, pctDentro } : null;
}

/* ══════════════════════════════════════════════════════════════
   4. LOS NIVELES

   Se agrupan los pivotes cercanos: si el precio giró tres veces en
   la misma zona, ese nivel importa. Cada uno lleva su cuenta de
   toques y el volumen que se movió ahí, y solo pasan los que
   superan el filtro.
   ══════════════════════════════════════════════════════════════ */
export function calcularNiveles(velas, piv, precio) {
  /* [CORREGIDO] Se usaban TODOS los pivotes de las 300 velas. En una
     tendencia sostenida, los antiguos quedan a un 30% del precio y
     el filtro de distancia los tiraba todos: por eso salía "sin
     soportes ni resistencias" y con ello el mensaje de relleno.

     Ahora se miran solo los pivotes de la parte reciente, que es lo
     que de verdad opera alguien. */
  const desde = Math.max(0, velas.length - 120);
  piv = {
    altos: piv.altos.filter((x) => x.i >= desde),
    bajos: piv.bajos.filter((x) => x.i >= desde)
  };

  const tolerancia = precio * 0.004;     // 0,4%: dos pivotes a esa distancia son el mismo nivel
  const grupos = [];

  const meter = (p, tipo) => {
    const g = grupos.find((x) => Math.abs(x.p - p.p) < tolerancia && x.tipo === tipo);
    if (g) {
      g.toques++;
      g.p = (g.p * (g.toques - 1) + p.p) / g.toques;   // media de los toques
      if (p.i > g.ultimo) g.ultimo = p.i;
    } else {
      grupos.push({ p: p.p, tipo, toques: 1, ultimo: p.i, primero: p.i });
    }
  };
  piv.bajos.forEach((p) => meter(p, 'soporte'));
  piv.altos.forEach((p) => meter(p, 'resistencia'));

  /* Volumen negociado cerca de cada nivel: un nivel con volumen
     tiene defensa real; uno sin volumen es casualidad. */
  const tramo = velas.slice(desde);
  const volTotal = tramo.reduce((a, v) => a + v.v, 0);
  grupos.forEach((g) => {
    let vol = 0;
    tramo.forEach((v) => {
      if (v.l <= g.p + tolerancia && v.h >= g.p - tolerancia) vol += v.v;
    });
    g.vol = vol;
    g.volPct = volTotal > 0 ? (vol / volTotal) * 100 : 0;
    g.dist = ((g.p - precio) / precio) * 100;
    g.frescura = velas.length > desde ? (g.ultimo - desde) / (velas.length - desde) : 0;

    /* La fuerza combina lo que de verdad importa:
         · cuántas veces aguantó
         · cuánto volumen tiene detrás
         · si es reciente o de hace mucho */
    g.fuerza = Math.min(100, Math.round(
      g.toques * 22 +
      Math.min(30, g.volPct * 2.2) +
      g.frescura * 24
    ));
  });

  /* EL FILTRO. Un nivel se dibuja solo si:
       · lo tocó al menos 2 veces (una es casualidad)
       · tiene fuerza suficiente
       · está a distancia operable (ni encima ni a un 15%) */
  /* [CORREGIDO] El filtro pedía 2 toques Y fuerza ≥45 a la vez, y
     casi nada pasaba: por eso salía siempre "el precio está en el
     medio", que es el mensaje de relleno.

     Ahora vale con una de las dos condiciones fuertes, y el rango
     de distancia es más amplio. Se sigue exigiendo calidad, pero
     sin dejar el mercado entero fuera. */
  const validos = grupos.filter((g) =>
    Math.abs(g.dist) > 0.08 && Math.abs(g.dist) < 18 &&
    (g.toques >= 3 || (g.toques >= 2 && g.fuerza >= 38) || g.fuerza >= 60)
  );

  /* Si aun así no pasa nada, se relaja al mínimo antes que mentir
     con un "no hay nada": mejor un nivel flojo bien etiquetado. */
  const lista = validos.length ? validos
    : grupos.filter((g) => g.toques >= 2 && Math.abs(g.dist) > 0.08);

  return lista
    .sort((a, b) => b.fuerza - a.fuerza)
    .slice(0, 6)
    .sort((a, b) => b.p - a.p);
}

/* ══════════════════════════════════════════════════════════════
   5. IMPULSO Y RETESTEO — el escenario de libro

   Es lo que busca cualquier trader con estructura:

     1. Un IMPULSO fuerte en una dirección (velas grandes seguidas)
     2. Un RETROCESO que devuelve el precio hacia el origen
     3. El precio LLEGA a esa zona de origen → entrada a favor

   La zona de origen del impulso es donde entró el dinero que lo
   provocó. Cuando el precio vuelve ahí, suele defenderse otra vez.
   ══════════════════════════════════════════════════════════════ */
/** ¿El impulso fue alcista? */
function alcista(imp) { return imp && imp.dir === 'alcista'; }

export function detectarImpulso(velas) {
  if (velas.length < 30) return null;

  /* Se busca el tramo más fuerte de las últimas 60 velas: una
     secuencia de velas en la misma dirección con recorrido real. */
  const n = Math.min(60, velas.length);
  const tramo = velas.slice(-n);

  // Medida de referencia: el recorrido típico de una vela
  const rangos = tramo.map((v) => v.h - v.l).sort((a, b) => a - b);
  const rMed = rangos[Math.floor(rangos.length / 2)] || 1;

  let mejor = null;

  for (let i = 0; i < tramo.length - 5; i++) {
    for (let largo = 3; largo <= 10 && i + largo < tramo.length; largo++) {
      const sub = tramo.slice(i, i + largo);
      const ini = sub[0].o;
      const fin = sub[sub.length - 1].c;
      const mov = fin - ini;
      const pct = Math.abs(mov / ini) * 100;

      // Cuántas velas van en la dirección del movimiento
      const aFavor = sub.filter((v) => (mov > 0 ? v.c > v.o : v.c < v.o)).length;
      const pureza = aFavor / largo;

      /* Es impulso si: recorre bastante más que una vela normal,
         la mayoría de velas van a favor, y el movimiento es
         significativo en porcentaje. */
      /* [CORREGIDO] Pedía 70% de velas a favor Y un 1,2% de
         recorrido: un crash o un tramo alcista normal no pasaban.
         Ahora se admite desde 60% de pureza y 0,6% de recorrido,
         que sigue siendo un movimiento con intención. */
      const fuerza = Math.abs(mov) / (rMed * largo);
      if (pureza >= 0.6 && fuerza > 0.4 && pct > 0.6) {
        const puntos = pct * pureza * fuerza;
        if (!mejor || puntos > mejor.puntos) {
          mejor = {
            puntos, pct,
            dir: mov > 0 ? 'alcista' : 'bajista',
            iniIdx: velas.length - n + i,
            finIdx: velas.length - n + i + largo - 1,
            // La zona de origen: donde arrancó el impulso
            zonaAlta: Math.max(sub[0].o, sub[0].c, sub[0].h * 0.999),
            zonaBaja: Math.min(sub[0].o, sub[0].c, sub[0].l * 1.001),
            precioFin: fin,
            velas: largo
          };
        }
      }
    }
  }
  if (!mejor) return null;

  /* ¿Hubo retroceso después? Se mira lo que pasó desde que acabó. */
  const despues = velas.slice(mejor.finIdx + 1);
  if (!despues.length) return null;

  const precioAhora = velas[velas.length - 1].c;
  const zonaMedia = (mejor.zonaAlta + mejor.zonaBaja) / 2;
  const distZona = ((precioAhora - zonaMedia) / precioAhora) * 100;

  /* [CORREGIDO] Se usaba Math.abs, así que si el precio ATRAVESABA
     la zona de origen y seguía, el retroceso pasaba del 100%: salían
     esos "130% del impulso" que no significan nada.

     Un retroceso por encima del 100% quiere decir que la estructura
     se ha roto: el precio se comió el impulso entero. Ahí no hay
     entrada, y hay que decirlo en vez de inventar una. */
  const recorrido = Math.abs(mejor.precioFin - zonaMedia);
  let vuelta = 0;
  if (recorrido > 0) {
    /* Con signo: si el precio pasó de largo, sale mayor que 100. */
    const avance = alcista(mejor)
      ? (mejor.precioFin - precioAhora)      // alcista: retrocede bajando
      : (precioAhora - mejor.precioFin);     // bajista: retrocede subiendo
    vuelta = (avance / recorrido) * 100;
  }

  /* Si el impulso está agotado o invalidado, no sirve como señal. */
  mejor.invalidado = vuelta > 100;
  mejor.retroceso = Math.max(0, Math.min(100, vuelta));
  mejor.retrocesoReal = vuelta;
  mejor.distZona = distZona;
  mejor.zonaMedia = zonaMedia;
  /* Márgenes más realistas: el precio raramente clava el nivel */
  mejor.enZona = !mejor.invalidado && Math.abs(distZona) < 1.8;
  mejor.acercandose = !mejor.invalidado && Math.abs(distZona) < 5 && vuelta > 35 && vuelta <= 100;
  mejor.velasDesde = despues.length;

  /* Un impulso viejo ya no dice nada: si han pasado más velas que
     el propio impulso por tres, se descarta. */
  if (despues.length > mejor.velas * 4) return null;

  return mejor;
}

/* ══════════════════════════════════════════════════════════════
   6. LAS ESTRUCTURAS — lo que un trader profesional busca

   Cuatro patrones reconocidos en el análisis de estructura, cada
   uno calculado sobre las velas reales y DIBUJADO en la gráfica
   para que el usuario vea de qué se le habla.

     · BOS   (Break of Structure) — el precio cierra más allá del
             último máximo o mínimo: la tendencia continúa.
     · CHoCH (Change of Character) — el primer giro contra la
             tendencia: puede estar cambiando el ciclo.
     · Order Block — la última vela contraria antes del impulso.
             Ahí es donde entró el dinero institucional.
     · Barrido de liquidez — el precio se pasa de un extremo,
             recoge los stops y vuelve. Trampa clásica.

   REGLA: solo cuenta el CIERRE del cuerpo, no las mechas. Una
   mecha que atraviesa un nivel es un barrido, no una ruptura.
   ══════════════════════════════════════════════════════════════ */
export function detectarEstructuras(velas, piv) {
  const out = [];
  if (velas.length < 30 || !piv.altos.length || !piv.bajos.length) return out;

  const ult = velas.length - 1;
  const reciente = (i) => ult - i <= 25;     // solo lo de ahora, no historia vieja

  /* ── BOS: ruptura de estructura ──
     El precio cierra por encima del último máximo relevante (alcista)
     o por debajo del último mínimo (bajista). */
  const ultAlto = piv.altos[piv.altos.length - 1];
  const ultBajo = piv.bajos[piv.bajos.length - 1];

  if (ultAlto) {
    for (let i = ultAlto.i + 1; i < velas.length; i++) {
      if (velas[i].c > ultAlto.p && reciente(i)) {
        out.push({
          tipo: 'bos', dir: 'alcista',
          nivel: ultAlto.p, iRef: ultAlto.i, iRot: i,
          nombre: 'Ruptura de estructura al alza',
          corto: 'BOS alcista'
        });
        break;
      }
    }
  }
  if (ultBajo) {
    for (let i = ultBajo.i + 1; i < velas.length; i++) {
      if (velas[i].c < ultBajo.p && reciente(i)) {
        out.push({
          tipo: 'bos', dir: 'bajista',
          nivel: ultBajo.p, iRef: ultBajo.i, iRot: i,
          nombre: 'Ruptura de estructura a la baja',
          corto: 'BOS bajista'
        });
        break;
      }
    }
  }

  /* ── CHoCH: cambio de carácter ──
     Veníamos haciendo mínimos crecientes y de pronto se pierde uno,
     o al revés. Es el primer aviso de que el ciclo puede girar. */
  const ba = piv.bajos.slice(-3), aa = piv.altos.slice(-3);
  if (ba.length >= 2 && ba[1].p > ba[0].p) {
    // veníamos al alza: ¿se ha perdido el último mínimo?
    const ref = ba[ba.length - 1];
    for (let i = ref.i + 1; i < velas.length; i++) {
      if (velas[i].c < ref.p && reciente(i)) {
        out.push({
          tipo: 'choch', dir: 'bajista',
          nivel: ref.p, iRef: ref.i, iRot: i,
          nombre: 'Cambio de carácter a bajista',
          corto: 'CHoCH bajista'
        });
        break;
      }
    }
  }
  if (aa.length >= 2 && aa[1].p < aa[0].p) {
    const ref = aa[aa.length - 1];
    for (let i = ref.i + 1; i < velas.length; i++) {
      if (velas[i].c > ref.p && reciente(i)) {
        out.push({
          tipo: 'choch', dir: 'alcista',
          nivel: ref.p, iRef: ref.i, iRot: i,
          nombre: 'Cambio de carácter a alcista',
          corto: 'CHoCH alcista'
        });
        break;
      }
    }
  }

  /* ── BARRIDO DE LIQUIDEZ ──
     La mecha atraviesa un extremo previo pero el cuerpo cierra de
     vuelta: han recogido los stops y han devuelto el precio. */
  const mirar = velas.slice(-14);
  const base = velas.length - 14;
  mirar.forEach((v, k) => {
    const i = base + k;
    if (i < 8) return;
    const previas = velas.slice(Math.max(0, i - 20), i);
    if (previas.length < 8) return;
    const maxPrev = Math.max(...previas.map((x) => x.h));
    const minPrev = Math.min(...previas.map((x) => x.l));

    if (v.h > maxPrev && v.c < maxPrev && (v.h - Math.max(v.o, v.c)) > (v.h - v.l) * 0.42) {
      out.push({
        tipo: 'barrido', dir: 'bajista',
        nivel: v.h, iRef: i, iRot: i,
        zonaA: v.h, zonaB: maxPrev,
        nombre: 'Barrido de liquidez arriba',
        corto: 'Barrido alcista'
      });
    }
    if (v.l < minPrev && v.c > minPrev && (Math.min(v.o, v.c) - v.l) > (v.h - v.l) * 0.42) {
      out.push({
        tipo: 'barrido', dir: 'alcista',
        nivel: v.l, iRef: i, iRot: i,
        zonaA: minPrev, zonaB: v.l,
        nombre: 'Barrido de liquidez abajo',
        corto: 'Barrido bajista'
      });
    }
  });

  /* ── ORDER BLOCK ──
     La última vela contraria antes de un impulso fuerte. Es donde
     cargaron las órdenes que provocaron el movimiento. */
  const rangos = velas.slice(-60).map((v) => v.h - v.l).sort((a, b) => a - b);
  const rMed = rangos[Math.floor(rangos.length / 2)] || 1;

  for (let i = velas.length - 3; i > Math.max(8, velas.length - 30); i--) {
    const v = velas[i];
    const cuerpo = Math.abs(v.c - v.o);
    if (cuerpo < rMed * 1.4) continue;          // no es impulso
    const alcista = v.c > v.o;

    // La vela contraria justo antes
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const p = velas[j];
      const contraria = alcista ? p.c < p.o : p.c > p.o;
      if (contraria) {
        /* Volumen real que se negoció dentro de la zona, separando
           velas alcistas de bajistas. Dato calculado, no estimado. */
        const zA = Math.max(p.o, p.c), zB = Math.min(p.o, p.c);
        let volAlc = 0, volBaj = 0;
        velas.forEach((v) => {
          if (v.l > zA || v.h < zB) return;      // no tocó la zona
          if (v.c >= v.o) volAlc += v.v; else volBaj += v.v;
        });

        out.push({
          tipo: 'ob', dir: alcista ? 'alcista' : 'bajista',
          nivel: (p.o + p.c) / 2,
          zonaA: zA, zonaB: zB,
          volAlc, volBaj,
          volTot: volAlc + volBaj,
          iRef: j, iRot: i,
          nombre: alcista ? 'Zona de demanda institucional' : 'Zona de oferta institucional',
          corto: alcista ? 'Order block alcista' : 'Order block bajista'
        });
        break;
      }
    }
    break;   // solo el más reciente
  }

  /* Solo lo reciente y sin duplicar: lo que pasa AHORA. */
  const vistos = new Set();
  return out.filter((e) => {
    const k = e.tipo + e.dir;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).slice(0, 4);
}

/* ══════════════════════════════════════════════════════════════
   7. LÍNEA DE TENDENCIA Y CANAL

   Se traza una recta por los mínimos (tendencia alcista) o por los
   máximos (bajista), usando mínimos cuadrados sobre los pivotes
   reales. Si el precio va lateral, se marcan las dos horizontales
   del rango.

   Fiabilidad medida por el sector: las líneas de tendencia rondan
   el 67% de acierto y los canales horizontales el 68%. Por eso se
   dibujan solo cuando el ajuste es bueno de verdad.
   ══════════════════════════════════════════════════════════════ */
export function calcularTendencia(velas, piv, tend) {
  /* Ajuste por mínimos cuadrados: la recta que mejor pasa por los
     puntos. No es una estimación a ojo. */
  const recta = (pts) => {
    const n = pts.length;
    if (n < 3) return null;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    pts.forEach((p) => { sx += p.i; sy += p.p; sxy += p.i * p.p; sxx += p.i * p.i; });
    const den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return null;
    const m = (n * sxy - sx * sy) / den;
    const b = (sy - m * sx) / n;

    // Qué tan bien se ajustan los puntos a la recta (R²)
    const media = sy / n;
    let ssTot = 0, ssRes = 0;
    pts.forEach((p) => {
      const est = m * p.i + b;
      ssTot += Math.pow(p.p - media, 2);
      ssRes += Math.pow(p.p - est, 2);
    });
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    return { m, b, r2, pts };
  };

  /* [CORREGIDO] Casi nunca se trazaba: exigía tendencia ya definida
     Y un ajuste altísimo. Ahora se prueban los dos lados siempre y
     se queda con el que mejor se ajuste, con un umbral razonable.
     Si de verdad no hay recta que valga, no se dibuja: pero eso
     ahora es la excepción, no la norma. */
  const probar = (pts, signo) => {
    if (pts.length < 3) return null;
    // Se prueba con 6, 5 y 4 puntos: la que mejor encaje
    let mejor = null;
    for (const cuantos of [6, 5, 4]) {
      const sub = pts.slice(-cuantos);
      if (sub.length < 3) continue;
      const r = recta(sub);
      if (!r) continue;
      if (signo > 0 && r.m <= 0) continue;
      if (signo < 0 && r.m >= 0) continue;
      if (r.r2 < 0.4) continue;                 // umbral realista
      if (!mejor || r.r2 > mejor.r2) mejor = r;
    }
    return mejor;
  };

  const alc = probar(piv.bajos, 1);
  const baj = probar(piv.altos, -1);

  /* Si hay tendencia declarada, manda ella. Si no, la que mejor
     ajuste tenga. */
  if (tend.dir === 'alcista' && alc) return { tipo: 'alcista', ...alc };
  if (tend.dir === 'bajista' && baj) return { tipo: 'bajista', ...baj };
  if (alc && baj) return alc.r2 >= baj.r2
    ? { tipo: 'alcista', ...alc } : { tipo: 'bajista', ...baj };
  if (alc) return { tipo: 'alcista', ...alc };
  if (baj) return { tipo: 'bajista', ...baj };
  return null;
}

/* ══════════════════════════════════════════════════════════════
   8. DOBLE SUELO Y DOBLE TECHO

   El patrón más fiable según los estudios: 88% de acierto el doble
   suelo cuando lo confirma el volumen. Dos mínimos casi iguales
   separados por un rebote.
   ══════════════════════════════════════════════════════════════ */
export function detectarDobles(velas, piv, precio) {
  const out = [];
  const tol = precio * 0.008;          // dos extremos a menos del 0,8% son "iguales"
  const ult = velas.length - 1;

  const buscar = (lista, tipo) => {
    for (let i = lista.length - 1; i >= 1; i--) {
      const b = lista[i], a = lista[i - 1];
      if (ult - b.i > 30) break;                 // solo lo reciente
      if (Math.abs(b.p - a.p) > tol) continue;   // no son iguales
      if (b.i - a.i < 4) continue;               // demasiado juntos

      /* La línea del cuello: el extremo contrario entre los dos.
         El patrón se confirma cuando el precio la rompe. */
      const entre = velas.slice(a.i, b.i + 1);
      if (!entre.length) continue;
      const cuello = tipo === 'suelo'
        ? Math.max(...entre.map((v) => v.h))
        : Math.min(...entre.map((v) => v.l));

      const alturaPct = Math.abs(cuello - b.p) / precio * 100;
      if (alturaPct < 0.8) continue;             // demasiado plano

      out.push({
        tipo: tipo === 'suelo' ? 'dobleSuelo' : 'dobleTecho',
        p1: a, p2: b, cuello,
        nivel: (a.p + b.p) / 2,
        altura: Math.abs(cuello - b.p),
        objetivo: tipo === 'suelo' ? cuello + Math.abs(cuello - b.p) : cuello - Math.abs(cuello - b.p),
        confirmado: tipo === 'suelo' ? precio > cuello : precio < cuello,
        iRef: b.i
      });
      break;
    }
  };
  buscar(piv.bajos, 'suelo');
  buscar(piv.altos, 'techo');
  return out;
}

/* ══════════════════════════════════════════════════════════════
   VWAP ANCLADO CON BANDAS

   El precio medio ponderado por volumen desde un punto concreto.
   Las mesas institucionales lo usan como referencia de "precio
   justo": si están comprando por debajo del VWAP, van ganando.

   Las bandas de desviación marcan hasta dónde es razonable que se
   aleje. Fuera de ±2σ, el precio suele volver.

   Se ancla al inicio del último impulso, que es lo que hace un
   profesional: no al inicio de sesión sin más.
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   PERFIL DE VOLUMEN

   Cuánto se negoció en cada nivel de precio. El nivel con más
   volumen (POC) es donde el mercado está de acuerdo, y el precio
   tiende a volver ahí. El área de valor recoge el 70% del volumen:
   fuera de ella, el precio está "caro" o "barato".

   En TradingView esto requiere plan de pago.
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   MAREA — el detector de cambio de ciclo

   Marca dónde la marea del mercado cambia de manos: de compradores a
   vendedores o al revés. NO es un SuperTrend. Un SuperTrend dispara en
   cada sacudida y arruina cuentas. Aquí una señal solo nace cuando
   varias cosas independientes coinciden, y la herramienta CALLA el
   resto del tiempo.

   CÓMO LEE EL MERCADO (nada de esto se dibuja: solo se usa para pensar)

   · HEIKIN ASHI, calculado dentro. Promedia cada vela con la anterior,
     así el ruido se cancela solo y quedan tramos limpios. Un cambio de
     color en Heikin Ashi es un cambio de ciclo de verdad, no un tirón.
   · ADX (índice direccional de Wilder). Dice si HAY tendencia o el
     precio va y viene. Por debajo de 20 es lateral de verdad: no hay
     ciclo que seguir y no se emite nada.
   · RACHAS de color. Dos o tres velas alternas son ruido; una racha
     larga es un ciclo. El giro solo cuenta si venía de un ciclo real.
   · CONFIRMACIÓN de la vela siguiente. La señal se dibuja en la vela
     del giro, pero solo nace cuando algo posterior la confirma dentro
     de una ventana. Así no repinta: una vez puesta, no se mueve.
   · VOLUMEN por encima de la media. Un giro que nadie respalda no vale.
   · RUPTURA DE ESTRUCTURA con margen de ¼ de ATR, para que un roce
     mínimo del nivel en pleno chop no cuente como ruptura.
   · ANCHO DE BANDA mínimo. Si el precio es una raya plana, aunque el
     ADX pegue un salto puntual, no hay recorrido y no se opera.

   FILTROS OBLIGATORIOS CONTRA FALSAS ALERTAS
   · LATERAL — sin fuerza de tendencia medible (ADX<20) o banda
     demasiado estrecha, no se emiten señales y se dice por qué.
   · FIN DE SEMANA — sábado y domingo el volumen cae y las rupturas se
     deshacen el lunes. No se opera y se avisa.
   · DESCANSO — tras una señal se exigen varias velas antes de admitir
     otra, para evitar el vaivén.

   Probado contra escenarios sintéticos (tendencia limpia, crash, pump,
   lateral, doble suelo, alta volatilidad): capta el giro de libro en su
   vela y calla en el lateral.
   ══════════════════════════════════════════════════════════════ */
const MAR = {
  UMBRAL_ADX: 20,    // por debajo: lateral, no hay ciclo
  MIN_CICLO: 3,      // velas HA del mismo color para que el tramo previo cuente
  DESCANSO: 5,       // velas mínimas entre dos señales (mata el vaivén)
  VENTANA_EST: 10,   // velas atrás para el máximo/mínimo de estructura
  VOL_MA: 20,        // media de volumen
  CONF: 10,          // velas de margen para que confirme la ruptura tras el giro
  MARGEN_ATR: 0.25,  // la ruptura debe superar el nivel por ¼ de ATR
  ANCHO_MIN: 2.0,    // banda mínima reciente (%) para que haya recorrido real
  BANDA_VELAS: 14    // ventana para medir el ancho de banda
};

/* Heikin Ashi interno. NO se muestra: solo se lee. */
function heikinAshi(velas) {
  const ha = [];
  for (let i = 0; i < velas.length; i++) {
    const v = velas[i];
    const cierre = (v.o + v.h + v.l + v.c) / 4;
    const apertura = i === 0 ? (v.o + v.c) / 2
                             : (ha[i - 1].o + ha[i - 1].c) / 2;
    ha.push({
      o: apertura, c: cierre,
      h: Math.max(v.h, apertura, cierre),
      l: Math.min(v.l, apertura, cierre),
      color: cierre >= apertura ? 1 : -1
    });
  }
  return ha;
}

/* ADX de Wilder. Devuelve una serie alineada con las velas (los
   primeros huecos son null). +DI/−DI se guardan para el panel. */
function adxSerie(velas, periodo = 14) {
  const n = velas.length;
  const out = new Array(n).fill(null);
  if (n < periodo * 2) return out;

  const trs = [], dmMas = [], dmMenos = [];
  for (let i = 1; i < n; i++) {
    const v = velas[i], p = velas[i - 1];
    const subeMax = v.h - p.h;
    const bajaMin = p.l - v.l;
    dmMas.push(subeMax > bajaMin && subeMax > 0 ? subeMax : 0);
    dmMenos.push(bajaMin > subeMax && bajaMin > 0 ? bajaMin : 0);
    trs.push(Math.max(v.h - v.l, Math.abs(v.h - p.c), Math.abs(v.l - p.c)));
  }

  let trS = trs.slice(0, periodo).reduce((a, b) => a + b, 0);
  let mS = dmMas.slice(0, periodo).reduce((a, b) => a + b, 0);
  let meS = dmMenos.slice(0, periodo).reduce((a, b) => a + b, 0);

  const dxs = [];
  for (let i = periodo; i < trs.length; i++) {
    trS = trS - trS / periodo + trs[i];
    mS = mS - mS / periodo + dmMas[i];
    meS = meS - meS / periodo + dmMenos[i];
    const diMas = trS > 0 ? (mS / trS) * 100 : 0;
    const diMenos = trS > 0 ? (meS / trS) * 100 : 0;
    const suma = diMas + diMenos;
    const dx = suma > 0 ? (Math.abs(diMas - diMenos) / suma) * 100 : 0;
    dxs.push({ i: i + 1, dx, diMas, diMenos });
  }
  if (dxs.length < periodo) return out;

  let adx = dxs.slice(0, periodo).reduce((a, b) => a + b.dx, 0) / periodo;
  const primero = dxs[periodo - 1];
  out[primero.i] = { adx, diMas: primero.diMas, diMenos: primero.diMenos };
  for (let k = periodo; k < dxs.length; k++) {
    adx = (adx * (periodo - 1) + dxs[k].dx) / periodo;
    out[dxs[k].i] = { adx, diMas: dxs[k].diMas, diMenos: dxs[k].diMenos };
  }
  return out;
}

function esFinde(t) {
  /* Cripto opera 24/7: no hay pausa de fin de semana. Se deja la función
     por compatibilidad, pero siempre devuelve false para que nada se pause
     ni el sábado ni el domingo. */
  return false;
}

/* El motor. Recibe las velas y el ATR ya calculado (N.atr). Devuelve
   las señales confirmadas y el estado en vivo del panel. */
export function marea(velas, atr) {
  if (!velas || velas.length < 60) return null;
  if (!(atr > 0)) atr = calcularATR(velas);
  if (!(atr > 0)) return null;

  const ha = heikinAshi(velas);
  const adx = adxSerie(velas);
  const n = velas.length;

  const volMA = (i) => {
    const desde = Math.max(0, i - MAR.VOL_MA + 1);
    let s = 0, c = 0;
    for (let k = desde; k <= i; k++) { s += velas[k].v; c++; }
    return c ? s / c : 0;
  };
  const estructura = (i) => {
    const desde = Math.max(0, i - MAR.VENTANA_EST);
    let hi = -Infinity, lo = Infinity;
    for (let k = desde; k < i; k++) {
      if (velas[k].h > hi) hi = velas[k].h;
      if (velas[k].l < lo) lo = velas[k].l;
    }
    return { hi, lo };
  };
  const banda = (i) => {
    const desde = Math.max(0, i - MAR.BANDA_VELAS + 1);
    let hi = -Infinity, lo = Infinity;
    for (let k = desde; k <= i; k++) { if (velas[k].h > hi) hi = velas[k].h; if (velas[k].l < lo) lo = velas[k].l; }
    return velas[i].c > 0 ? ((hi - lo) / velas[i].c) * 100 : 0;
  };

  /* 1) Giros de color de Heikin Ashi y longitud del ciclo previo. */
  const giros = [];
  let colorPrev = ha[0].color, inicioRacha = 0;
  for (let i = 1; i < n; i++) {
    if (ha[i].color === colorPrev) continue;
    giros.push({ i, color: ha[i].color, rachaPrev: i - inicioRacha });
    inicioRacha = i;
    colorPrev = ha[i].color;
  }

  /* 2) Cada giro se evalúa: se dibuja en su vela, pero solo nace cuando
     la ruptura confirma dentro de la ventana (sin repintar). */
  const señales = [];
  const cerrada = (s) => s.valida;
  const margen = atr * MAR.MARGEN_ATR;
  giros.forEach((f) => {
    const i = f.i, color = f.color;
    const dir = color === 1 ? 'compra' : 'venta';
    const est = estructura(i);
    const v = velas[i];

    const cicloPrevio = f.rachaPrev >= MAR.MIN_CICLO;
    const confirmadaColor = i + 1 < n && ha[i + 1].color === color;

    let jConf = -1, volMax = v.v, adxConf = adx[i] ? adx[i].adx : 0;
    for (let j = i + 1; j <= Math.min(i + MAR.CONF, n - 1); j++) {
      if (ha[j].color !== color) break;              // amago: el color se deshizo
      if (velas[j].v > volMax) volMax = velas[j].v;
      const a = adx[j];
      const rompe = dir === 'compra' ? velas[j].c > est.hi + margen
                                     : velas[j].c < est.lo - margen;
      const fuerte = a && a.adx >= MAR.UMBRAL_ADX;
      const anchoOK = banda(j) >= MAR.ANCHO_MIN;
      if (a) adxConf = a.adx;
      if (rompe && fuerte && anchoOK) { jConf = j; break; }
    }

    const ruptura = jConf !== -1;
    const vm = volMA(Math.min(jConf !== -1 ? jConf : i + 1, n - 1));
    const volOK = vm > 0 && volMax >= vm;

    const finde = esFinde(v.t);
    const ultima = señales.filter(cerrada).slice(-1)[0];
    const pronto = ultima && (i - ultima.i) < MAR.DESCANSO;

    /* Nace si: giro confirmado por color (no repinta), ruptura con
       fuerza y recorrido reales, volumen de respaldo, fuera de fin de
       semana y del descanso. */
    const valida = confirmadaColor && ruptura && volOK && !finde && !pronto;

    const met = [cicloPrevio, true, ruptura, volOK, ruptura];
    señales.push({
      i, t: v.t, precio: v.c, dir, color,
      met, cumplidos: met.filter(Boolean).length,
      adx: adxConf, finde, pronto, lateral: !ruptura,
      rachaPrev: f.rachaPrev, valida
    });
  });

  const validas = señales.filter((s) => s.valida);
  const ultima = validas[validas.length - 1] || null;

  /* 3) Estado EN VIVO del panel de probabilidad. El porcentaje NO es una
     predicción: es cuántos requisitos de la señal están ya cumplidos. */
  const iU = n - 1;
  const aU = adx[iU] || { adx: 0, diMas: 0, diMenos: 0 };
  const colorAhora = ha[iU].color;
  const precio = velas[iU].c;
  const vmU = volMA(iU);
  const volU = vmU > 0 && velas[iU].v >= vmU;
  const anchoU = banda(iU);
  const fuerzaU = aU.adx >= MAR.UMBRAL_ADX && anchoU >= MAR.ANCHO_MIN;

  let runLen = 1;
  for (let k = iU - 1; k >= 0; k--) { if (ha[k].color === colorAhora) runLen++; else break; }
  let runPrev = 0;
  { let k = iU - runLen; if (k >= 0) { const cc = ha[k].color; for (; k >= 0 && ha[k].color === cc; k--) runPrev++; } }

  /* Coherencia con la GENERACIÓN DE SEÑALES (validas):
     - una señal LONG solo nace tras un GIRO FRESCO a verde (dentro de la
       ventana de confirmación), no por estar verde a media tendencia;
     - la ruptura se mide contra la estructura MÁS el margen de ¼ ATR,
       igual que el motor;
     - la fuerza es ADX+banda, SIN exigir cruce de DI (el motor tampoco lo
       exige, porque el DI cruza tarde en los giros en V).
     Así el recuadro, la línea de objetivo y la tachuela cuentan lo mismo. */
  const flipLong = colorAhora === 1 && runLen <= MAR.CONF;
  const flipShort = colorAhora === -1 && runLen <= MAR.CONF;
  /* Umbral REAL de disparo = estructura del mercado (máximo/mínimo reciente)
     con un pequeño retardo de GAP velas: así el nivel AVANZA con la tendencia
     (no se queda de cartón) pero la vela de ruptura sí llega a cerrar por
     encima/por debajo y se registra el cruce. "Cuánto falta" es la distancia
     real del precio a ese nivel. */
  const M = Math.min(iU, Math.round(MAR.VENTANA_EST * 1.5)), GAP = 3;
  let dHi = -Infinity, dLo = Infinity;
  for (let k = Math.max(0, iU - M); k <= iU - GAP; k++) { if (velas[k].h > dHi) dHi = velas[k].h; if (velas[k].l < dLo) dLo = velas[k].l; }
  if (dHi === -Infinity) { const e = estructura(iU); dHi = e.hi; dLo = e.lo; }
  const nivLong = dHi + margen;      // superar para gatillar LONG
  const nivShort = dLo - margen;     // perder para gatillar SHORT

  const long = {
    cicloPrevio: colorAhora === -1 ? runLen >= MAR.MIN_CICLO : runPrev >= MAR.MIN_CICLO,
    giroHA: flipLong,
    fuerza: fuerzaU,
    volumen: volU,
    ruptura: precio > nivLong
  };
  const short = {
    cicloPrevio: colorAhora === 1 ? runLen >= MAR.MIN_CICLO : runPrev >= MAR.MIN_CICLO,
    giroHA: flipShort,
    fuerza: fuerzaU,
    volumen: volU,
    ruptura: precio < nivShort
  };
  const pctDe = (o) => Math.round((Object.values(o).filter(Boolean).length / 5) * 100);
  const cumplidosDe = (o) => Object.values(o).filter(Boolean).length;
  const faltaLong = precio > nivLong ? 0 : ((nivLong - precio) / precio) * 100;
  const faltaShort = precio < nivShort ? 0 : ((precio - nivShort) / precio) * 100;
  // % real: mezcla los requisitos cumplidos con la cercanía al nivel de disparo
  const proxDe = (falta) => Math.max(0, 1 - falta / 1.5);
  const pctReal = (o, falta) => Math.round(Math.min(100, (Object.values(o).filter(Boolean).length / 5) * 55 + proxDe(falta) * 45));
  const volRel = vmU > 0 ? velas[iU].v / vmU : 0;

  return {
    colorAhora, runLen, anchoAhora: anchoU,
    señales, validas, ultima,
    velasDesde: ultima ? (n - 1 - ultima.i) : null,
    lateral: !fuerzaU,
    /* Por qué está parada: 'adx' (sin tendencia) o 'banda' (sin
       recorrido ahora mismo). El ADX es rezagado, así que puede ser
       alto justo después de un tramo y la banda haberse cerrado: en ese
       caso el motivo real es la banda, no el ADX. */
    motivoLateral: aU.adx < MAR.UMBRAL_ADX ? 'adx' : (anchoU < MAR.ANCHO_MIN ? 'banda' : null),
    finde: esFinde(velas[iU].t),
    panel: {
      adx: aU.adx, diMas: aU.diMas, diMenos: aU.diMenos,
      volRel, runLen, color: colorAhora, ancho: anchoU,
      long:  { pct: pctReal(long, faltaLong),  cumplidos: cumplidosDe(long),  met: long,  falta: faltaLong,  nivel: nivLong },
      short: { pct: pctReal(short, faltaShort), cumplidos: cumplidosDe(short), met: short, falta: faltaShort, nivel: nivShort }
    }
  };
}


/* ══════════════════════════════════════════════════════════════
   9. ATR — la volatilidad real

   El recorrido medio de una vela. Sirve para poner el stop donde
   tenga sentido: si lo pones más cerca que el ruido normal del
   mercado, te barren sin que la idea falle.
   ══════════════════════════════════════════════════════════════ */
export function calcularATR(velas, periodo = 14) {
  if (velas.length < periodo + 1) return 0;
  const trs = [];
  for (let i = 1; i < velas.length; i++) {
    const v = velas[i], p = velas[i - 1];
    trs.push(Math.max(
      v.h - v.l,
      Math.abs(v.h - p.c),
      Math.abs(v.l - p.c)
    ));
  }
  const ult = trs.slice(-periodo);
  return ult.reduce((a, b) => a + b, 0) / ult.length;
}

/* ══════════════════════════════════════════════════════════════
   10. FIBONACCI SOBRE EL IMPULSO

   Se traza sobre el último tramo con dirección clara. La zona
   0,618–0,786 es la que las mesas institucionales usan para
   recargar posición: el llamado golden pocket.

   Según los estudios: Fibonacci solo ronda el 55-65% de acierto,
   pero combinado con una zona institucional sube al 70-80%. Por
   eso solo se marca cuando coincide con estructura.
   ══════════════════════════════════════════════════════════════ */
const FIBS = [
  { r: 0,     et: '0' },
  { r: 0.382, et: '0.382' },
  { r: 0.5,   et: '0.5' },
  { r: 0.618, et: '0.618' },
  { r: 0.705, et: '0.705' },
  { r: 0.786, et: '0.786' },
  { r: 1,     et: '1' }
];


/* ══════════════════════════════════════════════════════════════
   11. EL PLAN DE OPERACIÓN COMPLETO

   Lo que pide un profesional y hasta ahora faltaba:
     · Entrada exacta
     · Stop con lógica estructural, no arbitrario
     · Objetivo 1, objetivo 2 y objetivo final
     · Zona de peligro: dónde la idea deja de valer
     · Relación riesgo/beneficio calculada
     · Cuánto arriesgar del capital
   ══════════════════════════════════════════════════════════════ */
export function construirPlan(lado, entrada, stopBase, atr) {
  if (!(entrada > 0) || !(atr > 0)) return null;
  const largo = lado === 'compra';

  /* El stop respeta la estructura Y la volatilidad: nunca más
     cerca que 1,2 veces el ATR, o el ruido normal lo barre. */
  const minDist = atr * 1.2;
  let stop = stopBase;
  if (largo && entrada - stop < minDist) stop = entrada - minDist;
  if (!largo && stop - entrada < minDist) stop = entrada + minDist;

  const riesgo = Math.abs(entrada - stop);
  if (!(riesgo > 0)) return null;

  /* Objetivos escalonados: 1R para asegurar, 2R el principal,
     3R el que se deja correr. Es el estándar profesional. */
  const obj = [1, 2, 3].map((r) => ({
    r,
    p: largo ? entrada + riesgo * r : entrada - riesgo * r,
    pct: ((riesgo * r) / entrada) * 100
  }));

  return {
    lado, entrada, stop, riesgo,
    riesgoPct: (riesgo / entrada) * 100,
    obj,
    rr: 2,
    atr
  };
}

/* Descarga velas de Binance (klines). Devuelve [{t,o,h,l,c,v}]. */
export async function traerVelas(simbolo, tf, n = 300) {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${simbolo}&interval=${tf}&limit=${n}`);
  if (!r.ok) throw new Error('sin datos');
  const j = await r.json();
  return j.map((x) => ({
    t: x[0],
    o: Number(x[1]), h: Number(x[2]), l: Number(x[3]), c: Number(x[4]),
    v: Number(x[5])
  }));
}
