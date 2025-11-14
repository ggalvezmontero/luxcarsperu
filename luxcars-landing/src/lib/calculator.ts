import {
  LUXCARS_CONFIG,
  type CalculatorInput,
  type VehicleTypeId,
} from "./config";
import {
  PRICING_CONFIG,
  LOCAL_FIXED_FEE_ORDER,
  type LocalFixedFee,
  type PlanConfig,
  type PlanKey,
} from "./pricingConfig";

type VehicleTypeConfig = (typeof LUXCARS_CONFIG.vehicleTypes)[number];

export type LogisticsBreakdown = {
  freightBase: number;
  freight: number;
  freightAdjustment: number;
  insurance: number;
  cif: number;
};

export type FeeBreakdown = {
  adValorem: number;
  isc: number;
  iscRate: number;
  iscTooltip: string;
  igv: number;
  stateComplianceFee: number;
  brokerFee: number;
  documentHandlingFee: number;
  localFixedFees: LocalFixedFee[];
  localFixedTotal: number;
  finalEstimate: number;
  finalRange: { min: number; max: number };
  peruMarketReference: number;
  savingsVsPeru: number;
  planKey: PlanKey;
  planConfig: PlanConfig;
};

export type ImportEstimate = LogisticsBreakdown &
  FeeBreakdown & {
    input: CalculatorInput;
    vehicleType: VehicleTypeConfig;
  };

export function getVehicleTypeConfig(
  vehicleType: VehicleTypeId,
): VehicleTypeConfig {
  return (
    LUXCARS_CONFIG.vehicleTypes.find(({ id }) => id === vehicleType) ??
    LUXCARS_CONFIG.vehicleTypes[0]
  );
}

export function calculateLogistics(
  priceMiami: number,
  vehicleType: VehicleTypeConfig,
  plan: PlanConfig,
): LogisticsBreakdown {
  const freightBase =
    PRICING_CONFIG.freightByType[vehicleType.id as VehicleTypeId] ?? 2000;
  const freight = freightBase * plan.fleteAdjustment;
  const insurance =
    (priceMiami + freight) * PRICING_CONFIG.insuranceRate;
  const cif = priceMiami + freight + insurance;

  return {
    freightBase,
    freight,
    freightAdjustment: plan.fleteAdjustment,
    insurance,
    cif,
  };
}

export function calculateFees(
  priceMiami: number,
  vehicleType: VehicleTypeConfig,
  logistics: LogisticsBreakdown,
  planKey: PlanKey,
  planConfig: PlanConfig,
  peruPrice?: number,
): FeeBreakdown {
  const { services } = LUXCARS_CONFIG;
  const iscRule = PRICING_CONFIG.iscRules[vehicleType.id as VehicleTypeId];
  const iscRate = iscRule?.rate ?? vehicleType.iscRate ?? 0;
  const iscTooltip =
    iscRule?.reason ??
    vehicleType.tooltip ??
    "ISC estimado según categoría seleccionada.";

  const adValorem = logistics.cif * PRICING_CONFIG.adValoremRate;
  const isc = logistics.cif * iscRate;
  const igv =
    (logistics.cif + adValorem + isc) * PRICING_CONFIG.igvRate;
  const stateComplianceFee =
    priceMiami * PRICING_CONFIG.stateComplianceRate;
  const brokerFee = priceMiami * PRICING_CONFIG.brokerFeeRate;

  const localFixedFees = LOCAL_FIXED_FEE_ORDER.map(
    (key) => PRICING_CONFIG.localFixedFees[key],
  );
  const localFixedTotal = localFixedFees.reduce(
    (total, fee) => total + fee.amount,
    0,
  );
  const documentHandlingFee = planConfig.documentHandlingFee;

  const finalEstimate =
    logistics.cif +
    adValorem +
    isc +
    igv +
    stateComplianceFee +
    brokerFee +
    localFixedTotal +
    documentHandlingFee;

  const variance = services.finalRangeVariance;
  const finalRange = {
    min: finalEstimate * (1 - variance),
    max: finalEstimate * (1 + variance),
  };

  const peruMarketReference =
    typeof peruPrice === "number" && !Number.isNaN(peruPrice)
      ? peruPrice
      : priceMiami * (1 + services.localMarketMarkup);

  const savingsVsPeru = peruMarketReference - finalEstimate;

  return {
    adValorem,
    isc,
    iscRate,
    iscTooltip,
    igv,
    stateComplianceFee,
    brokerFee,
    documentHandlingFee,
    localFixedFees,
    localFixedTotal,
    finalEstimate,
    finalRange,
    peruMarketReference,
    savingsVsPeru,
    planKey,
    planConfig,
  };
}

export function calculateImportCosts(
  input: CalculatorInput,
  requestedPlanKey: PlanKey = "fast",
): ImportEstimate {
  const vehicleType = getVehicleTypeConfig(input.vehicleType);
  const planConfig =
    PRICING_CONFIG.planConfigs[requestedPlanKey] ??
    PRICING_CONFIG.planConfigs.fast;
  const planKey = planConfig.key;
  const logistics = calculateLogistics(
    input.price,
    vehicleType,
    planConfig,
  );
  const fees = calculateFees(
    input.price,
    vehicleType,
    logistics,
    planKey,
    planConfig,
    input.peruPrice,
  );

  return {
    input,
    vehicleType,
    ...logistics,
    ...fees,
  };
}
