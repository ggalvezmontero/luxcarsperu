/**
 * Presupuesto del expediente (Anexo B) e hitos de pago.
 *
 * REUTILIZA EL MOTOR VERIFICADO de `src/core/pricing/` por sus funciones
 * exportadas: seguro, cascada tributaria, tasas por origen, condición y
 * perfil, y la comisión escalonada. No reimplementa ninguna tasa. Lo que
 * agrega es lo propio de un expediente: precio en otra moneda con tipo de
 * cambio de referencia, transporte interno, flete repartido en un consolidado,
 * gastos registrales, margen de H3 y el reparto en cuatro hitos.
 *
 *   flete  = fleteBase × proporcionFlete
 *   seguro = InsuranceModule (0.5 % del 110 % del precio, mínimo 45)
 *   cif    = precioUsd + inland + flete + seguro
 *   tributos = calculateFiscalFees(cif, ad valorem, ISC, percepción)
 *   costoPuestoEnLima = cif + tributos + gastosAduana
 *   honorarios = BrokerModule (IGV incluido; base = ÷ 1.18)
 *   H1 = 30 % honorarios · H4 = 70 %
 *   H2 = precioUsd + inland + flete + seguro
 *   H3 = (tributos [+ percepción] + gastosAduana + gastosRegistrales) × (1 + margenH3)
 *
 * La percepción NO es un costo (se recupera como crédito fiscal) pero sí es
 * caja que se paga al numerar la DAM, por eso entra en H3 salvo que se pida lo
 * contrario, y siempre se muestra como línea informativa aparte.
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

export const MOTOR_VERSION = "src/core/expedientes@2026.11 · pricing tramos 2026-11-18";

/** IGV sobre honorarios: la comisión del motor ya lo incluye; la base de la factura es ÷ 1.18. */
export const IGV_HONORARIOS = PRICING_CONFIG.igvRate + PRICING_CONFIG.ipmRate;

export const PORCENTAJE_H1 = 0.3;
export const PORCENTAJE_H4 = 0.7;

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
    inland: 0,
    fleteBase: fleteBasePorDefecto(parcial.vehicleType),
    proporcionFlete: 1,
    gastosAduana: PRICING_CONFIG.customsCostsUsd,
    gastosRegistrales: 0,
    margenH3: 0,
    percepcionEnH3: true,
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
  if (entrada.margenH3 < 0 || entrada.margenH3 > 1) {
    throw new PresupuestoNoCalculableError("El margen de H3 va de 0 a 1.");
  }

  const precioUsd = precio * tc;
  const inland = positivo(entrada.inland, "El transporte interno");
  const fleteBase = positivo(entrada.fleteBase, "El flete base");
  const flete = fleteBase * entrada.proporcionFlete;
  const seguro = InsuranceModule.calculate({ priceMiami: precioUsd });
  const cif = precioUsd + inland + flete + seguro;

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
  const gastosRegistrales = positivo(entrada.gastosRegistrales, "Los gastos registrales");
  const costoPuestoEnLima = cif + tributos + gastosAduana;

  const honorarios = BrokerModule.calculate({ costBeforeFee: costoPuestoEnLima });
  const honorariosBase = honorarios / (1 + IGV_HONORARIOS);
  const honorariosIgv = honorarios - honorariosBase;

  const percepcionEnH3 = entrada.percepcionEnH3 ?? true;
  const h2 = precioUsd + inland + flete + seguro;
  const baseH3 = tributos + (percepcionEnH3 ? fiscal.percepcion : 0) + gastosAduana + gastosRegistrales;
  const h3 = baseH3 * (1 + entrada.margenH3);
  const h1 = honorarios * PORCENTAJE_H1;
  const h4 = honorarios * PORCENTAJE_H4;

  const totalSinPercepcion = cif + tributos + gastosAduana + gastosRegistrales + honorarios;
  const totalConPercepcion = totalSinPercepcion + fiscal.percepcion;

  const pct = (r: number) => `${(r * 100).toFixed(r * 100 % 1 === 0 ? 0 : 1)} %`;
  const brutas: LineaPresupuesto[] = [
    { clave: "precio", concepto: "Precio del vehículo", montoUsd: precioUsd, grupo: "vehiculo", detalle: tc === 1 ? undefined : `${entrada.monedaCompra.toUpperCase()} ${fmt(precio)} × ${tc}` },
    { clave: "inland", concepto: "Transporte interno hasta el puerto de salida", montoUsd: inland, grupo: "logistica" },
    { clave: "flete", concepto: "Flete marítimo", montoUsd: flete, grupo: "logistica", detalle: entrada.proporcionFlete === 1 ? "Contenedor exclusivo" : `${pct(entrada.proporcionFlete)} del contenedor (${fmt(fleteBase)})` },
    { clave: "seguro", concepto: "Seguro de transporte", montoUsd: seguro, grupo: "logistica", detalle: `${pct(PRICING_CONFIG.insuranceRate)} del ${pct(PRICING_CONFIG.insuredValueFactor)} del precio` },
    { clave: "cif", concepto: "Valor CIF (base de los tributos)", montoUsd: cif, grupo: "informativo" },
    { clave: "ad_valorem", concepto: "Ad valorem", montoUsd: fiscal.adValorem, grupo: "tributos", detalle: pct(adValoremRate) },
    { clave: "isc", concepto: "ISC", montoUsd: fiscal.isc, grupo: "tributos", detalle: pct(iscRate) },
    { clave: "igv", concepto: "IGV", montoUsd: fiscal.igv, grupo: "tributos", detalle: pct(PRICING_CONFIG.igvRate) },
    { clave: "ipm", concepto: "IPM", montoUsd: fiscal.ipm, grupo: "tributos", detalle: pct(PRICING_CONFIG.ipmRate) },
    { clave: "percepcion", concepto: "Percepción del IGV (adelanto recuperable)", montoUsd: fiscal.percepcion, grupo: "informativo", detalle: `${pct(percepcionRate)} · se paga al numerar la DAM${percepcionEnH3 ? ", incluida en H3" : ""}` },
    { clave: "gastos_aduana", concepto: "Gastos de aduana (agente, almacén, grúa)", montoUsd: gastosAduana, grupo: "gastos" },
    { clave: "gastos_registrales", concepto: "Gastos registrales y placas", montoUsd: gastosRegistrales, grupo: "gastos" },
    { clave: "honorarios", concepto: "Honorarios de Luxcars (IGV incluido)", montoUsd: honorarios, grupo: "honorarios", detalle: `Base ${fmt(honorariosBase)} + IGV ${fmt(honorariosIgv)} · tasa efectiva ${pct(BrokerModule.effectiveRate({ costBeforeFee: costoPuestoEnLima }))}` },
    { clave: "total", concepto: "Total estimado sin percepción", montoUsd: totalSinPercepcion, grupo: "informativo" },
    { clave: "total_con_percepcion", concepto: "Efectivo total con percepción", montoUsd: totalConPercepcion, grupo: "informativo" },
  ];
  const lineas = brutas.map((l) => ({ ...l, montoUsd: redondear(l.montoUsd) }));

  return {
    motorVersion: MOTOR_VERSION,
    entrada: { ...entrada },
    precioUsd: redondear(precioUsd),
    inland,
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
    tributos: redondear(tributos),
    gastosAduana,
    gastosRegistrales,
    costoPuestoEnLima: redondear(costoPuestoEnLima),
    honorarios: redondear(honorarios),
    honorariosBase: redondear(honorariosBase),
    honorariosIgv: redondear(honorariosIgv),
    margenH3: entrada.margenH3,
    totalSinPercepcion: redondear(totalSinPercepcion),
    totalConPercepcion: redondear(totalConPercepcion),
    lineas,
    hitos: [
      { tipo: "H1", montoUsd: redondear(h1), cuenta: CUENTA_POR_HITO.H1, descripcion: DESCRIPCION_HITO.H1 },
      { tipo: "H2", montoUsd: redondear(h2), cuenta: CUENTA_POR_HITO.H2, descripcion: DESCRIPCION_HITO.H2 },
      { tipo: "H3", montoUsd: redondear(h3), cuenta: CUENTA_POR_HITO.H3, descripcion: DESCRIPCION_HITO.H3 + (entrada.margenH3 > 0 ? ` (+${pct(entrada.margenH3)} de margen)` : "") },
      { tipo: "H4", montoUsd: redondear(h4), cuenta: CUENTA_POR_HITO.H4, descripcion: DESCRIPCION_HITO.H4 },
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
