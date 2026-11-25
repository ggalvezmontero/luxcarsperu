/**
 * 6 · Liquidación de tributos, parte 2: liquidación definitiva. Transcrita del
 * paquete. Las tablas de tributos y gastos se llenan con los PAGOS confirmados
 * del libro (`lineasDePagos`); la comparación con lo depositado, con
 * `datosLiquidacion`.
 */

import type { Campos } from "../../campos";
import { monto } from "../../campos";
import { lineasDePagos, diferenciaH3, type LineaLiquidacion } from "../../ledger";
import type { ContextoExpediente } from "../../tipos";
import { casillas, firmas, h2, h3, p, tabla, type Estructura } from "../estructura";
import { INTRO_LIQUIDACION, encabezadoLiquidacion } from "./avisoH3";
import type { Plantilla } from "./tipos";

const CONCEPTOS_TRIBUTO: [string, string][] = [
  ["Ad valorem", "Liquidación de cobranza"],
  ["Impuesto selectivo al consumo", "Liquidación de cobranza"],
  ["IGV", "Liquidación de cobranza"],
  ["IPM", "Liquidación de cobranza"],
  ["Percepción del IGV", "Constancia de percepción"],
];

function soles(l: LineaLiquidacion): string {
  return l.moneda === "PEN" ? monto(l.monto) : "";
}

function filasTributos(lineas: LineaLiquidacion[]): string[][] {
  // Una fila por concepto del paquete; si se pagó todo junto ("Tributos de importación (SUNAT)"), una sola fila.
  const filas: string[][] = [["Valor en aduana (FOB, flete, seguro)", "", "", "DAM"]];
  const usados = new Set<LineaLiquidacion>();
  for (const [concepto, documento] of CONCEPTOS_TRIBUTO) {
    const propias = lineas.filter((l) => l.concepto === concepto || (concepto === "Percepción del IGV" && l.concepto === "Percepción del IGV"));
    propias.forEach((l) => usados.add(l));
    filas.push([
      concepto === "Percepción del IGV" ? "Percepción del IGV (a favor del Mandante)" : concepto,
      monto(propias.reduce((s, l) => s + l.montoUsd, 0)) || "",
      propias.length ? monto(propias.reduce((s, l) => s + (l.moneda === "PEN" ? l.monto : 0), 0)) : "",
      propias[0]?.documento ?? documento,
    ]);
  }
  for (const l of lineas) {
    if (usados.has(l)) continue;
    filas.push([l.concepto, monto(l.montoUsd), soles(l), l.documento]);
  }
  return filas;
}

function construir(c: Campos, ctx: ContextoExpediente): Estructura {
  const tributos = lineasDePagos(ctx, ["tributo"]);
  const gastos = lineasDePagos(ctx, ["gasto"]);
  const d = diferenciaH3(ctx.hitos.find((h) => h.tipo === "H3") ?? null, ctx.movimientos);
  const aFavor = d.diferencia >= 0;
  const filasGastos: string[][] = gastos.length
    ? gastos.map((l) => [l.concepto, l.proveedor, l.documento, `${l.moneda} ${monto(l.monto)}`, monto(l.montoUsd)])
    : [
        ["Agente de aduana", c.AGENTE_ADUANA, "Factura n.º", "", ""],
        ["Depósito temporal", "", "Factura n.º", "", ""],
        ["Visto bueno y gastos de la naviera o el consolidador", "", "Factura n.º", "", ""],
        ["Movilización y cuadrilla", "", "Factura n.º", "", ""],
        ["Homologación o ficha técnica", "", "", "", ""],
        ["Tasa registral SUNARP", "", "Recibo", "", ""],
        ["Notaría", "", "Factura n.º", "", ""],
        ["Placas", "", "Recibo", "", ""],
      ];

  return {
    titulo: "Liquidación de tributos y gastos de aduana · Liquidación definitiva",
    subtitulo: encabezadoLiquidacion(c),
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(INTRO_LIQUIDACION),

      h2("Parte 2: Liquidación definitiva"),
      p(`**DAM n.º ${c.DAM_NUMERO} del ${c.DAM_FECHA} · Canal de control: ${c.CANAL} · Levante: ${c.FECHA_LEVANTE} · Factor de conversión aplicado: ${c.FACTOR_CONVERSION} · Tipo de cambio venta SBS del día de pago: ${c.TC_SBS_PAGO}**`),

      h3("Tributos pagados a SUNAT por cuenta del Mandante"),
      tabla(["Concepto", "USD según la DAM", "S/ pagados", "Comprobante"], [
        ...filasTributos(tributos),
        ["**Total tributos**", `**${c.TOTAL_TRIBUTOS_USD}**`, `**${c.TOTAL_TRIBUTOS_PEN}**`, ""],
      ], [3, 1.6, 1.6, 2.4]),

      h3("Gastos de aduana y registrales pagados por cuenta del Mandante"),
      tabla(["Concepto", "Proveedor", "Documento a nombre del Mandante", "Moneda y monto", "USD equivalente"], [
        ...filasGastos,
        ["**Total gastos**", "", "", "", `**${c.TOTAL_GASTOS_USD}**`],
      ], [2.6, 2.2, 2.2, 1.6, 1.4]),

      h3("Comparación con lo depositado"),
      tabla(["Concepto", "USD"], [
        ["Depositado en el hito H3", c.H3_DEPOSITADO],
        ["Total pagado (tributos más gastos, en USD al tipo de cambio de cada pago)", c.H3_PAGADO],
        ["**Diferencia**", `**${aFavor ? "" : "− "}${c.H3_DIFERENCIA}**`],
      ], [4, 1.5]),
      casillas([
        `${aFavor && d.diferencia > 0 ? "[X] " : ""}Diferencia a favor del Mandante: queda en el expediente y se devuelve con la rendición de cuentas.`,
        `${!aFavor ? "[X] " : ""}Diferencia a cargo del Mandante: depositar USD ${!aFavor ? c.H3_DIFERENCIA : "______________"} en Fondos de Clientes dentro de un día hábil, concepto "${c.EXPEDIENTE} H3 diferencia".`,
      ]),
      p("Los comprobantes de pago a SUNAT quedan asociados a la DAM del Mandante y sustentan su crédito fiscal por IGV, IPM y percepción. Las facturas de los proveedores están a nombre del Mandante y se entregan en original con la carpeta del expediente."),

      firmas(["LUX CARS IMPORT S.A.C.", `${c.LUXCARS_REPRESENTANTE}, DNI ${c.LUXCARS_REP_DNI}`, `${c.CIUDAD_FIRMA}, ______________`]),
    ],
  };
}

export const liquidacionDefinitiva: Plantilla = {
  tipo: "liquidacion_definitiva",
  version: "liquidacion_definitiva@2026-11-25",
  nombre: "Liquidación definitiva de tributos",
  idioma: "es",
  tarea: "luxcars.liquidacion_definitiva",
  seFirma: false,
  construir,
};
