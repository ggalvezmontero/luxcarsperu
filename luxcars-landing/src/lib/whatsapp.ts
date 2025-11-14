import { LUXCARS_CONFIG } from "./config";
import { formatCurrency, formatPercentage } from "./utils";
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
  const varianceLabel = formatPercentage(services.finalRangeVariance);
  const peruPriceProvided =
    typeof estimate.input.peruPrice === "number" &&
    !Number.isNaN(estimate.input.peruPrice);

  const lines = [
    "Hola LuxCars, quiero avanzar con la importación de un auto premium.",
    contact.name ? `Nombre: ${contact.name}` : undefined,
    contact.phone ? `Teléfono: ${contact.phone}` : undefined,
    contact.email ? `Email: ${contact.email}` : undefined,
    `Tipo de vehículo: ${estimate.vehicleType.label}`,
    `Plan seleccionado: ${planConfig.label}`,
    `Timeline estimado: ${timelineLabel}`,
    `Marca: ${estimate.input.brand}`,
    `Modelo: ${estimate.input.model}`,
    `Año: ${estimate.input.year}`,
    `Precio Miami: ${formatCurrency(estimate.input.price)}`,
    freightAppliedLine,
      `Seguro (1.5%): ${formatCurrency(estimate.insurance)}`,
    `CIF (auto + flete + seguro): ${formatCurrency(estimate.cif)}`,
    `Ad Valorem 6%: ${formatCurrency(estimate.adValorem)}`,
    `ISC aplicado (${formatPercentage(estimate.iscRate)}): ${formatCurrency(estimate.isc)}`,
    `IGV 18%: ${formatCurrency(estimate.igv)}`,
    `State Compliance Fee (7%): ${formatCurrency(estimate.stateComplianceFee)}`,
    `Broker fee (10%): ${formatCurrency(estimate.brokerFee)}`,
    ...estimate.localFixedFees.map(
      (fee) => `${fee.label}: ${formatCurrency(fee.amount)}`,
    ),
      estimate.documentHandlingFee > 0
        ? `Extra FastTrack: ${formatCurrency(estimate.documentHandlingFee)}`
        : undefined,
    `Precio final estimado Lima: ${formatCurrency(estimate.finalEstimate)} ± ${varianceLabel}`,
    `Rango estimado: ${formatCurrency(estimate.finalRange.min)} - ${formatCurrency(estimate.finalRange.max)}`,
    peruPriceProvided
      ? `Precio referencia Perú: ${formatCurrency(estimate.input.peruPrice!)}`
      : undefined,
    peruPriceProvided
      ? `Ahorro estimado vs Perú: ${formatCurrency(estimate.savingsVsPeru)}`
      : undefined,
    `ISC utilizado: ${formatPercentage(estimate.iscRate)} · ${estimate.iscTooltip}`,
    "Estimado sujeto a verificación de partida arancelaria y determinación SUNAT.",
    contact.notes ? `Notas: ${contact.notes}` : undefined,
  ].filter(Boolean);

  const message = encodeURIComponent(lines.join("\n"));

  return `https://wa.me/${contactConfig.whatsappNumber}?text=${message}`;
}
