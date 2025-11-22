import { LUXCARS_CONFIG } from "./config";
import { formatCurrency, formatPercentage } from "./utils";
import type { PremiumImportQuote } from "@/core/pricing/priceCalculator";

export type WhatsappPayload = {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  preferredPlan?: "fast" | "standard";
};

export function buildWhatsappLink(
  estimate: PremiumImportQuote,
  contact: WhatsappPayload,
) {
  const { contact: contactConfig, services } = LUXCARS_CONFIG;
  const planConfig = estimate.planConfig;
  const timelineLabel = planConfig.timelineLabel;
  const adjustmentPercent =
    estimate.freightAdjustment > 0
      ? Math.round((estimate.freightAdjustment - 1) * 100)
      : 0;
  const freightAppliedLine =
    adjustmentPercent > 0
      ? `Flete aplicado: ${formatCurrency(estimate.freight)} (base ${formatCurrency(estimate.freightBase)} +${adjustmentPercent}% Fast Track)`
      : `Flete aplicado: ${formatCurrency(estimate.freight)}`;
  const lines = [
    "Hola LuxCars, quiero avanzar con la importación de un auto premium.",
    contact.name ? `Nombre: ${contact.name}` : undefined,
    contact.phone ? `Teléfono: ${contact.phone}` : undefined,
    contact.email ? `Email: ${contact.email}` : undefined,
    `Categoría seleccionada: ${estimate.vehicleCategory.label}`,
    `Plan seleccionado: ${planConfig.label}`,
    `Timeline estimado: ${timelineLabel}`,
    `Marca: ${estimate.input.brand}`,
    `Modelo: ${estimate.input.model}`,
    `Año: ${estimate.input.year}`,
    `Precio Miami: ${formatCurrency(estimate.input.priceMiami)}`,
    freightAppliedLine,
    `Seguro 1.5%: ${formatCurrency(estimate.insurance)}`,
    `CIF (auto + flete + seguro): ${formatCurrency(estimate.cif)}`,
    `Ad Valorem 6%: ${formatCurrency(estimate.adValorem)}`,
    `ISC aplicado (${formatPercentage(estimate.iscRate)}): ${formatCurrency(estimate.isc)}`,
    `IGV 18%: ${formatCurrency(estimate.igv)}`,
    `State Compliance Fee (5%): ${formatCurrency(estimate.stateComplianceFee)}`,
    `Broker Fee (10%): ${formatCurrency(estimate.brokerFee)}`,
    estimate.documentHandlingFee > 0
      ? `Extra FastTrack: ${formatCurrency(estimate.documentHandlingFee)}`
      : undefined,
    `Precio final estimado Lima: ${formatCurrency(estimate.finalEstimate)}`,
    `ISC de referencia: ${formatPercentage(estimate.iscRate)} · ${estimate.iscTooltip}`,
    "Estimado sujeto a verificación de partida arancelaria y determinación SUNAT.",
    contact.notes ? `Notas: ${contact.notes}` : undefined,
  ].filter(Boolean);

  const message = encodeURIComponent(lines.join("\n"));

  return `https://wa.me/${contactConfig.whatsappNumber}?text=${message}`;
}
