export const IMPORTER_RULES = {
  minimumVehiclePrice: 30000,
  finalRangeVariance: 0.025,
} as const;

export type ImporterRules = typeof IMPORTER_RULES;
