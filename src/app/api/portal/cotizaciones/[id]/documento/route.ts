/**
 * /api/portal/cotizaciones/[id]/documento — PDF y DOCX de una cotización.
 *
 *   POST               → arma el documento con `src/core/cotizaciones` desde
 *                        lo guardado, renderiza PDF y DOCX con el formato
 *                        legal de Luxcars y los sube al bucket PRIVADO
 *                        `expedientes` (carpeta cotizaciones/<id>/). Responde
 *                        { ok, version }.
 *   GET ?formato=pdf|docx → redirige a una URL firmada de cinco minutos.
 *
 * Ruta de servidor porque generar un PDF y escribir en el bucket exige la
 * credencial `storage:write`, que nunca viaja al navegador. Comprueba sesión y
 * rol admin (`verificarSesionPortal`) antes de leer con `DATABASE_URL`.
 * Nunca lanza: todo error sale como JSON con `ok: false`.
 */

import { NextResponse } from "next/server";

import { nombreArchivoCotizacion } from "@/core/cotizaciones";
import { getSql } from "@/lib/db/client";
import { leerCotizacion, estructuraDe } from "@/lib/cotizaciones/servidor";
import { renderDocx } from "@/lib/expedientes/documentos/renderDocx";
import { renderPdf } from "@/lib/expedientes/documentos/renderPdf";
import { esUuid } from "@/lib/expedientes/servidor/contexto";
import { verificarSesionPortal } from "@/lib/portal/authServer";
import { EXPEDIENTES_BUCKET, firmarDescarga, getStorageWriteMissingEnv, isStorageWriteConfigured, subirObjeto } from "@/lib/portal/objectStorage";

const TIPO_PDF = "application/pdf";
const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

type Contexto = { params: Promise<{ id: string }> };

/** Hoy en Lima, ISO. */
function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

export async function POST(_request: Request, { params }: Contexto) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  if (!isStorageWriteConfigured()) {
    return fallo(503, `El almacenamiento de documentos no está configurado: falta ${getStorageWriteMissingEnv().join(", ")}.`);
  }
  const sql = getSql();
  if (!sql) return fallo(503, "Falta DATABASE_URL en el servidor.");
  const { id } = await params;
  if (!esUuid(id)) return fallo(400, "Cotización inválida.");

  let fila;
  try {
    fila = await leerCotizacion(id);
  } catch {
    return fallo(500, "No se pudo leer la cotización. Vuelve a intentarlo.");
  }
  if (!fila) return fallo(404, "La cotización no existe.");
  if (fila.estado === "aceptada") return fallo(409, "La cotización ya fue aceptada: su PDF queda como se envió.");

  // En borrador la fecha es la de hoy (al enviarla se fija); enviada, la de su emisión.
  const fecha = fila.estado === "borrador" ? hoyLima() : fila.fecha;
  let pdf: Uint8Array;
  let docx: Uint8Array;
  try {
    const estructura = estructuraDe(fila, fecha);
    [pdf, docx] = await Promise.all([renderPdf(estructura), renderDocx(estructura)]);
  } catch (error) {
    console.error("[cotizaciones/documento] render", error);
    return fallo(422, error instanceof Error ? error.message : "No se pudo armar el documento.");
  }

  const version = fila.documento_version + 1;
  const carpeta = `cotizaciones/${id}`;
  const rutaPdf = `${carpeta}/${fila.codigo}-v${version}.pdf`;
  const rutaDocx = `${carpeta}/${fila.codigo}-v${version}.docx`;
  const [okPdf, okDocx] = await Promise.all([
    subirObjeto(EXPEDIENTES_BUCKET, rutaPdf, pdf, TIPO_PDF),
    subirObjeto(EXPEDIENTES_BUCKET, rutaDocx, docx, TIPO_DOCX),
  ]);
  if (!okPdf || !okDocx) return fallo(502, "No se pudo guardar el documento en el almacenamiento.");

  try {
    await sql`
      update public.cotizaciones
         set ruta_pdf = ${rutaPdf}, ruta_docx = ${rutaDocx}, documento_version = ${version},
             documento_generado_en = now(),
             fecha = case when estado = 'borrador' then ${fecha}::date else fecha end
       where id = ${id}::uuid
    `;
  } catch {
    return fallo(500, "El documento se generó pero no se pudo registrar. Vuelve a intentarlo.");
  }
  return NextResponse.json({ ok: true, version, bytes: pdf.byteLength });
}

export async function GET(request: Request, { params }: Contexto) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  if (!isStorageWriteConfigured()) return fallo(503, "El almacenamiento de documentos no está configurado.");
  const { id } = await params;
  if (!esUuid(id)) return fallo(400, "Cotización inválida.");
  const formato = new URL(request.url).searchParams.get("formato") ?? "pdf";
  if (formato !== "pdf" && formato !== "docx") return fallo(400, "Formato desconocido.");

  let fila;
  try {
    fila = await leerCotizacion(id);
  } catch {
    return fallo(500, "No se pudo leer la cotización.");
  }
  if (!fila) return fallo(404, "La cotización no existe.");
  const ruta = formato === "pdf" ? fila.ruta_pdf : fila.ruta_docx;
  if (!ruta) return fallo(404, "Todavía no se generó el documento.");
  const firmada = await firmarDescarga(EXPEDIENTES_BUCKET, ruta, 300, nombreArchivoCotizacion(fila.codigo, fila.documento_version, formato));
  if (!firmada) return fallo(503, "No se pudo firmar la descarga.");
  return NextResponse.redirect(firmada, { status: 302, headers: { "Cache-Control": "no-store" } });
}
