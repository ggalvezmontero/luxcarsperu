/**
 * 6 · Aviso de pago de los hitos que se fijan durante la operación (calendario
 * del 27 nov 2026). Una plantilla, tres variantes según el campo HITO:
 *   · H4 · Pago 3 de 5 · gastos de aduana según la pro forma del agente, al
 *     arribo, a Fondos de Clientes. Reembolsable: el saldo se compensa en el
 *     Pago 5.
 *   · H5 · Pago 4 de 5 · tributos exactos de la liquidación de SUNAT, en soles,
 *     que el cliente paga DIRECTAMENTE a SUNAT dentro de dos días hábiles.
 *   · H6 · Pago 5 de 5 · segunda mitad de los honorarios, neta del sobrante (o
 *     más el faltante) de los gastos de aduana, a Fondos de Clientes.
 * Cada aviso dice qué pago es, el monto exacto, dónde pagar, la fecha límite y
 * de dónde sale la cifra, y repite la tabla de los cinco pagos con este en
 * negrita. El cliente nunca ve los códigos H.
 * Cada variante solo lee sus propios campos (regla "sin rayas").
 *
 * El tipo de documento conserva el valor viejo de la enum (`aviso_h3`): cambiar
 * un valor de enum en Postgres costaba más que documentarlo acá y en tipos.ts.
 */

import type { Campos } from "../../campos";
import { firmas, h2, p, tabla, vinetas, type Estructura } from "../estructura";
import { tablaCalendario } from "./calendario";
import type { Plantilla } from "./tipos";

export function encabezadoLiquidacion(c: Campos): string {
  return `**Expediente ${c.EXPEDIENTE} · Vehículo ${c.VEH_MARCA} ${c.VEH_MODELO} ${c.VEH_ANIO}, VIN ${c.VEH_VIN} · Importador: ${c.CLIENTE_RAZON_SOCIAL}, RUC ${c.CLIENTE_RUC}**`;
}

export const TEXTO_TRIBUTOS_AVISO =
  "Los tributos de importación que liquide SUNAT, así como cualquier ajuste, diferencia, multa o reliquidación que la Administración Aduanera determine sobre la operación, son de cargo exclusivo del Mandante y serán asumidos por él (cláusula 8.4 del contrato).";

/** La tabla corta con lo que el cliente necesita para pagar: qué pago es, cuánto, dónde, hasta cuándo y de dónde sale la cifra. */
function resumen(filas: [string, string][]): Estructura["bloques"][number] {
  return tabla(["", "Detalle"], filas.map(([k, v]) => [`**${k}**`, v]), [2.2, 6]);
}

function cuentaFondos(c: Campos, pago: number): string {
  return `Cuenta Fondos de Clientes de LUXCARS · ${c.CTA_FONDOS_BANCO} ${c.CTA_FONDOS_NUMERO} · CCI ${c.CTA_FONDOS_CCI} · concepto "${c.EXPEDIENTE} Pago ${pago}"`;
}

function avisoGastosAduana(c: Campos, usado: boolean): Estructura["bloques"] {
  return [
    h2("Pago 3 de 5: gastos de aduana"),
    p(`Tu auto está por llegar al ${c.PUERTO_DESTINO}. Toca el Pago 3 de 5: los gastos de aduana (agente, almacén y grúa del puerto).`),
    resumen([
      ["Qué pago es", "Pago 3 de 5: gastos de aduana"],
      ["Monto exacto", `**USD ${c.MONTO_AVISO}**`],
      ["Dónde pagar", cuentaFondos(c, 3)],
      ["Fecha límite", c.FECHA_LIMITE_PAGO],
      ["De dónde sale la cifra", `De la pro forma del agente de aduana ${c.AGENTE_ADUANA.replace(/\.+$/, "")}. Arribo estimado: ${c.FECHA_EST_ARRIBO}.`],
    ]),
    vinetas([
      "Es un gasto reembolsable: pagamos al agente, al almacén y a la grúa con facturas a tu nombre y te rendimos cada una (cláusula 8.5 del contrato).",
      "Si sobra, lo restamos del Pago 5. Si falta, se suma al Pago 5.",
      "Los tributos no van en este pago: cuando SUNAT los calcule te enviamos el aviso del Pago 4 para que los pagues directo a SUNAT.",
    ]),
    h2("Tus cinco pagos"),
    tablaCalendario(c, { usado, resaltar: 3, montoExacto: `USD ${c.MONTO_AVISO}` }),
  ];
}

function avisoTributos(c: Campos, usado: boolean): Estructura["bloques"] {
  return [
    h2("Pago 4 de 5: tributos, directo a SUNAT"),
    p("SUNAT calculó los tributos de tu auto. Los pagas tú, directo a SUNAT, en soles. Este pago no pasa por las cuentas de LUXCARS."),
    resumen([
      ["Qué pago es", "Pago 4 de 5: tributos de importación"],
      ["Monto exacto", `**S/ ${c.TRIBUTOS_SOLES}** (USD ${c.TRIBUTOS_USD} según la DAM)`],
      ["Dónde pagar", `Directo a SUNAT, con el número de liquidación **${c.LIQUIDACION_NUMERO}**: con tu Clave SOL en SUNAT Operaciones en Línea o en la ventanilla de un banco autorizado (BCP, BBVA, Interbank, Scotiabank, Banco de la Nación)`],
      ["Fecha límite", c.FECHA_LIMITE_PAGO],
      ["De dónde sale la cifra", `De la liquidación de SUNAT n.º ${c.LIQUIDACION_NUMERO} de la DAM n.º ${c.DAM_NUMERO}. Referencia en dólares al tipo de cambio ${c.TC_REFERENCIAL}.`],
    ]),
    vinetas([
      "El monto en soles se fija con el tipo de cambio venta SBS del día de pago: si pagas otro día, puede variar un poco.",
      "Al pagar, entra a tu cuenta en luxcars.pe y avísanos con «Ya pagué» y el comprobante. Con eso seguimos con el levante.",
      TEXTO_TRIBUTOS_AVISO,
    ]),
    h2("Tus cinco pagos"),
    tablaCalendario(c, { usado, resaltar: 4, montoExacto: `S/ ${c.TRIBUTOS_SOLES}` }),
  ];
}

/** Cifra de un campo de monto ("2,300.00" → 2300). */
function cifra(texto: string): number {
  const n = Number(texto.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Fila del saldo de aduana con su signo: lo que sobró se resta, lo que faltó se suma. */
function filaSaldoAduana(c: Campos): string[] {
  const saldo = cifra(c.ADUANA_RECIBIDO) - cifra(c.ADUANA_PAGADO);
  if (saldo > 0.005) return ["Lo que sobró de los gastos de aduana (se resta)", `− ${c.ADUANA_SALDO}`];
  if (saldo < -0.005) return ["Lo que faltó de los gastos de aduana (se suma)", `+ ${c.ADUANA_SALDO}`];
  return ["Diferencia de los gastos de aduana", "0.00"];
}

function avisoHonorarios(c: Campos, usado: boolean): Estructura["bloques"] {
  return [
    h2("Pago 5 de 5: segunda mitad de los honorarios"),
    p("Aduana entregó tu auto. Toca el último pago: la segunda mitad de nuestros honorarios, ajustada con lo que sobró o faltó de los gastos de aduana."),
    resumen([
      ["Qué pago es", "Pago 5 de 5: segunda mitad de los honorarios"],
      ["Monto exacto", `**USD ${c.PAGO5_NETO}**`],
      ["Dónde pagar", cuentaFondos(c, 5)],
      ["Fecha límite", c.FECHA_LIMITE_PAGO],
      ["De dónde sale la cifra", "La segunda mitad de los honorarios, menos lo que sobró de los gastos de aduana (o más lo que faltó). El detalle está en la tabla de abajo."],
    ]),
    tabla(["Cálculo", "USD"], [
      ["Segunda mitad de los honorarios (50 %, IGV incluido)", c.COMISION_MITAD],
      ["Gastos de aduana que depositaste (Pago 3)", c.ADUANA_RECIBIDO],
      ["Gastos de aduana pagados al agente, al almacén y a la grúa", c.ADUANA_PAGADO],
      filaSaldoAduana(c),
      ["**Pago 5 de 5**", `**${c.PAGO5_NETO}**`],
    ], [4, 1.5]),
    vinetas([
      `Paga el monto completo. Si eres empresa, nosotros depositamos la detracción de la factura (${c.PORCENTAJE_DETRACCION} %) en el Banco de la Nación y te enviamos la constancia (cláusula 5.3 del contrato).`,
      "Con este pago te entregamos el auto con placas, el acta de entrega y rendición de cuentas y la carpeta completa.",
    ]),
    h2("Tus cinco pagos"),
    tablaCalendario(c, { usado, resaltar: 5, montoExacto: `USD ${c.PAGO5_NETO}` }),
  ];
}

function construir(c: Campos): Estructura {
  const hito = c.HITO || "H4";
  const usado = c.VEH_CONDICION.toLowerCase().startsWith("usado");
  const bloques = hito === "H5" ? avisoTributos(c, usado) : hito === "H6" ? avisoHonorarios(c, usado) : avisoGastosAduana(c, usado);
  const titulo = hito === "H5" ? "Aviso de pago · Pago 4 de 5" : hito === "H6" ? "Aviso de pago · Pago 5 de 5" : "Aviso de pago · Pago 3 de 5";
  return {
    titulo,
    subtitulo: encabezadoLiquidacion(c),
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`**Fecha del aviso: ${c.FECHA_AVISO}**`),
      ...bloques,
      firmas(["LUX CARS IMPORT S.A.C.", `${c.LUXCARS_REPRESENTANTE}, DNI ${c.LUXCARS_REP_DNI}`, `${c.CIUDAD_FIRMA}, ${c.FECHA_AVISO}`]),
    ],
  };
}

export const avisoPago: Plantilla = {
  tipo: "aviso_h3",
  version: "aviso_pago@2026-11-27b",
  nombre: "Aviso de pago",
  idioma: "es",
  seFirma: false,
  construir,
};
