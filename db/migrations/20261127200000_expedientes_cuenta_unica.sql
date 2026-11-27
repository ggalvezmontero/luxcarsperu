-- =============================================================================
--  Migración 0023 · expedientes: UNA sola cuenta para el cliente,
--  autodetracción por defecto y "Pago N de 5" (decisiones del dueño del
--  27 nov 2026, segunda ronda; manda sobre la migración 0022)
-- =============================================================================
--
--  A. Una sola cuenta para el cliente. Los Pagos 1, 2, 3 y 5 van a Fondos de
--     Clientes; el Pago 4 (tributos) sigue directo a SUNAT. El Pago 2 es UNA
--     transferencia (flete, seguro y la primera mitad de los honorarios) que
--     se registra con el hito H2 y acredita H2 y H3 en orden (primero H2, el
--     resto a H3): `hito_acreditado` reparte lo depositado entre los hitos del
--     mismo pago, como `acreditadoPorHito` del core. H2 y H3 comparten la
--     tarea del cliente (`cliente.depositar_h2`) y la de confirmación
--     (`luxcars.confirmar_h2`). El cliente ya no ve la cuenta de Operaciones:
--     la vista `expediente_movimiento_cliente` la oculta, igual que los
--     asientos internos de detracciones.
--
--  B. Honorarios y autodetracción. `registrar_movimiento` acepta
--     `operacion`:
--       · aplicar_honorarios: al emitir la factura 1 o 2, un pago desde
--         Fondos de Clientes y un depósito en Operaciones, sin hito, con el
--         número de factura; cierra `luxcars.factura_h3` / `_h6`.
--       · autodetraccion: un pago desde Operaciones y un depósito en
--         detracciones, sin hito, con el número de constancia del Banco de la
--         Nación; cierra `luxcars.autodetraccion_h3` / `_h6`.
--     La tarea de autodetracción nace al confirmar el pago que cubre la
--     factura de un cliente empresa, con vencimiento a cinco días hábiles con
--     los feriados de Perú: la crea el servidor con el core
--     (`tareasTrasConfirmar`), no esta migración, para que los feriados vivan
--     en un solo lugar.
--
--  C. Lo que ve el cliente dice "Pago N de 5", nunca H1 a H6: títulos y
--     conceptos de `cliente_accion_expediente` y `registrar_movimiento`
--     (`pago_de_hito`).
--
--  Idempotente. Ningún valor de enum nuevo.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. Pago de cada hito y tareas por hito (H2 y H3 son un solo pago)
-- -----------------------------------------------------------------------------

create or replace function public.pago_de_hito(p_hito public.tipo_hito)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_hito::text
    when 'H1' then 1
    when 'H2' then 2
    when 'H3' then 2
    when 'H4' then 3
    when 'H5' then 4
    when 'H6' then 5
  end;
$$;

comment on function public.pago_de_hito(public.tipo_hito) is
  'Número del pago del cliente (1 a 5) al que pertenece cada hito interno: H2 y H3 forman el Pago 2. Mismo mapa que PAGO_POR_HITO del core.';

revoke all on function public.pago_de_hito(public.tipo_hito) from public;
grant execute on function public.pago_de_hito(public.tipo_hito) to authenticated;

create or replace function public.tarea_cliente_de_hito(p_hito public.tipo_hito)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_hito::text
    when 'H1' then 'cliente.depositar_h1'
    when 'H2' then 'cliente.depositar_h2'
    when 'H3' then 'cliente.depositar_h2'
    when 'H4' then 'cliente.depositar_h4'
    when 'H5' then 'cliente.depositar_h5'
    when 'H6' then 'cliente.depositar_h6'
  end;
$$;

create or replace function public.tarea_luxcars_de_hito(p_hito public.tipo_hito)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_hito::text
    when 'H1' then 'luxcars.confirmar_h1'
    when 'H2' then 'luxcars.confirmar_h2'
    when 'H3' then 'luxcars.confirmar_h2'
    when 'H4' then 'luxcars.confirmar_h4'
    when 'H5' then 'luxcars.confirmar_h5'
    when 'H6' then 'luxcars.confirmar_h6'
  end;
$$;

-- Misma regla que `estadoHito` + `acreditadoPorHito` del core: lo depositado
-- (confirmado, con hito) para el PAGO del hito se reparte en orden entre sus
-- hitos; un hito `directo` (el H5) queda acreditado con cualquier pago
-- confirmado; tolerancia de un dólar. Los asientos internos no llevan hito.
create or replace function public.hito_acreditado(p_expediente uuid, p_hito public.tipo_hito)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  with depositado as (
    select coalesce(sum(m.monto_usd), 0) as total
    from public.expediente_movimientos m
    where m.expediente_id = p_expediente
      and m.hito is not null
      and public.pago_de_hito(m.hito) = public.pago_de_hito(p_hito)
      and m.tipo = 'deposito' and m.estado = 'confirmado'
  ),
  antes as (
    -- Estimado de los hitos del mismo pago que van antes (en el Pago 2, el H2 va antes que el H3).
    select coalesce(sum(h.monto_estimado_usd), 0) as total
    from public.expediente_hitos h
    where h.expediente_id = p_expediente
      and public.pago_de_hito(h.tipo) = public.pago_de_hito(p_hito)
      and h.tipo::text < p_hito::text
  )
  select case
    when coalesce((
      select h.cuenta::text = 'directo'
      from public.expediente_hitos h
      where h.expediente_id = p_expediente and h.tipo = p_hito
    ), p_hito::text = 'H5')
    then (select total from depositado) > 0
    else (select total from depositado) - (select total from antes) + 1 >= coalesce((
      select h.monto_estimado_usd
      from public.expediente_hitos h
      where h.expediente_id = p_expediente and h.tipo = p_hito
    ), 0)
  end;
$$;

revoke all on function public.hito_acreditado(uuid, public.tipo_hito) from public;
grant execute on function public.hito_acreditado(uuid, public.tipo_hito) to authenticated;

-- El pago completo del hito está acreditado: todos los hitos de ese pago (en
-- el Pago 2, H2 y H3). Solo entonces se cierra la tarea "confirmar" del
-- equipo, que el core usa como evidencia cuando no hay libro.
create or replace function public.pago_acreditado(p_expediente uuid, p_hito public.tipo_hito)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.hito_acreditado(p_expediente, p_hito)
     and not exists (
       select 1
       from public.expediente_hitos h
       where h.expediente_id = p_expediente
         and public.pago_de_hito(h.tipo) = public.pago_de_hito(p_hito)
         and not public.hito_acreditado(p_expediente, h.tipo)
     );
$$;

revoke all on function public.pago_acreditado(uuid, public.tipo_hito) from public;
grant execute on function public.pago_acreditado(uuid, public.tipo_hito) to authenticated;


-- -----------------------------------------------------------------------------
--  2. cliente_accion_expediente: todo a Fondos de Clientes salvo el Pago 4;
--     textos "Pago N de 5"
-- -----------------------------------------------------------------------------

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
  v_directo boolean := false;
  v_monto numeric;
  v_soles numeric;
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

  -- Comparación por texto: `aprobar_unidad` es un valor nuevo de la enum.
  case p_tipo::text
    when 'aprobar_unidad' then
      v_clave := 'cliente.aprobar_unidad';
      v_titulo := case when e.veh_condicion::text = 'usado'
        then 'Aprobaste la unidad, el informe de inspección y el precio'
        else 'Aprobaste la unidad y el precio' end;
    when 'aprobar_inspeccion' then
      raise exception 'Esta acción ya no existe: desde el 27 nov 2026 se aprueba la unidad y el precio (aprobar_unidad).';
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
        raise exception 'Indica qué pago estás declarando.';
      end;
      if v_hito is null then
        raise exception 'Indica qué pago estás declarando.';
      end if;
      select h.cuenta into v_cuenta from public.expediente_hitos h where h.expediente_id = p_expediente and h.tipo = v_hito;
      -- Una sola cuenta para el cliente: todo a Fondos de Clientes salvo los tributos (H5), directo a SUNAT.
      v_cuenta := coalesce(v_cuenta, case
        when v_hito::text = 'H5' then 'directo'::public.cuenta_movimiento
        else 'fondos_clientes'::public.cuenta_movimiento end);
      v_directo := v_cuenta::text = 'directo';
      v_clave := public.tarea_cliente_de_hito(v_hito);
      v_titulo := case when v_directo
        then 'Declaraste el Pago ' || public.pago_de_hito(v_hito) || ' de 5: tributos pagados a SUNAT'
        else 'Declaraste el Pago ' || public.pago_de_hito(v_hito) || ' de 5' end;
      begin
        v_monto := (v_payload->>'monto')::numeric;
      exception when others then
        raise exception 'El monto no es un número válido.';
      end;
      if v_monto is null or v_monto <= 0 then
        raise exception 'El monto debe ser mayor que cero.';
      end if;
      begin
        v_soles := nullif(v_payload->>'soles', '')::numeric;
      exception when others then
        raise exception 'El monto en soles no es un número válido.';
      end;
      if v_soles is not null and v_soles <= 0 then
        raise exception 'El monto en soles debe ser mayor que cero.';
      end if;
      begin
        v_fecha := (v_payload->>'fecha')::date;
      exception when others then
        raise exception 'La fecha del pago no es válida.';
      end;
      if v_fecha is null or v_fecha > current_date + 1 then
        raise exception 'Indica la fecha en que hiciste el pago.';
      end if;
      v_banco := nullif(trim(coalesce(v_payload->>'banco', '')), '');
      if v_banco is null or length(v_banco) < 2 then
        raise exception '%', case when v_directo
          then 'Indica dónde pagaste (Clave SOL o el banco).'
          else 'Indica el banco desde el que transferiste.' end;
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

  if p_tipo::text = 'declarar_deposito' then
    insert into public.expediente_movimientos (
      expediente_id, tipo, cuenta, hito, estado, fecha, moneda, monto, tipo_cambio, monto_usd,
      concepto, documento_ref, comprobante_path, declarado_por_cliente, created_by
    ) values (
      p_expediente, 'deposito', v_cuenta, v_hito, 'por_confirmar', v_fecha,
      -- Pagado en soles (Pago 4 a SUNAT): el movimiento queda en PEN con los dólares de la DAM.
      case when v_soles is not null then 'PEN' else 'USD' end,
      round(coalesce(v_soles, v_monto), 2),
      case when v_soles is not null then greatest(round(v_monto / v_soles, 4), 0.0001) else 1 end,
      round(v_monto, 2),
      left(case when v_directo
        then 'Pago ' || public.pago_de_hito(v_hito) || ' de 5 pagado directo a SUNAT, declarado por el cliente'
        else 'Pago ' || public.pago_de_hito(v_hito) || ' de 5 declarado por el cliente' end, 200),
      left(v_banco || case when v_operacion is not null then ' · ' || case when v_directo then '' else 'op. ' end || v_operacion else '' end, 200),
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

  if p_tipo::text <> 'declarar_deposito' then
    update public.expediente_tareas
       set estado = 'hecha', hecha_en = now(), hecha_por = auth.uid()
     where id = t.id;
  end if;

  insert into public.expediente_eventos (
    expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, tarea_id, aprobacion_id, movimiento_id
  ) values (
    p_expediente, 'aprobacion', v_titulo,
    case
      when p_tipo::text = 'declarar_deposito' and v_directo then
        coalesce('S/ ' || to_char(round(v_soles, 2), 'FM999,999,990.00') || ' (', '(') || 'USD ' || to_char(round(v_monto, 2), 'FM999,999,990.00') || ') pagados a SUNAT el '
          || to_char(v_fecha, 'DD/MM/YYYY') || ' · ' || v_banco || '. Lo revisamos con el comprobante y seguimos con el levante.'
      when p_tipo::text = 'declarar_deposito' then
        'USD ' || to_char(round(v_monto, 2), 'FM999,999,990.00') || ' el ' || to_char(v_fecha, 'DD/MM/YYYY') || ' desde ' || v_banco || '. Lo confirmamos en cuanto se acredite.'
      else left(v_payload->>'comentario', 2000) end,
    true, auth.uid(), 'cliente', e.etapa, t.id, v_aprobacion, v_movimiento
  );

  return v_aprobacion;
end;
$$;

comment on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) is
  'Cliente dueño. Registra una decisión (aprobar la unidad y el precio —en usados, también el informe de inspección—, elegir consolidado, conformidad de la rendición, confirmar cuentas, declarar un pago) como aprobación con fecha y usuario, marca la tarea (salvo declarar_deposito, que deja un movimiento por_confirmar: todo a Fondos de Clientes salvo el Pago 4, que va a la cuenta `directo` en soles) y deja el evento con "Pago N de 5". Única vía de escritura del cliente en el módulo.';

revoke all on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) from public;
grant execute on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
--  3. registrar_movimiento: aplicación de honorarios y autodetracción;
--     textos "Pago N de 5"
-- -----------------------------------------------------------------------------

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
  v_comision numeric;
  v_motivo text := nullif(trim(coalesce(p_mov->>'motivo', '')), '');
  v_concepto text;
  v_titulo text;
  v_cargo uuid;
  v_operacion text := nullif(trim(coalesce(p_mov->>'operacion', '')), '');
  v_factura integer;
  v_doc text;
  v_par uuid;
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
        raise exception 'Anular un pago declarado exige un motivo (mínimo cinco caracteres).';
      end if;
      update public.expediente_movimientos
         set estado = 'anulado',
             nota_interna = left(concat_ws(E'\n', nota_interna, 'Anulado: ' || v_motivo), 2000)
       where id = m.id;
      insert into public.expediente_eventos (
        expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, movimiento_id
      ) values (
        m.expediente_id, 'movimiento',
        case when m.cuenta::text = 'directo' then 'No pudimos confirmar el pago a SUNAT que declaraste' else 'No pudimos confirmar el depósito que declaraste' end,
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
    v_monto_usd := coalesce((p_mov->>'monto_usd')::numeric, case when v_moneda = m.moneda and v_monto = m.monto then m.monto_usd end, round(v_monto * v_tc, 2));
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
     where id = m.id
    returning * into m;

    insert into public.expediente_eventos (
      expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, movimiento_id
    ) values (
      m.expediente_id, 'movimiento',
      case
        when v_hito is not null and m.cuenta::text = 'directo' then 'Pago ' || public.pago_de_hito(v_hito) || ' de 5 confirmado: tributos pagados a SUNAT'
        when v_hito is not null then 'Pago ' || public.pago_de_hito(v_hito) || ' de 5 confirmado'
        when m.cuenta::text = 'directo' then 'Pago a SUNAT confirmado'
        else 'Depósito confirmado' end,
      case when m.cuenta::text = 'directo'
        then case when v_moneda <> 'USD' then v_moneda || ' ' || to_char(v_monto, 'FM999,999,990.00') || ' (USD ' || to_char(v_monto_usd, 'FM999,999,990.00') || ')' else 'USD ' || to_char(v_monto_usd, 'FM999,999,990.00') end
          || ' pagados directamente a SUNAT el ' || to_char(v_fecha, 'DD/MM/YYYY') || '.'
        else 'USD ' || to_char(v_monto_usd, 'FM999,999,990.00') || ' acreditados el ' || to_char(v_fecha, 'DD/MM/YYYY') || '.' end,
      true, v_actor, 'admin', e.etapa, m.id
    );

    -- Las tareas del pago (la del cliente y la del equipo) se cierran recién con el
    -- pago completo: con un Pago 2 parcial el cliente sigue viendo lo que falta.
    if v_hito is not null and public.pago_acreditado(m.expediente_id, v_hito) then
      perform public.cerrar_tarea_por_clave(m.expediente_id, public.tarea_cliente_de_hito(v_hito), v_actor, m.id, e.etapa);
      perform public.cerrar_tarea_por_clave(m.expediente_id, public.tarea_luxcars_de_hito(v_hito), v_actor, m.id, e.etapa);
    end if;
    return m.id;
  end if;

  -- ------------------------------------------------------------------
  -- Asiento nuevo
  -- ------------------------------------------------------------------
  select * into e from public.expedientes where id = (p_mov->>'expediente_id')::uuid for update;
  if not found then
    raise exception 'El expediente no existe.';
  end if;
  if e.etapa = 'prospecto' then
    raise exception 'Un prospecto no tiene libro: pásalo a búsqueda o contrato primero.';
  end if;

  -- ------------------------------------------------------------------
  -- Operaciones internas de honorarios (27 nov 2026): asientos SIN hito,
  -- para que nunca acrediten un pago del cliente.
  --   aplicar_honorarios: al emitir la factura N, LUXCARS toma su importe de
  --     Fondos de Clientes (pago) y lo pasa a Operaciones (depósito).
  --   autodetraccion: LUXCARS deposita la detracción de la factura N desde
  --     Operaciones (pago) en su cuenta del Banco de la Nación (depósito en
  --     detracciones), con el número de constancia.
  -- ------------------------------------------------------------------
  if v_operacion is not null then
    if v_operacion not in ('aplicar_honorarios', 'autodetraccion') then
      raise exception 'Operación no reconocida: %.', v_operacion;
    end if;
    begin
      v_factura := (p_mov->>'factura')::integer;
    exception when others then
      v_factura := null;
    end;
    if v_factura is null or v_factura not in (1, 2) then
      raise exception 'Indica la factura de honorarios: 1 (primera mitad) o 2 (segunda mitad).';
    end if;
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
    v_doc := left(nullif(trim(p_mov->>'documento_ref'), ''), 200);
    if v_doc is null then
      raise exception '%', case when v_operacion = 'aplicar_honorarios'
        then 'Indica el número de la factura de honorarios.'
        else 'Indica el número de la constancia de depósito del Banco de la Nación.' end;
    end if;

    if v_operacion = 'aplicar_honorarios' then
      insert into public.expediente_movimientos (
        expediente_id, tipo, cuenta, hito, estado, fecha, moneda, monto, tipo_cambio, monto_usd,
        concepto, documento_ref, declarado_por_cliente, nota_interna, created_by
      ) values (
        e.id, 'pago', 'fondos_clientes', null, 'confirmado', v_fecha, v_moneda, v_monto, v_tc, v_monto_usd,
        'Aplicación de honorarios · factura ' || v_factura || ' ' || v_doc, v_doc, false,
        left(nullif(trim(p_mov->>'nota_interna'), ''), 2000), v_actor
      )
      returning id into v_id;
      insert into public.expediente_movimientos (
        expediente_id, tipo, cuenta, hito, estado, fecha, moneda, monto, tipo_cambio, monto_usd,
        concepto, documento_ref, declarado_por_cliente, nota_interna, created_by
      ) values (
        e.id, 'deposito', 'operaciones', null, 'confirmado', v_fecha, v_moneda, v_monto, v_tc, v_monto_usd,
        'Honorarios recibidos desde Fondos de Clientes · factura ' || v_factura || ' ' || v_doc, v_doc, false,
        left('Par de la aplicación ' || v_id::text, 2000), v_actor
      )
      returning id into v_par;
      insert into public.expediente_eventos (
        expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, movimiento_id
      ) values (
        e.id, 'movimiento', 'Factura ' || v_factura || ' de honorarios aplicada',
        'Tomamos USD ' || to_char(v_monto_usd, 'FM999,999,990.00') || ' de tu cuenta Fondos de Clientes para la factura ' || v_factura
          || ' (' || v_doc || '), como dice el contrato.',
        true, v_actor, 'admin', e.etapa, v_id
      );
      perform public.cerrar_tarea_por_clave(e.id, case v_factura when 1 then 'luxcars.factura_h3' else 'luxcars.factura_h6' end, v_actor, v_id, e.etapa);
    else
      insert into public.expediente_movimientos (
        expediente_id, tipo, cuenta, hito, estado, fecha, moneda, monto, tipo_cambio, monto_usd,
        concepto, documento_ref, declarado_por_cliente, nota_interna, created_by
      ) values (
        e.id, 'pago', 'operaciones', null, 'confirmado', v_fecha, v_moneda, v_monto, v_tc, v_monto_usd,
        'Detracción de la factura ' || v_factura || ' depositada en el Banco de la Nación (autodetracción)', v_doc, false,
        left(nullif(trim(p_mov->>'nota_interna'), ''), 2000), v_actor
      )
      returning id into v_id;
      insert into public.expediente_movimientos (
        expediente_id, tipo, cuenta, hito, estado, fecha, moneda, monto, tipo_cambio, monto_usd,
        concepto, documento_ref, declarado_por_cliente, nota_interna, created_by
      ) values (
        e.id, 'deposito', 'detracciones', null, 'confirmado', v_fecha, v_moneda, v_monto, v_tc, v_monto_usd,
        'Detracción de la factura ' || v_factura || ' (autodetracción)', v_doc, false,
        left('Par de la autodetracción ' || v_id::text, 2000), v_actor
      )
      returning id into v_par;
      insert into public.expediente_eventos (
        expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, movimiento_id
      ) values (
        e.id, 'movimiento', 'Detracción de la factura ' || v_factura || ' depositada',
        'Depositamos la detracción de la factura ' || v_factura || ' en el Banco de la Nación (constancia ' || v_doc || '). No cambia tu saldo: sale de nuestros honorarios.',
        true, v_actor, 'admin', e.etapa, v_id
      );
      perform public.cerrar_tarea_por_clave(e.id, case v_factura when 1 then 'luxcars.autodetraccion_h3' else 'luxcars.autodetraccion_h6' end, v_actor, v_id, e.etapa);
    end if;
    return v_id;
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
  if v_cuenta::text = 'directo' and v_tipo <> 'deposito' then
    raise exception 'La cuenta directo solo registra lo que el cliente pagó directo a SUNAT (tipo depósito).';
  end if;
  begin
    v_comision := nullif(p_mov->>'comision_bancaria_usd', '')::numeric;
  exception when others then
    raise exception 'La comisión bancaria no es un número válido.';
  end;
  if v_comision is not null then
    if v_comision <= 0 then
      v_comision := null;
    elsif v_tipo <> 'pago' or v_cuenta::text <> 'fondos_clientes' then
      raise exception 'La comisión bancaria solo acompaña un pago desde Fondos de Clientes.';
    elsif v_estado <> 'confirmado' then
      raise exception 'La comisión bancaria se registra con el pago ya confirmado.';
    elsif v_comision > 1000 then
      raise exception 'Una comisión bancaria de más de USD 1,000 no parece correcta: revisa el monto.';
    end if;
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

  v_titulo := case
    when v_tipo = 'deposito' and v_hito is not null and v_cuenta::text = 'directo' then 'Pago ' || public.pago_de_hito(v_hito) || ' de 5 '
      || case when v_estado = 'confirmado' then 'confirmado' else 'registrado' end || ': tributos pagados a SUNAT'
    when v_tipo = 'deposito' and v_hito is not null then 'Pago ' || public.pago_de_hito(v_hito) || ' de 5 '
      || case when v_estado = 'confirmado' then 'confirmado' else 'registrado' end
    when v_tipo = 'deposito' then 'Depósito ' || case when v_estado = 'confirmado' then 'confirmado' else 'registrado' end
    when v_tipo = 'pago' then 'Pago por tu cuenta' || case when v_concepto is not null then ': ' || v_concepto else '' end
    when v_tipo = 'devolucion' then 'Devolución de saldo'
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

  -- Comisión del wire: el cargo del banco y la reposición de Luxcars, el mismo día.
  if v_comision is not null then
    insert into public.expediente_movimientos (
      expediente_id, tipo, cuenta, hito, estado, fecha, moneda, monto, tipo_cambio, monto_usd,
      concepto, documento_ref, declarado_por_cliente, nota_interna, created_by
    ) values (
      e.id, 'pago', 'fondos_clientes', null, 'confirmado', v_fecha, 'USD', round(v_comision, 2), 1, round(v_comision, 2),
      'Comisión bancaria del wire (cargo del banco)', 'Estado de cuenta del banco',
      false, left('Comisión del pago ' || v_id::text, 2000), v_actor
    )
    returning id into v_cargo;

    insert into public.expediente_movimientos (
      expediente_id, tipo, cuenta, hito, estado, fecha, moneda, monto, tipo_cambio, monto_usd,
      concepto, documento_ref, declarado_por_cliente, nota_interna, created_by
    ) values (
      e.id, 'ajuste', 'fondos_clientes', null, 'confirmado', v_fecha, 'USD', round(v_comision, 2), 1, round(v_comision, 2),
      'Reposición de la comisión bancaria, por cuenta de Luxcars', 'Transferencia de Luxcars',
      false, left('Repone la comisión ' || v_cargo::text || ' del pago ' || v_id::text, 2000), v_actor
    );

    insert into public.expediente_eventos (
      expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, movimiento_id
    ) values (
      e.id, 'movimiento', 'Comisión bancaria del wire repuesta por Luxcars',
      'El banco cobró USD ' || to_char(round(v_comision, 2), 'FM999,999,990.00') || ' por la transferencia al exterior y Luxcars los repuso el mismo día. Tu saldo no cambia.',
      true, v_actor, 'admin', e.etapa, v_cargo
    );
  end if;

  if v_tipo = 'deposito' and v_estado = 'confirmado' and v_hito is not null and public.pago_acreditado(e.id, v_hito) then
    perform public.cerrar_tarea_por_clave(e.id, public.tarea_cliente_de_hito(v_hito), v_actor, v_id, e.etapa);
    perform public.cerrar_tarea_por_clave(e.id, public.tarea_luxcars_de_hito(v_hito), v_actor, v_id, e.etapa);
  end if;

  return v_id;
end;
$$;

comment on function public.registrar_movimiento(jsonb, uuid) is
  'Admin o servidor. Inserta un asiento del libro (con `comision_bancaria_usd` en un pago desde Fondos de Clientes registra también el cargo del banco y la reposición de Luxcars), confirma/anula uno declarado por el cliente cuando trae `id` (incluido el pago directo a SUNAT), o con `operacion` = aplicar_honorarios | autodetraccion arma el par interno de la factura 1 o 2 (sin hito) y cierra su tarea. Deja el evento ("Pago N de 5") y cierra las tareas del hito. Devuelve el id.';

revoke all on function public.registrar_movimiento(jsonb, uuid) from public;
grant execute on function public.registrar_movimiento(jsonb, uuid) to authenticated;

-- -----------------------------------------------------------------------------
--  4. Lo que el cliente ve del libro: sin la cuenta de Operaciones ni los
--     asientos internos de detracciones (los que no llevan hito)
-- -----------------------------------------------------------------------------

create or replace view public.expediente_movimiento_cliente as
  select m.id, m.expediente_id, m.tipo, m.cuenta, m.hito, m.estado, m.fecha, m.moneda, m.monto, m.tipo_cambio,
         m.monto_usd, m.concepto, m.documento_ref,
         m.comprobante_path is not null as tiene_comprobante,
         m.declarado_por_cliente, m.created_at
  from public.expediente_movimientos m
  join public.expedientes e on e.id = m.expediente_id
  where m.estado in ('por_confirmar', 'confirmado')
    and m.cuenta::text <> 'operaciones'
    and not (m.cuenta::text = 'detracciones' and m.hito is null)
    and e.etapa <> 'prospecto'
    and e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

comment on view public.expediente_movimiento_cliente is
  'Lo que el cliente ve de SU libro: Fondos de Clientes, lo que pagó directo a SUNAT y la detracción que haya depositado él mismo. Desde el 27 nov 2026 sin la cuenta de Operaciones ni los asientos internos de autodetracción.';

grant select on public.expediente_movimiento_cliente to authenticated;

comment on table public.expediente_hitos is
  'Pagos del cliente: cinco pagos con seis hitos internos (H1 precio; H2 flete y seguro + H3 50 % honorarios, UNA transferencia; H4 gastos de aduana; H5 tributos directo a SUNAT; H6 50 % honorarios neto del saldo de aduana), con monto estimado, fecha límite y cuenta de destino: Fondos de Clientes salvo el H5. El estado lo deriva el core del libro.';
