/**
 * Aviso interno por correo cuando entra una hoja del Libro de Reclamaciones.
 *
 * La ley da 15 días hábiles para responder. El portal muestra el contador,
 * pero nadie vive en el portal: el correo avisa en el momento. Si el correo
 * no está configurado o falla, la hoja ya quedó registrada igual.
 */
import "server-only";

import { LUXCARS_CONFIG } from "@/lib/config";
import { destinoAvisos, enviarCorreo, escaparHtml } from "@/lib/correo";
import type { EntradaReclamacion } from "@/lib/db/reclamaciones";

const TIPO_LABEL = { reclamo: "Reclamo", queja: "Queja" } as const;
const BIEN_LABEL = { producto: "Producto", servicio: "Servicio" } as const;

export async function avisarNuevaReclamacion(
  hoja: { numero: string; createdAt: string },
  e: EntradaReclamacion,
): Promise<boolean> {
  const tipo = TIPO_LABEL[e.tipo];
  const fecha = new Date(hoja.createdAt).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "long", timeStyle: "short" });
  const enlace = `${LUXCARS_CONFIG.contact.website}/admin/reclamaciones`;
  const monto = e.bien.montoUsd !== null ? `US$ ${e.bien.montoUsd.toLocaleString("en-US")}` : "No indicado";
  const contacto = [e.consumidor.telefono, e.consumidor.email].filter(Boolean).join(" · ") || "Sin datos de contacto";

  const filas: [string, string][] = [
    ["Hoja", hoja.numero],
    ["Tipo", tipo],
    ["Registrada", fecha],
    ["Consumidor", e.consumidor.nombre],
    ["Documento", e.consumidor.documento],
    ["Contacto", contacto],
    ["Domicilio", e.consumidor.domicilio],
    ...(e.consumidor.apoderado ? ([["Apoderado", e.consumidor.apoderado]] as [string, string][]) : []),
    [`${BIEN_LABEL[e.bien.tipo]}`, e.bien.descripcion],
    ["Monto reclamado", monto],
  ];

  const texto = [
    `Nueva hoja del Libro de Reclamaciones: ${hoja.numero} (${tipo}).`,
    "",
    ...filas.map(([k, v]) => `${k}: ${v}`),
    "",
    "Detalle:",
    e.detalle,
    "",
    "Pedido del consumidor:",
    e.pedido,
    "",
    "Plazo legal de respuesta: 15 días hábiles desde la fecha de registro.",
    `Responder desde el portal: ${enlace}`,
  ].join("\n");

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#0a0a0b;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#e8e8ec">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#c0c0c0">Libro de Reclamaciones</p>
    <h1 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#fff">Nueva hoja ${escaparHtml(hoja.numero)} · ${tipo}</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${filas
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #2c2c31;color:#898991;vertical-align:top;width:34%">${escaparHtml(k)}</td><td style="padding:8px 0;border-bottom:1px solid #2c2c31;color:#fff">${escaparHtml(v)}</td></tr>`,
        )
        .join("")}
    </table>
    <h2 style="margin:24px 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#898991">Detalle</h2>
    <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#b8b8be">${escaparHtml(e.detalle)}</p>
    <h2 style="margin:20px 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#898991">Pedido del consumidor</h2>
    <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#b8b8be">${escaparHtml(e.pedido)}</p>
    <p style="margin:28px 0 0;padding:14px 16px;border:1px solid #2c2c31;border-radius:12px;font-size:13px;line-height:1.6;color:#fbbf24">Plazo legal de respuesta: 15 días hábiles desde la fecha de registro.</p>
    <p style="margin:24px 0 0"><a href="${enlace}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#fff;color:#050505;font-weight:600;font-size:14px;text-decoration:none">Responder en el portal</a></p>
  </div></body></html>`;

  return enviarCorreo({
    para: destinoAvisos(),
    asunto: `[${hoja.numero}] ${tipo} nuevo en el Libro de Reclamaciones`,
    html,
    texto,
    responderA: e.consumidor.email,
  });
}
