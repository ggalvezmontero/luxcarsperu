import { PRICING_CONFIG } from "../pricing/pricingConfig";

export type InsuranceContext = {
  priceMiami: number;
  freight: number;
};

export const InsuranceModule = {
  /**
   * Seguro internacional de carga: 0.35% sobre el valor asegurado, que por
   * convención es el 110% del FOB más el flete, con un mínimo de USD 45.
   */
  calculate(context: InsuranceContext) {
    const insuredValue =
      (context.priceMiami + context.freight) *
      PRICING_CONFIG.insuredValueFactor;

    return Math.max(
      PRICING_CONFIG.insuranceMinimum,
      insuredValue * PRICING_CONFIG.insuranceRate,
    );
  },
};
