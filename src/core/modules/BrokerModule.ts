import { PRICING_CONFIG } from "../pricing/pricingConfig";

export type BrokerContext = {
  /**
   * Costo del auto puesto en Lima ANTES de la comisión: CIF + tributos + costos
   * de aduana. No incluye el recargo de Fast Track ni la percepción.
   */
  costBeforeFee: number;
};

export const BrokerModule = {
  /** Comisión de Luxcars. La base y la forma de aplicarla viven en `PRICING_CONFIG`. */
  calculate(context: BrokerContext) {
    const tasa = PRICING_CONFIG.brokerFeeRate;
    if (PRICING_CONFIG.brokerFeeBase === "sobre-precio-final") {
      // La comisión es `tasa` del precio final: final = costo + comisión.
      return (context.costBeforeFee * tasa) / (1 - tasa);
    }
    return context.costBeforeFee * tasa;
  },
};
