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

## 9. Multichain: la ruta (Solana, Tron, Ethereum)

El modelo es **un contrato por red** y un **botón de red** en la cabecera de Spot. Al
cambiar de red, el usuario cambia la red de su wallet y la sección usa el contrato y la
fuente de datos de esa red. La **experiencia es la misma** (long, short, cerrar,
cancelar); solo cambian las piezas de abajo:

| Red | DEX para operar | Gráfica (velas) | Precio/holders/seguridad | Contrato |
|---|---|---|---|---|
| **BSC** (hoy) | PancakeSwap V2/V3, Uniswap | GeckoTerminal → on-chain (Sync) | reservas V2 + DexScreener | Remix (Solidity), ya hay base en Terminal |
| **Ethereum** | Uniswap V2/V3 | GeckoTerminal (red `eth`) → on-chain | DexScreener + **Etherscan API** (misma que BscScan) | Remix (Solidity), casi igual que BSC |
| **Tron** | SunSwap | GeckoTerminal (red `tron`, ya lo soporta `gecko.js`) | **TronScan API** (ya hay key) | TronBox/Remix Tron (TVM); el usuario pasa fondos a Tron |
| **Solana** | Jupiter (agregador) / Raydium | GeckoTerminal (red `solana`) | DexScreener/Birdeye | **programa** en Rust/Anchor (no es EVM); otra wallet (Phantom) |

Pasos concretos:
1. **Botón de red** en la cabecera (BSC / ETH / Tron / Solana). Cambia la red de la
   wallet (en EVM, `wallet_switchEthereumChain`; en Solana, otra conexión de wallet).
2. **Datos por red:** la gráfica ya es multired en el espejo on-chain (GeckoTerminal
   acepta `eth`, `tron`, `solana`), y los escáneres (TronScan, Etherscan) dan holders y
   seguridad, como ya hace Terminal.
3. **Ejecución por red:** cada red su contrato. BSC y Ethereum comparten casi el mismo
   Solidity (solo cambian direcciones de router/factory). Tron es TVM (Solidity con
   matices). Solana es un programa Rust/Anchor aparte.
4. **Orden sugerido:** Ethereum primero (reutiliza casi todo lo de BSC), luego Tron
   (lectura ya está en `tron.js`), y Solana al final (es la más distinta).

> Nota honesta: Solana y Tron **no** son EVM, así que su contrato no se copia de BSC; se
> escribe para su máquina. La **lectura** (gráfica, precio, seguridad) sí está casi lista
> para las tres gracias a GeckoTerminal, TronScan y Etherscan.

## 10. Comisiones: la recomendación

El problema: PancakeSwap ya cobra lo suyo (0.25% por swap), y la sección por sí sola no
genera ingresos. Cobrar por operar la haría poco rentable para el usuario.

**Recomendación: comisión SOLO sobre la ganancia (success fee), nunca sobre el capital.**

- Se cobra **únicamente al cerrar en ganancia**, un **10% a 15% de la ganancia** (no del
  capital), en **BNB** (o la moneda de gas de la red). Si la operación cierra en pérdida
  o en cero, **no se cobra nada**.
- Ejemplo: abres un long con 1,000 USDT, cierras con +200 USDT de ganancia. Comisión =
  12% de 200 = **24 USDT equivalentes en BNB**. Te quedas con 176 de ganancia neta. Si
  cerraras en pérdida, comisión = 0.
- Por qué así: el usuario solo paga cuando **gana**, así que siempre le conviene operar
  aquí. Alinea nuestro ingreso con su éxito. Es el modelo que usan las plataformas de
  copytrading y los vaults serios.
- El cobro lo hace el **contrato** en el cierre (descuenta el fee del excedente antes de
  entregar), de forma no custodial y transparente. Sin ganancia, sin fee.
- Un **mínimo de gas**: si la ganancia es minúscula, el fee no debería ser menor que el
  gas que cuesta cobrarlo; en ese caso, fee = 0 (no vale la pena).

Rango final a decidir por ti: **10%, 12% o 15% de la ganancia**. Nada sobre el capital,
nada en operaciones perdedoras.

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
- **Gráfica on-chain** (eventos Sync de PancakeSwap) para tokens que ningún indexador
  lista, como EXT. **Búsqueda por contrato** en el selector (pega un `0x…` y lo carga).
- **PnL en vivo con porcentaje** en cada posición, **congruente** con el movimiento del
  precio desde la entrada (long: % del alza; short: % de la caída). Verificado con
  pruebas de cálculo y en navegador.
- **Sin marca demo** en las fotos exportadas (gráfica y tarjeta de operación); se borró
  el código muerto del certificado que aún decía "DEMO".

**Pendiente (siguiente fase):**
- El **smart contract** del punto 8 (ejecución on-chain real, enrutado multidex por
  mejor liquidez, triggers y anti gap) con el **success fee** del punto 10.
- Extensión **multichain** (Ethereum, Tron, Solana) del punto 9.
