# DecFreedom · Sección Análisis — Hoja de ruta y Smart Contract

> Documento de contexto y especificación técnica.
> Dominio oficial: **decfreedom.com**. Dominio temporal, no válido, que NO debe usarse en enlaces ni comunicaciones: criptocubaoficial.com.
> Red: **BNB Smart Chain** (chainId `0x38`). Moneda de cobro: **BNB** (precios fijados en USD y convertidos con el oráculo del sitio).
> Última actualización: noviembre 2026.

---

## 0. Resumen ejecutivo

La sección Análisis es el mercado de herramientas de trading de la plataforma: una rejilla de tarjetas (indicadores, estrategias y utilidades) que el usuario abre sobre una gráfica profesional. Hoy el front ya tiene el catálogo por servicio, el carrito y el buscador funcionando, pero **el cobro está desconectado**: el acceso es libre de forma temporal mientras se despliega el contrato definitivo.

Lo que viene a continuación tiene tres bloques:

1. **Producto y precios.** Dos servicios gratis como gancho de entrada (Multichart y Trading Demo) y cinco de pago con precio propio cada uno. Hay que marcar Multichart como gratis y pasar de un precio único a un precio por servicio.
2. **Programa de referidos.** Un botón nuevo en la barra de Análisis que entrega al usuario un enlace con su wallet. Quien llega por ese enlace y paga servicios deja un 10% perpetuo a quien lo refirió. La mecánica de referidos ya existe en la plataforma (Terminal) y se reutiliza tal cual.
3. **Smart contract "AnálisisPagos".** Un contrato proxy actualizable que cobra los servicios en BNB, reparte cada pago entre referido, staking, los dos owners y, cuando el servicio es de un tercero, el dueño de ese servicio; registra quién refirió a quién; permite dar de alta servicios nuevos sin tocar código; se conecta a los contratos de Contabilidad y Staking que ya tenemos; y conoce a su owner desde el primer bloque, sin esperas de 48 horas para operar.

Todo lo que sigue está anclado a contratos y módulos que **ya existen en el repositorio**. No se parte de cero: se clona la estructura del contrato de acceso que ya teníamos para Análisis (`AnalisisPro.sol`) y se le injerta el motor de reparto con referidos que ya está probado en el Terminal (`OrdenesTerminal.sol`).

---

## 1. Contexto: en qué punto estamos

### 1.1 El front de Análisis (hoy)

Ruta: `modules/analysis/` (`analisis.html`, `analisis.js`, más los módulos de cada herramienta).

- `abrirAnalisis()` **ya no muestra ninguna ventana de cobro**. El comentario en `analisis.js` lo dice literal: la ventana de cobro fue eliminada, el acceso es libre y el pago pasará a ser **por servicio** con un contrato nuevo todavía por desplegar. Entra directo al selector de herramientas.
- El selector es una rejilla de tarjetas (`HERRAMIENTAS`) con buscador, filtros por categoría y **carrito** (`CART_KEY = 'an-carrito'`, en `localStorage`).
- Cada tarjeta puede abrir un popup con descripción, precio mensual, precio anual y botones de pago o de añadir al carrito. Hoy esos botones solo muestran un aviso: *"El pago por servicio se conecta en la última fase (contrato)."*
- El precio hoy es **uniforme**: `MES_BASE = 25` USD y `ANIO_BASE = 300` USD por servicio, con un descuento por cantidad cuando se compran varios juntos (`DESC_MES = [0, 0.15, 0.30]`, `DESC_ANIO = [0, 0.25, 0.50]`). El propio código deja la nota de que, en la fase siguiente, el `serviceId`, el precio y el rating se leerán del contrato.
- Todo se paga en BNB. Los precios son la unidad de cuenta en USD y se convierten con el oráculo del sitio: `OraculoPrecios.precioUSD(address(0))` devuelve cuántos USD vale 1 BNB, con 18 decimales. Dirección del oráculo: `0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3`.

### 1.2 El contrato que ya teníamos: `AnalisisPro.sol`

Ruta: `contracts/Futuros/AnalisisPro.sol`. Proxy desplegado: `0x8e04ACEc37aE1D8fA6239d4407a73316bFC97469` (binding en `modules/analysis/analisis-pro.js`).

Es un contrato de **acceso de pago a Análisis** con planes mensual y anual, cobro en BNB o USDT vía oráculo, prueba gratis de 10 minutos registrada en cadena, acceso por tiempo que "se apaga solo" al vencer sin necesidad de un robot, multiowner y reporte a Contabilidad. Funcionó como puerta única de toda la sección.

**Por qué no se reutiliza tal cual:** cobra el acceso a la sección entera (un único precio mes o año), no servicio por servicio, y no reparte a referidos ni a staking ni contempla dueños externos de un servicio. El modelo de negocio cambió: ahora cada tarjeta tiene su precio y su posible dueño, y cada pago alimenta el programa de referidos. Por eso se construye un contrato nuevo que **toma la estructura de `AnalisisPro`** y le añade el **motor de reparto del Terminal**.

### 1.3 Lo que ya está construido y seguirá igual

Los módulos de cada herramienta ya existen y son independientes del cobro: Multichart (`modules/multichart/`), Trading Demo (`modules/trading-demo/`), VWAP Pro (`modules/institutional/`), Reaction Zones, Liquidity Pools, Heat Pools y Smart Pools. El contrato solo decide **quién puede abrir qué** y **cobra**; no toca el contenido de las herramientas.

---

## 2. Catálogo de servicios y precios

### 2.1 Tabla definitiva

| Servicio | id interno | abre | categoría | Precio / mes | Nota |
|---|---|---|---|---|---|
| **Multichart** | `multi` | `multi` | analysis | **Gratis** | poner etiqueta Free (gancho) |
| **Trading Demo** | `demo` | `demo` | trading | **Gratis** | ya marcado Free |
| **Liquidity Pools** | `pools` | `pools` | indicator | **12.00 USD** | |
| **Heat Pools** | `hair` | `heat` | indicator | **15.00 USD** | |
| **Smart Pools** | `smart` | `levels` | indicator | **5.00 USD** | |
| **VWAP Pro** | `inst` | `inst` | analysis | **2.50 USD** | |
| **Reaction Zones** | `react` | `react` | analysis | **2.50 USD** | |

Dos gratis como entrada para atraer usuarios, cinco de pago. Los nombres y los `id` son los que ya están en `analisis.js` (array `HERRAMIENTAS`).

> El precio anual no se ha fijado todavía. Propuesta por defecto, editable por servicio en el contrato: **anual = 10 meses** (dos meses de regalo). Queda a criterio del owner.

### 2.2 Etiqueta "Free" para Multichart

El sistema de etiqueta gratis **ya existe**. En `analisis.js` el render de cada tarjeta ya pinta "Free" cuando la herramienta tiene el flag `free`, con su estilo verde `.an-free`. Trading Demo ya lo usa. Para Multichart basta con añadir `free: true` a su objeto en `HERRAMIENTAS`; la tarjeta mostrará el sello Free, no abrirá cobro y entrará directa a la herramienta.

### 2.3 De precio único a precio por servicio

Hoy el precio es uniforme (`MES_BASE`). El cambio es:

- Cada objeto de `HERRAMIENTAS` lleva su `precioMes` (y opcionalmente `precioAnio`) en USD.
- Los servicios gratis no muestran precio ni botones de pago: van directos a "Open now".
- La fuente de verdad del precio pasa a ser el **contrato**, leído por `serviceId`. El front muestra el precio del contrato y el contrato es quien valida el cobro, de modo que nadie pueda forzar un precio o un descuento manipulando el navegador.

### 2.4 Cómo se cobra en BNB

Los precios viven en USD. En el momento de pagar, el contrato consulta el oráculo (`precioUSD(address(0))` = USD por 1 BNB) y calcula el BNB exacto. Es el mismo patrón que ya usa `AnalisisPro`:

```
BNB_wei = precioUSD_centavos * 1e18 * 1e18 / (100 * precioBNB_USD)
```

El usuario paga en BNB (o, si se quiere, en USDT de BSC `0x55d398326f99059fF775485246999027B3197955`, como ya soporta `AnalisisPro`).

---

## 3. Programa de referidos

### 3.1 Qué gana el usuario

Cada usuario tiene un enlace propio a la sección Análisis que lleva su wallet dentro. Cuando otra persona entra por ese enlace, conecta su wallet y paga cualquier servicio de pago de Análisis, **el 10% de cada pago va a quien la refirió, de forma automática y perpetua**: mientras el referido siga pagando su mensualidad, cada mes su referidor cobra ese 10%. Se paga en BNB, dentro de la misma transacción del pago, sin que nadie tenga que reclamar nada.

### 3.2 La mecánica ya existe (se reutiliza, no se reinventa)

La plataforma ya tiene referidos en el Terminal. Se reutiliza intacto:

- **Front** — `modules/terminal/referidos.js`:
  - El enlace usa el parámetro `?ref=<wallet>`.
  - Al cargar, `capturarRef()` lee `?ref=` de la URL y lo guarda en `localStorage` bajo la clave `df_ref` (gana el primer referidor, no se sobreescribe).
  - `referidorGuardado()` devuelve esa wallet para pasarla al contrato en el momento del pago.
  - El enlace se arma así: `enlaceBase() + '?ref=' + wallet`.
- **On-chain** — mapeo sticky referidor→referido (ver sección 5.6): se fija una sola vez, no admite auto referido y no se cambia.

### 3.3 El botón de referidos en la barra de Análisis

- **Dónde:** a la **izquierda del botón del carrito** en la barra superior de Análisis.
- **Regla estricta:** el carrito NO se mueve a la derecha; se queda donde está. Para hacer sitio, se **encoge un poco la barra de búsqueda**.
- **Cómo encaja sin mover el carrito:** en la barra (`analisis.js`), la búsqueda es un elemento flexible (`.an-search`, `flex: 1 1 300px`) y el carrito va al final. Al insertar el botón de referidos (`#an-refbtn`) **entre** la búsqueda y el carrito, la búsqueda cede espacio por sí sola y el carrito permanece pegado a la derecha. No hace falta recolocar el carrito.

### 3.4 La ventana de referidos

Al tocar el botón se abre un popup con el estilo de la interfaz que explica, en lenguaje claro:

- Que ganará mensualmente un porcentaje de lo que paguen las personas que lleguen por su enlace a la sección Análisis.
- Que es sobre los **servicios de pago** (los gratis no generan comisión) y que es **perpetuo** mientras el referido siga activo.
- El **enlace propio** a la sección Análisis, con su wallet dentro, y un botón para **copiar**.
- Opcionalmente, sus estadísticas en cadena (cuánta gente trajo y cuánto lleva ganado), que ya se leen con el ABI de referidos (`refContar`, `ganadoRef`, `referidoDe`).

Formato del enlace de Análisis (mismo esquema que el Terminal, apuntando a la sección Análisis):

```
https://decfreedom.com/modules/analysis/analisis.html?ref=<WALLET_DEL_REFERIDOR>
```

---

## 4. Modelo económico de distribución

Esta es la regla de reparto de **cada pago** de un servicio. Se expresa en puntos básicos (bps), donde 10000 bps = 100%.

### 4.1 La parte fija, no negociable

De todo lo que cuesta un servicio:

- **10% al referido** (`refBps = 1000`). Perpetuo: se paga en cada mensualidad del referido.
- **10% al staking** (`stakingBps = 1000`).
- **Si el usuario que paga no tiene referidor, ese 10% de referido no se queda en el aire: se suma al staking** (el staking recibe 20%). Es exactamente el fallback que ya hace el Terminal hoy.

Ese 20% (o el 10% + 10%) **no se toca nunca**. Lo que sigue reparte el 80% restante.

### 4.2 El 80% restante

**Caso A — servicio propio (creado por la academia, sin dueño externo):**

- **80% a los owners** (`owner1` + `owner2`), por defecto mitad y mitad.

**Caso B — servicio de un tercero (un indicador, bot o herramienta que vende otra persona dentro de la plataforma):**

- **30% a los owners** (`owner1` + `owner2`).
- **50% al dueño del servicio** (la dirección BNB que recibe el tercero).

Si no hay referidor en el caso B: 20% staking + 30% owners + 50% dueño.

### 4.3 Tabla resumen

| Destino | Servicio propio | Servicio de tercero |
|---|---|---|
| Referido (si existe) | 10% | 10% |
| Staking | 10% | 10% |
| Staking extra si NO hay referido | +10% (total 20%) | +10% (total 20%) |
| Owners (owner1 + owner2) | 80% | 30% |
| Dueño del servicio | — | 50% |
| **Total** | **100%** | **100%** |

Reglas de validación en el contrato:

- `refBps + stakingBps + ownersBps + duenoBps == 10000` siempre.
- Si el servicio no tiene dueño (campo vacío o `address(0)`), `duenoBps = 0` y `ownersBps = 8000`.
- Si el servicio tiene dueño, `duenoBps = 5000` y `ownersBps = 3000`.
- El 20% de referido y staking es constante en ambos casos.
- El reparto `owner1` / `owner2` es configurable (por defecto 50/50), igual que en `AnalisisPro`.

---

## 5. El Smart Contract "AnálisisPagos"

### 5.1 Principios de diseño

Es un **proxy UUPS actualizable** (patrón idéntico al resto del core: Solidity `0.8.24`, OpenZeppelin upgradeable 5.0.2, optimizer activado con 200 runs, sin viaIR). Se construye combinando dos contratos que ya tenemos y están probados:

- **Estructura, acceso por tiempo y cobro:** se clona de `contracts/Futuros/AnalisisPro.sol` (planes, `tieneAcceso` sin robot, pago BNB/USDT por oráculo, prueba gratis, multiowner, pausa, reporte a Contabilidad).
- **Motor de reparto con referidos:** se clona de `contracts/terminal/OrdenesTerminal.sol` (reparto staking + referido + owner1 + owner2 en BNB, con fallback al staking, envío que nunca revierte, registro sticky de referidos).

A ese molde se le añade lo propio de este contrato: **catálogo de servicios con precio y dueño por servicio**, y el **destino "dueño del servicio"** en el reparto.

### 5.2 Multiowner y por qué NO habrá espera de 48 horas

Esta es la queja histórica del owner y aquí está la causa raíz, confirmada leyendo los contratos:

- El control de acceso del proyecto **no usa `Ownable` de OpenZeppelin**. Se hace a mano: `mapping(address => bool) esOwner`, una lista de owners, y un `modifier soloOwner` / `soloAdmin`. Varios owners se gestionan entre sí; una wallet cualquiera no puede cambiar nada.
- El contrato **conoce a su owner desde el primer bloque**: en `initialize` se registran `owner1`, `owner2` y la wallet principal como owners (`_agregarOwner(...)`). No hay ventana en la que el contrato "no sepa quién manda".
- **La espera de 48 horas SOLO aplica al upgrade de la implementación**, nunca a las acciones de administración ni al cambio de owner. El mensaje "no eres admin, espera 48 horas" aparece únicamente cuando se intenta `upgradeToAndCall` sin haber llamado antes `proponerUpgrade` y dejado pasar el plazo. **Dar de alta un servicio, cambiar un precio o mover un owner son inmediatos.**
- Cambiar de owner es en dos pasos y **sin ningún retardo**: `transferirOwner(nuevo)` y luego `aceptarOwner()` desde la wallet nueva.

**Decisión recomendada sobre el upgrade:** se puede elegir entre dos variantes, las dos ya usadas en el proyecto:

1. **Upgrade inmediato** (como Contabilidad, WalletShield y TerminalSwap): `_authorizeUpgrade(address) internal override soloOwner {}` vacío. El owner actualiza al instante. Cómodo, sin esperas, y es la opción que elimina por completo el problema de las 48 horas.
2. **Upgrade con plazo de 48 horas** (como OrdenesTerminal): protege al contrato ya vivo con fondos, y permite `cancelarUpgrade()` y ver `upgradePendiente()`. Más seguro una vez en producción.

> Recomendación: desplegar con **upgrade inmediato** durante el desarrollo (cada despliegue es un proxy nuevo, no hay fondos que proteger) y, si se quiere, pasar al plazo de 48 horas solo cuando el contrato esté estable en producción. En cualquiera de las dos variantes, **las acciones de admin nunca esperan**.

Además, como blindaje extra contra el problema de "el contrato no sabe quién soy", se puede **fijar la wallet owner como constante** en el código, de modo que esa dirección sea owner de forma incondicional desde el despliegue:

```solidity
// Wallet de despliegue y owner raíz de toda la plataforma.
address public constant OWNER_RAIZ = 0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d;
```

### 5.3 Estructura de un servicio y alta de servicios (`addService`)

El contrato guarda un catálogo de servicios. Cada servicio es:

```solidity
struct Servicio {
    bytes32 id;          // keccak256(nombre), p.ej. keccak256("Liquidity Pools")
    string  nombre;      // nombre legible
    uint256 precioMes;   // USD con 2 decimales (1200 = $12.00)
    uint256 precioAnio;  // USD con 2 decimales (0 = sin plan anual)
    address dueno;       // dirección BNB del tercero que lo vende; address(0) = servicio propio
    uint16  duenoBps;    // parte del dueño en bps (5000 si hay dueño; 0 si es propio)
    bool    activo;      // se puede pausar un servicio sin borrarlo
}
mapping(bytes32 => Servicio) public servicios;
bytes32[] public listaServicios;
```

Función de alta, pensada para usarse **desde Remix** (Add Contract con la dirección del proxy) o desde el **panel admin** de la web:

```solidity
function addServicio(
    string calldata nombre,
    uint256 precioMesUSD2,   // $12.00 -> 1200
    uint256 precioAnioUSD2,  // 0 si no hay anual
    address dueno,           // address(0) si es propio
    uint16  duenoBps          // 0 si es propio; 5000 si hay dueño
) external soloAdmin returns (bytes32 id);
```

Reglas que el contrato valida al dar de alta (para que el owner no se equivoque):

- Si `dueno == address(0)` entonces `duenoBps` debe ser 0 (servicio propio, owners se llevan el 80%).
- Si `dueno != address(0)` entonces `duenoBps` debe ser 5000 (el tercero se lleva el 50%, owners el 30%).
- `refBps` (1000) y `stakingBps` (1000) son fijos del contrato, no se pasan por servicio.
- `id = keccak256(bytes(nombre))`; si ya existe, se actualiza en vez de duplicar.

Funciones de mantenimiento del catálogo:

```solidity
function setPrecioServicio(bytes32 id, uint256 precioMesUSD2, uint256 precioAnioUSD2) external soloAdmin;
function setDuenoServicio(bytes32 id, address dueno, uint16 duenoBps) external soloAdmin;
function setActivoServicio(bytes32 id, bool activo) external soloAdmin;
function servicioInfo(bytes32 id) external view returns (Servicio memory);
function totalServicios() external view returns (uint256);
```

> Flujo real del owner, tal como lo describió: entra a Remix, pega el código, compila para verificar, va a Deploy, usa **At Address** con el proxy, aparecen todas las funciones, abre `addServicio`, rellena nombre, precio, dueño (vacío si es propio) y confirma. El servicio queda disponible; cuando un usuario toca Open, el contrato cobra su precio y reparte según la sección 4.

### 5.4 Cobro y acceso por tiempo

El cobro sigue el patrón de `AnalisisPro` pero por servicio y con referido:

```solidity
// plan 0 = mensual, 1 = anual. token = address(0) para BNB, o USDT.
function comprarServicio(bytes32 id, uint8 plan, address referidor, address token) external payable;

// acceso que se apaga solo, sin robot:
mapping(address => mapping(bytes32 => uint40)) public accesoHasta;
function tieneAcceso(address wallet, bytes32 id) public view returns (bool);
```

`comprarServicio`:

1. Comprueba que el servicio está activo y lee su precio.
2. Convierte USD a BNB con el oráculo y exige el pago exacto.
3. Fija (si hace falta) el referidor del que paga (sticky, ver 5.6).
4. Reparte el pago (ver 5.5).
5. Extiende `accesoHasta[wallet][id]` 30 días (mensual) o 365 días (anual).
6. Reporta a Contabilidad en try/catch.

Los servicios gratis (Multichart, Trading Demo) no pasan por aquí: el front los abre directo.

### 5.5 Reparto en cadena

Molde exacto del `_repartir` del Terminal, extendido con el destino "dueño". Paga en BNB con envío que nunca revierte (si una dirección rechaza, el monto queda retirable):

```solidity
uint16 public refBps      = 1000;   // 10%
uint16 public stakingBps  = 1000;   // 10%
uint16 public ownerReparto = 5000;  // owner1 vs owner2 (50/50)

function _repartir(bytes32 id, address pagador, uint256 total) internal {
    Servicio storage s = servicios[id];

    uint256 aRef  = total * refBps / 10000;      // 10%
    uint256 aStk  = total * stakingBps / 10000;  // 10%

    address ref = referidoDe[pagador];
    if (ref == address(0)) { aStk += aRef; aRef = 0; }   // sin referido -> al staking

    uint256 aDueno = 0;
    if (s.dueno != address(0)) aDueno = total * s.duenoBps / 10000;  // 50%

    uint256 pool = total - aRef - aStk - aDueno;   // owners: 80% propio, 30% con dueño
    uint256 a1 = pool * ownerReparto / 10000;
    uint256 a2 = pool - a1;

    // staking en BNB nativo; si no acepta, su parte cae a owners (nunca se bloquea el cobro)
    if (aStk > 0) {
        (bool ok,) = staking.call{value: aStk}(
            abi.encodeWithSignature("depositarRecompensaBNB(uint16)", uint16(10000)));
        if (!ok) { a1 += aStk / 2; a2 += aStk - aStk / 2; aStk = 0; }
    }
    if (aRef   > 0) { _enviarSeguro(ref, aRef); ganadoRef[ref] += aRef; }
    if (aDueno > 0) { _enviarSeguro(s.dueno, aDueno); }
    _enviarSeguro(owner1, a1);
    _enviarSeguro(owner2, a2);

    emit PagoRepartido(id, pagador, total, ref, aRef, aStk, aDueno, a1, a2);
}
```

`_enviarSeguro` y `retirar` (pull sobre push) se copian tal cual de `OrdenesTerminal.sol`, para que un destino que rechace BNB nunca bloquee el pago.

### 5.6 Referidos en cadena

Copia literal del Terminal (`OrdenesTerminal.sol`), que es el estándar de la plataforma:

```solidity
mapping(address => address) public referidoDe;   // wallet => quién la trajo (se fija una vez)
mapping(address => uint256) public ganadoRef;    // referidor => BNB ganado (estadística)
mapping(address => uint256) public refContar;    // referidor => nº de wallets que trajo

function registrarReferido(address referidor) external { _fijarRef(msg.sender, referidor); }

function _fijarRef(address wallet, address referidor) internal {
    if (referidoDe[wallet] != address(0)) return;              // ya tiene: no se cambia
    if (referidor == address(0) || referidor == wallet) return; // no auto referido
    referidoDe[wallet] = referidor;
    unchecked { refContar[referidor] += 1; }
    emit ReferidoFijado(wallet, referidor);
}
```

El referidor se pasa como parámetro en `comprarServicio(...)`, igual que el Terminal lo pasa en `subscribe` y en `comprar`. Como `referidoDe` es sticky, el referidor cobra su 10% en **cada** mensualidad futura del referido. Eso es la perpetuidad pedida.

### 5.7 Conexión con Contabilidad y Staking

Ambos contratos ya están desplegados y el nuevo contrato se engancha a ellos con interfaces mínimas (las mismas que usan AnalisisPro, WalletShield y el Terminal).

**Contabilidad** (`0x7FdE85E0bD53208F380980cfE317A9D4982434Ab`). Es el contable central: no custodia dinero, solo registra en USD y emite eventos. Se le reporta cada cobro:

```solidity
interface IContabilidad {
    function reportar(address wallet, bytes32 servicio,
                      uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external;
}
// uso (siempre en try/catch para que nunca bloquee el cobro):
try IContabilidad(contabilidad).reportar(pagador, id, usd, aStkUSD, usd - aStkUSD) {} catch {}
```

**Staking** (`0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4`). Recibe su parte en BNB nativo:

```solidity
// depositarRecompensaBNB(uint16 bpsAStakers) payable, con 10000 = todo a stakers
staking.call{value: aStk}(abi.encodeWithSignature("depositarRecompensaBNB(uint16)", uint16(10000)));
```

**Importante (post despliegue):** los dos contratos tienen lista blanca de quién puede escribir. Tras desplegar el proxy de AnálisisPagos hay que ejecutar, desde una wallet admin:

- `Contabilidad.setReportador(proxyAnalisis, true)`
- `Staking.autorizarContrato(proxyAnalisis, true)`

Si se olvida, el cobro no se rompe (ambas llamadas van protegidas), pero el staking no recibiría su parte y la contabilidad no registraría hasta autorizarlo.

### 5.8 Cómo se administra (Remix y panel admin)

- **Remix:** compilar, Deploy, **At Address** con el proxy, y aparecen todas las funciones. El owner usa `addServicio`, `setPrecioServicio`, `setDuenoServicio`, `agregarOwner`, etc. Todas inmediatas.
- **Panel admin de la web** (`assets/js/admin.js`): ya funciona leyendo `owner()` de cada contrato y habilitando acciones solo si la wallet conectada es owner. Se le añade una sección para AnálisisPagos que llame a esas mismas funciones. El patrón ya está montado para los otros contratos.

### 5.9 Interfaz pública resumida (Solidity)

```solidity
// --- catálogo ---
function addServicio(string nombre, uint256 precioMesUSD2, uint256 precioAnioUSD2, address dueno, uint16 duenoBps) external returns (bytes32 id);
function setPrecioServicio(bytes32 id, uint256 mesUSD2, uint256 anioUSD2) external;
function setDuenoServicio(bytes32 id, address dueno, uint16 duenoBps) external;
function setActivoServicio(bytes32 id, bool activo) external;
function servicioInfo(bytes32 id) external view returns (Servicio memory);
function precioToken(bytes32 id, uint8 plan, address token) external view returns (uint256);
function totalServicios() external view returns (uint256);

// --- cobro y acceso ---
function comprarServicio(bytes32 id, uint8 plan, address referidor, address token) external payable;
function tieneAcceso(address wallet, bytes32 id) external view returns (bool);
function accesoHasta(address wallet, bytes32 id) external view returns (uint40);

// --- referidos ---
function registrarReferido(address referidor) external;
function referidoDe(address wallet) external view returns (address);
function ganadoRef(address wallet) external view returns (uint256);
function refContar(address wallet) external view returns (uint256);

// --- multiowner / config ---
function agregarOwner(address nuevo) external;
function quitarOwner(address quien) external;
function owners() external view returns (address[] memory);
function transferirOwner(address nuevo) external;
function aceptarOwner() external;
function setOwnersPago(address o1, address o2) external;
function setReparto(uint16 refBps, uint16 stakingBps, uint16 ownerReparto) external; // valida suma
function setContratos(address tarifas, address oraculo, address contabilidad, address staking, address usdt) external;
function setPausa(bool v) external;
function retirar() external;             // retirar saldo atascado (pull)
function proponerUpgrade(address impl) external;   // solo si se usa la variante con plazo
```

### 5.10 Despliegue y post despliegue

1. Compilar en Remix con Solidity 0.8.24, optimizer 200 runs, OpenZeppelin upgradeable 5.0.2.
2. Desplegar implementación y proxy ERC1967 (UUPS), llamando a `initialize(...)` con: principal/owner raíz, Tarifas, Oráculo, Contabilidad, Staking, owner1, owner2, USDT.
3. `Contabilidad.setReportador(proxy, true)`.
4. `Staking.autorizarContrato(proxy, true)`.
5. Dar de alta los cinco servicios de pago con `addServicio` (Multichart y Trading Demo no se dan de alta: son gratis en el front).
6. Apuntar el front al nuevo proxy (ver sección 7).

---

## 6. Trading on-chain desde las gráficas "spot" (fase futura)

El usuario pidió que, con este contrato listo, se puedan abrir operaciones spot y poner órdenes límite desde las gráficas que dicen "spot" en la esquina superior izquierda, y cerrarlas por take profit o a mano, incluso antes de tener la integración con Cloudflare. Esto **ya existe en el proyecto** y conviene reutilizarlo en lugar de reimplementarlo dentro de AnálisisPagos.

### 6.1 Qué hay ya construido

- **Spot a mercado** — `contracts/terminal/TerminalSwap.sol` (y el Terminal desplegado `0x458aA14D2B1144b34f0FD22e2F9d7031B5f288B7`): `comprar` y `vender` hacen el swap real BNB↔token por PancakeSwap V2, con comisión del 1% repartida igual que todo lo demás (staking + referido + owners). Los tokens salen del router directo a la wallet del usuario (no custodia).
- **Órdenes límite spot** — `contracts/terminal/OrdenesTerminal.sol`: tres tipos, `Compra`, `TomarGanancia` (take profit) y `Stop` (stop loss). El usuario **adelanta solo lo de esa orden** (el BNB en una compra, o los tokens en una venta con `approve` previo). No firma una autorización abierta para swaps futuros: deja depositado exactamente lo de esa orden, y puede cancelarla y recuperar sus fondos cuando quiera.
- **Órdenes límite y posiciones apalancadas (futuros)** — `contracts/Futuros/OrdenesLimite.sol` + `FuturosV2.sol`: abrir a mercado, take profit, stop loss, liquidación.

### 6.2 Quién dispara la orden (y por qué funciona sin Cloudflare)

Un contrato no puede ejecutarse solo. El modelo del proyecto es:

- La función `ejecutar(id)` es **pública** y cualquiera puede llamarla; a cambio recibe una **propina**. El contrato valida el precio real contra PancakeSwap en ese momento y exige el mínimo que puso el usuario, así que quien ejecuta solo puede **hacer cumplir** la orden al precio correcto, nunca forzar un mal llenado.
- La plataforma corre **su propio ejecutor (un keeper en un VPS)** que vigila los precios y llama `ejecutar` cuando toca. Esto no depende de Cloudflare: es un proceso propio. Cloudflare, cuando llegue, sería para servicios añadidos, no para que el trading on-chain básico funcione.
- Por eso, con el contrato desplegado y el keeper corriendo, un usuario **ya puede** abrir una operación a mercado y cerrarla por take profit, por stop loss o a mano, firmando cada acción desde su wallet.

### 6.3 Recomendación

AnálisisPagos debe centrarse en **cobro de servicios + referidos**. Para el trading desde las gráficas de Análisis, lo sensato es **reutilizar el Terminal ya desplegado** (swap + órdenes límite + referidos), no duplicar esa lógica dentro de AnálisisPagos. Así:

- Un solo lugar mantiene el registro de referidos (el del Terminal), y el enlace `?ref=` sirve igual para Análisis y para el resto.
- El contrato de Análisis queda simple, auditable y fácil de actualizar.

Si más adelante se quiere que Análisis tenga su propio motor de órdenes, se clona `OrdenesTerminal.sol` como satélite, igual que `OrdenesLimite.sol` es satélite de `FuturosV2.sol`. Queda como decisión abierta.

---

## 7. Cambios de front necesarios

Fase 1 (sin esperar al contrato):

1. **Multichart gratis:** añadir `free: true` a su objeto en `HERRAMIENTAS` (`analisis.js`). Muestra el sello Free y abre directo.
2. **Precio por servicio:** dar a cada tarjeta su `precioMes` (y `precioAnio`) en USD, sustituyendo el precio único `MES_BASE`. Los gratis sin precio ni botones de pago.
3. **Botón Referrals:** insertar `#an-refbtn` entre `.an-search` y `#an-cartbtn` en la barra. La búsqueda se encoge sola; el carrito no se mueve.
4. **Popup de referidos:** reutilizar la lógica de `modules/terminal/referidos.js` (`capturarRef`, `referidorGuardado`, armado del enlace y lectura de estadísticas), con el enlace apuntando a la sección Análisis.

Fase 2 (cuando el contrato esté desplegado):

5. Conectar los botones de pago del popup de servicio y del carrito a `comprarServicio(id, plan, referidor, token)`, leyendo el precio y el acceso del contrato por `serviceId`. El binding se hace como en `modules/analysis/analisis-pro.js`, apuntando al nuevo proxy.

---

## 8. Hoja de ruta por fases

**Fase 1 — Front de producto (ya se puede hacer):**
- [ ] Multichart con etiqueta Free.
- [ ] Precio por servicio en las tarjetas (12, 15, 5, 2.50, 2.50).
- [ ] Botón Referrals a la izquierda del carrito, encogiendo la búsqueda.
- [ ] Popup de referidos con enlace copiable (reutilizando `referidos.js`).

**Fase 2 — Smart contract AnálisisPagos:**
- [ ] Clonar estructura de `AnalisisPro.sol` + motor de reparto de `OrdenesTerminal.sol`.
- [ ] Catálogo de servicios con precio y dueño por servicio (`addServicio`).
- [ ] Reparto 10/10/80 propio y 10/10/30/50 con dueño, con fallback al staking.
- [ ] Referidos sticky y perpetuos.
- [ ] Multiowner, owner raíz por constante, decidir variante de upgrade (inmediato o 48 horas).
- [ ] Conectar Contabilidad y Staking.
- [ ] Desplegar, autorizar (`setReportador`, `autorizarContrato`), dar de alta los cinco servicios.

**Fase 3 — Conectar el pago:**
- [ ] Front de Análisis llamando a `comprarServicio` y leyendo precio/acceso del contrato.
- [ ] Panel admin con la sección de AnálisisPagos.

**Fase 4 — Trading on-chain desde Análisis (futuro):**
- [ ] Reutilizar el Terminal (swap + órdenes límite) en las gráficas "spot".
- [ ] Keeper propio para ejecutar órdenes.
- [ ] (Opcional) satélite de órdenes propio de Análisis.

---

## 9. Datos clave

**Dominio:** oficial `decfreedom.com` · temporal y no válido (no usar) `criptocubaoficial.com`.

**Owner raíz / deployer / tesorería (hoy owner1 y owner2 a la vez):**
`0x97e01a1C430E0cC826AcA6e9BE643721e45BCA7d`

**Contratos del ecosistema (proxy):**

| Contrato | Dirección |
|---|---|
| Tarifas (hub de admin) | `0x068729CBB708713266FFdE2374e51db2B063FD7C` |
| Contabilidad | `0x7FdE85E0bD53208F380980cfE317A9D4982434Ab` |
| Staking | `0xdC4802d8871cEf57A34e4e0E3b1a87226a4A84C4` |
| OraculoPrecios | `0xf51bf11D8C8905bc044B7Fb3B002Bf3F84c977f3` |
| Terminal (swap + suscripciones + referidos) | `0x458aA14D2B1144b34f0FD22e2F9d7031B5f288B7` |
| Futuros | `0x315C8Afc274f2BE822ffA1725b590D7fB7E2Af85` |
| AnalisisPro (acceso viejo, a reemplazar) | `0x8e04ACEc37aE1D8fA6239d4407a73316bFC97469` |

**Constantes BSC:** USDT `0x55d398326f99059fF775485246999027B3197955` · PancakeSwap V2 Router `0x10ED43C718714eb63d5aA57B78B54704E256024E`.

**Compilador:** Solidity 0.8.24, optimizer activado (200 runs), sin viaIR, OpenZeppelin upgradeable 5.0.2, proxy UUPS ERC1967.

---

## 10. Anexo — interfaces a consumir

```solidity
interface IOraculo {
    function precioUSD(address token) external view returns (uint256); // precioUSD(address(0)) = USD por 1 BNB, 18 dec
}

interface IContabilidad {
    function reportar(address wallet, bytes32 servicio,
                      uint256 generadoUSD, uint256 aStakingUSD, uint256 aOwnersUSD) external;
}

interface IStaking {
    function depositarRecompensaBNB(uint16 bpsAStakers) external payable; // 10000 = todo a stakers
}

interface ITarifas {
    function esAdmin(address cuenta) external view returns (bool); // admin central, para soloAdmin
}
```

**Referencias de código (todas en el repositorio):**
- `contracts/Futuros/AnalisisPro.sol` — base estructural (acceso, cobro, multiowner, reporte).
- `contracts/terminal/OrdenesTerminal.sol` — motor de reparto y referidos a copiar.
- `contracts/terminal/TerminalSwap.sol` — swap spot a mercado.
- `contracts/Futuros/OrdenesLimite.sol`, `contracts/Futuros/FuturosV2.sol` — órdenes límite y posiciones.
- `contracts/core/Contabilidad.sol`, `contracts/staking/repo_Staking.sol`, `contracts/core/Tarifas.sol` — infraestructura a la que conectar.
- `modules/analysis/analisis.js` — catálogo, carrito, barra y precios del front.
- `modules/analysis/analisis-pro.js` — ejemplo de binding front a contrato.
- `modules/terminal/referidos.js` — enlace `?ref=` y estadísticas de referidos a reutilizar.
