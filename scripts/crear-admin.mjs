#!/usr/bin/env node
/**
 * Crea (o promueve) el primer administrador del portal usando la API de
 * administración de Supabase Auth. Es la vía recomendada para PRODUCCIÓN:
 * no toca el esquema `auth` a mano, GoTrue cifra la contraseña y deja el
 * correo confirmado.
 *
 *   node scripts/crear-admin.mjs correo@luxcars.pe 'Contraseña-Provisional' "Nombre Apellido"
 *
 * Lee SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY de
 * `.env.local` o del entorno. La llave service_role salta RLS: este script se
 * corre en tu máquina, nunca en el navegador ni en Vercel.
 *
 * Qué hace:
 *   1. Si el correo ya existe, usa esa cuenta. Si no, la crea con el correo
 *      confirmado y el nombre en `user_metadata` (el trigger lo copia al perfil).
 *   2. Pone `public.profiles.rol = 'admin'` y `activo = true`.
 *
 * Idempotente: correrlo dos veces no crea duplicados ni cambia la contraseña
 * de una cuenta existente.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotEnv(file) {
  try {
    for (const raw of readFileSync(file, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Sin .env.local: se usan solo las variables del entorno.
  }
}

loadDotEnv(resolve(process.cwd(), ".env.local"));

const [email, password, nombre = ""] = process.argv.slice(2);
const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!email || !password) {
  fail('Uso: node scripts/crear-admin.mjs correo@luxcars.pe "Contraseña" "Nombre Apellido"');
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("El correo no parece válido.");
if (password.length < 8) fail("La contraseña debe tener al menos 8 caracteres.");
if (!url) fail("Falta SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL (en .env.local o el entorno).");
if (!serviceKey) fail("Falta SUPABASE_SERVICE_ROLE_KEY. Supabase → Project Settings → API Keys → service_role.");

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(target) {
  const wanted = target.toLowerCase();
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`No se pudo listar usuarios: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === wanted);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await findUserByEmail(email);

if (user) {
  console.log(`· La cuenta ${email} ya existe (${user.id}). No se cambia la contraseña.`);
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nombre.trim().slice(0, 160) },
  });
  if (error || !data.user) fail(`No se pudo crear la cuenta: ${error?.message ?? "sin detalle"}`);
  user = data.user;
  console.log(`· Cuenta creada: ${email} (${user.id}), correo confirmado.`);
}

// El trigger on_auth_user_created ya creó el perfil como cliente. Se promueve.
const { error: profileError } = await supabase
  .from("profiles")
  .upsert(
    { id: user.id, rol: "admin", activo: true, email: email.toLowerCase(), ...(nombre ? { nombre: nombre.trim().slice(0, 160) } : {}) },
    { onConflict: "id" },
  );

if (profileError) {
  fail(
    `La cuenta existe pero no se pudo poner el rol admin: ${profileError.message}. ` +
      "¿Aplicaste la migración 20260917100000_cuentas_y_roles.sql (supabase db push)?",
  );
}

console.log(`✔ ${email} es administrador. Entra en /portal/login.`);
if (!(await findUserByEmail(email))?.last_sign_in_at) {
  console.log("  Cambia la contraseña provisional después del primer ingreso (Supabase → Authentication → Users → Reset password).");
}
