/**
 * Código, vigencia y estado efectivo de una cotización. El estado guardado es
 * el que fijó el equipo; una enviada cuyo plazo ya pasó se muestra vencida
 * aunque nadie la haya marcado (la base no corre un cron para esto).
 */

import { VIGENCIA_DIAS, type EstadoCotizacion } from "./tipos";

/** (2026, 36) → "COT-2026-036". */
export function formatoCodigoCotizacion(anio: number, numero: number): string {
  return `COT-${anio}-${String(numero).padStart(3, "0")}`;
}

/** Fecha ISO de vencimiento: emisión + 15 días. */
export function venceEl(fechaIso: string, dias = VIGENCIA_DIAS): string {
  const [y, m, d] = fechaIso.slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

/** El estado que se muestra: una enviada con la vigencia pasada cuenta como vencida. */
export function estadoEfectivo(estado: EstadoCotizacion, vence: string | null, hoyIso: string): EstadoCotizacion {
  if (estado === "enviada" && vence && vence < hoyIso) return "vencida";
  return estado;
}
