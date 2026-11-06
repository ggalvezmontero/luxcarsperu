/**
 * Textos en lenguaje llano para los valores cerrados de un ejemplo. La base
 * guarda las claves (`msrp-oficial`, `hev`…); el dueño lee estas etiquetas.
 * Los `Record` completos obligan a sumar la etiqueta si mañana aparece un
 * valor nuevo en `validacion.ts`.
 */

import type { PlanKey } from "@/core/pricing/pricingConfig";
import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import type {
  TrendingVehicleAdValoremStatus,
  TrendingVehicleImportViability,
  TrendingVehiclePriceBasis,
} from "@/data/trendingVehicles";

export const PRICE_BASIS_LABEL: Record<TrendingVehiclePriceBasis, string> = {
  "msrp-oficial": "Precio oficial de fábrica (MSRP verificado)",
  "referencial-miami": "Rango referencial del mercado en EE.UU.",
  "lista-peru": "Precio de lista en Perú (concesionario local)",
};

export const VIABILITY_LABEL: Record<TrendingVehicleImportViability, string> = {
  importable: "Importable",
  "importable-con-advertencia": "Importable con aviso",
  "no-conviene-importar": "No conviene importar",
};

export const AD_VALOREM_LABEL: Record<TrendingVehicleAdValoremStatus, string> = {
  "candidato-0": "Candidato a 0%: se ensambla solo en EE.UU.",
  "no-califica": "No califica: se ensambla fuera de EE.UU., paga 6%",
  "depende-vin": "Depende del VIN: se cotiza 6% hasta verlo",
};

/** Los motores que acepta un ejemplo (`EXAMPLE_VEHICLE_TYPES`). */
export const VEHICLE_TYPE_LABEL: Record<VehicleCategoryId, string> = {
  gasolina: "Gasolina",
  hev: "Híbrido",
  phev: "Híbrido enchufable",
  ev: "Eléctrico",
  diesel: "Diésel",
};

export const PLAN_LABEL: Record<PlanKey, string> = {
  fast: "Fast Track",
  standard: "Estándar",
};
