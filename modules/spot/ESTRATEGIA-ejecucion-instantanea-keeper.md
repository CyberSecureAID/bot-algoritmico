# Spot · Estrategia de ejecución instantánea (keeper no custodial)

> Documento vivo. Vive en `modules/spot/` para que cualquiera (o nosotros mismos, si se
> nos olvida) entienda el objetivo completo de Spot y el rumbo de cómo lograr que las
> operaciones se disparen rápido SIN volverse custodial. Léelo antes de tocar el keeper.

---

## 1. El objetivo en una frase

Que abrir y cerrar una operación en Spot se sienta **instantáneo** (clic y listo), y que
las órdenes limit, take profit y stop loss se disparen solas, **sin dejar de ser NO
custodial**: los fondos nunca salen de la wallet del usuario.

La misma dinámica sirve para tres secciones de la plataforma, y SOLO para esas tres:
- **Spot** (abrir/cerrar a mercado al instante, y limit/TP/SL automáticos).
- **Bots** (el bot de cuadrícula dispara órdenes limit de compra y venta).
- **Análisis** (señales y vigilancia de precios).

Todo esto lo atiende **un solo proyecto en Cloudflare** preparado para las tres.

---

## 2. Por qué tardaba (diagnóstico real, no suposición)

La lentitud **no es la blockchain**. BSC con los upgrades Maxwell y Fermi mina en
**0.45 a 0.75 segundos** y confirma en ~1 segundo. Minar tarda menos de un segundo.

Lo que se sentía lento era:
1. **MetaMask**: el popup, confirmar a mano cada operación, y la "protección de demora"
   que el usuario puede tener activada en su MetaMask. Eso no lo controlamos nosotros.
2. **El bloqueo por esperar el minado** (esto SÍ era nuestro y YA está resuelto): el código
   esperaba `tx.wait()` antes de registrar la posición y liberar la interfaz. Ahora la
   posición se registra en cuanto la tx se envía (estado "confirming"), la interfaz se
   libera al instante, y el minado se confirma en segundo plano. Igual el cierre.

Lo que ya quedó hecho (Fase A, ver sección 7): modelo no custodial por pre aprobación,
approve por monto máximo una sola vez por moneda, lecturas por RPC propio (no por el
provider lento de MetaMask), cotizaciones en paralelo, y la UI optimista de arriba.

---

## 3. La función especial: session key + keeper no custodial

Esta es la pieza que falta para que sea "clic y ya", sin popups y sin custodia.

### Cómo funciona
1. El usuario **firma UNA sola vez** una autorización acotada (una *session key*, o una
   pre aprobación ampliada). Esa autorización:
   - Solo sirve para el **contrato Spot** (no para mover nada más).
   - Tiene **límites** (monto máximo, y solo las acciones abrir/cerrar).
   - **Caduca** (por ejemplo, vale por X horas o días).
   - Es **revocable** en cualquier momento por el usuario.
2. Después de esa firma única, cada operación la **dispara el keeper** (el worker de
   Cloudflare) al instante, sin que salga el popup de MetaMask.
3. Los fondos **nunca salen de la wallet del usuario**: se mueven por la pre aprobación
   (allowance) justo en la transacción, y la salida del swap **siempre vuelve a la wallet
   del usuario**. Nada se queda guardado en el contrato.

### Por qué esto NO es custodial y por qué es seguro
- El contrato **siempre manda la salida al usuario** (está escrito así). El keeper puede
  disparar la operación, pero no puede redirigir los fondos a otra wallet.
- Si algún día **filtran la llave del keeper**, lo peor que puede pasar es que **fuercen**
  una operación no deseada (una pérdida por slippage). **No pueden robar**, porque no hay
  a dónde mandar el dinero que no sea la wallet del dueño.
- La autorización es **acotada, con caducidad y revocable**: el usuario corta el acceso
  cuando quiera.

Comparado con un **contrato custodial** (guardar los fondos de todos juntos): eso sí es un
honeypot. Un solo bug o una sola llave filtrada = se drena **todo, de todos**. Es el blanco
número uno de los hackers. **Descartado.** El modelo de este documento da la misma velocidad
sin ese riesgo.

### Gasless (Gelato) — opcional, descartado por ahora
Existe la opción de que el usuario ni siquiera pague el gas (relayer tipo Gelato), a cambio
de gas + un pequeño recargo por transacción. **No hace falta.** Con nuestro propio keeper en
Cloudflare basta. Se puede valorar más adelante, no ahora.

---

## 4. Arquitectura: UN proyecto Cloudflare para las tres secciones

- **Un** Worker (no varios), con **un** Cron Trigger.
- Un almacén persistente de estado (Cloudflare **KV** o **D1** o **Durable Objects**):
  guarda las órdenes/posiciones a vigilar, qué ya se disparó, y las autorizaciones activas.
- El keeper, en cada tick del cron: lee precios **una sola vez por lote**, revisa qué
  órdenes cumplen condición, dispara las que toca, y marca lo disparado para no repetir.
- Las tres secciones (Spot, Bots, Análisis) comparten el mismo worker, el mismo cron y el
  mismo almacén. Se distinguen por un campo "tipo" en cada registro.

El plan de pago de Cloudflare es **por cuenta, no por proyecto**: cubre todos los Workers de
la cuenta. No hay que borrar ni recrear nada para que aplique; se activa a nivel de cuenta.

---

## 5. CÓMO NO QUEMAR EL PLAN (la lección que YA nos costó)

> En el pasado, la versión gratuita se agotaba **a diario sin un solo usuario**. Llegaban
> correos de "consumiste el límite diario" día tras día. Eso fue un **bug de diseño del
> keeper**, no falta de usuarios. Estas reglas existen para que no se repita.

Reglas obligatorias para el worker:
1. **Un solo cron**, con intervalo razonable (30 a 60 segundos). Nunca varios crons ni un
   bucle que se auto reinvoca.
2. **Una lectura de precios por lote (Multicall)** en cada tick, NO una llamada por cada
   posición. Si hay 50 órdenes, es **1** llamada agrupada, no 50.
3. **El front NO llama al worker en bucle.** La vigilancia vive en el cron del worker, no en
   `setInterval` del navegador. El navegador del usuario no debe estar martillando al worker.
4. **Caché corta** de precios y resultados (unos segundos). No releer lo mismo muchas veces
   en la misma ventana.
5. **Solo vigilar lo ABIERTO**: órdenes y posiciones con TP/SL/limit pendientes. Ignorar lo
   cerrado y lo ya disparado. Lista de trabajo mínima.
6. **Presupuesto de subrequests por invocación** (en el plan gratuito de Workers hay límite
   de subrequests por ejecución y de requests por día): medirlo y mantenerse MUY por debajo.
   Si el trabajo crece, agrupar más, no llamar más.
7. **Backoff en los fallos**: si una llamada falla, reintentos limitados (no bucle infinito).
8. **Idempotencia**: una orden que ya se disparó no se vuelve a disparar. Marcar en el
   almacén antes/después de disparar.

Objetivo: **la menor cantidad de llamadas por usuario**, sin estorbar el flujo que el
usuario necesita.

---

## 6. EL BUG DE LOS BOTS (disparaba una vez y moría) — modo de fallo a evitar

> Síntoma real: con un solo usuario (yo), el keeper **se disparaba bien una vez** y a los
> 2 o 3 días, o el mismo día, **dejaba de funcionar**. Las órdenes limit del bot de
> cuadrícula no se activaban. **No era falta de gas.** Simplemente dejaba de trabajar.

Causas típicas de "funciona una vez y luego no", y cómo evitarlas:
1. **El estado no persiste.** El worker no guardaba qué órdenes faltaban por disparar, así
   que al reiniciarse perdía el hilo. **Solución:** estado persistente en KV/D1/Durable
   Object. El worker nunca depende de su memoria entre ejecuciones.
2. **El cron no estaba bien declarado** (o se "desregistraba"). Si el Cron Trigger no está
   declarado en `wrangler.toml`, no corre. **Solución:** cron declarado y verificado;
   confirmar en el panel que realmente dispara.
3. **Un error sin capturar tumbaba toda la corrida.** Una orden mala reventaba el ciclo y
   las siguientes no corrían. **Solución:** `try/catch` **por cada orden**, no uno global.
   Una orden mala se salta, el resto sigue.
4. **Dependía del front abierto.** Si la "activación" vivía en un `setInterval` del
   navegador, al cerrar la pestaña moría. **Solución:** el keeper vive **100% en Cloudflare**,
   del lado del servidor. No depende de ningún navegador abierto.
5. **Rate limit silencioso.** Al quemar el plan diario (por el bug de la sección 5), el
   worker dejaba de responder el resto del día. Se veía como "funcionaba y de pronto no".
   **Solución:** respetar el presupuesto de llamadas (sección 5). Están conectados.

Regla de oro: **estado persistente + cron declarado + try/catch por item + keeper solo en el
servidor + idempotencia + presupuesto de llamadas.** Si falta uno, vuelve el bug.

---

## 7. Rumbo (fases)

- **Fase A — HECHO.** Wiring on chain no custodial de Spot. Approve máximo una vez por
  moneda. Lecturas por RPC propio. Cotizaciones en paralelo. UI optimista: abrir y cerrar
  no esperan a minar (estado "confirming" / "closing", confirmación en segundo plano).
- **Fase B — Contrato.** Función de keeper para abrir/cerrar **en nombre del usuario** con
  una session key acotada, con caducidad y revocable. Hoy el contrato ya tiene `esKeeper`
  para cerrar (TP/SL); se extiende a abrir con autorización. La salida siempre a la wallet
  del usuario (no custodial, sin poder de drenar).
- **Fase C — Worker Cloudflare.** Un proyecto para Spot + Bots + Análisis. Cron único.
  Multicall. Estado persistente. Presupuesto de llamadas (secciones 5 y 6).
- **Fase D — Front.** Botón "Activar modo instantáneo": el usuario firma la autorización una
  sola vez; desde ahí las operaciones las dispara el keeper, sin popup. Botón para revocar.
- **Fase E — Escala.** Plan de pago de Cloudflare (a nivel de cuenta) solo si de verdad se
  necesita. No antes.

---

## 8. Principios de seguridad (no negociables)

1. **Siempre no custodial.** Los fondos nunca se quedan en el contrato.
2. **Autorización acotada**: solo el contrato Spot, con monto máximo, con caducidad y
   revocable.
3. **La salida del swap siempre vuelve a la wallet del usuario.** El keeper no puede
   redirigir fondos.
4. **El keeper no puede drenar.** Lo peor ante una llave filtrada es una operación forzada
   (slippage), no un robo.
5. **Nada de contrato custodial.** Es un honeypot y un punto único de pérdida total.
