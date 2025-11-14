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
    id: "suv-premium",
    label: "SUV Premium / Lujo",
    iscRate: 0.3,
    tooltip:
      "Las SUVs de lujo generalmente tienen un ISC aproximado del 30% según tablas SUNAT.",
  },
  {
    id: "deportivo",
    label: "Deportivo / Superdeportivo",
    iscRate: 0.4,
    tooltip:
      "Los superdeportivos y autos de alta cilindrada suelen tener un ISC cercano al 40%.",
  },
  {
    id: "ev",
    label: "Eléctrico (EV)",
    iscRate: 0,
    tooltip:
      "Los vehículos 100% eléctricos están exonerados del ISC (0%).",
  },
  {
    id: "phev",
    label: "Híbrido Enchufable (PHEV)",
    iscRate: 0.02,
    tooltip:
      "Los híbridos enchufables tienen un ISC preferencial aproximado del 2%.",
  },
  {
    id: "hev",
    label: "Híbrido (HEV)",
    iscRate: 0.1,
    tooltip:
      "Los híbridos no enchufables suelen tributar un ISC estimado del 10%.",
  },
  {
    id: "pickup",
    label: "Pickup / Camioneta",
    iscRate: 0.2,
    tooltip:
      "ISC estimado para camionetas o pickups orientadas a uso mixto.",
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
