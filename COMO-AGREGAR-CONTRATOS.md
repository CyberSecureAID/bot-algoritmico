# Cómo agregar un contrato a la página de transparencia

La página `transparencia.html` (la tabla verificable Y el esquema neuronal) lee TODO de un
solo archivo: `assets/js/contratos-data.js`. Para agregar un contrato nuevo NO se reconstruye
nada: se añade una entrada, y la tabla y el círculo se actualizan solos. El círculo crece
automáticamente con cada contrato nuevo.

## Pasos

1. **Verifica primero en BscScan.** El proxy Y su implementación deben tener el check verde
   "Contract Source Code Verified". Solo se agregan contratos ya verificados.

2. **Sube el logo.** Circular, fondo transparente, `.webp`, 128x128 px, a la carpeta
   `assets/portada/img/red/`. El nombre del archivo = el `id` del contrato (minúsculas, sin
   espacios). Ej: `assets/portada/img/red/miservicio.webp`.

3. **Añade la entrada** en `assets/js/contratos-data.js`, dentro de `window.CONTRATOS`:

```js
{ id:'miservicio', nombre:'MiServicio', cat:'trade', logo:'miservicio',
  servicio:'Una frase corta de qué hace.',
  proxy:'0x...direccion del proxy...',
  impl:'0x...direccion de la implementacion...',
  conecta:['tarifas','contabilidad'] },
```

## Qué significa cada campo

- **id**: identificador único, minúsculas, sin espacios. Es también el nombre del logo.
- **nombre**: el nombre que se muestra.
- **cat**: la categoría, que define el COLOR. Valores válidos: `core`, `oracle`, `trade`,
  `p2p`, `shield`, `fut`, `stake`. Si es una categoría nueva, avísame y le asigno un color.
- **logo**: el nombre del archivo del logo sin `.webp` (normalmente igual que el id).
- **servicio**: frase corta de qué hace (sale en la tabla).
- **proxy**: la dirección del proxy.
- **impl**: la dirección de la implementación. Si NO es proxy (dirección directa), déjalo
  vacío: `impl:''`.
- **conecta**: array con los `id` de los contratos a los que este se conecta o de los que
  depende. Esas son las líneas que salen de su nodo en el esquema. Casi todos llevan
  `'tarifas'` (el núcleo que todos consultan).

## Ejemplo real (Futuros, ya en el archivo)

```js
{ id:'futuros', nombre:'Futuros', cat:'fut', logo:'futuros',
  servicio:'Motor de posiciones apalancadas (perpetuos).',
  proxy:'0x315C8Afc274f2BE822ffA1725b590D7fB7E2Af85',
  impl:'0x7cCaE3e57a2F8D546735B79DBa79B234d200F664',
  conecta:['tarifas','contabilidad','oracleguard','staking'] },
```

## Para que sea permanente

Después de editar el archivo de datos y subir el logo, haz commit de ambos al repositorio,
como cualquier cambio de código. Así queda permanente y sobrevive al Ctrl+F5. No se usa
almacenamiento del navegador para esto.

## Atajo

En el futuro solo tienes que decirme: "contrato nuevo, logo ya subido como `<id>.webp`,
nombre X, categoría Y, proxy 0x..., implementación 0x..., conecta a A, B, C". Yo añado la
entrada siguiendo este archivo y te entrego el data actualizado.
