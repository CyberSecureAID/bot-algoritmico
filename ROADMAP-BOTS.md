# ROADMAP de los bots — qué falta, por qué, cómo (continuidad entre sesiones)

Este archivo existe para que CUALQUIER sesión futura retome sin arrancar de cero.
Lo de abajo está verificado contra el contrato `GridBotV14.sol` y el frontend real,
no es de memoria. Reglas de trabajo: skill `criptocuba-reglas`. Herramientas y
cómo probar: `HERRAMIENTAS-DESARROLLO.md`.

---

## 0) Estado actual (octubre 2026)
- **Cash Out (modo 2): HECHO.** Reconstruido como `CashOutLib` (librería externa),
  apertura atómica ($2.50 por bot dentro de `crearRejilla`), 50/50 con pólvora,
  escalera de recompra, vende todo a promedio+% con **piso on-chain sin pérdida**,
  re-monta 50/50, protección de slippage. Probado 99/99 en EVM local.
- **GridBotV14 desplegado** (impl `0xC79cE08fa85b21ef7cb3d6F10f0aF98c98d3360F`,
  proxy `0x4e86…`), con `SwapLib 0x2eCA…` y `CashOutLib 0x610B…` enlazadas.
- Frontend: apertura atómica ya aplicada (gridbot.js + gridbot-ui.js). Transparency
  actualizado con las librerías (ícono de bot).

### Mapa de bots → modo (en el contrato)
| Bot | modo | Estado |
|---|---|---|
| Grid / "Smart Grid" | 0 | A auditar (comisiones) |
| Acumulador | 1 | A rehacer (AcumLib) |
| Cash Out | 2 | **Hecho** |
| DCA | 3 | A reforzar (cegar intervalo) |

### Modelo de comisión y gas (verificado, NO tocar sin razón)
- **Comisión:** `feeBps = 10` = **0.1%** del swap (`_comision`: `fee = recibido*feeBps/BPS`).
  De esa comisión, **20%** va al stake (`stakingBps = 2000`), el resto a tesorería.
  No hay tarifa fija por operación (esa fue la que se quitó en su momento; por eso
  con ~$1.90 se lograban ~193 ops en vez de <60).
- **Gas:** el usuario deposita BNB como `gasSaldo` (`depositarGas`/`receive`). Por
  cada operación del keeper se le reembolsa el gas real + `gasOverhead` (50000)
  (`_reembolsarGas`). Para operar, el keeper exige `gasSaldo[u] >= gasMinOp` (0.003 BNB).
  Con $2–4 de gas rinde para cientos de disparos de cuadrícula.
- El dueño puede ejecutar sus propios bots sin el requisito de gas del keeper.

---

## 1) PRÓXIMO UPGRADE DEL CONTRATO (GridBotV15) — lo que falta

### a) Acumulador → `AcumLib` (librería externa, como CashOutLib)
- **Qué:** re-armado **on-chain** (Opción A), **vender TODO** a promedio+% (no por
  nivel suelto), **nunca a pérdida** (piso `C*(1+obj)` como el Cash Out), promediado
  real a la baja, y re-arme automático sin huecos.
- **Por qué:** hoy (modo 1) el acumulador compra en escalera (montoC escala con
  `factorBps`) y **vende por-nivel** con piso `margenBps`. Eso deja ventas parciales
  y no capitaliza como el Cash Out. El usuario quiere la misma dinámica probada del
  Cash Out: una regla única por ciclo, vender el total a objetivo, re-armar.
- **Cómo:** `AcumLib` externa espejo de `CashOutLib` (abrir / comprarNivel / resolver),
  operando sobre `struct Rejilla`. Reusar `SwapLib`. Campos nuevos (si hacen falta)
  SIEMPRE al final del struct.

### b) DCA (modo 3): cegar el `intervalo` + DCA INTELIGENTE con take-profit
**b.1 Cegar el intervalo**
- **Qué/por qué:** hoy `intervalo` se guarda en claro en la `Rejilla` → la cadencia de
  compra es legible y frontrunnable.
- **Cómo:** commit-hash del intervalo o disparo por lógica del keeper con prueba, sin
  exponer el periodo. Verificar el camino de ejecución del modo 3 antes de tocar.

**b.2 DCA adaptativo (deseo del usuario, para esta misma etapa del DCA)**
Convertir el DCA de "básico" (solo compra programada) a uno que **entiende su entorno**:
- **Conoce su estado:** cuánto tiene acumulado y su **precio de entrada PROMEDIO**
  (promediado real; el promedio cambia con cada compra).
- **Compra programada por fechas/intervalos** (p. ej. "todos los viernes de cada mes",
  4 compras/mes). Verificar que la granularidad actual (`intervalo` en segundos +
  `comprasMax`) cubre "día de la semana / fechas"; si no, ampliarla.
- **Take-profit OPCIONAL y configurable (NO por defecto — el usuario lo activa):**
  el usuario define un **% de beneficio**; cuando el **PROMEDIO de TODO lo acumulado**
  alcanza ese %, el sistema **vende todo** → queda con más capital para seguir
  recomprando en los días programados. Si el precio vuelve a darle la razón y otra vez
  hay ese % de beneficio, **vuelve a vender** (ingresos compuestos). La venta se dispara
  por **% de beneficio alcanzado**, NO por tiempo.

- **⚠ SALVAGUARDA CRÍTICA (no equivocarse):** la venta se evalúa sobre el **promedio de
  TODA la posición** (coste total acumulado), **nunca** sobre las compras recientes.
  Ejemplo del usuario: compra de $1,000,000 hoy; 6 meses después, 8 compras de $1,000
  que están +16%, pero el precio general cayó 40% → en promedio **sigue en pérdida** →
  **NO se puede vender**, aunque las compras recientes estén en verde.
- **Cómo:** reutilizar EXACTAMENTE el modelo del Cash Out: piso on-chain
  `piso = costeTotalAcumulado * (1 + obj)`; vender la posición completa solo si lo
  recaudado ≥ piso (eso evalúa el promedio por construcción) y re-armar. Si hace falta,
  librería propia (`DcaLib`) espejo de `CashOutLib`, reusando `SwapLib`. Campos nuevos
  al final del struct.

### c) Grid / "Smart Grid" (modo 0): auditar comisiones
- **Qué:** revisar por qué "se atiborra de comisiones" y bajar la agresividad sin
  romperlo. Confirmar la regla **"vender solo en ganancia"**.
- **Por qué:** el grid hace un swap en CADA nivel (compra y venta) → cada swap paga
  0.1% + gas; con muchos niveles/ciclos se acumula. La regla de solo-ganancia ya
  existe vía `margenBps` (en la venta, el mínimo = `coste*(1+margenBps)`), pero hay
  que confirmar que está bien puesta en el flujo del Smart Grid y ver si conviene
  reducir la frecuencia de disparos o agrupar.
- **Cómo:** auditar `ejecutar` modo 0 y los `construirConfig` del grid; medir cuántos
  swaps implica un ciclo típico; proponer una optimización (menos disparos / piso de
  ganancia por nivel) SIN cambiar el modelo de comisión global (0.1% + 20% stake).

---

## 2) CÓMO se implementa un upgrade (receta fija)
1. **Una librería por bot** (externa, `delegatecall`), para que el principal entre
   bajo 24 KB. Enlazar `SwapLib` + la librería del bot.
2. **Storage append-only:** los campos existentes de `Rejilla` y de nivel superior
   NO se mueven; lo nuevo va al final.
3. **Reinicializador** si hay que fijar algo nuevo (`reinitializer(N)` con N por encima
   del último usado; V14 usó 14).
4. **Subir al proxy** con `upgradeToAndCall(IMPL, <calldata del reinit>)` desde el owner.
5. **Actualizar `contracts-data.js`**: impl del GridBot al nuevo + añadir la librería
   nueva (ícono de bot), y subir `?v=` en `transparency.html` e `index.html`.

## 3) VERIFICACIÓN antes de entregar (los 4 candados)
1. Compila (solc 0.8.22, optimizer runs=1, shanghai, bytecodeHash none, **sin viaIR**).
2. Tamaño ≤ **24 576** bytes (deployedBytecode sin metadata).
3. **Storage compatible** con V13/V14 (diff slot a slot; ningún campo se mueve).
4. **Pruebas en EVM local** en verde: núcleo de la lógica + librería por el camino
   real de swap (no custodial) + integración con **proxy UUPS** y librerías enlazadas
   (cobro atómico, abrir/operar/resolver, grid intacto, atomicidad).

## 4) SKILLS / herramientas necesarias
- Skill **`criptocuba-reglas`** (siempre).
- Toolchain local (solc, OpenZeppelin, `@ethereumjs/vm`, `ethers`, `ethereum-cryptography`)
  — ver `HERRAMIENTAS-DESARROLLO.md`. Si se usa una skill nueva, **se anota ahí**.
- La shell NO llega a la RPC de BSC (403): todo se prueba en EVM local; la cadena se
  verifica con datos que confirma el usuario o por BscScan.

## 5) FRONTEND pendiente (después del contrato)
- UI del Cash Out: abrir con la moneda, 50%, campo de límite inferior, botón "Rentable";
  visualizaciones de todos los bots (como la del Smart Grid); tutorial next-next-next
  no salteable tras el disclaimer; actualizar la página "cómo funciona".
- **UI del DCA (take-profit):** añadir un toggle **"Take Profit"** con un campo claro de
  **% de beneficio** (en inglés), y un **ícono de información** (como los demás bots) con
  este texto (borrador EN, afinar al construir):
  > *Take Profit (optional): when the AVERAGE price of everything you've accumulated
  > reaches the profit % you set here, the bot sells your whole position — giving you
  > more capital to keep buying back on your scheduled days. If the price proves you
  > right again and you hit that % once more, it sells again and keeps generating
  > income. It only sells when your average is in profit, never on recent buys alone.*
- FAQ desactualizado: dice "≈$1/mes, bots ilimitados"; ahora es **$2.50 por bot**.
- Unificar el `gridbot.js` duplicado (`assets/js/gridbot.js` es el vivo; hay otro en
  `assets/js/gridbot/` que no se usa).

## 6) CUIDADOS (no romper nada)
- **No romper los swaps:** toda la operación pasa por `SwapLib` (multi-DEX con
  fallback). Cualquier cambio de bot reusa `SwapLib`, no lo reescribe.
- **No custodial:** el capital vive en la wallet del usuario; el contrato jala solo lo
  justo por operación y el swap entrega de vuelta a la wallet.
- **Atomicidad:** cobro y montaje en la misma tx; si se cancela, no hay bot ni cobro.
- **Un solo cambio por entrega** y verificación de causa raíz (criptocuba-reglas).
