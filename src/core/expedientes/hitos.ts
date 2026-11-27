/**
 * Hitos de pago H1..H6: se derivan del presupuesto, y su estado del libro.
 *
 * Calendario definitivo del dueño (27 nov 2026): cinco pagos, seis hitos, una
 * cuenta por hito.
 *   Pago 1 · H1 · al firmar el contrato · precio del vehículo según la pro forma
 *            del broker (en usados, más la inspección) · Fondos de Clientes
 *   Pago 2 · H2 · release (auto listo para embarcar) · flete (traslado al puerto
 *            y marítimo) y seguro · Fondos de Clientes
 *          · H3 · mismo momento · 50 % de los honorarios · Operaciones
 *   Pago 3 · H4 · al arribo al Callao · gastos de aduana (agente, almacenaje,
 *            grúa del puerto) según la pro forma del agente · Fondos de Clientes
 *   Pago 4 · H5 · cuando SUNAT numera y liquida la DAM · tributos exactos de la
 *            liquidación, en soles · el cliente los paga DIRECTAMENTE a SUNAT
 *            (cuenta `directo`); dos días hábiles desde el aviso
 *   Pago 5 · H6 · con el levante · 50 % restante de los honorarios, neto del
 *            sobrante o faltante de los gastos de aduana · Operaciones
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

/** A qué cuenta va cada hito. Honorarios a Operaciones; fondos del cliente, a Fondos de Clientes; tributos, directo a SUNAT. */
export const CUENTA_POR_HITO: Record<TipoHito, CuentaMovimiento> = {
  H1: "fondos_clientes",
  H2: "fondos_clientes",
  H3: "operaciones",
  H4: "fondos_clientes",
  H5: "directo",
  H6: "operaciones",
};

export const DESCRIPCION_HITO: Record<TipoHito, string> = {
  H1: "Precio del vehículo según la pro forma del broker, al firmar el contrato",
  H2: "Flete (traslado al puerto y marítimo) y seguro, con el auto listo para embarcar",
  H3: "50 % de los honorarios, con el auto listo para embarcar",
  H4: "Gastos de aduana (agente, almacenaje y grúa del puerto), al arribo",
  H5: "Tributos de importación según la liquidación de SUNAT, pagados directamente a SUNAT",
  H6: "50 % restante de los honorarios, con el auto liberado, neto del saldo de aduana",
};

/** Nombre corto de cada pago, para el cliente. */
export const NOMBRE_PAGO: Record<NumeroPago, string> = {
  1: "Pago 1 · El auto",
  2: "Pago 2 · Flete, seguro y primera mitad de honorarios",
  3: "Pago 3 · Gastos de aduana",
  4: "Pago 4 · Tributos a SUNAT",
  5: "Pago 5 · Segunda mitad de honorarios",
};

/** Cuándo toca cada pago, en palabras del cliente. */
export const CUANDO_PAGO: Record<NumeroPago, string> = {
  1: "Al firmar el contrato",
  2: "Cuando el auto está listo para embarcar",
  3: "Al arribo al Callao",
  4: "Cuando SUNAT liquida la DAM (dos días hábiles para pagar)",
  5: "Cuando el auto queda liberado de aduana",
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

/** Suma días hábiles (lunes a viernes; los feriados no se descuentan). */
export function sumarDiasHabiles(fecha: FechaIso, dias: number): FechaIso {
  const d = new Date(`${fecha}T12:00:00Z`);
  let restantes = dias;
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dia = d.getUTCDay();
    if (dia !== 0 && dia !== 6) restantes -= 1;
  }
  return d.toISOString().slice(0, 10);
}

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

/** Suma de depósitos confirmados aplicados a un hito. */
export function acreditadoPorHito(hito: Pick<Hito, "tipo">, movimientos: readonly Movimiento[]): number {
  return movimientos
    .filter((m) => m.hito === hito.tipo && m.tipo === "deposito" && m.estado === "confirmado")
    .reduce((s, m) => s + m.montoUsd, 0);
}

export function estadoHito(hito: Hito, movimientos: readonly Movimiento[]): EstadoHito {
  const acreditado = acreditadoPorHito(hito, movimientos);
  if (acreditado <= 0) return "pendiente";
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
