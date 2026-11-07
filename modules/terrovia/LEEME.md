# Terrovia · Entrega Fase 2

Modulo nuevo del sitio, partiendo de **folio-2025** de Bruno Simon (licencia MIT).
Esta entrega cubre la **Fase 2: quitar la noche**.

## Que cambia en esta fase

- **Dia fijo, sin noche.** Se congela el ciclo de dia en pleno dia con buena luz, usando el modo que el propio juego ya trae (`VITE_DAY_CYCLE_PROGRESS=0.1` en `.env`). No se borro codigo: los preajustes de tarde/noche/amanecer siguen ahi, solo que el ciclo no avanza. Es reversible (basta cambiar o quitar esa variable).
- **La lluvia y los rayos NO se tocan.** El clima es un sistema aparte del dia, asi que siguen funcionando.
- **Empaque:** se quitaron los 3 `.wav` de musica que no se usan (el juego carga los `.mp3`, que son CC0). Eso baja el peso de 204 MB a 74 MB sin perder nada.

## Como verlo

1. Copia la carpeta `terrovia/` dentro de tu `modules/`.
2. El juego desplegable esta en la **raiz del modulo** (`modules/terrovia/index.html`), con rutas relativas, listo para GitHub Pages en `.../modules/terrovia/`.
3. Abrelo en tu navegador. Usa Three.js **WebGPU con respaldo automatico a WebGL**, por eso corre en equipos nuevos y viejos.

## Peso

- Antes (build original con `.wav`): ~204 MB.
- Ahora (`dist` servido): **74 MB** (audio MP3, modelos, texturas comprimidas, wasm de fisicas y fuentes).
- La descarga inicial real para el jugador es mucho menor: carga por partes. En fases siguientes baja mas (Draco y carga del auto bajo demanda).

## Aviso importante (pendiente)

El `index.html` todavia pide dos fuentes a **Google Fonts** (Nunito y Amatic SC) por CDN externo. Eso choca con la regla de "nada de CDN externos". Hay que **vendorizarlas** (traerlas al repo y servirlas locales). Es el primer paso que propongo para la siguiente entrega; se hace via npm (Fontsource), sin depender de internet.

## Contenido

- Raiz del modulo: el juego compilado y desplegable.
- `_source/`: el codigo fuente (`sources/`, config, `.env`) para referencia. Los archivos de Blender y los assets fuente pesados se quedan en el entorno de trabajo para la Fase 7 (variantes de autos); no hacen falta para desplegar.
- `license.md`: licencia MIT original de Bruno Simon (se conserva por regla).
- `LICENCIAS.md`: origen y licencia de los assets.

## Lo que falta (siguientes fases, segun tu documento)

- Fase 3: controles tactiles en movil (joystick izquierda, acelerador derecha).
- Fase 4: menus minimos y **marca** (nombre 3D de entrada y nombre del menu a DecFreedom, ocultar lo de Bruno y lo que dependa de su servidor, vendorizar fuentes).
- Fase 5 y 6: marketplace de autos (entrar NO te pone a conducir directo), comprar auto por postMessage con tu wallet, precios de $2 a $5.
- Fase 7: catalogo de 10 a 20 autos del mismo estilo.
