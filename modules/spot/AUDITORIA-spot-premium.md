# AUDITORIA Spot — geobloqueo, disparos limit, fee y lo que falta para ser premium

> Documento de auditoría del módulo `modules/spot/`. Fecha: 11 nov 2026.
> Escrito para que cualquiera que retome el proyecto entienda el estado real,
> sin adornos. Lo que está verificado se marca como tal; lo que es hipótesis o
> no se puede comprobar desde aquí, también.

---

## 0. Nivel de rigor de esta auditoría

- **Alto en lo verificable en navegador.** Todo lo que digo "verificado" se probó
  con Playwright renderizando `spot.html` de verdad, mirando los píxeles, con las
  rutas de Binance mockeadas para simular el bloqueo de EE. UU. No es "a ojo".
- **Honesto en lo no verificable.** No puedo originar tráfico desde una IP real de
  EE. UU. ni desde el contrato en mainnet. Lo que dependa de eso queda marcado
  como PENDIENTE, no como hecho. La regla del proyecto es decir la verdad, no
  dar por cerrado lo que no se comprobó.
- **Alcance de esta tanda:** se arregló y verificó **Spot**. El resto de la
  plataforma (Analysis y demás superficies de datos de mercado) **todavía no**;
  se explica abajo por qué y qué falta.

---

## 1. Geobloqueo de EE. UU. (causa raíz real)

### 1.1 Por qué la "solución" anterior no era una solución
El `CLAUDE.md` daba por buena esta vía: reescribir `api.binance.com` →
`data-api.binance.vision` con `feed-shim.js`. **El espejo `.vision` también
responde 451 desde una IP de EE. UU.**: sigue siendo infraestructura de
Binance.com y lleva el mismo bloqueo regional. La "confirmación" que se tuvo en
su día fue un navegador con caché de una sesión abierta por VPN, no una prueba
limpia desde EE. UU. Es decir: el shim reescribe bien, pero reescribe a un host
que **también está bloqueado**. Por eso el usuario en EE. UU. seguía viendo la
pantalla negra.

### 1.2 La solución aplicada (Spot)
En `modules/spot/datos.js` se montó **failover multi host**, no un solo espejo:

- **REST con lista de hosts y rotación:**
  `data-api.binance.vision` → `api.binance.us`.
  Cada petición pasa paths (`/klines`, `/ticker/24hr`, `/ticker/price`...). Si el
  primero da 451/403, salta al siguiente de forma transparente. Binance.US es un
  exchange **accesible desde EE. UU.**, con el **mismo formato de API** de Binance
  spot, así que ningún parser cambia.
- **WebSocket con failover:** `data-stream.binance.vision` →
  `stream.binance.us:9443`. Si el primero no abre, pasa al segundo. **Tiempo real
  de verdad** (velas que actualizan por tick del stream), **no** sondeo cada 30
  segundos. El usuario fue explícito en que no se admite nada que pinte velas
  cada 30 s, y no lo hay: es WS.
- **El shim no estorba:** `feed-shim.js` solo reescribe `*.binance.com`. No toca
  `api.binance.us` ni `data-api.binance.vision`, así que el failover manda sus
  URLs sin que el shim las altere.

### 1.3 Dos bugs de raíz encontrados y corregidos de paso
- **Condición de carrera en el índice de host (`_restI`).** Era una variable
  compartida leída dentro del bucle; una llamada concurrente (p. ej. `logos()`)
  la cambiaba a mitad de vuelo y el `klines` recalculaba el módulo y volvía al
  host bloqueado, sin llegar nunca a Binance.US. Se corrige capturando el índice
  **una sola vez** antes del bucle (`const inicio = _restI`).
- **`logos()` mal enrutado.** Pasaba una URL completa de CoinGecko por el mismo
  helper que anteponía los hosts de Binance, rompiendo el logo. Ahora `logos()`
  hace `fetch` directo a CoinGecko.

### 1.4 Verificado
Con el espejo `.vision` forzado a 451 en el mock, **la gráfica carga igual**
desde Binance.US en la primera pintada, sin tocar nada (mark 95,120.50, velas
en canvas). Sin regresión en la ruta normal (no EE. UU., espejo 200).

### 1.5 PENDIENTE (dicho claro)
- **Confirmación desde una IP real de EE. UU.** No se puede hacer desde aquí. La
  evidencia es fuerte (Binance.US es el endpoint pensado para EE. UU.), pero no
  se cierra al 100 % hasta esa prueba.
- **Portar el mismo failover al resto de la plataforma.** Hoy el arreglo robusto
  vive en `datos.js` de Spot. **Analysis** (`modules/analysis/`) y cualquier otra
  gráfica siguen dependiendo del shim solo, que apunta al espejo `.vision`
  bloqueado → **seguirán en negro en EE. UU.** hasta portarles el mismo patrón.
  Es la siguiente entrega lógica y se hará verificada, no a ciegas.

---

## 2. Firestore (Trading Demo)

**Trading Demo no usa Firestore.** Todo su estado (posiciones, órdenes,
historial) vive en `localStorage`, igual que Spot (`sp-spot-v1`). No hay import de
Firebase ni llamadas a Firestore. **No hay nada que migrar.** Si en el futuro se
quiere sincronizar historial entre dispositivos, habría que decidirlo como
feature nueva (y pensando en que lo real debe ir onchain, no a una base de datos
centralizada).

---

## 3. Disparos de órdenes limit, TP y SL SIN bots ni Cloudflare

### 3.1 Cómo dispara hoy la página (Trading Demo y Spot)
Es **100 % en el navegador**. No hay servidor, ni bot, ni worker de Cloudflare.
El motor expone `onPrecio(par, mark, hi, lo)` y se llama **en cada tick de
precio** que llega por WebSocket. Ahí:

- Revisa las **órdenes marcadas** (limit): una orden puesta "desde arriba"
  dispara cuando `low <= precio`; "desde abajo", cuando `high >= precio`.
- Revisa **TP/SL** de las posiciones abiertas, con la misma lógica.
- **Antigap:** no espera al cierre de la vela; dispara cuando el **rango**
  (high/low) **toca** el nivel. En short, el TP va por debajo (gana al bajar) y
  el SL por arriba, como cualquier venta en corto.

El "disparador" es el propio stream de precios moviendo `onPrecio`. Nada más.

### 3.2 El límite honesto de ese modelo
Los disparos solo ocurren **con la página abierta**. Si el usuario cierra la
pestaña, nada se ejecuta. Para un trader activo mirando la pantalla está bien;
para "dejar la orden puesta y olvidarse", no basta. Esto no es un bug: es la
frontera de lo que puede hacer una web sin backend.

### 3.3 Cómo la página le dice al contrato que ejecute
El motor está escrito **listo para smart contract**: la lógica de toque de
`onPrecio` es **exactamente** la que ejecutará el contrato. Hoy la página es (a)
la referencia de esa lógica y (b) la UI que marca los niveles en la gráfica.
Cuando exista el contrato, **él** es el ejecutor onchain con la misma regla.

### 3.4 Cómo disparar con la página cerrada, sin bots tuyos ni Cloudflare
Opciones reales, de menos a más "premium":

1. **Solo cliente (hoy).** Dispara con la página abierta. Cero infraestructura.
   Suficiente para operar mirando; insuficiente para set and forget.
2. **Keeper onchain.** El contrato guarda la orden y una red de automatización
   (Chainlink Automation, Gelato) o un `checkUpkeep` propio la ejecuta cuando el
   precio cruza. No es un bot *tuyo* en un servidor: corre descentralizado.
3. **Ejecución permisionless (recomendada).** El contrato guarda la orden y
   expone una función `ejecutar()` que **cualquiera** puede llamar cuando el
   precio cruza el nivel, a cambio de una **propina**. Es el diseño clásico de
   las limit orders de DEX (estilo 0x/UniswapX fillers, Gelato): el **mercado**
   ejecuta tus órdenes por el incentivo, sin que tú montes ni pagues infra. Es la
   respuesta trustless y la que encaja con "sin bots ni Cloudflare".

**Recomendación:** (3). Guardar la orden en el contrato + `ejecutar()`
permisionless con propina. La página sigue marcando niveles y mostrando todo; el
mercado hace el disparo cuando no estás.

---

## 4. Fee: 0.2 % SOLO sobre la ganancia

### 4.1 El modelo (aplicado y verificado)
- **Abrir:** gratis. **Perder o salir en tablas:** 0.
- **Cerrar en ganancia:** **0.2 % de la ganancia**, cobrado en **BNB** por el
  contrato al cerrar.
- Denominación: en long la ganancia es en USDT; en short es en la moneda (más
  monedas al recomprar más barato). El contrato convierte a BNB al cierre.
- Verificado en navegador: `comisionPct()` = 0.2, `feeGanancia(100)` = 0.2,
  `feeGanancia(-50)` = 0, `feeGanancia(0)` = 0. El paso "What it costs: only if
  you win" del How It Works lo explica, y el resumen de la orden también.

### 4.2 ¿Es competitivo? (análisis)
Comparado con lo normal del mercado, es **agresivamente barato**:

- Binance **spot**: ~0.1 % por lado = **0.2 % del nocional** ida y vuelta,
  **ganes o pierdas**.
- Perp DEX (GMX, dYdX): fee sobre nocional + funding.
- Aquí: **0.2 % de la ganancia**, y solo si ganas.

Ejemplo: operación de 10.000 USDT que gana 5 % (500 USDT).
- Nuestro fee: 0.2 % × 500 = **1 USDT** (= 0.01 % del nocional).
- Binance spot: ~0.2 % × 10.000 = **~20 USDT**.
- **~20 veces más barato** en ese ganador del 5 %. Y si la operación pierde, aquí
  pagas **0**; en Binance pagas igual.

Solo se acerca al fee por nocional en ganancias enormes (multiplicar el capital).
Para los movimientos típicos, es mucho más barato y además **alinea incentivos**:
la plataforma solo cobra cuando el usuario gana.

### 4.3 Lectura para el dueño (margen de maniobra)
0.2 % sobre ganancia es tan bajo que probablemente **deja dinero sobre la mesa**.
Se podría subir a **1 %–2 % de la ganancia** y **seguir siendo más barato** que el
fee por nocional en la mayoría de operaciones, manteniendo el gancho de marketing
("solo pagas si ganas"). La palanca queda del lado del usuario; el código expone
un único `PROFIT_FEE` para cambiarlo en un sitio.

---

## 5. Lo que falta a nivel de INTERFAZ para que Spot sea premium

Checklist riguroso. ✓ = ya está. ✗ = falta. ~ = parcial.

**Tipos de orden**
- ✓ Market, ✓ Limit (clic en la gráfica), ✓ TP/SL (arrastrar o lápiz).
- ✗ Trailing stop. ✗ OCO explícito. ✗ Cierre parcial / scale out. ✗ Reduce only.

**Profundidad y liquidez (lo que más se nota como "falta")**
- ✗ Order book. ✗ Cinta de trades recientes. ✗ Spread visible.
  Una UI premium de trading enseña al menos un libro ligero y la cinta; hoy Spot
  es solo gráfica. Esto es lo que más resta sensación de "exchange de verdad".

**Gestión de posición**
- ✓ PnL en vivo, ✓ porcentaje congruente con el mercado (long y short).
- ~ Línea de break even en la gráfica (hay marca de entrada; falta la de BE).
- ✗ PnL agregado de la cuenta, exposición total.

**Gráfica**
- ✓ Velas tiempo real, ✓ marca de entrada, ✓ notación de subíndice para precios
  con muchos ceros, ✓ logo del token, ✓ reconocimiento por contrato.
- ✗ Volumen. ✗ Indicadores (MA/RSI). ✗ Herramientas de dibujo. ~ Líneas de
  orden/posición dibujadas y arrastrables sobre la gráfica.

**Riesgo (ticket de orden)**
- ✗ Calculadora de tamaño por % del balance. ✗ Riesgo:Recompensa (R:R) en el
  ticket. ✗ Aviso de riesgo por operación. Son baratos de añadir y suben mucho la
  percepción de herramienta seria.

**Ejecución / wallet (el hueco nº 1)**
- ✓ Balance real de la wallet.
- ✗ **Ejecución onchain real.** Hoy las operaciones se registran en localStorage;
  no se liquidan en cadena. Este es el salto de "simulador con precios reales" a
  "producto". Sin esto, lo demás es cosmética.

**Confianza / social**
- ✓ Track record descargable (ahora marca **Spot**, sin Demo). ✓ Tarjeta de PnL
  compartible. ✗ Leaderboard. ✗ Tarjeta de PnL en vivo de posición abierta
  (existe la de cierre).

**Onboarding**
- ✓ How It Works (11 pasos, incluye el fee). Bien cubierto.

**Por verificar**
- ~ Responsive en móvil (no auditado este turno).

### 5.1 Prioridad recomendada
1. **Ejecución onchain + disparo permisionless** (sección 3.4). Es el producto.
2. **Order book + cinta de trades.** Credibilidad inmediata de exchange.
3. **Herramientas de riesgo en el ticket** (tamaño por %, R:R).
4. **Trailing stop y cierre parcial.**
5. Volumen e indicadores en la gráfica.

---

## 6. Verificado en navegador este turno
- Geobloqueo: con `.vision`→451, la gráfica de Spot carga desde Binance.US.
- Track record: botón dorado en History; genera el certificado; marca de agua
  **SPOT** (no Demo), subtítulo "DECFREEDOM SPOT · TRACK RECORD", pie "DecFreedom
  Spot". **No dice Demo en ningún sitio.** Píxeles con contenido, no pantalla
  negra.
- Guardia de denominación del certificado: un short que gana en su moneda cuenta
  para nº de trades y win rate, pero **no** contamina el Net PnL en dólares (que
  agrega solo lo liquidado en USDT). Probado con long +500 USDT, short +0.5 ETH,
  long −200 USDT → Trades 3, Win rate 67 %, Net PnL +$300.
- Fee: funciones del motor y textos (How It Works + resumen de orden).

## 7. Pendiente / no verificable desde aquí
- Confirmación del geobloqueo desde IP real de EE. UU.
- Portar el failover multi host a Analysis y al resto de superficies de datos.
- Contrato en mainnet: ejecución real, conversión del fee a BNB y disparo
  permisionless de limit/TP/SL.
- Responsive móvil de Spot.
