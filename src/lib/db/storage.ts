/**
 * Piezas de Storage que SÍ puede usar el navegador.
 *
 * Viven separadas de `db/client.ts` a propósito. Ese módulo lee
 * SUPABASE_SERVICE_ROLE_KEY, y un componente cliente que lo importara —aunque
 * fuera solo por el nombre del bucket— arrastraría el módulo entero al bundle
 * del navegador. Hoy el valor saldría `undefined` porque Next solo inyecta
 * `NEXT_PUBLIC_*`, pero es seguridad por accidente: bastaría con que alguien
 * renombrara la variable a NEXT_PUBLIC_ para filtrar una llave que salta RLS.
 *
 * Aquí solo hay variables públicas. `db/client.ts` importa de este archivo y
 * lleva un `server-only` que hace fallar el build si vuelve a colarse al cliente.
 */

/**
 * Bucket de Supabase Storage con las fotos del stock. El nombre `vehiculos` es
 * el que crea la migración `20260915090300_vehicle_photos.sql`; solo cambia si
 * cambia esa migración.
 */
export const VEHICLE_PHOTOS_BUCKET =
  (process.env.NEXT_PUBLIC_SUPABASE_VEHICLE_PHOTOS_BUCKET ?? "").trim() ||
  "vehiculos";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();

function isUsableUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** URL pública de una foto guardada en Storage. `null` si no hay configuración. */
export function getPublicStorageUrl(storagePath: string): string | null {
  if (!isUsableUrl(SUPABASE_URL) || !storagePath) return null;
  const base = SUPABASE_URL.replace(/\/+$/, "");
  const cleanPath = storagePath.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${VEHICLE_PHOTOS_BUCKET}/${cleanPath}`;
}
