# Spot · Explicación absoluta (estructura lógica de la sección)

Documento de contexto y diseño de la sección **Spot** de DecFreedom. Define, por
puntos, qué es, por qué es novedosa, cómo funciona hoy y qué debe construir el smart
contract cuando llegue el momento. No es un contrato ni código: es el mapa.

---

## 1. Qué es Spot (en una línea)

Operar criptomonedas **reales** (no contratos de futuros, sin apalancamiento y sin
liquidación) desde la wallet del usuario, de forma **no custodial**: lo que ve es lo
que tiene, y sus monedas nunca salen de su wallet.

## 2. Lo novedoso (esto no lo he visto en ningún exchange)

- En Spot, **vender una moneda que tienes es abrir una posición en corto**. No es solo
  deshacerte del token: el sistema **marca el nivel al que vendiste** en la gráfica y
  **sigue tu posición en tiempo real**.
- Mientras la posición está abierta se te muestra, en vivo, **cómo va**: su beneficio
  actual medido **en la propia moneda que vendiste** (no en USDT) y en porcentaje.
- **Si el precio baja, tu posición corta se pone en ganancia** (podrías recomprar más
  barato y quedarte con más moneda). Si sube, en pérdida.
- **Cerrar la posición = comprar.** Para cerrar un corto, se **compra (long)** con los
  mismos USDT (o más) que obtuviste al vender. El usuario no lo vive como "comprar",
  lo vive como **"cerrar mi posición"**, aunque por debajo firme 2 o 3 veces.
- Si el usuario **no quiere recomprar**, cancela la posición: la **X** de la esquina o
  el botón **Close/Cancel** de la fila. La posición deja de seguirse.
- Un **long** es lo de siempre: compras con USDT esperando que suba; la ganancia es en
  USDT.

## 3. Estructura lógica de la interfaz

1. **Primero, dirección (arriba):** el usuario marca **Long** o **Short** en la parte
   superior del panel. Esa sola elección configura todo lo de abajo. Hasta que no
   marca, nada más está activo (a propósito).
2. **Market o Limit**, con **Take Profit** y **Stop Loss** opcionales.
3. **Amount:** en long es USDT; en short es cuánta **moneda** vende, y elige **qué
   moneda** en el botón de unidad (solo las que realmente tiene).
4. **Botón de ejecución (abajo):** Long o Short. Es el que **abre** la posición. Al
   marcar un lado arriba, el botón **contrario de abajo queda bloqueado** (no se puede
   abrir al revés por error).
5. **Saldos de la wallet (barra superior):** total en USD + una tarjeta por moneda
   (se deslizan de lado) y un **botón que abre todas tus monedas**. Tocar una moneda la
   carga para operar: gráfica + panel.
6. **Gráfica** navegable al pasado, y **posiciones, órdenes e historial** abajo.

## 4. Las dos formas de ganar (el modelo exacto)

- **Long:** gastas `A` USDT y compras `A/precio` monedas. Cierras vendiendo. PnL en
  **USDT** = (precio_actual − precio_entrada) · monedas.
- **Short (spot):** vendes `Q` monedas a `precio_entrada` y recibes `A = Q · precio_entrada`
  USDT. El sistema recuerda `Q` y `precio_entrada`. Si el precio baja, con esos mismos
  `A` USDT recomprarías `A/precio_actual` monedas, que es **más** que `Q`. PnL en
  **la moneda** = `A/precio_actual − Q`. Se pone en positivo cuando `precio_actual <
  precio_entrada`. **Cerrar** = ejecutar esa recompra (long) con los `A` USDT.

## 5. De dónde salen los datos de la gráfica (y su respaldo)

Dos mundos, según la moneda:

- **Monedas que cotizan en Binance** (BTC, BNB, ETH, etc.): velas y precio por Binance,
  a través del **espejo** `data-api/stream.binance.vision` (regla de CLAUDE.md: Binance
  bloquea las IP de EE. UU. con 451; el espejo no). WebSocket en vivo.
- **Tokens que NO están en Binance** (BabyDoge, USDT.z, EXT y cualquier token con pool
  en una DEX): fuente alterna **que no geobloquea EE. UU.**, con **respaldo en cascada**
  (si una falla o limita por ritmo, la siguiente cubre):
  1. **GeckoTerminal** (`api.geckoterminal.com`) — velas OHLCV + precio, sin API key.
  2. **CoinGecko on-chain** (`api.coingecko.com/.../onchain`) — **mismo dataset**, otro
     CDN; respaldo directo si GeckoTerminal limita o cae.
  3. **DexScreener** (`api.dexscreener.com`) — precio del **par de más liquidez** de
     cualquier DEX (Pancake o Uniswap); respaldo de precio independiente.
  En vivo sin WebSocket: se **sondea** cada ~22 s (dentro del límite público).
  GeckoTerminal pide **atribución**: se muestra bajo la gráfica en estos tokens.

> Este patrón de respaldo no es nuevo en la plataforma: el servicio **Terminal** ya lo
> usa en producción (`modules/terminal/gecko.js` con doble origen, `precio.js` con
> DexScreener). Spot reutiliza ese enfoque probado, no inventa uno nuevo.

## 6. Multidex y "mejor liquidez" (clave para el contrato)

- Un mismo token puede tener pools en **varias DEX**. Para algunas monedas **Uniswap
  tiene mucha más liquidez que PancakeSwap** (ejemplo real: **USDT.z**, contrato
  `0x4BE3…07DB4`, tiene su mayor bolsa en **Uniswap V4 Pool Manager** en BSC,
  dirección que termina en `…E9DF`).
- Por eso la lectura de precio ya se apoya en **DexScreener**, que ordena por
  `liquidity.usd` y **elige la DEX con mejor liquidez** automáticamente. Así el precio
  y el gráfico reflejan el mercado real, venga de Pancake o de Uniswap.
- **Regla de diseño:** la comercialización (y el futuro contrato) debe **enrutar a la
  DEX con mejor liquidez y mejor precio** para esa moneda, no a una fija.

## 7. Qué ya existe en el proyecto (reutilizar, no reinventar)

El servicio **Terminal** (`modules/terminal/`) ya trae casi toda la infraestructura
on-chain que el contrato de Spot necesitará:

- `resolver.js` — resuelve un **contrato** a su par real en PancakeSwap (getPair con
  WBNB y, si no, USDT), lee metadatos y reservas **en cadena**.
- `compra.js` — **compra y venta reales no custodiales** de un token vía el contrato
  Terminal (PancakeSwap V2): `comprar`, `vender`, `aprobar`, cotizaciones y saldos.
- `precio.js` / `grafico.js` — precio en vivo por **reservas V2**, **DexScreener** o
  **TronScan**, según el token.
- `gecko.js` — velas con **doble origen** (GeckoTerminal + CoinGecko on-chain), BSC y
  **Tron**.
- `rpc.js` — acceso a RPC con rotación, tope de tiempo y reintentos.
- `tron.js` — Tron en solo lectura por **TronScan** (ya hay una API key declarada).
- `posiciones.js` — registro de compras y ventas.

El contrato de Spot debe apoyarse en estas piezas (o en su misma lógica), no duplicarlas.

## 8. El smart contract de Spot (lo que debe permitir; aún NO se construye)

Cuando llegue el momento, el contrato (no custodial, el usuario firma) debe:

1. **Comprar y vender** la moneda en la **DEX de mejor liquidez y precio** (enrutado
   entre Pancake V2/V3 y Uniswap, no una DEX fija).
2. Abrir un **short** ejecutando la **venta** de la moneda que el usuario tiene, y
   **cerrarlo** ejecutando la **compra** con los USDT obtenidos (el usuario lo vive como
   "cerrar posición").
3. Permitir **cancelar** una posición abierta (no recomprar) sin penalización: la
   posición simplemente deja de seguirse.
4. Soportar **disparadores (triggers)**: cierre **manual** (botón) y **automático** por
   TP/SL y **anti gap** (si el precio salta la mecha, cerrar al mejor precio posible).
5. Ser **no custodial**: nada se queda en ningún sitio; entrega directa a la wallet.

## 9. Multichain (futuro)

- **Hoy:** BSC (Pancake/Uniswap). 
- **Después:** **Tron**, **Solana** y **Ethereum**. Para Tron ya hay API key de
  TronScan; los contratos se desplegarían con Remix. Cada red con su vía propia, pero
  con la **misma experiencia** para el usuario.

## 10. Comisiones

- Por ahora el objetivo es que **al usuario le sea rentable operar aquí**, así que la
  comisión será **nula o muy baja** (sin decidir aún). Es un servicio para **atraer
  clientes** a la plataforma, no un centro de costos para ellos.

## 11. Estado actual (hecho y verificado) vs. pendiente

**Hecho y verificado en navegador (lado cliente, no custodial de seguimiento):**
- Interfaz Spot completa: dirección arriba, panel, botón de ejecución abajo con bloqueo
  del lado contrario, Market/Limit con TP/SL.
- Saldos reales de la wallet (barra superior deslizable + botón con todas las monedas);
  tocar una moneda la carga para operar.
- Gráfica por Binance (espejo) y por **DEX** (GeckoTerminal con doble origen +
  DexScreener de respaldo) para tokens que no están en Binance.
- **Short** marcando el nivel de venta y siguiendo la posición **en la moneda**; cierre
  por compra; cancelar por la X/Close. USDT.z tratado como token con precio propio.

**Pendiente (siguiente fase):**
- El **smart contract** del punto 8 (ejecución on-chain real, enrutado multidex por
  mejor liquidez, triggers y anti gap).
- Extensión **multichain** (Tron, Solana, Ethereum) del punto 9.
- Decisión final de **comisión** (punto 10).
