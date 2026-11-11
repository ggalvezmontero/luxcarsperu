import type { VehicleCategoryId } from "./vehicleCategories";

/**
 * COSTOS LOGÍSTICOS: USD 3,800 PARA LA UNIDAD DE REFERENCIA (decisión del
 * dueño, 2026-11-10). Es el costo real de traer un auto de USD 104,000 y ya
 * incluye el seguro, que es 0.5% sobre el 110% del precio:
 *
 *     seguro = 104,000 × 1.10 × 0.005 = 572
 *     flete  = 3,800 − 572          = 3,228
 *
 * El flete es el mismo para toda propulsión; lo que se mueve con el precio del
 * auto es el seguro. Antes eran estimados por categoría (USD 1,900 a 2,400)
 * que quedaban por debajo de lo que se paga de verdad.
 *
 * Para cambiar el costo logístico se tocan dos números: `LOGISTICS_REFERENCE`
 * y, si cambia la póliza, `insuranceRate`.
 */
const LOGISTICS_REFERENCE = { totalUsd: 3800, vehiclePriceUsd: 104000 } as const;
const INSURANCE_RATE = 0.005;
const INSURED_VALUE_FACTOR = 1.1;
const FREIGHT_USD =
  LOGISTICS_REFERENCE.totalUsd -
  LOGISTICS_REFERENCE.vehiclePriceUsd * INSURED_VALUE_FACTOR * INSURANCE_RATE;

const FREIGHT_ESTIMATES: Record<VehicleCategoryId, number> = {
  gasolina: FREIGHT_USD,
  hev: FREIGHT_USD,
  diesel: FREIGHT_USD,
  ev: FREIGHT_USD,
  phev: FREIGHT_USD,
};

/**
 * Origen del vehículo a efectos del ad valorem.
 *
 * OJO: el 0% del APC Perú–EE.UU. NO se gana por comprar en Miami. Exige que el
 * vehículo sea ORIGINARIO de EE.UU. (valor de contenido regional ≥ 35% por
 * costo neto), con certificado de origen y TPI 802 en la DAM. Un Toyota
 * japonés, un Kia coreano, un BMW alemán o un auto ensamblado en México,
 * comprados en Florida, pagan 6%.
 */
export type VehicleOrigin = "originario-usa" | "otro";

/** Condición del vehículo al momento de la importación. */
export type VehicleCondition = "nuevo" | "usado";

/**
 * Perfil del importador. Determina la tasa de percepción del IGV.
 */
export type ImporterProfile = "recurrente" | "primera-importacion";

const AD_VALOREM_BY_ORIGIN: Record<VehicleOrigin, number> = {
  "originario-usa": 0,
  otro: 0.06,
};

/**
 * Resuelve el ad valorem considerando origen Y condición.
 *
 * La preferencia del APC Perú–EE.UU. EXCLUYE a los vehículos usados de la
 * partida 87.03: un usado paga 6% aunque sea originario de EE.UU. y tenga
 * certificado de origen. Solo los nuevos originarios llegan a 0%.
 *
 * Ante la duda se cobra 6%: prometer 0% y que el cliente pague 6% al
 * nacionalizar es el error caro; lo contrario es una buena noticia.
 */
export function resolveAdValoremRate(params: {
  origin: VehicleOrigin;
  condition: VehicleCondition;
}): number {
  if (params.condition === "usado") return AD_VALOREM_BY_ORIGIN.otro;
  return AD_VALOREM_BY_ORIGIN[params.origin];
}

export const PRICING_CONFIG = {
  freightByCategory: FREIGHT_ESTIMATES,

  /**
   * Seguro internacional: 0.5% sobre el 110% del PRECIO del vehículo (sin el
   * flete), con un mínimo de USD 45. Ver `LOGISTICS_REFERENCE` arriba: con el
   * flete, da USD 3,800 de costo logístico para un auto de USD 104,000.
   */
  insuranceRate: INSURANCE_RATE,
  insuredValueFactor: INSURED_VALUE_FACTOR,
  insuranceMinimum: 45,

  adValoremByOrigin: AD_VALOREM_BY_ORIGIN,

  /**
   * Desde el ejercicio 2026 la composición legal del 18% es IGV 15.5% + IPM
   * 2.5% (Ley 32387). El total no cambia; el desglose sí. La proforma Heysen
   * ya usaba estas tasas.
   */
  igvRate: 0.155,
  ipmRate: 0.025,

  /**
   * Percepción del IGV a la importación. NO es un costo: es un adelanto que el
   * importador recupera como crédito fiscal. Pero sí es caja que hay que poner.
   *
   *   10%  primera importación, sin RUC o no afecto al IGV
   *    5%  mercancía usada
   *  3.5%  recurrente con mercancía nueva
   */
  percepcionRates: {
    primeraImportacion: 0.1,
    usado: 0.05,
    recurrenteNuevo: 0.035,
  },

  /**
   * Antigüedad máxima de un vehículo usado para poder nacionalizarse, contada
   * en años modelo INCLUYENDO el año en curso: en 2026 el año 1 es 2026 y el
   * año 2 es 2025, así que el modelo más antiguo que entra es 2025. Ver
   * `oldestImportableModelYear()`.
   */
  usedMaxAgeYears: 2,

  /**
   * COSTOS DE ADUANA: USD 2,300 FIJOS POR VEHÍCULO (decisión del dueño,
   * 2026-11-10). No forman parte del valor en aduana: no entran al CIF ni a la
   * base de ningún tributo. Se suman al costo final como una línea propia.
   */
  customsCostsUsd: 2300,
  /**
   * COMISIÓN DE LUXCARS: 12% DEL TOTAL, no del precio del vehículo (decisión
   * del dueño, 2026-11-11). El día anterior había quedado en 12% del precio de
   * compra en EE.UU.; el dueño aclaró que la base es el precio total.
   *
   * "El total" es el costo del auto puesto en Lima antes de la comisión:
   * CIF + tributos + costos de aduana. El recargo de Fast Track queda FUERA de
   * la base a propósito, para que la diferencia entre los dos planes siga
   * siendo exactamente su cargo fijo (ver `planConfigs`).
   *
   * `brokerFeeBase` dice cómo se aplica el 12% sobre ese total:
   *   · "sobre-costo":        comisión = 12% del costo.            total = costo × 1.12
   *   · "sobre-precio-final": la comisión es el 12% del precio que paga el
   *                           cliente, comisión incluida.          total = costo ÷ 0.88
   * Cambiar de una lectura a la otra es cambiar esta sola palabra.
   *
   * La inspección va dentro de la comisión (antes eran 10% + 5% aparte).
   */
  brokerFeeRate: 0.12,
  brokerFeeBase: "sobre-costo" as "sobre-costo" | "sobre-precio-final",
  /**
   * FAST TRACK CUESTA USD 1,200 MÁS QUE ESTÁNDAR, FIJOS (decisión del dueño,
   * 2026-11-06). Es un cargo de servicio: no toca el flete, así que no cambia
   * el CIF ni los tributos, y la diferencia entre los dos planes es la misma
   * para cualquier auto.
   *
   * Antes eran +15% de flete y USD 150 de gestión, que con los tributos encima
   * daban entre USD 540 y 700 según el auto: ni fijo ni lo que se cobra.
   * Para cambiar el monto se toca solo `documentHandlingFee`.
   */
  planConfigs: {
    fast: {
      key: "fast",
      label: "Fast Track",
      fleteAdjustment: 1,
      documentHandlingFee: 1200,
      timelineLabel: "30-40 días",
    },
    standard: {
      key: "standard",
      label: "Estándar",
      fleteAdjustment: 1,
      documentHandlingFee: 0,
      timelineLabel: "40-60 días",
    },
  } as const,
} as const;

export function resolvePercepcionRate(params: {
  profile: ImporterProfile;
  condition: VehicleCondition;
}): number {
  const { percepcionRates } = PRICING_CONFIG;
  if (params.profile === "primera-importacion") {
    return percepcionRates.primeraImportacion;
  }
  return params.condition === "usado"
    ? percepcionRates.usado
    : percepcionRates.recurrenteNuevo;
}

/**
 * El año en curso EN LIMA. Es el que cuenta para la regla de antigüedad: en
 * 2026 entran usados 2026 y 2025; el 1 de enero de 2027 pasan a entrar 2027 y
 * 2026, sin tocar el código.
 *
 * Se calcula en la hora de Lima a propósito. El servidor corre en UTC, cinco
 * horas por delante: con `new Date().getFullYear()` el sitio cambiaría de año
 * la tarde del 31 de diciembre, cuando en el Perú todavía rige el anterior.
 */
export function currentYearInLima(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric" }).format(now),
  );
}

/**
 * Modelo más antiguo que se puede nacionalizar como usado en un año dado.
 * El año en curso cuenta como el primero de los `usedMaxAgeYears`, por eso se
 * resta uno: con 2 años, en 2026 entran modelos 2025 en adelante.
 */
export function oldestImportableModelYear(currentYear: number): number {
  return currentYear - (PRICING_CONFIG.usedMaxAgeYears - 1);
}

export type PlanKey = keyof typeof PRICING_CONFIG.planConfigs;
export type PlanConfig =
  (typeof PRICING_CONFIG.planConfigs)[PlanKey];
