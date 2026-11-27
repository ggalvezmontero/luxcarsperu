/** Anexo D · Instrucciones de pago: tres pagos, cinco hitos, una cuenta por hito. Transcrito del paquete y adaptado el 27 nov 2026. */

import type { Campos } from "../../campos";
import { h2, nota, numerada, p, tabla, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  return {
    titulo: "Anexo D · Instrucciones de pago",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Anexo D del contrato de mandato del ${c.FECHA_FIRMA}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`Cinco pagos, seis hitos y una cuenta por hito. Las cuentas de LUXCARS están a nombre de **Lux Cars Import S.A.C.**, RUC ${c.LUXCARS_RUC}. Toda transferencia lleva el código **${c.EXPEDIENTE}** y el hito en el concepto. Los tributos (Pago 4) no pasan por LUXCARS: el Mandante los paga directamente a SUNAT.`),

      h2("1. A dónde va cada pago"),
      tabla(["Pago", "Qué paga", "Cuenta", "Banco", "Número", "CCI", "Moneda", "Concepto a escribir"], [
        ["1", "H1 · Precio del vehículo (a la firma)", "Fondos de Clientes", c.CTA_FONDOS_BANCO, c.CTA_FONDOS_NUMERO, c.CTA_FONDOS_CCI, "USD", `${c.EXPEDIENTE} H1`],
        ["2", "H2 · Flete y seguro (con el auto listo para embarcar)", "Fondos de Clientes", c.CTA_FONDOS_BANCO, c.CTA_FONDOS_NUMERO, c.CTA_FONDOS_CCI, "USD", `${c.EXPEDIENTE} H2`],
        ["2", "H3 · Primera mitad de honorarios, parte no sujeta a detracción", "Operaciones", c.CTA_OPER_BANCO, c.CTA_OPER_NUMERO, c.CTA_OPER_CCI, "USD", `${c.EXPEDIENTE} H3`],
        ["3", "H4 · Gastos de aduana según la pro forma del agente (al arribo)", "Fondos de Clientes", c.CTA_FONDOS_BANCO, c.CTA_FONDOS_NUMERO, c.CTA_FONDOS_CCI, "USD", `${c.EXPEDIENTE} H4`],
        ["4", "H5 · Tributos de importación según la liquidación de SUNAT", "Directo a SUNAT", "SUNAT Operaciones en Línea (Clave SOL) o ventanilla bancaria", "Número de liquidación del aviso", "No aplica", "PEN", "Número de liquidación"],
        ["5", "H6 · Segunda mitad de honorarios, neta del saldo de aduana, parte no sujeta a detracción (con el levante)", "Operaciones", c.CTA_OPER_BANCO, c.CTA_OPER_NUMERO, c.CTA_OPER_CCI, "USD", `${c.EXPEDIENTE} H6`],
        ["2 y 5", `Detracción de cada factura de honorarios (${c.PORCENTAJE_DETRACCION} %)`, "Detracciones", "Banco de la Nación", c.CTA_DETRACCION_NUMERO, "No aplica", "PEN", "Número de la factura y código del servicio que indique la factura"],
      ], [0.7, 2.6, 1.4, 1.4, 1.8, 2.2, 0.9, 1.8]),

      h2("2. Reglas"),
      numerada([
        `Las transferencias salen de una cuenta a nombre de ${c.CLIENTE_RAZON_SOCIAL}. No se aceptan depósitos en efectivo ni transferencias de terceros; si llegan, se devuelven.`,
        `Sin el código ${c.EXPEDIENTE} en el concepto la transferencia no se aplica hasta identificarla; si no se identifica en dos días hábiles, se devuelve.`,
        "Por cada depósito acreditado en Fondos de Clientes, LUXCARS envía una constancia de recepción dentro de un día hábil, con el saldo del expediente. El pago directo de tributos a SUNAT no lleva constancia de LUXCARS: el comprobante es el de SUNAT o el del banco, que el Mandante sube a su cuenta en el portal.",
        "Los montos se pactan en dólares americanos. Un pago en soles se convierte al tipo de cambio venta publicado por la SBS el día del abono. Para montos altos conviene usar ventanilla o transferencia interbancaria inmediata: las aplicaciones móviles suelen tener topes diarios.",
        `La detracción la deposita el Mandante en el Banco de la Nación dentro del plazo legal y envía la constancia a ${c.LUXCARS_CORREO}. Si el Mandante prefiere transferir el total de la factura a la cuenta de Operaciones, LUXCARS deposita la detracción en su propia cuenta del Banco de la Nación dentro de los cinco días hábiles siguientes y le envía la constancia (cláusula 4.3 del contrato). [CONFIRMAR con el contador el porcentaje y el código de servicio]`,
        "Para H3 y H6 se acepta también cheque de gerencia no negociable a nombre de Lux Cars Import S.A.C.",
        "Si el Mandante pide que LUXCARS pague los tributos por su cuenta (cláusula 5.6 del contrato), deposita antes su importe en Fondos de Clientes con el concepto del expediente y «H5».",
        "La comisión que el banco debite de Fondos de Clientes por un wire al exterior la repone LUXCARS el mismo día: el saldo del Mandante no cambia.",
      ]),

      h2("3. Aviso contra fraude"),
      p(`LUXCARS nunca cambia sus cuentas por correo, WhatsApp ni llamada. Un cambio de cuenta solo es válido con un documento firmado por el representante de LUXCARS y una llamada del Mandante al ${c.LUXCARS_TELEFONO} para confirmarlo. Si recibe una instrucción de pago distinta a este anexo, no la atienda y llame a ese número.`),

      h2("4. Confirmación"),
      p("El Mandante declara haber recibido este anexo en papel y haber confirmado por teléfono, antes de su primer depósito, que las cuentas coinciden con las que LUXCARS le indicó verbalmente. La confirmación queda registrada con fecha y hora en su cuenta del portal de LUXCARS."),
      nota("Este anexo se firma junto con el contrato: las firmas constan al final del contrato y en cada página foliada."),
    ],
  };
}

export const anexoD: Plantilla = {
  tipo: "anexo_d",
  version: "anexo_d@2026-11-27c",
  nombre: "Anexo D · Instrucciones de pago",
  idioma: "es",
  tarea: "luxcars.generar_contrato",
  seFirma: false,
  construir,
};
