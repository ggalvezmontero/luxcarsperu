import type { VehicleTypeId } from "./config";

const FREIGHT_ESTIMATES: Record<VehicleTypeId, number> = {
  "suv-premium": 2000,
  deportivo: 2800,
  pickup: 2300,
  ev: 2200,
  phev: 1700,
  hev: 1700,
};

export const PRICING_CONFIG = {
  freightByType: FREIGHT_ESTIMATES,
  insuranceRate: 0.015,
  adValoremRate: 0.06,
  igvRate: 0.18,
  stateComplianceRate: 0.07,
  brokerFeeRate: 0.1,
  localFixedCosts: [
    {
      id: "technical-inspection",
      label: "Revisión técnica inicial",
      amount: 450,
    },
    {
      id: "plates",
      label: "Placas e inscripción",
      amount: 160,
    },
    {
      id: "paperwork",
      label: "Gestoría y trámites locales",
      amount: 320,
    },
  ] as const,
};

export type LocalFixedCost = (typeof PRICING_CONFIG.localFixedCosts)[number];
