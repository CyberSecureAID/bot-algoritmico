# Super Scalper — servicio de Analysis (estrategia RSI 2 + EMA 50 en 1 segundo)

De cara al usuario se llama **Super Scalper**. Es un **servicio nuevo** del selector
de Analysis, pensado para scalping de entradas quirúrgicas en temporalidad de
**1 segundo**. No tiene analista: es una **estrategia mecánica** de reglas fijas que
se dibuja en vivo sobre la gráfica.

## La estrategia (reglas EXACTAS)

Dos herramientas:

- **EMA 50** sobre el precio (línea morada con el mismo glow iluminado del VWAP de
  VWAP Pro). Es el **filtro de tendencia**:
  - Precio **por encima** de la EMA → tendencia alcista → **solo largos**.
  - Precio **por debajo** de la EMA → tendencia bajista → **solo cortos**.
- **RSI longitud 2** (panel inferior). Longitud 2 para que oscile fuerte y llegue a
  los extremos. Banda baja **9 (verde)**, banda alta **99 (roja)**, línea del RSI en
  **amarillo brillante**.

Gatillo:

- **LARGO**: precio sobre la EMA **y** el RSI toca la banda baja (<= 9).
- **CORTO**: precio bajo la EMA **y** el RSI toca la banda alta (>= 99).
- Nada en contra de la tendencia (sobre la EMA tocando la banda alta = no se opera; es
  una alerta de corto que se ignora porque la tendencia es alcista; y al revés).

Operación:

- **Stop**: siempre al OTRO lado de la EMA, sin tocarla (por debajo en largos, por
  encima en cortos). Si la tendencia cruza la EMA, la idea ya está mal.
- **Objetivo**: a **1:1.5** (arriesgar 10 para ganar 15). El usuario puede cerrar
  antes a 1:1 o dejar correr a 1:2 según su gestión (se explica en la ayuda).
- Al dispararse, se dibuja la **herramienta de posición** (entrada, stop, objetivo)
  junto a la vela gatillo, con un **estado**: `ENTRY VALID NOW`, `ALREADY RUNNING`,
  `TARGET HIT` o `INVALIDATED`. Las que **pegan objetivo quedan dibujadas** como
  registro verde. Sin señal: `SCANNING` y qué lado permite la EMA.

## Datos (cumple CLAUDE.md)

Solo Binance SPOT. Velas por `klines` con `interval=1s` y en vivo por el WebSocket
`@kline_1s`. Se puede escribir `api.binance.com` / `stream.binance.com`: el
`feed-shim.js` reescribe al espejo `data-api.binance.vision` / `data-stream.binance.vision`,
que sirve el `1s` sin el bloqueo regional de EE. UU. No se usan futuros. El catálogo de
monedas (PARES) es el único compartido (`config.js`), así que todas tienen datos de 1s.

## Reutilización (nada inventado)

El módulo es un **fork de `velaavela.js`** (servicio huérfano que ya tenía aprobado
todo el chrome). De ahí se reutiliza, sin tocar lo que funciona:

- Barra superior: Back (dorado al pasar), selector de moneda con lista y buscador,
  precio + máx/mín, export con marca de agua, ayuda.
- Gráfica de canvas con zoom/pan: rueda = zoom, arrastre del eje de precios = estira
  vertical, arrastre del eje de tiempo = estira horizontal, arrastre de la gráfica =
  mover atrás/adelante y arriba/abajo, doble clic = reset.
- **Barra de dibujo lateral compartida** (`assets/js/niveles/barra.js`) y sus dibujos
  (`dibujo.js`), órdenes/alertas por clic derecho (`orden.js`).
- La proyección de la operación (zonas ganancia/riesgo + niveles EN/SL/TP + triángulo
  en la vela gatillo) y la ficha de estado.

Lo NUEVO respecto a velaavela: el motor (RSI 2 + EMA 50 en vez del order flow), la
EMA 50 con glow, el panel RSI con bandas 9/99, el R:R a 1:1.5, el stop al otro lado de
la EMA, la persistencia de ganadoras, la temporalidad fija en 1s, la marca y la ayuda.

## Chrome propio

- **Disclaimer oficial** de entrada (sello `assets/portada/red/disclaimer.webp`,
  aceptación obligatoria con casilla, exoneración total: es una estrategia, no consejo
  de inversión). Clave `ss-disc-v1`. Se puede reabrir desde la ayuda.
- **Ayuda** de 7 pasos que explica la estrategia a detalle.

## Integración

- Alta en `SERVICIOS` de `modules/analysis/analisis.js` con `id:'scalp'`,
  `abre:'scalp'`, `cat:'strategy'`, imagen `assets/img/serv-vela.webp` (ya existía).
- Handler: `abre === 'scalp'` → `import('../superscalper/superscalper.js').abrirSuperScalper()`.

## Archivos

- `modules/superscalper/superscalper.js` — el módulo completo (estilos incluidos).
- Imagen de tarjeta: `assets/img/serv-vela.webp` (ya en el repo).
- Reutiliza (sin cambios): `assets/js/niveles/{barra,config,estado,dibujo}.js`,
  `assets/js/orden.js`, `assets/js/feed-shim.js`.
