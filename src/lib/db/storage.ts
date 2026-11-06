/**
 * Piezas de Storage que SÍ puede usar el navegador.
 *
 * Viven separadas de `db/client.ts` a propósito. Ese módulo lee `DATABASE_URL`,
 * y un componente cliente que lo importara —aunque fuera solo por el nombre
 * del bucket— arrastraría el módulo entero al bundle del navegador. Hoy el
 * valor saldría `undefined` porque Next solo inyecta `NEXT_PUBLIC_*`, pero es
 * seguridad por accidente: bastaría con que alguien renombrara la variable a
 * NEXT_PUBLIC_ para filtrar una conexión que salta RLS.
 *
 * Aquí solo hay variables públicas. `db/client.ts` importa de este archivo y
 * lleva un `server-only` que hace fallar el build si vuelve a colarse al cliente.
 * Las llaves para ESCRIBIR en el bucket viven en `lib/portal/objectStorage.ts`,
 * también solo de servidor.
 */

/**
 * Bucket de Neon Object Storage con las fotos del stock. Se crea una vez por
 * rama con lectura pública (ver `db/migrations/20260915090300_vehicle_photos.sql`).
 */
export const VEHICLE_PHOTOS_BUCKET =
  (process.env.NEXT_PUBLIC_VEHICLE_PHOTOS_BUCKET ?? "").trim() || "vehiculos";

/**
 * Dirección S3 de la rama, p. ej.
 * `https://br-xxxx.storage.c-16.us-east-1.aws.neon.tech`. No es secreta: es la
 * misma que aparece en la URL pública de cada foto.
 */
const STORAGE_URL = (process.env.NEXT_PUBLIC_NEON_STORAGE_URL ?? "").trim();

function isUsableUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Dirección S3 de la rama, sin barra final. `null` si no hay configuración. */
export function getStorageEndpoint(): string | null {
  return isUsableUrl(STORAGE_URL) ? STORAGE_URL.replace(/\/+$/, "") : null;
}

/** URL pública de una foto guardada en Storage. `null` si no hay configuración. */
export function getPublicStorageUrl(storagePath: string): string | null {
  const base = getStorageEndpoint();
  if (!base || !storagePath) return null;
  const cleanPath = storagePath
    .replace(/^\/+/, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${base}/${VEHICLE_PHOTOS_BUCKET}/${cleanPath}`;
}
