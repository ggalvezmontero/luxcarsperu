# Arquitectura — LUX CARS IMPORT S.A.C.

Next.js 16.3.5 (App Router) · React 19 · TypeScript strict · Tailwind v4 ·
Supabase · despliegue **solo en Vercel**, sin backend aparte.

Este documento explica **cómo está armado el sistema y por qué**. Para poner el
sitio en producción, ver [`PUESTA_EN_MARCHA.md`](./PUESTA_EN_MARCHA.md).

---

## 0. La restricción legal. Léela antes de tocar el inventario.

> ### ⛔ PROHIBIDO GUARDAR INVENTARIO DE TERCEROS
>
> **No se puede persistir —en ningún formato y en ningún sitio— inventario de
> vehículos proveniente de:**
>
> **MarketCheck · Auto.dev · eBay / eBay Motors · Autotrader · CarGurus ·
> Cars.com · TrueCar · AutoTempest · Facebook Marketplace**

Sus términos de servicio lo prohíben **textualmente**: *"cache, store, index or
otherwise persist"*, prohibición expresa de crear **derivative databases**, y
obligación de **borrar a las 6 horas**. Un solo `INSERT` con esos datos es
**incumplimiento de contrato**, con revocación inmediata de la llave de API y
exposición legal para la empresa.

**Esto no es una preferencia de arquitectura ni una optimización pendiente.**

### Lo que cuenta como "persistir" — todas estas formas están prohibidas

| Forma | ¿Prohibido? |
|---|---|
| `INSERT` en Supabase | Sí |
| Un `.json` commiteado al repo | Sí |
| Caché de Vercel / ISR / `revalidate` | Sí |
| Un índice de búsqueda | Sí |
| `localStorage` del navegador | Sí |
| `images.remotePatterns` de `next/image` | **Sí** — el optimizador descarga la imagen ajena y la guarda 30 días en el caché de Vercel. Es literalmente "cache, store". |
| Un caché "temporal, solo 6 horas" | Sí. El plazo no vuelve legal el `INSERT`: solo acorta la ventana de incumplimiento. |

**Buscar en esos portales es legal. Guardar lo que devuelven, no.** Un asesor
puede abrir Autotrader y mirar. El sistema no puede escribir lo que ahí vio.

### La vía legal, que es la implementada

1. **Carga manual curada** desde el portal (`/portal/vehiculos/nuevo`), con
   autocompletado por VIN contra **NHTSA vPIC** — API del gobierno de EE.UU.,
   gratuita, sin autenticación y sin restricción contractual. Su respuesta **sí**
   se puede guardar (tabla `vehicle_models`). Costo real: ~4 minutos por auto.
2. **Feeds XML de dealers partner**, únicamente con cláusula de licencia
   **firmada**, y solo entonces con `fuente = 'feed_partner_licenciado'`.

### Cómo se hace cumplir, en vez de solo pedirlo

Un comentario se ignora. Por eso la regla está escrita en el motor:

- **`vehicles.fuente` es una LISTA BLANCA** (enum `fuente_inventario`):
  `carga_manual`, `importacion_directa`, `consignacion`,
  `feed_partner_licenciado`. **No existe un valor para "scrapeado de un
  marketplace".** Meter uno obliga a escribir una migración y justificarla.
  Es lista blanca y no lista negra a propósito: una lista negra se esquiva
  inventando un nombre nuevo.
- **`next.config.ts` tiene `images.remotePatterns: []`**, vacío a propósito y
  con el motivo escrito encima.
- **`src/data/trendingVehicles.ts` revienta el build** si alguien pone una
  `imageSrc` que no empiece en `/` (es decir, una URL externa).

### Si alguien propone "cachear el inventario un ratito para que cargue rápido"

La respuesta es **no**, y el motivo es **contractual, no técnico**. No hay
versión de esa idea que sea aceptable: ni con TTL corto, ni "solo los campos
públicos", ni "solo para desarrollo".

Mismo criterio para las **fotos**: solo fotos propias de la unidad real o de
prensa del fabricante con derecho de uso. Una foto de stock rotulada como "el
auto en venta" es la misma mentira que un precio inventado, y ya pasó una vez
(el catálogo anterior tenía precios hasta 48% inflados y fotos de Unsplash que
no eran el auto).

Esta sección se repite, a propósito, en `src/lib/db/types.ts`,
`next.config.ts`, `supabase/README.md`, `src/lib/portal/photoGuide.ts` y en la
pantalla del portal. Quien vaya a "optimizar" esto dentro de seis meses tiene
que tropezársela.

---

## 1. Mapa del sistema

```
Visitante (sin cuenta)      Cliente (rol `cliente`)        Equipo (rol `admin`)
        │                           │                              │
        ▼                           ▼                              ▼
  Sitio público               /cuenta  (noindex)             /portal  (noindex)
  /  /comprar  /vender        registro y login               login con Supabase Auth
  /importar  /faq …           con Supabase Auth                     │
        │                           │                              │
        │ formularios               │ escribe SUS solicitudes      │ lee y escribe TODO
        ▼                           │ desde el navegador           │ desde el navegador
  WhatsApp ◄── fallback             ▼                              ▼
        │                     Supabase (RLS = candado; `es_admin()` decide)
        └──► createLead()           solicitudes_compra   leads · vehicles
             [service_role]         solicitudes_venta    vehicle_photos · consignments
                                    profiles (rol)       tax_rates · quotes
  src/core/pricing/  ← motor de cálculo (TypeScript, verificado, NO se toca)
```

**Cuatro líneas de negocio**: compra-venta con stock propio · importación a
pedido desde Miami · tasación y consignación **sin contrato de exclusividad** ·
gestión documentaria.

**Tres tipos de persona, dos con cuenta.** El visitante cotiza y sigue por
WhatsApp sin registrarse, como siempre. El **cliente** crea cuenta en `/cuenta`
para dos cosas: pedir un auto que no está en stock (`solicitudes_compra`, el
equipo lo busca) y ofrecer el suyo en consignación (`solicitudes_venta`, que
**no se publica hasta que un admin la aprueba**). El **equipo** entra al
portal solo si su perfil tiene rol `admin`. No hay marketplace: el cliente
nunca publica nada por su cuenta.

---

## 2. El motor de precios — `src/core/pricing/`

Es el activo más valioso del proyecto. Está verificado. **No se reescribe ni se
cambia su lógica.**

- Calcula la cascada tributaria peruana de importación (ad valorem, ISC, IGV,
  IPM, percepción) y la admisibilidad del vehículo.
- **No fue reimplementado en SQL a propósito.** Dos implementaciones de la misma
  norma terminan discrepando, y la verificada es esta.
- La tabla `tax_rates` de Supabase es el **registro normativo** (qué tasa, desde
  cuándo, con qué norma citada), no la calculadora. Guarda a propósito el
  IGV 16% + IPM 2% histórico junto al 15.5% + 2.5% de la Ley 32387, para poder
  reproducir una cotización antigua.

> **Deuda conocida:** las tasas viven hoy en dos sitios — `tax_rates` y
> `src/core/pricing/pricingConfig.ts`. Es deliberado (no se tocó el motor
> verificado) pero es riesgo real de deriva: alguien actualiza la tabla, no el
> TypeScript, y las cotizaciones siguen saliendo con la tasa vieja. La salida
> definitiva es que el motor lea de la tabla — y eso es un cambio al activo más
> valioso, así que lo decide el dueño, no un agente.

**Mientras tanto la regla es: manda la NORMA, y quien calcula es el motor.**

---

## 3. Capa de datos — `src/lib/db/`

Cuatro archivos. Sirven al **sitio público**.

| Archivo | Qué hace |
|---|---|
| `types.ts` | **Fuente de verdad de los tipos.** Espejo del esquema SQL. |
| `client.ts` | Construye los clientes de Supabase. Devuelve `null` si falta configuración. |
| `vehicles.ts` | Lecturas públicas del stock. |
| `leads.ts` | Alta de leads. **Único consumidor de `service_role` en todo el proyecto.** |

### Regla número uno: **nunca lanza**

La configuración se resuelve una vez a nivel de módulo. Si falta, los clientes
son `null`; los errores de PostgREST y las excepciones de red se capturan y
degradan a `[]` / `null` / fallback a WhatsApp.

**Motivo:** una excepción durante el render tumba la página entera en Vercel.
Una lista vacía solo apaga una sección. Verificado empíricamente sin variables
de entorno y contra un host inexistente: devuelve vacío y no lanza una sola vez.

El aviso de "no hay base de datos" se registra **una sola vez por proceso**
(`warnOnce`), para no llenar los logs.

> **Contrapartida honesta:** esa misma decisión hace que un error de
> configuración se vea **igual** que "todavía no hay stock" — una sección vacía.
> Por eso existe `getDatabaseStatus()`, que dice qué variable falta sin exponer
> ninguna llave, y el tablero del portal lo muestra.

### Regla número dos: **`select *` como `anon` FALLA, y es a propósito**

El esquema combina **RLS** (qué *filas* se ven) con **GRANT por columna** (qué
*columnas* se ven). Sin los grants por columna, "anon lee los publicados"
dejaría leer `precio_compra` y `notas_internas` — **el margen del negocio**.

Consecuencia práctica, y va a parecer un bug cuando pase:

```ts
supabase.from("vehicles").select("*")   // ❌ permission denied para anon
```

Hay que **pedir columnas explícitas** o consultar la vista
**`vehiculos_publicos`** (declarada `security_invoker = true`, así que respeta
RLS en vez de eludirlo como haría una vista `SECURITY DEFINER`). Desde la
migración 0009 la vista expone también `fuente`: la web publica los autos en
consignación junto al stock propio, pero siempre etiquetados como tales.

**Si alguien "arregla" este error abriendo los permisos, está publicando el
margen del negocio.**

### Regla número tres: **los formularios sin cuenta no escriben directo**

El visitante no tiene identidad, así que alguien tiene que hacer el `INSERT`.
**No se le dio `INSERT` a `anon`**: su llave viaja al navegador, y con eso
cualquiera inyecta leads en masa desde la consola o escribe `estado = 'ganado'`.

Las escrituras entran por el servidor con `service_role`, y el estado inicial lo
fija el servidor en `'nuevo'`. `createLead()` **no** cae al cliente anónimo si
falta la llave de servicio: sería un intento condenado al fracaso que solo suma
latencia antes del mismo fallback a WhatsApp.

**El cliente con cuenta sí escribe directo, y está bien.** Tiene identidad
(`auth.uid()`), así que `solicitudes_compra` y `solicitudes_venta` le dan
`INSERT` con una política `WITH CHECK` que fija `user_id = auth.uid()` y el
estado inicial (`nueva` / `pendiente`), y un trigger que le impide tocar los
campos de revisión. Es el mismo principio del portal: RLS es el candado. Lo que
no puede pasar es que un cliente lea leads, márgenes o el precio mínimo de una
consignación: todas esas políticas exigen `public.es_admin()` desde la
migración 0010.

### Nombres: columnas en español, dominio en inglés

El SQL usa `marca` / `anio` / `precio_venta`; la UI recibe `brand` / `model` /
`year` para encajar sin traducción con el motor de precios. **Toda** la
traducción vive en un mapeador por tabla, en un solo archivo.

### ⚠ Estado real: la capa pública está escrita pero **no está conectada**

Verificado con `grep` sobre toda `src/`: **nada importa `db/vehicles.ts` ni
`db/leads.ts`.** Están probados y listos, pero:

- `/comprar` renderiza desde datos estáticos declarados en
  `src/app/comprar/StockExplorer.tsx`, no desde la base.
- Ningún formulario llama a `createLead()`. **Hoy no se guarda ni un solo
  lead**: todo se va por WhatsApp.

No es un error, es trabajo pendiente — pero hay que saberlo antes de asumir que
poner las variables de entorno hace aparecer el stock.

---

## 4. Los tipos: una sola definición por enum

**Regla: todo tipo que sea espejo del esquema SQL vive en
`src/lib/db/types.ts`. El resto importa de ahí.**

Ahí están `VehicleStatus`, `VehicleSource`, `Currency`, `LeadOrigin`,
`LeadStatus`, `ConsignmentStatus`, `CommissionType`, las filas crudas
(`PublicVehicleRow`, `LeadRow`, `ConsignmentRow`, `VehiclePhotoRow`) y las
constantes de validación.

`VehicleCondition`, `VehicleOrigin` y `VehicleCategoryId` se **reexportan** desde
`src/core/pricing/`: la UI consume un solo módulo de tipos, pero la fuente de
verdad sigue siendo el motor, que no se toca.

Los tipos de consignaciones vivían en `src/app/portal/consignaciones/model.ts` y
se movieron aquí al integrar. `model.ts` los reexporta, así que sus pantallas
siguen importando de `./model` sin cambios.

`src/lib/portal/metrics.ts` **tipa** los valores de estado contra estos enums en
vez de escribirlos como strings sueltos dentro de cada `.eq()`. Motivo concreto:
si alguien renombra una etiqueta en una migración, un string suelto sigue
compilando y el indicador pasa a devolver **cero en silencio** — un tablero que
miente sin que nadie se entere.

> **Excepción conocida, pendiente del otro equipo:**
> `src/app/comprar/StockExplorer.tsx` declara sus propios `StockStatus` y
> `StockCondition`, y **no coinciden con el esquema**: le falta `en_transito`, y
> usa `"seminuevo" | "usado-selecto"` donde `public.condicion_vehiculo` solo
> admite `'nuevo' | 'usado'`. Hoy no rompe nada porque esa pantalla usa datos
> estáticos, pero **el día que se conecte a la base, no va a mapear.** Ese
> archivo pertenece a otro equipo y no se tocó.

---

## 5. El portal — `/portal`

| Ruta | Qué hace |
|---|---|
| `/portal` | Tablero: stock, reservadas, vendidas del mes, leads sin atender, consignaciones activas, en tránsito, disponibles sin publicar |
| `/portal/login` | Acceso con Supabase Auth (`signInWithPassword`) |
| `/portal/vehiculos` | Listado con filtros por estado y búsqueda |
| `/portal/vehiculos/nuevo` | Alta con el **VIN** como protagonista |
| `/portal/vehiculos/[id]/fotos` | Subida de fotos, compresión, orden y portada |
| `/portal/leads` | Embudo, cambio de etapa, WhatsApp por fila |
| `/portal/consignaciones` | Cartera, comisión, "Vendido por el dueño" |
| `/portal/solicitudes` | Autos ofrecidos por clientes (aprobar → crea consignación + ficha; rechazar con motivo) y pedidos de búsqueda con respuesta visible al cliente |
| `/portal/usuarios` | Cuentas y roles: hacer admin, quitar admin, desactivar |

Y del lado del cliente:

| Ruta | Qué hace |
|---|---|
| `/cuenta/login` | Registro e ingreso (Supabase Auth; nombre y WhatsApp van en `options.data` y el trigger los copia al perfil) |
| `/cuenta` | Sus solicitudes con estado, respuesta de LuxCars y motivo de rechazo |
| `/cuenta/comprar` | Pedir un auto que no está en stock ni en consignación |
| `/cuenta/vender` | Ofrecer su auto en consignación; queda pendiente hasta la aprobación |

### El modelo de seguridad, que es lo importante

**Las pantallas del portal leen y escriben DESDE EL NAVEGADOR con la sesión del
equipo, no desde el servidor con `service_role`.**

Es deliberadamente incómodo y es la decisión de fondo. `service_role` **salta
todas las políticas RLS**. Una pantalla de servidor que lea con esa llave hace
que Next renderice el HTML **con los datos dentro** y lo envíe antes de que corra
ningún guard de cliente: un `curl` sin ejecutar JavaScript se lleva nombres,
teléfonos y correos de clientes — **datos personales bajo Ley 29733**.

Leyendo desde el cliente con la llave anónima + sesión, **RLS es el candado
real**: sin sesión, Postgres devuelve cero filas.

> **El login es comodidad. El candado es la base de datos.**

Verificado con `grep` sobre toda `src/`: **ninguna pantalla del portal usa
`service_role`.** Los dos archivos que lo hacían (`portal/leads/data.ts` y
`portal/vehiculos/data.ts`) fueron borrados y sus pantallas reescritas.

### Lo que sigue abierto, y hay que cerrarlo

`curl https://…/portal/leads` devuelve **200 con la cáscara vacía**, sin sesión.
No filtra datos (RLS lo impide), pero la URL responde. Además, el build
prerenderiza `/portal`, `/portal/login`, `/portal/leads` y
`/portal/consignaciones` como **HTML estático**: no hay servidor donde poner un
guard sin agregar un `middleware.ts`.

Dos caminos, y el segundo es gratis:

- **A)** Instalar `@supabase/ssr` + un `middleware.ts` que valide la sesión antes
  de responder cualquier `/portal/*`. Es la vía oficial. **Agrega una
  dependencia: lo decide el dueño**, por eso no se hizo.
- **B)** Activar **Deployment Protection** en Vercel. Corta el acceso al HTML en
  el borde, antes de que Next responda. **Cuesta cero y es lo que hay que hacer
  hoy.** Ver `PUESTA_EN_MARCHA.md`.

**Lo que NO es una solución:** confiar en que la ruta "no está enlazada", ni el
`noindex`. `noindex` le pide a un buscador que no indexe; no impide que alguien
abra la URL.

### Roles: `cliente` y `admin` (migración 0010)

`public.profiles` tiene una fila por usuario de `auth.users`, creada por
trigger al registrarse, con `rol` (`cliente` por defecto) y `activo`. La
función `public.es_admin()` (SECURITY DEFINER, estable) dice si `auth.uid()`
es admin activo, y **todas** las políticas "el equipo …" de las tablas del
negocio la exigen. Consecuencias:

- **El registro público queda abierto a propósito.** Registrarse da una
  cuenta de cliente, no acceso al portal. Un cliente que abre `/portal` ve
  "Esta cuenta no es del equipo" y, aunque forzara el HTML, RLS le devuelve
  cero filas.
- **El primer admin** es quien ya tenía cuenta al aplicar la migración (hasta
  entonces solo el equipo la tenía). Los siguientes se promueven desde
  `/portal/usuarios`. Sin sesión (editor SQL de Supabase) los triggers de
  protección no aplican, así que el dueño siempre puede promover a alguien con
  `update public.profiles set rol = 'admin' where email = '…'`.
- **Un admin no puede quitarse su propio rol ni desactivarse** (trigger
  `profiles_proteger`): evita quedarse fuera por error.
- **Aprobar una solicitud de venta** es una función SQL
  (`aprobar_solicitud_venta`) que crea consignación, ficha con
  `fuente = 'consignacion'` y los enlaces en una sola transacción. Desde el
  navegador en tres pasos quedarían estados a medias si uno fallara.

Sigue sin haber diferencia entre un vendedor y el dueño dentro del equipo:
todo admin ve todo. Si hiciera falta un rol intermedio, se agrega al enum y a
`es_admin()`, no a la interfaz.

---

## 6. Detalles del portal que conviene conocer

- **VIN**: validación ISO 3779 (17 caracteres, sin I/O/Q) y dígito verificador
  (49 CFR 565) **solo como aviso, nunca como bloqueo** — hay VINs legítimos de
  otros mercados que no lo cumplen. El autocompletado **nunca pisa** lo que ya
  escribiste; los campos que llenó vPIC van marcados y dejan de estarlo en
  cuanto los editas.
- **`/api/vin/[vin]`** es un endpoint **abierto**. No expone datos del negocio ni
  llaves (vPIC es público), así que el riesgo es tráfico, no fuga. Si molesta, se
  cierra con `verificarAccesoPortal()` de `src/lib/portal/auth.ts`.
- **Mild-hybrid 48V se clasifica como `gasolina`, no como `hev`**: tributariamente
  es gasolina, y de la categoría depende el ISC.
- **Avisos normativos que informan pero NO bloquean**: antigüedad, diésel usado y
  topes de 32.000 km (M1) / 36.000 km (N1) **aplican al IMPORTAR, no al
  inventariar**. Un auto en consignación de un cliente peruano puede tener ocho
  años y 150.000 km legítimamente. Un `CHECK` ahí habría bloqueado la línea de
  consignación entera.
- **Fotos**: se comprimen en el navegador antes de subir (medido: 4,34 MB → 328 KB)
  y van **de a una, en fila** — con señal irregular, ocho subidas en paralelo
  fallan juntas. El **orden y la portada los decide la base** (trigger
  `tg_acomodar_foto`), no el cliente: una sola verdad.
- **El bucket `vehiculos` es de lectura pública.** Necesario para mostrar el
  stock, pero implica que cualquiera con la URL ve el archivo aunque el vehículo
  esté sin publicar. **No subas ahí tarjetas de propiedad, DNIs ni documentos**:
  eso necesita un bucket privado con URLs firmadas.
- **Consignación sin exclusividad, en serio**: `sin_exclusividad` tiene un `CHECK`
  que solo admite `TRUE`. Y `vendido_por_dueno` está modelado como **desenlace
  previsto, con comisión cero** — no como fuga a penalizar. No hay campo de
  "motivo de incumplimiento" en ningún lado, y no debe haberlo.
- **Las fechas del embudo las sella un trigger en Postgres**, no la aplicación.
  Si las escribiera la app, cada cambio de estado pisaría la fecha del primer
  contacto y el tiempo de respuesta del equipo se vería siempre perfecto.
- **Los listados traen 200 filas y no paginan.** Sobra para hoy; cuando el embudo
  pase de ahí, hay que paginar o el equipo dejará de ver los leads antiguos sin
  enterarse.

---

## 7. Sistema de diseño

Tokens en `src/app/globals.css`: `bg-bg` `bg-surface` `bg-surface-2`
`bg-surface-3`, `border-line` `border-line-strong`, `text-ink` `text-ink-2`
`text-ink-3` `text-ink-4`, `text-silver` `text-gold`, `rounded-lux`
`rounded-lux-lg` `rounded-lux-xl`.

**Prohibido escribir hex literales en componentes.** La plata es el acento
dominante; **el oro solo para la acción que convierte, como mucho uno por
pantalla**. Verificado: cero hex en los `.tsx`.

**Dos excepciones justificadas, ambas en `.ts` y ambas anotadas:**

- `src/lib/brandPalette.ts` — la imagen social de `next/og` (satori resuelve
  estilos inline y no ve la hoja de estilos) y la exportación a PDF corren fuera
  del navegador. **Esta copia ya se desincronizó una vez**: la auditoría de
  accesibilidad subió `--color-ink-3` por contraste AA y la imagen social se
  quedó con el gris que no cumple. Por eso ahora hay un verificador:

  ```bash
  node scripts/verificar-paleta.mjs
  ```

  Sale con código 1 y lista las diferencias. **La fuente de verdad es
  `globals.css`; se corrige `brandPalette.ts`, nunca al revés.**
- `src/lib/config.ts` → `BRAND_THEME_COLOR`, que alimenta el `<meta name="theme-color">`.
  Un navegador no puede leer una variable CSS ahí.

### Dos trampas de Tailwind v4 que ya tumbaron el sitio entero

1. **Binarios dentro de `src/`.** Tailwind rastrea el proyecto para descubrir
   clases, leyó los bytes de `src/app/icon.png` como texto y emitió CSS
   inválido. Eso no rompe una pantalla: **tumba la hoja de estilos completa y
   TODAS las rutas devuelven 500.** Arreglado con `@source not` en `globals.css`.
2. **Directorios de build alternos sin ignorar.** Mismo fallo, misma
   consecuencia. Por eso `.gitignore` tiene el patrón **genérico** `/.next-*/`:
   enumerarlos uno por uno ya falló una vez.

**Si algún día todas las rutas devuelven 500, mira esto antes que nada.**

### Accesibilidad

Auditoría WCAG 2.1 AA en `docs/ACCESIBILIDAD.md`. Los tokens `ink-3`, `ink-4` y
`line-strong` están **en el mínimo AA medido**: hay un "NO BAJAR ESTOS VALORES"
escrito en `globals.css` y no es decorativo.

---

## 8. Rendimiento

- `framer-motion` **fuera del bundle**: las animaciones de entrada usan
  `animation-timeline: view()` nativo. First load JS de la home: **378,9 KB →
  225,5 KB** comprimido (−40,5%).
- **El beneficio grande no son los bytes**: `framer-motion` serializaba
  `opacity: 0` en el HTML del servidor, así que el elemento LCP **nacía
  invisible** y no se pintaba hasta que terminaba de hidratar. Hoy el HTML de
  `/` tiene cero `opacity:0`.

  > **Regla escrita en el CSS: el estado base es VISIBLE.** La opacidad 0 solo
  > existe dentro de los keyframes. Si alguien la mueve al selector base "para
  > que el fundido siempre funcione", vuelve a atar el pintado de la portada a la
  > hidratación.
- `jsPDF` + `jspdf-autotable` (392 KB) salen por `import()` dinámico: se
  descargan al pulsar "Descargar PDF". **Si alguien convierte eso en un import
  estático, la home vuelve a cargar 392 KB que el 99% de las visitas nunca
  ejecuta, y nada en el build lo avisa.**
- `minimumCacheTTL` de 30 días en `next/image`. **La URL optimizada no lleva hash
  del contenido**: al reemplazar una foto hay que **cambiarle el nombre de
  archivo**, no sobrescribirla, o se sigue sirviendo la vieja hasta 30 días.

---

## 9. Estado de verificación

```
npx tsc --noEmit              exit 0, cero errores
npx eslint src                exit 0, cero errores (5 warnings)
npx next build                exit 0, 23 rutas, cero warnings
grep hex en *.tsx             0 resultados
node scripts/verificar-paleta.mjs   9 colores sincronizados
```

`next build` local necesita `NEXT_DIST_DIR=.next-verify` porque `.next/` quedó
con dueño `root` en esta máquina. En Vercel no aplica.
