/**
 * /api/portal/expedientes/archivos?documento=…&formato=pdf|docx|firmado
 *
 * Descarga de un archivo del bucket PRIVADO `expedientes` para el EQUIPO:
 * comprueba sesión y rol admin, lee la ruta del objeto con `DATABASE_URL` y
 * redirige a una URL firmada de cinco minutos. La ruta del objeto nunca sale
 * al navegador; la URL firmada vence sola.
 */

import { NextResponse } from "next/server";

import { nombreArchivo } from "@/core/expedientes/documentos";
import type { TipoDocumento } from "@/core/expedientes/tipos";
import { getSql } from "@/lib/db/client";
import { esUuid } from "@/lib/expedientes/servidor/contexto";
import { verificarSesionPortal } from "@/lib/portal/authServer";
import { EXPEDIENTES_BUCKET, firmarDescarga, isStorageWriteConfigured } from "@/lib/portal/objectStorage";

type Fila = {
  id: string;
  tipo: string;
  version: number;
  ruta_pdf: string | null;
  ruta_docx: string | null;
  ruta_firmado: string | null;
  codigo: string;
};

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

export async function GET(request: Request) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  if (!isStorageWriteConfigured()) return fallo(503, "El almacenamiento de documentos no está configurado.");
  const sql = getSql();
  if (!sql) return fallo(503, "Falta DATABASE_URL en el servidor.");

  const url = new URL(request.url);
  const documentoId = url.searchParams.get("documento") ?? "";
  const formato = url.searchParams.get("formato") ?? "pdf";
  if (!esUuid(documentoId)) return fallo(400, "Falta el documento.");
  if (formato !== "pdf" && formato !== "docx" && formato !== "firmado") return fallo(400, "Formato desconocido.");

  let fila: Fila | undefined;
  try {
    const filas = (await sql`
      select d.id, d.tipo, d.version, d.ruta_pdf, d.ruta_docx, d.ruta_firmado, e.codigo
      from public.expediente_documentos d
      join public.expedientes e on e.id = d.expediente_id
      where d.id = ${documentoId}::uuid
      limit 1
    `) as unknown as Fila[];
    fila = filas[0];
  } catch {
    return fallo(500, "No se pudo leer el documento.");
  }
  if (!fila) return fallo(404, "El documento no existe.");

  const ruta = formato === "pdf" ? fila.ruta_pdf : formato === "docx" ? fila.ruta_docx : fila.ruta_firmado;
  if (!ruta) return fallo(404, "Este documento no tiene ese archivo.");

  const extension = formato === "docx" ? "docx" : "pdf";
  const base = nombreArchivo(fila.codigo, fila.tipo as TipoDocumento, fila.version, extension);
  const nombre = formato === "firmado" ? base.replace(/\.pdf$/, "-firmado.pdf") : base;
  const firmada = await firmarDescarga(EXPEDIENTES_BUCKET, ruta, 300, nombre);
  if (!firmada) return fallo(503, "No se pudo firmar la descarga.");

  return NextResponse.redirect(firmada, { status: 302, headers: { "Cache-Control": "no-store" } });
}
