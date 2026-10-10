# Auditoría de los 4 bots + rediseño (GridBot V13)

Contrato auditado: la implementación viva `0xE3A5c473B2B0b92166D34Ac42F519B0a324191B7` (proxy `0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B`).
Objetivo principal que no se pierde de vista: **matar la intermitencia** (que te cobre y el bot no abra, que a veces falle y a veces no).
Enemigo número uno: **el límite de 24576 bytes.** Hoy el contrato va a ~24.4 KB. Todo lo nuevo hay que meterlo SIN pasarnos, y eso lo valido compilando y midiendo, no a ojo.

Esto es el estudio. No toco código hasta que confirmes las decisiones del final.

---

## 0. Cómo funciona el motor por dentro (para que hablemos el mismo idioma)

- Cada bot es una "Rejilla" con niveles. Cada nivel tiene un estado: **1 = comprar**, **2 = vender**, **0 = hecho/apagado**.
- El **keeper** (robot automático, no el usuario) vigila el precio y llama `ejecutar(clave, nivel)` cuando el precio toca ese nivel. El disparo de precio va codificado en el `minOut` de cada nivel (la cantidad mínima aceptable a recibir).
- La apertura (`crearRejilla`) hace la configuración y, según el bot, una compra inicial.
- `modo`: **0 = Smart Grid**, **1 = Acumulador**, **2 = Cash Out**, **3 = DCA**.

---

## 1. Smart Grid (modo 0) — cómo está hoy

**Flujo real:**
- Al abrir compra inventario para cada nivel que arranca armado para vender (`estado 2`): `gastar = (nº niveles en estado 2) × ordenQuote`.
- Cuando se ejecuta una **compra** (nivel estado 1): compra `ordenQuote`, y arma el nivel de **venta de arriba** (`nivel i+1 → estado 2`).
- Cuando se ejecuta una **venta** (nivel estado 2): vende `ordenBase`, y re-arma la **compra de abajo** (`nivel i-1 → estado 1`).

**Veredicto:** esta es la lógica clásica y CORRECTA de un grid. Compra abajo, vende arriba, y cada operación re-arma la contraria. Aquí no veo un error de lógica. Solo hay que revisar protecciones de borde (que no re-arme fuera de rango) y que herede bien el arreglo de atomicidad. **Riesgo bajo.**

---

## 2. Acumulador (modo 1) — cómo está hoy

**Flujo real:**
- Al abrir hace UNA compra inicial (`compraInicialQuote`).
- En las compras hacia abajo sí mete más capital por nivel (`factorBps`): cuanto más profundo, más capital. **Eso que recordabas sí está.**
- PERO la venta: cuando se dispara un nivel de venta, vende **solo `ordenBase`** (un pedazo), no toda la posición. Tiene un piso de precio por promedio (`margenBps`: vende ese pedazo al menos a su costo promedio + X%).
- El campo `objetivoBps` (tu "porcentaje de venta", 10%, 20%…) está guardado pero **NO se usa en la ejecución.** El disparo real de venta lo pone el keeper vía `minOut`, pedazo a pedazo.
- **No existe** la venta de toda la posición al promedio + X%, ni el re-armado automático.

**Veredicto:** confirmado tu diagnóstico. Hoy el acumulador se comporta como un grid más: vende por pedazos, no la posición entera al precio promedio objetivo, y no se vuelve a montar solo. **Hay que reescribir su lógica de venta.**

---

## 3. Cash Out (modo 2) — cómo está hoy

**Flujo real:**
- Al abrir NO compra: toma la posición que YA tienes (`posicionBase = ordenBase`, `costeQuote = compraInicialQuote`).
- Tiene niveles de venta. Cuando se dispara uno, vende `ordenBase` y **desactiva el bot** (`activa = false`).
- O sea: es una **orden límite de venta de un solo tiro.** Si el precio no llega al objetivo, no hace nada; si baja, se queda mirando.

**Veredicto:** confirmado. Es una orden limit y ya. En una caída no te protege ni te da chance. **Hay que darle una dinámica nueva.** (Opciones en la sección 7.)

---

## 4. DCA (modo 3) — cómo está hoy

**Flujo real:**
- Al abrir compra `ordenQuote` una vez.
- Después compra `ordenQuote` cada vez que el keeper lo dispara, hasta `comprasMax`. No vende (solo acumula).
- **Detalle importante:** el campo `intervalo` (cada cuántas horas/días comprar) está guardado pero **NO se verifica en la ejecución on-chain.** Lo único que limita el tiempo entre compras es `cooldownSeg`. O sea, el "cada X tiempo" depende de que el keeper llame a tiempo y de que el frontend haya puesto `cooldownSeg = intervalo`. On-chain no hay garantía dura del intervalo.

**Veredicto:** la acumulación funciona si el keeper llama bien, pero el intervalo no está blindado on-chain. Hay que decidir: **blindarlo on-chain** (que el contrato rechace comprar antes de tiempo) o **dejarlo** como está. Y confirmar si de verdad lo quieres mantener o lo reemplazamos por algo más útil.

---

## 5. El problema de la intermitencia (lo principal, afecta a los cuatro)

Dos fallos de diseño, ya confirmados con tu evidencia:

1. **Apertura en dos transacciones.** Abrir un bot primero firma el pago (`pagarMes`) y después, aparte, firma la apertura (`crearRejilla` con `value: 0`). Si la segunda falla, ya te cobraron en la primera. Ese es el "me cobró y no abrió".
2. **La apertura hace un swap en vivo.** La compra inicial se hace dentro de `crearRejilla`. Ese swap, por gas o por precio del momento, a veces revienta, y tumba toda la apertura. Por eso "a veces sí, a veces no".

---

## 6. Rediseño propuesto (global)

**a) Cobro atómico y al final.**
Abrir un bot pasa a ser UNA sola transacción. El cobro se hace al final y solo si todo lo que define el bot quedó montado. Si algo falla, revierte todo y no se cobra nada. Nunca más "cobró y no abrió".

**b) La apertura no depende de un swap en vivo.**
`crearRejilla` solo registra el bot y cobra. La primera compra la hace el motor (keeper) en su primer tick, con reintento automático. Así la apertura es barata, predecible y determinista. Si un swap momentáneo no entra, se reintenta; nunca te deja colgado. Esto mata la intermitencia de raíz.

**c) Conexiones por defecto (reinicializador en el mismo upgrade).**
Dejar puestos de una vez: `staking`, `contabilidad`, `owner1` y `owner2` (ambos tu wallet, intercambiables con su setter) y `stakingBps = 2000`. Nunca más en cero.

**d) El swap que ya funciona, intacto byte a byte.** No se toca.

---

## 7. Rediseño por bot (aquí es donde necesito que decidas)

### Acumulador (modo 1) — propuesta
- Comprar en la entrada y seguir comprando hacia abajo con más capital (ya existe).
- Llevar el **precio promedio** de toda la posición.
- Cuando el precio llegue a **promedio × (1 + objetivo%)**, vender **TODA la posición de una vez** (con piso on-chain: los ingresos deben ser ≥ costo total × (1 + objetivo%), para que nadie te lo ejecute por debajo).
- Después **re-armarse solo**: nueva entrada = precio de venta, nueva rejilla hacia abajo, nuevo objetivo. Sin firma del usuario.

**DECISIÓN 1 — cómo se re-arma (por el límite de tamaño):**
- **Opción A (re-centro on-chain puro):** el contrato recalcula los niveles nuevos desde el oráculo. Es lo más "puro" (ni el keeper interviene), pero es la que MÁS código suma, y con el contrato tan lleno puede no caber. Para esto casi seguro hay que mover lógica a librería externa.
- **Opción B (re-armado por el keeper, invisible para ti):** al vender todo, el contrato deja el bot "listo para re-armar"; el keeper, en el mismo tick, lo vuelve a montar con los niveles nuevos. El usuario no firma ni se entera; el keeper ya está llamando en cada paso de todos modos. Pesa mucho menos on-chain.

Mi recomendación honesta: **B**, por el tamaño. Es automático e invisible igual, y nos deja margen. Pero tú decides.

### Cash Out (modo 2) — propuesta
Hoy es una orden limit de un tiro. Te doy opciones reales, sin prometerte lo imposible (ningún bot gana en una caída sostenida sin promediar o sin aguantar):

**DECISIÓN 2 — qué hacemos con el Cash Out:**
- **Opción A (venta escalonada / trailing):** en vez de vender todo en un punto, vende por tramos a medida que sube, y si empieza a bajar desde un pico, suelta el resto (trailing). Captura más si sube, no se queda esperando un número exacto.
- **Opción B (Cash Out con colchón):** si el precio no sube al objetivo y empieza a caer, el bot compra más barato con capital reservado para bajar tu precio promedio, y vuelve a intentar salir en verde (parecido al acumulador pero partiendo de lo que ya tienes). Necesita que reserves capital extra.
- **Opción C (stop para limitar pérdida):** mantiene la venta objetivo, pero agrega un stop: si cae por debajo de un límite, vende para no comerte toda la caída. No te hace ganar, pero te saca antes del -40%.
- **Opción D:** combinación (objetivo arriba + stop abajo + trailing).

Dime cuál te hace sentido para tu usuario. Mi recomendación para "que tenga chance real y limite el daño": **D** (trailing arriba + stop abajo). Pero es tu producto, tú mandas.

### DCA (modo 3) — propuesta
**DECISIÓN 3 — DCA:**
- **Opción A:** mantenerlo y **blindar el intervalo on-chain** (que el contrato no deje comprar antes de tiempo, no depender solo del keeper).
- **Opción B:** reemplazarlo por un bot que sí uses (por ejemplo, un "DCA inteligente" que compra más cuando el precio cae más, no a ciegas por tiempo).

### Smart Grid (modo 0)
Lo dejo igual (su lógica está bien), solo heredando la atomicidad y el reintento de la primera compra. Salvo que quieras tocarle algo.

---

## 8. Estrategia de tamaño (24576 bytes)

Esto es lo que hace viable todo lo de arriba sin que reviente el límite:
- Mover la **lógica de ejecución de los bots** (pasos de compra/venta, re-armado) a una **librería externa enlazada**, como ya se hace con SwapLib. Las librerías externas NO cuentan para el límite de 24 KB del contrato principal.
- El contrato principal queda delgado (almacenamiento + orquestación); la "inteligencia" de cada bot vive en la librería.
- **Lo mido compilando** con tus ajustes exactos (0.8.22, runs 1, shanghai) y te reporto el tamaño real antes de desplegar. Si no cabe, se recorta, no se fuerza.

El almacenamiento (orden de variables) NO se toca: todo lo nuevo va al final, para no corromper los bots y saldos existentes.

---

## 9. Qué necesito de ti (solo esto, y arranco a construir)

1. **Decisión 1 (Acumulador re-armado):** A (on-chain puro) o B (keeper invisible). Recomiendo B.
2. **Decisión 2 (Cash Out):** A, B, C o D. Recomiendo D.
3. **Decisión 3 (DCA):** mantener y blindar (A) o reemplazar (B).
4. ¿El Smart Grid lo dejo como está (solo heredando los arreglos)? Sí/No.

Con esas cuatro respuestas, construyo UNA sola implementación nueva (más la librería), la compilo, mido que entre bajo 24576, verifico que el swap quede byte a byte y el almacenamiento intacto, y te la entrego con la guía de despliegue. Un solo deploy, sin perder tus bots.
