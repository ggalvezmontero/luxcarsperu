-- =============================================================================
--  Migración 0014 · cotizaciones del cotizador interno de envíos
-- =============================================================================
--
--  Caso que se cotizaba a mano: un cliente que vive en Estados Unidos quiere
--  traer al Perú SU propio vehículo, por la Ley del Retorno (Ley 30001) o como
--  importación regular. Desde esta migración el equipo lo cotiza en
--  /admin/cotizador-envios y cada cotización queda guardada con fecha, cliente
--  y estado (borrador, enviada, aceptada).
--
--  POR QUÉ UNA TABLA NUEVA Y NO `quotes`
--  ---------------------------------------------------------------------------
--  `quotes` está modelada sobre la calculadora pública (precio de compra en
--  Miami, plan Fast Track / Estándar, comisión escalonada, percepción siempre
--  presente). Acá no hay compra, el régimen puede no tener tributos y los
--  costos los fija el administrador a mano. Forzarlo exigiría volver opcional
--  media tabla. Mejor una tabla propia, con la misma filosofía de `quotes`:
--  la ENTRADA exacta (para reproducir) y el RESULTADO exacto (para honrar lo
--  que se le dijo al cliente), ambos en JSON, más las columnas que el historial
--  necesita para listar y filtrar.
--
--  QUIÉN ESCRIBE
--  ---------------------------------------------------------------------------
--  Solo el servidor, desde los Route Handlers de /api/admin/cotizaciones-envio,
--  con `DATABASE_URL` y después de `verificarSesionPortal()` (sesión de Neon
--  Auth con perfil `admin` activo). Las políticas RLS para `authenticated`
--  exigen `es_admin()`, igual que el resto del esquema, por si algún día se
--  lee desde el navegador con la sesión del equipo; `anonymous` no ve nada.
--
--  El motor es `src/core/envios/`, que reutiliza `src/core/pricing/`. Como con
--  `quotes`, la lógica no se reimplementa en SQL.
-- =============================================================================

do $$ begin
  create type public.estado_cotizacion_envio as enum ('borrador', 'enviada', 'aceptada');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Espejo exacto de RegimenEnvio (src/core/envios/tipos.ts)
  create type public.regimen_envio as enum ('ley-retorno', 'importacion-regular');
exception when duplicate_object then null; end $$;

create sequence if not exists public.cotizacion_envio_numero_seq;

create table if not exists public.cotizaciones_envio (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique
    default 'EN-' || to_char(now(), 'YYYY') || '-'
            || lpad(nextval('public.cotizacion_envio_numero_seq')::text, 4, '0'),

  -- Cliente, para el historial. El detalle completo va en `entrada`.
  cliente_nombre text not null
    check (length(cliente_nombre) between 1 and 160),
  cliente_whatsapp text not null
    check (length(cliente_whatsapp) <= 40),

  -- Vehículo, para listar sin abrir el JSON.
  marca text not null check (length(marca) <= 80),
  modelo text not null check (length(modelo) <= 120),
  anio_modelo integer not null check (anio_modelo between 1980 and 2100),

  regimen public.regimen_envio not null,
  estado public.estado_cotizacion_envio not null default 'borrador',

  -- Total referencial del régimen elegido, sin percepción. Para el historial.
  total_usd numeric(12, 2) not null check (total_usd >= 0),

  entrada jsonb not null,     -- EntradaCotizacionEnvio exacta
  resultado jsonb not null,   -- ResultadoCotizacionEnvio exacto
  motor_version text not null default 'src/core/envios@2026.11',

  created_by uuid references neon_auth."user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cotizaciones_envio is
  'Cotizaciones del cotizador interno de envíos (traer al Perú el auto propio desde EE.UU., por Ley del Retorno o importación regular). Guarda entrada y resultado completos para reproducir y defender la cotización.';
comment on column public.cotizaciones_envio.entrada is
  'EntradaCotizacionEnvio exacta (src/core/envios/tipos.ts). Permite recalcular y volver a abrir la cotización en el formulario.';
comment on column public.cotizaciones_envio.resultado is
  'ResultadoCotizacionEnvio exacto que vio el administrador al guardar. Permite honrar lo que se le dijo al cliente aunque cambien las tasas.';
comment on column public.cotizaciones_envio.total_usd is
  'Total referencial del régimen elegido. NO incluye la percepción del IGV, que es un adelanto recuperable.';

create index if not exists cotizaciones_envio_created_idx
  on public.cotizaciones_envio (created_at desc);
create index if not exists cotizaciones_envio_estado_idx
  on public.cotizaciones_envio (estado);

drop trigger if exists cotizaciones_envio_set_updated_at on public.cotizaciones_envio;
create trigger cotizaciones_envio_set_updated_at
  before update on public.cotizaciones_envio
  for each row execute function public.tg_marcar_actualizado();

-- -----------------------------------------------------------------------------
--  Seguridad: nada para anonymous; authenticated solo si es admin
-- -----------------------------------------------------------------------------
alter table public.cotizaciones_envio enable row level security;
revoke all on public.cotizaciones_envio from anonymous, authenticated;
grant select, insert, update, delete on public.cotizaciones_envio to authenticated;
grant usage, select on sequence public.cotizacion_envio_numero_seq to authenticated;

drop policy if exists "cotizaciones_envio: el equipo lee" on public.cotizaciones_envio;
create policy "cotizaciones_envio: el equipo lee"
  on public.cotizaciones_envio for select
  to authenticated
  using (public.es_admin());

drop policy if exists "cotizaciones_envio: el equipo inserta" on public.cotizaciones_envio;
create policy "cotizaciones_envio: el equipo inserta"
  on public.cotizaciones_envio for insert
  to authenticated
  with check (public.es_admin());

drop policy if exists "cotizaciones_envio: el equipo actualiza" on public.cotizaciones_envio;
create policy "cotizaciones_envio: el equipo actualiza"
  on public.cotizaciones_envio for update
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "cotizaciones_envio: el equipo borra" on public.cotizaciones_envio;
create policy "cotizaciones_envio: el equipo borra"
  on public.cotizaciones_envio for delete
  to authenticated
  using (public.es_admin());
