-- =============================================================================
--  Migración 0019 · expedientes de importación (fase 4: embarques, terceros y
--  notificaciones)
-- =============================================================================
--
--  Lo que entra:
--    · `notificaciones`: cada correo o WhatsApp que el equipo prepara o envía
--      a un cliente (y el resumen diario del cron al propio equipo, con
--      `expediente_id` nulo). Solo lectura y escritura del equipo. El cliente
--      no la ve: lo que le llega es el correo o el mensaje, no la fila.
--    · `registrar_zarpe_arribo(p_embarque, p_datos)`: fechas del embarque y,
--      para CADA expediente del grupo (un contenedor consolidado lleva varios),
--      el evento visible al cliente ("Zarpó de Vancouver", "Arribó al Callao")
--      y las fechas estimadas que correspondan. Una sola transacción, así el
--      cliente del segundo auto no se entera un día después que el primero.
--    · `fijar_reparto_flete(p_embarque, p_reparto)`: las proporciones de flete
--      de los expedientes del embarque, validando que sumen 1 y que estén
--      todos. El trigger `tg_expedientes_aviso_proporcion` solo avisa; esto
--      exige.
--    · `verificar_banco_contraparte(p_id)`: deja constancia de quién verificó
--      por teléfono la cuenta bancaria de un tercero y cuándo (cláusula de
--      seguridad del pago: nunca se gira a una cuenta que llegó por correo sin
--      confirmarla por otro canal).
--
--  Diseño en docs/operaciones/portal-expedientes-diseno-2026-11-24.md (§5.2,
--  §8.1, §8.3). Idempotente: se puede reaplicar.
--
--  QUIÉN LLAMA. Las tres funciones son SECURITY INVOKER y aceptan dos
--  llamadores, como las de las fases 2 y 3: un administrador por la Data API
--  (`es_admin()`) o el servidor con DATABASE_URL tras `verificarSesionPortal()`
--  (`puede_escribir_documentos()` cubre ambos). El actor queda con
--  `uid_sesion()` o con `p_actor`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- notificaciones
-- -----------------------------------------------------------------------------
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  -- Nulo en el resumen diario del cron (va al equipo, no a un expediente).
  expediente_id uuid references public.expedientes (id) on delete cascade,
  canal text not null check (canal in ('email', 'whatsapp')),
  plantilla text not null check (length(plantilla) between 2 and 60),
  destinatario text check (destinatario is null or length(destinatario) <= 200),
  asunto text check (asunto is null or length(asunto) <= 300),
  cuerpo_texto text check (cuerpo_texto is null or length(cuerpo_texto) <= 20000),
  -- `enviada`: Resend aceptó el correo. `fallida`: no salió (sin clave, red,
  -- rechazo) y `error` dice por qué. `preparada`: WhatsApp, el enlace wa.me se
  -- generó y el admin lo abrió; no hay forma de saber si se mandó.
  estado text not null check (estado in ('enviada', 'fallida', 'preparada')),
  enviado_en timestamptz,
  error text check (error is null or length(error) <= 2000),
  created_by uuid references neon_auth."user" (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.notificaciones is
  'Correos y WhatsApp preparados o enviados a clientes por expediente, y el resumen diario del cron al equipo (expediente_id nulo). Solo el equipo.';

create index if not exists notificaciones_expediente_idx
  on public.notificaciones (expediente_id, created_at desc);

alter table public.notificaciones enable row level security;
revoke all on public.notificaciones from public, anonymous, authenticated;
grant select, insert, update, delete on public.notificaciones to authenticated;

drop policy if exists "notificaciones: el equipo lee" on public.notificaciones;
create policy "notificaciones: el equipo lee" on public.notificaciones
  for select to authenticated using (public.es_admin());
drop policy if exists "notificaciones: el equipo inserta" on public.notificaciones;
create policy "notificaciones: el equipo inserta" on public.notificaciones
  for insert to authenticated with check (public.es_admin());
drop policy if exists "notificaciones: el equipo actualiza" on public.notificaciones;
create policy "notificaciones: el equipo actualiza" on public.notificaciones
  for update to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists "notificaciones: el equipo borra" on public.notificaciones;
create policy "notificaciones: el equipo borra" on public.notificaciones
  for delete to authenticated using (public.es_admin());

-- -----------------------------------------------------------------------------
-- registrar_zarpe_arribo
-- -----------------------------------------------------------------------------
-- p_datos admite: fecha_zarpe_est, fecha_zarpe_real, fecha_arribo_est,
-- fecha_arribo_real, fecha_carga, nave, master_bl, precinto. Lo que no viene
-- no se toca. Devuelve cuántos expedientes activos del grupo se actualizaron.
create or replace function public.registrar_zarpe_arribo(
  p_embarque uuid,
  p_datos jsonb,
  p_actor uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := coalesce(public.uid_sesion(), p_actor);
  b public.embarques%rowtype;
  e record;
  v_n integer := 0;
  v_zarpe_real date := (p_datos->>'fecha_zarpe_real')::date;
  v_arribo_real date := (p_datos->>'fecha_arribo_real')::date;
  v_zarpe_est date := (p_datos->>'fecha_zarpe_est')::date;
  v_arribo_est date := (p_datos->>'fecha_arribo_est')::date;
  v_zarpe_nuevo boolean;
  v_arribo_nuevo boolean;
  v_puerto text;
begin
  if not public.puede_escribir_documentos() then
    raise exception 'Solo un administrador registra el zarpe o el arribo.';
  end if;
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Faltan los datos del embarque.';
  end if;
  select * into b from public.embarques where id = p_embarque for update;
  if not found then
    raise exception 'El embarque no existe.';
  end if;
  if v_zarpe_real is not null and v_arribo_real is not null and v_arribo_real < v_zarpe_real then
    raise exception 'El arribo no puede ser anterior al zarpe.';
  end if;

  v_zarpe_nuevo := v_zarpe_real is not null and (b.fecha_zarpe_real is null or b.fecha_zarpe_real <> v_zarpe_real);
  v_arribo_nuevo := v_arribo_real is not null and (b.fecha_arribo_real is null or b.fecha_arribo_real <> v_arribo_real);

  update public.embarques
     set fecha_zarpe_est = coalesce(v_zarpe_est, fecha_zarpe_est),
         fecha_zarpe_real = coalesce(v_zarpe_real, fecha_zarpe_real),
         fecha_arribo_est = coalesce(v_arribo_est, fecha_arribo_est),
         fecha_arribo_real = coalesce(v_arribo_real, fecha_arribo_real),
         fecha_carga = coalesce((p_datos->>'fecha_carga')::date, fecha_carga),
         nave = coalesce(left(nullif(trim(p_datos->>'nave'), ''), 160), nave),
         master_bl = coalesce(left(nullif(trim(p_datos->>'master_bl'), ''), 80), master_bl),
         precinto = coalesce(left(nullif(trim(p_datos->>'precinto'), ''), 80), precinto),
         estado = case
           when v_arribo_real is not null then 'arribado'
           when v_zarpe_real is not null then 'en_transito'
           else estado end
   where id = b.id;

  v_puerto := coalesce(b.puerto_origen, 'origen');

  for e in
    select x.id, x.etapa, x.codigo
    from public.expedientes x
    where x.embarque_id = b.id and x.etapa not in ('cancelado', 'cerrado')
    for update
  loop
    update public.expedientes
       set fecha_est_embarque = coalesce(v_zarpe_est, v_zarpe_real, fecha_est_embarque),
           fecha_est_arribo = coalesce(v_arribo_est, v_arribo_real, fecha_est_arribo)
     where id = e.id;

    if v_zarpe_nuevo then
      insert into public.expediente_eventos (expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa)
      values (
        e.id, 'hito', 'Zarpó de ' || v_puerto,
        'Tu auto salió el ' || to_char(v_zarpe_real, 'DD/MM/YYYY')
          || case when coalesce(nullif(trim(p_datos->>'nave'), ''), b.nave) is not null
               then ' a bordo de ' || coalesce(nullif(trim(p_datos->>'nave'), ''), b.nave) else '' end
          || case when coalesce(v_arribo_est, b.fecha_arribo_est) is not null
               then '. Arribo estimado al Callao: ' || to_char(coalesce(v_arribo_est, b.fecha_arribo_est), 'DD/MM/YYYY') || '.' else '.' end,
        true, v_actor, 'admin', e.etapa
      );
    end if;
    if v_arribo_nuevo then
      insert into public.expediente_eventos (expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa)
      values (
        e.id, 'hito', 'Arribó al ' || coalesce(b.puerto_destino, 'Callao'),
        'La nave llegó el ' || to_char(v_arribo_real, 'DD/MM/YYYY') || '. Sigue la descarga y el despacho aduanero.',
        true, v_actor, 'admin', e.etapa
      );
    end if;
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;
revoke all on function public.registrar_zarpe_arribo(uuid, jsonb, uuid) from public;
grant execute on function public.registrar_zarpe_arribo(uuid, jsonb, uuid) to authenticated;
comment on function public.registrar_zarpe_arribo(uuid, jsonb, uuid) is
  'Admin. Fechas, nave y BL del embarque; evento visible al cliente y fechas estimadas en cada expediente activo del grupo. Devuelve cuántos tocó.';

-- -----------------------------------------------------------------------------
-- fijar_reparto_flete
-- -----------------------------------------------------------------------------
-- p_reparto: [{ "expediente_id": uuid, "proporcion": 0.5 }, …]. Deben estar
-- TODOS los expedientes activos del embarque y sumar 1 (± 0,001).
create or replace function public.fijar_reparto_flete(
  p_embarque uuid,
  p_reparto jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_suma numeric := 0;
  v_item jsonb;
  v_id uuid;
  v_prop numeric;
  v_activos integer;
  v_ids uuid[] := '{}';
begin
  if not public.puede_escribir_documentos() then
    raise exception 'Solo un administrador fija el reparto del flete.';
  end if;
  if p_reparto is null or jsonb_typeof(p_reparto) <> 'array' or jsonb_array_length(p_reparto) = 0 then
    raise exception 'El reparto necesita al menos un expediente.';
  end if;
  if not exists (select 1 from public.embarques where id = p_embarque) then
    raise exception 'El embarque no existe.';
  end if;

  for v_item in select * from jsonb_array_elements(p_reparto) loop
    v_id := (v_item->>'expediente_id')::uuid;
    v_prop := (v_item->>'proporcion')::numeric;
    if v_id is null or v_prop is null then
      raise exception 'Cada línea del reparto necesita expediente_id y proporcion.';
    end if;
    if v_prop <= 0 or v_prop > 1 then
      raise exception 'La proporción de cada expediente debe estar entre 0 y 1.';
    end if;
    if v_id = any(v_ids) then
      raise exception 'El expediente % aparece dos veces en el reparto.', v_id;
    end if;
    if not exists (
      select 1 from public.expedientes x
      where x.id = v_id and x.embarque_id = p_embarque and x.etapa not in ('cancelado', 'cerrado')
    ) then
      raise exception 'El expediente % no pertenece a este embarque (o ya está cerrado).', v_id;
    end if;
    v_ids := v_ids || v_id;
    v_suma := v_suma + v_prop;
  end loop;

  select count(*) into v_activos
  from public.expedientes x
  where x.embarque_id = p_embarque and x.etapa not in ('cancelado', 'cerrado');
  if v_activos <> array_length(v_ids, 1) then
    raise exception 'El reparto debe incluir los % expedientes activos del embarque (vinieron %).', v_activos, array_length(v_ids, 1);
  end if;
  if abs(v_suma - 1) > 0.001 then
    raise exception 'Las proporciones deben sumar 1 (suman %).', round(v_suma, 4);
  end if;

  for v_item in select * from jsonb_array_elements(p_reparto) loop
    update public.expedientes
       set proporcion_flete = round((v_item->>'proporcion')::numeric, 4)
     where id = (v_item->>'expediente_id')::uuid;
  end loop;

  return array_length(v_ids, 1);
end;
$$;
revoke all on function public.fijar_reparto_flete(uuid, jsonb) from public;
grant execute on function public.fijar_reparto_flete(uuid, jsonb) to authenticated;
comment on function public.fijar_reparto_flete(uuid, jsonb) is
  'Admin. Proporciones de flete de los expedientes de un embarque: todos los activos, suma 1 (± 0,001).';

-- -----------------------------------------------------------------------------
-- verificar_banco_contraparte
-- -----------------------------------------------------------------------------
create or replace function public.verificar_banco_contraparte(
  p_id uuid,
  p_verificado boolean default true
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.contrapartes%rowtype;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador verifica cuentas bancarias.';
  end if;
  select * into c from public.contrapartes where id = p_id for update;
  if not found then
    raise exception 'La contraparte no existe.';
  end if;
  if p_verificado and (c.datos_bancarios is null or c.datos_bancarios = '{}'::jsonb) then
    raise exception 'La contraparte no tiene datos bancarios que verificar.';
  end if;
  update public.contrapartes
     set banco_verificado_en = case when p_verificado then now() else null end,
         banco_verificado_por = case when p_verificado then public.uid_sesion() else null end
   where id = p_id;
end;
$$;
revoke all on function public.verificar_banco_contraparte(uuid, boolean) from public;
grant execute on function public.verificar_banco_contraparte(uuid, boolean) to authenticated;
comment on function public.verificar_banco_contraparte(uuid, boolean) is
  'Admin. Marca (o desmarca) la cuenta bancaria de la contraparte como verificada por teléfono, con fecha y usuario.';

-- -----------------------------------------------------------------------------
-- Si los datos bancarios cambian, la verificación anterior deja de valer.
-- -----------------------------------------------------------------------------
create or replace function public.tg_contrapartes_banco_cambiado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.datos_bancarios is distinct from old.datos_bancarios
     and new.banco_verificado_en is not distinct from old.banco_verificado_en then
    new.banco_verificado_en := null;
    new.banco_verificado_por := null;
  end if;
  return new;
end;
$$;
drop trigger if exists contrapartes_banco_cambiado on public.contrapartes;
create trigger contrapartes_banco_cambiado
  before update of datos_bancarios on public.contrapartes
  for each row execute function public.tg_contrapartes_banco_cambiado();
