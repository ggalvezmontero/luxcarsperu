/**
 * /api/portal/fotos — permisos para escribir en el bucket de fotos.
 *
 *   POST   { vehicleId, contentType, bytes } → URL prefirmada para subir UNA foto
 *   DELETE { paths }                         → borra archivos del bucket
 *
 * POR QUÉ EXISTE ESTA RUTA, SI EL RESTO DEL PORTAL ESCRIBE DESDE EL NAVEGADOR
 * Las tablas se cuidan solas: RLS deja escribir en `vehicle_photos` solo al rol
 * `authenticated`. El bucket no. Neon Object Storage vive fuera de Postgres y
 * no tiene políticas por usuario: escribe quien tenga la credencial
 * `storage:write`, y esa credencial no puede estar en el navegador. Esta ruta
 * es el equivalente de RLS para los archivos: comprueba la sesión del equipo y
 * recién entonces firma.
 *
 * LA FOTO NO PASA POR ACÁ. La ruta solo entrega una URL; el archivo sube
 * directo del teléfono a Neon. Eso esquiva el límite de ~4.5 MB del cuerpo de
 * una función de Vercel y ahorra un salto de red en una conexión móvil.
 *
 * La RUTA del archivo la decide el servidor, no el cliente: `{vehicleId}/{uuid}.{ext}`.
 * Si la eligiera el navegador, una sesión válida podría pisar cualquier objeto.
 *
 * Nunca lanza: todo error sale como JSON con `ok: false` y un mensaje en español.
 */

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getPublicStorageUrl } from "@/lib/db/storage";
import { verificarSesionPortal } from "@/lib/portal/authServer";
import {
  borrarObjeto,
  firmarSubida,
  getStorageWriteMissingEnv,
  isStorageWriteConfigured,
} from "@/lib/portal/objectStorage";

/** Tope por foto. Una foto de celular moderno entra de sobra; un video no. */
const BYTES_MAXIMOS = 15 * 1024 * 1024;

/** Máximo de archivos por llamada de borrado. La galería de un auto no pasa de ahí. */
const BORRADOS_MAXIMOS = 100;

const EXTENSION_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
};

const RE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Carpeta de las fotos de los ejemplos de importación (/portal/ejemplos). No
 * cuelgan de un vehículo del stock, así que no van bajo un `{vehicleId}/`.
 */
const CARPETA_EJEMPLOS = "ejemplos";

/**
 * Solo rutas con la convención del bucket: `{uuid}/{uuid}.{ext}` para el stock
 * y `ejemplos/{uuid}.{ext}` para los ejemplos de importación.
 */
const RE_RUTA =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|ejemplos)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif|heic)$/i;

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

/** Sesión del equipo y credencial del bucket. Devuelve la respuesta de error, o `null` si todo está. */
async function puerta(): Promise<NextResponse | null> {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);

  if (!isStorageWriteConfigured()) {
    return fallo(
      503,
      `El almacenamiento de fotos no está configurado: falta ${getStorageWriteMissingEnv().join(", ")} (ver .env.example).`,
    );
  }
  return null;
}

async function leerCuerpo(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const cuerpo: unknown = await request.json();
    return cuerpo && typeof cuerpo === "object"
      ? (cuerpo as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const cerrada = await puerta();
  if (cerrada) return cerrada;

  const cuerpo = await leerCuerpo(request);
  const vehicleId = typeof cuerpo?.vehicleId === "string" ? cuerpo.vehicleId : "";
  const paraEjemplos = cuerpo?.carpeta === CARPETA_EJEMPLOS;
  const contentType =
    typeof cuerpo?.contentType === "string" ? cuerpo.contentType.toLowerCase() : "";
  const bytes = typeof cuerpo?.bytes === "number" ? cuerpo.bytes : Number.NaN;

  if (!paraEjemplos && !RE_UUID.test(vehicleId)) {
    return fallo(400, "Falta el vehículo al que pertenece la foto.");
  }
  const extension = EXTENSION_POR_TIPO[contentType];
  if (!extension) {
    return fallo(400, "Solo se aceptan fotos JPEG, PNG, WebP, AVIF o HEIC.");
  }
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return fallo(400, "El archivo está vacío.");
  }
  if (bytes > BYTES_MAXIMOS) {
    return fallo(413, "La foto supera los 15 MB permitidos.");
  }

  // El UUID evita que dos fotos que el celular llamó igual (IMG_0001.jpg) se pisen.
  const carpeta = paraEjemplos ? CARPETA_EJEMPLOS : vehicleId.toLowerCase();
  const path = `${carpeta}/${randomUUID()}.${extension}`;

  try {
    const url = await firmarSubida(path);
    if (!url) return fallo(503, "No se pudo preparar la subida.");

    return NextResponse.json({
      ok: true,
      path,
      url,
      // Las fotos son inmutables: la ruta lleva UUID, así que nunca cambia el
      // contenido de una URL. Un año de caché es seguro y gratis.
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      publicUrl: getPublicStorageUrl(path),
    });
  } catch {
    return fallo(500, "No se pudo preparar la subida. Vuelve a intentarlo.");
  }
}

export async function DELETE(request: Request) {
  const cerrada = await puerta();
  if (cerrada) return cerrada;

  const cuerpo = await leerCuerpo(request);
  const paths = Array.isArray(cuerpo?.paths)
    ? cuerpo.paths.filter((path): path is string => typeof path === "string")
    : [];

  if (paths.length === 0 || paths.length > BORRADOS_MAXIMOS) {
    return fallo(400, "Indica qué archivos borrar.");
  }
  if (!paths.every((path) => RE_RUTA.test(path))) {
    return fallo(400, "Alguna ruta no pertenece al bucket de fotos.");
  }

  const resultados = await Promise.all(paths.map(borrarObjeto));
  if (resultados.includes(false)) {
    return fallo(502, "Algún archivo no se pudo quitar del almacenamiento.");
  }
  return NextResponse.json({ ok: true });
}
