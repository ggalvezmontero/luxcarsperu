/**
 * Anexo B · Presupuesto estimado y calendario de pagos: cinco pagos, seis
 * hitos. Transcrito del paquete y adaptado el 27 nov 2026: sin línea de
 * transporte interno (va dentro del flete), sin gastos registrales (van dentro
 * de los honorarios), inspección solo en usados, tributos pagados directo a
 * SUNAT con la cifra de la liquidación y gastos de aduana reembolsables con su
 * saldo compensado en el Pago 5.
 */

import type { Campos } from "../../campos";
import { h2, nota, p, tabla, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

export const TEXTO_TRIBUTOS =
  "Los tributos de importación que liquide SUNAT, así como cualquier ajuste, diferencia, multa o reliquidación que la Administración Aduanera determine sobre la operación, son de cargo exclusivo del Mandante y serán asumidos por él. El Mandante los paga directamente a SUNAT con el número de liquidación que LUXCARS le comunica, dentro de los dos días hábiles del aviso; si pide que LUXCARS los pague por su cuenta, LUXCARS lo hace con los fondos del expediente y, si no alcanzan, el Mandante completa la diferencia dentro de los dos días hábiles del aviso.";

export const TEXTO_ADUANA =
  "Los gastos de aduana (Pago 3) son reembolsables: LUXCARS paga con ellos al agente de aduana, al almacén y a la grúa del puerto contra facturas a nombre del Mandante y los rinde uno por uno. El sobrante se descuenta del Pago 5 (segunda mitad de los honorarios) y el faltante se suma a ese pago; si el sobrante supera esa mitad, la diferencia se devuelve con la rendición de cuentas.";

function construir(c: Campos): Estructura {
  const usado = c.VEH_CONDICION.toLowerCase().startsWith("usado");
  const n = (i: number) => String(usado ? i + 1 : i);
  return {
    titulo: "Anexo B · Presupuesto estimado y calendario de pagos",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Anexo B del contrato de mandato del ${c.FECHA_FIRMA}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`Estimación en dólares americanos con las tasas vigentes al ${c.FECHA_FIRMA}. El precio del vehículo es el de la pro forma del Vendedor. Las cifras definitivas del flete, de los gastos de aduana y de los tributos resultan del flete real, de la pro forma del agente de aduana y de la liquidación de SUNAT. Lo que el Mandante paga a terceros no pasa por la factura de LUXCARS y se sustenta con documentos a nombre del Mandante.`),

      h2("1. Costo estimado puesto en Lima"),
      tabla(["#", "Concepto", "Base de cálculo", "USD estimado"], [
        ["1", "Precio del vehículo", `${c.MONEDA_COMPRA} ${c.PRECIO_COMPRA} según la pro forma del Vendedor, al tipo de cambio del día de la cotización`, c.PRECIO_COMPRA_USD],
        ...(usado ? [["2", "Inspección del vehículo usado", "Inspección física antes de la aprobación de la unidad", c.COSTO_INSPECCION]] : []),
        [n(2), "Flete (traslado al puerto y marítimo)", `Traslado del dealer al puerto y ${c.PROPORCION_FLETE} de un contenedor ${c.TIPO_CONTENEDOR}, ${c.PUERTO_ORIGEN} a ${c.PUERTO_DESTINO}`, c.EST_FLETE],
        [n(3), "Seguro de transporte", "0.5 % sobre el 110 % del precio del vehículo", c.EST_SEGURO],
        ["", "**Valor CIF estimado**", "Precio, flete y seguro", `**${c.EST_CIF}**`],
        [n(4), "Ad valorem", `${c.TASA_ADVALOREM} del CIF`, c.EST_ADVALOREM],
        [n(5), "Impuesto selectivo al consumo", `${c.TASA_ISC} sobre CIF más ad valorem`, c.EST_ISC],
        [n(6), "IGV e IPM", "18 % sobre CIF más ad valorem más ISC", c.EST_IGV_IPM],
        [n(7), "Percepción del IGV (adelanto a favor del Mandante)", `${c.TASA_PERCEPCION} sobre la suma de las líneas anteriores`, c.EST_PERCEPCION],
        ["", "**Tributos de importación (Pago 4, directo a SUNAT)**", "Ad valorem, ISC, IGV, IPM y percepción", `**${c.EST_TRIBUTOS}**`],
        [n(8), "Gastos de aduana (Pago 3)", "Agente de aduana, almacenaje, visto bueno y grúa del puerto, según la pro forma del agente", c.EST_GASTOS_ADUANA],
        [n(9), "Honorarios de LUXCARS, IGV incluido", `${c.TASA_COMISION} sobre el costo puesto en Lima (CIF más tributos más gastos de aduana), mínimo USD 5,000. Base ${c.COMISION_BASE} más IGV ${c.COMISION_IGV}. Incluyen la gestión registral: homologación o ficha técnica, SUNARP, placas y tarjeta`, c.COMISION_TOTAL],
        ["", "**Total estimado puesto en Lima con placas**", "Todas las líneas", `**${c.EST_TOTAL}**`],
      ], [0.6, 3, 4, 1.8]),
      p("El IGV, el IPM y la percepción son crédito fiscal del Mandante como importador, así que el costo neto para la empresa es menor que el total. El uso de ese crédito y la deducibilidad del vehículo dependen de la situación tributaria del Mandante: consultarlas con su contador."),

      h2("2. Calendario de pagos: cinco pagos, seis hitos"),
      tabla(["Pago", "Hito", "Cuándo", "Qué cubre", "USD", "A dónde"], [
        ["1", "H1", "A la firma del contrato", usado ? "Precio del vehículo e inspección del usado" : "Precio del vehículo", c.H1_MONTO, "Fondos de Clientes"],
        ["2", "H2", `Con el vehículo listo para embarcar (release), a más tardar el ${c.FECHA_LIMITE_H2}`, "Flete (traslado al puerto y marítimo) y seguro (estimado)", c.H2_MONTO, "Fondos de Clientes"],
        ["2", "H3", "Mismo momento que H2", "Primera mitad de los honorarios (50 %, fijo)", c.COMISION_MITAD, "Operaciones; la detracción al Banco de la Nación"],
        ["3", "H4", "Al arribo al Callao", "Gastos de aduana según la pro forma del agente (estimado)", c.H4_MONTO, "Fondos de Clientes"],
        ["4", "H5", "Dentro de los dos días hábiles del aviso con la liquidación de SUNAT", "Tributos de importación exactos de la liquidación, en soles (estimado)", c.H5_MONTO, "Directo a SUNAT, con Clave SOL o en ventanilla bancaria"],
        ["5", "H6", "Con el levante del vehículo", "Segunda mitad de los honorarios (50 %), menos el sobrante o más el faltante de los gastos de aduana", c.COMISION_MITAD, "Operaciones; la detracción al Banco de la Nación"],
      ], [0.7, 0.7, 3, 3, 1.5, 2.4]),
      p(TEXTO_TRIBUTOS),
      p(TEXTO_ADUANA),
      p("El saldo que quede en Fondos de Clientes después de pagar todo se devuelve con el acta de entrega y rendición de cuentas. Las comisiones bancarias de los wires al exterior las asume LUXCARS."),

      h2("3. Qué puede mover estos números"),
      tabla(["Variable", "Efecto", "Quién lo asume"], [
        [`Tipo de cambio ${c.MONEDA_COMPRA} a USD el día del pago al Vendedor`, "El Pago 1 sube o baja", "Mandante"],
        ["Factor de conversión monetaria de SUNAT en la fecha de numeración", "Cambia el valor en aduana y con él todos los tributos", "Mandante"],
        ["Tipo de cambio venta SBS el día de pago de los tributos", "Cambia los soles a pagar", "Mandante"],
        ["Flete real cobrado por el forwarder", "El Pago 2 y el CIF", "Mandante"],
        ["Pro forma y facturas del agente de aduana", "El Pago 3; el saldo se compensa en el Pago 5", "Mandante"],
        ["Ajuste de valor, reliquidación, multa o cambio de tasa", "Tributos", "Mandante"],
        ["Preferencia arancelaria acreditada con certificado de origen", "Ad valorem baja a 0 %", "A favor del Mandante"],
        ["Unidad nueva registrada por el dealer antes de exportar", "El ISC pasa de 10 % a 40 % y la unidad se trata como usada", "Se decide por escrito antes de continuar"],
        ["Impuestos del país de origen que el Vendedor no exonere", "Precio del vehículo sube", "Mandante"],
        ["Demora del Mandante en acreditar un hito o pagar los tributos", "Almacenaje, cambio de reserva, sobreestadía", "Mandante"],
      ], [3, 3, 2]),

      nota("Este anexo se firma junto con el contrato: las firmas constan al final del contrato y en cada página foliada."),
    ],
  };
}

export const anexoB: Plantilla = {
  tipo: "anexo_b",
  version: "anexo_b@2026-11-27b",
  nombre: "Anexo B · Presupuesto estimado",
  idioma: "es",
  tarea: "luxcars.presupuesto_definitivo",
  seFirma: false,
  construir,
};
