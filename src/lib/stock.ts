import "server-only";

import {
  getPublishedVehicles,
  getPublishedVehiclesOrThrow,
  getVehicleById,
  getVehicleByIdOrThrow,
} from "@/lib/db/vehicles";
import { isDatabaseConfigured } from "@/lib/db/client";
import type { Vehicle } from "@/lib/db/types";
import type { StockVehicle } from "@/lib/stockLabels";

export type { StockVehicle } from "@/lib/stockLabels";
export { STATUS_LABEL, CATEGORY_LABEL } from "@/lib/stockLabels";

/**
 * Capa única de lectura del stock para la web pública.
 *
 * Con Neon configurado, devuelve el inventario real (vista pública).
 * Sin base de datos, devuelve unidades de DEMOSTRACIÓN claramente marcadas,
 * para que el diseño de la ficha se pueda ver y probar. Ninguna unidad demo
 * lleva foto: no existe una foto honesta de ellas y no se usa stock ajeno.
 * Las demo SOLO existen sin base de datos: con Neon configurado, un id
 * `demo-*` se busca en la base como cualquier otro (y no existe → 404). Antes
 * /comprar/demo-01 mostraba en producción un Porsche "Disponible" ficticio con
 * botón de WhatsApp funcionando.
 *
 * DOS VARIANTES DE LECTURA:
 *  · `getStock()` / `getStockUnit()` NUNCA lanzan. Ante un error de la base
 *    devuelven `[]` / `null`. Para cualquier consumidor que no sea ISR.
 *  · `getStockForIsr()` / `getStockUnitForIsr()` son para las páginas con
 *    `revalidate` (home, /comprar, /comprar/[id]). Con la base configurada y
 *    una consulta que falla en tiempo de petición o de revalidación, LANZAN:
 *    así Next conserva la última página buena en vez de cachear "Todo el stock
 *    se vendió." cinco minutos, y la ficha responde 5xx en vez de un 404 falso.
 *    Durante `next build` NO lanzan (un error de red no debe tumbar el
 *    despliegue): ahí caen al resultado vacío, como las otras.
 *    Sin base de datos se comportan exactamente igual que las que no lanzan.
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
    source: "carga_manual",
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
    // Consignado: auto de un cliente, vendido a través de LuxCars.
    source: "consignacion",
    location: "Surco, Lima",
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

/** `true` mientras corre `next build` (prerender de páginas estáticas/ISR). */
function isProductionBuild() {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Stock público. Real si hay base de datos; demo si no. Nunca lanza. */
export async function getStock(limit = 24): Promise<StockVehicle[]> {
  if (!isDatabaseConfigured()) return DEMO_STOCK.slice(0, limit);
  return getPublishedVehicles({ limit, sort: "recientes" });
}

/**
 * Una unidad por id o slug. Nunca lanza. Las demo solo se resuelven cuando no
 * hay base de datos (ver cabecera).
 */
export async function getStockUnit(idOrSlug: string): Promise<StockVehicle | null> {
  if (!isDatabaseConfigured()) return findDemoUnit(idOrSlug);
  return getVehicleById(idOrSlug);
}

/**
 * Como `getStock()`, pero para páginas con ISR: LANZA si la base está
 * configurada y la lectura falla fuera de `next build`. Ver cabecera.
 */
export async function getStockForIsr(limit = 24): Promise<StockVehicle[]> {
  if (!isDatabaseConfigured()) return DEMO_STOCK.slice(0, limit);
  try {
    return await getPublishedVehiclesOrThrow({ limit, sort: "recientes" });
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[stock] Error leyendo el stock durante next build; se prerenderiza vacío y se corrige en la siguiente revalidación: ${describeError(error)}`,
      );
      return [];
    }
    throw error;
  }
}

/**
 * Como `getStockUnit()`, pero para la ficha: LANZA si la base está configurada
 * y la lectura falla fuera de `next build`, para responder 5xx y no un 404 falso.
 * `null` sigue significando "no existe o no está publicado". Ver cabecera.
 */
export async function getStockUnitForIsr(
  idOrSlug: string,
): Promise<StockVehicle | null> {
  if (!isDatabaseConfigured()) return findDemoUnit(idOrSlug);
  try {
    return await getVehicleByIdOrThrow(idOrSlug);
  } catch (error) {
    if (isProductionBuild()) {
      console.warn(
        `[stock] Error leyendo la unidad "${idOrSlug}" durante next build: ${describeError(error)}`,
      );
      return null;
    }
    throw error;
  }
}

function findDemoUnit(idOrSlug: string): StockVehicle | null {
  if (!isDemoId(idOrSlug)) return null;
  return DEMO_STOCK.find((v) => v.id === idOrSlug || v.slug === idOrSlug) ?? null;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
