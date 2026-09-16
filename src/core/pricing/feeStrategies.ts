import { PRICING_CONFIG } from "./pricingConfig";
import type { PlanConfig } from "./pricingConfig";
import type { VehicleCategoryId } from "./vehicleCategories";
import { InsuranceModule } from "../modules/InsuranceModule";

export type LogisticsContext = {
  priceMiami: number;
  vehicleCategoryId: VehicleCategoryId;
  planConfig: PlanConfig;
};

export type LogisticsBreakdown = {
  freightBase: number;
  freight: number;
  freightAdjustment: number;
  insurance: number;
  cif: number;
};

export type FiscalFeeContext = {
  cif: number;
  adValoremRate: number;
  iscRate: number;
  percepcionRate: number;
};

export type FiscalFeeBreakdown = {
  adValorem: number;
  isc: number;
  igv: number;
  ipm: number;
  percepcion: number;
  /** Bases de cada tramo, para poder mostrar el desglose como lo hace un agente de aduana. */
  iscBase: number;
  igvBase: number;
  percepcionBase: number;
  percepcionRate: number;
};

export function calculateLogistics(
  context: LogisticsContext,
): LogisticsBreakdown {
  const freightBase =
    PRICING_CONFIG.freightByCategory[context.vehicleCategoryId] ?? 2000;
  const freight = freightBase * context.planConfig.fleteAdjustment;
  const insurance = InsuranceModule.calculate({
    priceMiami: context.priceMiami,
    freight,
  });
  const cif = context.priceMiami + freight + insurance;

  return {
    freightBase,
    freight,
    freightAdjustment: context.planConfig.fleteAdjustment,
    insurance,
    cif,
  };
}

/**
 * Los tributos de importación se encadenan: cada tramo se calcula sobre el
 * valor en aduana más los tributos anteriores, no sobre el CIF pelado.
 *
 *   ad valorem  → CIF
 *   ISC         → CIF + ad valorem
 *   IGV e IPM   → CIF + ad valorem + ISC
 *   percepción  → CIF + ad valorem + ISC + IGV + IPM
 *
 * La cascada está verificada contra la proforma Heysen 202602537: la percepción
 * liquidada (S/ 5,813.89 al 3.5%) implica una base de S/ 166,111.14, que es
 * exactamente CIF + IGV + IPM (S/ 166,110.88) salvo redondeo.
 */
export function calculateFiscalFees(
  context: FiscalFeeContext,
): FiscalFeeBreakdown {
  const adValorem = context.cif * context.adValoremRate;

  const iscBase = context.cif + adValorem;
  const isc = iscBase * context.iscRate;

  const igvBase = iscBase + isc;
  const igv = igvBase * PRICING_CONFIG.igvRate;
  const ipm = igvBase * PRICING_CONFIG.ipmRate;

  const percepcionBase = igvBase + igv + ipm;
  const percepcion = percepcionBase * context.percepcionRate;

  return {
    adValorem,
    isc,
    igv,
    ipm,
    percepcion,
    iscBase,
    igvBase,
    percepcionBase,
    percepcionRate: context.percepcionRate,
  };
}
