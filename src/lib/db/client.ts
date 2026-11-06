/**
 * Clientes de Neon con detección de configuración.
 *
 * REGLA INNEGOCIABLE DE ESTE ARCHIVO: nunca lanza. El sitio de LuxCars debe
 * compilar y renderizar HOY, sin base de datos y sin variables de entorno. Si
 * falta configuración, `getPublicClient()` y `getSql()` devuelven `null` y cada
 * consumidor decide su respaldo (lista vacía, WhatsApp, etc.). Un `throw` aquí
 * tumba el build de Vercel y la página entera; un `null` solo apaga una sección.
 *
 * Hay DOS caminos a la misma base, con permisos distintos a propósito:
 *
 *  · `getPublicClient()` → Data API de Neon como rol `anonymous`. Respeta RLS y
 *    los GRANT por columna: solo ve vehículos publicados y sus fotos.
 *  · `getSql()` → conexión directa con `DATABASE_URL`, como dueño de la base.
 *    NO pasa por RLS. Es para escrituras del servidor (leads de formularios
 *    públicos), nunca para pintar pantallas.
 */

// Candado: este módulo lee DATABASE_URL, que salta RLS. Si un componente
// cliente lo importa, el build FALLA en vez de arrastrarlo al navegador. Lo
// que sí puede usar el cliente vive en `db/storage.ts` y `db/neonConfig.ts`.
import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { createClient } from "@neon/neon-js/supabase";

import { getNeonUrls, isNeonConfigured } from "./neonConfig";

/** Lectura de env a prueba de bundle de navegador (donde `process` puede no existir). */
function readEnv(key: string): string {
  if (typeof process === "undefined" || !process.env) return "";
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
}

const DATABASE_URL = readEnv("DATABASE_URL");

export { VEHICLE_PHOTOS_BUCKET, getPublicStorageUrl } from "./storage";

function isPostgresUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "postgresql:" || url.protocol === "postgres:";
  } catch {
    return false;
  }
}

const HAS_PUBLIC_CONFIG = isNeonConfigured();
const HAS_WRITE_CONFIG = isPostgresUrl(DATABASE_URL);

/**
 * ¿Hay base de datos disponible para lectura pública?
 *
 * Los componentes la usan para decidir si muestran la sección de inventario o
 * el respaldo estático. Es una comprobación barata y síncrona: no abre conexión.
 */
export function isDatabaseConfigured(): boolean {
  return HAS_PUBLIC_CONFIG;
}

/**
 * ¿Hay conexión directa para escrituras del servidor (inserción de leads,
 * operaciones del admin)? Nunca es `true` en el navegador.
 */
export function isDatabaseWriteConfigured(): boolean {
  return HAS_WRITE_CONFIG;
}

/** Diagnóstico para el panel de administración. No expone ningún secreto. */
export function getDatabaseStatus(): {
  configured: boolean;
  writeConfigured: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!HAS_PUBLIC_CONFIG) missing.push("NEXT_PUBLIC_NEON_URL");
  if (!HAS_WRITE_CONFIG) missing.push("DATABASE_URL");
  return {
    configured: HAS_PUBLIC_CONFIG,
    writeConfigured: HAS_WRITE_CONFIG,
    missing,
  };
}

/** Cliente de la Data API tal como lo construye `@neon/neon-js`. */
export type DataApiClient = ReturnType<typeof createClient>;

let publicClient: DataApiClient | null = null;
let publicClientResolved = false;

/**
 * Cliente de la Data API como visitante anónimo (respeta RLS). `null` si no hay
 * configuración. Se memoiza: `createClient` no debe llamarse por render.
 *
 * `allowAnonymous` hace que el SDK pida a Neon Auth un token anónimo de corta
 * duración y lo reutilice: Postgres evalúa cada consulta como rol `anonymous`.
 */
export function getPublicClient(): DataApiClient | null {
  if (publicClientResolved) return publicClient;
  publicClientResolved = true;

  const urls = getNeonUrls();
  if (!urls) {
    publicClient = null;
    return null;
  }

  try {
    publicClient = createClient({
      auth: { url: urls.auth, allowAnonymous: true },
      dataApi: { url: urls.dataApi },
    });
  } catch {
    // Configuración malformada: se degrada a "sin base de datos".
    publicClient = null;
  }
  return publicClient;
}

let sqlClient: NeonQueryFunction<false, false> | null = null;
let sqlClientResolved = false;

/**
 * Conexión directa a Postgres (HTTP, apta para funciones serverless). SOLO
 * servidor: entra como dueño de la base y salta RLS.
 *
 * Nunca la importes desde un componente cliente ni desde código que llegue al
 * navegador. Devuelve `null` en el navegador aunque hubiera variable.
 */
export function getSql(): NeonQueryFunction<false, false> | null {
  if (typeof window !== "undefined") return null;
  if (sqlClientResolved) return sqlClient;
  sqlClientResolved = true;

  if (!HAS_WRITE_CONFIG) {
    sqlClient = null;
    return null;
  }

  try {
    sqlClient = neon(DATABASE_URL);
  } catch {
    sqlClient = null;
  }
  return sqlClient;
}

const warnedKeys = new Set<string>();

/**
 * Registra un aviso UNA sola vez por clave durante la vida del proceso.
 * "No hay base de datos" no debe repetirse en cada render ni en cada request.
 */
export function warnOnce(key: string, message: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[luxcars/db] ${message}`);
}
