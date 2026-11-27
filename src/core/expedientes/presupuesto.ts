/**
 * Presupuesto del expediente (Anexo B) e hitos de pago.
 *
 * REUTILIZA EL MOTOR VERIFICADO de `src/core/pricing/` por sus funciones
 * exportadas: seguro, cascada tributaria, tasas por origen, condición y
 * perfil, y la comisión escalonada. No reimplementa ninguna tasa. Lo que
 * agrega es lo propio de un expediente: precio en otra moneda con tipo de
 * cambio de referencia, flete repartido en un consolidado, la inspección de los
 * usados y el reparto en seis hitos (cinco pagos).
 *
 *   precioUsd = precio de la pro forma del broker (sin línea de transporte interno:
 *               el traslado al puerto va dentro del flete)
 *   flete  = fleteBase × proporcionFlete   (traslado al puerto y marítimo, una cifra)
 *   seguro = InsuranceModule (0.5 % del 110 % del precio, mínimo 45)
 *   cif    = precioUsd + flete + seguro
 *   tributos = calculateFiscalFees(cif, ad valorem, ISC, percepción)
 *   costoPuestoEnLima = cif + tributos + gastosAduana
 *   honorarios = BrokerModule (IGV incluido; base = ÷ 1.18). La gestión registral
 *               (homologación, SUNARP, placas y tarjeta) va DENTRO de los honorarios:
 *               no hay línea de gastos registrales.
 *   H1 = precioUsd (+ inspección si es usado)          Pago 1, al firmar
 *   H2 = flete + seguro · H3 = 50 % honorarios          Pago 2, al release
 *   H4 = gastosAduana (agente, almacenaje, grúa)        Pago 3, al arribo
 *   H5 = tributos [+ percepción] (estimado; se paga la cifra exacta de SUNAT) Pago 4
 *   H6 = 50 % honorarios (neto del saldo de aduana)     Pago 5, al levante
 *
 * Sin margen por tipo de cambio: los tributos se pagan con la cifra real de la
 * liquidación de SUNAT y el sobrante o faltante de los gastos de aduana se
 * compensa en el Pago 5. La percepción NO es un costo (se recupera como
 * crédito fiscal) pero sí es caja que se paga con la DAM, por eso entra en el
 * H5 salvo que se pida lo contrario, y siempre se muestra como línea
 * informativa aparte.
 *
 * La salida lleva un snapshot de cada tasa y `motorVersion`: se guarda en
 * `expedientes.presupuesto` para reproducir el Anexo B aunque cambie
 * `pricingConfig`.
 */

import { BrokerModule } from "../modules/BrokerModule";
import { InsuranceModule } from "../modules/InsuranceModule";
import { calculateFiscalFees } from "../pricing/feeStrategies";
import {
  PRICING_CONFIG,
  resolveAdValoremRate,
  resolvePercepcionRate,
} from "../pricing/pricingConfig";
import { getVehicleCategory, resolveIscRate } from "../pricing/vehicleCategories";
import { CUENTA_POR_HITO, DESCRIPCION_HITO, redondear } from "./hitos";
import type {
  EntradaPresupuesto,
  LineaPresupuesto,
  Presupuesto,
  VehicleCategoryId,
} from "./tipos";

export const MOTOR_VERSION = "src/core/expedientes@2026.11.27 · cinco pagos, seis hitos · pricing tramos 2026-11-18";

/** IGV sobre honorarios: la comisión del motor ya lo incluye; la base de la factura es ÷ 1.18. */
export const IGV_HONORARIOS = PRICING_CONFIG.igvRate + PRICING_CONFIG.ipmRate;

/** Los honorarios se cobran en dos mitades: H3 al release y H6 al levante. */
export const MITAD_HONORARIOS = 0.5;

export class PresupuestoNoCalculableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresupuestoNoCalculableError";
  }
}

/** Flete del contenedor completo según el motor público, para una categoría. */
export function fleteBasePorDefecto(categoria: VehicleCategoryId): number {
  return PRICING_CONFIG.freightByCategory[categoria] ?? PRICING_CONFIG.freightByCategory.gasolina;
}

/** Entrada con los valores por defecto del motor, para que la pantalla arranque llena. */
export function entradaPorDefecto(parcial: Partial<EntradaPresupuesto> & Pick<EntradaPresupuesto, "precio" | "vehicleType" | "condition" | "origin">): EntradaPresupuesto {
  return {
    monedaCompra: "USD",
    tcCompraRef: 1,
    cylinderCapacityCc: null,
    importerProfile: "primera-importacion",
    fleteBase: fleteBasePorDefecto(parcial.vehicleType),
    proporcionFlete: 1,
    gastosAduana: PRICING_CONFIG.customsCostsUsd,
    costoInspeccion: 0,
    percepcionEnTributos: true,
    ...parcial,
  };
}

function positivo(n: number, nombre: string): number {
  if (!Number.isFinite(n) || n < 0) {
    throw new PresupuestoNoCalculableError(`${nombre} debe ser un número mayor o igual a cero.`);
  }
  return n;
}

export function presupuestar(entrada: EntradaPresupuesto): Presupuesto {
  const precio = positivo(entrada.precio, "El precio de compra");
  const tc = entrada.monedaCompra.toUpperCase() === "USD" ? 1 : entrada.tcCompraRef;
  if (!Number.isFinite(tc) || tc <= 0) {
    throw new PresupuestoNoCalculableError("El tipo de cambio de referencia debe ser mayor que cero.");
  }
  if (entrada.proporcionFlete <= 0 || entrada.proporcionFlete > 1) {
    throw new PresupuestoNoCalculableError("La proporción del flete va de 0 a 1 (1 = contenedor exclusivo).");
  }

  const precioUsd = precio * tc;
  const fleteBase = positivo(entrada.fleteBase, "El flete base");
  const flete = fleteBase * entrada.proporcionFlete;
  const seguro = InsuranceModule.calculate({ priceMiami: precioUsd });
  const cif = precioUsd + flete + seguro;

  const categoria = getVehicleCategory(entrada.vehicleType);
  const iscRate = resolveIscRate({
    category: categoria,
    condition: entrada.condition,
    cylinderCapacityCc: entrada.cylinderCapacityCc ?? undefined,
  });
  if (iscRate === null) {
    throw new PresupuestoNoCalculableError(
      `No se puede importar ${categoria.label} en condición "${entrada.condition}": la norma lo prohíbe.`,
    );
  }
  const adValoremRate = resolveAdValoremRate({ origin: entrada.origin, condition: entrada.condition });
  const percepcionRate = resolvePercepcionRate({
    profile: entrada.importerProfile,
    condition: entrada.condition,
  });

  const fiscal = calculateFiscalFees({ cif, adValoremRate, iscRate, percepcionRate });
  const tributos = fiscal.adValorem + fiscal.isc + fiscal.igv + fiscal.ipm;

  const gastosAduana = positivo(entrada.gastosAduana, "Los gastos de aduana");
  // La inspección solo existe en usados; en nuevos es cero y no aparece.
  const costoInspeccion = entrada.condition === "usado" ? positivo(entrada.costoInspeccion ?? 0, "El costo de la inspección") : 0;
  const costoPuestoEnLima = cif + tributos + gastosAduana;

  const honorarios = BrokerModule.calculate({ costBeforeFee: costoPuestoEnLima });
  const honorariosBase = honorarios / (1 + IGV_HONORARIOS);
  const honorariosIgv = honorarios - honorariosBase;

  const percepcionEnTributos = entrada.percepcionEnTributos ?? true;
  const h1 = precioUsd + costoInspeccion;
  const h2 = flete + seguro;
  const h4 = gastosAduana;
  // El Pago 4 es la suma de las líneas redondeadas que se muestran (ad valorem, ISC, IGV, IPM y percepción):
  // así el Anexo B y el calendario de pagos cuadran al centavo.
  const tributosMostrados = redondear(redondear(fiscal.adValorem) + redondear(fiscal.isc) + redondear(fiscal.igv) + redondear(fiscal.ipm));
  const h5 = tributosMostrados + (percepcionEnTributos ? redondear(fiscal.percepcion) : 0);
  const mitad = honorarios * MITAD_HONORARIOS;

  const totalSinPercepcion = cif + tributos + gastosAduana + costoInspeccion + honorarios;
  const totalConPercepcion = totalSinPercepcion + fiscal.percepcion;

  const pct = (r: number) => `${(r * 100).toFixed(r * 100 % 1 === 0 ? 0 : 1)} %`;
  const brutas: LineaPresupuesto[] = [
    { clave: "precio", concepto: "Precio del vehículo", montoUsd: precioUsd, grupo: "vehiculo", detalle: tc === 1 ? "Según la pro forma del broker" : `${entrada.monedaCompra.toUpperCase()} ${fmt(precio)} × ${tc} · pro forma del broker` },
    ...(entrada.condition === "usado" ? [{ clave: "inspeccion", concepto: "Inspección del vehículo usado", montoUsd: costoInspeccion, grupo: "vehiculo" as const, detalle: "Se paga con el Pago 1" }] : []),
    { clave: "flete", concepto: "Flete (traslado al puerto y marítimo)", montoUsd: flete, grupo: "logistica", detalle: entrada.proporcionFlete === 1 ? "Contenedor exclusivo" : `${pct(entrada.proporcionFlete)} del contenedor (${fmt(fleteBase)})` },
    { clave: "seguro", concepto: "Seguro de transporte", montoUsd: seguro, grupo: "logistica", detalle: `${pct(PRICING_CONFIG.insuranceRate)} del ${pct(PRICING_CONFIG.insuredValueFactor)} del precio` },
    { clave: "cif", concepto: "Valor CIF (base de los tributos)", montoUsd: cif, grupo: "informativo" },
    { clave: "ad_valorem", concepto: "Ad valorem", montoUsd: fiscal.adValorem, grupo: "tributos", detalle: pct(adValoremRate) },
    { clave: "isc", concepto: "ISC", montoUsd: fiscal.isc, grupo: "tributos", detalle: pct(iscRate) },
    { clave: "igv", concepto: "IGV", montoUsd: fiscal.igv, grupo: "tributos", detalle: pct(PRICING_CONFIG.igvRate) },
    { clave: "ipm", concepto: "IPM", montoUsd: fiscal.ipm, grupo: "tributos", detalle: pct(PRICING_CONFIG.ipmRate) },
    { clave: "percepcion", concepto: "Percepción del IGV (adelanto recuperable)", montoUsd: fiscal.percepcion, grupo: "informativo", detalle: `${pct(percepcionRate)} · se paga con la DAM${percepcionEnTributos ? ", incluida en el Pago 4 (H5)" : ""}` },
    { clave: "gastos_aduana", concepto: "Gastos de aduana (agente, almacenaje, grúa del puerto)", montoUsd: gastosAduana, grupo: "gastos", detalle: "Pago 3 según la pro forma del agente; el sobrante o faltante se compensa en el Pago 5" },
    { clave: "honorarios", concepto: "Honorarios de Luxcars (IGV incluido, gestión registral y placas incluidas)", montoUsd: honorarios, grupo: "honorarios", detalle: `Base ${fmt(honorariosBase)} + IGV ${fmt(honorariosIgv)} · tasa efectiva ${pct(BrokerModule.effectiveRate({ costBeforeFee: costoPuestoEnLima }))}` },
    { clave: "total", concepto: "Total estimado sin percepción", montoUsd: totalSinPercepcion, grupo: "informativo" },
    { clave: "total_con_percepcion", concepto: "Efectivo total con percepción", montoUsd: totalConPercepcion, grupo: "informativo" },
  ];
  const lineas = brutas.map((l) => ({ ...l, montoUsd: redondear(l.montoUsd) }));

  return {
    motorVersion: MOTOR_VERSION,
    entrada: { ...entrada },
    precioUsd: redondear(precioUsd),
    costoInspeccion: redondear(costoInspeccion),
    fleteBase,
    proporcionFlete: entrada.proporcionFlete,
    flete: redondear(flete),
    seguro: redondear(seguro),
    cif: redondear(cif),
    adValorem: redondear(fiscal.adValorem),
    isc: redondear(fiscal.isc),
    igv: redondear(fiscal.igv),
    ipm: redondear(fiscal.ipm),
    percepcion: redondear(fiscal.percepcion),
    tributos: tributosMostrados,
    gastosAduana,
    costoPuestoEnLima: redondear(costoPuestoEnLima),
    honorarios: redondear(honorarios),
    honorariosBase: redondear(honorariosBase),
    honorariosIgv: redondear(honorariosIgv),
    totalSinPercepcion: redondear(totalSinPercepcion),
    totalConPercepcion: redondear(totalConPercepcion),
    lineas,
    hitos: [
      { tipo: "H1", montoUsd: redondear(h1), cuenta: CUENTA_POR_HITO.H1, descripcion: costoInspeccion > 0 ? `${DESCRIPCION_HITO.H1}, más la inspección del usado` : DESCRIPCION_HITO.H1 },
      { tipo: "H2", montoUsd: redondear(h2), cuenta: CUENTA_POR_HITO.H2, descripcion: DESCRIPCION_HITO.H2 },
      { tipo: "H3", montoUsd: redondear(mitad), cuenta: CUENTA_POR_HITO.H3, descripcion: DESCRIPCION_HITO.H3 },
      { tipo: "H4", montoUsd: redondear(h4), cuenta: CUENTA_POR_HITO.H4, descripcion: DESCRIPCION_HITO.H4 },
      { tipo: "H5", montoUsd: redondear(h5), cuenta: CUENTA_POR_HITO.H5, descripcion: `${DESCRIPCION_HITO.H5} (estimado; se paga la cifra exacta de la liquidación)` },
      { tipo: "H6", montoUsd: redondear(mitad), cuenta: CUENTA_POR_HITO.H6, descripcion: DESCRIPCION_HITO.H6 },
    ],
    tasas: {
      adValorem: adValoremRate,
      isc: iscRate,
      igv: PRICING_CONFIG.igvRate,
      ipm: PRICING_CONFIG.ipmRate,
      percepcion: percepcionRate,
      seguroTasa: PRICING_CONFIG.insuranceRate,
      seguroFactorAsegurado: PRICING_CONFIG.insuredValueFactor,
      seguroMinimo: PRICING_CONFIG.insuranceMinimum,
      honorariosTramos: PRICING_CONFIG.brokerFeeTiers.map((t) => ({ hasta: t.upTo, tasa: t.rate })),
      honorariosMinimo: PRICING_CONFIG.brokerFeeMinimum,
      honorariosTasaEfectiva: BrokerModule.effectiveRate({ costBeforeFee: costoPuestoEnLima }),
      igvHonorarios: IGV_HONORARIOS,
    },
  };
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}
