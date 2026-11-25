/**
 * Métricas del negocio sobre los expedientes: cuántos por mes y por etapa,
 * cuánto dura cada etapa, cuánto dinero hay en custodia, qué está vencido.
 *
 * TypeScript puro sobre datos ya leídos (por la Data API con la sesión del
 * administrador). No decide nada; solo cuenta y agrupa. `hoy` siempre se pasa
 * para que las pruebas sean deterministas.
 */

import { saldoCuenta } from "./ledger";
import type { EtapaExpediente, FechaIso, Hito, Movimiento, TramoEtapa } from "./tipos";
import { ETAPAS_ORDEN } from "./tipos";

const MS_DIA = 86_400_000;

/** Lo mínimo del expediente que necesitan las métricas. */
export type ExpedienteMetrica = {
  id: string;
  codigo: string;
  etapa: EtapaExpediente;
  etapaDesde: string;
  createdAt: string;
  cerradoEn: string | null;
  fechaEstArribo: FechaIso | null;
  clienteNombre: string | null;
  auto: string;
};

export function esActivo(etapa: EtapaExpediente): boolean {
  return etapa !== "cerrado" && etapa !== "cancelado";
}

export function mesDeFecha(iso: string): string {
  return iso.slice(0, 7);
}

/* -------------------------------------------------------------------------- */
/* Expedientes por mes                                                        */
/* -------------------------------------------------------------------------- */

export type FilaMes = { mes: string; abiertos: number; cerrados: number; cancelados: number };

/**
 * Por mes calendario: cuántos se abrieron (`createdAt`), cuántos se cerraron
 * y cuántos se cancelaron (`cerradoEn`, que `avanzar_expediente` fija en ambos
 * casos). Meses ordenados de más antiguo a más reciente; se incluyen los meses
 * sin nada entre el primero y el último para que la gráfica no salte.
 */
export function expedientesPorMes(expedientes: readonly ExpedienteMetrica[]): FilaMes[] {
  const mapa = new Map<string, FilaMes>();
  const fila = (mes: string) => {
    let f = mapa.get(mes);
    if (!f) {
      f = { mes, abiertos: 0, cerrados: 0, cancelados: 0 };
      mapa.set(mes, f);
    }
    return f;
  };
  for (const e of expedientes) {
    fila(mesDeFecha(e.createdAt)).abiertos += 1;
    if (e.cerradoEn) {
      if (e.etapa === "cerrado") fila(mesDeFecha(e.cerradoEn)).cerrados += 1;
      else if (e.etapa === "cancelado") fila(mesDeFecha(e.cerradoEn)).cancelados += 1;
    }
  }
  if (mapa.size === 0) return [];
  const meses = [...mapa.keys()].sort();
  const salida: FilaMes[] = [];
  let [anio, mes] = meses[0].split("-").map(Number);
  const ultimo = meses[meses.length - 1];
  for (;;) {
    const clave = `${anio}-${String(mes).padStart(2, "0")}`;
    salida.push(mapa.get(clave) ?? { mes: clave, abiertos: 0, cerrados: 0, cancelados: 0 });
    if (clave >= ultimo) break;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }
  return salida;
}

/* -------------------------------------------------------------------------- */
/* Expedientes por etapa (foto de hoy)                                        */
/* -------------------------------------------------------------------------- */

export type FilaEtapa = { etapa: EtapaExpediente; cantidad: number };

export function expedientesPorEtapa(expedientes: readonly ExpedienteMetrica[]): FilaEtapa[] {
  const orden: EtapaExpediente[] = [...ETAPAS_ORDEN, "cancelado"];
  return orden.map((etapa) => ({ etapa, cantidad: expedientes.filter((e) => e.etapa === etapa).length }));
}

/* -------------------------------------------------------------------------- */
/* Días por etapa                                                             */
/* -------------------------------------------------------------------------- */

export type DuracionEtapa = {
  etapa: EtapaExpediente;
  /** Tramos considerados (cerrados + abiertos a hoy). */
  tramos: number;
  promedioDias: number | null;
  medianaDias: number | null;
  maxDias: number | null;
};

export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(desde).getTime();
  const b = new Date(hasta).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, (b - a) / MS_DIA);
}

export function mediana(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((x, y) => x - y);
  const m = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function redondear1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Duración por etapa a partir del historial (`expediente_etapas`). Un tramo
 * sin `hasta` (la etapa actual) cuenta hasta `hoy`: así una etapa que lleva
 * 40 días abierta sube el promedio en vez de desaparecer. `cerrado` y
 * `cancelado` no tienen duración: se omiten.
 */
export function duracionPorEtapa(tramos: readonly TramoEtapa[], hoy: Date): DuracionEtapa[] {
  const ahora = hoy.toISOString();
  return ETAPAS_ORDEN.filter((e) => e !== "cerrado").map((etapa) => {
    const dias = tramos.filter((t) => t.etapa === etapa).map((t) => diasEntre(t.desde, t.hasta ?? ahora));
    if (dias.length === 0) return { etapa, tramos: 0, promedioDias: null, medianaDias: null, maxDias: null };
    const suma = dias.reduce((s, d) => s + d, 0);
    return {
      etapa,
      tramos: dias.length,
      promedioDias: redondear1(suma / dias.length),
      medianaDias: redondear1(mediana(dias) ?? 0),
      maxDias: redondear1(Math.max(...dias)),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Dinero en custodia                                                         */
/* -------------------------------------------------------------------------- */

export type CustodiaExpediente = {
  expediente: ExpedienteMetrica;
  /** Saldo de `fondos_clientes` (depósitos − pagos − devoluciones, solo confirmados). */
  saldoUsd: number;
  /** Depósitos declarados por el cliente que el equipo no confirmó. */
  porConfirmarUsd: number;
  porConfirmar: number;
};

export type ResumenCustodia = {
  totalUsd: number;
  porConfirmarUsd: number;
  porConfirmar: number;
  filas: CustodiaExpediente[];
};

/**
 * Saldo de Fondos de Clientes por expediente ACTIVO. Los cerrados ya rindieron
 * cuentas (saldo cero por compuerta) y los cancelados devolvieron; si uno
 * quedara con saldo distinto de cero, se lista aparte en `fueraDeActivos`.
 */
export function dineroEnCustodia(
  expedientes: readonly ExpedienteMetrica[],
  movimientosPorExpediente: ReadonlyMap<string, readonly Movimiento[]>,
): ResumenCustodia & { fueraDeActivos: CustodiaExpediente[] } {
  const filas: CustodiaExpediente[] = [];
  const fueraDeActivos: CustodiaExpediente[] = [];
  for (const e of expedientes) {
    const movs = movimientosPorExpediente.get(e.id) ?? [];
    const saldoUsd = Math.round(saldoCuenta(movs, "fondos_clientes") * 100) / 100;
    const pendientes = movs.filter((m) => m.estado === "por_confirmar" && m.tipo === "deposito");
    const fila: CustodiaExpediente = {
      expediente: e,
      saldoUsd,
      porConfirmarUsd: Math.round(pendientes.reduce((s, m) => s + m.montoUsd, 0) * 100) / 100,
      porConfirmar: pendientes.length,
    };
    if (esActivo(e.etapa)) filas.push(fila);
    else if (saldoUsd !== 0) fueraDeActivos.push(fila);
  }
  filas.sort((a, b) => b.saldoUsd - a.saldoUsd);
  return {
    totalUsd: Math.round(filas.reduce((s, f) => s + f.saldoUsd, 0) * 100) / 100,
    porConfirmarUsd: Math.round(filas.reduce((s, f) => s + f.porConfirmarUsd, 0) * 100) / 100,
    porConfirmar: filas.reduce((s, f) => s + f.porConfirmar, 0),
    filas,
    fueraDeActivos,
  };
}

/* -------------------------------------------------------------------------- */
/* Hitos vencidos y próximo arribo                                            */
/* -------------------------------------------------------------------------- */

export type HitoVencido = { expediente: ExpedienteMetrica; hito: Hito; faltaUsd: number; diasVencido: number };

/**
 * Hitos con fecha límite pasada y monto sin acreditar (misma tolerancia de un
 * dólar que el core de hitos), solo en expedientes activos.
 */
export function hitosVencidos(
  expedientes: readonly ExpedienteMetrica[],
  hitosPorExpediente: ReadonlyMap<string, readonly Hito[]>,
  movimientosPorExpediente: ReadonlyMap<string, readonly Movimiento[]>,
  hoy: Date,
): HitoVencido[] {
  const hoyIso = hoy.toISOString().slice(0, 10);
  const salida: HitoVencido[] = [];
  for (const e of expedientes) {
    if (!esActivo(e.etapa)) continue;
    const movs = movimientosPorExpediente.get(e.id) ?? [];
    for (const h of hitosPorExpediente.get(e.id) ?? []) {
      if (!h.fechaLimite || h.fechaLimite >= hoyIso) continue;
      const acreditado = movs
        .filter((m) => m.estado === "confirmado" && m.tipo === "deposito" && m.hito === h.tipo)
        .reduce((s, m) => s + m.montoUsd, 0);
      const falta = h.montoEstimadoUsd - acreditado;
      if (falta <= 1) continue;
      salida.push({ expediente: e, hito: h, faltaUsd: Math.round(falta * 100) / 100, diasVencido: Math.floor(diasEntre(h.fechaLimite, hoyIso)) });
    }
  }
  return salida.sort((a, b) => b.diasVencido - a.diasVencido);
}

export type ProximoArribo = { expediente: ExpedienteMetrica; fecha: FechaIso; enDias: number };

/** Expedientes activos con fecha estimada de arribo de hoy en adelante, el más cercano primero. */
export function proximosArribos(expedientes: readonly ExpedienteMetrica[], hoy: Date, maximo = 5): ProximoArribo[] {
  const hoyIso = hoy.toISOString().slice(0, 10);
  return expedientes
    .filter((e) => esActivo(e.etapa) && e.fechaEstArribo && e.fechaEstArribo >= hoyIso)
    .map((e) => ({ expediente: e, fecha: e.fechaEstArribo!, enDias: Math.round(diasEntre(hoyIso, e.fechaEstArribo!)) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, maximo);
}
