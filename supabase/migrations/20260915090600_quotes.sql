-- =============================================================================
--  Migración 0007 · quotes — cotizaciones de la calculadora
-- =============================================================================
--
--  POR QUÉ SE GUARDA EL INPUT **Y** EL DESGLOSE COMPLETO
--  ---------------------------------------------------------------------------
--  Una cotización es una promesa con fecha. Las tasas cambian (IGV 16% → 15.5%
--  en 2026), el flete estimado cambia, las reglas del APC se interpretan mejor.
--  Si solo se guardara el input, recalcular la cotización de marzo con el
--  motor de agosto daría OTRO número, y no habría forma de explicarle al
--  cliente qué le prometimos.
--
--  Por eso cada fila guarda las dos mitades:
--
--    `entrada`  → el ImportCalculatorInput exacto (para poder recalcular)
--    `desglose` → el PremiumImportQuote exacto que se le mostró y se le envió
--                 en PDF y por WhatsApp (para poder honrar lo prometido)
--
--  Además, las TASAS APLICADAS se copian a columnas propias. No se dejan solo
--  dentro del JSON ni se leen de `tax_rates` al reproducir: una cotización
--  vieja se defiende con las tasas que se usaron ESE día, no con las de hoy.
--
--  Las columnas escalares de abajo son una desnormalización deliberada del
--  JSON: sirven para listar, filtrar y sumar en el admin sin castigar cada
--  consulta con operadores jsonb. El JSON manda; las columnas son un índice
--  legible que se escribe en el mismo INSERT.
--
--  QUIÉN ESCRIBE: igual que `leads`, un Route Handler de Vercel con
--  service_role. `anon` no tiene ningún permiso acá.
-- =============================================================================

create sequence if not exists public.quote_number_seq;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),

  -- Número legible para conversar por WhatsApp: "tu cotización LX-2026-00042".
  numero text not null unique
    default 'LX-' || to_char(now(), 'YYYY') || '-'
            || lpad(nextval('public.quote_number_seq')::text, 5, '0'),

  lead_id uuid references public.leads (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,

  -- --- Las dos mitades reproducibles ---------------------------------------
  entrada jsonb not null,    -- ImportCalculatorInput
  desglose jsonb not null,   -- PremiumImportQuote completo

  -- Versión del motor que produjo el desglose. Sin esto, dentro de un año
  -- nadie sabrá con qué código se calculó esta fila.
  motor_version text not null default 'src/core/pricing@2026.09',

  -- --- Vehículo cotizado (desnormalizado de `entrada`) ----------------------
  marca text not null,
  modelo text not null,
  anio text not null,        -- text: el motor recibe `year: string`
  precio_miami numeric(12, 2) not null
    check (precio_miami >= 0),
  categoria public.categoria_vehiculo not null,
  condicion public.condicion_vehiculo not null,
  origen public.origen_vehiculo not null,
  cilindrada_cc integer
    check (cilindrada_cc is null or cilindrada_cc between 0 and 20000),
  perfil_importador public.perfil_importador not null default 'recurrente',
  plan public.plan_importacion not null,

  -- --- Tasas aplicadas (foto del día) ---------------------------------------
  tasa_ad_valorem numeric(8, 6) not null,
  tasa_isc numeric(8, 6) not null,
  tasa_igv numeric(8, 6) not null,
  tasa_ipm numeric(8, 6) not null,
  tasa_percepcion numeric(8, 6) not null,

  -- --- Logística ------------------------------------------------------------
  flete_base numeric(12, 2) not null,
  flete numeric(12, 2) not null,
  ajuste_flete numeric(6, 4) not null,   -- 1.15 en Fast Track, 1 en Estándar
  seguro numeric(12, 2) not null,
  cif numeric(12, 2) not null,

  -- --- Tributos (la cascada, ya calculada) ----------------------------------
  ad_valorem numeric(12, 2) not null,
  isc numeric(12, 2) not null,
  igv numeric(12, 2) not null,
  ipm numeric(12, 2) not null,
  percepcion numeric(12, 2) not null,
  base_isc numeric(12, 2) not null,
  base_igv numeric(12, 2) not null,
  base_percepcion numeric(12, 2) not null,

  -- --- Servicios LuxCars ----------------------------------------------------
  comision_compliance numeric(12, 2) not null default 0,
  comision_broker numeric(12, 2) not null default 0,
  gastos_documentarios numeric(12, 2) not null default 0,

  -- --- Resultado ------------------------------------------------------------
  -- `total_estimado` es el COSTO REAL: no incluye la percepción, que es
  -- recuperable como crédito fiscal.
  -- `efectivo_requerido` es la CAJA que el cliente tiene que poner: el costo
  -- real más la percepción. Confundirlos es el error caro de esta industria.
  total_estimado numeric(12, 2) not null,
  efectivo_requerido numeric(12, 2) not null,
  rango_min numeric(12, 2) not null,
  rango_max numeric(12, 2) not null,

  moneda public.moneda not null default 'USD',

  -- --- Ciclo de vida --------------------------------------------------------
  -- Una cotización con tasas de hace seis meses no se puede honrar. La fecha
  -- de validez existe para decirlo antes de que el cliente lo descubra.
  valida_hasta date,
  pdf_generado boolean not null default false,
  enviada_por_whatsapp boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint quotes_rango_coherente
    check (rango_max >= rango_min),

  -- El efectivo requerido siempre incluye la percepción, así que nunca puede
  -- ser menor al costo. Si esto falla, el desglose se armó mal.
  constraint quotes_efectivo_cubre_costo
    check (efectivo_requerido >= total_estimado)
);

comment on table public.quotes is
  'Cotizaciones de la calculadora de importación. Guarda input y desglose completos más las tasas aplicadas, para poder reproducir y defender una cotización vieja.';
comment on column public.quotes.entrada is
  'ImportCalculatorInput exacto (src/core/pricing/priceCalculator.ts). Permite recalcular.';
comment on column public.quotes.desglose is
  'PremiumImportQuote exacto que vio el cliente. Permite honrar lo prometido aunque el motor cambie.';
comment on column public.quotes.total_estimado is
  'Costo real de la importación. NO incluye la percepción, que es recuperable como crédito fiscal.';
comment on column public.quotes.efectivo_requerido is
  'Caja a desembolsar: costo real + percepción. Es la cifra que le importa al cliente.';
comment on column public.quotes.motor_version is
  'Versión del motor de precios que produjo el desglose. Imprescindible para auditar cotizaciones antiguas.';

create index if not exists quotes_created_idx
  on public.quotes (created_at desc);

create index if not exists quotes_lead_id_idx
  on public.quotes (lead_id)
  where lead_id is not null;

create index if not exists quotes_vehicle_id_idx
  on public.quotes (vehicle_id)
  where vehicle_id is not null;

create index if not exists quotes_marca_modelo_idx
  on public.quotes (marca, modelo);

create index if not exists quotes_plan_idx
  on public.quotes (plan);

-- Búsqueda dentro del desglose sin tener que desnormalizar más columnas.
create index if not exists quotes_desglose_gin_idx
  on public.quotes using gin (desglose jsonb_path_ops);

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.tg_marcar_actualizado();


-- -----------------------------------------------------------------------------
--  RLS — sin acceso anónimo
-- -----------------------------------------------------------------------------
--  La cotización se le entrega al cliente como PDF y por WhatsApp, no como una
--  fila consultable. Si más adelante se quiere una URL pública para reabrirla,
--  se hace con un token firmado y una función SECURITY DEFINER acotada a ese
--  token, NO abriendo SELECT a `anon`.
-- -----------------------------------------------------------------------------
alter table public.quotes enable row level security;

revoke all on public.quotes from anon, authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
grant usage, select on sequence public.quote_number_seq to authenticated;

drop policy if exists "quotes: el equipo lee" on public.quotes;
create policy "quotes: el equipo lee"
  on public.quotes for select
  to authenticated
  using (true);

drop policy if exists "quotes: el equipo inserta" on public.quotes;
create policy "quotes: el equipo inserta"
  on public.quotes for insert
  to authenticated
  with check (true);

drop policy if exists "quotes: el equipo actualiza" on public.quotes;
create policy "quotes: el equipo actualiza"
  on public.quotes for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "quotes: el equipo borra" on public.quotes;
create policy "quotes: el equipo borra"
  on public.quotes for delete
  to authenticated
  using (true);
