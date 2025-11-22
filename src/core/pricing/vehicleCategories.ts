export type VehicleCategory = {
  id: VehicleCategoryId;
  label: string;
  iscRate: number;
  tooltip: string;
};

export type VehicleCategoryId =
  (typeof VEHICLE_CATEGORIES)[number]["id"];

export const VEHICLE_CATEGORIES: readonly VehicleCategory[] = [
  {
    id: "gasolina",
    label: "Gasolina",
    iscRate: 0.1,
    tooltip:
      "Vehículos a gasolina con ISC oficial del 10% sobre el CIF.",
  },
  {
    id: "hev",
    label: "Híbrido HEV",
    iscRate: 0.1,
    tooltip:
      "Híbridos HEV mantienen ISC referencial del 10% aplicado al CIF.",
  },
  {
    id: "diesel",
    label: "Diésel",
    iscRate: 0.4,
    tooltip:
      "Vehículos diésel tributan un ISC de referencia del 40% sobre el CIF.",
  },
  {
    id: "ev",
    label: "Eléctrico (EV)",
    iscRate: 0,
    tooltip:
      "Vehículos eléctricos (EV) están exonerados del ISC (0%).",
  },
  {
    id: "phev",
    label: "Híbrido enchufable PHEV",
    iscRate: 0,
    tooltip:
      "Híbridos enchufables PHEV cuentan con ISC 0% en la normativa vigente.",
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
