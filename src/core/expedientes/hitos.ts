/**
 * Hitos de pago H1..H4: se derivan del presupuesto, y su estado del libro.
 */

import type {
  CuentaMovimiento,
  EstadoHito,
  FechaIso,
  Hito,
  Movimiento,
  Presupuesto,
  TipoHito,
} from "./tipos";

/** A qué cuenta va cada hito. Honorarios a Operaciones; fondos del cliente, a Fondos de Clientes. */
export const CUENTA_POR_HITO: Record<TipoHito, CuentaMovimiento> = {
  H1: "operaciones",
  H2: "fondos_clientes",
  H3: "fondos_clientes",
  H4: "operaciones",
};

export const DESCRIPCION_HITO: Record<TipoHito, string> = {
  H1: "30 % de honorarios, al firmar el Anexo A",
  H2: "Precio del vehículo, transporte interno, flete y seguro",
  H3: "Tributos, gastos de aduana y registrales",
  H4: "70 % de honorarios, a la entrega",
};

export type FechasHitos = {
  fechaFirma?: FechaIso | null;
  fechaLimiteH2?: FechaIso | null;
  fechaEstArribo?: FechaIso | null;
  fechaEstEntrega?: FechaIso | null;
};

/** Días antes del arribo en que H3 debe estar acreditado para numerar la DAM a tiempo. */
export const DIAS_H3_ANTES_DEL_ARRIBO = 7;

export function restarDias(fecha: FechaIso, dias: number): FechaIso {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

export function hitosDesde(presupuesto: Presupuesto, fechas: FechasHitos = {}): Hito[] {
  const fechaPor: Record<TipoHito, FechaIso | null> = {
    H1: fechas.fechaFirma ?? null,
    H2: fechas.fechaLimiteH2 ?? null,
    H3: fechas.fechaEstArribo ? restarDias(fechas.fechaEstArribo, DIAS_H3_ANTES_DEL_ARRIBO) : null,
    H4: fechas.fechaEstEntrega ?? null,
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
  // Tolerancia de un dólar: comisiones bancarias no convierten un pago completo en parcial.
  if (acreditado + 1 >= hito.montoEstimadoUsd) return "acreditado";
  return "parcial";
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
