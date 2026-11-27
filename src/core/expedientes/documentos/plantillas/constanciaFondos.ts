/**
 * 5 · Constancia de recepción de fondos. Transcrita del paquete. Los campos
 * del depósito (fecha, monto, pago, saldos, correlativo) los arma el libro
 * (`datosConstancia`); el "destino previsto de los fondos" sale del
 * presupuesto del expediente según el pago. Todos los pagos del cliente a
 * LUXCARS entran a Fondos de Clientes (27 nov 2026) y la constancia los nombra
 * "Pago N de 5", nunca con el código interno del hito.
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
  if (hito === "H1") {
    const broker = nombre(e.reservado?.brokerId ?? e.reservado?.vendedorId, "Vendedor (broker)");
    const filas = [["Precio del vehículo (wire al broker, que paga al dealer)", broker, monto(pre.precioUsd), "Al confirmar el depósito"]];
    if (pre.costoInspeccion > 0) filas.push(["Inspección del vehículo usado", nombre(e.reservado?.inspectorId, "Inspector"), monto(pre.costoInspeccion), "Ya realizada"]);
    return filas;
  }
  if (hito === "H2" || hito === "H3") {
    const forwarder = nombre(ctx.embarque?.forwarderId, "Forwarder");
    return [
      ["Flete (traslado al puerto y marítimo)", forwarder, monto(pre.flete), fechaEnLetras(e.fechaEstEmbarque ?? ctx.embarque?.fechaZarpeEst) || "Al embarcar"],
      ["Seguro de transporte", nombre(ctx.embarque?.aseguradoraId, "Aseguradora"), monto(pre.seguro), fechaEnLetras(e.fechaEstEmbarque ?? ctx.embarque?.fechaZarpeEst) || "Al embarcar"],
      ["Primera mitad de los honorarios (factura 1), que LUXCARS aplica al emitir la factura", "LUX CARS IMPORT S.A.C.", c.COMISION_MITAD, "Al emitir la factura 1"],
    ];
  }
  if (hito === "H4") {
    const agente = nombre(e.reservado?.agenteAduanaId, "Agente de aduana");
    return [
      ["Gastos de aduana: agente, almacenaje, visto bueno y grúa del puerto (reembolsables; el saldo va al Pago 5)", agente, c.MONTO_DEPOSITO, fechaEnLetras(e.fechaEstArribo ?? ctx.embarque?.fechaArriboEst) || "Al arribo"],
    ];
  }
  if (hito === "H6") {
    return [["Segunda mitad de los honorarios (factura 2), que LUXCARS aplica al emitir la factura junto con el saldo de los gastos de aduana", "LUX CARS IMPORT S.A.C.", c.COMISION_MITAD, "Al emitir la factura 2"]];
  }
  return [["", "", "", ""]];
}

function construir(c: Campos, ctx: ContextoExpediente): Estructura {
  const pago = c.PAGO_DEPOSITO;
  const marca = (n: number) => (pago.startsWith(`Pago ${n} `) ? "[X]" : "[ ]");
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
        ["Pago al que corresponde", pago],
        ["Concepto según el contrato", `${marca(1)} Pago 1 de 5: el precio del auto   ${marca(2)} Pago 2 de 5: flete, seguro y primera mitad de los honorarios   ${marca(3)} Pago 3 de 5: gastos de aduana   ${marca(5)} Pago 5 de 5: segunda mitad de los honorarios`],
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
      p("Esta constancia no es comprobante de pago ni factura. De estos fondos LUXCARS toma solo el importe de cada factura de honorarios, en la fecha en que la emite (cláusula 3.2 del contrato), y lo muestra en el libro y en la rendición de cuentas."),

      firmas(["LUX CARS IMPORT S.A.C.", `${c.LUXCARS_REPRESENTANTE}, DNI ${c.LUXCARS_REP_DNI}`, `${c.CIUDAD_FIRMA}, ${c.FECHA_DEPOSITO}`]),
    ],
  };
}

export const constanciaFondos: Plantilla = {
  tipo: "constancia_fondos",
  version: "constancia_fondos@2026-11-27c",
  nombre: "Constancia de recepción de fondos",
  idioma: "es",
  seFirma: false,
  construir,
};
