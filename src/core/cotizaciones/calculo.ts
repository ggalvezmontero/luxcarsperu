/**
 * Cálculo de una cotización de importación a pedido.
 *
 * REUTILIZA `src/core/pricing/` sin tocarlo: las tasas de ad valorem e ISC
 * (`resolveAdValoremRate`, `resolveIscRate`), la cascada de tributos
 * (`calculateFiscalFees`) y la percepción (`resolvePercepcionRate`); y, para
 * proponer cifras, el seguro (`InsuranceModule`) y la comisión escalonada
 * (`BrokerModule`). Lo propio de la cotización es que los costos del
 * contenedor (flete, seguro, gastos de aduana y honorarios) se escriben como
 * totales y se reparten entre los autos, en partes iguales o por porcentaje.
 *
 *   flete, seguro, aduana, honorarios de cada auto = total × su proporción
 *     (el último auto lleva el resto, para que la suma cuadre al centavo)
 *   cif      = precio + flete + seguro
 *   tributos = r2(ad valorem) + r2(ISC) + r2(IGV) + r2(IPM)   (percepción aparte)
 *   total    = precio + flete + seguro + aduana + honorarios + tributos
 *   pagos    = precio · flete + seguro + ½ honorarios · aduana · tributos · ½ honorarios
 *
 * La percepción (10 % primera importación, 3.5 % recurrente) NO entra en el
 * total: es un adelanto recuperable y sale como nota.
 */

import { BrokerModule } from "../modules/BrokerModule";
import { InsuranceModule } from "../modules/InsuranceModule";
import { calculateFiscalFees } from "../pricing/feeStrategies";
import { resolveAdValoremRate, resolvePercepcionRate } from "../pricing/pricingConfig";
import { getVehicleCategory, resolveIscRate } from "../pricing/vehicleCategories";
import type { AutoCotizacion, DatosCotizacion, Reparto, ResultadoAuto, ResultadoCotizacion } from "./tipos";

export class CotizacionNoCalculableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CotizacionNoCalculableError";
  }
}

export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** "Marca Modelo Versión 2026". */
export function nombreAuto(a: Pick<AutoCotizacion, "marca" | "modelo" | "version" | "anio">): string {
  return [a.marca, a.modelo, a.version, a.anio ? String(a.anio) : ""].map((s) => (s ?? "").toString().trim()).filter(Boolean).join(" ");
}

/** "Modelo Versión": el modelo (con su versión), para las columnas de las tablas. */
export function nombreCortoAuto(a: Pick<AutoCotizacion, "marca" | "modelo" | "version">): string {
  const corto = [a.modelo, a.version].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
  return corto || a.marca.trim();
}

/** Proporciones de cada auto (suman 1). */
export function proporciones(reparto: Reparto, n: number): number[] {
  if (n <= 0) return [];
  if (reparto.modo === "iguales") return Array.from({ length: n }, () => 1 / n);
  return Array.from({ length: n }, (_, i) => (reparto.porcentajes[i] ?? 0) / 100);
}

/** Reparte un total según las proporciones; el último lleva el resto para cuadrar al centavo. */
export function repartir(total: number, props: readonly number[]): number[] {
  const partes = props.map((p) => r2(total * p));
  if (partes.length > 0) {
    const resto = r2(total - partes.slice(0, -1).reduce((s, x) => s + x, 0));
    partes[partes.length - 1] = resto;
  }
  return partes;
}

/** Primer error de los datos, o `null` si se pueden calcular. */
export function validarDatos(datos: DatosCotizacion): string | null {
  if (!datos.autos.length) return "Agrega al menos un auto.";
  if (datos.autos.length > 10) return "Una cotización lleva hasta diez autos.";
  for (const [i, a] of datos.autos.entries()) {
    const n = `Auto ${i + 1}`;
    if (!a.marca.trim()) return `${n}: falta la marca.`;
    if (!a.modelo.trim()) return `${n}: falta el modelo.`;
    if (!Number.isInteger(a.anio) || a.anio < 1980 || a.anio > 2100) return `${n}: el año no es válido.`;
    if (!Number.isFinite(a.precio) || a.precio <= 0) return `${n}: escribe el precio en USD.`;
    if (resolveIscRate({ category: getVehicleCategory(a.propulsion), condition: a.condicion }) === null) {
      return `${n}: un ${getVehicleCategory(a.propulsion).label.toLowerCase()} usado no se puede importar.`;
    }
    if (a.importador) {
      if (a.importador.nombre.trim().length < 2) return `${n}: falta el nombre o la razón social del importador.`;
      if (a.importador.tipo === "empresa" && a.importador.documento.trim() && !/^\d{11}$/.test(a.importador.documento.trim())) {
        return `${n}: el RUC del importador tiene 11 dígitos.`;
      }
    }
  }
  const c = datos.costos;
  for (const [k, v] of Object.entries({ flete: c.flete, seguro: c.seguro, "gastos de aduana": c.gastosAduana, honorarios: c.honorarios })) {
    if (!Number.isFinite(v) || v < 0) return `El monto de ${k} no es válido.`;
  }
  if (datos.reparto.modo === "porcentaje") {
    const ps = datos.reparto.porcentajes.slice(0, datos.autos.length);
    if (ps.length !== datos.autos.length || ps.some((p) => !Number.isFinite(p) || p <= 0)) return "Escribe el porcentaje de cada auto.";
    const suma = ps.reduce((s, p) => s + p, 0);
    if (Math.abs(suma - 100) > 0.01) return `Los porcentajes suman ${r2(suma)} %: deben sumar 100 %.`;
  }
  return null;
}

function tasas(a: AutoCotizacion) {
  const isc = resolveIscRate({
    category: getVehicleCategory(a.propulsion),
    condition: a.condicion,
    cylinderCapacityCc: a.cilindradaCc ?? undefined,
  });
  if (isc === null) throw new CotizacionNoCalculableError(`Un ${getVehicleCategory(a.propulsion).label} usado no se puede importar.`);
  return { adValorem: resolveAdValoremRate({ origin: a.origen, condition: a.condicion }), isc };
}

/** Costo puesto en Lima antes de honorarios de un auto con sus costos ya repartidos. */
function costoSinHonorarios(a: AutoCotizacion, flete: number, seguro: number, aduana: number): number {
  const t = tasas(a);
  const f = calculateFiscalFees({ cif: a.precio + flete + seguro, adValoremRate: t.adValorem, iscRate: t.isc, percepcionRate: 0 });
  return a.precio + flete + seguro + aduana + f.adValorem + f.isc + f.igv + f.ipm;
}

export function calcularCotizacion(datos: DatosCotizacion): ResultadoCotizacion {
  const error = validarDatos(datos);
  if (error) throw new CotizacionNoCalculableError(error);
  const n = datos.autos.length;
  const props = proporciones(datos.reparto, n);
  const fletes = repartir(datos.costos.flete, props);
  const seguros = repartir(datos.costos.seguro, props);
  const aduanas = repartir(datos.costos.gastosAduana, props);
  const honorarios = repartir(datos.costos.honorarios, props);

  const autos: ResultadoAuto[] = datos.autos.map((a, i) => {
    const t = tasas(a);
    const precio = r2(a.precio);
    const flete = fletes[i];
    const seguro = seguros[i];
    const cif = r2(precio + flete + seguro);
    const f = calculateFiscalFees({ cif, adValoremRate: t.adValorem, iscRate: t.isc, percepcionRate: 0 });
    const adValorem = r2(f.adValorem);
    const isc = r2(f.isc);
    const igv = r2(f.igv);
    const ipm = r2(f.ipm);
    const tributos = r2(adValorem + isc + igv + ipm);
    const gastosAduana = aduanas[i];
    const hon = honorarios[i];
    const mitad1 = r2(hon / 2);
    const mitad2 = r2(hon - mitad1);
    const pagos: ResultadoAuto["pagos"] = [precio, r2(flete + seguro + mitad1), gastosAduana, tributos, mitad2];
    const total = r2(pagos.reduce((s, x) => s + x, 0));
    const base = f.percepcionBase;
    const tasaPrimera = resolvePercepcionRate({ profile: "primera-importacion", condition: a.condicion });
    const tasaRecurrente = resolvePercepcionRate({ profile: "recurrente", condition: a.condicion });
    return {
      indice: i + 1,
      nombre: nombreAuto(a),
      nombreCorto: nombreCortoAuto(a),
      precio,
      flete,
      seguro,
      cif,
      tasaAdValorem: t.adValorem,
      tasaIsc: t.isc,
      adValorem,
      isc,
      igv,
      ipm,
      tributos,
      gastosAduana,
      honorarios: hon,
      costoAntesDeHonorarios: r2(cif + tributos + gastosAduana),
      total,
      percepcionBase: r2(base),
      percepcionPrimera: r2(base * tasaPrimera),
      percepcionRecurrente: r2(base * tasaRecurrente),
      tasaPercepcionPrimera: tasaPrimera,
      tasaPercepcionRecurrente: tasaRecurrente,
      proporcion: props[i],
      pagos,
    };
  });

  return {
    autos,
    total: r2(autos.reduce((s, a) => s + a.total, 0)),
    honorariosPropuestos: honorariosPropuestos(datos),
    seguroPropuesto: seguroPropuesto(datos),
  };
}

/** Seguro según InsuranceModule (0.5 % del 110 % del precio, mínimo 45), suma de los autos. */
export function seguroPropuesto(datos: Pick<DatosCotizacion, "autos">): number {
  return r2(datos.autos.reduce((s, a) => s + (a.precio > 0 ? InsuranceModule.calculate({ priceMiami: a.precio }) : 0), 0));
}

/**
 * Honorarios según la regla de `src/core/pricing` (BrokerModule: tramo sobre el
 * costo puesto en Lima de CADA auto, con su mínimo), con el flete, el seguro y
 * la aduana ya repartidos. Suma de los autos. Es una propuesta: se puede
 * escribir otra cifra.
 */
export function honorariosPropuestos(datos: DatosCotizacion): number {
  const n = datos.autos.length;
  if (!n) return 0;
  const props = proporciones(datos.reparto, n);
  const fletes = repartir(datos.costos.flete, props);
  const seguros = repartir(datos.costos.seguro, props);
  const aduanas = repartir(datos.costos.gastosAduana, props);
  let total = 0;
  for (const [i, a] of datos.autos.entries()) {
    if (!(a.precio > 0)) continue;
    try {
      total += BrokerModule.calculate({ costBeforeFee: costoSinHonorarios(a, fletes[i], seguros[i], aduanas[i]) });
    } catch {
      // Un usado prohibido no tiene propuesta; la validación lo avisa aparte.
    }
  }
  return r2(total);
}
