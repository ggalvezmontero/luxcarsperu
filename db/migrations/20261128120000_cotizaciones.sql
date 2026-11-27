-- =============================================================================
--  Cotizaciones de importación a pedido (28 nov 2026)
-- =============================================================================
--  El equipo arma en /portal/cotizaciones la cotización que antes se hacía a
--  mano (la COT-2026-035 fue la última). Una cotización tiene un cliente de
--  contacto, uno o varios autos (cada uno con su importador, que por defecto es
--  el mismo cliente) y los costos del contenedor repartidos entre los autos.
--  La regla de cálculo vive en `src/core/cotizaciones/` y reutiliza
--  `src/core/pricing/` sin tocarlo; acá solo se guarda lo que escribió el
--  equipo (`datos`) y la foto del cálculo (`resultado`, `total_usd`).
--
--  Estados: borrador → enviada → aceptada | rechazada | vencida. La vigencia es
--  de 15 días desde que se marca enviada. Al aceptarla se abre un expediente por
--  auto con `crear_expediente` (nace en búsqueda: el contrato espera a que el
--  cliente apruebe la unidad desde su cuenta, compuerta `aprobar_unidad`) y,
--  si hay más de un auto, todos quedan en un mismo embarque consolidado.
--
--  1. Correlativo COT-AAAA-NNN por año (2026 arranca en 35: la 035 se emitió a mano)
--  2. Tabla `cotizaciones` y vínculo `expedientes.cotizacion_id`
--  3. RLS: solo el equipo, con `(select public.es_admin())`
--  4. Vista `cotizacion_cliente`: lo que el cliente ve en su cuenta
--  5. Funciones: guardar, cambiar estado, clientes de la cotización, aceptar
--
--  Idempotente. Después: `neon data-api refresh-schema …`.
-- =============================================================================

-- -----------------------------------------------------------------------------
--  1. Correlativo por año
-- -----------------------------------------------------------------------------

create table if not exists public.cotizacion_correlativos (
  anio integer primary key check (anio between 2020 and 2100),
  ultimo integer not null default 0 check (ultimo >= 0)
);

comment on table public.cotizacion_correlativos is
  'Último número de cotización emitido por año (COT-AAAA-NNN). 2026 arranca en 35: la COT-2026-035 se emitió a mano.';

insert into public.cotizacion_correlativos (anio, ultimo) values (2026, 35)
on conflict (anio) do nothing;

alter table public.cotizacion_correlativos enable row level security;
revoke all on public.cotizacion_correlativos from anonymous, authenticated;

-- -----------------------------------------------------------------------------
--  2. Tabla
-- -----------------------------------------------------------------------------

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^COT-[0-9]{4}-[0-9]{3,}$'),
  anio integer not null,
  numero integer not null,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida')),

  -- Cliente de contacto (a quien se dirige la cotización).
  cliente_tipo text not null check (cliente_tipo in ('persona', 'empresa')),
  cliente_nombre text not null check (length(cliente_nombre) between 2 and 200),
  cliente_documento text check (cliente_documento is null or length(cliente_documento) between 6 and 20),
  cliente_email text check (cliente_email is null or cliente_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  cliente_telefono text check (cliente_telefono is null or length(cliente_telefono) <= 40),
  -- Ficha de cliente cuando ya existe (o cuando se crea al aceptar).
  cliente_id uuid references public.clientes (id) on delete set null,

  -- Lo que escribió el equipo: autos (con su importador), costos del
  -- contenedor, reparto y perfil del importador. Ver src/core/cotizaciones/tipos.ts.
  datos jsonb not null check (jsonb_typeof(datos) = 'object'),
  -- Foto del cálculo al guardar (por auto y totales) y su total.
  resultado jsonb,
  total_usd numeric(14, 2),

  fecha date not null default current_date,
  vence_el date,
  enviada_en timestamptz,
  aceptada_en timestamptz,
  rechazada_en timestamptz,
  motivo text check (motivo is null or length(motivo) <= 1000),

  -- PDF y DOCX en el bucket PRIVADO `expedientes`, carpeta cotizaciones/<id>/.
  ruta_pdf text,
  ruta_docx text,
  documento_version integer not null default 0,
  documento_generado_en timestamptz,

  -- Expedientes abiertos al aceptarla (también apuntan acá con cotizacion_id).
  expediente_ids uuid[] not null default '{}',

  notas_internas text check (notas_internas is null or length(notas_internas) <= 4000),
  created_by uuid references neon_auth."user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anio, numero)
);

comment on table public.cotizaciones is
  'Cotizaciones de importación a pedido (COT-AAAA-NNN). `datos` es lo que escribió el equipo; `resultado` la foto del cálculo de src/core/cotizaciones. Al aceptarse abre un expediente por auto (`expediente_ids`, y `expedientes.cotizacion_id` al revés).';

create index if not exists cotizaciones_estado_idx on public.cotizaciones (estado, created_at desc);
create index if not exists cotizaciones_cliente_idx on public.cotizaciones (cliente_id);
create index if not exists cotizaciones_email_idx on public.cotizaciones (lower(cliente_email));

drop trigger if exists cotizaciones_set_updated_at on public.cotizaciones;
create trigger cotizaciones_set_updated_at
  before update on public.cotizaciones
  for each row execute function public.tg_marcar_actualizado();

alter table public.expedientes
  add column if not exists cotizacion_id uuid references public.cotizaciones (id) on delete set null,
  add column if not exists cotizacion_auto smallint check (cotizacion_auto is null or cotizacion_auto >= 1);

comment on column public.expedientes.cotizacion_id is
  'Cotización de la que nació el expediente. `cotizacion_auto` es el número del auto dentro de ella (1, 2…).';

create index if not exists expedientes_cotizacion_idx on public.expedientes (cotizacion_id) where cotizacion_id is not null;

-- -----------------------------------------------------------------------------
--  3. RLS: solo el equipo lee; se escribe solo por las funciones de abajo
-- -----------------------------------------------------------------------------

alter table public.cotizaciones enable row level security;
revoke all on public.cotizaciones from anonymous, authenticated;
grant select on public.cotizaciones to authenticated;

drop policy if exists "cotizaciones: el equipo lee" on public.cotizaciones;
create policy "cotizaciones: el equipo lee" on public.cotizaciones
  for select to authenticated using ((select public.es_admin()));

-- -----------------------------------------------------------------------------
--  4. Lo que ve el cliente: sus cotizaciones ya enviadas, con PDF
-- -----------------------------------------------------------------------------
--  Es suya si apunta a una ficha de cliente vinculada a su cuenta, o si el
--  correo de contacto es el de su cuenta (Neon Auth lo verifica con código,
--  el mismo cruce que vincula clientes y cuentas). Sin notas internas ni datos.

create or replace view public.cotizacion_cliente as
  select
    q.id, q.codigo, q.estado, q.fecha, q.vence_el, q.total_usd, q.cliente_nombre,
    q.documento_version, q.documento_generado_en, q.created_at
  from public.cotizaciones q
  where q.estado <> 'borrador'
    and q.ruta_pdf is not null
    and (
      q.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()))
      or (
        q.cliente_email is not null
        and lower(q.cliente_email) = (select lower(p.email) from public.profiles p where p.id = (select auth.uid()))
      )
    );

comment on view public.cotizacion_cliente is
  'Cotizaciones enviadas (con PDF) del cliente de la sesión: por ficha vinculada o por el correo verificado de su cuenta. Sin datos internos.';

revoke all on public.cotizacion_cliente from anonymous, authenticated;
grant select on public.cotizacion_cliente to authenticated;

-- -----------------------------------------------------------------------------
--  5. Funciones
-- -----------------------------------------------------------------------------

-- Crea (p_id nulo) o edita (solo en borrador) una cotización. Asigna el
-- correlativo del año al crearla.
create or replace function public.guardar_cotizacion(p_id uuid, p_datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_anio integer := extract(year from (now() at time zone 'America/Lima'))::integer;
  v_numero integer;
  v_estado text;
  v_cliente uuid;
  v_tipo text;
  v_doc text;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador arma cotizaciones.';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Faltan los datos de la cotización.';
  end if;
  if jsonb_typeof(p_datos->'datos') <> 'object'
     or jsonb_typeof(p_datos->'datos'->'autos') <> 'array'
     or jsonb_array_length(p_datos->'datos'->'autos') < 1 then
    raise exception 'La cotización necesita al menos un auto.';
  end if;
  if jsonb_array_length(p_datos->'datos'->'autos') > 10 then
    raise exception 'Una cotización lleva hasta diez autos.';
  end if;

  v_tipo := p_datos->>'cliente_tipo';
  if v_tipo not in ('persona', 'empresa') then
    raise exception 'Indica si el cliente es persona natural o empresa.';
  end if;
  v_doc := nullif(regexp_replace(coalesce(p_datos->>'cliente_documento', ''), '\s', '', 'g'), '');
  if v_tipo = 'empresa' and v_doc is not null and v_doc !~ '^[0-9]{11}$' then
    raise exception 'El RUC de la empresa tiene 11 dígitos.';
  end if;

  v_cliente := nullif(p_datos->>'cliente_id', '')::uuid;
  if v_cliente is not null and not exists (select 1 from public.clientes c where c.id = v_cliente) then
    raise exception 'Ese cliente no existe.';
  end if;

  if p_id is null then
    insert into public.cotizacion_correlativos as k (anio, ultimo) values (v_anio, 1)
    on conflict (anio) do update set ultimo = k.ultimo + 1
    returning ultimo into v_numero;

    insert into public.cotizaciones (
      codigo, anio, numero, cliente_tipo, cliente_nombre, cliente_documento, cliente_email, cliente_telefono,
      cliente_id, datos, resultado, total_usd, notas_internas, created_by
    ) values (
      'COT-' || v_anio || '-' || lpad(v_numero::text, 3, '0'), v_anio, v_numero,
      v_tipo, trim(p_datos->>'cliente_nombre'), v_doc,
      nullif(lower(trim(coalesce(p_datos->>'cliente_email', ''))), ''),
      nullif(trim(coalesce(p_datos->>'cliente_telefono', '')), ''),
      v_cliente, p_datos->'datos', p_datos->'resultado', (p_datos->>'total_usd')::numeric,
      nullif(left(trim(coalesce(p_datos->>'notas_internas', '')), 4000), ''), auth.uid()
    )
    returning id into v_id;
    return v_id;
  end if;

  select estado into v_estado from public.cotizaciones where id = p_id for update;
  if not found then
    raise exception 'La cotización no existe.';
  end if;
  if v_estado <> 'borrador' then
    raise exception 'Solo se edita una cotización en borrador. Vuélvela a borrador para cambiarla.';
  end if;

  update public.cotizaciones set
    cliente_tipo = v_tipo,
    cliente_nombre = trim(p_datos->>'cliente_nombre'),
    cliente_documento = v_doc,
    cliente_email = nullif(lower(trim(coalesce(p_datos->>'cliente_email', ''))), ''),
    cliente_telefono = nullif(trim(coalesce(p_datos->>'cliente_telefono', '')), ''),
    cliente_id = v_cliente,
    datos = p_datos->'datos',
    resultado = p_datos->'resultado',
    total_usd = (p_datos->>'total_usd')::numeric,
    notas_internas = nullif(left(trim(coalesce(p_datos->>'notas_internas', '')), 4000), '')
  where id = p_id;
  return p_id;
end;
$$;

comment on function public.guardar_cotizacion(uuid, jsonb) is
  'Solo admin. Crea la cotización con el siguiente COT-AAAA-NNN (p_id nulo) o la edita si está en borrador.';

-- Cambia el estado: enviada (fija vigencia de 15 días), rechazada, vencida o
-- de vuelta a borrador. La aceptación va por aceptar_cotizacion().
create or replace function public.cambiar_estado_cotizacion(p_id uuid, p_estado text, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.cotizaciones%rowtype;
  v_hoy date := (now() at time zone 'America/Lima')::date;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador cambia el estado de una cotización.';
  end if;
  select * into q from public.cotizaciones where id = p_id for update;
  if not found then
    raise exception 'La cotización no existe.';
  end if;
  if q.estado = 'aceptada' then
    raise exception 'La cotización ya fue aceptada y abrió sus expedientes: no cambia de estado.';
  end if;

  case p_estado
    when 'enviada' then
      if q.estado <> 'borrador' then
        raise exception 'Solo se envía una cotización en borrador.';
      end if;
      if q.ruta_pdf is null then
        raise exception 'Genera el PDF antes de marcarla como enviada.';
      end if;
      update public.cotizaciones
         set estado = 'enviada', enviada_en = now(), vence_el = v_hoy + 15, motivo = null
       where id = p_id;
    when 'rechazada' then
      if q.estado not in ('enviada', 'vencida') then
        raise exception 'Solo se rechaza una cotización enviada.';
      end if;
      update public.cotizaciones
         set estado = 'rechazada', rechazada_en = now(), motivo = nullif(left(trim(coalesce(p_motivo, '')), 1000), '')
       where id = p_id;
    when 'vencida' then
      if q.estado <> 'enviada' then
        raise exception 'Solo vence una cotización enviada.';
      end if;
      update public.cotizaciones set estado = 'vencida' where id = p_id;
    when 'borrador' then
      if q.estado not in ('enviada', 'rechazada', 'vencida') then
        raise exception 'La cotización ya está en borrador.';
      end if;
      update public.cotizaciones
         set estado = 'borrador', enviada_en = null, vence_el = null, rechazada_en = null, motivo = null
       where id = p_id;
    else
      raise exception 'Estado no reconocido: %.', p_estado;
  end case;
end;
$$;

comment on function public.cambiar_estado_cotizacion(uuid, text, text) is
  'Solo admin. borrador → enviada (exige PDF; vigencia 15 días) → rechazada | vencida; o de vuelta a borrador para corregirla.';

-- Busca o crea la ficha de cliente de cada importador de la cotización (por
-- RUC, por DNI o por correo; si no hay, la crea). Devuelve un arreglo con el id
-- del cliente de cada auto, en orden. Idempotente: se puede llamar de nuevo.
create or replace function public.clientes_de_cotizacion(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.cotizaciones%rowtype;
  a jsonb;
  imp jsonb;
  v_tipo text;
  v_nombre text;
  v_doc text;
  v_email text;
  v_tel text;
  v_cliente uuid;
  v_ids jsonb := '[]'::jsonb;
  v_contacto uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador acepta cotizaciones.';
  end if;
  select * into q from public.cotizaciones where id = p_id for update;
  if not found then
    raise exception 'La cotización no existe.';
  end if;
  if q.estado not in ('enviada', 'vencida') then
    raise exception 'Solo se acepta una cotización enviada.';
  end if;

  for a in select * from jsonb_array_elements(q.datos->'autos') loop
    imp := a->'importador';
    if imp is null or jsonb_typeof(imp) <> 'object' then
      -- El importador es el cliente de contacto.
      imp := jsonb_build_object(
        'tipo', q.cliente_tipo, 'nombre', q.cliente_nombre, 'documento', q.cliente_documento,
        'email', q.cliente_email, 'telefono', q.cliente_telefono, 'cliente_id', q.cliente_id
      );
    end if;
    v_tipo := coalesce(imp->>'tipo', 'persona');
    v_nombre := trim(coalesce(imp->>'nombre', ''));
    v_doc := nullif(regexp_replace(coalesce(imp->>'documento', ''), '\s', '', 'g'), '');
    v_email := nullif(lower(trim(coalesce(imp->>'email', ''))), '');
    v_tel := nullif(trim(coalesce(imp->>'telefono', '')), '');
    v_cliente := nullif(imp->>'cliente_id', '')::uuid;

    if v_cliente is not null and not exists (select 1 from public.clientes c where c.id = v_cliente) then
      v_cliente := null;
    end if;
    if v_cliente is null and v_doc is not null then
      if v_tipo = 'empresa' then
        select c.id into v_cliente from public.clientes c where c.ruc = v_doc limit 1;
      else
        select c.id into v_cliente from public.clientes c where c.dni = v_doc order by c.created_at limit 1;
      end if;
    end if;
    if v_cliente is null and v_email is not null then
      select c.id into v_cliente from public.clientes c
       where c.email = v_email and c.tipo::text = v_tipo
       order by c.created_at limit 1;
    end if;
    if v_cliente is null then
      if length(v_nombre) < 2 then
        raise exception 'Falta el nombre o la razón social de un importador.';
      end if;
      if v_doc is null then
        raise exception 'Falta el documento de %: RUC si es empresa, DNI o carné si es persona.', v_nombre;
      end if;
      if v_tipo = 'empresa' and v_doc !~ '^[0-9]{11}$' then
        raise exception 'El RUC de % tiene 11 dígitos.', v_nombre;
      end if;
      insert into public.clientes (tipo, razon_social, ruc, dni, email, telefono, created_by)
      values (
        v_tipo::public.tipo_cliente, left(v_nombre, 200),
        case when v_tipo = 'empresa' then v_doc end,
        case when v_tipo = 'persona' then v_doc end,
        v_email, left(v_tel, 40), auth.uid()
      )
      returning id into v_cliente;
    end if;
    v_ids := v_ids || to_jsonb(v_cliente::text);
  end loop;

  -- La ficha del contacto: la del importador cuando coincide, o la que ya tenía.
  if q.cliente_id is null and q.cliente_documento is not null then
    select c.id into v_contacto from public.clientes c
     where (q.cliente_tipo = 'empresa' and c.ruc = q.cliente_documento)
        or (q.cliente_tipo = 'persona' and c.dni = q.cliente_documento)
     order by c.created_at limit 1;
    if v_contacto is not null then
      update public.cotizaciones set cliente_id = v_contacto where id = p_id;
    end if;
  end if;

  return v_ids;
end;
$$;

comment on function public.clientes_de_cotizacion(uuid) is
  'Solo admin. Busca (RUC, DNI o correo) o crea la ficha de cliente de cada importador de la cotización; devuelve sus ids en el orden de los autos.';

-- Acepta la cotización: abre un expediente por auto con crear_expediente (los
-- datos los arma el core en el navegador: vehículo, presupuesto con las cifras
-- de la cotización, hitos y tareas), los enlaza y, con más de un auto, los
-- deja en un mismo embarque consolidado. Todo o nada.
create or replace function public.aceptar_cotizacion(p_id uuid, p_expedientes jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.cotizaciones%rowtype;
  d jsonb;
  v_n integer;
  v_i integer := 0;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_embarque uuid;
  v_codigo text;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador acepta cotizaciones.';
  end if;
  select * into q from public.cotizaciones where id = p_id for update;
  if not found then
    raise exception 'La cotización no existe.';
  end if;
  if q.estado = 'aceptada' then
    raise exception 'La cotización ya fue aceptada.';
  end if;
  if q.estado not in ('enviada', 'vencida') then
    raise exception 'Solo se acepta una cotización enviada.';
  end if;
  if p_expedientes is null or jsonb_typeof(p_expedientes) <> 'array' then
    raise exception 'Faltan los datos de los expedientes.';
  end if;
  v_n := jsonb_array_length(q.datos->'autos');
  if jsonb_array_length(p_expedientes) <> v_n then
    raise exception 'Hace falta un expediente por cada auto de la cotización (% autos).', v_n;
  end if;

  for d in select * from jsonb_array_elements(p_expedientes) loop
    v_i := v_i + 1;
    if jsonb_typeof(d) <> 'object' then
      raise exception 'Los datos del expediente % no son válidos.', v_i;
    end if;
    -- Nace en búsqueda: el contrato espera la aprobación de la unidad del cliente.
    d := d || jsonb_build_object('etapa', 'busqueda');
    d := d - 'embarque_id' - 'embarque_nuevo';
    if v_n > 1 then
      if v_embarque is null then
        d := d || jsonb_build_object('embarque_nuevo', jsonb_build_object(
          'modalidad', 'consolidado',
          'puerto_destino', 'Callao',
          'notas_internas', 'Contenedor de la cotización ' || q.codigo || ' (' || v_n || ' autos).'
        ));
      else
        d := d || jsonb_build_object('embarque_id', v_embarque);
      end if;
    end if;

    v_id := public.crear_expediente(d);

    update public.expedientes set cotizacion_id = p_id, cotizacion_auto = v_i
     where id = v_id
     returning codigo, embarque_id into v_codigo, v_embarque;

    insert into public.expediente_eventos (expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa)
    values (
      v_id, 'nota', 'Abierto desde la cotización ' || q.codigo,
      'Auto ' || v_i || ' de ' || v_n || ' de la cotización ' || q.codigo || ', con sus mismas cifras.',
      false, auth.uid(), 'admin', 'busqueda'
    );

    v_ids := v_ids || v_id;
  end loop;

  update public.cotizaciones
     set estado = 'aceptada', aceptada_en = now(), expediente_ids = v_ids,
         cliente_id = coalesce(cliente_id, (select e.cliente_id from public.expedientes e where e.id = v_ids[1]))
   where id = p_id;

  return v_ids;
end;
$$;

comment on function public.aceptar_cotizacion(uuid, jsonb) is
  'Solo admin. Marca la cotización como aceptada y abre un expediente por auto con crear_expediente (en búsqueda, con cotizacion_id y cotizacion_auto); con varios autos los agrupa en un embarque consolidado nuevo. Devuelve los ids.';

revoke all on function public.guardar_cotizacion(uuid, jsonb) from public;
revoke all on function public.cambiar_estado_cotizacion(uuid, text, text) from public;
revoke all on function public.clientes_de_cotizacion(uuid) from public;
revoke all on function public.aceptar_cotizacion(uuid, jsonb) from public;
grant execute on function public.guardar_cotizacion(uuid, jsonb) to authenticated;
grant execute on function public.cambiar_estado_cotizacion(uuid, text, text) to authenticated;
grant execute on function public.clientes_de_cotizacion(uuid) to authenticated;
grant execute on function public.aceptar_cotizacion(uuid, jsonb) to authenticated;
