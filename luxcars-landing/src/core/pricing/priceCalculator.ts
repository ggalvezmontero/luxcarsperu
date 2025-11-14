import { IMPORTER_RULES } from "./importerRules";
import {
  PRICING_CONFIG,
  type PlanConfig,
  type PlanKey,
} from "./pricingConfig";
import {
  calculateFiscalFees,
  calculateLogistics,
  type FiscalFeeBreakdown,
  type LogisticsBreakdown,
} from "./feeStrategies";
import {
  getVehicleCategory,
  type VehicleCategory,
  type VehicleCategoryId,
} from "./vehicleCategories";
import { ComplianceModule } from "../modules/ComplianceModule";
import { BrokerModule } from "../modules/BrokerModule";
import { FastTrackModule } from "../modules/FastTrackModule";

export type ImportCalculatorInput = {
  brand: string;
  model: string;
  year: string;
  priceMiami: number;
  vehicleType: VehicleCategoryId;
};

export type PremiumImportQuote = LogisticsBreakdown &
  FiscalFeeBreakdown & {
    iscRate: number;
    iscTooltip: string;
    stateComplianceFee: number;
    brokerFee: number;
    documentHandlingFee: number;
    finalEstimate: number;
    finalRange: { min: number; max: number };
    planKey: PlanKey;
    planConfig: PlanConfig;
    vehicleCategory: VehicleCategory;
    input: ImportCalculatorInput;
  };

export function resolvePlanConfig(planKey: PlanKey): PlanConfig {
  return (
    PRICING_CONFIG.planConfigs[planKey] ??
    PRICING_CONFIG.planConfigs.fast
  );
}

export function calculateImportQuote(
  input: ImportCalculatorInput,
  requestedPlanKey: PlanKey = "fast",
): PremiumImportQuote {
  const planConfig = resolvePlanConfig(requestedPlanKey);
  const planKey = planConfig.key;
  const vehicleCategory = getVehicleCategory(input.vehicleType);

  const logistics = calculateLogistics({
    priceMiami: input.priceMiami,
    vehicleCategoryId: vehicleCategory.id,
    planConfig,
  });

  const fiscalFees = calculateFiscalFees({
    cif: logistics.cif,
    iscRate: vehicleCategory.iscRate,
  });

  const stateComplianceFee = ComplianceModule.calculate({
    priceMiami: input.priceMiami,
  });

  const brokerFee = BrokerModule.calculate({
    priceMiami: input.priceMiami,
  });

  const documentHandlingFee =
    FastTrackModule.calculateDocumentHandlingFee({
      planConfig,
    });

  const finalEstimate =
    logistics.cif +
    fiscalFees.adValorem +
    fiscalFees.isc +
    fiscalFees.igv +
    stateComplianceFee +
    brokerFee +
    documentHandlingFee;

  const variance = IMPORTER_RULES.finalRangeVariance;
  const finalRange = {
    min: finalEstimate * (1 - variance),
    max: finalEstimate * (1 + variance),
  };

  return {
    ...logistics,
    ...fiscalFees,
    iscRate: vehicleCategory.iscRate,
    iscTooltip: vehicleCategory.tooltip,
    stateComplianceFee,
    brokerFee,
    documentHandlingFee,
    finalEstimate,
    finalRange,
    planKey,
    planConfig,
    vehicleCategory,
    input,
  };
}
