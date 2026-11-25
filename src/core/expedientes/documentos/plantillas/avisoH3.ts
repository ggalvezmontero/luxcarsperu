/**
 * 6 · Liquidación de tributos, parte 1: aviso de pago estimado del hito H3.
 * Transcrito del paquete. Los montos salen del presupuesto RECALCULADO con
 * los datos reales que ya se conocen (`datosAvisoH3`), no del Anexo B.
 */

import type { Campos } from "../../campos";
import { firmas, h2, p, tabla, vinetas, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

export function encabezadoLiquidacion(c: Campos): string {
  return `**Expediente ${c.EXPEDIENTE} · Vehículo ${c.VEH_MARCA} ${c.VEH_MODELO} ${c.VEH_ANIO}, VIN ${c.VEH_VIN} · Importador: ${c.CLIENTE_RAZON_SOCIAL}, RUC ${c.CLIENTE_RUC}**`;
}

export const INTRO_LIQUIDACION =
  "Este documento tiene dos partes. La primera se envía antes del arribo y fija el depósito del hito H3 en dólares. La segunda se emite después del levante con lo que SUNAT liquidó y lo que se pagó en soles al tipo de cambio del día de pago. Los tributos y los gastos son del Mandante como importador; LUXCARS los paga por su cuenta, a través del agente de aduana, con los fondos depositados (cláusula octava del contrato).";

function construir(c: Campos): Estructura {
  return {
    titulo: "Liquidación de tributos y gastos de aduana · Aviso de pago H3",
    subtitulo: encabezadoLiquidacion(c),
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(INTRO_LIQUIDACION),

      h2("Parte 1: Aviso de pago estimado del hito H3"),
      p(`**Fecha del aviso: ${c.FECHA_AVISO} · Arribo estimado: ${c.FECHA_EST_ARRIBO} · Depósito a más tardar: ${c.FECHA_LIMITE_H3}**`),
      tabla(["Concepto", "Base de cálculo", "USD estimado"], [
        ["Valor FOB", `Factura del vendedor (${c.MONEDA_COMPRA} ${c.PRECIO_COMPRA}) más transporte interno, convertidos con el factor de conversión referencial`, c.PRECIO_COMPRA_USD],
        ["Transporte interno en origen", "Del vendedor al almacén del forwarder", c.EST_INLAND],
        ["Flete", `Según el documento de transporte, ${c.PROPORCION_FLETE} del contenedor`, c.EST_FLETE],
        ["Seguro", "Según la póliza", c.EST_SEGURO],
        ["**Valor CIF estimado**", "", `**${c.EST_CIF}**`],
        ["Ad valorem", `${c.TASA_ADVALOREM} del CIF`, c.EST_ADVALOREM],
        ["Impuesto selectivo al consumo", `${c.TASA_ISC} sobre CIF más ad valorem`, c.EST_ISC],
        ["IGV e IPM", "18 % sobre CIF más ad valorem más ISC", c.EST_IGV_IPM],
        ["Percepción del IGV", `${c.TASA_PERCEPCION} sobre la suma anterior`, c.EST_PERCEPCION],
        ["**Tributos estimados**", "", `**${c.EST_TRIBUTOS}**`],
        ["Gastos de aduana", "Agente de aduana, depósito temporal, visto bueno, movilización, homologación o ficha técnica", c.EST_GASTOS_ADUANA],
        ["Gastos registrales", "Tasa SUNARP, notaría, placas", c.EST_GASTOS_REGISTRALES],
        ["**Subtotal**", "", `**${c.H3_SUBTOTAL}**`],
        ["Margen por tipo de cambio", `${c.MARGEN_H3} % del subtotal`, c.H3_MARGEN_MONTO],
        ["**Monto a depositar (H3)**", `Cuenta Fondos de Clientes · ${c.CTA_FONDOS_BANCO} ${c.CTA_FONDOS_NUMERO} · CCI ${c.CTA_FONDOS_CCI} · concepto "${c.EXPEDIENTE} H3"`, `**USD ${c.H3_MONTO}**`],
        ["Equivalente referencial en soles", `Al tipo de cambio ${c.TC_REFERENCIAL}`, `S/ ${c.H3_SOLES}`],
      ], [2.4, 4, 1.6]),
      p("Notas del aviso:"),
      vinetas([
        "El monto en soles que se pague a SUNAT se fija el día del pago con el tipo de cambio venta publicado por la SBS, no con el referencial de esta tabla.",
        "Si la factura del vendedor no está en dólares americanos, SUNAT la convierte con su factor de conversión monetaria vigente a la fecha de numeración de la DAM, que puede diferir del tipo de cambio al que se pagó al vendedor.",
        "La DAM se numera en despacho anticipado, antes del arribo, para evitar almacenaje. Por eso el depósito se pide antes de que llegue la nave.",
        "La percepción es un adelanto de IGV a favor del Mandante, no un costo.",
        "La parte 2 (liquidación definitiva) se emite después del levante y compara lo depositado con lo que SUNAT liquidó; la diferencia se cobra o se acredita en la rendición.",
      ]),

      firmas(["LUX CARS IMPORT S.A.C.", `${c.LUXCARS_REPRESENTANTE}, DNI ${c.LUXCARS_REP_DNI}`, `${c.CIUDAD_FIRMA}, ${c.FECHA_AVISO}`]),
    ],
  };
}

export const avisoH3: Plantilla = {
  tipo: "aviso_h3",
  version: "aviso_h3@2026-11-25",
  nombre: "Aviso de pago H3 (estimado)",
  idioma: "es",
  tarea: "luxcars.aviso_h3",
  seFirma: false,
  construir,
};
