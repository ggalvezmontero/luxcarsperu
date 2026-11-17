import { PRICING_CONFIG, type BrokerFeeTier } from "../pricing/pricingConfig";

export type BrokerContext = {
  /**
   * Costo del auto puesto en Lima ANTES de la comisión: CIF + tributos + costos
   * de aduana. No incluye el recargo de Fast Track ni la percepción.
   */
  costBeforeFee: number;
};

/** El tramo en que cae un costo: el primero cuyo tope lo cubre (el último no tiene tope). */
function tierFor(cost: number, tiers: readonly BrokerFeeTier[]): BrokerFeeTier {
  return tiers.find((t) => t.upTo === null || cost <= t.upTo) ?? tiers[tiers.length - 1];
}

export const BrokerModule = {
  /**
   * Comisión de Luxcars: la tasa del tramo en que cae el costo, aplicada
   * sobre TODO el costo, con un piso. La escala, el piso y la base viven en
   * `PRICING_CONFIG`.
   */
  calculate(context: BrokerContext): number {
    const { brokerFeeTiers, brokerFeeMinimum, brokerFeeBase } = PRICING_CONFIG;
    const cost = Math.max(0, context.costBeforeFee);

    if (brokerFeeBase === "sobre-precio-final") {
      // La escala se lee del precio final (costo + comisión), así que la
      // comisión depende de sí misma. Como cada tasa es menor que 1, la
      // iteración converge en pocos pasos.
      let fee = cost * tierFor(cost, brokerFeeTiers).rate;
      for (let i = 0; i < 50; i++) {
        const rate = tierFor(cost + fee, brokerFeeTiers).rate;
        const next = (cost * rate) / (1 - rate);
        if (Math.abs(next - fee) < 1e-6) break;
        fee = next;
      }
      return Math.max(fee, brokerFeeMinimum);
    }

    return Math.max(cost * tierFor(cost, brokerFeeTiers).rate, brokerFeeMinimum);
  },

  /** La tasa del tramo en que cae el costo, sin el piso. */
  rateFor(context: BrokerContext): number {
    return tierFor(Math.max(0, context.costBeforeFee), PRICING_CONFIG.brokerFeeTiers).rate;
  },

  /**
   * Tasa efectiva: comisión ÷ costo. Coincide con la del tramo salvo cuando
   * manda el piso; es la cifra que se muestra junto al monto.
   */
  effectiveRate(context: BrokerContext): number {
    if (context.costBeforeFee <= 0) return 0;
    return BrokerModule.calculate(context) / context.costBeforeFee;
  },

  /** Los tramos con su rango, listos para una tabla pública. */
  tiers(): Array<BrokerFeeTier & { from: number }> {
    let from = 0;
    return PRICING_CONFIG.brokerFeeTiers.map((tier) => {
      const row = { ...tier, from };
      from = tier.upTo ?? Number.POSITIVE_INFINITY;
      return row;
    });
  },
};
