import { PRICING_CONFIG } from "../pricing/pricingConfig";

export type BrokerContext = {
  priceMiami: number;
};

export const BrokerModule = {
  calculate(context: BrokerContext) {
    return context.priceMiami * PRICING_CONFIG.brokerFeeRate;
  },
};
