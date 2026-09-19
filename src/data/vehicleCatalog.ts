/**
 * Catálogo de marcas y modelos para los formularios de importación
 * (calculadora pública y pedido de búsqueda).
 *
 * Es una lista CURADA del mercado de Estados Unidos, años modelo 2023–2026,
 * escrita a mano. No viene de ningún marketplace ni feed: solo nombres
 * comerciales, que no son inventario de nadie (ver la regla legal en
 * src/lib/db/types.ts). Los nombres de modelo coinciden con los patrones del
 * motor de origen (`src/core/pricing/originInference.ts`): "Silverado 1500",
 * "Corolla Cross", "Escalade IQ", etc., para que el ad valorem se infiera bien.
 *
 * Siempre existe la salida "Otra marca" / "Otro modelo": el catálogo ayuda a
 * elegir, no limita lo que se puede pedir.
 *
 * Mantenimiento: agregar o quitar un modelo es una línea. Marcas en orden
 * alfabético; modelos en el orden en que el fabricante los lista.
 */

export type CatalogBrand = {
  /** Nombre comercial tal como se muestra y se guarda. */
  name: string;
  models: readonly string[];
};

export const VEHICLE_CATALOG: readonly CatalogBrand[] = [
  { name: "Acura", models: ["Integra", "TLX", "RDX", "MDX", "ZDX"] },
  { name: "Alfa Romeo", models: ["Giulia", "Stelvio", "Tonale"] },
  { name: "Aston Martin", models: ["Vantage", "DB12", "DBX", "Vanquish", "Valhalla"] },
  {
    name: "Audi",
    models: [
      "A3", "S3", "RS 3", "A4", "S4", "A5", "S5", "RS 5", "A6", "S6", "RS 6 Avant", "A7", "S7", "RS 7", "A8", "S8",
      "Q3", "Q4 e-tron", "Q5", "SQ5", "Q6 e-tron", "SQ6 e-tron", "Q7", "SQ7", "Q8", "SQ8", "RS Q8", "Q8 e-tron", "e-tron GT", "RS e-tron GT",
    ],
  },
  { name: "Bentley", models: ["Continental GT", "Continental GTC", "Flying Spur", "Bentayga"] },
  {
    name: "BMW",
    models: [
      "Serie 2", "M2", "Serie 3", "M3", "Serie 4", "M4", "Serie 5", "M5", "Serie 7", "Serie 8", "M8",
      "i4", "i5", "i7", "iX", "X1", "X2", "X3", "X3 M", "X4", "X5", "X5 M", "X6", "X6 M", "X7", "XM", "Z4",
    ],
  },
  { name: "Buick", models: ["Encore GX", "Envista", "Envision", "Enclave"] },
  {
    name: "Cadillac",
    models: ["CT4", "CT4-V", "CT5", "CT5-V", "XT4", "XT5", "XT6", "Lyriq", "Optiq", "Vistiq", "Escalade", "Escalade-V", "Escalade IQ", "Celestiq"],
  },
  {
    name: "Chevrolet",
    models: [
      "Trax", "Trailblazer", "Equinox", "Equinox EV", "Blazer", "Blazer EV", "Traverse", "Tahoe", "Suburban",
      "Colorado", "Silverado 1500", "Silverado HD", "Silverado EV", "Malibu", "Camaro", "Corvette",
    ],
  },
  { name: "Chrysler", models: ["Pacifica", "Pacifica Hybrid"] },
  { name: "Dodge", models: ["Hornet", "Durango", "Charger", "Charger Daytona", "Challenger"] },
  { name: "Ferrari", models: ["Roma", "Roma Spider", "296 GTB", "296 GTS", "SF90 Stradale", "SF90 Spider", "12Cilindri", "Purosangue", "F80"] },
  {
    name: "Ford",
    models: [
      "Maverick", "Ranger", "Ranger Raptor", "F-150", "F-150 Raptor", "F-150 Lightning", "F-250 Super Duty", "F-350 Super Duty",
      "Escape", "Bronco Sport", "Bronco", "Explorer", "Expedition", "Mustang", "Mustang Mach-E",
    ],
  },
  { name: "Genesis", models: ["G70", "G80", "G90", "GV60", "GV70", "GV80"] },
  { name: "GMC", models: ["Terrain", "Acadia", "Yukon", "Yukon XL", "Canyon", "Sierra 1500", "Sierra HD", "Sierra EV", "Hummer EV"] },
  { name: "Honda", models: ["Civic", "Accord", "HR-V", "CR-V", "Passport", "Pilot", "Prologue", "Odyssey", "Ridgeline"] },
  { name: "Hyundai", models: ["Elantra", "Sonata", "Kona", "Tucson", "Santa Fe", "Palisade", "Ioniq 5", "Ioniq 6", "Ioniq 9", "Santa Cruz"] },
  { name: "Infiniti", models: ["Q50", "QX50", "QX55", "QX60", "QX80"] },
  { name: "Jaguar", models: ["E-PACE", "F-PACE", "I-PACE", "F-TYPE"] },
  {
    name: "Jeep",
    models: ["Renegade", "Compass", "Cherokee", "Wrangler", "Gladiator", "Grand Cherokee", "Grand Cherokee L", "Wagoneer", "Wagoneer S", "Grand Wagoneer", "Recon"],
  },
  { name: "Kia", models: ["K4", "K5", "Seltos", "Sportage", "Sorento", "Telluride", "Carnival", "EV6", "EV9"] },
  { name: "Lamborghini", models: ["Urus", "Huracán", "Temerario", "Revuelto"] },
  {
    name: "Land Rover",
    models: ["Range Rover Evoque", "Range Rover Velar", "Range Rover Sport", "Range Rover", "Discovery Sport", "Discovery", "Defender"],
  },
  { name: "Lexus", models: ["IS", "ES", "LS", "RC", "LC", "UX", "NX", "RX", "RZ", "TX", "GX", "LX"] },
  { name: "Lincoln", models: ["Corsair", "Nautilus", "Aviator", "Navigator"] },
  { name: "Lucid", models: ["Air", "Gravity"] },
  { name: "Maserati", models: ["Grecale", "Levante", "Ghibli", "Quattroporte", "GranTurismo", "GranCabrio", "MC20"] },
  { name: "Mazda", models: ["Mazda3", "CX-30", "CX-5", "CX-50", "CX-70", "CX-90", "MX-5 Miata"] },
  { name: "McLaren", models: ["Artura", "750S", "GTS", "W1"] },
  {
    name: "Mercedes-Benz",
    models: [
      "CLA", "Clase C", "CLE", "Clase E", "Clase S", "Maybach Clase S", "AMG GT", "SL",
      "GLA", "GLB", "GLC", "GLC Coupé", "GLE", "GLE Coupé", "GLS", "Maybach GLS", "Clase G",
      "EQB", "EQE", "EQE SUV", "EQS", "EQS SUV",
    ],
  },
  { name: "Nissan", models: ["Sentra", "Altima", "Kicks", "Rogue", "Murano", "Pathfinder", "Armada", "Frontier", "Titan", "Ariya", "Z"] },
  { name: "Porsche", models: ["718 Cayman", "718 Boxster", "911", "Taycan", "Panamera", "Macan", "Macan Electric", "Cayenne", "Cayenne Coupé"] },
  { name: "Ram", models: ["1500", "1500 REV", "2500", "3500", "ProMaster"] },
  { name: "Rivian", models: ["R1T", "R1S"] },
  { name: "Rolls-Royce", models: ["Ghost", "Phantom", "Cullinan", "Spectre"] },
  { name: "Subaru", models: ["Impreza", "Legacy", "Crosstrek", "Forester", "Outback", "Ascent", "Solterra", "WRX", "BRZ"] },
  { name: "Tesla", models: ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"] },
  {
    name: "Toyota",
    models: [
      "Corolla", "Corolla Cross", "GR Corolla", "Camry", "Crown", "Crown Signia", "Prius", "RAV4", "bZ4X", "Highlander", "Grand Highlander",
      "4Runner", "Land Cruiser", "Sequoia", "Sienna", "Tacoma", "Tundra", "GR86", "GR Supra",
    ],
  },
  { name: "Volkswagen", models: ["Jetta", "Golf GTI", "Golf R", "Taos", "Tiguan", "Atlas", "Atlas Cross Sport", "ID.4", "ID. Buzz"] },
  { name: "Volvo", models: ["S60", "S90", "V60", "XC40", "EX30", "XC60", "XC90", "EX90"] },
];

const norm = (v: string) => v.trim().toLowerCase();

/** Marca del catálogo cuyo nombre coincide (sin distinguir mayúsculas). */
export function findCatalogBrand(name: string): CatalogBrand | null {
  const wanted = norm(name);
  if (!wanted) return null;
  return VEHICLE_CATALOG.find((b) => norm(b.name) === wanted) ?? null;
}

/** Modelo del catálogo de esa marca, con el nombre canónico. */
export function findCatalogModel(brand: CatalogBrand, model: string): string | null {
  const wanted = norm(model);
  if (!wanted) return null;
  return brand.models.find((m) => norm(m) === wanted) ?? null;
}
