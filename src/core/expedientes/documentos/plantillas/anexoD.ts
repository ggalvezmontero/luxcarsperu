/** Anexo D · Instrucciones de pago. Transcrito del paquete. */

import type { Campos } from "../../campos";
import { firmas, h2, numerada, p, tabla, type Estructura } from "../estructura";
import { firmasLuxcarsYMandante, type Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  return {
    titulo: "Anexo D · Instrucciones de pago",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Anexo D del contrato de mandato del ${c.FECHA_FIRMA}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`Tres cuentas, una por tipo de pago. Todas a nombre de **Lux Cars Import S.A.C.**, RUC ${c.LUXCARS_RUC}. Toda transferencia lleva el código **${c.EXPEDIENTE}** y el hito en el concepto.`),

      h2("1. A dónde va cada pago"),
      tabla(["Qué paga", "Cuenta", "Banco", "Número", "CCI", "Moneda", "Concepto a escribir"], [
        ["Honorarios H1 y H4, parte no sujeta a detracción", "Operaciones", c.CTA_OPER_BANCO, c.CTA_OPER_NUMERO, c.CTA_OPER_CCI, "USD", `${c.EXPEDIENTE} H1 (o H4)`],
        [`Detracción de cada factura de honorarios (${c.PORCENTAJE_DETRACCION} %)`, "Detracciones", "Banco de la Nación", c.CTA_DETRACCION_NUMERO, "No aplica", "PEN", "Número de la factura y código del servicio que indique la factura"],
        ["Precio del vehículo, transporte interno, flete y seguro (H2)", "Fondos de Clientes", c.CTA_FONDOS_BANCO, c.CTA_FONDOS_NUMERO, c.CTA_FONDOS_CCI, "USD", `${c.EXPEDIENTE} H2`],
        ["Tributos de importación, gastos de aduana y registrales (H3)", "Fondos de Clientes", c.CTA_FONDOS_BANCO, c.CTA_FONDOS_NUMERO, c.CTA_FONDOS_CCI, "USD", `${c.EXPEDIENTE} H3`],
      ], [2.2, 1.4, 1.3, 2, 2.4, 1, 2.1]),

      h2("2. Reglas"),
      numerada([
        `Las transferencias salen de una cuenta a nombre de ${c.CLIENTE_RAZON_SOCIAL}. No se aceptan depósitos en efectivo ni transferencias de terceros; si llegan, se devuelven.`,
        `Sin el código ${c.EXPEDIENTE} en el concepto la transferencia no se aplica hasta identificarla; si no se identifica en dos días hábiles, se devuelve.`,
        "Por cada depósito acreditado en Fondos de Clientes, LUXCARS envía una constancia de recepción dentro de un día hábil, con el saldo del expediente.",
        "Los montos se pactan en dólares americanos. Un pago en soles se convierte al tipo de cambio venta publicado por la SBS el día del abono. Para montos altos conviene usar ventanilla o transferencia interbancaria inmediata: las aplicaciones móviles suelen tener topes diarios.",
        `La detracción la deposita el Mandante en el Banco de la Nación dentro del plazo legal y envía la constancia a ${c.LUXCARS_CORREO}. [CONFIRMAR con el contador el porcentaje y el código de servicio]`,
        "Para H1 y H4 se acepta también cheque de gerencia no negociable a nombre de Lux Cars Import S.A.C.",
        "Si el Mandante opta por pagar directamente al vendedor o a SUNAT (cláusula 5.6 del contrato), lo coordina antes con LUXCARS, usa las instrucciones bancarias que LUXCARS le entregue por escrito y envía el comprobante el mismo día.",
      ]),

      h2("3. Aviso contra fraude"),
      p(`LUXCARS nunca cambia sus cuentas por correo, WhatsApp ni llamada. Un cambio de cuenta solo es válido con un documento firmado por el representante de LUXCARS y una llamada del Mandante al ${c.LUXCARS_TELEFONO} para confirmarlo. Si recibe una instrucción de pago distinta a este anexo, no la atienda y llame a ese número.`),

      h2("4. Confirmación"),
      p("El Mandante declara haber recibido este anexo en papel y haber confirmado por teléfono, el ______________, que las cuentas coinciden con las que LUXCARS le indicó verbalmente."),
      firmas(...firmasLuxcarsYMandante(c)),
    ],
  };
}

export const anexoD: Plantilla = {
  tipo: "anexo_d",
  version: "anexo_d@2026-11-25",
  nombre: "Anexo D · Instrucciones de pago",
  idioma: "es",
  tarea: "luxcars.generar_contrato",
  seFirma: true,
  construir,
};
