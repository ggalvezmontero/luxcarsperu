-- =============================================================================
--  Migración 0011 · endurecer las cuentas de cliente
-- =============================================================================
--
--  Sale de la auditoría de seguridad del 2026-11-06, hecha justo después de
--  abrir el registro público. Las tablas del negocio (leads, vehículos,
--  consignaciones, márgenes) ya estaban cerradas a administradores; lo que
--  quedaba flojo era lo que un CLIENTE puede hacer con su propia cuenta
--  hablándole directo a la Data API, sin pasar por el sitio:
--
--    1. Podía reescribir `profiles.email`. Ese correo se muestra en
--       /portal/usuarios y era la llave del paso "dar rol admin por correo":
--       ponerse `ventas@luxcars.pe` y esperar a que el dueño ascendiera esa
--       dirección lo convertía en administrador.
--    2. Podía cambiar su solicitud de venta DESPUÉS de que el admin la
--       revisara y antes de que la aprobara: lo que se publicaba bajo la marca
--       LuxCars era el texto nuevo, no el revisado.
--    3. Una cuenta desactivada seguía creando y cambiando solicitudes:
--       desactivar a alguien no tenía efecto.
--    4. No había tope de tamaño ni de cantidad: los límites vivían solo en el
--       navegador.
--    5. El cliente veía "Publicada" aunque su auto se hubiera aprobado sin
--       publicar, y el enlace daba 404. No tenía cómo saberlo: no puede leer
--       `vehicles`.
--
--  Todo es aditivo o más restrictivo. No cambia nada para un administrador ni
--  para el sitio público.
-- =============================================================================


-- -----------------------------------------------------------------------------
--  1. PERFILES — el cliente edita su nombre y su teléfono, nada más
-- -----------------------------------------------------------------------------
--  El GRANT era sobre la tabla entera, así que la política "cada quien edita
--  el suyo" dejaba cambiar cualquier columna. `rol` y `activo` los cuidaba el
--  trigger; `email` no lo cuidaba nadie. Ahora el permiso es por columna.
--
--  `rol` y `activo` siguen en la lista porque el ADMIN los cambia con el mismo
--  rol de base (`authenticated`) desde /portal/usuarios; para un cliente los
--  sigue frenando `tg_proteger_perfil`. El correo solo lo escriben los
--  triggers de sincronización con Neon Auth, que son SECURITY DEFINER.
-- -----------------------------------------------------------------------------

revoke update on public.profiles from authenticated;
grant update (nombre, telefono, rol, activo) on public.profiles to authenticated;

alter table public.profiles
  drop constraint if exists profiles_largos;
alter table public.profiles
  add constraint profiles_largos
  check (length(nombre) <= 160 and coalesce(length(telefono), 0) <= 40);

-- Si algún perfil quedó con un correo distinto al de su cuenta, se corrige.
update public.profiles p
   set email = u.email
  from neon_auth."user" u
 where u.id = p.id
   and p.email is distinct from u.email;


-- -----------------------------------------------------------------------------
--  2. APROBAR — el correo del dueño sale de Neon Auth, no del perfil
-- -----------------------------------------------------------------------------

create or replace function public.aprobar_solicitud_venta(
  p_solicitud_id uuid,
  p_precio_venta numeric default null,
  p_comision_porcentaje numeric default 0.05,
  p_publicar boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.solicitudes_venta%rowtype;
  perfil public.profiles%rowtype;
  v_email text;
  v_precio numeric;
  v_consignment_id uuid;
  v_vehicle_id uuid;
  v_slug text;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador aprueba solicitudes.';
  end if;

  select * into s from public.solicitudes_venta where id = p_solicitud_id for update;
  if not found then
    raise exception 'La solicitud no existe.';
  end if;
  if s.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue revisada (estado: %).', s.estado;
  end if;

  select * into perfil from public.profiles where id = s.user_id;
  if not found then
    raise exception 'El cliente de la solicitud ya no tiene perfil.';
  end if;

  -- El correo se toma de Neon Auth: es el que la persona usa para entrar.
  -- `profiles.email` es una copia para listar, no una fuente de verdad.
  select u.email into v_email from neon_auth."user" u where u.id = s.user_id;

  v_precio := coalesce(p_precio_venta, s.precio_pedido);
  if v_precio < 0 then
    raise exception 'El precio de publicación no puede ser negativo.';
  end if;
  if p_comision_porcentaje is null or p_comision_porcentaje < 0 or p_comision_porcentaje > 1 then
    raise exception 'La comisión va de 0 a 1 (ej. 0.05 = 5%%).';
  end if;

  insert into public.consignments (
    propietario_nombre, propietario_telefono, propietario_email,
    marca, modelo, anio, version, placa, kilometraje_km, color,
    precio_pedido, moneda,
    tipo_comision, comision_porcentaje,
    estado, notas_internas, created_by
  ) values (
    coalesce(nullif(perfil.nombre, ''), v_email, 'Cliente sin nombre'),
    s.telefono_contacto, v_email,
    s.marca, s.modelo, s.anio, s.version, s.placa, s.kilometraje_km, s.color,
    v_precio, s.moneda,
    'porcentaje', p_comision_porcentaje,
    'activa',
    'Creada al aprobar la solicitud web ' || s.id::text
      || case when s.condicion_declarada is not null then '. Condición declarada: ' || s.condicion_declarada else '' end,
    auth.uid()
  )
  returning id into v_consignment_id;

  -- Slug único: base legible + sufijo corto. Un auto publicado exige slug.
  v_slug := public.slug_vehiculo(s.marca, s.modelo, s.anio)
            || '-' || left(replace(gen_random_uuid()::text, '-', ''), 6);

  insert into public.vehicles (
    fuente, fuente_referencia,
    marca, modelo, version, anio, categoria,
    kilometraje_km, condicion, color_exterior, placa,
    precio_venta, moneda_venta, precio_negociable,
    estado, ubicacion,
    publicado, slug, titular, descripcion,
    notas_internas, created_by
  ) values (
    'consignacion', 'solicitud:' || s.id::text,
    s.marca, s.modelo, s.version, s.anio, s.categoria,
    s.kilometraje_km, 'usado', s.color, s.placa,
    v_precio, s.moneda, true,
    'disponible', 'Lima (con su dueño)',
    p_publicar, v_slug,
    trim(s.marca || ' ' || s.modelo || ' ' || coalesce(s.version, '') || ' ' || s.anio::text),
    s.descripcion,
    'Consignación ' || v_consignment_id::text
      || case when s.condicion_declarada is not null then '. Condición declarada por el dueño: ' || s.condicion_declarada else '' end,
    auth.uid()
  )
  returning id into v_vehicle_id;

  update public.consignments set vehicle_id = v_vehicle_id where id = v_consignment_id;

  update public.solicitudes_venta
     set estado = 'aprobada',
         consignment_id = v_consignment_id,
         vehicle_id = v_vehicle_id,
         revisado_por = auth.uid(),
         revisado_en = now()
   where id = s.id;

  return v_vehicle_id;
end;
$$;


-- -----------------------------------------------------------------------------
--  3. SOLICITUD DE VENTA — enviada no se edita; solo se retira
-- -----------------------------------------------------------------------------
--  El sitio nunca dejó editar una solicitud enviada (solo retirarla), pero la
--  base sí: cualquier campo, mientras estuviera pendiente. Ahora la base dice
--  lo mismo que el sitio. Lo que el admin revisa es lo que se publica.
-- -----------------------------------------------------------------------------

create or replace function public.tg_proteger_solicitud_venta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.es_admin() then
    return new;
  end if;

  if old.estado <> 'pendiente' then
    raise exception 'Esta solicitud ya fue revisada y no se puede modificar.';
  end if;

  if (to_jsonb(new) - 'estado' - 'updated_at') is distinct from (to_jsonb(old) - 'estado' - 'updated_at') then
    raise exception 'Una solicitud enviada no se edita. Si cambió algo, retírala y registra el auto de nuevo.';
  end if;

  if new.estado <> old.estado and new.estado <> 'retirada' then
    raise exception 'Solo puedes retirar tu solicitud; aprobarla o rechazarla es tarea de LuxCars.';
  end if;

  return new;
end;
$$;


-- -----------------------------------------------------------------------------
--  4. CUENTA DESACTIVADA — puede ver lo suyo, no puede pedir ni cambiar nada
-- -----------------------------------------------------------------------------

create or replace function public.perfil_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.activo
  );
$$;

comment on function public.perfil_activo() is
  'TRUE si auth.uid() tiene perfil activo. Las políticas de cliente la exigen para escribir: una cuenta desactivada solo lee.';

revoke all on function public.perfil_activo() from public;
grant execute on function public.perfil_activo() to authenticated;

drop policy if exists "solicitudes_compra: cliente crea la suya" on public.solicitudes_compra;
create policy "solicitudes_compra: cliente crea la suya"
  on public.solicitudes_compra for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.perfil_activo()
    and estado = 'nueva'
    and respuesta_luxcars is null
    and atendido_por is null
  );

drop policy if exists "solicitudes_compra: cliente cierra la suya" on public.solicitudes_compra;
create policy "solicitudes_compra: cliente cierra la suya"
  on public.solicitudes_compra for update
  to authenticated
  using (user_id = auth.uid() and public.perfil_activo())
  with check (user_id = auth.uid() and public.perfil_activo());

drop policy if exists "solicitudes_venta: cliente crea la suya" on public.solicitudes_venta;
create policy "solicitudes_venta: cliente crea la suya"
  on public.solicitudes_venta for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.perfil_activo()
    and estado = 'pendiente'
    and motivo_rechazo is null
    and revisado_por is null
    and revisado_en is null
    and consignment_id is null
    and vehicle_id is null
  );

drop policy if exists "solicitudes_venta: cliente edita la suya" on public.solicitudes_venta;
create policy "solicitudes_venta: cliente edita la suya"
  on public.solicitudes_venta for update
  to authenticated
  using (user_id = auth.uid() and public.perfil_activo())
  with check (user_id = auth.uid() and public.perfil_activo());


-- -----------------------------------------------------------------------------
--  5. TOPES — de tamaño y de cantidad
-- -----------------------------------------------------------------------------
--  Los largos son los mismos que recorta el formulario (src/lib/cuenta/
--  solicitudes.ts), con algo de holgura. El tope diario existe porque el
--  registro está abierto: sin él, una cuenta recién creada puede enterrar la
--  bandeja del equipo. Al equipo no se le aplica.
-- -----------------------------------------------------------------------------

alter table public.solicitudes_compra
  drop constraint if exists solicitudes_compra_largos;
alter table public.solicitudes_compra
  add constraint solicitudes_compra_largos
  check (
    length(marca) between 1 and 80
    and length(modelo) between 1 and 120
    and coalesce(length(notas), 0) <= 2000
  );

alter table public.solicitudes_venta
  drop constraint if exists solicitudes_venta_largos;
alter table public.solicitudes_venta
  add constraint solicitudes_venta_largos
  check (
    length(marca) between 1 and 80
    and length(modelo) between 1 and 120
    and coalesce(length(version), 0) <= 120
    and coalesce(length(color), 0) <= 60
    and coalesce(length(placa), 0) <= 20
    and coalesce(length(condicion_declarada), 0) <= 80
    and coalesce(length(descripcion), 0) <= 2000
    and length(telefono_contacto) between 1 and 40
  );

-- Cuántas solicitudes (de los dos tipos) puede enviar una cuenta en 24 horas.
create or replace function public.tg_tope_diario_solicitudes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recientes integer;
  v_tope constant integer := 10;
begin
  -- Sin sesión (psql, DATABASE_URL) o siendo admin no hay tope.
  if auth.uid() is null or public.es_admin() then
    return new;
  end if;

  select
    (select count(*) from public.solicitudes_compra c
      where c.user_id = new.user_id and c.created_at > now() - interval '24 hours')
    +
    (select count(*) from public.solicitudes_venta v
      where v.user_id = new.user_id and v.created_at > now() - interval '24 hours')
  into v_recientes;

  if v_recientes >= v_tope then
    raise exception 'Ya enviaste varias solicitudes hoy. Escríbenos por WhatsApp y las vemos juntas.';
  end if;

  return new;
end;
$$;

drop trigger if exists solicitudes_compra_tope_diario on public.solicitudes_compra;
create trigger solicitudes_compra_tope_diario
  before insert on public.solicitudes_compra
  for each row execute function public.tg_tope_diario_solicitudes();

drop trigger if exists solicitudes_venta_tope_diario on public.solicitudes_venta;
create trigger solicitudes_venta_tope_diario
  before insert on public.solicitudes_venta
  for each row execute function public.tg_tope_diario_solicitudes();


-- -----------------------------------------------------------------------------
--  6. "¿MI AUTO YA ESTÁ PUBLICADO?"
-- -----------------------------------------------------------------------------
--  El cliente no puede leer `vehicles` (ahí están el precio de compra y las
--  notas internas), así que no sabía si su auto aprobado ya estaba en la web.
--  Esta función le contesta eso y nada más: los ids de SUS autos publicados.
-- -----------------------------------------------------------------------------

create or replace function public.mis_autos_publicados()
returns table (vehicle_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select s.vehicle_id
  from public.solicitudes_venta s
  join public.vehicles v on v.id = s.vehicle_id
  where s.user_id = auth.uid()
    and v.publicado;
$$;

comment on function public.mis_autos_publicados() is
  'Ids de los vehículos publicados que salieron de solicitudes de venta del usuario de la sesión. No expone ninguna otra columna de vehicles.';

revoke all on function public.mis_autos_publicados() from public;
grant execute on function public.mis_autos_publicados() to authenticated;
