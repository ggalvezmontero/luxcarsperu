/**
 * /api/admin/cotizaciones-envio — historial y guardado del cotizador de envíos.
 *
 *   GET            → lista de cotizaciones (sin los JSON), más recientes primero
 *   POST { entrada, estado? } → recalcula en el servidor, guarda y devuelve la fila
 *
 * Solo administradores: `verificarSesionPortal()` (sesión de Neon Auth con
 * perfil `admin` activo). Se escribe con `DATABASE_URL`, que salta RLS, por eso
 * la comprobación va acá y no se confía en el layout de /admin.
 *
 * El servidor NO guarda los números que manda el navegador: parsea la entrada,
 * la recalcula con `cotizarEnvio()` y guarda su propio resultado. Lo que se
 * muestra y lo que se archiva salen de la misma función pura.
 *
 * Nunca lanza: todo error sale como JSON con `ok: false` y un mensaje.
 */

import { NextResponse } from "next/server";

import { cotizarEnvio } from "@/core/envios/calculoEnvio";
import { parsearEntradaEnvio } from "@/core/envios/parsearEntrada";
import {
  ESTADOS_COTIZACION_ENVIO,
  crearCotizacionEnvio,
  listarCotizacionesEnvio,
  type EstadoCotizacionEnvio,
} from "@/lib/envios/cotizacionesEnvio";
import { verificarSesionPortal } from "@/lib/portal/authServer";

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

const SIN_TABLA =
  "No se pudo acceder a las cotizaciones. ¿Está aplicada la migración 20261118090000_cotizaciones_envio.sql? (ver db/README.md)";

export async function GET() {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);

  const cotizaciones = await listarCotizacionesEnvio();
  if (cotizaciones === null) return fallo(503, SIN_TABLA);
  return NextResponse.json({ ok: true, cotizaciones });
}

export async function POST(request: Request) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);

  let cuerpo: { entrada?: unknown; estado?: unknown } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    return fallo(400, "El cuerpo debe ser JSON.");
  }

  const entrada = parsearEntradaEnvio(cuerpo.entrada);
  if (!entrada) {
    return fallo(400, "Faltan datos obligatorios: nombre del cliente, marca, modelo, año y régimen.");
  }

  const estado: EstadoCotizacionEnvio = (ESTADOS_COTIZACION_ENVIO as readonly string[]).includes(
    String(cuerpo.estado),
  )
    ? (cuerpo.estado as EstadoCotizacionEnvio)
    : "borrador";

  const resultado = cotizarEnvio(entrada);
  const guardada = await crearCotizacionEnvio({
    entrada,
    resultado,
    estado,
    createdBy: sesion.userId,
  });
  if (!guardada) return fallo(503, SIN_TABLA);

  return NextResponse.json({ ok: true, cotizacion: guardada }, { status: 201 });
}
