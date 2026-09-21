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
| **GridBot** | Bots + swap (multi-DEX) | `0x4e86430BC2260FE359d1Ea7Eef8B595fB241F93B` | V11: `0xb2792C4D8Cf552cC0Da0938fD7F73DC82B5A3052` |
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

## 4. LO QUE FALTA POR HACER (nada se olvida)

### 4.1. Pendientes del GridBot / swap
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
