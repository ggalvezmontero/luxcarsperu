/**
 * Evaluación de un estimado con todos sus datos ya completos.
 *
 * La usan la calculadora (en el navegador, con cada cambio del formulario) y
 * la página del estimado compartido (`/c/<código>`, en el servidor). Vive acá,
 * y no dentro de la calculadora, para que las dos lleguen al mismo número por
 * el mismo camino: mismo mínimo, misma admisibilidad, mismo origen inferido.
 */

import {
  calculateImportQuote,
  checkAdmissibility,
  UnsupportedQuoteError,
  type ImportCalculatorInput,
  type PremiumImportQuote,
} from "@/core/pricing/priceCalculator";
import type {
  PlanKey,
  VehicleCondition,
  VehicleOrigin,
} from "@/core/pricing/pricingConfig";
import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import { resolveOrigin, type OriginInference } from "@/core/pricing/originInference";
import { LUXCARS_CONFIG } from "@/lib/config";
import { formatCurrency } from "@/lib/utils";

export type QuoteRequest = {
  brand: string;
  model: string;
  year: string;
  priceMiami: number;
  vehicleType: VehicleCategoryId;
  condition: VehicleCondition;
  preferredPlan: PlanKey;
  /** Corrección manual del origen. `null`: se usa el que infiere el motor. */
  originOverride: VehicleOrigin | null;
  currentYear: number;
};

export type QuoteEvaluation =
  | { kind: "blocked"; reason: string }
  | { kind: "ready"; estimate: PremiumImportQuote; originInfo: OriginInference };

export function evaluateQuote(request: QuoteRequest): QuoteEvaluation {
  const minPrice = LUXCARS_CONFIG.services.minimumVehiclePrice;
  if (!(request.priceMiami >= minPrice)) {
    return {
      kind: "blocked",
      reason: `Importamos a pedido desde ${formatCurrency(minPrice)}. Por debajo de ese monto los costos fijos del proceso pesan demasiado sobre el valor del auto.`,
    };
  }

  const admissibility = checkAdmissibility({
    vehicleType: request.vehicleType,
    condition: request.condition,
    year: request.year,
    currentYear: request.currentYear,
  });
  if (!admissibility.allowed) return { kind: "blocked", reason: admissibility.reason };

  const brand = request.brand.trim();
  const model = request.model.trim();
  const originInfo = resolveOrigin(brand, model);

  const input: ImportCalculatorInput = {
    brand,
    model,
    year: request.year,
    priceMiami: request.priceMiami,
    vehicleType: request.vehicleType,
    condition: request.condition,
    origin: request.originOverride ?? originInfo.origin,
  };

  try {
    return {
      kind: "ready",
      estimate: calculateImportQuote(input, request.preferredPlan),
      originInfo,
    };
  } catch (err) {
    return {
      kind: "blocked",
      reason:
        err instanceof UnsupportedQuoteError
          ? err.message
          : "Hubo un problema al generar el estimado. Revisa los datos e intenta de nuevo.",
    };
  }
}
