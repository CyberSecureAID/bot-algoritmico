# Región / geobloqueo de gráficas — RESUELTO (y reglas vivas del repo)

> Este archivo reemplaza al antiguo `CLAUDE.md`. Mantiene las reglas vivas del
> proyecto y documenta la solución REAL del bloqueo por región en las gráficas.
> La "solución" anterior (solo el espejo `.vision`) NO resolvía el problema desde
> una IP residencial de EE. UU.; lo que lo resuelve es el failover a Binance.US,
> que aquí está centralizado en `feed-shim.js`.
>
> (Nota: el archivo que un Claude lee automáticamente al abrir el repo es
> `CLAUDE.md`. Si lo borras, este queda como referencia manual.)

---

## El proyecto en cuatro líneas

- Plataforma cripto **DecFreedom**. Dominio oficial: **decfreedom.com**. El dominio
  temporal **criptocubaoficial.com NO debe aparecer** en código activo ni en enlaces.
- Red: **BNB Smart Chain** (BSC), moneda **BNB**. Front estático (HTML + JS por
  módulos en `modules/` y `assets/js/`), con cache busting por `?v=N` en los imports.
- Entrega: **NO git**. Los cambios se entregan por **ZIP o archivo suelto**, con solo
  los archivos tocados y su cascada de `?v=`. No commitear ni pushear.
- Prosa en español, **sin guiones dentro de las palabras**.

---

## REGLA CRÍTICA · Datos de mercado y bloqueo regional (EE. UU.)

### El problema real (confirmado en producción, nov 2026)
Toda la plataforma toma los **datos de mercado** (velas, precios, ticker, tiempo
real) de **Binance**. Binance bloquea por región las IP de EE. UU. y responde
**HTTP 451** en `api.binance.com` y `stream.binance.com`.

El espejo público `data-api/data-stream.binance.vision` resuelve muchos casos,
**pero se confirmó que desde una IP residencial de EE. UU. TAMBIÉN queda
bloqueado** (verificado por el usuario desde dos IP residenciales en dos estados
distintos, en incógnito y con caché borrada). Por eso, confiar solo en `.vision`
dejaba las gráficas en negro en EE. UU.

Lo que **sí responde desde EE. UU.** es **Binance.US** (`api.binance.us` /
`stream.binance.us:9443`), que sirve el **mismo formato de API** para los pares
principales. (Spot lo demostró: con ese respaldo, Spot funciona perfecto desde
EE. UU., confirmado por el usuario.)

> Importante: el bloqueo afecta **solo a los datos de mercado de Binance**
> (gráficas y precios). NO afecta a Swap, Launchpad, Terminal ni nada on chain:
> eso usa la blockchain BSC por RPC, que no geobloquea. Por eso Swap, Launchpad y
> Terminal **no** cargan el shim: no lo necesitan.

### La solución aplicada — failover en cascada, centralizado en el shim
`assets/js/feed-shim.js` (v2) intercepta `fetch` / `WebSocket` / `XMLHttpRequest`
y, **solo para los hosts `*.binance.com`**, aplica un failover en cascada:

| Paso | REST | WebSocket |
|---|---|---|
| 1 (normal) | `data-api.binance.vision` | `data-stream.binance.vision` |
| 2 (respaldo EE. UU.) | `api.binance.us` | `stream.binance.us:9443` |

- **REST:** prueba el paso 1; si da **451/403** o no conecta, salta al paso 2 y
  **recuerda** la preferencia en `sessionStorage` (no reintenta el espejo en cada
  llamada). Es transparente: el módulo recibe la respuesta buena y no cambia nada.
- **WebSocket:** abre por el host preferido; si el socket a `.vision` se cierra o
  da error **antes de abrir**, marca la preferencia a Binance.US. Como **todos los
  módulos de gráfica reconectan** en `onclose`, su siguiente intento ya sale por
  `.us`. La **formación de velas en tiempo real no cambia**: mismo stream, mismo
  motor; solo cambia el host cuando hace falta.

El formato de API es idéntico, así que **ningún módulo ni parser se toca**.

### Alcance quirúrgico (lo que el shim NO toca)
- Solo `*.binance.com`. Pasan intactos: RPC/blockchain, CoinGecko, WalletConnect,
  y los módulos que **ya usan hosts `.vision`/`.us` directos** como
  `modules/spot/datos.js` (que trae su propio failover). A Spot no se le toca.
- **Futuros** (`fapi`/`fstream.binance.com`): no tienen espejo ni equivalente en
  `.us`. El patrón de host del shim los evita. Hoy el único módulo que los usaba
  (order flow) está huérfano.

### Verificado (en navegador, simulando el bloqueo residencial de EE. UU.)
- REST: `api.binance.com` → `.vision` 451 → **failover a `.us`**, entrega datos
  (ok, 200) y recuerda `.us` para las siguientes llamadas.
- WS: al fallar `.vision`, conmuta la preferencia a `.us`.
- **Gráfica real de Análisis (Reaction Zones) renderiza completa** con `.vision`
  bloqueado, tomando los datos de Binance.US. Sin "no se pudo cargar".
- No regresión: con `.vision` 200 (fuera de EE. UU.) **no** hay failover; y las
  llamadas directas a `.vision` (Spot) pasan intactas, no se redirigen a `.us`.

### Páginas que cargan el shim (todas las que usan datos de Binance)
`index.html`, `portada.html`, `app.html`, `futuros.html`, `movil.html`,
`shield.html`, `modules/spot/spot.html`, `modules/analysis/analisis.html`,
`modules/bots/bots.html`, `modules/terminal/alertas.html`,
`modules/shield/shield.html`. Se carga como **primer `<script>` del `<head>`**,
antes que los módulos.

> `index.html` (la portada) abre Análisis y otras secciones **en overlay** (mismo
> documento), así que necesita el shim en su propio `<head>`. Antes no lo tenía:
> esa era una de las causas de que las gráficas de Análisis no salieran desde la
> portada. Ya está añadido.

### Reglas para TODO servicio/página nuevo con gráficas
1. Pide los datos de mercado a **Binance spot** por los endpoints que existen en
   ambos lados (`klines`, `ticker`, `ticker/24hr`, `ticker/price`, `depth`,
   `aggTrades`, `trades`, `exchangeInfo`, `time`...). Puedes escribir
   `api.binance.com` / `stream.binance.com` con normalidad: el shim se encarga.
2. **Carga `feed-shim.js` como primer `<script>` del `<head>`** en toda página de
   entrada NUEVA que muestre gráficas de Binance (ruta relativa correcta, `?v=`).
3. No anules el shim: si capturas `fetch`/`WebSocket`, hazlo **después** y no
   repongas la versión nativa.
4. Evita `fapi`/`fstream` en el navegador (sin espejo ni `.us`).
5. Lo on chain (swap, launchpad, terminal, staking, wallet) sigue por RPC de BSC;
   no se enruta por el shim y no necesita cargarlo.

### Caveats honestos
- Binance.US no da **cuentas** en algunos estados (NY, TX...), pero su **API
  pública de datos** suele responder igual. Por eso el plan A es `.vision` y `.us`
  es el respaldo.
- Binance.US lista menos símbolos. Los pares que grafican los módulos (BTC, ETH,
  BNB, SOL...) están en `.us`. Los tokens exóticos (EXT, BabyDoge...) grafican por
  la vía **on chain** (DEX), que no pasa por Binance ni por el shim.
- Falta la confirmación final desde la IP residencial del usuario tras desplegar.
  Si algo siguiera en negro, el dato a pedir es **la consola del navegador** (los
  errores de red exactos).

---

## Otras reglas de trabajo del repo
- Antes de tocar algo: **auditar, hallar la causa raíz y verificar** (idealmente en
  navegador con Playwright) antes de entregar. No romper lo que ya funciona. Ver
  `DO-NOT-BREAK-MAP.md`.
- Entregar **solo los archivos realmente tocados**, con su cascada de `?v=`
  actualizada en cada importador.
- Para agregar contratos o servicios, ver `COMO-AGREGAR-CONTRATOS.md` y
  `modules/analysis/ANALISIS-roadmap-y-smart-contract.md`.

---

## Historial de las dos correcciones de Análisis (nov 2026)
1. **Arranque serializado tras la wallet** (`analisis.html`): la sección esperaba
   `await reconectarSiProcede()` antes de montar la gráfica (6471 ms → 425 ms al
   desacoplar). La wallet se reconecta en paralelo; la píldora espera
   `window.__walletLista`. (Si no se auto conecta, el usuario pulsa Connect Wallet
   manualmente; no es bloqueante.)
2. **Failover de región** (este documento): `.vision` bloqueado desde EE. UU. →
   failover a Binance.US centralizado en `feed-shim.js`, aplicado a todas las
   páginas con gráficas de Binance.
