# CriptoCuba Oficial — README V7 (Guía maestra de contratos)

> **Qué es este documento.** La guía completa y detallada de TODOS los contratos
> desplegados, sus direcciones, qué hace cada uno, qué se puede editar desde cada
> uno (y cómo), y todo lo que falta por hacer. Escrito para que cualquiera, incluso
> alguien nuevo, pueda entrar a Remix, pegar una dirección en "At Address" y saber
> exactamente qué botón toca para cambiar qué. Continúa V1–V6.

---

## 0. Cómo usar esta guía en Remix (leer primero)

Para tocar cualquier contrato desplegado:
1. En Remix, sube y **compila** el `.sol` correspondiente (para que Remix tenga el ABI).
2. Ve a **Deploy & Run Transactions**, conecta tu wallet (WalletConnect, BNB Chain).
3. Pulsa **"At Address"** y pega la **dirección PROXY** del contrato (nunca la de
   implementación, salvo que se indique).
4. Aparece el contrato con todas sus funciones. Las de "leer" (azules) no cuestan gas;
   las de "escribir" (naranjas) piden confirmar en la wallet.
5. **Regla de oro de los upgrades:** solo se cambia la *implementación*, nunca el
   *proxy*. El proxy mantiene siempre la misma dirección, los fondos y los datos.

---

## 1. MAPA RÁPIDO — todas las direcciones

| Contrato | Qué es | Proxy (usar esta) | Implementación |
|---|---|---|---|
| **Tarifas** | Cerebro central: % y multi-owner | `0x068729CBB708713266FFdE2374e51db2B063FD7C` | V2: `0x04341ADf9C371b2cbB504F6722fF2e4Cce470824` |
| **OraculoPrecios** | Precio USD de cualquier token | `0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3` | `0x0150b62a2355AFc036612B890cbE00F5EcdB8CC7` |
| **Staking** | Bóveda no custodial + reparto | `0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4` | `0xB96675917b784987F06327a629398ff8637BFc64` |
| **PanelStaking** | Vistas del staking (solo lectura) | `0xE620D5BD60F70CCdFa4493F3a5B794d1BBEbf8d2` | (sin proxy) |
| **GridBot** | Bots + swap (multi-DEX) | `0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B` | V11 (final): `0x89bc0f298218118D9DF3Be49672961914fA3aF34` |
| **MercadoTokens** | Listar/vender tokens sin liquidez (con seguridad) | `0x39c48394068299Aa3e3ab114F16bfc3DE11F4112` | `0x4782c5A49C7d1Bba1C0A785f90775b47B5315a27` |
| **SwapLib** | Librería del fallback multi-DEX | (librería, se linkea) | `0x8713F1ABF29fBF912D032eA1c1c60380A8De901f` |
| **PerfilesP2P** | Perfiles del marketplace P2P | `0xC01B61B702011747B4c0Ee6B5F2d0F2b4B66880c` | ver V5 |
| **MercadoP2P** | Órdenes del marketplace P2P | `0x17B47a8Fb97F8980b96c94E4b9137182e0Bf8025` | ver V5 |

- **Owner principal:** `0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d`
- **Red:** BNB Smart Chain (chainId 56).
- **Compilador general:** Solidity 0.8.24, optimizer runs 200, EVM shanghai, MIT.
- **GridBotV11 se compila SIN viaIR** (optimizer activado), cabe en 24 KB. Ojo: usa la
  librería **SwapLib** (hay que linkear su dirección al compilar/desplegar).

---

## 2. Estructura del repo (`contracts/`)

```
contracts/
├── core/      → Tarifas.sol, Tarifas_V2.sol         (cerebro central)
├── p2p/       → PerfilesP2P.sol, MercadoP2P.sol      (marketplace)
├── staking/   → OraculoPrecios.sol, Staking.sol, PanelStaking.sol
├── futures/   → Futuros.sol                          (motor, ejecución pendiente)
├── bots/      → GridBotV11.sol, SwapLib.sol          (bots + swap)  ← crear esta carpeta
└── (raíz)     → GridBotV10.sol (versión anterior), IntercambioBot.sol
```

> **Nota:** el `GridBotV10.sol` de la raíz es la versión anterior (el contrato base
> del que partió todo). El código real desplegado en V10 se confirmó idéntico. La V11
> es su upgrade. Conviene mover GridBotV11.sol y SwapLib.sol a `contracts/bots/`.

---

## 3. CONTRATO POR CONTRATO — qué edita cada uno

### 3.1. Tarifas (core) — el cerebro central
**Proxy:** `0x068729CBB708713266FFdE2374e51db2B063FD7C`
Guarda los porcentajes de toda la plataforma y la lista de owners (multi-owner).
Desde "At Address" con este proxy puedes:
- `setStakingBps(2000)` → % general al staking (2000 = 20 %).
- `setStakingFuturosBps(5000)` → % de Futuros al staking (5000 = 50 %).
- `setUnstakeBps(100)` → comisión al retirar del staking (100 = 1 %).
- `setTesoreriaStaking(dir)` → dirección del Staking que recibe.
- (funciones de admin/owner) → añadir o quitar admins.
**Estado:** V2 activada y configurada (20 %, 50 %, 1 %, tesorería = Staking).

### 3.2. OraculoPrecios (staking)
**Proxy:** `0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3`
Da el precio en USD de cualquier token (Chainlink o PancakeSwap). Desde aquí:
- `configurarToken(token, fuente, feed)` → añade un token (fuente 1=Chainlink, 2=PancakeSwap-USDT, 3=PancakeSwap-WBNB).
- `setFeedBNB(dir)`, `setFactory(dir)`, `setMaxAntiguedad(seg)` → mantenimiento.
- `precioUSD(token)` (leer) → precio actual.
**Estado:** 30 monedas configuradas.

### 3.3. Staking (staking) — la bóveda
**Proxy:** `0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4`
Guarda el capital (en su moneda), reparte el 20 %/50 %, participación asignada. Desde aquí:
- `permitirToken(token, true)` → habilita una moneda para aportar.
- `autorizarContrato(dir, true)` → autoriza a un contrato (ej. Futuros, GridBot) a
  depositar recompensa o pedir préstamo.
- `asignarParticipacion(wallet, pesoUSD, "etiqueta")` → participación asignada por admin
  (cobra recompensas, NO retira capital).
- `quitarParticipacion(wallet, pesoUSD)`.
- `setOraculo(dir)`, `setTarifas(dir)`, `pausar(bool)`, `setPlazos([...])`.
- `stake / unstake / reclamar` (las usan los usuarios desde la web).
**Estado:** desplegado, cableado con Oráculo y Tarifas.

### 3.4. PanelStaking (staking) — solo lectura
**Dirección:** `0xE620D5BD60F70CCdFa4493F3a5B794d1BBEbf8d2` (no es proxy)
Vistas para el frontend: `posicionUsuario`, `capitalDeUsuario` (total/en uso/disponible),
`recompensasDe`, `global`, `tvlPorMoneda`. No edita nada.

### 3.5. GridBot (bots) — bots + swap  ★ el más nuevo
**Proxy:** `0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B`
**Implementación V11:** `0xb2792C4D8Cf552cC0Da0938fD7F73DC82B5A3052`
Motor de bots (grid, acumulador, auto-sell, DCA) y swap directo, no custodial, con
multi-DEX y fallback automático. Desde "At Address" con el **proxy** puedes:

Cobro de bots y parámetros:
- `setCostoBot(250)` → precio del bot en USD con 2 decimales (250 = $2.50).
- `setMaxBots(n)` → máximo de bots por wallet (por defecto 8).
- `setComision(feeBps, stakingBps)` → comisión del swap y % al staking.
- `setKeeper(dir)` → wallet que ejecuta los bots (el keeper).
- `setStaking(dir)`, `setTesoreria(dir)`, `setOraculo(dir)`.
- `setOwner2(dir)` → **el segundo owner** (recibe su parte del cobro de bots).
- `setPausado(bool)`.

Multi-DEX (auto-reparación):
- `agregarDex(router, quoter, "nombre")` → añade un proveedor (Pancake, Uniswap…).
- `setDexDireccion(i, router, quoter)` → **corrige una dirección si un DEX la cambia**
  (esto resuelve el problema que tuvimos: si Pancake cambia una dirección, se arregla
  aquí en 10 segundos, sin redesplegar).
- `setDexActivo(i, bool)`, `setDexPref(i)` → activar/preferir un proveedor.
- `numDexes` / `dexes(i)` (leer) → cuántos y cuál es cada uno (para el panel de salud).

Reparto del cobro de bots: 20 % staking, 80 % a los dos owners (50/50).

**Cómo funciona el cobro (SIN keeper, "lazy"):**
- El **primer bot** de cada wallet es **gratis** 30 días.
- Los bots extra cuestan **$2.50 en BNB** al abrir (equivalente calculado por el oráculo).
- A los 30 días, para seguir, se paga **$2.50 una vez** (no por bot). Si no paga, los
  bots se **pausan** (no se cierran; el usuario puede cerrarlos y recuperar su posición).
- El swap **envuelve/desenvuelve BNB↔WBNB** (resuelve el WBNB atascado).

**Estado V11 (configurado):**
- staking = `0xdC48…84C4`, oraculo = `0xf51b…77f3`, owner2 = wallet del owner (temporal),
  costoBot = 250 ($2.50), keeper = wallet del owner (temporal).
- tesoreria = wallet del owner (temporal, cambiar cuando haya contrato Tesorería).
- 1 DEX: PancakeSwap V3 (router `0x1b81…eB14`, quoter `0xB048…5997`).

---


### 3.6. MercadoTokens (swap) — listado libre de tokens  ★ NUEVO
**Proxy (dirección oficial):** `0x39c48394068299Aa3e3ab114F16bfc3DE11F4112`
**Implementación:** `0x19cec2944BA0701B592861c82e759b48202870fD`
**Verificado en BscScan:** sí (Exact Match). Compilado con **v0.8.22, optimizer runs 1, sin viaIR**.
**Proxy tipo:** el proxy se desplegó con el contrato `ProxyMercado` (ERC1967Proxy de OpenZeppelin).

**Qué hace.** Deja que cualquiera liste SU token para venderlo en el área de swap,
aunque no tenga liquidez. No custodia el capital de trading de nadie: solo retiene
los tokens que cada vendedor pone a la venta y sus ganancias hasta que las retira.

**Reglas de negocio (todas editables desde el panel):**
- Listar cuesta **$25 en BNB** (equivalente calculado por el oráculo). Reparto del $25:
  $5 al staking, $10 al owner1, $10 al owner2.
- Se compra **solo con BNB**.
- El vendedor elige el precio libremente (nombre, símbolo y contrato son obligatorios; el logo es opcional).
- Al **retirar ganancias**: comisión del **5%** (1% staking, 2% owner1, 2% owner2).
- Retirar **tokens sobrantes**: sin comisión. Reponer tokens: sin pagar de nuevo.
- **Regla de 2 años**: si el vendedor no retira su ganancia en 2 años, esa ganancia
  pasa al staking como recompensa (los tokens NO se tocan, siempre son suyos).
- Estos tokens **NO se operan en futuros ni spot**, solo se intercambian en el swap.
  El usuario es responsable; la plataforma no los respalda.

**Desde "At Address" con el PROXY puedes:**
- `listar((token,nombre,simbolo,logo,cantidad,precio))` (con $25 en BNB como value) → publica.
- `comprar(id, cantidadToken)` (con BNB como value) → compra tokens de un listado.
- `retirarGanancia(id)` → el vendedor retira su ganancia (menos 5%).
- `retirarTokens(id, cantidad)` → retira tokens no vendidos (sin comisión).
- `reponer(id, cantidad)` → añade más tokens a un listado sin pagar otra vez.
- `setPrecio(id, precio)` / `setLogo(id, logo)` → cambia precio o logo de su listado.
- `barrerGananciaVieja(id)` → cualquiera puede mandar al staking una ganancia sin retirar >2 años.
- Lecturas para el frontend: `ver(id)`, `pagina(desde,hasta)`, `listadosDeVendedor(addr)`,
  `listadosDeToken(addr)`, `totalListados`, `costoListadoBNB`.

**Panel admin (solo owner/owner2/admin de Tarifas):**
- `setCostoListado(usd2dec)` → cambia el precio de listar (2500 = $25).
- `setComisionRetiro(bps)` → cambia la comisión de retiro (500 = 5%, máximo 1000 = 10%).
- `setOwner2(addr)`, `setStaking(addr)`, `setOraculo(addr)`, `setPausado(bool)`.
- `transferirOwner(addr)` + `aceptarOwner()` → cambio de owner en dos pasos.
- `rescatarBNB(para,monto)` / `rescatarToken(token,para,monto)` → recupera polvo o envíos por error.

**Estado (configurado y cableado):**
- costoListado = $25, comisión = 5%.
- tarifas = `0x0687…FD7C`, staking = `0xdC48…84C4`, oraculo = `0xf51b…77f3`, owner2 = wallet del owner (temporal).
- **Autorizado en el Staking** (`autorizarContrato`) → ya puede depositar recompensas.

**Cómo modificarlo en el futuro (upgrade UUPS):**
1. Editar `MercadoTokens.sol`, compilar (0.8.22, optimizer, sin viaIR).
2. Deploy de la nueva implementación (sin proxy).
3. En el PROXY `0x39c4…4112`, llamar `upgradeToAndCall(nuevaImpl, 0x)`.
4. El storage debe respetarse (nuevas variables solo al final, antes del `__gap`).


### 3.6-bis. MercadoTokens — SEGURIDAD (versión final desplegada)
**Implementación final (con toda la seguridad):** `0x4782c5A49C7d1Bba1C0A785f90775b47B5315a27`
Verificada en BscScan. Compilada con **0.8.22, optimizer runs 1, sin viaIR**.

Medidas de seguridad implementadas y testeadas (todas acumuladas):
- **No se puede listar "aire":** `listar` hace `transferFrom` de los tokens al contrato; si el
  usuario no los tiene o no los aprobó, la transacción revierte. Solo se lista si los tokens llegan.
- **Filtro de liquidez (anti-suplantación):** si un token tiene más de `maxLiquidezUSD` ($250.000)
  de liquidez REAL en PancakeSwap (reservas contra WBNB/USDT, no market cap), NO se puede listar.
  Esto bloquea automáticamente TODAS las monedas establecidas (BTC, ETH, etc.) sin lista manual.
  Editable con `setMaxLiquidez(usd18)`. Consulta: `liquidezUSD(token)`.
- **Excepciones con nombre anclado:** `permitirConLiquidez(token, true, nombre, simbolo)` permite un
  token concreto aunque tenga liquidez, y ANCLA su nombre/símbolo (nadie puede falsearlo).
  Configurados los 4 USDT.z (nombre y símbolo forzados a "USDT.z"):
    `0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4`
    `0xd242797cBe7629C216f95f3deaFE79a9856Cb520`
    `0xa80A8cba9b40AC5dA81E84578a75c6ddA94C4444`
    `0xf15c7f1F86398520b70505e9cC285A8b18D9A21f`
- **Devolución protegida (anti fee-on-transfer):** el comprador puede devolver sus tokens y recuperar
  su BNB, pero el reembolso se basa en lo REALMENTE recibido (un token con comisión no puede drenar el pool).
  Solo la wallet que compró puede devolver.
- **Candado de 30 días:** el vendedor no retira ganancias hasta 30 días tras listar (`faltaCandado(id)`
  da el tiempo restante). Protege a los compradores.
- **Lista negra manual** (`setProhibidos`) por si se quiere bloquear algún contrato específico.
- Owner lista GRATIS; usuarios pagan $25. Comisión de retiro 5% (1% staking, 2%+2% owners). Owner en 2 pasos. Rescate. Pausa.

### 3.7. Firebase (logos de tokens listados)
- **Proyecto Firestore:** `criptocuba-logos` (plan gratis Spark, sin tarjeta).
- Los logos se guardan en la colección **`logos`** (id = dirección del token en minúsculas), como
  string dataURL WebP comprimido (pocos KB). Capacidad: ~130.000 logos gratis.
- **Reglas:** cualquiera puede LEER; crear solo strings <90KB; nadie puede editar/borrar (anti-sabotaje).
- El frontend NO depende del dominio: usa la API REST de Firestore con projectId + apiKey (en `firebase-logos.js`).
- El logo NO va on-chain (el contrato guarda logo vacío); se comprime en el navegador (`reducirImagen` en `listing.js`).

### 3.8. Frontend del Swap (completo)
- `assets/js/gridbot/swap.js`: swap normal + botón "List your token" + compra de tokens listados (con disclaimer).
- `assets/js/gridbot/listing.js`: panel de listar (web al lado del swap, móvil pantalla completa), My tokens, delete.
- `assets/js/gridbot/mercado.js`: capa de conexión al contrato MercadoTokens.
- `assets/js/gridbot/firebase-logos.js`: guardar/leer logos en Firestore.
- Móvil: acceso "Add Token" en All Services y en la sección bajo las tarjetas (movil.js, inicio.js).
- Los tokens listados aparecen en el buscador del swap con logo + "Protected · Xd" (garantía positiva).


### 3.9. Contabilidad (el "contable" central) — NUEVO
**Proxy (oficial):** `0x7FdE85E0bD53208F380980cfE317A9D4982434Ab`
**Implementación:** `0x6F3e055b5C8004F76956F26c4a82662Bca812fF3`
**Proxy tipo:** ProxyContabilidad (ERC1967Proxy). Verificado. Compilado 0.8.24, runs 200.

Contrato central que lleva la contabilidad de TODA la plataforma. NO custodia dinero: solo cuenta.
DATOS PRIVADOS (solo owners/admins pueden leer). Testeado 9/9.

Qué registra (los servicios se lo REPORTAN):
- Total generado (histórico + por mes), desglose por servicio, total al staking, total a owners.
- **Wallets únicas**: cada wallet cuenta UNA vez aunque interactúe muchas veces. Total + nuevas por mes.
- Nº de operaciones (total, por servicio, por mes).

Control (solo owner):
- **Lista negra de wallets** (`bloquear` / `bloquearVarias`): los demás contratos consultan `bloqueada(wallet)`.
- Autorizar quién puede reportar (`setReportador` / `setReportadores`).

Historial detallado: cada actividad/pago EMITE un evento (con wallet, token, monto). El panel admin los
lee de la blockchain con el hash de cada tx (para demostrar "aquí están tus 23 pagos"). NO se guarda en storage.

Funciones clave: `reportar(wallet, servicio, generadoUSD, aStakingUSD, aOwnersUSD)`, `reportarPagoStaking(...)`,
`tocarWallet(wallet)`, `resumen()`, `verMes(aaaamm)`, `verServicio(hash)`, `bloquear(wallet, bool)`.

**PENDIENTE:** interconectar cada servicio (GridBot, MercadoTokens, Futuros…) para que llame a `reportar()`.
Requiere autorizar cada uno con `setReportador` y un pequeño upgrade de cada contrato para que reporte.

### 3.10. Perfiles de usuario (Firebase) — NUEVO
- Nombre + foto de perfil por wallet, guardados en Firestore (colección **`perfiles`**, id = wallet en minúsculas).
- Misma dinámica que los logos: reductor de imagen (WebP pequeño) + API REST, sin depender del dominio.
- **Cartel OBLIGATORIO**: al entrar a perfil, si la wallet no tiene nombre Y foto, debe completarlos para ver los datos.
- Reconocimiento de wallet: cada wallet carga su nombre/foto al conectarse. Web y móvil (mismo `perfil.js`).
- Archivos: `assets/js/perfil.js`, `assets/js/firebase-perfil.js`.
- **Reglas de Firestore actualizadas** (logos + perfiles). Guardadas en el repo.

## 4. LO QUE FALTA POR HACER (nada se olvida)

### 4.0. MercadoTokens — HECHO ✓ (frontend, Firebase, seguridad, compra desde swap)
- [ ] **Frontend web**: ventana "gemela" al lado del swap (mismo fondo/estilo) para listar y comprar tokens.
- [ ] **Frontend móvil**: sección NUEVA y separada (el swap móvil queda limpio), con explicación completa,
      botón "cómo funciona", y el flujo paso a paso estilo P2P.
- [ ] **Reductor de imagen del logo**: al subir el logo, redimensionar en el navegador (canvas) a ~64x64 WebP
      a color (sin deformar, sin blanco y negro) antes de subir a Firebase, para que quepan millones de logos.
- [ ] **Firebase**: crear cuenta nueva SOLO para los logos de los tokens listados.
- [ ] Buscador: por nombre, por símbolo o por contrato (los tres son campos obligatorios del listado).

### 4.1. Pendientes del GridBot / swap
- [ ] **GridBot V11 se redesplegó varias veces**; la implementación FINAL y en uso es
      `0x89bc0f298218118D9DF3Be49672961914fA3aF34` (arregla el bug del `receive()` que hacía
      revertir los swaps hacia BNB por el gas stipend del WBNB). El proxy sigue siendo `0x4e86…F93B`.
- [ ] **La librería SwapLib se metió INLINE** dentro del GridBotV11 (ya NO se linkea aparte). Un despliegue anterior
      falló porque Remix no linkeó la librería externa. Mantener SwapLib inline en futuros upgrades.
- [ ] **El swap prueba los 4 fee tiers de Pancake** (0.01/0.05/0.25/1%) automáticamente: si un pool no tiene
      liquidez, usa el siguiente. Esto arregló el swap que revertía con fee 100.
- [ ] **Añadir Uniswap V3 como segundo DEX** (respaldo si Pancake falla). ANTES hay que
      **verificar que la interfaz `exactInputSingle` de Uniswap SwapRouter02 es compatible**
      con el contrato (Uniswap la tiene distinta a Pancake; si no, adaptar). Direcciones
      candidatas BSC: SwapRouter02 `0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2`, quoter por
      confirmar. Se añade con `agregarDex`. **No añadir sin verificar** (rompería el fallback).
- [ ] **Panel de salud de proveedores** en el frontend: leer `numDexes` y `dexes(i)` para
      mostrar verde/rojo (cuál se usa, cuál falla) y poder corregir antes de que se quejen.
- [ ] **Cobro automático desde el perfil** (`cobroAuto`): que el usuario active en su perfil
      el permiso para el cobro; conectarlo en el frontend.
- [ ] **Mejorar el bot Auto-Sell (Cash Out)**: hoy es solo una orden límite (vende a +X%);
      si el mercado baja meses, el capital se devalúa esperando. Hacerlo más inteligente.

### 4.2. Owners y tesorería
- [ ] **owner2 real:** hoy owner2 = wallet del owner. Cambiar por la wallet del segundo
      owner cuando exista, con `setOwner2` (desde el panel admin que se creará).
- [ ] **Contrato Tesorería:** crear un contrato que reciba el 80 % del exchange, con
      historial on-chain (quién retiró, cuánto, cuándo) y límites/multisig, en vez de mandar
      a una wallet suelta. Luego `setTesoreria(dirTesoreria)` en GridBot, Staking, Futuros.

### 4.3. Futuros
- [ ] **Completar la ejecución real en PancakeSwap** (comprar/vender spot en long/short) y
      la **propina de liquidación** (cualquiera liquida). Hoy la contabilidad está lista y
      testeada, falta la ejecución. Ver README-V6 secciones 2–4 y 14.
- [ ] Desplegar Futuros y **autorizarlo en el Staking** (`autorizarContrato`) para que pida
      préstamos y deposite el 50 %.

### 4.4. Frontend (todo el sitio, pendiente de conectar)
- [ ] **Conectar la web a los contratos nuevos** (staking, oráculo, panel, gridbot V11).
      Los contratos están en la cadena, pero la web todavía no los usa del todo.
- [ ] **Frontend de Staking** ya rediseñado; falta enlazar bien todas las lecturas reales.
- [ ] **Área de swap y bots**: apuntar al GridBot V11 y sus nuevas funciones de cobro.
- [ ] **Tercer botón "Staking"** en el hero/lobby (junto a Bots y Swap). *(Verificar: el
      enlace "Staking" ya existe en index.html; confirmar que se ve en el hero.)*
- [ ] **"Instalar app"** en web no instala; solo muestra el aviso. Implementar la instalación
      real (PWA).
- [ ] **Panel administrativo** (existe pero está oculto): conectarlo a Tarifas V2, GridBot,
      Staking y Tesorería. Debe permitir: cambiar %, precio de bots, owners, tesorería,
      corregir DEX, ver salud de proveedores. Todo con firma (queda en la blockchain).

### 4.4-bis. MetaMask: dominio marcado y parpadeo (de esta sesión)
- [ ] **Dominio "criptocubaoficial.com" marcado como malicioso** en MetaMask (falso positivo). Se reportó en
      https://github.com/MetaMask/eth-phishing-detect/issues pidiendo su retiro. Revisar respuesta en el issue.
      El dominio es temporal (falta nombre/marca definitiva de la plataforma).
- [ ] **Parpadeo "probable que falle"**: era el gasLimit fijo. Ahora el swap usa `estimateGas` + 35% de margen
      (en gridbot.js) para que MetaMask no re-simule en conflicto.
- [ ] **Saldo del MAX bloqueado**: el swap leía el saldo de un RPC con caché. Ahora lo lee del proveedor de
      MetaMask (saldo real). Ver `lectorFresco()` en gridbot.js.

### 4.4-ter. Pendientes GRANDES del proyecto (mencionados por el owner)
- [ ] **Interconectar TODO con Contabilidad**: cada servicio llama a `reportar()`. Autorizar cada uno.
- [ ] **Panel administrativo** conectado a TODOS los contratos (no solo visor): cambiar %, owners, DEX,
      bloquear wallets, ver ganancias por owner, ver pagos del staking a cada wallet con sus hashes, etc.
      Idea: alojar la interfaz del panel en Firebase (privada); la seguridad real la da el `soloOwner` de cada contrato.
- [ ] **Reparto directo (sin tesorería)**: confirmado que NO se crea contrato tesorería. Todo reparte
      20% staking / 50-50 owners en el momento. Asegurar que Futuros y demás lo hagan.
- [ ] **Bridge Pool**: contrato existe pero NO está interconectado. Probablemente recrearlo para que aporte
      20% al staking e interconectarlo con Contabilidad. Subir el mínimo de apuesta (ahora $1.50 es muy poco).
- [ ] **Área de Seguridad (revoke de permisos)**: NUEVO. Que el usuario conecte su wallet, vea todos los
      permisos (approvals) que ha dado, y pueda revocarlos. Cobrar una pequeña comisión, 20% al staking.
- [ ] **Academy**: contrato conectado a un keeper que no funciona. Revisar.
- [ ] **Prize Pool**: NO es proxy; hay que rehacerlo. Interconectar con staking y Contabilidad.
- [ ] **Completar Futuros**: la ejecución real en PancakeSwap (la contabilidad ya está).
- [ ] **Mejorar el bot Cash Out** (hoy solo vende a +X%; mejorar para no quedar en pérdida).
- [ ] **Pie de página**: rehacerlo como un "Cómo funciona" completo (seguridad, futuros, staking, swap,
      listado), con tutoriales paso a paso. Penúltima tarea antes de Cloudflare.
- [ ] Nota: el proyecto es MUCHO más grande que "lo básico". Meses de trabajo por delante.

### 4.5. Keeper (disparo de bots y órdenes)
- [ ] **Cloudflare de pago** falló al acreditarse; reintentar con otra tarjeta. Mientras,
      el keeper del GridBot es la wallet del owner (temporal).
- [ ] Estrategia final: **"cualquiera liquida/ejecuta"** con propina (bots externos lo hacen
      solos, coste $0) + Cloudflare de respaldo. Evitar depender de un solo keeper.
- [ ] Revisar por qué Cloudflare disparaba de más (correos de límite sin uso): posible bucle.

### 4.6. Multi-proveedor de datos (no solo un proveedor de nada)
- [ ] **Precios:** hoy el frontend usa oráculo on-chain + CoinGecko de respaldo. Añadir otra
      fuente más por si ambas fallan.
- [ ] **Logos de monedas:** revisar de dónde salen y tener un respaldo.
- [ ] **Intercambios (swaps):** Pancake + (pendiente) Uniswap + idealmente un tercero.

---

## 5. Orden sugerido de trabajo (para no perderse)

1. Conectar el **frontend** al GridBot V11 (swap + bots + cobro nuevo) y al Staking.
2. Verificar y **añadir Uniswap** como segundo DEX (con su interfaz comprobada).
3. Crear el **contrato Tesorería** y apuntar todos los contratos a él.
4. Completar la **ejecución de Futuros** y desplegarlo.
5. Conectar el **panel administrativo** (owners, %, precios, DEX, salud).
6. Resolver el **keeper** definitivo (propina + Cloudflare).
7. Mejorar el bot **Auto-Sell**.

---

## 6. Recordatorios de seguridad (no romper nada)

- **Nunca** cambiar el orden del storage en un upgrade (rompe los datos). En V11 se respetó
  el layout exacto del V10 y las variables nuevas van al final.
- **Siempre** desplegar la implementación suelta, probar una lectura, y solo entonces
  apuntar el proxy con `upgradeToAndCall(nuevaImpl, 0x)`.
- **GridBotV11 usa la librería SwapLib**: al compilar/desplegar hay que linkear su dirección
  `0x8713F1ABF29fBF912D032eA1c1c60380A8De901f`. La implementación desplegada ya está linkeada.
- Añadir un DEX o token **sin verificar** su dirección/interfaz es justo lo que causó la
  caída del swap. Verificar siempre antes.
