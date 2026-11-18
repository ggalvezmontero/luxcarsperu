import { InsuranceModule } from "../modules/InsuranceModule";
import { calculateFiscalFees } from "../pricing/feeStrategies";
import {
  PRICING_CONFIG,
  resolveAdValoremRate,
  resolvePercepcionRate,
  type VehicleOrigin,
} from "../pricing/pricingConfig";
import { getVehicleCategory, resolveIscRate } from "../pricing/vehicleCategories";
import { CONFIG_ENVIOS, type ServicioEnvio } from "./configEnvios";
import type {
  DesgloseRegimen,
  EntradaCotizacionEnvio,
  RegimenEnvio,
  ResultadoCotizacionEnvio,
  TributosEnvio,
} from "./tipos";
import { validarEnvio } from "./validaciones";
import {
  estimarValorAduana,
  fechaLimiteIngresoUsado,
  recorridoEnKm,
  resolverAnioImportacion,
} from "./valorAduana";

/**
 * ============================================================================
 *  CÁLCULO DEL COTIZADOR DE ENVÍOS
 * ============================================================================
 *
 * Reutiliza el motor público (`src/core/pricing/`) para todo lo tributario y
 * para el seguro; acá solo se arma la suma con las líneas propias de este
 * caso (transporte interno en EE.UU., servicio fijo). No hay segunda
 * implementación de ninguna tasa.
 *
 *   Ley del Retorno:        tributos = 0.
 *   Importación regular:    ad valorem (según origen y condición), ISC (según
 *                           condición y combustible), IGV + IPM sobre
 *                           CIF + ad valorem + ISC. Percepción aparte.
 *
 * El CIF se arma con el VALOR ESTIMADO PARA ADUANAS (no la factura, en un
 * usado), más flete y seguro. El seguro se calcula sobre la factura, que es lo
 * que se asegura. El transporte interno en EE.UU. es una línea aparte y no
 * entra al CIF, igual que en la calculadora pública.
 */

/** Países cuya fabricación da origen EE.UU. a efectos del APC. Ante la duda, 6%. */
const PATRON_EEUU = /^(estados unidos|ee\.?\s?uu\.?|eeuu|usa|u\.s\.a\.?|united states|us)$/i;

export function origenDesdePais(paisFabricacion: string): VehicleOrigin {
  const limpio = paisFabricacion.trim().replace(/\s+/g, " ");
  return PATRON_EEUU.test(limpio) || /^estados unidos\b/i.test(limpio) ? "originario-usa" : "otro";
}

/** Un monto en USD: cero si es negativo o no es un número. */
function monto(valor: number): number {
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}

export function calcularServicio(servicio: ServicioEnvio, valorFacturaUsd: number): number {
  if (servicio.tipo === "porcentaje") {
    return monto(valorFacturaUsd) * monto(servicio.tasa);
  }
  return monto(servicio.montoUsd);
}

function tributosRegulares(
  entrada: EntradaCotizacionEnvio,
  cif: number,
  origen: VehicleOrigin,
): TributosEnvio | null {
  const { vehiculo } = entrada;
  const categoria = getVehicleCategory(vehiculo.combustible);
  const iscRate = resolveIscRate({
    category: categoria,
    condition: vehiculo.condicion,
    cylinderCapacityCc: vehiculo.cilindradaCc ?? undefined,
  });
  // Diésel usado: el motor público dice "no se puede nacionalizar".
  if (iscRate === null) return null;

  const adValoremRate = resolveAdValoremRate({ origin: origen, condition: vehiculo.condicion });
  const percepcionRate = resolvePercepcionRate({
    profile: CONFIG_ENVIOS.perfilImportador,
    condition: vehiculo.condicion,
  });
  const fees = calculateFiscalFees({ cif, adValoremRate, iscRate, percepcionRate });

  return {
    adValorem: fees.adValorem,
    isc: fees.isc,
    igv: fees.igv,
    ipm: fees.ipm,
    total: fees.adValorem + fees.isc + fees.igv + fees.ipm,
    percepcion: fees.percepcion,
    tasas: {
      adValorem: adValoremRate,
      isc: iscRate,
      igv: PRICING_CONFIG.igvRate,
      ipm: PRICING_CONFIG.ipmRate,
      percepcion: percepcionRate,
    },
  };
}

function desglose(
  regimen: RegimenEnvio,
  entrada: EntradaCotizacionEnvio,
  base: { seguro: number; cif: number; servicio: number; origen: VehicleOrigin; beneficioAplica: boolean },
): DesgloseRegimen {
  const { costos } = entrada;
  const transporte = monto(costos.transporteInternoUsd);
  const flete = monto(costos.fleteUsd);
  const aduana = monto(costos.gastosAduanaUsd);

  const tributos: TributosEnvio | null =
    regimen === "ley-retorno"
      ? {
          adValorem: 0,
          isc: 0,
          igv: 0,
          ipm: 0,
          total: 0,
          percepcion: 0,
          tasas: { adValorem: 0, isc: 0, igv: 0, ipm: 0, percepcion: 0 },
        }
      : tributosRegulares(entrada, base.cif, base.origen);

  const total = transporte + flete + base.seguro + (tributos?.total ?? 0) + aduana + base.servicio;

  return {
    regimen,
    transporteInternoUsd: transporte,
    fleteUsd: flete,
    seguroUsd: base.seguro,
    cifUsd: base.cif,
    tributos,
    gastosAduanaUsd: aduana,
    servicioUsd: base.servicio,
    totalUsd: total,
    efectivoUsd: total + (tributos?.percepcion ?? 0),
    beneficioAplica: regimen === "ley-retorno" ? base.beneficioAplica : true,
  };
}

/**
 * Cotiza los dos regímenes a la vez, valida y devuelve todo lo que la pantalla
 * y el mensaje necesitan. Es una función pura: la misma entrada y la misma
 * fecha dan el mismo resultado, por eso se guarda la entrada y se puede
 * reproducir.
 */
export function cotizarEnvio(
  entrada: EntradaCotizacionEnvio,
  ahora: Date = new Date(),
): ResultadoCotizacionEnvio {
  const anioImportacion = resolverAnioImportacion(entrada, ahora);
  const valorAduana = estimarValorAduana(entrada, anioImportacion);
  const origen = origenDesdePais(entrada.vehiculo.paisFabricacion);
  const recorridoKm = recorridoEnKm(entrada.vehiculo.recorrido, entrada.vehiculo.unidadRecorrido);

  const seguro = InsuranceModule.calculate({ priceMiami: monto(entrada.vehiculo.valorFacturaUsd) });
  const cif = valorAduana.valorUsd + monto(entrada.costos.fleteUsd) + seguro;
  const servicio = calcularServicio(entrada.costos.servicio, entrada.vehiculo.valorFacturaUsd);

  const alertas = validarEnvio(entrada, { anioImportacion, valorAduana });
  const beneficioAplica = !alertas.some(
    (a) => a.nivel === "danger" && a.clave.startsWith("retorno-"),
  );

  const base = { seguro, cif, servicio, origen, beneficioAplica };
  const retorno = desglose("ley-retorno", entrada, base);
  const regular = desglose("importacion-regular", entrada, base);

  return {
    origen,
    recorridoKm,
    anioImportacion,
    valorAduana,
    fechaLimiteIngreso: fechaLimiteIngresoUsado(entrada.vehiculo.condicion, entrada.vehiculo.anioModelo),
    retorno,
    regular,
    elegido: entrada.regimen === "ley-retorno" ? retorno : regular,
    alertas,
    nota: CONFIG_ENVIOS.notaReferencial,
    motorVersion: CONFIG_ENVIOS.motorVersion,
  };
}
