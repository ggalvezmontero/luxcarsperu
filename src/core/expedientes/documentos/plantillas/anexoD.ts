/**
 * Anexo D · Instrucciones de pago (27 nov 2026): una sola cuenta para todos los
 * pagos del Mandante a LUXCARS (Fondos de Clientes), el Pago 4 directo a SUNAT
 * y la autodetracción por defecto. El calendario es la misma tabla de cinco
 * filas del contrato. Sin códigos internos ni cuentas internas.
 */

import type { Campos } from "../../campos";
import { h2, nota, numerada, p, tabla, type Estructura } from "../estructura";
import { tablaCalendario } from "./calendario";
import type { Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  const usado = c.VEH_CONDICION.toLowerCase().startsWith("usado");
  return {
    titulo: "Anexo D · Instrucciones de pago",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Anexo D del contrato de mandato del ${c.FECHA_FIRMA}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`El Mandante hace cinco pagos. Los Pagos 1, 2, 3 y 5 van a una sola cuenta de LUXCARS, la cuenta Fondos de Clientes. El Pago 4 son los tributos y se paga directo a SUNAT.`),

      h2("1. Los cinco pagos"),
      tablaCalendario(c, { usado }),

      h2("2. La cuenta para los Pagos 1, 2, 3 y 5"),
      tabla(["Dato", "Detalle"], [
        ["Titular", `**Lux Cars Import S.A.C.**, RUC ${c.LUXCARS_RUC}`],
        ["Cuenta", "Fondos de Clientes"],
        ["Banco", c.CTA_FONDOS_BANCO],
        ["Número de cuenta", c.CTA_FONDOS_NUMERO],
        ["CCI", c.CTA_FONDOS_CCI],
        ["Moneda", "Dólares americanos (USD)"],
        ["Concepto a escribir", `${c.EXPEDIENTE} y el número de pago, por ejemplo "${c.EXPEDIENTE} Pago 2"`],
      ], [2, 6]),

      h2("3. El Pago 4, directo a SUNAT"),
      p("Cuando SUNAT calcula los tributos, LUXCARS envía el aviso con el número de liquidación y el monto exacto en soles. El Mandante paga dentro de los dos días hábiles del aviso, con su Clave SOL en SUNAT Operaciones en Línea o en la ventanilla de un banco autorizado, con ese número de liquidación. Luego avisa en su cuenta del portal con «Ya pagué» y el comprobante. Este pago no pasa por las cuentas de LUXCARS."),

      h2("4. Reglas"),
      numerada([
        `Las transferencias salen de una cuenta a nombre de ${c.CLIENTE_RAZON_SOCIAL.replace(/\.+$/, "")}. No se aceptan depósitos en efectivo ni transferencias de terceros; si llegan, se devuelven.`,
        `Sin el código ${c.EXPEDIENTE} en el concepto la transferencia no se aplica hasta identificarla; si no se identifica en dos días hábiles, se devuelve.`,
        "Por cada depósito acreditado, LUXCARS envía una constancia de recepción dentro de un día hábil, con el saldo del expediente. El Pago 4 no lleva constancia de LUXCARS: el comprobante es el de SUNAT o el del banco.",
        "Los montos se pactan en dólares americanos. Un pago en soles se convierte al tipo de cambio venta publicado por la SBS el día del abono. Para montos altos conviene usar ventanilla o transferencia interbancaria inmediata: las aplicaciones móviles suelen tener topes diarios.",
        `Detracción. Si el Mandante es una empresa, cada factura de honorarios lleva detracción del ${c.PORCENTAJE_DETRACCION} %. El Mandante no tiene que hacer nada: paga el importe completo dentro de su Pago 2 y su Pago 5, y LUXCARS deposita la detracción en el Banco de la Nación dentro de los cinco días hábiles y le envía la constancia. Si prefiere detraer él mismo, deposita la detracción en la cuenta de detracciones de LUXCARS en el Banco de la Nación n.º ${c.CTA_DETRACCION_NUMERO}, la descuenta de su pago y envía la constancia a ${c.LUXCARS_CORREO} (cláusula 5.3 del contrato). [CONFIRMAR con el contador el porcentaje y el código de servicio]`,
        "Para los Pagos 2 y 5 se acepta también cheque de gerencia no negociable a nombre de Lux Cars Import S.A.C.",
        `Si el Mandante pide que LUXCARS pague los tributos por su cuenta (cláusula 6.6 del contrato), deposita antes su importe en la cuenta Fondos de Clientes con el concepto "${c.EXPEDIENTE} Pago 4".`,
        "La comisión que el banco cobre por una transferencia al exterior la repone LUXCARS el mismo día: el saldo del Mandante no cambia.",
      ]),

      h2("5. Aviso contra fraude"),
      p(`LUXCARS nunca cambia sus cuentas por correo, WhatsApp ni llamada. Un cambio de cuenta solo es válido con un documento firmado por el representante de LUXCARS y una llamada del Mandante al ${c.LUXCARS_TELEFONO} para confirmarlo. Si recibe una instrucción de pago distinta a este anexo, no la atienda y llame a ese número.`),

      h2("6. Confirmación"),
      p("El Mandante declara haber recibido este anexo en papel y haber confirmado por teléfono, antes de su primer depósito, que la cuenta coincide con la que LUXCARS le indicó verbalmente. La confirmación queda registrada con fecha y hora en su cuenta del portal de LUXCARS."),
      nota("Este anexo se firma junto con el contrato: las firmas constan al final del contrato y en cada página foliada."),
    ],
  };
}

export const anexoD: Plantilla = {
  tipo: "anexo_d",
  version: "anexo_d@2026-11-27d",
  nombre: "Anexo D · Instrucciones de pago",
  idioma: "es",
  tarea: "luxcars.generar_contrato",
  seFirma: false,
  construir,
};
