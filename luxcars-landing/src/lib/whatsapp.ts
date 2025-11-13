import { LUXCARS_CONFIG } from "./config";
import { formatCurrency } from "./utils";
import type { ImportEstimate } from "./calculator";

export type WhatsappPayload = {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  preferredPlan?: "fast" | "standard";
};

export function buildWhatsappLink(
  estimate: ImportEstimate,
  contact: WhatsappPayload,
) {
  const { deliveryWindows, contact: contactConfig } = LUXCARS_CONFIG;
  const plan =
    contact.preferredPlan === "fast"
      ? deliveryWindows.fastTrack
      : deliveryWindows.standard;

  const lines = [
    "Hola LuxCars, quiero avanzar con la importación de un auto premium.",
    contact.name ? `Nombre: ${contact.name}` : undefined,
    contact.phone ? `Teléfono: ${contact.phone}` : undefined,
    contact.email ? `Email: ${contact.email}` : undefined,
    `Marca: ${estimate.input.brand}`,
    `Modelo: ${estimate.input.model}`,
    `Año: ${estimate.input.year}`,
    `Precio Miami: ${formatCurrency(estimate.input.price)}`,
    `Flete + seguro (estim.): ${formatCurrency(estimate.shippingInsurance)}`,
    `Ad Valorem (6%): ${formatCurrency(estimate.adValorem)}`,
    `ISC (${estimate.iscLabel}): ${formatCurrency(estimate.isc)}`,
    `IGV 18%: ${formatCurrency(estimate.igv)}`,
    `Honorarios administrativos (7%): ${formatCurrency(estimate.adminFee)}`,
    `Broker fee (10%): ${formatCurrency(estimate.brokerFee)}`,
    `Precio final estimado Lima: ${formatCurrency(estimate.finalEstimate)}`,
    `Rango probable: ${formatCurrency(estimate.finalRange.min)} - ${formatCurrency(estimate.finalRange.max)}`,
    `Ahorro estimado vs Perú: ${formatCurrency(estimate.savingsVsPeru)}`,
    `Plan estimado: ${plan.label} (${plan.days[0]}-${plan.days[1]} días)`,
    contact.notes ? `Notas: ${contact.notes}` : undefined,
  ].filter(Boolean);

  const message = encodeURIComponent(lines.join("\n"));

  return `https://wa.me/${contactConfig.whatsappNumber}?text=${message}`;
}
