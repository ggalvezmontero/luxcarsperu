-- =============================================================================
--  Migración 0008 · consignments — autos en consignación
-- =============================================================================
--
--  LA REGLA QUE DEFINE ESTA LÍNEA DE NEGOCIO: **SIN EXCLUSIVIDAD**
--  ---------------------------------------------------------------------------
--  LuxCars no pide contrato de exclusividad. El dueño sigue usando su auto
--  mientras se vende, y puede venderlo por su cuenta sin penalidad. Eso no es
--  un detalle del contrato: es el argumento comercial de la línea entera.
--
--  El esquema lo hace explícito en tres lugares:
--
--    1. `sin_exclusividad` tiene un CHECK que solo admite TRUE. Si alguien
--       algún día quiere registrar una consignación exclusiva, va a tener que
--       escribir una migración y explicar por qué se cambió la promesa que se
--       le hizo al cliente. Esa fricción es intencional.
--    2. `vendido_por_dueno` + `vendido_por_dueno_en` registran el caso en que
--       el dueño lo vendió él mismo. No es una falla ni una fuga: es un
--       desenlace previsto y hay que poder cerrarlo limpio y sin comisión.
--    3. `fecha_fin` es opcional. No hay período de amarre.
--
--  El auto en consignación NO es stock propio: LuxCars no lo compró. Se
--  vincula opcionalmente a una fila de `vehicles` (con `fuente = 'consignacion'`)
--  cuando se publica en el sitio, pero el vehículo sigue siendo del cliente.
-- =============================================================================

create table if not exists public.consignments (
  id uuid primary key default gen_random_uuid(),

  -- --- Dueño del vehículo ---------------------------------------------------
  propietario_nombre text not null,
  propietario_documento text,           -- DNI / CE / RUC
  propietario_tipo_documento text
    check (propietario_tipo_documento is null
           or propietario_tipo_documento in ('DNI', 'CE', 'RUC', 'PASAPORTE')),
  propietario_telefono text not null,
  propietario_email text
    check (propietario_email is null
           or propietario_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

  -- --- Vehículo -------------------------------------------------------------
  -- Se describe inline porque la consignación empieza antes de que exista
  -- ficha publicable. `vehicle_id` se llena recién al publicarlo.
  vehicle_id uuid references public.vehicles (id) on delete set null,
  marca text not null,
  modelo text not null,
  anio integer not null
    check (anio between 1980 and 2100),
  version text,
  placa text,
  vin text check (public.es_vin_valido(vin)),
  kilometraje_km integer
    check (kilometraje_km is null or kilometraje_km >= 0),
  color text,

  -- --- Precios --------------------------------------------------------------
  -- `precio_minimo` es el piso que autorizó el dueño para negociar. Es
  -- información RESERVADA: si se filtra al comprador, se acabó la negociación.
  precio_pedido numeric(12, 2) not null
    check (precio_pedido >= 0),
  precio_minimo numeric(12, 2)
    check (precio_minimo is null or precio_minimo >= 0),
  moneda public.moneda not null default 'USD',
  tasacion_luxcars numeric(12, 2)
    check (tasacion_luxcars is null or tasacion_luxcars >= 0),

  constraint consignments_minimo_no_supera_pedido
    check (precio_minimo is null or precio_minimo <= precio_pedido),

  -- --- Comisión pactada -----------------------------------------------------
  tipo_comision public.tipo_comision not null default 'porcentaje',
  comision_porcentaje numeric(5, 4)
    check (comision_porcentaje is null
           or (comision_porcentaje >= 0 and comision_porcentaje <= 1)),
  comision_monto numeric(12, 2)
    check (comision_monto is null or comision_monto >= 0),

  constraint consignments_comision_coherente
    check (
      (tipo_comision = 'porcentaje' and comision_porcentaje is not null)
      or (tipo_comision = 'monto_fijo' and comision_monto is not null)
    ),

  -- --- Vigencia -------------------------------------------------------------
  fecha_inicio date not null default current_date,
  fecha_fin date,     -- NULL = sin plazo. No hay amarre.

  constraint consignments_vigencia_coherente
    check (fecha_fin is null or fecha_fin >= fecha_inicio),

  estado public.estado_consignacion not null default 'activa',

  -- --- SIN EXCLUSIVIDAD -----------------------------------------------------
  sin_exclusividad boolean not null default true
    constraint consignments_siempre_sin_exclusividad check (sin_exclusividad),

  -- El dueño vendió el auto por su cuenta. Desenlace previsto, no incidente.
  vendido_por_dueno boolean not null default false,
  vendido_por_dueno_en date,
  vendido_por_dueno_notas text,

  -- --- Cierre ---------------------------------------------------------------
  precio_venta_final numeric(12, 2)
    check (precio_venta_final is null or precio_venta_final >= 0),
  comision_cobrada numeric(12, 2)
    check (comision_cobrada is null or comision_cobrada >= 0),
  vendido_en date,

  notas_internas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  -- Coherencia entre el flag y el estado: si el dueño lo vendió, el estado lo
  -- refleja, y no se le cobra comisión.
  constraint consignments_venta_propia_coherente
    check (
      not vendido_por_dueno
      or (estado = 'vendida_por_dueno' and coalesce(comision_cobrada, 0) = 0)
    ),

  constraint consignments_venta_luxcars_exige_precio
    check (estado <> 'vendida_por_luxcars' or precio_venta_final is not null)
);

comment on table public.consignments is
  'Autos en consignación. SIN contrato de exclusividad: el dueño sigue usando su auto y puede venderlo por su cuenta sin penalidad.';
comment on column public.consignments.sin_exclusividad is
  'Siempre TRUE por CHECK. Cambiarlo exige una migración: la no exclusividad es la promesa comercial de esta línea de negocio.';
comment on column public.consignments.vendido_por_dueno is
  'El dueño lo vendió él mismo. Desenlace previsto y sin comisión, no una fuga que haya que penalizar.';
comment on column public.consignments.precio_minimo is
  'Piso autorizado para negociar. RESERVADO: jamás se muestra al comprador.';
comment on column public.consignments.fecha_fin is
  'Opcional. NULL significa sin plazo de amarre.';

create index if not exists consignments_estado_idx
  on public.consignments (estado, fecha_inicio desc);

create index if not exists consignments_activas_idx
  on public.consignments (fecha_inicio desc)
  where estado = 'activa';

create index if not exists consignments_propietario_telefono_idx
  on public.consignments (propietario_telefono);

create index if not exists consignments_vehicle_id_idx
  on public.consignments (vehicle_id)
  where vehicle_id is not null;

create index if not exists consignments_marca_modelo_idx
  on public.consignments (marca, modelo);

drop trigger if exists consignments_set_updated_at on public.consignments;
create trigger consignments_set_updated_at
  before update on public.consignments
  for each row execute function public.tg_marcar_actualizado();


-- Si se marca que el dueño lo vendió, se sella la fecha y se ajusta el estado.
-- Evita que el registro quede a medias por olvido del formulario.
create or replace function public.tg_sellar_venta_propia()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.vendido_por_dueno and not coalesce(old.vendido_por_dueno, false) then
    new.estado := 'vendida_por_dueno';
    if new.vendido_por_dueno_en is null then
      new.vendido_por_dueno_en := current_date;
    end if;
    new.comision_cobrada := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists consignments_sellar_venta_propia on public.consignments;
create trigger consignments_sellar_venta_propia
  before update on public.consignments
  for each row execute function public.tg_sellar_venta_propia();


-- -----------------------------------------------------------------------------
--  RLS — sin acceso anónimo
-- -----------------------------------------------------------------------------
--  Acá hay datos personales del dueño y su precio mínimo. Nada de esto sale
--  del portal. La ficha pública del auto consignado, si se publica, vive en
--  `vehicles` con `fuente = 'consignacion'`.
-- -----------------------------------------------------------------------------
alter table public.consignments enable row level security;

revoke all on public.consignments from anon, authenticated;
grant select, insert, update, delete on public.consignments to authenticated;

drop policy if exists "consignments: el equipo lee" on public.consignments;
create policy "consignments: el equipo lee"
  on public.consignments for select
  to authenticated
  using (true);

drop policy if exists "consignments: el equipo inserta" on public.consignments;
create policy "consignments: el equipo inserta"
  on public.consignments for insert
  to authenticated
  with check (true);

drop policy if exists "consignments: el equipo actualiza" on public.consignments;
create policy "consignments: el equipo actualiza"
  on public.consignments for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "consignments: el equipo borra" on public.consignments;
create policy "consignments: el equipo borra"
  on public.consignments for delete
  to authenticated
  using (true);
