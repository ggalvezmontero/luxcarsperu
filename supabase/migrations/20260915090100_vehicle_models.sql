-- =============================================================================
--  Migración 0002 · vehicle_models
--  Caché del decodificado de VIN de NHTSA vPIC
-- =============================================================================
--
--  POR QUÉ ESTA TABLA SÍ PUEDE PERSISTIR DATOS DE UN TERCERO
--  ---------------------------------------------------------------------------
--  NHTSA vPIC es una API del gobierno de los Estados Unidos:
--
--      https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json
--
--  Es gratuita, no exige autenticación, no impone límite contractual y sus
--  datos son obra del gobierno federal de EE.UU. (dominio público). Guardar el
--  resultado en caché es legítimo y además cortés: evita golpear la API una y
--  otra vez por el mismo VIN.
--
--  Esto NO es una excepción a la prohibición descrita en la migración 0003.
--  vPIC devuelve FICHA TÉCNICA (marca, modelo, año, carrocería, cilindrada,
--  combustible, planta de ensamblaje). No devuelve inventario, ni precios, ni
--  avisos de venta. Es exactamente lo contrario de un feed de marketplace.
--
--  CLAVE DE CACHÉ
--  ---------------------------------------------------------------------------
--  Se cachea por PATRÓN DE VIN (los 11 primeros caracteres: WMI + VDS + año +
--  planta), no por VIN completo. Ese prefijo es el que determina la ficha
--  técnica; los 6 últimos dígitos son el correlativo de producción de la unidad
--  y no aportan nada al decodificado. Así, el segundo Bronco Raptor del mismo
--  año y planta se autocompleta sin una sola llamada de red.
-- =============================================================================

create table if not exists public.vehicle_models (
  id uuid primary key default gen_random_uuid(),

  -- Clave de caché: 11 primeros caracteres del VIN, en mayúsculas.
  vin_pattern text not null unique
    check (vin_pattern ~ '^[A-HJ-NPR-Z0-9]{11}$'),

  -- VIN completo que originó la consulta. Se guarda solo como referencia de
  -- auditoría; NUNCA lo uses como clave de búsqueda del caché.
  vin_consultado text
    check (public.es_vin_valido(vin_consultado)),

  -- --- Ficha técnica devuelta por vPIC -------------------------------------
  marca text,                      -- Make
  modelo text,                     -- Model
  anio integer                     -- ModelYear
    check (anio is null or anio between 1980 and 2100),
  serie text,                      -- Series
  version text,                    -- Trim
  fabricante text,                 -- Manufacturer
  tipo_vehiculo text,              -- VehicleType (PASSENGER CAR, TRUCK, ...)
  carroceria text,                 -- BodyClass
  puertas integer,                 -- Doors
  traccion text,                   -- DriveType

  -- Motor
  cilindrada_cc integer            -- DisplacementCC → alimenta el ISC escalonado
    check (cilindrada_cc is null or cilindrada_cc between 0 and 20000),
  cilindrada_l numeric(4, 1),      -- DisplacementL
  cilindros integer,               -- EngineCylinders
  potencia_hp numeric(7, 2),       -- EngineHP

  -- Combustible y electrificación
  combustible_primario text,       -- FuelTypePrimary
  combustible_secundario text,     -- FuelTypeSecondary
  nivel_electrificacion text,      -- ElectrificationLevel

  -- Ensamblaje. `pais_ensamblaje` es el dato más caro de esta tabla: es lo que
  -- permite sospechar si el vehículo podría ser originario de EE.UU. bajo el
  -- APC. OJO: el país de planta NO prueba origen (ver originInference.ts); el
  -- único documento válido ante SUNAT es el certificado de origen.
  pais_ensamblaje text,            -- PlantCountry
  ciudad_ensamblaje text,          -- PlantCity
  estado_ensamblaje text,          -- PlantState
  empresa_ensamblaje text,         -- PlantCompanyName

  gvwr text,                       -- GVWR: relevante para clasificar M1 vs N1

  -- Anotación manual del equipo sobre este decodificado (por ejemplo, que la
  -- planta cambió de país entre años modelo, o por qué no califica al APC).
  notas text,

  -- --- Metadatos del caché --------------------------------------------------
  respuesta_cruda jsonb not null default '{}'::jsonb,
  api_origen text not null default 'nhtsa_vpic',
  codigo_error text,               -- ErrorCode de vPIC ('0' = sin error)
  texto_error text,                -- ErrorText de vPIC
  decodificado_en timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.vehicle_models is
  'Caché del decodificado de VIN de NHTSA vPIC (API pública del gobierno de EE.UU., dominio público). Ficha técnica únicamente: jamás inventario ni precios de terceros.';
comment on column public.vehicle_models.vin_pattern is
  'Clave de caché: 11 primeros caracteres del VIN (WMI + VDS + año + planta).';
comment on column public.vehicle_models.cilindrada_cc is
  'Alimenta el ISC escalonado de gasolina nueva (5% ≤1400cc, 7.5% ≤1500cc, 10% encima).';
comment on column public.vehicle_models.pais_ensamblaje is
  'Indicio de origen, NO prueba. Solo el certificado de origen del APC vale ante SUNAT.';
comment on column public.vehicle_models.respuesta_cruda is
  'Payload completo de vPIC. Se guarda entero para poder extraer campos nuevos sin volver a llamar.';

create index if not exists vehicle_models_marca_modelo_anio_idx
  on public.vehicle_models (marca, modelo, anio);

create index if not exists vehicle_models_anio_idx
  on public.vehicle_models (anio desc);

create index if not exists vehicle_models_decodificado_en_idx
  on public.vehicle_models (decodificado_en desc);

drop trigger if exists vehicle_models_set_updated_at on public.vehicle_models;
create trigger vehicle_models_set_updated_at
  before update on public.vehicle_models
  for each row execute function public.tg_marcar_actualizado();


-- -----------------------------------------------------------------------------
--  Sugerencia de categoría tributaria a partir del decodificado
-- -----------------------------------------------------------------------------
--  SUGIERE, no decide. La categoría definitiva la confirma una persona en el
--  admin, porque de ella depende el ISC y equivocarse cuesta plata real.
--
--  El caso delicado está documentado en vehicleCategories.ts: un mild-hybrid
--  de 48V NO es un HEV a efectos del Apéndice IV; tributa como gasolina. vPIC
--  lo identifica en ElectrificationLevel como "Mild HEV". Por eso esta función
--  devuelve 'gasolina' ante cualquier variante "mild".
-- -----------------------------------------------------------------------------
create or replace function public.sugerir_categoria_vpic(
  combustible_primario text,
  nivel_electrificacion text
)
returns public.categoria_vehiculo
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    -- Mild hybrid (48V) tributa como gasolina. Se evalúa PRIMERO a propósito.
    when upper(coalesce(nivel_electrificacion, '')) like '%MILD%'
      then 'gasolina'::public.categoria_vehiculo
    when upper(coalesce(nivel_electrificacion, '')) like '%PHEV%'
      or upper(coalesce(nivel_electrificacion, '')) like '%PLUG%'
      then 'phev'::public.categoria_vehiculo
    when upper(coalesce(nivel_electrificacion, '')) like '%BEV%'
      or upper(coalesce(combustible_primario, '')) like '%ELECTRIC%'
      then 'ev'::public.categoria_vehiculo
    when upper(coalesce(nivel_electrificacion, '')) like '%HEV%'
      or upper(coalesce(nivel_electrificacion, '')) like '%STRONG%'
      then 'hev'::public.categoria_vehiculo
    when upper(coalesce(combustible_primario, '')) like '%DIESEL%'
      then 'diesel'::public.categoria_vehiculo
    when upper(coalesce(combustible_primario, '')) like '%GASOLINE%'
      or upper(coalesce(combustible_primario, '')) like '%PETROL%'
      then 'gasolina'::public.categoria_vehiculo
    else null
  end;
$$;

comment on function public.sugerir_categoria_vpic(text, text) is
  'Sugiere la categoría tributaria desde el decodificado vPIC. Un mild-hybrid 48V devuelve gasolina, no hev: así lo exige el Apéndice IV. Siempre debe confirmarla una persona.';


-- -----------------------------------------------------------------------------
--  RLS
-- -----------------------------------------------------------------------------
--  Caché interno del admin: nadie anónimo lo lee. El formulario público no lo
--  necesita porque la decodificación por VIN ocurre dentro del portal.
-- -----------------------------------------------------------------------------
alter table public.vehicle_models enable row level security;

revoke all on public.vehicle_models from anon, authenticated;
grant select, insert, update, delete on public.vehicle_models to authenticated;

drop policy if exists "vehicle_models: el equipo lee" on public.vehicle_models;
create policy "vehicle_models: el equipo lee"
  on public.vehicle_models for select
  to authenticated
  using (true);

drop policy if exists "vehicle_models: el equipo escribe" on public.vehicle_models;
create policy "vehicle_models: el equipo escribe"
  on public.vehicle_models for insert
  to authenticated
  with check (true);

drop policy if exists "vehicle_models: el equipo actualiza" on public.vehicle_models;
create policy "vehicle_models: el equipo actualiza"
  on public.vehicle_models for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "vehicle_models: el equipo borra" on public.vehicle_models;
create policy "vehicle_models: el equipo borra"
  on public.vehicle_models for delete
  to authenticated
  using (true);
