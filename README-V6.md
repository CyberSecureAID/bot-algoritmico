# CriptoCuba Oficial — README V6 (Diseño del motor Staking + Futuros)

> **Propósito.** Continúa `README-V5.md` (contratos P2P, staking al 20 %, plan de
> unificación). Este documento **congela el diseño completo** del sistema de **Staking
> como motor de préstamos de Futuros**: cómo entra el capital, cómo se valora, cómo se
> presta a los traders, cómo se liquida y cómo se reparten las ganancias. Es la pieza
> más grande y delicada del proyecto (maneja millones), así que se documenta **antes**
> de escribir el contrato final, para no perder ni un detalle y construir por piezas
> auditando cada una. Léelo junto con V1–V5.

---

## 0. La idea en una frase

**El Staking no es solo una hucha que reparte comisiones: es la liquidez que hace
posible el área de Futuros.** Quien aporta al Staking presta (internamente, sin darse
cuenta ni mover nada) el capital con el que los traders abren posiciones apalancadas.
A cambio, el aportante gana el 20 % de todo lo que genera la plataforma **y** el 50 %
de todo lo que genera Futuros (comisiones + liquidaciones), repartido según su
participación económica.

---

## 1. Reglas de dinero INVIOLABLES de este sistema

- **El capital del staker reposa en la moneda que depositó.** Si deposita BTC, retira
  BTC (la **misma cantidad exacta**). Jamás se le devuelve en otra moneda ni una
  cantidad distinta. *(Regla de oro: "si deposito 1 BTC, no me puedes devolver 0,8 BTC".)*
- **Nadie cobra con el dinero de nadie.** La ganancia de un trader sale de la
  **valorización del mercado** de la posición, no del bolsillo de otro usuario. La
  pérdida de un trader **repone** exactamente lo que se devaluó el préstamo. El
  principal del staker queda **siempre íntegro**.
- **El peso en el reparto se fija en USD por ORÁCULO al momento del depósito**, nunca
  por lo que diga el usuario (eso sería regalar la estafa). Chainlink para las grandes;
  precio de PancakeSwap para las shitcoins.
- **Los roles asignados por el admin no pueden retirar capital que no existe.** Cobran
  recompensas de verdad, pero su "participación asignada" nunca da derecho a sacar
  dinero real. Doble candado: contrato (mira solo `real`) y UI (oculta el botón).

---

## 2. Flujo de una operación LONG (ejemplo real)

Pepito abre **long de BTC** con **$10** a **100×**, sin stop-loss.

1. Necesita $1000 de exposición → el motor **pide $1000 prestados al Staking** en el
   mismo instante (lo gestiona el contrato, Pepito no ve ni toca ese dinero).
2. El contrato **compra $1000 de BTC en spot** (PancakeSwap). Ese BTC comprado **es** el
   respaldo de la posición. En spot no hay precio de liquidación ni funding de exchange:
   ese riesgo lo modela nuestro contrato.
3. **Si BTC baja 0,75 %** desde la entrada: el préstamo de $1000 vale ahora $992,50 →
   pérdida de $7,50. Pepito tenía $10; a **1 % de caída** (−$10) se **liquida al 100 %**.
   Al cerrar, el BTC se vuelve a **USDT al instante** para no perder ni un centavo más.
4. **Reposición:** de los $10 de Pepito se toman los $7,50 (o lo que se haya devaluado el
   préstamo hasta el cierre) para **dejar el principal del staker íntegro**. El resto de
   lo liquidado se reparte **50/50** entre plataforma y aportante de la liquidez.
5. **Si BTC sube 1 %:** el préstamo vale $1010 → Pepito gana $10 (dobló). Ese beneficio
   sale de la **valorización** de la posición; el principal del staker sigue intacto.
   Nosotros cobramos **comisión de cierre**, repartida **50/50** plataforma/aportante.

**Clave que hace que todo cuadre:** el apalancamiento es **proporcional al volumen
disponible**. La pérdida máxima del trader (su capital) **nunca supera** lo que se
devaluó el préstamo. Por eso los $10 de Pepito **siempre alcanzan** para reponer.

## 3. Flujo de una operación SHORT (el espejo)

Pepito abre **short de BTC** con **$10** a **100×** → pide $1000 prestados.

1. En vez de comprar BTC, el motor **toma prestado el BTC equivalente a $1000 y lo vende
   a USDT** de inmediato (queda con $1000 en USDT y una **deuda en BTC**).
2. **Si BTC baja 0,75 %:** recomprar la deuda de BTC cuesta $992,50 → **sobran $7,50**
   de ganancia para Pepito.
3. **Si BTC sube 0,75 %:** recomprar cuesta $1007,50 → los $10 de Pepito reponen esos
   $7,50 de más; a **1 % de subida** se **liquida**.
4. Reposición del préstamo y reparto **50/50** exactamente igual que en long.

Long y short son simétricos: en ambos, la pérdida del trader repone la devaluación del
préstamo y el principal del staker no se toca.

## 4. Stop-loss

El stop-loss **no cambia la correlación**, solo **limita la pérdida** antes de la
liquidación total. Ejemplo: Pepito con $10 pone SL a −50 %. Cuando el mercado va 0,5 %
en su contra, pierde $5 (la mitad de su capital) y el préstamo se ha devaluado ~$5.
Esos $5 que se le quitan a Pepito **reponen** el capital devaluado del préstamo. Con SL
no se le quita nada extra: solo su pérdida hasta el SL más las comisiones de cierre.

---

## 5. Valoración del capital y participación (el oráculo)

- Al depositar, el contrato **consulta el oráculo** y fija el **valor en USD** del
  aporte. Ese valor USD es el **peso** de esa wallet en el reparto del 20 %/50 %.
- **No se paga por valorización del peso:** si depositas $1M en BNB y BNB sube, tu
  **peso de reparto sigue siendo $1M** (el valor declarado al entrar). El reparto no
  fluctúa con el mercado; se basa en lo que declaró el oráculo al depositar.
- **Sumar peras con manzanas:** como uno puede poner BTC y otro USDT, no se puede sumar
  "1 BTC + 1000 USDT". Por eso **todo peso se mide en USD** vía oráculo. Así el reparto
  es justo entre monedas distintas.
- **Oráculo:** Chainlink para tokens grandes (BNB, BTC, ETH, y las que tengan feed);
  para shitcoins sin feed, el **precio spot de PancakeSwap** en el momento del depósito.
  El admin marca en el panel qué tokens se aceptan y con qué fuente de precio.

---

## 6. Dos opciones para el usuario al aportar (con explicación clara)

El usuario elige, y se le explica el riesgo de cada una:

- **"Holdear en mi moneda"** (por defecto): tu BTC sigue siendo BTC. Si BTC sube, ganas
  también por **valorización** (estadística aparte: *"Ganancia por valorización"*); si
  baja, tu capital vale menos en USD. Solo se intercambia a USDT lo justo cuando se
  cierran posiciones que usaron tu liquidez y cuando se cobran tus comisiones.
- **"Conservar en USDT"**: tu parte se fija en USDT al cerrar las posiciones que usen tu
  liquidez. Estable, sin riesgo de que el precio de tu moneda baje, pero tampoco ganas
  por valorización.

**Importante para la UI:** dejar clarísimo en qué moneda reposa el dinero en cada
momento, para que un inversor de millones sepa exactamente a qué está expuesto.

---

## 7. Reparto: quién aporta cuánto al Staking

| Fuente | Aporta al bote de stakers |
|---|---|
| Swap, P2P, Bots, Academy, Prize Pool, Seguridad | **20 %** de lo que generen |
| **Futuros** | **50 %** de todo (comisiones de apertura/cierre, funding cada 8 h, y el sobrante de cada liquidación tras reponer el préstamo) |

- El **funding cada 8 h** que se le cobra al trader se reparte **50/50**
  plataforma/aportante.
- El **sobrante de una liquidación** (lo que queda tras reponer el préstamo) se reparte
  **50/50**.
- Todos los porcentajes (20 %, 50 %, funding, comisión de unstake) **editables desde el
  panel administrativo**, guardados en `Tarifas`.

---

## 8. Arquitectura de contratos (lo que hay que construir)

Este sistema son **varios contratos interconectados**, todos proxy UUPS, todos leyendo
el owner y los % de `Tarifas`:

1. **Oráculo** (`OraculoPrecios`): da el valor USD de cualquier token de BSC (Chainlink
   si tiene feed; si no, PancakeSwap). Base de todo lo demás.
2. **Staking** (`Staking`): bóveda no custodial. Capital por token (se devuelve en la
   misma moneda y cantidad), valoración en USD por oráculo, reparto del 20 %/50 % con el
   patrón `accRewardPerShare` (gas constante, exacto al céntimo), participación asignada
   por admin, opción hold/USDT, pausa y retirada de emergencia. Presta a Futuros y
   recibe de vuelta.
3. **Futuros** (`Futuros`): el motor. Pide prestado al Staking, ejecuta long/short en
   spot vía PancakeSwap, calcula liquidación, repone el préstamo, cobra comisiones y
   funding, y reparte 50/50. Nace leyendo de Tarifas y del Staking.
4. **Tarifas** (ya desplegado): registro central de % (incluye `stakingBps`,
   `unstakeBps`, y % por servicio con Futuros al 50 %). Requiere upgrade V2 para los
   campos de staking (ya preparado en `contracts/Tarifas_V2.sol`).
5. **PanelStaking** (`PanelStaking`): solo lectura. Vistas ricas para el inversor: APR
   estimado en tiempo real, TVL total y por token, ranking de participación, tu posición
   detallada (fecha de aporte, monto, plazo, % del bote, ganado por token, ganancia por
   valorización, pendiente), cifras globales. Separado para no inflar el núcleo.

---

## 9. Estado actual del contrato `Staking` (primer borrador)

Ya existe un primer `Staking.sol` (compila, 18748 bytes, 0 warnings) con: reparto
multi-token por `accRewardPerShare`, participación real + asignada con la salvaguarda
(los asignados no retiran capital inexistente), stake/unstake con comisión editable,
reclamar recompensas, pausa y retirada de emergencia, UUPS con espera 48 h, y lectura de
Tarifas. **Le falta, respecto a este diseño final:** valoración en USD por oráculo
(punto 5), opción hold/USDT (punto 6), integración con el motor de préstamo de Futuros
(puntos 2–4), y el % de Futuros al 50 %. Se reescribirá pieza por pieza.

---

## 10. Salvaguardas de seguridad de todo el sistema

- **UUPS + espera de 48 h** en cada upgrade.
- **CEI + no reentrada** en todo lo que mueve fondos.
- **Rechazo de fee-on-transfer** (se compara balance antes/después).
- **Rescate solo del excedente** (nunca capital de stakers).
- **Roles asignados sin acceso a capital real** (doble candado contrato + UI).
- **Apalancamiento proporcional al volumen disponible** (tope 200×): si hay poca
  liquidez, el apalancamiento máximo baja, para que la pérdida del trader nunca supere
  la devaluación del préstamo.
- **Cierre y conversión a USDT instantáneos** al liquidar, para no perder valor.
- **Oráculo obligatorio** para valorar aportes: nunca se confía en lo que declara el
  usuario.

---

## 11. Plan de construcción (por piezas, auditando cada una)

1. **Oráculo de precios** (Chainlink + PancakeSwap). Base de todo.
2. **Staking final**: valoración USD, opción hold/USDT, reparto 20 %/50 %.
3. **Futuros**: motor de préstamo long/short, liquidación, reparto 50/50.
4. **Tarifas V2** (upgrade): % de staking, unstake y Futuros al 50 %.
5. **PanelStaking**: vistas ricas para el inversor.
6. **Interconectar todo** y conectar el panel administrativo.
7. **Frontend nuevo** de Staking y Futuros (web y móvil), a la altura de manejar
   millones, con explicación clara de en qué moneda reposa el dinero y de las dos
   opciones (hold/USDT).

**Principio:** no se conecta ni se despliega nada a ciegas. Contrato por contrato: se
escribe, se testea aislado con números (verificar que el reparto cuadra al céntimo y que
las liquidaciones reponen exacto), se conecta al registro central, se re-testea
conectado, y solo entonces se pasa al siguiente.

---

## 12. Direcciones vigentes (recordatorio de V5)

- **Owner principal:** `0x97e0…bca7d`
- **Tarifas (proxy):** `0x068729CBB708713266FFdE2374e51db2B063FD7C`
- **PerfilesP2P (proxy):** `0xC01B61B702011747B4c0Ee6B5F2d0F2b4B66880c`
- **MercadoP2P (proxy):** `0x17B47a8Fb97F8980b96c94E4b9137182e0Bf8025`
- **Red:** BNB Smart Chain, chainId 56. **Compilador:** Solidity 0.8.24, optimizer
  runs 200, EVM shanghai, sin viaIR, MIT.

---

## 13. ACTUALIZACIÓN — Contratos escritos, testeados y estructura (sesión actual)

Se escribieron, compilaron y testearon los contratos del motor Staking + Futuros.
Todos UUPS, Solidity 0.8.24, optimizer runs 200, EVM shanghai, sin viaIR, MIT.

### 13.1. Estructura de carpetas del repo (`contracts/`)

```
contracts/
├── core/        → Tarifas.sol, Tarifas_V2.sol      (registro central, cerebro de TODA la plataforma)
├── p2p/         → PerfilesP2P.sol, MercadoP2P.sol   (marketplace)
├── staking/     → OraculoPrecios.sol, Staking.sol, PanelStaking.sol
├── futures/     → Futuros.sol
└── (raíz)       → GridBotV10.sol, IntercambioBot.sol
```

> **Tarifas NO es del P2P:** es el cerebro central de toda la plataforma. Vive en `core/`.

### 13.2. Estado de cada contrato

| Contrato | Carpeta | Estado | Test |
|---|---|---|---|
| OraculoPrecios | staking | escrito, compila (8260 b) | **4/4 ✓** |
| Staking | staking | escrito, compila (20638 b) | **8/8 ✓** |
| PanelStaking | staking | escrito, compila (6820 b) | **7/7 ✓** |
| Tarifas_V2 | core | upgrade de Tarifas, compila (10196 b) | **6/6 ✓** (upgrade conserva storage) |
| Futuros | futures | escrito, compila (13982 b) | contabilidad ✓, **ejecución PancakeSwap pendiente** |

Cuatro contratos listos para desplegar. Futuros necesita completar su ejecución real
en PancakeSwap (comprar al abrir long, vender al cerrar; vender al abrir short,
recomprar al cerrar) — el test destapó que sin ese swap real el motor no tiene de dónde
generar la ganancia. Se completa en sesión aparte.

### 13.3. Qué validó cada test (números reales)

- **Oráculo:** USDT=$1, BTC por Chainlink=$60.000 (normalizado), 2 BTC=$120.000, SHIB
  por PancakeSwap=$0,06. Precio exacto en ambas rutas.
- **Staking:** una ballena de $1.000.000 cobra **exactamente 1.000.000×** lo del pez de
  $1 (reparto proporcional al céntimo). Nada se pierde. La participación asignada por el
  admin **cobra recompensas pero NO puede retirar capital que no existe**. El capital se
  guarda y devuelve en su misma moneda (2 BTC → 2 BTC).
- **Tarifas V2:** el upgrade V1→V2 **conserva todo el storage** (comisiones, exentos).
  Espera de 48 h respetada. Campos nuevos (staking 20 %, futuros 50 %, unstake 1 %)
  editables.
- **PanelStaking:** el capital del inversor **nunca desaparece** de sus estadísticas
  aunque esté prestado a Futuros. Muestra total / en uso (trabajando) / disponible.

### 13.4. Cambios técnicos hechos durante el testeo

- **OraculoPrecios:** `FACTORY` de PancakeSwap pasó de constante a **editable** (por si
  cambia el router). `_decimals` ahora tolera cuentas sin código (robusto).
- **Futuros:** dirección de `USDT` pasó de constante a **editable** por el admin.
- **Staking:** añadidas `prestar` / `devolver` / `disponibleParaPrestar` para que el
  motor de Futuros pida y devuelva liquidez, con contabilidad de `prestado` por token.

---

## 14. Estructura completa del área de FUTUROS (para el frontend y para dejar clara la lógica)

> Esta explicación va en el frontend, tanto en el **área de Futuros** como en el **área
> de Staking** ("¿cómo generan ingresos mis fondos?"). Redactada de forma neutra.

### 14.1. Cómo funciona (y de dónde salen las ganancias)

Cuando operas en Futuros, usas liquidez que aportan otras personas en Staking. Tu dinero
y el de ellos nunca se mezclan ni se regalan: cada ganancia sale del propio movimiento
del mercado.

**Si operas en LONG** (crees que el precio sube): con la liquidez (en USDT) se compra la
moneda al precio de entrada. Si el precio sube, esa moneda se vende más cara y la
diferencia es tu ganancia. Si baja, la pérdida sale de tu capital, y quien aportó la
liquidez recupera su USDT completo.

**Si operas en SHORT** (crees que el precio baja): la liquidez pone **la propia moneda**
(por ejemplo Bitcoin, BNB o Ethereum — NO USDT) y se vende de inmediato al precio de
entrada. Queda pendiente devolver esa misma moneda. Si el precio baja, se recompra más
barata para devolverla, y lo que sobra es tu ganancia. Si sube, la diferencia sale de tu
capital, y quien aportó la liquidez recupera su moneda completa.

En los dos casos la idea es la misma: vender más caro de lo que se compró. Esa diferencia
la genera el mercado, no otro usuario. Quien aporta liquidez siempre recupera exactamente
lo que puso, en su misma moneda.

### 14.2. La regla nueva del SHORT (importante)

El short **no se respalda con USDT convertido**, sino con **la moneda que se shortea**.
Para que haya shorts de Bitcoin, tiene que haber Bitcoin aportado en el Staking; para
shorts de BNB, BNB; y así. **El Staking condiciona la disponibilidad de Futuros:** las
monedas que la gente aporta en Staking son las que se pueden operar (y shortear) en
Futuros. Si solo hay USDT, solo se pueden abrir longs.

### 14.3. Ganancia, pérdida, stop-loss y liquidación (con números)

Ejemplo: el usuario abre con **$10** de margen, **100×** de apalancamiento → posición de
**$1.000**. La liquidez presta esos $1.000 (en USDT si es long, en la moneda si es short).

- **Long que gana:** el precio sube 1 % → la posición vale $1.010 → se devuelven $1.000 a
  la liquidez y **sobran $10** para el usuario. Ganancia de la subida.
- **Long que pierde / se liquida:** el precio baja ~1 % → la pérdida (~$10) consume el
  margen del usuario. Al llegar al **precio de liquidación** se cierra; el margen perdido
  repone lo que se devaluó el préstamo. La liquidez vuelve completa.
- **Short que gana:** el precio baja → se recompra la moneda más barata para devolverla y
  **sobra** la diferencia para el usuario. Ganancia de la bajada.
- **Short que pierde / se liquida:** el precio sube → la diferencia sale del margen del
  usuario; al llegar a la liquidación se cierra y la moneda vuelve completa a la liquidez.
- **Stop-loss:** no cambia la correlación, solo **limita la pérdida** antes de la
  liquidación total. Si el usuario pone SL a −50 %, cuando el mercado va 0,5 % en su
  contra pierde la mitad de su margen; esa parte repone el préstamo y no se le quita nada
  extra salvo comisiones.

**Clave que hace que todo cuadre:** el apalancamiento es **proporcional a la liquidez
disponible** (tope 200×). La pérdida máxima del usuario (su margen) nunca supera lo que se
devaluó el préstamo, así que su margen siempre alcanza para reponer. El principal de quien
aporta liquidez queda **siempre íntegro**.

### 14.4. Cómo se reparten las comisiones

- Comisiones de **abrir** y **cerrar** posición: **50 % para quienes aportan liquidez**
  (según su participación) y **50 % para la plataforma**.
- **Funding** (comisión por mantener el préstamo activo, cada cierto tiempo): **50/50**.
- **Liquidación:** se toma el **75 %** para reponer la liquidez usada, y del **25 %
  restante**, **mitad para quienes aportan liquidez** y **mitad para la plataforma**.

Para quien aporta en Staking, sus fondos generan ingresos de dos formas: el **20 %** de
todas las comisiones de la plataforma, y el **50 %** de todo lo que genera Futuros
(comisiones, funding y liquidaciones). Todo repartido según cuánto ha aportado.

---

## 15. El keeper (quién dispara órdenes limit y liquidaciones)

Un smart contract no se dispara solo: alguien tiene que llamarlo cuando el precio llega.
Estrategia acordada, de coste bajo:

1. **"Cualquiera puede liquidar":** la función de liquidar es pública y paga una **propina
   porcentual del margen** (editable desde el panel, empieza ~0,5 % del margen — céntimos)
   a quien la ejecute. Bots externos que vigilan BSC lo hacen solos por esa propina; a la
   plataforma **le cuesta $0** (sale del margen ya perdido en la liquidación). El evento
   `Abrir` que emite el contrato es lo que esos bots leen para detectar posiciones.
2. **Cloudflare Worker de pago (~$5/mes):** respaldo para las órdenes limit y para
   liquidar mientras hay poco volumen y aún no aparecen bots externos.
3. **Chainlink Automation / Gelato:** se añade como respaldo descentralizado más adelante,
   cuando haya volumen y presupuesto (tiene coste por disparo).

La propina de liquidación **no es un cargo extra al usuario**: solo existe cuando alguien
se liquida, y sale de lo que ese usuario ya perdió.

---

## 16. Próximos pasos actualizados

1. Desplegar los cuatro contratos listos (Oráculo, Staking, PanelStaking) + upgrade de
   Tarifas a V2. **Interconectarlos** (setOraculo, setTarifas, setStaking, autorizar
   contratos, permitir tokens).
2. Completar la **ejecución real de Futuros** en PancakeSwap + la propina de liquidación,
   y testearlo entero.
3. **Frontend nuevo de Staking** (web y móvil): rediseño a nivel corporativo, con la lista
   de monedas a elegir (USDT, Bitcoin, y demás en orden de importancia), la explicación de
   la sección 14, el panel del usuario (capital total / en uso / disponible), ganancia por
   valorización, y las dos opciones (holdear en su moneda / conservar en USDT).
4. **Frontend nuevo de Futuros** (web y móvil) con órdenes limit y a mercado.
5. Upgrades de Swap, Bots, Academy y Prize Pool para aportar su 20 % al Staking.
6. Conectar el panel administrativo a Tarifas V2 y al Staking.

### Direcciones nuevas de esta sesión (al desplegar, anotar aquí)

- **Tarifas V2 (nueva implementación del proxy existente):** _por desplegar_
- **OraculoPrecios (proxy):** _por desplegar_
- **Staking (proxy):** _por desplegar_
- **PanelStaking:** _por desplegar_
- **Futuros (proxy):** _tras completar ejecución_

---

## 17. ACTUALIZACIÓN — Despliegue, interconexión y 30 monedas (sesión actual)

### 17.1. Contratos desplegados en BSC mainnet

| Contrato | Proxy (usar esta) | Implementación |
|---|---|---|
| **OraculoPrecios** | `0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3` | `0x0150b62a2355AFc036612B890cbE00F5EcdB8CC7` |
| **Staking** | `0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4` | `0xB96675917b784987F06327a629398ff8637BFc64` |
| **PanelStaking** (sin proxy) | `0xE620D5BD60F70CCdFa4493F3a5B794d1BBEbf8d2` | — |
| **Tarifas V2** (implementación nueva del proxy existente) | proxy `0x068729…FD7C` | impl `0x04341ADf9C371b2cbB504F6722fF2e4Cce470824` |

**Tarifas V2:** upgrade PROPUESTO (protección 48 h). Se activa con `upgradeToAndCall`
a partir del **domingo 20 sep 2026, 1:47 a.m.** en el proxy de Tarifas.

### 17.2. Interconexión hecha

- Staking → `setOraculo(0xf51b…)`, `setTarifas(0x0687…FD7C)`
- OraculoPrecios → `setTarifas(0x0687…FD7C)`
- **Pendiente:** autorizar Futuros en Staking (`autorizarContrato`) cuando Futuros se
  despliegue.

### 17.3. Las 30 monedas configuradas (Oráculo + permitidas en Staking)

Todas verificadas en BscScan. En el Oráculo con fuente PancakeSwap (`2`) salvo BNB
(Chainlink, feed `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE`) y USDT ($1 automático).

USDT, BTCB, ETH, BNB, USDC, XRP, DOGE, CAKE, LINK, DOT, TRX, ADA
(`0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47`), AVAX, LTC, BCH, ATOM, FIL, NEAR, UNI,
AAVE, XVS, INJ, SXP, YFI, ALPHA, FLOKI, BabyDoge, DAI, XTZ, BAT.

> Regla de seguridad aplicada: solo monedas con liquidez profunda y precio confiable.
> Se descartaron ~15 shitcoins sin liquidez (precio manipulable = agujero de seguridad).
> Para añadir tokens nuevos: verificar SIEMPRE token + liquidez antes; en un próximo
> upgrade se añadirá una función batch para configurar muchos a la vez.

### 17.4. Frontend de Staking (web + móvil) — conectado a los contratos

Reescritos y conectados a los contratos reales:
- `assets/js/aportar.js` (web)
- `assets/js/movil/aportar-movil.js` (móvil)

Incluyen: selector de las 30 monedas con logo y precio en vivo (oráculo), valor en USD al
teclear, plazos (30d/3m/6m/1año), opción **holdear en tu moneda / conservar en USDT** con
explicación, **stake** y **unstake** reales, panel del usuario (capital total / en uso
trabajando / disponible / ganancia por valorización / participación % / recompensas por
cobrar), y la sección "cómo generan ingresos tus fondos". Mantiene la estructura anterior
(tabs, plazos, aviso honesto) enriquecida.

**Nota:** aportar (stake) ya funciona. Las recompensas mostrarán 0 hasta que se active
Tarifas V2 y se despliegue Futuros (esperado).

### 17.5. Keeper de Futuros (decidido, para implementar con Futuros)

- **"Cualquiera puede liquidar":** función pública con **propina porcentual del margen**
  (editable, ~0,5 % = céntimos), que solo sale del margen ya perdido en una liquidación.
  Bots externos que vigilan BSC lo ejecutan solos; coste $0 para la plataforma.
- **Cloudflare Worker de pago (~$5/mes):** respaldo para órdenes limit y liquidaciones
  mientras hay poco volumen.
- **Chainlink Automation / Gelato:** respaldo descentralizado más adelante.

### 17.6. Pendientes inmediatos

1. Domingo 20 (1:47 a.m.): activar upgrade de Tarifas V2 (`upgradeToAndCall`).
2. Completar ejecución de Futuros en PancakeSwap + propina de liquidación, y testear.
3. Autorizar Futuros en Staking al desplegarlo.
4. Subir el frontend nuevo de Staking (web + móvil).
5. Configurar en Tarifas V2, desde el panel admin: stakingBps 20 %, stakingFuturosBps
   50 %, unstakeBps 1 %, y `setTesoreriaStaking(0xdC48…)`.
