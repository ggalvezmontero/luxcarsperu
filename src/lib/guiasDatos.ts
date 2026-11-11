/**
 * Cifras para las guías. SOLO SERVIDOR.
 *
 * Todo ejemplo que aparece en una guía se calcula aquí con el motor de precios,
 * por el mismo camino que la calculadora (`evaluateQuote`). Así una guía nunca
 * dice un número que la calculadora no pueda reproducir.
 */
import "server-only";

import type { PremiumImportQuote } from "@/core/pricing/priceCalculator";
import type { VehicleCondition, VehicleOrigin } from "@/core/pricing/pricingConfig";
import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import type { ImportableTrendingVehicle } from "@/data/trendingVehicles";
import { evaluateQuote } from "@/lib/cotizacion";
import { cotizarEjemplo, tienePaginaPropia } from "@/lib/importExamples/modelo";
import { getImportExamplesForIsr } from "@/lib/importExamples/servidor";

export type EjemploCotizado = { v: ImportableTrendingVehicle; e: PremiumImportQuote };

/** Los ejemplos del dueño que hoy se pueden cotizar, con su estimado. */
export async function ejemplosCotizados(anio: number): Promise<EjemploCotizado[]> {
  const { vehiculos } = await getImportExamplesForIsr();
  return vehiculos.filter(tienePaginaPropia).flatMap((v) => {
    const r = cotizarEjemplo(v, anio);
    return r.kind === "ready" ? [{ v, e: r.estimate }] : [];
  });
}

/**
 * Un estimado suelto, para comparar escenarios (nuevo contra usado, gasolina
 * contra híbrido, 0% contra 6%). `null` si esa combinación no se puede cotizar.
 */
export function cotizarEscenario(params: {
  brand: string;
  model: string;
  priceUsd: number;
  vehicleType: VehicleCategoryId;
  condition: VehicleCondition;
  anio: number;
  origin?: VehicleOrigin;
}): PremiumImportQuote | null {
  const r = evaluateQuote({
    brand: params.brand,
    model: params.model,
    year: String(params.anio),
    priceMiami: params.priceUsd,
    vehicleType: params.vehicleType,
    condition: params.condition,
    preferredPlan: "fast",
    originOverride: params.origin ?? null,
    currentYear: params.anio,
  });
  return r.kind === "ready" ? r.estimate : null;
}

/** Tributos que son costo: ad valorem, ISC, IGV e IPM. */
export function tributos(e: PremiumImportQuote): number {
  return e.adValorem + e.isc + e.igv + e.ipm;
}

/** Cuánto por encima del precio de compra queda el costo final (0.39 = 39%). */
export function sobrecosto(e: PremiumImportQuote): number {
  return e.finalEstimate / e.input.priceMiami - 1;
}
