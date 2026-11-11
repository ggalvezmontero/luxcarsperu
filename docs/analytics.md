# Google Analytics 4 en luxcars.pe

Cómo está montado, qué eventos manda el sitio y qué marcar en GA4.

## Cómo funciona

- **Carga:** `src/components/GoogleAnalytics.tsx`, montado en `src/app/layout.tsx`. Usa `GoogleAnalytics` de `@next/third-parties/google`, que es lo que recomienda la guía de la versión de Next instalada (`node_modules/next/dist/docs/01-app/02-guides/third-party-libraries.md`).
- **Solo en producción:** la etiqueta se incluye únicamente si existe `NEXT_PUBLIC_GA_MEASUREMENT_ID` y el build es de producción. En `next dev` nunca carga.
- **Solo con consentimiento:** el banner de cookies (`src/components/CookieBanner.tsx`) guarda la decisión en `localStorage` con la clave `luxcars-cookie-consent`. Hasta que valga `accepted` no se inyecta ningún script y no sale ninguna petición a `googletagmanager.com` ni a `google-analytics.com`. Al pulsar "Aceptar" la etiqueta se carga en ese momento, sin recargar. "Rechazar" deja el sitio sin rastreo.
- **Consent Mode v2:** antes de que cargue `gtag.js` se declara `consent default` con `analytics_storage`, `ad_storage`, `ad_user_data` y `ad_personalization` en `denied`, y acto seguido `consent update` concede solo `analytics_storage`. El sitio no hace publicidad, así que los tres permisos de anuncios quedan denegados siempre.
- **Vistas de página:** las manda GA4 solo, también en navegaciones internas (cambios de historial). Requiere tener activa la medición mejorada (ver más abajo).
- **Helpers:** `src/lib/analytics.ts` expone `trackEvent(nombre, parámetros)`. Es seguro llamarlo siempre: si GA no está cargado no hace nada. Todo parámetro lleva además `page_path` automático.

## Variable de entorno

| Variable | Dónde | Valor |
| --- | --- | --- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Vercel → proyecto `luxcarspe` → Settings → Environment Variables, entornos **Production** y **Preview** | El ID de medición del flujo web, formato `G-XXXXXXXXXX` |

Estado (2026-11-10): la propiedad GA4 ya existe (cuenta "Google Ads Account", propiedad `luxcars.pe`, flujo web `luxcars.pe`, ID `G-1CH51Z0FD8`) y la variable ya está creada en Vercel con ese valor para Production y Preview. Como las variables `NEXT_PUBLIC_*` se incrustan en build, empieza a medir con el **primer despliegue** que incluya este código. No ponerla en Development: en local no se quiere mandar datos.

## Eventos

Nombres en `snake_case`, en inglés como los eventos recomendados de GA4. Los parámetros van con prefijo por entidad. Cada evento lleva siempre `page_path`.

### Contacto (los que valen como conversión)

| Evento | Cuándo | Parámetros | Dónde se dispara |
| --- | --- | --- | --- |
| `whatsapp_click` | Clic en cualquier enlace a `wa.me` | `cta` (etiqueta del botón, ver tabla de CTAs) | Listener global en `GoogleAnalytics.tsx` |
| `contact_form_submit` | Formulario de contacto de la portada validado y WhatsApp abierto | `with_estimate` (adjuntaba un cálculo), `preferred_plan` (`fast`/`standard`), `with_email` | `ContactSection.tsx` |
| `valuation_form_submit` | Formulario de tasación de `/vender` validado y WhatsApp abierto | `vehicle_brand`, `vehicle_model`, `vehicle_year`, `vehicle_condition` | `app/vender/FormularioTasacion.tsx` |
| `phone_click` | Clic en un enlace `tel:` (hoy no hay ninguno; queda cubierto) | `cta` | Listener global |
| `email_click` | Clic en un enlace `mailto:` | `cta` | Listener global |

### Calculadora de importación

| Evento | Cuándo | Parámetros |
| --- | --- | --- |
| `calculator_model_change` | El visitante elige un modelo en el selector (cambiar solo la marca no cuenta) | `vehicle_brand`, `vehicle_model` |
| `calculator_estimate` | La calculadora produjo un estimado completo. Como calcula en vivo, se espera 1,5 s sin cambios y se manda una vez por combinación de auto, precio, plan y condición | `vehicle_brand`, `vehicle_model`, `vehicle_year`, `vehicle_condition`, `plan`, `price_usd`, `final_estimate_usd` |
| `calculator_pdf_download` | Descargó el PDF del estimado | `vehicle_brand`, `vehicle_model`, `vehicle_year` |
| `calculator_share` | Pulsó "Compartir" el estimado | `share_code` |

### Navegación comercial

| Evento | Cuándo | Parámetros |
| --- | --- | --- |
| `stock_card_click` | Clic en una tarjeta del stock (portada y `/comprar`) | `vehicle_id`, `vehicle_brand`, `vehicle_model`, `vehicle_status` |
| `cta_click` | Clic en un botón marcado con `data-ga-cta` que no es WhatsApp, teléfono ni correo | `cta`, `href` |

### Etiquetas `cta`

Los botones llevan `data-ga-cta="…"`. Los de WhatsApp salen como `whatsapp_click` con esa etiqueta; el resto como `cta_click`. Si un enlace a WhatsApp no tiene etiqueta, se usa su texto visible.

| Página | Etiquetas |
| --- | --- |
| Portada | `portada_hero_stock`, `portada_hero_calculadora`, `portada_importacion_proceso`, `portada_consignacion_publicar`, `portada_consignacion_tasar`, `portada_banda_escaneo`, `contacto_whatsapp_directo`, `contacto_correo` |
| Calculadora | `calculadora_asesoria_whatsapp`, `calculadora_bloqueada_whatsapp`, `calculadora_enviar_estimado_whatsapp` |
| `/importar` | `importar_portada_calculadora`, `importar_portada_proceso`, `importar_tasas_calculadora`, más la banda de cierre |
| `/vender` | `vender_portada_publicar`, `vender_portada_tasar`, `vender_portada_whatsapp` |
| `/escaneo` | `escaneo_portada_agendar_whatsapp`, `escaneo_portada_que_revisamos`, más la banda de cierre |
| `/comprar/<auto>` | `vehiculo_whatsapp`, `vehiculo_parte_de_pago` |
| Banda de cierre (`CtaBand`, en varias páginas) | `banda_cierre_whatsapp`, `banda_cierre_secundario` (la página la da `page_path`) |
| Navegación y pie | `navbar_whatsapp`, `menu_movil_whatsapp`, `footer_whatsapp`, `footer_correo` |

### Añadir un evento nuevo

1. Añadir el nombre a `GA_EVENTS` en `src/lib/analytics.ts`.
2. Llamar a `trackEvent(GA_EVENTS.xxx, { … })` desde el componente (tiene que ser de cliente), o, si es un enlace en un componente de servidor, ponerle `data-ga-cta`.
3. Apuntarlo en este archivo.

## Qué hacer en GA4 (una sola vez)

1. **Propiedad:** ya existe (ver arriba). Si alguna vez hay que crear otra: Administrar → Crear → Propiedad, zona horaria `Perú (GMT-5)`, moneda `USD`, plataforma Web con la URL `https://www.luxcars.pe`.
2. **Medición mejorada:** hecho y comprobado el 2026-11-10. Está activada y dentro de "Page views" la casilla **"Page changes based on browser history events"** está marcada, así que las navegaciones internas cuentan como vista de página. Si se revisa: Administrar → Data streams → `luxcars.pe` → rueda de Enhanced measurement.
3. **Marcar conversiones (eventos clave).** PENDIENTE hasta el 2026-11-11: en esta versión del panel (Administrar → Data display → Events) no se pueden crear eventos clave por nombre; un evento se marca con la **estrella** de su fila, y la fila aparece hasta 24 h después del primer envío. Los primeros envíos (`whatsapp_click`, `cta_click`, `contact_form_submit`, `valuation_form_submit`) se hicieron el 2026-11-10 desde el Preview de Vercel y ya se vieron en Tiempo real. Cuando aparezcan:
   - Marcar con la estrella: `whatsapp_click`, `contact_form_submit`, `valuation_form_submit`.
   - Opcional, como "casi conversión": `calculator_estimate`, `calculator_pdf_download`, `stock_card_click`.
   - No marcar `cta_click` ni `calculator_model_change`: son de navegación y ensuciarían la tasa de conversión.
4. **Dimensiones personalizadas** (para poder filtrar informes por ellas): Administrar → Definiciones personalizadas → Crear dimensión personalizada, ámbito Evento, una por parámetro: `cta`, `vehicle_brand`, `vehicle_model`, `vehicle_status`, `plan`, `vehicle_condition`. Y métricas personalizadas para `price_usd` y `final_estimate_usd` (unidad: moneda). Sin esto GA4 recibe los parámetros pero no los muestra en los informes estándar.
5. **Retención de datos:** Administrar → Retención de datos → 14 meses (el valor por defecto es 2).
6. **Vincular Search Console:** HECHO el 2026-11-10. Vínculo entre la propiedad de dominio `luxcars.pe` de Search Console y el flujo web `luxcars.pe`, creado por `info@luxcars.pe`. Para que fuera posible, `gianfranco.galvez8@gmail.com` (propietaria verificada en Search Console) añadió a `info@luxcars.pe` como propietaria delegada en Search Console → Ajustes → Usuarios y permisos. Para ver consultas y páginas de Google dentro de GA4: Informes → Biblioteca → publicar la colección "Search Console".
7. **Excluir el tráfico propio:** Administrar → Flujos de datos → flujo web → Configurar ajustes de etiquetas → Definir tráfico interno, con la IP de la oficina; luego Administrar → Filtros de datos → activar el filtro "Internal Traffic".

## Comprobar que funciona

1. Abrir `https://www.luxcars.pe` en una ventana privada y, en las herramientas del navegador, pestaña Red, filtrar por `google`: **no debe aparecer nada** hasta pulsar "Aceptar" en el banner.
2. Pulsar "Aceptar": aparecen `gtag/js?id=G-…` y una petición `collect?v=2…` (vista de página).
3. Hacer clic en un botón de WhatsApp: aparece otra `collect` con `en=whatsapp_click`.
4. En GA4 → Informes → Tiempo real, en menos de un minuto se ve el usuario activo, la página y los eventos por nombre. Para verlos con parámetros, instalar la extensión "Google Analytics Debugger" de Chrome y abrir Administrar → DebugView.
