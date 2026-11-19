/**
 * Correo saliente del servidor, por la API HTTP de Resend (sin SDK).
 *
 * Solo avisos internos: hoy, la hoja nueva del Libro de Reclamaciones, que
 * tiene plazo legal y no puede depender de que alguien entre al portal.
 *
 * Se activa con `RESEND_API_KEY` en el entorno. Sin la clave, `enviarCorreo`
 * devuelve `false` y nada más: el sitio funciona igual y quien llama no debe
 * fallar por un correo que no salió. NUNCA lanza.
 */
import "server-only";

import { LUXCARS_CONFIG } from "@/lib/config";

/** Remitente en el dominio verificado en Resend (luxcars.pe). */
const REMITENTE = `Luxcars <avisos@luxcars.pe>`;

export function correoConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Destino de los avisos internos; por defecto el correo de contacto. */
export function destinoAvisos(): string {
  return process.env.AVISOS_EMAIL?.trim() || LUXCARS_CONFIG.contact.email;
}

export async function enviarCorreo(input: {
  para: string | string[];
  asunto: string;
  html: string;
  texto: string;
  responderA?: string | null;
}): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REMITENTE,
        to: Array.isArray(input.para) ? input.para : [input.para],
        subject: input.asunto,
        html: input.html,
        text: input.texto,
        ...(input.responderA ? { reply_to: input.responderA } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Escapa texto para meterlo en el HTML del correo. */
export function escaparHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
