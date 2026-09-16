/**
 * Enlaces de WhatsApp SALIENTES del portal de administración.
 *
 * Diferencia con `src/lib/whatsapp.ts`: aquel arma el mensaje que el CLIENTE
 * le envía a LuxCars (destino = número de la empresa). Este arma el mensaje que
 * el EQUIPO le envía al cliente o al dueño de un auto en consignación
 * (destino = número de la persona). Por eso vive en un archivo aparte: el
 * destinatario es distinto y el tono también.
 *
 * Se conserva el patrón de `src/lib/whatsapp.ts` a propósito:
 *   1. arreglo de líneas con `undefined` para las opcionales,
 *   2. `.filter(Boolean)`,
 *   3. `join("\n")`,
 *   4. `encodeURIComponent`,
 *   5. `https://wa.me/<destino>?text=<mensaje>`.
 *
 * Ninguna función lanza: si el teléfono no sirve, devuelven `null` y la UI
 * muestra la acción deshabilitada en vez de romperse.
 */

import { LUXCARS_CONFIG } from "./config";
import { formatCurrency } from "./utils";

/** Perú. Se usa para completar los celulares locales de 9 dígitos. */
const PERU_COUNTRY_CODE = "51";

/**
 * Normaliza un teléfono a los dígitos que acepta `wa.me`.
 *
 * Reglas aplicadas, en orden:
 *   - Se descartan espacios, guiones, paréntesis y el `+`.
 *   - `00` inicial (prefijo internacional europeo) se elimina.
 *   - Un celular peruano de 9 dígitos que empieza en 9 recibe el prefijo 51.
 *   - Cualquier otro número de 8 a 15 dígitos se respeta tal cual: puede ser un
 *     cliente en el extranjero y no nos corresponde adivinarle el país.
 *
 * Devuelve `null` cuando no queda un número marcable. La UI debe tratar ese
 * `null` como "no hay WhatsApp para esta persona", nunca como un error.
 */
export function normalizePhoneForWhatsapp(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;

  let digits = raw.replace(/\D+/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.length === 9 && digits.startsWith("9")) {
    digits = `${PERU_COUNTRY_CODE}${digits}`;
  }

  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

function waLink(phoneDigits: string, lines: Array<string | undefined>): string {
  const message = encodeURIComponent(lines.filter(Boolean).join("\n"));
  return `https://wa.me/${phoneDigits}?text=${message}`;
}

/** Firma del asesor, idéntica en todos los mensajes salientes. */
function signature(): string[] {
  const { brandName, contact } = LUXCARS_CONFIG;
  return [
    "",
    `${brandName} · ${contact.address}, ${contact.city}`,
    contact.website,
  ];
}

/* ========================================================================== */
/* Leads                                                                      */
/* ========================================================================== */

export type LeadWhatsappContext = {
  /** Teléfono del cliente tal como está guardado. Puede venir sucio o `null`. */
  phone: string | null | undefined;
  name: string;
  /** Unidad del stock consultada, ya formateada ("Toyota Tacoma TRD 2026"). */
  vehicleLabel?: string | null;
  /** Lo que busca cuando la unidad todavía no existe (importación a pedido). */
  interestBrand?: string | null;
  interestModel?: string | null;
  interestYear?: number | null;
  budgetUsd?: number | null;
  /** Etiqueta legible del origen: "Calculadora", "Stock", … */
  originLabel?: string | null;
  /** Nombre del asesor que escribe. Opcional mientras no haya sesión. */
  agentName?: string | null;
};

/**
 * Primer contacto (o seguimiento) con un lead.
 *
 * El mensaje nombra explícitamente lo que la persona consultó: un lead que
 * recibe "Hola, vi tu consulta" sin más contexto no responde. Nunca incluye
 * datos internos (presupuesto solo si el propio cliente lo declaró, nada de
 * notas ni de márgenes).
 */
export function buildLeadWhatsappLink(
  context: LeadWhatsappContext,
): string | null {
  const destination = normalizePhoneForWhatsapp(context.phone);
  if (!destination) return null;

  const firstName = context.name.trim().split(/\s+/)[0] || "";
  const greeting = firstName
    ? `Hola ${firstName}, te escribe ${context.agentName?.trim() || "el equipo"} de ${LUXCARS_CONFIG.brandName}.`
    : `Hola, te escribe ${context.agentName?.trim() || "el equipo"} de ${LUXCARS_CONFIG.brandName}.`;

  const interest = [
    context.interestBrand?.trim(),
    context.interestModel?.trim(),
    context.interestYear ? String(context.interestYear) : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const subject =
    context.vehicleLabel?.trim() || interest || "el vehículo que consultaste";

  const lines: Array<string | undefined> = [
    greeting,
    `Recibimos tu consulta por ${subject}${
      context.originLabel ? ` (${context.originLabel.toLowerCase()})` : ""
    }.`,
    context.budgetUsd
      ? `Tomamos nota de tu presupuesto referencial: ${formatCurrency(context.budgetUsd)}.`
      : undefined,
    "",
    "¿Te parece si coordinamos una llamada para darte las opciones reales disponibles y el costo final puesto en Lima, con impuestos incluidos?",
    ...signature(),
  ];

  return waLink(destination, lines);
}

/* ========================================================================== */
/* Consignaciones                                                             */
/* ========================================================================== */

export type ConsignmentWhatsappContext = {
  phone: string | null | undefined;
  ownerName: string;
  /** "Toyota Tacoma TRD 2026". */
  vehicleLabel: string;
  askingPrice?: number | null;
  currency?: "USD" | "PEN";
  daysOnConsignment?: number | null;
  agentName?: string | null;
};

/**
 * Seguimiento con el dueño de un auto en consignación.
 *
 * NUNCA menciona el precio mínimo: ese piso es información reservada de la
 * negociación (ver el comentario de `precio_minimo` en la migración
 * `20260915090700_consignments.sql`). Sí recuerda la no exclusividad, porque
 * es la promesa comercial de la línea y conviene repetirla.
 */
export function buildConsignmentOwnerWhatsappLink(
  context: ConsignmentWhatsappContext,
): string | null {
  const destination = normalizePhoneForWhatsapp(context.phone);
  if (!destination) return null;

  const firstName = context.ownerName.trim().split(/\s+/)[0] || "";
  const greeting = firstName
    ? `Hola ${firstName}, te escribe ${context.agentName?.trim() || "el equipo"} de ${LUXCARS_CONFIG.brandName}.`
    : `Hola, te escribe ${context.agentName?.trim() || "el equipo"} de ${LUXCARS_CONFIG.brandName}.`;

  const lines: Array<string | undefined> = [
    greeting,
    `Te escribimos por la consignación de tu ${context.vehicleLabel}.`,
    typeof context.daysOnConsignment === "number" && context.daysOnConsignment >= 0
      ? `Lleva ${context.daysOnConsignment} ${context.daysOnConsignment === 1 ? "día" : "días"} publicado con nosotros.`
      : undefined,
    context.askingPrice
      ? `Precio publicado: ${formatCurrency(context.askingPrice, "es-PE", context.currency ?? "USD")}.`
      : undefined,
    "",
    "Te recordamos que no hay contrato de exclusividad: sigues usando tu auto con normalidad y, si lo vendes por tu cuenta, no pagas comisión. Solo avísanos para cerrar el registro.",
    "¿Conversamos esta semana sobre cómo va la búsqueda de comprador?",
    ...signature(),
  ];

  return waLink(destination, lines);
}
