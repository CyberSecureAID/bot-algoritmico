# Auditoria de seguridad — SpotDF.sol

Revision de codigo del contrato de Spot (proxy UUPS, BNB Smart Chain, swaps por
PancakeSwap V2). Hecha sobre el fuente entregado. No sustituye una auditoria
profesional independiente ni las pruebas en testnet: el propio contrato lo pide y
lo repito aqui, porque maneja ordenes de pago de usuarios por allowance.

Fecha: 2026-11-20.

---

## Veredicto

El contrato esta bien construido. El diseño no custodial es de verdad: los fondos
viven siempre en la wallet del usuario y entran y salen en la misma transaccion, asi
que el contrato no es un bote que robar. No encontre forma de que un tercero cualquiera
robe fondos directamente. Los riesgos que quedan son los normales de este patron, y uno
de ellos hay que cerrarlo ANTES de encender el keeper de Cloudflare.

---

## Lo que esta bien hecho

- No custodial confirmado: no se guarda capital entre operaciones. Aunque alguien vaciara
  el contrato, no hay nada dentro.
- Guard de reentrancia (noReentrada) en abrir, cerrar y retirar.
- En cerrar se marca la posicion como cerrada ANTES de hacer el swap (efectos antes de
  interaccion), asi un token malicioso no puede reentrar a cerrarla dos veces.
- La comision es 1% SOLO sobre la ganancia, tope fijo en el codigo (FEE_MAX_BPS), y si la
  conversion del fee falla no se cobra y no deja nada atascado (try/catch que devuelve 0).
  Abrir es gratis.
- Cada swap aprueba al router lo justo y lo deja en cero despues (forceApprove a 0). No
  quedan permisos abiertos hacia el router.
- Usa las variantes SupportingFeeOnTransferTokens y mide el saldo real recibido, asi
  funciona con tokens con impuesto de transferencia.
- Envios de BNB con patron pull (saldoRetirable) si un destino no puede recibir: nada se
  traba ni revierte el cierre.
- Cambio de owner en dos pasos (proponer / aceptar).
- receive() solo acepta BNB del router: no se traba BNB de nadie.
- La pausa NO bloquea cerrar: el usuario siempre puede salir aunque este pausado.
- El keeper NO recibe el resultado del swap: la salida va a la wallet del usuario. Un
  keeper no puede quedarse el dinero directamente.

---

## Hallazgo critico (cerrar ANTES de encender el keeper)

### 1. floorOut queda en 0, y con eso el cierre por keeper no tiene piso

El contrato hace lo correcto: si quien cierra no es el dueño, exige que sea keeper y que
`minOut >= floorOut` (linea 210), y el swap exige recibir `>= minOut`. O sea, el usuario
nunca recibe menos que su piso. El problema no esta en el contrato, esta en que HOY el
front abre las posiciones con `floorOut = 0` (contrato.js, parametro por defecto).

Con floorOut = 0, un keeper puede cerrar con minOut = 0, que acepta cualquier salida.
Mientras cierras tu a mano no pasa nada (tu cierre usa su propio anti slippage del 1%).
Pero en cuanto el keeper de Cloudflare dispare TP/SL, un keeper comprometido, o un bot
MEV que haga sandwich alrededor de la tx del keeper, podria cerrar casi a cero y robarte
en la salida.

No es un bug en vivo hoy (no hay keeper todavia y tus cierres manuales van protegidos).
Es el requisito numero uno para el keeper:

- Cuando el usuario ponga un TP o un SL, el front debe fijar `floorOut` (al abrir con
  q.floorOut, o despues con setFloor) al minimo real de esa orden: para long, el USDT
  minimo aceptable; para short, la cantidad minima de moneda. Ojo con los decimales:
  long en 18 (USDT), short en los decimales de la moneda. El contrato ya lo espera asi.
- Con el floor puesto cerca del precio de la orden, la perdida posible al cerrar queda
  acotada a la distancia hasta el piso, y el keeper no puede liquidarte peor que eso.

Opcional, para blindar aun mas: el contrato ya tiene un oraculo (IOraculoS) pero solo lo
usa para reportar el fee en USD. Se podria exigir en el cierre por keeper que minOut sea
coherente con el precio del oraculo, asi el piso no depende solo de lo que el front puso.

---

## Riesgo alto: las llaves de owner y la actualizacion del proxy

### 2. Cualquier owner puede actualizar el contrato, sin timelock

`_authorizeUpgrade` es soloOwner y no hay demora. Como los usuarios aprueban monto maximo
(MaxUint256) de USDT y de sus monedas a este proxy, quien controle UNA llave de owner
podria subir una implementacion maliciosa y vaciar todo lo aprobado. Esa llave es la joya
de la corona.

Recomendaciones (en orden de impacto):

- Owners = un multisig (tipo Gnosis Safe), no una sola wallet caliente. Asi una sola llave
  comprometida no basta.
- Timelock en la actualizacion (y idealmente en setRouter, setUsdt y setKeeper): cualquier
  cambio queda anunciado con horas de margen y se puede frenar.
- Las llaves de owner, SIEMPRE en hardware wallet, NUNCA en el servidor del keeper.

### 3. Setters de owner potentes (setRouter, setUsdt, setKeeper) sin demora

Un owner puede cambiar el router, el USDT de cuenta o el keeper. El checo de `minOut`
evita un robo directo via router malicioso (revertiria), pero cambiar el USDT por un token
falso romperia la contabilidad de las posiciones abiertas. El multisig y el timelock del
punto 2 cubren esto.

---

## Notas menores

- La llamada al staking reenvia todo el gas (linea 356). Reentrar a una funcion no
  guardada es posible pero de bajo impacto (el staking lo pone el owner, es de confianza).
  Se podria poner un limite de gas a esa llamada.
- Aprobaciones infinitas desde el front (MaxUint256): comodas, pero son el vector del punto
  2. Si se quiere minimizar, aprobar por operacion en vez de infinito (cuesta un approve
  mas por swap). Se puede revocar cuando se quiera.
- Cerrar un short exige que el usuario TODAVIA tenga el USDT colateral en su wallet. Si lo
  movio por fuera, el cierre (manual o por keeper) revierte. No es fallo de seguridad, es
  un tema de liquidez/UX: el keeper debe contemplar ese caso y no reintentar en bucle.
- `operaciones` cuenta aperturas y cierres (se incrementa en ambos). Solo es una estadistica.

---

## Checklist antes de encender el keeper de Cloudflare

- [ ] El front fija floorOut real en cada posicion con TP/SL (punto 1). Sin esto, el keeper
      NO es seguro.
- [ ] Owners en multisig; llaves en hardware wallet; nada de llaves en el servidor.
- [ ] Timelock en upgrade (y en setRouter/setUsdt/setKeeper si se puede).
- [ ] El keeper (la wallet que firma los cierres) con permisos minimos: solo cerrar, y su
      llave aislada del resto.
- [ ] Prueba en testnet de BSC del flujo completo (abrir, TP, SL, cierre por keeper) antes
      de mainnet con dinero real.
- [ ] Auditoria profesional independiente, como pide el propio encabezado del contrato,
      antes de exponerlo con capital real de usuarios.
