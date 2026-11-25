/**
 * 5 · Constancia de recepción de fondos. Transcrita del paquete. Los campos
 * del depósito (fecha, monto, hito, saldos, correlativo) los arma el libro
 * (`datosConstancia`); el "destino previsto de los fondos" sale del
 * presupuesto del expediente según el hito.
 */

import type { Campos } from "../../campos";
import { fechaEnLetras, monto } from "../../campos";
import type { ContextoExpediente, TipoHito } from "../../tipos";
import { firmas, h2, p, tabla, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

/** Filas de "destino previsto" para el hito, desde el presupuesto guardado y las contrapartes. */
function destinos(c: Campos, ctx: ContextoExpediente): string[][] {
  const pre = ctx.expediente.presupuesto;
  const terceros = ctx.contrapartes ?? [];
  const nombre = (id: string | null | undefined, fallback: string) => (id ? terceros.find((t) => t.id === id)?.nombre ?? fallback : fallback);
  const hito = (c.HITO || "") as TipoHito | "";
  if (!pre) return [["", "", "", ""]];
  const e = ctx.expediente;
  if (hito === "H2") {
    const vendedor = nombre(e.reservado?.vendedorId, "Vendedor del vehículo");
    const forwarder = nombre(ctx.embarque?.forwarderId, "Forwarder");
    return [
      ["Precio del vehículo", vendedor, monto(pre.precioUsd), fechaEnLetras(e.fechaRelease ?? ctx.embarque?.fechaReleaseEst) || "Al confirmar el depósito"],
      ["Transporte interno en origen", forwarder, monto(pre.inland), fechaEnLetras(e.fechaRelease ?? ctx.embarque?.fechaReleaseEst) || "Antes del embarque"],
      ["Flete marítimo y gastos del contenedor", forwarder, monto(pre.flete), fechaEnLetras(e.fechaEstEmbarque ?? ctx.embarque?.fechaZarpeEst) || "Al embarcar"],
      ["Seguro de transporte", nombre(ctx.embarque?.aseguradoraId, "Aseguradora"), monto(pre.seguro), fechaEnLetras(e.fechaEstEmbarque ?? ctx.embarque?.fechaZarpeEst) || "Al embarcar"],
    ];
  }
  if (hito === "H3") {
    const agente = nombre(e.reservado?.agenteAduanaId, "Agente de aduana");
    return [
      ["Tributos de importación (ad valorem, ISC, IGV, IPM y percepción)", "SUNAT", monto(pre.tributos + pre.percepcion), fechaEnLetras(e.fechaEstArribo ?? ctx.embarque?.fechaArriboEst) || "Al numerar la DAM"],
      ["Gastos de aduana", agente, monto(pre.gastosAduana), fechaEnLetras(e.fechaEstArribo ?? ctx.embarque?.fechaArriboEst) || "Al arribo"],
      ["Gastos registrales y placas", "SUNARP, notaría, AAP", monto(pre.gastosRegistrales), fechaEnLetras(e.fechaEstEntrega) || "Antes de la entrega"],
    ];
  }
  if (hito === "H1" || hito === "H4") {
    return [["Honorarios de LUXCARS (factura por separado)", "LUX CARS IMPORT S.A.C.", hito === "H1" ? c.COMISION_H1 : c.COMISION_H4, "Facturado al acreditarse"]];
  }
  return [["", "", "", ""]];
}

function construir(c: Campos, ctx: ContextoExpediente): Estructura {
  const marca = (h: string) => (c.HITO === h ? "[X]" : "[ ]");
  return {
    titulo: "Constancia de recepción de fondos",
    subtitulo: `**Constancia n.º ${c.EXPEDIENTE}-${c.CONSTANCIA_NUMERO} · Fecha: ${c.FECHA_DEPOSITO}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`LUX CARS IMPORT S.A.C., RUC ${c.LUXCARS_RUC}, deja constancia de haber recibido de **${c.CLIENTE_RAZON_SOCIAL}**, RUC ${c.CLIENTE_RUC}, en la cuenta Fondos de Clientes indicada en el Anexo D del contrato de mandato del ${c.FECHA_FIRMA}, el siguiente depósito:`),

      h2("1. Depósito recibido"),
      tabla(["Campo", "Dato"], [
        ["Monto acreditado", `USD ${c.MONTO_DEPOSITO}`],
        ["Fecha de acreditación", c.FECHA_DEPOSITO],
        ["Banco y cuenta de origen", c.CLIENTE_BANCO_ORIGEN],
        ["Número de operación", c.NUMERO_OPERACION],
        ["Hito al que corresponde", c.HITO],
        ["Concepto según el contrato", `${marca("H2")} H2: precio del vehículo, transporte interno, flete y seguro   ${marca("H3")} H3: tributos de importación, gastos de aduana y registrales   ${marca("H1")} H1 / ${marca("H4")} H4: honorarios   [ ] Diferencia comunicada el ______________   [ ] Otro: ______________`],
      ], [2, 3]),

      h2(`2. Saldo del expediente ${c.EXPEDIENTE}`),
      tabla(["Movimiento", "USD"], [
        ["Saldo anterior", c.SALDO_ANTERIOR],
        ["Depósito de esta constancia", `+ ${c.MONTO_DEPOSITO}`],
        ["**Saldo actual**", `**${c.SALDO_NUEVO}**`],
      ], [3, 1.5]),

      h2("3. Destino previsto de los fondos"),
      tabla(["Concepto", "Beneficiario", "USD estimado", "Fecha prevista"], destinos(c, ctx), [3, 2.5, 1.5, 2]),

      h2("4. Declaración"),
      p(`Los fondos recibidos pertenecen al Mandante. Se registran en el libro del expediente ${c.EXPEDIENTE} y se aplican únicamente a los conceptos del contrato de mandato del ${c.FECHA_FIRMA} y de sus anexos. Cada pago que se ordene con ellos se acredita con el comprobante correspondiente dentro de un día hábil de ejecutado. El saldo no aplicado se devuelve con la rendición de cuentas.`),
      p("Esta constancia no es comprobante de pago ni factura. Los honorarios de LUXCARS se facturan por separado y no se pagan con estos fondos."),

      firmas(["LUX CARS IMPORT S.A.C.", `${c.LUXCARS_REPRESENTANTE}, DNI ${c.LUXCARS_REP_DNI}`, `${c.CIUDAD_FIRMA}, ${c.FECHA_DEPOSITO}`]),
    ],
  };
}

export const constanciaFondos: Plantilla = {
  tipo: "constancia_fondos",
  version: "constancia_fondos@2026-11-25",
  nombre: "Constancia de recepción de fondos",
  idioma: "es",
  seFirma: false,
  construir,
};
