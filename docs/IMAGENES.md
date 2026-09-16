# Imágenes del sitio — auditoría, reglas y lista de tomas pendientes

Última auditoría: 2026-09-15. Se revisó `public/` completo y **todas** las
referencias a imágenes en `src/`, abriendo cada archivo para comparar lo que la
foto muestra contra lo que su `alt` y su contexto afirmaban.

---

## 1. La regla, en una línea

> **Una foto entra al sitio solo si muestra de verdad lo que el texto de al lado
> afirma. Si no existe esa foto, va un tratamiento gráfico del sistema de
> diseño — nunca un stock parecido.**

Por qué importa más acá que en otros rubros: el cliente de LuxCars está por
girar entre USD 50,000 y USD 1,000,000 a una empresa que conoció por internet.
Lo único que compra antes de confiar es coherencia. El día que nota que el
"Bronco Raptor" de la portada era un 4x4 cualquiera de banco de imágenes, no
discute el precio: se va, y no dice por qué.

El reemplazo honesto es `src/components/PlaceholderGrafico.tsx`.

---

## 2. Qué se encontró y qué se hizo

### 2.1 Fotos que mentían sobre su contenido — RETIRADAS

| Archivo | Se usaba en | Decía ser | Era en realidad |
|---|---|---|---|
| `images/how/search.jpg` | Paso "Búsqueda inteligente" y bloque lateral de `WebsitesSection` con el alt *"Selección de autos de lujo en marketplaces premium"* | Búsqueda de autos en marketplaces | Una laptop con un **dashboard de analítica de marketing** (plantilla de admin genérica). Cero autos, cero marketplaces. |
| `images/how/inspection.jpg` | Paso "Inspección certificada · checklist ASE de 150 puntos" | Inspección técnica certificada | Alguien **echando aceite de motor** (bidón Mobil 1) en un motor con el capó abierto. Un cambio de aceite no es una inspección de 150 puntos. |
| `images/contact/concierge.jpg` | `ContactSection` (*"Concierge de LuxCars coordinando una importación desde Miami"*) y `WhyUsSection` (*"Asesor concierge de LuxCars atendiendo a un cliente"*) | El equipo de LuxCars | **Stock de dos oficinistas desconocidos chocando las manos.** Ni es LuxCars, ni hay auto, ni hay importación. Presentar stock como "nuestro equipo" miente sobre quién atiende al cliente. |
| `images/faq/questions.jpg` | `FAQSection` (*"Asesor LuxCars respondiendo preguntas frecuentes"*) | Un asesor respondiendo | **Stock de tres desconocidos señalando una laptop.** |

Las cuatro se borraron del repo y su hueco lo ocupa `PlaceholderGrafico`.
Están en el historial de git si alguna vez hiciera falta recuperarlas.

### 2.2 `alt` que describían otra cosa — REESCRITOS

El `alt` debe describir **lo que se ve**, no el paso comercial que ilustra: quien
usa lector de pantalla necesita la imagen, no el título que ya leyó al lado.

| Archivo | `alt` anterior | `alt` corregido |
|---|---|---|
| `images/hero/main.jpg` (en `Hero.tsx`) | "SUV de lujo en estudio con iluminación dorada" — ni SUV, ni estudio, ni dorado | "Audi R8 gris mate visto de tres cuartos trasero sobre una carretera de montaña al atardecer" |
| `images/how/purchase.jpg` | "Paso 03: Negociación & compra en el proceso de importación de LuxCars" | "Dos personas de traje se dan la mano cerrando un acuerdo en una oficina" |
| `images/how/shipping.jpg` | "Paso 04: Envío asegurado…" / "Plan Fast Track timeline" | "Vista aérea de un terminal portuario con contenedores apilados y grúas pórtico" |
| `images/how/customs.jpg` | "Paso 05: Aduanas & SUNAT…" | "Una persona firma con lapicero un juego de documentos impresos sobre un escritorio" |
| `images/how/delivery.jpg` | "Paso 06: Entrega VIP…" | "Toyota RAV4 plateada recién lavada, estacionada al aire libre y vista de tres cuartos" |
| `images/timeline/journey.jpg` | "Plan Estándar timeline" | "Mercedes-AMG GT amarillo circulando sobre una carretera despejada" |

### 2.3 La imagen social estaba rota — REPARADA

`src/app/layout.tsx` apuntaba (dos veces: Open Graph y Twitter) a
`/brand/social-1024.png`, **un archivo que no existe en `public/`**. Es decir:
cada vez que alguien compartía luxcars.pe por WhatsApp, Facebook o LinkedIn, la
vista previa salía en blanco. Era la imagen más vista del sitio.

Ahora se genera con `next/og` en `src/app/opengraph-image.tsx`: composición
tipográfica con la paleta de marca, 1200×630. Se generó en vez de subir un PNG
para que no se vuelva a desincronizar — no hay archivo que borrar o renombrar
por error. Cuando exista una foto propia del stock se le puede montar de fondo.

### 2.4 Archivos huérfanos — BORRADOS

Nada de esto estaba referenciado por ninguna línea de código:

- `images/whyus/` completo (7 archivos, ~590 KB). Además estaban mal nombrados:
  `exotics.jpg` era **byte por byte la misma foto** que `how/delivery.jpg`, o
  sea una Toyota RAV4 plateada guardada como "exóticos"; `search-advisory.jpg`
  era copia del dashboard de analítica; `inspection-certified.jpg` era un
  **Chevrolet Niva** (SUV ruso) con el capó abierto en un taller cualquiera;
  `concierge.jpg` era una oficina de startup con programadores.
- `images/calculator/dashboard.jpg` — un dashboard de **rendimiento web**
  (SpeedCurve), sin relación con la calculadora de impuestos.
- `images/websites/{porsche,bmw,tesla}-old.png` — versiones viejas de logos.
- `images/logo{,-v2,-new,-clean,-final}.svg` + `images/logo.png` — seis logos
  antiguos. El sistema vigente es `public/brand/`.
- `public/{next,vercel,file,globe,window}.svg` — andamiaje del starter de Next.

### 2.5 `next/image` — verificado

Todas las referencias del sitio público usan `next/image`. Al cierre de la
auditoría:

- Las que van con `fill` llevan `sizes` correcto (`Hero`, `HowItWorksSection`,
  `DeliveryTimesSection`, `ContactSection`).
- Se agregó `priority` a la **primera foto real** de `HowItWorksSection`, que es
  la candidata a LCP de `/como-funciona`. `Hero` y `HeroNuevo` ya lo tenían.
- Los logos de marcas y de portales van con `width`/`height` fijos, que es lo
  correcto para un tamaño que no depende del viewport.
- Única excepción deliberada: `src/components/portal/SubidorFotos.tsx` usa
  `<img>` porque previsualiza blobs locales y objetos de Supabase Storage antes
  de que existan. Está documentado en el propio archivo.

### 2.6 `next.config.ts` — se cerró la puerta a dominios remotos

`images.remotePatterns` tenía `images.unsplash.com`: exactamente el canal por el
que entraron las fotos falsas del catálogo anterior. Se dejó **vacío a
propósito**, con el motivo escrito en el archivo.

> **No agregues ahí los CDN de MarketCheck, Auto.dev, eBay, Autotrader,
> CarGurus, Cars.com, TrueCar, AutoTempest ni Facebook Marketplace.** Sus
> contratos prohíben cachear, almacenar, indexar o persistir su contenido
> (*"cache, store, index or otherwise persist"*, *"derivative databases"*,
> borrado obligatorio a las 6 horas) y el optimizador de `next/image` hace
> literalmente eso: descarga la imagen ajena y la guarda optimizada en el caché
> de Vercel por 30 días. Habilitar uno de esos hostnames es incumplimiento de
> contrato con revocación de llave.

---

## 3. `public/images/vehiculos/*.webp` — verificación de modelo (OK) y pendientes

Durante esta auditoría aparecieron 9 archivos `.webp` en
`public/images/vehiculos/` (Bronco Raptor, Cybertruck, Tacoma TRD, Tundra TRD,
F-250 Super Duty, RAM 3500, Corvette Z06, Corvette C8, Geely Coolray). Son del
trabajo paralelo sobre el catálogo, no de esta auditoría, y hoy **no se muestran
en ninguna parte**: todos los `imageSrc` de `src/data/trendingVehicles.json`
siguen en `null`.

**Verificación de modelo — se abrió cada archivo y los 9 son correctos.** No se
repite el error del catálogo viejo. Detalle de lo que se ve:

| Archivo | Qué muestra realmente |
|---|---|
| `ford-bronco-raptor.webp` | Bronco Raptor negro de 4 puertas, guardabarros ensanchados y neumáticos BFGoodrich. Correcto. |
| `tesla-cybertruck.webp` | Cybertruck de acero inoxidable. Correcto. |
| `toyota-tacoma-trd.webp` | Tacoma TRD Pro 4ª gen color Terra, parrilla "TOYOTA". Correcto. |
| `toyota-tundra-trd.webp` | Tundra TRD Pro blanca. Correcto, **pero lleva paragolpes delantero y winche no originales**. |
| `ford-f250-super-duty.webp` | F-250 XLT FX4 blanca, insignia "F250" visible. Correcto. |
| `ram-3500-limited.webp` | RAM 3500 dually blanca en un salón del automóvil. Es un 3500, **pero el acabado "Limited" no se puede confirmar desde la foto** (la parrilla cromada es de Laramie o Limited indistintamente) y se ve insignia **Cummins**, o sea diésel. |
| `chevrolet-corvette-z06.webp` | Corvette C8 Z06 blanco, insignia Z06 en la aleta. Correcto. |
| `chevrolet-corvette-c8-stingray.webp` | Corvette C8 Stingray rojo con alerón alto. Correcto. |
| `geely-coolray-2026.webp` | (Contraejemplo del catálogo: no se importa, ver reglas de `trendingVehicles.ts`.) |

**Lo que falta antes de conectarlas.** Según el propio componente
`src/components/CreditoFoto.tsx`, las fotos vienen de Wikimedia Commons con
licencias CC0 y CC BY. Eso es una vía válida — pero CC BY obliga a nombrar al
autor, enlazar la licencia, enlazar la obra y declarar que la imagen fue
modificada (acá se recortan a 16:10 y se convierten a WebP). Queda pendiente:

1. Que exista `docs/FOTOS.md` con fuente, autor, licencia y URL de origen **de
   cada archivo**. Hoy `CreditoFoto.tsx` lo menciona pero el documento todavía
   no está en el repo.
2. Que el crédito se renderice de verdad donde la licencia lo exige.
3. Dejar claro en la ficha que la foto es **ilustrativa del modelo**, no de la
   unidad en venta. Ninguna de estas fotos es un auto de LuxCars: son unidades
   de concesionario, de salón del automóvil o de vía pública fotografiadas por
   terceros. Mostrarlas sin esa aclaración vuelve a prometer algo que no es.
4. Para el RAM 3500: o se confirma el acabado Limited o se le quita la palabra
   al título. Y si se ofrece, la ficha debe decir que es diésel.
5. Para el Tundra: declarar que el paragolpes y el winche son accesorios.

> Nada de esto se tocó en esta auditoría: `src/data/` y el flujo del catálogo
> son de otro frente de trabajo. Queda anotado para que no se pierda.

---

## 4. Lo que hay que conseguir — brief de producción

Prioridad de arriba hacia abajo. Todo esto reemplaza un `PlaceholderGrafico` o
una foto de banco genérica.

### P1 — Stock propio (lo que más vende y hoy no existe)

**Para qué:** las fichas de `/comprar`, el hero, la imagen social y la página
del vehículo. Es la carencia más cara del sitio: el dueño tiene autos y no tiene
fotos.

**Cómo:** ya existe una guía en el portal, `src/lib/portal/photoGuide.ts` y
`src/components/portal/GuiaFotografia.tsx`. Sígala. En resumen, por unidad:

- 3/4 delantero y 3/4 trasero, cámara a la altura del faro (no parado, no de
  cuclillas), rueda delantera girada hacia la cámara.
- Ambos laterales completos, paralelos al auto.
- Interior: tablero con el odómetro legible, asientos delanteros, asientos
  traseros, maletera.
- Detalle: llantas, placa de VIN, cualquier golpe o rayón — **sobre todo los
  golpes.** El defecto fotografiado y declarado genera más confianza que el
  auto impecable.
- Luz: nublado o primera/última hora del día. Sol de mediodía quema el capó.
- Fondo: pared lisa o el estacionamiento vacío. Nunca con otros autos, personas
  ni basura en cuadro.
- Formato: horizontal 16:10, mínimo 2000 px de ancho, JPG o WebP.

### P2 — Equipo real (3 tomas)

Reemplaza los `PlaceholderGrafico` de `ContactSection`, `WhyUsSection` y
`FAQSection`, que hoy dicen "Pendiente: retrato real del equipo".

1. **Retrato del equipo** en la oficina de San Isidro. Horizontal, 3:2,
   mínimo 1600 px. Vestimenta de trabajo real, no traje alquilado.
2. **Alguien atendiendo por WhatsApp o teléfono**, plano medio, de la persona
   que de verdad contesta.
3. **Escritorio con documentación de una importación real** (con los datos del
   cliente tapados).

Si el dueño prefiere no exponer caras, se quedan los tratamientos gráficos: es
una opción legítima y sigue siendo más honesta que stock.

### P3 — Proceso real (4 tomas)

1. **Comparativa de unidades en pantalla** — captura real del comparativo que se
   le arma al cliente, con precios y kilometrajes reales (datos del cliente
   tapados). Reemplaza el `PlaceholderGrafico` de "Búsqueda" en
   `HowItWorksSection` y el de `WebsitesSection`.
2. **Inspección de verdad** — el técnico con el checklist firmado junto a la
   unidad, en el taller. Reemplaza el `PlaceholderGrafico` de "Inspección". Si
   no hay foto propia todavía, sirve el reporte de inspección escaneado con los
   datos tapados: es más creíble que cualquier foto.
3. **Auto embarcado o en el patio del Callao**, con el contenedor o la nave
   detrás. Reemplazaría la foto genérica de puerto (`how/shipping.jpg`), que hoy
   es un terminal de contenedores cualquiera.
4. **Entrega a un cliente** — llaves, placa puesta, auto lavado. Con permiso
   firmado del cliente para usar su imagen. Reemplazaría `how/delivery.jpg`, que
   hoy es una RAV4 de stock.

### P4 — Imagen social propia (opcional)

La generada en `src/app/opengraph-image.tsx` funciona y es honesta. Si se quiere
una con foto, hace falta **una** toma horizontal 1200×630 de una unidad propia,
con espacio negativo a la izquierda para el texto.

---

## 5. Revisar antes de cada publicación

Checklist corto para quien suba una imagen nueva:

- [ ] ¿La foto muestra exactamente el modelo, año y versión que dice el texto?
- [ ] ¿Es propia, del fabricante con permiso, o comprada? Anotar la fuente acá.
- [ ] ¿El `alt` describe lo que se ve, no lo que la sección promete?
- [ ] ¿Usa `next/image`? ¿Con `sizes` si lleva `fill`? ¿Con `priority` solo si
      está sobre el pliegue?
- [ ] ¿Está en `public/` o en el bucket propio de Supabase — nunca hotlinkeada
      desde un dealer o un marketplace?
- [ ] Si reemplaza una foto existente: **cambiarle el nombre de archivo.** La URL
      optimizada de `next/image` no lleva hash de contenido y el caché dura 30
      días; sobrescribir el archivo deja la imagen vieja servida.

---

## 6. Nota aparte: logos de terceros

`BrandsSection` muestra 20 logos de fabricantes bajo el título *"Trabajamos
directamente con las marcas más deseadas del mundo"*, y `WebsitesSection`
muestra 10 logos de portales bajo *"Fuentes verificadas"*.

Los logos ilustran bien lo que dicen ser — no es el problema de esta auditoría.
Pero ambos titulares afirman una **relación comercial** con esas marcas y
portales. Si esa relación no existe como acuerdo firmado, conviene ajustar el
copy (por ejemplo "marcas que importamos" y "portales que revisamos"), porque un
logo ajeno junto a la palabra "directamente" es el tipo de afirmación que un
titular de marca sí reclama. No se tocó el copy porque excede el encargo; queda
señalado para que el dueño decida.
