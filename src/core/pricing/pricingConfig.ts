import type { VehicleCategoryId } from "./vehicleCategories";

const FREIGHT_ESTIMATES: Record<VehicleCategoryId, number> = {
  gasolina: 2100,
  hev: 1900,
  diesel: 2400,
  ev: 2200,
  phev: 2000,
};

/**
 * Origen del vehículo a efectos del ad valorem.
 *
 * OJO: el 0% del APC Perú–EE.UU. NO se gana por comprar en Miami. Exige que el
 * vehículo sea ORIGINARIO de EE.UU. (valor de contenido regional ≥ 35% por
 * costo neto), con certificado de origen y TPI 802 en la DAM. Un Toyota
 * japonés, un Kia coreano, un BMW alemán o un auto ensamblado en México,
 * comprados en Florida, pagan 6%.
 */
export type VehicleOrigin = "originario-usa" | "otro";

/** Condición del vehículo al momento de la importación. */
export type VehicleCondition = "nuevo" | "usado";

/**
 * Perfil del importador. Determina la tasa de percepción del IGV.
 */
export type ImporterProfile = "recurrente" | "primera-importacion";

const AD_VALOREM_BY_ORIGIN: Record<VehicleOrigin, number> = {
  "originario-usa": 0,
  otro: 0.06,
};

export const PRICING_CONFIG = {
  freightByCategory: FREIGHT_ESTIMATES,

  /**
   * Seguro internacional: 0.35% sobre el 110% del valor FOB + flete, con un
   * mínimo de USD 45. Reproduce de cerca la proforma real (modelado USD 157.81
   * vs USD 160.38 liquidados).
   */
  insuranceRate: 0.0035,
  insuredValueFactor: 1.1,
  insuranceMinimum: 45,

  adValoremByOrigin: AD_VALOREM_BY_ORIGIN,

  /**
   * Desde el ejercicio 2026 la composición legal del 18% es IGV 15.5% + IPM
   * 2.5% (Ley 32387). El total no cambia; el desglose sí. La proforma Heysen
   * ya usaba estas tasas.
   */
  igvRate: 0.155,
  ipmRate: 0.025,

  /**
   * Percepción del IGV a la importación. NO es un costo: es un adelanto que el
   * importador recupera como crédito fiscal. Pero sí es caja que hay que poner.
   *
   *   10%  primera importación, sin RUC o no afecto al IGV
   *    5%  mercancía usada
   *  3.5%  recurrente con mercancía nueva
   */
  percepcionRates: {
    primeraImportacion: 0.1,
    usado: 0.05,
    recurrenteNuevo: 0.035,
  },

  /**
   * Antigüedad máxima de un vehículo usado para poder nacionalizarse, contada
   * en años desde el año modelo.
   */
  usedMaxAgeYears: 2,

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

export function resolvePercepcionRate(params: {
  profile: ImporterProfile;
  condition: VehicleCondition;
}): number {
  const { percepcionRates } = PRICING_CONFIG;
  if (params.profile === "primera-importacion") {
    return percepcionRates.primeraImportacion;
  }
  return params.condition === "usado"
    ? percepcionRates.usado
    : percepcionRates.recurrenteNuevo;
}

export type PlanKey = keyof typeof PRICING_CONFIG.planConfigs;
export type PlanConfig =
  (typeof PRICING_CONFIG.planConfigs)[PlanKey];
