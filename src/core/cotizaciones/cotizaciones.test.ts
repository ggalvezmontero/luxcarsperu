/**
 * Cotizaciones: cálculo, reparto, documento y presupuesto del expediente.
 * Cifras inventadas a propósito (el repo es público): nada de clientes reales.
 */
import { describe, expect, it } from "vitest";
import { textoDeEstructura } from "../expedientes/documentos/estructura";
import {
  calcularCotizacion,
  construirDocumentoCotizacion,
  estadoEfectivo,
  formatoCodigoCotizacion,
  honorariosPropuestos,
  importadorCompleto,
  presupuestoDesdeCotizacion,
  repartir,
  validarDatos,
  venceEl,
  type ClienteCotizacion,
  type DatosCotizacion,
} from "./index";

const persona: ClienteCotizacion = { tipo: "persona", nombre: "Cliente de Prueba", documento: "09999999", email: "", telefono: "" };
const empresa = (n: string, ruc: string): ClienteCotizacion => ({ tipo: "empresa", nombre: n, documento: ruc, email: "", telefono: "" });

const dosAutos = (importadores: [ClienteCotizacion | null, ClienteCotizacion | null]): DatosCotizacion => ({
  autos: [
    { marca: "Marca", modelo: "Alfa Sport", anio: 2026, color: "Gris", condicion: "nuevo", propulsion: "gasolina", origen: "originario-usa", precio: 50000, importador: importadores[0] },
    { marca: "Otra", modelo: "Beta Hybrid", anio: 2026, color: "", condicion: "nuevo", propulsion: "hev", origen: "originario-usa", precio: 60000, importador: importadores[1] },
  ],
  costos: { flete: 4000, seguro: 600, gastosAduana: 3000, honorarios: 12000 },
  reparto: { modo: "iguales" },
});

describe("cálculo", () => {
  it("reparte en mitades y encadena los tributos como src/core/pricing", () => {
    const r = calcularCotizacion(dosAutos([null, null]));
    const [a, b] = r.autos;
    expect(a.flete).toBe(2000);
    expect(a.seguro).toBe(300);
    expect(a.cif).toBe(52300);
    expect(a.adValorem).toBe(0);
    expect(a.isc).toBe(5230); // gasolina nueva 10 %
    expect(a.igv).toBe(8917.15); // 15.5 % de 57,530
    expect(a.ipm).toBe(1438.25);
    expect(a.tributos).toBe(15585.4);
    expect(a.total).toBe(52300 + 1500 + 6000 + 15585.4);
    expect(b.isc).toBe(0); // híbrido nuevo
    expect(r.total).toBe(Math.round((a.total + b.total) * 100) / 100);
    // Los cinco pagos suman el total de cada auto.
    for (const x of r.autos) expect(x.pagos.reduce((s, v) => s + v, 0)).toBeCloseTo(x.total, 2);
    expect(a.pagos[1]).toBe(2000 + 300 + 3000);
    // Percepción aparte: 10 % y 3.5 % sobre CIF + tributos.
    expect(a.percepcionPrimera).toBe(Math.round((52300 + 5230 + 8917.15 + 1438.25) * 0.1 * 100) / 100);
    expect(a.tasaPercepcionRecurrente).toBe(0.035);
  });

  it("reparte por porcentaje y cuadra al centavo", () => {
    expect(repartir(100, [1 / 3, 1 / 3, 1 / 3])).toEqual([33.33, 33.33, 33.34]);
    const d = { ...dosAutos([null, null]), reparto: { modo: "porcentaje" as const, porcentajes: [60, 40] } };
    const r = calcularCotizacion(d);
    expect(r.autos[0].flete).toBe(2400);
    expect(r.autos[1].honorarios).toBe(4800);
    expect(validarDatos({ ...d, reparto: { modo: "porcentaje", porcentajes: [60, 30] } })).toMatch(/suman 90/);
  });

  it("sin TLC aplica 6 % de ad valorem; un diésel usado no se cotiza", () => {
    const d = dosAutos([null, null]);
    d.autos[0].origen = "otro";
    expect(calcularCotizacion(d).autos[0].adValorem).toBe(Math.round(52300 * 0.06 * 100) / 100);
    d.autos[1] = { ...d.autos[1], propulsion: "diesel", condicion: "usado" };
    expect(validarDatos(d)).toMatch(/no se puede importar/);
  });

  it("propone honorarios con la regla de pricing, por auto", () => {
    expect(honorariosPropuestos(dosAutos([null, null]))).toBeGreaterThan(0);
  });
});

describe("documento", () => {
  it("un importador: autos, calendario conjunto y sin detracción si es persona", () => {
    const d = dosAutos([null, null]);
    const r = calcularCotizacion(d);
    const txt = textoDeEstructura(construirDocumentoCotizacion({ codigo: "COT-2026-900", fecha: "2026-11-28", cliente: persona, datos: d, resultado: r }));
    expect(txt).toContain("Auto 1");
    expect(txt).toContain("3. Calendario de pagos");
    expect(txt).toContain("Pago 1 de 5");
    expect(txt).toContain("Pago 5 de 5");
    expect(txt).toContain("ISC (gasolina 10 %, híbrido 0 %)");
    expect(txt).toContain("Ad valorem (0 %, TLC Perú–EE.UU.)");
    expect(txt).not.toContain("detracción");
    expect(txt).toContain("puede pedir a SUNAT su devolución");
    expect(txt).toContain("Lima, 28 de noviembre de 2026");
  });

  it("dos empresas conocidas: su razón social en la tabla, calendario de cada empresa y detracción", () => {
    const d = dosAutos([empresa("Uno S.A.C.", "20000000001"), empresa("Dos S.A.C.", "20000000002")]);
    const r = calcularCotizacion(d);
    const txt = textoDeEstructura(construirDocumentoCotizacion({ codigo: "COT-2026-901", fecha: "2026-11-28", cliente: persona, datos: d, resultado: r }));
    expect(txt).toContain("Dos S.A.C.");
    expect(txt).toContain("Calendario de pagos de cada empresa");
    expect(txt).toContain("entre las dos");
    expect(txt).toContain("Crédito fiscal y detracción");
    expect(txt).toContain("por la Alfa y");
  });
});

describe("contacto e importadores", () => {
  const pendiente = (): ClienteCotizacion => ({ tipo: "empresa", nombre: "", documento: "", email: "", telefono: "" });

  it("importadores pendientes: Atención al contacto, Empresa 1 y 2, calendario de cada empresa", () => {
    const d = dosAutos([pendiente(), pendiente()]);
    expect(validarDatos(d)).toBeNull();
    const txt = textoDeEstructura(construirDocumentoCotizacion({ codigo: "COT-2026-902", fecha: "2026-11-28", cliente: persona, datos: d, resultado: calcularCotizacion(d) }));
    expect(txt).toContain("Atención: Cliente de Prueba · un contenedor · dos empresas importadoras");
    expect(txt).toContain("Empresa 1");
    expect(txt).toContain("Empresa 2");
    expect(txt).toContain("Calendario de pagos de cada empresa");
    expect(txt).toContain("Crédito fiscal y detracción");
  });

  it("con la razón social conocida, la tabla de vehículos la muestra", () => {
    const d = dosAutos([empresa("Uno S.A.C.", "20000000001"), pendiente()]);
    const txt = textoDeEstructura(construirDocumentoCotizacion({ codigo: "COT-2026-903", fecha: "2026-11-28", cliente: persona, datos: d, resultado: calcularCotizacion(d) }));
    expect(txt).toContain("Uno S.A.C.");
    expect(txt).toContain("Empresa 2");
  });

  it("un solo importador distinto del contacto: Atención y quién importa", () => {
    const uno = empresa("Uno S.A.C.", "20000000001");
    const d = dosAutos([uno, uno]);
    const txt = textoDeEstructura(construirDocumentoCotizacion({ codigo: "COT-2026-904", fecha: "2026-11-28", cliente: persona, datos: d, resultado: calcularCotizacion(d) }));
    expect(txt).toContain("Atención: Cliente de Prueba · importa Uno S.A.C.");
    expect(txt).toContain("Auto 2");
    expect(txt).toContain("3. Calendario de pagos");
  });

  it("para aceptar el importador necesita nombre y RUC o DNI", () => {
    expect(importadorCompleto(pendiente())).toBe(false);
    expect(importadorCompleto(empresa("Uno S.A.C.", "2000000000"))).toBe(false);
    expect(importadorCompleto(empresa("Uno S.A.C.", "20000000001"))).toBe(true);
    expect(importadorCompleto(persona)).toBe(true);
  });
});

describe("presupuesto del expediente", () => {
  it("lleva las cifras de la cotización, no las del motor", () => {
    const d = dosAutos([null, null]);
    const r = calcularCotizacion(d);
    const p = presupuestoDesdeCotizacion(d.autos[0], r.autos[0], { codigo: "COT-2026-900", fleteContenedor: 4000, perfil: "primera-importacion" });
    expect(p.seguro).toBe(300);
    expect(p.honorarios).toBe(6000);
    expect(p.proporcionFlete).toBe(0.5);
    expect(p.totalSinPercepcion).toBe(r.autos[0].total);
    const h = Object.fromEntries(p.hitos.map((x) => [x.tipo, x.montoUsd]));
    expect(h.H1).toBe(r.autos[0].pagos[0]);
    expect(h.H2 + h.H3).toBe(r.autos[0].pagos[1]);
    expect(h.H4).toBe(r.autos[0].pagos[2]);
    expect(h.H5).toBe(r.autos[0].pagos[3]); // sin percepción, como la cotización
    expect(h.H6).toBe(r.autos[0].pagos[4]);
    expect(p.honorariosBase + p.honorariosIgv).toBeCloseTo(6000, 2);
  });
});

describe("estado", () => {
  it("código, vigencia y vencida por fecha", () => {
    expect(formatoCodigoCotizacion(2026, 36)).toBe("COT-2026-036");
    expect(venceEl("2026-11-28")).toBe("2026-12-13");
    expect(estadoEfectivo("enviada", "2026-12-13", "2026-12-14")).toBe("vencida");
    expect(estadoEfectivo("enviada", "2026-12-13", "2026-12-13")).toBe("enviada");
  });
});
