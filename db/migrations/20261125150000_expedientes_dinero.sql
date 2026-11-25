-- =============================================================================
--  Migración 0018 · expedientes de importación (fase 3: dinero)
-- =============================================================================
--
--  El LIBRO del expediente: cada depósito del cliente, cada pago a un tercero
--  por su cuenta, cada devolución y cada ajuste es un MOVIMIENTO con moneda,
--  tipo de cambio, monto en USD, comprobante y a qué hito se aplica. El estado
--  de cada hito (pendiente, parcial, acreditado) NO se guarda: lo deriva el
--  core (`src/core/expedientes/ledger.ts`) al leer, sumando los depósitos
--  confirmados. Las compuertas "H2 acreditado" y "H3 acreditado" lo consumen.
--
--  Diseño en docs/operaciones/portal-expedientes-diseno-2026-11-24.md (§4,
--  §5.1 a §5.4, §6 y §7). Reglas de las fases 1 y 2 que se respetan:
--
--    · La tabla base es solo del equipo (`es_admin()`); el cliente lee por la
--      vista `expediente_movimiento_cliente`, sin nota interna ni ruta del
--      comprobante, y solo los estados por_confirmar y confirmado.
--    · El cliente NO inserta en la tabla: declara un depósito por
--      `cliente_accion_expediente('declarar_deposito')`, que lo deja
--      `por_confirmar` con `declarado_por_cliente = true`. El equipo lo
--      confirma (o lo anula con motivo) con `registrar_movimiento`, y al
--      confirmarlo la ruta de servidor emite la constancia de fondos.
--    · `registrar_movimiento` es SECURITY INVOKER como `registrar_documento`
--      (fase 2): la llama un administrador por la Data API o el servidor
--      (conexión del dueño) con `p_actor`. `uid_sesion()` da el usuario.
--    · Los comprobantes viven en el bucket PRIVADO `expedientes`
--      (`expedientes/{expedienteId}/comprobantes/…`); acá solo la ruta.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. TIPOS
-- -----------------------------------------------------------------------------
--  Espejo exacto de `Movimiento["tipo"]` y `Movimiento["estado"]` en
--  src/core/expedientes/tipos.ts. `cuenta_movimiento` y `tipo_hito` ya existen.

do $$ begin
  create type public.tipo_movimiento as enum ('deposito', 'pago', 'devolucion', 'ajuste');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_movimiento as enum ('por_confirmar', 'confirmado', 'anulado');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
--  2. TABLA
-- -----------------------------------------------------------------------------

create table if not exists public.expediente_movimientos (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes (id) on delete cascade,
  tipo public.tipo_movimiento not null,
  cuenta public.cuenta_movimiento not null default 'fondos_clientes',
  -- A qué hito se aplica (depósitos del cliente; en los pagos, H3 = tributos y gastos).
  hito public.tipo_hito,
  estado public.estado_movimiento not null default 'confirmado',
  fecha date not null default current_date,
  moneda text not null default 'USD' check (moneda ~ '^[A-Z]{3}$'),
  monto numeric(14, 2) not null check (monto > 0),
  -- USD por una unidad de `moneda`. Con USD es 1.
  tipo_cambio numeric(10, 4) not null default 1 check (tipo_cambio > 0),
  monto_usd numeric(14, 2) not null check (monto_usd > 0),
  contraparte_id uuid references public.contrapartes (id) on delete set null,
  concepto text check (concepto is null or length(concepto) <= 200),
  -- Factura, SWIFT, DAM, número de operación bancaria, banco de origen.
  documento_ref text check (documento_ref is null or length(documento_ref) <= 200),
  -- Ruta del comprobante en el bucket privado `expedientes`. Nunca una URL.
  comprobante_path text check (comprobante_path is null or length(comprobante_path) <= 300),
  declarado_por_cliente boolean not null default false,
  nota_interna text check (nota_interna is null or length(nota_interna) <= 2000),
  created_by uuid references neon_auth."user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expediente_movimientos is
  'Libro del expediente: depósitos del cliente, pagos a terceros por su cuenta, devoluciones y ajustes, en su moneda y en USD. Solo cuentan los `confirmado`; un depósito declarado por el cliente nace `por_confirmar`. El estado de los hitos lo deriva el core al leer.';

create index if not exists expediente_movimientos_exp_idx
  on public.expediente_movimientos (expediente_id, fecha desc, created_at desc);
create index if not exists expediente_movimientos_hito_idx
  on public.expediente_movimientos (expediente_id, hito, estado);

drop trigger if exists expediente_movimientos_set_updated_at on public.expediente_movimientos;
create trigger expediente_movimientos_set_updated_at
  before update on public.expediente_movimientos
  for each row execute function public.tg_marcar_actualizado();

-- Las columnas `movimiento_id` de la fase 1 se declararon sin FK.
alter table public.expediente_eventos
  drop constraint if exists expediente_eventos_movimiento_fk;
alter table public.expediente_eventos
  add constraint expediente_eventos_movimiento_fk
  foreign key (movimiento_id) references public.expediente_movimientos (id) on delete set null;

-- Los documentos que nacen del libro apuntan a su movimiento (constancia) o a
-- su hito (aviso H3). Columnas previstas en el diseño (§5.2), no creadas en la fase 2.
alter table public.expediente_documentos
  add column if not exists movimiento_id uuid references public.expediente_movimientos (id) on delete set null;
alter table public.expediente_documentos
  add column if not exists hito public.tipo_hito;


-- -----------------------------------------------------------------------------
--  3. SEGURIDAD — tabla base solo del equipo
-- -----------------------------------------------------------------------------

alter table public.expediente_movimientos enable row level security;
revoke all on public.expediente_movimientos from anonymous, authenticated;
grant select, insert, update, delete on public.expediente_movimientos to authenticated;

drop policy if exists "expediente_movimientos: el equipo lee" on public.expediente_movimientos;
create policy "expediente_movimientos: el equipo lee"
  on public.expediente_movimientos for select to authenticated
  using (public.es_admin());

drop policy if exists "expediente_movimientos: el equipo inserta" on public.expediente_movimientos;
create policy "expediente_movimientos: el equipo inserta"
  on public.expediente_movimientos for insert to authenticated
  with check (public.es_admin());

drop policy if exists "expediente_movimientos: el equipo actualiza" on public.expediente_movimientos;
create policy "expediente_movimientos: el equipo actualiza"
  on public.expediente_movimientos for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "expediente_movimientos: el equipo borra" on public.expediente_movimientos;
create policy "expediente_movimientos: el equipo borra"
  on public.expediente_movimientos for delete to authenticated
  using (public.es_admin());


-- -----------------------------------------------------------------------------
--  4. VISTA DEL CLIENTE — su estado de cuenta, sin nota interna ni rutas
-- -----------------------------------------------------------------------------
--  Corre como el dueño de la base (sin security_invoker) y filtra adentro. Los
--  anulados no se muestran. El comprobante se baja por
--  /api/cuenta/expedientes/archivos?movimiento=…, que vuelve a comprobar la
--  propiedad con la tabla base antes de firmar la URL.

create or replace view public.expediente_movimiento_cliente as
  select
    m.id, m.expediente_id, m.tipo, m.cuenta, m.hito, m.estado, m.fecha,
    m.moneda, m.monto, m.tipo_cambio, m.monto_usd, m.concepto, m.documento_ref,
    (m.comprobante_path is not null) as tiene_comprobante,
    m.declarado_por_cliente, m.created_at
  from public.expediente_movimientos m
  join public.expedientes e on e.id = m.expediente_id
  where m.estado in ('por_confirmar', 'confirmado')
    and e.etapa <> 'prospecto'
    and public.es_dueno_expediente(e.cliente_id);

comment on view public.expediente_movimiento_cliente is
  'Movimientos que el cliente ve de SUS expedientes: depósitos (confirmados y por confirmar), pagos a terceros, devoluciones y ajustes. Sin nota interna, sin ruta del comprobante, sin anulados.';

revoke all on public.expediente_movimiento_cliente from anonymous, authenticated;
grant select on public.expediente_movimiento_cliente to authenticated;

-- La vista de documentos del cliente gana las dos columnas nuevas (al final:
-- una vista no admite reordenar columnas con `create or replace`).
drop view if exists public.expediente_documento_cliente;
create view public.expediente_documento_cliente as
  select
    d.id, d.expediente_id, d.tipo, d.version, d.estado, d.titulo,
    (d.ruta_firmado is not null) as tiene_firmado,
    (d.ruta_pdf is not null) as tiene_pdf,
    d.emitido_en, d.firmado_en, d.created_at,
    d.movimiento_id, d.hito
  from public.expediente_documentos d
  join public.expedientes e on e.id = d.expediente_id
  where d.visible_cliente
    and d.estado <> 'borrador'
    and e.etapa <> 'prospecto'
    and public.es_dueno_expediente(e.cliente_id);

comment on view public.expediente_documento_cliente is
  'Documentos que el cliente puede ver de SUS expedientes (visible_cliente). Sin rutas de objeto, sin snapshot de campos ni versión de plantilla: el archivo solo sale por URL firmada.';

revoke all on public.expediente_documento_cliente from anonymous, authenticated;
grant select on public.expediente_documento_cliente to authenticated;


-- -----------------------------------------------------------------------------
--  5. FUNCIONES
-- -----------------------------------------------------------------------------

-- Clave de la tarea del cliente que corresponde a cada hito, y la del equipo
-- que confirma el depósito. Son las claves de src/core/expedientes/etapas.ts.
create or replace function public.tarea_cliente_de_hito(p_hito public.tipo_hito)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_hito
    when 'H1' then 'cliente.pagar_h1'
    when 'H2' then 'cliente.depositar_h2'
    when 'H3' then 'cliente.depositar_h3'
    when 'H4' then 'cliente.pagar_h4'
  end;
$$;

create or replace function public.tarea_luxcars_de_hito(p_hito public.tipo_hito)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_hito
    when 'H2' then 'luxcars.confirmar_h2'
    when 'H3' then 'luxcars.confirmar_h3'
    else null
  end;
$$;

revoke all on function public.tarea_cliente_de_hito(public.tipo_hito) from public;
revoke all on function public.tarea_luxcars_de_hito(public.tipo_hito) from public;
grant execute on function public.tarea_cliente_de_hito(public.tipo_hito) to authenticated;
grant execute on function public.tarea_luxcars_de_hito(public.tipo_hito) to authenticated;


-- Marca hecha una tarea del expediente por su clave si está pendiente, con el
-- movimiento como referencia en el evento. Interna (sin grant).
create or replace function public.cerrar_tarea_por_clave(
  p_expediente uuid,
  p_clave text,
  p_actor uuid,
  p_movimiento uuid,
  p_etapa public.etapa_expediente
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t public.expediente_tareas%rowtype;
begin
  if p_clave is null then
    return;
  end if;
  select * into t
  from public.expediente_tareas
  where expediente_id = p_expediente and clave = p_clave
  for update;
  if not found or t.estado <> 'pendiente' then
    return;
  end if;
  update public.expediente_tareas
     set estado = 'hecha', hecha_en = now(), hecha_por = p_actor
   where id = t.id;
  insert into public.expediente_eventos (
    expediente_id, tipo, titulo, visible_cliente, actor_id, actor_tipo, etapa, tarea_id, movimiento_id
  ) values (
    p_expediente, 'tarea', 'Listo: ' || t.titulo, t.visible_cliente, p_actor, 'admin', p_etapa, t.id, p_movimiento
  );
end;
$$;

revoke all on function public.cerrar_tarea_por_clave(uuid, text, uuid, uuid, public.etapa_expediente) from public;
grant execute on function public.cerrar_tarea_por_clave(uuid, text, uuid, uuid, public.etapa_expediente) to authenticated;


-- Suma de depósitos confirmados aplicados a un hito. Es la misma regla que
-- `acreditadoPorHito` del core; acá solo para decidir si la tarea del equipo
-- "confirmar Hn" queda hecha al confirmar (tolerancia de un dólar, como el core).
create or replace function public.hito_acreditado(p_expediente uuid, p_hito public.tipo_hito)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select sum(m.monto_usd)
    from public.expediente_movimientos m
    where m.expediente_id = p_expediente and m.hito = p_hito
      and m.tipo = 'deposito' and m.estado = 'confirmado'
  ), 0) + 1 >= coalesce((
    select h.monto_estimado_usd
    from public.expediente_hitos h
    where h.expediente_id = p_expediente and h.tipo = p_hito
  ), 0);
$$;

revoke all on function public.hito_acreditado(uuid, public.tipo_hito) from public;
grant execute on function public.hito_acreditado(uuid, public.tipo_hito) to authenticated;


-- Registra un asiento del libro, o resuelve uno `por_confirmar`.
--
--   · Sin `id`: inserta el movimiento como `confirmado` (tipo, cuenta, hito,
--     fecha, moneda, monto, tipo_cambio → monto_usd, contraparte_id, concepto,
--     documento_ref, comprobante_path, nota_interna) y deja el evento, visible
--     al cliente si es depósito, pago a tercero o devolución.
--   · Con `id` de un movimiento `por_confirmar`: lo CONFIRMA (admite corregir
--     monto, fecha, tipo de cambio, hito, concepto y referencia con lo que
--     realmente llegó), o lo ANULA si `estado = 'anulado'` (exige `motivo`).
--
--  Al confirmar o insertar un depósito con hito, la tarea del cliente de ese
--  hito queda hecha, y si el hito queda acreditado también la del equipo
--  ("confirmar H2/H3"). La función NO recalcula el estado del hito: eso lo
--  deriva el core al leer. Devuelve el id del movimiento.
create or replace function public.registrar_movimiento(
  p_mov jsonb,
  p_actor uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := coalesce(public.uid_sesion(), p_actor);
  v_id uuid := (p_mov->>'id')::uuid;
  e public.expedientes%rowtype;
  m public.expediente_movimientos%rowtype;
  v_tipo public.tipo_movimiento;
  v_cuenta public.cuenta_movimiento;
  v_hito public.tipo_hito;
  v_estado text := coalesce(p_mov->>'estado', 'confirmado');
  v_fecha date;
  v_moneda text;
  v_monto numeric;
  v_tc numeric;
  v_monto_usd numeric;
  v_motivo text := nullif(trim(coalesce(p_mov->>'motivo', '')), '');
  v_concepto text;
  v_titulo text;
begin
  if not public.puede_escribir_documentos() then
    raise exception 'Solo un administrador registra movimientos.';
  end if;
  if p_mov is null or jsonb_typeof(p_mov) <> 'object' then
    raise exception 'Faltan los datos del movimiento.';
  end if;

  -- ------------------------------------------------------------------
  -- Resolver uno declarado por el cliente (confirmar o anular)
  -- ------------------------------------------------------------------
  if v_id is not null then
    select * into m from public.expediente_movimientos where id = v_id for update;
    if not found then
      raise exception 'El movimiento no existe.';
    end if;
    if m.estado <> 'por_confirmar' then
      raise exception 'Este movimiento ya está %: no se puede volver a resolver.', m.estado;
    end if;
    select * into e from public.expedientes where id = m.expediente_id for update;

    if v_estado = 'anulado' then
      if v_motivo is null or length(v_motivo) < 5 then
        raise exception 'Anular un depósito declarado exige un motivo (mínimo cinco caracteres).';
      end if;
      update public.expediente_movimientos
         set estado = 'anulado',
             nota_interna = left(concat_ws(E'\n', nota_interna, 'Anulado: ' || v_motivo), 2000)
       where id = m.id;
      insert into public.expediente_eventos (
        expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, movimiento_id
      ) values (
        m.expediente_id, 'movimiento',
        'No pudimos confirmar el depósito que declaraste',
        left(v_motivo, 4000), true, v_actor, 'admin', e.etapa, m.id
      );
      return m.id;
    end if;

    if v_estado <> 'confirmado' then
      raise exception 'Un movimiento declarado solo se confirma o se anula.';
    end if;

    v_fecha := coalesce((p_mov->>'fecha')::date, m.fecha);
    v_moneda := upper(coalesce(nullif(trim(p_mov->>'moneda'), ''), m.moneda));
    v_monto := coalesce((p_mov->>'monto')::numeric, m.monto);
    v_tc := coalesce((p_mov->>'tipo_cambio')::numeric, case when v_moneda = 'USD' then 1 else m.tipo_cambio end);
    v_monto_usd := coalesce((p_mov->>'monto_usd')::numeric, round(v_monto * v_tc, 2));
    v_hito := coalesce((p_mov->>'hito')::public.tipo_hito, m.hito);
    if v_monto <= 0 or v_tc <= 0 or v_monto_usd <= 0 then
      raise exception 'El monto y el tipo de cambio deben ser mayores que cero.';
    end if;

    update public.expediente_movimientos
       set estado = 'confirmado',
           fecha = v_fecha,
           moneda = v_moneda,
           monto = v_monto,
           tipo_cambio = v_tc,
           monto_usd = v_monto_usd,
           hito = v_hito,
           cuenta = coalesce((p_mov->>'cuenta')::public.cuenta_movimiento, cuenta),
           concepto = left(coalesce(nullif(trim(p_mov->>'concepto'), ''), concepto), 200),
           documento_ref = left(coalesce(nullif(trim(p_mov->>'documento_ref'), ''), documento_ref), 200),
           comprobante_path = left(coalesce(nullif(trim(p_mov->>'comprobante_path'), ''), comprobante_path), 300),
           nota_interna = left(coalesce(nullif(trim(p_mov->>'nota_interna'), ''), nota_interna), 2000)
     where id = m.id;

    insert into public.expediente_eventos (
      expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, movimiento_id
    ) values (
      m.expediente_id, 'movimiento',
      'Depósito confirmado' || case when v_hito is not null then ' · ' || v_hito else '' end,
      'USD ' || to_char(v_monto_usd, 'FM999,999,990.00') || ' acreditados el ' || to_char(v_fecha, 'DD/MM/YYYY') || '.',
      true, v_actor, 'admin', e.etapa, m.id
    );

    if v_hito is not null then
      perform public.cerrar_tarea_por_clave(m.expediente_id, public.tarea_cliente_de_hito(v_hito), v_actor, m.id, e.etapa);
      if public.hito_acreditado(m.expediente_id, v_hito) then
        perform public.cerrar_tarea_por_clave(m.expediente_id, public.tarea_luxcars_de_hito(v_hito), v_actor, m.id, e.etapa);
      end if;
    end if;
    return m.id;
  end if;

  -- ------------------------------------------------------------------
  -- Asiento nuevo, confirmado
  -- ------------------------------------------------------------------
  select * into e from public.expedientes where id = (p_mov->>'expediente_id')::uuid for update;
  if not found then
    raise exception 'El expediente no existe.';
  end if;
  if e.etapa = 'prospecto' then
    raise exception 'Un prospecto no tiene libro: abre el expediente en contrato primero.';
  end if;

  begin
    v_tipo := (p_mov->>'tipo')::public.tipo_movimiento;
  exception when others then
    raise exception 'El tipo de movimiento no es válido (deposito, pago, devolucion o ajuste).';
  end;
  if v_tipo is null then
    raise exception 'Falta el tipo de movimiento.';
  end if;
  v_cuenta := coalesce((p_mov->>'cuenta')::public.cuenta_movimiento, 'fondos_clientes');
  v_hito := (p_mov->>'hito')::public.tipo_hito;
  v_fecha := coalesce((p_mov->>'fecha')::date, current_date);
  v_moneda := upper(coalesce(nullif(trim(p_mov->>'moneda'), ''), 'USD'));
  v_monto := (p_mov->>'monto')::numeric;
  v_tc := coalesce((p_mov->>'tipo_cambio')::numeric, case when v_moneda = 'USD' then 1 else null end);
  if v_monto is null or v_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero.';
  end if;
  if v_tc is null or v_tc <= 0 then
    raise exception 'Falta el tipo de cambio a dólares de la moneda %.', v_moneda;
  end if;
  v_monto_usd := coalesce((p_mov->>'monto_usd')::numeric, round(v_monto * v_tc, 2));
  if v_monto_usd <= 0 then
    raise exception 'El monto en dólares debe ser mayor que cero.';
  end if;
  if v_estado not in ('confirmado', 'por_confirmar') then
    raise exception 'Un movimiento nuevo nace confirmado o por confirmar.';
  end if;
  v_concepto := left(nullif(trim(p_mov->>'concepto'), ''), 200);

  insert into public.expediente_movimientos (
    expediente_id, tipo, cuenta, hito, estado, fecha, moneda, monto, tipo_cambio, monto_usd,
    contraparte_id, concepto, documento_ref, comprobante_path, declarado_por_cliente, nota_interna, created_by
  ) values (
    e.id, v_tipo, v_cuenta, v_hito, v_estado::public.estado_movimiento, v_fecha, v_moneda, v_monto, v_tc, v_monto_usd,
    (p_mov->>'contraparte_id')::uuid, v_concepto,
    left(nullif(trim(p_mov->>'documento_ref'), ''), 200),
    left(nullif(trim(p_mov->>'comprobante_path'), ''), 300),
    false, left(nullif(trim(p_mov->>'nota_interna'), ''), 2000), v_actor
  )
  returning id into v_id;

  v_titulo := case v_tipo
    when 'deposito' then 'Depósito ' || case when v_estado = 'confirmado' then 'confirmado' else 'registrado' end
      || case when v_hito is not null then ' · ' || v_hito else '' end
    when 'pago' then 'Pago por tu cuenta' || case when v_concepto is not null then ': ' || v_concepto else '' end
    when 'devolucion' then 'Devolución de saldo'
    else 'Ajuste del libro' || case when v_concepto is not null then ': ' || v_concepto else '' end
  end;

  insert into public.expediente_eventos (
    expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, movimiento_id
  ) values (
    e.id, 'movimiento', left(v_titulo, 300),
    'USD ' || to_char(v_monto_usd, 'FM999,999,990.00')
      || case when v_moneda <> 'USD' then ' (' || v_moneda || ' ' || to_char(v_monto, 'FM999,999,990.00') || ' × ' || v_tc || ')' else '' end
      || ' · ' || to_char(v_fecha, 'DD/MM/YYYY') || '.',
    v_tipo in ('deposito', 'pago', 'devolucion'), v_actor, 'admin', e.etapa, v_id
  );

  if v_tipo = 'deposito' and v_estado = 'confirmado' and v_hito is not null then
    perform public.cerrar_tarea_por_clave(e.id, public.tarea_cliente_de_hito(v_hito), v_actor, v_id, e.etapa);
    if public.hito_acreditado(e.id, v_hito) then
      perform public.cerrar_tarea_por_clave(e.id, public.tarea_luxcars_de_hito(v_hito), v_actor, v_id, e.etapa);
    end if;
  end if;

  return v_id;
end;
$$;

comment on function public.registrar_movimiento(jsonb, uuid) is
  'Admin o servidor. Inserta un asiento confirmado del libro (o confirma/anula uno declarado por el cliente cuando trae `id`), deja el evento y cierra la tarea del cliente del hito. El estado del hito lo deriva el core al leer. Devuelve el id.';

revoke all on function public.registrar_movimiento(jsonb, uuid) from public;
grant execute on function public.registrar_movimiento(jsonb, uuid) to authenticated;


-- `registrar_documento` gana `p_movimiento` (constancia) y `p_hito` (aviso H3).
-- Se reemplaza la firma anterior para que no queden dos sobrecargas.
drop function if exists public.registrar_documento(uuid, public.documento_tipo, text, text, jsonb, text, text, text, uuid, boolean);

create or replace function public.registrar_documento(
  p_expediente uuid,
  p_tipo public.documento_tipo,
  p_titulo text,
  p_plantilla_version text,
  p_campos jsonb,
  p_ruta_pdf text,
  p_ruta_docx text,
  p_tarea_clave text default null,
  p_actor uuid default null,
  p_visible_cliente boolean default false,
  p_movimiento uuid default null,
  p_hito public.tipo_hito default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := coalesce(public.uid_sesion(), p_actor);
  v_version integer;
  v_id uuid;
  e public.expedientes%rowtype;
  t public.expediente_tareas%rowtype;
begin
  if not public.puede_escribir_documentos() then
    raise exception 'Solo un administrador emite documentos.';
  end if;

  select * into e from public.expedientes where id = p_expediente for update;
  if not found then
    raise exception 'El expediente no existe.';
  end if;
  if p_titulo is null or length(trim(p_titulo)) < 2 then
    raise exception 'El documento necesita un título.';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.expediente_documentos
  where expediente_id = p_expediente and tipo = p_tipo;

  -- Las constancias son una por depósito: solo se reemplaza la de ESE movimiento.
  update public.expediente_documentos
     set estado = 'reemplazado'
   where expediente_id = p_expediente
     and tipo = p_tipo
     and estado in ('borrador', 'emitido')
     and (p_tipo <> 'constancia_fondos' or movimiento_id is not distinct from p_movimiento);

  insert into public.expediente_documentos (
    expediente_id, tipo, version, estado, origen, titulo, plantilla_version, campos,
    ruta_pdf, ruta_docx, visible_cliente, emitido_por, emitido_en, created_by, movimiento_id, hito
  ) values (
    p_expediente, p_tipo, v_version, 'emitido', 'generado', left(trim(p_titulo), 200),
    left(p_plantilla_version, 80), p_campos,
    left(p_ruta_pdf, 300), left(p_ruta_docx, 300), coalesce(p_visible_cliente, false),
    v_actor, now(), v_actor, p_movimiento, p_hito
  )
  returning id into v_id;

  insert into public.expediente_eventos (
    expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, documento_id, movimiento_id
  ) values (
    p_expediente, 'documento',
    'Documento generado: ' || left(trim(p_titulo), 200),
    'Versión ' || v_version || case when v_version > 1 then ' (reemplaza a la anterior).' else '.' end,
    false, v_actor, 'admin', e.etapa, v_id, p_movimiento
  );

  if p_tarea_clave is not null then
    select * into t
    from public.expediente_tareas
    where expediente_id = p_expediente and clave = p_tarea_clave
    for update;
    if found and t.estado = 'pendiente' then
      update public.expediente_tareas
         set estado = 'hecha', hecha_en = now(), hecha_por = v_actor, documento_id = v_id
       where id = t.id;
      insert into public.expediente_eventos (
        expediente_id, tipo, titulo, visible_cliente, actor_id, actor_tipo, etapa, tarea_id, documento_id
      ) values (
        p_expediente, 'tarea', 'Listo: ' || t.titulo, t.visible_cliente, v_actor, 'admin', t.etapa, t.id, v_id
      );
    elsif found then
      update public.expediente_tareas
         set documento_id = v_id
       where id = t.id;
    end if;
  end if;

  return jsonb_build_object('id', v_id, 'version', v_version);
end;
$$;

comment on function public.registrar_documento(uuid, public.documento_tipo, text, text, jsonb, text, text, text, uuid, boolean, uuid, public.tipo_hito) is
  'Admin o servidor. Inserta la versión siguiente del documento con su snapshot y rutas, marca la anterior reemplazada (en constancias, solo la del mismo movimiento), deja el evento y completa la tarea asociada. Devuelve {id, version}.';

revoke all on function public.registrar_documento(uuid, public.documento_tipo, text, text, jsonb, text, text, text, uuid, boolean, uuid, public.tipo_hito) from public;
grant execute on function public.registrar_documento(uuid, public.documento_tipo, text, text, jsonb, text, text, text, uuid, boolean, uuid, public.tipo_hito) to authenticated;


-- Acción del cliente desde su cuenta (fase 1), ahora con `declarar_deposito`:
-- valida monto, fecha, banco, hito y comprobante opcional; inserta el
-- movimiento `por_confirmar` con `declarado_por_cliente = true`, la aprobación
-- y el evento visible. La tarea del hito NO se marca: queda hecha cuando el
-- equipo confirma el depósito (`registrar_movimiento`). Se puede declarar más
-- de un depósito para el mismo hito (pagos parciales).
create or replace function public.cliente_accion_expediente(
  p_expediente uuid,
  p_tipo public.tipo_aprobacion,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.expedientes%rowtype;
  t public.expediente_tareas%rowtype;
  v_clave text;
  v_titulo text;
  v_aprobacion uuid;
  v_movimiento uuid;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_hito public.tipo_hito;
  v_monto numeric;
  v_fecha date;
  v_banco text;
  v_operacion text;
  v_comprobante text;
  v_cuenta public.cuenta_movimiento;
begin
  if auth.uid() is null or not public.perfil_activo() then
    raise exception 'Tu sesión no está activa.';
  end if;

  select * into e from public.expedientes where id = p_expediente for update;
  if not found or not public.es_dueno_expediente(e.cliente_id) then
    raise exception 'Este expediente no es tuyo.';
  end if;
  if e.etapa in ('prospecto', 'cerrado', 'cancelado') then
    raise exception 'Este expediente no admite acciones en su estado actual.';
  end if;
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception 'Los datos de la acción no son válidos.';
  end if;

  case p_tipo
    when 'aprobar_inspeccion' then
      v_clave := 'cliente.aprobar_inspeccion';
      v_titulo := 'Aprobaste la inspección y el precio';
    when 'elegir_consolidado' then
      v_clave := 'cliente.elegir_consolidado';
      if coalesce(v_payload->>'eleccion', '') not in ('esperar', 'embarcar_solo') then
        raise exception 'Elige una opción: esperar al consolidado o embarcar solo.';
      end if;
      v_titulo := case when v_payload->>'eleccion' = 'esperar'
        then 'Elegiste esperar al consolidado' else 'Elegiste embarcar solo' end;
    when 'conformidad_rendicion' then
      v_clave := 'cliente.conformidad_rendicion';
      v_titulo := 'Diste conformidad a la rendición de cuentas';
    when 'confirmar_cuentas' then
      v_clave := 'cliente.confirmar_cuentas';
      v_titulo := 'Confirmaste las cuentas bancarias de Luxcars';
    when 'declarar_deposito' then
      begin
        v_hito := (v_payload->>'hito')::public.tipo_hito;
      exception when others then
        raise exception 'Indica a qué hito corresponde el depósito (H1 a H4).';
      end;
      if v_hito is null then
        raise exception 'Indica a qué hito corresponde el depósito (H1 a H4).';
      end if;
      v_clave := public.tarea_cliente_de_hito(v_hito);
      v_titulo := 'Declaraste un depósito del hito ' || v_hito;
      begin
        v_monto := (v_payload->>'monto')::numeric;
      exception when others then
        raise exception 'El monto no es un número válido.';
      end;
      if v_monto is null or v_monto <= 0 then
        raise exception 'El monto debe ser mayor que cero.';
      end if;
      begin
        v_fecha := (v_payload->>'fecha')::date;
      exception when others then
        raise exception 'La fecha del depósito no es válida.';
      end;
      if v_fecha is null or v_fecha > current_date + 1 then
        raise exception 'Indica la fecha en que hiciste la transferencia.';
      end if;
      v_banco := nullif(trim(coalesce(v_payload->>'banco', '')), '');
      if v_banco is null or length(v_banco) < 2 then
        raise exception 'Indica el banco desde el que transferiste.';
      end if;
      v_operacion := nullif(trim(coalesce(v_payload->>'operacion', '')), '');
      v_comprobante := nullif(trim(coalesce(v_payload->>'comprobante_path', '')), '');
      if v_comprobante is not null
         and v_comprobante !~ ('^expedientes/' || p_expediente::text || '/comprobantes/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp|heic)$') then
        raise exception 'El comprobante no pertenece a este expediente.';
      end if;
    else
      raise exception 'Acción no reconocida.';
  end case;

  select * into t
  from public.expediente_tareas
  where expediente_id = p_expediente and clave = v_clave
  for update;
  if not found then
    raise exception 'Esta acción no está pendiente en tu expediente.';
  end if;
  if t.estado <> 'pendiente' then
    raise exception 'Esta acción ya fue registrada.';
  end if;

  if p_tipo = 'declarar_deposito' then
    select h.cuenta into v_cuenta from public.expediente_hitos h where h.expediente_id = p_expediente and h.tipo = v_hito;
    insert into public.expediente_movimientos (
      expediente_id, tipo, cuenta, hito, estado, fecha, moneda, monto, tipo_cambio, monto_usd,
      concepto, documento_ref, comprobante_path, declarado_por_cliente, created_by
    ) values (
      p_expediente, 'deposito',
      coalesce(v_cuenta, case when v_hito in ('H1', 'H4') then 'operaciones'::public.cuenta_movimiento else 'fondos_clientes'::public.cuenta_movimiento end),
      v_hito, 'por_confirmar', v_fecha, 'USD', round(v_monto, 2), 1, round(v_monto, 2),
      left('Depósito ' || v_hito || ' declarado por el cliente', 200),
      left(v_banco || case when v_operacion is not null then ' · op. ' || v_operacion else '' end, 200),
      left(v_comprobante, 300), true, auth.uid()
    )
    returning id into v_movimiento;
  end if;

  insert into public.expediente_aprobaciones (expediente_id, tipo, payload, user_id, agente_usuario)
  values (
    p_expediente, p_tipo,
    (v_payload - 'agente_usuario') || case when v_movimiento is not null then jsonb_build_object('movimiento_id', v_movimiento) else '{}'::jsonb end,
    auth.uid(), left(v_payload->>'agente_usuario', 400)
  )
  returning id into v_aprobacion;

  if p_tipo <> 'declarar_deposito' then
    update public.expediente_tareas
       set estado = 'hecha', hecha_en = now(), hecha_por = auth.uid()
     where id = t.id;
  end if;

  insert into public.expediente_eventos (
    expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, tarea_id, aprobacion_id, movimiento_id
  ) values (
    p_expediente, 'aprobacion', v_titulo,
    case when p_tipo = 'declarar_deposito'
      then 'USD ' || to_char(round(v_monto, 2), 'FM999,999,990.00') || ' el ' || to_char(v_fecha, 'DD/MM/YYYY') || ' desde ' || v_banco || '. Lo confirmamos en cuanto se acredite.'
      else left(v_payload->>'comentario', 2000) end,
    true, auth.uid(), 'cliente', e.etapa, t.id, v_aprobacion, v_movimiento
  );

  return v_aprobacion;
end;
$$;

comment on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) is
  'Cliente dueño. Registra una decisión (aprobar inspección, elegir consolidado, conformidad, confirmar cuentas, declarar depósito) como aprobación con fecha y usuario, marca la tarea (salvo declarar_deposito, que deja un movimiento por_confirmar) y deja el evento. Única vía de escritura del cliente en el módulo.';

revoke all on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) from public;
grant execute on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) to authenticated;
