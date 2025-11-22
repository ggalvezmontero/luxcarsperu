import type { VehicleCategoryId } from "./vehicleCategories";

const FREIGHT_ESTIMATES: Record<VehicleCategoryId, number> = {
  gasolina: 2100,
  hev: 1900,
  diesel: 2400,
  ev: 2200,
  phev: 2000,
};

export const PRICING_CONFIG = {
  freightByCategory: FREIGHT_ESTIMATES,
  insuranceRate: 0.015,
  adValoremRate: 0.06,
  igvRate: 0.18,
  stateComplianceRate: 0.05,
  brokerFeeRate: 0.1,
  planConfigs: {
    fast: {
      key: "fast",
      label: "Fast Track",
      fleteAdjustment: 1.15,
      documentHandlingFee: 150,
      timelineLabel: "30-40 días",
    },
    standard: {
      key: "standard",
      label: "Estándar",
      fleteAdjustment: 1,
      documentHandlingFee: 0,
      timelineLabel: "40-60 días",
    },
  } as const,
} as const;

export type PlanKey = keyof typeof PRICING_CONFIG.planConfigs;
export type PlanConfig =
  (typeof PRICING_CONFIG.planConfigs)[PlanKey];
