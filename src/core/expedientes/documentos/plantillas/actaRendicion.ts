/**
 * 7 · Acta de entrega y rendición de cuentas. UN solo documento que el cliente
 * firma simple con el auto delante (decisión del 27 nov 2026): fusiona el acta
 * de entrega y la rendición de cuentas del paquete original. Placa, TIVe, km y
 * fecha vienen del expediente; las tablas se llenan con TODO el libro
 * (`datosRendicion`): depósitos recibidos, pagos por cuenta del cliente, lo
 * pagado directo a SUNAT, el saldo de los gastos de aduana aplicado al Pago 5,
 * las comisiones bancarias repuestas por Luxcars, devoluciones y los
 * honorarios que LUXCARS tomó de Fondos de Clientes al emitir cada factura,
 * con sus detracciones. Nombra los pagos "Pago N de 5", nunca con códigos H.
 * Debe cuadrar: el saldo de Fondos de Clientes menos lo devuelto = 0. La
 * conformidad también se registra desde el portal (`conformidad_rendicion`).
 */

import type { Campos } from "../../campos";
import { fechaEnLetras, monto } from "../../campos";
import { etiquetaPago } from "../../hitos";
import { datosRendicion, numeroConstancia } from "../../ledger";
import type { ContextoExpediente, Movimiento, TipoHito } from "../../tipos";
import { PAGO_POR_HITO } from "../../tipos";
import { casillas, firmas, h2, p, tabla, type Estructura } from "../estructura";
import { firmasLuxcarsYMandante, type Plantilla } from "./tipos";

/** "Pago 2 de 5" para un movimiento con hito; "—" sin hito. */
function pagoDe(hito: TipoHito | null): string {
  return hito ? etiquetaPago(PAGO_POR_HITO[hito]) : "—";
}

/** El asiento de la factura `n` (por el texto "factura n" del concepto o, si no, por orden). */
function deLaFactura(lista: readonly Movimiento[], n: 1 | 2): Movimiento | undefined {
  return lista.find((m) => new RegExp(`factura ${n}\\b`, "i").test(m.concepto ?? "")) ?? lista[n - 1];
}

function construir(c: Campos, ctx: ContextoExpediente): Estructura {
  const r = datosRendicion(ctx);
  const usado = ctx.expediente.vehiculo.condicion === "usado";
  const h6Acreditado = Boolean(c.H6_ACREDITADO_FECHA) && c.H6_ACREDITADO_FECHA !== "pendiente";
  const recibidos = r.recibidos.length
    ? r.recibidos.map((m) => [fechaEnLetras(m.fecha), pagoDe(m.hito), `${c.EXPEDIENTE}-${numeroConstancia(m, ctx.movimientos)}`, monto(m.montoUsd)])
    : [["", "Pago 1 de 5", "", ""], ["", "Pago 2 de 5", "", ""], ["", "Pago 3 de 5", "", ""], ["", "Pago 5 de 5", "", ""]];
  const directos = r.directos.length
    ? r.directos.map((d) => [fechaEnLetras(d.fecha), pagoDe(d.hito), d.referencia || "Comprobante del Mandante", d.moneda === "PEN" ? `S/ ${monto(d.monto)}` : "", monto(d.montoUsd)])
    : [["", "Pago 4 de 5", "Pendiente de confirmar", "", ""]];
  const pagos = r.pagos.length
    ? r.pagos.map((l) => [fechaEnLetras(l.fecha), l.concepto, l.proveedor, l.documento, `${l.moneda} ${monto(l.monto)}`, l.moneda === "USD" ? "1" : String(l.tipoCambio), monto(l.montoUsd)])
    : [
        ["", "Precio del vehículo (wire al broker)", c.VENDEDOR_NOMBRE, "Pro forma, bill of sale n.º ___, SWIFT n.º ___", c.MONEDA_COMPRA, "", ""],
        ["", `Flete: traslado al puerto y marítimo (${c.PROPORCION_FLETE})`, c.FORWARDER_NOMBRE, "Factura n.º, house BL n.º", "", "", ""],
        ["", "Seguro de transporte", "", "Póliza n.º", "", "", ""],
        ["", "Agente de aduana", c.AGENTE_ADUANA, "Factura n.º", "", "", ""],
        ["", "Almacenaje (depósito temporal)", "", "Factura n.º", "", "", ""],
        ["", "Grúa del puerto", "", "Factura n.º", "", "", ""],
        ["", "Otros autorizados por el Mandante", "", "", "", "", ""],
      ];
  // Cada factura: lo aplicado desde Fondos de Clientes (o, en expedientes anteriores al 27 nov, el depósito directo) y su detracción.
  const aplicada = (n: 1 | 2) => deLaFactura(r.aplicaciones, n) ?? r.honorarios.find((m) => m.hito === (n === 1 ? "H3" : "H6"));
  const detraccion = (n: 1 | 2) => deLaFactura(r.detracciones, n);
  const filaFactura = (n: 1 | 2) => {
    const a = aplicada(n);
    const d = detraccion(n);
    return [
      `Factura ${n} (50 %, ${n === 1 ? "al release" : "al levante"})`,
      n === 1 ? "Pago 2 de 5" : "Pago 5 de 5",
      a ? fechaEnLetras(a.fecha) : "",
      c.COMISION_MITAD,
      a ? monto(a.montoUsd) : "",
      d ? `${monto(d.montoUsd)} · ${(d.documentoRef ?? "").trim() || "constancia por anotar"}` : "",
    ];
  };
  const saldoACargo = r.saldo < 0;

  return {
    titulo: "Acta de entrega y rendición de cuentas",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Contrato de mandato del ${c.FECHA_FIRMA} · ${c.CIUDAD_FIRMA}, ${c.FECHA_ENTREGA}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`En ${c.CIUDAD_FIRMA}, el ${c.FECHA_ENTREGA}, a las ______ horas, en ______________, LUX CARS IMPORT S.A.C., representada por ${c.LUXCARS_REPRESENTANTE} (DNI ${c.LUXCARS_REP_DNI}), entrega a **${c.CLIENTE_RAZON_SOCIAL}**, representada por ${c.CLIENTE_REPRESENTANTE} (DNI ${c.CLIENTE_REP_DNI}) o por la persona autorizada que se identifica al final, el vehículo y los documentos que siguen, y rinde cuentas del mandato conforme al artículo 1793 del Código Civil y a la cláusula vigésima del contrato.`),

      h2("1. Vehículo entregado"),
      tabla(["Campo", "Dato"], [
        ["Marca, modelo y versión", `${c.VEH_MARCA} ${c.VEH_MODELO} ${c.VEH_VERSION}`],
        ["Año modelo", c.VEH_ANIO],
        ["VIN", c.VEH_VIN],
        ["Color", c.VEH_COLOR],
        ["Placa", c.PLACA],
        ["Tarjeta de identificación vehicular (TIVe) n.º", c.TIVE_NUMERO],
        ["Kilometraje a la entrega", c.KM_ENTREGA],
        ["Nivel de combustible o carga", "______________"],
      ], [2, 3]),

      h2("2. Estado del vehículo"),
      p("Revisado en presencia de ambas partes. Lo no marcado se considera conforme."),
      casillas([
        "Carrocería y pintura sin daños, salvo las observaciones anotadas",
        "Vidrios, espejos y luces completos y sin fisuras",
        "Llantas y aro de repuesto (o kit de inflado) en buen estado",
        "Interior: asientos, tapicería, tablero, pantalla y controles sin daños",
        "Aire acondicionado, luces, limpiaparabrisas y bocina funcionan",
        "Encendido normal, sin testigos de falla en el tablero",
        "Accesorios: gata, llave de ruedas, kit de herramientas, triángulos, extintor, alfombras",
        "Cargador y cables (solo híbridos enchufables y eléctricos)",
        "Dos llaves, ambas programadas",
      ]),
      p("Observaciones: ______________________________________________"),
      p("Fotos tomadas en el acto y enviadas a ambas partes: ______ (cantidad)."),

      h2("3. Fondos recibidos en la cuenta Fondos de Clientes"),
      tabla(["Fecha", "Pago", "Constancia n.º", "USD"], [
        ...recibidos,
        ["", "**Total recibido**", "", `**${c.TOTAL_RECIBIDO}**`],
      ], [2.2, 1.2, 2.4, 1.6]),

      h2("4. Pagos realizados por cuenta del Mandante"),
      tabla(["Fecha", "Concepto", "Beneficiario", "Documento a nombre del Mandante", "Moneda y monto", "Tipo de cambio", "USD"], [
        ...pagos,
        ["", "**Total pagado**", "", "", "", "", `**${c.TOTAL_PAGADO}**`],
      ], [1.6, 2.6, 2, 2.4, 1.6, 1.1, 1.5]),

      h2("5. Pagado directamente por el Mandante (Pago 4, tributos a SUNAT)"),
      tabla(["Fecha", "Pago", "Comprobante", "Soles", "USD"], [
        ...directos,
        ["", "**Total pagado directo**", "", "", `**${c.TOTAL_DIRECTO}**`],
      ], [2, 1, 3, 1.6, 1.6]),
      p("No pasó por las cuentas de LUXCARS: se lista para que la rendición muestre el costo completo de la operación."),

      h2("6. Gastos de aduana (Pago 3) y su ajuste en el Pago 5"),
      tabla(["Concepto", "USD"], [
        ["Gastos de aduana recibidos (Pago 3)", c.ADUANA_RECIBIDO],
        ["Gastos de aduana pagados (agente, almacén, grúa; en la sección 4)", c.ADUANA_PAGADO],
        [r.aduana.saldo >= 0 ? "Sobrante: se restó del Pago 5" : "Faltante: se sumó al Pago 5", c.ADUANA_SALDO],
        ["Pago 5 cobrado (segunda mitad de los honorarios, ajustada)", c.PAGO5_NETO],
      ], [4, 1.5]),

      h2("7. Comisiones bancarias de las transferencias al exterior"),
      p(`El banco debitó de Fondos de Clientes USD ${c.COMISIONES_BANCARIAS} por comisiones de las transferencias al exterior y LUXCARS las repuso el mismo día: son gasto de LUXCARS (cláusula 5.4 del contrato) y no cambian el saldo del Mandante.`),

      h2("8. Saldo y devolución"),
      tabla(["Concepto", "USD"], [
        ["Total recibido en Fondos de Clientes (sección 3)", c.TOTAL_RECIBIDO],
        ["Total pagado a terceros (sección 4)", c.TOTAL_PAGADO],
        ["Honorarios tomados de Fondos de Clientes al emitir cada factura (sección 9)", r.honorariosAplicados > 0 ? `− ${monto(r.honorariosAplicados)}` : "0.00"],
        ...(r.sobranteAplicado > 0 || r.faltanteCubierto > 0
          ? [["Saldo de aduana aplicado al Pago 5 (sección 6)", r.sobranteAplicado > 0 ? `− ${monto(r.sobranteAplicado)}` : `+ ${monto(r.faltanteCubierto)}`]]
          : []),
        [saldoACargo ? "**Saldo a cargo del Mandante**" : "**Saldo a favor del Mandante**", `**${c.SALDO_RENDICION}**`],
        [`Devuelto el ${c.DEVOLUCION_FECHA} a la cuenta ${c.CLIENTE_BANCO_ORIGEN}, operación n.º ${c.NUMERO_OPERACION}`, c.DEVOLUCION_MONTO],
      ], [4, 1.5]),
      p(saldoACargo
        ? `El saldo resulta a cargo del Mandante: USD ${monto(Math.abs(r.saldo))}, a depositar en Fondos de Clientes con el concepto "${c.EXPEDIENTE} saldo". Fecha en que lo depositó: ______________.`
        : "Si el saldo resultara a cargo del Mandante, se indica aquí el monto y la fecha en que lo depositó: ______________."),

      h2("9. Honorarios de LUXCARS (tomados de Fondos de Clientes al emitir cada factura)"),
      tabla(["Factura", "Se pagó con", "Fecha", "Total USD", "Tomado de Fondos de Clientes USD", "Detracción USD · constancia n.º"], [
        filaFactura(1),
        filaFactura(2),
        ["**Total honorarios**", "", "", `**${c.COMISION_TOTAL}** (base ${c.COMISION_BASE} + IGV ${c.COMISION_IGV})`, r.totalHonorarios > 0 ? `**${monto(r.totalHonorarios)}**` : "", ""],
      ], [2.2, 1.4, 1.8, 2.4, 1.8, 2.2]),
      p("Los honorarios incluyen la gestión registral: homologación o ficha técnica, inscripción en SUNARP, placas y tarjeta de identificación vehicular. Con cliente empresa, LUXCARS depositó la detracción de cada factura en el Banco de la Nación (cláusula 5.3 del contrato); la constancia va en la carpeta."),
      p(`Pago 5 de 5: ${h6Acreditado ? "[X]" : "[ ]"} acreditado el ${h6Acreditado ? c.H6_ACREDITADO_FECHA : "______________"}   ${h6Acreditado ? "[ ]" : "[X]"} pendiente, el vehículo queda en custodia conforme a la cláusula décima tercera del contrato.`),

      h2("10. Costo total de la operación para el Mandante"),
      tabla(["Concepto", "USD"], [
        ["Pagos a terceros (sección 4)", c.TOTAL_PAGADO],
        ["Pagado directamente a SUNAT (sección 5)", c.TOTAL_DIRECTO],
        ["Honorarios de LUXCARS (sección 9)", c.COMISION_TOTAL],
        ["**Total pagado por el Mandante**", `**${c.TOTAL_OPERACION}**`],
        ["Estimado del Anexo B", c.EST_TOTAL],
        ["Diferencia y explicación (tipo de cambio, flete real, ajustes de SUNAT)", c.DIFERENCIA_ESTIMADO],
        ["De ese total, crédito fiscal del Mandante (IGV, IPM y percepción según la DAM)", c.CREDITO_FISCAL],
      ], [4, 1.5]),

      h2("11. Documentos y carpeta entregada"),
      casillas([
        "Contrato de mandato con los anexos A, B, C y D, carta de autorización y poder para la inmatriculación",
        "Pro forma y factura o bill of sale del dealer a nombre del Mandante y comprobante del pago al broker",
        `Documento de propiedad del exterior (${c.VEH_DOC_PROPIEDAD}) con la transferencia`,
        usado ? "Historial del vehículo (CarFax) e informe de inspección" : "Constancia del MSO sin matricular y consulta de recalls por VIN",
        "Certificado de origen (si se usó)",
        "House BL, lista de empaque, acta de carga con fotos y declaración de exportación",
        "Póliza de seguro de transporte",
        `DAM n.º ${c.DAM_NUMERO} con levante, liquidación y comprobantes de pago de tributos`,
        "Facturas del forwarder, del agente de aduana, del almacén y de la grúa, a nombre del Mandante",
        "Constancia de homologación o ficha técnica",
        "Tarjeta de identificación vehicular y placas colocadas",
        "Facturas de honorarios 1 y 2 con constancias de detracción",
        "Constancias de recepción de fondos y comprobante de devolución del saldo",
        "Manuales del vehículo",
      ]),

      h2("12. Pendientes, si los hay"),
      tabla(["Pendiente", "Responsable", "Fecha compromiso"], [["", "", ""], ["", "", ""]], [3, 2, 2]),

      h2("13. Conformidad"),
      p(`El Mandante declara recibir el vehículo y los documentos a su satisfacción, en el estado descrito, sin perjuicio de las garantías que otorguen el fabricante o el dealer. Desde este momento la custodia, el riesgo, el SOAT y el seguro vehicular son de su cargo. Aprueba esta rendición de cuentas, declara haber recibido el saldo indicado y la carpeta completa, y da por cumplido el mandato del ${c.FECHA_FIRMA}, sin reclamo pendiente salvo los que se anotan aquí: ______________________________________________. La misma conformidad puede registrarse desde su cuenta en el portal de LUXCARS.`),
      p(`${c.CIUDAD_FIRMA}, ${c.FECHA_ENTREGA}`),
      firmas(
        ...firmasLuxcarsYMandante(c, true).map((col, i) => (i === 1 ? [...col, "O persona autorizada: nombre ______________ DNI ______________"] : col)),
      ),
    ],
  };
}

export const actaRendicion: Plantilla = {
  tipo: "acta_rendicion",
  version: "acta_rendicion@2026-11-27c",
  nombre: "Acta de entrega y rendición de cuentas",
  idioma: "es",
  tarea: "luxcars.acta_rendicion",
  seFirma: true,
  construir,
};
