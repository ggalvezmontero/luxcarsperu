import { describe, expect, it } from "vitest";

import {
  conceptoDe,
  datosRendicion,
  diferenciaH3,
  estadoHitos,
  ordenarLibro,
  pagadoPorConcepto,
  porConfirmarDeHito,
  saldoFondos,
  totalPagado,
} from "./ledger";
import type { Hito, Movimiento } from "./tipos";

function mov(cambios: Partial<Movimiento> & Pick<Movimiento, "id" | "tipo" | "montoUsd">): Movimiento {
  return {
    cuenta: "fondos_clientes",
    hito: null,
    estado: "confirmado",
    fecha: "2026-12-10",
    concepto: null,
    contraparteId: null,
    ...cambios,
  };
}

const H2: Hito = { tipo: "H2", montoEstimadoUsd: 73_490.5, fechaLimite: "2026-12-12", cuenta: "fondos_clientes", nota: null };
const H3: Hito = { tipo: "H3", montoEstimadoUsd: 31_006.72, fechaLimite: "2027-02-03", cuenta: "fondos_clientes", nota: null };
const H1: Hito = { tipo: "H1", montoEstimadoUsd: 2_481.94, fechaLimite: null, cuenta: "operaciones", nota: null };

describe("ledger · saldos", () => {
  it("suma depósitos y ajustes, resta pagos y devoluciones, por cuenta, solo confirmados", () => {
    const saldo = saldoFondos([
      mov({ id: "a", tipo: "deposito", montoUsd: 1000 }),
      mov({ id: "b", tipo: "pago", montoUsd: 300 }),
      mov({ id: "c", tipo: "devolucion", montoUsd: 50 }),
      mov({ id: "d", tipo: "ajuste", montoUsd: 10.5 }),
      mov({ id: "e", tipo: "deposito", montoUsd: 500, estado: "por_confirmar" }),
      mov({ id: "f", tipo: "pago", montoUsd: 999, estado: "anulado" }),
      mov({ id: "g", tipo: "deposito", montoUsd: 2481.94, cuenta: "operaciones" }),
    ]);
    expect(saldo).toEqual({ fondos_clientes: 660.5, operaciones: 2481.94, detracciones: 0 });
  });

  it("ordena el libro por fecha y deja fuera los anulados", () => {
    const libro = ordenarLibro([
      mov({ id: "b", tipo: "pago", montoUsd: 1, fecha: "2026-12-12" }),
      mov({ id: "a", tipo: "deposito", montoUsd: 1, fecha: "2026-12-10" }),
      mov({ id: "z", tipo: "pago", montoUsd: 1, fecha: "2026-12-01", estado: "anulado" }),
    ]);
    expect(libro.map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("ledger · hitos", () => {
  it("deriva pendiente, parcial (con lo que falta y lo por confirmar) y acreditado, y marca vencidos", () => {
    const movs = [
      mov({ id: "a", tipo: "deposito", hito: "H2", montoUsd: 50_000 }),
      mov({ id: "b", tipo: "deposito", hito: "H2", montoUsd: 23_490.5, estado: "por_confirmar" }),
      mov({ id: "c", tipo: "deposito", hito: "H1", cuenta: "operaciones", montoUsd: 2_481 }),
    ];
    const [h1, h2, h3] = estadoHitos([H1, H2, H3], movs, "2026-12-20");
    expect(h2).toMatchObject({ estado: "parcial", acreditado: 50_000, porConfirmar: 23_490.5, pendiente: 23_490.5, vencido: true });
    expect(h3).toMatchObject({ estado: "pendiente", acreditado: 0, pendiente: 31_006.72, vencido: false });
    // Tolerancia de un dólar: una comisión bancaria no deja el hito en parcial.
    expect(h1).toMatchObject({ estado: "acreditado", pendiente: 0.94 });
    expect(porConfirmarDeHito(H2, movs)).toBe(23_490.5);
  });
});

describe("ledger · pagos y diferencia H3", () => {
  const pagos = [
    mov({ id: "d3", tipo: "deposito", hito: "H3", montoUsd: 31_006.72 }),
    mov({ id: "t1", tipo: "pago", hito: "H3", montoUsd: 4_404.63, concepto: "Ad valorem" }),
    mov({ id: "t2", tipo: "pago", hito: "H3", montoUsd: 14_001.55, concepto: "IGV" }),
    mov({ id: "t3", tipo: "pago", hito: "H3", montoUsd: 9_181.67, concepto: "Percepción del IGV" }),
    mov({ id: "g1", tipo: "pago", hito: "H3", montoUsd: 2_300, concepto: "Agente de aduana" }),
    mov({ id: "g2", tipo: "pago", hito: "H3", montoUsd: 180, concepto: "Tasa registral SUNARP" }),
    mov({ id: "g3", tipo: "pago", hito: "H3", montoUsd: 50, concepto: "Agente de aduana" }),
    mov({ id: "v", tipo: "pago", hito: "H2", montoUsd: 70_920, concepto: "Wire al vendedor" }),
  ];

  it("agrupa los pagos por concepto del catálogo y clasifica los conceptos libres", () => {
    const grupos = pagadoPorConcepto(pagos);
    expect(grupos.map((g) => [g.concepto, g.montoUsd, g.cantidad])).toEqual([
      ["Precio del vehículo", 70_920, 1],
      ["Ad valorem", 4_404.63, 1],
      ["IGV", 14_001.55, 1],
      ["Percepción del IGV", 9_181.67, 1],
      ["Agente de aduana", 2_350, 2],
      ["Tasa registral SUNARP", 180, 1],
    ]);
    expect(conceptoDe({ concepto: "Pago a la grúa del puerto" }).clave).toBe("grua");
    expect(conceptoDe({ concepto: "Propina" }).clave).toBe("otro");
    expect(totalPagado(pagos, { grupo: "tributo" })).toBe(27_587.85);
  });

  it("diferencia H3 positiva: sobró y se devuelve con la rendición", () => {
    expect(diferenciaH3(H3, pagos)).toEqual({ depositado: 31_006.72, pagado: 30_117.85, diferencia: 888.87 });
  });

  it("diferencia H3 negativa: faltó y se cobra al cliente", () => {
    const masGastos = [...pagos, mov({ id: "g4", tipo: "pago", hito: "H3", montoUsd: 1_500, concepto: "Depósito temporal" })];
    expect(diferenciaH3(H3, masGastos).diferencia).toBe(-611.13);
    expect(diferenciaH3(null, masGastos).depositado).toBe(0);
  });
});

describe("ledger · rendición", () => {
  it("cuadra a cero: recibido − pagado − devuelto, y separa los honorarios", () => {
    const movs = [
      mov({ id: "h1", tipo: "deposito", hito: "H1", cuenta: "operaciones", montoUsd: 2_481.94, fecha: "2026-12-01" }),
      mov({ id: "d2", tipo: "deposito", hito: "H2", montoUsd: 73_490.5, fecha: "2026-12-10" }),
      mov({ id: "p1", tipo: "pago", hito: "H2", montoUsd: 70_920, concepto: "Precio del vehículo", fecha: "2026-12-12" }),
      mov({ id: "p2", tipo: "pago", hito: "H2", montoUsd: 2_490.5, concepto: "Flete marítimo y gastos del contenedor", fecha: "2027-01-09" }),
      mov({ id: "d3", tipo: "deposito", hito: "H3", montoUsd: 31_006.72, fecha: "2027-02-01" }),
      mov({ id: "t1", tipo: "pago", hito: "H3", montoUsd: 27_587.85, concepto: "Tributos de importación (SUNAT)", fecha: "2027-02-10" }),
      mov({ id: "g1", tipo: "pago", hito: "H3", montoUsd: 2_480, concepto: "Agente de aduana", fecha: "2027-02-12" }),
      mov({ id: "h4", tipo: "deposito", hito: "H4", cuenta: "operaciones", montoUsd: 5_791.19, fecha: "2027-03-05" }),
      mov({ id: "x", tipo: "deposito", hito: "H3", montoUsd: 100, estado: "por_confirmar" }),
    ];
    const ctx = { expediente: { presupuesto: null }, hitos: [], movimientos: movs, contrapartes: [] } as unknown as Parameters<typeof datosRendicion>[0];
    const antes = datosRendicion(ctx);
    expect(antes.totalRecibido).toBe(104_497.22);
    expect(antes.totalPagado).toBe(103_478.35);
    expect(antes.saldo).toBe(1_018.87);
    expect(antes.devuelto).toBe(0);
    expect(antes.saldoFinal).toBe(1_018.87);
    expect(antes.totalHonorarios).toBe(8_273.13);
    expect(antes.totalOperacion).toBe(111_751.48);

    movs.push(mov({ id: "dev", tipo: "devolucion", montoUsd: 1_018.87, fecha: "2027-03-06" }));
    const despues = datosRendicion(ctx);
    expect(despues.devuelto).toBe(1_018.87);
    expect(despues.saldoFinal).toBe(0);
    expect(despues.recibidos.map((m) => m.id)).toEqual(["d2", "d3"]);
    expect(despues.honorarios.map((m) => m.id)).toEqual(["h1", "h4"]);
  });
});
