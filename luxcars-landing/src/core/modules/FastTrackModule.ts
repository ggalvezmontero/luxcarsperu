import type { PlanConfig } from "../pricing/pricingConfig";

export type FastTrackContext = {
  planConfig: PlanConfig;
};

export const FastTrackModule = {
  calculateDocumentHandlingFee(context: FastTrackContext) {
    return context.planConfig.documentHandlingFee;
  },
};
