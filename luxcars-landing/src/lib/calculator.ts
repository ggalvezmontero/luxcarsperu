import { LUXCARS_CONFIG, type CalculatorInput } from "./config";

export type ImportEstimate = {
  input: CalculatorInput;
  shippingInsurance: number;
  adValorem: number;
  isc: number;
  igv: number;
  adminFee: number;
  brokerFee: number;
  cif: number;
  finalEstimate: number;
  finalRange: { min: number; max: number };
  peruMarketReference: number;
  savingsVsPeru: number;
  iscLabel: string;
};

export function calculateImportCosts(input: CalculatorInput): ImportEstimate {
  const { services, iscByBrand, iscDefault } = LUXCARS_CONFIG;
  const normalizedBrand = input.brand.toLowerCase();

  const iscConfig =
    Object.entries(iscByBrand).find(([key]) => normalizedBrand.includes(key))
      ?.[1] ?? iscDefault;

  const shippingInsurance = Math.max(
    services.shippingInsuranceBase,
    input.price * services.shippingInsuranceRate,
  );

  const cif = input.price + shippingInsurance;
  const adValorem = cif * services.adValoremRate;
  const isc = cif * iscConfig.rate;
  const igv = (cif + adValorem + isc) * services.igvRate;
  const adminFee = input.price * services.adminFeeRate;
  const brokerFee = input.price * services.brokerFeeRate;

  const finalEstimate =
    input.price +
    shippingInsurance +
    adValorem +
    isc +
    igv +
    adminFee +
    brokerFee;

  const variance = services.finalRangeVariance;
  const finalRange = {
    min: finalEstimate * (1 - variance),
    max: finalEstimate * (1 + variance),
  };

  const peruMarketReference = input.price * (1 + services.localMarketMarkup);
  const savingsVsPeru = peruMarketReference - finalEstimate;

  return {
    input,
    shippingInsurance,
    adValorem,
    isc,
    igv,
    adminFee,
    brokerFee,
    cif,
    finalEstimate,
    finalRange,
    peruMarketReference,
    savingsVsPeru,
    iscLabel: iscConfig.label,
  };
}
