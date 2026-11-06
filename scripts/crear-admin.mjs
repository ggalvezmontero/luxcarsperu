#!/usr/bin/env node
/**
 * Da rol de administrador del portal a una cuenta que YA existe en Neon Auth.
 *
 *   node scripts/crear-admin.mjs correo@luxcars.pe "Nombre Apellido"
 *   npm run admin:crear -- correo@luxcars.pe "Nombre Apellido"
 *   npm run admin:crear -- correo@luxcars.pe "Nombre Apellido" --sin-verificar
 *
 * Lee DATABASE_URL de `.env.local` o del entorno. Esa conexión entra como
 * dueño de la base y salta RLS: este script se corre en tu máquina, nunca en
 * el navegador ni en Vercel.
 *
 * ACÁ NO SE CREA LA CUENTA NI SE MANEJA NINGUNA CONTRASEÑA. Las credenciales
 * las guarda Neon Auth. La cuenta nace de una de dos formas:
 *
 *   · La persona se registra en luxcars.pe/cuenta/login (Crear cuenta).
 *   · El dueño la agrega por correo en la consola de Neon → Auth → Users, y la
 *     persona define su contraseña en luxcars.pe/portal/recuperar.
 *
 * Qué hace:
 *   1. Busca la cuenta por correo en `neon_auth."user"`. Si no existe, lo dice
 *      y termina sin tocar nada.
 *   2. Pone `public.profiles.rol = 'admin'` y `activo = true` (crea el perfil
 *      si la cuenta es anterior a la migración 0010).
 *
 * CUIDADO CON QUIÉN ES LA CUENTA. El registro del sitio es abierto y no
 * confirma el correo: cualquiera puede crear una cuenta con la dirección de
 * otra persona (la de alguien que vas a sumar al equipo, por ejemplo) y ponerle
 * su propia contraseña. Si después se asciende "ese correo", el que entra como
 * administrador es el extraño. Por eso el script muestra cuándo se creó la
 * cuenta y NO asciende una con el correo sin verificar, salvo que le pases
 * `--sin-verificar` después de confirmar con la persona que la cuenta es suya.
 *
 * Idempotente: correrlo dos veces deja lo mismo.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

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

const argumentos = process.argv.slice(2);
const aceptaSinVerificar = argumentos.includes("--sin-verificar");
const [email, nombre = ""] = argumentos.filter((arg) => !arg.startsWith("--"));
const databaseUrl = (process.env.DATABASE_URL ?? "").trim();

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

if (!email) {
  fail('Uso: node scripts/crear-admin.mjs correo@luxcars.pe "Nombre Apellido"');
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("El correo no parece válido.");
if (!databaseUrl) {
  fail("Falta DATABASE_URL (en .env.local o el entorno). Consola de Neon → Connect → Connection string.");
}

const sql = neon(databaseUrl);

let cuenta;
try {
  [cuenta] = await sql`
    select id, email, name, "emailVerified" as verificado, "createdAt" as creada
    from neon_auth."user"
    where lower(email) = lower(${email})
    limit 1
  `;
} catch (error) {
  fail(`No se pudo consultar Neon Auth: ${error instanceof Error ? error.message : String(error)}`);
}

if (!cuenta) {
  fail(
    [
      `No hay ninguna cuenta con el correo ${email}.`,
      "  Créala primero, de una de estas dos formas, y vuelve a correr este comando:",
      "    · Regístrate en luxcars.pe/cuenta/login (Crear cuenta).",
      "    · Consola de Neon → Auth → Users → agrega el correo, y define la contraseña en luxcars.pe/portal/recuperar.",
    ].join("\n"),
  );
}

const creada = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Lima",
}).format(new Date(cuenta.creada));

if (!cuenta.verificado && !aceptaSinVerificar) {
  fail(
    [
      `La cuenta ${cuenta.email} existe (creada el ${creada}) pero su correo NO está verificado.`,
      "  El registro del sitio no confirma el correo: esa cuenta pudo crearla otra persona usando esta dirección.",
      "  Antes de darle rol de administrador, confirma con la persona que la creó ella y que entra con su contraseña.",
      "  Si es así, vuelve a correr el comando agregando --sin-verificar.",
    ].join("\n"),
  );
}

try {
  await sql`
    insert into public.profiles (id, rol, activo, nombre, email)
    values (${cuenta.id}, 'admin', true, ${(nombre || cuenta.name || "").slice(0, 160)}, lower(${cuenta.email}))
    on conflict (id) do update
      set rol = 'admin',
          activo = true,
          nombre = case when ${nombre} <> '' then excluded.nombre else public.profiles.nombre end,
          email = excluded.email
  `;
} catch (error) {
  fail(
    [
      `No se pudo asignar el rol: ${error instanceof Error ? error.message : String(error)}`,
      "  ¿Aplicaste la migración 20260917100000_cuentas_y_roles.sql? (ver db/README.md)",
    ].join("\n"),
  );
}

console.log(`\n✔ ${cuenta.email} es administrador del portal y está activo. (Cuenta creada el ${creada}.)`);
console.log("  Entra por luxcars.pe/portal/login. Si todavía no tiene contraseña: luxcars.pe/portal/recuperar.\n");
