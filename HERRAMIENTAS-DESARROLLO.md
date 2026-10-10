# Herramientas para desarrollar CriptoCuba (runbook)

Lo que siempre uso para construir, auditar y **probar** los contratos de la
plataforma antes de entregarte nada. Guárdalo: es el procedimiento fijo.

## 0) Skill del proyecto (siempre activa)
- **`criptocuba-reglas`** — reglas obligatorias del repo: buscar causa raíz antes
  de tocar código, un solo cambio por entrega, no reescribir bloques enteros, no
  volver a soluciones ya descartadas, y comprobar que **compila y no queda código
  basura** antes de entregar. Aplica a cada tarea (web, móvil, contratos).

## 1) Dónde se trabaja (y por qué no toco la cadena)
- Todo se compila y se prueba en un **entorno local aislado** (una carpeta de
  trabajo con Node). **No** se despliega en BSC desde aquí.
- La shell **llega a npm y a GitHub**, pero **NO a la RPC de BSC** (la bloquea el
  allowlist del proxy → 403). Por eso **no leo la cadena**: todo se verifica en una
  **EVM local en memoria** que reproduce exactamente el bytecode de producción.
- Consecuencia práctica: los datos de la cadena (p. ej. un valor on-chain) me los
  confirmas tú o los deduzco; las pruebas de lógica las corro yo enteras en local.

## 2) Toolchain (instalar una vez con `npm install`)
| Paquete | Versión | Para qué |
|---|---|---|
| `solc` | 0.8.22 | compilar Solidity (mismo compilador que Remix) |
| `@openzeppelin/contracts` | 5.0.2 | `ERC1967Proxy` y utilidades |
| `@openzeppelin/contracts-upgradeable` | 5.0.2 | `Initializable`, `UUPSUpgradeable` |
| `@ethereumjs/vm` | 8.1.1 | ejecutar una EVM real en local |
| `@ethereumjs/util` | 9.1.0 | cuentas/direcciones en la EVM |
| `@ethereumjs/common` | 4.4.0 | parámetros de red de la EVM |
| `@ethereumjs/tx` | 5.4.0 | (dependencia de la VM) |
| `ethers` | 6.17.0 | codificar ABI de structs complejos y keccak/selectores |
| `ethereum-cryptography` | 2.2.1 | keccak256 (claves de bot, selectores) |
| Node.js | 22 | runtime |

Procedimiento de instalación (lo que hago yo por mi cuenta):
```
npm install solc@0.8.22 @openzeppelin/contracts@5.0.2 \
  @openzeppelin/contracts-upgradeable@5.0.2 \
  @ethereumjs/vm@8 @ethereumjs/util@9 @ethereumjs/tx@5 @ethereumjs/common@4 \
  ethers@6 ethereum-cryptography@2 --break-system-packages
```
(`--break-system-packages` solo si el entorno lo pide; en Node normal no hace falta.)

## 3) Config de compilación de PRODUCCIÓN (fija, igual en Remix y en local)
- solc **0.8.22**, optimizer **enabled, runs = 1**, evmVersion **shanghai**,
  metadata **bytecodeHash = none**, **viaIR = NO**.
- Con esta config el bytecode calza bajo el límite y coincide con lo que mides en
  Remix. Si cambias algo de aquí, el tamaño deja de cuadrar.

## 4) Chequeos obligatorios antes de entregar (los 4 "candados")
1. **Compila** sin errores con la config de arriba.
2. **Tamaño** del contrato principal ≤ **24 576 bytes** (se mide el deployedBytecode
   **sin metadata**). Hoy: GridBotV14 = 24 187 (margen 389).
3. **Almacenamiento compatible** con el V13 desplegado: se saca el `storageLayout`
   de ambos y se comparan slot a slot. Ningún campo existente se puede mover; los
   nuevos van **al final** del struct. (Script `check_v14.mjs`.)
4. **Pruebas en EVM local** (todas en verde). Hoy 99/99:
   - núcleo de la lógica (Cash Out) — 29/29
   - arquitectura librería-sobre-storage (delegatecall) — 5/5
   - librería por el **camino real de swap** (no custodial) — 26/26
   - **integración** del contrato principal tras un **proxy UUPS real** con las dos
     librerías enlazadas — 39/39

## 5) Cómo enlazo librerías externas en local (igual que Remix, pero automatizado)
- Compilo pidiendo `evm.bytecode.linkReferences`.
- Despliego en orden: `SwapLib` → `CashOutLib` (enlaza SwapLib) → `GridBotV14`
  (enlaza ambas) → `ERC1967Proxy` → `initialize`.
- El enlazado es sustituir el placeholder `__$…$__` por la dirección de la librería
  en las posiciones exactas que da `linkReferences`. En Remix esto lo hace la GUI.

## 6) Método de prueba de integración (lo que de verdad da confianza)
Monto el stack como en producción (proxy + 2 librerías), inicializo, y ejecuto los
flujos reales con tokens/oráculo/router simulados: cobro atómico, abrir Cash Out,
comprar niveles en el trigger, resolver con piso, re-montaje 50/50, grid intacto,
atomicidad del cobro, 20% al stake y el reinicializador que quema los proxies.

## 7) Para verificar en BscScan tras desplegar
Cada contrato (SwapLib, CashOutLib, GridBotV14 impl) se verifica con **su** código y
**la misma** config (0.8.22, runs=1, shanghai, sin metadata). Al verificar un
contrato que usa librerías externas, BscScan pide las **direcciones de las librerías**
(las que te dio Remix al desplegarlas). El proxy ya está verificado como proxy.
