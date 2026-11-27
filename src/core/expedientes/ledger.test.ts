import { describe, expect, it } from "vitest";

import {
  comisionesBancarias,
  conceptoDe,
  datosPago5,
  datosRendicion,
  estadoHitos,
  ordenarLibro,
  pagadoPorConcepto,
  pagosDirectos,
  porConfirmarDeHito,
  saldoCuenta,
  saldoFondos,
  saldoGastosAduana,
  totalPagado,
} from "./ledger";
import type { ContextoExpediente, Hito, Movimiento } from "./tipos";

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

/** Contexto mínimo para las funciones del libro: honorarios del expediente y los movimientos. */
function ctxLibro(movimientos: Movimiento[], honorariosUsd = 8_273.14): ContextoExpediente {
  return { expediente: { presupuesto: null, honorariosUsd }, hitos: [], movimientos, contrapartes: [] } as unknown as ContextoExpediente;
}

const H1: Hito = { tipo: "H1", montoEstimadoUsd: 73_490.5, fechaLimite: "2026-12-12", cuenta: "fondos_clientes", nota: null };
const H4: Hito = { tipo: "H4", montoEstimadoUsd: 2_500, fechaLimite: "2027-02-03", cuenta: "fondos_clientes", nota: null };
const H3: Hito = { tipo: "H3", montoEstimadoUsd: 2_481.94, fechaLimite: null, cuenta: "operaciones", nota: null };

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
      mov({ id: "h", tipo: "deposito", montoUsd: 27_587.85, cuenta: "directo", hito: "H5" }),
    ]);
    expect(saldo).toEqual({ fondos_clientes: 660.5, operaciones: 2481.94, detracciones: 0, directo: 27_587.85 });
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
      mov({ id: "a", tipo: "deposito", hito: "H1", montoUsd: 50_000 }),
      mov({ id: "b", tipo: "deposito", hito: "H1", montoUsd: 23_490.5, estado: "por_confirmar" }),
      mov({ id: "c", tipo: "deposito", hito: "H3", cuenta: "operaciones", montoUsd: 2_481 }),
    ];
    const [h3, h1, h4] = estadoHitos([H3, H1, H4], movs, "2026-12-20");
    expect(h1).toMatchObject({ estado: "parcial", acreditado: 50_000, porConfirmar: 23_490.5, pendiente: 23_490.5, vencido: true });
    expect(h4).toMatchObject({ estado: "pendiente", acreditado: 0, pendiente: 2_500, vencido: false });
    // Tolerancia de un dólar: una comisión bancaria no deja el hito en parcial.
    expect(h3).toMatchObject({ estado: "acreditado", pendiente: 0 });
    expect(porConfirmarDeHito(H1, movs)).toBe(23_490.5);
  });
});

describe("ledger · conceptos", () => {
  const pagos = [
    mov({ id: "v", tipo: "pago", hito: "H1", montoUsd: 70_920, concepto: "Wire al broker" }),
    mov({ id: "f", tipo: "pago", hito: "H2", montoUsd: 2_190.5, concepto: "Flete (traslado al puerto y marítimo)" }),
    mov({ id: "g1", tipo: "pago", hito: "H4", montoUsd: 2_000, concepto: "Agente de aduana" }),
    mov({ id: "g2", tipo: "pago", hito: "H4", montoUsd: 150, concepto: "Pago a la grúa del puerto" }),
    mov({ id: "g3", tipo: "pago", hito: "H4", montoUsd: 50, concepto: "Agente de aduana" }),
    mov({ id: "c1", tipo: "pago", montoUsd: 45, concepto: "Comisión bancaria del wire (cargo del banco)" }),
    mov({ id: "c2", tipo: "ajuste", montoUsd: 45, concepto: "Reposición de la comisión bancaria, por cuenta de Luxcars" }),
  ];

  it("agrupa los pagos a terceros por concepto del catálogo, sin comisiones, y clasifica los conceptos libres", () => {
    const grupos = pagadoPorConcepto(pagos);
    expect(grupos.map((g) => [g.concepto, g.montoUsd, g.cantidad])).toEqual([
      ["Precio del vehículo (wire al broker)", 70_920, 1],
      ["Flete (traslado al puerto y marítimo)", 2_190.5, 1],
      ["Agente de aduana", 2_050, 2],
      ["Grúa del puerto", 150, 1],
    ]);
    expect(conceptoDe({ concepto: "Inspección del Corvette usado" }).clave).toBe("inspeccion");
    expect(conceptoDe({ concepto: "Transporte interno al puerto" }).clave).toBe("flete");
    expect(conceptoDe({ concepto: "Propina" }).clave).toBe("otro");
    expect(totalPagado(pagos, { grupo: "gasto" })).toBe(2_200);
    // La gestión registral ya no es un concepto del libro: va dentro de los honorarios.
    expect(conceptoDe({ concepto: "Tasa registral SUNARP" }).clave).toBe("otro");
  });
});

describe("ledger · gastos de aduana (Pago 3) compensados en el Pago 5", () => {
  const base = [
    mov({ id: "d4", tipo: "deposito", hito: "H4", montoUsd: 2_500 }),
    mov({ id: "g1", tipo: "pago", hito: "H4", montoUsd: 2_000, concepto: "Agente de aduana" }),
    mov({ id: "g2", tipo: "pago", hito: "H4", montoUsd: 300, concepto: "Almacenaje (depósito temporal)" }),
    // Un pago que no es gasto de aduana no entra al saldo de aduana.
    mov({ id: "v", tipo: "pago", hito: "H1", montoUsd: 70_920, concepto: "Precio del vehículo (wire al broker)" }),
  ];

  it("sobrante: se descuenta de la segunda mitad de los honorarios", () => {
    const movs = [...base, mov({ id: "g3", tipo: "pago", hito: "H4", montoUsd: 150, concepto: "Grúa del puerto" })];
    expect(saldoGastosAduana(movs)).toEqual({ recibido: 2_500, pagado: 2_450, saldo: 50 });
    expect(datosPago5(ctxLibro(movs))).toEqual({ honorarios: 4_136.57, aduana: { recibido: 2_500, pagado: 2_450, saldo: 50 }, neto: 4_086.57, aDevolver: 0 });
  });

  it("faltante: se suma a la segunda mitad de los honorarios", () => {
    const movs = [...base, mov({ id: "g3", tipo: "pago", hito: "H4", montoUsd: 500, concepto: "Grúa del puerto" })];
    expect(saldoGastosAduana(movs).saldo).toBe(-300);
    expect(datosPago5(ctxLibro(movs))).toMatchObject({ honorarios: 4_136.57, neto: 4_436.57, aDevolver: 0 });
  });

  it("sobrante mayor que la mitad: el Pago 5 queda en cero y el resto se devuelve con la rendición", () => {
    const movs = [mov({ id: "d4", tipo: "deposito", hito: "H4", montoUsd: 10_000 }), mov({ id: "g1", tipo: "pago", hito: "H4", montoUsd: 1_000, concepto: "Agente de aduana" })];
    expect(datosPago5(ctxLibro(movs))).toMatchObject({ neto: 0, aDevolver: 4_863.43 });
  });
});

describe("ledger · comisión bancaria del wire", () => {
  it("el par cargo del banco + reposición de Luxcars deja igual el saldo del cliente", () => {
    const movs = [
      mov({ id: "d1", tipo: "deposito", hito: "H1", montoUsd: 71_000 }),
      mov({ id: "p1", tipo: "pago", hito: "H1", montoUsd: 70_920, concepto: "Precio del vehículo (wire al broker)" }),
    ];
    const antes = saldoCuenta(movs);
    const conPar = [
      ...movs,
      mov({ id: "c1", tipo: "pago", montoUsd: 45, concepto: "Comisión bancaria del wire (cargo del banco)" }),
      mov({ id: "c2", tipo: "ajuste", montoUsd: 45, concepto: "Reposición de la comisión bancaria, por cuenta de Luxcars" }),
    ];
    expect(saldoCuenta(conPar)).toBe(antes);
    expect(comisionesBancarias(conPar)).toEqual({ cargadas: 45, repuestas: 45, efecto: 0 });
    // La rendición la lista como asumida por Luxcars y no la cuenta como pago a terceros.
    const r = datosRendicion(ctxLibro(conPar));
    expect(r.totalPagado).toBe(70_920);
    expect(r.saldo).toBe(antes);
    expect(r.comisiones.cargadas).toBe(45);
    // Sin la reposición el saldo baja: por eso la crea el sistema junto con el cargo.
    expect(comisionesBancarias(conPar.slice(0, 3)).efecto).toBe(-45);
  });
});

describe("ledger · pago directo a SUNAT (Pago 4)", () => {
  it("lo lista aparte, en soles y en dólares, y no toca Fondos de Clientes", () => {
    const movs = [
      mov({ id: "d1", tipo: "deposito", hito: "H1", montoUsd: 71_000 }),
      mov({ id: "t5", tipo: "deposito", cuenta: "directo", hito: "H5", montoUsd: 27_587.85, moneda: "PEN", monto: 103_920.02, tipoCambio: 3.7669, documentoRef: "Liquidación 118-2027-0001234" }),
      mov({ id: "t6", tipo: "deposito", cuenta: "directo", hito: "H5", montoUsd: 10, estado: "por_confirmar" }),
    ];
    expect(saldoCuenta(movs)).toBe(71_000);
    expect(pagosDirectos(movs)).toEqual([
      { movimientoId: "t5", fecha: "2026-12-10", hito: "H5", moneda: "PEN", monto: 103_920.02, montoUsd: 27_587.85, referencia: "Liquidación 118-2027-0001234", tieneComprobante: false },
    ]);
  });
});

describe("ledger · rendición", () => {
  /** Expediente completo con sobrante de aduana aplicado al Pago 5, comisión repuesta y tributos pagados directo. */
  function libroCompleto(): Movimiento[] {
    return [
      mov({ id: "d1", tipo: "deposito", hito: "H1", montoUsd: 71_000, fecha: "2026-12-01" }),
      mov({ id: "p1", tipo: "pago", hito: "H1", montoUsd: 70_920, concepto: "Precio del vehículo (wire al broker)", fecha: "2026-12-03" }),
      mov({ id: "c1", tipo: "pago", montoUsd: 45, concepto: "Comisión bancaria del wire (cargo del banco)", fecha: "2026-12-03" }),
      mov({ id: "c2", tipo: "ajuste", montoUsd: 45, concepto: "Reposición de la comisión bancaria, por cuenta de Luxcars", fecha: "2026-12-03" }),
      mov({ id: "d2", tipo: "deposito", hito: "H2", montoUsd: 2_490.5, fecha: "2026-12-10" }),
      mov({ id: "h3", tipo: "deposito", hito: "H3", cuenta: "operaciones", montoUsd: 4_136.57, fecha: "2026-12-10" }),
      mov({ id: "p2", tipo: "pago", hito: "H2", montoUsd: 2_490.5, concepto: "Flete (traslado al puerto y marítimo)", fecha: "2027-01-09" }),
      mov({ id: "d4", tipo: "deposito", hito: "H4", montoUsd: 2_500, fecha: "2027-02-01" }),
      mov({ id: "t5", tipo: "deposito", cuenta: "directo", hito: "H5", montoUsd: 27_587.85, moneda: "PEN", monto: 103_920.02, fecha: "2027-02-11" }),
      mov({ id: "g1", tipo: "pago", hito: "H4", montoUsd: 2_300, concepto: "Agente de aduana", fecha: "2027-02-12" }),
      mov({ id: "g2", tipo: "pago", hito: "H4", montoUsd: 150, concepto: "Grúa del puerto", fecha: "2027-02-12" }),
      mov({ id: "s1", tipo: "pago", montoUsd: 50, concepto: "Sobrante de gastos de aduana aplicado al Pago 5", fecha: "2027-02-20" }),
      mov({ id: "h6", tipo: "deposito", hito: "H6", cuenta: "operaciones", montoUsd: 4_086.57, fecha: "2027-02-20" }),
      mov({ id: "x", tipo: "deposito", hito: "H4", montoUsd: 100, estado: "por_confirmar" }),
    ];
  }

  it("cuadra con el saldo real de Fondos de Clientes, separa honorarios y pagos directos, y llega a cero con la devolución", () => {
    const movs = libroCompleto();
    const ctx = ctxLibro(movs);
    const antes = datosRendicion(ctx);
    expect(antes.totalRecibido).toBe(75_990.5);
    expect(antes.totalPagado).toBe(75_860.5);
    expect(antes.sobranteAplicado).toBe(50);
    expect(antes.faltanteCubierto).toBe(0);
    expect(antes.comisiones).toEqual({ cargadas: 45, repuestas: 45, efecto: 0 });
    expect(antes.saldo).toBe(80);
    expect(antes.saldo).toBe(saldoCuenta(movs));
    expect(antes.totalDirecto).toBe(27_587.85);
    expect(antes.directos.map((d) => d.movimientoId)).toEqual(["t5"]);
    // Honorarios: H3 + H6 neto + el sobrante aplicado = las dos mitades completas.
    expect(antes.totalHonorarios).toBe(8_273.14);
    expect(antes.totalOperacion).toBe(111_721.49);
    expect(antes.aduana).toEqual({ recibido: 2_500, pagado: 2_450, saldo: 50 });
    expect(antes.pago5.neto).toBe(4_086.57);

    movs.push(mov({ id: "dev", tipo: "devolucion", montoUsd: 80, fecha: "2027-03-06" }));
    const despues = datosRendicion(ctx);
    expect(despues.devuelto).toBe(80);
    expect(despues.saldoFinal).toBe(0);
    expect(saldoCuenta(movs)).toBe(0);
    expect(despues.recibidos.map((m) => m.id)).toEqual(["d1", "d2", "d4"]);
    expect(despues.honorarios.map((m) => m.id)).toEqual(["h3", "h6"]);
  });

  it("con faltante de aduana: el Pago 5 lo trae y la reposición deja Fondos de Clientes en cero", () => {
    const movs = [
      mov({ id: "d4", tipo: "deposito", hito: "H4", montoUsd: 2_500, fecha: "2027-02-01" }),
      mov({ id: "g1", tipo: "pago", hito: "H4", montoUsd: 2_800, concepto: "Agente de aduana", fecha: "2027-02-12" }),
      mov({ id: "h3", tipo: "deposito", hito: "H3", cuenta: "operaciones", montoUsd: 4_136.57, fecha: "2026-12-10" }),
      mov({ id: "h6", tipo: "deposito", hito: "H6", cuenta: "operaciones", montoUsd: 4_436.57, fecha: "2027-02-20" }),
      mov({ id: "f1", tipo: "ajuste", montoUsd: 300, concepto: "Faltante de gastos de aduana cubierto con el Pago 5", fecha: "2027-02-20" }),
    ];
    const r = datosRendicion(ctxLibro(movs));
    expect(r.faltanteCubierto).toBe(300);
    expect(r.saldo).toBe(0);
    expect(r.saldo).toBe(saldoCuenta(movs));
    expect(r.totalHonorarios).toBe(8_273.14);
    expect(r.totalRecibido).toBe(2_500);
  });
});
