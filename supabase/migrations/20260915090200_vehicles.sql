-- =============================================================================
--  Migración 0003 · vehicles — el stock propio de LuxCars
-- =============================================================================
--
--  ####################################################################
--  ##  RESTRICCIÓN LEGAL DURA. LEE ESTO ANTES DE TOCAR ESTA TABLA.   ##
--  ####################################################################
--
--  ESTÁ PROHIBIDO GUARDAR EN ESTA TABLA (o en cualquier otra de esta base)
--  INVENTARIO PROVENIENTE DE:
--
--      MarketCheck · Auto.dev · eBay / eBay Motors · Autotrader ·
--      CarGurus · Cars.com · TrueCar · AutoTempest · Facebook Marketplace
--
--  Los contratos de esas fuentes prohíben textualmente "cache, store, index or
--  otherwise persist" sus datos, prohíben construir "derivative databases" y
--  varios obligan a BORRAR cualquier copia dentro de las 6 HORAS.
--
--  Un solo INSERT con datos de esas fuentes es INCUMPLIMIENTO DE CONTRATO, con
--  revocación inmediata de la llave de API y exposición legal para
--  LUX CARS IMPORT S.A.C.
--
--  Esto NO es una preferencia de arquitectura ni una optimización pendiente.
--  No lo "arregles" en seis meses metiendo un job de sincronización.
--  Si alguien pide "solo cachear un ratito para que cargue más rápido": NO.
--  El plazo contractual de 6 horas no vuelve legal el INSERT, solo acorta la
--  ventana de incumplimiento.
--
--  LA VÍA LEGAL, que es la que implementa este esquema:
--    1. CARGA MANUAL CURADA en el admin, con autocompletado por VIN contra
--       NHTSA vPIC (API pública del gobierno de EE.UU., sin restricción
--       contractual). Cuatro minutos por auto.
--    2. FEEDS XML DE DEALERS PARTNER, únicamente con cláusula de licencia
--       FIRMADA que autorice el almacenamiento y la republicación.
--
--  La columna `fuente` de abajo aplica esa regla a nivel de motor de base de
--  datos: es una LISTA BLANCA. Si aparece un valor nuevo, alguien tuvo que
--  escribir una migración y justificarlo. Ese es exactamente el punto.
--
--  ####################################################################
--
--
--  NORMATIVA DE IMPORTACIÓN (contexto para quien consulte esta tabla)
--  ---------------------------------------------------------------------------
--  Para unidades IMPORTADAS rigen: antigüedad máxima 2 años desde el año
--  modelo (en 2026, solo 2024 en adelante), diésel usado PROHIBIDO en autos y
--  camionetas, timón izquierdo de fábrica, y tope de kilometraje de 32,000 km
--  (categoría M1) / 36,000 km (categoría N1).
--
--  A PROPÓSITO no hay CHECK de kilometraje ni de antigüedad en esta tabla: un
--  auto en consignación de un cliente peruano puede tener 150,000 km
--  legítimamente y debe poder registrarse. Esas reglas aplican al momento de
--  IMPORTAR, no al de inventariar.
--
--  La única fuente de verdad de esas reglas es `checkAdmissibility()` en
--  src/core/pricing/priceCalculator.ts. NO se reimplementan acá: dos
--  implementaciones de la misma norma terminan discrepando, y la que está en
--  TypeScript es la verificada.
-- =============================================================================

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),

  -- --- Procedencia del DATO (no del vehículo) -------------------------------
  fuente public.fuente_inventario not null default 'carga_manual',
  fuente_referencia text,  -- nº de feed licenciado, orden de compra, etc.

  -- --- Identificación -------------------------------------------------------
  vin text unique
    check (public.es_vin_valido(vin)),
  vehicle_model_id uuid
    references public.vehicle_models (id) on delete set null,
  placa text,

  marca text not null,
  modelo text not null,
  version text,                       -- trim / edición
  anio integer not null
    check (anio between 1980 and 2100),
  carroceria text,

  categoria public.categoria_vehiculo not null,
  cilindrada_cc integer
    check (cilindrada_cc is null or cilindrada_cc between 0 and 20000),
  transmision text,
  traccion text,
  color_exterior text,
  color_interior text,
  puertas integer check (puertas is null or puertas between 1 and 8),
  asientos integer check (asientos is null or asientos between 1 and 30),

  kilometraje_km integer not null default 0
    check (kilometraje_km >= 0),
  condicion public.condicion_vehiculo not null,

  -- --- Comercial: COMPRA (información reservada) ----------------------------
  precio_compra numeric(12, 2)
    check (precio_compra is null or precio_compra >= 0),
  moneda_compra public.moneda not null default 'USD',
  fecha_compra date,

  -- --- Comercial: VENTA (información pública) -------------------------------
  precio_venta numeric(12, 2)
    check (precio_venta is null or precio_venta >= 0),
  moneda_venta public.moneda not null default 'USD',
  precio_negociable boolean not null default true,

  -- --- Cierre (información reservada) ---------------------------------------
  precio_final numeric(12, 2)
    check (precio_final is null or precio_final >= 0),
  vendido_en date,

  -- --- Operación ------------------------------------------------------------
  estado public.estado_vehiculo not null default 'disponible',
  ubicacion text,                     -- "Showroom San Isidro", "En tránsito Miami–Callao"
  fecha_ingreso date not null default current_date,

  -- --- Publicación ----------------------------------------------------------
  publicado boolean not null default false,
  publicado_en timestamptz,
  slug text unique,
  titular text,                       -- titular comercial de la ficha
  descripcion text,
  destacados text[] not null default '{}',

  -- --- Interno (jamás público) ----------------------------------------------
  notas_internas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  -- Publicar un auto sin precio deja al cliente sin nada que decidir y obliga a
  -- preguntar por WhatsApp solo para saber cuánto cuesta. No se permite.
  constraint vehicles_publicado_exige_precio
    check (not publicado or precio_venta is not null),

  -- Un auto publicado necesita slug para tener URL propia.
  constraint vehicles_publicado_exige_slug
    check (not publicado or slug is not null),

  constraint vehicles_vendido_exige_fecha
    check (estado <> 'vendido' or vendido_en is not null)
);

comment on table public.vehicles is
  'Stock propio de LuxCars. PROHIBIDO insertar inventario de MarketCheck, Auto.dev, eBay, Autotrader, CarGurus, Cars.com, TrueCar, AutoTempest o Facebook Marketplace: sus contratos prohíben persistir los datos. Solo carga manual curada o feed de partner con licencia firmada.';
comment on column public.vehicles.fuente is
  'LISTA BLANCA de procedencia del dato. Agregar un valor exige migración y justificación legal.';
comment on column public.vehicles.notas_internas is
  'Uso interno. No se expone a anon: revisa los GRANT por columna más abajo.';
comment on column public.vehicles.precio_compra is
  'Margen del negocio. Reservado: nunca se otorga a anon.';
comment on column public.vehicles.kilometraje_km is
  'Sin tope acá a propósito. El límite de 32,000 km (M1) / 36,000 km (N1) aplica al importar, no al inventariar.';

create index if not exists vehicles_publicado_idx
  on public.vehicles (publicado, estado, fecha_ingreso desc)
  where publicado;

create index if not exists vehicles_estado_idx
  on public.vehicles (estado);

create index if not exists vehicles_marca_modelo_idx
  on public.vehicles (marca, modelo);

create index if not exists vehicles_anio_idx
  on public.vehicles (anio desc);

create index if not exists vehicles_categoria_idx
  on public.vehicles (categoria);

create index if not exists vehicles_precio_venta_idx
  on public.vehicles (precio_venta)
  where publicado;

create index if not exists vehicles_vehicle_model_id_idx
  on public.vehicles (vehicle_model_id);

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.tg_marcar_actualizado();


-- Sella la fecha de publicación sin que la app tenga que acordarse.
create or replace function public.tg_sellar_publicacion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.publicado and not coalesce(old.publicado, false) then
    new.publicado_en := now();
  elsif not new.publicado then
    new.publicado_en := null;
  end if;
  return new;
end;
$$;

drop trigger if exists vehicles_sellar_publicacion on public.vehicles;
create trigger vehicles_sellar_publicacion
  before insert or update on public.vehicles
  for each row execute function public.tg_sellar_publicacion();


-- -----------------------------------------------------------------------------
--  RLS + PRIVILEGIOS POR COLUMNA
-- -----------------------------------------------------------------------------
--  RLS filtra FILAS, no columnas. Una política "anon lee los publicados" sin
--  más dejaría a cualquiera leer `precio_compra` y `notas_internas` de los
--  autos publicados, que es justamente el margen del negocio.
--
--  Por eso se combinan dos capas:
--    · RLS          → qué filas (solo publicadas)
--    · GRANT(col)   → qué columnas (nunca compra, margen ni notas)
--
--  Consecuencia práctica para quien consulte desde el front público:
--  `select *` FALLA para anon. Hay que pedir columnas explícitas, o usar la
--  vista `vehiculos_publicos` definida al final.
-- -----------------------------------------------------------------------------
alter table public.vehicles enable row level security;

revoke all on public.vehicles from anon, authenticated;

grant select (
  id, marca, modelo, version, anio, carroceria, categoria, cilindrada_cc,
  transmision, traccion, color_exterior, color_interior, puertas, asientos,
  kilometraje_km, condicion, precio_venta, moneda_venta, precio_negociable,
  estado, ubicacion, fecha_ingreso, publicado, publicado_en, slug, titular,
  descripcion, destacados, created_at, updated_at
) on public.vehicles to anon;

grant select, insert, update, delete on public.vehicles to authenticated;

-- Lectura pública: SOLO lo publicado. Un auto vendido sigue siendo visible si
-- el equipo lo dejó publicado (sirve de prueba social); despublicarlo lo oculta.
drop policy if exists "vehicles: lectura pública de publicados" on public.vehicles;
create policy "vehicles: lectura pública de publicados"
  on public.vehicles for select
  to anon
  using (publicado);

drop policy if exists "vehicles: el equipo lee todo" on public.vehicles;
create policy "vehicles: el equipo lee todo"
  on public.vehicles for select
  to authenticated
  using (true);

drop policy if exists "vehicles: el equipo inserta" on public.vehicles;
create policy "vehicles: el equipo inserta"
  on public.vehicles for insert
  to authenticated
  with check (true);

drop policy if exists "vehicles: el equipo actualiza" on public.vehicles;
create policy "vehicles: el equipo actualiza"
  on public.vehicles for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "vehicles: el equipo borra" on public.vehicles;
create policy "vehicles: el equipo borra"
  on public.vehicles for delete
  to authenticated
  using (true);
