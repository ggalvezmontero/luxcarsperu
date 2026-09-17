import type { Vehicle } from "@/lib/db/types";

/** Tipos y etiquetas del stock compartidos por servidor y cliente. */
export type StockVehicle = Vehicle & { isDemo?: boolean };

/**
 * Un consignado es el auto de un cliente que LuxCars vende por él, sin
 * exclusividad. Se publica junto al stock propio pero SIEMPRE etiquetado:
 * el comprador debe saber antes de la visita que el dueño es otro.
 */
export function isConsignment(vehicle: Pick<Vehicle, "source">) {
  return vehicle.source === "consignacion";
}

export const CONSIGNMENT_LABEL = "En consignación";
export const OWN_STOCK_LABEL = "Stock propio";

export const STATUS_LABEL: Record<Vehicle["status"], string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
  en_transito: "En camino",
};

export const CATEGORY_LABEL: Record<Vehicle["category"], string> = {
  gasolina: "Gasolina",
  hev: "Híbrido",
  diesel: "Diésel",
  ev: "Eléctrico",
  phev: "Híbrido enchufable",
};
