# CriptoCuba Oficial — README V5 (Mercado P2P, Staking y Unificación de contratos)

> **Propósito.** Este documento continúa `README.md` (V1), `README-V2.md` (V2, app
> móvil), `README-V3.md` y `README-V4.md` (V4, pausa por Cloudflare). Recoge lo nuevo:
> los **tres contratos del Mercado P2P** (Tarifas, PerfilesP2P, MercadoP2P), el
> **modelo de Staking con reparto del 20 %** de todas las comisiones de la plataforma,
> y el **plan para unificar e interconectar todos los smart contracts** bajo un único
> registro central editable desde el panel administrativo. Léelos en orden y tendrás
> el contexto completo para retomar sin perder nada.

---

## 0. Objetivo de esta etapa (en una frase)

**Que toda la plataforma sea un solo organismo:** todos los contratos leen sus
comisiones de un único registro central (`Tarifas`), todos son actualizables (proxy
UUPS), y un cambio en el panel administrativo se refleja **al instante y al unísono**
en todos los servicios. Ningún contrato queda aislado ni con comisiones propias
sueltas.

---

## 1. Reglas de trabajo INVIOLABLES

- **No custodial:** el dinero del usuario nunca sale de su wallet salvo el escrow del
  P2P (que retiene fondos del vendedor y los libera por tramos). Permisos por monto
  exacto y revocables.
- **Sin backend ni APIs de pago.** Todo on-chain. Única API externa: CoinGecko (gratis)
  para precios y logos. Firebase solo para foto/nombre de perfil Pro y KYC.
- **Todos los contratos nuevos son proxy UUPS** (actualizables). Los que aún no lo sean
  (ver §7) se migran o se envuelven para que interactúen con el registro central.
- **Idioma:** inglés por defecto; español solo si el usuario lo elige desde el perfil.
- **Interfaz:** cada cambio se hace en web y, aparte, en versión app para móvil.

---

## 2. Los tres contratos del Mercado P2P (desplegados y verificados)

Los tres son **UUPS (proxy + implementación)** en **BNB Smart Chain (chainId 56)**,
compilados con **Solidity 0.8.24**, **optimizer runs 200**, **EVM shanghai**,
**sin viaIR**, licencia **MIT**. El código fuente está en `contracts/`.

| Contrato | Proxy (dirección oficial) | Implementación |
|---|---|---|
| **Tarifas** | `0x068729CBB708713266FFdE2374e51db2B063FD7C` | `0xcFC27E025947ADFC109B27bD43726fEA81bA543F` |
| **PerfilesP2P** | `0xC01B61B702011747B4c0Ee6B5F2d0F2b4B66880c` | `0xCeA7DD129BF53ac7Ac54CAD6bCA70425449e86eD` |
| **MercadoP2P** | `0x17B47a8Fb97F8980b96c94E4b9137182e0Bf8025` | `0x1e02c7FaBe2e6eeAc8c17a0689C46E6170aCa2a9` |

> **Regla de oro:** para interactuar (leer, escribir, conectar) se usa **siempre la
> dirección del PROXY**, nunca la de la implementación.

### 2.1. Qué hace cada contrato

**Tarifas** — *el registro central de comisiones de toda la plataforma.*
Un solo sitio donde el panel administrativo escribe y del que todos los contratos leen.
Guarda: comisión por servicio en puntos básicos (P2P, Swap, Futuros, Bots…), mínimo y
máximo por token, wallets exentas, descuento Pro (50 %), códigos promocionales (con
registro de qué wallet los usó), y multi-admin (principal + hasta 3 directores). Cambiar
un número aquí cambia el cobro en toda la plataforma.

**PerfilesP2P** — *identidad pública, reputación y confianza del Marketplace.*
Perfil y contacto (Telegram, WhatsApp, teléfono, horario, país, ciudad); calificaciones
1–5 con comentario solo entre las dos partes de una orden cerrada; badge "verificado";
estadísticas (completadas, canceladas, disputas perdidas, velocidad de liberación, tasa
de finalización); baneo automático a las 2 disputas perdidas; pausa por cancelaciones
repetidas; límite de órdenes simultáneas que crece con la reputación. Solo el escrow
puede escribir aquí.

**MercadoP2P** — *el escrow, sin custodia de la plataforma.*
Anuncios con stock que varios compradores toman por partes; tramos a medida; liberación
tramo a tramo con patrón CEI (efectos antes de enviar, protegido contra reentrada);
comisión leída de Tarifas con reparto **25 % al padrino de referido / 75 % plataforma**;
contabilidad estricta de lo custodiado (imposible rescatar fondos de usuarios, rechazo de
tokens con transferencia trucada); disputas con árbitro aleatorio y resolución parcial con
motivo; retirada de emergencia justa para ambas partes; anuncios "personalizados" sin
escrow (MLC, CUP, saldo…); wallets bloqueadas; actualización con espera de 48 h.

### 2.2. Cómo se conectan (pendiente de ejecutar)

Los tres están desplegados pero **aún no interconectados**. La conexión se hace con
llamadas de una sola vez desde el panel o desde BscScan (Write as Proxy):

1. En **Tarifas** → `autorizarContrato(MercadoP2P, true)` (permite al escrow registrar el
   uso de códigos promocionales).
2. En **MercadoP2P** → `setTarifas(Tarifas)` y `setPerfiles(PerfilesP2P)`.
3. En **PerfilesP2P** → `setTarifas(Tarifas)` y `setMercado(MercadoP2P)`.

Owner de arranque de los tres: la wallet principal `0x97e0…bca7d`. Multi-owner
(principal + 3 directores con llaves en países distintos) se gestiona desde Tarifas.

### 2.3. El fantasma de la verificación (para no repetirlo)

MercadoP2P costó horas de verificar en BscScan. La causa **NO** era el contrato: el
`remix.config.json` tenía **`runs: 200`** aunque la pantalla mostrara `runs: 1`. Remix,
con "Use configuration file" activo, compila con lo del archivo (200), no con lo de la
pantalla. Además BscScan no resuelve imports con `@5.0.2` en la ruta ni casa el bytecode
del "flat" con el del multi-archivo. **Solución que funcionó:** verificar por
**Standard-Json-Input**, con las rutas de OpenZeppelin sin `@5.0.2`, **runs 200**,
**EVM shanghai**. Tarifas y PerfilesP2P se verificaron con el código plano (single file)
porque son pequeños; MercadoP2P solo con el JSON.

---

## 3. Modelo económico unificado

Regla única, sin fragmentar: lo transaccional cobra un **porcentaje pequeño**; lo premium
es **una sola suscripción**; lo de juego es **ticket fijo**. Todos los porcentajes viven en
`Tarifas` y son editables desde el panel administrativo.

| Servicio | Cobro |
|---|---|
| Swap | 0,15 % (mín $0.05) |
| P2P | 0,30 % al vendedor al liberar (mín $0.20, máx $3); 0 % en "personalizado" |
| Futuros | 0,04 % por abrir/cerrar + 0,5 % de liquidación |
| Bots | activación única ≈ $1 / 30 días (todos los bots que quiera) |
| Prize Pool | ticket fijo $1.50 |
| Pro (bots + academy + análisis + tools) | $9.99/mes · $24.99/3m · $79/año |
| Pro del Marketplace | $6.99/mes · $29.99/6m · $49.99/año (50 % de descuento en comisiones, prioridad, foto/nombre, KYC, panel vendedor) |

Referidos del P2P: el padrino cobra el **25 %** de la comisión que generan sus referidos;
el 75 % queda para la plataforma.

---

## 4. Staking (antes "Add liquidity") — el 20 % de TODA la plataforma

> El área que antes se llamaba **Add liquidity** ahora se llama **Staking** (en móvil y
> web; acciones **Stake / Unstake**).

**Idea central:** quien aporte capital en Staking no gana solo por los resultados de los
traders de futuros, sino por **toda la actividad de la plataforma**.

- **Reparto del 20 %.** Un **20 % de todas las comisiones y ganancias** que genera la
  plataforma (swap, P2P, futuros, bots, academy, prize pool, y en el futuro el área de
  seguridad) se destina a **pagar a quienes hacen staking**. El otro 80 % es de la
  plataforma. **Este porcentaje es editable desde el panel administrativo.**
- **Distribución equitativa por participación.** Ese 20 % se reparte entre todos los que
  tienen fondos en staking **en proporción a su aporte** (quien pone más, recibe más;
  quien pone menos, recibe menos). No es un APR fijo prometido: es un reparto real de lo
  que la plataforma efectivamente genere.
- **Comisión de retiro (unstake).** Al retirar los fondos se cobra una comisión de **1 %
  o menos** (nunca gratis, porque es un servicio). Sobre el capital retirado más lo
  ganado. **Este porcentaje también es editable desde el panel administrativo.**
- **Plazos:** el staking mantiene los plazos ya existentes; solo se puede retirar el
  aporte cuyo plazo haya vencido.

**Implicación técnica:** para que el staking cobre el 20 % de *todo*, cada contrato de la
plataforma (swap, bots, futuros, P2P, academy, prize pool) tiene que **enviar su parte
al bote común del staking** en cada cobro, o registrar en `Tarifas`/un contrato de reparto
cuánto generó. Por eso la unificación (§5) es requisito para que el staking funcione como
se describe.

---

## 5. Plan de unificación de todos los contratos

**Meta:** un solo cerebro (`Tarifas` + un contrato de reparto/tesorería) del que todo
dependa, y que todo sea proxy para poder evolucionar sin redesplegar.

**Orden de trabajo:**

1. **Interconectar los tres del P2P** (Tarifas ↔ Perfiles ↔ Mercado). *Siguiente paso
   inmediato.*
2. **Contrato `Pro`** (suscripción única) del que Bots, Academy y Análisis pregunten
   "¿está activa?".
3. **Contrato de tesorería/reparto de Staking:** recibe el 20 % configurable de cada
   cobro y lo reparte entre los stakers por participación; cobra el 1 % configurable al
   hacer unstake.
4. **Upgrades por proxy** de los contratos existentes (Swap, Bots/GridBot, Academy,
   Prize Pool) para que: (a) lean su comisión de `Tarifas` en vez de tenerla propia, y
   (b) envíen el 20 % al bote del staking en cada cobro.
5. **Migrar a proxy lo que no lo sea.** Todo contrato que no sea actualizable se
   redespliega como UUPS o se envuelve, para que ninguno quede fuera del sistema.
6. **Conectar el panel administrativo** (5 clics en la esquina inferior izquierda, solo
   wallet owner) para que escriba en `Tarifas`, `Pro` y la tesorería. Cambias un número
   en un sitio → cambia en toda la plataforma al instante.

**Principio:** *todo debe reaccionar al unísono a un cambio en el panel administrativo.
Todo debe enterarse de lo que está pasando.*

---

## 6. Método de trabajo: testear contrato por contrato

Hay servicios rotos hoy que hay que arreglar mientras se unifica:

- **Bots:** no pueden ejecutar posiciones. Algo está roto en la ejecución (revisar
  activación, keeper, permisos y lectura de Tarifas).
- **Swap:** no puede ejecutar operaciones. Revisar el contrato de swap y su ruta con
  PancakeSwap.

Regla: se va **contrato por contrato**, se testea aislado, se conecta al registro
central, se vuelve a testear conectado, y solo entonces se pasa al siguiente. No se
conecta nada a ciegas.

---

## 7. Inventario de contratos (estado y tipo)

| Contrato | Tipo | Estado |
|---|---|---|
| Tarifas | UUPS proxy | ✅ desplegado y verificado |
| PerfilesP2P | UUPS proxy | ✅ desplegado y verificado |
| MercadoP2P | UUPS proxy | ✅ desplegado y verificado (falta interconectar) |
| GridBot (bots) | UUPS proxy | desplegado; ejecución rota; falta leer de Tarifas |
| AurexSwap (swap) | directo, sin proxy | desplegado; ejecución rota; migrar a proxy y a Tarifas |
| AurexPrizePool | UUPS proxy | desplegado; falta leer de Tarifas |
| Academy | por confirmar tipo | desplegado; falta leer de Tarifas |
| Pro (suscripción única) | UUPS proxy | por escribir |
| Tesorería/Reparto Staking | UUPS proxy | por escribir |

---

## 8. Cómo verificar un contrato en BscScan (receta que funciona)

1. Método: **Solidity (Standard-Json-Input)**.
2. Dirección: la de la **implementación** (no el proxy).
3. Compiler: **v0.8.24+commit.e11b9ed9**.
4. Subir el **JSON estándar** con: rutas de OpenZeppelin **sin `@5.0.2`**, optimizer
   **enabled, runs 200**, **evmVersion shanghai**, sin viaIR.
5. Licencia: **MIT**.

Para contratos pequeños (Tarifas, PerfilesP2P) el código plano (single file) también
sirve. Para grandes (MercadoP2P), solo el JSON.

---

## 9. Direcciones y datos clave (para copiar)

- **Owner principal:** `0x97e0…bca7d`
- **Tarifas (proxy):** `0x068729CBB708713266FFdE2374e51db2B063FD7C`
- **PerfilesP2P (proxy):** `0xC01B61B702011747B4c0Ee6B5F2d0F2b4B66880c`
- **MercadoP2P (proxy):** `0x17B47a8Fb97F8980b96c94E4b9137182e0Bf8025`
- **Red:** BNB Smart Chain, chainId 56 (`0x38`)
- **Compilador:** Solidity 0.8.24, optimizer runs 200, EVM shanghai, sin viaIR, MIT

---

## 10. Próximos pasos (en orden)

1. Interconectar los tres contratos del P2P (§2.2).
2. Frontend nuevo del Marketplace P2P (web como sección completa tipo bots; móvil app),
   con selector de monedas con logos, anuncios personalizados, Pro, referidos y panel del
   vendedor.
3. Escribir `Pro` y la Tesorería/Reparto de Staking (§5).
4. Upgrades de Swap, Bots, Academy y Prize Pool para leer de Tarifas y aportar el 20 % al
   staking.
5. Arreglar la ejecución rota de bots y swap (§6).
6. Conectar el panel administrativo a Tarifas, Pro y Tesorería.
7. Contrato de Futuros + Staking on-chain.
8. Keeper de Cloudflare al final.
