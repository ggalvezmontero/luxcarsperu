import type { Vehicle } from "@/lib/db/types";

/** Tipos y etiquetas del stock compartidos por servidor y cliente. */
export type StockVehicle = Vehicle & { isDemo?: boolean };

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
