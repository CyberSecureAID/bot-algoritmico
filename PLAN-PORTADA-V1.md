# PLAN DE LA NUEVA PORTADA — CriptoCuba Oficial

> **Diseño primero, implementación después.** Este documento no contiene código.
> Es el plan que hay que aprobar antes de escribir una sola línea.
> Complemento de `PROJECT-TRUTH-MAP.md` y `DO-NOT-BREAK-MAP.md`.
>
> **Nada de lo que se propone aquí modifica la aplicación funcional existente.**

---

## A. DIAGNÓSTICO ACTUAL

### Escritorio
`gridbot-ui.js :: render()` bifurca. Sin wallet conectada, el visitante ve:

```
[header con 8 destinos: Swap · Academy · Tools · Liquidity · Prize · Market · Install · Conectar]
        ┌──────────────────────────────────────┐
        │  Cripto Cuba Oficial                 │  h2
        │  Bots que compran barato y venden    │  un párrafo
        │  caro por ti, en tu propia wallet.   │
        │  Sin custodia y sin KYC.             │
        │        [ Conectar wallet ]           │  un botón
        └──────────────────────────────────────┘
[FAQ desplegable de 29 preguntas]
```

Una caja de 440 px centrada sobre fondo negro. **Eso es la portada de hoy.**

### Móvil
Peor: `montarMovil()` monta la cáscara y **`autoConectarMovil()` dispara `wallet.conectar()` automáticamente**. El visitante recibe el pop-up de su wallet **antes de leer una sola frase** sobre qué es esto.

### El problema real, en una línea
> **El producto es de primer nivel y la puerta parece un prototipo.**

Todo lo sofisticado que existe de verdad —arquitectura no custodial, permisos por monto exacto revocables, contratos actualizables verificables en BscScan, motor de análisis propio, ejecución automática, marketplace P2P con disputas— **es invisible hasta después de conectar la wallet**. Se le está pidiendo al visitante que dé el paso de mayor desconfianza del mundo cripto (conectar su wallet) **a cambio de nada**.

### Qué dice el estándar del sector en 2026
La investigación de referencias confirma el diagnóstico: <cite index="6-1">el visitante de una landing cripto llega desconfiado, y su primera pregunta no es qué hace el producto sino si le va a quitar el dinero; hay que decir qué es en una sola frase por encima del pliegue —el mecanismo, no la visión— y quien no consigue clasificar el producto en cinco segundos, se va</cite>. Sobre el momento de pedir la wallet: <cite index="8-1">solo se debería exigir la conexión cuando el usuario necesita comprar, vender, listar o gestionar activos; siempre que sea posible, hay que dejarle explorar el producto antes de pedirle acceso a la wallet</cite>. Y sobre la estética: <cite index="1-1">el minimalismo, la tipografía limpia y el movimiento contenido reducen la ansiedad y refuerzan la sensación de control, algo esencial cuando un error no se puede deshacer</cite>.

---

## B. QUÉ FALTA

| # | Falta | Por qué importa |
|---|---|---|
| 1 | Una respuesta de 5 segundos a *"¿qué es esto?"* | Sin ella, el visitante se va antes de entender. |
| 2 | Una razón para confiar **antes** de conectar | Es el punto de fricción máximo del sector. |
| 3 | Prueba visible de la arquitectura no custodial | Hoy se afirma en una frase, sin demostrarla. |
| 4 | Muestra del producto sin necesidad de wallet | Hoy no se ve nada hasta conectar. |
| 5 | Prueba verificable (direcciones de contrato enlazadas a BscScan) | Convierte "confía en mí" en "compruébalo tú". |
| 6 | Jerarquía de navegación | El header tiene 8 destinos al mismo peso: no hay jerarquía. |
| 7 | Un umbral móvil antes de la auto-conexión | Hoy el pop-up de wallet llega antes que el mensaje. |
| 8 | Una transición de entrada que se sienta premium | Hoy el paso es un repintado en seco. |

---

## C. OBJETIVO VISUAL

**Referencia conceptual:** infraestructura financiera + Web3 premium. No startup, no casino, no exchange de retail chillón.

**Cinco principios, en orden de prioridad:**

1. **Densidad controlada.** Un producto financiero serio no es una página con tres iconos y mucho aire. Hay datos, hay estructura, hay tablas. Pero cada elemento está donde tiene que estar.
2. **El oro es acento, no fondo.** `#E8B84B` marca lo importante: una cifra, un borde, un CTA. Si el oro está en todas partes, deja de significar nada.
3. **Superficies, no decoración.** La profundidad se consigue con capas de gris muy oscuro, bordes de 1 px y sombras largas y suaves. Sin partículas, sin blobs, sin degradados arcoíris.
4. **La tipografía hace el trabajo.** Chakra Petch para titulares (ya es la voz de la marca), Plus Jakarta Sans para lectura, IBM Plex Mono para **todo lo que sea un número, una dirección o un dato de mercado**. El monoespaciado es lo que hace que un producto parezca financiero.
5. **Honestidad radical como estética.** El "puedes revocar el permiso cuando quieras" y el "esto no garantiza ganancias" **son argumentos de venta**, no letra pequeña. Puestos con la misma tipografía y peso que el resto, comunican más seriedad que cualquier badge inventado.

### Lo que queda prohibido
Colores fuera de la paleta · estética de casino · emojis decorativos (los que ya existen en la app se quedan; en la portada, ninguno) · gráficos de stock · parallax exagerado · partículas · contadores de "usuarios" o "volumen" inventados · cualquier promesa de rentabilidad · badges de auditoría que no existen.

---

## D. PALETA Y TOKENS — SE REUTILIZA LO QUE HAY

**No se inventa ningún color.** Todo sale del sistema existente, verificado en el repo:

| Token | Valor | Origen |
|---|---|---|
| Fondo base | `#0b0e11` | `index.html`, `manifest`, `movil/estilos.js` |
| Superficie 1 | `#12161c` | `gridbot/estilos.js` (`--panel-2`) |
| Superficie 2 | `#1b2027` | `gridbot/estilos.js` (`--panel`) |
| Superficie 3 (móvil) | `#151b23` / `#1b222c` | `movil/estilos.js` |
| Línea | `#2b3139` / `#232b36` | ambos |
| Texto principal | `#eaecef` | ambos |
| Texto secundario | `#b7bdc6` | `gridbot/estilos.js` |
| Texto terciario | `#7d8794` / `#8b96a3` | ambos |
| **Oro de marca** | **`#E8B84B`** | `styles.css :root --gold` |
| Oro suave / borde | `#C9A84B` | `--gold-soft` |
| Set 3D del oro | `#f7db8d` → `#E8B84B` → `#c79426` → `#8f6a1a` → `#3a2800` | `gridbot/estilos.js` |
| Verde (alza) | `#12d18e` / `#2ebd85` | ambos |
| Rojo (baja) | `#f6465d` | ambos |
| Display | Chakra Petch 600/700/800 | `styles.css --display` |
| Texto | Plus Jakarta Sans 400-800 | `--sans` |
| Mono | IBM Plex Mono 400/500/600 | `--mono` |
| Radio | 14 px base, 18-20 px en tarjetas grandes | existente |

**Continuidad garantizada:** el usuario que pase de la portada al exchange **no notará el cambio**, porque son literalmente los mismos colores, las mismas tipografías y los mismos botones dorados con relieve 3D (`box-shadow: 0 4px 0 #8f6a1a`) que ya usa toda la app.

---

## E. ARQUITECTURA DE LA LANDING — ESCRITORIO

Ocho secciones. Cada una responde a una objeción concreta del visitante.

---

### E.0 — HEADER (reutiliza el existente, no lo sustituye)
**Objeción que resuelve:** *"¿dónde estoy?"*

El header actual (`headerHTML()`) ya funciona y se queda **tal cual**. La portada solo lo complementa con anclas suaves de scroll (Producto · Seguridad · Infraestructura · Mercados). En cuanto hay wallet conectada, el header vuelve a su comportamiento de siempre.

---

### E.1 — HERO
**Objeción:** *"¿qué es esto y en cinco segundos?"*

- **Titular (Chakra Petch, 56-64 px):** una frase de mecanismo, no de visión. Dirección: *"Automatiza tu trading sin entregar tus fondos a nadie."*
- **Subtítulo (Jakarta, 18 px, máx. 2 líneas):** qué hace, sobre qué red, y qué no pide. Sin KYC, sin cuenta, en BNB Smart Chain.
- **Fila de credenciales técnicas en monoespaciado**, no como badges de marketing:
  `BNB Smart Chain · Chain ID 56` — `PancakeSwap V3` — `Contratos verificables en BscScan` — `Sin custodia`
- **CTA primario:** `Entrar al exchange`.
  **CTA secundario, en texto:** `Ver cómo funciona ↓`.
  **Uno solo manda.** <cite index="6-1">Una acción por página: tres botones iguales producen un tercio de las conversiones que uno solo</cite>.
- **Elemento visual:** una **maqueta estática y fiel** del panel de un bot (rango, cuadrículas, precio, ganancia por vuelta) con datos de ejemplo **etiquetados como ejemplo**. Se dibuja con el mismo CSS de las tarjetas reales. Cero imágenes pesadas.

> ⚠️ **Regla de honestidad:** el hero **no** dirá "ejecuta 24/7 sin fallos" mientras el keeper siga bloqueado por el plan gratuito de Cloudflare. Se describe la arquitectura ("un servicio automático vigila el precio y ejecuta por ti"), no un nivel de servicio que hoy no se puede sostener.

---

### E.2 — LA PROMESA NO CUSTODIAL (va segunda, no al final)
**Objeción:** *"¿me vais a quitar el dinero?"* — la pregunta número uno del sector. Se responde **antes** que cualquier otra cosa.

Tres columnas, cada una con una afirmación **demostrable**:

| | Afirmación | Prueba real |
|---|---|---|
| 1 | **Tu dinero no se mueve de tu wallet.** | Los contratos operan por *allowance*, no por custodia. El capital nunca cambia de dueño. |
| 2 | **El permiso es por monto exacto, nunca infinito.** | Verificado en el código: es una decisión de diseño del proyecto, no una promesa. |
| 3 | **Puedes revocarlo cuando quieras, y está aquí.** | Enlace directo a la sección de permisos del perfil. La revocación **existe y funciona**. |

Debajo, un diagrama de **una sola línea**, en monoespaciado, sin animación:

```
TU WALLET ──permiso por monto exacto──▶ CONTRATO ──swap──▶ PANCAKESWAP V3
     ▲                                                              │
     └──────────────── el resultado vuelve a tu wallet ─────────────┘
```

Y una línea final que casi nadie se atreve a escribir, y que aquí es un activo:
*"Lo único que dejas depositado es un pequeño tanque de BNB para el gas. Es tuyo y lo retiras cuando quieras."*

---

### E.3 — PRODUCTO: LAS CUATRO ESTRATEGIAS
**Objeción:** *"¿qué hace exactamente por mí?"*

Cuatro tarjetas con las imágenes que **ya existen** en el repo (`bot-grid.webp`, `bot-acumulador.webp`, `bot-cashout.webp`, `bot-dca.webp`), y para cada una: qué hace · cuándo gana · **y qué puede salir mal**.

Los textos **ya están escritos** en `gridbot/config.js` (`BOTMETA`, `CONF_BOTS`) y son excelentes: honestos, sin adornos, en lenguaje llano. **Se reutilizan, no se reescriben.**

Incluir la tercera columna ("qué puede salir mal") es lo que separa esto de una landing de casino. Es un diferenciador de confianza, no una debilidad.

---

### E.4 — INFRAESTRUCTURA
**Objeción:** *"¿hay ingeniería de verdad detrás o son cuatro páginas?"*

Cuatro bloques, cada uno con un hecho verificable del sistema:

1. **Arquitectura actualizable.** Contratos tras proxy: la lógica puede mejorar sin que el usuario migre, sin cambiar de dirección y sin perder ningún bot. *(Explicado en llano, con el diagrama proxy→implementación.)*
2. **Ejecución automática.** Un servicio vigila los precios y dispara las operaciones; antes de enviar cualquier transacción hace un ensayo en seco para no gastar gas en intentos que van a fallar. *(Detalle real del keeper, y es un detalle que impresiona a quien entiende.)*
3. **Análisis propio, no indicadores de catálogo.** Smart Levels, Lógica Estructural Avanzada y Liquidity Pools, calculados en el navegador sobre velas reales de Binance.
4. **Todo on-chain, sin base de datos.** No hay servidor con tus datos porque no hay servidor. Lo que ves sale del contrato.

**Regla estricta:** cada bloque debe corresponder a algo que **existe hoy en el código**. Nada de "próximamente" disfrazado de presente.

---

### E.5 — MERCADOS Y ACTIVOS
**Objeción:** *"¿puedo operar lo que me interesa?"*

Tabla en monoespaciado, densa, tipo terminal. Los datos son reales y ya están en el repo:

- **Quote:** USDT, USDC (`gridbot/config.js :: QUOTES`)
- **Base:** los 26 activos de `BASES` — BNB, BTCB, ETH, SOL, XRP, ADA, DOT, LTC, AVAX, MATIC, ATOM, NEAR, FIL, BCH, ETC, EOS, LINK, CAKE, UNI, AAVE, XVS, INJ, TWT, DOGE, SHIB, FLOKI.
- **Análisis:** el catálogo de pares de `niveles/config.js`.

**Sin precios en vivo en el primer pintado.** Los precios se cargan de forma diferida cuando la sección entra en viewport (`IntersectionObserver`), reutilizando la caché de CoinGecko que la app ya tiene. Si la API falla, la tabla se ve igual, sin precio, sin errores en pantalla.

**Prohibido:** volumen, TVL, número de usuarios, liquidez agregada. **No tenemos esos datos y no se inventan.**

---

### E.6 — CONFIANZA VERIFICABLE
**Objeción:** *"demuéstramelo."*

Esta es la sección que ningún competidor pequeño se atreve a poner, y aquí es gratis porque **los datos existen**:

- **Las direcciones de los contratos, enlazadas a BscScan.** GridBot, AurexMarket, AurexSwap, AurexPrizePool, Academy. Que el visitante las mire él mismo.
- **Coste real, sin letra pequeña:** suscripción de aproximadamente 1 USD al mes, **cero comisión por operación** (se eliminó on-chain), más el gas de la red, que es de céntimos y va al tanque del bot. Todo verificable en `perfil.js` y en el contrato.
- **Qué NO hacemos:** no custodiamos fondos · no pedimos KYC · no tenemos tu clave · no podemos mover tu dinero fuera del permiso que diste.
- **Aviso de riesgo, con el mismo peso visual que el resto:** el trading tiene riesgo, ningún bot garantiza ganancias, invierte solo lo que puedas permitirte perder. *(Este texto ya existe en la FAQ. Subirlo a la portada es una decisión de producto correcta y protege legalmente.)*

**No incluir:** badges de auditoría (no hay auditoría formal), logos de partners (no hay), certificaciones (no hay), testimonios (no hay). Poner cualquiera de esas cosas destruiría toda la credibilidad ganada en esta sección.

---

### E.7 — CTA FINAL + FAQ
- CTA final grande: `Entrar al exchange`.
- **La FAQ existente se reutiliza tal cual.** Sus 29 preguntas son de calidad y ya tienen buscador con resaltado. No se toca `wireFaq()`; solo se le da mejor marco visual.
- Pie: identidad, red, Telegram de soporte, aviso de riesgo.

---

## F. EXPERIENCIA MÓVIL — APP-LIKE, NO ESCRITORIO ESTRECHADO

**Restricción de partida:** la app móvil ya existe, funciona y tiene 15 bugs históricos resueltos documentados. **No se reconstruye.** La portada se le añade *delante*, y desaparece limpiamente.

### F.1 El cambio clave: aplazar la auto-conexión, no eliminarla

Hoy: `montarMovil()` → `autoConectarMovil()` → pop-up de wallet inmediato.

Propuesta:

```
LLEGADA
   │
   ├─ ¿Hay sesión previa? (reconexión silenciosa, sin pop-up)
   │     SÍ ──▶ salta la portada, va directo a la app (comportamiento de hoy, intacto)
   │
   └─ NO ──▶ PORTADA MÓVIL (pantalla completa, sin scroll horizontal)
                 │
                 └─ el usuario toca "Entrar" ──▶ AHORA sí, wallet.conectar()
```

**Nadie pierde nada:** el usuario recurrente no ve la portada ni una vez. El visitante nuevo ve un producto antes de que le pidan permiso. Y la auto-conexión, que es una de las mejores cosas del producto, **se conserva íntegra**.

### F.2 Estructura de la portada móvil

No es la de escritorio comprimida. Es **una secuencia de pantallas verticales a altura completa**, con `dvh` (nunca `vh`: no cuenta la barra del navegador — lección ya aprendida en el repo) y respeto de `env(safe-area-inset-*)`.

1. **Pantalla 1 — Marca + promesa.** Logo, titular de dos líneas, el par credencial en monoespaciado, y un indicador de deslizar. `Entrar` fijo abajo, por encima de la safe area.
2. **Pantalla 2 — No custodial.** Las tres pruebas, apiladas, con el diagrama de una línea.
3. **Pantalla 3 — Las cuatro estrategias.** Carrusel horizontal con *scroll snap* nativo. Cero librerías.
4. **Pantalla 4 — Mercados.** Lista compacta con logos, reutilizando `logoDe()` de `movil/fmt.js` (que ya resuelve el problema de CoinGecko bloqueado dentro de las wallets).
5. **Pantalla 5 — Verificable + CTA.** Direcciones, coste real, aviso de riesgo, `Entrar al exchange`.

### F.3 Patrones app-like a aplicar (y a extender al resto de la app móvil)

| Patrón | Estado hoy | Propuesta |
|---|---|---|
| Barra inferior fija | ✅ Existe (`#mv-nav`) | Sin cambios |
| Safe areas | ✅ Existe | Aplicarlo también en la portada |
| Hojas emergentes | ✅ Existe (`#mv-sheet`) | Reutilizar el mismo componente |
| Gestos (swipe, pull-to-refresh) | ✅ Existe (`gestos.js`) | Reutilizar para el carrusel |
| **Transición entre pestañas** | ❌ Repintado en seco | Fundido de 180 ms con `prefers-reduced-motion` respetado |
| **Skeleton de carga** | ❌ | Esqueletos en balance, mercados y libro, en vez de "—" |
| **Botón atrás del sistema** | ❌ **Sale del sitio** | `history.pushState` por pestaña y overlay: el atrás navega *dentro* de la app. **Este es el arreglo que más "app nativa" hace sentir el producto.** |
| **Transición de entrada** | ❌ | La portada se desvanece hacia arriba mientras la cáscara aparece: 220 ms, una sola vez, sensación de "abrir la app" |
| Haptics | ❌ | `navigator.vibrate(8)` en confirmaciones, si existe la API |

---

## G. INTEGRACIÓN CON LA APLICACIÓN EXISTENTE

**La decisión arquitectónica más importante de todo este plan:**

> La portada es un **módulo nuevo e independiente**, con estilos propios y prefijo propio.
> **No se añade ni una línea a `gridbot-ui.js` fuera de un único punto de enganche, ni una línea a `gridbot/estilos.js`.**

Esto cumple la regla R1 del README §27 ("función nueva = módulo nuevo, no engordar `gridbot-ui.js`") y hace el cambio **trivialmente reversible**: si algo va mal, se quita el enganche y todo vuelve exactamente a como estaba.

### Punto de enganche en escritorio
Un único punto: la rama `if (!cuenta)` de `render()`. Hoy pinta `.conectar-box`. Pasaría a montar la portada. **La rama con wallet conectada no se toca en absoluto.**

### Punto de enganche en móvil
Un único punto: `autoConectarMovil()` en `movil/movil.js`. Pasa de conectar siempre a conectar **solo si ya había sesión**; si no, muestra la portada y conecta al pulsar `Entrar`.

### Flujo conceptual completo

```
PORTADA ──▶ [Entrar al exchange] ──▶ conectar wallet ──▶ EXCHANGE
                                            │
                                            └─ ¿red incorrecta? ──▶ aviso existente
```

El usuario recurrente **no ve la portada nunca**: la reconexión silenciosa lo lleva directo, igual que hoy.

---

## H. ELEMENTOS REUTILIZABLES (no se duplica nada)

| Se reutiliza | De dónde | Por qué |
|---|---|---|
| Paleta y tipografías | `styles.css :root` + `gridbot/estilos.js` | Continuidad visual literal |
| Botón dorado con relieve 3D | `gridbot/estilos.js` | Ya es la firma de la marca |
| Header completo | `headerHTML()` + `wireHeader()` | Funciona; no hay motivo para tocarlo |
| FAQ con buscador | `footerHTML()` + `wireFaq()` | 29 preguntas de calidad ya escritas |
| Textos de los bots | `gridbot/config.js :: BOTMETA`, `CONF_BOTS` | Honestos y bien redactados |
| Imágenes de los bots | `assets/img/bot-*.webp` | Ya existen y ya están optimizadas |
| Logo y marca | `cco-logo.png`, `cco-full.webp`, `cco-movil.webp` | Identidad actual |
| Lista de activos | `gridbot/config.js :: BASES/QUOTES`, `niveles/config.js :: PARES` | Fuente única de verdad |
| Logos de monedas | `movil/fmt.js :: logoDe()` | Ya resuelve el bloqueo de CoinGecko dentro de wallets |
| Contadores animados | `extras.js :: data-contar` | **Ya existe y nunca se aplicó** (README §12) |
| Traducción | `idioma.js` | La portada debe ser traducible desde el día uno |
| Componente de hoja emergente | `movil/estilos.js :: #mv-sheet` | Consistencia móvil |

---

## I. ELEMENTOS NUEVOS (mínimos)

| Archivo nuevo | Contenido | Tamaño objetivo |
|---|---|---|
| `assets/js/portada.js` | Estructura, secciones, `IntersectionObserver`, transición de entrada | < 800 líneas (regla R2) |
| `assets/js/portada/estilos.js` | CSS con scope `#cco-portada` | < 800 líneas |
| `assets/js/portada/contenido.js` | Todos los textos, en un solo sitio, para traducir y editar sin tocar la lógica | < 300 líneas |
| `assets/js/portada/movil.js` | Secuencia de pantallas móvil | < 500 líneas |

**Total estimado: 4 archivos nuevos, ninguna dependencia externa, ninguna imagen nueva.**

**Presupuesto de peso: < 60 KB sin comprimir, 0 KB de librerías.** La portada debe pintar sin esperar a `ethers` ni a ningún módulo pesado.

---

## J. RIESGOS DE ESTE TRABAJO Y CÓMO SE MITIGAN

| Riesgo | Mitigación |
|---|---|
| Romper el arranque de `gridbot-ui.js` | Un solo punto de enganche, dentro de la rama que hoy solo pinta una caja. La rama con wallet no se toca. |
| Que el CSS de la portada se filtre a la app | Todo con scope `#cco-portada`. Cero selectores globales. Cero `!important`. |
| Que el usuario recurrente quede atrapado en la portada | La portada solo aparece si la reconexión silenciosa no encontró sesión. Verificar explícitamente en dispositivo real. |
| Descuadre de versiones `?v=` | Los archivos nuevos entran en `?v=1`. **No se toca la versión de ningún archivo existente.** Evita de raíz el bug de doble instancia. |
| Añadir peso al arranque móvil | Sin librerías, sin imágenes nuevas, precios diferidos por viewport, animaciones solo con `transform` y `opacity`. |
| Que el service worker sirva la versión vieja | Al entregar hay que subir `VERSION` en `sw.js` y añadir los archivos nuevos a la lista `APP`. **Regla ya escrita en el repo.** |
| Prometer algo que el keeper no puede cumplir | Se describe la arquitectura, no un SLA. Nada de "24/7 garantizado" hasta que Cloudflare esté resuelto. |
| Inventar datos para rellenar | Ninguna cifra de usuarios, volumen, TVL ni liquidez. Solo lo verificable. |
| Que la portada perjudique el SEO | Contenido real en HTML desde el primer pintado (no inyectado tras un fetch). Y **arreglar `robots.txt` y `sitemap.xml`**, que hoy apuntan al dominio antiguo. |

---

## K. QUÉ NO SE TOCA — LISTA CERRADA

- ❌ El mapa de calor de `liquidity.js` (congelado por decisión del owner)
- ❌ `wallet.js` — ni una línea
- ❌ `gridbot.js` — ni una línea
- ❌ `orden.js` — ni una línea *(su deuda de versiones se arregla en un ticket propio, aparte)*
- ❌ `gridbot/estilos.js` — ni una línea
- ❌ Las direcciones de contratos
- ❌ `niveles/*`, `muros.js`, `market/*`, `academy.js`, `perfil.js`, `prizepool.js`, `admin.js`
- ❌ La rama de `render()` con wallet conectada
- ❌ El bloque síncrono anti-parpadeo de `gridbot-ui.js:34-42`
- ❌ La bandera `_arrancando`
- ❌ Las 4 pantallas de la app móvil
- ❌ `styles.css` *(por sus tokens `:root` — ver DO-NOT-BREAK-MAP §7)*
- ❌ Cualquier archivo huérfano *(no se borra nada hasta que el owner confirme)*
- ❌ Los `?v=` de los archivos existentes

**Se toca, y solo esto:**
- ✏️ `gridbot-ui.js` → la rama `if (!cuenta)` de `render()`, y solo esa rama
- ✏️ `movil/movil.js` → `autoConectarMovil()`, para aplazar la conexión
- ✏️ `index.html` + `sw.js` → registrar los archivos nuevos y subir `VERSION`
- ➕ 4 archivos nuevos

---

## ROADMAP RECOMENDADO

| # | Fase | Qué incluye | Riesgo | Depende de |
|---|---|---|---|---|
| **0** | **Validación del plan** | Que el owner apruebe este documento, el titular del hero y qué se enseña en "Confianza" | Nulo | — |
| **1** | Maqueta estática de la portada de escritorio | HTML+CSS aislado, sin enganchar a la app. Se revisa y se itera **sin tocar nada** | **Nulo** | Fase 0 |
| **2** | Maqueta de la portada móvil | Ídem, verificada a 320 / 360 / 390 px | **Nulo** | Fase 1 |
| **3** | Integración de escritorio | Un solo punto de enganche en `render()` | Bajo | Fase 1 |
| **4** | Integración móvil | Aplazar `autoConectarMovil()` + transición de entrada | **Medio** — verificar en teléfono real | Fases 2-3 |
| **5** | Traducción de la portada | Añadir sus textos a `idioma.js` | Bajo | Fase 4 |
| **6** | Pulido app-like móvil | Historial (botón atrás), skeletons, transiciones entre pestañas | Medio | Fase 4 |
| **7** | Rendimiento y accesibilidad | Lighthouse, contraste, focus, `prefers-reduced-motion`, touch targets ≥ 44 px | Bajo | Fase 6 |
| **8** | Higiene técnica *(tickets independientes)* | Unificar `?v=` de `orden.js` y `ethers` · versionar `tokens.js` · arreglar `robots.txt`/`sitemap.xml` · sustituir `INVENTARIO.md` | Medio | Aislado |
| **9** | **Cloudflare / keeper** | Cron externo a `/run` (gratis, 15 min) → luego Workers Paid | Medio | Independiente, **puede ir en paralelo desde ya** |

**Las fases 1 y 2 no tocan el repositorio.** Se puede iterar el diseño todo lo que haga falta sin ningún riesgo para producción. Solo a partir de la fase 3 se modifica código existente, y siempre en un único punto reversible.

---

## DECISIONES QUE NECESITO DEL OWNER ANTES DE EMPEZAR

1. **Titular del hero.** ¿Qué frase de una línea define el producto? *(Propuesta: "Automatiza tu trading sin entregar tus fondos a nadie.")*
2. **Idioma de la portada.** El repo dice español base; el README.md §14 dice inglés por defecto. **Hay contradicción y esto la decide.**
3. **¿Se publican las direcciones de contrato en la portada?** Es el activo de confianza más fuerte que hay, pero es una decisión del owner.
4. **¿Se menciona el precio (≈1 USD/mes) en la portada?** Es una ventaja competitiva enorme frente al mercado. Recomiendo que sí.
5. **Los 4 módulos huérfanos de `movil/`** (275 KB): ¿trabajo en curso o para borrar? **No toco nada hasta que se confirme.**
6. **¿Se muestra el Prize Pool en la portada?** README-V4 lo da por desechado, pero el código lo tiene vivo y con botón en el header. Hay que resolver la contradicción.
