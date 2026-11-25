/**
 * /api/portal/expedientes/[id]/documentos — generar documentos del expediente.
 *
 *   GET                         → { fijos }: datos fijos de Luxcars para la vista previa
 *   POST { tipo, extra?, visibleCliente? } → construye el documento desde su plantilla,
 *                                 renderiza PDF y DOCX, los sube al bucket PRIVADO
 *                                 `expedientes`, registra la versión y responde
 *                                 { documentoId, version, urls } (URLs firmadas de 5 min).
 *
 * POR QUÉ ES UNA RUTA DE SERVIDOR. Generar un PDF no se puede hacer desde el
 * navegador, y escribir en el bucket exige la credencial `storage:write`, que
 * nunca viaja al cliente. La ruta comprueba sesión Y rol admin
 * (`verificarSesionPortal`) y recién entonces lee el expediente con
 * `DATABASE_URL`: mismo patrón que `/api/portal/fotos`.
 *
 * LA REGLA (texto, campos, qué falta) ES DEL CORE. Acá solo se orquesta:
 * cargar → construir → 422 si faltan campos no manuales → renderizar → subir →
 * `registrar_documento` (versión siguiente, anterior reemplazada, evento,
 * tarea). Solo esta ruta importa `@react-pdf/renderer` y `docx`.
 *
 * Nunca lanza: todo error sale como JSON con `ok: false` y un mensaje en español.
 */

import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import type { CamposExtra } from "@/core/expedientes/campos";
import { esCampo } from "@/core/expedientes/campos";
import { construirDocumento, nombreArchivo, plantillaDe } from "@/core/expedientes/documentos";
import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/core/expedientes/tipos";
import { getSql } from "@/lib/db/client";
import { renderDocx } from "@/lib/expedientes/documentos/renderDocx";
import { renderPdf } from "@/lib/expedientes/documentos/renderPdf";
import { cargarContextoServidor, esUuid } from "@/lib/expedientes/servidor/contexto";
import { camposFijosLuxcars } from "@/lib/expedientes/servidor/datosFijos";
import { verificarSesionPortal } from "@/lib/portal/authServer";
import {
  EXPEDIENTES_BUCKET,
  firmarDescarga,
  getStorageWriteMissingEnv,
  isStorageWriteConfigured,
  subirObjeto,
} from "@/lib/portal/objectStorage";

const TIPO_PDF = "application/pdf";
const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fallo(status: number, mensaje: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, mensaje, ...extra }, { status });
}

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  const { id } = await params;
  if (!esUuid(id)) return fallo(400, "Expediente inválido.");
  return NextResponse.json({ ok: true, fijos: camposFijosLuxcars() });
}

export async function POST(request: Request, { params }: Contexto) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);

  if (!isStorageWriteConfigured()) {
    return fallo(503, `El almacenamiento de documentos no está configurado: falta ${getStorageWriteMissingEnv().join(", ")}.`);
  }
  const sql = getSql();
  if (!sql) return fallo(503, "Falta DATABASE_URL en el servidor.");

  const { id } = await params;
  if (!esUuid(id)) return fallo(400, "Expediente inválido.");

  let cuerpo: Record<string, unknown> = {};
  try {
    const json: unknown = await request.json();
    if (json && typeof json === "object") cuerpo = json as Record<string, unknown>;
  } catch {
    return fallo(400, "El cuerpo de la petición no es JSON.");
  }

  const tipo = typeof cuerpo.tipo === "string" && (TIPOS_DOCUMENTO as readonly string[]).includes(cuerpo.tipo) ? (cuerpo.tipo as TipoDocumento) : null;
  const plantilla = tipo ? plantillaDe(tipo) : null;
  if (!tipo || !plantilla) return fallo(400, "Ese tipo de documento no se genera desde una plantilla.");

  // Lo escrito a mano en el formulario, solo nombres de campo válidos y texto.
  const extra: CamposExtra = { ...camposFijosLuxcars() };
  if (cuerpo.extra && typeof cuerpo.extra === "object") {
    for (const [k, v] of Object.entries(cuerpo.extra as Record<string, unknown>)) {
      if (esCampo(k) && typeof v === "string" && v.trim()) extra[k] = v.trim().slice(0, 500);
    }
  }
  const visibleCliente = cuerpo.visibleCliente === true;

  let ctx;
  try {
    ctx = await cargarContextoServidor(id);
  } catch {
    return fallo(500, "No se pudo leer el expediente. Vuelve a intentarlo.");
  }
  if (!ctx) return fallo(404, "El expediente no existe.");

  const doc = construirDocumento(plantilla, ctx, extra);
  if (doc.faltantes.length > 0) {
    return fallo(422, `Faltan datos para emitir este documento: ${doc.faltantes.join(", ")}.`, { faltantes: doc.faltantes });
  }

  // Versión siguiente: la misma cuenta que hará la función SQL. Si dos
  // administradores generan a la vez, la restricción única rechaza al segundo.
  const [{ siguiente }] = (await sql`
    select coalesce(max(version), 0) + 1 as siguiente
    from public.expediente_documentos
    where expediente_id = ${id}::uuid and tipo = ${tipo}::public.documento_tipo
  `) as unknown as { siguiente: number }[];
  const version = Number(siguiente) || 1;
  const documentoId = randomUUID();
  const carpeta = `expedientes/${id}/documentos`;
  const rutaPdf = `${carpeta}/${documentoId}-v${version}.pdf`;
  const rutaDocx = `${carpeta}/${documentoId}-v${version}.docx`;

  let pdf: Uint8Array;
  let docx: Uint8Array;
  try {
    [pdf, docx] = await Promise.all([renderPdf(doc.estructura), renderDocx(doc.estructura)]);
  } catch (error) {
    console.error("[expedientes/documentos] render", error);
    return fallo(500, "No se pudo construir el archivo del documento.");
  }

  const [subioPdf, subioDocx] = await Promise.all([
    subirObjeto(EXPEDIENTES_BUCKET, rutaPdf, pdf, TIPO_PDF),
    subirObjeto(EXPEDIENTES_BUCKET, rutaDocx, docx, TIPO_DOCX),
  ]);
  if (!subioPdf || !subioDocx) return fallo(502, "El almacenamiento no aceptó el archivo. Vuelve a intentarlo.");

  let registrado: { id: string; version: number };
  try {
    const [fila] = (await sql`
      select public.registrar_documento(
        ${id}::uuid,
        ${tipo}::public.documento_tipo,
        ${`${plantilla.nombre} · ${ctx.expediente.codigo}`},
        ${plantilla.version},
        ${JSON.stringify(doc.campos)}::jsonb,
        ${rutaPdf},
        ${rutaDocx},
        ${plantilla.tarea ?? null},
        ${sesion.userId}::uuid,
        ${visibleCliente}
      ) as r
    `) as unknown as { r: { id: string; version: number } }[];
    registrado = fila.r;
  } catch (error) {
    console.error("[expedientes/documentos] registrar", error);
    const m = error instanceof Error ? error.message : "";
    return fallo(500, /[áéíóúñ]|administrador|expediente/i.test(m) ? m : "El archivo se generó pero no se pudo registrar.");
  }

  // La fila guarda la ruta con el id que ya se usó en el nombre del objeto; si
  // la función asignó otra versión (carrera), el objeto queda huérfano pero la
  // fila es la verdad: se usa la ruta registrada.
  if (registrado.version !== version) {
    await sql`
      update public.expediente_documentos
         set ruta_pdf = ${rutaPdf}, ruta_docx = ${rutaDocx}
       where id = ${registrado.id}::uuid
    `;
  }

  const nombrePdf = nombreArchivo(ctx.expediente.codigo, tipo, registrado.version, "pdf");
  const nombreDocx = nombreArchivo(ctx.expediente.codigo, tipo, registrado.version, "docx");
  const [urlPdf, urlDocx] = await Promise.all([
    firmarDescarga(EXPEDIENTES_BUCKET, rutaPdf, 300, nombrePdf),
    firmarDescarga(EXPEDIENTES_BUCKET, rutaDocx, 300, nombreDocx),
  ]);

  return NextResponse.json({
    ok: true,
    documentoId: registrado.id,
    version: registrado.version,
    manualesVacios: doc.manualesVacios,
    bytes: { pdf: pdf.byteLength, docx: docx.byteLength },
    urls: { pdf: urlPdf, docx: urlDocx },
  });
}
