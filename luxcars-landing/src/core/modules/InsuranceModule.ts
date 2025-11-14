import { PRICING_CONFIG } from "../pricing/pricingConfig";

export type InsuranceContext = {
  priceMiami: number;
  freight: number;
};

export const InsuranceModule = {
  calculate(context: InsuranceContext) {
    return (
      (context.priceMiami + context.freight) *
      PRICING_CONFIG.insuranceRate
    );
  },
};
