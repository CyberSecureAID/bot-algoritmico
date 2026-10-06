# Problemas frecuentes y cómo solucionarlos

Historial de bugs que ya resolvimos, con su causa raíz exacta, la solución y los
archivos tocados. Si un problema vuelve a salir, busca aquí primero antes de
investigar de cero.

> Regla de oro descubierta: **el service worker `sw3.js` es cache-first por URL con
> `?v=`.** Si cambias un archivo y NO subes su número `?v=` en TODA la cadena de
> importadores (desde el HTML raíz hacia abajo), el navegador y el CDN de GitHub te
> siguen sirviendo la versión vieja, aunque borres caché mil veces. Al cambiar
> cualquier .js, sube su `?v=` en todos los archivos que lo importan.

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
- **Archivos:** `assets/portada/portada.js`. (Pendiente: `shield.html` usa v=126, hay
  que pasarlo a v=129 también para el swap de Wallet Shield.)
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

## MÓDULO: CACHÉ / DESPLIEGUE

### Subo un archivo y el cambio no se refleja, aunque borre caché
- **Causa raíz:** `sw3.js` (el service worker de app.html) es cache-first y guarda cada
  archivo por su URL completa con `?v=`. Si cambias el archivo pero dejas el mismo
  `?v=`, sirve la versión vieja del caché. Borrar caché del navegador no basta porque
  al recargar vuelve a pedir la misma URL vieja.
- **Solución:** subir el número `?v=` del archivo cambiado EN TODA LA CADENA de
  importadores, de arriba hacia abajo. Ejemplo para gridbot.js:
  `index.html` → `portada.js?v=N` → `gridbot/swap.js?v=M` → `gridbot.js?v=K`. Sube los
  3 números. El HTML raíz (index.html, app.html) siempre llega fresco porque el SW
  ignora los documentos. También conviene subir la VERSION de sw2.js/sw3.js.
- **Diagnóstico rápido:** abre el archivo directo con una URL nueva
  (`tusitio.com/assets/js/gridbot.js?x=123`) y busca tu cambio. Si está, el servidor
  sirve lo nuevo y el problema es el `?v=` en la cadena.

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

- **Wallet Shield: saldo total solo cuenta BNB.** `nr_getTokenHoldings` (NodeReal) está
  fallando, por eso no lista USDT. Archivo: `assets/js/shield/shield-watch.js`.
- **Wallet Shield: logo de la wallet conectada sale roto.** URL del icono. Archivos:
  `assets/js/shield/shield.js` / `shield-datos.js`.
- **Dust Collector no abre** al pulsarlo (parpadea pero no sale). Archivo: `tools.js`.
- **Futuros:** falta terminar (móvil, desconectar timer de cierre del Sprint, indicadores).
- **Mensajes verdes de los iconos de info de los bots:** pasar a la paleta del sitio.
- **Segundo upgrade del contrato:** Cash Out trailing, Accumulator "vender todo y
  re-montarse", conectar a Contabilidad, auto-cierre real.
