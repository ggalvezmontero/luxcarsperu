import { PRICING_CONFIG, type ImporterProfile } from "../pricing/pricingConfig";

/**
 * ============================================================================
 *  COTIZADOR INTERNO DE ENVÍOS: TRAER AL PERÚ EL AUTO PROPIO DESDE EE.UU.
 * ============================================================================
 *
 * Caso que se cotizaba a mano: un cliente que vive en Estados Unidos quiere
 * traer SU vehículo al Perú, por la Ley del Retorno (Ley 30001, migrante
 * retornado) o como importación regular. No hay compra: el auto ya es suyo.
 *
 * TODOS los valores por defecto, tasas y parámetros legales del cotizador
 * viven en este archivo. Lo que ya existe en el motor público
 * (`src/core/pricing/`) se IMPORTA, no se copia: flete, gastos de aduana,
 * seguro, ad valorem, ISC, IGV, IPM y percepción salen de ahí. Si el dueño
 * cambia el flete en `pricingConfig.ts`, este cotizador cambia solo.
 *
 * ÚLTIMA VERIFICACIÓN DE LOS PARÁMETROS LEGALES: 2026-11-18, según los datos
 * entregados por el dueño. Lo marcado "por confirmar" no tiene sustento
 * normativo revisado todavía y se muestra así en pantalla.
 */

/** Fecha de la última revisión de estos parámetros (ISO). Se muestra en la pantalla. */
export const CONFIG_ENVIOS_VERIFICADA = "2026-11-18";

/** Cómo se cobra el servicio de Luxcars en esta línea. */
export type ServicioEnvio =
  | { tipo: "fijo"; montoUsd: number }
  /** Porcentaje sobre el valor de factura del vehículo. */
  | { tipo: "porcentaje"; tasa: number };

export const CONFIG_ENVIOS = {
  /**
   * Flete marítimo Miami–Callao. Es el MISMO del motor público (USD 3,228 al
   * 2026-11-10): el flete no depende de la propulsión, así que se toma la fila
   * de gasolina. Editable por cotización.
   */
  fleteMiamiCallaoUsd: PRICING_CONFIG.freightByCategory.gasolina,

  /** Gastos de aduana y puerto, fijos por vehículo. Mismo valor del motor público (USD 2,300). */
  gastosAduanaUsd: PRICING_CONFIG.customsCostsUsd,

  /**
   * Seguro internacional. Se calcula con `InsuranceModule` del motor público:
   * 0.5% sobre el 110% del valor de factura = 0.55% del valor. Se documenta la
   * tasa efectiva para la pantalla; el cálculo no la usa.
   */
  seguroTasaEfectiva: PRICING_CONFIG.insuranceRate * PRICING_CONFIG.insuredValueFactor,

  /** Servicio de Luxcars por defecto. Editable; la alternativa es un porcentaje. */
  servicioPorDefecto: { tipo: "fijo", montoUsd: 3000 } as ServicioEnvio,
  /** Tasa inicial cuando se elige la alternativa por porcentaje. POR CONFIRMAR con el dueño. */
  servicioPorcentajePorDefecto: 0.05,

  /** Transporte interno en EE.UU. hasta el puerto: siempre manual. Sin valor por defecto. */
  puertoSalidaPorDefecto: "Miami",

  /** 1 milla terrestre = 1.609344 km (definición exacta). */
  millasAKm: 1.609344,

  usados: {
    /**
     * Antigüedad máxima de un usado, en años modelo contando el año en curso:
     * misma regla del motor público (2 años). Para una importación en el año N
     * entran modelos N y N-1. Se reutiliza para no tener dos reglas.
     */
    antiguedadMaximaAnios: PRICING_CONFIG.usedMaxAgeYears,
    /** Recorrido máximo de un usado. POR CONFIRMAR: parámetro operativo, sin norma revisada. */
    recorridoMaximoKm: 32_000,
    recorridoPorConfirmar: true,
  },

  valorAduana: {
    /**
     * Valor estimado para aduanas de un USADO cuando no hay valor de referencia:
     * factura menos 10% por cada año de uso, con tope del 50%. Un usado tiene
     * al menos 1 año de uso aunque se importe en su mismo año modelo.
     */
    depreciacionAnual: 0.1,
    depreciacionMaxima: 0.5,
    /** Si el valor estimado queda a menos de esto del tope del Retorno, se alerta. */
    margenAlertaUsd: 3000,
  },

  leyRetorno: {
    nombre: "Ley del Retorno (Ley 30001)",
    /** Años continuos viviendo fuera del Perú que exige el beneficio. */
    aniosMinimosFuera: 3,
    /** Valor máximo del vehículo. Si lo supera, se pierde TODO el beneficio: no hay parcial. */
    valorMaximoUsd: 50_000,
    /** El vehículo no se puede transferir durante estos años. */
    aniosSinTransferir: 3,
    /** Vigencia del beneficio (ISO). */
    vigenteHasta: "2029-12-31",
  },

  /**
   * Perfil del importador para la percepción del IGV en la importación
   * regular. Una persona natural que trae su propio auto casi siempre es
   * primera importación (10%). La percepción es un adelanto, no un costo.
   */
  perfilImportador: "primera-importacion" as ImporterProfile,

  /** Nota fija de toda cotización. */
  notaReferencial: "Estimado referencial. Valores sujetos a determinación de SUNAT.",

  /** Versión del motor que se guarda con cada cotización, para auditarlas. */
  motorVersion: "src/core/envios@2026.11",
} as const;
