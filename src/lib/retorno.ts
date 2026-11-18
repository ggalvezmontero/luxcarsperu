/* -----------------------------------------------------------------------------
 * Traer al Perú el auto propio: Ley del Retorno y requisitos del vehículo.
 *
 * POR QUÉ EXISTE: llegan muchas consultas de peruanos que viven en Estados
 * Unidos y quieren traer SU auto al volver (2026-11-16). El sitio no decía
 * nada del caso, así que todos escribían sin saber si su auto podía entrar; la
 * mayoría no puede, porque el auto es más antiguo de lo que Perú admite.
 *
 * Aquí viven los parámetros de la ley y la regla que decide el caso. La usan la
 * guía `/guias/traer-tu-auto-de-estados-unidos-a-peru` y su filtro.
 *
 * Los requisitos del VEHÍCULO no se repiten: antigüedad, recorrido y diésel
 * salen de donde ya los toma el resto del sitio. SUNAT aplica al migrante
 * retornado los mismos requisitos que a cualquier usado ("previo cumplimiento
 * de los requisitos previstos en la normatividad vigente").
 *
 * FUENTES (revisadas el 2026-11-18):
 *   · sunat.gob.pe/orientacionaduanera/incentivosmigratorios (beneficiarios,
 *     bienes, requisitos y plazo).
 *   · Ley 30001, art. 3; Ley 32722, que prorroga el beneficio hasta el
 *     31-12-2029.
 * Si cambia la norma, se cambia aquí y se actualiza `verificada`.
 * -------------------------------------------------------------------------- */

import { PRICING_CONFIG, oldestImportableModelYear } from "@/core/pricing/pricingConfig";
import { getVehicleCategory, type VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import { IMPORT_COMPLIANCE_REFERENCE } from "@/lib/db/types";

export const LEY_RETORNO = {
  /** Años seguidos viviendo fuera del Perú. */
  aniosMinimosFuera: 3,
  /** Las visitas al Perú no cortan el plazo si no pasan de estos días por año. */
  diasVisitaPorAnio: 180,
  /** Valor máximo del vehículo. Por encima no hay beneficio, ni parcial. */
  valorMaximoUsd: 50_000,
  /** El vehículo no se puede transferir en este plazo sin pagar los tributos. */
  aniosSinTransferir: 3,
  /** Plazo para pedir el beneficio a SUNAT, desde el ingreso al país o la emisión de la tarjeta. */
  mesesParaSolicitar: 6,
  /** Último día de vigencia del beneficio (Ley 32722). */
  vigenteHasta: "2029-12-31",
  /** Última revisión de estos datos contra SUNAT. */
  verificada: "2026-11-18",
} as const;

/** Auto o SUV (categoría M1) frente a camioneta o pickup (N1): cambia el tope de recorrido. */
export type TipoVehiculoRetorno = "auto" | "camioneta";

export type UnidadRecorrido = "mi" | "km";

export type EntradaRetorno = {
  anioModelo: number;
  tipo: TipoVehiculoRetorno;
  combustible: VehicleCategoryId;
  recorrido: number;
  unidad: UnidadRecorrido;
  /** Valor aproximado del vehículo hoy, en dólares. */
  valorUsd: number;
  /** Peruano con los años mínimos viviendo fuera. */
  cumplePersona: boolean;
};

/**
 * `no-entra`: el vehículo no se puede importar, con o sin ley.
 * `retorno`: entra y califica al beneficio.
 * `regular`: entra, pero pagando los tributos de un usado.
 */
export type Veredicto = "no-entra" | "retorno" | "regular";

export type ResultadoRetorno = {
  veredicto: Veredicto;
  /** Por qué no entra, o por qué no aplica el beneficio. */
  motivos: string[];
  /** Cosas que no cambian el veredicto pero conviene saber antes de embarcar. */
  avisos: string[];
  recorridoKm: number;
};

const MILLAS_A_KM = 1.609344;
/** Desde este valor se avisa que SUNAT puede valorizarlo por encima del tope. */
const MARGEN_TOPE_USD = 5_000;

const usd = (n: number) => `US$ ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)}`;
const km = (n: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)} km`;

export function recorridoEnKm(recorrido: number, unidad: UnidadRecorrido): number {
  return Math.round(unidad === "mi" ? recorrido * MILLAS_A_KM : recorrido);
}

export function topeRecorridoKm(tipo: TipoVehiculoRetorno): number {
  const { M1, N1 } = IMPORT_COMPLIANCE_REFERENCE.maxMileageKm;
  return tipo === "auto" ? M1 : N1;
}

export function evaluarRetorno(entrada: EntradaRetorno, anioActual: number): ResultadoRetorno {
  const masAntiguo = oldestImportableModelYear(anioActual);
  const recorridoKm = recorridoEnKm(entrada.recorrido, entrada.unidad);
  const tope = topeRecorridoKm(entrada.tipo);

  const noEntra: string[] = [];
  if (entrada.anioModelo < masAntiguo) {
    noEntra.push(
      `Es modelo ${entrada.anioModelo}. Perú solo admite usados de hasta ${PRICING_CONFIG.usedMaxAgeYears} años: en ${anioActual} entran modelos ${masAntiguo} en adelante.`,
    );
  }
  if (!getVehicleCategory(entrada.combustible).usedImportAllowed) {
    noEntra.push("Es diésel. Perú no permite importar autos, SUV ni camionetas diésel usados.");
  }
  if (recorridoKm > tope) {
    noEntra.push(`Tiene ${km(recorridoKm)}. El tope para un usado de este tipo es ${km(tope)}.`);
  }
  if (noEntra.length > 0) {
    return { veredicto: "no-entra", motivos: noEntra, avisos: [], recorridoKm };
  }

  const avisos: string[] = [];
  if (entrada.anioModelo === masAntiguo) {
    avisos.push(
      `Un modelo ${masAntiguo} entra solo hasta el 31 de diciembre de ${anioActual}. El embarque y la aduana tienen que cerrarse este año.`,
    );
  }

  const sinBeneficio: string[] = [];
  if (!entrada.cumplePersona) {
    sinBeneficio.push(
      `La Ley del Retorno es para peruanos con al menos ${LEY_RETORNO.aniosMinimosFuera} años seguidos viviendo fuera.`,
    );
  }
  if (entrada.valorUsd > LEY_RETORNO.valorMaximoUsd) {
    sinBeneficio.push(
      `Vale más de ${usd(LEY_RETORNO.valorMaximoUsd)}, el tope de la Ley del Retorno. Por encima no hay beneficio parcial.`,
    );
  }
  if (sinBeneficio.length > 0) {
    return { veredicto: "regular", motivos: sinBeneficio, avisos, recorridoKm };
  }

  if (entrada.valorUsd > LEY_RETORNO.valorMaximoUsd - MARGEN_TOPE_USD) {
    avisos.push(
      `El valor lo fija SUNAT, no la factura. Está cerca del tope de ${usd(LEY_RETORNO.valorMaximoUsd)}: si lo valoriza por encima, se pierde el beneficio.`,
    );
  }
  return { veredicto: "retorno", motivos: [], avisos, recorridoKm };
}
