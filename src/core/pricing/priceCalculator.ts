import { IMPORTER_RULES } from "./importerRules";
import {
  PRICING_CONFIG,
  resolvePercepcionRate,
  type ImporterProfile,
  type PlanConfig,
  type PlanKey,
  type VehicleCondition,
  type VehicleOrigin,
} from "./pricingConfig";
import {
  calculateFiscalFees,
  calculateLogistics,
  type FiscalFeeBreakdown,
  type LogisticsBreakdown,
} from "./feeStrategies";
import {
  getVehicleCategory,
  resolveIscRate,
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
  condition: VehicleCondition;
  origin: VehicleOrigin;
  /** Solo cambia el ISC en gasolina nueva. Si falta, se asume > 1,500 cc. */
  cylinderCapacityCc?: number;
  importerProfile?: ImporterProfile;
};

export type PremiumImportQuote = LogisticsBreakdown &
  FiscalFeeBreakdown & {
    iscRate: number;
    iscTooltip: string;
    adValoremRate: number;
    stateComplianceFee: number;
    brokerFee: number;
    documentHandlingFee: number;
    /** Costo real de la importación. NO incluye la percepción, que es recuperable. */
    finalEstimate: number;
    /** Efectivo a desembolsar: el costo real más la percepción. */
    cashRequired: number;
    finalRange: { min: number; max: number };
    planKey: PlanKey;
    planConfig: PlanConfig;
    vehicleCategory: VehicleCategory;
    condition: VehicleCondition;
    origin: VehicleOrigin;
    input: ImportCalculatorInput;
  };

export function resolvePlanConfig(planKey: PlanKey): PlanConfig {
  return (
    PRICING_CONFIG.planConfigs[planKey] ??
    PRICING_CONFIG.planConfigs.fast
  );
}

/**
 * Deduce la condición a partir del año del modelo. Solo es un valor por
 * defecto: un auto del año ya matriculado se importa como usado.
 */
export function inferCondition(
  year: string,
  currentYear: number,
): VehicleCondition {
  const parsed = Number.parseInt(year, 10);
  if (!Number.isFinite(parsed)) return "usado";
  return parsed >= currentYear - 1 ? "nuevo" : "usado";
}

export type AdmissibilityResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Verifica que el vehículo se pueda nacionalizar antes de cotizarlo. Cotizar
 * algo que no puede entrar al país es peor que no cotizar nada.
 */
export function checkAdmissibility(params: {
  vehicleType: VehicleCategoryId;
  condition: VehicleCondition;
  year: string;
  currentYear: number;
}): AdmissibilityResult {
  const category = getVehicleCategory(params.vehicleType);

  if (params.condition === "nuevo") return { allowed: true };

  if (!category.usedImportAllowed) {
    return {
      allowed: false,
      reason:
        "El Perú prohíbe importar vehículos usados a diésel en autos, SUVs y camionetas (D. Leg. 843). Solo se pueden traer diésel nuevos.",
    };
  }

  const modelYear = Number.parseInt(params.year, 10);
  if (!Number.isFinite(modelYear)) return { allowed: true };

  const age = params.currentYear - modelYear;
  if (age > PRICING_CONFIG.usedMaxAgeYears) {
    const oldest = params.currentYear - PRICING_CONFIG.usedMaxAgeYears;
    return {
      allowed: false,
      reason:
        `Un vehículo usado no puede tener más de ${PRICING_CONFIG.usedMaxAgeYears} años desde su año modelo. ` +
        `En ${params.currentYear} el más antiguo que se puede nacionalizar es del ${oldest}.`,
    };
  }

  return { allowed: true };
}

export class UnsupportedQuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedQuoteError";
  }
}

export function calculateImportQuote(
  input: ImportCalculatorInput,
  requestedPlanKey: PlanKey = "fast",
): PremiumImportQuote {
  const planConfig = resolvePlanConfig(requestedPlanKey);
  const planKey = planConfig.key;
  const vehicleCategory = getVehicleCategory(input.vehicleType);

  const iscRate = resolveIscRate({
    category: vehicleCategory,
    condition: input.condition,
    cylinderCapacityCc: input.cylinderCapacityCc,
  });

  if (iscRate === null) {
    throw new UnsupportedQuoteError(
      `No se puede cotizar ${vehicleCategory.label} en condición "${input.condition}": ` +
        `su importación no está permitida.`,
    );
  }

  const adValoremRate = PRICING_CONFIG.adValoremByOrigin[input.origin];
  const percepcionRate = resolvePercepcionRate({
    profile: input.importerProfile ?? "recurrente",
    condition: input.condition,
  });

  const logistics = calculateLogistics({
    priceMiami: input.priceMiami,
    vehicleCategoryId: vehicleCategory.id,
    planConfig,
  });

  const fiscalFees = calculateFiscalFees({
    cif: logistics.cif,
    adValoremRate,
    iscRate,
    percepcionRate,
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
    fiscalFees.ipm +
    stateComplianceFee +
    brokerFee +
    documentHandlingFee;

  const cashRequired = finalEstimate + fiscalFees.percepcion;

  const variance = IMPORTER_RULES.finalRangeVariance;
  const finalRange = {
    min: finalEstimate * (1 - variance),
    max: finalEstimate * (1 + variance),
  };

  return {
    ...logistics,
    ...fiscalFees,
    iscRate,
    iscTooltip: vehicleCategory.tooltip,
    adValoremRate,
    stateComplianceFee,
    brokerFee,
    documentHandlingFee,
    finalEstimate,
    cashRequired,
    finalRange,
    planKey,
    planConfig,
    vehicleCategory,
    condition: input.condition,
    origin: input.origin,
    input,
  };
}
