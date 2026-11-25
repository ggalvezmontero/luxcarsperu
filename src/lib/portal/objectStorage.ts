/**
 * Escritura en Neon Object Storage (API compatible con S3). SOLO SERVIDOR.
 *
 * Dos buckets en la misma rama, con la misma credencial `storage:write`:
 *
 *  · `vehiculos` (`VEHICLE_PHOTOS_BUCKET`): fotos del stock, lectura PÚBLICA.
 *    Escribir o borrar exige la credencial; leer, no.
 *  · `expedientes` (`EXPEDIENTES_BUCKET`): documentos de los expedientes de
 *    importación (contratos, firmados, comprobantes), PRIVADO. Nadie lee sin
 *    una URL firmada de corta duración (`firmarDescarga`), y esa URL solo la
 *    emite una ruta de servidor que antes comprobó sesión y propiedad.
 *
 * La credencial vive acá, en variables de servidor, y NUNCA viaja al
 * navegador. Lo que sí viaja es una URL prefirmada: sirve para subir UN archivo
 * a UNA ruta (o bajar uno) durante cinco minutos, y nada más.
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

/** Bucket privado de los expedientes. Se creó a mano en la consola de Neon (2026-11-25). */
export const EXPEDIENTES_BUCKET = (process.env.NEON_STORAGE_EXPEDIENTES_BUCKET ?? "").trim() || "expedientes";

export type Bucket = string;

/** Vigencia de una URL firmada. Alcanza para una foto en una conexión móvil lenta o para abrir un PDF. */
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
function urlDeObjeto(endpoint: string, bucket: Bucket, storagePath: string): URL {
  const clave = storagePath.split("/").map(encodeURIComponent).join("/");
  return new URL(`${endpoint}/${bucket}/${clave}`);
}

/**
 * URL prefirmada para subir un archivo con `PUT`. `null` si no hay credencial.
 *
 * Solo se firma el host, igual que hace el SDK de AWS: el navegador manda
 * `Content-Type` y `Cache-Control` como cabeceras normales.
 */
export async function firmarSubida(storagePath: string, bucket: Bucket = VEHICLE_PHOTOS_BUCKET): Promise<string | null> {
  const actual = getAlmacen();
  if (!actual) return null;

  const url = urlDeObjeto(actual.endpoint, bucket, storagePath);
  url.searchParams.set("X-Amz-Expires", String(SEGUNDOS_VIGENCIA));

  const firmada = await actual.cliente.sign(url.toString(), {
    method: "PUT",
    aws: { signQuery: true },
  });
  return firmada.url;
}

/**
 * URL prefirmada para subir UN archivo de un tipo y un tamaño EXACTOS.
 *
 * Es la que se usa cuando lo que sube importa (un cliente adjuntando fotos a
 * su solicitud; el equipo archivando un contrato firmado). A diferencia de
 * `firmarSubida`, aquí el `Content-Type` y el `Content-Length` entran en la
 * firma: si el navegador manda otro tipo u otro tamaño, el almacenamiento
 * contesta 403. Sin eso, una URL pensada para un PDF de 1 MB serviría para
 * subir cualquier archivo de cualquier peso. Comprobado contra Neon Object
 * Storage el 2026-11-11.
 */
export async function firmarSubidaExacta(
  storagePath: string,
  contentType: string,
  bytes: number,
  bucket: Bucket = VEHICLE_PHOTOS_BUCKET,
): Promise<string | null> {
  const actual = getAlmacen();
  if (!actual) return null;

  const url = urlDeObjeto(actual.endpoint, bucket, storagePath);
  url.searchParams.set("X-Amz-Expires", String(SEGUNDOS_VIGENCIA));

  const firmada = await actual.cliente.sign(url.toString(), {
    method: "PUT",
    headers: { "content-type": contentType, "content-length": String(bytes) },
    aws: { signQuery: true, allHeaders: true },
  });
  return firmada.url;
}

/**
 * URL prefirmada para BAJAR un objeto de un bucket privado con `GET`. Vale
 * `segundos` (cinco minutos por defecto). Es la única forma de leer del bucket
 * `expedientes`: la ruta que la emite ya comprobó sesión y propiedad.
 *
 * `nombreDescarga` fija el nombre con que el navegador guarda el archivo
 * (`Content-Disposition`), para que un contrato no se baje como un UUID.
 */
export async function firmarDescarga(
  bucket: Bucket,
  storagePath: string,
  segundos = SEGUNDOS_VIGENCIA,
  nombreDescarga?: string,
): Promise<string | null> {
  const actual = getAlmacen();
  if (!actual) return null;

  const url = urlDeObjeto(actual.endpoint, bucket, storagePath);
  url.searchParams.set("X-Amz-Expires", String(Math.max(1, Math.min(segundos, 3600))));
  if (nombreDescarga) {
    const seguro = nombreDescarga.replace(/[^A-Za-z0-9._-]/g, "_");
    url.searchParams.set("response-content-disposition", `inline; filename="${seguro}"`);
  }

  const firmada = await actual.cliente.sign(url.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });
  return firmada.url;
}

/**
 * Sube un objeto DESDE EL SERVIDOR (un PDF recién generado). Devuelve `false`
 * si no hay credencial o si el almacenamiento lo rechaza.
 */
export async function subirObjeto(
  bucket: Bucket,
  storagePath: string,
  cuerpo: Uint8Array,
  contentType: string,
): Promise<boolean> {
  const actual = getAlmacen();
  if (!actual) return false;
  try {
    const respuesta = await actual.cliente.fetch(urlDeObjeto(actual.endpoint, bucket, storagePath).toString(), {
      method: "PUT",
      headers: { "content-type": contentType, "content-length": String(cuerpo.byteLength) },
      body: new Uint8Array(cuerpo),
    });
    return respuesta.ok;
  } catch {
    return false;
  }
}

/** ¿Existe el objeto? (`HEAD`). `null` si no se pudo preguntar. */
export async function existeObjeto(bucket: Bucket, storagePath: string): Promise<boolean | null> {
  const actual = getAlmacen();
  if (!actual) return null;
  try {
    const respuesta = await actual.cliente.fetch(urlDeObjeto(actual.endpoint, bucket, storagePath).toString(), {
      method: "HEAD",
    });
    if (respuesta.ok) return true;
    if (respuesta.status === 404) return false;
    return null;
  } catch {
    return null;
  }
}

export type ObjetoListado = { path: string; bytes: number };

/**
 * Los objetos que cuelgan de un prefijo (una "carpeta"), hasta 100. `null` si
 * no hay credencial o si el almacenamiento no responde: quien llama decide si
 * eso es "no hay fotos" o un error.
 */
export async function listarObjetos(prefijo: string, bucket: Bucket = VEHICLE_PHOTOS_BUCKET): Promise<ObjetoListado[] | null> {
  const actual = getAlmacen();
  if (!actual) return null;

  try {
    const url = new URL(`${actual.endpoint}/${bucket}`);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("max-keys", "100");
    url.searchParams.set("prefix", prefijo);
    const respuesta = await actual.cliente.fetch(url.toString(), { method: "GET" });
    if (!respuesta.ok) return null;

    const xml = await respuesta.text();
    const objetos: ObjetoListado[] = [];
    for (const bloque of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []) {
      const clave = /<Key>([^<]*)<\/Key>/.exec(bloque)?.[1];
      const peso = /<Size>(\d+)<\/Size>/.exec(bloque)?.[1];
      if (clave) objetos.push({ path: decodificarXml(clave), bytes: Number(peso ?? 0) });
    }
    return objetos;
  } catch {
    return null;
  }
}

/** Las cinco entidades que S3 escapa en las claves del listado. */
function decodificarXml(valor: string): string {
  return valor
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Borra un objeto del bucket. Devuelve `false` si no hay credencial o si Neon
 * rechaza el borrado; borrar algo que ya no existe cuenta como éxito.
 */
export async function borrarObjeto(storagePath: string, bucket: Bucket = VEHICLE_PHOTOS_BUCKET): Promise<boolean> {
  const actual = getAlmacen();
  if (!actual) return false;

  try {
    const respuesta = await actual.cliente.fetch(
      urlDeObjeto(actual.endpoint, bucket, storagePath).toString(),
      { method: "DELETE" },
    );
    return respuesta.ok || respuesta.status === 404;
  } catch {
    return false;
  }
}
