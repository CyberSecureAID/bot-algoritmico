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
