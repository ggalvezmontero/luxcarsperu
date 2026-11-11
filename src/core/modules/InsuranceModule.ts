import { PRICING_CONFIG } from "../pricing/pricingConfig";

export type InsuranceContext = {
  priceMiami: number;
};

export const InsuranceModule = {
  /**
   * Seguro internacional de carga: la tasa de `PRICING_CONFIG.insuranceRate`
   * sobre el valor asegurado, que es el 110% del precio del vehículo, con un
   * mínimo de USD 45. El flete no entra en el valor asegurado.
   */
  calculate(context: InsuranceContext) {
    const insuredValue = context.priceMiami * PRICING_CONFIG.insuredValueFactor;

    return Math.max(
      PRICING_CONFIG.insuranceMinimum,
      insuredValue * PRICING_CONFIG.insuranceRate,
    );
  },
};
