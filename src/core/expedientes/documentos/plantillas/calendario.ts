/**
 * El calendario de pagos tal como lo ve el cliente: una tabla de cinco filas
 * (Pago, Cuándo, Qué cubre, Monto, Dónde pagas), igual en el contrato, el
 * Anexo B, el Anexo D y los avisos de pago, en lenguaje simple y sin códigos
 * internos (nunca H1 a H6 ni nombres de cuentas internas). Los textos de
 * "Cuándo", "Qué cubre" y "Dónde pagas" son los mismos de la cuenta del
 * cliente (`core/expedientes/hitos.ts`).
 */

import { CUANDO_PAGO, DONDE_PAGA, etiquetaPago, queCubrePago } from "../../hitos";
import type { Campos } from "../../campos";
import type { NumeroPago } from "../../tipos";
import { tabla, type Bloque } from "../estructura";

export const CABECERA_CALENDARIO = ["Pago", "Cuándo", "Qué cubre", "Monto", "Dónde pagas"];

export type OpcionesCalendario = {
  usado: boolean;
  /** Pago que se está avisando: su fila va en negrita y con el monto exacto. */
  resaltar?: NumeroPago;
  /** Monto exacto del pago resaltado (texto ya formateado, con la moneda). */
  montoExacto?: string;
};

/** Filas del calendario con los montos del expediente. */
export function filasCalendario(c: Campos, opciones: OpcionesCalendario): string[][] {
  const filas: [NumeroPago, string, string, string, string][] = [
    [1, CUANDO_PAGO[1], queCubrePago(1, opciones.usado), `USD ${c.PAGO1_MONTO}`, DONDE_PAGA[1]],
    [2, `${CUANDO_PAGO[2]}, a más tardar el ${c.FECHA_LIMITE_H2}`, queCubrePago(2), `USD ${c.PAGO2_MONTO} (estimado)`, DONDE_PAGA[2]],
    [3, CUANDO_PAGO[3], queCubrePago(3), `USD ${c.PAGO3_MONTO} (estimado)`, DONDE_PAGA[3]],
    [4, CUANDO_PAGO[4], queCubrePago(4), `USD ${c.PAGO4_MONTO} (estimado; se paga en soles)`, DONDE_PAGA[4]],
    [5, CUANDO_PAGO[5], queCubrePago(5), `USD ${c.PAGO5_MONTO} antes del ajuste`, DONDE_PAGA[5]],
  ];
  return filas.map(([pago, cuando, que, montoTexto, donde]) => {
    const fila = [etiquetaPago(pago), cuando, que, opciones.resaltar === pago && opciones.montoExacto ? opciones.montoExacto : montoTexto, donde];
    return opciones.resaltar === pago ? fila.map((t) => `**${t}**`) : fila;
  });
}

/** La tabla del calendario, lista para insertar en un documento. */
export function tablaCalendario(c: Campos, opciones: OpcionesCalendario): Bloque {
  return tabla(CABECERA_CALENDARIO, filasCalendario(c, opciones), [1.1, 2.4, 3.4, 1.9, 2.2]);
}
