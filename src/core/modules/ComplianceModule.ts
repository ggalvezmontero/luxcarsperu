import { PRICING_CONFIG } from "../pricing/pricingConfig";

export type ComplianceContext = {
  priceMiami: number;
};

export const ComplianceModule = {
  calculate(context: ComplianceContext) {
    return context.priceMiami * PRICING_CONFIG.stateComplianceRate;
  },
};
