/**
 * Una sola cuenta para el cliente y autodetracción por defecto (27 nov 2026):
 * el Pago 2 en una sola transferencia que cubre el H2 y el H3, los asientos
 * internos de honorarios (aplicación y autodetracción) que no acreditan
 * pagos, la tarea de autodetracción a cinco días hábiles con los feriados de
 * Perú y la rendición que cuadra con Fondos de Clientes.
 */
import { describe, expect, it } from "vitest";

import { detraccionSugerida, hitoHonorariosDelPago, importeFactura, llevaDetraccion, tareasTrasConfirmar } from "./honorarios";
import { CUENTA_POR_HITO, DONDE_PAGA, FERIADOS_PERU, acreditadoPorHito, esDiaHabil, estadoHito, etiquetaPago, queCubrePago, sumarDiasHabiles } from "./hitos";
import { datosRendicion, esAsientoInterno, estadoPagos, numeroConstancia, saldoCuenta, saldoFondos } from "./ledger";
import { cuentaParaUif } from "./uif";
import type { ContextoExpediente, Hito, Movimiento, Tarea } from "./tipos";

const HITOS: Hito[] = [
  { tipo: "H1", montoEstimadoUsd: 50_000, fechaLimite: "2026-12-01", cuenta: "fondos_clientes", nota: null },
  { tipo: "H2", montoEstimadoUsd: 2_000, fechaLimite: "2026-12-18", cuenta: "fondos_clientes", nota: null },
  { tipo: "H3", montoEstimadoUsd: 4_000, fechaLimite: "2026-12-18", cuenta: "fondos_clientes", nota: null },
  { tipo: "H4", montoEstimadoUsd: 2_300, fechaLimite: "2027-02-10", cuenta: "fondos_clientes", nota: null },
  { tipo: "H5", montoEstimadoUsd: 20_000, fechaLimite: null, cuenta: "directo", nota: null },
  { tipo: "H6", montoEstimadoUsd: 4_000, fechaLimite: "2027-02-22", cuenta: "fondos_clientes", nota: null },
];

function mov(cambios: Partial<Movimiento> & Pick<Movimiento, "id" | "tipo" | "montoUsd">): Movimiento {
  return {
    cuenta: "fondos_clientes", hito: null, estado: "confirmado", fecha: "2026-12-04", moneda: "USD", monto: cambios.montoUsd, tipoCambio: 1,
    concepto: null, contraparteId: null, documentoRef: null, tieneComprobante: false, declaradoPorCliente: false, createdAt: "2026-12-04T12:00:00Z",
    ...cambios,
  };
}

function ctx(movimientos: Movimiento[], cambios: { tipoCliente?: "empresa" | "persona"; tareas?: Tarea[] } = {}): ContextoExpediente {
  return {
    expediente: { id: "e1", codigo: "LC-2026-020", etapa: "embarque", honorariosUsd: 8_000, porcentajeDetraccion: 12, presupuesto: null },
    cliente: { id: "c1", tipo: cambios.tipoCliente ?? "empresa" },
    hitos: HITOS,
    movimientos,
    tareas: cambios.tareas ?? [],
    documentos: [],
  } as unknown as ContextoExpediente;
}

const PAGO2 = mov({ id: "p2", tipo: "deposito", hito: "H2", montoUsd: 6_000, fecha: "2026-12-04" });

describe("una sola cuenta para el cliente", () => {
  it("todo va a Fondos de Clientes salvo los tributos, que se pagan directo a SUNAT", () => {
    expect(CUENTA_POR_HITO).toEqual({ H1: "fondos_clientes", H2: "fondos_clientes", H3: "fondos_clientes", H4: "fondos_clientes", H5: "directo", H6: "fondos_clientes" });
    expect([1, 2, 3, 5].map((n) => DONDE_PAGA[n as 1 | 2 | 3 | 5])).toEqual(Array(4).fill("Cuenta Fondos de Clientes de LUXCARS"));
    expect(DONDE_PAGA[4]).toMatch(/Directo a SUNAT/);
    expect(etiquetaPago(2)).toBe("Pago 2 de 5");
    expect(queCubrePago(1, true)).toMatch(/inspección del auto usado/);
    expect(queCubrePago(1)).not.toMatch(/inspecci/);
  });

  it("el Pago 2 es una sola transferencia: acredita primero el H2 y el resto el H3", () => {
    expect(acreditadoPorHito(HITOS[1], [PAGO2], HITOS)).toBe(2_000);
    expect(acreditadoPorHito(HITOS[2], [PAGO2], HITOS)).toBe(4_000);
    expect(estadoHito(HITOS[2], [PAGO2], HITOS)).toBe("acreditado");
    const pago2 = estadoPagos(HITOS, [PAGO2], "2026-12-05").find((p) => p.pago === 2)!;
    expect(pago2).toMatchObject({ etiqueta: "Pago 2 de 5", montoEstimadoUsd: 6_000, acreditado: 6_000, pendiente: 0, estado: "acreditado", directo: false });
    // Una transferencia corta deja el H3 parcial y el Pago 2 parcial, con lo que falta.
    const corto = mov({ id: "c", tipo: "deposito", hito: "H2", montoUsd: 3_500 });
    expect(estadoHito(HITOS[1], [corto], HITOS)).toBe("acreditado");
    expect(estadoHito(HITOS[2], [corto], HITOS)).toBe("parcial");
    expect(estadoPagos(HITOS, [corto]).find((p) => p.pago === 2)).toMatchObject({ estado: "parcial", acreditado: 3_500, pendiente: 2_500 });
    // El Pago 4 se marca directo y vencido solo si tiene fecha.
    const pago4 = estadoPagos(HITOS, [], "2027-03-01").find((p) => p.pago === 4)!;
    expect(pago4).toMatchObject({ directo: true, vencido: false, donde: DONDE_PAGA[4] });
  });

  it("los asientos internos (aplicación de honorarios y autodetracción) no acreditan pagos, no son depósitos del cliente ni operaciones UIF", () => {
    const aplicacion = mov({ id: "a1", tipo: "pago", montoUsd: 4_000, concepto: "Aplicación de honorarios · factura 1 F001-000101", documentoRef: "F001-000101" });
    const recibidos = mov({ id: "a2", tipo: "deposito", cuenta: "operaciones", montoUsd: 4_000, concepto: "Honorarios recibidos desde Fondos de Clientes · factura 1 F001-000101" });
    const autoPago = mov({ id: "r1", tipo: "pago", cuenta: "operaciones", montoUsd: 480, concepto: "Detracción de la factura 1 depositada en el Banco de la Nación (autodetracción)", documentoRef: "BN 123" });
    const autoDep = mov({ id: "r2", tipo: "deposito", cuenta: "detracciones", montoUsd: 480, concepto: "Detracción de la factura 1 (autodetracción)", documentoRef: "BN 123" });
    const internos = [aplicacion, recibidos, autoPago, autoDep];
    for (const m of internos) {
      expect(esAsientoInterno(m), m.id).toBe(true);
      expect(cuentaParaUif(m), m.id).toBe(false);
    }
    const libro = [PAGO2, ...internos];
    expect(estadoPagos(HITOS, libro).find((p) => p.pago === 2)!.acreditado).toBe(6_000);
    expect(estadoPagos(HITOS, libro).find((p) => p.pago === 5)!.acreditado).toBe(0);
    expect(saldoFondos(libro)).toMatchObject({ fondos_clientes: 2_000, operaciones: 3_520, detracciones: 480 });
    // Las constancias se numeran solo con los depósitos del cliente.
    const pago3 = mov({ id: "p3", tipo: "deposito", hito: "H4", montoUsd: 2_300, fecha: "2027-02-08" });
    expect(numeroConstancia(pago3, [...libro, pago3])).toBe("F02");
    // La detracción que deposita el propio cliente (alternativa) sí cuenta para su pago.
    const delCliente = mov({ id: "dc", tipo: "deposito", cuenta: "detracciones", hito: "H6", montoUsd: 480, concepto: "Detracción depositada por el cliente" });
    expect(esAsientoInterno(delCliente)).toBe(false);
    expect(estadoPagos(HITOS, [delCliente]).find((p) => p.pago === 5)!.acreditado).toBe(480);
  });
});

describe("días hábiles con los feriados de Perú", () => {
  it("salta fines de semana y feriados nacionales de 2026 y 2027", () => {
    expect(FERIADOS_PERU.has("2026-12-08")).toBe(true);
    expect(FERIADOS_PERU.has("2027-03-25")).toBe(true);
    expect(esDiaHabil("2026-12-09")).toBe(false);
    expect(esDiaHabil("2026-12-10")).toBe(true);
    expect(esDiaHabil("2026-12-12")).toBe(false);
    // Viernes 4 de diciembre + 5 días hábiles: el 8 y el 9 son feriados → martes 15.
    expect(sumarDiasHabiles("2026-12-04", 5)).toBe("2026-12-15");
    expect(sumarDiasHabiles("2026-12-04", 5, new Set())).toBe("2026-12-11");
    // Martes 22 de diciembre + 5: Navidad no cuenta → miércoles 30.
    expect(sumarDiasHabiles("2026-12-22", 5)).toBe("2026-12-30");
    // Semana Santa 2027: lunes 22 de marzo + 5 → miércoles 31.
    expect(sumarDiasHabiles("2027-03-22", 5)).toBe("2027-03-31");
  });
});

describe("autodetracción", () => {
  it("solo las facturas a una empresa llevan detracción; cada factura es la mitad de los honorarios", () => {
    expect(llevaDetraccion({ tipo: "empresa" })).toBe(true);
    expect(llevaDetraccion({ tipo: "persona" })).toBe(false);
    expect(hitoHonorariosDelPago(2)).toBe("H3");
    expect(hitoHonorariosDelPago(5)).toBe("H6");
    expect(hitoHonorariosDelPago(3)).toBeNull();
    expect(importeFactura(ctx([]))).toBe(4_000);
    expect(detraccionSugerida(ctx([]))).toBe(480);
  });

  it("al confirmar el pago que cubre una factura de un cliente empresa nace la tarea, a cinco días hábiles", () => {
    const tareas = tareasTrasConfirmar(ctx([PAGO2]), PAGO2);
    expect(tareas).toEqual([
      {
        clave: "luxcars.autodetraccion_h3",
        titulo: "Depositar la detracción de la factura 1 de honorarios en el Banco de la Nación",
        descripcion: expect.stringContaining("Autodetracción"),
        venceEl: "2026-12-15",
      },
    ]);
    // El Pago 5 (factura 2).
    const pago5 = mov({ id: "p5", tipo: "deposito", hito: "H6", montoUsd: 4_000, fecha: "2027-02-22" });
    expect(tareasTrasConfirmar(ctx([PAGO2, pago5]), pago5).map((t) => [t.clave, t.venceEl])).toEqual([["luxcars.autodetraccion_h6", "2027-03-01"]]);
  });

  it("no nace con persona natural, con el pago incompleto, si ya existe, si el cliente detrajo él mismo ni con otros pagos", () => {
    expect(tareasTrasConfirmar(ctx([PAGO2], { tipoCliente: "persona" }), PAGO2)).toEqual([]);
    const corto = mov({ id: "c", tipo: "deposito", hito: "H2", montoUsd: 5_000 });
    expect(tareasTrasConfirmar(ctx([corto]), corto)).toEqual([]);
    const existente = { clave: "luxcars.autodetraccion_h3" } as Tarea;
    expect(tareasTrasConfirmar(ctx([PAGO2], { tareas: [existente] }), PAGO2)).toEqual([]);
    const neto = mov({ id: "n", tipo: "deposito", hito: "H2", montoUsd: 5_520 });
    const detrajo = mov({ id: "d", tipo: "deposito", cuenta: "detracciones", hito: "H3", montoUsd: 480, concepto: "Detracción depositada por el cliente" });
    expect(tareasTrasConfirmar(ctx([neto, detrajo]), neto)).toEqual([]);
    const pago1 = mov({ id: "p1", tipo: "deposito", hito: "H1", montoUsd: 50_000 });
    expect(tareasTrasConfirmar(ctx([pago1]), pago1)).toEqual([]);
    expect(tareasTrasConfirmar(ctx([PAGO2]), { ...PAGO2, estado: "por_confirmar" })).toEqual([]);
  });
});

describe("rendición con una sola cuenta", () => {
  it("las facturas aplicadas salen de Fondos de Clientes y el saldo cuadra con la cuenta", () => {
    const libro = [
      mov({ id: "p1", tipo: "deposito", hito: "H1", montoUsd: 50_000, fecha: "2026-12-01" }),
      mov({ id: "w", tipo: "pago", hito: "H1", montoUsd: 50_000, concepto: "Precio del vehículo (wire al broker)", fecha: "2026-12-02" }),
      PAGO2,
      mov({ id: "a1", tipo: "pago", montoUsd: 4_000, concepto: "Aplicación de honorarios · factura 1 F001-000101", documentoRef: "F001-000101", fecha: "2026-12-04" }),
      mov({ id: "a2", tipo: "deposito", cuenta: "operaciones", montoUsd: 4_000, concepto: "Honorarios recibidos desde Fondos de Clientes · factura 1 F001-000101", fecha: "2026-12-04" }),
      mov({ id: "r1", tipo: "pago", cuenta: "operaciones", montoUsd: 480, concepto: "Detracción de la factura 1 depositada en el Banco de la Nación (autodetracción)", documentoRef: "BN 123", fecha: "2026-12-10" }),
      mov({ id: "r2", tipo: "deposito", cuenta: "detracciones", montoUsd: 480, concepto: "Detracción de la factura 1 (autodetracción)", documentoRef: "BN 123", fecha: "2026-12-10" }),
      mov({ id: "f", tipo: "pago", hito: "H2", montoUsd: 1_900, concepto: "Flete (traslado al puerto y marítimo)", fecha: "2026-12-20" }),
    ];
    const r = datosRendicion(ctx(libro));
    expect(r.recibidos.map((m) => m.id)).toEqual(["p1", "p2"]);
    expect(r.honorariosAplicados).toBe(4_000);
    expect(r.aplicaciones.map((m) => m.id)).toEqual(["a1"]);
    expect(r.detracciones.map((m) => m.id)).toEqual(["r2"]);
    expect(r.saldo).toBe(100);
    expect(r.saldo).toBe(saldoCuenta(libro, "fondos_clientes"));
  });
});
