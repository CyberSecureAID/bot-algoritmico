# Todo lo que tenemos que darle a Blockaid

> Documento maestro y hoja de ruta. Aquí vive TODO: lo que Blockaid pide, lo que ya tenemos, cada contrato con su dirección actual, los hashes de ejemplo que vamos sacando, y lo que falta. Se va actualizando. NO se envía todavía (falta nombre, dominio, correo corporativo y el rebrand).

Última actualización: 10 de octubre de 2026.
Wallet owner / deployer: `0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d`
Sitio actual: criptocubaoficial.com (en BNB Smart Chain, chainId 56)

---

## 1. LO QUE BLOCKAID NOS PIDE (su correo, textual)

> Hi Jesús,
> Thank you for consolidating the package on criptocubaoficial.com and 0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d. We compared it with the material from 28 September and 2 October, including the four connection screenshots.
> The warning stays in place. This site is classified as a high-risk automated-trading product, not as a drain that fires when a wallet connects. The screenshots show a normal account connection and an unchanged balance. They also show the live page still presented as Cripto Cuba Oficial, with a 5,000 USDT prize pool, grid bots, swaps, and a P2P market. A connection that only reveals the account and balances does not change that classification. We are not marking your deployment wallet benign, and we are not asking you to publish a DNS record as the step that would clear this host.
> Another review needs these items live on the site:
> - Pages that no longer present the product as official Cuban crypto, unless you can document a real affiliation.
> - The prize pool removed or clearly separated from the live product.
> - Every contract that can take a fee, approval, deposit, or subscription listed on the public homepage, with the proxy and implementation addresses and the BscScan verification link for each.
> - The GitHub commit that is actually deployed, the deployment time, and a way to match the live files to that commit.
> - The transactions a user signs after connect: token approvals, gas deposits, the bot subscription, swaps, and any automated-trading authorization, with an example transaction hash for each.
> - If the product remains a paid trading bot: who controls the admin keys, an independent audit of those live contracts, and a clear statement that returns are not guaranteed.
> A separate staging domain is the way to keep testing while this host stays blocked. After those changes are live, reply here with the updated pages and the transaction hashes. We cannot promise the classification will change if the product and branding stay the same.
> Best regards,
> Blockaid Security Team

---

## 2. RESPUESTA PUNTO POR PUNTO (estado actual)

| # | Lo que piden | Estado | Qué tenemos / qué falta |
|---|---|---|---|
| 1 | Quitar la marca "official Cuban crypto" si no hay afiliación real | PENDIENTE | Rebrand completo: nombre nuevo, dominio nuevo. Es el bloqueador grande. Falta decidir el nombre. |
| 2 | Quitar o separar el prize pool (5,000 USDT) | PENDIENTE | El contrato AurexPrizePool ya se descartó; falta quitarlo visualmente de la portada. |
| 3 | Cada contrato que cobra comisión/aprobación/depósito/suscripción, listado en la homepage, con proxy + implementación + enlace BscScan | HECHO (sobrecumplido) | Listamos los 16 en la sección Transparency y en el botón Contracts. Tabla en la sección 3. |
| 4 | El commit de GitHub desplegado, hora de despliegue, y cómo casar los archivos vivos con el commit | HECHO | El sitio se sirve como archivos ES module idénticos al repo público, sin build. Se puede diferenciar archivo por archivo contra GitHub. Falta anclar commit+hora en la página. |
| 5 | Las transacciones que un usuario firma (approve, depósito de gas, suscripción del bot, swaps, autorización de trading) con un hash de ejemplo cada una | EN PROGRESO | Ver sección 4. Ya tenemos el de la suscripción; faltan los demás limpios. |
| 6 | Quién controla las claves admin, auditoría independiente, y declaración de que no se garantizan ganancias | PARCIAL | Claves admin y candados documentados (sección 6). Disclaimer de riesgo ya en el sitio. Auditoría independiente: pendiente (externa/pagada). |

---

## 3. LOS 16 CONTRATOS (direcciones ACTUALES, verificados en BscScan)

Todos en BNB Smart Chain (chainId 56). Formato: proxy (el que se usa) + implementación (la lógica verificada).

| # | Contrato | Cobra? | Proxy | Implementación |
|---|---|---|---|---|
| 1 | Tarifas (registro central de comisiones + multi-owner) | no | `0x068729CBB708713266FFdE2374e51db2B063FD7C` | `0x04341ADf9C371b2cbB504F6722fF2e4Cce470824` |
| 2 | Contabilidad (registro de actividad) | no | `0x7FdE85E0bD53208F380980cfE317A9D4982434Ab` | `0x6F3e055b5C8004F76956F26c4a82662Bca812fF3` |
| 3 | GridBot (motor de bots + swap, cobra suscripción $2.50/30d) | SÍ | `0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B` | `0xE3A5c473B2B0b92166D34Ac42F519B0a324191B7` |
| 4 | MercadoTokens (listado de tokens para el swap) | SÍ | `0x39c48394068299Aa3e3ab114F16bfc3DE11F4112` | `0x4782c5A49C7d1Bba1C0A785f90775b47B5315a27` |
| 5 | SwapLib (librería multi-DEX, linkeada por GridBot) | no | (librería, se linkea) | `0x8365dA05184CdeD0d824504A9E8f87819f39E2ff` |
| 6 | Futuros (posiciones apalancadas) | SÍ | `0x315C8Afc274f2BE822ffA1725b590D7fB7E2Af85` | `0x7cCaE3e57a2F8D546735B79DBa79B234d200F664` |
| 7 | AnalisisPro (acceso de pago a análisis técnico) | SÍ | `0x8e04ACEc37aE1D8fA6239d4407a73316bFC97469` | `0x9c82B4eb95c5D072948A4265dAE6d7dCDB28Cf2E` |
| 8 | OrdenesLimite (órdenes límite de Futuros) | no | `0x1C7F75404a525e1198Cf6f33391D88Bd2d9B008F` | `0x5C5aF9A2c35Ce781E0B33bAdCB2F35536697c421` |
| 9 | OracleGuard (oráculo endurecido para Futuros) | no | `0x300E908d0703D0b934201b3EE1a115632E88af86` | `0xdf2B3371F4a98dbf39d4B69D75563CEc72d5925E` |
| 10 | OraculoPrecios (precio USD de cualquier token) | no | `0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3` | `0x41d9Cb401F453405f2069f93B8a590FE8A58959e` |
| 11 | Staking (bóveda no custodial, reparte recompensas) | SÍ | `0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4` | `0x131c136549450C62b431B987745CaA05e493c722` |
| 12 | PanelStaking (lecturas de staking, no mueve fondos) | no | (impl directa, sin proxy) | `0xE620D5BD60F70CCdFa4493F3a5B794d1BBEbf8d2` |
| 13 | MercadoP2P (mercado entre pares) | SÍ | `0x17B47a8Fb97F8980b96c94E4b9137182e0Bf8025` | `0x1e02c7FaBe2e6eeAc8c17a0689C46E6170aCa2a9` |
| 14 | PerfilesP2P (perfiles y reputación P2P) | no | `0xC01B61B702011747B4c0Ee6B5F2d0F2b4B66880c` | `0xCeA7DD129BF53ac7Ac54CAD6bCA70425449e86eD` |
| 15 | WalletShield (suscripción de seguridad de wallet) | SÍ | `0x24E34b95dBd7786b0d11E00e7FA256A8763B6D05` | `0x4Fe00c77d08A1eE2cF844023353Ea0366E7ece23` |
| 16 | GasFaucet (faucet de gas) | no | `0x71763E9Ad60d3D2Baa833496F8b4f8eeD497B65F` | `0x440873C885913D756179AA8823B39B9a0680F5D6` |

Enlace de verificación: `https://bscscan.com/address/<direccion>#code` para cada proxy e implementación.

---

## 4. LAS TRANSACCIONES QUE UN USUARIO FIRMA (con hash de ejemplo)

Todas se firman desde la wallet del usuario; nada es custodial. Hay que sacar un hash limpio de cada tipo.

| Tipo | Qué es | Contrato | Hash de ejemplo |
|---|---|---|---|
| Suscripción del bot (`pagarMes`) | Paga $2.50 en BNB por 30 días de uso de bots. 20% staking, 80% owners. | GridBot `0x4e86…` | `0xb6495393e815c79e6679b53f25272d4dafb5e29011d19317121cc11e541fc6da` (ver nota) |
| Aprobación de token (`approve`) | Permiso ERC-20 acotado al contrato, nunca ilimitado. | token → GridBot | POR SACAR |
| Depósito de gas (`depositarGas`) | El usuario carga BNB para que su bot opere. | GridBot `0x4e86…` | POR SACAR |
| Swap (`ejecutarSwap`) | Intercambio directo desde la wallet del usuario. | GridBot `0x4e86…` | POR SACAR |
| Crear bot (`crearRejilla`) | Abre un bot (grid/acumulador/cashout/DCA). | GridBot `0x4e86…` | `0x378ec677e492cce0fb76f6951eb1dd315eb64281a26e0dbaaa926b579713aaad` (sirve una vez que el 20% al Staking salga limpio) |

> NOTA sobre el hash de suscripción: se probó dos veces (`0xb649…` de `pagarMes` y `0x378ec6…` al abrir un acumulador). En ambos el cobro de $2.50 funcionó, pero el 20% de staking NO llegó: salió todo al owner ($1.25 + $1.25). Leyendo el código completo del Staking quedó confirmado que `depositarRecompensa` solo revierte por `contratoAutorizado[GridBot] == false`, así que el GridBot sigue sin estar autorizado en el Staking. El GridBot atrapa ese fallo a propósito (`if (!ok)` manda ese 20% a owners) para que el bot del usuario nunca se trabe por un problema del staking. Fix sin redeploy: autorizar el GridBot (`autorizarContrato`) en el proxy del Staking desde la wallet admin, luego `resetMes` a la wallet de prueba y reabrir un bot. Ahí sale el hash limpio (20% $0.50 a Staking `0xdC48…` en WBNB, 80% a owners) que reemplaza a estos.
>
> NOTA sobre el reparto a owners: hoy sale `$1.25 + $1.25` porque `owner2` está puesto con la misma wallet del owner. Es correcto e intencional mientras llega la wallet del segundo owner (la aporta quien financia el proyecto). Así se le muestra a Blockaid.

---

## 5. TRANSPARENCIA PÚBLICA EN EL SITIO (descripción neutral, para la respuesta)

- **Disclaimer de riesgo al entrar:** cualquier visitante, al entrar, ve un aviso (una sola vez, recordado): plataforma descentralizada, no custodia fondos, no garantiza rendimiento, el usuario arriesga solo lo que puede permitirse perder, contratos verificables en BscScan. (Se añadirá además un disclaimer específico de bots en la sección de bots.)
- **Botón "Contracts" (esquina superior derecha):** abre la lista de todos los contratos con su dirección completa, copiable, y enlace a BscScan.
- **Sección "Transparency" (scroll en el lobby):** muestra públicamente los 16 contratos (proxy + implementación), un mapa interactivo de cómo se conectan entre sí (red neuronal, conexiones reales del código), y tres bloques: "verifícalo tú mismo", "tus fondos nunca salen de tu wallet", y "upgrades con reloj público" (candado de 48h). Exporta la lista a CSV.
- **Código público sin build:** el sitio se sirve como los mismos archivos ES module publicados en el repo, sin compilación ni minificación, así que cualquiera diffea el archivo vivo contra GitHub.

---

## 6. GOBERNANZA Y CLAVES DE ADMIN

- **Owner actual:** `0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d` (wallet del dueño).
- **Modelo multi-owner:** la autoridad vive en el contrato Tarifas (`esAdmin`), que todos los demás consultan. Se puede añadir un segundo owner (owner2) y directores.
- **Segundo owner (owner2):** hoy está puesto con la misma wallet del owner, así que cada cobro se parte en dos mitades que llegan ambas al mismo dueño ($1.25 + $1.25 de los $2.50). La wallet del segundo owner la aportará más adelante quien financia el proyecto; hasta entonces se queda así y así se le muestra a Blockaid. Jesús es el desarrollador.
- **Candados de upgrade:** los contratos de Futuros, OraculoPrecios y Staking usan UUPS con candado de 48h (propuesta en cadena + espera + activación, todo público). GridBot usa UUPS soloOwner (sin 48h, para poder arreglar el swap rápido).
- **No custodia:** ningún contrato guarda capital del usuario; cada operación sale firmada desde su wallet, con permisos acotados.
- **Pendiente:** declaración formal de claves admin + plan de paso a multisig + auditoría independiente externa.

---

## 7. PENDIENTES (hoja de ruta / checklist)

- [ ] **Nombre nuevo** (fuera de "Cripto Cuba Oficial"). Bloqueador principal.
- [ ] **Dominio nuevo** (y dominio de staging para seguir probando mientras este host está bloqueado).
- [ ] **Correo corporativo** (para firmar la respuesta y sobrecumplir transparencia).
- [ ] **Rebrand en el sitio:** quitar toda referencia a "official Cuban crypto" (107 instancias aprox.).
- [ ] **Quitar el prize pool** de la portada (contrato ya descartado).
- [ ] **Anclar el commit de GitHub desplegado + hora** en la página de transparencia.
- [ ] **Autorizar el GridBot en el Staking** para que el 20% ($0.50) llegue. Causa confirmada leyendo todo el código del Staking: `depositarRecompensa` solo revierte por `contratoAutorizado[GridBot] == false`. Fix sin redeploy, desde la wallet admin (principal del Staking): en el proxy `0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4`, Write as Proxy → `autorizarContrato(0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B, true)`. Después `resetMes(walletPrueba)` en el GridBot y reabrir un bot para sacar el hash limpio.
- [ ] **Sacar los hashes limpios** de: approve, depositarGas, ejecutarSwap, crearRejilla.
- [ ] **Gas en bots ya abiertos (UI):** al cargar gas después de abrir un bot, el bot abierto no refresca su saldo de gas ni muestra el aviso de "sin gas". El bot necesita ese gas para disparar las cuadrículas. Revisar el refresco del estado de gas en la interfaz del bot.
- [ ] **Declaración de claves admin** + plan multisig.
- [ ] **Auditoría independiente** de los contratos en vivo (externa).
- [ ] **Disclaimer específico de bots** (modal estilo portada, inglés, escala Blockaid).
- [ ] **Responder en el hilo de Zendesk** con las páginas actualizadas y los hashes (AL FINAL, cuando todo esté vivo).

---

## 8. HISTORIAL TÉCNICO (para no olvidar qué se hizo)

- **GridBot:** se arregló el swap USDT→BNB (colisión en `receive()` con el stipend de WBNB.withdraw). Se rediseñó el cobro de bots: sin bot gratis, $2.50 = 30 días por cuenta cubren hasta 8 bots, a los 30 días se pausa (no se cierra), reactivar pagando. Se añadieron errores legibles (custom errors) y la función de owner `resetMes`. Implementación actual: `0xE3A5c473B2B0b92166D34Ac42F519B0a324191B7`.
- **SwapLib:** librería externa linkeada, verificada. Dirección actual: `0x8365dA05184CdeD0d824504A9E8f87819f39E2ff`.
- **OraculoPrecios y Staking:** se redeployaron con código verificado y se activaron por upgrade UUPS (candado de 48h). Impls: `0x41d9Cb…` y `0x131c13…`.
- **Pendiente técnico abierto:** autorizar GridBot en Staking para el reparto del 20% (causa confirmada: el GridBot no está en `contratoAutorizado` del Staking; fix de 1 transacción sin redeploy); el bot ya abierto no refresca el gas cargado después (revisar la UI); revisar la intermitencia de firmas que aparece con wallets EIP-7702 (MetaMask smart account) vía el Delegation Manager.
