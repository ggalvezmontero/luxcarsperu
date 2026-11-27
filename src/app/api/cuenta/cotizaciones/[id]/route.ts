/**
 * /api/cuenta/cotizaciones/[id] — el CLIENTE baja el PDF de su cotización.
 *
 * Comprueba la sesión (`verificarSesionCliente`) y que la cotización sea suya
 * con la misma regla que la vista `cotizacion_cliente`: enviada (no borrador),
 * con PDF, y de una ficha de cliente vinculada a su cuenta o dirigida al
 * correo verificado de su cuenta. Luego firma una URL de cinco minutos. Una
 * cotización ajena y una que no existe contestan lo mismo, a propósito.
 */

import { NextResponse } from "next/server";

import { nombreArchivoCotizacion } from "@/core/cotizaciones";
import { getSql } from "@/lib/db/client";
import { esUuid } from "@/lib/expedientes/servidor/contexto";
import { verificarSesionCliente } from "@/lib/portal/authServer";
import { EXPEDIENTES_BUCKET, firmarDescarga, isStorageWriteConfigured } from "@/lib/portal/objectStorage";

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await verificarSesionCliente();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  if (!isStorageWriteConfigured()) return fallo(503, "Los documentos no están disponibles por ahora.");
  const sql = getSql();
  if (!sql) return fallo(503, "Las cuentas no están configuradas.");
  const { id } = await params;
  if (!esUuid(id)) return fallo(400, "Falta la cotización.");

  let fila: { codigo: string; ruta_pdf: string; documento_version: number } | undefined;
  try {
    const filas = (await sql`
      select q.codigo, q.ruta_pdf, q.documento_version
      from public.cotizaciones q
      where q.id = ${id}::uuid
        and q.estado <> 'borrador'
        and q.ruta_pdf is not null
        and (
          q.cliente_id in (select c.id from public.clientes c where c.user_id = ${sesion.userId}::uuid)
          or (q.cliente_email is not null
              and lower(q.cliente_email) = (select lower(p.email) from public.profiles p where p.id = ${sesion.userId}::uuid))
        )
      limit 1
    `) as unknown as { codigo: string; ruta_pdf: string; documento_version: number }[];
    fila = filas[0];
  } catch {
    return fallo(500, "No se pudo leer la cotización. Vuelve a intentarlo.");
  }
  if (!fila) return fallo(404, "No encontramos esa cotización en tu cuenta.");

  const firmada = await firmarDescarga(EXPEDIENTES_BUCKET, fila.ruta_pdf, 300, nombreArchivoCotizacion(fila.codigo, fila.documento_version, "pdf"));
  if (!firmada) return fallo(503, "No se pudo preparar la descarga.");
  return NextResponse.redirect(firmada, { status: 302, headers: { "Cache-Control": "no-store" } });
}
