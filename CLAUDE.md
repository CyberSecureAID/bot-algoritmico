# CLAUDE.md — Léeme primero

> Este archivo es lo primero que debe leer cualquier Claude que audite o trabaje en este repositorio. Contiene reglas vivas del proyecto. Si implementas un servicio nuevo, estas reglas te aplican.

## El proyecto en cuatro líneas

- Plataforma cripto **DecFreedom**. Dominio oficial: **decfreedom.com**. Dominio temporal, no válido, que NUNCA debe aparecer en el código ni en enlaces: criptocubaoficial.com.
- Red: **BNB Smart Chain** (BSC), moneda **BNB**. Front estático (HTML + JS por módulos en `modules/` y `assets/js/`), con cache busting por `?v=N` en los imports.
- Entrega: **NO git**. Los cambios se entregan por ZIP o archivo suelto, con solo los archivos tocados y su cascada de versiones. No commitear ni pushear.
- Prosa en español, sin guiones (guiones) dentro de las palabras.

---

## REGLA CRÍTICA · Datos de mercado y bloqueo regional de Binance (EE. UU.)

### El problema (reportado en noviembre de 2026)

Toda la plataforma toma los **datos de mercado** (velas, precios, ticker, libro, tiempo real) de **Binance**. Binance **bloquea por región las IP de Estados Unidos** y responde **HTTP 451 "Unavailable For Legal Reasons"** en `api.binance.com` y `stream.binance.com`, incluso en los endpoints públicos de solo lectura. Resultado: un usuario en EE. UU., sin VPN, veía **"Could not load market data"** en todas las gráficas. La plataforma se va a promocionar en EE. UU., así que esto es bloqueante.

**Alcance real (verificado por auditoría):** el bloqueo afecta **solo a la visualización de datos de mercado** (gráficas y precios). **NO afecta** al Swap, Launchpad, Terminal, Shield/Wallet Watcher ni nada on-chain: eso usa la blockchain BSC por RPC (`bsc-dataseed`, `publicnode`, `ankr`, etc.), que no geobloquea.

### La solución (aplicada)

Binance publica endpoints **oficiales de solo datos de mercado**, sin API key y sin ese bloqueo regional:

| Original (bloqueado en EE. UU.) | Espejo de solo datos (abierto) |
|---|---|
| `api.binance.com` (REST) | `data-api.binance.vision` |
| `stream.binance.com` (WebSocket) | `data-stream.binance.vision` |

Sirven exactamente los mismos datos y el mismo formato. La solución es **`assets/js/feed-shim.js`**: un script "classic" que se carga **antes que todo** y reescribe el host de Binance al espejo en `fetch`, `WebSocket` y `XMLHttpRequest`. No toca ninguna otra URL (blockchain, CoinGecko, WalletConnect quedan intactas). Como el formato es idéntico, ningún módulo ni ningún parser cambia.

Está inyectado como primer `<script>` del `<head>` en las páginas de entrada: `index.html`, `portada.html`, `app.html`, `futuros.html`, `movil.html`, `shield.html`, `modules/analysis/analisis.html`, `modules/bots/bots.html`, `modules/terminal/alertas.html`, `modules/shield/shield.html`.

### Estado

- Verificado en navegador: el shim reescribe correctamente, es selectivo (no toca lo que no es Binance) y no rompe el arranque de ningún módulo.
- **Pendiente de confirmación definitiva desde una IP real de EE. UU.** (el contacto que reportó el problema no ha vuelto a confirmar). No se puede dar por cerrado al 100% hasta esa prueba. La evidencia es fuerte: es el endpoint oficial de datos públicos de Binance y `assets/js/muros.js` ya lo usaba como respaldo con una nota sobre el geobloqueo.
- Los **futuros** de Binance (`fapi.binance.com` / `fstream.binance.com`) NO tienen espejo público. El único módulo que los usa es `modules/analysis/orderflow/` y hoy está **huérfano** (no se abre desde ninguna tarjeta ni overlay), así que no afecta a nada en uso. Si algún día se conecta, habrá que resolverle su propia vía.

### La regla, para TODO servicio nuevo de ahora en adelante

1. **Los datos de mercado se piden a Binance SPOT y solo a endpoints que existan en el espejo** `data-api.binance.vision`: `klines`, `uiKlines`, `ticker`, `ticker/24hr`, `ticker/price`, `ticker/bookTicker`, `depth`, `aggTrades`, `trades`, `exchangeInfo`, `avgPrice`, `time`, `ping`. El WebSocket, a los mismos streams que `stream.binance.com`.
2. **Deja que el shim haga su trabajo.** Puedes escribir `api.binance.com` / `stream.binance.com` en el código con normalidad: el shim los reescribe al vuelo. No hace falta escribir el host del espejo a mano.
3. **No anules el shim.** Si un módulo captura `window.fetch` o `window.WebSocket`, debe hacerlo DESPUÉS del shim (nunca cargarse antes del `<head>`), y no debe reponer la versión nativa.
4. **Toda página de entrada NUEVA (HTML) debe cargar `feed-shim.js` como primer script del `<head>`**, con la ruta relativa correcta (`assets/js/feed-shim.js?v=N` desde la raíz, `../../assets/js/feed-shim.js?v=N` desde `modules/x/`).
5. **Evita la API de futuros de Binance (`fapi`/`fstream`) para datos en el navegador**: no tiene espejo y quedará bloqueada en EE. UU. Usa spot, o resuelve una vía propia.
6. **Lo on-chain no cambia:** swap, launchpad, contratos, wallet, staking siguen por RPC de BSC. El shim no los toca y no deben enrutarse por él.

> Detalle extendido del diagnóstico y una solución alternativa con proxy propio: `modules/DATOS-geobloqueo-EEUU-y-solucion.md`.

---

## Otras reglas de trabajo del repo

- Antes de tocar algo: auditar, encontrar la causa raíz y verificar (idealmente en navegador con Playwright) antes de entregar. No romper lo que ya funciona. Ver `DO-NOT-BREAK-MAP.md`.
- Entregar solo los archivos realmente tocados, con su cascada de `?v=` actualizada en cada importador.
- Para agregar contratos o servicios, ver `COMO-AGREGAR-CONTRATOS.md` y `modules/analysis/ANALISIS-roadmap-y-smart-contract.md`.
