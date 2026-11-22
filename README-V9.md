# DecFreedom / CriptoCuba — README V9 (Contexto: Spot, Análisis y el keeper de Cloudflare)

> PARA CLAUDE EN UNA SESIÓN NUEVA: lee este documento entero antes de tocar nada.
> Continúa V1 a V8 y NO reemplaza a ninguno. El README-V8 tiene la base completa
> (todos los contratos desplegados, Futuros, Firebase, y las reglas de trabajo con
> detalle en su sección 0). Este V9 añade lo que V8 no cubre: la sección SPOT, el
> estado de ANÁLISIS, la auditoría de seguridad del contrato de Spot, y el objetivo
> del keeper en Cloudflare, incluido el punto EXACTO en el que nos detuvimos.
>
> Fecha de este documento: 2026-11-20.

---

## 0. Cómo trabajar con este usuario (resumen; el detalle está en V8 sección 0)

- NO toques lo que ya funciona. Lo nuevo va en archivo/módulo/contrato NUEVO, con
  cambios quirúrgicos mínimos. Estudia el código al 100% antes de actuar, de verdad,
  no "por arribita".
- NO se usa git en este proyecto. La entrega es por ZIP o archivo suelto, con SOLO los
  archivos tocados y su cascada de versiones `?v=N` actualizada en cada importador. Si
  un hook te recuerda commitear, respondes exactamente: "No. En este proyecto no se usa
  git: la entrega va por ZIP, ya enviado. No comiteo ni pusheo."
- Verifica SIEMPRE antes de entregar: `node --check` del JS, scripts balanceados, y
  RENDER visual con Playwright mirando de verdad las capturas. El contenedor no alcanza
  Binance ni BSC, así que para probar se monta un harness offline con datos simulados y
  mocks de fetch/WebSocket (hay ejemplos probados en el historial de la sesión de Spot).
- Prosa en español, concisa. CERO emojis. CERO guiones largos y CERO guiones dentro de
  las palabras (código y nombres de archivo exentos).
- Para configurar/desplegar: paso a paso, UN paso a la vez, y espera su "listo". Este
  usuario se abruma rápido con lo técnico de infraestructura. Ve MUY despacio. No le
  sueltes jerga sin explicar. Él leyó "Hola mundo" de Cloudflare como un "test" y se
  frustró: hay que aclarar cada término y evitar que sienta que estamos "probando a ver
  si funciona".
- Dominio oficial: decfreedom.com. NUNCA debe aparecer en el código criptocubaoficial.com.
- userEmail jesuskuba175@gmail.com es PRIVADO.

---

## 1. EL PUNTO EXACTO EN EL QUE PARAMOS (léelo primero al retomar)

Spot quedó CERRADO en todo lo funcional. Lo único pendiente de Spot es el keeper de
Cloudflare (ver sección 4). Estábamos empezando a montarlo y se hizo una pausa para
atender otras tareas ajenas al proyecto. Al volver, retomamos por el keeper.

Estado del arranque del keeper cuando paramos:
- El usuario YA creó una wallet nueva dedicada al keeper (solo él tiene su llave
  privada; a Claude solo le daría la dirección pública). Esa wallet NO es owner y nunca
  debe serlo: va a tener solo permiso de keeper vía `setKeeper`.
- El usuario dice que ya aseguró las llaves de owner en un multisig (hallazgo #2 de la
  auditoría, ver sección 3).
- El usuario estaba en la pantalla de Cloudflare "Crea una aplicación" y no sabía qué
  tocar. Rechaza cualquier cosa que suene a "test" (incluido el botón "Hola mundo", que
  en realidad solo crea un worker vacío, no es un test).
- Próximo paso real: crear el Worker del keeper APARTE del repo y escribir su código,
  empezando por fijar el `floorOut` (hallazgo crítico #1). Ir muy despacio con él.

Objetivo de fondo de todo esto (no olvidarlo): disparo de órdenes TP/SL rápido y
automático, en el plan gratuito de Cloudflare, y que tocar el repo de GitHub NUNCA
rompa el keeper (por eso el worker vive aparte, con URL fija).

---

## 2. SECCIÓN SPOT (lo más reciente del proyecto)

Spot es trading al contado (long y short) no custodial sobre BNB Smart Chain, con swaps
por PancakeSwap V2 y gráficas tipo TradingView (LightweightCharts v5 standalone,
vendorizado en `modules/spot/vendor/`). Los datos de mercado vienen del espejo de
Binance (data-api.binance.vision) vía `assets/js/feed-shim.js`; lo on chain va por RPC
de BSC (`https://bsc-rpc.publicnode.com`).

### 2.1 Archivos y versiones ACTUALES (cascada vigente)

- `modules/spot/spot.html` importa `spot.js?v=28` (y `feed-shim.js?v=2`).
- `modules/spot/spot.js` (v28) importa:
  - `contrato.js?v=7` — cableado on chain al contrato SpotDF.
  - `datos.js?v=12` — feed Binance (velas, ticker, movers24h).
  - `motor.js?v=12` — estado de posiciones y UI optimista (estados pend/cerrando).
  - `estilos.js?v=21` — CSS de Spot.
  - `indicadores-spot.js?v=5` — motor de indicadores de Spot (incluye MultiMA).
  - `dust.js?v=1` — motor del Colector de polvo (swaps directos al router).
  - `logos.js?v=1`.

Regla de oro: si tocas uno, sube su `?v=` y el de spot.js (y spot.html si cambió spot.js).

### 2.2 Qué se construyó (últimas actualizaciones, ya entregadas)

- Guardia de precio (POOL_MALO) en contrato.js: compara el precio del pool on chain con
  el precio real del gráfico; si se desvían más del 15% (DESV_MAX=0.15) BLOQUEA la
  apertura. Es la red que evita las "pools trampa" (como ZKC, que le costó ~5 USD).
- Movers curados: lista blanca `MOVERS_OK` en spot.js (BTC, ETH, BNB, SOL, XRP, ADA,
  DOGE, LINK, DOT, LTC, AVAX, UNI, AAVE, CAKE, TWT, SHIB, FLOKI, PEPE). Se pide
  `D.movers24h({minAmp:0,factorBTC:0,minVol:5e5,max:1000})` SIN la reja de volatilidad
  (si no, la lista salía vacía) y la lista blanca es el único filtro. Solo restringe.
- Indicadores: leyenda con 3 chips a la DERECHA del botón Indicators y un "+N" (que al
  pasar el cursor abre un gestor con todos y papelera). El número del "+N" ahora es
  dorado (antes salía negro, invisible). Se copió el sistema de multichart.
- Duplicar indicadores: en el selector, un "+" dorado en cada overlay activo agrega otra
  instancia del mismo indicador con su propia config (EMA 9 y EMA 200, por ejemplo);
  muestra ×2, ×3. También está el botón de duplicar en la barra de ajustes.
- MultiMA (indicador NUEVO, local de Spot, no está en la libreria compartida para no
  romper multichart): un solo indicador que dibuja 5 medias EMA (9/20/50/100/200) en
  amarillo/azul/rojo/verde/blanco. Su panel de ajustes es compacto (206px, con scroll
  interno, no se desborda ni en móvil) y permite cambiar color, periodo y grosor de cada
  media por separado. Con esto son 51 indicadores. Todo vive en indicadores-spot.js.
- Colector de polvo (Dust Collector) dentro del popup "All Your Coins": botón Dust en el
  header, selección de monedas con casillas, destino USDT o BNB, botón Collect, un swap
  por moneda directo al router de PancakeSwap (motor en dust.js, no usa el contrato
  SpotDF ni gridbot). SEGURIDAD: siempre deja ~1 USD en BNB para gas (la reserva se
  aplica dentro del motor, no en la UI). Las variantes SupportingFeeOnTransferTokens
  respetan el mínimo de salida.
- De sesiones previas de Spot: UI optimista (registrar al ENVIAR la tx, confirmar en
  segundo plano), balance que cuenta WBNB, certificado de trading (sin marca de agua,
  sin 10.000 falsos, PnL en USD), cruceta, etiqueta de precio de entrada, cierre on
  chain firmado, velocidad (lecturas por RPC propio, cotizaciones en paralelo, approve
  máximo una vez por token).

### 2.3 Qué está cerrado y qué falta en Spot

- Cerrado: indicadores, MultiMA, movers curados, lógica de swap (el usuario confirmó que
  abre y cierra shorts con BNB contra BTC y otras), colector de polvo, velocidad, balance.
- Falta SOLO: el keeper de Cloudflare (sección 4), que incluye el arreglo del `floorOut`.

---

## 3. CONTRATO SpotDF.sol + AUDITORÍA DE SEGURIDAD

- Fuente: `contracts/spot/SpotDF.sol`. Proxy UUPS en BSC.
- Proxy (usar esta): `0xfC3c9516665Ab36D8E56e0797F4392FbFc073c11` (constante SPOT_ADDR en
  contrato.js). La dirección de implementación no está en el repo; verla en BscScan o en
  el registro de despliegue.
- Diseño: NO custodial por allowance. Los fondos viven SIEMPRE en la wallet del usuario;
  en cada abrir/cerrar entran y salen en la misma tx. No hay bote común. Cobra 1% SOLO
  sobre la ganancia al cerrar en positivo (reparte 10% staking, 45% owner1, 45% owner2).
- Dependencias que usa (direcciones del registro base, ver sección 7): router PancakeSwap
  V2, USDT, Contabilidad, Oráculo, Staking. El keeper se autoriza con
  `setKeeper(<wallet keeper>, true)` desde el owner (paso on chain pendiente del keeper).
- Para TP/SL automático: el usuario firma UNA aprobación por adelantado; cuando el precio
  llega, el keeper llama `cerrar(id, ruta, minOut, deadline)`. Un keeper SOLO puede cerrar
  si `minOut >= floorOut` (el piso que fijó el usuario).

### Auditoría (documento completo: `modules/spot/AUDITORIA-seguridad-spotdf.md`)

Veredicto: contrato bien construido, no custodial real, no se halló robo directo por un
tercero. Tres puntos:

1. CRÍTICO — `floorOut` por defecto en 0. El contrato exige `minOut >= floorOut` al
   keeper, pero hoy el front abre con floorOut=0, así que un cierre por keeper no tendría
   piso (un bot MEV podría robar en la salida). NO es bug en vivo hoy (no hay keeper y los
   cierres manuales van protegidos con su anti slippage). Es el PRIMER código a escribir
   en el keeper: cuando el usuario ponga TP/SL, el front fija floorOut (en USDT para long,
   en moneda para short; cuidado con los decimales).
2. ALTO — llaves de owner y upgrade del proxy. Cualquier owner puede actualizar y vaciar
   lo aprobado (MaxUint256). Mitigación: owners en multisig (Gnosis Safe), llaves en
   hardware wallet, nunca en el servidor del keeper. El usuario dice que ESTO YA LO HIZO.
3. ALTO — setters potentes (setRouter/setUsdt/setKeeper) sin demora. El multisig ya cubre
   el grueso; un timelock de verdad pide un pequeño cambio de contrato (separar el permiso
   de actualizar del de cobrar) porque hoy cualquier owner actualiza al instante y además
   cobra. Queda para una revisión del contrato, con cuidado.

Guía de pasos para 2 y 3: `modules/spot/GUIA-endurecimiento-seguridad.md`.
El usuario NO quiere testnet. Para un cambio de contrato (timelock) al menos simular en un
fork local antes de tocar mainnet; es su decisión, pero manejar fondos de usuarios sin
pruebas es delicado, y el propio contrato pide auditoría profesional independiente.

---

## 4. EL KEEPER DE CLOUDFLARE (lo que sigue)

Objetivo: que las órdenes TP/SL/límite se disparen solas y rápido, en el plan gratuito,
y que editar el repo NUNCA rompa el keeper.

Diseño acordado (detalle y estrategia en `modules/spot/ESTRATEGIA-ejecucion-instantanea-keeper.md`):

- El Worker vive APARTE del repo de GitHub. NO se despliega con git push. Tiene su propia
  URL fija. El front solo LLAMA a esa URL. Así las ediciones del repo no lo tocan. Esto
  resuelve el problema histórico de "toco el repo y se rompe todo".
- Las órdenes (TP/SL) se guardan en el worker (Cloudflare KV), no en el navegador, para
  que el keeper las vigile aunque no haya ninguna pestaña abierta.
- Un cron del worker vigila el precio (espejo de Binance); cuando se toca el nivel, el
  worker calcula `minOut` desde la cotización del pool (>= floorOut) y llama `cerrar()`
  firmando con la wallet keeper (su llave privada va como SECRETO cifrado de Cloudflare).
- Endpoints del worker: registrar orden, estado (ver órdenes pendientes y última
  revisión EN VIVO, para no esperar 24 horas a ver si funciona), cancelar.
- El front, al poner un TP/SL: envía la orden al worker Y fija `floorOut` on chain
  (setFloor), que es el arreglo del hallazgo crítico #1.

Por qué fallaban los intentos anteriores (no repetir): el keeper/worker estaba pegado al
front o dependía de que el navegador estuviera abierto; el plan gratuito diario se gastaba;
las órdenes límite se disparaban una vez y luego no. La solución es el worker aparte, con
estado propio y cron, y con un endpoint de estado para verificar sin esperar.

Pasos de montaje (ir MUY despacio con el usuario, uno a la vez, esperando "listo"):
1. Wallet keeper creada (HECHO por el usuario). Dar solo la dirección pública.
2. Crear el Worker (aparte del repo). El usuario se traba aquí; evitar la palabra "test".
3. Claude escribe el worker (KV + cron + endpoints + firma de cerrar con ethers) y el
   floorOut en el front.
4. Secreto de Cloudflare con la llave del keeper; variables (RPC, contrato, router, USDT).
5. Desplegar el worker, obtener su URL.
6. On chain: `setKeeper(<wallet keeper>, true)` desde el multisig owner.
7. Cablear el front a la URL del worker (registrar orden + setFloor + estado).
8. Prueba con UNA posición real pequeña (el usuario no hará testnet).

---

## 5. SECCIÓN ANÁLISIS (estado)

Documento guía: `modules/ANALISIS-roadmap-y-smart-contract.md` (hoja de ruta detallada).

- Las HERRAMIENTAS ya existen y son independientes del cobro: Multichart
  (`modules/multichart/`, con el sistema de indicadores que Spot reutiliza vía
  `modules/indicadores/libreria.js` y `ui.js`), Trading Demo, VWAP Pro
  (`modules/institutional/`), Reaction Zones, Liquidity Pools, Heat Pools, Smart Pools.
- Lo que FALTA: el contrato de cobro por servicio "AnálisisPagos" (precio por servicio en
  vez de precio único), el programa de referidos (reutiliza mecánica existente) y el
  modelo de distribución. Es roadmap, aún no desplegado.
- Existe ya `AnalisisPro.sol` desplegado (del área de Futuros, ver V8), distinto del
  "AnálisisPagos" planificado.

El usuario dijo que Análisis todavía no está terminado. Es la siguiente sección grande del
proyecto después de cerrar Spot (keeper).

---

## 6. BUG DE NAVEGACIÓN PENDIENTE (reportado como grave)

Navegar Bots -> Análisis -> Spot rompe la página con error 404 (el usuario lo describió
como "unicornio multicolor"). También "desde análisis hasta spot me da error 404" directo.
Está pendiente de auditar: el enrutado/carga entre esos módulos y su cascada de versiones.
No empezar hasta que el usuario lo pida; quedó anotado como tarea.

---

## 7. REGISTRO DE CONTRATOS RELEVANTES (direcciones; PROXY = usar esta)

De V8 (base ya desplegada y operativa):
- Owner principal (wallet del usuario): `0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d`
  (NOTA: el usuario dice que los owners ya pasaron a un multisig; confirmar la dirección
  del Safe con él al retomar el keeper).
- USDT (BSC, 18 dec): `0x55d398326f99059fF775485246999027B3197955`
- WBNB: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`
- PancakeSwap Router V2: `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- Contabilidad (proxy): `0x7FdE85E0bD53208F380980cfE317A9D4982434Ab`
- OraculoPrecios (proxy): `0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3`
- Staking (proxy): `0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4`

De Spot (este bloque):
- SpotDF (proxy): `0xfC3c9516665Ab36D8E56e0797F4392FbFc073c11`

(El registro completo de TODOS los contratos está en README-V8, sección 3.)

---

## 8. QUÉ LEER AL RETOMAR (orden)

1. Este README-V9 (dónde estamos, el keeper, el floorOut).
2. `README-V8.md` (base: contratos, Futuros, reglas completas, Firebase).
3. `CLAUDE.md` (regla crítica del geobloqueo de Binance en EE. UU. y el feed-shim).
4. Para Spot, en `modules/spot/`: `ESTRATEGIA-ejecucion-instantanea-keeper.md`,
   `AUDITORIA-seguridad-spotdf.md`, `GUIA-endurecimiento-seguridad.md`, `LEEME.md`,
   `AUDITORIA-spot-premium.md`, `DATOS-dex-pancakeswap.md`.
5. `DO-NOT-BREAK-MAP.md` y `PROBLEMAS-FRECUENTES.md` antes de tocar cualquier cosa.
6. Para Análisis: `modules/ANALISIS-roadmap-y-smart-contract.md`.

Resumen de una línea: Spot está terminado salvo el keeper; el keeper es un Worker de
Cloudflare aparte del repo, y su primer código es fijar el floorOut al poner TP/SL. Ir
muy despacio con el usuario en la parte de Cloudflare.
