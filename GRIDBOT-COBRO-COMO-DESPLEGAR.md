# GridBotV13 (cobro nuevo) — qué cambió y cómo desplegarlo

Archivo a desplegar: `GridBotV13.sol` (mismo nombre de contrato `GridBotV13`).
Proxy en vivo (no cambia): `0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B`

---

## Verificado aquí antes de entregártelo (solc 0.8.22, optimizer runs 1, EVM shanghai)
- **Compila: 0 errores, 0 warnings.**
- **Tamaño: ~24177 bytes en Remix** (límite 24576, margen ~399). Entra holgado.
- **El swap quedó idéntico, byte por byte** al desplegado: `swap`, `_swapNormal`, `_paso`, `_pull`, `_comision`, `receive`, `depositarGas`. No se tocó ni una coma.
- **Almacenamiento sin variables nuevas** → el orden de la memoria es idéntico → el upgrade NO corrompe bots ni saldos. Es seguro.

---

## Qué cambió (solo el cobro y los errores, nada más)
1. **Sin bot gratis.** Desde el primer bot se paga.
2. **$2.50 en BNB = 30 días por cuenta**, cubren hasta 8 bots a la vez.
3. Al abrir un bot:
   - Si tu mes NO está activo: cobra $2.50 y activa 30 días.
   - Si tu mes YA está activo: gratis (hasta 8 bots). Si por error mandas BNB, **te lo devuelve** (blindaje anti doble cobro).
4. **A los 30 días el bot se PAUSA**, no se cierra, no vende nada.
5. **Reactivar:** el usuario paga con `pagarMes()` y el bot **se reanuda solo** en el siguiente ciclo del keeper. No hice función nueva: el botón "reactivar" del frontend llamará a `pagarMes`.
6. **Errores legibles:** `NoPagado`, `LimiteBots`, `NoAutorizado`. Ahora el revert dice su razón (se acabó el fallo mudo en el cobro y al crear).

Lógica anti fugas: como el cobro depende del mes pagado (`pagadoHasta`) y no de cuántos bots tienes abiertos, **cerrar y reabrir ya NO regala meses**. Dentro del mes pagado abres y cierras libre; cuando vence, el siguiente bot vuelve a cobrar.

---

## Cómo desplegar (igual que hiciste con V13; GridBot es soloOwner, SIN candado de 48h)
1. En Remix, carga `GridBotV13.sol` y `SwapLib.sol`. Compila con **0.8.22, optimizer runs 1, EVM shanghai**.
2. Al desplegar, **enlaza la librería SwapLib a la que ya existe**: `0x0a0fbd6160158fea25ca2525bd7d4e38b57ddd1f`. No la vuelvas a desplegar.
3. Despliega **solo la implementación** (Deploy, con "Deploy with Proxy" DESMARCADO).
4. Verifica la implementación nueva en BscScan (contrato `GridBotV13`, mismos ajustes).
5. En el proxy `0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B`, At Address, llama `upgradeToAndCall(nuevaImpl, 0x)`. Firma. Es inmediato (soloOwner, sin 48h).
6. Pásame la dirección de la implementación nueva para actualizar la página (contracts-data.js y README).

---

## Prueba rápida después del upgrade (para confirmar el reloj suizo)
1. Con una wallet con BNB, abre un bot → debe pedir el pago de $2.50.
2. Abre un 2do bot ese mismo mes → **gratis** (no recobra).
3. Cierra un bot y ábrelo otra vez → **gratis** (no recobra; el mes sigue activo).
4. (Opcional, a los 30 días) el bot se pausa; al pagar `pagarMes`, se reanuda solo.

Si algo revierte, ahora MetaMask/BscScan te dirá la razón (`NoPagado`, `LimiteBots`…), y me lo pasas.

---

## Fase 2 (frontend, cuando el contrato esté vivo)
- Ventana de cobro al entrar a bots (estilo WalletShield), que solo cobra si no estás activo (gatea con `alDia`).
- El disclaimer de bots: modal centrado, mismo estilo y sello que la portada, en inglés, a escala Blockaid, que solo se quita con "I agree".
- Botón "reactivar" = llama a `pagarMes`.
- Los nombres exactos de las imágenes te los doy cuando montemos esa ventana.
