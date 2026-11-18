/**
 * /api/admin/cotizaciones-envio/[id]
 *
 *   GET                        → la cotización completa (entrada y resultado), para reabrirla
 *   PATCH { estado }           → cambia solo el estado: borrador, enviada o aceptada
 *   PATCH { entrada, estado? } → la corrige: recalcula en el servidor y reemplaza
 *                                entrada y resultado conservando número y fecha
 *
 * Mismas reglas que la ruta padre: solo administradores, nunca lanza.
 */

import { NextResponse } from "next/server";

import { cotizarEnvio } from "@/core/envios/calculoEnvio";
import { parsearEntradaEnvio } from "@/core/envios/parsearEntrada";
import {
  ESTADOS_COTIZACION_ENVIO,
  actualizarCotizacionEnvio,
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

  let cuerpo: { estado?: unknown; entrada?: unknown } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return fallo(400, "El cuerpo debe ser JSON.");
  }
  const estadoValido = (ESTADOS_COTIZACION_ENVIO as readonly string[]).includes(String(cuerpo.estado));
  const estado = estadoValido ? (cuerpo.estado as EstadoCotizacionEnvio) : null;

  if (cuerpo.entrada !== undefined) {
    const entrada = parsearEntradaEnvio(cuerpo.entrada);
    if (!entrada) {
      return fallo(400, "Faltan datos obligatorios: nombre del cliente, marca, modelo, año y régimen.");
    }
    const actualizada = await actualizarCotizacionEnvio(id, { entrada, resultado: cotizarEnvio(entrada), estado });
    if (!actualizada) return fallo(404, "No se pudo actualizar la cotización.");
    return NextResponse.json({ ok: true, cotizacion: actualizada });
  }

  if (!estado) return fallo(400, "Estado inválido: borrador, enviada o aceptada.");
  const actualizada = await cambiarEstadoCotizacionEnvio(id, estado);
  if (!actualizada) return fallo(404, "No se pudo actualizar la cotización.");
  return NextResponse.json({ ok: true, cotizacion: actualizada });
}
