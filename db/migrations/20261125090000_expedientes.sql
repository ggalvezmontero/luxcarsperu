-- =============================================================================
--  Migración 0016 · expedientes de importación (fase 1: núcleo y seguimiento)
-- =============================================================================
--
--  Una importación a pedido es un EXPEDIENTE: un vehículo, un cliente, un
--  mandato. El equipo lo abre, lo lleva por nueve etapas y registra lo que
--  pasa; el cliente lo sigue desde su cuenta y toma las decisiones que el
--  contrato le reserva (aprobar la inspección, elegir esperar o embarcar solo,
--  dar conformidad a la rendición). Diseño en
--  docs/operaciones/portal-expedientes-diseno-2026-11-24.md (carpeta privada).
--
--  Esta fase crea: enums, `clientes`, `contrapartes`, `embarques`,
--  `expedientes` (+ `expedientes_reservado`), historial de etapas, tareas,
--  hitos, eventos y aprobaciones, con RLS, las vistas del cliente y las
--  funciones `crear_expediente`, `avanzar_expediente`, `completar_tarea`,
--  `vincular_cliente_cuenta` y `cliente_accion_expediente`. Los documentos, el
--  libro de movimientos y las notificaciones son de las fases 2 a 4.
--
--  REGLAS DE LA CASA QUE SE RESPETAN
--  ---------------------------------------------------------------------------
--  · RLS es el candado: todo se lee y escribe desde el navegador con la sesión.
--  · Lo que son varios pasos va en una función SECURITY DEFINER.
--  · Las reglas de negocio (qué etapa sigue, qué falta para avanzar, cómo se
--    calcula el presupuesto) viven en `src/core/expedientes/`. Las funciones de
--    acá hacen la transacción y lo mínimo de integridad (una etapa a la vez,
--    motivo obligatorio al forzar o cancelar).
--
--  POR QUÉ EL CLIENTE LEE POR VISTAS Y NO POR GRANTS DE COLUMNA
--  ---------------------------------------------------------------------------
--  El diseño pedía "grants por columna para el cliente". No se puede: el
--  cliente y el administrador entran a la Data API con el MISMO rol de
--  Postgres (`authenticated`); quién es quién lo decide `es_admin()` dentro de
--  cada política. Un `grant select (columnas)` se lo quitaría también al
--  equipo. Por eso:
--
--    · Las tablas base solo tienen políticas de administrador. Para un cliente
--      devuelven cero filas, pida la columna que pida.
--    · El cliente lee por vistas `*_cliente` que corren como su dueño (sin
--      `security_invoker`), exponen SOLO las columnas que le corresponden y
--      filtran con `es_dueno_expediente()` adentro. Es el mismo "vista como
--      puerta" que `vehiculos_publicos`, con el filtro dentro de la vista.
--    · Lo reservado del expediente (notas internas, precio tope, tipo de
--      cambio de referencia, a quién se le compra, inspector, agente) vive en
--      `expedientes_reservado`, tabla aparte y solo admin: así ni una vista
--      mal escrita mañana lo puede filtrar.
--
--  El cliente NO inserta en ninguna tabla de este módulo: sus acciones van por
--  `cliente_accion_expediente`, que verifica propiedad y tarea pendiente.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. TIPOS
-- -----------------------------------------------------------------------------
--  Espejo exacto de los tipos de `src/core/expedientes/tipos.ts`.

do $$ begin
  create type public.etapa_expediente as enum (
    'prospecto', 'contrato', 'busqueda', 'compra', 'embarque',
    'transito', 'aduana', 'placas', 'entrega', 'cerrado', 'cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.modalidad_embarque as enum ('consolidado', 'exclusivo', 'roro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_contenedor as enum ('c20', 'c40', 'c40hc', 'roro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_hito as enum ('H1', 'H2', 'H3', 'H4');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cuenta_movimiento as enum ('fondos_clientes', 'operaciones', 'detracciones');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.responsable_tarea as enum ('luxcars', 'cliente', 'tercero');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_tarea as enum ('pendiente', 'hecha', 'no_aplica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_evento as enum (
    'etapa', 'tarea', 'hito', 'movimiento', 'documento',
    'aprobacion', 'nota', 'notificacion', 'alerta'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_aprobacion as enum (
    'aprobar_inspeccion', 'elegir_consolidado', 'declarar_deposito',
    'conformidad_rendicion', 'confirmar_cuentas'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_contraparte as enum (
    'vendedor', 'forwarder', 'agente_aduana', 'aseguradora',
    'inspector', 'notaria', 'deposito', 'gestor', 'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_cliente as enum ('empresa', 'persona');
exception when duplicate_object then null; end $$;


-- Orden de las etapas, para que la función de avance rechace saltos. Es la
-- única "regla" de etapas que vive en SQL, y solo porque la integridad del
-- historial depende de ella. Los nombres y las compuertas están en el core.
create or replace function public.orden_etapa(p_etapa public.etapa_expediente)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_etapa
    when 'prospecto' then 0
    when 'contrato'  then 1
    when 'busqueda'  then 2
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


-- -----------------------------------------------------------------------------
--  2. CLIENTES — quien firma el mandato
-- -----------------------------------------------------------------------------

create sequence if not exists public.expediente_numero_seq;
create sequence if not exists public.embarque_numero_seq;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_cliente not null default 'empresa',
  razon_social text not null check (length(razon_social) between 2 and 200),
  ruc text check (ruc is null or ruc ~ '^[0-9]{11}$'),
  dni text check (dni is null or length(dni) between 6 and 20),
  domicilio text check (domicilio is null or length(domicilio) <= 300),
  -- Partida registral (empresa).
  partida text check (partida is null or length(partida) <= 60),
  representante text check (representante is null or length(representante) <= 160),
  representante_dni text check (representante_dni is null or length(representante_dni) <= 20),
  representante_cargo text check (representante_cargo is null or length(representante_cargo) <= 80),
  -- En minúsculas (lo garantiza el trigger). Es la llave del vínculo con la cuenta.
  email text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  telefono text check (telefono is null or length(telefono) <= 40),
  actividad text check (actividad is null or length(actividad) <= 200),
  -- KYC / debida diligencia
  banco_origen text check (banco_origen is null or length(banco_origen) <= 120),
  beneficiario_final text check (beneficiario_final is null or length(beneficiario_final) <= 200),
  origen_fondos text check (origen_fondos is null or length(origen_fondos) <= 500),
  es_pep boolean not null default false,
  kyc_ficha_ruc_en date,
  kyc_vigencia_en date,
  kyc_listas_en date,
  kyc_listas_resultado text check (kyc_listas_resultado is null or length(kyc_listas_resultado) <= 300),
  kyc_completo boolean generated always as (
    kyc_ficha_ruc_en is not null and kyc_vigencia_en is not null and kyc_listas_en is not null
  ) stored,
  -- Cuenta en /cuenta. Nulo hasta vincular (por correo verificado o a mano).
  user_id uuid references public.profiles (id) on delete set null,
  notas_internas text check (notas_internas is null or length(notas_internas) <= 4000),
  created_by uuid references neon_auth."user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_identificado check (ruc is not null or dni is not null)
);

comment on table public.clientes is
  'Cliente del mandato de importación (empresa o persona). `user_id` lo vincula con su cuenta en /cuenta; se cruza solo por correo verificado o lo vincula el equipo.';

create unique index if not exists clientes_ruc_unico on public.clientes (ruc) where ruc is not null;
create index if not exists clientes_email_idx on public.clientes (lower(email));
create index if not exists clientes_user_idx on public.clientes (user_id);

drop trigger if exists clientes_set_updated_at on public.clientes;
create trigger clientes_set_updated_at
  before update on public.clientes
  for each row execute function public.tg_marcar_actualizado();

-- Correo siempre en minúsculas y sin espacios: el cruce con la cuenta lo exige.
create or replace function public.tg_clientes_normalizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := nullif(lower(trim(new.email)), '');
  new.ruc := nullif(trim(new.ruc), '');
  new.dni := nullif(trim(new.dni), '');
  return new;
end;
$$;

drop trigger if exists clientes_normalizar on public.clientes;
create trigger clientes_normalizar
  before insert or update on public.clientes
  for each row execute function public.tg_clientes_normalizar();

-- Si al crear o editar el cliente ya existe una cuenta con ese correo, se
-- vincula al momento (el otro sentido, cuenta nueva → cliente, está abajo).
create or replace function public.tg_clientes_vincular_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null and new.email is not null then
    select p.id into new.user_id
    from public.profiles p
    where lower(p.email) = new.email
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists clientes_vincular_cuenta on public.clientes;
create trigger clientes_vincular_cuenta
  before insert or update of email on public.clientes
  for each row execute function public.tg_clientes_vincular_cuenta();

-- Cuenta nueva (o cambio de correo) → vincula el cliente que la esperaba.
-- El correo de Neon Auth se verifica con código, así que el cruce es seguro.
create or replace function public.tg_vincular_cliente_por_correo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.email is not distinct from old.email then
    return new;
  end if;
  update public.clientes c
     set user_id = new.id
   where c.user_id is null
     and c.email is not null
     and lower(c.email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists profiles_vincular_cliente on public.profiles;
create trigger profiles_vincular_cliente
  after insert or update of email on public.profiles
  for each row execute function public.tg_vincular_cliente_por_correo();


-- -----------------------------------------------------------------------------
--  3. CONTRAPARTES — terceros reutilizables (solo admin)
-- -----------------------------------------------------------------------------

create table if not exists public.contrapartes (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_contraparte not null,
  nombre text not null check (length(nombre) between 2 and 200),
  pais text check (pais is null or length(pais) <= 80),
  direccion text check (direccion is null or length(direccion) <= 300),
  contacto text check (contacto is null or length(contacto) <= 160),
  email text check (email is null or length(email) <= 160),
  telefono text check (telefono is null or length(telefono) <= 40),
  ruc_o_tax_id text check (ruc_o_tax_id is null or length(ruc_o_tax_id) <= 40),
  datos_bancarios jsonb,
  banco_verificado_en timestamptz,
  banco_verificado_por uuid references neon_auth."user" (id) on delete set null,
  notas text check (notas is null or length(notas) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contrapartes is
  'Terceros de una importación: vendedor, forwarder, agente de aduana, aseguradora, inspector, notaría, depósito. Con datos bancarios y fecha de verificación telefónica.';

create index if not exists contrapartes_tipo_idx on public.contrapartes (tipo, nombre);

drop trigger if exists contrapartes_set_updated_at on public.contrapartes;
create trigger contrapartes_set_updated_at
  before update on public.contrapartes
  for each row execute function public.tg_marcar_actualizado();


-- -----------------------------------------------------------------------------
--  4. EMBARQUES — el viaje físico, compartido por uno o varios expedientes
-- -----------------------------------------------------------------------------

create table if not exists public.embarques (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique
    default 'EMB-' || to_char(now(), 'YYYY') || '-'
            || lpad(nextval('public.embarque_numero_seq')::text, 2, '0'),
  modalidad public.modalidad_embarque not null default 'exclusivo',
  contenedor public.tipo_contenedor,
  forwarder_id uuid references public.contrapartes (id) on delete set null,
  aseguradora_id uuid references public.contrapartes (id) on delete set null,
  almacen_consolidacion text check (almacen_consolidacion is null or length(almacen_consolidacion) <= 200),
  puerto_origen text check (puerto_origen is null or length(puerto_origen) <= 120),
  puerto_destino text not null default 'Callao' check (length(puerto_destino) <= 120),
  fecha_release_est date,
  fecha_release_real date,
  fecha_carga date,
  fecha_zarpe_est date,
  fecha_zarpe_real date,
  fecha_arribo_est date,
  fecha_arribo_real date,
  nave text check (nave is null or length(nave) <= 160),
  master_bl text check (master_bl is null or length(master_bl) <= 80),
  precinto text check (precinto is null or length(precinto) <= 80),
  flete_total_usd numeric(12, 2) check (flete_total_usd is null or flete_total_usd >= 0),
  gastos_contenedor_usd numeric(12, 2) check (gastos_contenedor_usd is null or gastos_contenedor_usd >= 0),
  declaracion_exportacion text check (declaracion_exportacion is null or length(declaracion_exportacion) <= 120),
  estado text not null default 'planificado' check (length(estado) <= 40),
  notas_internas text check (notas_internas is null or length(notas_internas) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.embarques is
  'Contenedor o Ro-Ro: forwarder, puertos, fechas, master BL. Un embarque agrupa uno o varios expedientes (consolidado) y reparte el flete por `expedientes.proporcion_flete`.';

create index if not exists embarques_fecha_zarpe_idx on public.embarques (fecha_zarpe_est);

drop trigger if exists embarques_set_updated_at on public.embarques;
create trigger embarques_set_updated_at
  before update on public.embarques
  for each row execute function public.tg_marcar_actualizado();


-- -----------------------------------------------------------------------------
--  5. EXPEDIENTES — el agregado raíz
-- -----------------------------------------------------------------------------

create table if not exists public.expedientes (
  id uuid primary key default gen_random_uuid(),
  -- LC-AAAA-001. Es lo que el cliente ve y lo que va en cada documento.
  codigo text not null unique
    default 'LC-' || to_char(now(), 'YYYY') || '-'
            || lpad(nextval('public.expediente_numero_seq')::text, 3, '0'),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  etapa public.etapa_expediente not null default 'prospecto',
  etapa_desde timestamptz not null default now(),
  origen_solicitud_id uuid references public.solicitudes_compra (id) on delete set null,
  embarque_id uuid references public.embarques (id) on delete set null,
  -- 1.0000 exclusivo; en consolidado la suma por embarque debe dar 1.
  proporcion_flete numeric(5, 4) not null default 1
    check (proporcion_flete > 0 and proporcion_flete <= 1),

  -- Vehículo: copia propia, no apunta a `vehicles` porque no es stock.
  veh_marca text not null check (length(veh_marca) between 1 and 80),
  veh_modelo text not null check (length(veh_modelo) between 1 and 120),
  veh_version text check (veh_version is null or length(veh_version) <= 120),
  veh_anio integer not null check (veh_anio between 1980 and 2100),
  veh_vin text check (veh_vin is null or length(veh_vin) between 11 and 17),
  veh_color text check (veh_color is null or length(veh_color) <= 60),
  veh_km integer check (veh_km is null or veh_km >= 0),
  veh_combustible text check (veh_combustible is null or length(veh_combustible) <= 60),
  veh_cilindrada_cc integer check (veh_cilindrada_cc is null or veh_cilindrada_cc between 0 and 20000),
  veh_transmision text check (veh_transmision is null or length(veh_transmision) <= 60),
  veh_condicion public.condicion_vehiculo not null default 'usado',
  veh_categoria public.categoria_vehiculo not null default 'gasolina',
  veh_origen public.origen_vehiculo not null default 'otro',
  veh_pais_ensamblaje text check (veh_pais_ensamblaje is null or length(veh_pais_ensamblaje) <= 80),
  veh_doc_propiedad text check (veh_doc_propiedad is null or length(veh_doc_propiedad) <= 120),
  veh_peso_kg integer check (veh_peso_kg is null or veh_peso_kg between 0 and 20000),
  veh_medidas text check (veh_medidas is null or length(veh_medidas) <= 120),
  vehicle_model_id uuid references public.vehicle_models (id) on delete set null,

  -- Compra (lo reservado va en expedientes_reservado)
  moneda_compra text not null default 'USD' check (moneda_compra ~ '^[A-Z]{3}$'),
  precio_compra numeric(12, 2) check (precio_compra is null or precio_compra >= 0),
  precio_compra_usd numeric(12, 2) check (precio_compra_usd is null or precio_compra_usd >= 0),
  fecha_limite_compra date,
  fecha_inspeccion date,
  historial_ref text check (historial_ref is null or length(historial_ref) <= 200),
  fecha_release date,
  pais_origen text check (pais_origen is null or length(pais_origen) <= 80),
  puerto_origen text check (puerto_origen is null or length(puerto_origen) <= 120),

  -- Presupuesto y honorarios. `presupuesto` es la salida exacta de
  -- `presupuestar()` con el snapshot de tasas y la versión del motor.
  presupuesto jsonb,
  honorarios_usd numeric(12, 2) check (honorarios_usd is null or honorarios_usd >= 0),
  honorarios_base_usd numeric(12, 2) check (honorarios_base_usd is null or honorarios_base_usd >= 0),
  honorarios_igv_usd numeric(12, 2) check (honorarios_igv_usd is null or honorarios_igv_usd >= 0),
  porcentaje_detraccion numeric(5, 2) check (porcentaje_detraccion is null or porcentaje_detraccion between 0 and 100),
  margen_h3 numeric(5, 4) not null default 0 check (margen_h3 >= 0 and margen_h3 <= 1),
  tarifa_custodia_usd numeric(12, 2) check (tarifa_custodia_usd is null or tarifa_custodia_usd >= 0),
  costo_inspeccion_usd numeric(12, 2) check (costo_inspeccion_usd is null or costo_inspeccion_usd >= 0),

  -- Fechas del mandato
  fecha_firma date,
  fecha_limite_h2 date,
  fecha_est_embarque date,
  fecha_est_arribo date,
  fecha_est_entrega date,
  semanas_estimadas text check (semanas_estimadas is null or length(semanas_estimadas) <= 40),
  loa_vence date,

  -- Aduana y placas
  dam_numero text check (dam_numero is null or length(dam_numero) <= 40),
  dam_fecha date,
  dam_canal text check (dam_canal is null or length(dam_canal) <= 20),
  dam_factor_conversion numeric(10, 6),
  dam_tc_sbs numeric(10, 4),
  levante_en date,
  placa text check (placa is null or length(placa) <= 12),
  tive_numero text check (tive_numero is null or length(tive_numero) <= 40),
  km_entrega integer check (km_entrega is null or km_entrega >= 0),
  fecha_entrega date,

  -- Cierre
  cancelado_motivo text check (cancelado_motivo is null or length(cancelado_motivo) <= 2000),
  cerrado_en timestamptz,
  created_by uuid references neon_auth."user" (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expedientes_cancelado_con_motivo
    check (etapa <> 'cancelado' or cancelado_motivo is not null)
);

comment on table public.expedientes is
  'Importación a pedido: un vehículo, un cliente, un mandato. Código LC-AAAA-NNN. Lo reservado (notas internas, precio tope, tipo de cambio de referencia, contrapartes) está en expedientes_reservado.';
comment on column public.expedientes.presupuesto is
  'Salida exacta de presupuestar() (src/core/expedientes/presupuesto.ts): líneas del Anexo B, hitos, snapshot de tasas y motorVersion. Reproduce el Anexo B aunque cambie pricingConfig.';

create index if not exists expedientes_etapa_idx on public.expedientes (etapa, etapa_desde);
create index if not exists expedientes_cliente_idx on public.expedientes (cliente_id);
create index if not exists expedientes_embarque_idx on public.expedientes (embarque_id);
create index if not exists expedientes_vin_idx on public.expedientes (upper(veh_vin));

drop trigger if exists expedientes_set_updated_at on public.expedientes;
create trigger expedientes_set_updated_at
  before update on public.expedientes
  for each row execute function public.tg_marcar_actualizado();

-- Aviso (no bloqueo) si las proporciones de flete de un embarque no suman 1.
-- El core lo valida en pantalla; esto deja rastro en el log del servidor.
create or replace function public.tg_expedientes_aviso_proporcion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_suma numeric;
begin
  if new.embarque_id is null then
    return new;
  end if;
  select coalesce(sum(e.proporcion_flete), 0) into v_suma
  from public.expedientes e
  where e.embarque_id = new.embarque_id
    and e.etapa <> 'cancelado';
  if v_suma > 1.0001 then
    raise warning 'Embarque %: las proporciones de flete suman % (> 1).', new.embarque_id, v_suma;
  end if;
  return new;
end;
$$;

drop trigger if exists expedientes_aviso_proporcion on public.expedientes;
create trigger expedientes_aviso_proporcion
  after insert or update of embarque_id, proporcion_flete on public.expedientes
  for each row execute function public.tg_expedientes_aviso_proporcion();


-- Lo que el cliente NO debe ver nunca, en su propia tabla y solo admin.
create table if not exists public.expedientes_reservado (
  expediente_id uuid primary key references public.expedientes (id) on delete cascade,
  precio_tope numeric(12, 2) check (precio_tope is null or precio_tope >= 0),
  tc_compra_ref numeric(10, 4) check (tc_compra_ref is null or tc_compra_ref > 0),
  vendedor_id uuid references public.contrapartes (id) on delete set null,
  inspector_id uuid references public.contrapartes (id) on delete set null,
  agente_aduana_id uuid references public.contrapartes (id) on delete set null,
  notas_internas text check (notas_internas is null or length(notas_internas) <= 8000),
  updated_at timestamptz not null default now()
);

comment on table public.expedientes_reservado is
  'Parte reservada del expediente: precio tope, tipo de cambio de referencia, contrapartes y notas internas. Solo administradores; el cliente ve los datos del vendedor en el Anexo A, no acá.';

drop trigger if exists expedientes_reservado_set_updated_at on public.expedientes_reservado;
create trigger expedientes_reservado_set_updated_at
  before update on public.expedientes_reservado
  for each row execute function public.tg_marcar_actualizado();


-- -----------------------------------------------------------------------------
--  6. HISTORIAL, TAREAS, HITOS, EVENTOS, APROBACIONES
-- -----------------------------------------------------------------------------

create table if not exists public.expediente_etapas (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes (id) on delete cascade,
  etapa public.etapa_expediente not null,
  desde timestamptz not null default now(),
  hasta timestamptz,
  por uuid references neon_auth."user" (id) on delete set null,
  forzado boolean not null default false,
  motivo text check (motivo is null or length(motivo) <= 2000)
);

comment on table public.expediente_etapas is
  'Historial de etapas: una fila por tramo, con quién avanzó, si forzó la compuerta y por qué.';

create index if not exists expediente_etapas_exp_idx on public.expediente_etapas (expediente_id, desde);


create table if not exists public.expediente_tareas (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes (id) on delete cascade,
  etapa public.etapa_expediente not null,
  -- Clave estable de la plantilla del core, p. ej. `cliente.depositar_h2`.
  clave text not null check (clave ~ '^[a-z]+\.[a-z0-9_]+$'),
  titulo text not null check (length(titulo) between 2 and 200),
  descripcion text check (descripcion is null or length(descripcion) <= 1000),
  responsable public.responsable_tarea not null,
  estado public.estado_tarea not null default 'pendiente',
  vence_el date,
  hecha_en timestamptz,
  hecha_por uuid references neon_auth."user" (id) on delete set null,
  -- Evidencia (expediente_documentos, fase 2). Sin FK hasta que exista la tabla.
  documento_id uuid,
  visible_cliente boolean not null default false,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expediente_id, clave)
);

comment on table public.expediente_tareas is
  'Lista de la etapa: qué falta, quién lo hace, hasta cuándo. Las claves salen de las plantillas del core; `visible_cliente` decide si sale en "Qué necesitamos de ti".';

create index if not exists expediente_tareas_exp_idx on public.expediente_tareas (expediente_id, estado, orden);

drop trigger if exists expediente_tareas_set_updated_at on public.expediente_tareas;
create trigger expediente_tareas_set_updated_at
  before update on public.expediente_tareas
  for each row execute function public.tg_marcar_actualizado();


create table if not exists public.expediente_hitos (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes (id) on delete cascade,
  tipo public.tipo_hito not null,
  monto_estimado_usd numeric(12, 2) not null check (monto_estimado_usd >= 0),
  fecha_limite date,
  cuenta public.cuenta_movimiento not null default 'fondos_clientes',
  nota text check (nota is null or length(nota) <= 500),
  created_at timestamptz not null default now(),
  unique (expediente_id, tipo)
);

comment on table public.expediente_hitos is
  'Pagos del cliente H1..H4: monto estimado, fecha límite y cuenta de destino. El estado (pendiente, parcial, acreditado) lo deriva el core del libro (fase 3).';


create table if not exists public.expediente_eventos (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes (id) on delete cascade,
  tipo public.tipo_evento not null,
  titulo text not null check (length(titulo) between 1 and 300),
  detalle text check (detalle is null or length(detalle) <= 4000),
  visible_cliente boolean not null default false,
  actor_id uuid references neon_auth."user" (id) on delete set null,
  actor_tipo text not null default 'sistema' check (actor_tipo in ('admin', 'cliente', 'sistema')),
  -- Etapa a la que se refiere (eventos de tipo `etapa`): la UI pone el nombre.
  etapa public.etapa_expediente,
  tarea_id uuid references public.expediente_tareas (id) on delete set null,
  documento_id uuid,
  movimiento_id uuid,
  aprobacion_id uuid,
  created_at timestamptz not null default now()
);

comment on table public.expediente_eventos is
  'Actividad del expediente. Los títulos no llevan datos sensibles: se leen en la cuenta del cliente cuando `visible_cliente`.';

create index if not exists expediente_eventos_exp_idx on public.expediente_eventos (expediente_id, created_at desc);


create table if not exists public.expediente_aprobaciones (
  id uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes (id) on delete cascade,
  tipo public.tipo_aprobacion not null,
  payload jsonb not null default '{}'::jsonb,
  user_id uuid references neon_auth."user" (id) on delete set null,
  agente_usuario text check (agente_usuario is null or length(agente_usuario) <= 400),
  created_at timestamptz not null default now()
);

comment on table public.expediente_aprobaciones is
  'Decisiones que el cliente toma desde su cuenta, con fecha y usuario. Solo se insertan por cliente_accion_expediente().';

create index if not exists expediente_aprobaciones_exp_idx on public.expediente_aprobaciones (expediente_id, created_at desc);

alter table public.expediente_eventos
  drop constraint if exists expediente_eventos_aprobacion_fk;
alter table public.expediente_eventos
  add constraint expediente_eventos_aprobacion_fk
  foreign key (aprobacion_id) references public.expediente_aprobaciones (id) on delete set null;


-- -----------------------------------------------------------------------------
--  7. SEGURIDAD — tablas base: solo administradores
-- -----------------------------------------------------------------------------

-- ¿El cliente de la sesión es el dueño del expediente con este cliente_id?
-- SECURITY DEFINER para que las vistas y políticas no dependan de que el
-- cliente tenga permiso de lectura sobre `clientes`.
create or replace function public.es_dueno_expediente(p_cliente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.clientes c
    where c.id = p_cliente_id
      and c.user_id = auth.uid()
  );
$$;

revoke all on function public.es_dueno_expediente(uuid) from public;
grant execute on function public.es_dueno_expediente(uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes', 'contrapartes', 'embarques', 'expedientes', 'expedientes_reservado',
    'expediente_etapas', 'expediente_tareas', 'expediente_hitos',
    'expediente_eventos', 'expediente_aprobaciones'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anonymous, authenticated', t);

    execute format('drop policy if exists "%s: el equipo lee" on public.%I', t, t);
    execute format(
      'create policy "%s: el equipo lee" on public.%I for select to authenticated using (public.es_admin())', t, t);

    if t <> 'expediente_aprobaciones' then
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);

      execute format('drop policy if exists "%s: el equipo inserta" on public.%I', t, t);
      execute format(
        'create policy "%s: el equipo inserta" on public.%I for insert to authenticated with check (public.es_admin())', t, t);
      execute format('drop policy if exists "%s: el equipo actualiza" on public.%I', t, t);
      execute format(
        'create policy "%s: el equipo actualiza" on public.%I for update to authenticated using (public.es_admin()) with check (public.es_admin())', t, t);
      execute format('drop policy if exists "%s: el equipo borra" on public.%I', t, t);
      execute format(
        'create policy "%s: el equipo borra" on public.%I for delete to authenticated using (public.es_admin())', t, t);
    else
      -- Las aprobaciones solo se insertan por RPC: ni el equipo las escribe a mano.
      execute format('grant select on public.%I to authenticated', t);
    end if;
  end loop;
end $$;

grant usage, select on sequence public.expediente_numero_seq to authenticated;
grant usage, select on sequence public.embarque_numero_seq to authenticated;


-- -----------------------------------------------------------------------------
--  8. VISTAS DEL CLIENTE — lo suyo, solo las columnas que le corresponden
-- -----------------------------------------------------------------------------
--  Corren como el dueño de la base (sin security_invoker) y filtran adentro
--  con es_dueno_expediente(). Por eso NO llevan notas internas, precio tope,
--  tipo de cambio de referencia ni contrapartes: eso ni siquiera está en la
--  tabla que leen (ver expedientes_reservado).

create or replace view public.expediente_cliente as
  select
    e.id, e.codigo, e.cliente_id, e.etapa, e.etapa_desde, e.embarque_id,
    e.veh_marca, e.veh_modelo, e.veh_version, e.veh_anio, e.veh_vin, e.veh_color,
    e.veh_km, e.veh_combustible, e.veh_cilindrada_cc, e.veh_transmision,
    e.veh_condicion, e.veh_categoria, e.veh_pais_ensamblaje,
    e.moneda_compra, e.precio_compra, e.precio_compra_usd,
    e.fecha_inspeccion, e.pais_origen, e.puerto_origen,
    e.honorarios_usd, e.honorarios_base_usd, e.honorarios_igv_usd,
    e.fecha_firma, e.fecha_limite_h2, e.fecha_est_embarque, e.fecha_est_arribo,
    e.fecha_est_entrega, e.semanas_estimadas,
    e.dam_numero, e.dam_fecha, e.levante_en, e.placa, e.tive_numero, e.fecha_entrega,
    e.cancelado_motivo, e.cerrado_en, e.created_at, e.updated_at
  from public.expedientes e
  where e.etapa <> 'prospecto'
    and public.es_dueno_expediente(e.cliente_id);

comment on view public.expediente_cliente is
  'Lo que un cliente ve de SUS expedientes (sin prospectos, sin notas internas, sin precio tope ni contrapartes). Filtra con es_dueno_expediente(); el cliente no lee la tabla base.';

create or replace view public.embarque_cliente as
  select
    e.id as expediente_id, b.id, b.codigo, b.modalidad, b.contenedor,
    b.puerto_origen, b.puerto_destino,
    b.fecha_release_est, b.fecha_release_real, b.fecha_carga,
    b.fecha_zarpe_est, b.fecha_zarpe_real, b.fecha_arribo_est, b.fecha_arribo_real,
    b.nave, b.master_bl
  from public.expedientes e
  join public.embarques b on b.id = e.embarque_id
  where e.etapa <> 'prospecto'
    and public.es_dueno_expediente(e.cliente_id);

comment on view public.embarque_cliente is
  'Fechas, puerto y nave del embarque de un expediente del cliente. Sin datos de los otros expedientes del contenedor ni del forwarder.';

create or replace view public.expediente_tarea_cliente as
  select
    t.id, t.expediente_id, t.etapa, t.clave, t.titulo, t.descripcion, t.responsable,
    t.estado, t.vence_el, t.hecha_en, t.orden, t.created_at
  from public.expediente_tareas t
  join public.expedientes e on e.id = t.expediente_id
  where t.visible_cliente
    and e.etapa <> 'prospecto'
    and public.es_dueno_expediente(e.cliente_id);

create or replace view public.expediente_evento_cliente as
  select
    v.id, v.expediente_id, v.tipo, v.titulo, v.detalle, v.actor_tipo, v.etapa, v.created_at
  from public.expediente_eventos v
  join public.expedientes e on e.id = v.expediente_id
  where v.visible_cliente
    and e.etapa <> 'prospecto'
    and public.es_dueno_expediente(e.cliente_id);

create or replace view public.expediente_hito_cliente as
  select h.id, h.expediente_id, h.tipo, h.monto_estimado_usd, h.fecha_limite, h.nota
  from public.expediente_hitos h
  join public.expedientes e on e.id = h.expediente_id
  where e.etapa <> 'prospecto'
    and public.es_dueno_expediente(e.cliente_id);

create or replace view public.expediente_etapa_cliente as
  select s.id, s.expediente_id, s.etapa, s.desde, s.hasta
  from public.expediente_etapas s
  join public.expedientes e on e.id = s.expediente_id
  where e.etapa <> 'prospecto'
    and public.es_dueno_expediente(e.cliente_id);

create or replace view public.expediente_aprobacion_cliente as
  select a.id, a.expediente_id, a.tipo, a.payload, a.created_at
  from public.expediente_aprobaciones a
  join public.expedientes e on e.id = a.expediente_id
  where public.es_dueno_expediente(e.cliente_id);

-- Su propia ficha de cliente, sin notas internas ni datos de KYC.
create or replace view public.cliente_cuenta as
  select c.id, c.tipo, c.razon_social, c.ruc, c.email, c.telefono, c.representante
  from public.clientes c
  where auth.uid() is not null and c.user_id = auth.uid();

revoke all on public.expediente_cliente, public.embarque_cliente, public.expediente_tarea_cliente,
  public.expediente_evento_cliente, public.expediente_hito_cliente, public.expediente_etapa_cliente,
  public.expediente_aprobacion_cliente, public.cliente_cuenta
  from anonymous, authenticated;
grant select on public.expediente_cliente, public.embarque_cliente, public.expediente_tarea_cliente,
  public.expediente_evento_cliente, public.expediente_hito_cliente, public.expediente_etapa_cliente,
  public.expediente_aprobacion_cliente, public.cliente_cuenta
  to authenticated;


-- -----------------------------------------------------------------------------
--  9. FUNCIONES (RPC desde la Data API)
-- -----------------------------------------------------------------------------

-- Inserta las tareas que trae el core (array de objetos con clave, titulo,
-- descripcion, responsable, estado, vence_el, visible_cliente, orden). Las
-- que ya existen por clave se dejan como están.
create or replace function public.insertar_tareas_expediente(
  p_expediente uuid,
  p_etapa public.etapa_expediente,
  p_tareas jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  t jsonb;
begin
  if p_tareas is null or jsonb_typeof(p_tareas) <> 'array' then
    return 0;
  end if;
  for t in select * from jsonb_array_elements(p_tareas) loop
    insert into public.expediente_tareas (
      expediente_id, etapa, clave, titulo, descripcion, responsable, estado,
      vence_el, hecha_en, visible_cliente, orden
    ) values (
      p_expediente,
      coalesce((t->>'etapa')::public.etapa_expediente, p_etapa),
      t->>'clave',
      left(coalesce(t->>'titulo', t->>'clave'), 200),
      left(t->>'descripcion', 1000),
      coalesce((t->>'responsable')::public.responsable_tarea, 'luxcars'),
      coalesce((t->>'estado')::public.estado_tarea, 'pendiente'),
      (t->>'vence_el')::date,
      case when (t->>'estado') = 'hecha' then now() else null end,
      coalesce((t->>'visible_cliente')::boolean, false),
      coalesce((t->>'orden')::integer, 0)
    )
    on conflict (expediente_id, clave) do nothing;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.insertar_tareas_expediente(uuid, public.etapa_expediente, jsonb) from public;


-- Abre un expediente en una sola transacción: expediente, parte reservada,
-- embarque nuevo si viene, historial, hitos, tareas de la etapa inicial y el
-- evento "Expediente abierto". Si nace de una solicitud de compra, la enlaza.
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
    veh_origen, veh_pais_ensamblaje, veh_doc_propiedad, veh_peso_kg, veh_medidas, vehicle_model_id,
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
  'Solo admin. Abre el expediente con su parte reservada, historial, hitos, tareas de la etapa inicial y el evento de apertura, en una transacción. Devuelve el id.';


-- Avanza una etapa (o cancela desde cualquiera). Las compuertas las evalúa
-- el core en pantalla; si el admin las fuerza, deja motivo y queda en el
-- historial. Acá solo se garantiza: una etapa a la vez, motivo al forzar o
-- cancelar, historial coherente.
create or replace function public.avanzar_expediente(
  p_id uuid,
  p_destino public.etapa_expediente,
  p_tareas jsonb default '[]'::jsonb,
  p_forzado boolean default false,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.expedientes%rowtype;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador avanza expedientes.';
  end if;

  select * into e from public.expedientes where id = p_id for update;
  if not found then
    raise exception 'El expediente no existe.';
  end if;
  if e.etapa in ('cerrado', 'cancelado') then
    raise exception 'El expediente ya está %: no se mueve más.', e.etapa;
  end if;

  if p_destino = 'cancelado' then
    if v_motivo is null or length(v_motivo) < 5 then
      raise exception 'Cancelar exige un motivo (mínimo cinco caracteres).';
    end if;
  else
    if public.orden_etapa(p_destino) <> public.orden_etapa(e.etapa) + 1 then
      raise exception 'De % solo se pasa a la etapa siguiente; a % no.', e.etapa, p_destino;
    end if;
    if p_forzado and (v_motivo is null or length(v_motivo) < 5) then
      raise exception 'Forzar el avance exige un motivo (mínimo cinco caracteres).';
    end if;
  end if;

  update public.expediente_etapas
     set hasta = now()
   where expediente_id = p_id and hasta is null;

  insert into public.expediente_etapas (expediente_id, etapa, desde, por, forzado, motivo)
  values (p_id, p_destino, now(), auth.uid(), coalesce(p_forzado, false), left(v_motivo, 2000));

  update public.expedientes
     set etapa = p_destino,
         etapa_desde = now(),
         cancelado_motivo = case when p_destino = 'cancelado' then left(v_motivo, 2000) else cancelado_motivo end,
         cerrado_en = case when p_destino in ('cerrado', 'cancelado') then now() else cerrado_en end
   where id = p_id;

  perform public.insertar_tareas_expediente(p_id, p_destino, p_tareas);

  insert into public.expediente_eventos (expediente_id, tipo, titulo, visible_cliente, actor_id, actor_tipo, etapa)
  values (
    p_id, 'etapa',
    case when p_destino = 'cancelado' then 'Expediente cancelado' else 'Nueva etapa' end,
    p_destino <> 'prospecto', auth.uid(), 'admin', p_destino
  );

  if coalesce(p_forzado, false) or p_destino = 'cancelado' then
    insert into public.expediente_eventos (expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa)
    values (
      p_id, 'nota',
      case when p_destino = 'cancelado' then 'Motivo de la cancelación' else 'Avance forzado sin cumplir la compuerta' end,
      left(v_motivo, 4000), false, auth.uid(), 'admin', p_destino
    );
  end if;
end;
$$;

comment on function public.avanzar_expediente(uuid, public.etapa_expediente, jsonb, boolean, text) is
  'Solo admin. Cierra la etapa en el historial, abre la nueva, inserta las tareas del core y deja el evento. Una etapa a la vez salvo a cancelado; forzar o cancelar exigen motivo.';


create or replace function public.completar_tarea(
  p_tarea uuid,
  p_documento uuid default null,
  p_estado public.estado_tarea default 'hecha'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.expediente_tareas%rowtype;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador completa tareas.';
  end if;

  select * into t from public.expediente_tareas where id = p_tarea for update;
  if not found then
    raise exception 'La tarea no existe.';
  end if;

  update public.expediente_tareas
     set estado = p_estado,
         hecha_en = case when p_estado = 'pendiente' then null else now() end,
         hecha_por = case when p_estado = 'pendiente' then null else auth.uid() end,
         documento_id = coalesce(p_documento, documento_id)
   where id = p_tarea;

  if p_estado <> 'pendiente' then
    insert into public.expediente_eventos (expediente_id, tipo, titulo, visible_cliente, actor_id, actor_tipo, etapa, tarea_id)
    values (
      t.expediente_id, 'tarea',
      case when p_estado = 'hecha' then 'Listo: ' || t.titulo else 'No aplica: ' || t.titulo end,
      t.visible_cliente, auth.uid(), 'admin', t.etapa, t.id
    );
  end if;
end;
$$;

comment on function public.completar_tarea(uuid, uuid, public.estado_tarea) is
  'Solo admin. Marca una tarea hecha, no aplica o la reabre, con evidencia opcional, y deja el evento (visible al cliente si la tarea lo es).';


create or replace function public.vincular_cliente_cuenta(p_cliente uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador vincula cuentas.';
  end if;
  if p_user is not null and not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'Esa cuenta no existe.';
  end if;
  update public.clientes set user_id = p_user where id = p_cliente;
  if not found then
    raise exception 'El cliente no existe.';
  end if;
end;
$$;

comment on function public.vincular_cliente_cuenta(uuid, uuid) is
  'Solo admin. Vincula (o desvincula con NULL) la cuenta de /cuenta de un cliente del mandato.';


-- Acción del cliente desde su cuenta. Valida que el expediente sea suyo, que
-- la tarea de esa acción esté pendiente y que el payload traiga lo mínimo;
-- deja la aprobación (evidencia con fecha y usuario), marca la tarea y avisa
-- en la actividad. `declarar_deposito` llega en la fase 3 (libro).
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
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
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
      raise exception 'Declarar un depósito desde la cuenta todavía no está disponible. Envíanos el comprobante por WhatsApp.';
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

  insert into public.expediente_aprobaciones (expediente_id, tipo, payload, user_id, agente_usuario)
  values (
    p_expediente, p_tipo, v_payload - 'agente_usuario', auth.uid(),
    left(v_payload->>'agente_usuario', 400)
  )
  returning id into v_aprobacion;

  update public.expediente_tareas
     set estado = 'hecha', hecha_en = now(), hecha_por = auth.uid()
   where id = t.id;

  insert into public.expediente_eventos (
    expediente_id, tipo, titulo, detalle, visible_cliente, actor_id, actor_tipo, etapa, tarea_id, aprobacion_id
  ) values (
    p_expediente, 'aprobacion', v_titulo, left(v_payload->>'comentario', 2000),
    true, auth.uid(), 'cliente', e.etapa, t.id, v_aprobacion
  );

  return v_aprobacion;
end;
$$;

comment on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) is
  'Cliente dueño. Registra una decisión (aprobar inspección, elegir consolidado, conformidad, confirmar cuentas) como aprobación con fecha y usuario, marca la tarea y deja el evento. Única vía de escritura del cliente en el módulo.';


revoke all on function public.crear_expediente(jsonb) from public;
revoke all on function public.avanzar_expediente(uuid, public.etapa_expediente, jsonb, boolean, text) from public;
revoke all on function public.completar_tarea(uuid, uuid, public.estado_tarea) from public;
revoke all on function public.vincular_cliente_cuenta(uuid, uuid) from public;
revoke all on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) from public;
revoke all on function public.orden_etapa(public.etapa_expediente) from public;

grant execute on function public.crear_expediente(jsonb) to authenticated;
grant execute on function public.avanzar_expediente(uuid, public.etapa_expediente, jsonb, boolean, text) to authenticated;
grant execute on function public.completar_tarea(uuid, uuid, public.estado_tarea) to authenticated;
grant execute on function public.vincular_cliente_cuenta(uuid, uuid) to authenticated;
grant execute on function public.cliente_accion_expediente(uuid, public.tipo_aprobacion, jsonb) to authenticated;
grant execute on function public.orden_etapa(public.etapa_expediente) to anonymous, authenticated;
