import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import type { PlanKey } from "@/core/pricing/pricingConfig";
import rawPresets from "./trendingSimulationPresets.json";
import rawVehicles from "./trendingVehicles.json";

export type TrendingVehicleCalculatorPreset = {
  brand: string;
  model: string;
  priceUsd: number;
  vehicleType: VehicleCategoryId;
  preferredPlan?: PlanKey;
};

export type TrendingVehicle = {
  id: string;
  name: string;
  detail: string;
  segment: string;
  priceMinUsd: number;
  priceMaxUsd: number;
  imageSrc: string;
  imageAlt: string;
  calculator: TrendingVehicleCalculatorPreset;
};

type RawVehicle = {
  id: string;
  name: string;
  detail: string;
  segment: string;
  priceMinUsd: number;
  priceMaxUsd: number;
  imageSrc: string;
  imageAlt: string;
};

type RawPreset = {
  id: string;
  brand: string;
  model: string;
  vehicleType: VehicleCategoryId;
  priceUsd: number;
  preferredPlan?: PlanKey;
};

function buildTrendingVehicles(): TrendingVehicle[] {
  const presets = new Map<string, RawPreset>(
    (rawPresets as RawPreset[]).map((p) => [p.id, p]),
  );

  return (rawVehicles as RawVehicle[]).map((v) => {
    const preset = presets.get(v.id);
    if (!preset) {
      throw new Error(
        `[trendingVehicles] Falta entrada en trendingSimulationPresets.json para id="${v.id}"`,
      );
    }
    return {
      ...v,
      calculator: {
        brand: preset.brand,
        model: preset.model,
        priceUsd: preset.priceUsd,
        vehicleType: preset.vehicleType,
        preferredPlan: preset.preferredPlan,
      },
    };
  });
}

export const TRENDING_VEHICLES: readonly TrendingVehicle[] = buildTrendingVehicles();

export const TRENDING_BY_ID: Readonly<Record<string, TrendingVehicle>> =
  Object.fromEntries(TRENDING_VEHICLES.map((v) => [v.id, v]));

export function getTrendingVehicleById(id: string): TrendingVehicle | undefined {
  return TRENDING_BY_ID[id];
}
