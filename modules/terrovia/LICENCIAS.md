# Licencias de Terrovia

Base del proyecto: **folio-2025** de Bruno Simon, licencia **MIT** (se conserva `license.md` con su copyright, como exige la regla).

## Codigo

| Que | Origen | Licencia |
|---|---|---|
| Base del juego | folio-2025 (Bruno Simon) | MIT |
| three.js (WebGPU) | npm `three` | MIT |
| Fisicas | npm `@dimforge/rapier3d` | Apache 2.0 |
| Animaciones | npm `gsap` | Licencia estandar GreenSock (uso permitido en web) |
| Audio | npm `howler` | MIT |
| Camara | npm `camera-controls` | MIT |
| Joystick tactil | npm `nipplejs` | MIT |

## Assets

| Que | Origen | Licencia | Nota |
|---|---|---|---|
| Modelos 3D (auto, escenario, props) | folio-2025 | MIT | Incluidos en el repo MIT de Bruno. Hay `.blend` fuente para derivar variantes (Fase 7). |
| Texturas | folio-2025 | MIT | Formato comprimido (`.ktx`, `.basis`). |
| Musica (`Boy`, `Baguira`, `Sudo`) | folio-2025 `sounds/musics/` | **CC0 1.0** | Confirmado por el `license.md` de esa carpeta. Uso comercial, sin creditos. Se usan los `.mp3`. |
| Efectos de sonido (vehiculo, clima, UI...) | folio-2025 | Incluidos bajo su MIT | Verificacion fina por pista pendiente; la mayoria provienen de bancos CC0. |
| Fuente Pally | folio-2025 `static/fonts/` | Pendiente de confirmar (Pally suele ser libre) | Local, sin CDN. |
| Fuentes Nunito y Amatic SC | Google Fonts (CDN externo) | OFL (libre) | **PENDIENTE vendorizar**: hoy se piden por CDN, hay que servirlas locales. |

## Reglas que seguimos

- Solo CC0, MIT, Apache o fuentes OFL/libres. Nada de licencias no comerciales.
- Si una licencia no se puede verificar, no se usa el asset y se avisa.
- Al agregar autos nuevos (Fase 7) se anota aqui el origen y licencia de cada modelo.
