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
  const { deliveryWindows, contact: contactConfig } = LUXCARS_CONFIG;
  const plan =
    contact.preferredPlan === "fast"
      ? deliveryWindows.fastTrack
      : deliveryWindows.standard;
  const peruPriceProvided =
    typeof estimate.input.peruPrice === "number" &&
    !Number.isNaN(estimate.input.peruPrice);

  const lines = [
    "Hola LuxCars, quiero avanzar con la importación de un auto premium.",
    contact.name ? `Nombre: ${contact.name}` : undefined,
    contact.phone ? `Teléfono: ${contact.phone}` : undefined,
    contact.email ? `Email: ${contact.email}` : undefined,
    `Tipo de vehículo: ${estimate.vehicleType.label} (${formatPercentage(estimate.iscRate)})`,
    `Marca: ${estimate.input.brand}`,
    `Modelo: ${estimate.input.model}`,
    `Año: ${estimate.input.year}`,
    `Precio Miami: ${formatCurrency(estimate.input.price)}`,
    `Flete aplicado: ${formatCurrency(estimate.freight)}`,
    `Seguro marítimo (1.5%): ${formatCurrency(estimate.insurance)}`,
    `CIF (auto + flete + seguro): ${formatCurrency(estimate.cif)}`,
    `Ad Valorem 6%: ${formatCurrency(estimate.adValorem)}`,
    `ISC aplicado (${formatPercentage(estimate.iscRate)}): ${formatCurrency(estimate.isc)}`,
    `IGV 18%: ${formatCurrency(estimate.igv)}`,
    `State Compliance Fee (7%): ${formatCurrency(estimate.stateComplianceFee)}`,
    `Broker fee (10%): ${formatCurrency(estimate.brokerFee)}`,
    ...estimate.localFixedCosts.map(
      (cost) => `${cost.label}: ${formatCurrency(cost.amount)}`,
    ),
    `Precio final estimado Lima: ${formatCurrency(estimate.finalEstimate)}`,
    `Rango probable: ${formatCurrency(estimate.finalRange.min)} - ${formatCurrency(estimate.finalRange.max)}`,
    peruPriceProvided
      ? `Precio referencia Perú: ${formatCurrency(estimate.input.peruPrice!)}`
      : undefined,
    peruPriceProvided
      ? `Ahorro estimado vs Perú: ${formatCurrency(estimate.savingsVsPeru)}`
      : undefined,
    `Plan estimado: ${plan.label} (${plan.days[0]}-${plan.days[1]} días)`,
    "Estimado sujeto a verificación de partida arancelaria y determinación SUNAT.",
    contact.notes ? `Notas: ${contact.notes}` : undefined,
  ].filter(Boolean);

  const message = encodeURIComponent(lines.join("\n"));

  return `https://wa.me/${contactConfig.whatsappNumber}?text=${message}`;
}
