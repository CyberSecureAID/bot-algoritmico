# Spot — nuevo servicio del loader (entre Analysis y Futures)

Módulo nuevo y autónomo en `modules/spot/`. Clona la interfaz completa de Trading
Demo (misma gráfica LightweightCharts, órdenes limit, alertas, TP/SL arrastrables,
operación abierta, tarjeta por operación) y la convierte a **Spot real, no
custodial**. Abre desde el loader superior en su propia página `spot.html`.

## Novedades de esta entrega (archivos tocados: spot.js, estilos.js, datos.js, spot.html)

- **Barra superior más limpia:** se quitó el bloque 24H (change, high, low). Ese
  espacio ahora lo usan las tarjetas de saldo de la wallet, que se deslizan de lado.
- **Botón de monedas** (cuadrado, junto a Total balance): abre un popup con TODAS las
  monedas de la wallet. Tocar una moneda (en la tira o en el popup) la carga para
  operar: gráfica y panel. Las tarjetas también son clicables.
- **Gráfica y operación de tokens DEX que no están en Binance** (BabyDoge, USDT.z, EXT
  y cualquier token con contrato y pool en PancakeSwap). Fuente alterna verificada:
  GeckoTerminal (sin llave, no geobloquea EE. UU.). Detalle completo en
  `DATOS-dex-pancakeswap.md`.
- **Short en cualquier token que tengas:** marca el nivel de venta en la gráfica y la
  posición se mide en la moneda; si el precio baja, se pone en positivo en cantidad de
  moneda. El picker de short lista solo lo que el usuario realmente tiene (no una lista
  fija). USDT.z deja de tratarse como estable de $1: se valora y grafica por DEX.
- **Arreglo:** los popups (monedas de wallet y de short) salían por detrás de la capa
  de la sección (z-index). Ahora salen por delante.

## Qué cambia respecto a Trading Demo

- **Sin apalancamiento y sin precio de liquidación.** El importe (Amount) es el
  valor en USDT que comprometes; el panel muestra cuántas monedas son a ese precio.
- **Saldo real de la wallet conectada** arriba: total en USD + un cuadrito por
  activo con saldo (USDT, BNB, BTCB, ETH…). Se lee con `saldosTodas()` y `tokens.js`
  de la plataforma; nada se custodia. Reconoce la wallet ya conectada del sitio
  (reconectarSiProcede), así que el saldo aparece solo. Sin wallet, dice "No wallet detected".
- **El usuario elige dirección arriba (Long/Short):** un selector arriba del panel
  define toda la sección. Al marcar uno, el botón opuesto de abajo queda inhabilitado.
  En short, el Amount muestra las monedas que el usuario realmente tiene (de su wallet,
  no una lista fija) y puede elegir cuál vender.
- **Long y Short en spot:**
  - **Long** = compras la moneda con USDT. Ganancia o pérdida **en USDT**.
  - **Short** = vendes la moneda base que tienes (ej. BTC) marcando precio y
    cantidad; si el precio baja, recompras más barato y te queda **más moneda**. El
    PnL se mide **en la moneda** (ej. +0.002 BTC), no en USDT. Verificado en navegador.
- **Sin marca "demo"** ni marca de agua "DEMO" en la imagen compartida. El rótulo
  superior dice **SPOT** (rojo) y el punto de "How It Works" es **rojo**.
- **How It Works** rehecho como **stepper** (como el de Vela a Vela), en inglés y
  explicado para principiantes: qué es spot, long comprando, short vendiendo y
  recomprando más barato, cómo fijar el importe, Market/Limit con TP y SL, y el saldo.
- **Gráfica navegable al pasado:** carga 1000 velas y va cargando lotes más viejos
  al hacer scroll a la izquierda (`velasAntes` con `endTime`).
- **Cableado no custodial listo para el smart contract futuro:** la lógica de
  `onPrecio()` (fills de limit, TP y SL, anti gap por mecha) es la que ejecutará el
  contrato cuando se conecte. Por ahora las posiciones se llevan del lado del cliente.

## Datos (cumple CLAUDE.md)

`spot.html` carga `feed-shim.js` como primer script del `<head>`, así Binance SPOT
se reescribe al espejo `data-api/data-stream.binance.vision` y la gráfica no se
bloquea por región en EE. UU. No usa futuros.

## Archivos de esta entrega (respetar rutas)

NUEVOS (todo el módulo, autónomo):
- `modules/spot/spot.html` — página de entrada (feed-shim + arranque).
- `modules/spot/spot.js` — interfaz y lógica.
- `modules/spot/motor.js` — motor spot (PnL long en USDT, short en la moneda).
- `modules/spot/datos.js` — datos de Binance (velas, ticker, stream, velasAntes).
- `modules/spot/estilos.js` — estilos del módulo.
- `modules/spot/vendor/lightweight-charts.standalone.production.js` — motor de gráfica.

CAMBIADO:
- `index.html` — un item "Spot" en el loader, entre Analysis y Futures
  (`<a href="modules/spot/spot.html">Spot</a>`).

No se tocó nada del área de Análisis ni de Trading Demo. El loader se repite en
cada página de módulo (terminal.html, etc.); si quieres el item "Spot" también en
esas barras, dímelo y lo agrego a cada una (son archivos aparte).

## Verificado en navegador (Playwright)

- Abre desde `spot.html`, interfaz idéntica, gráfica con datos.
- Panel sin apalancamiento ni liquidación; Amount + "Coins at this price".
- Short abierto: la posición muestra la cantidad y el PnL **en BTC** (no USDT).
- How It Works (stepper) con el paso del short explicado; punto rojo; rótulo SPOT.
- `node --check` OK en los cuatro JS; `<script>` balanceados en `spot.html`.

El WebSocket a Binance no conecta desde el entorno de prueba (IP de sandbox): es
esperado; confirma además que el shim reescribe al espejo. En producción conecta.
El saldo poblado y la ejecución on chain requieren wallet real (y, para operar de
verdad, el smart contract que haremos después).
