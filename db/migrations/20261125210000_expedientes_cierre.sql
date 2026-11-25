-- =============================================================================
-- Expedientes de importación · fase 5: cierre operativo
-- =============================================================================
--
-- Qué trae:
--  1. Índices que faltaban, medidos con EXPLAIN (ANALYZE, BUFFERS) sobre una
--     semilla sintética de 400 expedientes, 20.000 eventos, 6.000 movimientos,
--     3.200 documentos y 2.400 tramos de etapa, dentro de una transacción que
--     se revirtió (la base de producción estaba vacía al medir, 25 nov 2026).
--  2. Políticas RLS del módulo con `(select es_admin())` en vez de `es_admin()`:
--     Postgres evaluaba la función UNA VEZ POR FILA (es STABLE, pero sin el
--     sub-select no la convierte en InitPlan). Medido: leer el historial de
--     etapas completo como administrador pasó de 12,5 ms y 4.828 buffers a
--     0,4 ms y 30 buffers; la lista del tablero, de 3,2 ms a 0,15 ms.
--  3. Vistas `*_cliente` filtrando con `cliente_id in (select … clientes …)`
--     en vez de `es_dueno_expediente(cliente_id)` por fila. Medido en
--     `expediente_cliente`: de 6,8 ms y 1.625 buffers (un sub-select por cada
--     uno de los 400 expedientes) a 0,05 ms y 7 buffers (índice por usuario y
--     por cliente). La función `es_dueno_expediente` sigue existiendo para las
--     RPC del cliente; ya no la usan las vistas.
--  4. Trigger que, al abrir un expediente desde una solicitud de compra, deja
--     la solicitud `cerrada` con la respuesta visible al cliente apuntando al
--     código del expediente (y al revés, si se enlaza después). Reemplaza el
--     `propuesta_enviada` que ponía `crear_expediente` en la fase 1: con el
--     expediente abierto, el pedido de búsqueda ya está atendido y el cliente
--     lo sigue desde la tarjeta del expediente en su cuenta.
--
-- Idempotente: se puede volver a correr. Después: refrescar la caché de la
-- Data API (`neon data-api refresh-schema …`).
--
-- Lo que NO hace falta y se verificó: `avanzar_expediente` ya fija
-- `cerrado_en` al pasar a `cerrado` o `cancelado` (fase 1).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Índices
-- -----------------------------------------------------------------------------

-- Tablero y cron: "los abiertos, del más reciente en su etapa al más antiguo".
-- Antes: Seq Scan sobre toda la tabla (incluidos los 300 cerrados), 3,2 ms.
-- Después: Index Scan sobre las ~100 filas activas, 0,15 ms. Parcial para que
-- no crezca con el archivo.
create index if not exists expedientes_activos_idx
  on public.expedientes (etapa_desde desc)
  where etapa not in ('cerrado', 'cancelado');

-- Archivo por año y métricas de cierres por mes. Antes: Seq Scan + filtro,
-- 1,6 ms y 512 buffers; después: Index Scan por rango, 0,23 ms.
create index if not exists expedientes_cerrado_en_idx
  on public.expedientes (cerrado_en desc)
  where cerrado_en is not null;

-- "¿Qué expediente salió de esta solicitud?" (botón en /portal/solicitudes).
-- Antes: Seq Scan 0,58 ms; después: Index Scan 0,02 ms y 1 buffer.
create index if not exists expedientes_origen_solicitud_idx
  on public.expedientes (origen_solicitud_id)
  where origen_solicitud_id is not null;

-- Registro UIF: movimientos confirmados en un rango de fechas, de todos los
-- expedientes. Antes: Seq Scan de los 6.000 asientos (127 buffers); después:
-- Bitmap por rango (39 buffers). El índice de la fase 3 empieza por
-- expediente_id y no sirve para un rango de fechas global.
create index if not exists expediente_movimientos_fecha_idx
  on public.expediente_movimientos (fecha, expediente_id)
  where estado = 'confirmado';

-- Descartado tras medir: un índice `expediente_etapas (etapa, desde)` para las
-- métricas de duración. La pantalla lee el historial completo (2.400 filas,
-- 0,4 ms con la política corregida) y agrega en el core; el planificador
-- eligió Seq Scan igual con el índice puesto.

-- -----------------------------------------------------------------------------
-- 2. Políticas: es_admin() una vez por consulta, no por fila
-- -----------------------------------------------------------------------------
--
-- Solo las tablas del módulo de expedientes. Las demás (vehicles, leads…) no
-- se tocan en esta fase. `qual`/`with_check` se leen de pg_policies para que
-- correr esto dos veces no haga nada la segunda.

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'clientes', 'contrapartes', 'embarques', 'expedientes', 'expedientes_reservado',
        'expediente_etapas', 'expediente_tareas', 'expediente_hitos', 'expediente_eventos',
        'expediente_aprobaciones', 'expediente_documentos', 'expediente_movimientos', 'notificaciones'
      )
      and (qual = 'es_admin()' or with_check = 'es_admin()')
  loop
    if p.cmd = 'INSERT' then
      execute format('alter policy %I on %I.%I with check ((select public.es_admin()))', p.policyname, p.schemaname, p.tablename);
    elsif p.cmd = 'UPDATE' then
      execute format('alter policy %I on %I.%I using ((select public.es_admin())) with check ((select public.es_admin()))', p.policyname, p.schemaname, p.tablename);
    else
      execute format('alter policy %I on %I.%I using ((select public.es_admin()))', p.policyname, p.schemaname, p.tablename);
    end if;
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- 3. Vistas del cliente: propiedad por sub-consulta, no por función fila a fila
-- -----------------------------------------------------------------------------
--
-- Las vistas corren con los permisos del dueño (no son security_invoker), así
-- que la sub-consulta a `clientes` no pasa por RLS: es la misma garantía que
-- daba `es_dueno_expediente` (SECURITY DEFINER), solo que el planificador la
-- resuelve una vez (Index Scan por `clientes_user_idx`) y entra a `expedientes`
-- por `expedientes_cliente_idx`. Mismas columnas, mismo orden.

create or replace view public.expediente_cliente as
  select
    e.id, e.codigo, e.cliente_id, e.etapa, e.etapa_desde, e.embarque_id,
    e.veh_marca, e.veh_modelo, e.veh_version, e.veh_anio, e.veh_vin, e.veh_color, e.veh_km,
    e.veh_combustible, e.veh_cilindrada_cc, e.veh_transmision, e.veh_condicion, e.veh_categoria,
    e.veh_pais_ensamblaje, e.moneda_compra, e.precio_compra, e.precio_compra_usd, e.fecha_inspeccion,
    e.pais_origen, e.puerto_origen, e.honorarios_usd, e.honorarios_base_usd, e.honorarios_igv_usd,
    e.fecha_firma, e.fecha_limite_h2, e.fecha_est_embarque, e.fecha_est_arribo, e.fecha_est_entrega,
    e.semanas_estimadas, e.dam_numero, e.dam_fecha, e.levante_en, e.placa, e.tive_numero, e.fecha_entrega,
    e.cancelado_motivo, e.cerrado_en, e.created_at, e.updated_at
  from public.expedientes e
  where e.etapa <> 'prospecto'
    and e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

create or replace view public.expediente_etapa_cliente as
  select s.id, s.expediente_id, s.etapa, s.desde, s.hasta
  from public.expediente_etapas s
  join public.expedientes e on e.id = s.expediente_id
  where e.etapa <> 'prospecto'
    and e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

create or replace view public.expediente_tarea_cliente as
  select t.id, t.expediente_id, t.etapa, t.clave, t.titulo, t.descripcion, t.responsable, t.estado,
         t.vence_el, t.hecha_en, t.orden, t.created_at
  from public.expediente_tareas t
  join public.expedientes e on e.id = t.expediente_id
  where t.visible_cliente
    and e.etapa <> 'prospecto'
    and e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

create or replace view public.expediente_hito_cliente as
  select h.id, h.expediente_id, h.tipo, h.monto_estimado_usd, h.fecha_limite, h.nota
  from public.expediente_hitos h
  join public.expedientes e on e.id = h.expediente_id
  where e.etapa <> 'prospecto'
    and e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

create or replace view public.expediente_evento_cliente as
  select v.id, v.expediente_id, v.tipo, v.titulo, v.detalle, v.actor_tipo, v.etapa, v.created_at
  from public.expediente_eventos v
  join public.expedientes e on e.id = v.expediente_id
  where v.visible_cliente
    and e.etapa <> 'prospecto'
    and e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

create or replace view public.expediente_aprobacion_cliente as
  select a.id, a.expediente_id, a.tipo, a.payload, a.created_at
  from public.expediente_aprobaciones a
  join public.expedientes e on e.id = a.expediente_id
  where e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

create or replace view public.embarque_cliente as
  select e.id as expediente_id, b.id, b.codigo, b.modalidad, b.contenedor, b.puerto_origen, b.puerto_destino,
         b.fecha_release_est, b.fecha_release_real, b.fecha_carga, b.fecha_zarpe_est, b.fecha_zarpe_real,
         b.fecha_arribo_est, b.fecha_arribo_real, b.nave, b.master_bl
  from public.expedientes e
  join public.embarques b on b.id = e.embarque_id
  where e.etapa <> 'prospecto'
    and e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

create or replace view public.expediente_documento_cliente as
  select d.id, d.expediente_id, d.tipo, d.version, d.estado, d.titulo,
         d.ruta_firmado is not null as tiene_firmado,
         d.ruta_pdf is not null as tiene_pdf,
         d.emitido_en, d.firmado_en, d.created_at, d.movimiento_id, d.hito
  from public.expediente_documentos d
  join public.expedientes e on e.id = d.expediente_id
  where d.visible_cliente
    and d.estado <> 'borrador'
    and e.etapa <> 'prospecto'
    and e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

create or replace view public.expediente_movimiento_cliente as
  select m.id, m.expediente_id, m.tipo, m.cuenta, m.hito, m.estado, m.fecha, m.moneda, m.monto, m.tipo_cambio,
         m.monto_usd, m.concepto, m.documento_ref,
         m.comprobante_path is not null as tiene_comprobante,
         m.declarado_por_cliente, m.created_at
  from public.expediente_movimientos m
  join public.expedientes e on e.id = m.expediente_id
  where m.estado in ('por_confirmar', 'confirmado')
    and e.etapa <> 'prospecto'
    and e.cliente_id in (select c.id from public.clientes c where c.user_id = (select auth.uid()));

-- `create or replace view` conserva los grants, pero se repiten por si una
-- vista se hubiera recreado con drop en otra sesión.
grant select on public.expediente_cliente, public.expediente_etapa_cliente, public.expediente_tarea_cliente,
  public.expediente_hito_cliente, public.expediente_evento_cliente, public.expediente_aprobacion_cliente,
  public.embarque_cliente, public.expediente_documento_cliente, public.expediente_movimiento_cliente
  to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Solicitud de compra → expediente
-- -----------------------------------------------------------------------------
--
-- Al insertar un expediente con `origen_solicitud_id` (o al enlazarlo después),
-- la solicitud queda `cerrada` y el cliente lee en su cuenta a qué expediente
-- dio lugar. `crear_expediente` (fase 1) sigue poniendo `propuesta_enviada`
-- solo si la solicitud estaba `nueva` o `en_busqueda`; como este trigger corre
-- antes (AFTER INSERT, dentro de la misma función), la deja `cerrada` y ese
-- CASE ya no la toca. El trigger de protección de `solicitudes_compra` deja
-- pasar al administrador (y a este SECURITY DEFINER, que corre como dueño).

create or replace function public.tg_expedientes_cerrar_solicitud()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texto text;
begin
  if new.origen_solicitud_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.origen_solicitud_id is not distinct from old.origen_solicitud_id then
    return new;
  end if;

  v_texto := 'Tu pedido se convirtió en el expediente ' || new.codigo || '. Síguelo desde tu cuenta, en Mis importaciones.';

  update public.solicitudes_compra s
     set estado = 'cerrada',
         respuesta_luxcars = case
           when s.respuesta_luxcars is null or btrim(s.respuesta_luxcars) = '' then v_texto
           when position(new.codigo in s.respuesta_luxcars) > 0 then s.respuesta_luxcars
           else left(s.respuesta_luxcars, 1800) || E'\n\n' || v_texto
         end,
         atendido_por = coalesce(s.atendido_por, auth.uid())
   where s.id = new.origen_solicitud_id;

  return new;
end;
$$;

revoke all on function public.tg_expedientes_cerrar_solicitud() from public;

drop trigger if exists expedientes_cerrar_solicitud on public.expedientes;
create trigger expedientes_cerrar_solicitud
  after insert or update of origen_solicitud_id on public.expedientes
  for each row execute function public.tg_expedientes_cerrar_solicitud();

comment on function public.tg_expedientes_cerrar_solicitud() is
  'Fase 5. Al abrir o enlazar un expediente desde una solicitud de compra, la deja cerrada con la respuesta al cliente apuntando al código del expediente.';
