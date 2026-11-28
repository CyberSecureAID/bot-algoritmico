/* estrategias.js — Las 6 estrategias de Catalyst.
 *
 * Fuente: las diapositivas del colega (análisis en TC2000, opciones put/call
 * sobre acciones de EE.UU.). Cada estrategia se CARGA de a una en el gráfico:
 * se muestra solo esa, con su temporalidad, sus indicadores y su checklist.
 *
 * Indicadores que usa el colega (notas generales):
 *   - Medias 20 y 40  -> tendencia de CORTO plazo (20>40 alcista, 40>20 bajista)
 *   - Medias 100 y 200 -> tendencia de LARGO plazo (100>200 alcista, 200>100 bajista)
 *   - Se miran en 1h y Diario; marcan posible rebote en el punto medio (media 20).
 *   - Bollinger en 15min para operar; en 1h/Diario para ver volatilidad y rebote/ruptura.
 *
 * Cada paso lleva `clave` para que el motor de alertas (alertas.js) pueda, más
 * adelante, evaluar cuáles ya se cumplen y avisar cuando la entrada está CERCA.
 *
 * `lado`: 'call' (apuesta al alza) | 'put' (apuesta a la baja).
 * `tfs`: temporalidades que intervienen, en orden de lectura.
 * `tfEntrada`: dónde se confirma y se toma la entrada.
 */

export const ESTRATEGIAS = [
  /* ──────────── 1 · CAMBIO DE TENDENCIA AL ALZA (CALL) ────────────
     (Reconstruida como espejo de la bajista: en las diapositivas venía citada
     como "la anterior" pero no estaba la foto. Marcada abajo para revisarla.) */
  {
    id: 'cambio-alza',
    n: 1,
    grupo: 'Cambio de tendencia',
    nombre: 'Cambio de tendencia al alza',
    lado: 'call',
    tfs: ['1h', '15m'],
    tfEntrada: '1h',
    base: 'Bollinger · temporalidad Hora',
    revisar: true, // ⚠ reconstruida como espejo; confirmar con la diapositiva real
    resumen: 'El precio venía bajando, rompe su línea de tendencia bajista y la media de 20 con vela alcista, y en 15min ya se ve totalmente alcista.',
    pasos: [
      { clave: 'linea', t: 'Trazar una línea de tendencia que bordee levemente por ENCIMA la mayor cantidad de puntos posibles de la tendencia bajista.' },
      { clave: 'ruptura', t: 'Que el precio rompa esa línea de tendencia (puede ocurrir durante el día o en forma de salto).' },
      { clave: 'media20', t: 'Que el precio rompa la media móvil de 20 periodos en esa temporalidad y cierre con una vela de confirmación alcista.' },
      { clave: 'tf15', t: 'Cambiar a 15 minutos: la tendencia debe mostrarse totalmente alcista.' },
      { clave: 'entrada', t: 'Con todo cumplido, tomar una posición en CALL.' }
    ]
  },

  /* ──────────── 2 · CAMBIO DE TENDENCIA A LA BAJA (PUT) ──────────── */
  {
    id: 'cambio-baja',
    n: 2,
    grupo: 'Cambio de tendencia',
    nombre: 'Cambio de tendencia a la baja',
    lado: 'put',
    tfs: ['1h', '15m'],
    tfEntrada: '1h',
    base: 'Bollinger · temporalidad Hora',
    resumen: 'El precio venía subiendo, rompe su línea de tendencia alcista y la media de 20 con vela bajista, y en 15min ya se ve totalmente bajista.',
    pasos: [
      { clave: 'linea', t: 'Trazar una línea de tendencia que bordee levemente por DEBAJO la mayor cantidad de puntos posibles de la tendencia alcista.' },
      { clave: 'ruptura', t: 'Que el precio rompa esa línea de tendencia (puede ocurrir durante el día o en forma de salto).' },
      { clave: 'media20', t: 'Que el precio rompa la media móvil de 20 periodos en esa temporalidad y cierre con una vela de confirmación bajista.' },
      { clave: 'tf15', t: 'Cambiar a 15 minutos: la tendencia debe mostrarse totalmente bajista.' },
      { clave: 'entrada', t: 'Con todo cumplido, tomar una posición en PUT.' }
    ]
  },

  /* ──────────── 3 · EFECTO IMÁN, TENDENCIA ALCISTA (PUT) ────────────
     Tendencia alcista pero sobre-extendida: el precio se aleja tanto de la
     media que "el imán" lo jala de vuelta -> se compran PUT. */
  {
    id: 'iman-alza',
    n: 3,
    grupo: 'Efecto imán',
    nombre: 'Efecto imán, tendencia alcista',
    lado: 'put',
    tfs: ['1h', '15m'],
    tfEntrada: '15m',
    base: 'Gráfico hora · Bollinger 15min',
    resumen: 'Tendencia alcista que se estira demasiado: el precio salta y queda muy lejos de la media de 20. El imán lo regresa -> PUT.',
    pasos: [
      { clave: 'tendencia', t: 'En las medias móviles debemos estar en una tendencia claramente alcista (varios días subiendo).' },
      { clave: 'salto', t: 'El precio abre con un fuerte salto al alza y queda muy alejado de la media móvil de 20 periodos.' },
      { clave: 'bollinger', t: 'En Bollinger 15min, la primera vela debe quedar completamente fuera del oscilador.' },
      { clave: 'worden', t: 'Cuando se empiece a formar la vela en el indicador de volumen, deberá cruzar la línea roja del Worden Stochastics: esa es la confirmación de compra de PUT.' }
    ]
  },

  /* ──────────── 4 · EFECTO IMÁN, TENDENCIA BAJISTA (CALL) ──────────── */
  {
    id: 'iman-baja',
    n: 4,
    grupo: 'Efecto imán',
    nombre: 'Efecto imán, tendencia bajista',
    lado: 'call',
    tfs: ['1h', '15m'],
    tfEntrada: '15m',
    base: 'Gráfico hora · Bollinger 15min',
    resumen: 'Tendencia bajista sobre-extendida: el precio salta a la baja y queda muy lejos de la media de 20. El imán lo regresa -> CALL.',
    pasos: [
      { clave: 'tendencia', t: 'En las medias móviles debemos estar en una tendencia claramente bajista (varios días bajando).' },
      { clave: 'salto', t: 'El precio abre con un fuerte salto a la baja y queda muy alejado de la media móvil de 20 periodos.' },
      { clave: 'bollinger', t: 'En Bollinger 15min, la primera vela debe quedar completamente fuera del oscilador.' },
      { clave: 'worden', t: 'Cuando se empiece a formar la vela en el indicador de volumen, deberá cruzar la línea roja del Worden Stochastics: esa es la confirmación de compra de CALL.' }
    ]
  },

  /* ──────────── 5 · REBOTE EN PUNTO MEDIO, TENDENCIA AL ALZA (CALL) ──────────── */
  {
    id: 'rebote-alza',
    n: 5,
    grupo: 'Rebote en punto medio',
    nombre: 'Rebote en punto medio, al alza',
    lado: 'call',
    tfs: ['1D', '1h', '15m'],
    tfEntrada: '1h',
    base: 'Bollinger · temporalidad Día',
    resumen: 'Alcista de fondo (Día), corrige a la baja (Hora) hasta el punto medio (media 20). Lo respeta, rebota -> CALL.',
    pasos: [
      { clave: 'dia', t: 'Tendencia claramente alcista en Bollinger, temporalidad DÍA.' },
      { clave: 'hora', t: 'Tendencia claramente bajista en Bollinger, temporalidad HORA.' },
      { clave: 'puntomedio', t: 'El precio viene en caída acercándose al punto medio en diario (la media móvil de 20), que marcamos con una línea como referencia del rebote.' },
      { clave: 'respeto', t: 'Al tocar esa marca, verificar que NO la cruce sino que la respete; cambiar a 15min y esperar que empiece a rebotar.' },
      { clave: 'entrada', t: 'En temporalidad HORA, esperar vela de confirmación alcista y tomar entrada en CALL.' }
    ]
  },

  /* ──────────── 6 · REBOTE EN PUNTO MEDIO, TENDENCIA A LA BAJA (PUT) ──────────── */
  {
    id: 'rebote-baja',
    n: 6,
    grupo: 'Rebote en punto medio',
    nombre: 'Rebote en punto medio, a la baja',
    lado: 'put',
    tfs: ['1D', '1h', '15m'],
    tfEntrada: '1h',
    base: 'Bollinger · temporalidad Día',
    resumen: 'Bajista de fondo (Día), rebota al alza (Hora) hasta el punto medio (media 20). Lo respeta, cae -> PUT.',
    pasos: [
      { clave: 'dia', t: 'Tendencia claramente bajista en Bollinger, temporalidad DÍA.' },
      { clave: 'hora', t: 'Tendencia claramente alcista en Bollinger, temporalidad HORA.' },
      { clave: 'puntomedio', t: 'El precio viene en subida acercándose al punto medio en diario (la media móvil de 20), que marcamos con una línea como referencia del rebote.' },
      { clave: 'respeto', t: 'Al tocar esa marca, verificar que NO la cruce sino que la respete; cambiar a 15min y esperar que empiece a rebotar.' },
      { clave: 'entrada', t: 'En temporalidad HORA, esperar vela de confirmación bajista y tomar entrada en PUT.' }
    ]
  }
];

export const porId = (id) => ESTRATEGIAS.find((e) => e.id === id) || ESTRATEGIAS[0];
