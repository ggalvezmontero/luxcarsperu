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
  iscRate: number;
};

export type FiscalFeeBreakdown = {
  adValorem: number;
  isc: number;
  igv: number;
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

export function calculateFiscalFees(
  context: FiscalFeeContext,
): FiscalFeeBreakdown {
  const adValorem = context.cif * PRICING_CONFIG.adValoremRate;
  const isc = context.cif * context.iscRate;
  const igv =
    (context.cif + adValorem + isc) * PRICING_CONFIG.igvRate;

  return {
    adValorem,
    isc,
    igv,
  };
}
