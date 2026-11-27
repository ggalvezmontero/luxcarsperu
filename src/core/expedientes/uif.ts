/**
 * Registro de Operaciones para la UIF (Ley 27693 y su reglamento; normas de
 * la SBS para sujetos obligados en compraventa de vehículos).
 *
 * Qué hace este módulo y qué NO hace:
 *  - Marca, sobre el libro de los expedientes, las operaciones que superan
 *    los umbrales: individuales (por defecto ≥ USD 10,000) y múltiples que,
 *    sumadas por cliente y mes calendario, alcanzan el umbral acumulado (por
 *    defecto ≥ USD 50,000). Los umbrales se pasan como parámetro porque los
 *    fija la norma vigente, no el software.
 *  - Arma las filas que el oficial de cumplimiento necesita para llenar el
 *    Registro de Operaciones. NO reproduce el formato oficial (que cambia y
 *    lo publica la SBS), ni decide qué se reporta como operación sospechosa:
 *    eso es criterio del oficial de cumplimiento.
 *
 * TypeScript puro, sin fechas del sistema: el "mes" sale de `fecha` del
 * movimiento (`YYYY-MM-DD`), y la moneda extranjera se compara siempre por
 * `montoUsd` (el libro ya guarda la conversión al registrar).
 */

import type { Cliente, CuentaMovimiento, Movimiento, TipoCliente, TipoMovimiento } from "./tipos";

export type UmbralesUif = {
  /** Operación individual que se registra por sí sola (USD). */
  individualUsd: number;
  /** Suma por cliente y mes calendario a partir de la cual TODAS las del mes se registran (USD). */
  acumuladoMensualUsd: number;
};

/** Umbrales vigentes al escribir esto (nov 2026). Si la norma cambia, se pasa otro objeto. */
export const UMBRALES_UIF_DEFECTO: UmbralesUif = {
  individualUsd: 10_000,
  acumuladoMensualUsd: 50_000,
};

/** Lo mínimo que hay que saber del expediente dueño de cada movimiento. */
export type ExpedienteUif = {
  id: string;
  codigo: string;
  clienteId: string;
};

/** Movimiento con el expediente al que pertenece y quién lo registró. */
export type MovimientoUif = Movimiento & {
  expedienteId: string;
  /** Correo o nombre de quien registró el asiento; `null` si no se sabe. */
  registradoPor?: string | null;
  /** Nombre de la contraparte (vendedor, forwarder…) si el pago fue a un tercero. */
  contraparteNombre?: string | null;
};

export type MotivoUif = "individual" | "acumulado";

export type OperacionReportable = {
  movimiento: MovimientoUif;
  expediente: ExpedienteUif;
  cliente: Pick<Cliente, "id" | "tipo" | "razonSocial" | "ruc" | "dni"> | null;
  /** `YYYY-MM` del movimiento. */
  mes: string;
  motivos: MotivoUif[];
  /** Suma del cliente en ese mes (todas sus operaciones confirmadas), para contexto. */
  acumuladoMesUsd: number;
};

export type OrigenOperacion = "deposito_cliente" | "pago_tercero" | "devolucion_cliente" | "ajuste";

export function origenDe(tipo: TipoMovimiento): OrigenOperacion {
  switch (tipo) {
    case "deposito":
      return "deposito_cliente";
    case "pago":
      return "pago_tercero";
    case "devolucion":
      return "devolucion_cliente";
    default:
      return "ajuste";
  }
}

export const ORIGEN_LABEL: Record<OrigenOperacion, string> = {
  deposito_cliente: "Depósito del cliente",
  pago_tercero: "Pago a tercero por cuenta del cliente",
  devolucion_cliente: "Devolución al cliente",
  ajuste: "Ajuste contable",
};

export const CUENTA_LABEL_UIF: Record<CuentaMovimiento, string> = {
  fondos_clientes: "Fondos de clientes",
  operaciones: "Operaciones",
  detracciones: "Detracciones",
  directo: "Pagado directo por el cliente",
};

export const TIPO_CLIENTE_LABEL_UIF: Record<TipoCliente, string> = {
  empresa: "Persona jurídica",
  persona: "Persona natural",
};

export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

/**
 * Solo las operaciones reales que pasan por Luxcars cuentan: ni declaradas sin
 * confirmar ni anuladas, nunca los ajustes contables y nunca lo que el cliente
 * pagó directo a SUNAT (cuenta `directo`, desde el 27 nov 2026).
 */
export function cuentaParaUif(m: Pick<Movimiento, "estado" | "tipo"> & { cuenta?: Movimiento["cuenta"] }): boolean {
  return m.estado === "confirmado" && m.tipo !== "ajuste" && m.cuenta !== "directo";
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Marca las operaciones reportables.
 *
 * Reglas:
 *  1. Individual: `montoUsd >= individualUsd` (el borde exacto cuenta).
 *  2. Acumulado: se agrupa por cliente (del expediente) y mes calendario de
 *     `fecha`; si la suma de las operaciones que cuentan alcanza
 *     `acumuladoMensualUsd`, TODAS las del grupo se marcan, incluidas las que
 *     ya eran individuales (acumulan ambos motivos).
 *  3. Sin cliente conocido se agrupa por expediente (no se pierde la operación).
 *
 * Orden de salida: fecha, luego código de expediente, luego `createdAt`.
 */
export function operacionesReportables(
  movimientos: readonly MovimientoUif[],
  expedientes: readonly ExpedienteUif[],
  clientes: readonly Pick<Cliente, "id" | "tipo" | "razonSocial" | "ruc" | "dni">[],
  umbrales: UmbralesUif = UMBRALES_UIF_DEFECTO,
): OperacionReportable[] {
  const porExpediente = new Map(expedientes.map((e) => [e.id, e]));
  const porCliente = new Map(clientes.map((c) => [c.id, c]));

  const validos = movimientos.filter((m) => cuentaParaUif(m) && porExpediente.has(m.expedienteId));

  const acumulado = new Map<string, number>();
  const claveDe = (m: MovimientoUif) => {
    const e = porExpediente.get(m.expedienteId)!;
    return `${e.clienteId || `exp:${e.id}`}|${mesDe(m.fecha)}`;
  };
  for (const m of validos) {
    const k = claveDe(m);
    acumulado.set(k, (acumulado.get(k) ?? 0) + m.montoUsd);
  }

  const salida: OperacionReportable[] = [];
  for (const m of validos) {
    const e = porExpediente.get(m.expedienteId)!;
    const suma = redondear2(acumulado.get(claveDe(m)) ?? 0);
    const motivos: MotivoUif[] = [];
    if (m.montoUsd >= umbrales.individualUsd) motivos.push("individual");
    if (suma >= umbrales.acumuladoMensualUsd) motivos.push("acumulado");
    if (motivos.length === 0) continue;
    salida.push({
      movimiento: m,
      expediente: e,
      cliente: porCliente.get(e.clienteId) ?? null,
      mes: mesDe(m.fecha),
      motivos,
      acumuladoMesUsd: suma,
    });
  }

  return salida.sort(
    (a, b) =>
      a.movimiento.fecha.localeCompare(b.movimiento.fecha) ||
      a.expediente.codigo.localeCompare(b.expediente.codigo) ||
      (a.movimiento.createdAt ?? "").localeCompare(b.movimiento.createdAt ?? ""),
  );
}

/** Una fila del registro, con nombres de columna estables (son los encabezados del CSV). */
export type FilaRegistroUif = {
  fecha: string;
  expediente: string;
  tipo_operacion: string;
  origen: string;
  moneda: string;
  monto: number;
  monto_usd: number;
  cuenta: string;
  cliente_tipo: string;
  cliente_nombre: string;
  cliente_documento: string;
  contraparte: string;
  referencia_documental: string;
  concepto: string;
  motivo_registro: string;
  acumulado_mes_usd: number;
  registrado_por: string;
};

export const COLUMNAS_REGISTRO_UIF: readonly (keyof FilaRegistroUif)[] = [
  "fecha",
  "expediente",
  "tipo_operacion",
  "origen",
  "moneda",
  "monto",
  "monto_usd",
  "cuenta",
  "cliente_tipo",
  "cliente_nombre",
  "cliente_documento",
  "contraparte",
  "referencia_documental",
  "concepto",
  "motivo_registro",
  "acumulado_mes_usd",
  "registrado_por",
];

export const ENCABEZADOS_REGISTRO_UIF: Record<keyof FilaRegistroUif, string> = {
  fecha: "Fecha",
  expediente: "Expediente",
  tipo_operacion: "Tipo de operación",
  origen: "Origen",
  moneda: "Moneda",
  monto: "Monto",
  monto_usd: "Monto USD",
  cuenta: "Cuenta",
  cliente_tipo: "Tipo de cliente",
  cliente_nombre: "Cliente",
  cliente_documento: "Documento del cliente",
  contraparte: "Contraparte",
  referencia_documental: "Referencia documental",
  concepto: "Concepto",
  motivo_registro: "Motivo de registro",
  acumulado_mes_usd: "Acumulado del mes USD",
  registrado_por: "Registrado por",
};

const TIPO_OPERACION_LABEL: Record<TipoMovimiento, string> = {
  deposito: "Depósito",
  pago: "Pago",
  devolucion: "Devolución",
  ajuste: "Ajuste",
};

const MOTIVO_LABEL: Record<MotivoUif, string> = {
  individual: "Individual ≥ umbral",
  acumulado: "Múltiple: acumulado del mes ≥ umbral",
};

export function filasRegistroUif(operaciones: readonly OperacionReportable[]): FilaRegistroUif[] {
  return operaciones.map(({ movimiento: m, expediente: e, cliente: c, motivos, acumuladoMesUsd }) => ({
    fecha: m.fecha,
    expediente: e.codigo,
    tipo_operacion: TIPO_OPERACION_LABEL[m.tipo],
    origen: ORIGEN_LABEL[origenDe(m.tipo)],
    moneda: m.moneda ?? "USD",
    monto: redondear2(m.monto ?? m.montoUsd),
    monto_usd: redondear2(m.montoUsd),
    cuenta: CUENTA_LABEL_UIF[m.cuenta],
    cliente_tipo: c ? TIPO_CLIENTE_LABEL_UIF[c.tipo] : "",
    cliente_nombre: c?.razonSocial ?? "",
    cliente_documento: c ? (c.ruc ? `RUC ${c.ruc}` : c.dni ? `DNI ${c.dni}` : "") : "",
    contraparte: m.contraparteNombre ?? "",
    referencia_documental: m.documentoRef ?? "",
    concepto: m.concepto ?? "",
    motivo_registro: motivos.map((x) => MOTIVO_LABEL[x]).join(" y "),
    acumulado_mes_usd: acumuladoMesUsd,
    registrado_por: m.registradoPor ?? "",
  }));
}

/**
 * CSV para Excel en español: BOM UTF-8, separador `;`, decimales con coma y
 * comillas dobladas. Sin librerías.
 */
export function csvRegistroUif(filas: readonly FilaRegistroUif[]): string {
  const celda = (v: string | number): string => {
    if (typeof v === "number") return v.toFixed(2).replace(".", ",");
    // Una celda que empieza con = + - @ la interpretaría Excel como fórmula.
    const texto = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return `"${texto.replace(/"/g, '""')}"`;
  };
  const lineas = [COLUMNAS_REGISTRO_UIF.map((c) => celda(ENCABEZADOS_REGISTRO_UIF[c])).join(";")];
  for (const f of filas) lineas.push(COLUMNAS_REGISTRO_UIF.map((c) => celda(f[c])).join(";"));
  return "﻿" + lineas.join("\r\n") + "\r\n";
}
