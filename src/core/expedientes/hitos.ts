/**
 * Hitos de pago H1..H6: se derivan del presupuesto, y su estado del libro.
 *
 * Calendario definitivo del dueño (27 nov 2026): cinco pagos, seis hitos
 * internos y UNA sola cuenta para el cliente.
 *   Pago 1 · H1 · al firmar el contrato · precio del vehículo según la pro forma
 *            del broker (en usados, más la inspección)
 *   Pago 2 · H2 + H3 · release (auto listo para embarcar) · UNA transferencia:
 *            flete (traslado al puerto y marítimo), seguro (H2) y 50 % de los
 *            honorarios (H3)
 *   Pago 3 · H4 · al arribo al Callao · gastos de aduana (agente, almacenaje,
 *            grúa del puerto) según la pro forma del agente; reembolsables
 *   Pago 4 · H5 · cuando SUNAT liquida la DAM · tributos exactos, en soles · el
 *            cliente los paga DIRECTAMENTE a SUNAT (cuenta `directo`); dos días
 *            hábiles desde el aviso
 *   Pago 5 · H6 · con el levante · 50 % restante de los honorarios, neto del
 *            sobrante o faltante de los gastos de aduana
 * Los Pagos 1, 2, 3 y 5 van todos a Fondos de Clientes. Al emitir cada factura
 * de honorarios, Luxcars aplica su importe de Fondos de Clientes a Operaciones
 * y desde ahí deposita la detracción (autodetracción): asientos internos SIN
 * hito, para que nunca cuenten como pagos del cliente.
 */

import type {
  CuentaMovimiento,
  EstadoHito,
  FechaIso,
  Hito,
  Movimiento,
  NumeroPago,
  Presupuesto,
  TipoHito,
} from "./tipos";
import { PAGO_POR_HITO } from "./tipos";

/**
 * A qué cuenta deposita el cliente cada hito: todo a Fondos de Clientes salvo
 * los tributos, que paga directo a SUNAT. Los honorarios (H3 y H6) también
 * entran por Fondos de Clientes; Luxcars los aplica a Operaciones al facturar.
 */
export const CUENTA_POR_HITO: Record<TipoHito, CuentaMovimiento> = {
  H1: "fondos_clientes",
  H2: "fondos_clientes",
  H3: "fondos_clientes",
  H4: "fondos_clientes",
  H5: "directo",
  H6: "fondos_clientes",
};

export const DESCRIPCION_HITO: Record<TipoHito, string> = {
  H1: "Precio del vehículo según la pro forma del broker, al firmar el contrato",
  H2: "Flete (traslado al puerto y marítimo) y seguro, con el auto listo para embarcar",
  H3: "50 % de los honorarios, con el auto listo para embarcar",
  H4: "Gastos de aduana (agente, almacenaje y grúa del puerto), al arribo",
  H5: "Tributos de importación según la liquidación de SUNAT, pagados directamente a SUNAT",
  H6: "50 % restante de los honorarios, con el auto liberado, neto del saldo de aduana",
};

/** "Pago 1 de 5" … "Pago 5 de 5": así se nombra cada pago en todo lo que ve el cliente (nunca H1 a H6). */
export function etiquetaPago(pago: NumeroPago): string {
  return `Pago ${pago} de 5`;
}

/** Nombre corto de cada pago, para el cliente. */
export const NOMBRE_PAGO: Record<NumeroPago, string> = {
  1: "Pago 1 de 5 · El precio del auto",
  2: "Pago 2 de 5 · Flete, seguro y primera mitad de los honorarios",
  3: "Pago 3 de 5 · Gastos de aduana",
  4: "Pago 4 de 5 · Tributos a SUNAT",
  5: "Pago 5 de 5 · Segunda mitad de los honorarios",
};

/** Cuándo toca cada pago, en palabras del cliente. */
export const CUANDO_PAGO: Record<NumeroPago, string> = {
  1: "Al firmar el contrato",
  2: "Cuando el auto está listo para embarcar",
  3: "Cuando el auto llega al Callao",
  4: "Cuando SUNAT calcula los tributos (tienes dos días hábiles)",
  5: "Cuando aduana entrega el auto (levante)",
};

/** Qué cubre cada pago, en frases cortas. */
export const QUE_CUBRE_PAGO: Record<NumeroPago, string> = {
  1: "El precio del auto, según la pro forma del vendedor",
  2: "El flete hasta el Callao, el seguro y la primera mitad de nuestros honorarios",
  3: "Los gastos de aduana: agente, almacén y grúa del puerto",
  4: "Los tributos de importación, la cifra exacta que fija SUNAT",
  5: "La segunda mitad de nuestros honorarios, menos lo que sobró de los gastos de aduana o más lo que faltó",
};

/** "Qué cubre" de un pago; en un usado, el Pago 1 lleva además la inspección. */
export function queCubrePago(pago: NumeroPago, usado = false): string {
  return pago === 1 && usado ? `${QUE_CUBRE_PAGO[1]}, más la inspección del auto usado` : QUE_CUBRE_PAGO[pago];
}

/** Dónde se paga cada pago. */
export const DONDE_PAGA: Record<NumeroPago, string> = {
  1: "Cuenta Fondos de Clientes de LUXCARS",
  2: "Cuenta Fondos de Clientes de LUXCARS",
  3: "Cuenta Fondos de Clientes de LUXCARS",
  4: "Directo a SUNAT, con el número de liquidación",
  5: "Cuenta Fondos de Clientes de LUXCARS",
};

export function pagoDeHito(tipo: TipoHito): NumeroPago {
  return PAGO_POR_HITO[tipo];
}

/** Hitos de un pago, en orden. */
export function hitosDelPago(pago: NumeroPago): TipoHito[] {
  return (Object.keys(PAGO_POR_HITO) as TipoHito[]).filter((h) => PAGO_POR_HITO[h] === pago);
}

/** El hito lo paga el cliente directamente a un tercero (no pasa por cuentas de Luxcars). */
export function esHitoDirecto(hito: Pick<Hito, "cuenta">): boolean {
  return hito.cuenta === "directo";
}

export type FechasHitos = {
  /** H1: la firma del contrato. */
  fechaFirma?: FechaIso | null;
  /** H2 y H3: fecha límite del Pago 2 fijada en el expediente; si no, el release estimado. */
  fechaLimitePago2?: FechaIso | null;
  fechaReleaseEst?: FechaIso | null;
  /** H4: el arribo estimado. H6: si no hay levante estimado, arribo + DIAS_LEVANTE_TRAS_ARRIBO. */
  fechaEstArribo?: FechaIso | null;
  fechaEstLevante?: FechaIso | null;
};

/** Días estimados entre el arribo y el levante cuando no hay fecha de levante estimada (H6). */
export const DIAS_LEVANTE_TRAS_ARRIBO = 10;
/** Días hábiles que tiene el cliente para pagar los tributos desde el aviso con la liquidación (H5). */
export const DIAS_HABILES_PAGO_TRIBUTOS = 2;

export function restarDias(fecha: FechaIso, dias: number): FechaIso {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

export function sumarDias(fecha: FechaIso, dias: number): FechaIso {
  return restarDias(fecha, -dias);
}

/**
 * Feriados nacionales de Perú (calendario oficial publicado en gob.pe). Los
 * días no laborables que decreta el Gobierno para el sector público no están:
 * no son feriados para el sector privado. Revisar al empezar cada año y sumar
 * el siguiente (Jueves y Viernes Santo cambian de fecha).
 */
export const FERIADOS_PERU: ReadonlySet<FechaIso> = new Set([
  // 2026
  "2026-01-01", "2026-04-02", "2026-04-03", "2026-05-01", "2026-06-07", "2026-06-29", "2026-07-23",
  "2026-07-28", "2026-07-29", "2026-08-06", "2026-08-30", "2026-10-08", "2026-11-01", "2026-12-08",
  "2026-12-09", "2026-12-25",
  // 2027
  "2027-01-01", "2027-03-25", "2027-03-26", "2027-05-01", "2027-06-07", "2027-06-29", "2027-07-23",
  "2027-07-28", "2027-07-29", "2027-08-06", "2027-08-30", "2027-10-08", "2027-11-01", "2027-12-08",
  "2027-12-09", "2027-12-25",
]);

/** Día hábil: de lunes a viernes y no feriado nacional. */
export function esDiaHabil(fecha: FechaIso, feriados: ReadonlySet<FechaIso> = FERIADOS_PERU): boolean {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return dia !== 0 && dia !== 6 && !feriados.has(fecha);
}

/** Suma días hábiles: salta sábados, domingos y feriados nacionales de Perú. */
export function sumarDiasHabiles(fecha: FechaIso, dias: number, feriados: ReadonlySet<FechaIso> = FERIADOS_PERU): FechaIso {
  let actual = fecha;
  let restantes = dias;
  while (restantes > 0) {
    actual = sumarDias(actual, 1);
    if (esDiaHabil(actual, feriados)) restantes -= 1;
  }
  return actual;
}

/** Días hábiles que tiene LUXCARS para depositar la detracción desde que recibe el pago de una factura (autodetracción). */
export const DIAS_HABILES_AUTODETRACCION = 5;

export function hitosDesde(presupuesto: Presupuesto, fechas: FechasHitos = {}): Hito[] {
  const pago2 = fechas.fechaLimitePago2 ?? fechas.fechaReleaseEst ?? null;
  const fechaPor: Record<TipoHito, FechaIso | null> = {
    H1: fechas.fechaFirma ?? null,
    H2: pago2,
    H3: pago2,
    H4: fechas.fechaEstArribo ?? null,
    // Sin fecha hasta que SUNAT liquida: el aviso con la liquidación la fija (dos días hábiles).
    H5: null,
    H6: fechas.fechaEstLevante ?? (fechas.fechaEstArribo ? sumarDias(fechas.fechaEstArribo, DIAS_LEVANTE_TRAS_ARRIBO) : null),
  };
  return presupuesto.hitos.map((h) => ({
    tipo: h.tipo,
    montoEstimadoUsd: redondear(h.montoUsd),
    fechaLimite: fechaPor[h.tipo],
    cuenta: h.cuenta,
    nota: h.descripcion,
  }));
}

/**
 * Depósitos confirmados del cliente para un pago: suma los de todos sus hitos
 * (el Pago 2 es una sola transferencia, registrada con el hito H2 o, en
 * expedientes viejos, partida en H2 y H3). Los asientos internos de Luxcars
 * (aplicación de honorarios, autodetracción) no llevan hito y no entran.
 */
export function acreditadoPorPago(pago: NumeroPago, movimientos: readonly Movimiento[]): number {
  const delPago = hitosDelPago(pago);
  return movimientos
    .filter((m) => m.hito !== null && delPago.includes(m.hito) && m.tipo === "deposito" && m.estado === "confirmado")
    .reduce((s, m) => s + m.montoUsd, 0);
}

/**
 * Lo acreditado que corresponde a un hito. Con `hitos` (los del expediente),
 * lo depositado para su pago se reparte en orden entre los hitos del pago: en
 * el Pago 2, primero el H2 (flete y seguro) y lo que sigue al H3 (honorarios).
 * Sin `hitos`, suma solo los depósitos marcados con ese hito.
 */
export function acreditadoPorHito(
  hito: Pick<Hito, "tipo">,
  movimientos: readonly Movimiento[],
  hitos?: readonly Pick<Hito, "tipo" | "montoEstimadoUsd">[],
): number {
  const pago = PAGO_POR_HITO[hito.tipo];
  const delPago = hitosDelPago(pago);
  if (!hitos || delPago.length === 1) {
    return movimientos
      .filter((m) => m.hito === hito.tipo && m.tipo === "deposito" && m.estado === "confirmado")
      .reduce((s, m) => s + m.montoUsd, 0);
  }
  const total = acreditadoPorPago(pago, movimientos);
  const indice = delPago.indexOf(hito.tipo);
  const estimado = (t: TipoHito) => hitos.find((h) => h.tipo === t)?.montoEstimadoUsd ?? 0;
  const antes = delPago.slice(0, indice).reduce((s, t) => s + estimado(t), 0);
  const disponible = Math.max(0, total - antes);
  // El último hito del pago se lleva lo que sobre; los anteriores, hasta su estimado.
  return indice === delPago.length - 1 ? disponible : Math.min(disponible, estimado(hito.tipo));
}

export function estadoHito(hito: Hito, movimientos: readonly Movimiento[], hitos?: readonly Hito[]): EstadoHito {
  const acreditado = acreditadoPorHito(hito, movimientos, hitos);
  // Un hito sin monto (un Pago 5 que el sobrante de aduana dejó en cero) no espera nada.
  if (acreditado <= 0) return hito.montoEstimadoUsd <= 0 && movimientos.length > 0 ? "acreditado" : "pendiente";
  // Pago directo a SUNAT: la cifra es la de la liquidación y el comprobante la prueba;
  // basta con que el equipo confirme el pago declarado.
  if (esHitoDirecto(hito)) return "acreditado";
  // Tolerancia de un dólar: comisiones bancarias no convierten un pago completo en parcial.
  if (acreditado + 1 >= hito.montoEstimadoUsd) return "acreditado";
  return "parcial";
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
