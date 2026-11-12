# decfreedom.com

**Plataforma de bots de trading no custodial en BNB Smart Chain.**
El dinero del usuario **nunca sale de su wallet**. Los contratos solo tienen
permiso para mover una cantidad concreta, y ese permiso se puede quitar.

- **Web en producción:** https://cybersecureaid.github.io/bot-algoritmico/
- **Repositorio web:** `CyberSecureAID/bot-algoritmico`
- **Repositorio del keeper:** `CyberSecureAID/bolita-keeper`
- **Worker en Cloudflare:** `bolita-keeper-bot`
- **Red:** BNB Smart Chain (chainId 56)

> **Nota sobre el nombre.** El repositorio se llama `bot-algoritmico` y el del
> keeper `bolita-keeper` por razones históricas: el proyecto empezó como una
> lotería ("La Bolita") y evolucionó a CryptoCuba Oficial. **El proyecto es CryptoCuba Oficial.**
> Todo lo de la lotería está desechado (ver *Historia*).

---

## 1. QUÉ ES Y QUÉ HACE

Cuatro bots de trading que operan sobre PancakeSwap V3, más un marketplace
persona a persona, un swap y un sorteo comunitario.

| Bot | Qué hace | Cuándo gana |
|---|---|---|
| **Smart Grid** | Reparte el dinero en cuadrículas dentro de un rango. Compra al bajar a una, vende al subir a la siguiente. | Cuando el precio sube y baja dentro del rango. |
| **Accumulator** | Compra más cuanto más baja el precio, bajando el precio medio. Vende TODO de golpe al alcanzar el objetivo. | Cuando el precio se recupera un % desde el promedio. |
| **Cash Out** | Una sola orden de venta a un precio objetivo (Take Profit). | Cuando el precio toca el objetivo. |
| **DCA** | Compra una cantidad fija cada cierto tiempo. Solo compra, no vende. | A largo plazo, suavizando el precio de entrada. |

**Modelo de negocio:** suscripción mensual en BNB + comisión del swap +
comisión por publicar en el marketplace.

---

## 2. CONTRATOS DESPLEGADOS

### 2.1 GridBot — el contrato principal de los bots
```
PROXY (usar siempre esta):  0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B
Tipo:                       actualizable (proxy)
```
**Funciones confirmadas (de su ABI en `assets/js/gridbot.js`):**

*Crear y manejar bots*
- `crearRejilla(config)` — crea un bot con su configuración completa
- `misRejillas(address)` — devuelve las claves de los bots de un usuario
- `resumen(bytes32)` / `resumen(address,address,address)` — estado completo
- `nivelesDe(bytes32)` — las cuadrículas y su estado (1=espera comprar, 2=espera vender)
- `modoDe(bytes32)` — tipo de bot (0=Grid, 1=Acumulador, 2=Cash Out, 3=DCA) y objetivo
- `pathsDe(bytes32)` — rutas de compra y venta
- `clave(address,address,address)` / `claveBot(...,uint256)` — identificadores
- `cancelarRejilla(bytes32)` — cancela y devuelve todo al usuario
- `cerrarAhora(bytes32)` — cierra la posición
- `activarRejilla(address,address,bool)` — pausa/reanuda

*Ejecución (las llama el keeper)*
- `ejecutar(bytes32,uint256)` — dispara una cuadrícula concreta
- `cerrarPorTPSL(address,address,address)` — cierra por Take Profit o Stop Loss
- `venderAcumulado(bytes32)` — venta total del Acumulador
- `comprarDCA(bytes32)` — compra programada del DCA

*Ajustes del usuario*
- `setTPSL(address,address,uint128,uint128)` — objetivo y stop loss
- `ajustarSlippage(address,address,uint16)`
- `ajustarCooldown(address,address,uint32)`

*Gas y suscripción*
- `depositarGas()` payable — el usuario deposita BNB para que sus bots operen
- `retirarGas(uint256)`
- `gasSaldo(address)` — **saldo ÚNICO por usuario, compartido por todos sus bots**
- `gasMinOp()` — coste mínimo de una operación
- `suscribir()` payable, `activo(address)`, `precioSuscripcion()`

*Swap integrado*
- `swap(tokenIn,tokenOut,amountIn,minOut,fee)`, `tarifaSwap()`

**⚠️ NO TENEMOS EL CÓDIGO FUENTE DE ESTE CONTRATO.** Solo su ABI. Para añadirle
funciones (renovación automática de suscripción, wallets de respaldo, contador
global de usuarios) hace falta el `.sol` original. Está desplegado como proxy,
así que **sí se puede actualizar** cuando se recupere el código.

### 2.2 AurexMarket — marketplace persona a persona
```
PROXY:   0x1131c4760Da083aaFCf20d6848Af93A8a2edFb18
LÓGICA:  0x16F75Aa7451c1363aEF1C1D1dcC5b38829346A81  (V2)
Fuente:  SÍ la tenemos (AurexMarketV2.sol)
Tipo:    UUPS actualizable · Ownable · Pausable
```
**Funciones:**
- *Vender:* `crearOrden(token,monto,tramos,moneda,metodo,precioFiat)`, `depositarFianza`, `liberarTramo`, `abandonarVenta`, `retirarTodo`
- *Comprar:* `crearAnuncioCompra`, `marcarPagado`, `liberarReserva`, `pedirCancelar`, `cancelarOrden`, `cancelarPorTiempo`
- *Disputas:* `abrirDisputa(id,motivo)`, `resolverDisputa(id,bool)`, `anularDisputa(id)`, `caducarDisputa(id)` (48 h)
- *Perfil:* `guardarPerfil`, `guardarHorario`, `compartirUbicacion`, `ocultarUbicacion`, `calificar`
- *Lectura:* `ordenes(id)`, `misOrdenes`, `misCompras`, `fianzaDe`, `limiteDe`, `totalOrdenes`, `pendientesDeCalificar`
- *Owner:* `setToken`, `setArbitro`, `setFianzaMinima`, `setLimites`, `setPlazos`, `setComision`, `setOraculo`, `setContratoBase`, `pause`, `unpause`

**Nota de compilación:** se compiló con `optimizer runs=1` — es el único valor
con el que cabe en el límite de 24 KB.

### 2.3 AurexPrizePool — sorteo comunitario
```
PROXY:   0x595CD563F236DAEba21219D60AEF656a750A8132
LÓGICA:  0xe5b44a43eEe2a70d76002E7Af43380BaaFb244Bb  (V5)
Fuente:  SÍ la tenemos (AurexPrizePoolV5.sol)
Tipo:    UUPS actualizable · Ownable · Pausable
Aleatoriedad: API3 QRNG (verificable en cadena)
sponsorWallet: 0x53c4b467ee19CD6bfc343eE9E5113d95F125862f
```
**Funciones:**
- *Usuario:* `participar(nombre,telegram,invitador)`, `reclamar(round)`, `abandonarParticipacion()`, `miAporte(address)`, `miReclamo`
- *Lectura:* `currentRound`, `rounds(id)`, `estadoActual`, `entryTotal`, `ultimosGanadores`, `distribucionEstimada`, `saldoGas`, `gasFaltante`, `necesitaGas`, `sorteoAtascado`
- *Antibloqueo:* `destrabarSorteo(round)` payable — **cualquiera** puede destrabar si el árbitro no responde en 48 h
- *Owner:* `setConfig`, `setQrngParams`, `setFeeWallet`, `setDrawTimeout`, `setBloqueoSalida`, `setGasMinimoSorteo`, `setGasFunding`, `setLinkedContract`, `sweepBnb`, `forzarReembolso`, `rescueToken`, `flagName`, `cerrarRonda`, `pause`, `unpause`

**Protección antifraude:** `bloqueoSalida` impide retirarse en las 24 h previas
al cierre (para que nadie infle el pozo y se marche antes del sorteo).

### 2.4 AurexSwap
```
DIRECCIÓN: 0xa15794D9c313F3E2726ED1D45A1B6CC72BFA2a0c
Tipo:      NO es proxy (no actualizable)
```
Intercambio sobre PancakeSwap V3 con comisión propia en BNB.
Solo BNB Smart Chain. (Ver *Pendientes* para el multicadena.)

### 2.5 Lotería (DESECHADA)
```
PROXY:  0x964a68D3A2dB18c723581410C49aa8789048E1B9
LÓGICA: 0x731AD90586d50AaB31Cc19BF62E7d986FED05D25
Estado: VACÍO. Fondos retirados. No se usa.
Fuente: sí (contracts/Bolita.sol, aunque es de una versión anterior)
```
Sigue en el repo (`loteria.html`) pero **sin acceso desde la web**.
Su código tiene ideas aprovechables: `ownerSecundario`, `retirarBanca(token,cantidad,destino)`,
`retirarBeneficios`, `rescateEmergencia`, `redirigirYtomarControl`.

---

## 3. DIRECCIONES IMPORTANTES

```
Owner / comisiones:  0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d
Wallet del keeper:   0x34D57FBdCD5D7254fdC111357f0f2b28562F4419
sponsorWallet:       0x53c4b467ee19CD6bfc343eE9E5113d95F125862f
Multicall3:          0xcA11bde05977b3631167028862bE2a173976CA11
PancakeSwap Quoter:  0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997
PancakeSwap V2:      0x10ED43C718714eb63d5aA57B78B54704E256024E
Chainlink BNB/USD:   0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE
```

**Monedas** (definidas en `assets/js/tokens.js`):
```
BNB       nativa                                        18 dec
USDT      0x55d398326f99059fF775485246999027B3197955   18 dec
USDC      0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d   18 dec
BTCB      0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c   18 dec
ETH       0x2170Ed0880ac9A755fd29B2688956BD959F933F8   18 dec
USDT.z    0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4   18 dec
BabyDoge  0xc748673057861a797275CD8A068AbB95A902e8de    9 dec
EXT       0xd86b5cd7cFC28a1e4Fd6b39F133bF64EF24c5246   18 dec
SOL/DOGE/XRP/CAKE/LINK/ADA — solo bots (soloBot: true)
```

---

## 4. EL KEEPER (lo que hace que los bots operen solos)

**Repo:** `CyberSecureAID/bolita-keeper` · **Worker:** `bolita-keeper-bot`
**URL:** https://bolita-keeper-bot.yamicelanvivesqui.workers.dev
**Archivo:** `src/worker.js`

**Rutas:**
- `/estado` — informe público, sin contraseña. **Es la herramienta de diagnóstico principal.**
- `/registrar?u=0xWallet` — la web lo llama al crear cada bot
- `/parte?n=N&de=M&key=TOKEN` — reparto interno del trabajo

**Variables en Cloudflare:**
```
KEEPER_PRIVATE_KEY   (secreto)  admite VARIAS claves separadas por comas
ADMIN_TOKEN          (secreto)
KEEPER_URL           https://bolita-keeper-bot.yamicelanvivesqui.workers.dev
KV: KEEPER_KV → bolita-keeper-kv (id 0759bdf9e97e47158364ce2ef08f6f6a)
```
**⚠️ El binding de KV debe estar declarado en `wrangler.toml`**, o se borra en
cada despliegue. Ese fue un fallo real que costó días.

**Cómo funciona:**
1. La corrida principal **no trabaja: reparte.** Llama a hasta 30 copias de sí misma en paralelo.
2. Cada copia atiende 400 bots con su presupuesto propio de peticiones.
3. Usa **Multicall3** para leer 150 datos en UNA petición.
4. Antes de enviar cualquier transacción, hace un **ensayo en seco**: si el contrato la va a rechazar, no la envía y anota el motivo.

**Capacidad:** 30 partes × 400 bots = **12.000 bots revisados cada minuto**
(~1.500 usuarios con 8 bots). Para más: subir `MAX_PARTES` y pagar el plan de
Cloudflare (5 $/mes, 50× más capacidad).

**Límite de Cloudflare:** 50 peticiones por corrida. El tope interno está en 38.

---

## 5. ESTRUCTURA DEL REPOSITORIO

```
/
├── index.html                 App principal (CryptoCuba Oficial)
├── sw.js                      Service worker (app instalable + caché)
├── manifest-aurex.webmanifest App instalable
├── favicon.svg                Logo de CryptoCuba Oficial (transparente)
├── diag.html                  Diagnóstico de conexión de wallet
├── loteria.html               Lotería antigua (sin acceso desde la web)
├── README.md                  Este archivo
└── assets/
    ├── css/styles.css
    ├── img/  aurex-32/192/512/apple/maskable.png, aurex-logo.png, marco-precio.webp
    └── js/
        ├── gridbot-ui.js   (3841) Interfaz principal: los 4 bots, tarjetas, swap
        ├── market.js       (1969) Marketplace P2P completo
        ├── gridbot.js      ( 717) Capa de contrato: ABI, lecturas, firmas
        ├── admin.js        ( 687) Panel de control oculto (5 clics)
        ├── extras.js       ( 594) App instalable, compartir, historial Excel
        ├── prizepool.js    ( 562) Sorteo comunitario
        ├── wallet.js       ( 540) Detección de wallets, EIP-6963, WalletConnect
        ├── perfil.js       ( 473) Perfil, estadísticas, permisos revocables
        ├── tokens.js       ( 322) Catálogo de monedas
        ├── grafica.js      ( 238) Velas de Binance + líneas de cuadrículas
        ├── tutorial.js     ( 219) Tutorial de iniciación
        ├── avisos.js       ( 160) Notificaciones
        └── vendor/
            ├── ethers-6.13.4.min.js      (490 KB, alojado localmente)
            ├── lightweight-charts.mjs    (160 KB, TradingView)
            ├── walletconnect.umd.js      (850 KB, se carga SOLO al conectar)
            └── qrcode.js                 ( 55 KB)
```
**Archivos de la lotería — ELIMINADOS (limpieza de repo, ver sección 25).**
Se borraron del repo por estar desechados y sin uso: `app.js`, `contrato.js`,
`comprar.js`, `draws.js`, `economics.js`, `charada.js`, `versos.js`, `cup.js`,
`florida.js`, `prices.js`, `icons.js`, `confetti.js`, `notificaciones.js`,
`manifest.webmanifest`, `loteria.html`, `diag.html`, `contracts/Bolita.sol`, y
19 imágenes sin uso. También los huérfanos `delta.js`, `footprint.js`,
`termometro.js`, `worker.js`, `ethers-carga.js`. La app cripto quedó intacta.

---

## 6. REGLAS DE TRABAJO (importantes)

1. **Idioma:** español. Respuestas cortas y directas.
2. **Entregar SOLO los archivos modificados** a `/mnt/user-data/outputs/`.
3. **Verificar SIEMPRE** con `node --input-type=module --check`.
4. **Versionado:** todos los archivos llevan `?v=N`. Si se sube la versión,
   **hay que entregar TODOS los JS + index.html + sw.js a la vez**, o los
   módulos se descuadran (síntoma clásico: la wallet se carga dos veces).
5. **Versión actual: `?v=107`** en los imports · caché del service worker: `aurex-v109`
   (pueden ir desacompasadas: los imports solo cambian cuando hace falta romper la caché)
6. **Funciones nuevas → módulo nuevo.** No engordar `gridbot-ui.js`.
7. **Comentarios en el código: en español, explicando el PORQUÉ**, no el qué.
8. **Antes de entregar:** probar con Playwright que la página sigue funcionando.
9. **⛔ NO TOCAR el MAPA DE CALOR de Liquidity Pools (`liquidity.js`).** La
   distribución de colores del mapa (los escalones azul→verde→amarillo→rojo, el
   suavizado de los tonos intermedios y la ubicación de los rojos como muros de
   liquidación) quedó **aprobada y perfecta**. No se modifica la lógica de
   `calor()`, `ESCALONES`, el suavizado (`suave`) ni el cálculo de intensidad.
   Sí se pueden tocar elementos **encima** del mapa (tachuelas, perfil, escala),
   pero **el mapa de calor en sí es intocable**.

---

## 7. HISTORIAL DE PROBLEMAS RESUELTOS (para no repetirlos)

### El keeper no ejecutaba nada
- **Había dos workers** usando el mismo KV y se pisaban → se eliminó el viejo.
- **El KV se borraba en cada despliegue** → faltaba declararlo en `wrangler.toml`.
- **`eth_getLogs` no funciona en los RPC públicos de BSC** → se cambió a preguntar
  al contrato por cada usuario vigilado.
- **`cargarEstado()` descartaba la lista de usuarios** → se perdía cada minuto.
- **Gastaba las 50 peticiones solo buscando bots** (33 bots creados, 3 activos, y
  recomprobaba los inactivos cada vez) → ahora se descartan y no se vuelven a mirar.
- **Sin Multicall no escalaba** → 6 peticiones por bot → ahora 150 datos por petición.

### 17 ejecuciones revertidas seguidas
Las transacciones fallaban con `execution reverted` sin mensaje. Se añadió el
**ensayo en seco** (`staticCall`) antes de enviar: ahora el motivo aparece en
`/estado` y no se gasta gas en intentos fallidos. **Pendiente de confirmar en
producción cuando el precio cruce una cuadrícula.**

### Las cuadrículas no se veían en la gráfica
La escala se ajustaba **solo a las velas**, así que las líneas fuera de ese rango
quedaban invisibles y sus etiquetas pegadas al borde. Se añadió
`autoscaleInfoProvider` que incluye todas las líneas, con tope de 2,2× el
recorrido de las velas para que no se aplasten.

### La página parpadeaba al cargar
Se dibujaba **dos veces**: una al conectar la wallet y otra al terminar el
arranque. Se añadió una bandera `_arrancando`.

### La gráfica se cerraba sola
Un refresco automático llamaba a `refrescarRejillas()`, que redibujaba toda la
lista. Ahora el refresco solo actualiza el número del gas.

### "El gas no se actualiza" (dos veces)
No era un placeholder: era **redondeo a 4 decimales**. `0.00396` se mostraba como
`0.0040`. Se pasó a 5 decimales en el perfil y en las tarjetas de los bots.

### Configuración "Activo" que perdía dinero
40 cuadrículas en ±12% dejaba una separación del 0,60%, y con 50 USDT las
comisiones se comían la ganancia. **El contrato se negaba a vender con pérdida**
(comportamiento correcto), y parecía que estaba roto. Se recalcularon las cuatro
configuraciones para que rindan incluso con 50 USDT.

### La caché no dejaba ver los cambios
Al dejar de subir el `?v=N`, el service worker servía los archivos viejos. **Regla:
si cambia algo importante, subir la versión y entregar todos los archivos.**

---

## 8. ECONOMÍA DE LOS BOTS (números reales medidos)

```
Gas por operación:      ~0.0000205 BNB  (~$0.012)
Gas por vuelta:         ~$0.025        (comprar + vender)
Comisión PancakeSwap:   0,05% por swap (0,1% ida y vuelta)
```
**Separación mínima para ganar:** con órdenes de $25, basta un 0,20%.

**Configuraciones auditadas** (en `gridbot-ui.js`, constante `PRESETS`):
| Configuración | Rango | Cuadrículas | Separación | Deja con $200 |
|---|---|---|---|---|
| Tranquilo | ±40% | 24 | 3,59% | +0,27 USDT/vuelta |
| Equilibrado | ±28% | 20 | 2,92% | +0,26 USDT/vuelta |
| Activo | ±16% | 14 | 2,33% | +0,29 USDT/vuelta |
| Volátil | ±60% | 30 | 4,73% | +0,28 USDT/vuelta |

**Cupo:** 8 bots por usuario, 2 de cada tipo (`CUPO_TOTAL` / `CUPO_POR_TIPO`).

---

## 9. FUNCIONES DE LA WEB

- **4 bots** con configuraciones rentables explicadas y honestas ("qué puede salir mal")
- **Gráficas** con velas reales de Binance y las cuadrículas dibujadas encima
- **Marketplace P2P** con fianza, tramos, disputas con motivo escrito y árbitros
- **Prize Pool** con aleatoriedad verificable (API3 QRNG)
- **Swap** con comisión propia
- **Perfil**: estadísticas, coste por operación y **permisos revocables**
- **Historial en Excel** por bot (con formato, colores, explicación de la estrategia)
- **App instalable** (PWA) con service worker, funciona con mala conexión
- **Compartir**: imagen del resultado (móvil) y enlace promocional
- **Panel de control oculto** (5 clics en la esquina inferior izquierda)
- **WalletConnect** + apertura directa en MetaMask/Trust/SafePal desde el móvil

---

## 10. EL PANEL DE CONTROL (`admin.js`)

**Se abre con 5 clics en la esquina inferior izquierda.** Si quien los da no es
dueño de los contratos, **no pasa nada**: ni se abre, ni avisa, ni deja rastro.
La comprobación se hace **leyendo los contratos**, no la web.

**Filosofía: no puede romper nada.**
1. No hay ejecución libre de funciones
2. **Lo irreversible NO ESTÁ** (traspasar/renunciar propiedad, actualizar contratos)
3. Cada ajuste enseña su valor actual
4. Cada campo tiene mínimo y máximo
5. **Ensayo en seco** antes de firmar (`staticCall`)
6. **Deshacer** con el valor anterior guardado
7. Todo explicado en lenguaje llano

**Pestañas:** Resumen (usuarios, bots, pozo, estado del keeper) · Disputas ·
Sorteo (recargar gas, destrabar, cerrar ronda, reembolsar) · Ajustes (fianza,
plazos, árbitros) · Emergencia (congelar/reanudar).

---

## 11. SEGURIDAD

**Corregido:**
- **XSS por token malicioso** — el nombre y símbolo de una moneda importada los
  pone quien creó ese token. Se limpian (solo letras/números, máx. 12 y 40) y se escapan.
- **Clickjacking** — si Aurex se carga dentro de un iframe, se sale del marco.
- **Permisos revocables** — la web decía "puedes revocarlo cuando quieras" pero
  no había dónde. Ahora está en el perfil.

**Ya estaba bien:** permisos con monto exacto (nunca infinito), direcciones fijas
en el código, `rel="noopener"` en enlaces externos, datos ajenos escapados.

**El riesgo real NO está en el código.** Según los datos de 2026, las cuentas
comprometidas son >50% de los ataques DeFi. Los dos puntos débiles son:
1. **La wallet del owner** (controla contratos actualizables) → **usar wallet física**
2. **La cuenta de GitHub** (puede servir un JS malicioso) → **2FA con app, no SMS**

---

## 12. PENDIENTES

### Bloqueado por falta de código fuente
- **Renovación automática de la suscripción** — necesita el `.sol` del GridBot.
  Si está verificado en BscScan, copiar el código al repo y desbloquea esto.
- **Contador global de usuarios** en el contrato de bots (ahora se saca del keeper).
- **Wallets de respaldo (owner 1→2→3)** en los tres contratos principales. La
  lotería ya lo tenía implementado (`ownerSecundario`); hay que llevarlo a los demás.

### Decidido pero sin hacer
- **Swap multicadena.** PancakeSwap está en BNB Chain, Ethereum, Base, Arbitrum,
  Linea, zkSync, opBNB, Solana y Aptos. **Tron NO** (haría falta otro exchange).
  Solana necesita otra wallet (Phantom) y es un desarrollo aparte.
  *Decisión pendiente:* la comisión no se puede cobrar en BNB fuera de BSC →
  o se renuncia a ella en otras redes, o se despliega un contrato por red.
- **Números animados** (`data-contar` ya está en `extras.js`, falta aplicarlo).
- **Historial del Marketplace** con fechas de ejecución y limpieza automática.
- **Marcas de compra/venta sobre las velas** (los datos de `operacionesDe` ya existen).
- **Lotería propia** con premio proporcional al bote (sistema pari-mutuel: la casa
  nunca pierde y siempre hay ganador, sin engañar a nadie). Interfaz ya hecha;
  faltaría contrato nuevo y cambiar el verde por el negro/dorado de Aurex.

### Lo más importante ahora mismo
**Confirmar que el keeper ejecuta sin revertir.** Es lo único que separa la
plataforma de estar lista. Cuando el precio cruce una cuadrícula, mirar `/estado`:
- `✅ VENTA nivel 3 · tx 0x…` → funciona
- `✋ NO se puede — [motivo]` → ahí está el fallo, con su explicación

---

## 13. HERRAMIENTAS DE DIAGNÓSTICO

| Herramienta | Para qué |
|---|---|
| `/estado` del keeper | Ver si trabaja, cuántos bots vigila y por qué no ejecuta |
| `diag.html` | Problemas de conexión de wallet (muestra el error exacto) |
| Panel de control | Estado general y acciones de administración |
| Consola del navegador | Los errores se registran con prefijo `[Aurex]` |

**Lectura del `/estado`:**
```
Revisados en esta corrida: 3 (peticiones: 3 de 50)   ← salud del keeper
WBNB/USDT: 6 niveles · 3 esperan comprar (falta 1.20% de bajada)
           · 3 esperan vender (falta 0.85% de subida)
WBNB/USDT: ACUMULADOR — falta 12.05% para vender todo
```

---
---

# PARTE II — CRIPTOCUBA OFICIAL

> Todo lo que sigue se añadió después de la primera versión de este
> documento. **No sustituye nada de lo anterior**: las secciones 1 a 13
> siguen vigentes tal cual. Esta parte cubre el proyecto tal como está
> hoy, con el dominio propio, las herramientas de análisis y el modelo
> de suscripción.

---

## 14. QUÉ ES EL PROYECTO AHORA

Lo que empezó como una plataforma de bots es hoy **dos negocios que
comparten el mismo contrato**:

**Bots de trading** — cuadrículas, acumulador, DCA y Cash Out. Ya
descritos en las secciones 1 a 13.

**Herramientas de análisis (Pro)** — una suite de análisis técnico por
suscripción, dentro de la sección Liquidity. Es la parte en desarrollo
activo y la que se enseña a inversores.

- **Dominio en producción:** https://criptocubaoficial.com
- **Red:** BNB Smart Chain (sin cambios)
- **Idioma:** inglés por defecto; español y portugués a elección del
  usuario desde su perfil

### El público objetivo

Personas que quieren operar en los mercados y **no saben leer una
gráfica**, o que sí saben pero quieren que alguien les confirme lo que
están viendo. No son analistas profesionales: son gente que necesita
que le digan **qué hacer, dónde y por qué**.

De ahí sale la regla que gobierna todas las decisiones de diseño:

> **Si no se explica solo, no sirve.** Si hay que enseñar a alguien a
> leerlo, no vale. Si se encuentra gratis en TradingView, no es premium.

---

## 15. LA SECCIÓN LIQUIDITY — TRES HERRAMIENTAS

Se entra desde el botón **Liquidity** de la portada. Dentro hay una
portada propia con tres tarjetas. **Al cerrar cualquiera de las tres se
vuelve a esa portada**, no a la página principal.

### 15.1 Liquidity Pools (`liquidity.js`)

Mapa de calor de liquidaciones. Muestra dónde se acumulan las
posiciones apalancadas que serían liquidadas si el precio llegara ahí.
Esas zonas actúan como imanes: el precio tiende a buscarlas.

Es el mismo dato por el que **CoinGlass cobra suscripción**.

> **⛔ MAPA DE CALOR CONGELADO.** La distribución del mapa (colores por
> escalones, suavizado de tonos intermedios y ubicación de los rojos) quedó
> aprobada y **no se toca**. Ver regla 9 de la sección 6. Lo que va *encima*
> del mapa (tachuelas de alta liquidez, perfil de volumen, escala) sí se
> puede ajustar.

### 15.2 Radar Institucional (`muros.js`)

Antes se llamaba "Muros Reales". Lee el libro de órdenes en tiempo real
y detecta las órdenes grandes que aguantan el precio, distinguiendo las
reales de las que se retiran cuando el precio se acerca.

Veredictos: *Orden blindada / firme / falsa*.

### 15.3 Smart Levels (`niveles.js`)

**La herramienta principal y la más trabajada.** Analiza la estructura
del mercado sobre velas reales de Binance y da un plan de operación
completo.

> **📦 MODULARIZADO (ver sección 26).** `niveles.js` pasó de **6.221 líneas
> a 800** repartiendo su código en **15 módulos** dentro de
> `assets/js/niveles/`. `niveles.js` sigue siendo el punto de entrada (lo
> importa `liquidity.js` como `./niveles.js?v=126`, sin cambios) y ahora solo
> contiene el arranque, el selector de monedas y las animaciones; el render y
> todo lo demás vive en su módulo. **Toda ampliación futura debe respetar esta
> modularización (ver sección 27).**

**El motor de análisis:**

| Función | Qué detecta |
|---|---|
| `pivotes()` | Giros del precio. Con respaldo por tramos para tendencias fuertes |
| `tendencia()` | Dirección por estructura de máximos y mínimos |
| `detectarRango()` | Lateralidad |
| `calcularNiveles()` | Soportes y resistencias con sus toques y volumen |
| `detectarImpulso()` | El último tramo con dirección y su zona de origen |
| `detectarEstructuras()` | BOS, CHoCH, order blocks, barridos de stops |
| `detectarDobles()` | Doble suelo y doble techo con línea de cuello |
| `calcularATR()` | Volatilidad real, para colocar el stop |
| `calcularTendencia()` | Línea de tendencia por mínimos cuadrados |

**El plan de operación** (lo que pide un profesional):

```
Entry     66,476
Stop      66,986   −0.77%
Target 1  65,967   1R  · asegura
Target 2  65,458   2R  · el principal
Target 3  64,949   3R  · si acompaña
Riesgo/beneficio 1:2 · Volatilidad media 424.3
```

El stop nunca se coloca a menos de **1,2 veces el ATR**: si está dentro
del ruido normal del mercado, lo barren sin que la idea falle.

**El asistente:** tres tarjetas numeradas en la banda superior, con el
avatar de Jesús. Ninguna se abre sola; la flecha late para avisar de
que hay algo que leer. Cada una tiene "Por qué lo digo" y "Señálame
dónde está" (que traza una curva hasta el nivel).

**Regla de unificación:** las lecturas se ponderan y sale **un solo
plan**. La tendencia manda: lo que va a favor cuenta entero, lo que va
en contra la mitad. Solo se declara empate si no hay tendencia
definida.

---

## 16. ÓRDENES DESDE EL GRÁFICO (`orden.js`)

**La funcionalidad que no tiene nadie más.** El usuario hace clic
derecho (o mantiene pulsado 500 ms en móvil) en cualquier punto del
gráfico y pone una orden a ese precio exacto.

- Por **encima** del precio actual → vender (ficha roja)
- Por **debajo** → comprar (ficha verde)
- El porcentaje de descuento o ganancia sale grande y en verde

**Dos modos, a elección del usuario:**

**Orden automática** — se crea en el contrato con `crearRejilla` de un
solo nivel. El keeper la vigila y la ejecuta sola. Consume gas.

**Solo avisarme** — se guarda en el navegador, vigila el precio cada 30
segundos y avisa con notificación del sistema. No cuesta gas.

**No hizo falta desplegar ningún contrato nuevo.** Una rejilla de un
solo nivel **es** una orden limit: espera un precio, ejecuta, y el
keeper la vigila. Se reutiliza lo que ya está probado en producción.

**Los cuatro pasos obligatorios** (esto costó varias sesiones
descubrirlo):

1. Comprobar suscripción activa
2. Comprobar gas
3. Envolver BNB a WBNB si se vende BNB
4. **Aprobar el token** — sin esto la transacción revierte siempre
5. Crear la orden

Funciona en **las tres secciones**. Las órdenes se dibujan con franja
rayada y su botón de cancelar. Cancelar una orden real pide firma
(toca el contrato); cancelar una alerta no (es local).

---

## 17. CONTRATO NUEVO: CriptoCubaPro.sol

**Estado: escrito, sin desplegar.**

Controla el acceso a las herramientas Pro. Mismo patrón que el resto:
proxy UUPS con OpenZeppelin 4.9.6.

| Aspecto | Detalle |
|---|---|
| Dueños | Tres (`duenios[0,1,2]`), con suspensión y relevo |
| Pago | BNB (oráculo Chainlink `0x0567F2...`) o USDT (`0x55d398...`) |
| Planes | 7 días $3 · 30 días $10 · 90 días $20 — modificables |
| Función clave | `tieneAcceso(wallet)` — lo que consulta la web |
| Regalos | `regalar()`, `regalarVarios()`, `revocar()` |
| Seguridad | `pausar()`, `retirar()`, hueco de 45 slots para futuro |

**Para desplegarlo:** compilar en Remix, desplegar como proxy UUPS, y
poner la dirección en la constante `PRO` de `liquidity.js`.

Archivo: `CriptoCubaPro.sol`

---

## 18. LA ECONOMÍA

### 18.1 El coste real por operación (aclarado)

Durante mucho tiempo el perfil mostraba "1,76 USD por operación" y eso
puso en duda la rentabilidad del sistema entero. **Era un error de
etiqueta, no del contrato.**

`gasMinOp()` **no es el coste de una operación**: es el **saldo mínimo**
que el contrato exige para dejar operar al bot — un colchón de
seguridad.

**El coste real, medido con datos propios:**

| | |
|---|---|
| Gas inicial | 0.004 BNB |
| Gas tras una operación | 0.00394 BNB |
| **Consumo real** | **0.00006 BNB ≈ 3,6 centavos** |

Lo mismo que un swap en PancakeSwap. Con 0.004 BNB caben unas **65
operaciones**, no una. La economía de los bots está intacta.

Corregido en `perfil.js`: ahora calcula el coste dividiendo el gas
gastado entre las operaciones hechas, y dice de dónde sale el dato
("según tu consumo real" o "estimado para BNB Chain").

### 18.2 Precio de la suscripción

Los planes actuales (3, 10 y 20 dólares) están **por debajo del
mercado**. La competencia cobra:

| Servicio | Precio |
|---|---|
| TradingView Premium | $199,95/mes (plan Ultimate) |
| ChartPrime | $49–149/mes |
| Indicadores premium sueltos | $20–100/mes |
| CoinGlass, Glassnode | plan de pago para lo que aquí ya está |

**Conversación pendiente:** subir el precio o mantenerlo bajo como
estrategia de entrada.

---

## 19. DÓNDE ESTAMOS Y QUÉ FALTA

### 19.1 Lo que funciona hoy

- Las tres herramientas de Liquidity, con datos reales de Binance
- Smart Levels con plan de operación completo y las tres tarjetas
- Órdenes desde el gráfico en las tres secciones, con cancelación
- 47 monedas agrupadas (criptomonedas, divisas, materias primas)
- Filtro "Solo las que puedo operar"
- Sistema de idiomas: inglés por defecto, español y portugués
- Bot de Telegram apuntando al dominio nuevo
- Imagen para compartir con cabecera, análisis y marca

### 19.2 Lo que queremos lograr

**El objetivo declarado:** que un trader profesional —de los que operan
para bancos— vea Smart Levels y diga *"esto promete"*.

Para eso hace falta **una lista de indicadores extraordinarios** en el
menú de herramientas, que se activan y desactivan de uno en uno. No
indicadores básicos: cosas que no se encuentren gratis.

**Requisitos que debe cumplir cualquier herramienta nueva:**

1. Que se explique sola, sin manual
2. Que use datos reales y verificables — **cero placeholder**
3. Que sea estéticamente atractiva (dorado y negro, la identidad)
4. Que no se encuentre gratis en TradingView
5. Que sirva para ganar dinero, no para "mostrar un dato"

**En desarrollo:** un detector de cambio de ciclo. Alertas `LONG`
(verde, texto negro, pico arriba) y `SHORT` (rojo intenso, texto
amarillo, pico abajo) en la vela exacta del giro. Con filtro de
lateralidad real, sin operar fines de semana, y un medidor de
probabilidad en la esquina que diga cuánto falta para la próxima señal.

### 19.3 Pendientes concretos

| Tarea | Estado |
|---|---|
| Desplegar `CriptoCubaPro.sol` y conectar la constante `PRO` | Bloqueante para cobrar |
| Detector de ciclos con Heikin Ashi + ADX | Diseñado, sin aplicar |
| Medidor de probabilidad de señal | Diseñado, sin aplicar |
| Imagen `serv-tres.webp` para Smart Levels | Marcador provisional |
| Limpiar archivos muertos del repo | Acordado |
| Revisar precio de suscripción | Conversación pendiente |
| Noticias por moneda en el asistente | Idea, sin empezar |

---

## 20. IDEAS DESCARTADAS (y por qué)

Para no volver a proponerlas:

| Idea | Motivo del descarte |
|---|---|
| Termómetro de mercado | No aportaba nada accionable |
| Footprint | Demasiado complejo de leer |
| Perfil de volumen | Gratis en cualquier sitio |
| VWAP anclado | *"Una banda de Bollinger abierta"* — no convence |
| Divergencia institucional (largos/cortos) | *"Una tripita abajo"* — no se entiende su utilidad |
| Gamma Exposure (GEX) | Un trader con 10 años nunca lo había oído |
| Confluencia entre herramientas | No interesó |
| Calculadora de posición | Ya existe en otros sitios |

**El patrón:** todo lo que sea "mostrar un dato más" se rechaza. Solo
pasa lo que dice **qué hacer**.

---

## 21. REGLAS DE TRABAJO (ampliación de la sección 6)

Estas se suman a las que ya están en la sección 6.

### 21.1 Sobre el código

- **Nunca reemplazos masivos** sobre archivos grandes. `niveles.js`
  pasa de 3.000 líneas: un `replace` global puede llevarse funciones
  enteras sin avisar. **Editar bloque a bloque, verificando cada corte.**
- **Las versiones de módulo importan.** Todo el proyecto importa
  `wallet.js?v=125`. Si un archivo pide `?v=126`, el navegador carga
  **dos instancias distintas** con estados separados. Esto causó el bug
  de "conecta tu wallet" con la wallet conectada.
- **Auditoría Playwright obligatoria** en 320, 390 y 430 px antes de
  entregar. Se comprueba: elementos que se salen, paneles cortados,
  botones inalcanzables y errores JS.
- **Comprobar que las funciones clave siguen vivas** después de editar:
  `unificar`, `analizar`, la barra de botones.

### 21.2 Sobre la interfaz

- Las **tachuelas siempre por encima** de cualquier línea. Se guardan
  en una cola y se pintan al final.
- **Bordes dorados**, no blancos. La identidad es dorada y negra.
- El arrastre del gráfico se agrupa **por fotograma**
  (`requestAnimationFrame`), no por píxel, o va en cámara lenta.
- En móvil, los paneles se anclan abajo con scroll propio y `dvh`
  (no `vh`, que no cuenta la barra del navegador).

---

## 22. ERRORES COMETIDOS EN EL DESARROLLO

Documentados para no repetirlos.

### 22.1 Romper el archivo con expresiones automáticas

**Ocurrió dos veces.** Al eliminar una herramienta con expresiones
regulares sobre `niveles.js`, se borraron funciones que sí se usaban
(`unificar`, la barra de botones). El archivo compilaba sin errores
pero **el análisis no mostraba nada**.

**Solución:** restaurar desde el repo o desde la última entrega buena,
y hacer los cortes uno a uno verificando que existen las marcas de
inicio y fin.

### 22.2 Proponer herramientas que no encajan

Se propusieron seis herramientas seguidas y **todas fueron
rechazadas**. El error fue investigar *"qué indicadores premium
existen"* en vez de *"qué necesita alguien que no sabe leer una
gráfica"*.

### 22.3 Arreglar en un solo sitio

Varias correcciones se aplicaron solo a Smart Levels cuando el problema
estaba en las tres secciones. **Ahora hay un dibujante común** para las
órdenes: se arregla en un sitio y sirve para todas.

### 22.4 Datos sin sentido por fórmulas mal planteadas

- *"Retroceso del 130%"* — se usaba `Math.abs`, así que si el precio
  atravesaba la zona de origen el porcentaje crecía sin tope. Un
  retroceso mayor del 100% significa **estructura rota**, y ahora se
  dice así.
- *"El precio está en el medio"* en 8 de 10 escenarios — la detección de
  pivotes usaba comparación estricta y en tendencias sostenidas
  devolvía **cero pivotes**. Sin pivotes no hay niveles y salía el
  mensaje de relleno.

**Lección:** probar el motor contra escenarios sintéticos (tendencia
limpia, crash, pump, lateral, doble suelo) antes de dar nada por bueno.

---

## 23. ARCHIVOS NUEVOS Y MODIFICADOS

| Archivo | Estado |
|---|---|
| `assets/js/niveles.js` | **Modularizado** — 6.221 → 800 líneas (solo arranque + selector + animaciones) |
| `assets/js/niveles/` (15 módulos) | **Nuevo** — motor, asistente, render, interaccion, dibujo, menus, panel, burbujas, imagen, alertas, estilos, util, estado, config, i18n |
| `assets/js/orden.js` | Smart Levels — órdenes desde el gráfico |
| `assets/js/muros.js` | Modificado — Radar Institucional |
| `assets/js/liquidity.js` | Modificado — portada y Liquidity Pools |
| `assets/js/idioma.js` | Modificado — 1.200+ entradas en inglés |
| `assets/js/perfil.js` | Modificado — coste por operación corregido |
| `CriptoCubaPro.sol` | **Nuevo** — sin desplegar |
| Archivos de lotería + huérfanos | **Eliminados** (limpieza de repo, sección 25) |

---

## 24. CÓMO RETOMAR EL TRABAJO

Si esta es una conversación nueva, con leer este documento hay
contexto suficiente. El orden recomendado:

1. **Leer las secciones 14 a 16** para entender qué son las tres
   herramientas y cómo funcionan las órdenes desde el gráfico.
2. **Leer la sección 20** antes de proponer cualquier herramienta
   nueva, para no repetir una idea ya descartada.
3. **Leer las secciones 21 y 22** antes de tocar `niveles.js`.
   **Y las secciones 26 y 27** (modularización y sus reglas obligatorias):
   `niveles.js` ya está troceado en `assets/js/niveles/`; todo cambio nuevo va
   en su módulo, no en el archivo principal.
4. **Preguntar en qué punto está** el despliegue de `CriptoCubaPro.sol`,
   porque es lo que bloquea el cobro.

**Lo más urgente ahora mismo:** terminar el detector de ciclos con el
medidor de probabilidad, aplicándolo **sin romper el archivo**.

---
---

# PARTE III — LIMPIEZA Y MODULARIZACIÓN

> Se añadió después de las Partes I y II. **No sustituye nada anterior.**
> Documenta la limpieza del repo (sección 25), el troceado de `niveles.js`
> en módulos (sección 26) y las **reglas obligatorias** para que los
> archivos no vuelvan a crecer sin control (sección 27).

---

## 25. LIMPIEZA DEL REPOSITORIO

El repo mezclaba **dos apps** que compartían `tokens.js` y `wallet.js`:

- **CriptoCuba (CCO)** — la que funciona. Entra por `index.html → gridbot-ui.js`.
- **Lotería "Aurex/bolita"** — desechada. Entraba por `loteria.html → app.js`.

Se auditó el grafo de imports desde `index.html`, más `sw.js` y los manifests,
y se borró todo lo que solo colgaba de la lotería o estaba huérfano, **sin tocar
la app cripto**.

**Borrado (verificado, no referenciado por la app cripto):**

- **JS huérfanos (5):** `delta.js`, `footprint.js`, `termometro.js`, `worker.js`
  (`orden.js` ya no lo importaba), `ethers-carga.js`.
- **JS de la lotería (13):** `app.js`, `charada.js`, `comprar.js`, `confetti.js`,
  `contrato.js`, `cup.js`, `draws.js`, `economics.js`, `florida.js`, `versos.js`,
  `notificaciones.js`, `icons.js`, `prices.js`.
- **Páginas / manifest / contrato:** `loteria.html`, `diag.html`,
  `manifest.webmanifest` (solo lo usaba `loteria.html`), `contracts/Bolita.sol`.
- **Imágenes sin uso (19):** `aurex-32/512/logo/maskable.png`, `favicon.png`,
  `favicon.ico`, `logo.webp`, `logo-nav.webp`, `bots-bg.webp`, `hero-bg.webp`,
  `fondo-bots.webp`, `banner.svg`, `banner.webp`, `bola-num-sm.webp`,
  `cup-coin.webp`, `ext-logo.webp`, `modo-numero/parle/terminales.webp`.

**Cuidado (NO se borraron — sí las usa la app cripto, aunque el nombre engañe):**
`aurex-apple.png`, `aurex-og.jpg`, `aurex-192.png`, `cco-maskable.png` (los usan
`index.html`, `orden.js` y `manifest-aurex.webmanifest`).

> **Nota:** `index.html` usa `manifest-aurex.webmanifest` (no `manifest.webmanifest`).
> El nombre "aurex" es histórico; esos archivos están en uso por la app cripto.

---

## 26. MODULARIZACIÓN DE `niveles.js`

`niveles.js` había crecido a **6.221 líneas**, con todo embebido. Cada cambio en
un sitio rompía otro. Se troceó, **sin cambiar la lógica y verificando cada
paso** (compilar + render Playwright + las 7 señales del motor idénticas), en
**15 módulos** dentro de `assets/js/niveles/`.

**Resultado: `niveles.js` de 6.221 → 800 líneas (‑87%).**

### 26.1 Estructura

```
assets/js/
├── niveles.js              ( 800) MAIN: arranque (abrirNiveles/recargar),
│                                  selector de monedas (menuPares),
│                                  pintarEstado y animaciones (animarTrazo/Fibo).
│                                  Orquesta e importa todos los módulos.
└── niveles/
    ├── render.js      ( 981) El render principal (dibujar): velas, niveles,
    │                         indicadores (Marea/Faro), herramientas del usuario;
    │                         arranca gestos y orden.js en el primer dibujado.
    ├── motor.js       (1058) Cálculo PURO: pivotes, tendencia, rango, niveles,
    │                         impulsos, estructuras (Faro), dobles, Marea, ATR,
    │                         construirPlan, traerVelas. No toca el DOM.
    ├── asistente.js   ( 731) analizar + unificar: la lectura del asistente
    │                         (mensajes + plan). Escribe en N; no dibuja.
    ├── estilos.js     ( 720) Todo el CSS del overlay.
    ├── interaccion.js ( 591) gestos: cursores, herramientas de dibujo, arrastre,
    │                         zoom, popups y barra de ajustes.
    ├── menus.js       ( 328) Guía de indicador, menú de alertas, ventana
    │                         flotante (PiP), registrar indicador, logos, ayuda.
    ├── dibujo.js      ( 320) Herramientas de dibujo: coordenadas (tiempo/precio
    │                         ↔ píxeles), posiciones, marcadores, regla, tarjetas;
    │                         guardar/cargar dibujos.
    ├── panel.js       ( 215) Panel del indicador Marea (confluencia, HA/ADX/VOL,
    │                         barras LONG/SHORT).
    ├── burbujas.js    ( 179) Burbujas del asistente + escritura letra a letra +
    │                         tabla del plan.
    ├── imagen.js      ( 163) Exportar la gráfica como PNG con marca de agua.
    ├── alertas.js     ( 143) Sonido, notificaciones del sistema y sondeo del
    │                         mercado para las alertas de Marea.
    ├── config.js      (  60) Catálogo de pares (PARES) y temporalidades (TFS).
    ├── util.js        (  50) Utilidades PURAS: fmt, miles, hora, fecha,
    │                         redondeado, _hex2rgb, esc, elegir, sembrar.
    ├── estado.js      (  22) El objeto N compartido (estado de la app).
    └── i18n.js        (  13) El traductor T (carga idioma.js dinámicamente).
```

### 26.2 Arquitectura (cómo encajan sin romperse)

- **`niveles.js` es el punto de entrada.** Lo importa `liquidity.js` como
  `./niveles.js?v=126` (sin cambios). Exporta `abrirNiveles()`.
- **Los submódulos se importan con `?v=1`.** Al ser archivos nuevos no hay caché
  previa; si se editan en el futuro, se sube su `?v=`.
- **`estado.js` exporta `N`**, el objeto de estado. `N` **solo se muta**
  (`N.algo = ...`), **nunca se reasigna** (`N = ...`). Por eso funciona igual
  importado que local, y no hay dependencias circulares.
- **Módulos "hoja" (sin dependencias internas):** `estado`, `util`, `i18n`,
  `motor`, `estilos`. El resto importa de ellos, nunca al revés.
- **Para evitar imports circulares**, los módulos que necesitan `dibujar` /
  `burbujas` / `recargar` / `guardarDib` **los reciben por parámetro** (ej.
  `gestos(cv, dibujar, burbujas, guardarDib)`) o por un inicializador que fija la
  referencia una sola vez (ej. `initBurbujas(dibujar)`, `initRender(recargar)`).
  Nunca se importa `niveles.js` desde un submódulo.
- **El estado del ciclo de vida vive en `N`** (`estado.js`): `N.par`, `N.tf`,
  `N.trazo`, `N.od`, `N.zonasOd`, `N.cerrarFichas`, `N._geo`. Antes eran
  variables sueltas del módulo (`_par`, `_tf`…); se movieron a `N` para poder
  extraer el render sin romper nada.
- **La configuración estática (pares y temporalidades) está en `config.js`** y la
  importan el render, los menús y el selector. Es la fuente única de `PARES`/`TFS`.
- Algunas funciones ahora **reciben `par`/`tf` por parámetro** en vez de leer las
  variables de módulo (`analizar(par)`, `menuAlertas(par, tf)`,
  `abrirWidget(par, tf)`, `guardarImagen(par, tf)`, `activarAlertasMarea(...,
  par, tf)`).

### 26.3 Qué quedó en `niveles.js` y por qué

Tras extraer el render a `render.js`, en `niveles.js` solo queda el **ciclo de
vida y la orquestación**: `abrirNiveles` (monta el overlay y cablea los módulos),
`recargar` (baja velas, corre el análisis y redibuja), `pintarEstado`, las
animaciones (`animarTrazo`/`animarFibo`) y el selector de monedas (`menuPares`).
Es el "main" que une todo: importa los 15 módulos, fija las referencias
(`initRender(recargar)`, `initBurbujas(dibujar)`) y responde a los botones de la
cabecera. Se mantiene deliberadamente fino; cualquier lógica nueva va en su
módulo (ver sección 27), nunca aquí.

---

## 27. 📌 REGLAS DE MODULARIZACIÓN (OBLIGATORIAS PARA TODO CAMBIO FUTURO)

> **Estas reglas son un contrato. Cualquier implementación futura —humana o de
> IA— debe cumplirlas para que los archivos NO vuelvan a crecer sin control.
> Léelas antes de tocar `niveles.js`, `gridbot-ui.js` o cualquier archivo que ya
> pase de ~800 líneas.**

**R1 — Función nueva = módulo (o el módulo existente que le toque).**
Nada nuevo se escribe dentro de `niveles.js` ni de `gridbot-ui.js`. Si es lógica
de análisis/indicadores → `niveles/motor.js`. Herramientas de dibujo →
`niveles/dibujo.js` o `niveles/interaccion.js`. Alertas → `niveles/alertas.js`.
Menús/ventanas → `niveles/menus.js`. Texto del asistente → `niveles/asistente.js`.
Si no encaja en ninguno, **se crea un módulo nuevo** en `niveles/`.

**R2 — Límite de tamaño.** Si un archivo se acerca a **~800 líneas**, se trocea
**antes** de seguir añadiendo. Ningún archivo debería superar ~1.000 líneas
salvo el "main" (`niveles.js`), que aun así se mantiene lo más fino posible.

**R3 — Estado compartido solo en `estado.js`.** El estado que necesiten varios
módulos vive en el objeto `N` (`estado.js`) y **solo se muta, nunca se reasigna**.
No crear variables `let` de módulo nuevas que luego bloqueen extraer código. Si
una pieza necesita estado mutable compartido, se pone como propiedad de `N`.

**R4 — Prohibido el import circular.** Un submódulo **nunca** importa de
`niveles.js`. Si necesita `dibujar`/`burbujas`/`recargar`/etc., se le pasan por
parámetro o por un `init...()` que fija la referencia una vez. Los módulos hoja
(`estado`, `util`, `i18n`, `motor`, `estilos`) no importan de nadie interno.

**R5 — Utilidades puras a `util.js`.** Formateo, colores, geometría de canvas y
helpers sin estado van a `util.js` y se importan. No duplicar helpers.

**R6 — Respetar el motor.** `motor.js` es cálculo puro y da las señales de Marea.
Tras tocarlo, **las 7 señales de los escenarios sintéticos deben ser idénticas**
(crash, pump, doble suelo, alta volatilidad…). Se prueba antes de entregar.

**R7 — No tocar `?v=` de módulos ajenos.** `niveles.js` se importa como
`?v=126`; `orden.js` e `idioma.js` van en `?v=126`. Los submódulos de `niveles/`
usan su propio `?v=`. No cambiar versiones de otros archivos (rompe la caché y
carga instancias dobles; ver regla 4 de la sección 6).

**R8 — Editar bloque a bloque, verificando.** Nada de `replace` global sobre
archivos grandes (ya se rompió dos veces, ver sección 22). Tras cada corte:
`node --input-type=module --check` de **todos** los archivos afectados, render
con Playwright y prueba de la función tocada.

**R9 — Entregar todos los archivos afectados juntos.** Si un cambio toca
`niveles.js` y un submódulo, se entregan ambos, indicando en qué carpeta va cada
uno (`niveles.js` suelto en `assets/js/`; los módulos dentro de `assets/js/niveles/`).

**R10 — Comentarios en español explicando el PORQUÉ.** Cada módulo empieza con
una cabecera de 2-4 líneas que dice qué hace y de dónde salió.

**Regla de oro:** si al terminar un cambio `niveles.js` (o cualquier archivo) es
**más grande** que antes por lógica nueva embebida, el cambio está **mal hecho**:
esa lógica va en un módulo.
