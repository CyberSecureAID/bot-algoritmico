# DecFreedom · Análisis — Wallets colaboradoras (acceso gratuito)

> Complemento del documento `ANALISIS-roadmap-y-smart-contract.md`.
> Dominio oficial: **decfreedom.com**. No usar criptocubaoficial.com.
> Este rol vive **dentro del mismo contrato** AnálisisPagos; no es un contrato aparte.

---

## 1. Qué es, en una frase

Un rol llamado **colaborador**: wallets que pueden usar **todos los servicios de la sección Análisis sin pagar la suscripción**, sin ser owners y sin poder administrar nada.

## 2. Para qué sirve

Son las personas que trabajan revisando la plataforma: entran a Análisis de forma constante, prueban las herramientas, buscan fallos y reportan problemas. Como es un trabajo continuo, **no se les cobra mensualidad** por los servicios mientras lo hacen. El owner es una sola persona y necesita un equipo revisando; este rol es la forma de darles acceso sin regalar el control del contrato ni tener que estar gestionándolos uno por uno.

## 3. Las 4 wallets por defecto

Van **escritas en el propio código del contrato** y quedan activas **desde el primer bloque**, en el mismo momento del despliegue, sin que nadie tenga que darlas de alta a mano:

```
0xd5612c29d030dc4E03D0C958a4Fff08102dA9445
0x5eE98F3Efc048A653b2B5b0562A9126C0f340F8a
0x223Df56FaACE1334F0CbC26c49005931542BDFb9 y 0xa232B017b19D0248cdaE37C2Ca6EDE4fd9EAdC6f
```

## 4. Qué puede y qué no puede un colaborador

| Capacidad | Usuario normal | **Colaborador** | Owner |
|---|---|---|---|
| Usar servicios gratis de Análisis (Multichart, Trading Demo) | Sí | Sí | Sí |
| Usar los servicios de pago de Análisis **sin pagar** | No (paga) | **Sí, gratis** | Sí |
| Dar de alta servicios, cambiar precios, mover owners | No | **No** | Sí |
| Agregar o quitar colaboradores | No | **No** | Sí |
| Pagar comisión al **operar en spot** (cuando el trading esté activo) | Sí | **Sí, igual que todos** | Sí |

En resumen: el colaborador **no es owner**. Solo se le perdona el pago de las suscripciones de los indicadores y herramientas de Análisis. Todo lo demás lo hace como un usuario cualquiera.

## 5. Qué SÍ paga un colaborador

El rol cubre **únicamente** las suscripciones de los servicios de Análisis (los indicadores y herramientas). **No** cubre las comisiones de **abrir operaciones de trading**. Cuando el motor de trading spot esté activo, un colaborador que abra una operación paga su comisión como cualquier otro usuario; eso no es una suscripción, es el coste de operar. Así el acceso gratuito es solo para revisar y usar las herramientas, no para operar gratis.

## 6. Cómo se maneja en el contrato

Se añaden a AnálisisPagos tres piezas: las tres wallets fijas, un registro para las que se agreguen después, y una función para gestionarlas. Solo el owner puede agregar o quitar.

```solidity
// --- Colaboradores: acceso gratis a los servicios de Análisis, sin ser owners ---

// 1) Las tres por defecto, quemadas en el código (activas desde el despliegue,
//    no dependen de que nadie las registre a mano).
address public constant COLAB_1 = 0xd5612c29d030dc4E03D0C958a4Fff08102dA9445;
address public constant COLAB_2 = 0x5eE98F3Efc048A653b2B5b0562A9126C0f340F8a;
address public constant COLAB_3 = 0x223Df56FaACE1334F0CbC26c49005931542BDFb9; y address public constant COLAB_4 = 0xa232B017b19D0248cdaE37C2Ca6EDE4fd9EAdC6f

// 2) Las que el owner agregue más adelante.
mapping(address => bool) public colaboradorExtra;

event ColaboradorCambiado(address indexed wallet, bool permitido);

// 3) ¿Es colaborador? (las tres fijas o cualquiera agregada después)
function esColaborador(address w) public view returns (bool) {
    return w == COLAB_1 || w == COLAB_2 || w == COLAB_3 || w == COLAB_4 || colaboradorExtra[w];
}

// 4) Agregar o quitar colaboradores. Solo owner/admin. Las tres fijas no se pueden quitar.
function setColaborador(address w, bool permitido) external soloAdmin {
    require(w != address(0), "wallet vacia");
    require(w != COLAB_1 && w != COLAB_2 && w != COLAB_3, && w != COLAB_4, "fija: no se puede quitar");
    colaboradorExtra[w] = permitido;
    emit ColaboradorCambiado(w, permitido);
}
```

Y se engancha al control de acceso, de modo que un colaborador siempre tiene acceso a cualquier servicio sin pasar por el cobro:

```solidity
function tieneAcceso(address wallet, bytes32 id) public view returns (bool) {
    if (esOwner[wallet] || esColaborador[wallet]) return true;   // gratis total en Análisis
    return accesoHasta[wallet][id] > block.timestamp;            // el resto, por suscripción
}
```

Como `tieneAcceso` devuelve `true` para un colaborador, el front abre la herramienta directamente y **nunca le presenta el cobro**. No hace falta que el colaborador llame a `comprarServicio` ni que pague nada.

> Por qué van como **constantes** y no solo en el `initialize`: al estar quemadas en el código, esas tres wallets tienen el permiso desde el bloque cero, de forma inmutable, aunque el despliegue o una actualización fallaran a medias. El `mapping` queda para todas las que agregues después con `setColaborador`. Es el mismo criterio de seguridad que usamos con la wallet owner raíz.

## 7. Cómo se refleja en el front

En el catálogo de Análisis, cuando la wallet conectada es colaboradora (se lee `esColaborador(wallet)` del contrato, o directamente `tieneAcceso`), las tarjetas de pago muestran una etiqueta tipo **"Incluido"** en lugar del precio y abren la herramienta directo, igual que hoy hacen Multichart y Trading Demo. El botón de referidos y el resto de la sección funcionan sin cambios.

## 8. Resumen

- **Rol colaborador** = acceso gratis a todos los servicios de Análisis, sin ser owner.
- **Tres wallets fijas** en el código, activas desde el despliegue, sin alta manual.
- **`setColaborador(wallet, true/false)`** (solo owner) para agregar o quitar más.
- **No administra nada**; **sí paga** las comisiones de operar en spot, como todos.
- Se integra en el contrato **AnálisisPagos**; es una capa de permisos, no un contrato nuevo.

**Funciones y datos que se añaden:**
`COLAB_1/2/3/4` (constantes) · `colaboradorExtra` (mapping) · `esColaborador(address) view` · `setColaborador(address,bool) soloAdmin` · evento `ColaboradorCambiado` · enganche en `tieneAcceso`.
