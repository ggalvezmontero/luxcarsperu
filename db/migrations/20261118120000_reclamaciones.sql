-- =============================================================================
--  Migración 0015 · reclamaciones — Libro de Reclamaciones virtual
-- =============================================================================
--
--  Luxcars vende por internet, así que debe tener Libro de Reclamaciones
--  virtual (Código de Protección y Defensa del Consumidor, Ley 29571, y su
--  reglamento, D.S. 011-2011-PCM y modificatorias). Cada hoja lleva número
--  correlativo, fecha, los datos del consumidor, el bien contratado, el
--  detalle (reclamo o queja), el pedido, y la respuesta del proveedor, que
--  debe llegar en quince (15) días hábiles.
--
--  QUIÉN ESCRIBE
--  ---------------------------------------------------------------------------
--  El consumidor no tiene cuenta: el formulario público llama a un Route
--  Handler que inserta con `DATABASE_URL`, igual que `leads`. Ni `anonymous`
--  ni `authenticated` tienen INSERT. Leer y responder es solo para admins
--  (`es_admin()`), desde /admin/reclamaciones.
--
--  DATOS PERSONALES
--  ---------------------------------------------------------------------------
--  Hay nombre, documento, domicilio y contacto: son los campos que la norma
--  exige en la hoja. Se guarda lo que pide la hoja y nada más (sin IP).
-- =============================================================================

do $$ begin
  create type public.tipo_reclamacion as enum ('reclamo', 'queja');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_reclamacion as enum ('recibida', 'respondida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_bien_reclamado as enum ('producto', 'servicio');
exception when duplicate_object then null; end $$;

create sequence if not exists public.reclamacion_numero_seq;

create table if not exists public.reclamaciones (
  id uuid primary key default gen_random_uuid(),
  -- Número de hoja: LR-AAAA-0001, correlativo. Es lo que se le da al consumidor.
  numero text not null unique
    default 'LR-' || to_char(now(), 'YYYY') || '-'
            || lpad(nextval('public.reclamacion_numero_seq')::text, 4, '0'),

  tipo public.tipo_reclamacion not null,
  estado public.estado_reclamacion not null default 'recibida',

  -- 1. Identificación del consumidor reclamante
  consumidor_nombre text not null check (length(consumidor_nombre) between 2 and 160),
  consumidor_documento text not null check (length(consumidor_documento) between 6 and 20),
  consumidor_domicilio text not null check (length(consumidor_domicilio) between 3 and 240),
  consumidor_telefono text check (consumidor_telefono is null or length(consumidor_telefono) <= 40),
  consumidor_email text
    check (consumidor_email is null or consumidor_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint reclamaciones_requiere_un_contacto
    check (consumidor_telefono is not null or consumidor_email is not null),
  -- Menor de edad: nombre del padre, madre o apoderado.
  apoderado_nombre text check (apoderado_nombre is null or length(apoderado_nombre) <= 160),

  -- 2. Identificación del bien contratado
  bien_tipo public.tipo_bien_reclamado not null,
  bien_descripcion text not null check (length(bien_descripcion) between 3 and 500),
  monto_reclamado_usd numeric(12, 2) check (monto_reclamado_usd is null or monto_reclamado_usd >= 0),

  -- 3. Detalle de la reclamación y pedido del consumidor
  detalle text not null check (length(detalle) between 10 and 4000),
  pedido text not null check (length(pedido) between 3 and 2000),

  -- 4. Observaciones y acciones adoptadas por el proveedor
  respuesta text check (respuesta is null or length(respuesta) <= 4000),
  respondida_en timestamptz,
  respondida_por uuid references neon_auth."user" (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reclamaciones_respondida_con_texto
    check (estado <> 'respondida' or (respuesta is not null and respondida_en is not null))
);

comment on table public.reclamaciones is
  'Libro de Reclamaciones virtual (Ley 29571). Una fila por hoja; el número correlativo es el que recibe el consumidor.';

create index if not exists reclamaciones_created_idx on public.reclamaciones (created_at desc);
create index if not exists reclamaciones_estado_idx on public.reclamaciones (estado);

drop trigger if exists reclamaciones_set_updated_at on public.reclamaciones;
create trigger reclamaciones_set_updated_at
  before update on public.reclamaciones
  for each row execute function public.tg_marcar_actualizado();

-- -----------------------------------------------------------------------------
--  Seguridad: nada para anonymous; authenticated lee y responde solo si es admin
-- -----------------------------------------------------------------------------
alter table public.reclamaciones enable row level security;
revoke all on public.reclamaciones from anonymous, authenticated;
grant select, update on public.reclamaciones to authenticated;

drop policy if exists "reclamaciones: el equipo lee" on public.reclamaciones;
create policy "reclamaciones: el equipo lee"
  on public.reclamaciones for select
  to authenticated
  using (public.es_admin());

drop policy if exists "reclamaciones: el equipo responde" on public.reclamaciones;
create policy "reclamaciones: el equipo responde"
  on public.reclamaciones for update
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());
