# Base de datos — LUX CARS IMPORT S.A.C.

Esquema de Supabase para el **portal de administración** de LuxCars. Lo usan el
dueño y su equipo. El cliente final **nunca crea cuenta**: cotiza, llena
formularios y continúa por WhatsApp.

---

## ⛔ Restricción legal dura sobre el inventario

**Está prohibido guardar en esta base de datos inventario proveniente de:**

> MarketCheck · Auto.dev · eBay / eBay Motors · Autotrader · CarGurus ·
> Cars.com · TrueCar · AutoTempest · Facebook Marketplace

Sus contratos lo prohíben textualmente: *"cache, store, index or otherwise
persist"*, prohibición de **derivative databases**, y borrado obligatorio a las
**6 horas**. Un solo `INSERT` con esos datos es **incumplimiento de contrato**,
con revocación inmediata de la llave de API y exposición legal para la empresa.

Esto **no** es una preferencia de arquitectura ni una optimización pendiente.
No aplica solo a esta base: aplica igual a un job de Vercel Cron, a un índice de
búsqueda, a un archivo JSON commiteado al repo o a un caché "temporal". El
formato no cambia la prohibición — **persistir es persistir**. Y el plazo de 6
horas no vuelve legal el `INSERT`: solo acorta la ventana de incumplimiento.

### La vía legal, que es la que implementa este esquema

1. **Carga manual curada** en el admin, con autocompletado por VIN contra
   **NHTSA vPIC** — API del gobierno de EE.UU., gratuita, sin autenticación y
   sin límite contractual:
   `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json`
   Costo real: ~4 minutos por auto. Se cachea en `vehicle_models`.
2. **Feeds XML de dealers partner**, únicamente con cláusula de licencia
   **firmada** que autorice el almacenamiento y la republicación.

### Cómo lo hace cumplir el motor de base de datos

La columna `vehicles.fuente` es una **lista blanca** (`fuente_inventario`):

| Valor | Significado |
|---|---|
| `carga_manual` | Cargado a mano en el admin |
| `importacion_directa` | Unidad importada por LuxCars a pedido |
| `consignacion` | Unidad de un tercero en consignación |
| `feed_partner_licenciado` | Feed de dealer con licencia **firmada** |

No hay valor posible para "scrapeado de un marketplace". Agregar uno exige
escribir una migración y justificarlo. **Esa fricción es intencional.**

---

## Tablas

| Tabla | Para qué |
|---|---|
| `vehicle_models` | Caché del decodificado de VIN de NHTSA vPIC (ficha técnica, nunca inventario) |
| `vehicles` | Stock propio: VIN, precios, estado, ubicación, publicación |
| `vehicle_photos` | Galería por vehículo, con portada y orden |
| `leads` | Consultas entrantes y embudo comercial |
| `quotes` | Cotizaciones de la calculadora, reproducibles |
| `consignments` | Autos en consignación, **sin exclusividad** |
| `tax_rates` | Tasas tributarias con vigencia y sustento normativo |

### Reglas de negocio que viven en el esquema

- **Sin exclusividad.** `consignments.sin_exclusividad` tiene un `CHECK` que solo
  admite `TRUE`. Cambiarlo exige una migración: es la promesa comercial de esa
  línea de negocio. `vendido_por_dueno` registra que el dueño lo vendió él
  mismo — desenlace previsto, sin comisión, no una fuga.
- **Una sola portada por vehículo**, garantizada por índice único parcial.
- **No se publica un auto sin precio ni sin slug.** Publicar algo que obliga al
  cliente a escribir solo para saber cuánto cuesta no es publicar.
- **Una sola tasa por alcance y fecha**, garantizada por índice de exclusión. Si
  no, "¿qué IGV aplicaba en marzo?" tendría dos respuestas.

---

## Seguridad: RLS + privilegios por columna

RLS filtra **filas**, no columnas. Una política "anon lee los publicados" sin más
dejaría leer `precio_compra` y `notas_internas` de los autos publicados — es
decir, el margen del negocio. Por eso hay **dos capas**:

| Capa | Qué controla |
|---|---|
| RLS | Qué filas (solo `publicado = true`) |
| `GRANT` por columna | Qué columnas (nunca compra, margen ni notas internas) |

**Consecuencia práctica:** `select *` como `anon` **falla a propósito**. Desde el
front público hay que pedir columnas explícitas o usar la vista
`vehiculos_publicos` (declarada `security_invoker = true`, así que respeta el RLS
de quien consulta en lugar de eludirlo).

Resumen de acceso:

| Rol | Acceso |
|---|---|
| `anon` | Solo lectura de vehículos publicados y sus fotos, solo columnas públicas |
| `authenticated` | El equipo: acceso completo vía RLS |
| `service_role` | Route Handlers de Vercel (formularios públicos). No pasa por RLS |

### Los formularios públicos no escriben directo

`leads` y `quotes` **no** otorgan `INSERT` a `anon`. Las escrituras entran por un
Route Handler de Next.js con `SUPABASE_SERVICE_ROLE_KEY` (variable **solo de
servidor**, jamás `NEXT_PUBLIC_*`). La llave anónima viaja al navegador: con
`INSERT` abierto, cualquiera podría inyectar leads en masa o escribir
`estado = 'ganado'` y ensuciar el embudo.

> Si algún día se decide abrir el `INSERT` a `anon`, hace falta además rate
> limiting, captcha y una política `WITH CHECK` que fije `estado = 'nuevo'`. No
> es un cambio de una línea.

**Pendiente de configuración:** desactivar el registro público de usuarios en el
panel de Supabase (*Authentication → Providers → Disable signup*). Las políticas
otorgan acceso de equipo a **cualquier usuario autenticado**, tal como se pidió;
si el registro queda abierto, cualquiera que se registre entra como equipo.

---

## Cotizaciones reproducibles

Una cotización es una promesa con fecha. Las tasas cambian: desde 2026 el 18% se
descompone en **IGV 15.5% + IPM 2.5%** (Ley 32387), antes era 16% + 2%.
Recalcular en agosto la cotización de marzo daría otro número.

Por eso cada fila de `quotes` guarda **las dos mitades** — `entrada` (el
`ImportCalculatorInput` exacto, para recalcular) y `desglose` (el
`PremiumImportQuote` que el cliente vio, para honrar lo prometido) — **más las
tasas aplicadas copiadas a columnas propias**. Una cotización vieja se defiende
con las tasas de **ese** día, no con las de hoy.

## Quién manda sobre el cálculo

**El motor de precios de `src/core/pricing/` es la fuente de verdad.** Está
verificado contra la proforma Heysen 202602537 y **no se reimplementa en SQL**:
dos implementaciones de la misma norma terminan discrepando.

`tax_rates` es el **registro normativo** que lo respalda y el insumo para migrarlo
si algún día se decide. Mientras existan los dos, cualquier discrepancia entre la
tabla y `pricingConfig.ts` es un bug, y se resuelve **a favor de la norma**.

Por la misma razón, las reglas de admisibilidad (antigüedad máxima 2 años, diésel
usado prohibido, timón izquierdo, tope 32,000 km M1 / 36,000 km N1) **no** están
como `CHECK`: viven en `checkAdmissibility()`. Además aplican al momento de
**importar**, no al de inventariar — un auto en consignación de un cliente
peruano puede tener 150,000 km legítimamente y debe poder registrarse.

---

## Cómo aplicar

```bash
supabase link --project-ref <ref>   # organización zvwegcanushbpmjtohnp
supabase db push                    # aplica supabase/migrations/
```

En local, `supabase db reset` aplica las migraciones y luego `seed.sql`.

### El seed es opcional y no publica nada

`seed.sql` es solo para desarrollo. Respeta tres reglas a propósito:

1. **Nada publicado** (`publicado = false` en todo). El catálogo anterior tenía 9
   vehículos con precios inflados hasta **48%** sobre el MSRP real (el Bronco
   Raptor figuraba en USD 85–118k contra **79,995** reales) y 9 fotos de Unsplash
   que **no eran el auto anunciado**. Un seed que publique inventario inventado
   repite exactamente ese error.
2. **Sin fotos falsas.** No siembra `vehicle_photos`. Mejor una ficha sin foto que
   una ficha con la foto de otro auto.
3. **Sin cotizaciones falsas.** No siembra `quotes`. Un desglose escrito a mano
   parecería verificado sin estarlo. Genera cotizaciones de prueba con la
   calculadora real.

Las tasas tributarias **no** están en el seed: son datos normativos reales y se
cargan en la migración `20260915090400_tax_rates.sql`.
