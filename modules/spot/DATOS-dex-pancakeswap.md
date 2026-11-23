# Spot · Gráfica y operación de tokens DEX (PancakeSwap) que NO están en Binance

Documento de la solución para operar en Spot (long y short) con tokens de la wallet
que se compran y venden en PancakeSwap pero que la fuente tradicional (Binance) no
lista. Ejemplos reales que ya trae `assets/js/tokens.js`: **BabyDoge**, **USDT.z** y
**EXT (ExactTrader)**.

## El problema

La gráfica de Spot pedía las velas solo a Binance. Un token como BabyDoge, USDT.z o
EXT no cotiza en Binance, así que no tenía gráfica ni se podía operar, aunque el
usuario lo tuviera en su wallet y se pueda vender en PancakeSwap. Faltaba una fuente
alterna de velas para tokens de la red BSC.

## La solución (verificada): GeckoTerminal (API on-chain de CoinGecko), pública y sin llave

Binance bloquea las IP de EE. UU. (HTTP 451), por eso la plataforma ya usa el espejo
`data-api.binance.vision` (ver CLAUDE.md). Para los tokens que Binance no lista, la
fuente alterna es **GeckoTerminal**, la API on-chain de CoinGecko. Es la adecuada por:

- **Pública y sin API key** en el host `https://api.geckoterminal.com/api/v2`.
- **NO geobloquea EE. UU.** (CoinGecko es un servicio accesible desde EE. UU., a
  diferencia de Binance). Así que no reintroduce el problema del 451.
- Cubre los pools de **PancakeSwap** en BSC (red id `bsc`) y da velas **OHLCV** en USD.
- Devuelve las velas en un formato que se normaliza al MISMO shape que las de Binance,
  así la gráfica (LightweightCharts) no distingue el origen.

### Endpoints usados (exactos)

Base: `https://api.geckoterminal.com/api/v2` · Red BSC: `bsc`

1. **Mejor pool de un token por su contrato** (para saber de qué par sacar las velas):
   ```
   GET /networks/bsc/tokens/{contrato}/pools?page=1
   ```
   Se elige el pool con mayor `attributes.reserve_in_usd` (más liquidez). Se cachea
   por sesión.

2. **Velas OHLCV de ese pool**:
   ```
   GET /networks/bsc/pools/{pool}/ohlcv/{timeframe}?aggregate={n}&limit={<=1000}&currency=usd&token=base
   ```
   - `timeframe`: `day`, `hour`, `minute`. `aggregate` válidos: day 1 · hour 1,4,12 ·
     minute 1,5,15. El sitio mapea sus temporalidades así: 1m, 5m, 15m, 1h, 4h, 1d.
   - `currency=usd` y `token=base` → velas del token en dólares.
   - `before_timestamp={segundos}` para traer lotes más viejos (scroll al pasado).
   - Respuesta: `data.attributes.ohlcv_list` = lista de `[timestamp(seg), open, high,
     low, close, volume]`, **de más nueva a más vieja** (el código la ordena ascendente).

3. **Precio USD de uno o varios tokens** (saldo total de la wallet, precio en vivo):
   ```
   GET /simple/networks/bsc/token_price/{contrato1,contrato2,...}
   ```
   Respuesta: `data.attributes.token_prices` = `{ contrato: "precio_usd" }`.

### Límites y atribución

- La capa pública sin llave está limitada por IP (del orden de pocas decenas de
  llamadas por minuto, variable). Por eso el precio en vivo de un token DEX se
  **sondea cada ~22 s** (no hay WebSocket), suficiente y dentro del límite.
- GeckoTerminal **pide atribución** al mostrar sus datos. Se cumple con la nota bajo
  la gráfica: *"DEX price · PancakeSwap data via GeckoTerminal"* (solo en tokens DEX).

## Cómo se integra en Spot

- `datos.js`: `poolDe()`, `velasDex()`, `velasDexAntes()`, `preciosDex()`, `tickerDex()`.
  Código nuevo y aparte; no toca la ruta de Binance.
- `spot.js`: cada moneda se resuelve con `parDeMoneda(id)`:
  - si tiene par en Binance → fuente `binance` (velas por el espejo + WebSocket, igual
    que antes);
  - si no, pero tiene `address` en `tokens.js` → fuente `dex` (velas por GeckoTerminal
    + sondeo cada 22 s).
  La gráfica, el scroll al pasado, el precio en vivo y el precio USD del saldo total
  eligen la fuente según eso. Nada de la lógica de posiciones cambia.
- **Short real en la moneda:** vender un token que tienes marca el nivel de venta en la
  gráfica; la posición activa se mide **en la moneda** (no en USDT): si el precio baja,
  el PnL se pone en positivo en cantidad de moneda (la que recomprarías más barata con
  los USDT de la venta). Si sube, se pone en negativo. Long gana en USDT.
- **USDT.z** deja de tratarse como estable de $1 (no lo es): se grafica y valora por
  DEX como cualquier otro token con contrato.
- **Precios minúsculos** (memecoins): la gráfica y el panel muestran los decimales
  necesarios (ceros iniciales + 4 cifras), p. ej. `0.000000001200`.

## Qué tokens cubre

Cualquier token de `tokens.js` con `address` y sin par en Binance. Hoy: BabyDoge,
USDT.z, EXT. Para habilitar otro token comprable en PancakeSwap/Uniswap basta con
tenerlo en `tokens.js` (símbolo, contrato, decimales); la gráfica y el short salen
solos si ese token tiene un pool con liquidez indexado en GeckoTerminal.

## Verificación y nota honesta

- Verificado en navegador (Playwright) con una wallet simulada: carga de BabyDoge por
  GeckoTerminal, etiqueta `BabyDoge/USD`, atribución visible, eje de precio con decimales
  correctos, short abierto marcando el nivel y PnL en la moneda, y el picker de monedas
  reflejando el saldo real (no una lista fija).
- El entorno de prueba (sandbox) **no** puede llamar en vivo a `api.geckoterminal.com`
  (su proxy solo permite ciertos hosts), así que la llamada real se validó contra la
  documentación oficial de CoinGecko on-chain, no con una respuesta en vivo desde aquí.
  En producción (navegador del usuario, EE. UU.) el host es accesible y responde.
- Si un token no tuviera pool indexado en GeckoTerminal, la gráfica avisa y no rompe
  el resto de la sección.

## Fuentes

- CoinGecko On-chain · Pool OHLCV: https://docs.coingecko.com/reference/pool-ohlcv-contract-address
- CoinGecko On-chain · Top pools por token: https://docs.coingecko.com/reference/top-pools-contract-address
- API pública sin llave de GeckoTerminal: https://docs.coingecko.com/docs/keyless-public-api
