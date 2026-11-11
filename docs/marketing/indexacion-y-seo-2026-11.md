# Indexación y SEO · noviembre 2026 · LuxCars Perú

**Fecha:** 10 de noviembre de 2026.
**Fuentes:** Search Console, propiedad de dominio `luxcars.pe` (el informe de indexación tenía fecha del 5 de noviembre; el de rendimiento cubría del 5 al 8 de noviembre); el sitio publicado en `https://www.luxcars.pe`; el código de la rama de trabajo. Parte del [análisis de palabras clave](analisis-palabras-clave.md) del mismo día y no lo repite: aquí van los datos reales que ese documento no tenía.

**Resumen en seis líneas.**
1. El sitemap está enviado, se leyó hoy sin errores y Google ya descubrió sus 25 URLs (antes veía 19).
2. De las 23 URLs "no indexadas" del informe, ninguna es un problema: son versiones viejas (`/?simular=`, fichas demo borradas, `luxcars.pe` sin `www`), páginas privadas con `noindex` a propósito y archivos estáticos.
3. robots.txt está bien: solo excluye `/portal/` y `/api/`, apunta al sitemap con `www` y Search Console no reporta ninguna página bloqueada.
4. Hoy se pidió indexación de 10 URLs nuevas (calculadora, cómo funciona, 7 modelos y la guía de costos) hasta agotar la cuota diaria; quedan 9 para mañana, empezando por `/importar`, que cambió hoy. Las seis fichas demo que Google aún mostraba se retiraron del buscador con una eliminación temporal.
5. En cuatro días con datos, el sitio salió 97 veces en Google con 9 clics. Casi todo es marca y "autos de lujo"; la importación todavía no aparece porque sus páginas se publicaron hoy.
6. Por pedido del dueño, cada servicio responde ahora a todas sus variantes de búsqueda, y todo está ya en producción: `/importar` con "Importación de autos a pedido desde Estados Unidos a Perú", la portada con "Autos de lujo en Lima" al frente del título, y `/comprar`, `/vender`, `/escaneo` y `/calculadora` con títulos o descripciones nuevos (sección 10). Falta que Google las vuelva a leer: la cuota de solicitudes se agotó hoy y se piden mañana.

---

## 1. Sitemap

| Dato | Antes de hoy | Hoy |
|---|---|---|
| URL enviada | `https://www.luxcars.pe/sitemap.xml` (6 nov) | Reenviada el 10 nov |
| Última lectura | 9 nov | 10 nov |
| Estado | Correcto | Correcto, sin errores |
| URLs descubiertas | 19 | **25** |

Las 25 URLs del sitemap en vivo, comprobadas con `curl`: portada, `/comprar`, `/importar`, `/calculadora`, `/vender`, `/escaneo`, `/como-funciona`, `/faq`, `/terminos`, `/privacidad`, `/cookies`, nueve `/importar/<modelo>`, `/guias` y cuatro guías. No entra ninguna ficha de stock porque hoy no hay vehículos publicados.

---

## 2. Estado de indexación, URL por URL

Informe "Páginas" de Search Console con fecha 5 de noviembre: **17 indexadas, 23 no indexadas**. El informe se actualiza cada varios días, así que todavía no refleja ni el canonical `www` del 6 de noviembre ni las páginas publicadas hoy.

### 2.1 Las 25 URLs del sitemap

| URL | Estado el 5 nov | Qué se hizo hoy |
|---|---|---|
| `/` | Indexada (y también `luxcars.pe/` sin www) | Nada: ya está |
| `/comprar` | Indexada | Nada |
| `/importar` | Indexada | Nada |
| `/vender` | Indexada | Nada |
| `/escaneo` | Indexada | Nada |
| `/terminos` | Indexada | Nada |
| `/privacidad` | Indexada | Nada |
| `/como-funciona` | Indexada solo como `luxcars.pe/como-funciona`; la versión `www` figuraba como "página alternativa con canonical" porque el 30 oct el canonical apuntaba sin www | **Indexación solicitada** (ya con canonical www) |
| `/faq` | Igual que la anterior: indexada sin www | Inspeccionada; la solicitud no entró por cuota. **Mañana** |
| `/cookies` | Igual: indexada sin www | **Mañana** |
| `/calculadora` | Descubierta por el sitemap, sin rastrear | **Indexación solicitada** |
| `/importar/toyota-tundra-trd` | Desconocida para Google | **Solicitada** |
| `/importar/ford-bronco-raptor` | Descubierta, sin rastrear | **Solicitada** |
| `/importar/chevrolet-corvette-c8-stingray` | Descubierta, sin rastrear | **Solicitada** |
| `/importar/ram-3500-limited` | Descubierta, sin rastrear | **Solicitada** |
| `/importar/tesla-cybertruck` | Desconocida | **Solicitada** |
| `/importar/chevrolet-corvette-z06` | Descubierta, sin rastrear | **Solicitada** |
| `/importar/toyota-tacoma-trd` | Descubierta, sin rastrear | **Solicitada** |
| `/importar/ford-f250-super-duty` | Descubierta, sin rastrear | **Mañana** |
| `/importar/toyota-gr-supra-final-edition` | Descubierta, sin rastrear | **Mañana** |
| `/guias/cuanto-cuesta-importar-un-auto-a-peru` | Desconocida | **Solicitada** |
| `/guias/requisitos-para-importar-un-auto-a-peru` | Descubierta, sin rastrear | Inspeccionada; "Quota exceeded". **Mañana** |
| `/guias/ad-valorem-0-autos-estados-unidos` | Descubierta, sin rastrear | **Mañana** |
| `/guias/isc-vehiculos-peru` | Descubierta, sin rastrear | **Mañana** |
| `/guias` | Descubierta, sin rastrear | **Mañana** |

### 2.2 Las 17 indexadas (tal como las lista Search Console)

Con `www`: `/vender`, `/privacidad`, `/`, `/escaneo`, `/importar`, `/comprar`, `/terminos`, `/comprar/demo-01`, `/comprar/demo-02`, `/comprar/demo-05`.
Sin `www` (de antes del cambio de canonical): `luxcars.pe/`, `/como-funciona`, `/faq`, `/cookies`, `/comprar/demo-03`, `/comprar/demo-04`, `/comprar/demo-06`.

Dos observaciones:
- Las seis fichas `demo-0X` eran vehículos de demostración. Hoy devuelven 404 con `noindex`, así que Google las sacará solas en las próximas semanas. Una de ellas (`demo-06`) recibió un clic real desde Google: alguien buscó un auto y aterrizó en una ficha que ya no existe. Es el argumento más concreto para publicar stock real (sección 6.3).
- Las versiones sin `www` se consolidarán en `www` conforme Google vuelva a rastrearlas; `luxcars.pe` ya redirige con 308 a `www.luxcars.pe` (comprobado hoy).

### 2.3 Las 23 "no indexadas", motivo por motivo

| Motivo | Cuántas | Qué son | Acción |
|---|---|---|---|
| Página alternativa con canonical correcto | 15 | Nueve `/?simular=<modelo>` (reemplazadas por `/importar/<modelo>`); `www` de `/faq`, `/como-funciona`, `/cookies` (canonicalizaban sin www hasta el 6 nov); `www` de `demo-03`, `demo-04`, `demo-06` | Ninguna. Las de `faq`/`como-funciona`/`cookies` se corrigen solas al recrawl con el canonical nuevo; hoy se pidió `/como-funciona` |
| Excluida por `noindex` | 3 | `/cuenta`, `/cuenta/comprar`, `/cuenta/vender` | Correcto: son privadas |
| Página con redirección | 1 | `http://luxcars.pe/` | Correcto: redirige a `https://www` |
| Rastreada, no indexada | 4 | `/opengraph-image`, dos fuentes `.woff2`, `favicon.ico` | Correcto: no son páginas |

**Ninguna URL figura como "bloqueada por robots.txt".**

---

## 3. robots.txt

Comprobado en vivo (`https://www.luxcars.pe/robots.txt`) y en `src/app/robots.ts`:

```
User-Agent: *
Allow: /
Disallow: /portal/
Disallow: /api/
Host: https://www.luxcars.pe
Sitemap: https://www.luxcars.pe/sitemap.xml
```

- No bloquea ninguna página pública.
- Apunta al sitemap y al host con `www`, que salen de `contact.website` en `src/lib/config.ts`.
- `/cuenta/*` y los estimados compartidos `/c/<código>` no están en `Disallow` y **así debe seguir**: se excluyen con la etiqueta `noindex`, y Google solo puede leer esa etiqueta si el robots le deja entrar. Ponerlos en `Disallow` los dejaría "indexados aunque bloqueados" si alguien los enlaza.
- Search Console confirma: cero páginas bloqueadas por robots.

**No hubo nada que corregir; no se tocó código.**

---

## 4. Solicitudes de indexación

Google corta en unas 10 a 12 solicitudes por día por propiedad. Hoy entraron **10 URLs distintas** (una, la Tundra, se envió dos veces por error de la interfaz; Google avisa que repetir no cambia la cola). La undécima devolvió "Quota Exceeded".

**Enviadas el 10 de noviembre:** `/calculadora`, `/como-funciona`, `/importar/toyota-tundra-trd`, `/importar/ford-bronco-raptor`, `/importar/chevrolet-corvette-c8-stingray`, `/importar/ram-3500-limited`, `/importar/tesla-cybertruck`, `/guias/cuanto-cuesta-importar-un-auto-a-peru`, `/importar/chevrolet-corvette-z06`, `/importar/toyota-tacoma-trd`.

**Pendientes para el 11 de noviembre y el 12 (son 15 y la cuota da para unas 10 por día), en este orden:**
1. `/importar` (título, H1 y texto nuevos, en producción; la solicitud de hoy devolvió "Quota Exceeded")
2. `/` (título nuevo con "Autos de lujo en Lima" al frente; también "Quota Exceeded" hoy)
3. `/comprar` (título, H1, descripción y párrafo nuevos)
4. `/vender` (título, descripción y párrafo nuevos)
5. `/escaneo` (título, descripción y párrafo nuevos)
6. `/calculadora` (descripción nueva)
7. `/guias/requisitos-para-importar-un-auto-a-peru`
8. `/faq`
9. `/importar/ford-f250-super-duty`
10. `/importar/toyota-gr-supra-final-edition`
11. `/guias/ad-valorem-0-autos-estados-unidos`
12. `/guias/isc-vehiculos-peru`
13. `/guias`
14. `/cookies`
15. Las páginas por marca que se están creando (`/importar/marca/<marca>`, commit `cd15171`), cuando estén en el sitemap; ese día reenviar también el sitemap.

Comprobado antes de pedirlas: las seis primeras ya sirven en producción los títulos nuevos (leídos con `curl` el 10 de noviembre por la noche).

Cómo se hace: Search Console → cuadro "Inspeccionar cualquier URL" → pegar la URL con `www` → "Solicitar indexación". En esta propiedad, inspeccionar no gasta cuota; solicitar sí.

**Eliminación temporal de las fichas demo.** En Eliminaciones → Nueva solicitud se pidió retirar del buscador todo lo que empiece por `https://www.luxcars.pe/comprar/demo-` (Google aplica la petición a www, sin www, http y https). Estado: "Processing request". Dura unos seis meses; como las URLs devuelven 404 con `noindex`, al vencer ya no volverán. Motivo: Google seguía mandando clics a fichas de autos ficticios.

---

## 5. Lo que la gente buscó (Rendimiento, 5 al 8 de noviembre)

La propiedad solo tiene datos desde el 5 de noviembre, así que "últimos 3 meses" son cuatro días. Es poco, pero ya dice por dónde entra el tráfico.

**Totales:** 97 impresiones, 9 clics, CTR 9,3 %, posición media 15. Móvil: 66 impresiones y 8 clics; escritorio: 30 y 1; tablet: 1 y 0.

### 5.1 Las 27 consultas

| Consulta | Clics | Impr. | Posición | Lectura |
|---|---|---|---|---|
| lux car | 2 | 3 | 1,7 | Marca |
| luxcars | 1 | 2 | 1,5 | Marca |
| autos de lujo peru | 1 | 2 | 9,0 | **Genérica de compra, ya en primera página** |
| autos de lujo | 0 | 6 | 57,2 | Genérica, muy disputada |
| tesla model y precio perú | 0 | 4 | 10,2 | **Modelo concreto, sin página propia** |
| cotizar mi auto gratis peru | 0 | 3 | 65,7 | Tasación (vender) |
| comprar autos de lujo | 0 | 2 | 13,5 | Compra |
| carros de lujo | 0 | 2 | 46,5 | Genérica |
| un vehiculo · busca · en peru · peru · si ayudame · que carro es ese · solo esos modelos? | 0 | 1 c/u | 1 a 23 | Fragmentos de conversación (modo IA de Google); no accionables |
| luxe car · luccar | 0 | 1 c/u | 4 y 11 | Marca mal escrita |
| porsche | 0 | 1 | 8,0 | Marca de auto, sin intención clara |
| carros de lujo en peru | 0 | 1 | 9,0 | Compra, primera página |
| land cruiser 300 peru | 0 | 1 | 9,0 | Modelo concreto, sin página |
| bmw | 0 | 1 | 11,0 | Marca de auto |
| tesla | 0 | 1 | 15,0 | Marca de auto |
| venta autos usados de lujo lima | 0 | 1 | 19,0 | **Compra de usado en Lima** |
| tasar mi auto | 0 | 1 | 50,0 | Tasación (vender) |
| camionetas de lujo | 0 | 1 | 88,0 | Compra, SUV/pickup |
| autos exclusivos | 0 | 1 | 91,0 | Compra |
| importacion de vehiculos usados | 0 | 1 | 100,0 | Importación (única de su grupo) |

### 5.2 Por página

| Página | Clics | Impr. |
|---|---|---|
| `luxcars.pe/` (sin www) | 5 | 24 |
| `www.luxcars.pe/` | 2 | 18 |
| `/vender` | 1 | 8 |
| `luxcars.pe/comprar/demo-06` (ya no existe) | 1 | 6 |
| `/importar` | 0 | **27** |
| `/comprar` | 0 | 18 |
| `luxcars.pe/faq` | 0 | 4 |
| `/comprar/demo-05` · `demo-04` · `demo-01` (ya no existen) | 0 | 5 |
| `/escaneo` | 0 | 1 |
| `luxcars.pe/como-funciona` | 0 | 1 |

### 5.3 Qué dicen estos datos

- **La marca ya funciona.** Cuatro variantes del nombre, todas en el puesto 1 o 2. El nombre del sitio en Google se corregirá solo con el canonical `www`.
- **Google ve a LuxCars como vendedor de autos de lujo, no como importador.** Las consultas con impresiones son "autos de lujo peru", "comprar autos de lujo", "carros de lujo en peru", "venta autos usados de lujo lima", "camionetas de lujo", "autos exclusivos". Tres de ellas ya están en primera página. Pero la página que debería responderlas, `/comprar`, tiene 297 palabras y cero autos publicados: aparece y no gana el clic.
- **`/importar` es la página con más impresiones y ningún clic.** Sale por búsquedas donde no es la mejor respuesta. Las búsquedas de importación propiamente dichas ("importar auto de usa a perú", "cuánto cuesta importar") aún no aparecen: las guías, la calculadora y los modelos se publicaron hoy. Hay que medir de nuevo en dos semanas.
- **Hay demanda de modelos que no tienen página:** Tesla Model Y (4 impresiones, puesto 10) y Land Cruiser 300. Model Y está en la lista de modelos por cargar desde el portal del análisis anterior; el dato lo sube al primer lugar.
- **La tasación tiene búsquedas propias** ("tasar mi auto", "cotizar mi auto gratis peru") y el sitio sale en los puestos 50 y 65: existe el bloque en `/vender`, pero no una página que responda esa pregunta.
- **Escaneo casi no aparece** (1 impresión). Es un servicio que se gana en el mapa (perfil de Google Business), no en la web; coincide con el análisis anterior.
- **Siete de cada diez impresiones son en móvil.** Cualquier texto nuevo se lee primero en un teléfono: respuesta en el primer párrafo, tablas cortas.

---

## 6. Propuesta por servicio

Regla del proyecto: no se cambian títulos, descripciones, canonicals ni URLs existentes sin motivo. Esta noche el dueño dio el motivo: el sitio tiene que salir para todas las variantes con que la gente busca cada servicio. Con eso, la sesión principal cambió títulos, descripciones, H1 y primeros párrafos (sección 10); las URLs y canonicals no se tocaron. Lo que sigue abajo marca qué ya está **hecho** y qué sigue siendo propuesta. Las cifras, como siempre, salen de `src/core/pricing` y nunca a mano.

### 6.1 Importación a pedido desde Estados Unidos

**Páginas responsables:** `/importar`, `/como-funciona`, `/importar/<modelo>`, las cuatro guías.
**Búsquedas a ganar:** "importar auto de estados unidos a perú", "cuánto cuesta importar un auto a perú", "cuánto cuesta nacionalizar un auto en perú", "importación de vehículos usados" (ya aparece, puesto 100), "importar [modelo] perú", "[modelo] precio perú".

Cambios concretos:
1. **Cargar desde `/portal/ejemplos`, sin código, los modelos con demanda medida:** Tesla Model Y primero (es la única búsqueda de modelo con varias impresiones y el sitio ya está en el puesto 10 sin página), luego Tesla Model 3, Porsche 911 Carrera y BMW X5 (las marcas "porsche", "bmw" y "tesla" ya muestran el sitio). Land Cruiser 300 no se vende en Estados Unidos: no crear página; esa búsqueda es para la búsqueda local (6.6).
2. **`/importar`: hecho y en producción** (commit `694911a`). Título y H1 "Importación de autos a pedido desde Estados Unidos a Perú", descripción y primer párrafo con "auto o camioneta", "Miami o cualquier estado de EE.UU.", "puesto en Lima", y cuatro preguntas frecuentes con las palabras de la búsqueda ("¿Cómo funciona la importación de autos a pedido?", "¿Cuánto cuesta importar un auto de Estados Unidos a Perú?", "¿Qué autos se pueden importar a Perú desde USA?", "¿Conviene traer un carro de Estados Unidos o comprarlo en Lima?"). Motivo: en "importación de autos a pedido" mandaba Altagamma con ese título exacto y la página no usaba la frase. Queda por añadir "¿cuánto demora?" y "¿qué vehículos no se pueden importar?" con enlace a la guía.
3. **`/como-funciona`**: nada que cambiar en el texto; hoy se pidió su indexación con `www`. Añadir un enlace en el paso de aduanas a la guía de costos y en el de requisitos a la de requisitos.
4. **Guías**: pedir indexación de las tres restantes mañana. Después, una guía nueva por semana en el orden del análisis anterior: placas (validar con el gestor), "importar o comprar en Perú" por modelo, "cuánto demora importar".
5. **Medir en dos semanas** en Rendimiento, filtrando por página `/importar/` y `/guias/`, qué consultas traen impresiones; ajustar entonces, no antes.

### 6.2 Calculadora de impuestos SUNAT

**Página responsable:** `/calculadora` (indexación pedida hoy; enlazada desde la portada, `/importar`, `/comprar`, `/vender` y `/escaneo`).
**Búsquedas a ganar:** "calculadora importación de autos perú", "calcular impuestos importación vehículo", "simulador importación autos sunat", "cuánto se paga de impuestos por importar un auto".

Cambios concretos:
1. **Hecho** (commit `4edc79f`, en producción): la descripción dice ahora "Simulador gratis: calcula cuánto cuesta importar y nacionalizar un auto o carro de Estados Unidos a Perú con los impuestos SUNAT (ad valorem, ISC, IGV)…". Título y H1 no cambian. Comprobar en dos semanas si entra por "simulador"; si no, añadir un H2 con esa palabra.
2. Añadir tres preguntas al final: "¿La calculadora incluye el ISC y la percepción del IGV?", "¿Sirve para autos usados?", "¿Qué pasa si el auto es de planta fuera de Estados Unidos?" (enlace a la guía de ad valorem).
3. Que cada página de modelo enlace a la calculadora con el modelo ya cargado (hoy ya lo hace el botón de cotizar): verificar que el enlace lleve el parámetro.

### 6.3 Compra de stock en Lima

**Página responsable:** `/comprar` y `/comprar/<ficha>`.
**Búsquedas a ganar:** "autos de lujo peru" (puesto 9), "comprar autos de lujo" (13), "carros de lujo en peru" (9), "venta autos usados de lujo lima" (19), "camionetas de lujo", "autos exclusivos", "autos de lujo en venta lima". Es el grupo con más impresiones reales hoy y el que peor atiende el sitio.

Cambios concretos:
1. **Publicar stock real.** Las seis fichas demo que Google tenía indexadas ya no existen y una recibía clics. El Corvette 2027 comprado como stock (ver `plan-corvette-2027.md`) debería ser la primera ficha publicada desde el portal: entra sola al sitemap y da a Google una página de auto en venta con esquema `Car`.
2. **Hecho** (commit `4edc79f`, en producción): título "Comprar autos de lujo en Lima · Stock de alta gama disponible", H1 con etiqueta "Comprar autos de lujo en Lima" y titular "Autos de alta gama disponibles hoy en Lima", descripción y primer párrafo con "carros, camionetas y deportivos de lujo seminuevos en venta en San Isidro". Las fichas demo llevan además `noindex` por si algún entorno las sirve sin base.
3. **Pendiente: reforzar `/comprar`** de 297 a unas 700 palabras: un bloque "¿No está en stock? Lo buscamos en Perú o lo importamos" (enlace a 6.6 y a `/importar`) y preguntas: "¿Venden autos usados de lujo?", "¿Aceptan auto en parte de pago?", "¿Tienen financiamiento?", "¿Puedo ver el auto antes de comprar?".
4. **Vigilar la descripción:** promete "stock disponible" y hoy no hay fichas. Si va a seguir vacía varias semanas, cambiarla por una que prometa búsqueda e importación, para no pagar en CTR una promesa que la página no cumple.

### 6.4 Venta y consignación con tasación

**Página responsable:** `/vender` (1 clic y 8 impresiones; ya tiene título con "consignación", H1 con "tasación" y esquema FAQPage).
**Búsquedas a ganar:** "tasar mi auto", "cotizar mi auto gratis peru", "cuánto vale mi auto", "tasación de autos lima", "vender mi auto en consignación lima", "consignación de autos lima".

Cambios concretos:
0. **Hecho** (commit `4edc79f`, en producción): título "Vender mi auto en Lima · Consignación y tasación sin exclusividad", descripción y primer párrafo con "auto usado, camioneta o carro de lujo", "tasación gratuita" y "consignación".
1. **Página nueva `/tasacion`** con el mismo formulario de tasación que ya vive en `/vender`, igual que se hizo con `/calculadora`: título "Tasación de autos en Lima: cuánto vale tu auto hoy, gratis | LuxCars Perú", H1 "Tasación gratuita de autos en Lima", 400 palabras sobre cómo se calcula el rango (año, kilometraje, versión, mercado local) y enlace a `/vender`. Motivo: dos búsquedas distintas ("tasar" y "consignar") compiten hoy por la misma URL y el sitio sale en los puestos 50 y 65 para la primera. Ninguna URL existente cambia.
2. En `/vender`, sumar preguntas: "¿Cuánto cobra LuxCars por vender mi auto?", "¿Cuánto demora venderlo?", "¿Puedo seguir usándolo mientras tanto?" (ya está en el H1, falta como pregunta), "¿Qué documentos necesito?".
3. Usar "cotizar" una vez en el bloque de tasación ("cotiza tu auto gratis"): es la palabra que apareció en Search Console.

### 6.5 Escaneo pre-compra

**Página responsable:** `/escaneo` (982 palabras, menciona "scanner", precios desde S/ 349, esquemas Service y FAQPage; 1 impresión en cuatro días).
**Búsquedas a ganar:** "escaneo de autos usados lima", "revisión pre compra auto lima", "scanner automotriz a domicilio lima", "cuánto cuesta escanear un auto en perú", "inspección vehicular antes de comprar".

Cambios concretos:
0. **Hecho** (commits `4edc79f` y `2c1f60e`, en producción): título "Escaneo de autos usados en Lima antes de comprar · Inspección precompra", descripción "Revisión de autos usados antes de comprar en Lima: vamos a donde está el auto con un escáner automotriz profesional…", primer párrafo con "inspección precompra a domicilio, con diagnóstico electrónico y visual". A propósito no se promete "peritaje" ni "revisión mecánica": la página aclara que es diagnóstico electrónico y visual, no inspección de taller, y el texto no debe decir algo que el servicio no es.
1. Añadir la pregunta "¿Cuánto cuesta escanear un auto en Lima?" con el precio que ya sale de la configuración, y "¿Van a domicilio?" con la respuesta explícita: Google muestra esas dos preguntas y la página responde pero no con esas palabras.
2. Las variantes "inspección precompra" y "revisión de autos usados antes de comprar" ya están en título y descripción; falta "revisión pre compra" como subtítulo.
3. Lo que más pesa está fuera de la web: perfil de Google Business verificado con categoría de inspección vehicular y reseñas de cada escaneo. Sin eso la página no entra al bloque de mapa que ocupa la parte alta de esas búsquedas.

### 6.6 Búsqueda local de autos (servicio pendiente)

**Página responsable:** no existe. Decisión abierta del dueño: quinta línea de negocio o sección dentro de `/comprar`.
**Evidencia de hoy:** "land cruiser 300 peru", "porsche", "bmw", "tesla", "venta autos usados de lujo lima" y los fragmentos "que carro es ese", "solo esos modelos?" muestran gente que busca un auto concreto disponible ya, en Perú, y no encuentra en el sitio más que el stock vacío o la importación.

Propuesta: una sección en `/comprar` ("¿Buscas un modelo que no está aquí? Lo encontramos en Perú y lo verificamos antes de que pagues") con formulario corto (modelo, presupuesto, plazo) y, si se aprueba como línea propia, una página `/buscamos-tu-auto` con título "Buscamos tu auto en Perú y lo verificamos antes de comprar". Responde a "[modelo] en venta lima" cuando no hay stock, y conecta con el escaneo (6.5) como garantía. No implementar sin la decisión del dueño.

---

## 7. Orden sugerido

| Prioridad | Qué | Por qué primero |
|---|---|---|
| 1 | 11 y 12 de noviembre: las 15 solicitudes de indexación de la sección 4 | Son minutos y desbloquean todo lo demás; todo el código ya está en producción |
| 2 | Perfil de Google Business verificado, en San Isidro, con reseñas | Es el hueco frente a Altagamma (sección 9) y decide escaneo, consignación y "comprar autos de lujo en lima" |
| 3 | Publicar el Corvette 2027 como ficha real desde el portal | Google ya mandaba clics a fichas que no existen; Altagamma gana con 59 fichas |
| 4 | Cargar Tesla Model Y (y Model 3, 911, X5) desde `/portal/ejemplos` | Única búsqueda de modelo con impresiones y sin página. Es del dueño: no requiere código |
| 5 | Reforzar `/comprar` (6.3) y preguntas en `/vender` (6.4) | Es donde ya hay impresiones y no hay clics |
| 6 | Decidir si va una página `/tasacion` aparte (6.4) | Búsqueda propia con el sitio en el puesto 50; decisión del dueño |
| 7 | Preguntas en `/calculadora` y `/escaneo` | Mejoras sobre páginas que ya responden bien |
| 8 | Decidir la búsqueda local (6.6) | Necesita decisión del dueño |
| 9 | Revisar Rendimiento el 24 de noviembre | Con dos semanas de datos de las páginas nuevas |

Hecho ya y fuera de esta lista: el título de la portada con "Autos de lujo en Lima" al frente (commit `340ffba`, en producción).

**Expectativa honesta.** Cuatro días de datos no son una tendencia. Lo que sí es seguro: la marca ya posiciona, "autos de lujo" ya muestra el sitio en primera página sin que la página esté preparada, y la importación se medirá recién cuando Google indexe lo publicado hoy. Nadie garantiza el primer puesto.

---

## 8. Todas las variantes de búsqueda, servicio por servicio

Cada grupo tiene una sola página responsable. Las variantes mezclan sinónimos ("auto", "carro", "vehículo", "camioneta"), origen ("USA", "Estados Unidos", "EE.UU.", "Miami"), lugar ("Lima", "Perú"), orden de palabras y tildes; Google trata "importación" e "importacion" como lo mismo, así que no se listan por separado. Entre paréntesis, la posición medida hoy cuando la hay.

### 8.1 Importación a pedido

| Grupo | Variantes | Página |
|---|---|---|
| A pedido | importación de autos a pedido · importación de autos a pedido perú · importar auto a pedido · autos a pedido desde estados unidos · importación directa de autos | `/importar` |
| Origen | importar auto de usa a perú · importar carro de estados unidos a perú · importar vehículo de eeuu · importar auto de miami a perú · traer auto (carro) de estados unidos a perú · importar camioneta de estados unidos · autos americanos importados | `/importar` |
| Genéricas | importación de autos a perú · importación de vehículos perú · importadora de autos americanos perú · importadores de autos de lujo lima · importación de autos de lujo (puesto 5, con la portada) · empresas importadoras de autos en perú | `/importar` |
| Proceso | cómo importar un auto a perú · importar auto paso a paso · proceso de importación de vehículos · cuánto demora importar un auto · vale la pena importar un auto de estados unidos | `/como-funciona` |
| Costo | cuánto cuesta importar un auto (carro) a perú · cuánto cuesta nacionalizar un auto en perú · impuestos para importar un auto · cuánto cobran por traer un carro de estados unidos | `/guias/cuanto-cuesta-importar-un-auto-a-peru` |
| Requisitos | requisitos para importar un auto a perú 2026 · qué autos se pueden importar · qué vehículos no se pueden importar · importar auto usado antigüedad máxima · importación de vehículos usados sunat (puesto 100) | `/guias/requisitos-para-importar-un-auto-a-peru` |
| Arancel | ad valorem 0 autos estados unidos · arancel autos usa perú · certificado de origen tlc vehículos | `/guias/ad-valorem-0-autos-estados-unidos` |
| ISC | isc vehículos perú 2026 · isc autos · impuesto selectivo al consumo vehículos · diferencia igv e isc | `/guias/isc-vehiculos-peru` |
| Modelo | importar [modelo] a perú · cuánto cuesta importar una [modelo] · [modelo] precio perú · [modelo] en perú 2026 · [modelo] 0 km perú · tesla model y precio perú (puesto 10, sin página) | `/importar/<modelo>` |

### 8.2 Calculadora

| Variantes | Página |
|---|---|
| calculadora importación de autos perú · calculadora de importación de vehículos · calculadora impuestos importación auto · calcular impuestos importación vehículo perú · simulador importación autos sunat · simulador de impuestos vehículos · cuánto pagaría de impuestos por importar un carro · cotizar importación de auto · cotización importar auto de usa a perú · calculadora aduanas vehículos perú · calculadora ad valorem isc igv auto | `/calculadora` |

### 8.3 Compra de stock en Lima

| Variantes | Página |
|---|---|
| autos de lujo lima · autos de lujo en lima (puesto 11) · autos de lujo perú (9) · comprar autos de lujo (13) · comprar auto de lujo lima · autos de lujo en venta lima · carros de lujo lima · carros de lujo en perú (9) · camionetas de lujo lima (88) · camionetas de lujo en venta · autos de alta gama lima · autos premium lima · autos exclusivos lima (91) · venta de autos usados de lujo lima (19) · seminuevos de lujo lima · autos deportivos en venta lima · autos americanos en venta lima · autos importados en venta lima · concesionario autos de lujo lima · tienda de autos de lujo san isidro | `/comprar` |
| [marca modelo año] en venta lima · [marca] en venta lima | `/comprar/<ficha>` (y páginas por marca cuando haya stock) |

### 8.4 Venta, consignación y tasación

| Grupo | Variantes | Página |
|---|---|---|
| Vender | vender mi auto en lima · vender mi carro lima · vender mi auto rápido · vender auto de lujo lima · vender mi camioneta lima · vender auto sin exclusividad · dónde vender mi auto usado lima | `/vender` |
| Consignación | consignación de autos lima · vender mi auto en consignación · autos en consignación lima · consignación de vehículos perú · venta por consignación de autos | `/vender` |
| Tasación | tasación de autos lima · tasar mi auto (50) · tasación vehicular gratis · cuánto vale mi auto · cotizar mi auto gratis perú (65) · cotización de mi auto usado · valorización de autos perú · avalúo vehicular lima · precio de mi auto usado | `/vender` hoy; `/tasacion` si se aprueba (6.4) |

### 8.5 Escaneo pre-compra

| Grupo | Variantes | Página |
|---|---|---|
| Escaneo | escaneo de autos usados lima · escaneo de auto antes de comprar · escanear auto lima · escaneo vehicular a domicilio · scanner automotriz lima · scanner automotriz a domicilio · escáner automotriz a domicilio lima · cuánto cuesta escanear un auto en perú | `/escaneo` |
| Revisión | revisión pre compra auto lima · revisión precompra · inspección precompra vehicular · inspección de auto usado antes de comprar · inspección vehicular antes de comprar · revisión de autos usados antes de comprar · diagnóstico automotriz a domicilio · verificar auto usado antes de comprar | `/escaneo` |
| No usar | peritaje vehicular · revisión mecánica: el servicio es diagnóstico electrónico y visual, no inspección de taller; prometerlo sería engañar | — |

### 8.6 Portada y marca

| Variantes | Página |
|---|---|
| luxcars · lux cars · luxcars perú · lux car (puesto 1,7) · luxe car · luccar · autos de lujo en lima (la genérica donde ya aparece la portada) | `/` |

### 8.7 Búsqueda local (servicio pendiente, sin página)

| Variantes | Página |
|---|---|
| busco un [modelo] en lima · [modelo] en venta lima/perú (ej. land cruiser 300 peru, puesto 9) · comprar auto usado verificado lima · encontrar auto en perú · auto a pedido en perú sin importar | Sección en `/comprar` o `/buscamos-tu-auto` si el dueño lo aprueba (6.6) |

**Reglas de redacción que salen de aquí:** usar "carro", "camioneta" y "vehículo" además de "auto"; "Estados Unidos" en títulos y "USA / EE.UU. / Miami" en preguntas y párrafos; "Lima" en lo local y "Perú" en importación; la respuesta en el primer párrafo, porque siete de cada diez impresiones son en móvil.

---

## 9. Por qué Altagamma sale primera (recogido de la sesión principal y de la sección 10.5 del análisis)

Verificado el 10 de noviembre en Google Perú sin personalizar. Altagamma es puesto 1 en "autos de lujo", "autos de lujo lima" e "importacion de autos de lujo" con su portada, titulada "Altagamma – Autos de Lujo". No aparece en "importación de autos" ni en "importación de autos a pedido". LuxCars: puesto 5 en "importacion de autos de lujo" (portada), 11 en "autos de lujo lima" (`/comprar`), y sale en la Visión general de IA de ambas búsquedas.

Su sitio es técnicamente flojo: la página de importación tiene 75 palabras, H1 vacío, sin descripción ni JSON-LD; la portada, 195 palabras y cero datos estructurados. **Gana por autoridad, no por contenido:**

| Factor | Altagamma | LuxCars |
|---|---|---|
| Ficha de Google Business | San Isidro, 4,7 con 18 reseñas; entra al pack local de "comprar autos de lujo en lima" junto a Autosell (4,3 / 50), Autos Exclusivos (4,4 / 33), Iconic Cars (3,0 / 6) y Auto Traders (5,0 / 1) | Sin ficha |
| Fichas de autos indexadas | 59, más 22 páginas de marca; unas 417 URLs en el índice | 0 fichas; unas 25 URLs |
| Antigüedad y marca | Dominio en línea desde al menos 2018; "40 años de trayectoria" | Marca nueva |
| Redes y directorios | Facebook 13 700 seguidores, Instagram unos 49 mil, blog, nombre‑dirección‑teléfono idénticos en web, redes y Cylex | Recién empezando |

**Qué hacer con esto (para el dueño):** crear y verificar la ficha de Google Business (Dionisio Derteano 184, Of. 1102, San Isidro; categorías Concesionario de automóviles, Importador e Inspección de vehículos), pedir una reseña a cada cliente, mantener nombre, dirección y teléfono idénticos en todos los perfiles y directorios, un video por semana (los TikTok y Facebook de la competencia salen en los resultados), publicar stock como fichas, y añadir `sameAs` al JSON-LD cuando existan los perfiles. Donde LuxCars ya es mejor, la importación (calculadora, modelos, guías), no hay nada que copiarles.

---

## 10. Búsqueda → página → cambio aplicado

Estado al cierre del 10 de noviembre por la noche. Todos los commits citados están en `master` y desplegados: los títulos nuevos se leyeron en `www.luxcars.pe` con `curl` antes de cerrar este documento. "Reindexación pendiente" quiere decir que Google aún no ha vuelto a leer la página; se pide el 11 de noviembre (sección 4).

| Búsqueda (grupo) | Página | Cambio aplicado | Estado |
|---|---|---|---|
| importación de autos a pedido · importar auto de estados unidos (usa, miami) a perú · importar camioneta | `/importar` | Título y H1 "Importación de autos a pedido desde Estados Unidos a Perú"; descripción y primer párrafo con "auto o camioneta", "Miami o cualquier estado de EE.UU.", "puesto en Lima"; cuatro preguntas frecuentes con las palabras de la búsqueda (commit `694911a`) | En producción. Reindexación pendiente (cuota) |
| cómo importar un auto a perú · paso a paso · cuánto demora | `/como-funciona` | H1 con "Cómo importar un auto a Perú" (hecho antes, `0f8cf72`) | En producción; indexación pedida hoy |
| cuánto cuesta importar / nacionalizar · requisitos · ad valorem 0 · isc | Las cuatro guías | Guías nuevas (`f6f1e94`) | En producción; costo pedida hoy, las otras tres mañana |
| importar [modelo] a perú · [modelo] precio perú | `/importar/<modelo>` | Nueve páginas de modelo (`14ff486` y anteriores) | En producción; 7 pedidas hoy, 2 mañana. Falta crear Tesla Model Y desde el portal |
| calculadora importación de autos perú · simulador · calcular impuestos sunat · cotizar importación | `/calculadora` | Página propia (hecha antes); descripción nueva con "simulador", "impuestos SUNAT", "auto o carro de Estados Unidos" (`4edc79f`) | En producción; indexación pedida hoy antes del cambio de descripción, volver a pedir mañana |
| comprar autos de lujo en lima · autos (carros, camionetas) de lujo lima/perú · alta gama · seminuevos · en venta | `/comprar` | Título "Comprar autos de lujo en Lima · Stock de alta gama disponible"; H1 con etiqueta "Comprar autos de lujo en Lima" y titular "Autos de alta gama disponibles hoy en Lima"; descripción y párrafo con "carros, camionetas y deportivos de lujo seminuevos en venta en San Isidro" (`4edc79f`) | En producción. Reindexación pendiente. Fichas demo retiradas del buscador hoy |
| [marca modelo] en venta lima | `/comprar/<ficha>` | Fichas demo con `noindex` (`4edc79f`); eliminación temporal del prefijo `comprar/demo-` en Search Console | Hecho. Falta publicar stock real (Corvette 2027) |
| vender mi auto (carro, camioneta) en lima · consignación de autos lima · tasar mi auto · cuánto vale mi auto | `/vender` | Título "Vender mi auto en Lima · Consignación y tasación sin exclusividad"; descripción y párrafo con "auto usado, camioneta o carro de lujo", "tasación gratuita", "consignación" (`4edc79f`); H1 con "Consignación y tasación de autos en Lima" (hecho antes) | En producción. Reindexación pendiente. `/tasacion` sigue como propuesta para el dueño |
| escaneo de autos usados lima · scanner automotriz a domicilio · revisión / inspección precompra | `/escaneo` | Título "Escaneo de autos usados en Lima antes de comprar · Inspección precompra"; descripción con "revisión de autos usados antes de comprar", "escáner automotriz"; párrafo con "inspección precompra a domicilio, con diagnóstico electrónico y visual" (`4edc79f`, `2c1f60e`) | En producción. Reindexación pendiente |
| luxcars · lux car · luxe car · autos de lujo en lima | `/` | H1 con "Autos de lujo en Lima, Perú" (hecho antes); título "Autos de lujo en Lima · Importación, compra y venta" y descripción con "stock de alta gama en San Isidro, importación a pedido desde Estados Unidos y venta en consignación" (`340ffba`) | En producción. Reindexación pendiente (cuota) |
| [marca] en venta lima · importar [marca] | `/importar/marca/<marca>` | Páginas por marca en construcción por la otra sesión (`cd15171`); solo existen con autos de esa marca | Pedir indexación y reenviar el sitemap cuando estén listadas |
| busco un [modelo] en lima · [modelo] en venta perú | Sin página | Nada todavía: decisión del dueño sobre la búsqueda local | Propuesta (6.6) |
