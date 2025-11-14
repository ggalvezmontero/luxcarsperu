import {
  LUXCARS_CONFIG,
  type CalculatorInput,
  type VehicleTypeId,
} from "./config";

type VehicleTypeConfig = (typeof LUXCARS_CONFIG.vehicleTypes)[number];

export type LogisticsBreakdown = {
  shipping: number;
  insurance: number;
  cif: number;
};

export type FeeBreakdown = {
  isc: number;
  iscRate: number;
  igv: number;
  stateComplianceFee: number;
  brokerFee: number;
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

export function calculateLogistics(priceMiami: number): LogisticsBreakdown {
  const { services } = LUXCARS_CONFIG;
  const shipping = Math.max(
    services.shippingBase,
    priceMiami * services.shippingRate,
  );
  const insurance = Math.max(
    services.insuranceMinimum,
    priceMiami * services.insuranceRate,
  );
  const cif = priceMiami + shipping + insurance;

  return { shipping, insurance, cif };
}

export function calculateFees(
  priceMiami: number,
  vehicleType: VehicleTypeConfig,
  logistics: LogisticsBreakdown,
  peruPrice?: number,
): FeeBreakdown {
  const { services } = LUXCARS_CONFIG;

  const isc = logistics.cif * vehicleType.iscRate;
  const igv = (logistics.cif + isc) * services.igvRate;
  const stateComplianceFee = priceMiami * services.stateComplianceRate;
  const brokerFee = priceMiami * services.brokerFeeRate;

  const finalEstimate =
    logistics.cif + isc + igv + stateComplianceFee + brokerFee;

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
    isc,
    iscRate: vehicleType.iscRate,
    igv,
    stateComplianceFee,
    brokerFee,
    finalEstimate,
    finalRange,
    peruMarketReference,
    savingsVsPeru,
  };
}

export function calculateImportCosts(input: CalculatorInput): ImportEstimate {
  const vehicleType = getVehicleTypeConfig(input.vehicleType);
  const logistics = calculateLogistics(input.price);
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
