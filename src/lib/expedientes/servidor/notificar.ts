/**
 * Avisos al cliente de un expediente, DESDE EL SERVIDOR: construye el texto
 * con el core (`notificaciones.ts`), lo manda por Resend (correo) o prepara el
 * enlace `wa.me` (WhatsApp) y deja la fila en `notificaciones`.
 *
 * SOLO para rutas que ya verificaron sesión y rol con `verificarSesionPortal()`
 * o, en el cron, el secreto. NUNCA lanza: si falta `RESEND_API_KEY`, si el
 * cliente no tiene correo o si Resend rechaza, la fila queda `fallida` con el
 * motivo y la acción principal (confirmar un depósito, emitir un documento)
 * sigue su curso. Un aviso que no salió no puede frenar el expediente.
 */
import "server-only";

import {
  construirNotificacion,
  enlaceCuenta,
  enlaceWhatsApp,
  type ContextoNotificacion,
  type DatosNotificacion,
  type Notificacion,
  type PlantillaNotificacion,
} from "@/core/expedientes/notificaciones";
import type { CanalNotificacion, ContextoExpediente, EstadoNotificacion } from "@/core/expedientes/tipos";
import { LUXCARS_CONFIG } from "@/lib/config";
import { correoConfigurado, enviarCorreo } from "@/lib/correo";
import { getSql } from "@/lib/db/client";
import { normalizePhoneForWhatsapp } from "@/lib/whatsappPortal";

export function contextoNotificacionDe(ctx: ContextoExpediente): ContextoNotificacion {
  const v = ctx.expediente.vehiculo;
  return {
    codigo: ctx.expediente.codigo,
    cliente: ctx.cliente?.representante?.trim() || ctx.cliente?.razonSocial || "",
    auto: [v.marca, v.modelo, String(v.anio)].filter(Boolean).join(" "),
    etapa: ctx.expediente.etapa,
    enlace: enlaceCuenta(ctx.expediente.codigo, LUXCARS_CONFIG.contact.website),
  };
}

export type ResultadoNotificacion = {
  ok: boolean;
  id: string | null;
  estado: EstadoNotificacion;
  canal: CanalNotificacion;
  destinatario: string | null;
  notificacion: Notificacion;
  /** Solo WhatsApp: el enlace listo para abrir. */
  enlaceWhatsApp: string | null;
  error: string | null;
};

export type OpcionesNotificar = {
  plantilla: PlantillaNotificacion;
  canal: CanalNotificacion;
  datos?: DatosNotificacion;
  /** Usuario verificado que la envía; `null` en el cron. */
  actorId: string | null;
};

export async function notificarCliente(ctx: ContextoExpediente, opciones: OpcionesNotificar): Promise<ResultadoNotificacion> {
  const n = construirNotificacion(opciones.plantilla, contextoNotificacionDe(ctx), opciones.datos ?? {});
  let estado: EstadoNotificacion = "fallida";
  let error: string | null = null;
  let destinatario: string | null = null;
  let enlace: string | null = null;

  if (opciones.canal === "email") {
    destinatario = ctx.cliente?.email?.trim().toLowerCase() || null;
    if (!destinatario) {
      error = "El cliente no tiene correo registrado.";
    } else if (!correoConfigurado()) {
      error = "Falta RESEND_API_KEY en el servidor: el correo no se envió.";
    } else {
      const salio = await enviarCorreo({ para: destinatario, asunto: n.asunto, html: n.html, texto: n.texto, responderA: LUXCARS_CONFIG.contact.email });
      if (salio) estado = "enviada";
      else error = "Resend no aceptó el correo. Revisa el dominio verificado y la clave.";
    }
  } else {
    const digitos = normalizePhoneForWhatsapp(ctx.cliente?.telefono);
    destinatario = digitos ? `+${digitos}` : null;
    enlace = enlaceWhatsApp(digitos, n.texto);
    if (enlace) estado = "preparada";
    else error = "El cliente no tiene un teléfono válido para WhatsApp.";
  }

  const id = await registrar({ expedienteId: ctx.expediente.id, canal: opciones.canal, plantilla: opciones.plantilla, destinatario, asunto: n.asunto, texto: n.texto, estado, error, actorId: opciones.actorId });

  return { ok: estado !== "fallida", id, estado, canal: opciones.canal, destinatario, notificacion: n, enlaceWhatsApp: enlace, error };
}

/** Inserta la fila en `notificaciones`. `null` si no hay conexión o falló (se registra en consola). */
export async function registrar(input: {
  expedienteId: string | null;
  canal: CanalNotificacion;
  plantilla: string;
  destinatario: string | null;
  asunto: string | null;
  texto: string | null;
  estado: EstadoNotificacion;
  error: string | null;
  actorId: string | null;
}): Promise<string | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const [fila] = (await sql`
      insert into public.notificaciones (expediente_id, canal, plantilla, destinatario, asunto, cuerpo_texto, estado, enviado_en, error, created_by)
      values (
        ${input.expedienteId}::uuid, ${input.canal}, ${input.plantilla.slice(0, 60)}, ${input.destinatario?.slice(0, 200) ?? null},
        ${input.asunto?.slice(0, 300) ?? null}, ${input.texto?.slice(0, 20000) ?? null}, ${input.estado},
        ${input.estado === "enviada" ? new Date().toISOString() : null}::timestamptz, ${input.error?.slice(0, 2000) ?? null}, ${input.actorId}::uuid
      )
      returning id
    `) as unknown as { id: string }[];
    return fila?.id ?? null;
  } catch (e) {
    console.error("[expedientes/notificar] registrar", e);
    return null;
  }
}

/**
 * Aviso automático por correo tras una acción del servidor (depósito
 * confirmado, documento visible). Solo si el cliente tiene correo; nunca
 * lanza ni frena a quien llama.
 */
export async function avisarPorCorreoSiHayCorreo(ctx: ContextoExpediente, plantilla: PlantillaNotificacion, datos: DatosNotificacion, actorId: string | null): Promise<ResultadoNotificacion | null> {
  if (!ctx.cliente?.email) return null;
  try {
    return await notificarCliente(ctx, { plantilla, canal: "email", datos, actorId });
  } catch (e) {
    console.error("[expedientes/notificar] automático", e);
    return null;
  }
}
