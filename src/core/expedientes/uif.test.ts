import { describe, expect, it } from "vitest";

import type { Cliente } from "./tipos";
import { csvRegistroUif, filasRegistroUif, operacionesReportables, type ExpedienteUif, type MovimientoUif } from "./uif";

const EXP: ExpedienteUif[] = [
  { id: "e1", codigo: "LC-2026-001", clienteId: "c1" },
  { id: "e2", codigo: "LC-2026-002", clienteId: "c1" },
  { id: "e3", codigo: "LC-2026-003", clienteId: "c2" },
];

const CLIENTES: Pick<Cliente, "id" | "tipo" | "razonSocial" | "ruc" | "dni">[] = [
  { id: "c1", tipo: "empresa", razonSocial: "ACME S.A.C.", ruc: "20123456789", dni: null },
  { id: "c2", tipo: "persona", razonSocial: "Juan Pérez", ruc: null, dni: "12345678" },
];

function mov(c: Partial<MovimientoUif> & Pick<MovimientoUif, "id" | "montoUsd" | "fecha">): MovimientoUif {
  return {
    expedienteId: "e1",
    tipo: "deposito",
    cuenta: "fondos_clientes",
    hito: null,
    estado: "confirmado",
    moneda: "USD",
    monto: c.montoUsd,
    tipoCambio: 1,
    concepto: null,
    contraparteId: null,
    ...c,
  };
}

describe("uif · operaciones individuales", () => {
  it("marca las ≥ 10,000 y deja fuera las menores, con el borde exacto incluido", () => {
    const r = operacionesReportables(
      [mov({ id: "a", montoUsd: 9_999.99, fecha: "2026-12-01" }), mov({ id: "b", montoUsd: 10_000, fecha: "2026-12-02" }), mov({ id: "c", montoUsd: 15_000, fecha: "2026-12-03" })],
      EXP,
      CLIENTES,
    );
    expect(r.map((x) => x.movimiento.id)).toEqual(["b", "c"]);
    expect(r[0].motivos).toEqual(["individual"]);
  });

  it("ignora anulados, por confirmar y ajustes aunque superen el umbral", () => {
    const r = operacionesReportables(
      [
        mov({ id: "a", montoUsd: 50_000, fecha: "2026-12-01", estado: "anulado" }),
        mov({ id: "b", montoUsd: 50_000, fecha: "2026-12-01", estado: "por_confirmar" }),
        mov({ id: "c", montoUsd: 50_000, fecha: "2026-12-01", tipo: "ajuste" }),
      ],
      EXP,
      CLIENTES,
    );
    expect(r).toEqual([]);
  });

  it("con moneda distinta a USD compara por monto_usd, no por monto", () => {
    const r = operacionesReportables(
      [mov({ id: "a", montoUsd: 7_300, monto: 10_000, moneda: "CAD", tipoCambio: 0.73, fecha: "2026-12-01" }), mov({ id: "b", montoUsd: 10_950, monto: 15_000, moneda: "CAD", tipoCambio: 0.73, fecha: "2026-12-01" })],
      EXP,
      CLIENTES,
    );
    expect(r.map((x) => x.movimiento.id)).toEqual(["b"]);
    const filas = filasRegistroUif(r);
    expect(filas[0]).toMatchObject({ moneda: "CAD", monto: 15_000, monto_usd: 10_950 });
  });
});

describe("uif · acumulado mensual por cliente", () => {
  it("si el cliente suma ≥ 50,000 en el mes, TODAS sus operaciones del mes se marcan, aun entre expedientes distintos", () => {
    const r = operacionesReportables(
      [
        mov({ id: "a", montoUsd: 9_000, fecha: "2026-12-01", expedienteId: "e1" }),
        mov({ id: "b", montoUsd: 9_000, fecha: "2026-12-10", expedienteId: "e2" }),
        mov({ id: "c", montoUsd: 32_000, fecha: "2026-12-20", expedienteId: "e1", tipo: "pago" }),
        // Otro cliente, mismo mes: no suma con ACME.
        mov({ id: "d", montoUsd: 9_000, fecha: "2026-12-05", expedienteId: "e3" }),
      ],
      EXP,
      CLIENTES,
    );
    expect(r.map((x) => x.movimiento.id)).toEqual(["a", "b", "c"]);
    expect(r[0].motivos).toEqual(["acumulado"]);
    expect(r[0].acumuladoMesUsd).toBe(50_000);
    // La individual acumula los dos motivos.
    expect(r[2].motivos).toEqual(["individual", "acumulado"]);
  });

  it("49,999.99 en el mes no dispara el acumulado; el mes siguiente empieza de cero", () => {
    const r = operacionesReportables(
      [
        mov({ id: "a", montoUsd: 25_000, fecha: "2026-12-01" }),
        mov({ id: "b", montoUsd: 24_999.99, fecha: "2026-12-31" }),
        mov({ id: "c", montoUsd: 9_000, fecha: "2027-01-01" }),
      ],
      EXP,
      CLIENTES,
    );
    expect(r.map((x) => [x.movimiento.id, x.motivos])).toEqual([
      ["a", ["individual"]],
      ["b", ["individual"]],
    ]);
  });

  it("los umbrales son parametrizables", () => {
    const r = operacionesReportables([mov({ id: "a", montoUsd: 500, fecha: "2026-12-01" })], EXP, CLIENTES, { individualUsd: 500, acumuladoMensualUsd: 1_000 });
    expect(r).toHaveLength(1);
  });
});

describe("uif · filas y CSV", () => {
  it("arma las columnas que necesita el Registro de Operaciones", () => {
    const r = operacionesReportables(
      [mov({ id: "a", montoUsd: 12_000, fecha: "2026-12-02", tipo: "pago", cuenta: "fondos_clientes", documentoRef: "SWIFT 123", contraparteNombre: "Dealer Inc.", registradoPor: "ana@luxcars.pe", expedienteId: "e3" })],
      EXP,
      CLIENTES,
    );
    const [fila] = filasRegistroUif(r);
    expect(fila).toEqual({
      fecha: "2026-12-02",
      expediente: "LC-2026-003",
      tipo_operacion: "Pago",
      origen: "Pago a tercero por cuenta del cliente",
      moneda: "USD",
      monto: 12_000,
      monto_usd: 12_000,
      cuenta: "Fondos de clientes",
      cliente_tipo: "Persona natural",
      cliente_nombre: "Juan Pérez",
      cliente_documento: "DNI 12345678",
      contraparte: "Dealer Inc.",
      referencia_documental: "SWIFT 123",
      concepto: "",
      motivo_registro: "Individual ≥ umbral",
      acumulado_mes_usd: 12_000,
      registrado_por: "ana@luxcars.pe",
    });
  });

  it("CSV con BOM, punto y coma, decimales con coma y comillas dobladas", () => {
    const filas = filasRegistroUif(
      operacionesReportables([mov({ id: "a", montoUsd: 12_345.5, fecha: "2026-12-02", concepto: 'Pago "final"' })], EXP, CLIENTES),
    );
    const csv = csvRegistroUif(filas);
    expect(csv.startsWith("﻿")).toBe(true);
    const lineas = csv.slice(1).trimEnd().split("\r\n");
    expect(lineas).toHaveLength(2);
    expect(lineas[0].startsWith('"Fecha";"Expediente"')).toBe(true);
    expect(lineas[1]).toContain(';12345,50;12345,50;');
    expect(lineas[1]).toContain('"Pago ""final"""');
  });
});
