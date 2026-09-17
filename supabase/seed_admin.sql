-- =============================================================================
--  SEED DEL PRIMER ADMINISTRADOR
-- =============================================================================
--
--  Crea (o promueve) la cuenta del primer administrador del portal. Sirve en
--  dos escenarios:
--
--    · LOCAL: después de `supabase db reset`, córrelo con
--      `psql "$DATABASE_URL" -f supabase/seed_admin.sql`.
--    · PRODUCCIÓN, una sola vez: pégalo en Supabase → SQL Editor con tu correo
--      y una contraseña provisional. La vía RECOMENDADA para producción es
--      `npm run admin:crear -- correo contraseña "Nombre"`, que usa la API
--      oficial de administración de Auth (scripts/crear-admin.mjs).
--
--  CAMBIA LOS TRES VALORES DEL BLOQUE `config` ANTES DE CORRERLO.
--
--  Qué hace, en orden:
--    1. Si el correo ya existe en auth.users, no lo toca.
--    2. Si no existe, inserta el usuario en auth.users y auth.identities con
--       la contraseña cifrada (bcrypt, igual que GoTrue) y el correo ya
--       confirmado. El trigger `on_auth_user_created` crea su perfil.
--    3. Pone el perfil en rol `admin` y activo.
--
--  Desde el SQL Editor no hay sesión, así que el trigger `profiles_proteger`
--  no interfiere (ver migración 0010).
--
--  CAMBIA LA CONTRASEÑA DESPUÉS DEL PRIMER INGRESO. Este archivo queda en el
--  repositorio: la contraseña que pongas acá NO es secreta.
-- =============================================================================

do $$
declare
  -- ---------------------------------------------------------------------------
  --  config — edita estos tres valores
  -- ---------------------------------------------------------------------------
  v_email    text := 'admin@luxcars.pe';
  v_password text := 'CambiaEstaClave-2026!';
  v_nombre   text := 'Administrador LuxCars';
  -- ---------------------------------------------------------------------------
  v_id uuid;
begin
  if v_password is null or length(v_password) < 8 then
    raise exception 'La contraseña del seed debe tener al menos 8 caracteres.';
  end if;

  select id into v_id from auth.users where lower(email) = lower(v_email);

  if v_id is null then
    v_id := gen_random_uuid();

    -- Las columnas de token van como '' y no NULL: GoTrue las lee como string
    -- y un NULL rompe el login con "converting NULL to string is unsupported".
    insert into auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', lower(v_email),
      extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nombre', v_nombre),
      false, now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id, v_id::text, 'email',
      jsonb_build_object('sub', v_id::text, 'email', lower(v_email), 'email_verified', true),
      now(), now(), now()
    );

    raise notice 'Usuario creado: % (%)', v_email, v_id;
  else
    raise notice 'El usuario % ya existía (%): solo se promueve a admin.', v_email, v_id;
  end if;

  -- El trigger ya creó el perfil; si la migración 0010 corrió antes que el
  -- usuario existiera, igual está. Por si acaso, upsert.
  insert into public.profiles (id, rol, activo, nombre, email)
  values (v_id, 'admin', true, v_nombre, lower(v_email))
  on conflict (id) do update
    set rol = 'admin',
        activo = true,
        nombre = case when public.profiles.nombre = '' then excluded.nombre else public.profiles.nombre end,
        email = excluded.email;

  raise notice 'Perfil % con rol admin y activo.', v_id;
end;
$$;
