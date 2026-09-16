/**
 * Cliente de Supabase con detección de configuración.
 *
 * REGLA INNEGOCIABLE DE ESTE ARCHIVO: nunca lanza. El sitio de LuxCars debe
 * compilar y renderizar HOY, sin base de datos y sin variables de entorno. Si
 * falta configuración, `getSupabaseClient()` devuelve `null` y cada consumidor
 * decide su respaldo (lista vacía, WhatsApp, etc.). Un `throw` aquí tumba el
 * build de Vercel y la página entera; un `null` solo apaga una sección.
 */

// Candado: este módulo lee SUPABASE_SERVICE_ROLE_KEY, que salta RLS. Si un
// componente cliente lo importa, el build FALLA en vez de arrastrarlo al
// navegador. Lo que sí puede usar el cliente vive en `db/storage.ts`.
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Lectura de env a prueba de bundle de navegador (donde `process` puede no existir). */
function readEnv(key: string): string {
  if (typeof process === "undefined" || !process.env) return "";
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Next.js reemplaza `process.env.NEXT_PUBLIC_*` de forma estática, así que las
 * públicas se leen por nombre literal para que el inlining funcione en el
 * bundle del cliente. Las privadas solo existen en el servidor.
 */
const SUPABASE_URL =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim() ||
  readEnv("SUPABASE_URL");

const SUPABASE_ANON_KEY =
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() ||
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

const SUPABASE_SERVICE_ROLE_KEY = readEnv("SUPABASE_SERVICE_ROLE_KEY");

export { VEHICLE_PHOTOS_BUCKET, getPublicStorageUrl } from "./storage";
import { VEHICLE_PHOTOS_BUCKET } from "./storage";

function isUsableUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const HAS_PUBLIC_CONFIG = isUsableUrl(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 0;
const HAS_SERVICE_CONFIG =
  isUsableUrl(SUPABASE_URL) && SUPABASE_SERVICE_ROLE_KEY.length > 0;

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
 * ¿Hay llave de servicio para escrituras del servidor (inserción de leads,
 * operaciones del admin)? Nunca es `true` en el navegador.
 */
export function isDatabaseWriteConfigured(): boolean {
  return HAS_SERVICE_CONFIG;
}

/** Diagnóstico para el panel de administración. No expone ninguna llave. */
export function getDatabaseStatus(): {
  configured: boolean;
  writeConfigured: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!isUsableUrl(SUPABASE_URL)) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return {
    configured: HAS_PUBLIC_CONFIG,
    writeConfigured: HAS_SERVICE_CONFIG,
    missing,
  };
}

let publicClient: SupabaseClient | null = null;
let publicClientResolved = false;
let serviceClient: SupabaseClient | null = null;
let serviceClientResolved = false;

/**
 * Cliente con llave anónima (respeta RLS). `null` si no hay configuración.
 * Se memoiza: `createClient` no debe llamarse por render.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (publicClientResolved) return publicClient;
  publicClientResolved = true;

  if (!HAS_PUBLIC_CONFIG) {
    publicClient = null;
    return null;
  }

  try {
    publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-application-name": "luxcars-web" } },
    });
  } catch {
    // Configuración malformada: se degrada a "sin base de datos".
    publicClient = null;
  }
  return publicClient;
}

/**
 * Cliente con service role. SOLO servidor: salta RLS.
 *
 * Nunca lo importes desde un componente cliente ni desde código que llegue al
 * navegador. Devuelve `null` en el navegador aunque hubiera llave.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (typeof window !== "undefined") return null;
  if (serviceClientResolved) return serviceClient;
  serviceClientResolved = true;

  if (!HAS_SERVICE_CONFIG) {
    serviceClient = null;
    return null;
  }

  try {
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-application-name": "luxcars-server" } },
    });
  } catch {
    serviceClient = null;
  }
  return serviceClient;
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
