#!/usr/bin/env node
/**
 * Aplica UNA migración de `db/migrations/` a Neon, en una sola transacción.
 *
 *   node scripts/aplicar-migracion.mjs db/migrations/20261125090000_expedientes.sql
 *
 * Lee DATABASE_URL de `.env.local` o del entorno. Existe porque desde algunas
 * redes el puerto 5432 está bloqueado y `psql` se queda colgado: el driver
 * serverless de Neon entra por WebSocket (443) y llega igual. Hace lo mismo
 * que `psql --single-transaction -f`: si una sentencia falla, no queda nada
 * aplicado a medias.
 *
 * Después de aplicar un cambio de esquema hay que refrescar la caché de la
 * Data API (ver db/README.md), si no el sitio responde "Could not find the
 * table … in the schema cache".
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "@neondatabase/serverless";

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

const [archivo] = process.argv.slice(2);
if (!archivo) {
  console.error("Uso: node scripts/aplicar-migracion.mjs db/migrations/<archivo>.sql");
  process.exit(1);
}
const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
if (!databaseUrl) {
  console.error("Falta DATABASE_URL (en .env.local o el entorno).");
  process.exit(1);
}

const sql = readFileSync(resolve(process.cwd(), archivo), "utf8");
const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();
try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log(`✔ Aplicada: ${archivo}`);
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(`✖ No se aplicó ${archivo}:`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
