/**
 * Honorarios con UNA sola cuenta para el cliente y autodetracción por defecto
 * (decisiones del dueño del 27 nov 2026).
 *
 *   · El cliente paga la primera mitad de los honorarios dentro del Pago 2 y la
 *     segunda en el Pago 5, siempre a Fondos de Clientes.
 *   · Al emitir cada factura, Luxcars APLICA su importe de Fondos de Clientes a
 *     Operaciones (asientos internos sin hito, que arma `registrar_movimiento`).
 *   · Con cliente empresa (factura), Luxcars deposita la detracción en su
 *     cuenta del Banco de la Nación dentro de los cinco días hábiles de recibido
 *     el pago y le manda la constancia: al confirmar el pago que cubre la
 *     factura nace la tarea `luxcars.autodetraccion_h3` / `_h6`. Si el cliente
 *     prefiere detraer él mismo, deposita la detracción y la descuenta del
 *     pago (alternativa del contrato). Una persona natural con boleta no tiene
 *     detracción.
 *
 * TypeScript puro.
 */

import { FACTURA_POR_HITO, TAREA_AUTODETRACCION_POR_HITO, TAREA_FACTURA_POR_HITO, type HitoHonorarios } from "./etapas";
import { DIAS_HABILES_AUTODETRACCION, estadoHito, redondear, sumarDiasHabiles } from "./hitos";
import type { Cliente, ContextoExpediente, FechaIso, Movimiento } from "./tipos";
import { PAGO_POR_HITO } from "./tipos";

/** Las facturas de honorarios de un cliente empresa llevan detracción; una persona natural recibe boleta y no. */
export function llevaDetraccion(cliente: Pick<Cliente, "tipo"> | null | undefined): boolean {
  return cliente?.tipo === "empresa";
}

/** Hito de honorarios que cubre un pago: la factura 1 con el Pago 2, la factura 2 con el Pago 5. */
export function hitoHonorariosDelPago(pago: number): HitoHonorarios | null {
  return pago === 2 ? "H3" : pago === 5 ? "H6" : null;
}

/** Importe de cada factura de honorarios (la mitad, IGV incluido). */
export function importeFactura(ctx: ContextoExpediente): number {
  const total = ctx.expediente.honorariosUsd ?? ctx.expediente.presupuesto?.honorarios ?? 0;
  return redondear(total / 2);
}

/** Detracción sugerida de una factura en USD: el porcentaje del expediente (o el de la empresa) sobre el importe. */
export function detraccionSugerida(ctx: ContextoExpediente, porcentajeEmpresa?: number | null): number {
  const pct = ctx.expediente.porcentajeDetraccion ?? porcentajeEmpresa ?? 0;
  return redondear((importeFactura(ctx) * pct) / 100);
}

export type TareaNueva = {
  clave: string;
  titulo: string;
  descripcion: string;
  venceEl: FechaIso;
};

/**
 * Tareas que nacen al confirmar un depósito: si deja acreditado el pago que
 * cubre una factura de honorarios (Pago 2 o Pago 5) y el cliente es empresa,
 * la autodetracción de esa factura, con vencimiento a cinco días hábiles de la
 * fecha del depósito (feriados de Perú incluidos). Nunca repite una tarea que
 * ya existe, y no nace si el cliente eligió detraer él mismo (depositó la
 * detracción de ese pago en la cuenta de detracciones de LUXCARS).
 */
export function tareasTrasConfirmar(ctx: ContextoExpediente, mov: Pick<Movimiento, "tipo" | "estado" | "hito" | "fecha">): TareaNueva[] {
  if (mov.tipo !== "deposito" || mov.estado !== "confirmado" || !mov.hito) return [];
  if (!llevaDetraccion(ctx.cliente)) return [];
  const pago = PAGO_POR_HITO[mov.hito];
  const hitoHonorarios = hitoHonorariosDelPago(pago);
  if (!hitoHonorarios) return [];
  const clienteDetrajo = ctx.movimientos.some(
    (m) => m.tipo === "deposito" && m.cuenta === "detracciones" && m.estado !== "anulado" && m.hito !== null && PAGO_POR_HITO[m.hito] === pago,
  );
  if (clienteDetrajo) return [];
  const hito = ctx.hitos.find((h) => h.tipo === hitoHonorarios);
  if (!hito || estadoHito(hito, ctx.movimientos, ctx.hitos) !== "acreditado") return [];
  const clave = TAREA_AUTODETRACCION_POR_HITO[hitoHonorarios];
  if (ctx.tareas.some((t) => t.clave === clave)) return [];
  const factura = FACTURA_POR_HITO[hitoHonorarios];
  return [
    {
      clave,
      titulo: `Depositar la detracción de la factura ${factura} de honorarios en el Banco de la Nación`,
      descripcion: `Autodetracción: el cliente pagó la factura ${factura} completa. Deposita la detracción en la cuenta de detracciones de LUXCARS, registra la constancia en la pestaña Dinero y envíasela al cliente.`,
      venceEl: sumarDiasHabiles(mov.fecha, DIAS_HABILES_AUTODETRACCION),
    },
  ];
}

/** Tarea de la factura de un hito de honorarios (para cerrarla al aplicar los honorarios). */
export function tareaFactura(hito: HitoHonorarios): string {
  return TAREA_FACTURA_POR_HITO[hito];
}
