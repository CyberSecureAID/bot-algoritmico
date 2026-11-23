# Auditoría de la sesión — qué cambié y qué subir

Auditado con git (control de versiones del repo). Cambié **34 archivos**. Abajo,
por grupo, con su ruta exacta y qué hace. Lo que rompió las gráficas está primero.

---

## 1) LO QUE ROMPIÓ LAS GRÁFICAS — súbelo SÍ O SÍ

- **`assets/js/feed-shim.js`**
  El bug: ante cualquier hipo de `data-api.binance.vision` (un cierre de WebSocket,
  un error de red transitorio) saltaba a **Binance.US**. Binance.US no sirve desde
  fuera de EE. UU. (México), así que al saltar, todas las gráficas que cargaban
  datos después del salto se rompían ("no se cargan datos / checking connection"),
  y quedaba pegado toda la sesión.
  **Arreglado (v3):** solo salta a Binance.US ante un **451 real** (geobloqueo que
  en la práctica solo ve EE. UU.); un hipo ya no cambia de host; y si la sesión
  quedó mal marcada, **se auto cura** sola volviendo a `.vision`. Verificado con 3
  escenarios (fuera de US, auto cura, y EE. UU.).

**Cómo comprobar que tu despliegue funciona:** sube ese archivo, abre en el
navegador `https://decfreedom.com/assets/js/feed-shim.js`. Si arriba dice **v3**,
llegó. Si dice **v2**, tus subidas no están entrando (ese es el nudo de despliegue).

---

## 2) Barras superiores: añadido Spot entre Analysis y Futures, quitado Tools

- `modules/swap/swap.html`
- `modules/launchpad/launchpad.html`
- `modules/terminal/terminal.html`
- `modules/bots/bots.html`
- `modules/shield/shield.js`
- `modules/analysis/analisis.js`

> Nada de esto rompe. Tu `swap.html` EN VIVO sigue siendo el viejo (sin Spot): es
> que no se desplegó, no que esté mal.

## 3) Market Cap dentro de VWAP Pro (botón opcional)

- `modules/institutional/institutional.js` — botón "Market Cap" junto a Export; por
  defecto tu treemap, y si el usuario lo toca muestra el heatmap de TradingView.
- `modules/institutional/estilos.js` — estilos del botón/capa.
- `assets/js/tools.js` — además, achiqué la X y la "i" de la barra del widget.

## 4) Telegram oficial

- `assets/js/academy.js`, `assets/js/asistente/conocimiento.js` — enlaces a
  `t.me/DecFreedom`.

## 5) Dominio viejo → decfreedom.com (SEO, pies, enlaces de compartir, marca de agua)

- `index.html`, `portada.html`, `shield.html`, `modules/shield/shield.html`
- `modules/bots/bots-ui.js`, `modules/bots/idioma.js`, `modules/bots/extras.js`
- `modules/launchpad/idioma.js`, `modules/swap/idioma.js`, `assets/js/idioma.js`
- `assets/js/gridbot-ui.js`, `assets/js/movil/muros.js`, `assets/js/movil/activos.js`, `assets/js/movil/liquidity.js`
- `CNAME` — contiene solo `decfreedom.com` (va en la raíz).

## 6) Cascada de versiones (?v=) y shim en páginas de entrada

- `modules/analysis/analisis.html`, `app.html`, `futuros.html`, `movil.html`,
  `assets/portada/portada.js`
  (bumps de `?v=` para que el navegador baje lo nuevo; y el shim cargado como
  primer script en las páginas que faltaban).

## 7) Documentación (NO afecta al sitio, es para el repo)

- `PROBLEMAS-FRECUENTES.md`, `RESOLUCION-region-graficas.md`,
  `modules/analysis/AUDITORIA-bloqueo-analisis.md`, este `INVENTARIO-SESION.md`.

---

## Resumen

- **Para arreglar la rotura:** sube `assets/js/feed-shim.js`. Con eso vuelven las
  gráficas.
- **El resto** son mejoras correctas que no rompían nada; estaban sin desplegar.
- **El nudo real a resolver:** que tus archivos lleguen al sitio (la prueba del v2/v3
  de arriba lo confirma). Si da v2, el problema es el despliegue, no los archivos.
