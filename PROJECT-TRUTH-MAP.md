# PROJECT TRUTH MAP — CriptoCuba Oficial

> Auditoría de solo lectura del ZIP `bot-algoritmico-main.zip`.
> **No se ha modificado ningún archivo del repositorio.**
> Fecha de auditoría: 8 de septiembre de 2026.
>
> **Etiquetas usadas en todo el documento:**
> `[HECHO]` verificado leyendo el código o la documentación del repo ·
> `[INFERENCIA]` deducido del sistema, no afirmado explícitamente ·
> `[VERIFICAR]` no se puede determinar desde el repo (hace falta on-chain, Cloudflare o el teléfono) ·
> `[RECOM.]` propuesta mía, no estado actual.
>
> Regla aplicada: **cuando la documentación y el código se contradicen, manda el código**, y la contradicción se anota.

---

## 0. Alcance de lo auditado

152 archivos, 4,0 MB. Se leyeron íntegros: `index.html`, `sw.js`, `manifest-aurex.webmanifest`, `CNAME`, `robots.txt`, `sitemap.xml`, `INVENTARIO.md`, `README.md` (V1), `README-V2.md`, `README-V3.md`, `README-V4.md`, `ESTRATEGIA-logica-estructural-avanzada.md`, `assets/js/wallet.js`, `assets/js/gridbot/config.js`, cabeceras y secciones clave de los 70+ módulos JS, y el `:root` de `assets/css/styles.css`.

Se ejecutaron además tres análisis mecánicos:

1. **Comprobación de sintaxis** de los 71 módulos ES (`node --input-type=module --check`) → **0 errores**. `[HECHO]`
2. **Resolución del grafo de imports** desde `index.html` + `sw.js` → lista de módulos inalcanzables (sección 11). `[HECHO]`
3. **Barrido de secretos** (claves privadas, seeds, API keys, tokens) → **no se encontró ningún secreto en el repo** (sección 13). `[HECHO]`

---

## 1. RESUMEN EJECUTIVO

**CriptoCuba Oficial** es una plataforma **no custodial** de bots de trading y análisis técnico sobre **BNB Smart Chain (chainId 56)**, que opera contra **PancakeSwap V3**. El capital del usuario nunca sale de su wallet: los contratos reciben un *allowance* por monto exacto, revocable desde el perfil. Lo único que el usuario deja depositado en el contrato es un **tanque de BNB para gas**, retirable. `[HECHO — README.md §1, gridbot.js cabecera]`

Técnicamente es una **SPA de JavaScript vanilla con módulos ES nativos, sin build, sin bundler, sin backend propio y sin `package.json`**, servida como sitio estático desde GitHub Pages con dominio propio `criptocubaoficial.com`. Toda la lógica corre en el navegador; los datos son on-chain (RPC público de BSC vía ethers v6) más tres APIs públicas gratuitas (Binance, CoinGecko, y un widget de calendario económico). `[HECHO]`

La única pieza fuera del navegador y de la cadena es el **keeper**: un Cloudflare Worker en un repositorio aparte (`CyberSecureAID/bolita-keeper`, **no incluido en este ZIP**) que cada minuto revisa precios y dispara las órdenes de los bots. `[HECHO — README.md §4, README-V3 §1, README-V4 §4]`

**Estado real hoy:** el producto tiene una superficie funcional muy grande y madura (4 bots, marketplace P2P, swap, 3 herramientas de análisis profesional, academia de pago, app móvil completa, PWA instalable, i18n de 1.200+ entradas, asistente por reglas). Está bloqueado por **dos cosas**, ninguna de ellas de frontend:

1. El **keeper no ejecuta de forma fiable** por límites del plan gratuito de Cloudflare (bloqueo #1 declarado). `[HECHO — README-V4 §4.3]`
2. El contrato de cobro de la sección Pro (`CriptoCubaPro.sol`) **está escrito pero sin desplegar**, y la constante `PRO` en `liquidity.js` está vacía → **todas las herramientas premium están abiertas y gratis para cualquiera**. `[HECHO — liquidity.js:27, liquidity.js:537]`

Y tiene un tercer problema, el que motiva este encargo, que **no está documentado en ningún README**: **no existe portada**. Ver sección 12.

---

## 2. ARQUITECTURA COMPLETA (extremo a extremo)

### 2.1 El flujo real (no el genérico)

```
NAVEGADOR DEL USUARIO
│
├─ index.html  (GitHub Pages → CNAME criptocubaoficial.com)
│    ├─ styles.css            ← tokens :root (--gold, --display, --sans, --mono)
│    ├─ asistente.css
│    ├─ news.js (clásico, no módulo) → window.abrirCalendario()
│    ├─ sw.js  (PWA: precache de 15 archivos, red-primero para navegación)
│    └─ <script type="module"> gridbot-ui.js   ← ÚNICO PUNTO DE ENTRADA
│
└─ gridbot-ui.js :: arrancar()
     ├─ initSwap()
     ├─ pinta #c-boot (splash negro; spinner solo si tarda >500 ms)
     ├─ wallet.reconectarSiProcede()   [carrera contra timeout de 2500 ms]
     ├─ render()
     │    ├─ SIN cuenta  → headerHTML() + .conectar-box (h2 + p + botón) + FAQ
     │    └─ CON cuenta  → header + creador de bots + tarjetas de bots + FAQ
     └─ SI ancho ≤ 760px → import('./movil/movil.js').montarMovil()
                             └─ montarMovil() → inyectarMovil() → #mv-app + #mv-nav
                                              → irA('home')
                                              → autoConectarMovil()  ⚠️ CONECTA SOLA
```

`[HECHO — gridbot-ui.js:3154-3191, movil/movil.js:546-604]`

### 2.2 Capas

| Capa | Dónde corre | Qué hace |
|---|---|---|
| **Presentación web** | Navegador | `gridbot-ui.js` (3.800+ líneas) monta todo dentro de `#colmena-app`. CSS inyectado por `gridbot/estilos.js` (110 KB) con scope `#colmena-app`. |
| **Presentación móvil** | Navegador ≤760px | Cáscara `#mv-app` + barra `#mv-nav`, montada **encima** de la web (que se oculta con `visibility:hidden`). CSS en `movil/estilos.js`. |
| **Lógica de aplicación** | Navegador | `orden.js`, `perfil.js`, `market/*`, `niveles/*`, `muros.js`, `liquidity.js`, `tools.js`, `academy.js`, `prizepool.js`, `admin.js`. |
| **Capa de contrato** | Navegador | `gridbot.js` (ABI + firmas + matemática de rejilla), `wallet.js` (EIP-1193/6963/WalletConnect), `tokens.js` (catálogo). |
| **Blockchain** | BNB Smart Chain | GridBot (proxy), AurexMarket (proxy UUPS), AurexPrizePool (proxy UUPS), AurexSwap (directo), Academy (proxy). |
| **Ejecución automática** | Cloudflare Worker | El **keeper**: cron cada minuto, Multicall3, ensayo en seco, envía las tx con su propia clave. **Repo aparte, no auditado aquí.** |
| **Datos de mercado** | APIs públicas | Binance (klines, ticker, depth, WebSocket), CoinGecko (precios/logos), Trust Wallet assets en GitHub raw (logos de respaldo). |

### 2.3 Quién llama a quién (dependencias reales)

- `gridbot-ui.js` → `gridbot.js`, `wallet.js`, `tokens.js`, `perfil.js`, `prizepool.js`, `tutorial.js`, `market.js`, `avisos.js`, `grafica.js`, `extras.js`, `gestos.js`, `gridbot/{estilos,util,estado,config,swap}.js`.
- `gridbot-ui.js` → **imports dinámicos**: `liquidity.js`, `tools.js`, `academy.js`, `idioma.js`, `admin.js`, `orden.js`, `movil/movil.js`.
- `movil/movil.js` → `wallet.js`, `gridbot.js`, `movil/{estilos,iconos,inicio,markets,operar,activos,menu,buscar,alerta}.js` y, **dinámicamente, los módulos de la WEB** (`../niveles.js`, `../muros.js`, `../liquidity.js`, `../market.js`, `../tools.js`, `../academy.js`, `../perfil.js`, `../prizepool.js`, `../gridbot/swap.js`).
- `liquidity.js` → `niveles.js` y `muros.js` (portada de las tres herramientas Pro).
- `niveles.js` → los 15 módulos de `niveles/`.
- `muros.js`, `niveles/render.js`, `movil/operar.js` → `orden.js`.

`[HECHO — verificado por resolución del grafo de imports]`

### 2.4 Qué es on-chain y qué es off-chain

| On-chain (BSC) | Off-chain |
|---|---|
| Creación, estado, ejecución y cancelación de bots | Toda la interfaz |
| Saldo de gas por usuario (`gasSaldo`) | Cálculo de niveles, presets, previsualizaciones |
| Suscripción mensual (`activo`, `suscribir`) | Análisis técnico (Smart Levels, Radar, Heat Pools) — cálculo puro en el navegador |
| Órdenes limit (= rejilla de 1 nivel) | **Marcador de "esto es orden limit, no bot"** → `localStorage` (`cco-ordenes-grafico`) |
| Marketplace P2P: órdenes, fianzas, disputas, perfiles, calificaciones | Alertas de precio "solo avisarme" → `localStorage` |
| Prize Pool + aleatoriedad API3 QRNG | Preferencia de wallet, idioma, favoritos, aviso de riesgo visto |
| Academy: planes y acceso por usuario de Telegram | Registro de la cuenta en el keeper (`fetch /registrar`) |
| Swap con comisión propia | Precios, velas y libro de órdenes (Binance / CoinGecko) |

### 2.5 Puntos únicos de fallo `[INFERENCIA, salvo donde se indica]`

| Punto | Consecuencia si cae | Fallback |
|---|---|---|
| **Keeper (Cloudflare Worker)** | Los bots **no operan**. La web sigue navegable y el usuario puede cancelar/cerrar a mano. | Ninguno. `[HECHO — es el único ejecutor]` |
| **GitHub Pages** | El sitio no carga… salvo para quien tenga la PWA instalada (el SW sirve la copia). | Parcial, vía service worker. `[HECHO — sw.js]` |
| **Wallet del owner** | Controla los proxies actualizables → riesgo máximo. | El README §11 ya lo identifica y recomienda wallet física. `[HECHO]` |
| **Cuenta de GitHub** | Puede servir JS malicioso a todos los usuarios. | 2FA recomendado en README §11. `[HECHO]` |
| **API de Binance** | Sin velas, sin libro de órdenes, sin precios → las tres herramientas Pro y Operar quedan vacías. | Hay hosts alternativos declarados (`api1/api2/api-gcp/data-api.binance.vision`). `[HECHO]` |
| **RPC de BSC** | Sin saldos ni estado de bots. | 3 RPC en rotación en `gridbot.js`; `wallet.js` usa el proveedor inyectado. `[HECHO]` |
| **CoinGecko** | Logos y precios de la lista de mercados. | Sí: `movil/fmt.js` cae a Trust Wallet assets (GitHub) y luego a la inicial de la moneda. `[HECHO — README-V2 §6.2]` |
| **`localStorage`** | Se pierde la distinción orden-limit vs bot → las órdenes vuelven a contarse como bots y ocupan cupo. | Ninguno. Es el punto frágil más subestimado. `[HECHO — README-V2 §8]` |

---

## 3. INVENTARIO DEL REPOSITORIO

### 3.1 Raíz

| Archivo | Tamaño | Estado |
|---|---|---|
| `index.html` | 14 KB | **CRÍTICO** — único HTML del proyecto. Entrada, PWA, anti-clickjacking, fallback a 20 s, carga diferida del asistente. |
| `sw.js` | 3,8 KB | **CRÍTICO** — service worker, caché `aurex-v128`. |
| `manifest-aurex.webmanifest` | 1 KB | PWA. Nombre "Cripto Cuba Oficial". |
| `CNAME` | 21 B | `criptocubaoficial.com` |
| `robots.txt` / `sitemap.xml` | — | ⚠️ **Ambos apuntan al dominio VIEJO** `cybersecureaid.github.io/bot-algoritmico/`, no al CNAME. `[HECHO]` |
| `.nojekyll` | 0 B | Necesario para GitHub Pages. |
| `orden.js` | 64 KB | 🟡 **HUÉRFANO** — duplicado viejo de `assets/js/orden.js`. 151 líneas de diferencia. README-V3 §0 dice explícitamente: *"el de la raíz es duplicado viejo: NO tocar"*. `[HECHO]` |
| `Favicon.webp` | 94 KB | 🟡 Huérfano, no referenciado por nada. `[HECHO]` |
| `README.md` (V1) | 48 KB | Documentación fundacional: contratos, keeper, economía, seguridad, reglas de modularización. |
| `README-V2.md` | 22 KB | App móvil: arquitectura, 4 pantallas, sistema de diseño, 15 bugs históricos. |
| `README-V3.md` | 10 KB | Keeper: causa raíz del cron, comisiones eliminadas, 3 bots planeados. |
| `README-V4.md` | 12 KB | Estado en el momento de la pausa por Cloudflare. |
| `ESTRATEGIA-logica-estructural-avanzada.md` | 15 KB | Especificación de implementación del Radar (muros.js), con `[PREGUNTA]` abiertas. |
| `INVENTARIO.md` | 2,3 KB | ⚠️ **OBSOLETO** — describe el proyecto "bolita" (lotería): `app.js`, `charada.js`, `versos.js`, `contracts/Bolita.sol`… **ninguno existe ya**. Induce a error a cualquiera que lo lea primero. `[HECHO]` |

### 3.2 `assets/js/` — módulos (los 15 mayores)

| Archivo | Líneas aprox. | Función | Criticidad |
|---|---|---|---|
| `muros.js` (270 KB) | ~6.000 | Radar Institucional / Lógica Estructural Avanzada | IMPORTANTE |
| `gridbot-ui.js` (212 KB) | 3.800+ | Interfaz principal: header, 4 bots, tarjetas, cupo, órdenes | **CRÍTICO** |
| `asistente/motor.js` (158 KB) | — | Motor del chatbot por reglas | SECUNDARIO |
| `liquidity.js` (139 KB) | ~2.100 | Portada Pro + mapa de calor de liquidez (**CONGELADO**) | IMPORTANTE |
| `movil/liquidity.js` (132 KB) | — | 🔴 **HUÉRFANO** (ver §11) | — |
| `idioma.js` (116 KB) | — | i18n ES→EN/PT, 1.200+ entradas, traducción del DOM en vivo | IMPORTANTE |
| `asistente/conocimiento.js` (111 KB) | — | Base de conocimiento del chatbot | SECUNDARIO |
| `gridbot/estilos.js` (110 KB) | — | **Todo el CSS de la app web**, scope `#colmena-app` | **CRÍTICO** |
| `movil/muros.js` (95 KB) | — | 🔴 **HUÉRFANO** | — |
| `tools.js` (72 KB) | — | Colector de polvo, alertas, gráfica limpia TradingView | IMPORTANTE |
| `academy.js` (69 KB) | — | Academia de pago (contrato propio) | IMPORTANTE |
| `orden.js` (68 KB) | — | Órdenes desde el gráfico = rejillas de 1 nivel | **CRÍTICO** |
| `niveles/*` (15 módulos) | ~5.600 | Smart Levels modularizado | IMPORTANTE |
| `market/*` (16 módulos) | ~2.000 | Marketplace P2P | IMPORTANTE |
| `movil/*` (18 módulos) | ~3.500 | Cáscara móvil | **CRÍTICO en móvil** |

### 3.3 Vendor (1,6 MB — el 40 % del repo)

`ethers-6.13.4.min.js` (501 KB), `walletconnect.umd.js` (875 KB, carga diferida), `lightweight-charts.mjs` (163 KB, TradingView), `qrcode.js` (57 KB, carga diferida). Todo alojado localmente, sin CDN — decisión deliberada y correcta. `[HECHO — gridbot.js cabecera]`

### 3.4 Tecnologías

- JavaScript ES2020+, módulos ES nativos. **Sin TypeScript, sin React, sin Tailwind, sin bundler, sin `package.json`, sin CI.** `[HECHO]`
- Versionado de caché manual por query string `?v=N`.
- Fuentes: Google Fonts (Chakra Petch, IBM Plex Mono, Plus Jakarta Sans) con carga no bloqueante.
- Despliegue: push a `main` → GitHub Pages.

---

## 4. INVENTARIO DE CONTRATOS

### 4.1 Tabla maestra

| Contrato | Dirección | Red | Patrón | ¿Actualizable? | Fuente `.sol` | Referencia en código | Función |
|---|---|---|---|---|---|---|---|
| **GridBot** | `0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B` (proxy) | BSC 56 | Proxy `[VERIFICAR]` tipo exacto | **Sí** `[HECHO — README]` | ❌ **NO la tenemos** | `gridbot.js:22` | Los 4 bots, gas, suscripción, ejecución |
| ↳ implementación | `0xAfda4B885CE5599050CF0f1c2c9Cc4661Cae8005` | BSC 56 | — | — | ❌ | Solo `README-V3.md:60` | Lógica del GridBot |
| **AurexMarket** | `0x1131c4760Da083aaFCf20d6848Af93A8a2edFb18` (proxy) | BSC 56 | **UUPS** + Ownable + Pausable | **Sí** | ⚠️ Documentada, **no en el ZIP** | `market/config.js:5`, `avisos.js:8` | Marketplace P2P |
| ↳ lógica V2 | `0x16F75Aa7451c1363aEF1C1D1dcC5b38829346A81` | BSC 56 | — | — | ⚠️ | Solo README.md §2.2 | — |
| **AurexPrizePool** | `0x595CD563F236DAEba21219D60AEF656a750A8132` (proxy) | BSC 56 | **UUPS** + Ownable + Pausable | **Sí** | ⚠️ Documentada, no en el ZIP | `prizepool.js:8` | Sorteo con API3 QRNG |
| ↳ lógica V5 | `0xe5b44a43eEe2a70d76002E7Af43380BaaFb244Bb` | BSC 56 | — | — | ⚠️ | Solo README.md §2.3 | — |
| **AurexSwap** | `0xa15794D9c313F3E2726ED1D45A1B6CC72BFA2a0c` | BSC 56 | **Directo, NO proxy** | **No** | ❌ | `gridbot.js:790` | Swap sobre Pancake V3 con comisión |
| **Academy** | `0x96b7c62771FcdB4F9210f9ee70bAe0eA5d7E9721` | BSC 56 | Proxy (según comentario) `[VERIFICAR]` | `[VERIFICAR]` | ❌ | `academy.js:11` | Acceso de pago al grupo de formación |
| **CriptoCubaPro** | — | — | UUPS previsto | — | ⚠️ Escrito, **no en el ZIP** | `liquidity.js:27` (`PRO = ''`) | **SIN DESPLEGAR** — bloquea el cobro Pro |
| **Lotería (desechada)** | `0x964a68D3A2dB18c723581410C49aa8789048E1B9` | BSC 56 | Proxy | Sí | ❌ | **Ninguna** en el código actual | Vacío, sin uso |

### 4.2 Hallazgo importante sobre el código fuente

**En este ZIP hay CERO archivos `.sol`.** `[HECHO — verificado]`

El README.md §2.2 y §2.3 dicen *"Fuente: SÍ la tenemos"* para `AurexMarketV2.sol` y `AurexPrizePoolV5.sol`, y el §17 menciona `CriptoCubaPro.sol` como archivo del repo. **Ninguno está aquí.** O viven fuera del repositorio, o se perdieron. `[HECHO]`

**Consecuencia práctica:** hoy **no se puede actualizar la implementación de ningún contrato**, porque no hay con qué compilar una nueva. Y `CriptoCubaPro.sol` no se puede desplegar. Esto convierte "recuperar los `.sol`" en un pendiente de prioridad alta que ningún README lista como tal.

### 4.3 Cómo funciona la relación proxy → implementación

```
Usuario (wallet)
   │  firma
   ▼
PROXY  0x4e86…F93B          ← esta dirección NO cambia nunca
   │  delegatecall
   ▼
IMPLEMENTACIÓN 0xAfda…8005  ← esta SÍ se puede sustituir
   │
   ▼
Storage: vive SIEMPRE en el proxy
```

El *storage* (bots, saldos de gas, suscripciones) vive en el proxy. La implementación solo aporta código. Por eso **se puede cambiar la lógica sin que el usuario tenga que migrar, sin cambiar la dirección que la web usa, y sin perder ningún bot**. `[HECHO — patrón estándar; README.md §2 lo confirma para este proyecto]`

### 4.4 Regla de no redesplegar — aplicada a lo que hay sobre la mesa

| Mejora deseada | ¿Hace falta redesplegar? | Por qué |
|---|---|---|
| Renovación automática de suscripción | **No** — upgrade de implementación del GridBot | Es un proxy. Solo falta el `.sol`. `[HECHO — README §12]` |
| Contador global de usuarios on-chain | **No** — upgrade | Ídem. |
| Wallets de respaldo (owner 1→2→3) | **No** en GridBot/Market/PrizePool (upgrade) · **Sí** en AurexSwap | AurexSwap no es proxy. `[HECHO]` |
| Bot de Rebalanceo (nuevo modo) | **No** — nuevo `modo` en el enum del GridBot vía upgrade | Los modos ya son `uint8` (0-3). Añadir 4 es compatible en layout. `[INFERENCIA razonable, requiere ver el `.sol`]` |
| Trailing Stop | **No** — upgrade (nuevo modo + campo de máximo alcanzado) | ⚠️ Añadir un campo a un struct persistido **sí** afecta al storage layout. `[VERIFICAR con el `.sol`]` |
| Marcador on-chain de "orden limit" | **No** — upgrade (usar el `botId` que ya existe en `crearRejilla`) | El campo `botId` **ya está en el ABI**. Podría bastar con leerlo, sin tocar el contrato. `[HECHO — gridbot.js ABI]` |
| Cobro de la sección Pro | **Sí, despliegue nuevo** de `CriptoCubaPro` | No existe todavía. Es un contrato nuevo, no un redespliegue. |
| Comisión del swap en otras redes | **Sí, un contrato por red** | No es redespliegue: es expansión multicadena. `[HECHO — README §12]` |

**Antes de proponer cualquier upgrade hay que responder, y hoy no se puede desde el repo:** quién es el `owner`/`upgrader` de cada proxy `[VERIFICAR on-chain]`, si el storage layout de la nueva implementación es compatible `[VERIFICAR — requiere el `.sol` actual]`, y si el mecanismo de upgrade está bien configurado `[VERIFICAR]`.

### 4.5 Seguridad de contratos — hallazgos preliminares

**No he hecho, ni puedo hacer, una auditoría formal de seguridad: no hay código fuente Solidity en el repositorio.** Todo lo que sigue es **"hallazgo preliminar — requiere auditoría formal"**.

1. **Centralización.** Los tres contratos principales son actualizables y `Ownable`. Quien controle la wallet del owner puede sustituir la lógica de un contrato que tiene *allowance* sobre los fondos de los usuarios. El README §11 ya lo identifica como el riesgo #1 y recomienda wallet física. **Es correcto y sigue siendo el riesgo mayor del sistema.**
2. **Sin wallets de respaldo.** Si se pierde la wallet del owner, los contratos quedan sin administración para siempre. La lotería desechada ya tenía `ownerSecundario`; los contratos vivos no. `[HECHO — README §12]`
3. **El `PRO` vacío es un agujero de negocio, no de seguridad.** Cualquiera accede hoy a las herramientas de pago. `[HECHO — liquidity.js:27 y :537]`
4. **Se leyó de la doc:** `AurexMarket` se compiló con `optimizer runs=1` para caber en 24 KB. Eso indica que el contrato está **en el límite de tamaño**: cualquier upgrade que añada lógica puede no compilar. `[HECHO — README §2.2]` `[RECOM.]` tenerlo presente antes de prometer funciones nuevas en el Market.
5. **Aspecto positivo verificado en el frontend:** los *allowance* se piden por **monto exacto, nunca infinito**, y son revocables desde el perfil. `[HECHO — README §11]`

---

## 5. INVENTARIO DE SERVICIOS

| Servicio | Ubicación | Función | Depende de | Infra | Frecuencia | Criticidad | ¿Fallback? | Si cae… |
|---|---|---|---|---|---|---|---|---|
| **Keeper** | Repo aparte `bolita-keeper`, `src/worker.js` | Ejecuta los bots on-chain | RPC BSC, Multicall3, `KEEPER_PRIVATE_KEY` | Cloudflare Workers (**plan gratuito**) | Cron cada minuto | **CRÍTICO** | **No** | Los bots dejan de operar. El resto de la web funciona. |
| **Registro en keeper** | `gridbot-ui.js:407`, `orden.js:751` | `GET /registrar?u=0x…` al crear bot | Keeper vivo | fetch | Al crear cada bot | IMPORTANTE | Falla en silencio (`.catch(()=>{})`) | El bot existe on-chain pero **el keeper no lo vigila**. |
| **`/estado`** | Keeper | Diagnóstico público | Keeper | HTTP | Bajo demanda | IMPORTANTE | — | Se pierde la única ventana de diagnóstico. |
| **Panel admin** | `admin.js` | Administración; lee `/estado` y saldos | Keeper + contratos + ser owner | Navegador | Bajo demanda (5 clics) | IMPORTANTE | — | Sin panel de control. |
| **RPC BSC** | `gridbot.js` (3 RPC), `academy.js`, `wallet.js` | Lecturas on-chain | — | Públicos | Continuo | **CRÍTICO** | Sí, rotación | Sin saldos ni estado. |
| **Binance API** | `niveles/motor.js`, `muros.js`, `liquidity.js`, `movil/operar.js` | Velas, ticker, profundidad, WebSocket | — | Pública | Continuo | **CRÍTICO para Pro** | Hosts alternativos | Las 3 herramientas y Operar quedan vacíos. |
| **CoinGecko** | `movil/markets.js`, `tokens.js`, `movil/fmt.js` | Precios y logos | — | Pública, gratis | Caché 5 min | IMPORTANTE | Sí (Trust Wallet assets → inicial) | Solo estética. Bloqueada dentro de wallets. `[HECHO — README-V2 §6.2]` |
| **Trust Wallet assets** | `movil/fmt.js` | Logos de respaldo | GitHub raw | Pública | Bajo demanda | IMPORTANTE | Sí (inicial) | Logos como letra inicial. |
| **Service Worker** | `sw.js` | PWA, arranque sin conexión | — | Navegador | Instalación | IMPORTANTE | Degrada solo | La app deja de abrir sin red. |
| **Calendario económico** | `news.js` | Widget CashbackForex | Tercero | iframe | Bajo demanda | SECUNDARIO | — | Sin calendario. |
| **Nominatim (OSM)** | `market/ubicacion.js` | Geocodificación inversa P2P | — | Pública | Bajo demanda | SECUNDARIO | — | Sin nombre de ciudad. |
| **flagcdn** | `liquidity.js`/`muros.js` | Banderas de divisas | — | Pública | Bajo demanda | SECUNDARIO | — | Sin banderitas. |
| **Bot Telegram Academy** | Cloudflare `aurex-academy-bot` | Bot de la academia | Cloudflare | Worker | — | SECUNDARIO | — | README-V3 §2: **NO TOCAR**. |
| **Asistente por reglas** | `asistente/{conocimiento,motor}.js` | Chatbot sin IA externa | — | Navegador | Carga diferida | SECUNDARIO | — | Sin ayuda contextual. |
| **i18n** | `idioma.js` | ES→EN/PT sobre el DOM | — | Navegador | Al cambiar idioma | IMPORTANTE | Sí: español permanente | Se queda en español. |
| **Servicios de pago móviles** | `movil/movil.js:41` | `SERVICIOS_PAGO = {}` | — | — | — | **EXPERIMENTAL** | — | Andamiaje vacío, todo libre. `[HECHO]` |

---

## 6. WEB — CÓMO FUNCIONA

1. `index.html` carga `news.js` (clásico) y `gridbot-ui.js` (módulo).
2. `arrancar()` pinta un splash negro (`#c-boot`) y lanza `wallet.reconectarSiProcede()` **en carrera con un timeout de 2,5 s**: si la extensión de wallet no responde, la página se pinta igual y se avisa al usuario. Buena ingeniería defensiva. `[HECHO]`
3. `render()` bifurca:
   - **Sin wallet:** `headerHTML()` + `.conectar-box` (título, un párrafo, un botón) + FAQ de 29 preguntas. **Esto es todo lo que ve un visitante nuevo.**
   - **Con wallet:** header + creador de bots (4 tipos, presets, gráfica de previsualización con `lightweight-charts`, asesor de rentabilidad) + tarjetas de bots activos + cupo (8 total, 2 por tipo) + FAQ.
4. El **header** es la navegación real del producto: Swap · Academy · Tools · Liquidity · Prize Pool · Market · Install · Conectar/Perfil, más el ticker del Prize Pool.
5. Todas las secciones grandes abren como **overlays a pantalla completa** con id propio (`nv-overlay`, `mu-overlay`, `lq-overlay`, `mk-overlay`, `pf-overlay`, `tools-overlay`, `ac-overlay`, `pp-overlay`). No hay router ni URLs por sección: **una sola URL para todo el producto**. `[HECHO]` — dato relevante para SEO y para la portada.
6. **Panel de administración oculto:** 5 clics en la esquina inferior izquierda. La comprobación de que eres owner **se hace leyendo los contratos**, no la web, y si no lo eres no pasa absolutamente nada. Diseño correcto. `[HECHO — README §10]`

---

## 7. MOBILE — CÓMO FUNCIONA

**No es la web estrechada.** Es una aplicación distinta montada encima. `[HECHO]`

- Disparador: `matchMedia('(max-width: 760px)')`, evaluado **de forma síncrona** al cargar `gridbot-ui.js` para evitar el parpadeo (inyecta `#colmena-app{visibility:hidden}` antes de pintar nada).
- `montarMovil()` crea `#mv-app` (cáscara, `position:fixed; inset:0`) y `#mv-nav` (barra inferior **perpetua**, fuera de la cáscara, siempre visible).
- **Cuatro pestañas:** Inicio · Mercados · Operar · Activos, con router propio `irA(tab)`.
- **La móvil no duplica lógica on-chain:** importa dinámicamente los módulos de la web (`../gridbot.js`, `../orden.js`, `../niveles.js`, `../market.js`…). Decisión arquitectónica excelente y hay que preservarla.
- Patrones app-like ya presentes: barra inferior fija, hojas emergentes (`#mv-sheet`, z-index 11000), toast, `env(safe-area-inset-*)`, scroll interno con scrollbar oculta, libro de órdenes por WebSocket a Binance con barras animadas, gestos (swipe entre bots, pull-to-refresh en `gestos.js`), escáner de NFTs on-chain sin API.
- **Auto-conexión:** `autoConectarMovil()` intenta reconexión silenciosa y, si hay `window.ethereum` y sigue sin cuenta, **llama a `wallet.conectar()` una vez, sin que el usuario pida nada**. `[HECHO — movil/movil.js:594-604]`
- **Aviso de red incorrecta:** ventana con instrucciones por wallet (MetaMask / Trust / SafePal) y botón de `wallet_switchEthereumChain`.

### Lo que le falta a la móvil para ser realmente app-like `[INFERENCIA]`

No hay transiciones entre pestañas (el contenido se reemplaza de golpe: `host.innerHTML = …`), no hay skeletons de carga, no hay bottom-sheets con arrastre, no hay gestión de historial (el botón "atrás" del sistema **no navega dentro de la app**, sale del sitio), y no hay indicación de progreso al abrir overlays pesados como Smart Levels.

---

## 8. WALLET — CÓMO FUNCIONA

`assets/js/wallet.js` (540 líneas), **sin librerías de conexión**, salvo WalletConnect que se carga a demanda. `[HECHO]`

**Detección, por orden de prioridad:**
1. Wallet que el usuario eligió a mano (guardada en `localStorage` como `aurex-wallet`).
2. **EIP-6963** (`eip6963:announceProvider` / `requestProvider`), prefiriendo MetaMask real y **descartando explícitamente la wallet integrada de Brave**, que se anuncia sin estar configurada y no responde. Detalle de calidad. `[HECHO]`
3. `window.ethereum.providers[]` → MetaMask.
4. `window.ethereum`.
5. **WalletConnect v2** (`projectId` en el código; es un identificador público, no un secreto), con **ventana propia** en vez del modal de la librería: en móvil botones directos a MetaMask/Trust/SafePal con *deep link* + enlace universal de respaldo a los 1,2 s; en escritorio, QR generado localmente.
6. `abrirEnWalletMovil()`: reabre la página **dentro** del navegador de MetaMask/Trust/SafePal.

**Ciclo de vida:** `conectar()` → `eth_requestAccounts` + `eth_chainId` → engancha `accountsChanged` / `chainChanged` → notifica a los suscriptores (`alCambiar`). `desconectar()` intenta `wallet_revokePermissions` (si la wallet lo soporta) y marca `bolita.desconectado='1'` para **no reconectar sola**. `reconectarSiProcede()` usa `eth_accounts` (silencioso, sin pop-up) y respeta esa bandera.

**Red:** BNB Smart Chain `0x38`; `cambiarARedCorrecta()` hace `switch` y, si la red no existe (código 4902), `wallet_addEthereumChain`.

**Valoración:** es la pieza mejor construida del proyecto. Cubre EIP-6963, multi-proveedor, WalletConnect, deep links, desconexión honesta, diagnóstico legible y checksum EIP-55. **No tocar.**

---

## 9. CLOUDFLARE — QUÉ ES Y CUÁL ES EL PROBLEMA

### 9.1 Aclaración de nomenclatura (importante)

En el encargo se habla de un sistema **"CAPER"** y de un **"Walker"** de Cloudflare.

**En el repositorio no existe ningún sistema llamado CAPER ni ningún Walker.** Se buscó exhaustivamente: la única aparición de "caper" es dentro de la palabra `landscaper` en una lista de oficios de `asistente/motor.js`, y la única de "walker" es `document.createTreeWalker` en `idioma.js`. `[HECHO — verificado]`

Lo que sí existe, y encaja exactamente con la descripción, es:

- **KEEPER** (no CAPER) — el servicio que vigila precios y ejecuta los bots.
- **WORKER** (no Walker) — el Cloudflare Worker donde vive ese keeper.

Trabajaré con esa lectura. Si el owner se refería a otra cosa, hay que aclararlo antes de tocar nada.

### 9.2 Qué hace el keeper

- **Repo:** `CyberSecureAID/bolita-keeper`, archivo `src/worker.js`. **No está en este ZIP** — no puedo auditar su código. `[HECHO]`
- **Worker:** `bolita-keeper-bot` · URL `https://bolita-keeper-bot.yamicelanvivesqui.workers.dev`
- **Rutas:** `/estado` (informe público), `/registrar?u=0x…` (la web lo llama al crear cada bot), `/parte?n=N&de=M&key=TOKEN` (reparto interno), `/run?key=ADMIN_TOKEN` (disparo manual).
- **Diseño:** la corrida principal **no trabaja, reparte**: llama a hasta 30 copias de sí misma; cada copia atiende 400 bots. Usa **Multicall3** para leer ~150 datos en una petición, y hace un **ensayo en seco** (`staticCall`) antes de cada transacción para no gastar gas en intentos que van a revertir. Capacidad de diseño: **12.000 bots/minuto**.
- **Estado en Cloudflare:** `KEEPER_PRIVATE_KEY` (admite varias claves), `ADMIN_TOKEN`, y un KV `KEEPER_KV` → `bolita-keeper-kv`.

### 9.3 El problema, con su causa raíz

Los README documentan una cadena de diagnósticos que **ya se resolvieron** (dos workers pisándose el mismo KV; el KV borrándose en cada deploy por no estar declarado en `wrangler.toml`; `eth_getLogs` no soportado en RPC públicos de BSC; el margen del 0,3 % que bloqueaba ejecuciones; la llamada al contrato `bolita` que hacía revertir cada swap, resuelta con `setBolita(0x0)`). `[HECHO — README §7, README-V3 §1.2]`

**Lo que queda, y es un límite de plataforma, no un bug:**

> El keeper corre en el **plan gratuito de Cloudflare Workers**. Ahí choca con el tope de **CPU por invocación** (10 ms) y el de **50 subpeticiones por corrida** (el tope interno del código está en 38). Además, el **cron trigger interno es frágil** con deploys por Git: en el último incidente la sección Cron Triggers del panel **estaba vacía**, y apareció un error de conexión con GitHub que puede dejar deploys a medias.
> Síntoma: el keeper funciona un rato y luego **se congela durante horas**.
> `[HECHO — README-V3 §1.3, README-V4 §4.3]`

### 9.4 Qué depende de Cloudflare y qué se pierde

| Depende de Cloudflare | Se pierde si cae |
|---|---|
| Ejecución de las cuadrículas del Smart Grid | Los bots **no compran ni venden**. |
| Venta total del Accumulator | No cierra ciclo. |
| Cash Out al precio objetivo | No vende. |
| Compras programadas del DCA | No compra. |
| Órdenes limit "automáticas" desde el gráfico | No se ejecutan. |
| Cierre por TP/SL | **No protege.** El más grave: el usuario cree tener un stop y no lo tiene. |
| Panel admin: bloque de estado del keeper | Sale vacío. |
| Bot de Telegram de la academia | Worker aparte. |

**NO depende de Cloudflare:** conectar wallet, crear/cancelar/cerrar bots a mano, swap, marketplace P2P, Prize Pool, academia, las tres herramientas de análisis, la app móvil, la PWA, el perfil, el historial. **La plataforma sigue siendo usable; lo que no funciona es la automatización.**

### 9.5 ¿Hay fallback?

**No.** El keeper es el único ejecutor y no hay ruta alternativa. `[HECHO]`

Las **alertas "solo avisarme"** de `orden.js` son lo único que sigue vivo sin keeper (vigilan el precio cada 30 s en el navegador y notifican), pero **no ejecutan nada**. `[HECHO — README §16]`

### 9.6 Solución ya decidida por el equipo (no la re-decido yo)

1. **Comprar Workers Paid ($5/mes):** 10 M ejecuciones, 30 s de CPU, 10.000 subpeticiones. *Bloqueo declarado: el pago requiere tarjeta Visa/Mastercard y el owner está en Cuba; se pagará vía un contacto en EE. UU. o tarjeta virtual.* `[HECHO — README-V3 §1.3]`
2. **Cron externo redundante** (p. ej. cron-job.org) llamando a `/run?key=ADMIN_TOKEN` cada minuto, para que el keeper corra aunque Cloudflare borre su cron interno. **Esto es lo que rompe el problema de raíz.** `[HECHO — README-V3 §1.3]`
3. Reconectar GitHub en Cloudflare, deploy limpio, verificar que la watch-list persiste en KV y no en memoria, y revisar los ~959 errores vistos en métricas.

### 9.7 Mi posición

**Es prioridad 9, como marca el encargo, y estoy de acuerdo.** El paso 2 (cron externo, gratis, 15 minutos de trabajo) probablemente elimina el 80 % del síntoma sin gastar un dólar, y **no requiere tocar el frontend**. `[RECOM.]` Es un ticket independiente que puede ejecutarse en paralelo con la portada sin ningún acoplamiento.

---

## 10. LO QUE YA FUNCIONA — NO TOCAR SIN MOTIVO

| # | Funcionalidad | Nota |
|---|---|---|
| 1 | Conexión de wallet (EIP-6963 + WalletConnect + deep links) | La pieza mejor hecha del repo. |
| 2 | Creación de los 4 bots con presets auditados | Los números fueron recalculados para rendir con 50 USDT. |
| 3 | Cancelar / cerrar / pausar bots | On-chain, con firma. |
| 4 | Depósito y retirada de gas | Saldo único por usuario. |
| 5 | Permisos por monto exacto y revocables | Diferenciador real, no marketing. |
| 6 | Swap integrado | Contrato propio. |
| 7 | Marketplace P2P completo (fianza, tramos, disputas, árbitros, calificaciones) | 16 módulos. |
| 8 | Prize Pool con API3 QRNG | ⚠️ Ver contradicción en §14. |
| 9 | Academy con contrato de pago propio | Contrato **no documentado** en ningún README. |
| 10 | Smart Levels (15 módulos) con plan de operación | La joya del producto. |
| 11 | Radar / Lógica Estructural Avanzada | Muchas features. |
| 12 | Liquidity Pools — **MAPA DE CALOR CONGELADO** | 🔴 Intocable por decisión explícita del owner. |
| 13 | Órdenes desde el gráfico (clic derecho / pulsación larga) | Reutiliza rejillas de 1 nivel: cero contratos nuevos. |
| 14 | App móvil de 4 pantallas | Reutiliza la lógica on-chain sin duplicarla. |
| 15 | Libro de órdenes por WebSocket | ~10 actualizaciones/segundo. |
| 16 | PWA instalable con service worker | Arranca sin conexión. |
| 17 | i18n ES/EN/PT con español como respaldo permanente | 1.200+ entradas. |
| 18 | Asistente por reglas, carga diferida | 210 KB, no bloquea el arranque. |
| 19 | Panel admin oculto, sin funciones irreversibles | Diseñado para no poder romper nada. |
| 20 | Anti-clickjacking, XSS de tokens saneado, `rel=noopener` | README §11. |
| 21 | Historial exportable a Excel por bot | — |
| 22 | Escáner de NFTs on-chain sin API | — |

---

## 11. LO QUE FALTA, ESTÁ INCOMPLETO O ES CÓDIGO MUERTO

### 11.1 Bloqueantes de negocio

| Qué | Estado | Impacto |
|---|---|---|
| **Keeper fiable** | Bloqueado por plan gratuito de Cloudflare | Los bots no se ejecutan → **el producto principal no cumple su promesa**. |
| **`CriptoCubaPro.sol` desplegado** | Escrito, sin desplegar, y **el `.sol` no está en el ZIP** | No se puede cobrar la sección Pro. |
| **`PRO = ''` en `liquidity.js:27`** *(y en `movil/liquidity.js:27`)* | Vacío | Todo el mundo entra gratis. |
| **`OWNER = ''` en `liquidity.js:537`** | Vacío = modo desarrollo | Nadie ve los planes; todos entran directo. |
| **Los `.sol` de los contratos** | **Ausentes del repositorio** | **No se puede actualizar ningún contrato.** No documentado como pendiente en ningún README. |
| **Portada / landing** | **No existe** | Ver §12. |

### 11.2 Código muerto verificado

Resuelto por grafo de imports desde `index.html` + `sw.js`. Todos compilan, ninguno es alcanzable. `[HECHO]`

| Archivo | Peso | Situación |
|---|---|---|
| `assets/js/movil/liquidity.js` | 132 KB | Nadie lo importa. `movil/movil.js` usa `../liquidity.js` (la web). |
| `assets/js/movil/muros.js` | 95 KB | Ídem. |
| `assets/js/movil/niveles.js` | 48 KB | Ídem. |
| `assets/js/movil/config.js` | 3,9 KB | **Copia literal de `niveles/config.js`** (su propia cabecera lo dice). |
| `orden.js` (raíz) | 65 KB | Duplicado viejo. README-V3 §0: *"NO tocar"*. |
| `Favicon.webp` (raíz) | 94 KB | Sin referencias. |
| 8 imágenes en `assets/img/` | ~330 KB | `aurex-32/512/maskable.png`, `favicon-32.png`, `favicon.webp`, `modo-numero/parle/terminales.webp` (restos de la lotería). |
| `INVENTARIO.md` | 2,3 KB | Describe un proyecto que ya no existe. |

**Total ≈ 770 KB de peso muerto (≈19 % del repo).**

> `[RECOM.]` **No borrar nada todavía.** El clúster `movil/{liquidity,muros,niveles,config}.js` puede ser trabajo en curso intencionado (una versión móvil nativa de las herramientas Pro que se dejó a medias). **Hay que preguntar al owner antes de tocarlo.** Lo que sí propongo sin riesgo: sustituir `INVENTARIO.md` por una nota que apunte a los READMEs, porque hoy desinforma activamente a quien llega nuevo.

### 11.3 Deuda técnica concreta y verificada

| # | Problema | Ubicación | Consecuencia |
|---|---|---|---|
| **D1** | **`orden.js` se importa con DOS versiones distintas.** `gridbot-ui.js` usa `?v=125` (líneas 2250, 2312, 2458); `muros.js`, `niveles/render.js` y `movil/operar.js` usan `?v=126`. | 4 archivos | **Dos instancias del módulo con estado separado.** Es exactamente el bug que README-V3 §3 dio por resuelto ("se unificó"): **ha vuelto o nunca se cerró del todo**. Síntoma esperable: el contador de "Mis órdenes" y la lista no coinciden entre la vista de bots y las gráficas. `[HECHO]` |
| **D2** | **`ethers` se importa con dos versiones.** `wallet.js`, `liquidity.js`, `muros.js`, `movil/muros.js`, `movil/liquidity.js` usan `?v=126`; los otros 17 sitios usan `?v=125`. | 22 imports | **El navegador descarga y parsea 501 KB dos veces.** El SW solo precachea `?v=125`, así que `?v=126` va siempre a la red. Impacto directo en el arranque móvil. `[HECHO]` |
| **D3** | **`wallet.js:18` importa `./tokens.js` SIN `?v=`**, mientras el resto usa `?v=125`. | `wallet.js` | Dos instancias de `tokens.js`. `[HECHO]` |
| **D4** | `robots.txt` y `sitemap.xml` apuntan al dominio antiguo de GitHub Pages, no al CNAME. | raíz | SEO dividido entre dos dominios. `[HECHO]` |
| **D5** | El `.catch(()=>{})` del montaje móvil oculta cualquier error de arranque. | `gridbot-ui.js:3185` | Depuración a ciegas en móvil. Ya avisado en README-V2 §1.1. `[HECHO]` |
| **D6** | "Mis órdenes" vive en `localStorage` (`cco-ordenes-grafico`). | `orden.js` | No cruza entre dispositivos. El campo `botId` ya existe en el ABI de `crearRejilla` → **solución probablemente sin tocar el contrato**. `[HECHO]` |
| **D7** | `styles.css` (87 KB) sigue siendo **la hoja de la lotería** (fondo `#030B08`, verde neón `#2EE86A`). `index.html` la neutraliza con un `<style>` en línea. | `assets/css/styles.css` | ⚠️ **NO SE PUEDE BORRAR:** su `:root` define `--gold`, `--gold-soft`, `--display`, `--sans`, `--mono`, `--r`, que **`gridbot/estilos.js` consume y no redefine**. Borrarla deja la app sin dorado y sin tipografías. `[HECHO — verificado]` |
| **D8** | El botón "atrás" del sistema no navega dentro de la app móvil. | `movil/movil.js` | Sale del sitio. Rompe la ilusión app-like. `[INFERENCIA]` |

### 11.4 Previsto pero no implementado

Renovación automática de suscripción · contador global de usuarios on-chain · wallets de respaldo (owner 1→2→3) · swap multicadena (decisión pendiente sobre la comisión fuera de BSC) · marcas de compra/venta sobre las velas · historial del Marketplace con fechas · detector de ciclos con Heikin Ashi + ADX · medidor de probabilidad de señal · imagen `serv-tres.webp` (marcador provisional) · **3 bots nuevos: Rebalanceo → Trailing Stop → Señales** · Fases 1-5 de la app móvil (acciones de wallet, marketplace NFT) · números animados (`data-contar` existe, sin aplicar).

---

## 12. EL PROBLEMA DE PRODUCTO: NO HAY PORTADA

Esto no está documentado en ningún README, y es el hallazgo de UX más importante de la auditoría.

**En escritorio** (`gridbot-ui.js:678-694`), un visitante sin wallet ve, literalmente:

```
[header con 8 botones]
┌────────────────────────────────┐
│   Cripto Cuba Oficial          │   ← h2
│   Bots que compran barato y    │   ← un párrafo
│   venden caro por ti…          │
│   [ Conectar wallet ]          │   ← un botón
└────────────────────────────────┘
[FAQ desplegable de 29 preguntas]
```

Una caja de 440 px de ancho centrada. Eso es todo. `[HECHO]`

**En móvil es peor:** `montarMovil()` monta la cáscara y `autoConectarMovil()` **dispara `wallet.conectar()` automáticamente**. El visitante llega y lo primero que ve es un pop-up de su wallet pidiendo permiso, **antes de haber visto una sola frase sobre qué es esto**. `[HECHO — movil/movil.js:594-604]`

Esto contradice el estándar del sector. La investigación de referencias 2026 lo dice con claridad: <cite index="6-1">el visitante de una landing cripto llega desconfiado, y su primera pregunta no es qué hace el producto sino si le va a quitar el dinero; hay que responder qué es en una sola frase por encima del pliegue, con el mecanismo, no la visión, y quien no consigue clasificar el producto en cinco segundos se va</cite>. Y sobre el momento de pedir la wallet: <cite index="8-1">solo se debería exigir la conexión cuando el usuario necesita comprar, vender, listar o gestionar activos; siempre que sea posible, hay que dejarle explorar el producto antes de pedirle acceso a la wallet</cite>.

**Diagnóstico:** el proyecto tiene un producto de nivel alto detrás de una puerta que parece un prototipo. Toda la sofisticación real (arquitectura no custodial, contratos actualizables, permisos revocables, motor de análisis propio, ejecución 24/7) **es invisible hasta después de conectar la wallet**.

---

## 13. SEGURIDAD — RESULTADO DEL BARRIDO

**No se detectó ningún secreto expuesto en el repositorio.** `[HECHO]`

Las únicas apariciones de `KEEPER_PRIVATE_KEY` y `ADMIN_TOKEN` son **menciones del nombre de la variable** en la documentación (README.md:181-182, README-V3:27, README-V4:93), explicando que viven como *secrets* en Cloudflare. Ningún valor. No hay claves privadas, ni seeds, ni API keys, ni tokens.

**Nota, no hallazgo:** `WC_PROJECT_ID` en `wallet.js:42` es el identificador público de proyecto de WalletConnect. Está pensado para ir en el cliente; no es un secreto. `[HECHO]`

**Riesgos reales, en orden** (coinciden con el README §11 y los suscribo):
1. **La wallet del owner.** Controla contratos actualizables con *allowance* sobre fondos de usuarios. → Wallet física, obligatorio.
2. **La cuenta de GitHub.** Un push malicioso sirve JS a todos los usuarios en segundos. → 2FA con app, nunca SMS. Sin CI ni revisión, el push es despliegue directo.
3. **Sin wallets de respaldo.** Perder la wallet del owner = contratos sin administración para siempre.
4. **Los `.sol` ausentes.** Sin código fuente no hay auditoría posible, ni upgrades, ni verificación en BscScan.

---

## 14. CONTRADICCIONES ENTRE DOCUMENTACIÓN Y CÓDIGO

Manda el código. Documentadas, no resueltas:

| # | Contradicción | Realidad según el código |
|---|---|---|
| C1 | README-V4 §2: *"**AurexPrizePool**: **desechado**"*. README.md §2.3 lo describe como activo. | **El código lo tiene vivo:** `prizepool.js` está importado estáticamente por `gridbot-ui.js`, y el header tiene botón *Prize Pool* + ticker enganchados a `abrirPrizePool()`. **No está desechado.** `[HECHO — gridbot-ui.js:559-560]` |
| C2 | README.md §2.2/§2.3/§17: *"Fuente: SÍ la tenemos"* + `CriptoCubaPro.sol` como archivo del repo. | **Cero archivos `.sol` en el ZIP.** `[HECHO]` |
| C3 | README.md §6 regla 5: *"Versión actual `?v=107`, caché `aurex-v109`"*. | Los imports van en `?v=125/126`, `sw.js` en `aurex-v128`. La regla envejeció. `[HECHO]` |
| C4 | README-V3 §3: el bug de doble instancia de `orden.js` *"se unificó"*. | **Sigue habiendo `?v=125` y `?v=126`** conviviendo. `[HECHO — D1]` |
| C5 | README.md §5 dice que se borraron `hero-bg.webp`, `banner.svg`, `banner.webp`, `logo.webp`, `logo-nav.webp`, `bots-bg.webp`, `fondo-bots.webp`, `bola-num-sm.webp`, `cup-coin.webp`, `ext-logo.webp`… | **Siguen en `assets/img/`.** La limpieza se documentó pero no se ejecutó del todo. Algunas sí están en uso hoy. `[HECHO]` |
| C6 | `INVENTARIO.md` describe `app.js`, `charada.js`, `versos.js`, `contracts/Bolita.sol`, "19 archivos en total". | Ninguno existe. El repo tiene 152 archivos y es otro producto. `[HECHO]` |
| C7 | README-V2 §0: *"Idioma: todo en **español**"*. README.md §14: *"inglés por defecto; español y portugués a elección"*. | `index.html` declara `lang="es"` y todos los textos base están en español; `idioma.js` traduce sobre la marcha. **El idioma base es español.** `[HECHO]` |
| C8 | README.md §2.4: AurexSwap *"Solo BNB Smart Chain"* y no actualizable; README §12 planea multicadena. | Coherente, pero implica **contrato nuevo por red**. No es contradicción: es una consecuencia que conviene tener escrita. |

---

## 15. RIESGOS — QUÉ PODRÍA ROMPERSE

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Subir `?v=` de un módulo sin subirlo en **todos** sus importadores | **Alta** (ya pasó dos veces) | Doble instancia con estado partido; "conecta tu wallet" con la wallet conectada | Cambiar versiones **en bloque** y entregar todos los archivos juntos. Regla ya escrita en README §6.4 y §21.1. |
| Tocar `gridbot/estilos.js` para la portada | Alta | Ese archivo pinta **toda** la app web | La portada debe llevar CSS propio, con prefijo propio, en un módulo nuevo. |
| Borrar `styles.css` por "ser de la lotería" | Media | La app pierde `--gold` y las tipografías | **No borrar.** Ver D7. |
| Reemplazo global sobre archivos grandes | Media | Ya destruyó funciones dos veces en `niveles.js` | Edición bloque a bloque + verificación. README §22.1. |
| Tocar `calor()`, `ESCALONES` o `suave()` en `liquidity.js` | — | Prohibición explícita del owner | **Congelado.** |
| Cambiar el orden de arranque de `arrancar()` | Media | Vuelve el doble pintado y el parpadeo (bandera `_arrancando`) | No reordenar. |
| Modificar el gancho móvil síncrono en `gridbot-ui.js:34-42` | Media | Vuelve el destello de la web antes de montar la cáscara | Es síncrono a propósito. |
| Añadir dependencias pesadas a la portada | Media | Mata el arranque en gama media y conexiones lentas (público objetivo real) | Presupuesto de peso explícito. Ver plan. |
| Que la portada bloquee la auto-conexión móvil sin ruta de salida | **Alta si se hace mal** | Usuarios existentes atrapados en la portada | La portada debe **saltarse sola** si ya hay sesión. Ver plan. |
| Desplegar contratos sin los `.sol` | — | Imposible hoy | Recuperar el código fuente es prioritario. |

---

## 16. CRITICIDAD POR COMPONENTE

**CRÍTICO** — `index.html` · `gridbot-ui.js` · `gridbot.js` · `wallet.js` · `tokens.js` · `gridbot/{estilos,config,util,estado,swap}.js` · `orden.js` · `movil/{movil,estilos}.js` · **keeper** · `sw.js` · `styles.css` (por sus tokens `:root`)

**IMPORTANTE** — `liquidity.js` · `niveles.js` + `niveles/*` · `muros.js` · `market.js` + `market/*` · `perfil.js` · `tools.js` · `academy.js` · `idioma.js` · `movil/{inicio,markets,operar,activos,fmt,iconos,picker}.js` · `admin.js` · `grafica.js` · `avisos.js`

**SECUNDARIO** — `prizepool.js` · `asistente/*` · `news.js` · `extras.js` · `tutorial.js` · `gestos.js` · `movil/{nfts,menu,buscar,alerta}.js` · `academy-ruta.js`

**EXPERIMENTAL / MUERTO** — `movil/{liquidity,muros,niveles,config}.js` · `orden.js` (raíz) · `SERVICIOS_PAGO` vacío · `INVENTARIO.md` · 8 imágenes huérfanas · `Favicon.webp`

---

## 17. RESPUESTAS DIRECTAS A LAS PREGUNTAS DE FASE 1

**¿Qué es este proyecto?** Una plataforma no custodial de bots de trading y análisis técnico sobre BNB Smart Chain, construida como SPA de JS vanilla sin backend, con contratos propios actualizables y un keeper en Cloudflare que ejecuta las órdenes.

**¿Cuál es su objetivo?** Que alguien sin conocimientos de trading opere en automático desde su propia wallet, sin KYC ni cuenta en un exchange. Modelo de ingresos: suscripción mensual (~1 USD), comisión del swap, comisión del marketplace, y suscripciones Pro y Academy.

**¿Cómo funciona?** El usuario conecta su wallet, aprueba un allowance por monto exacto, deposita gas, crea el bot on-chain, y el keeper vigila el precio y dispara las operaciones.

**¿Cómo se conecta la wallet?** EIP-6963 → `window.ethereum` → WalletConnect v2 con ventana propia, más deep links y reapertura dentro del navegador de la wallet. Reconexión silenciosa vía `eth_accounts`, respetando la bandera de desconexión manual.

**¿Qué ocurre después de conectar?** `render()` repinta con el creador de bots y las tarjetas de bots activos; se registra la cuenta en el keeper (`/registrar`); se comprueban suscripción, gas y cupo (8 bots, 2 por tipo).

**¿Qué contratos usa?** GridBot (proxy), AurexSwap (directo), AurexMarket (UUPS), AurexPrizePool (UUPS), Academy (proxy). CriptoCubaPro pendiente de desplegar.

**¿Qué servicios usa?** Keeper (Cloudflare), RPC de BSC, Binance, CoinGecko, Trust Wallet assets, Nominatim, flagcdn, CashbackForex.

**¿Qué es on-chain / off-chain?** Ver §2.4.

**¿Qué es Web y qué es Mobile?** Web: `index.html` + `gridbot-ui.js` en `#colmena-app`. Mobile: cáscara `#mv-app` montada encima cuando el ancho ≤ 760 px, reutilizando la lógica on-chain de la web.

**¿Qué depende de Cloudflare?** Solo la ejecución automática de bots y órdenes (§9.4). Todo lo demás es independiente.

**¿Qué funciona actualmente?** §10 — 22 funcionalidades.

**¿Qué está incompleto?** §11 — bloqueantes de negocio, ~770 KB de código muerto, 8 puntos de deuda técnica, y la ausencia de portada.

---

## 18. DIAGNÓSTICO FASE 2

**FUNCIONA:** los 22 puntos de §10.

**INCOMPLETO:** portada · cobro Pro (`PRO`/`OWNER` vacíos) · historial de operaciones · marcador on-chain de órdenes limit · 3 bots planeados · Fases 1-5 de móvil · detector de ciclos.

**PROBLEMÁTICO:** keeper bloqueado por plan gratuito · doble instancia de `orden.js` (D1) · doble carga de `ethers` (D2) · `tokens.js` sin versionar (D3) · SEO al dominio viejo (D4) · `.sol` ausentes.

**RIESGOSO:** wallet del owner sin respaldo · cuenta de GitHub sin CI (push = despliegue) · `localStorage` como fuente de verdad para distinguir órdenes de bots · `AurexMarket` en el límite de 24 KB · errores móviles silenciados.

**FUTURO:** multicadena · marketplace NFT · rebalanceo/trailing/señales · lotería pari-mutuel · noticias por moneda en el asistente.

---

*Fin del PROJECT TRUTH MAP. Ningún archivo del repositorio fue modificado durante esta auditoría.*
