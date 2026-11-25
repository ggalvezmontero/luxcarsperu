/**
 * /api/cuenta/expedientes/archivos?documento=…
 *
 * Descarga de un documento de SU expediente para el CLIENTE. Comprueba la
 * sesión (`verificarSesionCliente`), que el expediente sea de un cliente
 * vinculado a esa cuenta y que el documento esté marcado visible; recién
 * entonces firma una URL de cinco minutos y redirige. Si hay firmado, baja el
 * firmado; si no, el PDF emitido. Un documento ajeno y uno que no existe
 * contestan lo mismo, a propósito.
 */

import { NextResponse } from "next/server";

import { nombreArchivo } from "@/core/expedientes/documentos";
import type { TipoDocumento } from "@/core/expedientes/tipos";
import { getSql } from "@/lib/db/client";
import { esUuid } from "@/lib/expedientes/servidor/contexto";
import { verificarSesionCliente } from "@/lib/portal/authServer";
import { EXPEDIENTES_BUCKET, firmarDescarga, isStorageWriteConfigured } from "@/lib/portal/objectStorage";

type Fila = {
  id: string;
  tipo: string;
  version: number;
  ruta_pdf: string | null;
  ruta_firmado: string | null;
  codigo: string;
};

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

export async function GET(request: Request) {
  const sesion = await verificarSesionCliente();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  if (!isStorageWriteConfigured()) return fallo(503, "Los documentos no están disponibles por ahora.");
  const sql = getSql();
  if (!sql) return fallo(503, "Las cuentas no están configuradas.");

  const documentoId = new URL(request.url).searchParams.get("documento") ?? "";
  if (!esUuid(documentoId)) return fallo(400, "Falta el documento.");

  let fila: Fila | undefined;
  try {
    const filas = (await sql`
      select d.id, d.tipo, d.version, d.ruta_pdf, d.ruta_firmado, e.codigo
      from public.expediente_documentos d
      join public.expedientes e on e.id = d.expediente_id
      join public.clientes c on c.id = e.cliente_id
      where d.id = ${documentoId}::uuid
        and d.visible_cliente
        and d.estado <> 'borrador'
        and e.etapa <> 'prospecto'
        and c.user_id = ${sesion.userId}::uuid
      limit 1
    `) as unknown as Fila[];
    fila = filas[0];
  } catch {
    return fallo(500, "No se pudo leer el documento. Vuelve a intentarlo.");
  }
  if (!fila) return fallo(404, "No encontramos ese documento en tu cuenta.");

  const ruta = fila.ruta_firmado ?? fila.ruta_pdf;
  if (!ruta) return fallo(404, "Este documento todavía no tiene archivo.");

  const nombre = nombreArchivo(fila.codigo, fila.tipo as TipoDocumento, fila.version, "pdf").replace(
    /\.pdf$/,
    fila.ruta_firmado ? "-firmado.pdf" : ".pdf",
  );
  const firmada = await firmarDescarga(EXPEDIENTES_BUCKET, ruta, 300, nombre);
  if (!firmada) return fallo(503, "No se pudo preparar la descarga.");

  return NextResponse.redirect(firmada, { status: 302, headers: { "Cache-Control": "no-store" } });
}
