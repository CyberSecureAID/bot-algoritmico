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

- **Wallet Shield: saldo total — resuelto pero INCOMPLETO.** Ya suma los tokens grandes
  (USDT, BUSD, USDC, CAKE, ETH, BTCB, DAI), pero no los poco comunes ni el token propio de
  CriptoCuba. Ver "Solución completa pendiente" en el módulo WALLET SHIELD.
- **Wallet Shield: integración con TronScan** en los servicios que lo permitan (Permissions
  Scan y los que investiguen hashes o wallets), para soportar redes BSC y Tron. Emergency
  Evacuation NO aplica (mueve fondos reales en BSC a una dirección de respaldo).
- **Wallet Shield: Permissions Scan no debe auto-escanear.** Al entrar debe salir ya la
  wallet conectada por defecto MÁS la opción de escanear otra wallet; se escanea la que el
  usuario elija al dar Scan. (La lógica del selector ya existe en la ventana de diagnóstico.)
- **Dust Collector no abre** al pulsarlo (parpadea pero no sale). Archivo: `tools.js`.
- **Futuros:** falta terminar (móvil, desconectar timer de cierre del Sprint, indicadores).
- **Mensajes verdes de los iconos de info de los bots:** pasar a la paleta del sitio.
- **Segundo upgrade del contrato:** Cash Out trailing, Accumulator "vender todo y
  re-montarse", conectar a Contabilidad, auto-cierre real.
