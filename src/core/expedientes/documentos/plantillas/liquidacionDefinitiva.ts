/**
 * 6 · Liquidación definitiva de tributos y gastos de aduana, después del
 * levante. Lista los tributos pagados (directo por el cliente a SUNAT o, si lo
 * pidió, por Luxcars) y los gastos de aduana pagados con el Pago 3, y compara
 * lo depositado con lo pagado: el saldo pasa al Pago 5 (cláusula 8.5).
 */

import type { Campos } from "../../campos";
import { fechaEnLetras, monto } from "../../campos";
import { lineasDePagos, pagosDirectos, saldoGastosAduana, type LineaLiquidacion } from "../../ledger";
import type { ContextoExpediente } from "../../tipos";
import { firmas, h2, h3, p, tabla, type Estructura } from "../estructura";
import { TEXTO_TRIBUTOS_AVISO, encabezadoLiquidacion } from "./avisoH3";
import type { Plantilla } from "./tipos";

function soles(l: LineaLiquidacion): string {
  return l.moneda === "PEN" ? monto(l.monto) : "";
}

function construir(c: Campos, ctx: ContextoExpediente): Estructura {
  const tributos = lineasDePagos(ctx, ["tributo"]);
  const directos = pagosDirectos(ctx.movimientos).filter((d) => d.hito === "H5");
  const gastos = lineasDePagos(ctx, ["gasto"]);
  const aduana = saldoGastosAduana(ctx.movimientos);
  const sobrante = aduana.saldo >= 0;
  const filasTributos: string[][] = [
    ...directos.map((d) => [`Pagado directamente por el Mandante a SUNAT (${fechaEnLetras(d.fecha)})`, monto(d.montoUsd), d.moneda === "PEN" ? monto(d.monto) : "", d.referencia || "Comprobante del Mandante"]),
    ...tributos.map((l) => [`${l.concepto} (pagado por LUXCARS por cuenta del Mandante)`, monto(l.montoUsd), soles(l), l.documento]),
  ];
  const filasGastos: string[][] = gastos.length
    ? gastos.map((l) => [l.concepto, l.proveedor, l.documento, `${l.moneda} ${monto(l.monto)}`, monto(l.montoUsd)])
    : [["Sin gastos de aduana registrados todavía", "", "", "", ""]];

  return {
    titulo: "Liquidación definitiva de tributos y gastos de aduana",
    subtitulo: encabezadoLiquidacion(c),
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`**DAM n.º ${c.DAM_NUMERO} del ${c.DAM_FECHA} · Canal de control: ${c.CANAL} · Levante: ${c.FECHA_LEVANTE} · Factor de conversión aplicado: ${c.FACTOR_CONVERSION} · Tipo de cambio venta SBS del día de pago: ${c.TC_SBS_PAGO}**`),
      p("Este documento cierra la etapa aduanera: lo que SUNAT liquidó y cómo se pagó, y los gastos de aduana pagados con el Pago 3, con su saldo para el Pago 5."),

      h3("Tributos de importación (Pago 4)"),
      tabla(["Concepto", "USD según la DAM", "S/ pagados", "Comprobante"], [
        ...(filasTributos.length ? filasTributos : [["Pago pendiente o sin comprobante confirmado", "", "", ""]]),
        ["**Total tributos**", `**${c.TOTAL_TRIBUTOS_USD}**`, `**${c.TOTAL_TRIBUTOS_PEN}**`, ""],
      ], [3, 1.6, 1.6, 2.4]),
      p(TEXTO_TRIBUTOS_AVISO),

      h3("Gastos de aduana pagados con el Pago 3"),
      tabla(["Concepto", "Proveedor", "Documento a nombre del Mandante", "Moneda y monto", "USD equivalente"], [
        ...filasGastos,
        ["**Total gastos**", "", "", "", `**${c.TOTAL_GASTOS_USD}**`],
      ], [2.6, 2.2, 2.2, 1.6, 1.4]),

      h2("Saldo de los gastos de aduana"),
      tabla(["Concepto", "USD"], [
        ["Recibido en el Pago 3 (H4)", c.ADUANA_RECIBIDO],
        ["Pagado al agente, al almacén y a la grúa", c.ADUANA_PAGADO],
        [sobrante ? "**Sobrante a favor del Mandante: se descuenta del Pago 5**" : "**Faltante a cargo del Mandante: se suma al Pago 5**", `**${c.ADUANA_SALDO}**`],
        ["Pago 5 (segunda mitad de honorarios, ajustada)", c.PAGO5_NETO],
      ], [4, 1.5]),
      p("Los comprobantes de pago a SUNAT quedan asociados a la DAM del Mandante y sustentan su crédito fiscal por IGV, IPM y percepción. Las facturas de los proveedores están a nombre del Mandante y se entregan en original con la carpeta del expediente."),

      firmas(["LUX CARS IMPORT S.A.C.", `${c.LUXCARS_REPRESENTANTE}, DNI ${c.LUXCARS_REP_DNI}`, `${c.CIUDAD_FIRMA}, ${c.FECHA_LEVANTE}`]),
    ],
  };
}

export const liquidacionDefinitiva: Plantilla = {
  tipo: "liquidacion_definitiva",
  version: "liquidacion_definitiva@2026-11-27b",
  nombre: "Liquidación definitiva de tributos y gastos de aduana",
  idioma: "es",
  tarea: "luxcars.liquidacion_definitiva",
  seFirma: false,
  construir,
};
