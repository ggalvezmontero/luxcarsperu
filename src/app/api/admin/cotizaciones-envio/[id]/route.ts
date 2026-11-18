/**
 * /api/admin/cotizaciones-envio/[id]
 *
 *   GET              → la cotización completa (entrada y resultado), para reabrirla
 *   PATCH { estado } → cambia el estado: borrador, enviada o aceptada
 *
 * Mismas reglas que la ruta padre: solo administradores, nunca lanza.
 */

import { NextResponse } from "next/server";

import {
  ESTADOS_COTIZACION_ENVIO,
  cambiarEstadoCotizacionEnvio,
  obtenerCotizacionEnvio,
  type EstadoCotizacionEnvio,
} from "@/lib/envios/cotizacionesEnvio";
import { verificarSesionPortal } from "@/lib/portal/authServer";

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);

  const { id } = await params;
  if (!RE_UUID.test(id)) return fallo(404, "No existe esa cotización.");

  const cotizacion = await obtenerCotizacionEnvio(id);
  if (!cotizacion) return fallo(404, "No existe esa cotización.");
  return NextResponse.json({ ok: true, cotizacion });
}

export async function PATCH(request: Request, { params }: Contexto) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);

  const { id } = await params;
  if (!RE_UUID.test(id)) return fallo(404, "No existe esa cotización.");

  let cuerpo: { estado?: unknown } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return fallo(400, "El cuerpo debe ser JSON.");
  }
  if (!(ESTADOS_COTIZACION_ENVIO as readonly string[]).includes(String(cuerpo.estado))) {
    return fallo(400, "Estado inválido: borrador, enviada o aceptada.");
  }

  const actualizada = await cambiarEstadoCotizacionEnvio(id, cuerpo.estado as EstadoCotizacionEnvio);
  if (!actualizada) return fallo(404, "No se pudo actualizar la cotización.");
  return NextResponse.json({ ok: true, cotizacion: actualizada });
}
