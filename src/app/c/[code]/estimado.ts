/**
 * Estimado que hay detrás de un enlace `/c/<código>`.
 *
 * Lo usan la página y su imagen social, para que las dos muestren el mismo
 * número. El código trae los datos del formulario; acá se recalcula con el
 * motor de precios y las tasas de HOY (ver `lib/cotizacionCompartida.ts` para
 * el porqué de no guardar el resultado).
 */

import { evaluateQuote, type QuoteEvaluation } from "@/lib/cotizacion";
import { decodeSharedQuote, type SharedQuote } from "@/lib/cotizacionCompartida";
import { currentYearInLima } from "@/core/pricing/pricingConfig";

export type SharedEstimate = {
  quote: SharedQuote;
  /** "Chevrolet Corvette 2026", o "Vehículo 2026" si el modelo ya no está en el catálogo. */
  vehicleName: string;
  evaluation: QuoteEvaluation;
};

/** `null` si el código no es un estimado válido. */
export function resolveSharedEstimate(code: string): SharedEstimate | null {
  const quote = decodeSharedQuote(code);
  if (!quote) return null;

  const named = Boolean(quote.brand && quote.model);
  return {
    quote,
    vehicleName: named ? `${quote.brand} ${quote.model} ${quote.year}` : `Vehículo ${quote.year}`,
    evaluation: evaluateQuote({
      brand: quote.brand,
      model: quote.model,
      year: String(quote.year),
      priceMiami: quote.price,
      vehicleType: quote.vehicleType,
      condition: quote.condition,
      preferredPlan: quote.plan,
      originOverride: quote.origin,
      currentYear: currentYearInLima(),
    }),
  };
}
