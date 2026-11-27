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
import { queCubrePago } from "../../hitos";
import type { ContextoExpediente, NumeroPago, TipoHito } from "../../tipos";
import { firmas, h2, p, tabla, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

/** Filas de "destino previsto" para el hito, desde el presupuesto guardado y las contrapartes. */
function destinos(c: Campos, ctx: ContextoExpediente): string[][] {
  const pre = ctx.expediente.presupuesto;
  const terceros = ctx.contrapartes ?? [];
  const nombre = (id: string | null | undefined, fallback: string) => (id ? terceros.find((t) => t.id === id)?.nombre ?? fallback : fallback);
  const hito = (c.HITO || "") as TipoHito | "";
  // Sin presupuesto o sin hito conocido no hay desglose: una fila con el concepto del contrato, nunca una fila en blanco.
  const sinDesglose = [["Conceptos de este pago según el calendario del contrato (cláusula tercera)", "Los que indica el contrato", c.MONTO_DEPOSITO, "Según el calendario"]];
  if (!pre) return sinDesglose;
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
  return sinDesglose;
}

function construir(c: Campos, ctx: ContextoExpediente): Estructura {
  const pago = c.PAGO_DEPOSITO;
  // El concepto es el del pago de esta constancia, con el texto del calendario del contrato: sin casillas.
  const numero = Number(/^Pago (\d) de 5/.exec(pago)?.[1] ?? 0);
  const concepto = numero >= 1 && numero <= 5 ? queCubrePago(numero as NumeroPago, ctx.expediente.vehiculo.condicion === "usado") : pago;
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
        ["Concepto según el contrato (cláusula tercera)", concepto],
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
  version: "constancia_fondos@2026-11-28",
  nombre: "Constancia de recepción de fondos",
  idioma: "es",
  seFirma: false,
  construir,
};
