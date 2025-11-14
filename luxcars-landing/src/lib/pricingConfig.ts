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
  localFixedFees: {
    revisionTecnica: {
      key: "revisionTecnica",
      label: "Revisión técnica inicial",
      amount: 450,
    },
    placas: {
      key: "placas",
      label: "Placas e inscripción",
      amount: 160,
    },
    gestor: {
      key: "gestor",
      label: "Gestoría y trámites locales",
      amount: 320,
    },
  } as const,
  iscRules: {
    ev: {
      rate: 0,
      reason: "Vehículos 100% eléctricos están exonerados del ISC (0%).",
    },
    phev: {
      rate: 0.02,
      reason: "Híbridos enchufables cuentan con ISC preferencial del 2%.",
    },
    hev: {
      rate: 0.1,
      reason: "Híbridos no enchufables tributan aproximadamente 10% de ISC.",
    },
    "suv-premium": {
      rate: 0.3,
      reason: "SUVs premium y de lujo aplican un ISC referencial del 30%.",
    },
    deportivo: {
      rate: 0.4,
      reason:
        "Deportivos y superdeportivos de alta cilindrada tributan un ISC cercano al 40%.",
    },
    pickup: {
      rate: 0.2,
      reason:
        "Pickups orientadas a uso mixto aplican un ISC estimado del 20%.",
    },
  } satisfies Record<VehicleTypeId, { rate: number; reason: string }>,
};

export type PlanKey = keyof typeof PRICING_CONFIG.planConfigs;
export type PlanConfig = (typeof PRICING_CONFIG.planConfigs)[PlanKey];

export type LocalFixedFeeKey = keyof typeof PRICING_CONFIG.localFixedFees;
export type LocalFixedFee =
  (typeof PRICING_CONFIG.localFixedFees)[LocalFixedFeeKey];

export const LOCAL_FIXED_FEE_ORDER: LocalFixedFeeKey[] = [
  "revisionTecnica",
  "placas",
  "gestor",
];
