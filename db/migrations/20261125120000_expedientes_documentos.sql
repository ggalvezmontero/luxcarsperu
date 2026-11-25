-- =============================================================================
--  Migración 0017 · expedientes de importación (fase 2: documentos del contrato)
-- =============================================================================
--
--  Cada expediente genera documentos desde plantillas (contrato, anexos A a D,
--  carta de autorización, instrucciones al vendedor y al forwarder; en fases
--  siguientes constancias, liquidación, acta y rendición) y archiva los que
--  vuelven firmados. Cada emisión es una VERSIÓN con el snapshot de campos con
--  que se generó: regenerar crea la siguiente y marca la anterior como
--  `reemplazado`. Los archivos (PDF, DOCX, firmado) viven en el bucket PRIVADO
--  `expedientes` de Neon Object Storage; acá solo se guarda la ruta del objeto,
--  y la descarga pasa siempre por una ruta de servidor que comprueba sesión y
--  propiedad y emite una URL firmada de cinco minutos.
--
--  Diseño en docs/operaciones/portal-expedientes-diseno-2026-11-24.md (§4.3,
--  §5.2, §6 y §7). Reglas de la fase 1 que se respetan:
--
--    · Las tablas base son solo del equipo (`es_admin()`); el cliente lee por
--      la vista `expediente_documento_cliente`, que filtra con
--      `es_dueno_expediente()` y `visible_cliente`, y NO expone las rutas de
--      objeto ni el snapshot de campos ni la versión de plantilla.
--    · Lo transaccional (versión siguiente, reemplazo de la anterior, evento,
--      tarea) va en una función SECURITY DEFINER: `registrar_documento`.
--
--  QUIÉN LLAMA A LAS FUNCIONES. Generar un PDF no se puede hacer desde el
--  navegador: lo hace una ruta de servidor (`/api/portal/expedientes/[id]/
--  documentos`) que YA verificó sesión y rol admin con `verificarSesionPortal`
--  y entra a la base como dueño (`DATABASE_URL`). En esa conexión `auth.uid()`
--  es NULL y `es_admin()` es falso, así que las funciones aceptan dos
--  llamadores: un administrador por la Data API (`es_admin()`), o el servidor
--  (cualquier rol que NO sea `authenticated` ni `anonymous`, es decir, el
--  dueño). El servidor pasa `p_actor` con el usuario verificado para que el
--  evento y la fila lleven quién lo hizo.
--
--  Por eso estas funciones son SECURITY INVOKER, no DEFINER como las de la
--  fase 1: dentro de una función DEFINER `current_user` es el dueño y la
--  comprobación del rol no distingue nada (se vio en la prueba de punta a
--  punta: un cliente llegaba a ejecutarla). Como INVOKER, el administrador que
--  llama por la Data API corre como `authenticated` con sus políticas RLS (que
--  ya le dan todo), y el dueño corre como dueño.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. TIPOS
-- -----------------------------------------------------------------------------
--  Espejo exacto de `TipoDocumento` y `EstadoDocumento` en
--  src/core/expedientes/tipos.ts.

do $$ begin
  create type public.documento_tipo as enum (
    'contrato', 'anexo_a', 'anexo_b', 'anexo_c', 'anexo_d', 'loa',
    'instrucciones_vendedor', 'instrucciones_forwarder',
    'constancia_fondos', 'aviso_h3', 'liquidacion_definitiva', 'acta_entrega', 'rendicion',
    'factura_honorarios', 'bill_of_sale', 'documento_propiedad', 'informe_inspeccion',
    'poliza', 'bl', 'acta_carga', 'dam', 'liquidacion_sunat',
    'comprobante_pago', 'comprobante_cliente', 'tive', 'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.documento_estado as enum (
    'borrador', 'emitido', 'firmado', 'reemplazado', 'anulado'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
--  2. TABLA
-- -----------------------------------------------------------------------------

create table if not exists public.expediente_documentos (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes (id) on delete cascade,
  tipo public.documento_tipo not null,
  version integer not null default 1 check (version >= 1),
  estado public.documento_estado not null default 'emitido',
  -- 'generado' desde una plantilla, 'subido' por el equipo (bill of sale, BL, DAM…).
  origen text not null default 'generado' check (origen in ('generado', 'subido')),
  titulo text not null check (length(titulo) between 2 and 200),
  -- Versión de la plantilla del core con la que se construyó (p. ej. "contrato@2026-11-24").
  plantilla_version text check (plantilla_version is null or length(plantilla_version) <= 80),
  -- Snapshot de los campos {{CAMPO}} con que se generó. Reproduce el documento
  -- aunque el expediente cambie después.
  campos jsonb,
  -- Rutas de objeto en el bucket privado `expedientes`. Nunca URLs.
  ruta_pdf text check (ruta_pdf is null or length(ruta_pdf) <= 300),
  ruta_docx text check (ruta_docx is null or length(ruta_docx) <= 300),
  ruta_firmado text check (ruta_firmado is null or length(ruta_firmado) <= 300),
  visible_cliente boolean not null default false,
  emitido_por uuid references neon_auth."user" (id) on delete set null,
  emitido_en timestamptz,
  firmado_en date,
  created_by uuid references neon_auth."user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expediente_id, tipo, version)
);

comment on table public.expediente_documentos is
  'Documentos del expediente, versionados. Los generados guardan el snapshot de campos y la versión de plantilla; los archivos viven en el bucket privado `expedientes` y solo se bajan por URL firmada desde una ruta de servidor.';
comment on column public.expediente_documentos.campos is
  'Mapa {{CAMPO}} → valor con que se construyó el documento (src/core/expedientes/campos.ts). Snapshot: no se actualiza.';

create index if not exists expediente_documentos_exp_idx
  on public.expediente_documentos (expediente_id, tipo, version desc);

drop trigger if exists expediente_documentos_set_updated_at on public.expediente_documentos;
create trigger expediente_documentos_set_updated_at
  before update on public.expediente_documentos
  for each row execute function public.tg_marcar_actualizado();

-- Las columnas `documento_id` de la fase 1 se declararon sin FK porque la
-- tabla no existía. Ahora sí.
alter table public.expediente_tareas
  drop constraint if exists expediente_tareas_documento_fk;
alter table public.expediente_tareas
  add constraint expediente_tareas_documento_fk
  foreign key (documento_id) references public.expediente_documentos (id) on delete set null;

alter table public.expediente_eventos
  drop constraint if exists expediente_eventos_documento_fk;
alter table public.expediente_eventos
  add constraint expediente_eventos_documento_fk
  foreign key (documento_id) references public.expediente_documentos (id) on delete set null;


-- -----------------------------------------------------------------------------
--  3. SEGURIDAD — tabla base solo del equipo
-- -----------------------------------------------------------------------------

alter table public.expediente_documentos enable row level security;
revoke all on public.expediente_documentos from anonymous, authenticated;
grant select, insert, update, delete on public.expediente_documentos to authenticated;

drop policy if exists "expediente_documentos: el equipo lee" on public.expediente_documentos;
create policy "expediente_documentos: el equipo lee"
  on public.expediente_documentos for select to authenticated
  using (public.es_admin());

drop policy if exists "expediente_documentos: el equipo inserta" on public.expediente_documentos;
create policy "expediente_documentos: el equipo inserta"
  on public.expediente_documentos for insert to authenticated
  with check (public.es_admin());

drop policy if exists "expediente_documentos: el equipo actualiza" on public.expediente_documentos;
create policy "expediente_documentos: el equipo actualiza"
  on public.expediente_documentos for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists "expediente_documentos: el equipo borra" on public.expediente_documentos;
create policy "expediente_documentos: el equipo borra"
  on public.expediente_documentos for delete to authenticated
  using (public.es_admin());


-- -----------------------------------------------------------------------------
--  4. VISTA DEL CLIENTE — sus documentos visibles, sin rutas ni campos
-- -----------------------------------------------------------------------------
--  Corre como el dueño de la base (sin security_invoker) y filtra adentro. El
--  archivo se baja por /api/cuenta/expedientes/archivos, que vuelve a comprobar
--  propiedad y visibilidad con la tabla base antes de firmar la URL.

create or replace view public.expediente_documento_cliente as
  select
    d.id, d.expediente_id, d.tipo, d.version, d.estado, d.titulo,
    (d.ruta_firmado is not null) as tiene_firmado,
    (d.ruta_pdf is not null) as tiene_pdf,
    d.emitido_en, d.firmado_en, d.created_at
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

-- Usuario de la sesión, utilizable desde una función SECURITY INVOKER que corre
-- como `authenticated` (ese rol no tiene USAGE sobre el esquema `auth`; las
-- políticas lo consultan siempre a través de funciones DEFINER como esta).
create or replace function public.uid_sesion()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid();
$$;

revoke all on function public.uid_sesion() from public;
grant execute on function public.uid_sesion() to authenticated;


-- ¿Quién llama puede escribir documentos? Un administrador por la Data API, o
-- el servidor (conexión del dueño, que nunca es `authenticated` ni `anonymous`).
-- SECURITY INVOKER a propósito: con DEFINER `current_user` sería el dueño siempre.
create or replace function public.puede_escribir_documentos()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.es_admin() or current_user not in ('authenticated', 'anonymous');
$$;

revoke all on function public.puede_escribir_documentos() from public;
grant execute on function public.puede_escribir_documentos() to authenticated;


-- Registra una emisión: versión siguiente del tipo, la anterior pasa a
-- `reemplazado`, evento interno y, si viene la clave, la tarea del expediente
-- queda hecha con el documento como evidencia. Devuelve {id, version}.
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
  p_visible_cliente boolean default false
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

  update public.expediente_documentos
     set estado = 'reemplazado'
   where expediente_id = p_expediente
     and tipo = p_tipo
     and estado in ('borrador', 'emitido');

  insert into public.expediente_documentos (
    expediente_id, tipo, version, estado, origen, titulo, plantilla_version, campos,
    ruta_pdf, ruta_docx, visible_cliente, emitido_por, emitido_en, created_by
  ) values (
    p_expediente, p_tipo, v_version, 'emitido', 'generado', left(trim(p_titulo), 200),
    left(p_plantilla_version, 80), p_campos,
    left(p_ruta_pdf, 300), left(p_ruta_docx, 300), coalesce(p_visible_cliente, false),
    v_actor, now(), v_actor
  )
  returning id into v_id;

  insert into public.expediente_eventos (
    expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, documento_id
  ) values (
    p_expediente, 'documento',
    'Documento generado: ' || left(trim(p_titulo), 200),
    'Versión ' || v_version || case when v_version > 1 then ' (reemplaza a la anterior).' else '.' end,
    false, v_actor, 'admin', e.etapa, v_id
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

comment on function public.registrar_documento(uuid, public.documento_tipo, text, text, jsonb, text, text, text, uuid, boolean) is
  'Admin o servidor. Inserta la versión siguiente del documento con su snapshot y rutas, marca la anterior reemplazada, deja el evento y completa la tarea asociada. Devuelve {id, version}.';


-- Archiva el PDF firmado de un documento emitido: ruta, estado `firmado`,
-- fecha de firma y evento visible al cliente si el documento lo es.
create or replace function public.marcar_documento_firmado(
  p_documento uuid,
  p_ruta_firmado text,
  p_firmado_en date default null,
  p_actor uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := coalesce(public.uid_sesion(), p_actor);
  d public.expediente_documentos%rowtype;
  e public.expedientes%rowtype;
begin
  if not public.puede_escribir_documentos() then
    raise exception 'Solo un administrador archiva documentos firmados.';
  end if;

  select * into d from public.expediente_documentos where id = p_documento for update;
  if not found then
    raise exception 'El documento no existe.';
  end if;
  if d.estado = 'reemplazado' or d.estado = 'anulado' then
    raise exception 'Este documento fue reemplazado: sube el firmado sobre la versión vigente.';
  end if;
  if p_ruta_firmado is null or length(trim(p_ruta_firmado)) = 0 then
    raise exception 'Falta la ruta del archivo firmado.';
  end if;

  select * into e from public.expedientes where id = d.expediente_id;

  update public.expediente_documentos
     set ruta_firmado = left(trim(p_ruta_firmado), 300),
         estado = 'firmado',
         firmado_en = coalesce(p_firmado_en, firmado_en, current_date)
   where id = p_documento;

  insert into public.expediente_eventos (
    expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, documento_id
  ) values (
    d.expediente_id, 'documento',
    'Documento firmado: ' || d.titulo,
    'Versión ' || d.version || ' archivada con las firmas.',
    d.visible_cliente, v_actor, 'admin', e.etapa, d.id
  );
end;
$$;

comment on function public.marcar_documento_firmado(uuid, text, date, uuid) is
  'Admin o servidor. Guarda la ruta del PDF firmado, pasa el documento a `firmado` y deja el evento (visible al cliente si el documento lo es).';


revoke all on function public.registrar_documento(uuid, public.documento_tipo, text, text, jsonb, text, text, text, uuid, boolean) from public;
revoke all on function public.marcar_documento_firmado(uuid, text, date, uuid) from public;
grant execute on function public.registrar_documento(uuid, public.documento_tipo, text, text, jsonb, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.marcar_documento_firmado(uuid, text, date, uuid) to authenticated;
