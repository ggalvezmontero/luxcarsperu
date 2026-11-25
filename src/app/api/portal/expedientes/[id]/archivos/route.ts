/**
 * /api/portal/expedientes/[id]/archivos — el PDF FIRMADO de un documento, o el
 * COMPROBANTE de un movimiento del libro (`destino: "comprobante"`).
 *
 *   POST  { documentoId, contentType, bytes } → URL prefirmada (PUT exacto) para subir
 *                                              el firmado al bucket privado
 *   PATCH { documentoId, firmadoEn? }         → comprueba que el objeto existe y
 *                                              registra `estado = firmado`
 *   POST  { destino: "comprobante", movimientoId, contentType, bytes }
 *                                             → URL prefirmada para el comprobante
 *                                               (PDF o imagen, hasta 10 MB) en
 *                                               expedientes/{id}/comprobantes/{movimientoId}.{ext}
 *   PATCH { destino: "comprobante", movimientoId, contentType }
 *                                             → comprueba el objeto y guarda `comprobante_path`
 *
 * La RUTA del objeto la decide el servidor: `expedientes/{expedienteId}/firmados/
 * {documentoId}.pdf`. La URL de subida es EXACTA (tipo y tamaño en la firma,
 * como `firmarSubidaExacta` para las fotos de los clientes): no sirve para
 * subir otra cosa. El archivo no pasa por acá: sube directo del navegador al
 * bucket, y recién después el PATCH lo registra (y antes verifica con un HEAD
 * que esté ahí).
 *
 * Nunca lanza: todo error sale como JSON con `ok: false` y un mensaje en español.
 */

import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/client";
import { esUuid } from "@/lib/expedientes/servidor/contexto";
import { verificarSesionPortal } from "@/lib/portal/authServer";
import {
  EXPEDIENTES_BUCKET,
  existeObjeto,
  firmarSubidaExacta,
  getStorageWriteMissingEnv,
  isStorageWriteConfigured,
} from "@/lib/portal/objectStorage";

/** Tope del firmado. Un contrato escaneado a color entra de sobra. */
const BYTES_MAXIMOS = 15 * 1024 * 1024;
const TIPO_PDF = "application/pdf";

/** Comprobantes de pagos y depósitos: PDF o imagen, hasta 10 MB. */
const BYTES_MAXIMOS_COMPROBANTE = 10 * 1024 * 1024;
const EXTENSION_COMPROBANTE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

type Contexto = { params: Promise<{ id: string }> };

async function leerCuerpo(request: Request): Promise<Record<string, unknown>> {
  try {
    const json: unknown = await request.json();
    return json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

type Documento = { id: string; expediente_id: string; estado: string; ruta_firmado: string | null };

/** Sesión, almacenamiento, expediente y documento, en ese orden. */
async function acceso(expedienteId: string, documentoId: string) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return { ok: false as const, respuesta: fallo(sesion.status, sesion.mensaje) };
  if (!isStorageWriteConfigured()) {
    return { ok: false as const, respuesta: fallo(503, `El almacenamiento no está configurado: falta ${getStorageWriteMissingEnv().join(", ")}.`) };
  }
  const sql = getSql();
  if (!sql) return { ok: false as const, respuesta: fallo(503, "Falta DATABASE_URL en el servidor.") };
  if (!esUuid(expedienteId) || !esUuid(documentoId)) return { ok: false as const, respuesta: fallo(400, "Falta el documento.") };

  try {
    const filas = (await sql`
      select id, expediente_id, estado, ruta_firmado
      from public.expediente_documentos
      where id = ${documentoId}::uuid and expediente_id = ${expedienteId}::uuid
      limit 1
    `) as unknown as Documento[];
    const doc = filas[0];
    if (!doc) return { ok: false as const, respuesta: fallo(404, "Ese documento no pertenece al expediente.") };
    if (doc.estado === "reemplazado" || doc.estado === "anulado") {
      return { ok: false as const, respuesta: fallo(409, "Este documento fue reemplazado: sube el firmado sobre la versión vigente.") };
    }
    return { ok: true as const, sql, userId: sesion.userId, doc };
  } catch {
    return { ok: false as const, respuesta: fallo(500, "No se pudo comprobar el documento. Vuelve a intentarlo.") };
  }
}

function rutaFirmado(expedienteId: string, documentoId: string): string {
  return `expedientes/${expedienteId.toLowerCase()}/firmados/${documentoId.toLowerCase()}.pdf`;
}

/* -------------------------------------------------------------------------- */
/* Comprobantes de movimientos                                                */
/* -------------------------------------------------------------------------- */

type Movimiento = { id: string; expediente_id: string; estado: string };

async function accesoMovimiento(expedienteId: string, movimientoId: string) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return { ok: false as const, respuesta: fallo(sesion.status, sesion.mensaje) };
  if (!isStorageWriteConfigured()) {
    return { ok: false as const, respuesta: fallo(503, `El almacenamiento no está configurado: falta ${getStorageWriteMissingEnv().join(", ")}.`) };
  }
  const sql = getSql();
  if (!sql) return { ok: false as const, respuesta: fallo(503, "Falta DATABASE_URL en el servidor.") };
  if (!esUuid(expedienteId) || !esUuid(movimientoId)) return { ok: false as const, respuesta: fallo(400, "Falta el movimiento.") };
  try {
    const filas = (await sql`
      select id, expediente_id, estado from public.expediente_movimientos
      where id = ${movimientoId}::uuid and expediente_id = ${expedienteId}::uuid limit 1
    `) as unknown as Movimiento[];
    const mov = filas[0];
    if (!mov) return { ok: false as const, respuesta: fallo(404, "Ese movimiento no pertenece al expediente.") };
    if (mov.estado === "anulado") return { ok: false as const, respuesta: fallo(409, "El movimiento está anulado.") };
    return { ok: true as const, sql, mov };
  } catch {
    return { ok: false as const, respuesta: fallo(500, "No se pudo comprobar el movimiento. Vuelve a intentarlo.") };
  }
}

function rutaComprobante(expedienteId: string, movimientoId: string, extension: string): string {
  return `expedientes/${expedienteId.toLowerCase()}/comprobantes/${movimientoId.toLowerCase()}.${extension}`;
}

async function subirComprobante(id: string, cuerpo: Record<string, unknown>) {
  const movimientoId = typeof cuerpo.movimientoId === "string" ? cuerpo.movimientoId : "";
  const permiso = await accesoMovimiento(id, movimientoId);
  if (!permiso.ok) return permiso.respuesta;
  const contentType = typeof cuerpo.contentType === "string" ? cuerpo.contentType.toLowerCase() : "";
  const bytes = typeof cuerpo.bytes === "number" ? cuerpo.bytes : Number.NaN;
  const extension = EXTENSION_COMPROBANTE[contentType];
  if (!extension) return fallo(400, "El comprobante tiene que ser un PDF o una imagen (JPEG, PNG, WebP o HEIC).");
  if (!Number.isInteger(bytes) || bytes <= 0) return fallo(400, "El archivo está vacío.");
  if (bytes > BYTES_MAXIMOS_COMPROBANTE) return fallo(413, "El comprobante supera los 10 MB permitidos.");
  const path = rutaComprobante(id, movimientoId, extension);
  try {
    const url = await firmarSubidaExacta(path, contentType, bytes, EXPEDIENTES_BUCKET);
    if (!url) return fallo(503, "No se pudo preparar la subida.");
    return NextResponse.json({ ok: true, path, url, headers: { "Content-Type": contentType } });
  } catch {
    return fallo(500, "No se pudo preparar la subida. Vuelve a intentarlo.");
  }
}

async function registrarComprobante(id: string, cuerpo: Record<string, unknown>) {
  const movimientoId = typeof cuerpo.movimientoId === "string" ? cuerpo.movimientoId : "";
  const permiso = await accesoMovimiento(id, movimientoId);
  if (!permiso.ok) return permiso.respuesta;
  const contentType = typeof cuerpo.contentType === "string" ? cuerpo.contentType.toLowerCase() : "";
  const extension = EXTENSION_COMPROBANTE[contentType];
  if (!extension) return fallo(400, "Falta el tipo del archivo subido.");
  const path = rutaComprobante(id, movimientoId, extension);
  const existe = await existeObjeto(EXPEDIENTES_BUCKET, path);
  if (existe === null) return fallo(503, "No se pudo comprobar el archivo en el almacenamiento.");
  if (!existe) return fallo(409, "El comprobante todavía no está en el almacenamiento. Vuelve a subirlo.");
  try {
    await permiso.sql`update public.expediente_movimientos set comprobante_path = ${path} where id = ${movimientoId}::uuid`;
    return NextResponse.json({ ok: true, path });
  } catch {
    return fallo(500, "No se pudo registrar el comprobante.");
  }
}

/* -------------------------------------------------------------------------- */

export async function POST(request: Request, { params }: Contexto) {
  const { id } = await params;
  const cuerpo = await leerCuerpo(request);
  if (cuerpo.destino === "comprobante") return subirComprobante(id, cuerpo);
  const documentoId = typeof cuerpo.documentoId === "string" ? cuerpo.documentoId : "";
  const permiso = await acceso(id, documentoId);
  if (!permiso.ok) return permiso.respuesta;

  const contentType = typeof cuerpo.contentType === "string" ? cuerpo.contentType.toLowerCase() : "";
  const bytes = typeof cuerpo.bytes === "number" ? cuerpo.bytes : Number.NaN;
  if (contentType !== TIPO_PDF) return fallo(400, "El firmado tiene que ser un PDF.");
  if (!Number.isInteger(bytes) || bytes <= 0) return fallo(400, "El archivo está vacío.");
  if (bytes > BYTES_MAXIMOS) return fallo(413, "El PDF supera los 15 MB permitidos.");

  const path = rutaFirmado(id, documentoId);
  try {
    const url = await firmarSubidaExacta(path, TIPO_PDF, bytes, EXPEDIENTES_BUCKET);
    if (!url) return fallo(503, "No se pudo preparar la subida.");
    return NextResponse.json({ ok: true, path, url, headers: { "Content-Type": TIPO_PDF } });
  } catch {
    return fallo(500, "No se pudo preparar la subida. Vuelve a intentarlo.");
  }
}

export async function PATCH(request: Request, { params }: Contexto) {
  const { id } = await params;
  const cuerpo = await leerCuerpo(request);
  if (cuerpo.destino === "comprobante") return registrarComprobante(id, cuerpo);
  const documentoId = typeof cuerpo.documentoId === "string" ? cuerpo.documentoId : "";
  const permiso = await acceso(id, documentoId);
  if (!permiso.ok) return permiso.respuesta;

  const path = rutaFirmado(id, documentoId);
  const existe = await existeObjeto(EXPEDIENTES_BUCKET, path);
  if (existe === null) return fallo(503, "No se pudo comprobar el archivo en el almacenamiento.");
  if (!existe) return fallo(409, "El archivo firmado todavía no está en el almacenamiento. Vuelve a subirlo.");

  const firmadoEn = typeof cuerpo.firmadoEn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cuerpo.firmadoEn) ? cuerpo.firmadoEn : null;
  try {
    await permiso.sql`
      select public.marcar_documento_firmado(${documentoId}::uuid, ${path}, ${firmadoEn}::date, ${permiso.userId}::uuid)
    `;
    return NextResponse.json({ ok: true, path });
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    return fallo(500, /[áéíóúñ]|documento|administrador/i.test(m) ? m : "No se pudo registrar el firmado.");
  }
}
