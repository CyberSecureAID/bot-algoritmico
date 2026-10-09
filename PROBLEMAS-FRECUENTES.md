# Problemas frecuentes y cómo solucionarlos

Historial de bugs que ya resolvimos, con su causa raíz exacta, la solución y los
archivos tocados. Si un problema vuelve a salir, busca aquí primero antes de
investigar de cero.

> **Regla de oro del caché (service workers).** Las páginas son cache-first por URL con
> `?v=`. Hay **TRES** service workers, uno por página:
> - `sw.js` → lo usa **shield.html** (Wallet Shield)
> - `sw2.js` → lo usa **index.html** (portada / lobby)
> - `sw3.js` → lo usa **app.html** (la app: bots, swap, futuros)
>
> Si cambias un archivo de Wallet Shield, sube la `VERSION` de **sw.js**. Si cambias la
> app principal, sube **sw2.js** y/o **sw3.js**. Y además sube el `?v=` del archivo en
> TODA la cadena de importadores (desde el HTML raíz hacia abajo), o el navegador y el
> CDN de GitHub te siguen sirviendo la versión vieja aunque borres caché mil veces.
> Diagnóstico rápido: abre el archivo con una URL nueva (`tusitio.com/....js?x=123`) y
> busca tu cambio; si está, el servidor sirve lo nuevo y el problema es el `?v=` o el SW.

---

## MÓDULO: BOTS

### Bots no se abren: sale "límite de bots" aunque no tengas ninguno
- **Causa raíz:** en el contrato GridBot, `maxBots` estaba en **0**. El chequeo
  `botsAbiertos < maxBots` = `0 < 0` = siempre falla. `maxBots` solo se seteaba en
  `initialize`, que ya corrió con una versión vieja, y no había función para cambiarlo.
- **Solución:** upgrade a GridBotV13 que añade `setMaxBots(n)`, y luego llamar
  `setMaxBots(8)` en el proxy. El proxy es UUPS sin espera de 48h.
- **Archivos:** `contracts/bots/GridBotV13.sol` (nueva impl), proxy `0x4e86…F93B`.

### Los bots no se muestran en "My Bots" (y carga lentísimo)
- **Causa raíz:** el frontend leía cada bot con `resumen(bytes32)`, pero esa función
  se perdió en un upgrade del contrato. Cada lectura fallaba y reintentaba por los 4
  RPCs, por decenas de claves viejas → minutos de espera y nada en pantalla.
- **Solución:** leer los datos del bot DIRECTO del storage del proxy con `getStorage`
  (el mapping `rejillas` está en el slot 14). Se decodifica a mano en gridbot.js. Es
  solo lectura, no toca fondos. Además se lee `activa` primero para descartar bots
  cerrados con una sola lectura.
- **Archivos:** `assets/js/gridbot.js` (funciones `resumenK`, `modoDe`, `nivelesDe`).

### Los bots no se cierran: "Cannot read properties of undefined (reading 'estimateGas')"
- **Causa raíz:** el botón de cerrar llamaba a `cancelarRejilla(bytes32)`, función que
  el contrato V13 NO tiene. El método salía `undefined` y reventaba en `.estimateGas`.
- **Solución:** que `cancelarRejillaK` use `cerrarAhora(bytes32)`, que sí existe.
- **Archivos:** `assets/js/gridbot.js` (función `cancelarRejillaK`).

### Bots fantasma: aparecen decenas de bots que ya cerraste al borrar caché
- **Causa raíz:** el contrato guarda TODAS las claves de bots en `clavesDe` para
  siempre; nunca las borra. El frontend las mostraba todas si no filtraba por activo.
- **Solución:** mostrar solo los bots con `activa == true` (se lee del storage).
- **Archivos:** `assets/js/gridbot.js`.

### No se puede cerrar un bot en wallet smart account: "out of gas" / "es probable que esta transacción falle"
- **Características exactas (para reconocerlo):** al cerrar un Cash Out hay que firmar 2-3 transacciones; falla el paso "Closing the bot… confirm in your wallet" (la tx `cancelarRejillaK`). MetaMask avisa "Es probable que esta transacción falle". El trace de BSCScan muestra la tx yendo a `0xdb9B…7dB3` (MetaMask: Delegation Manager), estado **Fail**, error **"out of gas" / "sin gas"**. La wallet tiene BNB de sobra (gas depositado para ~190 operaciones): **NO es falta de saldo**.
- **Causa raíz:** la wallet es una **smart account de MetaMask (EIP-7702)**. MetaMask no envía la tx directa al contrato: la **envuelve y la enruta por su Delegation Manager**, que gasta bastante más gas que una tx normal. `gasMargen` daba solo **35% de margen** sobre la estimación de la tx normal (sin envolver), y los 4 `approve` usaban un `gasLimit` **fijo de 120.000**. Eso alcanza para una EOA normal, pero se queda corto para la tx envuelta de una smart account → out of gas.
- **La variable que despista:** "out of gas" hace pensar en falta de saldo o de gas depositado, pero eso está bien. El problema es el `gasLimit` de la propia tx, demasiado bajo para el envoltorio. **Síntoma que lo delata:** la tx va al Delegation Manager (`0xdb9B…`), no directa al contrato GridBot.
- **Solución exacta:** helper `_esSmartAccount(runner)` que mira si la EOA tiene código desplegado (`getCode` ≠ `'0x'`). Si es smart account: (1) `gasMargen` sube el gasLimit a `estimación × 2 + 300000`; (2) los 4 `approve` pasan por `gasAprobar` (mínimo 600.000); (3) `desenvolverBNB`, que hacía `withdraw` sin margen, ahora pasa por `gasMargen`. Las EOA normales (sin código) no cambian: siguen con la estimación ajustada de siempre.
- **Archivos:** `assets/js/gridbot.js` (v202), `assets/js/gridbot-ui.js` (v268), `app.html`, `sw3.js` (v449).

---

## MÓDULO: SWAP

### El swap sale con guiones (no muestra el saldo) — EL MÁS IMPORTANTE
- **Causa raíz (la gorda):** cada archivo importaba `wallet.js` con un número `?v=`
  distinto (v=125, v=126, v=129). En módulos ES, cada versión distinta es una
  INSTANCIA SEPARADA con su propia cuenta conectada. El swap leía la cuenta de la
  instancia v=129, pero el lobby (portada.js) conectaba la wallet en la v=125. Así que
  el swap veía la cuenta vacía → guiones. En futuros y app.html funcionaba porque ahí
  todo usa la misma instancia (v=129).
- **Solución:** que TODOS usen la misma versión de wallet.js. Se cambió portada.js de
  `wallet.js?v=125` a `?v=129` (la misma que el swap).
- **Archivos:** `assets/portada/portada.js`. `shield.html` también se pasó a v=129 (ya
  resuelto; fue necesario además para el logo y el saldo de Wallet Shield).
- **Causa raíz secundaria:** la lectura de saldo (`saldoNativoBNB`, `balanceToken`)
  usaba un solo RPC sin rotación; si ese RPC fallaba, salía guion.
- **Solución secundaria:** darles rotación de RPC igual que `leeGB`.
- **Archivos:** `assets/js/gridbot.js`.

### El botón Max solo deja usar parte del BNB (dice $3 cuando tienes $5)
- **Causa raíz:** `SW_GAS_BUF` (colchón de gas al dar Máx con BNB) estaba en 0.003 BNB,
  diez veces de más. Un swap en BSC gasta ~0.0003 BNB.
- **Solución:** bajar `SW_GAS_BUF` a 0.0005 BNB.
- **Archivos:** `assets/js/gridbot/swap.js` (constante `SW_GAS_BUF`).

### El swap "es probable que esta transacción falle" SOLO cuando la salida es BNB nativo (USDT→BNB y cualquier token→BNB)
- **Características exactas (para reconocerlo):** al dar "Intercambiar" hacia BNB nativo, MetaMask abre "Solicitud de transacción" con "Es probable que esta transacción falle". La wallet tiene BNB de sobra: NO es falta de saldo. En el log de consola: `execution reverted (no data present; likely require(false) occurred` con `data="0x"`, tx hacia `0x4e86…F93B` (GridBot). El swap hacia un TOKEN (p.ej. USDT→WBNB, USDT→CAKE) SÍ funciona; solo falla cuando la salida es BNB nativo.
- **Lo que PENSAMOS al inicio (ERA FALSO, no repetir):** que era el gas de la smart account EIP-7702, igual que el cierre de bots. Se aplicó `gasMargen` a `ejecutarSwap` y `envolverBNB` (frontend, cadena gridbot v203). NO lo arregló: siguió fallando. Eso descartó el gas y descartó que fuera del frontend.
- **El paso EXACTO que lo destapó (prueba de aislamiento, gratis):** en la misma pantalla de swap, cambiar el token de salida de BNB a WBNB y ejecutar. Resultado: **USDT→WBNB FUNCIONÓ, USDT→BNB FALLÓ.** Como WBNB no toca el paso de "desenvolver", eso aisló el fallo al único tramo que los diferencia: convertir WBNB en BNB nativo dentro del contrato. Confirmó que el permiso, el frontend y el motor DEX están BIEN; el fallo es del contrato.
- **Causa raíz exacta (nivel contrato):** en `_swapNormal`, cuando `tokenOut == address(0)` (BNB nativo), el DEX manda el WBNB al propio contrato y luego hace `IWBNB(WBNB).withdraw(salida)`. El WBNB devuelve ese BNB al contrato con el stipend de **2300 gas** de `.transfer`. Pero el `receive()` del contrato hacía `_acreditarGas(...)` → `gasSaldo[...] += ...`, que es una **escritura en storage (≥5000 gas)**. 2300 < 5000 → out of gas en el `receive` → `withdraw()` revierte → todo el swap revierte con data vacía (`require(false)`). **Afecta a CUALQUIER wallet, no solo smart account.** El mismo fallo rompe el tramo desenvolver WBNB→BNB (`swap` con `tokenIn==WBNB && tokenOut==address(0)`), que también hace `withdraw`.
- **Por qué despistaba:** (1) el `require(false)` sin datos parece un permiso mal dado; (2) que en WBNB sí funcione hace pensar en la wallet; (3) el cierre de bots SÍ era gas de smart account, así que la teoría del gas parecía la misma. Pero el swap a BNB nunca fue gas: era la colisión `receive()` + stipend de `withdraw`.
- **Solución (una sola línea en el contrato):** en `receive()`, ignorar el BNB que llega desde el WBNB (no es depósito de gas, es la devolución del swap):
  `receive() external payable { if (msg.sender == WBNB) return; _acreditarGas(msg.sender, msg.value); }`
  Así ese retorno no escribe storage y cabe en los 2300 gas; `withdraw()` pasa, y el envío final al usuario usa `.call` (gas completo), que llega bien incluso a smart account. Arregla USDT→BNB, cualquier token→BNB y desenvolver WBNB→BNB de un solo golpe.
- **Upgrade:** nueva implementación al proxy UUPS. **Sin espera de 48h** (el `_authorizeUpgrade` del GridBot es `soloOwner`, no tiene timelock; la espera de 48h es de Futuros, otro contrato). Preserva todo el storage (owner, owner2, staking, tesorería, tarifas, oráculo, contabilidad). NO re-ejecuta `initialize`.
- **Auditoría de tamaño (clave, el contrato está al filo de 24576 bytes):** lo DESPLEGADO es `GridBotV13` (NO el `V14`, que traía funciones de lectura extra `resumen`/`nivelesDe`/`modoDe` que lo inflaban por encima del límite y no cabía; el frontend ya lee esos datos directo del storage con `getStorage`, no necesita esas funciones). El fix se aplica sobre `GridBotV13`. Para que entre con margen SIN externalizar nada ni archivos de config: `SwapLib` queda INTERNA (como siempre), optimizador runs=1, EVM **shanghai** (usa PUSH0, achica ~600 bytes), y se quitan los TEXTOS de los `require`/`revert` (el frontend NO los usa: `enCristiano` en `gridbot/util.js` solo reacciona a patrones en inglés y códigos, nunca a esos textos en español). Resultado: **24043 bytes, margen 533**. OJO: en EVM `paris` NO entra (24641); tiene que ser `shanghai` o superior.
- **Archivos:** `contracts/bots/GridBotV13.sol` con DOS cambios respecto al desplegado: (1) la línea del `receive()` (el fix real), (2) quitados 6 mensajes de texto de `require`/`revert` (`no owner`, `sin precio`, `BNB insuficiente`, `limite de bots`, `paga el bot en BNB`, `mes vencido...`) para caber; las condiciones quedan idénticas. `SwapLib.sol` NO se toca (interna, se compila junto). Se despliega como nueva implementación y se hace upgrade al proxy `0x4e86…F93B` (sin 48h). El frontend NO se toca: `gridbot.js` ya manda `address(0)` para BNB nativo. Los `gasMargen` de `ejecutarSwap`/`envolverBNB` (teoría vieja v203) son inofensivos; pueden quedarse.

---

## MÓDULO: WALLET SHIELD

### El logo de la wallet sale PARTIDO (ojo: no es que falte, sale a pedazos)
- **Síntoma exacto (para reconocerlo bien):** NO es que no haya logo. El logo de
  MetaMask aparece, pero sale ROTO, partido en forma de cruz: se ven las dos orejas
  arriba y los dos cachetes a los lados, pero NO la cara del zorro. Son trozos sueltos
  de naranja, no el logo entero. Documentar esto importa: si se busca "no sale el logo"
  se diagnostica mal; el logo sí sale, sale incompleto.
- **Por qué se veía así:** `infoWallet()` (shield-datos.js) decide el logo en cascada:
  1. Si la wallet mandó su icono real por EIP-6963 (`info.icon`, un `<img>` con el logo
     oficial completo) → lo usa.
  2. Si no, usa un SVG dibujado a mano por clave (`LOGOS['metamask']`).
  Ese SVG local tenía solo **3 trozos** (orejas y esquinas), incompleto → de ahí el
  zorro partido. El logo real (caso 1) no se usaba porque `info.icon` salía vacío.
- **Causa raíz de que `info.icon` saliera vacío:** al abrir Wallet Shield la wallet se
  **auto-reconecta** sola (wallet.js, ~línea 380: pide `eth_accounts` y guarda la cuenta
  en `est.cuenta`). Pero ese camino guarda la cuenta y **NO guarda `est.info`**, que es
  donde vive el icono EIP-6963. Como ya había cuenta, shield.html se saltaba el
  `conectar()` normal (el único que llenaba `est.info` con el icono). Resultado:
  `est.info.icon` vacío → infoWallet caía al SVG dibujado → zorro partido.
- **Variables que se probaron y NO resolvieron (para no repetirlas):**
  1. **Unificar la versión de wallet.js.** shield-datos, shield.html y shield.js usaban
     v=125 / v=126 / v=129, es decir TRES instancias separadas, cada una con su propia
     cuenta. Se pusieron las tres en v=129. Esto ERA necesario (si no, infoWallet lee una
     instancia distinta de la que conectó), pero por sí solo NO arregló el logo, porque
     el icono seguía vacío por lo de la auto-reconexión.
  2. **Cambiar el SVG dibujado incompleto (3 trozos) por el SVG completo de config.js
     (13 trozos).** Hacía que el dibujo se viera entero, pero seguía siendo un PARCHE: un
     dibujo, más chiquito, que no es el logo oficial que manda la wallet. Rechazado.
- **Solución real:** que `infoWallet()` tome el icono oficial DIRECTO de la lista
  EIP-6963 que la propia wallet anuncia, aunque la auto-reconexión no lo haya guardado
  en `est.info`. Se añadió un paso (caso 1.5) que llama a `wallet.walletsDisponibles()`
  (devuelve cada wallet con su `icono` oficial), busca la activa / la que coincide con la
  clave detectada / la que marca `window.ethereum` (isMetaMask, isTrust, etc.) / o la
  única si solo hay una, y usa ese icono real en un `<img>`. Así sale el logo entero de
  verdad, no un dibujo.
- **Archivos tocados:** `assets/js/shield/shield-datos.js` (función `infoWallet`, caso
  1.5 nuevo con `walletsDisponibles`) y la cadena de versiones (`shield-datos.js?v=113`,
  `shield.js?v=160`, `shield.html` y `app.html` a `shield.js?v=160`). Caché: subir `sw.js`.
- **Funciones/variables clave:** `infoWallet()`, `wallet.walletsDisponibles()`,
  `est.info.icon` (EIP-6963), `proveedores6963` (lista que llena el evento
  `eip6963:announceProvider`), la auto-reconexión de wallet.js (~línea 380).

### El saldo total solo cuenta el BNB (ignora los tokens)
- **Síntoma exacto:** el total en USD de Wallet Shield mostraba solo el valor del BNB
  nativo (ej. $5.33). Los tokens ERC20 (USDT, etc.) no se sumaban; el total salía igual
  que si solo tuvieras BNB.
- **Causa raíz:** `saldoTotalUSD` (shield-datos.js) detectaba los tokens SOLO con una
  llamada a Etherscan V2 (`action=tokentx`). Esa llamada no devolvía nada —muy
  probablemente la API key no vale en el endpoint v2 de etherscan.io (es key de BscScan),
  o CORS, o límite de la key gratis. Sin tokens detectados, solo se sumaba el BNB (que sí
  se lee on-chain con `getBalance` y se valora con DeFiLlama por el WBNB).
- **Variable previa que NO bastó:** antes se usaba `api.bscscan.com`, que bloqueaba CORS.
  Se cambió a `api.etherscan.io/v2/api?chainid=56`. Eso arregló el CORS, pero la detección
  seguía sin devolver tokens (probado CON internet: solo salía BNB).
- **Solución aplicada:** revisar SIEMPRE on-chain (con `balanceOf`) una lista fija de los
  tokens grandes de BSC, sin depender de que Etherscan responda. Lista `COMUNES` dentro de
  `saldoTotalUSD`: USDT, BUSD, USDC, CAKE, ETH, BTCB, DAI. Etherscan queda como añadido por
  si trae otros. Con esto el saldo ya suma esos tokens y muestra el total correcto (probado:
  pasó de solo-BNB a $7.37).
- **IMPORTANTE — esta solución RESUELVE pero es INCOMPLETA:** solo cubre esos ~7 tokens
  escritos a mano. Si la wallet tiene CUALQUIER otro token (el token propio de CriptoCuba,
  o cualquiera poco común), NO aparecerá. Razones:
  1. La lista `COMUNES` es fija: solo esos 7 tokens.
  2. La detección dinámica (Etherscan `tokentx`) sigue sin funcionar (sin verificar / rota).
  3. DeFiLlama solo pone precio a tokens listados; un token no listado (el de CriptoCuba)
     saldría en $0 aunque se detectara.
- **Solución completa pendiente:** (a) hacer que Etherscan V2 funcione de verdad —verificar
  que la key sea de Etherscan (no solo de BscScan) o sacar una key propia de etherscan.io—;
  o (b) detectar TODOS los tokens con el propio RPC usando `eth_getLogs` de eventos Transfer
  hacia la wallet; o (c) usar la API mejorada de NodeReal de balances de tokens. Y para
  valorar tokens no listados, consultar el precio on-chain en PancakeSwap.
- **Archivos tocados:** `assets/js/shield/shield-datos.js` (función `saldoTotalUSD`, lista
  `COMUNES` nueva).
- **Funciones/variables clave:** `saldoTotalUSD()`, `COMUNES`, `balanceOf` (ABI mínimo),
  `BSCSCAN` + `BSCSCAN_KEY` (Etherscan V2), `WBNB`, precios de `coins.llama.fi` (DeFiLlama),
  `lector()` (provider on-chain).

---

## MÓDULO: CACHÉ / DESPLIEGUE

### Subo un archivo y el cambio no se refleja, aunque borre caché
- **Causa raíz:** el service worker de esa página (sw.js / sw2.js / sw3.js según la
  página; ver la regla de oro de arriba) es cache-first y guarda cada archivo por su URL
  completa con `?v=`. Si cambias el archivo pero dejas el mismo `?v=`, sirve la versión
  vieja del caché. Borrar caché del navegador no basta porque al recargar vuelve a pedir
  la misma URL vieja.
- **Solución:** subir el número `?v=` del archivo cambiado EN TODA LA CADENA de
  importadores, de arriba hacia abajo. Ejemplo para gridbot.js:
  `index.html` → `portada.js?v=N` → `gridbot/swap.js?v=M` → `gridbot.js?v=K`. Sube los 3.
  Para Wallet Shield: `shield.html` → `shield.js?v=N` → `shield-datos.js?v=M`. El HTML raíz
  (index.html, app.html, shield.html) siempre llega fresco porque el SW ignora los
  documentos. Y sube la `VERSION` del service worker correspondiente (sw/sw2/sw3).
- **Diagnóstico rápido:** abre el archivo directo con una URL nueva
  (`tusitio.com/assets/js/....js?x=123`) y busca tu cambio. Si está, el servidor sirve lo
  nuevo y el problema es el `?v=` en la cadena o la VERSION del SW. Si en la pestaña
  Network ves "(disk cache)" con el SW como initiator, es el service worker.

---

## MÓDULO: HTML INDEPENDIENTES

### Falta el favicon en páginas sueltas (shield, limpiar, movil)
- **Causa raíz:** esos HTML no tenían el `<link rel="icon">`.
- **Solución:** añadir en el `<head>`:
  `<link rel="icon" type="image/png" href="assets/img/cco-32.png">`
  `<link rel="apple-touch-icon" href="assets/img/aurex-apple.png">`
- **Archivos:** `shield.html`, `limpiar.html`, `movil.html`.

---

## PENDIENTES (anotados, aún sin resolver)

### Bugs detectados en la presentación (octubre 2026)
- **Bots: el botón de cerrar dice "Pause", debe decir "Close".** No está en `gridbot-ui.js`; localizar dónde se renderiza ese label (otro módulo o label dinámico).
- **Wallet Shield: barra de scroll vertical amarilla no deseada** al entrar a la portada. Hay que quitarla; afea la experiencia.
- **Analysis: como owner salta la ventana de cobro** en vez de ir a Choose Your Tools. Tocando cualquier plan, el owner debe pasar directo.
- **Analysis (web, escritorio): al entrar a una herramienta (p.ej. Open Liquidity Pools) bota al lobby y luego carga**; y al cerrar con la X bota al lobby en vez de volver a Choose Your Tools (donde están Liquidity Pool, Gear Pool y Smart Levels).
- **Analysis: dice "Hire Pool", debe decir "Gear Pool".**
- **P2P / Marketplace: dice "wallet no conectada"** cuando la wallet sí está conectada.

### De antes
- **Wallet Shield: saldo total — resuelto pero INCOMPLETO.** Suma los tokens grandes (USDT, BUSD, USDC, CAKE, ETH, BTCB, DAI), pero no los poco comunes ni el token propio de CriptoCuba. Ver módulo WALLET SHIELD.
- **Wallet Shield: crear las 3 imágenes** de la portada desplegable: `card-permissions.webp`, `card-poison.webp`, `card-watcher.webp` en `assets/portada/img/` (proporción 16:10). Mientras no existan, cada tarjeta muestra su icono dorado de respaldo.
- **Wallet Shield: Contract Check en Tron — NO se hará** (decisión tomada): necesita `triggerconstantcontract` y no existe el concepto de "nuestros contratos" en Tron.
- **Futuros:** falta terminar (móvil, desconectar el timer de cierre del Sprint, indicadores pro). Además, el upgrade de futuros cumple sus 48h.
- **Idioma:** ~48 textos de `config.js` faltan en inglés.
- **Mensajes verdes de los iconos de info de los bots:** pasar a la paleta del sitio.
- **Segundo upgrade del contrato:** Cash Out trailing, Accumulator "vender todo y re-montarse", conectar a Contabilidad, auto-cierre real.

### Trayectoria (cuando se termine lo pendiente)
- **Sistema de creación de tokens/criptomonedas** (estilo AMW8): que la gente cree sus propias monedas, con una comisión por venta que va a la plataforma cada vez que se vendan.
