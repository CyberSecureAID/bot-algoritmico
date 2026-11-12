# AUDITORIA estricta — "pantalla negra / bloqueo" en Análisis (EE. UU.)

> Fecha: 11 nov 2026. Auditoría de la causa REAL del bloqueo que reporta el
> usuario en EE. UU. ("no tiene permiso / pantalla negra, bloquea hasta que la
> wallet se conecta"). Sin adornos: lo verificado se marca; lo que no se puede
> probar desde aquí, también.

---

## 0. Método y nivel de rigor

- **Pruebas reales, no suposiciones.** Reproduje el fallo en navegador
  (Playwright) cargando `analisis.html` de verdad y **midiendo el tiempo** hasta
  que la sección aparece. Probé los endpoints de datos **desde infraestructura de
  EE. UU.** (las peticiones de verificación salen de servidores en EE. UU., sin
  VPN y sin caché).
- **Lo que NO puedo probar desde aquí:** el navegador exacto del usuario con su
  IP residencial de su estado. Lo digo donde toca.

---

## 1. La causa RAÍZ (verificada y medida)

**No es el geobloqueo de Binance. Es que la gráfica de Análisis está serializada
detrás de la reconexión automática de la wallet.**

En `modules/analysis/analisis.html`, el arranque hacía:

```js
try { if (W && W.reconectarSiProcede) await W.reconectarSiProcede(); } catch(_){}
...
await m.abrirAnalisis('hero', W, ethers);   // la gráfica SOLO después
```

El `await` de la reconexión **bloquea todo lo que viene después**, incluida la
gráfica. Si la wallet tarda o el puente de la extensión está mudo ("Receiving end
does not exist"), se espera al timeout interno (6 s por petición). Durante ese
tiempo: **pantalla de carga / negra**. Eso es, literal, "bloquea hasta que la
wallet se conecta".

### Medición (Playwright, con una wallet que cuelga en `eth_accounts`)
- **Código actual:** la sección aparece a los **6471 ms**.
- **Con el arreglo:** aparece a los **425 ms** (15x más rápido). La wallet se
  reconecta en segundo plano; la gráfica ya no la espera.

Los datos de mercado son **públicos**: no necesitan wallet. No había ninguna
razón para que la gráfica esperara a la wallet.

---

## 2. El geobloqueo: la verdad, comprobada desde EE. UU.

Había que despejar el mito de "la solución anterior era un navegador cacheado por
VPN". Lo probé desde infraestructura de EE. UU.:

| Endpoint | Resultado desde EE. UU. |
|---|---|
| `api.binance.com` (REST) | Bloqueado (451), como se sabía. |
| **`data-api.binance.vision`** (REST, el que usa el shim) | **Devuelve velas reales. NO da 451.** |
| **`data-stream.binance.vision`** (WebSocket, tiempo real) | **Host alcanzable, no da 451** (rechaza solo el GET plano porque espera upgrade a WS). |

Y revisé el montaje: **`feed-shim.js` es el primer script de `analisis.html`** y
reescribe `api/stream.binance.com` → `data-api/stream.binance.vision`. **Solo el
shim** toca `fetch`/`WebSocket` (nada lo anula después; descarté la hipótesis de
"la wallet pisa el shim").

**Conclusión:** para los datos que usa la plataforma (spot), el espejo `.vision`
**sí funciona desde EE. UU.**, REST y WebSocket. El shim era una solución real,
no un espejismo de caché. Lo que daba la sensación de "sigue bloqueado" era la
pantalla negra del punto 1 (la wallet), no el 451.

> Matiz honesto: mi prueba sale de un datacenter de EE. UU., no de la IP
> residencial del usuario en su estado concreto. La evidencia es fuerte (es el
> endpoint público oficial de datos de Binance, pensado para ser abierto), pero
> si un ISP o estado concreto filtrara `.vision`, habría que ir al plan B del
> punto 5.

---

## 3. Por qué Spot NO tenía este bloqueo

Spot está bien hecho: carga los datos **primero** y la wallet **después**.

```js
await cargarDatos();   // gráfica primero (no depende de la wallet)
...
arrancarWallet();      // wallet después, en su propia función
```

Análisis hacía lo contrario. Por eso el usuario lo veía en Análisis y no igual en
Spot.

---

## 4. La solución EXACTA (aplicada y verificada)

Sin tocar nada de la formación de velas en tiempo real. Dos cambios quirúrgicos,
siguiendo el propio diseño del código (que ya tenía la señal `window.__walletLista`
"para secciones que dependen de la cuenta"):

1. **`analisis.html`** — la reconexión de la wallet pasa a correr EN PARALELO, sin
   bloquear:
   ```js
   // antes:  await W.reconectarSiProcede();
   // ahora:  W.reconectarSiProcede().catch(() => {});   // no bloquea la gráfica
   ```
2. **`analisis.js`** — la píldora de suscripción (los "días" / "Owner") espera a la
   señal `window.__walletLista` en vez de leer la cuenta de golpe, para que al
   desacoplar no deje de mostrarse la suscripción:
   ```js
   for (let i = 0; i < 120 && !window.__walletLista; i++) await esperar(100);
   ```

**La formación de las velas en tiempo real no cambia en absoluto:** sigue siendo
el mismo WebSocket (`stream.binance.com` → shim → `data-stream.binance.vision`) y
el mismo motor. Solo se quitó la espera que tapaba la gráfica.

### Verificado en navegador
- Con la wallet colgada, la sección de Análisis (nav, buscador, catálogo completo,
  disclaimer) se monta a los **425 ms**, no en negro.
- `analisis.js` compila (node --check).
- La píldora de suscripción se puebla cuando la reconexión termina (señal
  `__walletLista`), sin bloquear nada.

---

## 5. Plan B, por si algún día `.vision` sí se filtra en EE. UU.

No hace falta ahora (el punto 2 muestra que `.vision` funciona), pero queda listo:
**Spot ya tiene failover multi host** en `modules/spot/datos.js`
(`data-api.binance.vision` → `api.binance.us`, y el WS a `stream.binance.us:9443`).
Si una IP concreta llegara a filtrar `.vision`, se porta ese mismo patrón al motor
de velas de Análisis (`assets/js/niveles.js` y `assets/js/niveles/motor.js`). Es
el **mismo formato de API**, así que la formación de velas tampoco cambiaría.

> Aviso sobre Binance.US: no da servicio en algunos estados (NY, TX, etc.). Su
> API pública de datos suele seguir accesible, pero no es garantía universal. Por
> eso el plan A es `.vision` (abierto para datos) y Binance.US solo es el respaldo.

---

## 6. Cascada de versiones de esta entrega

Cambié `analisis.js`, que tiene dos importadores → subo la cascada en cada uno:
- `analisis.html` → `analisis.js?v=75` (+ el desacople de la wallet).
- `portada.js` → `analisis.js?v=29`; y sus importadores `index.html`
  (`portada.js?v=239`) y `portada.html` (`portada.js?v=7`).

`sw3.js` es "netonly" (sin precache): no hay lista que tocar.

---

## 7. Verificado este turno / pendiente

**Verificado:** causa raíz (wallet serializada), 6471→425 ms, `.vision` REST y WS
alcanzables desde EE. UU., shim correcto y único que toca fetch/WebSocket, Spot
sin el defecto, la sección monta completa.

**Pendiente (no verificable desde aquí):** confirmación final desde la IP
residencial del usuario tras desplegar esta entrega. Si tras desplegar SIGUE en
negro, el siguiente dato que necesito es **la consola del navegador** del usuario
en EE. UU. (errores de red exactos): eso dirá si quedara algún filtrado real de
`.vision` en su red, y entonces se activa el plan B del punto 5.
