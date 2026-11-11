/**
 * /api/cuenta/solicitudes/fotos — fotos que un CLIENTE adjunta a su solicitud
 * de venta ("Registra tu auto").
 *
 *   POST   { solicitudId, contentType, bytes } → URL prefirmada para subir UNA foto
 *   GET    ?solicitudId=…                     → fotos de la solicitud
 *   DELETE { solicitudId, path }              → quita una foto
 *
 * POR QUÉ ES UNA RUTA Y NO UNA COLUMNA
 * Las fotos viven en el mismo almacenamiento que las del stock, bajo
 * `solicitudes/{solicitudId}/`. No hay tabla ni columna nueva: la lista se lee
 * del propio almacenamiento. Así adjuntar fotos no exigió tocar la base ni sus
 * políticas.
 *
 * QUIÉN PUEDE QUÉ — esta ruta es el candado, porque el almacenamiento no tiene
 * políticas por usuario:
 *   · Subir: solo el dueño de la solicitud, y solo mientras está `pendiente`.
 *   · Ver:   el dueño, o un administrador (el portal las muestra al revisar).
 *   · Quitar: el dueño mientras está `pendiente`, o un administrador.
 * Que haya sesión no basta: cada operación comprueba con la base que la
 * solicitud sea de quien la pide.
 *
 * LÍMITES, porque aquí sube gente que no es del equipo:
 *   · La URL firmada vale para UN archivo del tipo y del tamaño exactos que se
 *     declararon (`firmarSubidaExacta`). No sirve para subir otra cosa.
 *   · Solo imágenes, hasta 10 MB cada una y 12 por solicitud.
 *   · La ruta del archivo la decide el servidor.
 *
 * OJO: el bucket es de lectura pública. Una foto subida se puede ver con su
 * URL, aunque la solicitud no se haya aprobado. La URL lleva dos UUID y no se
 * puede adivinar ni listar desde fuera, pero no es un archivo privado.
 *
 * Nunca lanza: todo error sale como JSON con `ok: false` y un mensaje en español.
 */

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/client";
import { getPublicStorageUrl } from "@/lib/db/storage";
import { verificarSesionCliente } from "@/lib/portal/authServer";
import {
  borrarObjeto,
  firmarSubidaExacta,
  isStorageWriteConfigured,
  listarObjetos,
} from "@/lib/portal/objectStorage";

/** Fotos por solicitud. Alcanza para exterior, interior, tablero y detalles. */
const FOTOS_MAXIMAS = 12;

/** Tope por foto. El formulario las comprime a menos de 1 MB antes de subir. */
const BYTES_MAXIMOS = 10 * 1024 * 1024;

const EXTENSION_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RE_UUID = new RegExp(`^${UUID}$`, "i");
const RE_ARCHIVO = new RegExp(`^${UUID}\\.(jpg|png|webp|heic)$`, "i");

const CARPETA = "solicitudes";

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

function carpetaDe(solicitudId: string): string {
  return `${CARPETA}/${solicitudId.toLowerCase()}/`;
}

type Acceso =
  | { ok: true; esDueno: boolean; esAdmin: boolean; pendiente: boolean }
  | { ok: false; respuesta: NextResponse };

/**
 * Sesión, almacenamiento y pertenencia de la solicitud, en ese orden. Una
 * solicitud ajena y una que no existe contestan lo mismo, a propósito: no se
 * le confirma a nadie qué identificadores existen.
 */
async function acceso(solicitudId: string): Promise<Acceso> {
  const sesion = await verificarSesionCliente();
  if (!sesion.ok) return { ok: false, respuesta: fallo(sesion.status, sesion.mensaje) };

  if (!RE_UUID.test(solicitudId)) {
    return { ok: false, respuesta: fallo(400, "Falta la solicitud a la que pertenecen las fotos.") };
  }
  if (!isStorageWriteConfigured()) {
    return { ok: false, respuesta: fallo(503, "El almacenamiento de fotos no está disponible.") };
  }

  const sql = getSql();
  if (!sql) return { ok: false, respuesta: fallo(503, "Las cuentas no están configuradas.") };

  try {
    const filas = await sql`
      select user_id, estado
      from public.solicitudes_venta
      where id = ${solicitudId}::uuid
      limit 1
    `;
    const fila = filas[0] as { user_id?: string; estado?: string } | undefined;
    const esDueno = Boolean(fila) && fila?.user_id === sesion.userId;
    if (!fila || (!esDueno && !sesion.esAdmin)) {
      return { ok: false, respuesta: fallo(404, "No encontramos esa solicitud.") };
    }
    return { ok: true, esDueno, esAdmin: sesion.esAdmin, pendiente: fila.estado === "pendiente" };
  } catch {
    return { ok: false, respuesta: fallo(500, "No se pudo comprobar la solicitud. Vuelve a intentarlo.") };
  }
}

async function leerCuerpo(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const cuerpo: unknown = await request.json();
    return cuerpo && typeof cuerpo === "object" ? (cuerpo as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const cuerpo = await leerCuerpo(request);
  const solicitudId = typeof cuerpo?.solicitudId === "string" ? cuerpo.solicitudId : "";
  const permiso = await acceso(solicitudId);
  if (!permiso.ok) return permiso.respuesta;

  if (!permiso.esDueno) return fallo(403, "Solo quien registró el auto puede adjuntar fotos.");
  if (!permiso.pendiente) {
    return fallo(409, "Esta solicitud ya fue revisada. Envíanos las fotos nuevas por WhatsApp.");
  }

  const contentType =
    typeof cuerpo?.contentType === "string" ? cuerpo.contentType.toLowerCase() : "";
  const bytes = typeof cuerpo?.bytes === "number" ? cuerpo.bytes : Number.NaN;
  const extension = EXTENSION_POR_TIPO[contentType];
  if (!extension) return fallo(400, "Solo se aceptan fotos JPEG, PNG, WebP o HEIC.");
  if (!Number.isInteger(bytes) || bytes <= 0) return fallo(400, "El archivo está vacío.");
  if (bytes > BYTES_MAXIMOS) return fallo(413, "La foto supera los 10 MB permitidos.");

  const existentes = await listarObjetos(carpetaDe(solicitudId));
  if (existentes === null) return fallo(503, "No se pudo preparar la subida. Vuelve a intentarlo.");
  if (existentes.length >= FOTOS_MAXIMAS) {
    return fallo(409, `Ya adjuntaste el máximo de ${FOTOS_MAXIMAS} fotos.`);
  }

  const path = `${carpetaDe(solicitudId)}${randomUUID()}.${extension}`;
  try {
    const url = await firmarSubidaExacta(path, contentType, bytes);
    if (!url) return fallo(503, "No se pudo preparar la subida.");
    return NextResponse.json({
      ok: true,
      path,
      url,
      // Tienen que ir tal cual: el tipo forma parte de la firma.
      headers: { "Content-Type": contentType },
      publicUrl: getPublicStorageUrl(path),
    });
  } catch {
    return fallo(500, "No se pudo preparar la subida. Vuelve a intentarlo.");
  }
}

export async function GET(request: Request) {
  const solicitudId = new URL(request.url).searchParams.get("solicitudId") ?? "";
  const permiso = await acceso(solicitudId);
  if (!permiso.ok) return permiso.respuesta;

  const objetos = await listarObjetos(carpetaDe(solicitudId));
  if (objetos === null) return fallo(503, "No se pudieron leer las fotos. Vuelve a intentarlo.");

  const fotos = objetos.flatMap((objeto) => {
    const url = getPublicStorageUrl(objeto.path);
    return url ? [{ path: objeto.path, url, bytes: objeto.bytes }] : [];
  });
  return NextResponse.json({ ok: true, fotos, maximo: FOTOS_MAXIMAS });
}

export async function DELETE(request: Request) {
  const cuerpo = await leerCuerpo(request);
  const solicitudId = typeof cuerpo?.solicitudId === "string" ? cuerpo.solicitudId : "";
  const permiso = await acceso(solicitudId);
  if (!permiso.ok) return permiso.respuesta;

  if (!permiso.esAdmin && !(permiso.esDueno && permiso.pendiente)) {
    return fallo(409, "Esta solicitud ya fue revisada y sus fotos no se pueden cambiar.");
  }

  // La ruta tiene que ser de ESTA solicitud: sin esta comprobación, quien es
  // dueño de una solicitud podría borrar las fotos de otra o del stock.
  const path = typeof cuerpo?.path === "string" ? cuerpo.path : "";
  const carpeta = carpetaDe(solicitudId);
  if (!path.startsWith(carpeta) || !RE_ARCHIVO.test(path.slice(carpeta.length))) {
    return fallo(400, "Esa foto no pertenece a la solicitud.");
  }

  const borrada = await borrarObjeto(path);
  if (!borrada) return fallo(502, "No se pudo quitar la foto. Vuelve a intentarlo.");
  return NextResponse.json({ ok: true });
}
