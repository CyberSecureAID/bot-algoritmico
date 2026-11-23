# CLAUDE.md — Léeme primero

> Este archivo es lo PRIMERO que lee cualquier Claude que trabaje en este repositorio.
> Son las **reglas vivas** del proyecto: un sistema de trabajo pensado para que CADA
> actualización de DecFreedom salga al máximo nivel y sin romper lo que ya funciona.
> No son sugerencias. Si una se incumple, el usuario puede detener el trabajo citando
> su número. Se maneja **dinero de la gente**: la calidad y la verdad van primero.

---

## 0. El proyecto en breve

- Plataforma cripto **DecFreedom**, **no custodial**, sobre **BNB Smart Chain** (BSC), moneda **BNB**.
- Front **estático**: HTML + JS por módulos en `modules/` y `assets/js/`. Nada de backend en el front; lo que se ejecuta del lado del servidor vive en el **worker de Cloudflare** (keeper).
- Dominio oficial: **decfreedom.com**. NUNCA debe aparecer en el código ni en enlaces el dominio temporal e inválido **criptocubaoficial.com** (revisar también el archivo `CNAME`).
- Prosa en **español**, sin guiones largos dentro del texto.

---

## 1. Flujo de entrega — AHORA POR GIT  (sustituye la antigua regla de ZIP)

Antes se entregaba por ZIP y estaba prohibido commitear. **Esa regla queda cancelada.**
El flujo nuevo, pensado para entregar rápido sin arriesgar producción:

1. **Nunca push directo a `main` sin OK explícito del usuario.** `main` es lo que puede ir a producción.
2. Cada entrega va en una **rama** con nombre claro (ej. `spot-limite`, `fix-grafica-eeuu`) y se abre un **Pull Request** para que el usuario revise archivo por archivo.
3. El usuario decide si fusiona. **Antes de fusionar a `main`, confirmar de dónde se despliega el sitio** (GitHub Pages despliega al fusionar; otro hosting no). 
4. Commits pequeños, con mensaje que explique el **qué** y el **porqué**. Un PR = un objetivo.
5. Antes de subir: **revisar el diff y confirmar que no hay secretos** (claves, `.env`, correos privados).
6. Si el usuario pide un ZIP puntual, se le da; pero el canal por defecto es git.

> Git cambia CÓMO se entrega, no las reglas de calidad de abajo. El cache busting `?v=N`
> (regla 3) sigue siendo obligatorio: deploy y caché del navegador son cosas distintas.

---

## 2. Las 7 reglas de oro (calidad en cada cambio)

1. **No tocar lo que funciona.** Verifica qué hay AHORA antes de cambiar. Lo nuevo va en archivos o ramas separadas, o en cambios quirúrgicos mínimos; nunca reescribiendo bloques que ya sirven (salvo que el usuario pida expresamente reescribir, como este mismo documento).
2. **Un solo cambio por entrega.** Tres problemas = tres entregas. El usuario confirma que una funcionó antes de pasar a la siguiente.
3. **Verificar antes de entregar.** Que compila (`node --check` / `node --input-type=module --check`), que los `<script>` de los HTML están balanceados, que no quedó código basura de reemplazos, que las versiones `?v=` encadenan, y que las funciones e ids clave siguen presentes. Idealmente probado en navegador con Playwright.
4. **No involucionar.** Revisa el historial: si un enfoque ya falló, no se repite; no se deshace una solución que ya funcionaba para "probar otra cosa".
5. **Causa raíz, no parches.** Encontrar la causa exacta primero. Si falta un dato (un error de consola, una captura), se pide; no se adivina ni se entrega "prueba a ver".
6. **Decir la verdad.** Lo que no se pudo verificar, se dice. No se afirma "ya quedó" sin comprobarlo. Si el problema está en el servidor, el hosting o la wallet y no en el código, se dice, en vez de tocar código en vano.
7. **Poco texto.** Respuestas cortas, al grano, sin relleno.

---

## 3. Cache busting `?v=N` — OBLIGATORIO al tocar cualquier JS o HTML

El navegador (incluido el de la wallet) cachea los JS. Si cambias un archivo y NO subes su
`?v=N`, el usuario sigue viendo la versión vieja: vuelve el clásico "no cambió nada".

- Al tocar un JS, **sube su `?v=N` en TODOS los archivos que lo importan**, y encadena hacia arriba hasta el HTML de entrada.
- Cadenas típicas:
  - **Móvil:** `movil.html` → `gridbot-ui.js` → `movil.js` → `operar.js`.
  - **Escritorio:** `app.html` → `gridbot-ui.js`.
- El **service worker** (`sw3.js`) es solo red: no cachea nada y borra cachés viejas. Si cambias su lógica, sube su versión.
- Dos imports de la misma URL + mismo `?v` comparten la MISMA instancia del módulo (singleton). Cuidar que un motor compartido (ej. `motor.js`) no se duplique por pedirlo con versiones distintas desde dos archivos.

---

## 4. REGLA CRÍTICA · Datos de mercado y bloqueo regional de Binance (EE. UU.)

### El problema

Toda la plataforma toma los **datos de mercado** (velas, precios, ticker, libro, tiempo real) de **Binance**. Binance **bloquea por región las IP de Estados Unidos** y responde **HTTP 451** en `api.binance.com` y `stream.binance.com`, incluso en endpoints públicos de solo lectura. Un usuario en EE. UU. sin VPN veía **"Could not load market data"** en todas las gráficas. La plataforma se promociona en EE. UU., así que esto es bloqueante.

**Alcance real (verificado):** el bloqueo afecta **solo a la visualización de datos de mercado** (gráficas y precios). **NO afecta** a Swap, Launchpad, Terminal, Shield/Wallet Watcher ni nada on-chain: eso usa la blockchain BSC por RPC (`bsc-dataseed`, `publicnode`, `ankr`), que no geobloquea.

### La solución (aplicada)

Binance publica endpoints **oficiales de solo datos**, sin API key y sin bloqueo regional:

| Original (bloqueado en EE. UU.) | Espejo de solo datos (abierto) |
|---|---|
| `api.binance.com` (REST) | `data-api.binance.vision` |
| `stream.binance.com` (WebSocket) | `data-stream.binance.vision` |

Sirven los mismos datos y el mismo formato. La solución es **`assets/js/feed-shim.js`**: un script "classic" que se carga **antes que todo** y reescribe el host de Binance al espejo en `fetch`, `WebSocket` y `XMLHttpRequest`. No toca ninguna otra URL (blockchain, CoinGecko, WalletConnect quedan intactas).

### La regla, para TODO servicio nuevo

1. **Los datos de mercado se piden a Binance SPOT y solo a endpoints que existan en el espejo** `data-api.binance.vision`: `klines`, `uiKlines`, `ticker`, `ticker/24hr`, `ticker/price`, `ticker/bookTicker`, `depth`, `aggTrades`, `trades`, `exchangeInfo`, `avgPrice`, `time`, `ping`. El WebSocket, a los mismos streams que `stream.binance.com`.
2. **Deja que el shim haga su trabajo.** Puedes escribir `api.binance.com` / `stream.binance.com` con normalidad: el shim los reescribe al vuelo.
3. **No anules el shim.** Si un módulo captura `window.fetch` o `window.WebSocket`, debe hacerlo DESPUÉS del shim y no reponer la versión nativa.
4. **Toda página de entrada NUEVA (HTML) debe cargar `feed-shim.js` como primer script del `<head>`** (`assets/js/feed-shim.js?v=N` desde la raíz; `../../assets/js/feed-shim.js?v=N` desde `modules/x/`).
5. **Evita la API de futuros de Binance (`fapi`/`fstream`)** para datos en el navegador: no tiene espejo y queda bloqueada en EE. UU. Usa spot o resuelve una vía propia.
6. **Lo on-chain no cambia:** swap, launchpad, contratos, wallet, staking siguen por RPC de BSC. El shim no los toca.

> Pendiente: confirmación definitiva desde una IP real de EE. UU.
> Detalle extendido: `modules/DATOS-geobloqueo-EEUU-y-solucion.md`.

---

## 5. Seguridad · dinero de la gente

- **No custodial.** Los fondos viven en las wallets de los usuarios. El contrato solo mueve lo que el usuario aprobó (allowance) y SIEMPRE respeta sus límites (`floorOut` al cerrar, `minSalida` al abrir un límite).
- **KEEPER_PK** (clave privada del keeper) NUNCA en el repo, ni en el front, ni en logs. Vive solo como **secreto cifrado en Cloudflare**. Claude nunca la ve ni la pide.
- La **wallet keeper** (`0x14af2f2fcE64E7aC02F7e3a969A0d9517bD36850`) **NO es owner**. Solo cierra o ejecuta órdenes respetando los límites del usuario.
- La **comisión de apertura** va **directa a la wallet keeper**, no a owners, y no crea multifirma. Se cobra dentro de la misma apertura que el usuario ya firma.
- **Ningún secreto se commitea.** Revisar el diff antes de subir. Correos y datos personales son privados y no van al repo.
- El mensaje firmado (EIP-191) que el front manda al worker debe coincidir **byte por byte** con el que el worker reconstruye (mismo orden de campos, símbolo en mayúsculas y sin caracteres raros). Si no, la firma no valida.

---

## 6. Contratos · UUPS upgradeable

- Proxy **UUPS** (OpenZeppelin **4.9.6**, solc **0.8.24**).
- **Storage append only:** nunca reordenar ni cambiar el tipo de variables existentes; lo nuevo se agrega AL FINAL consumiendo el `__gap`. Mezclar layouts de OZ4 y OZ5 es catastrófico.
- **Upgrade en Remix:** desplegar la nueva implementación (Deploy with Proxy DESMARCADO, sin inicializar), luego proxy → *Write as Proxy* → `upgradeToAndCall(nuevaImpl, 0x)`.
- **Config de compilación:** 0.8.24, optimizer runs=1, evmVersion `shanghai`, bytecodeHash `none`.
- **Direcciones públicas de referencia:** proxy Spot `0xfC3c9516665Ab36D8E56e0797F4392FbFc073c11`. (La dirección de la *implementación* cambia en cada upgrade; no fijarla como regla.)
- Antes de un upgrade: verificar que el storage de la nueva versión preserva el layout anterior (diff de `storageLayout` del compilador y, si se puede, prueba de que una posición vieja sobrevive al upgrade).

---

## 7. Checklist que se pega en cada entrega

- [ ] Es UN solo cambio (o el usuario pidió explícitamente más)
- [ ] Va en **rama + PR**; no toqué `main` sin OK
- [ ] Compila / `<script>` balanceados / sin código basura de reemplazos
- [ ] `?v=` encadenado en TODOS los importadores, hasta el HTML de entrada
- [ ] No deshace nada que funcionaba
- [ ] Verifiqué la **causa raíz**, no es un parche a ciegas
- [ ] **Sin secretos** en el diff
- [ ] Dije la verdad sobre lo que verifiqué y lo que no

---

## 8. Mapa del repo y referencias

- Escritorio: `app.html`. Móvil: `movil.html`. Portada: `index.html` (en móvil redirige a `movil.html`).
- Módulos móviles en `assets/js/movil/`. Spot en `modules/spot/`. Contratos en `contracts/`.
- Más contexto: `DO-NOT-BREAK-MAP.md`, `COMO-AGREGAR-CONTRATOS.md`, `modules/analysis/ANALISIS-roadmap-y-smart-contract.md`, `modules/DATOS-geobloqueo-EEUU-y-solucion.md`.
