-- Expedientes · configuración de la empresa para los documentos y clase del vehículo (2026-11-27)
--
--  1. Tabla `configuracion_documentos`: los parámetros de la EMPRESA que van en
--     los documentos del expediente (RUC, domicilio, partida registral,
--     representante y su DNI, cuentas de Operaciones, Fondos de Clientes y
--     Detracciones, porcentaje de detracción, ciudad de firma, días máximos de
--     espera en consolidado). Una fila por campo: la clave es el nombre del
--     campo del paquete (`LUXCARS_RUC`, `CTA_FONDOS_NUMERO`, …) tal como lo
--     define `src/core/expedientes/campos.ts` (CAMPOS_EMPRESA). El equipo los
--     llena una vez desde /portal/configuracion; desde entonces ningún
--     documento se emite con una raya en blanco: lo que falte bloquea la
--     emisión y la pestaña Documentos manda a Configuración.
--
--     La variable de entorno `LUXCARS_DOCUMENTOS_JSON` sigue existiendo solo
--     como RESPALDO (lo que la tabla no tenga se toma de ahí); la tabla manda.
--     Los valores NO van en el repositorio (público): se escriben desde el
--     portal con la sesión del administrador.
--
--  2. `expedientes.veh_clase` ('M1' autos y SUV / 'N1' pickups y camionetas):
--     la categoría vehicular que piden el Anexo A y la aduana. Se pide en el
--     alta (`crear_expediente` la acepta en `p_datos->>'veh_clase'`) y se
--     muestra al cliente en `expediente_cliente`.
--
-- Idempotente: se puede volver a aplicar.
-- Después de aplicar: `neon data-api refresh-schema`.

-- 1. Configuración de la empresa -------------------------------------------

create table if not exists public.configuracion_documentos (
  clave text primary key check (clave ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  valor text not null check (length(valor) between 1 and 500),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.configuracion_documentos is
  'Parámetros de la empresa que van en los documentos del expediente (RUC, domicilio, partida, representante y DNI, cuentas de Operaciones / Fondos de Clientes / Detracciones, porcentaje de detracción, ciudad de firma, días de espera en consolidado). Una fila por campo del paquete (clave = nombre del campo en src/core/expedientes/campos.ts). Se llena desde /portal/configuracion; la variable LUXCARS_DOCUMENTOS_JSON queda solo como respaldo. Solo admin.';
comment on column public.configuracion_documentos.clave is 'Nombre del campo del paquete, p. ej. LUXCARS_RUC o CTA_FONDOS_NUMERO.';
comment on column public.configuracion_documentos.updated_by is 'Perfil (auth.uid()) que guardó el valor por última vez.';

alter table public.configuracion_documentos enable row level security;

revoke all on public.configuracion_documentos from public, anonymous;
grant select, insert, update, delete on public.configuracion_documentos to authenticated;

drop policy if exists "configuracion_documentos: el equipo lee" on public.configuracion_documentos;
create policy "configuracion_documentos: el equipo lee"
  on public.configuracion_documentos
  for select to authenticated
  using ((select public.es_admin()));

drop policy if exists "configuracion_documentos: el equipo crea" on public.configuracion_documentos;
create policy "configuracion_documentos: el equipo crea"
  on public.configuracion_documentos
  for insert to authenticated
  with check ((select public.es_admin()));

drop policy if exists "configuracion_documentos: el equipo edita" on public.configuracion_documentos;
create policy "configuracion_documentos: el equipo edita"
  on public.configuracion_documentos
  for update to authenticated
  using ((select public.es_admin()))
  with check ((select public.es_admin()));

drop policy if exists "configuracion_documentos: el equipo borra" on public.configuracion_documentos;
create policy "configuracion_documentos: el equipo borra"
  on public.configuracion_documentos
  for delete to authenticated
  using ((select public.es_admin()));

-- 2. Clase del vehículo (M1 / N1) --------------------------------------------

alter table public.expedientes
  add column if not exists veh_clase text check (veh_clase is null or veh_clase in ('M1', 'N1'));

comment on column public.expedientes.veh_clase is
  'Categoría vehicular para el Anexo A y la aduana: M1 (autos y SUV) o N1 (pickups y camionetas).';

-- La vista del cliente lista columnas del vehículo: se añade al final (create
-- or replace view solo admite columnas nuevas al final; los grants se conservan).
create or replace view public.expediente_cliente as
  select
    e.id, e.codigo, e.cliente_id, e.etapa, e.etapa_desde, e.embarque_id,
    e.veh_marca, e.veh_modelo, e.veh_version, e.veh_anio, e.veh_vin, e.veh_color, e.veh_km,
    e.veh_combustible, e.veh_cilindrada_cc, e.veh_transmision, e.veh_condicion, e.veh_categoria,
    e.veh_pais_ensamblaje, e.moneda_compra, e.precio_compra, e.precio_compra_usd, e.fecha_inspeccion,
    e.pais_origen, e.puerto_origen, e.honorarios_usd, e.honorarios_base_usd, e.honorarios_igv_usd,
    e.fecha_firma, e.fecha_limite_h2, e.fecha_est_embarque, e.fecha_est_arribo, e.fecha_est_entrega,
    e.semanas_estimadas, e.dam_numero, e.dam_fecha, e.levante_en, e.placa, e.tive_numero, e.fecha_entrega,
    e.cancelado_motivo, e.cerrado_en, e.created_at, e.updated_at,
    e.veh_clase
  from public.expedientes e
  where e.etapa <> 'prospecto'
    and e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

grant select on public.expediente_cliente to authenticated;

-- `crear_expediente` acepta `veh_clase`. Mismo cuerpo que la fase 1 más la
-- columna nueva (la solicitud de origen la cierra el trigger de la fase 5).
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
  if v_etapa not in ('prospecto', 'contrato') then
    raise exception 'Un expediente nace en prospecto o en contrato, no en %.', v_etapa;
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
    (p_datos->>'fecha_limite_compra')::date, (p_datos->>'fecha_inspeccion')::date,
    left(p_datos->>'historial_ref', 200), (p_datos->>'fecha_release')::date,
    left(p_datos->>'pais_origen', 80), left(p_datos->>'puerto_origen', 120),
    p_datos->'presupuesto',
    (p_datos->>'honorarios_usd')::numeric, (p_datos->>'honorarios_base_usd')::numeric,
    (p_datos->>'honorarios_igv_usd')::numeric,
    (p_datos->>'porcentaje_detraccion')::numeric,
    coalesce((p_datos->>'margen_h3')::numeric, 0),
    (p_datos->>'tarifa_custodia_usd')::numeric, (p_datos->>'costo_inspeccion_usd')::numeric,
    (p_datos->>'fecha_firma')::date, (p_datos->>'fecha_limite_h2')::date,
    (p_datos->>'fecha_est_embarque')::date, (p_datos->>'fecha_est_arribo')::date,
    (p_datos->>'fecha_est_entrega')::date,
    left(p_datos->>'semanas_estimadas', 40), (p_datos->>'loa_vence')::date,
    auth.uid()
  )
  returning id, codigo into v_id, v_codigo;

  insert into public.expedientes_reservado (
    expediente_id, precio_tope, tc_compra_ref, vendedor_id, inspector_id, agente_aduana_id, notas_internas
  ) values (
    v_id,
    (p_datos->>'precio_tope')::numeric,
    (p_datos->>'tc_compra_ref')::numeric,
    (p_datos->>'vendedor_id')::uuid,
    (p_datos->>'inspector_id')::uuid,
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
  'Solo admin. Abre el expediente con su parte reservada, historial, hitos, tareas de la etapa inicial y el evento de apertura, en una transacción. Acepta veh_clase (M1/N1). Devuelve el id.';

revoke all on function public.crear_expediente(jsonb) from public;
grant execute on function public.crear_expediente(jsonb) to authenticated;
