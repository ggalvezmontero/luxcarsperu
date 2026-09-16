-- =============================================================================
--  Migración 0006 · leads — consultas entrantes
-- =============================================================================
--
--  CÓMO ENTRA UN LEAD SI EL CLIENTE NO TIENE CUENTA
--  ---------------------------------------------------------------------------
--  El cliente nunca se registra: llena un formulario y sigue por WhatsApp.
--  Entonces, ¿quién hace el INSERT?
--
--  DECISIÓN: lo hace un Route Handler de Next.js en Vercel usando la
--  SUPABASE_SERVICE_ROLE_KEY (variable de entorno SOLO de servidor, jamás
--  NEXT_PUBLIC_*). El rol `service_role` no pasa por RLS, así que esta tabla
--  NO otorga ningún permiso de escritura a `anon`.
--
--  POR QUÉ NO SE LE DA INSERT A `anon`
--  ---------------------------------------------------------------------------
--  Porque la llave anónima viaja al navegador y es pública por diseño.
--  Cualquiera podría insertar leads en masa desde la consola, o escribir
--  directamente `estado = 'ganado'` y ensuciar el embudo. Con el Route Handler
--  de por medio, el servidor valida, limpia y decide qué campos se escriben.
--
--  Si en algún momento se decide abrir el INSERT a `anon`, hace falta además:
--  rate limiting, captcha y una política WITH CHECK que fije `estado = 'nuevo'`
--  y prohíba escribir los campos internos. No es un cambio de una línea.
--
--  DATOS PERSONALES
--  ---------------------------------------------------------------------------
--  Acá hay datos personales de ciudadanos peruanos (Ley 29733). Se guarda lo
--  mínimo para poder responder: nombre, teléfono, correo y lo que la persona
--  escribió. A propósito NO se guarda dirección IP ni huella de navegador:
--  no aportan a vender un auto y sí aumentan la exposición.
-- =============================================================================

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),

  origen public.origen_lead not null,
  estado public.estado_lead not null default 'nuevo',

  -- --- Contacto -------------------------------------------------------------
  nombre text not null,
  telefono text,
  email text
    check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

  -- Sin teléfono ni correo no hay forma de responderle. Un lead así es ruido.
  constraint leads_requiere_un_contacto
    check (telefono is not null or email is not null),

  -- --- Interés --------------------------------------------------------------
  -- Puede apuntar a un auto del stock, o describir lo que busca cuando aún no
  -- existe la unidad (típico de importación a pedido).
  vehicle_id uuid references public.vehicles (id) on delete set null,
  interes_marca text,
  interes_modelo text,
  interes_anio integer
    check (interes_anio is null or interes_anio between 1980 and 2100),
  presupuesto_usd numeric(12, 2)
    check (presupuesto_usd is null or presupuesto_usd >= 0),

  mensaje text,

  -- --- Atribución -----------------------------------------------------------
  pagina_origen text,       -- ruta desde la que se envió
  utm_source text,
  utm_medium text,
  utm_campaign text,

  -- --- Seguimiento interno --------------------------------------------------
  asignado_a uuid references auth.users (id) on delete set null,
  notas_internas text,
  contactado_en timestamptz,
  cerrado_en timestamptz,
  motivo_perdida text,
  whatsapp_enviado boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leads_perdido_exige_motivo
    check (estado <> 'perdido' or motivo_perdida is not null)
);

comment on table public.leads is
  'Consultas entrantes. Se escriben desde Route Handlers de Vercel con service_role: anon no tiene INSERT. Contiene datos personales (Ley 29733).';
comment on column public.leads.vehicle_id is
  'Auto del stock consultado. NULL en importación a pedido, donde la unidad todavía no existe.';
comment on column public.leads.notas_internas is
  'Uso interno del equipo. Nunca se expone fuera del portal.';

-- El embudo se mira siempre así: por estado, lo más reciente arriba.
create index if not exists leads_estado_created_idx
  on public.leads (estado, created_at desc);

create index if not exists leads_origen_idx
  on public.leads (origen);

create index if not exists leads_created_idx
  on public.leads (created_at desc);

create index if not exists leads_vehicle_id_idx
  on public.leads (vehicle_id)
  where vehicle_id is not null;

create index if not exists leads_asignado_idx
  on public.leads (asignado_a)
  where asignado_a is not null;

-- Para detectar al mismo interesado que vuelve a escribir.
create index if not exists leads_telefono_idx
  on public.leads (telefono)
  where telefono is not null;

create index if not exists leads_email_idx
  on public.leads (lower(email))
  where email is not null;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.tg_marcar_actualizado();


-- Sella las fechas del embudo sola: un equipo chico no va a llenarlas a mano.
create or replace function public.tg_sellar_embudo_lead()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado then
    if new.estado <> 'nuevo' and new.contactado_en is null then
      new.contactado_en := now();
    end if;
    if new.estado in ('ganado', 'perdido') and new.cerrado_en is null then
      new.cerrado_en := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_sellar_embudo on public.leads;
create trigger leads_sellar_embudo
  before update on public.leads
  for each row execute function public.tg_sellar_embudo_lead();


-- -----------------------------------------------------------------------------
--  RLS — sin acceso anónimo de ningún tipo
-- -----------------------------------------------------------------------------
alter table public.leads enable row level security;

revoke all on public.leads from anon, authenticated;
grant select, insert, update, delete on public.leads to authenticated;

drop policy if exists "leads: el equipo lee" on public.leads;
create policy "leads: el equipo lee"
  on public.leads for select
  to authenticated
  using (true);

drop policy if exists "leads: el equipo inserta" on public.leads;
create policy "leads: el equipo inserta"
  on public.leads for insert
  to authenticated
  with check (true);

drop policy if exists "leads: el equipo actualiza" on public.leads;
create policy "leads: el equipo actualiza"
  on public.leads for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "leads: el equipo borra" on public.leads;
create policy "leads: el equipo borra"
  on public.leads for delete
  to authenticated
  using (true);
