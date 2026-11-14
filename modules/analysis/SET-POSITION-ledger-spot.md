# Set Position en Análisis + ledger compartido con Spot

> Documentación de la función de operar a mercado desde el área de análisis y de
> cómo esas posiciones quedan registradas en Spot. Vale para los 8 servicios de
> análisis que interactúan con contrato. El único excluido es **Trading Demo**.

## En una frase

Clic derecho sobre cualquier gráfica de análisis abre un menú con **Set Position**
y **Alerta**. Set Position abre una ficha vertical estilo Spot que opera **a
mercado** (sin órdenes limit, sin Cloudflare). Al ejecutar, la posición se guarda
en el **mismo almacén que Spot** y aparece en **Spot › Positions** con su PnL en
vivo, además de pintarse como una línea limpia en la propia gráfica de análisis.

## Servicios donde está activo

Los 8 que interactúan con contrato, todos con exactamente la misma dinámica:

| Servicio | Archivo | Tipo de gráfica |
|---|---|---|
| Liquidity Pools | `assets/js/liquidity.js` | canvas |
| Heat Pools | `assets/js/muros.js` | canvas |
| Smart Pools | `assets/js/niveles/render.js` | canvas |
| VWAP Pro | `modules/institutional/institutional.js` | lightweight-charts + overlay |
| Reaction Zones | `modules/reaction/reaction.js` | canvas |
| Multichart | `modules/multichart/multichart.js` | lightweight-charts, varios paneles |
| Footprint Pro | `modules/footprint/footprint.js` | motor de render propio |
| Prediction | `modules/superscalper/superscalper.js` | canvas |

**Trading Demo queda fuera a propósito**: no interactúa con contrato.

## La ficha (a mercado)

- **Título**: `Short` si das clic por encima del precio, `Long` si das clic por
  debajo. Debajo, `MONEDA · market`. No dice "order" ni "limit" porque es a
  mercado.
- **Lado Long / Short**: dos píldoras estilo Spot. Cambiar de lado reabre la ficha
  para el otro lado y relee el saldo correspondiente.
- **Disponible (arriba a la derecha, grande y en verde)**: lo que tienes para
  operar. En **Short** es la cantidad de **la moneda de la gráfica** (la que vas a
  vender). En **Long** es tu **USDT** (con el que vas a comprar). Sustituye al
  antiguo porcentaje de profit/discount, que no tenía sentido en una orden a
  mercado.
- **Nota de mercado**: "Opens now at ≈ PRECIO". Ese precio se **refresca en vivo**
  cada segundo desde la gráfica, así que siempre coincide con el precio real y no
  se queda congelado al abrir la ficha.
- **Amount**: en la unidad del lado (moneda en short, USDT en long), con barra y
  25/50/75/Max calculados sobre el disponible.
- **Botón**: `Sell at market` / `Buy at market`.

Todo el texto visible va en inglés.

## Qué pasa al ejecutar

1. Se calcula el valor en USDT de la operación (long: el USDT escrito; short:
   cantidad de moneda por el precio de mercado).
2. Se registra la posición en el ledger de Spot con `motor.abrirMercado(...)`.
3. Se dispara una **notificación** (sonido + aviso del sistema si hay permiso +
   toast visible).
4. Se repinta la gráfica para que aparezca la línea de la posición.

No usa rejilla, ni keeper, ni Cloudflare. La ejecución real on-chain se conectará
con el contrato de spot que se creará más adelante. Por ahora la posición es un
registro y una visualización.

## El ledger compartido

- Almacén único: `localStorage` bajo la clave **`sp-spot-v1`**, propiedad del motor
  de Spot (`modules/spot/motor.js`).
- `orden.js` importa ese mismo motor (misma URL `?v`) para compartir instancia.
- Spot lee ese almacén en su pestaña **Positions** y muestra cada posición con su
  **PnL y porcentaje en vivo** (long en USDT, short en la moneda). No hubo que
  tocar el motor de Spot: ya tenía `abrirMercado`, `pnlDe` y `cerrar`.
- Una sola fuente de verdad: operes desde Liquidity Pools, Reaction Zones o
  cualquier otro, la posición termina en el mismo sitio y Spot la ve sola.

## La posición en la gráfica de análisis

- Se dibuja una **línea limpia** en el precio de entrada, con etiqueta `LONG`/`SHORT`
  y el precio. Verde para long, roja para short.
- Tiene una **X**. La X **solo oculta la visualización** en esa gráfica (se guarda
  en `localStorage` bajo `cco-pos-ocultas`). **No vende ni cierra la posición**:
  esa sigue viva en Spot › Positions. El cierre real se hace desde Spot.

## Arquitectura técnica (orden.js)

`assets/js/orden.js` es el núcleo compartido. Cada servicio lo cablea con:

- `conectar(cfg)`: engancha el clic derecho (menú Set Position / Alerta) a la
  gráfica. `cfg` expone `precioEn(y)`, `precioActual()`, `par()`, `simbolo()` y
  `repintar()`.
- `pintar(g, opciones)`: dibuja órdenes, alertas y posiciones sobre el canvas.
  Filtra las posiciones por símbolo. (Se corrigió un `return` temprano que impedía
  pintar la posición cuando no había órdenes.)
- `clicCancelar(canvas, dameZonas, repintar)`: gestiona los clics sobre la X (ocultar
  posición) y sobre cancelar de órdenes/alertas.

Casos particulares del cableado:

- **Multichart**: varios paneles. Se cablea `conectar` por panel sobre `pane.body`
  y se dibuja en el loop `dibujarUX` usando `geoDibPane(pane)`.
- **Footprint Pro**: motor de render propio. Se le añadió una geo de solo lectura
  (`geo()`) y un hook `dibujarOverlay` en su capa FX; el clic derecho se cablea
  sobre el host estable `#fp-cv`.

## Archivos tocados y cascada de versiones

`orden.js` quedó en `?v=132`, propagado a los 8 servicios. Cada servicio subió su
`?v` en `analisis.js`, y `analisis.js` subió en `analisis.html` (`?v=109`). Los
módulos de render encadenados (`niveles/render.js`, `footprint/render.js`) subieron
en sus importadores.

> Nota de caché: la entrega sigue la ruta de `analisis.js` (la sección de análisis).
> Los cargadores alternos antiguos (portada, modulo) usan versiones viejas aparte y
> no se tocaron para no romper rutas sin verificar.

## Pendiente (Fase 2)

Una sección de **disparador descentralizado**: una red de bots públicos que ejecutan
take profit, stop loss y órdenes limit cuando el precio llega al punto exacto, a
cambio de una recompensa que **no** sale del operador, y **sin Cloudflare ni LINK**.
Trading Demo ya dispara entradas y salidas sin Cloudflare, así que el punto de
partida de la investigación es cómo lo resuelve ahí. Queda para la segunda fase.
