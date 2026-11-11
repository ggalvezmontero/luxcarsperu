/**
 * Lo que hace falta para pintar la página de un modelo (`/importar/<id>`):
 * su ruta, el estimado que le corresponde y cómo nombrarlo en una frase.
 *
 * POR QUÉ EXISTE LA PÁGINA: antes cada ejemplo solo tenía `/?simular=<id>`, que
 * es la portada con un parámetro. La portada declara `canonical: "/"`, así que
 * Google fundía los nueve ejemplos en una sola URL y ninguna búsqueda de modelo
 * concreto ("cuánto cuesta importar una Tundra a Perú") tenía una página propia
 * que pudiera posicionar. Ahora cada ejemplo tiene la suya, con el número ya
 * calculado.
 *
 * EL NÚMERO ES EL DE LA CALCULADORA. Se llega a él por el mismo camino
 * (`evaluateQuote`) y con los mismos datos que carga la calculadora al abrir
 * `/?simular=<id>`: mismo año, misma condición, mismo plan. Si aquí saliera
 * otra cifra, el botón "Ajustar en la calculadora" contradiría a la página.
 *
 * Sin dependencias de servidor ni de navegador.
 */

import { inferCondition } from "@/core/pricing/priceCalculator";
import { oldestImportableModelYear } from "@/core/pricing/pricingConfig";
import type { ImportableTrendingVehicle, TrendingVehicle } from "@/data/trendingVehicles";
import { evaluateQuote, type QuoteEvaluation } from "@/lib/cotizacion";

/** Ruta pública de la página de un modelo. Es también su URL canónica. */
export function rutaModelo(id: string): string {
  return `/importar/${id}`;
}

/**
 * Ruta que abre la calculadora con los datos del modelo. Por defecto la de la
 * portada (las tarjetas de la home la abren ahí mismo, sin cambiar de página);
 * con `base = "/calculadora"`, la de la página propia de la calculadora.
 */
export function rutaCalculadora(id: string, base: "/" | "/calculadora" = "/"): string {
  return `${base}?simular=${id}#calculator`;
}

/** ¿Este ejemplo tiene página propia? Solo los que se pueden cotizar. */
export function tienePaginaPropia(v: TrendingVehicle): v is ImportableTrendingVehicle {
  return v.calculator !== null;
}

/**
 * Año modelo del ejemplo: el que anuncia su nombre ("… Raptor 2026") si está
 * entre los que la calculadora deja elegir; si no, el año en curso. Es la misma
 * regla que aplica `CalculatorSection` al precargar un ejemplo.
 */
export function anioDelEjemplo(name: string, currentYear: number): string {
  const match = /\b(20\d{2})\s*$/.exec(name);
  if (!match) return String(currentYear);
  const anio = Number(match[1]);
  const masNuevo = currentYear + 1;
  const masAntiguo = oldestImportableModelYear(currentYear);
  return anio >= masAntiguo && anio <= masNuevo ? match[1] : String(currentYear);
}

/**
 * El estimado del ejemplo. `priceUsd` permite recalcularlo con otro precio de
 * compra (los extremos del rango referencial); sin él, el del preset.
 */
export function cotizarEjemplo(
  v: ImportableTrendingVehicle,
  currentYear: number,
  priceUsd: number = v.calculator.priceUsd,
): QuoteEvaluation {
  const year = anioDelEjemplo(v.name, currentYear);
  return evaluateQuote({
    brand: v.calculator.brand,
    model: v.calculator.model,
    year,
    priceMiami: priceUsd,
    vehicleType: v.calculator.vehicleType,
    condition: inferCondition(year, currentYear),
    preferredPlan: v.calculator.preferredPlan ?? "fast",
    originOverride: null,
    currentYear,
  });
}

/**
 * Artículo con el que se nombra el vehículo en una frase. En el Perú las
 * camionetas van en femenino ("una Tundra", "una Bronco") y los autos en
 * masculino ("un Corvette"). Sale del segmento de la tarjeta; ante la duda,
 * masculino.
 */
export function articuloDe(v: Pick<TrendingVehicle, "segment">): "un" | "una" {
  return /^\s*(pickup|suv|camioneta|van)\b/i.test(v.segment) ? "una" : "un";
}

/** "una Toyota Tundra TRD 2026". */
export function conArticulo(v: Pick<TrendingVehicle, "segment" | "name">): string {
  return `${articuloDe(v)} ${v.name}`;
}
