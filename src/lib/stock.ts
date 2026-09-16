import "server-only";

import { getPublishedVehicles, getVehicleById } from "@/lib/db/vehicles";
import { isDatabaseConfigured } from "@/lib/db/client";
import type { Vehicle } from "@/lib/db/types";
import type { StockVehicle } from "@/lib/stockLabels";

export type { StockVehicle } from "@/lib/stockLabels";
export { STATUS_LABEL, CATEGORY_LABEL } from "@/lib/stockLabels";

/**
 * Capa única de lectura del stock para la web pública.
 *
 * Con Supabase configurado, devuelve el inventario real (vista pública).
 * Sin base de datos, devuelve unidades de DEMOSTRACIÓN claramente marcadas,
 * para que el diseño de la ficha se pueda ver y probar. Ninguna unidad demo
 * lleva foto: no existe una foto honesta de ellas y no se usa stock ajeno.
 */

const DEMO_ID_PREFIX = "demo-";

function demo(
  partial: Partial<Vehicle> &
    Pick<Vehicle, "id" | "brand" | "model" | "year" | "mileageKm">,
): StockVehicle {
  return {
    slug: partial.id,
    trim: null,
    bodyStyle: null,
    category: "gasolina",
    condition: "usado",
    engineCc: null,
    transmission: "Automática",
    drivetrain: null,
    exteriorColor: null,
    doors: null,
    seats: null,
    price: null,
    currency: "USD",
    priceNegotiable: false,
    status: "disponible",
    location: "San Isidro, Lima",
    title: `${partial.brand} ${partial.model} ${partial.year}`,
    description: null,
    highlights: [],
    publishedAt: null,
    coverPhoto: null,
    photos: [],
    isDemo: true,
    ...partial,
  };
}

export const DEMO_STOCK: StockVehicle[] = [
  demo({
    id: "demo-01",
    brand: "Porsche",
    model: "Cayenne S",
    year: 2021,
    mileageKm: 28400,
    bodyStyle: "SUV",
    drivetrain: "AWD",
    exteriorColor: "Negro",
    highlights: ["1 dueño", "CarFax sin siniestros", "Mantenimiento en red oficial"],
  }),
  demo({
    id: "demo-02",
    brand: "Range Rover",
    model: "Sport HSE",
    year: 2022,
    mileageKm: 19100,
    bodyStyle: "SUV",
    drivetrain: "AWD",
    exteriorColor: "Blanco",
    status: "reservado",
    highlights: ["1 dueño corporativo", "CarFax + AutoCheck", "Transferencia lista"],
  }),
  demo({
    id: "demo-03",
    brand: "Mercedes-Benz",
    model: "GLE 450",
    year: 2020,
    mileageKm: 46700,
    bodyStyle: "SUV",
    category: "hev",
    drivetrain: "4MATIC",
    exteriorColor: "Gris",
    highlights: ["Historial completo", "CarFax sin siniestros", "Placa Lima"],
  }),
  demo({
    id: "demo-04",
    brand: "BMW",
    model: "X5 xDrive40i",
    year: 2022,
    mileageKm: 22300,
    bodyStyle: "SUV",
    drivetrain: "xDrive",
    exteriorColor: "Azul",
    highlights: ["Paquete M Sport", "1 dueño", "Garantía de fábrica vigente"],
  }),
  demo({
    id: "demo-05",
    brand: "Toyota",
    model: "Land Cruiser 300 VX",
    year: 2023,
    mileageKm: 12800,
    bodyStyle: "SUV",
    category: "diesel",
    drivetrain: "4x4",
    exteriorColor: "Blanco perla",
    highlights: ["Nacionalizado", "Mantenimiento al día", "Sin siniestros"],
  }),
  demo({
    id: "demo-06",
    brand: "Tesla",
    model: "Model Y Long Range",
    year: 2023,
    mileageKm: 9600,
    bodyStyle: "SUV",
    category: "ev",
    drivetrain: "Dual Motor",
    exteriorColor: "Blanco",
    status: "en_transito",
    highlights: ["Autopilot", "Cargador incluido", "Llega este mes"],
  }),
];

export function isDemoId(id: string) {
  return id.startsWith(DEMO_ID_PREFIX);
}

/** Stock público. Real si hay base de datos; demo si no. */
export async function getStock(limit = 24): Promise<StockVehicle[]> {
  if (!isDatabaseConfigured()) return DEMO_STOCK.slice(0, limit);
  const real = await getPublishedVehicles({ limit, sort: "recientes" });
  return real;
}

/** Una unidad por id o slug. Cubre también las unidades demo. */
export async function getStockUnit(idOrSlug: string): Promise<StockVehicle | null> {
  if (isDemoId(idOrSlug)) {
    return DEMO_STOCK.find((v) => v.id === idOrSlug || v.slug === idOrSlug) ?? null;
  }
  if (!isDatabaseConfigured()) return null;
  return getVehicleById(idOrSlug);
}
