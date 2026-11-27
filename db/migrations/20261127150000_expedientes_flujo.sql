-- =============================================================================
--  Migración 0022 · expedientes de importación: flujo con cinco pagos, una
--  firma y datos por etapa (decisiones del dueño del 27 nov 2026)
-- =============================================================================
--
--  Lo que cambia respecto al diseño del 24 nov (que manda sobre él):
--
--  A. Orden de etapas. Primero se busca y se elige el auto sin costo; el
--     contrato se firma con la unidad ya elegida:
--       prospecto → busqueda → contrato → compra → embarque → transito →
--       aduana → placas → entrega → cerrado (+ cancelado).
--     `orden_etapa` cambia (busqueda = 1, contrato = 2) y `crear_expediente`
--     acepta nacer en `prospecto` o `busqueda`. La enum `tipo_aprobacion` gana
--     `aprobar_unidad` (compuerta para pasar a contrato; en un usado incluye el
--     informe de inspección). `aprobar_inspeccion` queda en la enum por las
--     filas viejas y la acción ya no se acepta. La inspección sigue existiendo
--     SOLO para usados: las columnas `fecha_inspeccion`, `costo_inspeccion_usd`
--     e `inspector_id` se conservan.
--
--  B. Pagos: cinco pagos, seis hitos, una cuenta por hito.
--       Pago 1 · H1 · a la firma · precio del vehículo (más la inspección del
--                usado) · Fondos de Clientes
--       Pago 2 · H2 · al release · flete (traslado al puerto y marítimo) y
--                seguro · Fondos de Clientes
--              · H3 · al release · 50 % de honorarios · Operaciones
--       Pago 3 · H4 · al arribo · gastos de aduana según la pro forma del agente
--                · Fondos de Clientes (reembolsable: el saldo se compensa en el
--                Pago 5)
--       Pago 4 · H5 · con la liquidación de SUNAT · tributos exactos, en soles,
--                que el cliente paga DIRECTO a SUNAT · cuenta `directo`
--       Pago 5 · H6 · al levante · 50 % restante de honorarios, neto del saldo
--                de aduana · Operaciones
--     `tipo_hito` gana `H5` y `H6`; `cuenta_movimiento` gana `directo` (no es
--     una cuenta de Luxcars: registra lo que el cliente pagó directo a un
--     tercero, sin constancia de fondos). `tarea_cliente_de_hito` /
--     `tarea_luxcars_de_hito` cubren H1..H6 con las claves uniformes
--     `cliente.depositar_hX` / `luxcars.confirmar_hX`. `hito_acreditado` da por
--     acreditado un hito `directo` con cualquier pago confirmado (la cifra
--     exacta la fija SUNAT). La columna `margen_h3` queda sin uso (no hay
--     margen: los tributos se pagan con la cifra de la liquidación). La columna
--     `fecha_limite_h2` es ahora la fecha límite del Pago 2 (H2 y H3 juntos).
--
--  C. Libro. `registrar_movimiento` acepta `comision_bancaria_usd` en un pago
--     desde Fondos de Clientes: registra además el cargo del banco y la
--     reposición de Luxcars (dos asientos que se anulan: el saldo del cliente
--     no cambia). El cliente declara el Pago 4 con los soles pagados: el
--     movimiento queda en PEN con el monto en dólares de la DAM.
--
--  D. Firmas: una sola vez en notaría (contrato con anexos, LOA y poder para
--     la inmatriculación) y una simple a la entrega. `documento_tipo` gana
--     `acta_rendicion` (fusiona acta de entrega y rendición) y
--     `poder_inmatriculacion`; `acta_entrega` y `rendicion` quedan en la enum
--     sin uso. `tipo_contraparte` gana `broker` (al que se gira el precio
--     completo; el `vendedor` es el dealer que emite factura y MSO), y
--     `expedientes_reservado` gana `broker_id`.
--
--  El valor `aviso_h3` de `documento_tipo` se CONSERVA aunque ahora sea el
--  aviso de pago genérico de los hitos H4, H5 y H6 (Pagos 3, 4 y 5): renombrar
--  un valor de enum obligaría a tocar cada fila y cada caché. El documento
--  lleva el hito en `expediente_documentos.hito` y `registrar_documento` solo
--  reemplaza el aviso anterior del MISMO hito.
--
--  Los expedientes existentes (solo la demo LC-2026-010) NO se migran a los
--  hitos nuevos: se rehacen con `SEED_DEMO=1 SEED_DEMO_RESET=1`.
--
--  Idempotente: se puede reaplicar. Los valores nuevos de enum se comparan por
--  texto (`::text`) dentro de las funciones SQL para que la migración corra en
--  una sola transacción (un valor de enum recién añadido no puede usarse como
--  literal en la misma transacción).
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. ENUMS
-- -----------------------------------------------------------------------------

alter type public.tipo_hito add value if not exists 'H5';
alter type public.tipo_hito add value if not exists 'H6';
alter type public.cuenta_movimiento add value if not exists 'directo';
alter type public.tipo_aprobacion add value if not exists 'aprobar_unidad';
alter type public.tipo_contraparte add value if not exists 'broker';
alter type public.documento_tipo add value if not exists 'acta_rendicion';
alter type public.documento_tipo add value if not exists 'poder_inmatriculacion';


-- -----------------------------------------------------------------------------
--  2. COLUMNAS Y COMENTARIOS
-- -----------------------------------------------------------------------------

alter table public.expedientes_reservado
  add column if not exists broker_id uuid references public.contrapartes (id) on delete set null;

comment on column public.expedientes_reservado.broker_id is
  'Broker al que se gira el precio completo (hito H1) y que paga al dealer. `vendedor_id` es el dealer que emite la factura y el MSO. Sin broker, el dealer cobra directo.';

comment on column public.expedientes.fecha_limite_h2 is
  'Fecha límite del Pago 2 (H2 flete y seguro + H3 primera mitad de honorarios); por defecto el release estimado.';

comment on column public.expedientes.margen_h3 is
  'Sin uso desde el 27 nov 2026: el calendario de cinco pagos no lleva margen (los tributos se pagan con la cifra exacta de la liquidación de SUNAT). Se conserva por las filas viejas.';

comment on column public.expedientes.fecha_inspeccion is
  'Solo usados: fecha de la inspección física, antes de que el cliente apruebe la unidad.';

comment on column public.expedientes.costo_inspeccion_usd is
  'Solo usados: costo de la inspección, que se cobra con el Pago 1 (H1). En nuevos queda vacío.';

comment on table public.expediente_hitos is
  'Pagos del cliente: seis hitos en cinco pagos (H1 precio; H2 flete y seguro + H3 50 % honorarios; H4 gastos de aduana; H5 tributos directo a SUNAT; H6 50 % honorarios neto del saldo de aduana), con monto estimado, fecha límite y cuenta de destino. El estado lo deriva el core del libro.';


-- -----------------------------------------------------------------------------
--  3. ORDEN DE ETAPAS
-- -----------------------------------------------------------------------------

create or replace function public.orden_etapa(p_etapa public.etapa_expediente)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_etapa
    when 'prospecto' then 0
    when 'busqueda'  then 1
    when 'contrato'  then 2
    when 'compra'    then 3
    when 'embarque'  then 4
    when 'transito'  then 5
    when 'aduana'    then 6
    when 'placas'    then 7
    when 'entrega'   then 8
    when 'cerrado'   then 9
    else 99 -- cancelado: terminal, fuera de la línea
  end;
$$;

comment on function public.orden_etapa(public.etapa_expediente) is
  'Orden operativo de las etapas (27 nov 2026: búsqueda antes de contrato). `avanzar_expediente` rechaza saltos con él.';


-- -----------------------------------------------------------------------------
--  4. HITOS: tareas por hito (H1..H6) y acreditación. Comparación por texto.
-- -----------------------------------------------------------------------------

create or replace function public.tarea_cliente_de_hito(p_hito public.tipo_hito)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_hito::text
    when 'H1' then 'cliente.depositar_h1'
    when 'H2' then 'cliente.depositar_h2'
    when 'H3' then 'cliente.depositar_h3'
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
    when 'H3' then 'luxcars.confirmar_h3'
    when 'H4' then 'luxcars.confirmar_h4'
    when 'H5' then 'luxcars.confirmar_h5'
    when 'H6' then 'luxcars.confirmar_h6'
  end;
$$;

-- Misma regla que `estadoHito` del core: un hito `directo` (el H5, tributos
-- pagados por el cliente a SUNAT) queda acreditado con cualquier pago
-- confirmado; los demás, con depósitos confirmados que lleguen al estimado con
-- tolerancia de un dólar.
create or replace function public.hito_acreditado(p_expediente uuid, p_hito public.tipo_hito)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when coalesce((
      select h.cuenta::text = 'directo'
      from public.expediente_hitos h
      where h.expediente_id = p_expediente and h.tipo = p_hito
    ), p_hito::text = 'H5')
    then exists (
      select 1
      from public.expediente_movimientos m
      where m.expediente_id = p_expediente and m.hito = p_hito
        and m.tipo = 'deposito' and m.estado = 'confirmado'
    )
    else coalesce((
      select sum(m.monto_usd)
      from public.expediente_movimientos m
      where m.expediente_id = p_expediente and m.hito = p_hito
        and m.tipo = 'deposito' and m.estado = 'confirmado'
    ), 0) + 1 >= coalesce((
      select h.monto_estimado_usd
      from public.expediente_hitos h
      where h.expediente_id = p_expediente and h.tipo = p_hito
    ), 0)
  end;
$$;

revoke all on function public.hito_acreditado(uuid, public.tipo_hito) from public;
grant execute on function public.hito_acreditado(uuid, public.tipo_hito) to authenticated;


-- -----------------------------------------------------------------------------
--  5. crear_expediente: nace en prospecto o busqueda; broker; inspección en usados
-- -----------------------------------------------------------------------------

create or replace function public.crear_expediente(p_datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_cliente uuid;
  v_embarque uuid;
  v_etapa public.etapa_expediente;
  v_codigo text;
  v_solicitud uuid;
  v_clase text;
  h jsonb;
  emb jsonb;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador abre expedientes.';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Faltan los datos del expediente.';
  end if;

  v_cliente := (p_datos->>'cliente_id')::uuid;
  if v_cliente is null or not exists (select 1 from public.clientes c where c.id = v_cliente) then
    raise exception 'El expediente necesita un cliente registrado.';
  end if;

  v_etapa := coalesce((p_datos->>'etapa')::public.etapa_expediente, 'prospecto');
  if v_etapa not in ('prospecto', 'busqueda') then
    raise exception 'Un expediente nace en prospecto o en búsqueda, no en %.', v_etapa;
  end if;

  v_clase := upper(trim(p_datos->>'veh_clase'));
  if v_clase is not null and v_clase not in ('M1', 'N1') then
    raise exception 'La clase del vehículo es M1 (autos y SUV) o N1 (pickups y camionetas), no %.', v_clase;
  end if;

  -- Embarque: uno existente o uno nuevo descrito en `embarque_nuevo`.
  v_embarque := (p_datos->>'embarque_id')::uuid;
  emb := p_datos->'embarque_nuevo';
  if v_embarque is null and emb is not null and jsonb_typeof(emb) = 'object' then
    insert into public.embarques (
      modalidad, contenedor, puerto_origen, puerto_destino,
      fecha_release_est, fecha_zarpe_est, fecha_arribo_est, almacen_consolidacion, notas_internas
    ) values (
      coalesce((emb->>'modalidad')::public.modalidad_embarque, 'exclusivo'),
      (emb->>'contenedor')::public.tipo_contenedor,
      left(emb->>'puerto_origen', 120),
      coalesce(left(emb->>'puerto_destino', 120), 'Callao'),
      (emb->>'fecha_release_est')::date,
      (emb->>'fecha_zarpe_est')::date,
      (emb->>'fecha_arribo_est')::date,
      left(emb->>'almacen_consolidacion', 200),
      left(emb->>'notas_internas', 4000)
    )
    returning id into v_embarque;
  end if;

  insert into public.expedientes (
    cliente_id, etapa, etapa_desde, origen_solicitud_id, embarque_id, proporcion_flete,
    veh_marca, veh_modelo, veh_version, veh_anio, veh_vin, veh_color, veh_km,
    veh_combustible, veh_cilindrada_cc, veh_transmision, veh_condicion, veh_categoria,
    veh_origen, veh_pais_ensamblaje, veh_doc_propiedad, veh_peso_kg, veh_medidas, veh_clase, vehicle_model_id,
    moneda_compra, precio_compra, precio_compra_usd, fecha_limite_compra, fecha_inspeccion,
    historial_ref, fecha_release, pais_origen, puerto_origen,
    presupuesto, honorarios_usd, honorarios_base_usd, honorarios_igv_usd,
    porcentaje_detraccion, margen_h3, tarifa_custodia_usd, costo_inspeccion_usd,
    fecha_firma, fecha_limite_h2, fecha_est_embarque, fecha_est_arribo, fecha_est_entrega,
    semanas_estimadas, loa_vence, created_by
  ) values (
    v_cliente, v_etapa, now(), (p_datos->>'origen_solicitud_id')::uuid, v_embarque,
    coalesce((p_datos->>'proporcion_flete')::numeric, 1),
    left(p_datos->>'veh_marca', 80), left(p_datos->>'veh_modelo', 120), left(p_datos->>'veh_version', 120),
    (p_datos->>'veh_anio')::integer, upper(left(p_datos->>'veh_vin', 17)), left(p_datos->>'veh_color', 60),
    (p_datos->>'veh_km')::integer,
    left(p_datos->>'veh_combustible', 60), (p_datos->>'veh_cilindrada_cc')::integer,
    left(p_datos->>'veh_transmision', 60),
    coalesce((p_datos->>'veh_condicion')::public.condicion_vehiculo, 'usado'),
    coalesce((p_datos->>'veh_categoria')::public.categoria_vehiculo, 'gasolina'),
    coalesce((p_datos->>'veh_origen')::public.origen_vehiculo, 'otro'),
    left(p_datos->>'veh_pais_ensamblaje', 80), left(p_datos->>'veh_doc_propiedad', 120),
    (p_datos->>'veh_peso_kg')::integer, left(p_datos->>'veh_medidas', 120),
    v_clase,
    (p_datos->>'vehicle_model_id')::uuid,
    coalesce(upper(left(p_datos->>'moneda_compra', 3)), 'USD'),
    (p_datos->>'precio_compra')::numeric, (p_datos->>'precio_compra_usd')::numeric,
    (p_datos->>'fecha_limite_compra')::date,
    -- La inspección solo existe en usados.
    case when coalesce(p_datos->>'veh_condicion', 'usado') = 'usado' then (p_datos->>'fecha_inspeccion')::date end,
    left(p_datos->>'historial_ref', 200), (p_datos->>'fecha_release')::date,
    left(p_datos->>'pais_origen', 80), left(p_datos->>'puerto_origen', 120),
    p_datos->'presupuesto',
    (p_datos->>'honorarios_usd')::numeric, (p_datos->>'honorarios_base_usd')::numeric,
    (p_datos->>'honorarios_igv_usd')::numeric,
    (p_datos->>'porcentaje_detraccion')::numeric,
    0, -- margen_h3: sin uso desde el 27 nov 2026
    (p_datos->>'tarifa_custodia_usd')::numeric,
    case when coalesce(p_datos->>'veh_condicion', 'usado') = 'usado' then (p_datos->>'costo_inspeccion_usd')::numeric end,
    (p_datos->>'fecha_firma')::date, (p_datos->>'fecha_limite_h2')::date,
    (p_datos->>'fecha_est_embarque')::date, (p_datos->>'fecha_est_arribo')::date,
    (p_datos->>'fecha_est_entrega')::date,
    left(p_datos->>'semanas_estimadas', 40), (p_datos->>'loa_vence')::date,
    auth.uid()
  )
  returning id, codigo into v_id, v_codigo;

  insert into public.expedientes_reservado (
    expediente_id, precio_tope, tc_compra_ref, vendedor_id, broker_id, inspector_id, agente_aduana_id, notas_internas
  ) values (
    v_id,
    (p_datos->>'precio_tope')::numeric,
    (p_datos->>'tc_compra_ref')::numeric,
    (p_datos->>'vendedor_id')::uuid,
    (p_datos->>'broker_id')::uuid,
    case when coalesce(p_datos->>'veh_condicion', 'usado') = 'usado' then (p_datos->>'inspector_id')::uuid end,
    (p_datos->>'agente_aduana_id')::uuid,
    left(p_datos->>'notas_internas', 8000)
  );

  insert into public.expediente_etapas (expediente_id, etapa, desde, por)
  values (v_id, v_etapa, now(), auth.uid());

  if p_datos->'hitos' is not null and jsonb_typeof(p_datos->'hitos') = 'array' then
    for h in select * from jsonb_array_elements(p_datos->'hitos') loop
      insert into public.expediente_hitos (expediente_id, tipo, monto_estimado_usd, fecha_limite, cuenta, nota)
      values (
        v_id,
        (h->>'tipo')::public.tipo_hito,
        coalesce((h->>'monto_estimado_usd')::numeric, 0),
        (h->>'fecha_limite')::date,
        coalesce((h->>'cuenta')::public.cuenta_movimiento, 'fondos_clientes'),
        left(h->>'nota', 500)
      )
      on conflict (expediente_id, tipo) do nothing;
    end loop;
  end if;

  perform public.insertar_tareas_expediente(v_id, v_etapa, p_datos->'tareas');

  insert into public.expediente_eventos (expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa)
  values (
    v_id, 'etapa', 'Expediente ' || v_codigo || ' abierto',
    'Abrimos el expediente de importación de tu ' || (p_datos->>'veh_marca') || ' ' || (p_datos->>'veh_modelo') || '.',
    true, auth.uid(), 'admin', v_etapa
  );

  v_solicitud := (p_datos->>'origen_solicitud_id')::uuid;
  if v_solicitud is not null then
    update public.solicitudes_compra
       set estado = case when estado in ('nueva', 'en_busqueda') then 'propuesta_enviada' else estado end,
           atendido_por = coalesce(atendido_por, auth.uid())
     where id = v_solicitud;
  end if;

  return v_id;
end;
$$;

comment on function public.crear_expediente(jsonb) is
  'Solo admin. Abre el expediente (en prospecto o búsqueda) con su parte reservada (dealer `vendedor_id`, `broker_id`, inspector solo en usados, agente), historial, hitos H1..H6, tareas de la etapa inicial y el evento de apertura, en una transacción. Acepta veh_clase (M1/N1). Devuelve el id.';

revoke all on function public.crear_expediente(jsonb) from public;
grant execute on function public.crear_expediente(jsonb) to authenticated;


-- -----------------------------------------------------------------------------
--  6. cliente_accion_expediente: aprobar_unidad; depósitos H1..H6; Pago 4
--     directo a SUNAT declarado en soles
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
        raise exception 'Indica a qué hito corresponde el pago (H1 a H6).';
      end;
      if v_hito is null then
        raise exception 'Indica a qué hito corresponde el pago (H1 a H6).';
      end if;
      select h.cuenta into v_cuenta from public.expediente_hitos h where h.expediente_id = p_expediente and h.tipo = v_hito;
      -- Honorarios (H3 y H6) a Operaciones; tributos (H5) directo a SUNAT; lo demás a Fondos de Clientes.
      v_cuenta := coalesce(v_cuenta, case
        when v_hito::text in ('H3', 'H6') then 'operaciones'::public.cuenta_movimiento
        when v_hito::text = 'H5' then 'directo'::public.cuenta_movimiento
        else 'fondos_clientes'::public.cuenta_movimiento end);
      v_directo := v_cuenta::text = 'directo';
      v_clave := public.tarea_cliente_de_hito(v_hito);
      v_titulo := case when v_directo
        then 'Declaraste el pago de tributos a SUNAT (' || v_hito::text || ')'
        else 'Declaraste un depósito del hito ' || v_hito::text end;
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
        then 'Pago directo a SUNAT (' || v_hito::text || ') declarado por el cliente'
        else 'Depósito ' || v_hito::text || ' declarado por el cliente' end, 200),
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
  'Cliente dueño. Registra una decisión (aprobar la unidad y el precio —en usados, también el informe de inspección—, elegir consolidado, conformidad de la rendición, confirmar cuentas, declarar un pago H1..H6) como aprobación con fecha y usuario, marca la tarea (salvo declarar_deposito, que deja un movimiento por_confirmar; el Pago 4 va a la cuenta `directo` en soles) y deja el evento. Única vía de escritura del cliente en el módulo.';

revoke all on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) from public;
grant execute on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) to authenticated;


-- -----------------------------------------------------------------------------
--  7. registrar_movimiento: comisión bancaria del wire en pareja; pago directo
-- -----------------------------------------------------------------------------
--
--   · Sin `id`: inserta el movimiento (confirmado o por confirmar) y deja el
--     evento. Un `pago` desde Fondos de Clientes con `comision_bancaria_usd`
--     registra además, en la misma transacción, el cargo del banco ("Comisión
--     bancaria del wire (cargo del banco)", pago) y la reposición de Luxcars
--     ("Reposición de la comisión bancaria, por cuenta de Luxcars", ajuste):
--     el saldo del cliente no cambia y la rendición lo muestra.
--   · Con `id` de un movimiento `por_confirmar`: lo CONFIRMA (admite corregir
--     monto, fecha, moneda, tipo de cambio, monto en dólares, hito, concepto y
--     referencia) o lo ANULA si `estado = 'anulado'` (exige `motivo`). El pago
--     directo del cliente a SUNAT (cuenta `directo`) se confirma igual, con su
--     propio texto.
--  Al confirmar o insertar un depósito con hito, la tarea del cliente de ese
--  hito queda hecha, y si el hito queda acreditado también la del equipo.
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
      case when m.cuenta::text = 'directo' then 'Pago a SUNAT confirmado' else 'Depósito confirmado' end
        || case when v_hito is not null then ' · ' || v_hito::text else '' end,
      case when m.cuenta::text = 'directo'
        then case when v_moneda <> 'USD' then v_moneda || ' ' || to_char(v_monto, 'FM999,999,990.00') || ' (USD ' || to_char(v_monto_usd, 'FM999,999,990.00') || ')' else 'USD ' || to_char(v_monto_usd, 'FM999,999,990.00') end
          || ' pagados directamente a SUNAT el ' || to_char(v_fecha, 'DD/MM/YYYY') || '.'
        else 'USD ' || to_char(v_monto_usd, 'FM999,999,990.00') || ' acreditados el ' || to_char(v_fecha, 'DD/MM/YYYY') || '.' end,
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
  -- Asiento nuevo
  -- ------------------------------------------------------------------
  select * into e from public.expedientes where id = (p_mov->>'expediente_id')::uuid for update;
  if not found then
    raise exception 'El expediente no existe.';
  end if;
  if e.etapa = 'prospecto' then
    raise exception 'Un prospecto no tiene libro: pásalo a búsqueda o contrato primero.';
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
    when v_tipo = 'deposito' and v_cuenta::text = 'directo' then 'Pago directo a SUNAT ' || case when v_estado = 'confirmado' then 'confirmado' else 'registrado' end
      || case when v_hito is not null then ' · ' || v_hito::text else '' end
    when v_tipo = 'deposito' then 'Depósito ' || case when v_estado = 'confirmado' then 'confirmado' else 'registrado' end
      || case when v_hito is not null then ' · ' || v_hito::text else '' end
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
  'Admin o servidor. Inserta un asiento del libro (con `comision_bancaria_usd` en un pago desde Fondos de Clientes registra también el cargo del banco y la reposición de Luxcars), o confirma/anula uno declarado por el cliente cuando trae `id` (incluido el pago directo a SUNAT). Deja el evento y cierra las tareas del hito. Devuelve el id.';

revoke all on function public.registrar_movimiento(jsonb, uuid) from public;
grant execute on function public.registrar_movimiento(jsonb, uuid) to authenticated;


-- -----------------------------------------------------------------------------
--  8. registrar_documento: el aviso de pago reemplaza solo el del mismo hito
-- -----------------------------------------------------------------------------

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
  v_reemplazados integer := 0;
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
  if p_tipo::text = 'aviso_h3' and p_hito is null then
    raise exception 'El aviso de pago necesita el hito (H4, H5 o H6).';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.expediente_documentos
  where expediente_id = p_expediente and tipo = p_tipo;

  -- Las constancias son una por depósito y los avisos uno por hito: solo se
  -- reemplaza el del MISMO movimiento o el del MISMO hito.
  update public.expediente_documentos
     set estado = 'reemplazado'
   where expediente_id = p_expediente
     and tipo = p_tipo
     and estado in ('borrador', 'emitido')
     and (p_tipo::text <> 'constancia_fondos' or movimiento_id is not distinct from p_movimiento)
     and (p_tipo::text <> 'aviso_h3' or hito is not distinct from p_hito);
  get diagnostics v_reemplazados = row_count;

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
    'Versión ' || v_version || case when v_reemplazados > 0 then ' (reemplaza a la anterior).' else '.' end,
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
  'Admin o servidor. Inserta la versión siguiente del documento con su snapshot y rutas, marca la anterior reemplazada (constancias: solo la del mismo movimiento; avisos de pago: solo el del mismo hito), deja el evento y completa la tarea asociada. Devuelve {id, version}.';

revoke all on function public.registrar_documento(uuid, public.documento_tipo, text, text, jsonb, text, text, text, uuid, boolean, uuid, public.tipo_hito) from public;
grant execute on function public.registrar_documento(uuid, public.documento_tipo, text, text, jsonb, text, text, text, uuid, boolean, uuid, public.tipo_hito) to authenticated;
