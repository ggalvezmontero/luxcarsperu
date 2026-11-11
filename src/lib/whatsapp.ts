import { LUXCARS_CONFIG } from "./config";
import { formatCurrency, formatPercentage, formatRate } from "./utils";
import type { PremiumImportQuote } from "@/core/pricing/priceCalculator";
import { PRICING_CONFIG } from "@/core/pricing/pricingConfig";

export type WhatsappPayload = {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  preferredPlan?: "fast" | "standard";
  /** Enlace al estimado (`/c/<código>`), para que el asesor abra el mismo desglose. */
  detailUrl?: string;
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
    `Seguro internacional: ${formatCurrency(estimate.insurance)}`,
    `CIF (auto + flete + seguro): ${formatCurrency(estimate.cif)}`,
    `Ad Valorem ${formatPercentage(estimate.adValoremRate)}: ${formatCurrency(estimate.adValorem)}`,
    `ISC ${formatPercentage(estimate.iscRate)} (sobre CIF + Ad Valorem): ${formatCurrency(estimate.isc)}`,
    `IGV 15.5% + IPM 2.5% (sobre CIF + Ad Valorem + ISC): ${formatCurrency(estimate.igv + estimate.ipm)}`,
    `Costos de aduana: ${formatCurrency(estimate.customsFee)}`,
    `Comisión LuxCars (${formatRate(PRICING_CONFIG.brokerFeeRate)}): ${formatCurrency(estimate.brokerFee)}`,
    estimate.documentHandlingFee > 0
      ? `Fast Track (cargo fijo): ${formatCurrency(estimate.documentHandlingFee)}`
      : undefined,
    `Precio final estimado Lima: ${formatCurrency(estimate.finalEstimate)}`,
    `Percepción IGV ${formatRate(estimate.percepcionRate)} (adelanto recuperable, no es costo): ${formatCurrency(estimate.percepcion)}`,
    `Efectivo a desembolsar: ${formatCurrency(estimate.cashRequired)}`,
    `Condición: ${estimate.condition} · Origen: ${estimate.origin === "originario-usa" ? "originario de EE.UU. (ad valorem 0% por APC)" : "importado a EE.UU. (ad valorem 6%)"}`,
    `ISC de referencia: ${formatPercentage(estimate.iscRate)} · ${estimate.iscTooltip}`,
    "Estimado sujeto a verificación de partida arancelaria y determinación SUNAT.",
    contact.detailUrl ? `Detalle del estimado: ${contact.detailUrl}` : undefined,
    contact.notes ? `Notas: ${contact.notes}` : undefined,
  ].filter(Boolean);

  const message = encodeURIComponent(lines.join("\n"));

  return `https://wa.me/${contactConfig.whatsappNumber}?text=${message}`;
}

export type IncompleteCalculatorWhatsappParams = {
  vehicleTypeLabel?: string;
  brand: string;
  model: string;
  missingYearAndPrice: boolean;
  preferredPlanLabel: string;
};

export function buildIncompleteCalculatorWhatsappLink(
  params: IncompleteCalculatorWhatsappParams,
) {
  const { contact: contactConfig } = LUXCARS_CONFIG;
  const lines = [
    "Hola LuxCars, quiero orientación para importar un vehículo premium.",
    "No cuento con todos los datos para completar la calculadora:",
    params.missingYearAndPrice
      ? "• No tengo el año ni el precio en Miami (USD)"
      : undefined,
    params.vehicleTypeLabel
      ? `Tipo de vehículo / ISC: ${params.vehicleTypeLabel}`
      : undefined,
    params.brand.trim() ? `Marca: ${params.brand.trim()}` : undefined,
    params.model.trim() ? `Modelo: ${params.model.trim()}` : undefined,
    `Plan de entrega de interés: ${params.preferredPlanLabel}`,
    "¿Podrían asesorarme para ofrecerme las mejores opciones?",
  ].filter(Boolean);

  const message = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${contactConfig.whatsappNumber}?text=${message}`;
}

export type BlockedCalculatorWhatsappParams = {
  vehicleTypeLabel?: string;
  conditionLabel: string;
  brand: string;
  model: string;
  year: string;
  priceUsd: number | null;
  /** El motivo que la calculadora le mostró al cliente. */
  reason: string;
};

/**
 * Mensaje para cuando la calculadora NO puede cotizar el auto (precio bajo el
 * mínimo, diésel usado, demasiado antiguo). Lleva lo que el cliente escribió y
 * el motivo: antes salía el mensaje de "no tengo el año ni el precio", que era
 * falso justo en el caso en que el cliente sí los había puesto.
 */
export function buildBlockedCalculatorWhatsappLink(
  params: BlockedCalculatorWhatsappParams,
) {
  const { contact: contactConfig } = LUXCARS_CONFIG;
  const lines = [
    "Hola LuxCars, quise cotizar este auto en la calculadora y no me dio un estimado:",
    params.brand.trim() ? `Marca: ${params.brand.trim()}` : undefined,
    params.model.trim() ? `Modelo: ${params.model.trim()}` : undefined,
    params.year ? `Año: ${params.year}` : undefined,
    `Condición: ${params.conditionLabel}`,
    params.vehicleTypeLabel ? `Motor: ${params.vehicleTypeLabel}` : undefined,
    params.priceUsd ? `Precio en EE.UU.: ${formatCurrency(params.priceUsd)}` : undefined,
    `Lo que me indicó la calculadora: ${params.reason}`,
    "¿Hay alguna alternativa?",
  ].filter(Boolean);

  const message = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${contactConfig.whatsappNumber}?text=${message}`;
}
