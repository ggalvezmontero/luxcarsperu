# Fotos del catálogo — procedencia, licencia y atribución

Respaldo documental de **todas** las fotos que se publican en la sección "Los autos
más buscados" (`src/components/MostSoughtVehiclesSection.tsx`, datos en
`src/data/trendingVehicles.json`).

Si alguna vez llega un reclamo por una foto, este archivo es la defensa: dice de
dónde salió cada imagen, bajo qué licencia, quién la tomó y qué se le modificó.

**Última verificación: 15 de septiembre de 2026.**

---

## Por qué existe este archivo

El catálogo anterior usaba fotos genéricas de Unsplash que **no correspondían al
vehículo**: un 4x4 cualquiera etiquetado "Ford Bronco Raptor", un pickup cualquiera
etiquetado "Tesla Cybertruck". A un cliente que va a gastar USD 100,000 eso le
destruye la credibilidad del negocio.

Se quitaron todas y se reemplazaron solo por fotos que pasan **tres pruebas**,
verificadas una por una:

1. **Es el vehículo correcto.** Modelo y generación confirmados *mirando la
   imagen* y los rasgos que distinguen la versión (emblemas, parrilla, rines,
   suspensión), no confiando en el nombre del archivo ni en la categoría de
   origen. Ese es justamente el error que se está corrigiendo.
2. **La licencia permite uso comercial.** CC0 o CC BY. Se descartaron las salas
   de prensa de los fabricantes y todo lo que dijera "editorial use only".
3. **La URL funciona y el archivo es el que dice ser.** Descarga real con `curl`
   verificando tamaño y dimensiones, no un `HEAD` asumido.

Un vehículo que no pasa las tres se queda **sin foto** (`imageSrc: null`) y la UI
muestra el placeholder "Foto pendiente". Nunca se rellena con una foto genérica.

---

## Tabla maestra

| Vehículo (id) | Fuente | Autor | Licencia | ¿Atribución exigida? | URL de origen |
|---|---|---|---|---|---|
| Ford Bronco Raptor 2026<br>`ford-bronco-raptor` | Wikimedia Commons — `24 Ford Bronco Raptor.jpg` | HJUdall (obra propia) | **CC0 1.0** | No | [File:24 Ford Bronco Raptor.jpg](https://commons.wikimedia.org/wiki/File:24_Ford_Bronco_Raptor.jpg) |
| Toyota Tacoma TRD 2026<br>`toyota-tacoma-trd` | Wikimedia Commons — `24 Toyota Tacoma TRD Pro HV.jpg` | HJUdall (obra propia) | **CC0 1.0** | No | [File:24 Toyota Tacoma TRD Pro HV.jpg](https://commons.wikimedia.org/wiki/File:24_Toyota_Tacoma_TRD_Pro_HV.jpg) |
| Ford F-250 Super Duty 2026<br>`ford-f250-super-duty` | Wikimedia Commons — `24 Ford F-250 Super Duty XLT.jpg` | HJUdall (obra propia) | **CC0 1.0** | No | [File:24 Ford F-250 Super Duty XLT.jpg](https://commons.wikimedia.org/wiki/File:24_Ford_F-250_Super_Duty_XLT.jpg) |
| RAM 3500 Limited 2026<br>`ram-3500-limited` | Wikimedia Commons (originada en Flickr) — `Ram 3500 Limited Longhorn Crew Cab 4x4 Long Box (2026) (55213412374).jpg` | Charles, Port Chester NY (Flickr); subida a Commons por usf1fan2 | **CC0 1.0** | No | [File:Ram 3500 Limited Longhorn…](https://commons.wikimedia.org/wiki/File:Ram_3500_Limited_Longhorn_Crew_Cab_4x4_Long_Box_(2026)_(55213412374).jpg) |
| Toyota Tundra TRD 2026<br>`toyota-tundra-trd` | Wikimedia Commons — `24 Toyota Tundra TRD Pro HV.jpg` | HJUdall (obra propia) | **CC0 1.0** | No | [File:24 Toyota Tundra TRD Pro HV.jpg](https://commons.wikimedia.org/wiki/File:24_Toyota_Tundra_TRD_Pro_HV.jpg) |
| Chevrolet Corvette Z06 Coupé 2026<br>`chevrolet-corvette-z06` | Wikimedia Commons — `25 Chevrolet Corvette Z06.jpg` | HJUdall (obra propia) | **CC0 1.0** | No | [File:25 Chevrolet Corvette Z06.jpg](https://commons.wikimedia.org/wiki/File:25_Chevrolet_Corvette_Z06.jpg) |
| Chevrolet Corvette Stingray C8 2026<br>`chevrolet-corvette-c8-stingray` | Wikimedia Commons — `Chevrolet Corvette Stingray (C8) Washington DC Metro Area, USA (3).jpg` | OWS Photography (obra propia) | **CC BY 4.0** | **SÍ — obligatoria** | [File:Chevrolet Corvette Stingray (C8)…](https://commons.wikimedia.org/wiki/File:Chevrolet_Corvette_Stingray_(C8)_Washington_DC_Metro_Area,_USA_(3).jpg) |
| Tesla Cybertruck 2026<br>`tesla-cybertruck` | Wikimedia Commons — `2024 Tesla Cybertruck, front left, 07-27-2024.jpg` | Cutlass (obra propia) | **CC0 1.0** | No | [File:2024 Tesla Cybertruck, front left…](https://commons.wikimedia.org/wiki/File:2024_Tesla_Cybertruck,_front_left,_07-27-2024.jpg) |
| Geely Coolray 2026<br>`geely-coolray-2026` | Wikimedia Commons — `Geely Binyue L 001.jpg` | JustAnotherCarDesigner (obra propia) | **CC0 1.0** | No | [File:Geely Binyue L 001.jpg](https://commons.wikimedia.org/wiki/File:Geely_Binyue_L_001.jpg) |
| Toyota GR Supra MkV Final Edition 2026<br>`toyota-gr-supra-final-edition` | — **SIN FOTO** | — | — | — | — |
| Changan CS55 Plus Híbrido<br>`changan-cs55-plus-hev` | — **SIN FOTO** | — | — | — | — |

---

## La única foto que obliga a dar crédito

**Chevrolet Corvette Stingray C8 — CC BY 4.0.**

Las otras ocho son CC0 (dedicación al dominio público): no obligan a nada. Esta sí.
La cláusula 3(a)(1) de CC BY 4.0 exige nombrar al autor, enlazar la licencia,
enlazar la obra e indicar si la imagen fue modificada. **Si el crédito no se
publica, el sitio está infringiendo la licencia.**

El crédito se publica bajo la tarjeta mediante `src/components/CreditoFoto.tsx`,
que se pinta automáticamente cuando `imageLicense` lo exige y no se pinta cuando no.
Texto publicado:

> Foto: [OWS Photography](https://commons.wikimedia.org/wiki/File:Chevrolet_Corvette_Stingray_(C8)_Washington_DC_Metro_Area,_USA_(3).jpg) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · imagen recortada

`buildTrendingVehicles()` en `src/data/trendingVehicles.ts` revienta el build si
una foto con licencia que exige atribución se queda sin `imageCredit` o sin
`imageSourceUrl`. No se puede publicar sin crédito por descuido.

---

## Modificaciones aplicadas a todas las fotos

Todas las licencias usadas (CC0 y CC BY, ninguna con ShareAlike) permiten
modificar y permiten quemar overlays de precio o badges sobre el pixel sin
contagiar la licencia al sitio.

- Recorte a 16:10, el aspecto exacto de la tarjeta.
- Redimensión a 1600 px de ancho máximo.
- Conversión a WebP (todas por debajo de 300 KB; el techo fijado era 400 KB).
- **Eliminación de metadatos EXIF, incluidas coordenadas GPS** de los archivos
  originales. Se verificó que los WebP publicados no llevan EXIF ni ICC.
- Autohospedadas en `public/images/vehiculos/<id>.webp`. **No se hotlinkea a
  `upload.wikimedia.org`**, tal como pide la Wikimedia Foundation.

Solo en la foto del Geely, además:

- Difuminado del portaplacas delantero, que llevaba el nombre chino del modelo
  (缤越 L). En una tarjeta peruana ese texto se lee como otro modelo.
- Difuminado de los rostros de tres personas del público que aparecen al fondo
  del salón. No hay obligación legal (Commons no marca *personality rights*),
  pero es lo correcto en privacidad y no cuesta nada.

Nada se agregó ni se fabricó: solo se recortó y se difuminó.

---

## Salvedades por vehículo (decirlas antes de publicar)

Ninguna de estas invalida la foto — el modelo y la generación son correctos en
todos los casos — pero el dueño debe conocerlas. Por eso **todos** los `imageAlt`
terminan en *"Imagen referencial del modelo, no de la unidad en venta"*: LUX CARS
es broker y no tiene la unidad en patio.

| Vehículo | Salvedad |
|---|---|
| Ford Bronco Raptor | La unidad es **MY2024**. El Bronco Raptor 2026 es el mismo U725 sin cambios de carrocería: el rediseño se pospuso al MY2027 y para 2026 Ford solo sumó colores. En negro y en este ángulo son indistinguibles. |
| Toyota Tacoma TRD | Unidad **MY2024, acabado TRD Pro, color Terra**. Terra era el color exclusivo del TRD Pro 2024; el exclusivo de 2026 es Wave Maker. Generación N400 sin rediseño: chapa, parrilla, rines y suspensión son los del 2026. |
| Ford F-250 Super Duty | Unidad **MY2024, acabado XLT con paquete FX4**. Generación P708 (2023-2026) sin rediseño — verificado contra ford.com, descartando blogs de concesionario que anunciaban una fascia nueva para 2026. El rango de precio de la tarjeta llega hasta Platinum/King Ranch; el XLT está dentro del rango, no en el tope. |
| RAM 3500 Limited | Dos: (a) el acabado real es **Limited Longhorn**, que en la gama RAM es distinto del "Limited" a secas; (b) la unidad es **Cummins turbodiésel**, y la propia tarjeta advierte que el diésel usado no entra a Perú. A tamaño de tarjeta el badge no es legible, pero un cliente que amplíe la foto podría señalarlo. |
| Toyota Tundra TRD | Unidad **MY2024**, acabado TRD Pro. Generación XK70 idéntica al 2026: se comparó contra una foto genuinamente MY2026 y solo cambia el color de pintura. |
| Chevrolet Corvette Z06 | Unidad **MY2025**. El Z06 C8 no tuvo cambio visual entre 2025 y 2026. |
| Chevrolet Corvette Stingray C8 | Foto del 25/04/2025, así que la unidad es **MY2020-2025**. El refresh de 2026 fue de interior (tres pantallas, consola nueva); el exterior no cambia de chapa. |
| Tesla Cybertruck | Unidad **MY2024**. El Cybertruck tiene una sola generación desde su lanzamiento, sin facelift. No se puede distinguir AWD de Cyberbeast en la foto. **Marcas**: CC0 cubre el copyright de la foto, no las marcas "Tesla" y "Cybertruck". El uso es nominativo (ilustrar un vehículo que se intermedia); la tarjeta no debe sugerir patrocinio ni afiliación de Tesla. |
| Geely Coolray | La foto es del **Geely Binyue L**, el modelo donante chino del New Coolray que Geely vende en Perú desde diciembre de 2025. Es el mismo vehículo: coinciden largo (4,380 mm), emblema Geely plateado, parrilla de listones horizontales con marco plateado, faros LED partidos y el color Purple Grey tornasolado de la paleta de lanzamiento peruana. Se descartaron a propósito todos los archivos de `Category:Geely Coolray`, que son el SX11 anterior (parrilla de malla, filete rojo, emblema negro): publicar uno de esos habría repetido el error de Unsplash en versión sutil. |

---

## Vehículos sin foto (y por qué siguen sin foto)

### Toyota GR Supra MkV Final Edition 2026 — candidata **RECHAZADA**

Existía un archivo CC0 en Commons titulado como "Final Edition", con URL y licencia
correctas, y aun así se rechazó:

- El auto de la foto es **rojo mate**, y el Final Edition **nunca se ofreció en rojo
  mate**. La paleta oficial es Absolute Zero, Nocturnal y Renaissance Red 2.0 en
  brillante, más Burnout (blanco mate) y Undercover (negro mate).
- Lleva los *wheel arch flaps* del **GT4 Style Pack**, que solo se ofrece sobre
  Burnout o Undercover. Rojo mate + flaps es una combinación que Toyota nunca
  fabricó.
- El alerón *ducktail* de carbono, el rasgo firma del Final Edition, no es visible.
- La etiqueta "Final Edition" venía del **nombre del archivo**, puesto por un
  concesionario Chrysler-Dodge-Jeep-Ram que recibió el auto en parte de pago.

Lectura más probable: un GR Supra A90 normal con vinilo rojo satinado y piezas de
posventa. Publicarlo bajo "Final Edition" en una tarjeta con precio sería
exactamente el error que se está corrigiendo, y en un catálogo de broker puede
leerse como declaración comercial sobre la versión del vehículo.

**Si se quiere llenar este slot** hay dos caminos honestos: (a) usar esa misma foto
etiquetada solo como "Toyota GR Supra MkV (A90)", sin la palabra *Final Edition* —
la licencia CC0 está limpia y la generación sí está verificada; o (b) buscar una
foto donde se vea el ducktail de carbono y el color sea uno real de la versión.

### Changan CS55 Plus Híbrido — sin candidata

No se encontró ninguna foto con licencia de uso comercial que sea verificablemente
un CS55 Plus híbrido. Se queda en `null`.

---

## Fuentes descartadas (y por qué)

### Prohibidas por contrato

**MarketCheck, Auto.dev, eBay, Autotrader, CarGurus, Cars.com, TrueCar,
AutoTempest y Facebook Marketplace.** Sus términos prohíben textualmente
*"cache, store, index or otherwise persist"* su contenido. Ninguna foto del
catálogo sale de un listado de esas plataformas. Ver la cabecera de
`src/data/trendingVehicles.ts`.

### Salas de prensa de los fabricantes

| Fuente | Por qué no sirve |
|---|---|
| Ford — *From the Road* | "Editorial use only": prohíbe uso comercial sin permiso escrito de Ford. |
| Stellantis North America | "Personal, commercial or any other use of the materials provided from this site is prohibited." Solo periodistas acreditados y solo uso editorial. |
| Chevrolet Pressroom (GM) | Licencia **CC BY-NC 4.0**. El componente *NonCommercial* impide usarla en la web de un broker que cobra por intermediar. |
| Toyota Pressroom | Uso editorial. |
| Tesla | Exige ser *"a member of the news media"* y prohíbe el uso *"for advertising, promotion or otherwise for commercial purposes"*. |
| IMAGIN.studio (renders) | Su licencia prohíbe descargar y cachear en servidor; además la clave de demo entrega marca de agua. |

### Descartes puntuales dentro de Wikimedia Commons

- **Bronco Raptor**: los archivos del "Bronco Raptor 4600" del Salón de Nueva York
  (es el *trophy truck* de carrera, con jaula y calcomanías, no el auto que se
  importa) y dos de Washington DC en CC BY 4.0 con matrícula legible y conductor
  identificable.
- **Corvette Z06**: la categoría `Chevrolet Corvette Z06 C8` de Commons está
  contaminada con Stingray mal clasificados, así que el emblema Z06 se verificó a
  ojo sobre el archivo original en vez de confiar en la categoría.
- **Corvette Stingray**: se descartaron varias CC0 de alta resolución por mostrar
  gente identificable, puertas abiertas en un *car show*, matrícula legible o el
  panel targa quitado (se lee como descapotable).
- **Cybertruck**: se prefirió una CC0 antes que las CC BY-SA 4.0 de mayor
  resolución, porque ShareAlike complica los overlays.
- **RAM 3500**: existe una alternativa CC0 MY2026 en acabado Limited Night Edition,
  descartada por menor resolución y procedencia menos trazable.
- **Geely**: descartado todo `Category:Geely Coolray` por ser la generación
  anterior (SX11), como se explica en la tabla de salvedades.

---

## Cómo agregar una foto nueva sin romper nada

1. Verificar las tres pruebas de arriba. **Mirar la imagen**, no el nombre del archivo.
2. Descargar el original y procesarlo: recorte 16:10, 1600 px de ancho, WebP,
   sin EXIF, por debajo de 400 KB.
3. Guardarlo en `public/images/vehiculos/<id>.webp` — el nombre debe ser el `id`
   exacto del vehículo en `src/data/trendingVehicles.json`.
4. En ese JSON, llenar `imageSrc`, `imageAlt` (descripción real: modelo,
   generación, ángulo, color; nunca un texto genérico), `imageCredit`,
   `imageLicense` e `imageSourceUrl`.
5. Agregar la fila a la tabla maestra de este archivo.
6. `npx tsc --noEmit`. Si la licencia exige atribución y falta el crédito, el
   build revienta a propósito.
