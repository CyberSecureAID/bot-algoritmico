# CriptoCuba Oficial — README V8 (Guía maestra completa)

> **PARA CLAUDE EN UNA SESIÓN NUEVA: LEE ESTE DOCUMENTO ENTERO ANTES DE TOCAR NADA.**
> Este documento te da TODO el contexto que necesitas, porque no recordarás nada de
> lo que hicimos. Si no lo lees completo, romperás el repo. Contiene: todos los
> contratos (nombre, ubicación, dirección de implementación Y de proxy, y qué hace
> cada uno), las APIs que usamos, la integración con Firebase, el estado del frontend,
> todo lo que falta, y las REGLAS DE TRABAJO OBLIGATORIAS con este usuario. Continúa V1–V7.

---

## ⚠️ 0. CÓMO TRABAJAR CON ESTE USUARIO (LEE ESTO PRIMERO, ES LO MÁS IMPORTANTE)

Este usuario ha sufrido MUCHO con ciclos de bugs cuando Claude pierde contexto y rompe
lo que ya funciona. Para NO repetirlo, estas reglas son OBLIGATORIAS y NO negociables:

1. **NUNCA toques lo que ya funciona para "mejorarlo".** Si algo está desplegado y
   operativo, se queda. Si hay que añadir, se añade en un MÓDULO o CONTRATO NUEVO.
2. **ANTES de hacer cualquier cosa: ESTUDIA.** No hagas un estudio por encima. Entra
   en un proceso real de aprendizaje: lee el código completo, entiende el 100% de cómo
   funciona, y SOLO entonces actúa. El usuario lo repite constantemente: "estúdialo en
   serio, no por arribita".
3. **BUSCA ALTERNATIVAS antes de elegir una solución.** Investiga varias formas de
   resolver el problema y elige la que NO rompa nada. Explícale las opciones.
4. **SIEMPRE haz respaldo antes de editar un archivo** (cp archivo archivo.backup).
5. **VERIFICA antes de entregar:** compila los contratos, comprueba la sintaxis del JS
   (node --check), y RENDERIZA visualmente los cambios de interfaz con Playwright antes
   de decir que está listo. El usuario odia que le entregues algo roto.
6. **HÁBLALE CON POCO TEXTO.** Respuestas concisas. Para desplegar/configurar: paso a
   paso, UN paso a la vez, y espera su "listo" antes del siguiente. Él no lee textos
   largos; lee por encima. Si escribes 30 kilómetros de texto, se frustra.
7. **CERO emojis. CERO guiones largos (—) en los párrafos.** No suenes infantil, barato,
   ni como un comercial de Disney con consignas. Suena inteligente, profesional, real.
8. **Cuando él diga "audita el repo" o "vamos a hacer X":** NO te lances a entregar
   archivos. Primero estudia, confirma que entendiste, propón el plan, y que él apruebe.
9. **Las verificaciones son sagradas.** En upgrades de contratos, SIEMPRE compara el
   storage layout del original vs el nuevo (las variables deben quedar en el mismo slot;
   solo se añade al final, reduciendo el __hueco). Un error de storage corrompe el
   contrato con dinero real.
10. **El usuario entra al repo a través de GitHub.** Él sube los archivos manualmente.
    Tú le entregas los archivos con present_files y le dices EXACTAMENTE dónde van.

---

## 1. QUÉ ES CRIPTOCUBA

Un exchange descentralizado (DEX) completo en **BNB Smart Chain (chainId 56)**, no
custodial, pensado para público mundial (empezó orientado a Cuba). Ofrece: swap,
marketplace P2P, staking, bots de trading (GridBot), análisis técnico premium, y el
área de **FUTUROS** (lo que construimos en la sesión V8: futuros perpetuos, Sprint
Scalper, órdenes límite). Todo cobrado y administrado por smart contracts.

### Hay DOS "versiones" del sistema que conviven:
- **Versión WEB (PC):** `index.html` (el hero/lobby) + `futuros.html` (el área de
  futuros en PC) + `app.html` (donde viven los indicadores de análisis en PC).
- **Versión MÓVIL:** `app.html` + los módulos `assets/js/movil/*.js`. El usuario entra
  por `index.html`, y si detecta móvil, redirige a `app.html`.
- Ambas comparten los mismos contratos y la misma wallet.

---

## 2. DATOS GLOBALES

- **Owner principal (tu wallet):** `0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d`
- **Red:** BNB Smart Chain (chainId 56 / 0x38).
- **Compilador (TODOS los contratos):** Solidity **0.8.24**, optimizer **runs 200**,
  EVM **shanghai**, **SIN viaIR**, licencia **MIT**. (commit exacto: e11b9ed9).
- **USDT (BSC):** `0x55d398326f99059fF775485246999027B3197955` (18 decimales).
- **WBNB (BSC):** `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`
- **PancakeSwap Router V2:** `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- **Repo:** GitHub `CyberSecureAID/bot-algoritmico`, rama `main`. Carpeta raw:
  `https://raw.githubusercontent.com/CyberSecureAID/bot-algoritmico/main/`
- **El repo usa `contracts/` (en inglés), con los .sol prefijados `repo_` en algunas
  carpetas** (ej. `contracts/staking/repo_Staking.sol`). Los de futuros NO llevan prefijo.

---

## 3. TODOS LOS CONTRATOS (nombre, ubicación, implementación, PROXY, qué hace)

> **REGLA:** para usar un contrato en Remix, compílalo (para tener el ABI), pulsa
> "At Address" y pega la **dirección PROXY** (nunca la implementación, salvo desplegar
> una impl nueva para un upgrade). Las funciones azules (leer) no cuestan gas; las
> naranjas (escribir) piden firma.

### 3.1 — CONTRATOS BASE (de sesiones anteriores, YA desplegados y operativos)

| # | Contrato | Ubicación en repo | PROXY (usar esta) | Implementación |
|---|---|---|---|---|
| 1 | **Tarifas** | `contracts/core/Tarifas.sol` | `0x068729CBB708713266FFdE2374e51db2B063FD7C` | V2: `0x04341ADf9C371b2cbB504F6722fF2e4Cce470824` |
| 2 | **OraculoPrecios** | `contracts/staking/repo_OraculoPrecios.sol` | `0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3` | `0x0150b62a2355AFc036612B890cbE00F5EcdB8CC7` |
| 3 | **Staking** | `contracts/staking/repo_Staking.sol` | `0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4` | `0xB96675917b784987F06327a629398ff8637BFc64` |
| 4 | **PanelStaking** | `contracts/staking/repo_PanelStaking.sol` | `0xE620D5BD60F70CCdFa4493F3a5B794d1BBEbf8d2` | (sin proxy) |
| 5 | **GridBot V11** | `contracts/bots/GridBotV11.sol` | `0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B` | `0x89bc0f298218118D9DF3Be49672961914fA3aF34` |
| 6 | **GridBot V10** | `contracts/GridBotV10.sol` | (ver abajo) | administra SPOT de los indicadores |
| 7 | **MercadoTokens** | `contracts/MercadoTokens.sol` | `0x39c48394068299Aa3e3ab114F16bfc3DE11F4112` | `0x4782c5A49C7d1Bba1C0A785f90775b47B5315a27` |
| 8 | **SwapLib** (librería) | `contracts/bots/SwapLib.sol` | (se linkea) | `0x8713F1ABF29fBF912D032eA1c1c60380A8De901f` |
| 9 | **PerfilesP2P** | `contracts/p2p/PerfilesP2P.sol` | `0xC01B61B702011747B4c0Ee6B5F2d0F2b4B66880c` | ver V5 |
| 10 | **MercadoP2P** | `contracts/p2p/MercadoP2P.sol` | `0x17B47a8Fb97F8980b96c94E4b9137182e0Bf8025` | ver V5 |
| 11 | **Contabilidad** | `contracts/core/Contabilidad.sol` | `0x7FdE85E0bD53208F380980cfE317A9D4982434Ab` | ver V6 |
| 12 | **WalletShield** | `contracts/shield/WalletShield.sol` | `0x24E34b95dBd7786b0d11E00e7FA256A8763B6D05` | ver V6 |
| 13 | **GasFaucet** | `contracts/core/GasFaucet.sol` | `0x71763E9Ad60d3D2Baa833496F8b4f8eeD497B65F` | ver V6 |

**Qué hace cada uno (base):**
- **Tarifas:** el CEREBRO. Registro central de comisiones (bps) por servicio + el
  MULTI-OWNER de toda la plataforma (principal + hasta 3 directores). Todos los demás
  contratos le preguntan `esAdmin(wallet)`. Funciones: `esAdmin(addr)`, `comisionBps(srv)`,
  `setBps(srv,b)`, `agregarDirector(d)`, `quitarDirector(d)`. Cambias owners aquí y toda
  la plataforma lo hereda.
- **OraculoPrecios:** precio USD (18 dec) de cualquier token. 3 fuentes por token:
  Chainlink, PancakeUSDT, PancakeWBNB. `precioUSD(token)`, `valorUSD(token,cant)`,
  `aceptado(token)`, `configurarToken(token,fuente,feed)` (admin).
- **Staking:** bóveda no custodial. 20% de TODAS las comisiones va a stakers (reparto
  accRewardPerShare, escala a miles sin bucles). Presta liquidez a Futuros:
  `prestar(token,monto,a)`, `devolver(token,monto)`, `disponibleParaPrestar(token)`,
  `depositarRecompensa(token,monto,bps)`, `autorizarContrato(dir,v)` (admin),
  `permitirToken(token)`. El staker SIEMPRE recupera su token exacto.
- **GridBot V11:** bots de trading + swap multi-DEX. Administra operaciones.
- **GridBot V10:** versión anterior, ADMINISTRA LAS OPERACIONES SPOT de los indicadores
  (liquidity pool, hair pool, smart levels) del hero. El usuario YA ha abierto ops ahí.
- **Contabilidad:** registro de actividad para el panel admin. `reportar(wallet,srv,
  generadoUSD,aStakingUSD,aOwnersUSD)` (solo reportadores), `setReportador(dir,v)` (owner).
- **WalletShield:** cobra $5/30 días por un servicio de protección. Patrón de cobro por
  tiempo que replicamos en AnalisisPro: `tieneAcceso(wallet)`, `comprarAcceso()` payable.

### 3.2 — CONTRATOS NUEVOS DE FUTUROS (desplegados en la sesión V8, domingo)

> **TODOS están en la carpeta `contracts/futuros/` del repo** (el usuario los guardó ahí):
> `AnalisisPro.sol`, `Futuros.sol`, `FuturosV2.sol`, `OracleGuard.sol`, `OrdenesLimite.sol`.

| # | Contrato | Archivo | PROXY (usar esta) | Implementación |
|---|---|---|---|---|
| A | **Futuros** | `contracts/futuros/Futuros.sol` | `0x315C8Afc274f2BE822ffA1725b590D7fB7E2Af85` | `0x0dF1E1Fc4cFe1DD8A3BB4A1938879c4c0746c5E9` |
| B | **AnalisisPro** | `contracts/futuros/AnalisisPro.sol` | `0x8e04ACEc37aE1D8fA6239d4407a73316bFC97469` | `0x9c82B4eb95c5D072948A4265dAE6d7dCDB28Cf2E` |
| C | **OracleGuard** | `contracts/futuros/OracleGuard.sol` | `0x300E908d0703D0b934201b3EE1a115632E88af86` | `0xdf2B3371F4a98dbf39d4B69D75563CEc72d5925E` |
| D | **OrdenesLimite** | `contracts/futuros/OrdenesLimite.sol` | `0x1C7F75404a525e1198Cf6f33391D88Bd2d9B008F` | `0x5C5aF9A2c35Ce781E0B33bAdCB2F35536697c421` |
| E | **FuturosV2** (upgrade) | `contracts/futuros/FuturosV2.sol` | (es la nueva impl del proxy A) | `0x7cCaE3e57a2F8D546735B79DBa79B234d200F664` |

> ⚠️ Hubo un Futuros ANTERIOR DESCARTADO (impl suelta sin proxy): `0xF5E7Ba79E3Ef4F4b0c7Be75368b8E69Bc250A0af`. NO USAR. El bueno es el proxy A.

**A — Futuros** (motor de futuros perpetuos). Qué hace / funciones clave:
- `abrirPosicion(token,stable,lado,margen,lev,tp,sl)` — abrir a mercado (lado 0=long,1=short).
- `abrir(ParamsAbrir)` — la usan los satélites (OrdenesLimite) para abrir en nombre de un trader.
- `abrirSprint(token,stable,lado,margen,sl,segundos)` — Sprint Scalper (100x fijo, 60-300s).
- `cerrar(id)`, `liquidar(id)` (pública+propina), `ejecutarTP(id)`, `cerrarVencido(id)` (Sprint),
  `cobrarFunding(id)` (cada 8h).
- Vistas: `posicion(id)`, `idsDe(trader)`, `resumen(trader)`, `levMaximo(token,stable,margen)`.
- Admin: `setTokenOperable(token,v)`, `setStableColateral(token,v)`, `setSatelite(dir,v)`,
  `setFundingBps`, `setPropinaBps`, `setComisionLiquidacionBps`, `setMaxExposicionBps`,
  `setSlippageBps`, `setRouter`, `setContratos(tarifas,staking,oraculo)`, `setPausa(v)`,
  `proponerUpgrade(impl)`.
- MODELO: 0% comisión al abrir, 0% al cerrar normal. SOLO cobra en liquidación/SL (1.5%
  del margen, editable), repartido 50/50 plataforma/stakers. Funding 8h ínfimo (0.01%)
  100% a stakers. Liquidación al perder 75% del margen. Apalancamiento autorregulado por
  la liquidez libre del Staking (techo 200x). Opción B: 2 swaps reales por posición
  (abrir+cerrar en PancakeSwap); el beneficio del short sale del mercado, no de stakers.
- YA configurado: 21 monedas operables (BTCB, ETH, WBNB, CAKE, ADA, DOGE, XRP, DOT, LINK,
  LTC, AVAX, ATOM, UNI, FIL, INJ, SHIB, FLOKI, BABYDOGE, MATIC, TRX, USDC). Staking
  autorizado (puede pedir liquidez). OrdenesLimite autorizado como satélite.
- ⏳ PENDIENTE: ejecutar el upgrade V2 (ver sección 4) que añade editarTPSL + Contabilidad.

**B — AnalisisPro** (cobra el acceso al análisis técnico premium). Funciones:
- `comprarAcceso(plan,token)` payable — plan 0=mes($20), 1=año($100). token=USDT o
  address(0)=BNB. Reparto 50/50 a owner1/owner2.
- `pruebaGratis()` — 10 min, UNA vez por wallet, registrado on-chain.
- `tieneAcceso(wallet)` view, `segundosRestantes(wallet)` view — para el frontend.
- `precioToken(plan,token)` view, `precioMesUSD()`, `precioAnioUSD()`.
- Admin: `setPrecios(mesUSD2,anioUSD2)` (NO fijo), `setDuraciones`, `setReparto`,
  `setOwnersPago(o1,o2)` (cambiar owners de pago), `agregarOwner`, `quitarOwner`,
  `setContratos`, `setPausa`, `concederAcceso(wallet,hasta)`.
- Interconectado con Contabilidad (reporta cada cobro). Autorizado como reportador ✅.
- El acceso por tiempo funciona SIN keeper: tieneAcceso devuelve false solo al vencer.

**C — OracleGuard** (oráculo endurecido anti-gap/anti-manipulación). Funciones:
- DROP-IN del oráculo: `precioUSD(token)`, `valorUSD(token,cant)`, `aceptado(token)`
  (mismas firmas, Futuros puede apuntar aquí).
- `precioSeguro(token)` view — como precioUSD pero frena si hay gap (circuit breaker).
- `chequearGap(token)` — actualiza la referencia y marca gap si el precio saltó >15%.
- Usa el oráculo base (0xf51b..) + Pyth (0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594) con
  mediana + sanity check de desvío. Pyth YA configurado para BTC/ETH/BNB.
- Admin: `setPythId(token,id)`, `setMaxDesvioBps`, `setMaxMovBps`, `setBreakerActivo(v)`,
  `resetGap(token)`, `setContratos`, `setPausa`.

**D — OrdenesLimite** (órdenes límite de Futuros, satélite). Funciones:
- `crear(token,stable,lado,precio,margen,lev,tp,sl)` — cobra el margen, guarda la orden.
- `cancelar(id)` — devuelve el margen al dueño.
- `ejecutar(id)` (pública+propina+idempotente) — cuando el precio toca, abre la posición
  en Futuros en nombre del dueño.
- Vistas: `orden(id)`, `idsDe(trader)`, `ejecutable(id)` (para el keeper).
- Admin: `setPropinaBps`, `setContratos`, `setPausa`.
- Autorizado como satélite en Futuros ✅ y reportador en Contabilidad ✅.

**TODOS los contratos nuevos (A-E) tienen OBLIGATORIAMENTE:** multi-owner vía Tarifas +
principal, proxy UUPS con espera 48h, pausa de emergencia, nonReentrant, SafeERC20
(fee-on-transfer), storage gap, y están interconectados con los contratos que les tocan.

---

## 4. ⏰⏰ UPGRADE DEL FUTUROS — PENDIENTE (CRÍTICO, LEER)

**Hoy es DOMINGO.** Se propuso el upgrade del contrato Futuros el domingo ~06:14.
El upgrade UUPS tiene una espera de **48 HORAS**. Se puede EJECUTAR a partir del
**MARTES ~06:14**.

### Qué es el upgrade: FuturosV2 añade al Futuros desplegado:
- `editarTPSL(id,nuevoTP,nuevoSL)` — el dueño ajusta TP/SL; el SL no pasa la liquidación.
- `setContabilidad(address)` + reporta a Contabilidad en liquidaciones/SL.
- STORAGE VERIFICADO: las 25 variables de V1 quedan en el MISMO slot; solo se añadió
  `contabilidad` + se redujo __hueco de 40 a 39. NO corrompe nada.

### PASOS para ejecutar el upgrade (en 48h, guiar al usuario paso a paso):
1. La implementación V2 YA está desplegada: `0x7cCaE3e57a2F8D546735B79DBa79B234d200F664`.
2. El proponerUpgrade YA se llamó. Solo falta ejecutar.
3. En Remix, cargar el proxy `0x315C8Afc274f2BE822ffA1725b590D7fB7E2Af85` con el ABI de
   FuturosV2. Llamar: **`upgradeToAndCall(0x7cCaE3e57a2F8D546735B79DBa79B234d200F664, 0x)`**
   (el 0x vacío = sin llamada extra). Firmar.
4. El proxy pasa a usar el código V2. Dirección del proxy NO cambia. Datos intactos.

### DESPUÉS de ejecutar el upgrade (3 conexiones):
1. `Futuros.setContabilidad(0x7FdE85E0bD53208F380980cfE317A9D4982434Ab)`
2. `Contabilidad.setReportador(0x315C8Afc274f2BE822ffA1725b590D7fB7E2Af85, true)`
3. `Futuros.setContratos(0x0, 0x0, 0x300E908d0703D0b934201b3EE1a115632E88af86)` ← apunta
   el oráculo del Futuros al OracleGuard endurecido (anti-gap activo). Los dos 0x0 dejan
   tarifas y staking como están.
4. Verificar: `Futuros.editarTPSL` existe; `Futuros.contabilidad()` != 0.

---

## 5. APIs Y SERVICIOS EXTERNOS (YA integrados, NO volver a crear)

### 5.1 — Etherscan API V2 (YA en uso)
- **Key:** `TZQ4M8PRW6J794MWDB1D2WM3FPVVC6NKB6`
- Sirve para BscScan + 60 redes EVM cambiando `chainid` (56=BNB, 1=ETH, 137=Polygon...).
- URL: `https://api.etherscan.io/v2/api?chainid=56&module=...&apikey=KEY`
- YA IMPLEMENTADA en `assets/js/movil/movil.js` para descubrir los tokens del saldo.

### 5.2 — TronScan API (guardada, NO implementada aún)
- **Key:** `a9e2c8f6-b952-42ac-9127-3a2e11c7e271`
- Para DESPUÉS: USDT-TRON, P2P Cuba, un módulo aparte. NO es prioridad.

### 5.3 — Pyth Network (oráculo, YA en OracleGuard)
- Contrato Pyth Core BSC: `0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594`
- Feed IDs: BTC `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43`,
  ETH `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`,
  BNB `0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f`.

### 5.4 — Binance (gráficas, YA en uso)
- REST klines: `https://api.binance.com/api/v3/klines` (velas históricas).
- WebSocket velas en vivo: `wss://stream.binance.com:9443/ws/<simbolo>@kline_<tf>` y
  `@aggTrade` (tick a tick). Implementado en `assets/js/modulo/velas-vivo.js` (futuros).

### 5.5 — Firebase / Firestore (YA integrado, versión GRATUITA)
- Se usa para guardar los LOGOS de tokens listados (criptocuba-logos). Versión gratis.
- La seguridad REAL la da el `soloOwner` de cada contrato; Firebase es solo apoyo.
- **Reglas de Firestore actuales** (colección de logos, lectura pública, escritura
  controlada):
  ```
  rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Logos de tokens listados (ya lo teníamos)
    match /logos/{tokenId} {
      allow read: if true;
      allow create: if request.resource.data.logo is string
                    && request.resource.data.logo.size() < 90000;
      allow update, delete: if false;
    }

    // Perfiles de usuario por wallet (nombre + foto)
    match /perfiles/{wallet} {
      allow read: if true;
      allow create, update: if request.resource.data.keys().hasOnly(['nombre', 'foto', 'ts'])
                    && (!('nombre' in request.resource.data) || (request.resource.data.nombre is string && request.resource.data.nombre.size() < 60))
                    && (!('foto' in request.resource.data) || (request.resource.data.foto is string && request.resource.data.foto.size() < 90000));
      allow delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}

  ```
- OJO: Firebase NO compila en GitHub; es config del lado cliente.

### 5.6 — Cloudflare Workers (keeper) — LO ÚLTIMO DE TODO
- El keeper para disparar liquidaciones/funding/órdenes/cierres por tiempo.
- ⚠️ ESTO ES LO ÚLTIMO ABSOLUTO DEL PROYECTO. El usuario NO tiene el plan de pago aún.
  NO se hace ahora. MIENTRAS TANTO, los disparadores funcionan por: (1) las funciones
  públicas con propina del contrato (bots públicos de la blockchain las ejecutan), y
  (2) el frontend que llama cerrarVencido cuando el cronómetro de Sprint llega a 0.

---

## 6. ESTADO DEL FRONTEND (qué está hecho y qué falta)

### 6.1 — WEB de FUTUROS (`futuros.html`, en la raíz del repo)
YA CONECTADO al contrato Futuros (versión en index.html: `futuros.html?v=13`):
- ✅ Abrir a mercado (approve USDT + firma).
- ✅ Cerrar posición (real, en el contrato).
- ✅ Leer posiciones reales del contrato (refresco cada 15s).
- ✅ Órdenes límite: crear, leer, cancelar (contrato OrdenesLimite 0x1C7F75..).
- ✅ Sprint Scalper: pestañas Futures/Sprint, ventana explicativa (inglés, inteligente,
  menciona binarias, sin consignas), temporizador estilo IQ Option (expiry con -/+,
  countdown), 100x fijo, solo 1m/3m/5m, conectado a abrirSprint, disparador real
  cerrarVencido cuando vence.
- ✅ Historial: botón History, muestra todo (fecha, par, lado, lev, margen, entrada,
  salida, PNL, cómo cerró), paginación, reseteo 30 días, lee eventos de la blockchain.
- ✅ VELAS EN VIVO Y SINCRONIZADAS: módulo `assets/js/modulo/velas-vivo.js` (WebSocket
  @kline + @aggTrade + interpolación 60fps). El temporizador de Sprint está sincronizado
  con el cierre REAL de la vela de Binance (usa velasVivoCierreActual, no el reloj local).
- ⏳ FALTA: conectar `editarTPSL` (necesita el upgrade V2 activo).
- wallet unificada a v129 en futuros.html.

### 6.2 — ANÁLISIS PROFESIONAL (en curso, 5 piezas)
- ✅ PIEZA 1: módulo `assets/js/modulo/analisis-pro.js` (ventana de cobro). Ventana
  emergente (no navega, no desconecta wallet). Lee precio del contrato (no fijo). Pago
  BNB/USDT. Prueba 10 min. Owner no paga. 2 mensajes (hero/futuros). Conectada a
  AnalisisPro 0x8e04... FALTA: el usuario debe subir `assets/portada/img/analisis-pro.webp`
  (imagen candado/escudo estilo WalletShield).
- ⏳ PIEZA 3 (LO MÁS DELICADO, EN CURSO): botón TORNASOL en futuros + REPLICAR los
  indicadores (liquidity pool, hair pool, smart levels) en un MÓDULO NUEVO que los
  proyecte sobre la gráfica de FUTUROS, SIN TOCAR el original. Ver sección 7.
- ⏳ PIEZA 2: transformar el botón "Analysis" del hero (index.html línea ~158): al hover
  NO desplegar menú; al clic abrir la ventana de cobro (origen 'hero'). NO romper la
  uniformidad con los botones de al lado. Mensaje: operaciones SPOT.
- ⏳ PIEZA 4: corte por tiempo (polling tieneAcceso del contrato + temporizador cuenta
  regresiva + difuminar gráfica (blur, NO negra) + ventana de cobro al vencer). Las capas
  de seguridad: el frontend consulta SIEMPRE al contrato, nunca decide solo.
- ⏳ PIEZA 5: quitar de la barra superior de futuros (futuros.html ~líneas 269-273): Máx
  24H, Mín 24H, Vol 24H, Vol 24H USDT, Financ. → hacer espacio para 2 botones: "Análisis
  Profesional" (tornasol) y "Señales de Trading".

### 6.3 — MÓVIL (`app.html` + `assets/js/movil/*.js`) — PENDIENTE, MENOS TRABAJO
- El usuario dice que en móvil NO hay que hacer tanto como en la web.
- FALTA: replicar lo conectado de la web (abrir, cerrar, posiciones, Sprint, órdenes
  límite) en los módulos móviles (`futuros-movil.js`, `operar.js`).
- Móvil: el botón Sprint Scalper es UN solo botón que cambia según si está seleccionado
  (no dos pestañas como en web; en móvil no hay espacio para el apalancamiento repetido).
- La lista de monedas operables debe leerse de Staking (disponibleParaPrestar) — frontend.

---

## 7. ⚠️ PIEZA 3 — REPLICAR INDICADORES EN FUTUROS (la tarea en curso, LEER BIEN)

El usuario quiere que, tras pagar, el usuario vea los indicadores premium (liquidity
pool, hair pool, smart levels) DENTRO de la gráfica de futuros, sin salir.

### REGLA ABSOLUTA: NO TOCAR EL ORIGINAL.
- Los indicadores originales viven en `assets/js/niveles.js` (799 líneas) + la carpeta
  `assets/js/niveles/` (motor.js 1058, render.js 981, dibujo.js 320, estado.js, config.js,
  estilos.js, y más). Se muestran en el HERO / `app.html` y los administra GridBot V10
  (operaciones SPOT con clic derecho en la gráfica). ESTO SE QUEDA INTACTO.
- Hay que REPLICAR (copiar la lógica) en un MÓDULO NUEVO (ej. `assets/js/modulo/
  analisis-futuros.js`) que: lea las velas de futuros (N.velas, que ya están en vivo),
  calcule los mismos pools (reusando o replicando motor.js), y los dibuje sobre el canvas
  de futuros. SIN modificar niveles.js ni sus módulos.

### CÓMO HACERLO (el usuario insiste: ESTUDIAR EN SERIO, no por encima):
1. Estudiar a fondo cómo motor.js calcula liquidity/hair pools (detectarImpulso,
   detectarRango, calcularNiveles, detectarEstructuras) y cómo render.js los dibuja
   (la función dibujar()).
2. Entender la cadena completa: velas → motor (cálculo) → render (dibujo sobre canvas).
3. Replicar esa cadena en el módulo nuevo, apuntando al canvas y las velas de futuros.
4. El acceso lo controla AnalisisPro (tieneAcceso): solo dibujar si el usuario pagó.
5. Botón para activar/quitar las capas. Botón tornasol profesional (no brillo de
   cumpleaños) para abrir el servicio.
- Smart Levels: el usuario quiere RENOMBRARLO a algo que termine en "pool" (ej. "Smart
  Pool", "Level Pool"). Confirmar el nombre con él.
- RECOMENDACIÓN DE CLAUDE (V8): esta tarea es grande y merece una sesión dedicada con
  todo el espacio para estudiar el motor sin prisa. Fue por esto que se cerró la sesión
  V8 y se creó este README.

---

## 8. LO QUE FALTA (lista completa, por prioridad)

### Inmediato / corto plazo:
1. ⏰ Ejecutar el upgrade del Futuros en 48h (martes) + las 3 conexiones (sección 4).
2. Conectar editarTPSL en la web (tras el upgrade).
3. PIEZA 3: replicar indicadores en futuros (sección 7) — sesión dedicada.
4. PIEZA 2, 4, 5 del Análisis Profesional (sección 6.2).
5. Renombrar Smart Levels a algo con "pool".

### Medio plazo:
6. MÓVIL: conectar futuros (abrir, cerrar, posiciones, Sprint, órdenes límite).
7. SEÑALES DE TRADING: servicio NUEVO. Botón en futuros Y en el hero. Cada señal cuesta
   dinero. Lo cobra el contrato (AnalisisPro ampliado o uno nuevo). Reparto a owners.
8. FONDEO (cuentas fondeadas sin challenge): POSPUESTO. Diseño completo guardado. Es muy
   delicado (sincronización temporal stake↔plan, doble asignación de capital, inmoviliza
   mucho capital). Solo cuando el núcleo lleve meses estable y el pool sea grande.
   Planes estilo FTMO (comprar un plan: ej. $50 → cuenta de $1000). Saldo FIGURATIVO que
   NUNCA sale a la wallet. Comisión semanal 100% a stakers. Operar 4x/semana obligatorio.

### Largo plazo / lo último:
9. Cloudflare Workers (keeper) — LO ÚLTIMO ABSOLUTO.
10. Fase de ciberseguridad (6 meses dedicados al final).

---

## 9. RECETA DE VERIFICACIÓN EN BSCSCAN (para verificar contratos)
- Método: Solidity (Standard-JSON-Input).
- Dirección: la de la IMPLEMENTACIÓN (no el proxy).
- Compiler: v0.8.24+commit.e11b9ed9. Optimizer runs 200. EVM shanghai. Sin viaIR. MIT.
- JSON con rutas OpenZeppelin (contracts + contracts-upgradeable @5.0.2).

## 10. ENTORNO DE DESARROLLO DE CLAUDE (para compilar/verificar contratos)
- El sandbox bloquea solc-select pero `npm install solc@0.8.24` SÍ funciona (trae el
  compilador en JS). OpenZeppelin: `npm install @openzeppelin/contracts@5.0.2
  @openzeppelin/contracts-upgradeable@5.0.2`.
- Para compilar: usar solc.compile con callback de imports que mapea @openzeppelin/..@5.0.2
  a node_modules. Optimizer 200, shanghai. (El "stack too deep" sin viaIR se resuelve
  refactorizando funciones grandes en sub-funciones y usando structs para params; NO
  activar viaIR porque el repo no lo usa).
- Para storage layout (upgrades): outputSelection storageLayout, comparar slots.
- Para render de interfaz: Playwright (chromium headless, --no-sandbox) + screenshot.
- El sandbox NO puede conectar al WebSocket de Binance ni a la blockchain (para probar
  esas cosas, el usuario las prueba en su navegador).

---

## 11. RESUMEN DE LA SESIÓN V8 (qué se logró)
Se desplegaron 4 contratos nuevos (Futuros, AnalisisPro, OracleGuard, OrdenesLimite),
todos compilados, auditados y operativos. Se propuso el upgrade del Futuros (V2, espera
48h). En el frontend web de futuros se conectó casi todo al contrato (abrir mercado,
cerrar, leer posiciones, órdenes límite, Sprint Scalper completo con interfaz IQ Option,
historial) y se resolvió el movimiento fluido + sincronizado de las velas en tiempo real.
Se construyó la ventana de cobro del Análisis Profesional (pieza 1). Quedó en curso la
pieza 3 (replicar indicadores en futuros), que merece una sesión dedicada.

**FIN DEL README V8. Si eres Claude en una sesión nueva: ya tienes todo el contexto.
Ahora SÍ puedes empezar a trabajar, siempre siguiendo las reglas de la sección 0.**
