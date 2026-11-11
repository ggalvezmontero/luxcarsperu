/**
 * Páginas de importación por marca (`/importar/marca/<marca>`).
 *
 * POR QUÉ EXISTEN: los concesionarios que salen primero en Google para "autos
 * de lujo" tienen una página por marca además de las fichas (estudio del
 * 2026-11-10, docs/marketing, sección 10.5). Aquí la página por marca responde
 * "importar [marca] de Estados Unidos a Perú": qué modelos se ensamblan en
 * EE.UU., cuáles pagan 6%, cuánto cuesta traer los que ya están calculados y
 * qué hay de esa marca en el stock de Lima.
 *
 * Solo tienen página las marcas cuyos modelos reconoce el motor de origen: sin
 * ese dato la página no tendría nada propio que decir. La lista de modelos sale
 * del catálogo de la calculadora y lo que se dice de cada uno, de
 * `resolveOrigin`; aquí no se escribe ningún país ni ninguna tasa.
 *
 * Sin dependencias de servidor ni de navegador.
 */

import { resolveOrigin, type OriginInference } from "@/core/pricing/originInference";
import { VEHICLE_CATALOG, type CatalogBrand } from "@/data/vehicleCatalog";

export type GrupoDeOrigen = {
  /** País o países de ensamblaje, sin las notas internas entre paréntesis. */
  pais: string;
  /** Lo que se cotiza hoy para esos modelos. */
  cotizacion: "cero" | "seis-puede-bajar" | "seis";
  modelos: string[];
};

export type MarcaImportable = {
  slug: string;
  nombre: string;
  /** Modelos del catálogo que el motor de origen reconoce. */
  reconocidos: number;
  /** De esos, los que hoy se cotizan con 0% de ad valorem. */
  conCero: number;
  /** Los que se cotizan con 6% pero pueden bajar a 0% con VIN y certificado. */
  puedenBajar: number;
  grupos: GrupoDeOrigen[];
};

/** "Mercedes-Benz" → "mercedes-benz", "Land Rover" → "land-rover". */
export function slugDeMarca(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function rutaMarca(nombre: string): string {
  return `/importar/marca/${slugDeMarca(nombre)}`;
}

/** Dos nombres de marca son la misma: "RAM" y "Ram", "Mercedes Benz" y "Mercedes-Benz". */
export function mismaMarca(a: string, b: string): boolean {
  return slugDeMarca(a) === slugDeMarca(b);
}

function cotizacionDe(o: OriginInference): GrupoDeOrigen["cotizacion"] {
  if (o.adValoremRate === 0) return "cero";
  return o.mayQualifyWithCertificate || o.requiresVin ? "seis-puede-bajar" : "seis";
}

function construir(marca: CatalogBrand): MarcaImportable | null {
  const grupos = new Map<string, GrupoDeOrigen>();
  let reconocidos = 0;
  let conCero = 0;
  let puedenBajar = 0;

  for (const modelo of marca.models) {
    const origen = resolveOrigin(marca.name, modelo);
    if (!origen.matched) continue;
    reconocidos += 1;
    const cotizacion = cotizacionDe(origen);
    if (cotizacion === "cero") conCero += 1;
    if (cotizacion === "seis-puede-bajar") puedenBajar += 1;
    const pais = origen.assemblyCountry.replace(/\s*\([^)]*\)/g, "").trim();
    const clave = `${cotizacion}|${pais}`;
    const grupo = grupos.get(clave) ?? { pais, cotizacion, modelos: [] };
    grupo.modelos.push(modelo);
    grupos.set(clave, grupo);
  }

  if (reconocidos === 0) return null;

  const orden = { cero: 0, "seis-puede-bajar": 1, seis: 2 } as const;
  return {
    slug: slugDeMarca(marca.name),
    nombre: marca.name,
    reconocidos,
    conCero,
    puedenBajar,
    grupos: [...grupos.values()].sort((a, b) => orden[a.cotizacion] - orden[b.cotizacion]),
  };
}

/** Las marcas con página, en el orden del catálogo (alfabético). */
export const MARCAS_IMPORTABLES: readonly MarcaImportable[] = VEHICLE_CATALOG.flatMap((marca) => {
  const construida = construir(marca);
  return construida ? [construida] : [];
});

export function marcaPorSlug(slug: string): MarcaImportable | undefined {
  return MARCAS_IMPORTABLES.find((m) => m.slug === slug);
}

/** La marca con página a la que pertenece un nombre de marca cualquiera. */
export function marcaPorNombre(nombre: string): MarcaImportable | undefined {
  return marcaPorSlug(slugDeMarca(nombre));
}
