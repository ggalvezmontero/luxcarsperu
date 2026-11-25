/** Anexo B · Presupuesto estimado y calendario de pagos. Transcrito del paquete. */

import type { Campos } from "../../campos";
import { firmas, h2, p, tabla, type Estructura } from "../estructura";
import { firmasLuxcarsYMandante, type Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  return {
    titulo: "Anexo B · Presupuesto estimado y calendario de pagos",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Anexo B del contrato de mandato del ${c.FECHA_FIRMA}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`Estimación en dólares americanos con las tasas vigentes al ${c.FECHA_FIRMA}. Las cifras definitivas resultan de la factura del vendedor, del flete real y de la liquidación de SUNAT al tipo de cambio de la fecha de pago. Lo que el Mandante paga a terceros (líneas 1 a 10) no pasa por la factura de LUXCARS y se sustenta con documentos a nombre del Mandante.`),

      h2("1. Costo estimado puesto en Lima"),
      tabla(["#", "Concepto", "Base de cálculo", "USD estimado"], [
        ["1", "Precio del vehículo", `${c.MONEDA_COMPRA} ${c.PRECIO_COMPRA} al tipo de cambio del día de la cotización`, c.PRECIO_COMPRA_USD],
        ["2", "Transporte interno en origen", "Del vendedor al almacén del forwarder", c.EST_INLAND],
        ["3", "Flete marítimo y gastos del contenedor", `${c.PROPORCION_FLETE} de un contenedor ${c.TIPO_CONTENEDOR}, ${c.PUERTO_ORIGEN} a ${c.PUERTO_DESTINO}`, c.EST_FLETE],
        ["4", "Seguro de transporte", "0.5 % sobre el 110 % del precio del vehículo", c.EST_SEGURO],
        ["", "**Valor CIF estimado**", "Líneas 1 a 4", `**${c.EST_CIF}**`],
        ["5", "Ad valorem", `${c.TASA_ADVALOREM} del CIF`, c.EST_ADVALOREM],
        ["6", "Impuesto selectivo al consumo", `${c.TASA_ISC} sobre CIF más ad valorem`, c.EST_ISC],
        ["7", "IGV e IPM", "18 % sobre CIF más ad valorem más ISC", c.EST_IGV_IPM],
        ["8", "Percepción del IGV (adelanto a favor del Mandante)", `${c.TASA_PERCEPCION} sobre la suma de las líneas anteriores`, c.EST_PERCEPCION],
        ["", "**Tributos de importación**", "Líneas 5 a 8", `**${c.EST_TRIBUTOS}**`],
        ["9", "Gastos de aduana", "Agente de aduana, depósito temporal, visto bueno, movilización, homologación o ficha técnica", c.EST_GASTOS_ADUANA],
        ["10", "Gastos registrales", "Tasa SUNARP, notaría, placas", c.EST_GASTOS_REGISTRALES],
        ["11", "Honorarios de LUXCARS, IGV incluido", `${c.TASA_COMISION} sobre el costo puesto en Lima (CIF más tributos más gastos de aduana), mínimo USD 5,000. Base ${c.COMISION_BASE} más IGV ${c.COMISION_IGV}`, c.COMISION_TOTAL],
        ["", "**Total estimado puesto en Lima con placas**", "Líneas 1 a 11", `**${c.EST_TOTAL}**`],
      ], [0.6, 3, 4, 1.8]),
      p("El IGV y el IPM de la línea 7 y la percepción de la línea 8 son crédito fiscal del Mandante como importador, así que el costo neto para la empresa es menor que el total. El uso de ese crédito y la deducibilidad del vehículo dependen de la situación tributaria del Mandante: consultarlas con su contador."),

      h2("2. Calendario de pagos"),
      tabla(["Hito", "Cuándo", "Qué cubre", "USD", "Cuenta de destino"], [
        ["H1", "Firma del Anexo A", "30 % de los honorarios (fijo)", c.COMISION_H1, "Operaciones; la detracción al Banco de la Nación"],
        ["H2", `Inspección aprobada, a más tardar el ${c.FECHA_LIMITE_H2}`, "Líneas 1 a 4 (estimado)", c.H2_MONTO, "Fondos de Clientes"],
        ["H3", "Antes del arribo, dentro de un día hábil del aviso de pago", `Líneas 5 a 10 más un margen del ${c.MARGEN_H3} % por tipo de cambio (estimado)`, c.H3_MONTO, "Fondos de Clientes"],
        ["H4", "Entrega del vehículo con placas", "70 % de los honorarios (fijo)", c.COMISION_H4, "Operaciones; la detracción al Banco de la Nación"],
      ], [0.8, 3, 3, 1.6, 2.6]),
      p("El saldo que quede en el expediente después de pagar todo se devuelve con la rendición de cuentas. Si falta, se deposita la diferencia dentro de un día hábil de comunicada."),

      h2("3. Qué puede mover estos números"),
      tabla(["Variable", "Efecto", "Quién lo asume"], [
        [`Tipo de cambio ${c.MONEDA_COMPRA} a USD el día del pago al vendedor`, "H2 sube o baja", "Mandante"],
        ["Factor de conversión monetaria de SUNAT en la fecha de numeración", "Cambia el valor en aduana y con él todos los tributos", "Mandante"],
        ["Tipo de cambio venta SBS el día de pago de los tributos", "Cambia los soles a pagar", "Mandante"],
        ["Flete real cobrado por el forwarder", "Línea 3 y el CIF", "Mandante"],
        ["Ajuste de valor en aduana o cambio de tasa", "Tributos", "Mandante"],
        ["Preferencia arancelaria acreditada con certificado de origen", "Ad valorem baja a 0 %", "A favor del Mandante"],
        ["Unidad nueva registrada por el vendedor antes de exportar", "El ISC pasa de 10 % a 40 % y la unidad se trata como usada", "Se decide por escrito antes de continuar"],
        ["Impuestos del país de origen que el vendedor no exonere", "Precio del vehículo sube", "Mandante"],
        ["Demora del Mandante en acreditar un hito", "Almacenaje, cambio de reserva, sobreestadía", "Mandante"],
      ], [3, 3, 2]),

      p(`${c.CIUDAD_FIRMA}, ${c.FECHA_FIRMA}`),
      firmas(...firmasLuxcarsYMandante(c)),
    ],
  };
}

export const anexoB: Plantilla = {
  tipo: "anexo_b",
  version: "anexo_b@2026-11-25",
  nombre: "Anexo B · Presupuesto estimado",
  idioma: "es",
  tarea: "luxcars.anexo_a_presupuesto",
  seFirma: false,
  construir,
};
