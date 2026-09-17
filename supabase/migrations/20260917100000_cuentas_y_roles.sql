-- =============================================================================
--  Migración 0010 · cuentas de cliente, roles y solicitudes
-- =============================================================================
--
--  CAMBIO DE MODELO (decisión del dueño, 2026-09-17)
--  ---------------------------------------------------------------------------
--  Hasta acá "el cliente nunca crea cuenta" y `authenticated` era sinónimo de
--  "el equipo". A partir de esta migración el cliente SÍ tiene cuenta, para
--  dos cosas:
--
--    1. Pedir un auto que no está en stock ni en consignación
--       (`solicitudes_compra`): LuxCars lo busca.
--    2. Ofrecer su auto para venderlo en consignación (`solicitudes_venta`).
--       NO se publica solo: un administrador la revisa y, al aprobarla, el
--       sistema crea la consignación y la ficha pública en un solo paso.
--
--  Eso rompe la premisa de todas las políticas anteriores ("authenticated =
--  equipo"). Por eso esta migración hace TRES cosas, en este orden:
--
--    A. Crea `profiles` con un rol (`cliente` | `admin`) y `es_admin()`.
--    B. REESCRIBE todas las políticas "el equipo …" de las tablas anteriores
--       para que exijan `es_admin()`. Un cliente autenticado no puede leer
--       leads, márgenes, precios mínimos ni el stock sin publicar. Si esta
--       parte no se aplica, abrir el registro público sería abrir el negocio.
--    C. Crea las tablas de solicitudes con RLS por dueño de la fila.
--
--  REGLAS QUE SE CONSERVAN
--  ---------------------------------------------------------------------------
--  · `anon` sigue leyendo solo vehículos publicados y sus fotos.
--  · `service_role` sigue siendo exclusivo de `createLead()` en el servidor.
--  · Los formularios sin cuenta siguen sin escribir directo.
--  · El cliente escribe sus propias solicitudes desde el navegador con su
--    sesión: RLS (fila propia + estado inicial fijo + trigger que protege los
--    campos internos) es el candado, igual que en el portal.
--
--  PRIMER ADMINISTRADOR
--  ---------------------------------------------------------------------------
--  Todo usuario que YA exista en `auth.users` al aplicar esta migración pasa a
--  `admin`: hasta hoy solo el equipo tenía cuenta. Los que se registren después
--  nacen `cliente`, y un admin los promueve desde /portal/usuarios.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  A. TIPOS
-- -----------------------------------------------------------------------------

do $$ begin
  create type public.rol_usuario as enum ('cliente', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Espejo de PurchaseRequestStatus (src/lib/db/types.ts)
  create type public.estado_solicitud_compra as enum (
    'nueva',              -- la acaba de enviar el cliente
    'en_busqueda',        -- el equipo la tomó y está buscando
    'propuesta_enviada',  -- ya se le mandó una o más opciones
    'cerrada',            -- terminó (se compró, o el cliente desistió)
    'descartada'          -- el equipo no la va a atender (fuera de alcance)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  -- Espejo de SaleRequestStatus (src/lib/db/types.ts)
  create type public.estado_solicitud_venta as enum (
    'pendiente',   -- esperando revisión de un admin
    'aprobada',    -- se creó la consignación y la ficha
    'rechazada',   -- el admin la rechazó, con motivo visible para el cliente
    'retirada'     -- el cliente la retiró antes de la revisión
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
--  A. PERFILES
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  rol public.rol_usuario not null default 'cliente',
  -- Un admin puede apagar una cuenta sin borrarla (conserva sus solicitudes).
  activo boolean not null default true,
  nombre text not null default '',
  telefono text,
  -- Copia del correo de auth.users para poder listarlo y buscarlo desde el
  -- portal sin tocar el esquema `auth`, que no se expone por PostgREST.
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil por usuario de auth.users. `rol` decide si es cliente o administrador. Se crea solo, por trigger, al registrarse.';
comment on column public.profiles.rol is
  'cliente: solo ve y escribe sus propias solicitudes. admin: el equipo, acceso al portal.';

create index if not exists profiles_rol_idx on public.profiles (rol);
create index if not exists profiles_email_idx on public.profiles (lower(email));

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_marcar_actualizado();


-- ¿El usuario de la sesión actual es administrador activo?
-- SECURITY DEFINER a propósito: se usa dentro de las políticas de `profiles`
-- y sin él la consulta se evaluaría contra las mismas políticas (recursión).
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.rol = 'admin'
      and p.activo
  );
$$;

comment on function public.es_admin() is
  'TRUE si auth.uid() tiene perfil con rol admin y activo. Base de todas las políticas del portal.';

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;


-- Alta automática del perfil al registrarse. Nombre y teléfono llegan en
-- `raw_user_meta_data` (options.data de supabase.auth.signUp). El rol nace
-- `cliente` SIEMPRE: nadie se registra como admin.
create or replace function public.tg_crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nombre, telefono, email)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data ->> 'nombre', 160), ''),
    nullif(left(new.raw_user_meta_data ->> 'telefono', 40), ''),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_crear_perfil();

-- Si el correo cambia en auth, la copia del perfil lo sigue.
create or replace function public.tg_sincronizar_email_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.tg_sincronizar_email_perfil();


-- PRIMER ADMINISTRADOR: quien ya tenía cuenta era el equipo.
insert into public.profiles (id, rol, nombre, telefono, email)
select
  u.id,
  'admin',
  coalesce(left(u.raw_user_meta_data ->> 'nombre', 160), ''),
  nullif(left(u.raw_user_meta_data ->> 'telefono', 40), ''),
  u.email
from auth.users u
on conflict (id) do update set rol = 'admin';


-- Protección del rol: un cliente no puede ascenderse ni reactivarse, y un
-- admin no puede quitarse su propio rol (evita quedarse fuera por error).
create or replace function public.tg_proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id <> old.id then
    raise exception 'El id del perfil no se cambia.';
  end if;

  -- Sin sesión (editor SQL de Supabase, service_role) no hay a quién
  -- restringir: es el dueño operando la base. Así se promueve al primer admin.
  if auth.uid() is null then
    return new;
  end if;

  if not public.es_admin() then
    if new.rol <> old.rol or new.activo <> old.activo then
      raise exception 'Solo un administrador cambia el rol o el estado de una cuenta.';
    end if;
  elsif old.id = auth.uid() and old.rol = 'admin' and (new.rol <> 'admin' or not new.activo) then
    raise exception 'No puedes quitarte tu propio rol de administrador ni desactivarte. Pídeselo a otro admin.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_proteger on public.profiles;
create trigger profiles_proteger
  before update on public.profiles
  for each row execute function public.tg_proteger_perfil();


alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
-- Sin INSERT ni DELETE para nadie: el alta la hace el trigger y la baja va por
-- `activo = false` (o borrando el usuario en auth, que cascadea).
grant select, update on public.profiles to authenticated;

drop policy if exists "profiles: cada quien lee el suyo" on public.profiles;
create policy "profiles: cada quien lee el suyo"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles: admin lee todos" on public.profiles;
create policy "profiles: admin lee todos"
  on public.profiles for select
  to authenticated
  using (public.es_admin());

drop policy if exists "profiles: cada quien edita el suyo" on public.profiles;
create policy "profiles: cada quien edita el suyo"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles: admin edita todos" on public.profiles;
create policy "profiles: admin edita todos"
  on public.profiles for update
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());


-- -----------------------------------------------------------------------------
--  B. CERRAR LAS TABLAS DEL NEGOCIO A ADMINISTRADORES
-- -----------------------------------------------------------------------------
--  Mismos nombres de política que en las migraciones 0002–0008, para que quien
--  las busque las encuentre; solo cambia `true` por `public.es_admin()`.
--  Las políticas de `anon` (lectura de publicados) no se tocan.
-- -----------------------------------------------------------------------------

-- vehicle_models
drop policy if exists "vehicle_models: el equipo lee" on public.vehicle_models;
create policy "vehicle_models: el equipo lee"
  on public.vehicle_models for select to authenticated using (public.es_admin());
drop policy if exists "vehicle_models: el equipo escribe" on public.vehicle_models;
create policy "vehicle_models: el equipo escribe"
  on public.vehicle_models for insert to authenticated with check (public.es_admin());
drop policy if exists "vehicle_models: el equipo actualiza" on public.vehicle_models;
create policy "vehicle_models: el equipo actualiza"
  on public.vehicle_models for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "vehicle_models: el equipo borra" on public.vehicle_models;
create policy "vehicle_models: el equipo borra"
  on public.vehicle_models for delete to authenticated using (public.es_admin());

-- vehicles
drop policy if exists "vehicles: el equipo lee todo" on public.vehicles;
create policy "vehicles: el equipo lee todo"
  on public.vehicles for select to authenticated using (public.es_admin());
drop policy if exists "vehicles: el equipo inserta" on public.vehicles;
create policy "vehicles: el equipo inserta"
  on public.vehicles for insert to authenticated with check (public.es_admin());
drop policy if exists "vehicles: el equipo actualiza" on public.vehicles;
create policy "vehicles: el equipo actualiza"
  on public.vehicles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "vehicles: el equipo borra" on public.vehicles;
create policy "vehicles: el equipo borra"
  on public.vehicles for delete to authenticated using (public.es_admin());

-- vehicle_photos
drop policy if exists "vehicle_photos: el equipo lee" on public.vehicle_photos;
create policy "vehicle_photos: el equipo lee"
  on public.vehicle_photos for select to authenticated using (public.es_admin());
drop policy if exists "vehicle_photos: el equipo inserta" on public.vehicle_photos;
create policy "vehicle_photos: el equipo inserta"
  on public.vehicle_photos for insert to authenticated with check (public.es_admin());
drop policy if exists "vehicle_photos: el equipo actualiza" on public.vehicle_photos;
create policy "vehicle_photos: el equipo actualiza"
  on public.vehicle_photos for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "vehicle_photos: el equipo borra" on public.vehicle_photos;
create policy "vehicle_photos: el equipo borra"
  on public.vehicle_photos for delete to authenticated using (public.es_admin());

-- storage: bucket `vehiculos` (la lectura pública se conserva)
drop policy if exists "vehiculos: el equipo sube" on storage.objects;
create policy "vehiculos: el equipo sube"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'vehiculos' and public.es_admin());
drop policy if exists "vehiculos: el equipo actualiza" on storage.objects;
create policy "vehiculos: el equipo actualiza"
  on storage.objects for update to authenticated
  using (bucket_id = 'vehiculos' and public.es_admin())
  with check (bucket_id = 'vehiculos' and public.es_admin());
drop policy if exists "vehiculos: el equipo borra" on storage.objects;
create policy "vehiculos: el equipo borra"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vehiculos' and public.es_admin());

-- tax_rates
drop policy if exists "tax_rates: el equipo lee" on public.tax_rates;
create policy "tax_rates: el equipo lee"
  on public.tax_rates for select to authenticated using (public.es_admin());
drop policy if exists "tax_rates: el equipo inserta" on public.tax_rates;
create policy "tax_rates: el equipo inserta"
  on public.tax_rates for insert to authenticated with check (public.es_admin());
drop policy if exists "tax_rates: el equipo actualiza" on public.tax_rates;
create policy "tax_rates: el equipo actualiza"
  on public.tax_rates for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "tax_rates: el equipo borra" on public.tax_rates;
create policy "tax_rates: el equipo borra"
  on public.tax_rates for delete to authenticated using (public.es_admin());

-- leads
drop policy if exists "leads: el equipo lee" on public.leads;
create policy "leads: el equipo lee"
  on public.leads for select to authenticated using (public.es_admin());
drop policy if exists "leads: el equipo inserta" on public.leads;
create policy "leads: el equipo inserta"
  on public.leads for insert to authenticated with check (public.es_admin());
drop policy if exists "leads: el equipo actualiza" on public.leads;
create policy "leads: el equipo actualiza"
  on public.leads for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "leads: el equipo borra" on public.leads;
create policy "leads: el equipo borra"
  on public.leads for delete to authenticated using (public.es_admin());

-- quotes
drop policy if exists "quotes: el equipo lee" on public.quotes;
create policy "quotes: el equipo lee"
  on public.quotes for select to authenticated using (public.es_admin());
drop policy if exists "quotes: el equipo inserta" on public.quotes;
create policy "quotes: el equipo inserta"
  on public.quotes for insert to authenticated with check (public.es_admin());
drop policy if exists "quotes: el equipo actualiza" on public.quotes;
create policy "quotes: el equipo actualiza"
  on public.quotes for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "quotes: el equipo borra" on public.quotes;
create policy "quotes: el equipo borra"
  on public.quotes for delete to authenticated using (public.es_admin());

-- consignments
drop policy if exists "consignments: el equipo lee" on public.consignments;
create policy "consignments: el equipo lee"
  on public.consignments for select to authenticated using (public.es_admin());
drop policy if exists "consignments: el equipo inserta" on public.consignments;
create policy "consignments: el equipo inserta"
  on public.consignments for insert to authenticated with check (public.es_admin());
drop policy if exists "consignments: el equipo actualiza" on public.consignments;
create policy "consignments: el equipo actualiza"
  on public.consignments for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "consignments: el equipo borra" on public.consignments;
create policy "consignments: el equipo borra"
  on public.consignments for delete to authenticated using (public.es_admin());


-- -----------------------------------------------------------------------------
--  C. SOLICITUDES DE COMPRA — "quiero un auto que no tienen"
-- -----------------------------------------------------------------------------

create table if not exists public.solicitudes_compra (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  marca text not null,
  modelo text not null,
  anio_min integer check (anio_min is null or anio_min between 1980 and 2100),
  anio_max integer check (anio_max is null or anio_max between 1980 and 2100),
  constraint solicitudes_compra_anios_coherentes
    check (anio_min is null or anio_max is null or anio_min <= anio_max),
  -- 'nuevo' | 'usado' | 'indistinto'. Texto y no el enum del motor porque acá
  -- "me da igual" es una respuesta válida.
  condicion text not null default 'indistinto'
    check (condicion in ('nuevo', 'usado', 'indistinto')),
  presupuesto_max_usd numeric(12, 2)
    check (presupuesto_max_usd is null or presupuesto_max_usd >= 0),
  notas text,

  estado public.estado_solicitud_compra not null default 'nueva',
  -- Lo que el equipo le responde. VISIBLE para el cliente a propósito: acá no
  -- hay notas internas, para eso están los leads.
  respuesta_luxcars text,
  atendido_por uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.solicitudes_compra is
  'Pedidos de búsqueda: el cliente quiere un auto que no está en stock ni en consignación. Los escribe el cliente con su sesión; el equipo los atiende desde /portal/solicitudes.';

create index if not exists solicitudes_compra_user_idx
  on public.solicitudes_compra (user_id, created_at desc);
create index if not exists solicitudes_compra_estado_idx
  on public.solicitudes_compra (estado, created_at desc);

drop trigger if exists solicitudes_compra_set_updated_at on public.solicitudes_compra;
create trigger solicitudes_compra_set_updated_at
  before update on public.solicitudes_compra
  for each row execute function public.tg_marcar_actualizado();

-- Lo único que un cliente puede cambiar de su solicitud es cerrarla.
create or replace function public.tg_proteger_solicitud_compra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.es_admin() then
    return new;
  end if;

  if new.user_id <> old.user_id
     or new.marca <> old.marca
     or new.modelo <> old.modelo
     or new.anio_min is distinct from old.anio_min
     or new.anio_max is distinct from old.anio_max
     or new.condicion <> old.condicion
     or new.presupuesto_max_usd is distinct from old.presupuesto_max_usd
     or new.notas is distinct from old.notas
     or new.respuesta_luxcars is distinct from old.respuesta_luxcars
     or new.atendido_por is distinct from old.atendido_por
  then
    raise exception 'Una solicitud enviada no se edita; si cambió lo que buscas, crea una nueva.';
  end if;

  if new.estado <> old.estado and new.estado <> 'cerrada' then
    raise exception 'Solo puedes cerrar tu solicitud; el resto de estados los maneja LuxCars.';
  end if;

  return new;
end;
$$;

drop trigger if exists solicitudes_compra_proteger on public.solicitudes_compra;
create trigger solicitudes_compra_proteger
  before update on public.solicitudes_compra
  for each row execute function public.tg_proteger_solicitud_compra();

alter table public.solicitudes_compra enable row level security;
revoke all on public.solicitudes_compra from anon, authenticated;
grant select, insert, update, delete on public.solicitudes_compra to authenticated;

drop policy if exists "solicitudes_compra: cliente crea la suya" on public.solicitudes_compra;
create policy "solicitudes_compra: cliente crea la suya"
  on public.solicitudes_compra for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and estado = 'nueva'
    and respuesta_luxcars is null
    and atendido_por is null
  );

drop policy if exists "solicitudes_compra: cliente lee las suyas" on public.solicitudes_compra;
create policy "solicitudes_compra: cliente lee las suyas"
  on public.solicitudes_compra for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "solicitudes_compra: cliente cierra la suya" on public.solicitudes_compra;
create policy "solicitudes_compra: cliente cierra la suya"
  on public.solicitudes_compra for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "solicitudes_compra: admin lee todas" on public.solicitudes_compra;
create policy "solicitudes_compra: admin lee todas"
  on public.solicitudes_compra for select to authenticated using (public.es_admin());
drop policy if exists "solicitudes_compra: admin actualiza" on public.solicitudes_compra;
create policy "solicitudes_compra: admin actualiza"
  on public.solicitudes_compra for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "solicitudes_compra: admin borra" on public.solicitudes_compra;
create policy "solicitudes_compra: admin borra"
  on public.solicitudes_compra for delete to authenticated using (public.es_admin());


-- -----------------------------------------------------------------------------
--  C. SOLICITUDES DE VENTA — "publiquen mi auto", con aprobación
-- -----------------------------------------------------------------------------

create table if not exists public.solicitudes_venta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  -- --- El auto, tal como lo describe el dueño -------------------------------
  marca text not null,
  modelo text not null,
  version text,
  anio integer not null check (anio between 1980 and 2100),
  categoria public.categoria_vehiculo not null default 'gasolina',
  kilometraje_km integer not null default 0 check (kilometraje_km >= 0),
  color text,
  placa text,
  -- Texto libre elegido de una lista en el formulario ("Impecable", etc.).
  condicion_declarada text,
  descripcion text,

  -- --- Precio que pide ------------------------------------------------------
  precio_pedido numeric(12, 2) not null check (precio_pedido >= 0),
  moneda public.moneda not null default 'USD',

  -- --- Contacto (copia, por si cambia el perfil después) --------------------
  telefono_contacto text not null,

  -- --- Revisión -------------------------------------------------------------
  estado public.estado_solicitud_venta not null default 'pendiente',
  motivo_rechazo text,
  revisado_por uuid references auth.users (id) on delete set null,
  revisado_en timestamptz,
  -- Se llenan al aprobar: la consignación y la ficha pública creadas.
  consignment_id uuid references public.consignments (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint solicitudes_venta_rechazo_exige_motivo
    check (estado <> 'rechazada' or motivo_rechazo is not null),
  constraint solicitudes_venta_aprobada_exige_vinculos
    check (estado <> 'aprobada' or (consignment_id is not null and vehicle_id is not null))
);

comment on table public.solicitudes_venta is
  'Autos que un cliente ofrece para consignación. Nacen pendientes; un admin las aprueba (crea consignación + ficha) o las rechaza con motivo. Sin exclusividad, como toda consignación.';

create index if not exists solicitudes_venta_user_idx
  on public.solicitudes_venta (user_id, created_at desc);
create index if not exists solicitudes_venta_estado_idx
  on public.solicitudes_venta (estado, created_at desc);

drop trigger if exists solicitudes_venta_set_updated_at on public.solicitudes_venta;
create trigger solicitudes_venta_set_updated_at
  before update on public.solicitudes_venta
  for each row execute function public.tg_marcar_actualizado();

-- El cliente edita su solicitud solo mientras está pendiente, y el único
-- cambio de estado que puede hacer es retirarla. Los campos de revisión son
-- del admin.
create or replace function public.tg_proteger_solicitud_venta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.es_admin() then
    return new;
  end if;

  if old.estado <> 'pendiente' then
    raise exception 'Esta solicitud ya fue revisada y no se puede modificar.';
  end if;

  if new.user_id <> old.user_id
     or new.motivo_rechazo is distinct from old.motivo_rechazo
     or new.revisado_por is distinct from old.revisado_por
     or new.revisado_en is distinct from old.revisado_en
     or new.consignment_id is distinct from old.consignment_id
     or new.vehicle_id is distinct from old.vehicle_id
  then
    raise exception 'Los campos de revisión los maneja LuxCars.';
  end if;

  if new.estado <> old.estado and new.estado <> 'retirada' then
    raise exception 'Solo puedes retirar tu solicitud; aprobarla o rechazarla es tarea de LuxCars.';
  end if;

  return new;
end;
$$;

drop trigger if exists solicitudes_venta_proteger on public.solicitudes_venta;
create trigger solicitudes_venta_proteger
  before update on public.solicitudes_venta
  for each row execute function public.tg_proteger_solicitud_venta();

alter table public.solicitudes_venta enable row level security;
revoke all on public.solicitudes_venta from anon, authenticated;
grant select, insert, update, delete on public.solicitudes_venta to authenticated;

drop policy if exists "solicitudes_venta: cliente crea la suya" on public.solicitudes_venta;
create policy "solicitudes_venta: cliente crea la suya"
  on public.solicitudes_venta for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and estado = 'pendiente'
    and motivo_rechazo is null
    and revisado_por is null
    and revisado_en is null
    and consignment_id is null
    and vehicle_id is null
  );

drop policy if exists "solicitudes_venta: cliente lee las suyas" on public.solicitudes_venta;
create policy "solicitudes_venta: cliente lee las suyas"
  on public.solicitudes_venta for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "solicitudes_venta: cliente edita la suya" on public.solicitudes_venta;
create policy "solicitudes_venta: cliente edita la suya"
  on public.solicitudes_venta for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "solicitudes_venta: admin lee todas" on public.solicitudes_venta;
create policy "solicitudes_venta: admin lee todas"
  on public.solicitudes_venta for select to authenticated using (public.es_admin());
drop policy if exists "solicitudes_venta: admin actualiza" on public.solicitudes_venta;
create policy "solicitudes_venta: admin actualiza"
  on public.solicitudes_venta for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "solicitudes_venta: admin borra" on public.solicitudes_venta;
create policy "solicitudes_venta: admin borra"
  on public.solicitudes_venta for delete to authenticated using (public.es_admin());


-- -----------------------------------------------------------------------------
--  APROBAR / RECHAZAR — en una sola transacción, desde el portal
-- -----------------------------------------------------------------------------
--  Aprobar crea TRES cosas coherentes entre sí: la consignación (con los datos
--  del dueño tomados del perfil), la ficha en `vehicles` con
--  `fuente = 'consignacion'` y el enlace de vuelta en la solicitud. Hacerlo en
--  tres llamadas desde el navegador dejaría estados a medias si una falla.
-- -----------------------------------------------------------------------------

create or replace function public.slug_vehiculo(p_marca text, p_modelo text, p_anio integer)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(coalesce(p_marca, '') || '-' || coalesce(p_modelo, '') || '-' || coalesce(p_anio::text, '')),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create or replace function public.aprobar_solicitud_venta(
  p_solicitud_id uuid,
  p_precio_venta numeric default null,
  p_comision_porcentaje numeric default 0.05,
  p_publicar boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.solicitudes_venta%rowtype;
  perfil public.profiles%rowtype;
  v_precio numeric;
  v_consignment_id uuid;
  v_vehicle_id uuid;
  v_slug text;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador aprueba solicitudes.';
  end if;

  select * into s from public.solicitudes_venta where id = p_solicitud_id for update;
  if not found then
    raise exception 'La solicitud no existe.';
  end if;
  if s.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue revisada (estado: %).', s.estado;
  end if;

  select * into perfil from public.profiles where id = s.user_id;
  if not found then
    raise exception 'El cliente de la solicitud ya no tiene perfil.';
  end if;

  v_precio := coalesce(p_precio_venta, s.precio_pedido);
  if v_precio < 0 then
    raise exception 'El precio de publicación no puede ser negativo.';
  end if;
  if p_comision_porcentaje is null or p_comision_porcentaje < 0 or p_comision_porcentaje > 1 then
    raise exception 'La comisión va de 0 a 1 (ej. 0.05 = 5%%).';
  end if;

  insert into public.consignments (
    propietario_nombre, propietario_telefono, propietario_email,
    marca, modelo, anio, version, placa, kilometraje_km, color,
    precio_pedido, moneda,
    tipo_comision, comision_porcentaje,
    estado, notas_internas, created_by
  ) values (
    coalesce(nullif(perfil.nombre, ''), perfil.email, 'Cliente sin nombre'),
    s.telefono_contacto, perfil.email,
    s.marca, s.modelo, s.anio, s.version, s.placa, s.kilometraje_km, s.color,
    v_precio, s.moneda,
    'porcentaje', p_comision_porcentaje,
    'activa',
    'Creada al aprobar la solicitud web ' || s.id::text
      || case when s.condicion_declarada is not null then '. Condición declarada: ' || s.condicion_declarada else '' end,
    auth.uid()
  )
  returning id into v_consignment_id;

  -- Slug único: base legible + sufijo corto. Un auto publicado exige slug.
  v_slug := public.slug_vehiculo(s.marca, s.modelo, s.anio)
            || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6);

  insert into public.vehicles (
    fuente, fuente_referencia,
    marca, modelo, version, anio, categoria,
    kilometraje_km, condicion, color_exterior, placa,
    precio_venta, moneda_venta, precio_negociable,
    estado, ubicacion,
    publicado, slug, titular, descripcion,
    notas_internas, created_by
  ) values (
    'consignacion', 'solicitud:' || s.id::text,
    s.marca, s.modelo, s.version, s.anio, s.categoria,
    s.kilometraje_km, 'usado', s.color, s.placa,
    v_precio, s.moneda, true,
    'disponible', 'Lima (con su dueño)',
    p_publicar, v_slug,
    trim(s.marca || ' ' || s.modelo || ' ' || coalesce(s.version, '') || ' ' || s.anio::text),
    s.descripcion,
    'Consignación ' || v_consignment_id::text
      || case when s.condicion_declarada is not null then '. Condición declarada por el dueño: ' || s.condicion_declarada else '' end,
    auth.uid()
  )
  returning id into v_vehicle_id;

  update public.consignments set vehicle_id = v_vehicle_id where id = v_consignment_id;

  update public.solicitudes_venta
     set estado = 'aprobada',
         consignment_id = v_consignment_id,
         vehicle_id = v_vehicle_id,
         revisado_por = auth.uid(),
         revisado_en = now()
   where id = s.id;

  return v_vehicle_id;
end;
$$;

comment on function public.aprobar_solicitud_venta(uuid, numeric, numeric, boolean) is
  'Solo admin. Crea consignación + ficha (fuente consignacion) y marca la solicitud como aprobada. Devuelve el id del vehículo.';

create or replace function public.rechazar_solicitud_venta(
  p_solicitud_id uuid,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado public.estado_solicitud_venta;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador rechaza solicitudes.';
  end if;
  if p_motivo is null or length(trim(p_motivo)) < 3 then
    raise exception 'Escribe el motivo: el cliente lo va a leer.';
  end if;

  select estado into v_estado from public.solicitudes_venta where id = p_solicitud_id for update;
  if not found then
    raise exception 'La solicitud no existe.';
  end if;
  if v_estado <> 'pendiente' then
    raise exception 'La solicitud ya fue revisada (estado: %).', v_estado;
  end if;

  update public.solicitudes_venta
     set estado = 'rechazada',
         motivo_rechazo = left(trim(p_motivo), 1000),
         revisado_por = auth.uid(),
         revisado_en = now()
   where id = p_solicitud_id;
end;
$$;

revoke all on function public.aprobar_solicitud_venta(uuid, numeric, numeric, boolean) from public;
revoke all on function public.rechazar_solicitud_venta(uuid, text) from public;
grant execute on function public.aprobar_solicitud_venta(uuid, numeric, numeric, boolean) to authenticated;
grant execute on function public.rechazar_solicitud_venta(uuid, text) to authenticated;
