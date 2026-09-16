-- =============================================================================
--  LUX CARS IMPORT S.A.C. (RUC 20615410935)
--  Migración 0001 · Fundaciones: extensiones, tipos y utilidades comunes
-- =============================================================================
--
--  Este esquema da soporte a UN PORTAL DE ADMINISTRACIÓN INTERNO.
--  El cliente final NUNCA crea cuenta: cotiza, llena formularios y continúa
--  por WhatsApp. Por lo tanto:
--
--    · `anon`          → solo lee vehículos PUBLICADOS y sus fotos.
--    · `authenticated` → el dueño y su equipo. Acceso completo vía RLS.
--    · `service_role`  → usado por los Route Handlers de Next.js en Vercel
--                        para insertar leads y cotizaciones desde los
--                        formularios públicos (ver nota en 0005 y 0006).
--
--  Convención: los identificadores de tipo que cruzan el límite TypeScript ↔
--  SQL están escritos EXACTAMENTE igual que las uniones literales de
--  `src/core/pricing/`. No los cambies sin cambiar el motor de precios.
-- =============================================================================

-- btree_gist habilita el índice de exclusión de `tax_rates` (igualdad sobre
-- texto combinada con solapamiento de rangos de fechas). Sin él, dos tasas
-- vigentes del mismo tributo podrían solaparse y una cotización histórica
-- dejaría de ser reproducible.
create extension if not exists btree_gist with schema extensions;


-- -----------------------------------------------------------------------------
--  TIPOS ENUMERADOS
-- -----------------------------------------------------------------------------

do $$ begin
  -- Espejo exacto de VehicleCategoryId (src/core/pricing/vehicleCategories.ts)
  create type public.categoria_vehiculo as enum (
    'gasolina',
    'hev',
    'diesel',
    'ev',
    'phev'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- Espejo exacto de VehicleCondition (src/core/pricing/pricingConfig.ts)
  create type public.condicion_vehiculo as enum ('nuevo', 'usado');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Espejo exacto de VehicleOrigin. OJO: 'originario-usa' NO significa
  -- "comprado en Miami"; significa que cumple la regla de origen del APC
  -- Perú–EE.UU. y tiene certificado de origen. Ver originInference.ts.
  create type public.origen_vehiculo as enum ('originario-usa', 'otro');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Espejo exacto de PlanKey (src/core/pricing/pricingConfig.ts)
  create type public.plan_importacion as enum ('fast', 'standard');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Espejo exacto de ImporterProfile. Determina la tasa de percepción.
  create type public.perfil_importador as enum (
    'recurrente',
    'primera-importacion'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.moneda as enum ('USD', 'PEN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_vehiculo as enum (
    'disponible',
    'reservado',
    'vendido',
    'en_transito'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- ORIGEN DEL DATO DE INVENTARIO. Es una lista blanca a propósito:
  -- ver la advertencia legal completa en la migración 0003.
  create type public.fuente_inventario as enum (
    'carga_manual',            -- cargado a mano en el admin (vía decodificador de VIN)
    'importacion_directa',     -- unidad importada por LuxCars a pedido
    'consignacion',            -- unidad de un tercero en consignación
    'feed_partner_licenciado'  -- feed XML de dealer con licencia FIRMADA
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.origen_lead as enum (
    'calculadora',
    'contacto',
    'stock',
    'consignacion'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_lead as enum (
    'nuevo',
    'contactado',
    'calificado',
    'cotizado',
    'negociacion',
    'ganado',
    'perdido'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_consignacion as enum (
    'activa',
    'pausada',
    'vendida_por_luxcars',
    'vendida_por_dueno',   -- sin exclusividad: el dueño puede venderlo él mismo
    'retirada',
    'vencida'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_comision as enum ('porcentaje', 'monto_fijo');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Tributos de la cascada de importación. Solo tributos: el flete y el seguro
  -- NO van acá porque son costos logísticos, no tasas normadas.
  create type public.tributo as enum (
    'ad_valorem',
    'isc',
    'igv',
    'ipm',
    'percepcion'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
--  UTILIDADES
-- -----------------------------------------------------------------------------

-- Mantiene `updated_at` sin depender de que la aplicación se acuerde.
create or replace function public.tg_marcar_actualizado()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.tg_marcar_actualizado() is
  'Trigger BEFORE UPDATE: refresca updated_at en cada modificación.';


-- Validación de VIN: 17 caracteres, sin I, O ni Q (el estándar ISO 3779 las
-- excluye justamente para que no se confundan con 1 y 0).
create or replace function public.es_vin_valido(vin text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$';
$$;

comment on function public.es_vin_valido(text) is
  'TRUE si el VIN es NULL o cumple ISO 3779 (17 caracteres, sin I/O/Q).';
