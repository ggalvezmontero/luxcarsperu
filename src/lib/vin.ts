/**
 * VIN: validación, normalización y forma del decodificado.
 *
 * Este módulo es COMPARTIDO entre el navegador (el formulario de alta valida
 * mientras el usuario escribe) y el servidor (el Route Handler valida otra vez
 * antes de salir a la red). Por eso no importa nada de Supabase ni de Node: se
 * queda en tipos, expresiones regulares y funciones puras.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NHTSA vPIC Y NO UNA API DE INVENTARIO
 * ────────────────────────────────────────────────────────────────────────────
 * vPIC es un servicio del Departamento de Transporte de EE.UU. (NHTSA):
 *
 *     https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json
 *
 * Es gratuito, no pide autenticación y NO tiene cláusula que prohíba almacenar
 * su respuesta. Decodifica la FICHA TÉCNICA del VIN (marca, modelo, año,
 * carrocería, motor, planta de ensamblaje): no devuelve precios, ni kilometraje,
 * ni avisos de venta. Es decir, no es inventario de nadie.
 *
 * Eso es exactamente lo contrario de MarketCheck, Auto.dev, eBay, Autotrader,
 * CarGurus, Cars.com, TrueCar, AutoTempest y Facebook Marketplace, cuyos
 * contratos prohíben textualmente "cache, store, index or otherwise persist" su
 * inventario y prohíben construir "derivative databases". Guardar una sola fila
 * de esas fuentes es incumplimiento de contrato. Guardar lo que devuelve vPIC
 * no lo es.
 *
 * Si alguien en seis meses propone "reemplazar este paso manual por un scraper
 * que llene la base sola": la respuesta es no, y el motivo es contractual, no
 * técnico. Cuatro minutos de carga curada por auto es el precio de operar
 * dentro de la ley. La alternativa legal para escalar son feeds XML de dealers
 * partner con licencia FIRMADA (`fuente = 'feed_partner_licenciado'`).
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";

/** ISO 3779: 17 caracteres. */
export const VIN_LENGTH = 17;

/**
 * Las letras I, O y Q están EXCLUIDAS del alfabeto del VIN por norma: se
 * confunden con 1, 0 y 0 en una placa estampada. Por eso el rango es
 * A-H, J-N, P, R-Z más los dígitos.
 */
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const VIN_FORBIDDEN_LETTERS = /[IOQ]/g;

/**
 * Limpia lo que el usuario pegó: mayúsculas y fuera todo lo que no sea
 * alfanumérico (espacios, guiones y saltos de línea son lo que suele venir
 * pegado desde un PDF de subasta o un correo del dealer).
 */
export function normalizeVin(raw: string): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type VinValidation =
  | { valid: true; vin: string }
  | { valid: false; vin: string; reason: string };

/**
 * Valida un VIN según ISO 3779. Devuelve el motivo exacto en español: un
 * "VIN inválido" a secas obliga a contar los caracteres a mano.
 */
export function validateVin(raw: string): VinValidation {
  const vin = normalizeVin(raw);

  if (!vin) {
    return { valid: false, vin, reason: "Ingresa el VIN de 17 caracteres." };
  }

  const forbidden = vin.match(VIN_FORBIDDEN_LETTERS);
  if (forbidden) {
    const unique = Array.from(new Set(forbidden)).join(", ");
    return {
      valid: false,
      vin,
      reason:
        `El VIN no usa las letras I, O ni Q (se confunden con 1 y 0). ` +
        `Encontramos: ${unique}. Revisa si en realidad son dígitos.`,
    };
  }

  if (vin.length !== VIN_LENGTH) {
    return {
      valid: false,
      vin,
      reason:
        vin.length < VIN_LENGTH
          ? `Faltan ${VIN_LENGTH - vin.length} caracteres: el VIN tiene ${VIN_LENGTH}.`
          : `Sobran ${vin.length - VIN_LENGTH} caracteres: el VIN tiene ${VIN_LENGTH}.`,
    };
  }

  if (!VIN_PATTERN.test(vin)) {
    return {
      valid: false,
      vin,
      reason: "El VIN solo admite letras (sin I, O ni Q) y dígitos.",
    };
  }

  return { valid: true, vin };
}

/* -------------------------------------------------------------------------- */
/* Dígito verificador (posición 9)                                            */
/* -------------------------------------------------------------------------- */

const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Verifica el dígito de control (posición 9) según 49 CFR 565.
 *
 * ES UN AVISO, NO UN BLOQUEO. La regla es obligatoria para vehículos
 * comercializados en Norteamérica, pero hay VINs legítimos de otros mercados
 * que no la cumplen. Sirve para cazar el error de tipeo de un solo carácter,
 * que es el fallo real al copiar un VIN a mano; jamás para rechazar un auto.
 */
export function vinCheckDigitMatches(vin: string): boolean {
  if (!VIN_PATTERN.test(vin)) return false;

  let sum = 0;
  for (let i = 0; i < VIN_LENGTH; i += 1) {
    const char = vin[i];
    const value = /\d/.test(char) ? Number(char) : TRANSLITERATION[char];
    if (value === undefined) return false;
    sum += value * POSITION_WEIGHTS[i];
  }

  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  return vin[8] === expected;
}

/* -------------------------------------------------------------------------- */
/* Forma del decodificado                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Ficha técnica normalizada que devuelve `/api/vin/[vin]`.
 *
 * Los nombres están en el mismo inglés camelCase que usa `src/lib/db/types.ts`
 * para que el formulario pueda volcarlos en sus campos sin traducir dos veces.
 * Todo puede venir `null`: vPIC decodifica lo que el fabricante registró, y para
 * un modelo recién salido puede faltar la mitad.
 */
export type VinDecoded = {
  vin: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  bodyStyle: string | null;
  /** Cilindrada en cc, ya convertida desde los litros que a veces devuelve vPIC. */
  engineCc: number | null;
  /** Combustible en español, listo para mostrar. */
  fuelType: string | null;
  /** Combustible tal como lo devuelve vPIC, por si hay que auditar el mapeo. */
  fuelTypeRaw: string | null;
  /** Categoría del motor de precios sugerida a partir del combustible. */
  suggestedCategory: VehicleCategoryId | null;
  /** País de ensamblaje, traducido. El GR Supra sale de AUSTRIA, no de Japón. */
  assemblyCountry: string | null;
  assemblyPlant: string | null;
  trim: string | null;
  doors: number | null;
  drivetrain: string | null;
  transmission: string | null;
  /** "PASSENGER CAR", "TRUCK", etc. Sirve para intuir M1 vs N1. */
  vehicleType: string | null;
  manufacturer: string | null;
};

export type VinLookupResponse =
  | {
      ok: true;
      vin: string;
      data: VinDecoded;
      /** Observaciones para mostrar: campos vacíos, ErrorText de NHTSA, etc. */
      notices: string[];
    }
  | {
      ok: false;
      vin: string;
      code: "vin-invalido" | "sin-datos" | "upstream-error";
      /** Mensaje en español, listo para mostrar al usuario. */
      error: string;
    };
