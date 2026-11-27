/**
 * El LIBRO del expediente: saldos por cuenta, estado de cada hito, pagos por
 * concepto, diferencia del H3 y los datos con que se arman los documentos que
 * nacen del libro (constancia de fondos, aviso H3, liquidación definitiva,
 * acta de entrega, rendición de cuentas).
 *
 * ÚNICA IMPLEMENTACIÓN DE ESTAS REGLAS. La base guarda asientos; nada se
 * recalcula en SQL salvo la suma que decide si la tarea "confirmar Hn" queda
 * hecha (misma regla, misma tolerancia). Solo cuentan los movimientos
 * `confirmado`; los `por_confirmar` se muestran aparte y los `anulado` no
 * existen para el libro.
 *
 *   depósito  +   pago  −   devolución  −   ajuste  + (con signo en el monto)
 *
 * TypeScript puro, sin fecha actual salvo la que se pase.
 */

import { fechaEnLetras, monto, type CamposExtra } from "./campos";
import { acreditadoPorHito, estadoHito, redondear } from "./hitos";
import { presupuestar } from "./presupuesto";
import type {
  ContextoExpediente,
  CuentaMovimiento,
  EntradaPresupuesto,
  EstadoHito,
  FechaIso,
  Hito,
  Movimiento,
  Presupuesto,
  TipoHito,
  TipoMovimiento,
} from "./tipos";

export { acreditadoPorHito, estadoHito };

/* -------------------------------------------------------------------------- */
/* Conceptos de pago                                                          */
/* -------------------------------------------------------------------------- */

export type GrupoConcepto = "vehiculo" | "logistica" | "tributo" | "gasto" | "otro";

export type ConceptoPago = {
  clave: string;
  etiqueta: string;
  grupo: GrupoConcepto;
  /** Hito que financia este pago por defecto (H2 compra y logística; H3 tributos y gastos). */
  hito: TipoHito | null;
  /** Texto del documento que lo sustenta, como en el paquete ("Factura n.º", "Recibo"). */
  documento: string;
};

/**
 * Catálogo de conceptos de pago a terceros. El formulario los ofrece y el
 * concepto se guarda como texto (la etiqueta): así la liquidación y la
 * rendición agrupan por grupo sin adivinar. Un concepto libre cae en `otro`.
 */
export const CONCEPTOS_PAGO: readonly ConceptoPago[] = [
  { clave: "precio_vehiculo", etiqueta: "Precio del vehículo", grupo: "vehiculo", hito: "H2", documento: "Bill of sale, SWIFT" },
  { clave: "inland", etiqueta: "Transporte interno en origen", grupo: "logistica", hito: "H2", documento: "Factura" },
  { clave: "flete", etiqueta: "Flete marítimo y gastos del contenedor", grupo: "logistica", hito: "H2", documento: "Factura, house BL" },
  { clave: "seguro", etiqueta: "Seguro de transporte", grupo: "logistica", hito: "H2", documento: "Póliza" },
  { clave: "ad_valorem", etiqueta: "Ad valorem", grupo: "tributo", hito: "H3", documento: "Liquidación de cobranza" },
  { clave: "isc", etiqueta: "Impuesto selectivo al consumo", grupo: "tributo", hito: "H3", documento: "Liquidación de cobranza" },
  { clave: "igv", etiqueta: "IGV", grupo: "tributo", hito: "H3", documento: "Liquidación de cobranza" },
  { clave: "ipm", etiqueta: "IPM", grupo: "tributo", hito: "H3", documento: "Liquidación de cobranza" },
  { clave: "percepcion", etiqueta: "Percepción del IGV", grupo: "tributo", hito: "H3", documento: "Constancia de percepción" },
  { clave: "tributos", etiqueta: "Tributos de importación (SUNAT)", grupo: "tributo", hito: "H3", documento: "DAM, liquidación de cobranza" },
  { clave: "agente_aduana", etiqueta: "Agente de aduana", grupo: "gasto", hito: "H3", documento: "Factura" },
  { clave: "deposito_temporal", etiqueta: "Depósito temporal", grupo: "gasto", hito: "H3", documento: "Factura" },
  { clave: "visto_bueno", etiqueta: "Visto bueno y gastos en destino", grupo: "gasto", hito: "H3", documento: "Factura" },
  { clave: "movilizacion", etiqueta: "Movilización y cuadrilla", grupo: "gasto", hito: "H3", documento: "Factura" },
  { clave: "grua", etiqueta: "Grúa del puerto al taller", grupo: "gasto", hito: "H3", documento: "Factura" },
  { clave: "homologacion", etiqueta: "Homologación o ficha técnica", grupo: "gasto", hito: "H3", documento: "Factura" },
  { clave: "sunarp", etiqueta: "Tasa registral SUNARP", grupo: "gasto", hito: "H3", documento: "Recibo" },
  { clave: "notaria", etiqueta: "Notaría", grupo: "gasto", hito: "H3", documento: "Factura" },
  { clave: "placas", etiqueta: "Placas", grupo: "gasto", hito: "H3", documento: "Recibo" },
  { clave: "otro", etiqueta: "Otros autorizados por el Mandante", grupo: "otro", hito: null, documento: "" },
];

const CONCEPTO_POR_ETIQUETA = new Map(CONCEPTOS_PAGO.map((c) => [c.etiqueta.toLowerCase(), c]));

/** Concepto del catálogo que corresponde a un movimiento (por etiqueta exacta o por palabra clave). */
export function conceptoDe(m: Pick<Movimiento, "concepto">): ConceptoPago {
  const texto = (m.concepto ?? "").trim().toLowerCase();
  const exacto = CONCEPTO_POR_ETIQUETA.get(texto);
  if (exacto) return exacto;
  const reglas: [RegExp, string][] = [
    [/vendedor|wire|precio|bill of sale/, "precio_vehiculo"],
    [/inland|transporte interno/, "inland"],
    [/flete|contenedor|freight/, "flete"],
    [/seguro|p[oó]liza/, "seguro"],
    [/ad ?valorem/, "ad_valorem"],
    [/\bisc\b|selectivo/, "isc"],
    [/\bipm\b/, "ipm"],
    [/percepci/, "percepcion"],
    [/\bigv\b/, "igv"],
    [/tributo|sunat|dam\b|liquidaci/, "tributos"],
    [/agente|agencia/, "agente_aduana"],
    [/dep[oó]sito temporal|almac[eé]n/, "deposito_temporal"],
    [/visto bueno|naviera|consolidador/, "visto_bueno"],
    [/moviliza|cuadrilla/, "movilizacion"],
    [/gr[uú]a/, "grua"],
    [/homologa|ficha t[eé]cnica/, "homologacion"],
    [/sunarp|registral/, "sunarp"],
    [/notar/, "notaria"],
    [/placa/, "placas"],
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

/** Signo con que cada tipo entra al saldo. El ajuste va con el signo de su monto. */
export function signoDe(tipo: TipoMovimiento): 1 | -1 {
  return tipo === "pago" || tipo === "devolucion" ? -1 : 1;
}

export type SaldoPorCuenta = Record<CuentaMovimiento, number>;

/** Saldo de cada cuenta con los movimientos confirmados. */
export function saldoFondos(movimientos: readonly Movimiento[]): SaldoPorCuenta {
  const saldo: SaldoPorCuenta = { fondos_clientes: 0, operaciones: 0, detracciones: 0 };
  for (const m of movimientos) {
    if (!esConfirmado(m)) continue;
    saldo[m.cuenta] += signoDe(m.tipo) * m.montoUsd;
  }
  return { fondos_clientes: redondear(saldo.fondos_clientes), operaciones: redondear(saldo.operaciones), detracciones: redondear(saldo.detracciones) };
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
    const acreditado = redondear(acreditadoPorHito(hito, movimientos));
    const estado = estadoHito(hito, movimientos);
    return {
      hito,
      estado,
      acreditado,
      porConfirmar: porConfirmarDeHito(hito, movimientos),
      pendiente: redondear(Math.max(0, hito.montoEstimadoUsd - acreditado)),
      vencido: Boolean(hoy && hito.fechaLimite && hito.fechaLimite < hoy && estado !== "acreditado"),
    };
  });
}

export type PagoPorConcepto = { concepto: string; grupo: GrupoConcepto; montoUsd: number; cantidad: number };

/** Pagos confirmados agrupados por concepto, en el orden del catálogo. */
export function pagadoPorConcepto(movimientos: readonly Movimiento[]): PagoPorConcepto[] {
  const porClave = new Map<string, PagoPorConcepto>();
  for (const m of movimientos) {
    if (!esConfirmado(m) || m.tipo !== "pago") continue;
    const c = conceptoDe(m);
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

export type DiferenciaH3 = {
  depositado: number;
  /** Tributos y gastos pagados con cargo al H3. */
  pagado: number;
  /** Positiva: a favor del cliente (sobró). Negativa: a cargo del cliente (faltó). */
  diferencia: number;
};

/**
 * Lo depositado para el H3 contra lo pagado por tributos y gastos. Los pagos
 * cuentan si traen `hito = 'H3'` o si su concepto es de tributos o gastos.
 */
export function diferenciaH3(hito: Pick<Hito, "tipo"> | null | undefined, movimientos: readonly Movimiento[]): DiferenciaH3 {
  const depositado = hito ? redondear(acreditadoPorHito(hito, movimientos)) : 0;
  const pagado = totalPagado(movimientos, { hito: "H3" });
  return { depositado, pagado, diferencia: redondear(depositado - pagado) };
}

/** Los movimientos del libro en orden de fecha (y de creación), solo los que existen para el libro. */
export function ordenarLibro(movimientos: readonly Movimiento[]): Movimiento[] {
  return [...movimientos]
    .filter((m) => m.estado !== "anulado")
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
}

/* -------------------------------------------------------------------------- */
/* Datos para los documentos que nacen del libro                              */
/* -------------------------------------------------------------------------- */

/** Campos de presupuesto a partir de un `Presupuesto` (el guardado o uno recalculado con datos reales). */
export function camposDePresupuesto(p: Presupuesto): CamposExtra {
  const baseH3 = p.tributos + (p.entrada.percepcionEnH3 === false ? 0 : p.percepcion) + p.gastosAduana + p.gastosRegistrales;
  const h3 = p.hitos.find((h) => h.tipo === "H3")?.montoUsd ?? redondear(baseH3 * (1 + p.margenH3));
  return {
    PRECIO_COMPRA_USD: monto(p.precioUsd),
    EST_INLAND: monto(p.inland),
    EST_FLETE: monto(p.flete),
    EST_SEGURO: monto(p.seguro),
    EST_CIF: monto(p.cif),
    EST_ADVALOREM: monto(p.adValorem),
    EST_ISC: monto(p.isc),
    EST_IGV_IPM: monto(p.igv + p.ipm),
    EST_PERCEPCION: monto(p.percepcion),
    EST_TRIBUTOS: monto(p.tributos + p.percepcion),
    EST_GASTOS_ADUANA: monto(p.gastosAduana),
    EST_GASTOS_REGISTRALES: monto(p.gastosRegistrales),
    H3_SUBTOTAL: monto(baseH3),
    H3_MARGEN_MONTO: monto(h3 - baseH3),
    H3_MONTO: monto(h3),
  };
}

/**
 * Entrada del presupuesto con los datos REALES que ya se conocen al emitir el
 * aviso H3: precio y tipo de cambio de la compra, flete del embarque y el
 * transporte interno pagado. Lo demás (tasas, gastos, margen) viene del
 * snapshot guardado al abrir el expediente; sin snapshot no hay aviso.
 */
export function entradaRealAvisoH3(ctx: ContextoExpediente): EntradaPresupuesto | null {
  const e = ctx.expediente;
  const p = e.presupuesto;
  if (!p) return null;
  const base = p.entrada;
  const inlandPagado = totalPagadoDe(ctx.movimientos, "inland");
  const fleteEmbarque = ctx.embarque?.fleteTotalUsd ?? null;
  const fletePagado = totalPagadoDe(ctx.movimientos, "flete");
  return {
    ...base,
    precio: e.precioCompra ?? base.precio,
    monedaCompra: e.monedaCompra || base.monedaCompra,
    tcCompraRef: e.reservado?.tcCompraRef ?? base.tcCompraRef,
    inland: inlandPagado > 0 ? inlandPagado : base.inland,
    // El flete se paga ya repartido; `presupuestar` lo multiplica por la proporción.
    fleteBase: fletePagado > 0 ? fletePagado / (e.proporcionFlete || 1) : fleteEmbarque ?? base.fleteBase,
    proporcionFlete: e.proporcionFlete || base.proporcionFlete,
    margenH3: e.margenH3 ?? base.margenH3,
    percepcionEnH3: base.percepcionEnH3 ?? true,
  };
}

function totalPagadoDe(movimientos: readonly Movimiento[], clave: string): number {
  return redondear(
    movimientos
      .filter((m) => esConfirmado(m) && m.tipo === "pago" && conceptoDe(m).clave === clave)
      .reduce((s, m) => s + m.montoUsd, 0),
  );
}

/** Presupuesto recalculado con datos reales para el aviso H3. `null` sin snapshot. */
export function presupuestoAvisoH3(ctx: ContextoExpediente): Presupuesto | null {
  const entrada = entradaRealAvisoH3(ctx);
  return entrada ? presupuestar(entrada) : null;
}

/**
 * Campos del aviso de pago H3: el presupuesto recalculado, la fecha límite
 * (la del hito H3 del expediente) y el equivalente en soles si se dio el tipo
 * de cambio referencial en `extra`.
 */
export function datosAvisoH3(ctx: ContextoExpediente, extra: CamposExtra = {}): CamposExtra {
  const p = presupuestoAvisoH3(ctx);
  if (!p) return {};
  const campos = camposDePresupuesto(p);
  const h3 = ctx.hitos.find((h) => h.tipo === "H3");
  const tc = Number((extra.TC_REFERENCIAL ?? "").replace(",", "."));
  const h3Monto = p.hitos.find((h) => h.tipo === "H3")?.montoUsd ?? 0;
  return {
    ...campos,
    FECHA_LIMITE_H3: fechaEnLetras(h3?.fechaLimite),
    H3_SOLES: Number.isFinite(tc) && tc > 0 ? monto(h3Monto * tc) : "",
  };
}

/** Número correlativo de la constancia dentro del expediente: F01, F02… según el orden de los depósitos confirmados. */
export function numeroConstancia(mov: Movimiento, movimientos: readonly Movimiento[]): string {
  const depositos = ordenarLibro(movimientos).filter((m) => m.tipo === "deposito" && esConfirmado(m));
  const i = depositos.findIndex((m) => m.id === mov.id);
  return `F${String((i >= 0 ? i : depositos.length) + 1).padStart(2, "0")}`;
}

/**
 * Campos de la constancia de recepción de fondos de UN depósito confirmado:
 * fecha, monto, hito, saldo de la cuenta antes y después (en el orden del
 * libro), número correlativo y el banco de origen que declaró el cliente.
 */
export function datosConstancia(mov: Movimiento, ctx: ContextoExpediente): CamposExtra {
  const libro = ordenarLibro(ctx.movimientos).filter((m) => esConfirmado(m) && m.cuenta === mov.cuenta);
  const posicion = libro.findIndex((m) => m.id === mov.id);
  const previos = posicion >= 0 ? libro.slice(0, posicion) : libro.filter((m) => m.id !== mov.id);
  const saldoAnterior = redondear(previos.reduce((s, m) => s + signoDe(m.tipo) * m.montoUsd, 0));
  const saldoNuevo = redondear(saldoAnterior + signoDe(mov.tipo) * mov.montoUsd);
  const salida: CamposExtra = {
    FECHA_DEPOSITO: fechaEnLetras(mov.fecha),
    MONTO_DEPOSITO: monto(mov.montoUsd),
    HITO: mov.hito ?? "",
    SALDO_ANTERIOR: monto(saldoAnterior),
    SALDO_NUEVO: monto(saldoNuevo),
    CONSTANCIA_NUMERO: numeroConstancia(mov, ctx.movimientos),
  };
  const ref = (mov.documentoRef ?? "").trim();
  if (ref) {
    const [banco, operacion] = ref.split(/\s·\sop\.\s/);
    salida.CLIENTE_BANCO_ORIGEN = banco.trim();
    if (operacion) salida.NUMERO_OPERACION = operacion.trim();
  }
  return salida;
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

/** Pagos confirmados de un grupo, como líneas listas para la tabla del documento. */
export function lineasDePagos(ctx: ContextoExpediente, grupos: readonly GrupoConcepto[]): LineaLiquidacion[] {
  const terceros = ctx.contrapartes ?? [];
  return ordenarLibro(ctx.movimientos)
    .filter((m) => esConfirmado(m) && m.tipo === "pago" && grupos.includes(conceptoDe(m).grupo))
    .map((m) => {
      const c = conceptoDe(m);
      const tercero = m.contraparteId ? terceros.find((t) => t.id === m.contraparteId) : null;
      return {
        concepto: c.clave === "otro" ? (m.concepto?.trim() || c.etiqueta) : c.etiqueta,
        proveedor: tercero?.nombre ?? (c.grupo === "tributo" ? "SUNAT" : c.clave === "sunarp" ? "SUNARP" : ""),
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
 * SBS), levante, y la comparación entre lo depositado para el H3 y lo pagado
 * por tributos y gastos.
 */
export function datosLiquidacion(ctx: ContextoExpediente): CamposExtra {
  const e = ctx.expediente;
  const h3 = ctx.hitos.find((h) => h.tipo === "H3") ?? null;
  const d = diferenciaH3(h3, ctx.movimientos);
  const tributos = lineasDePagos(ctx, ["tributo"]);
  const gastos = lineasDePagos(ctx, ["gasto"]);
  return {
    FACTOR_CONVERSION: e.damFactorConversion !== null && e.damFactorConversion !== undefined ? String(e.damFactorConversion) : "",
    TC_SBS_PAGO: e.damTcSbs !== null && e.damTcSbs !== undefined ? e.damTcSbs.toFixed(4) : "",
    FECHA_LEVANTE: fechaEnLetras(e.levanteEn),
    H3_DEPOSITADO: monto(d.depositado),
    H3_PAGADO: monto(d.pagado),
    H3_DIFERENCIA: monto(Math.abs(d.diferencia)),
    TOTAL_TRIBUTOS_USD: monto(tributos.reduce((s, l) => s + l.montoUsd, 0)),
    TOTAL_TRIBUTOS_PEN: monto(tributos.filter((l) => l.moneda === "PEN").reduce((s, l) => s + l.monto, 0)),
    TOTAL_GASTOS_USD: monto(gastos.reduce((s, l) => s + l.montoUsd, 0)),
  };
}

export type DatosRendicion = {
  /** Depósitos confirmados en Fondos de Clientes, en orden. */
  recibidos: Movimiento[];
  /** Pagos confirmados por cuenta del cliente, en orden. */
  pagos: LineaLiquidacion[];
  devoluciones: Movimiento[];
  /** Depósitos confirmados en Operaciones (honorarios H1 y H4). */
  honorarios: Movimiento[];
  totalRecibido: number;
  totalPagado: number;
  /** Recibido menos pagado: lo que corresponde devolver (negativo: a cargo del cliente). */
  saldo: number;
  devuelto: number;
  /** Saldo menos devuelto. Cuadra a cero cuando el expediente se puede cerrar. */
  saldoFinal: number;
  totalHonorarios: number;
  /** Pagos a terceros más honorarios: costo total de la operación. */
  totalOperacion: number;
  estimadoAnexoB: number | null;
  creditoFiscal: number;
};

/** Todo el libro resumido para la rendición de cuentas. */
export function datosRendicion(ctx: ContextoExpediente): DatosRendicion {
  const libro = ordenarLibro(ctx.movimientos).filter(esConfirmado);
  const recibidos = libro.filter((m) => m.tipo === "deposito" && m.cuenta === "fondos_clientes");
  const ajustes = libro.filter((m) => m.tipo === "ajuste" && m.cuenta === "fondos_clientes");
  const pagos = lineasDePagos(ctx, ["vehiculo", "logistica", "tributo", "gasto", "otro"]);
  const devoluciones = libro.filter((m) => m.tipo === "devolucion");
  const honorarios = libro.filter((m) => m.tipo === "deposito" && m.cuenta === "operaciones");
  const totalRecibido = redondear(recibidos.reduce((s, m) => s + m.montoUsd, 0) + ajustes.reduce((s, m) => s + m.montoUsd, 0));
  const totalPagado = redondear(pagos.reduce((s, l) => s + l.montoUsd, 0));
  const devuelto = redondear(devoluciones.reduce((s, m) => s + m.montoUsd, 0));
  const saldo = redondear(totalRecibido - totalPagado);
  const totalHonorarios = redondear(honorarios.reduce((s, m) => s + m.montoUsd, 0));
  const creditoFiscal = redondear(
    libro
      .filter((m) => m.tipo === "pago" && ["igv", "ipm", "percepcion"].includes(conceptoDe(m).clave))
      .reduce((s, m) => s + m.montoUsd, 0),
  );
  return {
    recibidos,
    pagos,
    devoluciones,
    honorarios,
    totalRecibido,
    totalPagado,
    saldo,
    devuelto,
    saldoFinal: redondear(saldo - devuelto),
    totalHonorarios,
    totalOperacion: redondear(totalPagado + totalHonorarios),
    estimadoAnexoB: ctx.expediente.presupuesto?.totalConPercepcion ?? null,
    creditoFiscal,
  };
}

/** Campos de la rendición: totales, saldo, devolución y el costo total contra el Anexo B. */
export function camposRendicion(ctx: ContextoExpediente): CamposExtra {
  const r = datosRendicion(ctx);
  const ultimaDevolucion = r.devoluciones[r.devoluciones.length - 1];
  const dif = r.estimadoAnexoB !== null ? redondear(r.totalOperacion - r.estimadoAnexoB) : null;
  return {
    TOTAL_RECIBIDO: monto(r.totalRecibido),
    TOTAL_PAGADO: monto(r.totalPagado),
    SALDO_RENDICION: monto(r.saldo),
    DEVOLUCION_MONTO: r.devuelto > 0 ? monto(r.devuelto) : "",
    DEVOLUCION_FECHA: ultimaDevolucion ? fechaEnLetras(ultimaDevolucion.fecha) : "",
    NUMERO_OPERACION: (ultimaDevolucion?.documentoRef ?? "").trim(),
    TOTAL_OPERACION: monto(r.totalOperacion),
    DIFERENCIA_ESTIMADO: dif === null ? "" : `${dif >= 0 ? "+" : "−"} ${monto(Math.abs(dif))}`,
    CREDITO_FISCAL: monto(r.creditoFiscal),
    ...datosLiquidacion(ctx),
  };
}

/**
 * Campos del acta de entrega: placa, TIVe, kilometraje y fecha ya vienen del
 * expediente; acá la fecha en que se acreditó el H4, o "pendiente" si todavía
 * no (el acta marca entonces la casilla de custodia). Nunca vacío: un campo
 * vacío bloquearía la emisión.
 */
export function datosActa(ctx: ContextoExpediente): CamposExtra {
  const h4 = ctx.hitos.find((h) => h.tipo === "H4");
  const acreditado = h4 ? estadoHito(h4, ctx.movimientos) === "acreditado" : false;
  const ultimo = ordenarLibro(ctx.movimientos).filter((m) => esConfirmado(m) && m.tipo === "deposito" && m.hito === "H4").pop();
  return {
    H4_ACREDITADO_FECHA: acreditado && ultimo ? fechaEnLetras(ultimo.fecha) : "pendiente",
  };
}
