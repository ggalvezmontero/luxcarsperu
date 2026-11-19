/**
 * PATCH /api/admin/reclamaciones/[id] { respuesta } — registra la respuesta
 * del proveedor. Solo administradores; nunca lanza.
 */

import { NextResponse } from "next/server";

import { responderReclamacion } from "@/lib/db/reclamaciones";
import { verificarSesionPortal } from "@/lib/portal/authServer";

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);

  const { id } = await params;
  if (!RE_UUID.test(id)) return fallo(404, "No existe esa hoja.");

  let cuerpo: { respuesta?: unknown } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return fallo(400, "El cuerpo debe ser JSON.");
  }
  const respuesta = typeof cuerpo.respuesta === "string" ? cuerpo.respuesta.trim().slice(0, 4000) : "";
  if (respuesta.length < 10) return fallo(400, "La respuesta debe explicar qué se hizo o se hará.");

  const hoja = await responderReclamacion(id, respuesta, sesion.userId);
  if (!hoja) return fallo(404, "No se pudo registrar la respuesta.");
  return NextResponse.json({ ok: true, hoja });
}
