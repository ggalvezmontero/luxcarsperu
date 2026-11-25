/**
 * /api/cuenta/expedientes/comprobantes — comprobante de un depósito que el
 * CLIENTE declara desde su cuenta ("Ya transferí").
 *
 *   POST { expedienteId, contentType, bytes } → URL prefirmada (PUT exacto) para subir
 *                                              UN archivo al bucket PRIVADO `expedientes`
 *
 * El navegador sube el archivo directo al bucket y después llama a
 * `cliente_accion_expediente('declarar_deposito')` con el `path` que devuelve
 * esta ruta; la función SQL comprueba que el path sea de SU expediente.
 *
 * QUIÉN PUEDE QUÉ: solo el dueño del expediente (cliente vinculado a la cuenta
 * con `clientes.user_id`) y solo en un expediente activo. Un expediente ajeno y
 * uno que no existe contestan lo mismo, a propósito. Como en
 * `/api/cuenta/solicitudes/fotos`: la ruta es el candado porque el
 * almacenamiento no tiene políticas por usuario.
 *
 * LÍMITES: PDF o imagen (JPEG, PNG, WebP, HEIC), hasta 10 MB, firma exacta de
 * tipo y tamaño (`firmarSubidaExacta`). La ruta del objeto la decide el
 * servidor: `expedientes/{expedienteId}/comprobantes/{uuid}.{ext}`.
 *
 * Nunca lanza: todo error sale como JSON con `ok: false` y un mensaje en español.
 */

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/client";
import { esUuid } from "@/lib/expedientes/servidor/contexto";
import { verificarSesionCliente } from "@/lib/portal/authServer";
import { EXPEDIENTES_BUCKET, firmarSubidaExacta, isStorageWriteConfigured } from "@/lib/portal/objectStorage";

/** Tope por comprobante. Una captura o un PDF del banco pesan mucho menos. */
const BYTES_MAXIMOS_COMPROBANTE = 10 * 1024 * 1024;

const EXTENSION_POR_TIPO: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

export async function POST(request: Request) {
  const sesion = await verificarSesionCliente();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  if (!isStorageWriteConfigured()) return fallo(503, "Los comprobantes no se pueden adjuntar por ahora. Envíanoslo por WhatsApp.");
  const sql = getSql();
  if (!sql) return fallo(503, "Las cuentas no están configuradas.");

  let cuerpo: Record<string, unknown> = {};
  try {
    const json: unknown = await request.json();
    if (json && typeof json === "object") cuerpo = json as Record<string, unknown>;
  } catch {
    return fallo(400, "El cuerpo de la petición no es JSON.");
  }

  const expedienteId = typeof cuerpo.expedienteId === "string" ? cuerpo.expedienteId.toLowerCase() : "";
  if (!esUuid(expedienteId)) return fallo(400, "Falta el expediente.");

  const contentType = typeof cuerpo.contentType === "string" ? cuerpo.contentType.toLowerCase() : "";
  const bytes = typeof cuerpo.bytes === "number" ? cuerpo.bytes : Number.NaN;
  const extension = EXTENSION_POR_TIPO[contentType];
  if (!extension) return fallo(400, "El comprobante tiene que ser un PDF o una imagen (JPEG, PNG, WebP o HEIC).");
  if (!Number.isInteger(bytes) || bytes <= 0) return fallo(400, "El archivo está vacío.");
  if (bytes > BYTES_MAXIMOS_COMPROBANTE) return fallo(413, "El comprobante supera los 10 MB permitidos.");

  try {
    const filas = (await sql`
      select e.id
      from public.expedientes e
      join public.clientes c on c.id = e.cliente_id
      where e.id = ${expedienteId}::uuid
        and e.etapa not in ('prospecto', 'cerrado', 'cancelado')
        and c.user_id = ${sesion.userId}::uuid
      limit 1
    `) as unknown as { id: string }[];
    if (!filas[0]) return fallo(404, "No encontramos ese expediente en tu cuenta.");
  } catch {
    return fallo(500, "No se pudo comprobar el expediente. Vuelve a intentarlo.");
  }

  const path = `expedientes/${expedienteId}/comprobantes/${randomUUID()}.${extension}`;
  try {
    const url = await firmarSubidaExacta(path, contentType, bytes, EXPEDIENTES_BUCKET);
    if (!url) return fallo(503, "No se pudo preparar la subida.");
    // Las cabeceras tienen que ir tal cual: el tipo forma parte de la firma.
    return NextResponse.json({ ok: true, path, url, headers: { "Content-Type": contentType } });
  } catch {
    return fallo(500, "No se pudo preparar la subida. Vuelve a intentarlo.");
  }
}
