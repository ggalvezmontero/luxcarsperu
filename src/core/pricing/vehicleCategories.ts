import type { VehicleCondition } from "./pricingConfig";

export type VehicleCategoryId =
  | "gasolina"
  | "hev"
  | "diesel"
  | "ev"
  | "phev";

/**
 * TODO vehículo usado de la partida 87.03 paga 40% de ISC, sin importar la
 * propulsión. Literal A del Nuevo Apéndice IV del TUO de la Ley del IGV e ISC
 * (D.S. 055-99-EF), entrada "8703.40.10.00 / 8703.80.90.90 — Sólo: vehículos
 * automóviles USADOS". Vigente desde el D.S. 181-2019-EF (16.6.2019).
 *
 * El 10% que circula para usados viene de bloques rotulados "TEXTO ANTERIOR"
 * en el PDF oficial: redacción derogada en 2019.
 */
export const USED_ISC_RATE = 0.4;

/**
 * El ISC de gasolina nueva es escalonado por cilindrada, no plano.
 */
const GASOLINE_NEW_BRACKETS: readonly { maxCc: number; rate: number }[] = [
  { maxCc: 1400, rate: 0.05 },
  { maxCc: 1500, rate: 0.075 },
  { maxCc: Number.POSITIVE_INFINITY, rate: 0.1 },
];

export type VehicleCategory = {
  id: VehicleCategoryId;
  label: string;
  /** Tasa para vehículo nuevo. null en gasolina: depende de la cilindrada. */
  newIscRate: number | null;
  /** El usado a diésel no es una tarifa: es importación prohibida. */
  usedImportAllowed: boolean;
  tooltip: string;
};

export const VEHICLE_CATEGORIES: readonly VehicleCategory[] = [
  {
    id: "gasolina",
    label: "Gasolina",
    newIscRate: null,
    usedImportAllowed: true,
    tooltip:
      "Nuevo: ISC escalonado por cilindrada (5% hasta 1,400 cc, 7.5% hasta 1,500 cc, 10% por encima). Usado: 40%.",
  },
  {
    id: "hev",
    label: "Híbrido full (HEV)",
    newIscRate: 0,
    usedImportAllowed: true,
    tooltip:
      "Nuevo: no gravado (0%), las subpartidas 8703.40/8703.50 no figuran en el Apéndice IV. Usado: 40%. Ojo: un mild-hybrid 48V NO califica aquí, tributa como gasolina.",
  },
  {
    id: "diesel",
    label: "Diésel",
    newIscRate: 0.2,
    usedImportAllowed: false,
    tooltip:
      "Nuevo: 20%. El diésel USADO está prohibido de importar en autos, SUVs y camionetas (D. Leg. 843, texto del D.S. 005-2020-MTC).",
  },
  {
    id: "ev",
    label: "Eléctrico (EV)",
    newIscRate: 0,
    usedImportAllowed: true,
    tooltip:
      "Nuevo: no gravado (0%). Usado: 40%, igual que cualquier otro usado de la partida 87.03.",
  },
  {
    id: "phev",
    label: "Híbrido enchufable (PHEV)",
    newIscRate: 0,
    usedImportAllowed: true,
    tooltip:
      "Nuevo: no gravado (0%). Usado: 40%, igual que cualquier otro usado de la partida 87.03.",
  },
] as const;

export function getVehicleCategory(
  id: VehicleCategoryId,
): VehicleCategory {
  return (
    VEHICLE_CATEGORIES.find((category) => category.id === id) ??
    VEHICLE_CATEGORIES[0]
  );
}

export function gasolineNewIscRate(cylinderCapacityCc: number): number {
  const bracket = GASOLINE_NEW_BRACKETS.find(
    (b) => cylinderCapacityCc <= b.maxCc,
  );
  return bracket ? bracket.rate : 0.1;
}

/**
 * Resuelve la tasa de ISC. Devuelve null cuando la combinación no se puede
 * cotizar (hoy solo el usado a diésel, que está prohibido de importar).
 */
export function resolveIscRate(params: {
  category: VehicleCategory;
  condition: VehicleCondition;
  cylinderCapacityCc?: number;
}): number | null {
  const { category, condition, cylinderCapacityCc } = params;

  if (condition === "usado") {
    return category.usedImportAllowed ? USED_ISC_RATE : null;
  }

  if (category.newIscRate !== null) return category.newIscRate;

  // Gasolina nueva sin cilindrada declarada: se asume el tramo más alto, que es
  // el de la enorme mayoría del catálogo de LuxCars (autos sobre 1,500 cc).
  return gasolineNewIscRate(cylinderCapacityCc ?? 2000);
}
