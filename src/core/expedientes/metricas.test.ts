import { describe, expect, it } from "vitest";

import {
  dineroEnCustodia,
  duracionPorEtapa,
  expedientesPorEtapa,
  expedientesPorMes,
  hitosVencidos,
  mediana,
  proximosArribos,
  type ExpedienteMetrica,
} from "./metricas";
import type { Hito, Movimiento, TramoEtapa } from "./tipos";

const HOY = new Date("2026-12-15T12:00:00Z");

function exp(c: Partial<ExpedienteMetrica> & Pick<ExpedienteMetrica, "id">): ExpedienteMetrica {
  return {
    codigo: `LC-2026-${c.id}`,
    etapa: "compra",
    etapaDesde: "2026-12-01T00:00:00Z",
    createdAt: "2026-11-01T00:00:00Z",
    cerradoEn: null,
    fechaEstArribo: null,
    clienteNombre: "ACME",
    auto: "Toyota Tacoma 2026",
    ...c,
  };
}

function mov(c: Partial<Movimiento> & Pick<Movimiento, "id" | "tipo" | "montoUsd">): Movimiento {
  return { cuenta: "fondos_clientes", hito: null, estado: "confirmado", fecha: "2026-12-10", concepto: null, contraparteId: null, ...c };
}

describe("metricas · por mes y por etapa", () => {
  it("cuenta aperturas por createdAt y cierres/cancelaciones por cerradoEn, rellenando meses vacíos", () => {
    const filas = expedientesPorMes([
      exp({ id: "1", createdAt: "2026-09-10T00:00:00Z", etapa: "cerrado", cerradoEn: "2026-12-01T00:00:00Z" }),
      exp({ id: "2", createdAt: "2026-09-20T00:00:00Z", etapa: "cancelado", cerradoEn: "2026-10-05T00:00:00Z" }),
      exp({ id: "3", createdAt: "2026-12-02T00:00:00Z" }),
    ]);
    expect(filas).toEqual([
      { mes: "2026-09", abiertos: 2, cerrados: 0, cancelados: 0 },
      { mes: "2026-10", abiertos: 0, cerrados: 0, cancelados: 1 },
      { mes: "2026-11", abiertos: 0, cerrados: 0, cancelados: 0 },
      { mes: "2026-12", abiertos: 1, cerrados: 1, cancelados: 0 },
    ]);
  });

  it("sin expedientes no hay meses", () => {
    expect(expedientesPorMes([])).toEqual([]);
  });

  it("agrupa por etapa en el orden operativo, con ceros", () => {
    const filas = expedientesPorEtapa([exp({ id: "1", etapa: "compra" }), exp({ id: "2", etapa: "compra" }), exp({ id: "3", etapa: "cancelado" })]);
    expect(filas.find((f) => f.etapa === "compra")?.cantidad).toBe(2);
    expect(filas.find((f) => f.etapa === "cancelado")?.cantidad).toBe(1);
    expect(filas.find((f) => f.etapa === "aduana")?.cantidad).toBe(0);
    expect(filas[0].etapa).toBe("prospecto");
  });
});

describe("metricas · días por etapa", () => {
  it("una etapa abierta cuenta hasta hoy; promedio y mediana salen del historial", () => {
    const tramos: TramoEtapa[] = [
      { etapa: "contrato", desde: "2026-11-01T00:00:00Z", hasta: "2026-11-11T00:00:00Z", forzado: false, motivo: null }, // 10
      { etapa: "contrato", desde: "2026-11-01T00:00:00Z", hasta: "2026-11-03T00:00:00Z", forzado: false, motivo: null }, // 2
      { etapa: "contrato", desde: "2026-12-05T12:00:00Z", hasta: null, forzado: false, motivo: null }, // 10 a hoy
      { etapa: "cerrado", desde: "2026-12-01T00:00:00Z", hasta: null, forzado: false, motivo: null },
    ];
    const d = duracionPorEtapa(tramos, HOY);
    const contrato = d.find((x) => x.etapa === "contrato")!;
    expect(contrato.tramos).toBe(3);
    expect(contrato.promedioDias).toBe(7.3);
    expect(contrato.medianaDias).toBe(10);
    expect(contrato.maxDias).toBe(10);
    expect(d.find((x) => x.etapa === "busqueda")).toMatchObject({ tramos: 0, promedioDias: null, medianaDias: null });
    expect(d.some((x) => x.etapa === "cerrado")).toBe(false);
  });

  it("mediana de pares e impares", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
});

describe("metricas · custodia", () => {
  it("suma el saldo de fondos_clientes por expediente activo, excluye anulados y por_confirmar, y los lista aparte", () => {
    const movs = new Map<string, Movimiento[]>([
      [
        "1",
        [
          mov({ id: "a", tipo: "deposito", montoUsd: 50_000 }),
          mov({ id: "b", tipo: "pago", montoUsd: 20_000 }),
          mov({ id: "c", tipo: "deposito", montoUsd: 9_999, estado: "anulado" }),
          mov({ id: "d", tipo: "deposito", montoUsd: 5_000, estado: "por_confirmar" }),
          mov({ id: "e", tipo: "deposito", montoUsd: 2_481.94, cuenta: "operaciones" }),
        ],
      ],
      ["2", [mov({ id: "f", tipo: "deposito", montoUsd: 1_000 })]],
      ["3", [mov({ id: "g", tipo: "deposito", montoUsd: 300 })]],
    ]);
    const r = dineroEnCustodia([exp({ id: "1" }), exp({ id: "2" }), exp({ id: "3", etapa: "cerrado", cerradoEn: "2026-12-01T00:00:00Z" })], movs);
    expect(r.totalUsd).toBe(31_000);
    expect(r.porConfirmarUsd).toBe(5_000);
    expect(r.porConfirmar).toBe(1);
    expect(r.filas.map((f) => [f.expediente.id, f.saldoUsd])).toEqual([
      ["1", 30_000],
      ["2", 1_000],
    ]);
    // El cerrado con saldo es una anomalía que se muestra, no se suma.
    expect(r.fueraDeActivos.map((f) => f.expediente.id)).toEqual(["3"]);
  });
});

describe("metricas · hitos vencidos y arribos", () => {
  it("un hito vencido sin acreditar aparece con lo que falta; uno acreditado o futuro no", () => {
    const H2: Hito = { tipo: "H2", montoEstimadoUsd: 10_000, fechaLimite: "2026-12-10", cuenta: "fondos_clientes", nota: null };
    const H3: Hito = { tipo: "H3", montoEstimadoUsd: 5_000, fechaLimite: "2027-01-10", cuenta: "fondos_clientes", nota: null };
    const hitos = new Map<string, Hito[]>([
      ["1", [H2, H3]],
      ["2", [H2]],
    ]);
    const movs = new Map<string, Movimiento[]>([["2", [mov({ id: "a", tipo: "deposito", montoUsd: 9_999.5, hito: "H2" })]]]);
    const r = hitosVencidos([exp({ id: "1" }), exp({ id: "2" }), exp({ id: "3", etapa: "cancelado" })], hitos, movs, HOY);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ faltaUsd: 10_000, diasVencido: 5 });
    expect(r[0].hito.tipo).toBe("H2");
  });

  it("próximos arribos: solo activos con fecha de hoy en adelante, el más cercano primero", () => {
    const r = proximosArribos(
      [
        exp({ id: "1", fechaEstArribo: "2027-01-20" }),
        exp({ id: "2", fechaEstArribo: "2026-12-20" }),
        exp({ id: "3", fechaEstArribo: "2026-12-01" }),
        exp({ id: "4", fechaEstArribo: "2026-12-18", etapa: "cerrado" }),
      ],
      HOY,
    );
    expect(r.map((x) => [x.expediente.id, x.enDias])).toEqual([
      ["2", 5],
      ["1", 36],
    ]);
  });
});
