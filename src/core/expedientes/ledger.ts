/**
 * El LIBRO del expediente: saldos por cuenta, estado de cada hito, pagos por
 * concepto, saldo de los gastos de aduana (que se compensa en el Pago 5), los
 * pagos que el cliente hace directo a SUNAT y los datos con que se arman los
 * documentos que nacen del libro (constancia de fondos, avisos de pago,
 * liquidación definitiva, acta de entrega y rendición de cuentas).
 *
 * ÚNICA IMPLEMENTACIÓN DE ESTAS REGLAS. La base guarda asientos; nada se
 * recalcula en SQL salvo la suma que decide si la tarea "confirmar Hn" queda
 * hecha (misma regla, misma tolerancia). Solo cuentan los movimientos
 * `confirmado`; los `por_confirmar` se muestran aparte y los `anulado` no
 * existen para el libro. Los montos son siempre positivos (la base lo exige):
 * el signo lo da el tipo.
 *
 *   depósito  +   pago  −   devolución  −   ajuste  +
 *
 * Tres reglas del calendario del 27 nov 2026 viven acá:
 *   · Pago 3 (H4, gastos de aduana) es un gasto REEMBOLSABLE: lo depositado
 *     menos lo pagado al agente, al almacén y a la grúa es el "saldo de
 *     aduana"; el Pago 5 (H6) se cobra neto de ese saldo (`datosPago5`).
 *   · Pago 4 (H5, tributos) lo paga el cliente DIRECTO a SUNAT: se registra en
 *     la cuenta `directo`, acredita el hito y no entra en el saldo de Fondos
 *     de Clientes (`pagosDirectos`).
 *   · La comisión bancaria del wire al exterior la debita el banco de Fondos de
 *     Clientes y Luxcars la repone el mismo día: un `pago` y un `ajuste` del
 *     mismo monto, que dejan el saldo del cliente igual (`comisionesBancarias`).
 *   · UNA sola cuenta para el cliente: los Pagos 1, 2, 3 y 5 entran a Fondos de
 *     Clientes. Al emitir cada factura de honorarios, Luxcars APLICA su importe
 *     de Fondos de Clientes a Operaciones (un `pago` desde Fondos y un
 *     `deposito` en Operaciones, sin hito) y desde Operaciones deposita la
 *     detracción en su cuenta del Banco de la Nación (autodetracción: un
 *     `pago` desde Operaciones y un `deposito` en detracciones, sin hito). Los
 *     asientos internos no llevan hito, así que nunca acreditan un pago del
 *     cliente. El sobrante o faltante de aduana se compensa solo: el cliente
 *     deposita el Pago 5 neto y Luxcars aplica la mitad completa.
 *
 * TypeScript puro, sin fecha actual salvo la que se pase.
 */

import { fechaEnLetras, monto, type CamposExtra } from "./campos";
import { CUANDO_PAGO, DONDE_PAGA, acreditadoPorHito, acreditadoPorPago, etiquetaPago, estadoHito, hitosDelPago, redondear, sumarDiasHabiles, DIAS_HABILES_PAGO_TRIBUTOS } from "./hitos";
import type {
  ContextoExpediente,
  CuentaMovimiento,
  EstadoHito,
  FechaIso,
  Hito,
  Movimiento,
  NumeroPago,
  TipoHito,
  TipoMovimiento,
} from "./tipos";
import { NUMEROS_PAGO, PAGO_POR_HITO as PAGO_POR_HITO_LEDGER } from "./tipos";

export { acreditadoPorHito, estadoHito };

/* -------------------------------------------------------------------------- */
/* Conceptos de pago                                                          */
/* -------------------------------------------------------------------------- */

/**
 * `honorarios` y `detraccion` son asientos internos de Luxcars (aplicación de
 * una factura desde Fondos de Clientes, autodetracción): no son pagos a
 * terceros ni pagos del cliente. `detraccion_cliente` es la detracción que el
 * cliente deposita él mismo (alternativa del contrato): sí es un pago suyo.
 */
export type GrupoConcepto = "vehiculo" | "logistica" | "tributo" | "gasto" | "compensacion" | "comision" | "honorarios" | "detraccion" | "otro";

export type ConceptoPago = {
  clave: string;
  etiqueta: string;
  grupo: GrupoConcepto;
  /** Hito que financia este pago por defecto (H1 precio; H2 flete y seguro; H4 gastos de aduana; H5 tributos; H6 compensación). */
  hito: TipoHito | null;
  /** Texto del documento que lo sustenta, como en el paquete ("Factura n.º", "Recibo"). */
  documento: string;
};

/**
 * Catálogo de conceptos del libro. El formulario los ofrece y el concepto se
 * guarda como texto (la etiqueta): así la liquidación y la rendición agrupan
 * sin adivinar. Un concepto libre cae en `otro`. La gestión registral
 * (homologación, SUNARP, placas, notaría) ya no está: va dentro de los
 * honorarios y la paga Luxcars.
 */
export const CONCEPTOS_PAGO: readonly ConceptoPago[] = [
  { clave: "precio_vehiculo", etiqueta: "Precio del vehículo (wire al broker)", grupo: "vehiculo", hito: "H1", documento: "Pro forma, bill of sale, SWIFT" },
  { clave: "inspeccion", etiqueta: "Inspección del vehículo usado", grupo: "vehiculo", hito: "H1", documento: "Informe de inspección, factura" },
  { clave: "flete", etiqueta: "Flete (traslado al puerto y marítimo)", grupo: "logistica", hito: "H2", documento: "Factura, house BL" },
  { clave: "seguro", etiqueta: "Seguro de transporte", grupo: "logistica", hito: "H2", documento: "Póliza" },
  { clave: "agente_aduana", etiqueta: "Agente de aduana", grupo: "gasto", hito: "H4", documento: "Factura" },
  { clave: "deposito_temporal", etiqueta: "Almacenaje (depósito temporal)", grupo: "gasto", hito: "H4", documento: "Factura" },
  { clave: "visto_bueno", etiqueta: "Visto bueno y gastos en destino", grupo: "gasto", hito: "H4", documento: "Factura" },
  { clave: "movilizacion", etiqueta: "Movilización y cuadrilla", grupo: "gasto", hito: "H4", documento: "Factura" },
  { clave: "grua", etiqueta: "Grúa del puerto", grupo: "gasto", hito: "H4", documento: "Factura" },
  { clave: "ad_valorem", etiqueta: "Ad valorem", grupo: "tributo", hito: "H5", documento: "Liquidación de cobranza" },
  { clave: "isc", etiqueta: "Impuesto selectivo al consumo", grupo: "tributo", hito: "H5", documento: "Liquidación de cobranza" },
  { clave: "igv", etiqueta: "IGV", grupo: "tributo", hito: "H5", documento: "Liquidación de cobranza" },
  { clave: "ipm", etiqueta: "IPM", grupo: "tributo", hito: "H5", documento: "Liquidación de cobranza" },
  { clave: "percepcion", etiqueta: "Percepción del IGV", grupo: "tributo", hito: "H5", documento: "Constancia de percepción" },
  { clave: "tributos", etiqueta: "Tributos de importación (SUNAT)", grupo: "tributo", hito: "H5", documento: "DAM, liquidación de cobranza" },
  { clave: "aduana_sobrante", etiqueta: "Sobrante de gastos de aduana aplicado al Pago 5", grupo: "compensacion", hito: "H6", documento: "Liquidación definitiva" },
  { clave: "aduana_faltante", etiqueta: "Faltante de gastos de aduana cubierto con el Pago 5", grupo: "compensacion", hito: "H6", documento: "Liquidación definitiva" },
  { clave: "comision_wire", etiqueta: "Comisión bancaria del wire (cargo del banco)", grupo: "comision", hito: null, documento: "Estado de cuenta del banco" },
  { clave: "comision_reposicion", etiqueta: "Reposición de la comisión bancaria, por cuenta de Luxcars", grupo: "comision", hito: null, documento: "Transferencia de Luxcars" },
  { clave: "aplicacion_honorarios", etiqueta: "Aplicación de honorarios desde Fondos de Clientes", grupo: "honorarios", hito: null, documento: "Factura de honorarios" },
  { clave: "honorarios_recibidos", etiqueta: "Honorarios recibidos desde Fondos de Clientes", grupo: "honorarios", hito: null, documento: "Factura de honorarios" },
  { clave: "autodetraccion", etiqueta: "Detracción depositada por Luxcars en el Banco de la Nación", grupo: "detraccion", hito: null, documento: "Constancia de depósito del Banco de la Nación" },
  { clave: "detraccion_cliente", etiqueta: "Detracción depositada por el cliente en el Banco de la Nación", grupo: "detraccion", hito: null, documento: "Constancia de depósito del Banco de la Nación" },
  { clave: "otro", etiqueta: "Otros autorizados por el Mandante", grupo: "otro", hito: null, documento: "" },
];

/** Grupos de asientos que no son pagos a terceros (los arma el sistema). */
const GRUPOS_INTERNOS: readonly GrupoConcepto[] = ["compensacion", "comision", "honorarios", "detraccion"];

/** Los conceptos que el equipo elige al registrar un pago a un tercero (los de compensación, comisión, honorarios y detracción los arma el sistema). */
export const CONCEPTOS_PAGO_TERCEROS: readonly ConceptoPago[] = CONCEPTOS_PAGO.filter((c) => !GRUPOS_INTERNOS.includes(c.grupo));

const CONCEPTO_POR_ETIQUETA = new Map(CONCEPTOS_PAGO.map((c) => [c.etiqueta.toLowerCase(), c]));

/** Concepto del catálogo que corresponde a un movimiento (por etiqueta exacta o por palabra clave). */
export function conceptoDe(m: Pick<Movimiento, "concepto">): ConceptoPago {
  const texto = (m.concepto ?? "").trim().toLowerCase();
  const exacto = CONCEPTO_POR_ETIQUETA.get(texto);
  if (exacto) return exacto;
  const reglas: [RegExp, string][] = [
    [/aplicaci[oó]n de (los )?honorarios/, "aplicacion_honorarios"],
    [/honorarios recibidos/, "honorarios_recibidos"],
    [/detracci[oó]n.*cliente|cliente.*detracci[oó]n/, "detraccion_cliente"],
    [/detracci[oó]n|autodetracci/, "autodetraccion"],
    [/reposici[oó]n de la comisi/, "comision_reposicion"],
    [/comisi[oó]n bancaria|cargo del banco/, "comision_wire"],
    [/sobrante.*aduana|aplicado al pago 5/, "aduana_sobrante"],
    [/faltante.*aduana|cubierto con el pago 5/, "aduana_faltante"],
    [/inspecci/, "inspeccion"],
    [/vendedor|broker|dealer|wire|precio|bill of sale/, "precio_vehiculo"],
    [/flete|contenedor|freight|inland|transporte interno|traslado al puerto/, "flete"],
    [/seguro|p[oó]liza/, "seguro"],
    [/ad ?valorem/, "ad_valorem"],
    [/\bisc\b|selectivo/, "isc"],
    [/\bipm\b/, "ipm"],
    [/percepci/, "percepcion"],
    [/\bigv\b/, "igv"],
    [/tributo|sunat|dam\b|liquidaci/, "tributos"],
    [/agente|agencia/, "agente_aduana"],
    [/dep[oó]sito temporal|almac[eé]n|almacenaje/, "deposito_temporal"],
    [/visto bueno|naviera|consolidador/, "visto_bueno"],
    [/moviliza|cuadrilla/, "movilizacion"],
    [/gr[uú]a/, "grua"],
  ];
  for (const [re, clave] of reglas) {
    if (re.test(texto)) return CONCEPTOS_PAGO.find((c) => c.clave === clave)!;
  }
  return CONCEPTOS_PAGO[CONCEPTOS_PAGO.length - 1];
}

/* -------------------------------------------------------------------------- */
/* Saldos                                                                     */
/* -------------------------------------------------------------------------- */

export function esConfirmado(m: Pick<Movimiento, "estado">): boolean {
  return m.estado === "confirmado";
}

/** Asiento interno de Luxcars (comisión repuesta, aplicación de honorarios, autodetracción): no es un pago del cliente ni a un tercero. */
export function esAsientoInterno(m: Pick<Movimiento, "concepto">): boolean {
  const c = conceptoDe(m);
  return c.grupo === "comision" || c.grupo === "honorarios" || c.clave === "autodetraccion";
}

/** Signo con que cada tipo entra al saldo. */
export function signoDe(tipo: TipoMovimiento): 1 | -1 {
  return tipo === "pago" || tipo === "devolucion" ? -1 : 1;
}

export type SaldoPorCuenta = Record<CuentaMovimiento, number>;

/**
 * Saldo de cada cuenta con los movimientos confirmados. `directo` no es una
 * cuenta de Luxcars: su "saldo" es lo que el cliente pagó directo a terceros.
 */
export function saldoFondos(movimientos: readonly Movimiento[]): SaldoPorCuenta {
  const saldo: SaldoPorCuenta = { fondos_clientes: 0, operaciones: 0, detracciones: 0, directo: 0 };
  for (const m of movimientos) {
    if (!esConfirmado(m)) continue;
    saldo[m.cuenta] += signoDe(m.tipo) * m.montoUsd;
  }
  return {
    fondos_clientes: redondear(saldo.fondos_clientes),
    operaciones: redondear(saldo.operaciones),
    detracciones: redondear(saldo.detracciones),
    directo: redondear(saldo.directo),
  };
}

/** Saldo de UNA cuenta, por defecto Fondos de Clientes. */
export function saldoCuenta(movimientos: readonly Movimiento[], cuenta: CuentaMovimiento = "fondos_clientes"): number {
  return saldoFondos(movimientos)[cuenta];
}

/** Suma de depósitos `por_confirmar` de un hito (declarados por el cliente, aún sin confirmar). */
export function porConfirmarDeHito(hito: Pick<Hito, "tipo">, movimientos: readonly Movimiento[]): number {
  return redondear(
    movimientos
      .filter((m) => m.hito === hito.tipo && m.tipo === "deposito" && m.estado === "por_confirmar")
      .reduce((s, m) => s + m.montoUsd, 0),
  );
}

export type HitoDerivado = {
  hito: Hito;
  estado: EstadoHito;
  acreditado: number;
  porConfirmar: number;
  /** Lo que falta para llegar al estimado (cero si ya está). */
  pendiente: number;
  /** Fecha límite pasada sin acreditar. */
  vencido: boolean;
};

/** Estado de todos los hitos, derivado del libro. `hoy` en ISO para decidir vencidos. */
export function estadoHitos(hitos: readonly Hito[], movimientos: readonly Movimiento[], hoy?: FechaIso): HitoDerivado[] {
  return hitos.map((hito) => {
    const acreditado = redondear(acreditadoPorHito(hito, movimientos, hitos));
    const estado = estadoHito(hito, movimientos, hitos);
    return {
      hito,
      estado,
      acreditado,
      porConfirmar: porConfirmarDeHito(hito, movimientos),
      pendiente: estado === "acreditado" ? 0 : redondear(Math.max(0, hito.montoEstimadoUsd - acreditado)),
      vencido: Boolean(hoy && hito.fechaLimite && hito.fechaLimite < hoy && estado !== "acreditado"),
    };
  });
}

/** Un pago tal como lo ve el cliente ("Pago 2 de 5"): la suma de sus hitos, un solo estado y una sola fecha. */
export type PagoDerivado = {
  pago: NumeroPago;
  /** "Pago 2 de 5". */
  etiqueta: string;
  hitos: Hito[];
  montoEstimadoUsd: number;
  acreditado: number;
  porConfirmar: number;
  pendiente: number;
  estado: EstadoHito;
  fechaLimite: FechaIso | null;
  vencido: boolean;
  /** El cliente paga directo a SUNAT (Pago 4). */
  directo: boolean;
  cuando: string;
  donde: string;
};

/** Los cinco pagos del cliente, derivados de los hitos y del libro (solo los que tienen hitos cargados). */
export function estadoPagos(hitos: readonly Hito[], movimientos: readonly Movimiento[], hoy?: FechaIso): PagoDerivado[] {
  const derivados = estadoHitos(hitos, movimientos, hoy);
  return NUMEROS_PAGO.flatMap((pago) => {
    const delPago = derivados.filter((d) => hitosDelPago(pago).includes(d.hito.tipo));
    if (delPago.length === 0) return [];
    const montoEstimadoUsd = redondear(delPago.reduce((s, d) => s + d.hito.montoEstimadoUsd, 0));
    const acreditado = redondear(acreditadoPorPago(pago, movimientos));
    const porConfirmar = redondear(
      movimientos
        .filter((m) => m.hito !== null && hitosDelPago(pago).includes(m.hito) && m.tipo === "deposito" && m.estado === "por_confirmar")
        .reduce((s, m) => s + m.montoUsd, 0),
    );
    const estados = delPago.map((d) => d.estado);
    const estado: EstadoHito = estados.every((e) => e === "acreditado") ? "acreditado" : acreditado > 0 ? "parcial" : "pendiente";
    const fechas = delPago.map((d) => d.hito.fechaLimite).filter((f): f is FechaIso => Boolean(f)).sort();
    const fechaLimite = fechas[0] ?? null;
    return [{
      pago,
      etiqueta: etiquetaPago(pago),
      hitos: delPago.map((d) => d.hito),
      montoEstimadoUsd,
      acreditado,
      porConfirmar,
      pendiente: estado === "acreditado" ? 0 : redondear(Math.max(0, montoEstimadoUsd - acreditado)),
      estado,
      fechaLimite,
      vencido: Boolean(hoy && fechaLimite && fechaLimite < hoy && estado !== "acreditado"),
      directo: delPago.some((d) => d.hito.cuenta === "directo"),
      cuando: CUANDO_PAGO[pago],
      donde: DONDE_PAGA[pago],
    }];
  });
}

export type PagoPorConcepto = { concepto: string; grupo: GrupoConcepto; montoUsd: number; cantidad: number };

/** Pagos confirmados a terceros agrupados por concepto, en el orden del catálogo (sin compensaciones, comisiones, honorarios ni detracciones). */
export function pagadoPorConcepto(movimientos: readonly Movimiento[]): PagoPorConcepto[] {
  const porClave = new Map<string, PagoPorConcepto>();
  for (const m of movimientos) {
    if (!esConfirmado(m) || m.tipo !== "pago") continue;
    const c = conceptoDe(m);
    if (GRUPOS_INTERNOS.includes(c.grupo)) continue;
    const llave = c.clave === "otro" ? `otro:${(m.concepto ?? "").trim()}` : c.clave;
    const actual = porClave.get(llave) ?? { concepto: c.clave === "otro" ? (m.concepto?.trim() || c.etiqueta) : c.etiqueta, grupo: c.grupo, montoUsd: 0, cantidad: 0 };
    actual.montoUsd = redondear(actual.montoUsd + m.montoUsd);
    actual.cantidad += 1;
    porClave.set(llave, actual);
  }
  const orden = new Map(CONCEPTOS_PAGO.map((c, i) => [c.clave, i]));
  return [...porClave.entries()]
    .sort((a, b) => (orden.get(a[0]) ?? 99) - (orden.get(b[0]) ?? 99))
    .map(([, v]) => v);
}

/** Total de pagos confirmados, opcionalmente de un hito o grupo. */
export function totalPagado(movimientos: readonly Movimiento[], filtro: { hito?: TipoHito; grupo?: GrupoConcepto } = {}): number {
  return redondear(
    movimientos
      .filter((m) => esConfirmado(m) && m.tipo === "pago")
      .filter((m) => !filtro.hito || (m.hito ?? conceptoDe(m).hito) === filtro.hito)
      .filter((m) => !filtro.grupo || conceptoDe(m).grupo === filtro.grupo)
      .reduce((s, m) => s + m.montoUsd, 0),
  );
}

/** Los movimientos del libro en orden de fecha (y de creación), solo los que existen para el libro. */
export function ordenarLibro(movimientos: readonly Movimiento[]): Movimiento[] {
  return [...movimientos]
    .filter((m) => m.estado !== "anulado")
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

/* -------------------------------------------------------------------------- */
/* Gastos de aduana (Pago 3) y su compensación en el Pago 5                   */
/* -------------------------------------------------------------------------- */

export type SaldoAduana = {
  /** Depósitos confirmados del hito H4 en Fondos de Clientes. */
  recibido: number;
  /** Pagos confirmados al agente, al almacén, a la grúa (grupo `gasto`) desde Fondos de Clientes. */
  pagado: number;
  /** Recibido menos pagado: positivo = sobrante (a favor del cliente), negativo = faltante. */
  saldo: number;
};

/** Lo depositado para los gastos de aduana (H4) contra lo pagado por ellos. */
export function saldoGastosAduana(movimientos: readonly Movimiento[]): SaldoAduana {
  const confirmados = movimientos.filter(esConfirmado);
  const recibido = redondear(
    confirmados.filter((m) => m.tipo === "deposito" && m.hito === "H4" && m.cuenta === "fondos_clientes").reduce((s, m) => s + m.montoUsd, 0),
  );
  const pagado = redondear(
    confirmados.filter((m) => m.tipo === "pago" && m.cuenta === "fondos_clientes" && conceptoDe(m).grupo === "gasto").reduce((s, m) => s + m.montoUsd, 0),
  );
  return { recibido, pagado, saldo: redondear(recibido - pagado) };
}

export type DatosPago5 = {
  /** 50 % restante de los honorarios, sin compensar. */
  honorarios: number;
  aduana: SaldoAduana;
  /** Lo que el cliente paga en el Pago 5: honorarios − sobrante (o + faltante), nunca negativo. */
  neto: number;
  /** Si el sobrante de aduana supera los honorarios, lo que se devuelve con la rendición. */
  aDevolver: number;
};

/** Mitad de los honorarios del expediente (lo que valen el H3 y el H6 antes de compensar). */
export function mitadHonorarios(ctx: ContextoExpediente): number {
  const total = ctx.expediente.honorariosUsd ?? ctx.expediente.presupuesto?.honorarios ?? null;
  if (total !== null) return redondear(total / 2);
  return ctx.expediente.presupuesto?.hitos.find((h) => h.tipo === "H6")?.montoUsd ?? 0;
}

/** El Pago 5 (H6): la segunda mitad de los honorarios, neta del saldo de los gastos de aduana. */
export function datosPago5(ctx: ContextoExpediente): DatosPago5 {
  const honorarios = mitadHonorarios(ctx);
  const aduana = saldoGastosAduana(ctx.movimientos);
  const bruto = redondear(honorarios - aduana.saldo);
  return { honorarios, aduana, neto: Math.max(0, bruto), aDevolver: redondear(Math.max(0, -bruto)) };
}

/* -------------------------------------------------------------------------- */
/* Pagos directos del cliente (tributos a SUNAT) y comisiones bancarias       */
/* -------------------------------------------------------------------------- */

export type PagoDirecto = {
  movimientoId: string;
  fecha: FechaIso;
  hito: TipoHito | null;
  /** Monto en la moneda en que pagó (soles, normalmente). */
  moneda: string;
  monto: number;
  montoUsd: number;
  referencia: string;
  tieneComprobante: boolean;
};

/** Lo que el cliente pagó directamente a un tercero (cuenta `directo`), confirmado por el equipo. */
export function pagosDirectos(movimientos: readonly Movimiento[]): PagoDirecto[] {
  return ordenarLibro(movimientos)
    .filter((m) => esConfirmado(m) && m.cuenta === "directo")
    .map((m) => ({
      movimientoId: m.id,
      fecha: m.fecha,
      hito: m.hito,
      moneda: m.moneda ?? "USD",
      monto: m.monto ?? m.montoUsd,
      montoUsd: m.montoUsd,
      referencia: (m.documentoRef ?? "").trim(),
      tieneComprobante: Boolean(m.tieneComprobante),
    }));
}

export type ComisionesBancarias = {
  /** Lo que el banco debitó de Fondos de Clientes por los wires al exterior. */
  cargadas: number;
  /** Lo que Luxcars repuso a Fondos de Clientes. */
  repuestas: number;
  /** Efecto en el saldo del cliente: cero cuando cada comisión está repuesta. */
  efecto: number;
};

export function comisionesBancarias(movimientos: readonly Movimiento[]): ComisionesBancarias {
  let cargadas = 0;
  let repuestas = 0;
  for (const m of movimientos) {
    if (!esConfirmado(m) || m.cuenta !== "fondos_clientes") continue;
    const c = conceptoDe(m);
    if (c.clave === "comision_wire" && m.tipo === "pago") cargadas += m.montoUsd;
    if (c.clave === "comision_reposicion" && (m.tipo === "ajuste" || m.tipo === "deposito")) repuestas += m.montoUsd;
  }
  return { cargadas: redondear(cargadas), repuestas: redondear(repuestas), efecto: redondear(repuestas - cargadas) };
}

/* -------------------------------------------------------------------------- */
/* Datos para los documentos que nacen del libro                              */
/* -------------------------------------------------------------------------- */

/** Número correlativo de la constancia dentro del expediente: F01, F02… según el orden de los depósitos confirmados del cliente en cuentas de Luxcars (sin asientos internos). */
export function numeroConstancia(mov: Movimiento, movimientos: readonly Movimiento[]): string {
  const depositos = ordenarLibro(movimientos).filter((m) => m.tipo === "deposito" && esConfirmado(m) && m.cuenta !== "directo" && !esAsientoInterno(m));
  const i = depositos.findIndex((m) => m.id === mov.id);
  return `F${String((i >= 0 ? i : depositos.length) + 1).padStart(2, "0")}`;
}

/**
 * Campos de la constancia de recepción de fondos de UN depósito confirmado:
 * fecha, monto, hito, saldo de la cuenta antes y después (en el orden del
 * libro), número correlativo y el banco de origen que declaró el cliente.
 * Los pagos directos a SUNAT no tienen constancia: no pasan por Luxcars.
 */
export function datosConstancia(mov: Movimiento, ctx: ContextoExpediente): CamposExtra {
  const libro = ordenarLibro(ctx.movimientos).filter((m) => esConfirmado(m) && m.cuenta === mov.cuenta);
  const posicion = libro.findIndex((m) => m.id === mov.id);
  const previos = posicion >= 0 ? libro.slice(0, posicion) : libro.filter((m) => m.id !== mov.id);
  const saldoAnterior = redondear(previos.reduce((s, m) => s + signoDe(m.tipo) * m.montoUsd, 0));
  const saldoNuevo = redondear(saldoAnterior + signoDe(mov.tipo) * mov.montoUsd);
  const pago = mov.hito ? PAGO_POR_HITO_LEDGER[mov.hito] : null;
  const salida: CamposExtra = {
    FECHA_DEPOSITO: fechaEnLetras(mov.fecha),
    MONTO_DEPOSITO: monto(mov.montoUsd),
    HITO: mov.hito ?? "",
    PAGO_DEPOSITO: pago ? etiquetaPago(pago) : "",
    SALDO_ANTERIOR: monto(saldoAnterior),
    SALDO_NUEVO: monto(saldoNuevo),
    CONSTANCIA_NUMERO: numeroConstancia(mov, ctx.movimientos),
  };
  const ref = (mov.documentoRef ?? "").trim();
  if (ref) {
    const [banco, operacion] = ref.split(/\s·\sop\.\s/);
    salida.CLIENTE_BANCO_ORIGEN = banco.trim();
    if (operacion) salida.NUMERO_OPERACION = operacion.split(" · ")[0].trim();
  }
  return salida;
}

export type HitoConAviso = "H4" | "H5" | "H6";
export const HITOS_CON_AVISO: readonly HitoConAviso[] = ["H4", "H5", "H6"];

/**
 * Campos del aviso de pago de un hito que se fija durante la operación:
 *  · H4 (Pago 3): gastos de aduana según la pro forma del agente. El monto se
 *    escribe al emitir (`MONTO_AVISO`); si no, el estimado del hito.
 *  · H5 (Pago 4): tributos exactos de la liquidación de SUNAT, que el cliente
 *    paga directo: número de liquidación, USD de la DAM y soles a pagar se
 *    escriben al emitir; la fecha límite es `hoy` + dos días hábiles.
 *  · H6 (Pago 5): la segunda mitad de los honorarios neta del saldo de aduana.
 * `hoy` (ISO) solo hace falta para la fecha límite del H5.
 */
export function datosAvisoPago(ctx: ContextoExpediente, hito: HitoConAviso, extra: CamposExtra = {}, hoy?: FechaIso): CamposExtra {
  const h = ctx.hitos.find((x) => x.tipo === hito) ?? null;
  const base: CamposExtra = { HITO: hito };
  if (hito === "H4") {
    const monto4 = (extra.MONTO_AVISO ?? "").trim() || monto(h?.montoEstimadoUsd ?? ctx.expediente.presupuesto?.gastosAduana ?? null);
    return { ...base, MONTO_AVISO: monto4, FECHA_LIMITE_PAGO: (extra.FECHA_LIMITE_PAGO ?? "").trim() || fechaEnLetras(h?.fechaLimite ?? ctx.expediente.fechaEstArribo ?? ctx.embarque?.fechaArriboEst ?? null) };
  }
  if (hito === "H5") {
    const limite = (extra.FECHA_LIMITE_PAGO ?? "").trim() || (hoy ? fechaEnLetras(sumarDiasHabiles(hoy, DIAS_HABILES_PAGO_TRIBUTOS)) : fechaEnLetras(h?.fechaLimite));
    return { ...base, FECHA_LIMITE_PAGO: limite };
  }
  const p5 = datosPago5(ctx);
  return {
    ...base,
    COMISION_MITAD: monto(p5.honorarios),
    ADUANA_RECIBIDO: monto(p5.aduana.recibido),
    ADUANA_PAGADO: monto(p5.aduana.pagado),
    ADUANA_SALDO: monto(Math.abs(p5.aduana.saldo)),
    PAGO5_NETO: monto(p5.neto),
    MONTO_AVISO: monto(p5.neto),
    FECHA_LIMITE_PAGO: (extra.FECHA_LIMITE_PAGO ?? "").trim() || fechaEnLetras(h?.fechaLimite ?? ctx.expediente.levanteEn),
  };
}

/** Monto en USD que el aviso deja en el hito (lo que el cliente debe pagar). `null` si no se puede leer. */
export function montoDelAviso(ctx: ContextoExpediente, hito: HitoConAviso, campos: CamposExtra): number | null {
  const leer = (v: string | undefined) => {
    const n = Number((v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? redondear(n) : null;
  };
  if (hito === "H5") return leer(campos.TRIBUTOS_USD);
  if (hito === "H6") return datosPago5(ctx).neto;
  return leer(campos.MONTO_AVISO);
}

export type LineaLiquidacion = {
  concepto: string;
  proveedor: string;
  documento: string;
  moneda: string;
  monto: number;
  tipoCambio: number;
  montoUsd: number;
  fecha: FechaIso;
};

/** Pagos confirmados desde Fondos de Clientes de unos grupos, como líneas listas para la tabla del documento. */
export function lineasDePagos(ctx: ContextoExpediente, grupos: readonly GrupoConcepto[]): LineaLiquidacion[] {
  const terceros = ctx.contrapartes ?? [];
  return ordenarLibro(ctx.movimientos)
    .filter((m) => esConfirmado(m) && m.tipo === "pago" && m.cuenta === "fondos_clientes" && grupos.includes(conceptoDe(m).grupo))
    .map((m) => {
      const c = conceptoDe(m);
      const tercero = m.contraparteId ? terceros.find((t) => t.id === m.contraparteId) : null;
      return {
        concepto: c.clave === "otro" ? (m.concepto?.trim() || c.etiqueta) : c.etiqueta,
        proveedor: tercero?.nombre ?? (c.grupo === "tributo" ? "SUNAT" : ""),
        documento: (m.documentoRef ?? "").trim() || c.documento,
        moneda: m.moneda ?? "USD",
        monto: m.monto ?? m.montoUsd,
        tipoCambio: m.tipoCambio ?? 1,
        montoUsd: m.montoUsd,
        fecha: m.fecha,
      };
    });
}

/**
 * Campos de la liquidación definitiva: DAM (número, fecha, canal, factor, TC
 * SBS), levante, los tributos pagados (directo por el cliente o por Luxcars) y
 * la comparación entre lo depositado para los gastos de aduana y lo pagado, con
 * el saldo que pasa al Pago 5.
 */
export function datosLiquidacion(ctx: ContextoExpediente): CamposExtra {
  const e = ctx.expediente;
  const tributos = lineasDePagos(ctx, ["tributo"]);
  const directos = pagosDirectos(ctx.movimientos).filter((d) => d.hito === "H5");
  const gastos = lineasDePagos(ctx, ["gasto"]);
  const p5 = datosPago5(ctx);
  const usd = tributos.reduce((s, l) => s + l.montoUsd, 0) + directos.reduce((s, d) => s + d.montoUsd, 0);
  const pen = tributos.filter((l) => l.moneda === "PEN").reduce((s, l) => s + l.monto, 0) + directos.filter((d) => d.moneda === "PEN").reduce((s, d) => s + d.monto, 0);
  return {
    FACTOR_CONVERSION: e.damFactorConversion !== null && e.damFactorConversion !== undefined ? String(e.damFactorConversion) : "",
    TC_SBS_PAGO: e.damTcSbs !== null && e.damTcSbs !== undefined ? e.damTcSbs.toFixed(4) : "",
    FECHA_LEVANTE: fechaEnLetras(e.levanteEn),
    TOTAL_TRIBUTOS_USD: monto(usd),
    TOTAL_TRIBUTOS_PEN: monto(pen),
    TOTAL_GASTOS_USD: monto(gastos.reduce((s, l) => s + l.montoUsd, 0)),
    ADUANA_RECIBIDO: monto(p5.aduana.recibido),
    ADUANA_PAGADO: monto(p5.aduana.pagado),
    ADUANA_SALDO: monto(Math.abs(p5.aduana.saldo)),
    PAGO5_NETO: monto(p5.neto),
  };
}

export type DatosRendicion = {
  /** Depósitos confirmados del cliente en Fondos de Clientes, en orden. */
  recibidos: Movimiento[];
  /** Pagos confirmados a terceros por cuenta del cliente desde Fondos de Clientes, en orden. */
  pagos: LineaLiquidacion[];
  /** Lo que el cliente pagó directo a SUNAT (Pago 4). */
  directos: PagoDirecto[];
  devoluciones: Movimiento[];
  /** Depósitos confirmados en Operaciones: los honorarios aplicados desde Fondos de Clientes al emitir cada factura (en expedientes anteriores al 27 nov, depositados directo). */
  honorarios: Movimiento[];
  /** Aplicaciones de honorarios desde Fondos de Clientes, una por factura, en orden. */
  aplicaciones: Movimiento[];
  honorariosAplicados: number;
  /** Detracciones de las facturas de honorarios en el Banco de la Nación: las de Luxcars (autodetracción) y las que depositó el cliente. */
  detracciones: Movimiento[];
  aduana: SaldoAduana;
  pago5: DatosPago5;
  /** Sobrante de aduana pasado de Fondos de Clientes a los honorarios. */
  sobranteAplicado: number;
  /** Faltante de aduana cubierto con el Pago 5 y repuesto en Fondos de Clientes. */
  faltanteCubierto: number;
  comisiones: ComisionesBancarias;
  totalRecibido: number;
  totalPagado: number;
  totalDirecto: number;
  /** Lo que queda en Fondos de Clientes antes de devolver (negativo: a cargo del cliente). */
  saldo: number;
  devuelto: number;
  /** Saldo menos devuelto. Cuadra a cero cuando el expediente se puede cerrar. */
  saldoFinal: number;
  /** Honorarios cobrados: lo aplicado a Operaciones, más la detracción que depositó el cliente si la hizo él (más el sobrante aplicado y menos el faltante repuesto de expedientes anteriores). */
  totalHonorarios: number;
  /** Pagos a terceros, pagos directos y honorarios: costo total de la operación. */
  totalOperacion: number;
  estimadoAnexoB: number | null;
  creditoFiscal: number;
};

/** Todo el libro resumido para el acta de entrega y rendición de cuentas. */
export function datosRendicion(ctx: ContextoExpediente): DatosRendicion {
  const libro = ordenarLibro(ctx.movimientos).filter(esConfirmado);
  const fondos = libro.filter((m) => m.cuenta === "fondos_clientes");
  const recibidos = fondos.filter((m) => m.tipo === "deposito" && !esAsientoInterno(m));
  const ajustesOtros = fondos.filter((m) => m.tipo === "ajuste" && !["compensacion", "comision", "honorarios"].includes(conceptoDe(m).grupo));
  const aplicaciones = fondos.filter((m) => m.tipo === "pago" && conceptoDe(m).clave === "aplicacion_honorarios");
  const honorariosAplicados = redondear(aplicaciones.reduce((s, m) => s + m.montoUsd, 0));
  const detracciones = libro.filter((m) => m.tipo === "deposito" && m.cuenta === "detracciones");
  // La detracción que deposita el cliente es parte de lo que paga por honorarios; la de Luxcars sale de Operaciones.
  const detraccionCliente = redondear(detracciones.filter((m) => conceptoDe(m).clave !== "autodetraccion").reduce((s, m) => s + m.montoUsd, 0));
  const pagos = lineasDePagos(ctx, ["vehiculo", "logistica", "tributo", "gasto", "otro"]);
  const directos = pagosDirectos(ctx.movimientos);
  const devoluciones = libro.filter((m) => m.tipo === "devolucion");
  const honorarios = libro.filter((m) => m.tipo === "deposito" && m.cuenta === "operaciones");
  const sobranteAplicado = redondear(fondos.filter((m) => m.tipo === "pago" && conceptoDe(m).clave === "aduana_sobrante").reduce((s, m) => s + m.montoUsd, 0));
  const faltanteCubierto = redondear(fondos.filter((m) => m.tipo === "ajuste" && conceptoDe(m).clave === "aduana_faltante").reduce((s, m) => s + m.montoUsd, 0));
  const comisiones = comisionesBancarias(ctx.movimientos);
  const totalRecibido = redondear(recibidos.reduce((s, m) => s + m.montoUsd, 0) + ajustesOtros.reduce((s, m) => s + m.montoUsd, 0));
  const totalPagado = redondear(pagos.reduce((s, l) => s + l.montoUsd, 0));
  const totalDirecto = redondear(directos.reduce((s, d) => s + d.montoUsd, 0));
  const devuelto = redondear(devoluciones.reduce((s, m) => s + m.montoUsd, 0));
  const saldo = redondear(totalRecibido - totalPagado - honorariosAplicados - sobranteAplicado + faltanteCubierto + comisiones.efecto);
  const totalHonorarios = redondear(honorarios.reduce((s, m) => s + m.montoUsd, 0) + detraccionCliente + sobranteAplicado - faltanteCubierto);
  const p = ctx.expediente.presupuesto;
  const creditoPagado = libro.filter((m) => m.tipo === "pago" && ["igv", "ipm", "percepcion"].includes(conceptoDe(m).clave)).reduce((s, m) => s + m.montoUsd, 0);
  // Pagados directo a SUNAT no traen el detalle por tributo: se toma el del Anexo B (el exacto está en la DAM).
  const creditoDirecto = directos.length > 0 && p ? p.igv + p.ipm + p.percepcion : 0;
  return {
    recibidos,
    pagos,
    directos,
    devoluciones,
    honorarios,
    aplicaciones,
    honorariosAplicados,
    detracciones,
    aduana: saldoGastosAduana(ctx.movimientos),
    pago5: datosPago5(ctx),
    sobranteAplicado,
    faltanteCubierto,
    comisiones,
    totalRecibido,
    totalPagado,
    totalDirecto,
    saldo,
    devuelto,
    saldoFinal: redondear(saldo - devuelto),
    totalHonorarios,
    totalOperacion: redondear(totalPagado + totalDirecto + totalHonorarios),
    estimadoAnexoB: p?.totalConPercepcion ?? null,
    creditoFiscal: redondear(creditoPagado + creditoDirecto),
  };
}

/**
 * Campos de la rendición: totales, saldo, devolución, lo pagado directo, el
 * saldo de aduana aplicado al Pago 5, las comisiones repuestas y el costo
 * total contra el Anexo B. La devolución dice "pendiente" mientras no esté en
 * el libro (el acta se firma con el auto delante, a veces antes de que el
 * banco acredite la devolución): nunca vacío, porque un campo vacío bloquearía
 * la emisión.
 */
export function camposRendicion(ctx: ContextoExpediente): CamposExtra {
  const r = datosRendicion(ctx);
  const ultimaDevolucion = r.devoluciones[r.devoluciones.length - 1];
  const dif = r.estimadoAnexoB !== null ? redondear(r.totalOperacion - r.estimadoAnexoB) : null;
  const sinDevolver = r.devuelto <= 0;
  return {
    TOTAL_RECIBIDO: monto(r.totalRecibido),
    TOTAL_PAGADO: monto(r.totalPagado),
    TOTAL_DIRECTO: monto(r.totalDirecto),
    SALDO_RENDICION: monto(r.saldo),
    DEVOLUCION_MONTO: sinDevolver ? (r.saldo > 0.01 ? "pendiente" : "0.00") : monto(r.devuelto),
    DEVOLUCION_FECHA: ultimaDevolucion ? fechaEnLetras(ultimaDevolucion.fecha) : "pendiente",
    NUMERO_OPERACION: (ultimaDevolucion?.documentoRef ?? "").trim() || "pendiente",
    TOTAL_OPERACION: monto(r.totalOperacion),
    DIFERENCIA_ESTIMADO: dif === null ? "" : `${dif >= 0 ? "+" : "−"} ${monto(Math.abs(dif))}`,
    CREDITO_FISCAL: monto(r.creditoFiscal),
    COMISIONES_BANCARIAS: monto(r.comisiones.cargadas),
    ...datosLiquidacion(ctx),
  };
}

/**
 * Campos del acta de entrega: placa, TIVe, kilometraje y fecha ya vienen del
 * expediente; acá la fecha en que se acreditó el H6 (segunda mitad de los
 * honorarios), o "pendiente" si todavía no (el acta marca entonces la casilla
 * de custodia). Nunca vacío: un campo vacío bloquearía la emisión.
 */
export function datosActa(ctx: ContextoExpediente): CamposExtra {
  const h6 = ctx.hitos.find((h) => h.tipo === "H6");
  const acreditado = h6 ? estadoHito(h6, ctx.movimientos, ctx.hitos) === "acreditado" : false;
  const ultimo = ordenarLibro(ctx.movimientos).filter((m) => esConfirmado(m) && m.tipo === "deposito" && m.hito === "H6").pop();
  return {
    H6_ACREDITADO_FECHA: acreditado && ultimo ? fechaEnLetras(ultimo.fecha) : "pendiente",
    // Propuestas que el formulario de emisión puede corregir; hora, lugar y nivel de combustible se escriben con el auto delante.
    OBSERVACIONES_ENTREGA: OBSERVACIONES_POR_DEFECTO,
    PENDIENTES_ENTREGA: PENDIENTES_POR_DEFECTO,
    RECIBE_ENTREGA: quienRecibe(ctx),
  };
}

/** Lo que el acta dice cuando la entrega no deja observaciones ni pendientes. */
export const OBSERVACIONES_POR_DEFECTO = "Sin observaciones";
export const PENDIENTES_POR_DEFECTO = "Sin pendientes";

/** Quién recibe por el Mandante, por defecto: su representante con cargo y DNI (o la persona natural con su DNI). */
export function quienRecibe(ctx: ContextoExpediente): string {
  const c = ctx.cliente;
  if (!c) return "";
  if (c.tipo === "persona") return c.razonSocial && c.dni ? `${c.razonSocial}, con DNI n.º ${c.dni}` : "";
  const nombre = (c.representante ?? "").trim();
  const dni = (c.representanteDni ?? "").trim();
  if (!nombre || !dni) return "";
  const cargo = (c.representanteCargo ?? "").trim();
  return `${nombre}${cargo ? `, ${cargo.toLowerCase()}` : ""}, con DNI n.º ${dni}`;
}

/** Todo lo del acta de entrega y rendición de cuentas (un solo documento desde el 27 nov 2026). */
export function camposActaRendicion(ctx: ContextoExpediente): CamposExtra {
  return { ...camposRendicion(ctx), ...datosActa(ctx) };
}
