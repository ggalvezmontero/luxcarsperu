/**
 * 8 · Rendición de cuentas final y conformidad. Transcrita del paquete. Las
 * tablas se llenan con TODO el libro (`datosRendicion`): depósitos recibidos,
 * pagos por cuenta del cliente, devoluciones y honorarios. Debe cuadrar:
 * recibido − pagado − devuelto = 0.
 */

import type { Campos } from "../../campos";
import { fechaEnLetras, monto } from "../../campos";
import { datosRendicion, numeroConstancia } from "../../ledger";
import type { ContextoExpediente } from "../../tipos";
import { casillas, firmas, h2, p, tabla, type Estructura } from "../estructura";
import { firmasLuxcarsYMandante, type Plantilla } from "./tipos";

function construir(c: Campos, ctx: ContextoExpediente): Estructura {
  const r = datosRendicion(ctx);
  const recibidos = r.recibidos.length
    ? r.recibidos.map((m) => [fechaEnLetras(m.fecha), m.hito ?? "—", `${c.EXPEDIENTE}-${numeroConstancia(m, ctx.movimientos)}`, monto(m.montoUsd)])
    : [["", "H2", "", ""], ["", "H3", "", ""], ["", "Diferencias", "", ""]];
  const pagos = r.pagos.length
    ? r.pagos.map((l) => [fechaEnLetras(l.fecha), l.concepto, l.proveedor, l.documento, `${l.moneda} ${monto(l.monto)}`, l.moneda === "USD" ? "1" : String(l.tipoCambio), monto(l.montoUsd)])
    : [
        ["", "Precio del vehículo", c.VENDEDOR_NOMBRE, "Bill of sale n.º ___, SWIFT n.º ___", c.MONEDA_COMPRA, "", ""],
        ["", "Transporte interno en origen", c.FORWARDER_NOMBRE, "Factura n.º", "", "", ""],
        ["", `Flete marítimo y gastos del contenedor (${c.PROPORCION_FLETE})`, c.FORWARDER_NOMBRE, "Factura n.º, house BL n.º", "", "", ""],
        ["", "Seguro de transporte", "", "Póliza n.º", "", "", ""],
        ["", "Tributos de importación (ad valorem, ISC, IGV, IPM, percepción)", "SUNAT", `DAM ${c.DAM_NUMERO}, liquidación de cobranza`, "PEN", c.TC_SBS_PAGO, ""],
        ["", "Agente de aduana", c.AGENTE_ADUANA, "Factura n.º", "", "", ""],
        ["", "Depósito temporal", "", "Factura n.º", "", "", ""],
        ["", "Visto bueno y gastos en destino", "", "Factura n.º", "", "", ""],
        ["", "Homologación o ficha técnica", "", "", "", "", ""],
        ["", "Tasa registral SUNARP", "SUNARP", "Recibo", "", "", ""],
        ["", "Notaría", "", "Factura n.º", "", "", ""],
        ["", "Placas", "", "Recibo", "", "", ""],
        ["", "Otros autorizados por el Mandante", "", "", "", "", ""],
      ];
  const [f1, f2] = [r.honorarios.find((m) => m.hito === "H1"), r.honorarios.find((m) => m.hito === "H4")];
  const saldoACargo = r.saldo < 0;

  return {
    titulo: "Rendición de cuentas final y conformidad",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Contrato de mandato del ${c.FECHA_FIRMA} · Fecha de la rendición: ${c.FECHA_RENDICION}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p("Resumen de todo lo recibido del Mandante y de todo lo pagado por su cuenta, con el saldo del expediente y su devolución. Los comprobantes están en la carpeta del expediente. Conforme a la cláusula vigésima del contrato, la rendición se entiende aprobada si el Mandante no la observa por escrito dentro de los diez días hábiles siguientes."),

      h2("1. Fondos recibidos en la cuenta Fondos de Clientes"),
      tabla(["Fecha", "Hito", "Constancia n.º", "USD"], [
        ...recibidos,
        ["", "**Total recibido**", "", `**${c.TOTAL_RECIBIDO}**`],
      ], [2.2, 1.2, 2.4, 1.6]),

      h2("2. Pagos realizados por cuenta del Mandante"),
      tabla(["Fecha", "Concepto", "Beneficiario", "Documento a nombre del Mandante", "Moneda y monto", "Tipo de cambio", "USD"], [
        ...pagos,
        ["", "**Total pagado**", "", "", "", "", `**${c.TOTAL_PAGADO}**`],
      ], [1.6, 2.6, 2, 2.4, 1.6, 1.1, 1.5]),

      h2("3. Saldo y devolución"),
      tabla(["Concepto", "USD"], [
        ["Total recibido (sección 1)", c.TOTAL_RECIBIDO],
        ["Total pagado (sección 2)", c.TOTAL_PAGADO],
        [saldoACargo ? "**Saldo a cargo del Mandante**" : "**Saldo a favor del Mandante**", `**${c.SALDO_RENDICION}**`],
        [`Devuelto el ${c.DEVOLUCION_FECHA} a la cuenta ${c.CLIENTE_BANCO_ORIGEN}, operación n.º ${c.NUMERO_OPERACION}`, c.DEVOLUCION_MONTO],
      ], [4, 1.5]),
      p(saldoACargo
        ? `El saldo resulta a cargo del Mandante: USD ${monto(Math.abs(r.saldo))}, a depositar en Fondos de Clientes con el concepto "${c.EXPEDIENTE} saldo". Fecha en que lo depositó: ______________.`
        : "Si el saldo resultara a cargo del Mandante, se indica aquí el monto y la fecha en que lo depositó: ______________."),

      h2("4. Honorarios de LUXCARS (facturados aparte; no salen de Fondos de Clientes)"),
      tabla(["Factura", "Fecha", "Base imponible USD", "IGV USD", "Total USD", "Detracción depositada (constancia n.º)", "Abonado a Operaciones USD"], [
        ["Factura 1 (H1)", f1 ? fechaEnLetras(f1.fecha) : "", "", "", c.COMISION_H1, "", f1 ? monto(f1.montoUsd) : ""],
        ["Factura 2 (H4)", f2 ? fechaEnLetras(f2.fecha) : "", "", "", c.COMISION_H4, "", f2 ? monto(f2.montoUsd) : ""],
        ["**Total honorarios**", "", c.COMISION_BASE, c.COMISION_IGV, `**${c.COMISION_TOTAL}**`, "", r.totalHonorarios > 0 ? `**${monto(r.totalHonorarios)}**` : ""],
      ], [1.8, 1.8, 1.6, 1.3, 1.5, 2.2, 1.8]),

      h2("5. Costo total de la operación para el Mandante"),
      tabla(["Concepto", "USD"], [
        ["Pagos a terceros (sección 2)", c.TOTAL_PAGADO],
        ["Honorarios de LUXCARS (sección 4)", c.COMISION_TOTAL],
        ["**Total pagado por el Mandante**", `**${c.TOTAL_OPERACION}**`],
        ["Estimado del Anexo B", c.EST_TOTAL],
        ["Diferencia y explicación (tipo de cambio, flete real, ajustes de SUNAT)", c.DIFERENCIA_ESTIMADO],
        ["De ese total, crédito fiscal del Mandante (IGV, IPM y percepción según la DAM)", c.CREDITO_FISCAL],
      ], [4, 1.5]),

      h2("6. Carpeta entregada"),
      casillas([
        "Contrato de mandato y anexos A, B, C y D",
        "Informe de inspección con fotos",
        "Bill of sale y comprobante del pago al vendedor",
        "Documento de propiedad del exterior con la transferencia",
        "Certificado de origen (si se usó)",
        "House BL, lista de empaque, acta de carga y declaración de exportación",
        "Póliza de seguro",
        "DAM con levante, liquidación y comprobantes de pago a SUNAT",
        "Facturas de terceros a nombre del Mandante",
        "Constancia de homologación o ficha técnica",
        "Tarjeta de identificación vehicular y placas",
        "Facturas de honorarios y constancias de detracción",
        "Constancias de recepción de fondos y comprobante de devolución del saldo",
        "Acta de entrega",
      ]),

      h2("7. Conformidad"),
      p(`El Mandante aprueba esta rendición de cuentas, declara haber recibido el saldo indicado y la carpeta completa, y da por cumplido el mandato del ${c.FECHA_FIRMA}, sin reclamo pendiente salvo los que se anotan aquí: ______________________________________________.`),
      p(`${c.CIUDAD_FIRMA}, ${c.FECHA_RENDICION}`),
      firmas(...firmasLuxcarsYMandante(c, true)),
    ],
  };
}

export const rendicion: Plantilla = {
  tipo: "rendicion",
  version: "rendicion@2026-11-25",
  nombre: "Rendición de cuentas",
  idioma: "es",
  tarea: "luxcars.rendicion",
  seFirma: true,
  construir,
};
