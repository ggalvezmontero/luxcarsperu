/**
 * /api/portal/expedientes/[id]/notificaciones — avisar al cliente.
 *
 *   POST { plantilla, canal: "email" | "whatsapp", datos? }
 *     → email: manda el correo con Resend desde avisos@luxcars.pe al correo del
 *       cliente y registra la fila (`enviada` o `fallida` + motivo; sin
 *       RESEND_API_KEY queda `fallida`, no lanza).
 *     → whatsapp: registra `preparada` y devuelve el enlace wa.me con el texto
 *       para que el admin lo abra con un clic.
 *
 * Comprueba sesión Y rol admin (`verificarSesionPortal`) y recién entonces lee
 * el expediente con `DATABASE_URL`. El texto lo arma el core
 * (`src/core/expedientes/notificaciones.ts`); la vista previa del portal usa
 * la misma función en el navegador, así lo que se ve es lo que se manda.
 *
 * Nunca lanza: todo error sale como JSON con `ok: false` y un mensaje en español.
 */

import { NextResponse } from "next/server";

import { esPlantillaNotificacion, type DatosNotificacion } from "@/core/expedientes/notificaciones";
import { TIPOS_HITO, type TipoHito } from "@/core/expedientes/tipos";
import { getSql } from "@/lib/db/client";
import { cargarContextoServidor, esUuid } from "@/lib/expedientes/servidor/contexto";
import { notificarCliente } from "@/lib/expedientes/servidor/notificar";
import { verificarSesionPortal } from "@/lib/portal/authServer";

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

type Contexto = { params: Promise<{ id: string }> };

const ETAPAS = new Set(["prospecto", "contrato", "busqueda", "compra", "embarque", "transito", "aduana", "placas", "entrega", "cerrado", "cancelado"]);

/** Solo las llaves conocidas, con el tipo que la plantilla espera. */
function limpiarDatos(entrada: unknown): DatosNotificacion {
  const d: DatosNotificacion = {};
  if (!entrada || typeof entrada !== "object") return d;
  const o = entrada as Record<string, unknown>;
  const texto = (k: string, max = 500) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim().slice(0, max) : undefined);
  const numero = (k: string) => (typeof o[k] === "number" && Number.isFinite(o[k]) && (o[k] as number) > 0 ? (o[k] as number) : undefined);
  if (typeof o.etapa === "string" && ETAPAS.has(o.etapa)) d.etapa = o.etapa as DatosNotificacion["etapa"];
  d.tarea = texto("tarea", 300);
  d.venceEl = texto("venceEl", 10);
  d.instrucciones = texto("instrucciones", 2000);
  d.montoUsd = numero("montoUsd");
  if (typeof o.hito === "string" && (TIPOS_HITO as readonly string[]).includes(o.hito)) d.hito = o.hito as TipoHito;
  d.fecha = texto("fecha", 10);
  d.fechaLimite = texto("fechaLimite", 10);
  if (typeof o.conConstancia === "boolean") d.conConstancia = o.conConstancia;
  d.documento = texto("documento", 300);
  d.lugar = texto("lugar", 300);
  d.nota = texto("nota", 2000);
  return d;
}

export async function POST(request: Request, { params }: Contexto) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  if (!getSql()) return fallo(503, "Falta DATABASE_URL en el servidor.");

  const { id } = await params;
  if (!esUuid(id)) return fallo(400, "Expediente inválido.");

  let cuerpo: Record<string, unknown> = {};
  try {
    const json: unknown = await request.json();
    if (json && typeof json === "object") cuerpo = json as Record<string, unknown>;
  } catch {
    return fallo(400, "El cuerpo de la petición no es JSON.");
  }

  if (!esPlantillaNotificacion(cuerpo.plantilla)) return fallo(400, "Plantilla de aviso desconocida.");
  const canal = cuerpo.canal === "whatsapp" ? "whatsapp" : cuerpo.canal === "email" ? "email" : null;
  if (!canal) return fallo(400, "El canal es email o whatsapp.");

  let ctx;
  try {
    ctx = await cargarContextoServidor(id);
  } catch {
    return fallo(500, "No se pudo leer el expediente. Vuelve a intentarlo.");
  }
  if (!ctx) return fallo(404, "El expediente no existe.");
  if (ctx.expediente.etapa === "prospecto") return fallo(409, "Un prospecto todavía no recibe avisos: abre el expediente en contrato primero.");

  const r = await notificarCliente(ctx, { plantilla: cuerpo.plantilla, canal, datos: limpiarDatos(cuerpo.datos), actorId: sesion.userId });

  return NextResponse.json({
    ok: r.ok,
    estado: r.estado,
    canal: r.canal,
    destinatario: r.destinatario,
    asunto: r.notificacion.asunto,
    texto: r.notificacion.texto,
    enlaceWhatsApp: r.enlaceWhatsApp,
    mensaje: r.error,
    notificacionId: r.id,
  });
}
