/**
 * 6 · Aviso de pago de los hitos que se fijan durante la operación (calendario
 * del 27 nov 2026). Una plantilla, tres variantes según el campo HITO:
 *   · H4 · Pago 3 · gastos de aduana según la pro forma del agente, al arribo,
 *     a Fondos de Clientes. Gasto reembolsable: el saldo se compensa en el Pago 5.
 *   · H5 · Pago 4 · tributos exactos de la liquidación de SUNAT, en soles, que
 *     el cliente paga DIRECTAMENTE a SUNAT dentro de dos días hábiles.
 *   · H6 · Pago 5 · segunda mitad de los honorarios, neta del sobrante (o más
 *     el faltante) de los gastos de aduana, a Operaciones.
 * Cada variante solo lee sus propios campos (regla "sin rayas").
 *
 * El tipo de documento conserva el valor viejo de la enum (`aviso_h3`): cambiar
 * un valor de enum en Postgres costaba más que documentarlo acá y en tipos.ts.
 */

import type { Campos } from "../../campos";
import { firmas, h2, p, tabla, vinetas, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

export function encabezadoLiquidacion(c: Campos): string {
  return `**Expediente ${c.EXPEDIENTE} · Vehículo ${c.VEH_MARCA} ${c.VEH_MODELO} ${c.VEH_ANIO}, VIN ${c.VEH_VIN} · Importador: ${c.CLIENTE_RAZON_SOCIAL}, RUC ${c.CLIENTE_RUC}**`;
}

export const TEXTO_TRIBUTOS_AVISO =
  "Los tributos de importación que liquide SUNAT, así como cualquier ajuste, diferencia, multa o reliquidación que la Administración Aduanera determine sobre la operación, son de cargo exclusivo del Mandante y serán asumidos por él (cláusula 8.4 del contrato).";

function avisoGastosAduana(c: Campos): Estructura["bloques"] {
  return [
    h2("Pago 3 · Hito H4 · Gastos de aduana"),
    p(`**Fecha del aviso: ${c.FECHA_AVISO} · Arribo estimado: ${c.FECHA_EST_ARRIBO} · Depósito a más tardar: ${c.FECHA_LIMITE_PAGO}**`),
    p(`Tu vehículo está por llegar al ${c.PUERTO_DESTINO}. Según la pro forma del agente de aduana ${c.AGENTE_ADUANA}, los gastos de aduana (agente, almacenaje, visto bueno y grúa del puerto) suman lo siguiente:`),
    tabla(["Concepto", "Detalle", "USD"], [
      ["**Monto a depositar (H4, Pago 3)**", `Cuenta Fondos de Clientes · ${c.CTA_FONDOS_BANCO} ${c.CTA_FONDOS_NUMERO} · CCI ${c.CTA_FONDOS_CCI} · concepto "${c.EXPEDIENTE} H4"`, `**USD ${c.MONTO_AVISO}**`],
    ], [2.4, 4, 1.6]),
    vinetas([
      "Es un gasto reembolsable: LUXCARS paga al agente, al almacén y a la grúa contra facturas a tu nombre y te los rinde uno por uno (cláusula 8.5 del contrato).",
      "Si sobra, el sobrante se descuenta del Pago 5 (segunda mitad de los honorarios); si falta, se suma a ese pago.",
      "Los tributos de importación no van en este pago: cuando SUNAT liquide la DAM te enviamos el aviso del Pago 4 para que los pagues directamente a SUNAT.",
    ]),
  ];
}

function avisoTributos(c: Campos): Estructura["bloques"] {
  return [
    h2("Pago 4 · Hito H5 · Tributos de importación"),
    p(`**Fecha del aviso: ${c.FECHA_AVISO} · DAM n.º ${c.DAM_NUMERO} · Liquidación n.º ${c.LIQUIDACION_NUMERO} · Pago a más tardar: ${c.FECHA_LIMITE_PAGO}**`),
    p("SUNAT liquidó la DAM de tu vehículo. Los tributos se pagan directamente a SUNAT, en soles, con el número de liquidación; no pasan por las cuentas de LUXCARS."),
    tabla(["Concepto", "Detalle", "Monto"], [
      ["Tributos según la DAM", "Ad valorem, ISC, IGV, IPM y percepción, expresados en dólares por SUNAT", `USD ${c.TRIBUTOS_USD}`],
      ["**Monto a pagar en soles**", `Según la liquidación n.º ${c.LIQUIDACION_NUMERO}; referencia al tipo de cambio ${c.TC_REFERENCIAL}`, `**S/ ${c.TRIBUTOS_SOLES}**`],
    ], [2.4, 4, 1.6]),
    p("Cómo pagar:"),
    vinetas([
      "Con tu Clave SOL en SUNAT Operaciones en Línea (www.sunat.gob.pe), opción de pago de deudas aduaneras, con el número de liquidación; o",
      "En ventanilla de un banco autorizado (BCP, BBVA, Interbank, Scotiabank, Banco de la Nación), indicando el número de liquidación.",
      "El monto en soles se fija con el tipo de cambio venta SBS del día de pago: si pagas otro día, la cifra puede variar ligeramente.",
      "Al pagar, entra a tu cuenta en luxcars.pe y declara «Ya pagué» con el comprobante. Confirmamos el pago y seguimos con el levante.",
      TEXTO_TRIBUTOS_AVISO,
    ]),
  ];
}

function avisoHonorarios(c: Campos): Estructura["bloques"] {
  return [
    h2("Pago 5 · Hito H6 · Segunda mitad de los honorarios"),
    p(`**Fecha del aviso: ${c.FECHA_AVISO} · Levante: ${c.FECHA_LEVANTE} · Pago a más tardar: ${c.FECHA_LIMITE_PAGO}**`),
    p("Tu vehículo quedó liberado de aduana. Toca la segunda mitad de los honorarios, ajustada con el saldo de los gastos de aduana que depositaste en el Pago 3 (cláusula 8.5 del contrato):"),
    tabla(["Concepto", "USD"], [
      ["Segunda mitad de los honorarios (50 %, IGV incluido)", c.COMISION_MITAD],
      ["Gastos de aduana recibidos (Pago 3)", c.ADUANA_RECIBIDO],
      ["Gastos de aduana pagados al agente, al almacén y a la grúa", c.ADUANA_PAGADO],
      ["Saldo de aduana aplicado (sobrante se resta, faltante se suma)", c.ADUANA_SALDO],
      ["**Monto a depositar (H6, Pago 5)**", `**${c.PAGO5_NETO}**`],
    ], [4, 1.5]),
    vinetas([
      `Cuenta de Operaciones · ${c.CTA_OPER_BANCO} ${c.CTA_OPER_NUMERO} · CCI ${c.CTA_OPER_CCI} · concepto "${c.EXPEDIENTE} H6". La detracción de la factura 2 (${c.PORCENTAJE_DETRACCION} %) va a la cuenta del Banco de la Nación del Anexo D.`,
      "Con este pago acreditado te entregamos el vehículo con placas, el acta de entrega y rendición de cuentas y la carpeta completa.",
    ]),
  ];
}

function construir(c: Campos): Estructura {
  const hito = c.HITO || "H4";
  const bloques = hito === "H5" ? avisoTributos(c) : hito === "H6" ? avisoHonorarios(c) : avisoGastosAduana(c);
  const titulo = hito === "H5" ? "Aviso del Pago 4 · Tributos de importación" : hito === "H6" ? "Aviso del Pago 5 · Segunda mitad de los honorarios" : "Aviso del Pago 3 · Gastos de aduana";
  return {
    titulo,
    subtitulo: encabezadoLiquidacion(c),
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      ...bloques,
      firmas(["LUX CARS IMPORT S.A.C.", `${c.LUXCARS_REPRESENTANTE}, DNI ${c.LUXCARS_REP_DNI}`, `${c.CIUDAD_FIRMA}, ${c.FECHA_AVISO}`]),
    ],
  };
}

export const avisoPago: Plantilla = {
  tipo: "aviso_h3",
  version: "aviso_pago@2026-11-27",
  nombre: "Aviso de pago",
  idioma: "es",
  seFirma: false,
  construir,
};
