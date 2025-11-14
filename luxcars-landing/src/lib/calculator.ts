import {
  LUXCARS_CONFIG,
  type CalculatorInput,
  type VehicleTypeId,
} from "./config";
import {
  PRICING_CONFIG,
  type LocalFixedCost,
} from "./pricingConfig";

type VehicleTypeConfig = (typeof LUXCARS_CONFIG.vehicleTypes)[number];

export type LogisticsBreakdown = {
  freight: number;
  insurance: number;
  cif: number;
};

export type FeeBreakdown = {
  adValorem: number;
  isc: number;
  iscRate: number;
  igv: number;
  stateComplianceFee: number;
  brokerFee: number;
  localFixedCosts: readonly LocalFixedCost[];
  localFixedTotal: number;
  finalEstimate: number;
  finalRange: { min: number; max: number };
  peruMarketReference: number;
  savingsVsPeru: number;
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
): LogisticsBreakdown {
  const freight =
    PRICING_CONFIG.freightByType[vehicleType.id as VehicleTypeId] ?? 2000;
  const insurance =
    (priceMiami + freight) * PRICING_CONFIG.insuranceRate;
  const cif = priceMiami + freight + insurance;

  return { freight, insurance, cif };
}

export function calculateFees(
  priceMiami: number,
  vehicleType: VehicleTypeConfig,
  logistics: LogisticsBreakdown,
  peruPrice?: number,
): FeeBreakdown {
  const { services } = LUXCARS_CONFIG;

  const adValorem = logistics.cif * PRICING_CONFIG.adValoremRate;
  const isc = logistics.cif * vehicleType.iscRate;
  const igv =
    (logistics.cif + adValorem + isc) * PRICING_CONFIG.igvRate;
  const stateComplianceFee =
    priceMiami * PRICING_CONFIG.stateComplianceRate;
  const brokerFee = priceMiami * PRICING_CONFIG.brokerFeeRate;

  const localFixedTotal = PRICING_CONFIG.localFixedCosts.reduce(
    (total, cost) => total + cost.amount,
    0,
  );

  const finalEstimate =
    logistics.cif +
    adValorem +
    isc +
    igv +
    stateComplianceFee +
    brokerFee +
    localFixedTotal;

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
    iscRate: vehicleType.iscRate,
    igv,
    stateComplianceFee,
    brokerFee,
    localFixedCosts: PRICING_CONFIG.localFixedCosts,
    localFixedTotal,
    finalEstimate,
    finalRange,
    peruMarketReference,
    savingsVsPeru,
  };
}

export function calculateImportCosts(input: CalculatorInput): ImportEstimate {
  const vehicleType = getVehicleTypeConfig(input.vehicleType);
  const logistics = calculateLogistics(input.price, vehicleType);
  const fees = calculateFees(
    input.price,
    vehicleType,
    logistics,
    input.peruPrice,
  );

  return {
    input,
    vehicleType,
    ...logistics,
    ...fees,
  };
}
