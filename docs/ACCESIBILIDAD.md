# Accesibilidad — auditoría, correcciones y pendientes

Auditoría del sitio público y del portal interno contra **WCAG 2.1 nivel AA**.
Última revisión: **15 de septiembre de 2026**.

Todo lo que dice este documento se comprobó en el navegador con el sitio
corriendo, no leyendo el código. Las mediciones de contraste salen de la fórmula
WCAG 2.1 aplicada a los valores reales de los tokens; las de foco y orden de
tabulación, de enfocar cada control y preguntarle al DOM quién quedó activo.

---

## Resultado de la pasada automática final

Diez rutas, cada una revisada con el sitio servido: un solo `h1`, sin saltos de
nivel, `alt` en todas las imágenes, nombre accesible en todos los controles,
`label` real en todos los campos, sin `aria-controls` colgando y **sin ningún
elemento que reciba el foco sin ser visible**.

| Ruta | Encabezados | Problemas |
|---|---|---|
| `/` | 36 | 0 |
| `/comprar` | 15 | 0 |
| `/importar` | 23 | 0 |
| `/vender` | 16 | 0 |
| `/como-funciona` | 31 | 0 |
| `/faq` | 7 | 0 |
| `/cookies` | 19 | 0 |
| `/privacidad` | 17 | 0 |
| `/terminos` | 16 | 0 |
| `/portal/login` | 1 | 0 |

Antes de las correcciones, `/` y las otras nueve rutas daban **seis fallos de
foco fantasma cada una** (el menú móvil, ver más abajo).

---

## 1. Contraste de color — dos tokens no cumplían

La cabecera de `src/app/globals.css` afirmaba que todos los pares verificaban AA.
Era falso. Medido contra `surface-3` (`#232327`), el fondo más claro sobre el que
se pintan y por tanto el peor caso:

| Token | Antes | Después | Mínimo exigido | Regla |
|---|---|---|---|---|
| `--color-ink-4` | `#787880` · **3.58:1** | `#898991` · **4.51:1** | 4.5:1 | 1.4.3 texto |
| `--color-ink-3` | `#8E8E96` · 4.82:1 | `#9E9EA6` · **5.89:1** | 4.5:1 | 1.4.3 texto |
| `--color-line-strong` | `#5D5D62` · **2.39:1** | `#6D6D72` · **3.04:1** | 3:1 | 1.4.11 no textual |

**Por qué importa `ink-4`.** Tiene unos 140 usos y casi siempre en texto de 10 u
11 px: notas al pie, etiquetas de campo, leyendas de precio. Ese tamaño no
califica como "texto grande", así que el umbral aplicable es 4.5:1 sin excepción.
A 3.58:1 era texto legalmente inaccesible en toda la superficie del sitio.

**Por qué se movió también `ink-3`, que ya pasaba.** Al subir `ink-4` hasta el
mínimo AA, los dos grises quedaban en 4.82 y 4.51: indistinguibles a ojo. La
escala documentada de cuatro pesos se derrumbaba a tres y el equipo habría
"arreglado" la ambigüedad volviendo a oscurecer `ink-4`. Subir `ink-3` mantiene
el escalón. La escala sobre `surface` queda **9.48 / 7.03 / 5.39**.

**Por qué `line-strong` va a 3:1 y no a 4.5:1.** Es el borde de inputs y botones
delineados, no texto: WCAG 1.4.11 pide 3:1 al límite que identifica un control.
A 2.39:1 el borde del input contra su propio relleno era prácticamente
invisible; el campo no se distinguía del fondo de la tarjeta.

`ink-4` quedó **exactamente en el mínimo**. Está anotado en el CSS: no se puede
oscurecer ni un punto.

### Pares verificados que sí cumplían y no se tocaron

Sobre los cinco fondos (`void`, `bg`, `surface`, `surface-2`, `surface-3`):
`ink` 15.66–20.38 · `ink-2` 7.93–10.32 · `silver` 8.61–11.20 · `silver-bright`
12.81–16.68 · `silver-dim` 4.57–5.95 · `gold` 7.45–9.69 · `gold-bright`
9.18–11.95 · `ok` 8.99 · `warn` 9.38 · `danger` 5.66 · `info` 9.39 (peor caso
cada uno). Texto `void` sobre los acentos sólidos (`silver`, `gold`, semánticos):
7.37 el más bajo. Todo AA.

`gold-dim` (`#9A761F`) da 3.72:1 sobre `surface-3` y **no cumpliría como texto**.
Hoy no se usa como texto en ningún sitio (cero ocurrencias de `text-gold-dim`).
Si alguien lo usa algún día, solo vale sobre `bg` o `void`, y aun así justo.

---

## 2. Foco — los dos sitios donde se rompía

### 2.1 Menú móvil: seis paradas invisibles en cada página

**El fallo.** `#mobile-menu` se colapsa con `max-h-0 opacity-0
pointer-events-none` dentro de un `overflow-hidden`. Ninguna de esas tres
propiedades saca un elemento del orden de tabulación: `opacity: 0` no lo hace,
`max-height: 0` con `overflow: hidden` tampoco, y `pointer-events: none`
desactiva el ratón, nunca el teclado.

Comprobado a 375 px con el menú **cerrado**: `visibility: visible`, y los seis
enlaces reciben el foco. En móvil, quien navega con teclado o con un conmutador
atravesaba seis paradas con el anillo de foco puesto sobre la nada, en todas las
páginas. Incumple 2.4.3 (orden del foco) y 2.4.7 (foco visible).

**Lo que se hizo.** `Navbar.tsx` pertenece a otro equipo en esta sesión y no se
podía tocar, así que el parche va en `globals.css`, acotado al estado cerrado:

```css
#mobile-menu.pointer-events-none { visibility: hidden; }
```

`visibility: hidden` sí saca a los descendientes del orden de tabulación. La
regla solo aplica mientras el contenedor lleva `pointer-events-none`, que es
exactamente su estado cerrado; al abrirse, Navbar cambia esa clase por
`pointer-events-auto` y la regla deja de aplicar sola.

No se declara ninguna transición propia a propósito: el div ya lleva
`transition-all duration-300`, y `visibility` interpola de forma especial —se
mantiene `visible` durante todo el cierre y solo cambia al final—, que es justo
lo que se quiere. Un `transition:` propio pisaría el `transition-property: all`
de Tailwind y mataría la animación de colapso.

Verificado tras el parche: cerrado → no recibe foco; abierto → recibe foco,
`aria-expanded="true"`, 348 px de alto; y el cierre sigue animando (348 → 210 a
mitad → 0, con `visibility: visible` durante toda la animación).

> **PENDIENTE, y es de otro equipo.** Esto es un parche, no el arreglo. Lo
> correcto es el atributo `inert` en el div del menú cuando está cerrado, dentro
> de `src/components/Navbar.tsx`:
>
> ```diff
>   <div
>     id="mobile-menu"
> +   inert={!isMenuOpen}
>     className={cn(...)}
> ```
>
> `inert` saca el subárbol del foco, del árbol de accesibilidad y del ratón de
> una vez, sin depender de una clase utilitaria. **Cuando ese `inert` exista,
> hay que borrar el bloque de `globals.css`**: una regla de CSS acoplada al `id`
> y a una clase de otro componente es deuda, no diseño.

### 2.2 Banner de cookies: el foco se perdía al elegir

**El fallo.** Al pulsar "Aceptar" o "Rechazar", el componente se desmonta, el
botón enfocado desaparece y el navegador manda el foco a `<body>`. La siguiente
tabulación reinicia desde la cabecera de la página en lugar de seguir donde
estabas. Incumple 2.4.3.

**Lo que se hizo** (`src/components/CookieBanner.tsx`):

- Se guarda quién tenía el foco justo antes de que el banner apareciera y se le
  devuelve al cerrar. Si ese elemento ya no existe, el foco va al `<main>`.
  Verificado: tras aceptar, el foco **no** queda en `<body>`.
- `aria-labelledby` / `aria-describedby` apuntando al encabezado y al párrafo
  visibles, en vez de una cadena suelta que se desincroniza al editar el texto.
- Los botones pasan a `min-h-11` (44 px) y llevan sufijo en `sr-only`
  ("Aceptar **las cookies opcionales**"): fuera de contexto, una lista de
  enlaces y botones mostraba solo "Aceptar" / "Rechazar".
- `type="button"` explícito, y fuera los `console.log`.

**Decisiones deliberadas, no olvidos:**

- **No se roba el foco al aparecer.** El banner se monta un segundo después de
  cargar; llevar el foco ahí por sorpresa interrumpiría a quien ya está leyendo
  o escribiendo (3.2.5). Se anuncia como región con nombre y queda al final del
  orden de tabulación, que es donde también está visualmente.
- **No se cierra con Escape.** Escape tendría que significar "aceptar" o
  "rechazar" y ninguna de las dos es una lectura honesta de una tecla de
  descarte. El consentimiento tiene que ser explícito.
- **No es un diálogo modal**: no atrapa el foco ni bloquea la página.

---

## 3. Saltar al contenido (WCAG 2.4.1, nivel A) — no existía

Todas las páginas públicas empiezan con la Navbar: entre 6 y 8 tabulaciones
(logo, cinco enlaces, CTA y en móvil el hamburguesa) antes del contenido, en cada
página. Sin enlace de salto eso es un incumplimiento de **nivel A**, el más
básico, y era el fallo de más impacto diario del sitio.

Nuevo: `src/components/SkipLink.tsx`, montado como primer hijo de `<body>` en
`src/app/layout.tsx`.

Dos detalles que lo hacen funcionar de verdad:

- **Busca el `<main>` en tiempo de ejecución** en vez de apuntar a un `id` fijo.
  Cada página declara su propio `<main>` y ninguno tenía `id`; esos archivos son
  de otro equipo. El componente localiza el `<main>`, le pone el `id` y el
  `tabindex="-1"` que necesita, y respeta un `id` propio si algún día se lo
  ponen.
- **Mueve el foco con JS, no solo con el hash.** Un `href="#x"` mueve el scroll
  pero en varios navegadores no mueve el foco del teclado si el destino no es
  enfocable: saltas visualmente y la siguiente tabulación te devuelve a la
  navbar.

Verificado: es el primer elemento enfocable del documento, se hace visible al
recibir foco con su anillo, y al activarlo el foco queda en
`<main id="contenido-principal" tabindex="-1">`.

---

## 4. `focus:outline-none` — tres sitios lo anulaban

El anillo de foco global de `globals.css` estaba siendo pisado.

| Archivo | Qué quedaba como indicador |
|---|---|
| `src/components/ContactSection.tsx` | `focus:border-silver-bright`, 1 px de borde |
| `src/components/portal/PortalLoginForm.tsx` (×2) | `focus:border-line-strong`, 1 px de gris |

Un cambio de color en un borde de 1 px no llega al indicador de foco visible que
exige 2.4.7, y desaparece por completo en modo de alto contraste. En la pantalla
de acceso era especialmente grave: no se sabía en qué campo se escribía.

Se quitó `focus:outline-none` en los tres. El cambio de borde se conserva como
refuerzo visual. Verificado con tabulación real en `/portal/login`: el campo
recibe `outline: solid 2px rgb(232,232,236)` con 2 px de separación.

> **PENDIENTE, y es de otro equipo.** Queda uno sin corregir:
> `src/app/vender/FormularioTasacion.tsx:67` tiene `focus:outline-none` en la
> clase compartida de sus campos, y ese directorio está fuera de mi alcance. Es
> el mismo fallo 2.4.7, en el formulario de tasación. Se arregla borrando esas
> dos palabras de la cadena: no hay nada más que hacer.

---

## 5. Estados y grupos sin nombre — ARIA que faltaba o estorbaba

### Calculadora (`src/components/CalculatorSection.tsx`)

- **`aria-pressed` faltaba en dos grupos de botones**: "Tipo de vehículo & ISC"
  (5 botones) y "Plan estimado de entrega" (2). El botón elegido se distinguía
  solo por color de borde y fondo, así que con lector de pantalla no había forma
  de saber qué estaba seleccionado (1.3.1 / 4.1.2). El grupo "Condición" sí lo
  tenía: la inconsistencia era el indicio.
- **Los tres grupos no tenían nombre.** "Condición", "Tipo de vehículo & ISC" y
  "Plan estimado de entrega" eran texto suelto en un `<div>`: se veían como
  etiqueta pero no lo eran para nadie más. Ahora son `role="group"` +
  `aria-labelledby` apuntando al texto visible.
- **El error de validación era mudo.** Sin `role="alert"`, pulsar "Calcular" con
  el formulario incompleto pintaba un mensaje rojo que no se anunciaba (3.3.1).
- **El cambio de vista perdía el foco.** El formulario y los resultados no
  conviven: al calcular, el formulario entero se desmonta y el botón enfocado
  desaparece con él. El foco iba a `<body>`, y con lector de pantalla no se
  anunciaba nada — la persona no se enteraba de que el cálculo estaba hecho.
  Ahora el foco va al panel de resultados (`tabIndex={-1}`, `role="group"`,
  `aria-label="Resultado del estimado de importación"`) y vuelve al formulario
  con "Nueva Simulación". El efecto se salta el primer render para no robar el
  foco al cargar la página. Verificado: `aria-pressed="true"` y foco en el panel
  de resultados, no en `<body>`.

### Tooltip (`src/components/Tooltip.tsx`)

- **`aria-expanded` era el atributo equivocado**: describe un widget de
  divulgación (acordeón, desplegable) que revela contenido del flujo. Un tooltip
  no lo es; el lector anunciaba "contraído/expandido" sobre un control que no
  expande nada. Fuera.
- **`aria-describedby` era el correcto y no estaba**: el texto del tooltip no
  estaba asociado de ninguna forma con su disparador.
- **El nombre accesible era el párrafo entero.** `aria-label={content}`
  convertía todo el texto explicativo en el nombre del botón: en una lista de
  controles aparecía un párrafo de tres líneas como etiqueta. Ahora el nombre es
  "Más información" y el párrafo va de descripción.
- **La descripción vive siempre en el DOM**, no solo cuando el tooltip está
  abierto. Si solo existiera al abrirse, el lector ya habría calculado la
  descripción del botón al recibir el foco y se quedaría sin ella: la asociación
  llegaría un render tarde. El panel visible lleva `aria-hidden` para que el
  texto no se anuncie dos veces.

### Formulario de contacto (`src/components/ContactSection.tsx`)

- `role="group"` + `aria-labelledby` para "Plan preferido", que era texto suelto.
- `autoComplete` en nombre, teléfono y email, y `type`/`inputMode` correctos
  (1.3.5 Identify Input Purpose).
- `aria-required` y `aria-invalid` en los dos campos obligatorios.
- **El foco va al campo que falta** cuando la validación falla. Con `role="alert"`
  el mensaje se anunciaba, pero el foco se quedaba en "Enviar", al final del
  formulario: había que retroceder a ciegas hasta encontrar el campo vacío.

> Nota de criterio: **no** se añadió `required` nativo. Habría disparado la
> validación del navegador antes que `handleSubmit`, saltándose el flujo de
> error propio del componente. Una auditoría de accesibilidad no debe cambiar en
> silencio el comportamiento de un formulario; `aria-required` comunica lo mismo
> sin tocar la lógica.

---

## 6. Portal interno

### Formulario de alta de vehículo (`.../vehiculos/nuevo/VehiculoForm.tsx`)

Los campos se marcaban `aria-invalid` pero **el motivo del error no estaba
asociado a nada**: un lector decía "no válido" y no tenía forma de leer por qué,
porque el mensaje era un `<p>` suelto debajo (3.3.1). El texto de ayuda sufría lo
mismo: se veía pero no se leía junto al campo.

`PieCampo` ahora lleva `id` y `role="alert"` cuando es error, y los cuatro tipos
de campo (`Campo`, `CampoSelect`, `CampoTextarea`, `CampoMoneda`) lo referencian
con `aria-describedby`.

### Subidor de fotos (`src/components/portal/SubidorFotos.tsx`)

Era la pantalla mejor resuelta de partida: etiquetas `sr-only` por foto,
`aria-label` en las flechas, `role="progressbar"` con sus valores, y flechas como
alternativa de teclado al arrastrar. Se corrigió:

- **Reordenar perdía el foco.** Al mover una foto a la primera o la última
  posición, la flecha recién pulsada se vuelve `disabled`; el navegador quita el
  foco de un elemento deshabilitado y lo manda a `<body>`. En una galería de 12
  fotos eso significa perder el sitio en cada movimiento. Ahora el foco vuelve a
  la flecha equivalente de la foto movida, y si esa quedó deshabilitada, a la
  contraria.
- **El movimiento no se anunciaba.** En pantalla la tarjeta salta de lugar; con
  lector de pantalla no pasaba nada. Se añadió una región viva que dice
  "Foto movida a la posición N de M" y avisa cuando queda como portada.
- `role="alert"` en el error de subida y `role="status"` en los avisos.
- Los glifos `←`, `→` y `×` van en `<span aria-hidden>`.

### Estructura del portal (`PortalShell.tsx`)

Sin fallos. El menú móvil está bien resuelto —renderizado condicional, así que no
deja paradas fantasma— y ya traía `aria-expanded` y `aria-controls`. Es el
contraejemplo directo del menú móvil público.

---

## 7. Lo que ya estaba bien y no se tocó

- **Anillo de foco global** en `globals.css` con `:focus-visible`, sobre
  `silver-bright`: alto contraste y no molesta a quien usa ratón.
- **`prefers-reduced-motion`** respetado en todo el sitio.
- **`<html lang="es-PE">`**.
- **Pie de página**: `aria-hidden` en los SVG decorativos, `aria-label` en los
  enlaces de redes, `alt` correcto en el logo.
- **Jerarquía de encabezados**: un solo `h1` por página y ningún salto de nivel
  en las diez rutas. `SectionHeading` emite `h2` y las tarjetas `h3`, que es lo
  que mantiene el orden.
- **Objetivos táctiles**: los botones ya usaban `min-h-11` / `min-h-12`.

---

## 8. Pendientes

| # | Qué | Dónde | Por qué no se hizo |
|---|---|---|---|
| 1 | `inert` en el menú móvil cerrado, y borrar el parche CSS | `src/components/Navbar.tsx` | Archivo de otro equipo. Parche temporal aplicado en `globals.css`. |
| 2 | Quitar `focus:outline-none` de los campos | `src/app/vender/FormularioTasacion.tsx:67` | Directorio de otro equipo. Fallo 2.4.7 sin corregir. |
| 3 | Que el consentimiento de cookies **gobierne algo** | `CookieBanner.tsx` | No es accesibilidad. Hoy ni "aceptar" ni "rechazar" activan o bloquean nada; el día que haya analítica tiene que leer la clave antes de cargarse o el banner es decorativo. |
| 4 | Revisión con lector de pantalla real | Todo el sitio | Esta auditoría es estática y programática. NVDA/VoiceOver sobre el recorrido completo de compra es la única forma de validar que el resultado se entiende, no solo que los atributos están puestos. |
| 5 | Revisar al zoom 200% y 400% | Todo el sitio | WCAG 1.4.4 y 1.4.10 (reflow) no se comprobaron en esta pasada. |

---

## 9. Hallazgo colateral: el sitio entero devolvía 500

No es accesibilidad, pero salió al intentar levantar el sitio para verificar y
hay que dejarlo escrito porque **vuelve a pasar solo**.

`npm run dev` fallaba en todas las rutas con:

```
./src/app/globals.css:2269:22
Error: Parsing CSS source code failed
  .shadow-\[var\(-J\4 \3 \12 ?ilg\)\] { --tw-shadow: var(-J ilg); }
  Unexpected token Ident("-J")
```

Es exactamente el fallo que ya documenta la cabecera de `globals.css` para los
iconos binarios de `src/app/`: Tailwind v4 rastrea el proyecto buscando clases,
y si encuentra un binario lo lee como texto, extrae basura como nombre de clase
y emite CSS inválido. Eso no rompe una pantalla: **tumba la hoja de estilos
entera y todas las rutas responden 500**.

Los culpables eran tres directorios con caché binaria de Turbopack dentro del
repo, ninguno en `.gitignore`, así que Tailwind los rastreaba:

- `.next-fotos/` — dist alterno de otra sesión
- `tmp/luxbuild-img/` — 84 MB
- `private/tmp/claude-501/...` — 85 MB, una ruta de scratchpad creada en
  relativo por error

Corregido en `.gitignore`, con el patrón genérico `/.next-*/` en vez de
enumerarlos uno a uno —enumerarlos ya falló una vez, que es cómo apareció
`.next-fotos/`— más `/tmp/` y `/private/`. Los 169 MB de `tmp/` y `private/` se
pueden borrar sin consecuencias; no los toqué porque no son míos.

---

## Cómo volver a correr esta auditoría

```bash
# .next es de root en esta máquina: hay que usar un dist alterno (ya ignorado)
NEXT_DIST_DIR=.next-dev PORT=3311 npm run dev
```

Y en la consola del navegador, por cada ruta: comprobar un solo `h1` y cero
saltos de nivel, `alt` en toda `<img>`, nombre accesible en todo `button`/`a`,
`label` asociado en todo campo, y —el que más fallos destapó— **enfocar cada
elemento tabulable y verificar que el que recibe el foco tiene tamaño mayor que
cero**. Esa última comprobación es la que encontró el menú móvil; ninguna
heurística basada en clases CSS lo habría visto.
