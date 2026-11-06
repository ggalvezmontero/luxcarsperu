/**
 * Escritura en Neon Object Storage (API compatible con S3). SOLO SERVIDOR.
 *
 * El bucket `vehiculos` es de lectura pública, pero escribir o borrar exige una
 * credencial `storage:write`. Esa credencial vive acá, en variables de servidor,
 * y NUNCA viaja al navegador. Lo que sí viaja es una URL prefirmada: sirve para
 * subir UN archivo a UNA ruta durante cinco minutos, y nada más.
 *
 * Los nombres `NEON_STORAGE_*` son propios a propósito: Neon sugiere `AWS_*`,
 * pero Vercel reserva `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y
 * `AWS_REGION` para su propio entorno y no deja definirlas.
 *
 * Nunca lanza: sin credencial devuelve `null` y la ruta contesta 503.
 */
import "server-only";

import { AwsClient } from "aws4fetch";

import { VEHICLE_PHOTOS_BUCKET, getStorageEndpoint } from "@/lib/db/storage";

/** Vigencia de una URL de subida. Alcanza para una foto en una conexión móvil lenta. */
const SEGUNDOS_VIGENCIA = 300;

function leer(key: string): string {
  return (process.env[key] ?? "").trim();
}

/**
 * La región va en la dirección de la rama
 * (`br-xxxx.storage.c-16.us-east-1.aws.neon.tech`): es la etiqueta anterior a
 * `aws`. `NEON_STORAGE_REGION` permite forzarla si Neon cambia el formato.
 */
function regionDe(endpoint: string): string {
  const forzada = leer("NEON_STORAGE_REGION");
  if (forzada) return forzada;
  try {
    const labels = new URL(endpoint).hostname.split(".");
    const indice = labels.indexOf("aws");
    if (indice > 0) return labels[indice - 1];
  } catch {
    // Se cae al valor por defecto.
  }
  return "us-east-1";
}

type Almacen = { cliente: AwsClient; endpoint: string };

let almacen: Almacen | null = null;
let resuelto = false;

function getAlmacen(): Almacen | null {
  if (resuelto) return almacen;
  resuelto = true;

  const endpoint = getStorageEndpoint();
  const accessKeyId = leer("NEON_STORAGE_ACCESS_KEY_ID");
  const secretAccessKey = leer("NEON_STORAGE_SECRET_ACCESS_KEY");
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    almacen = null;
    return null;
  }

  almacen = {
    endpoint,
    cliente: new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: regionDe(endpoint),
    }),
  };
  return almacen;
}

/** Qué falta para poder escribir en el bucket. Para mensajes; no expone valores. */
export function getStorageWriteMissingEnv(): string[] {
  const missing: string[] = [];
  if (!getStorageEndpoint()) missing.push("NEXT_PUBLIC_NEON_STORAGE_URL");
  if (!leer("NEON_STORAGE_ACCESS_KEY_ID")) missing.push("NEON_STORAGE_ACCESS_KEY_ID");
  if (!leer("NEON_STORAGE_SECRET_ACCESS_KEY")) {
    missing.push("NEON_STORAGE_SECRET_ACCESS_KEY");
  }
  return missing;
}

export function isStorageWriteConfigured(): boolean {
  return getAlmacen() !== null;
}

/** Dirección del objeto con estilo de ruta (`endpoint/bucket/clave`), que exige Neon. */
function urlDeObjeto(endpoint: string, storagePath: string): URL {
  const clave = storagePath.split("/").map(encodeURIComponent).join("/");
  return new URL(`${endpoint}/${VEHICLE_PHOTOS_BUCKET}/${clave}`);
}

/**
 * URL prefirmada para subir un archivo con `PUT`. `null` si no hay credencial.
 *
 * Solo se firma el host, igual que hace el SDK de AWS: el navegador manda
 * `Content-Type` y `Cache-Control` como cabeceras normales.
 */
export async function firmarSubida(storagePath: string): Promise<string | null> {
  const actual = getAlmacen();
  if (!actual) return null;

  const url = urlDeObjeto(actual.endpoint, storagePath);
  url.searchParams.set("X-Amz-Expires", String(SEGUNDOS_VIGENCIA));

  const firmada = await actual.cliente.sign(url.toString(), {
    method: "PUT",
    aws: { signQuery: true },
  });
  return firmada.url;
}

/**
 * Borra un objeto del bucket. Devuelve `false` si no hay credencial o si Neon
 * rechaza el borrado; borrar algo que ya no existe cuenta como éxito.
 */
export async function borrarObjeto(storagePath: string): Promise<boolean> {
  const actual = getAlmacen();
  if (!actual) return false;

  try {
    const respuesta = await actual.cliente.fetch(
      urlDeObjeto(actual.endpoint, storagePath).toString(),
      { method: "DELETE" },
    );
    return respuesta.ok || respuesta.status === 404;
  } catch {
    return false;
  }
}
