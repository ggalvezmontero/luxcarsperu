-- =============================================================================
--  PRIMER ADMINISTRADOR (o uno más)
-- =============================================================================
--
--  Da rol `admin` a una cuenta que YA existe en Neon Auth. La vía cómoda es el
--  script, que hace lo mismo y avisa si la cuenta no existe:
--
--      npm run admin:crear -- correo@luxcars.pe "Nombre Apellido"
--
--  Este archivo es la alternativa para pegar en el editor SQL de Neon o correr
--  con `psql "$DATABASE_URL" -f db/seed_admin.sql`.
--
--  ACÁ NO SE CREA LA CUENTA NI SE ESCRIBE NINGUNA CONTRASEÑA. Neon Auth guarda
--  las credenciales y no se insertan a mano. La cuenta nace de una de dos
--  formas, y después se asciende con este archivo:
--
--    · La persona se registra en luxcars.pe/cuenta/login (Crear cuenta).
--    · El dueño la agrega por correo en la consola de Neon → Auth → Users, y
--      la persona define su contraseña en luxcars.pe/portal/recuperar.
--
--  Por conexión directa no hay sesión (`auth.uid()` es NULL), así que el
--  trigger `profiles_proteger` no interfiere (ver migración 0010).
--
--  CAMBIA LOS DOS VALORES DEL BLOQUE `config` ANTES DE CORRERLO.
-- =============================================================================

do $$
declare
  -- ---------------------------------------------------------------------------
  --  config — edita estos dos valores
  -- ---------------------------------------------------------------------------
  v_email  text := 'admin@luxcars.pe';
  v_nombre text := 'Administrador LuxCars';
  -- ---------------------------------------------------------------------------
  v_id uuid;
begin
  select id into v_id from neon_auth."user" where lower(email) = lower(v_email);

  if v_id is null then
    raise exception
      'No hay ninguna cuenta con el correo %. Créala primero (luxcars.pe/cuenta/login o consola de Neon → Auth → Users) y vuelve a correr este archivo.',
      v_email;
  end if;

  -- El trigger de alta ya creó el perfil; por si la cuenta es anterior a la
  -- migración 0010, upsert.
  insert into public.profiles (id, rol, activo, nombre, email)
  values (v_id, 'admin', true, v_nombre, lower(v_email))
  on conflict (id) do update
    set rol = 'admin',
        activo = true,
        nombre = case when public.profiles.nombre = '' then excluded.nombre else public.profiles.nombre end,
        email = excluded.email;

  raise notice 'Perfil % (%) con rol admin y activo.', v_email, v_id;
end;
$$;
