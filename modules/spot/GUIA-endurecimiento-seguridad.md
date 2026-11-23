# Guia para cerrar los hallazgos de seguridad de SpotDF

Pasos concretos para los tres hallazgos de la auditoria. El #1 lo hago yo en codigo
cuando montemos el keeper. El #2 y el #3 son acciones en la blockchain con tus llaves:
aqui tienes el paso a paso exacto. Nada de esto necesita testnet salvo donde se avisa.

Red: BNB Smart Chain. Contrato (proxy): `0xfC3c9516665Ab36D8E56e0797F4392FbFc073c11`.

---

## Hallazgo #1 — floorOut (lo hago yo, con el keeper)

No hay nada que hagas tu. Cuando construyamos el keeper, el front va a fijar el piso real
de cada orden TP/SL (floorOut al abrir o con setFloor), en USDT para long y en moneda para
short. Hasta que exista el keeper, floorOut no lo usa nadie, asi que ponerlo ahora no haria
nada. Queda anotado como el primer paso del keeper.

---

## Hallazgo #2 — Llaves de owner a un multisig (esto es lo mas importante; hazlo ya)

Hoy, quien tenga UNA llave de owner puede actualizar el contrato y vaciar lo aprobado por
los usuarios. La solucion de verdad: que los owners sean un multisig con firmantes en
hardware wallet, para que una sola llave no alcance.

### Antes de empezar
- 2 o 3 hardware wallets (Ledger o Trezor), una por firmante.
- Saber cuales son los owner1 y owner2 actuales (leelos en el contrato: funciones `owner1`,
  `owner2`, `owners`).
- Un poco de BNB para gas en las wallets que van a firmar.

### Paso a paso
1. Crea un Gnosis Safe en BSC en `app.safe.global` (red BNB Smart Chain). Umbral sugerido:
   2 de 3. Cada firmante, una hardware wallet. Anota la direccion del Safe.
2. Apunta owner1 al Safe (dos pasos, por eso es seguro: si te equivocas de direccion, no
   pasa nada hasta que esa direccion acepte):
   - Desde un owner actual, llama `proponerOwner1(DIRECCION_DEL_SAFE)`.
   - Desde el Safe (una transaccion del Safe), llama `aceptarOwner1()`.
   - Verifica: `owner1` ahora devuelve la direccion del Safe.
3. Haz lo mismo con owner2: `proponerOwner2(DIRECCION_DEL_SAFE)` y luego `aceptarOwner2()`
   desde el Safe. (Si quieres repartir la comision entre dos partes distintas, usa dos Safes
   o dos hardware wallets, uno por owner, en vez del mismo Safe para ambos.)
   - Verifica: `owner2` ahora devuelve el Safe.
4. Saca a los owners viejos (las wallets calientes). Por cada direccion vieja que ya no sea
   owner1 ni owner2, desde el Safe llama `removeOwner(DIRECCION_VIEJA)`.
   - Verifica: `owners()` lista solo el Safe (o tus dos wallets seguras).

Con esto, para actualizar el contrato o tocar cualquier setter hacen falta las firmas del
multisig. Una sola llave robada ya no sirve de nada. Es reversible: siempre puedes volver a
proponer otro owner con el mismo mecanismo de dos pasos.

Nota sobre la comision: un Gnosis Safe recibe BNB sin problema. Si alguna vez el envio
directo del reparto se queda corto de gas, el contrato lo deja en saldo retirable y el Safe
lo cobra llamando `retirar()`. No se pierde.

---

## Hallazgo #3 — Demora (timelock) en las actualizaciones

El multisig del #2 ya cubre la mayor parte: nadie cambia nada sin varias firmas. Lo que
falta para un timelock de verdad (que un cambio se anuncie con horas de margen y se pueda
frenar) choca con este contrato, porque aqui CUALQUIER owner puede actualizar al instante y
los owners ademas cobran la comision. Meter un timelock limpio pide separar el permiso de
actualizar del de cobrar, y eso es un pequeno cambio en el contrato.

Recomendacion honesta:
- Con el multisig ya tienes el 80% del riesgo cubierto. Para operar, con eso vas seguro
  frente a un robo por una sola llave.
- El timelock formal lo dejamos como una revision del contrato, y lo montamos junto con el
  keeper, con cuidado. Ahi es donde saltarse pruebas es mas delicado: un timelock mal
  cableado puede dejarte sin poder actualizar. Como no quieres testnet, al menos lo
  simulamos en una copia local (un fork) antes de tocar el contrato en vivo. Es tu decision,
  pero para un contrato con fondos de usuarios yo no lo cambiaria a ciegas.

---

## El keeper, cuando lo montemos (para no olvidarlo)

- La wallet del keeper es una cuenta APARTE, nunca un owner.
- Se le da permiso solo con `setKeeper(DIRECCION_KEEPER, true)` desde el Safe.
- Su llave vive en el servidor (secreto cifrado de Cloudflare), aislada del resto. Si se
  compromete, con el floorOut puesto el daño queda acotado a tu piso.

---

## Orden recomendado

1. Ahora: crea el Safe y pasa owner1 y owner2 al Safe (hallazgo #2). Es lo que mas te
   protege y es reversible.
2. Con el keeper: floorOut (#1) y el permiso de keeper aislado.
3. Antes de exponerlo con dinero real de usuarios: el timelock (#3) y, como pide el propio
   contrato, una auditoria profesional independiente.
