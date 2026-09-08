# DO NOT BREAK MAP — CriptoCuba Oficial

> Lista de las partes del sistema que **no deben modificarse sin extrema precaución**.
> Complemento del `PROJECT-TRUTH-MAP.md`. Documento de solo lectura: no se modificó ningún archivo.
>
> Antes de tocar cualquier archivo de esta lista, hay que poder responder por escrito:
> **qué depende de él, qué estado administra, y qué se rompe si falla.**

---

## Nivel 🔴 — PROHIBIDO tocar sin autorización explícita del owner

### 1. Mapa de calor de Liquidity Pools
**Archivo:** `assets/js/liquidity.js` — funciones `calor()`, constante `ESCALONES`, suavizado `suave()`, cálculo de intensidad.
**Por qué es crítico:** el owner lo declaró **aprobado y congelado** en README.md §6 regla 9 y §15.1, y lo repitió en README-V4 §1 regla 10. Es la distribución de color azul→verde→amarillo→rojo y la ubicación de los rojos como muros de liquidación.
**Qué depende de él:** la herramienta Pro más visual del producto.
**Qué se rompe:** una decisión de producto ya cerrada. *Sí* se puede tocar lo que va **encima** del mapa (tachuelas, perfil de volumen, escala).

### 2. Contratos desplegados
**Direcciones:** GridBot `0x4e86…F93B` · AurexMarket `0x1131…Fb18` · AurexPrizePool `0x595C…8132` · AurexSwap `0xa157…2a0c` · Academy `0x96b7…9721`.
**Por qué es crítico:** hay fondos, bots activos y allowances vivos apuntando a esas direcciones.
**Qué depende de ellos:** absolutamente todo el producto.
**Qué se rompe:** cambiar una dirección en el frontend deja huérfanos todos los bots existentes de todos los usuarios. **Nunca se cambia una dirección de contrato para "probar algo".**
**Nota adicional:** hoy **no hay ningún `.sol` en el repositorio**, así que ni siquiera es posible generar una implementación nueva. Ver PROJECT-TRUTH-MAP §4.2.

---

## Nivel 🟠 — Modificar solo con motivo escrito y verificación completa

### 3. `assets/js/wallet.js` — conexión de wallet
**Por qué es crítico:** puerta de entrada única al producto. 27 módulos lo importan.
**Qué administra:** proveedor activo, cuenta, chainId, oyentes, preferencia de wallet, bandera de desconexión manual (`bolita.desconectado`), sesión de WalletConnect.
**Qué depende de él:** todo. Sin wallet no hay bots, ni swap, ni market, ni perfil, ni Pro.
**Qué se rompe si se modifica mal:** la detección EIP-6963 (incluyendo el descarte deliberado de la wallet de Brave, que se anuncia sin estar configurada), los deep links de móvil, el QR de escritorio, la reconexión silenciosa, el respeto de la desconexión manual.
**Regla:** cualquier cambio aquí obliga a probar en MetaMask escritorio, MetaMask móvil, Trust y WalletConnect. El sandbox **no puede** verificarlo: se confirma en dispositivo real.

### 4. `assets/js/gridbot.js` — capa de contrato
**Por qué es crítico:** contiene el ABI, las direcciones, la codificación de `crearRejilla` (struct con arrays anidados) y la matemática de rejilla.
**Qué depende de él:** `gridbot-ui.js`, `orden.js`, `perfil.js`, `movil/operar.js`, `movil/activos.js`, `admin.js`.
**Qué se rompe:** un cambio en el ABI o en el orden de los campos del struct hace que **todas las transacciones reviertan**.
**Regla:** no tocar el ABI salvo que el contrato haya cambiado de verdad on-chain.

### 5. `assets/js/orden.js` — órdenes desde el gráfico
**Por qué es crítico:** una orden limit **es** una rejilla de 1 nivel on-chain. Este módulo mantiene el marcador que distingue "orden limit" de "bot Cash Out", y de él depende el conteo de cupo.
**Qué administra:** `localStorage` → `cco-ordenes-grafico` (órdenes reales) y `cco-ordenes-aviso` (alertas locales).
**Qué depende de él:** `gridbot-ui.js` (tarjetas + cupo), `muros.js`, `niveles/render.js`, `movil/operar.js`.
**Qué se rompe:** las órdenes limit vuelven a contarse como bots, ocupan cupo y las canceladas quedan colgadas. Bug ya sufrido (README-V2 §5.9).
**⚠️ Deuda activa:** hoy se importa con **dos versiones distintas** (`?v=125` desde `gridbot-ui.js`, `?v=126` desde el resto). Ver PROJECT-TRUTH-MAP D1. **Unificar es una corrección deseable, pero hay que hacerla en un cambio propio y aislado, nunca de paso mientras se hace otra cosa.**

### 6. `assets/js/gridbot/estilos.js` — el CSS de toda la app web
**Por qué es crítico:** 110 KB con todo el aspecto de la web, con scope `#colmena-app`, inyectados de una sola vez por `inyectarEstilo()`.
**Qué depende de él:** cada pantalla de escritorio.
**Qué se rompe:** un selector mal tocado repinta o descoloca todo el producto a la vez.
**Regla para la portada:** **no se añade ni una línea aquí.** La portada lleva su propio módulo de estilos con prefijo propio.

### 7. `assets/css/styles.css` — NO BORRAR pese a las apariencias
**Por qué parece basura:** es la hoja original de la lotería (fondo `#030B08`, verde neón `#2EE86A`), y `index.html` tiene un `<style>` en línea precisamente para tapar ese verde al arrancar.
**Por qué es crítico de verdad:** su bloque `:root` define **`--gold`, `--gold-soft`, `--display`, `--sans`, `--mono`, `--r`**, y `gridbot/estilos.js` **los consume sin redefinirlos** (verificado: 0 apariciones de `--gold:` y `--display:` en `estilos.js`).
**Qué se rompe si se borra:** la app entera pierde el dorado de marca y las tres tipografías, y cae a fuentes del sistema. Es una trampa perfecta para un refactor "de limpieza".

### 8. Arranque de `gridbot-ui.js` — `arrancar()` y el gancho móvil
**Por qué es crítico:** contiene tres soluciones a bugs reales que volverían de inmediato.
- El bloque **síncrono** de las líneas 34-42 que oculta `#colmena-app` en móvil **antes** de pintar nada. Si se hace asíncrono, vuelve el destello de la web de escritorio antes de montar la cáscara.
- La bandera `_arrancando`, que impide dibujar dos veces (una al conectar la wallet y otra al terminar el arranque). Sin ella vuelve el parpadeo.
- La carrera `reconectarSiProcede()` vs. timeout de 2.500 ms: si una extensión de wallet no responde, la página se pinta igual. Sin ella vuelve el "Cargando…" eterno.
**Regla:** no reordenar. La portada se inserta **dentro** de la rama "sin cuenta" de `render()`, no antes de `arrancar()`.

### 9. `assets/js/movil/movil.js` — cáscara y router móvil
**Por qué es crítico:** monta `#mv-app` y la barra `#mv-nav`, despacha todas las acciones, cierra overlays y gestiona la auto-conexión.
**Qué administra:** pestaña activa, balance en caché, puentes hacia los módulos de la web.
**Qué se rompe:** si se toca `cerrarSecciones()` o el orden de montaje, quedan overlays colgados o la barra inferior deja de ser perpetua.
**⚠️ Punto de contacto con la portada:** `autoConectarMovil()` (líneas 594-604) **conecta la wallet sola en cuanto se monta**. La portada tiene que poder aplazar esa llamada sin eliminarla, porque para el usuario recurrente esa auto-conexión es una de las mejores cosas del producto.

### 10. Reutilización móvil→web (arquitectura, no un archivo)
**Qué es:** la app móvil **no reimplementa** nada de la lógica on-chain: importa dinámicamente `../gridbot.js`, `../orden.js`, `../niveles.js`, `../muros.js`, `../liquidity.js`, `../market.js`, `../tools.js`, `../academy.js`, `../perfil.js`, `../prizepool.js`, `../gridbot/swap.js`.
**Por qué es crítico:** es lo que evita que existan dos versiones divergentes de la lógica de negocio.
**Qué se rompe:** duplicar lógica en `movil/` crea dos verdades. Ya hay un aviso en el repo: `movil/{liquidity,muros,niveles}.js` son 275 KB de una duplicación anterior que quedó huérfana.
**Regla:** **nunca** duplicar lógica on-chain en móvil. Se importa la de la web.

### 11. Sistema de versionado `?v=N`
**Por qué es crítico:** no hay bundler ni hashing. La caché se rompe a mano.
**Qué se rompe:** si un archivo se importa con dos versiones, el navegador carga **dos instancias del módulo con estado separado**. Síntoma clásico documentado: "conecta tu wallet" con la wallet conectada; contadores que no cuadran.
**Regla (README §6.4 y §21.1):** al subir la versión de un módulo, hay que subirla en **todos** sus importadores y entregarlos juntos, incluidos `index.html` y `sw.js`.

### 12. Service worker `sw.js`
**Por qué es crítico:** define la lista de precache y la constante `VERSION` (`aurex-v128`).
**Qué se rompe:** si no se sube `VERSION` al cambiar archivos, los usuarios siguen viendo la versión vieja indefinidamente. Ya ocurrió (README §7).
**Cuidado especial:** la lista `NUNCA_GUARDAR` impide cachear RPC, Binance, CoinGecko y el keeper. **No añadir dominios de datos al precache.** Y no volver a poner el `p.navigate()` que se quitó del `activate`: recargaba la página bajo los pies del visitante en su primera visita.

### 13. Panel de administración `admin.js`
**Por qué es crítico:** actúa sobre contratos en producción.
**Diseño a preservar:** sin ejecución libre de funciones; **sin acciones irreversibles** (no traspasa propiedad, no actualiza contratos); ensayo en seco (`staticCall`) antes de firmar; deshacer con el valor anterior; mínimos y máximos por campo; la comprobación de owner se hace **leyendo los contratos**, no la web.
**Qué se rompe:** añadir aquí una función irreversible convierte una herramienta segura en un arma.

### 14. Configuración de producción
`CNAME` (`criptocubaoficial.com`) · `manifest-aurex.webmanifest` · `.nojekyll` · el bloque anti-clickjacking de `index.html` · el fallback de 20 s.
**Qué se rompe:** borrar `.nojekyll` hace que GitHub Pages ignore rutas; tocar el manifest rompe la PWA instalada de los usuarios; quitar el anti-iframe reabre la vía de clickjacking para firmas falsas.

---

## Nivel 🟡 — Precaución alta

| Componente | Por qué | Regla |
|---|---|---|
| `niveles.js` + `niveles/*` | 15 módulos con contrato de arquitectura explícito (README §26-27): `N` solo se muta, nunca se reasigna; prohibido el import circular; los submódulos nunca importan `niveles.js` | Toda lógica nueva va en su módulo. Tras tocar `motor.js`, **las 7 señales de los escenarios sintéticos deben salir idénticas**. |
| `market/*` (16 módulos) | Marketplace P2P con fianzas y disputas: hay dinero de terceros en juego | El contrato está en el límite de 24 KB (`optimizer runs=1`): cuidado con prometer funciones nuevas. |
| `idioma.js` | Traduce el DOM en vivo; 1.200+ entradas | Regla de oro del propio módulo: **nunca puede romper la web**; el español es el respaldo permanente. |
| `tokens.js` | Catálogo de monedas, decimales y direcciones | Un decimal mal puesto = importes mal calculados en transacciones reales. |
| `gridbot/config.js` | Presets auditados, cupos, `KEEPER_URL`, textos explicativos | Los presets fueron recalculados para rendir con 50 USDT (README §8). No "mejorarlos" a ojo. |
| `perfil.js` | Contiene la revocación de permisos | Es la prueba de la promesa "puedes quitarlo cuando quieras". |
| `sw.js` lista `APP` | Precache | Si un archivo listado no existe, la instalación no cae (hay `.catch`), pero se degrada el arranque sin conexión. |

---

## Checklist obligatorio antes de tocar cualquier archivo

1. ¿Es realmente necesario, o es gusto personal?
2. ¿Hay una vía menos invasiva (CSS con scope, módulo nuevo, parámetro opcional)?
3. ¿Quién importa este archivo? *(`grep -rn "nombre.js?v=" assets/js/`)*
4. ¿Qué estado administra y quién más lo lee?
5. ¿Afecta a escritorio? ¿A móvil? ¿A ambos?
6. ¿Toca contratos, wallet o transacciones?
7. ¿Cambia alguna versión `?v=`? Si sí → **hay que actualizarla en todos los importadores y entregar el lote completo**.
8. ¿Compila? `node --input-type=module --check < archivo.js` (los 71 módulos compilan hoy: ese es el punto de partida).
9. ¿Se comprobó responsive a 320 / 360 / 390 px sin desbordes?
10. ¿Sigue funcionando lo de antes exactamente igual que antes?

---

## Lo que el sandbox NO puede verificar (hay que confirmarlo en el dispositivo real)

- Conexión de wallet real, firmas, cambio de red, deep links.
- Carga en vivo de precios, logos, libro de órdenes, bots y NFTs (CoinGecko / Binance / RPC / GitHub raw están bloqueados en el entorno de pruebas).
- Estado y ejecución del keeper (Cloudflare no es inspeccionable desde aquí).
- Comportamiento dentro del navegador interno de MetaMask / Trust / SafePal.

**Lo que sí se verifica aquí:** que compila, que las rutas y URLs existen, que no hay desbordes horizontales, que el grafo de imports es coherente, y que las funciones clave siguen exportadas.
