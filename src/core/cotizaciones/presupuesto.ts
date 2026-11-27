/**
 * Presupuesto del expediente (el que se guarda en `expedientes.presupuesto` y
 * alimenta el Anexo B y el calendario) armado con LAS CIFRAS DE LA COTIZACIÓN.
 *
 * No llama a `presupuestar()`: ese motor propone el seguro (InsuranceModule) y
 * los honorarios (BrokerModule) por su cuenta, y la cotización los pudo
 * escribir a mano o repartir desde el total del contenedor. Acá se arma la
 * misma forma (`Presupuesto`) con el precio, el flete, el seguro, los tributos,
 * los gastos de aduana y los honorarios de la cotización, para que el Anexo B y
 * los cinco pagos digan exactamente lo mismo que el PDF que vio el cliente.
 *
 * Las tasas siguen saliendo de `src/core/pricing` (las mismas que usó el cálculo).
 */

import { CUENTA_POR_HITO, DESCRIPCION_HITO, redondear } from "../expedientes/hitos";
import type { LineaPresupuesto, Presupuesto } from "../expedientes/tipos";
import { BrokerModule } from "../modules/BrokerModule";
import { PRICING_CONFIG, resolvePercepcionRate, type ImporterProfile } from "../pricing/pricingConfig";
import { r2 } from "./calculo";
import { pct } from "./documento";
import type { AutoCotizacion, ResultadoAuto } from "./tipos";

/** IGV sobre honorarios (la cifra de la cotización ya lo incluye). */
const IGV_HONORARIOS = PRICING_CONFIG.igvRate + PRICING_CONFIG.ipmRate;

export function motorVersionCotizacion(codigo: string): string {
  return `cotización ${codigo} · src/core/cotizaciones@2026.11.28 · cifras de la cotización`;
}

export type OpcionesPresupuesto = {
  codigo: string;
  /** Flete total del contenedor (para la línea "x % del contenedor"). */
  fleteContenedor: number;
  perfil: ImporterProfile;
  /** Si la percepción se suma al Pago 4. Por defecto no: así el Pago 4 es el de la cotización. */
  percepcionEnTributos?: boolean;
};

export function presupuestoDesdeCotizacion(auto: AutoCotizacion, r: ResultadoAuto, o: OpcionesPresupuesto): Presupuesto {
  const percepcionEnTributos = o.percepcionEnTributos ?? false;
  const tasaPercepcion = resolvePercepcionRate({ profile: o.perfil, condition: auto.condicion });
  const percepcion = r2(r.percepcionBase * tasaPercepcion);
  const honorarios = r.honorarios;
  const honorariosBase = r2(honorarios / (1 + IGV_HONORARIOS));
  const honorariosIgv = r2(honorarios - honorariosBase);
  const costoPuestoEnLima = r.costoAntesDeHonorarios;
  const totalSinPercepcion = r.total;
  const totalConPercepcion = r2(totalSinPercepcion + percepcion);
  const [h1, h2pago, h4, h5, h6] = r.pagos;
  const mitad1 = r2(h2pago - r.flete - r.seguro);
  const fleteContenedor = o.fleteContenedor > 0 ? o.fleteContenedor : r.flete;
  const proporcionFlete = fleteContenedor > 0 ? Math.min(1, Math.max(0.0001, r.flete / fleteContenedor)) : r.proporcion || 1;
  const tasaEfectiva = costoPuestoEnLima > 0 ? honorarios / costoPuestoEnLima : 0;

  const lineas: LineaPresupuesto[] = [
    { clave: "precio", concepto: "Precio del vehículo", montoUsd: r.precio, grupo: "vehiculo", detalle: `Según la cotización ${o.codigo}` },
    { clave: "flete", concepto: "Flete (traslado al puerto y marítimo)", montoUsd: r.flete, grupo: "logistica", detalle: proporcionFlete >= 0.9999 ? "Contenedor exclusivo" : `${pct(proporcionFlete)} del contenedor (${fmt(fleteContenedor)})` },
    { clave: "seguro", concepto: "Seguro de transporte", montoUsd: r.seguro, grupo: "logistica", detalle: `Según la cotización ${o.codigo}` },
    { clave: "cif", concepto: "Valor CIF (base de los tributos)", montoUsd: r.cif, grupo: "informativo" },
    { clave: "ad_valorem", concepto: "Ad valorem", montoUsd: r.adValorem, grupo: "tributos", detalle: pct(r.tasaAdValorem) },
    { clave: "isc", concepto: "ISC", montoUsd: r.isc, grupo: "tributos", detalle: pct(r.tasaIsc) },
    { clave: "igv", concepto: "IGV", montoUsd: r.igv, grupo: "tributos", detalle: pct(PRICING_CONFIG.igvRate) },
    { clave: "ipm", concepto: "IPM", montoUsd: r.ipm, grupo: "tributos", detalle: pct(PRICING_CONFIG.ipmRate) },
    { clave: "percepcion", concepto: "Percepción del IGV (adelanto recuperable)", montoUsd: percepcion, grupo: "informativo", detalle: `${pct(tasaPercepcion)} · se paga con la DAM${percepcionEnTributos ? ", incluida en el Pago 4 (H5)" : ", fuera del total de la cotización"}` },
    { clave: "gastos_aduana", concepto: "Gastos de aduana (agente, almacenaje, grúa del puerto)", montoUsd: r.gastosAduana, grupo: "gastos", detalle: "Pago 3; el sobrante o faltante se compensa en el Pago 5" },
    { clave: "honorarios", concepto: "Honorarios de Luxcars (IGV incluido, gestión registral y placas incluidas)", montoUsd: honorarios, grupo: "honorarios", detalle: `Base ${fmt(honorariosBase)} + IGV ${fmt(honorariosIgv)} · según la cotización ${o.codigo}` },
    { clave: "total", concepto: "Total estimado sin percepción", montoUsd: totalSinPercepcion, grupo: "informativo" },
    { clave: "total_con_percepcion", concepto: "Efectivo total con percepción", montoUsd: totalConPercepcion, grupo: "informativo" },
  ];

  return {
    motorVersion: motorVersionCotizacion(o.codigo),
    entrada: {
      precio: r.precio,
      monedaCompra: "USD",
      tcCompraRef: 1,
      vehicleType: auto.propulsion,
      condition: auto.condicion,
      origin: auto.origen,
      cylinderCapacityCc: auto.cilindradaCc ?? null,
      importerProfile: o.perfil,
      fleteBase: fleteContenedor,
      proporcionFlete,
      gastosAduana: r.gastosAduana,
      costoInspeccion: 0,
      percepcionEnTributos,
    },
    precioUsd: r.precio,
    costoInspeccion: 0,
    fleteBase: fleteContenedor,
    proporcionFlete,
    flete: r.flete,
    seguro: r.seguro,
    cif: r.cif,
    adValorem: r.adValorem,
    isc: r.isc,
    igv: r.igv,
    ipm: r.ipm,
    percepcion,
    tributos: r.tributos,
    gastosAduana: r.gastosAduana,
    costoPuestoEnLima,
    honorarios,
    honorariosBase,
    honorariosIgv,
    totalSinPercepcion,
    totalConPercepcion,
    lineas,
    hitos: [
      { tipo: "H1", montoUsd: redondear(h1), cuenta: CUENTA_POR_HITO.H1, descripcion: DESCRIPCION_HITO.H1 },
      { tipo: "H2", montoUsd: redondear(r.flete + r.seguro), cuenta: CUENTA_POR_HITO.H2, descripcion: DESCRIPCION_HITO.H2 },
      { tipo: "H3", montoUsd: redondear(mitad1), cuenta: CUENTA_POR_HITO.H3, descripcion: DESCRIPCION_HITO.H3 },
      { tipo: "H4", montoUsd: redondear(h4), cuenta: CUENTA_POR_HITO.H4, descripcion: DESCRIPCION_HITO.H4 },
      { tipo: "H5", montoUsd: redondear(h5 + (percepcionEnTributos ? percepcion : 0)), cuenta: CUENTA_POR_HITO.H5, descripcion: `${DESCRIPCION_HITO.H5} (estimado; se paga la cifra exacta de la liquidación)` },
      { tipo: "H6", montoUsd: redondear(h6), cuenta: CUENTA_POR_HITO.H6, descripcion: DESCRIPCION_HITO.H6 },
    ],
    tasas: {
      adValorem: r.tasaAdValorem,
      isc: r.tasaIsc,
      igv: PRICING_CONFIG.igvRate,
      ipm: PRICING_CONFIG.ipmRate,
      percepcion: tasaPercepcion,
      seguroTasa: PRICING_CONFIG.insuranceRate,
      seguroFactorAsegurado: PRICING_CONFIG.insuredValueFactor,
      seguroMinimo: PRICING_CONFIG.insuranceMinimum,
      honorariosTramos: PRICING_CONFIG.brokerFeeTiers.map((t) => ({ hasta: t.upTo, tasa: t.rate })),
      honorariosMinimo: PRICING_CONFIG.brokerFeeMinimum,
      honorariosTasaEfectiva: tasaEfectiva,
      igvHonorarios: IGV_HONORARIOS,
    },
  };
}

/** Honorarios que la regla propondría para este auto (informativo). */
export function honorariosReglaAuto(r: ResultadoAuto): number {
  return r2(BrokerModule.calculate({ costBeforeFee: r.costoAntesDeHonorarios }));
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}
