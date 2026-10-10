# Cash Out Avanzado — especificación para confirmar ANTES de construir

Esto es lo que entendí de tu diseño, formalizado. No escribo contrato hasta que me digas "está correcto o corrige esto". Es el bot más complejo que vamos a tener; vale la pena clavarlo en papel primero.

---

## 0. Verdad de arquitectura (hay que tenerla clara)

Un contrato on-chain NO puede mirar el precio solo ni colocar o cancelar órdenes limit por su cuenta. Aquí una "orden limit" es: el contrato guarda el nivel (precio objetivo + monto), y Cloudflare vigila el precio y le dice al contrato "el nivel X se tocó, ejecútalo".

Reparto, respetando tu regla:
- **Cloudflare (keeper):** solo DISPARA. Avisa "el precio tocó este nivel de compra", "tocó el objetivo de venta", "rompió el límite inferior". Eso es lo que ya hace hoy.
- **Contrato (on-chain):** ejecuta el swap, promedia, recalcula el límite inferior, re-monta la posición y reconstruye la escalera. TODA la inteligencia vive aquí, nada en Cloudflare.

Así Cloudflare no re-arma nada; solo avisa que llegó el momento.

---

## 1. Apertura (se abre con la moneda, no con USDT)

- El usuario trae la moneda (DOGE, BTC, BNB… en BSC) y define: **% objetivo** (10%, 15%…) y **límite inferior** (obligatorio, nuevo campo).
- Al abrir, a precio de entrada P0:
  - **Vende el 50% de la moneda a USDT.** Esa es la "pólvora" para comprar en la caída.
  - El otro **50% queda como posición inicial** (su costo es P0).
  - Coloca una **escalera de compras** desde P0 hacia abajo hasta el límite inferior, repartiendo la pólvora.
  - La posición se arma para **vender a P0 × (1 + objetivo)**.

---

## 2. Modelo unificado (mi recomendación senior — CONFIRMA)

En vez de arrastrar "dos mitades" por separado, llevo UNA sola posición con su costo:
- **posición** = toda la moneda que tiene en ese momento.
- **costo** = USDT total gastado en esa moneda.
- **promedio** = costo ÷ posición.
- Vende SIEMPRE **toda la posición** cuando el precio llega a **promedio × (1 + objetivo)**, con **piso on-chain = costo × (1 + objetivo)**. Imposible salir en pérdida.

Esto cubre tus dos casos con una sola regla:
- Si el precio **sube** primero: el promedio es P0, vende la posición inicial a P0 × 1.10.
- Si **baja** primero: las compras de abajo se llenan, el promedio baja, la posición crece, y vende todo cuando el promedio esté +objetivo.

Es exactamente lo que pediste ("sale cuando en promedio está en positivo"), pero sin la complejidad de rastrear mitades. Más simple = más confiable = cabe mejor en el límite de tamaño.

---

## 3. Regla única cada vuelta (SIMPLIFICADA — sin vuelta 1 ni vuelta 2)

El bot SIEMPRE mantiene su capital partido en dos mitades:
- **Mitad posición:** la moneda que tiene, puesta a vender a promedio × (1 + objetivo).
- **Mitad pólvora:** USDT en la escalera de compras, del precio actual al límite inferior.

Cuando vende toda la posición con ganancia, la ganancia engorda el capital total. La próxima vuelta se vuelve a partir 50/50 desde el precio actual (escalera reconstruida). Como el total creció, las DOS mitades crecen.

Eso produce SOLO tu reparto 50/50 de la ganancia, sin reglas especiales:
- Sacas $50 de ganancia → la próxima vuelta la posición crece ~$25 (más capital de recompra) y la escalera crece ~$25 (cada orden más gorda). Igual siempre, cada vuelta.

Compounding puro: cada venta en verde agranda el bot. Sin "vuelta 1 / vuelta 2", una sola regla que se repite.

---

## 4. Cómo se cubre el "hueco" (CONFIRMA)

Tú describiste cancelar las órdenes de más abajo y subirlas para tapar el hueco cuando el precio sube y re-montas arriba.

**Reconstruir la escalera entera desde el precio actual hacia abajo LOGRA ESO MISMO, y mejor:** la escalera siempre arranca justo debajo del precio actual, así que nunca queda un hueco entre donde vendió y donde están las compras. No hay que mover órdenes una por una; se rehace centrada en cada vuelta. Mismo objetivo, menos piezas móviles, menos riesgo de bug.

---

## 5. Límite inferior dinámico (grid infinito hacia abajo)

Si el precio **rompe por debajo** del límite inferior, el contrato **baja el límite inferior** y extiende la escalera más abajo, para seguir promediando en caídas largas. La regla exacta del recálculo está en las preguntas (tu ejemplo 16.000 → 15.200 no me cuadró la matemática, por eso pregunto).

---

## 6. Ejemplo numérico (demuestra lo bueno del bot)

Abres con **$1000 en DOGE a $0.10** (10,000 DOGE). Objetivo 10%, límite inferior $0.08.

**Apertura:**
- Vende 50% (5,000 DOGE) → **$500 USDT** (pólvora).
- Posición = 5,000 DOGE, costo $500, promedio $0.10. Objetivo de venta: $0.11.
- Escalera de compra: $500 repartidos de $0.10 a $0.08.

**El precio CAE a $0.08** y se llenan las compras:
- Los $500 compran ~6,250 DOGE más.
- Posición = 11,250 DOGE, costo = $1000, **promedio = $0.0889**. Nuevo objetivo: $0.0978.

**El precio se recupera a $0.0978** (ojo: ¡sigue POR DEBAJO de tu entrada de $0.10!):
- Vende las 11,250 DOGE → **$1100**. Ganancia **$100 (10%)**.

Aquí está la magia: **ganaste el 10% aunque el precio nunca volvió a tu precio de entrada.** Una orden limit normal seguiría esperando en rojo. Eso es lo que ningún bot simple hace.

- Vuelta 1: $550 a pólvora, $550 re-monta (compra a $0.0978, objetivo +10%, reconstruye la escalera hasta el límite inferior).

---

## 7. Decisiones CONFIRMADAS por el usuario

1. Modelo unificado + reconstrucción de escalera: **CONFIRMADO.** (Nada de mover órdenes una por una.)
2. Reparto de ganancia: **SIMPLIFICADO a regla única** (sección 3). Sin vuelta 1 / vuelta 2. Cada venta en verde parte el capital 50/50 y re-monta; la ganancia engorda las dos mitades.
3. Límite inferior dinámico: **CONFIRMADO.** La escalera baja por pasos; mientras haya pólvora sigue poniendo compras más abajo del límite inicial; cuando se acaba la pólvora, ese es el piso real.
4. % objetivo desde la config del Cash Out: **CONFIRMADO.**

## 8. Resumen del bot en 5 líneas

1. Abre con la moneda; vende 50% a USDT (pólvora), 50% queda como posición.
2. La pólvora es una escalera de compras del precio actual al límite inferior; si el precio cae, compra y baja el promedio.
3. Vende TODA la posición a promedio × (1 + objetivo), con piso on-chain = costo × (1 + objetivo). Nunca en pérdida.
4. Con lo recaudado parte 50/50 otra vez y se re-monta desde el precio actual (escalera reconstruida, sin huecos). La ganancia engorda las dos mitades → compounding.
5. Límite inferior dinámico; guardas de redondeo para aguantar desde $1 hasta miles de millones.

## 9. Cómo se construye

Cash Out como **librería dedicada (CashOutLib)**. Antes de entregar nada: **pruebas locales** de escenarios (sube, baja, lateral, caída larga, montos extremos de $1 y de miles de millones) para comprobar el promedio, el piso sin pérdida, el re-montaje sin huecos y el redondeo. Nada sin probar.
