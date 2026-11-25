/**
 * Carga el contexto completo de un expediente DESDE EL SERVIDOR con
 * `DATABASE_URL`. SOLO para rutas que ya verificaron sesión y rol con
 * `verificarSesionPortal()` (generar un PDF no se puede hacer en el
 * navegador). Nunca para pintar pantallas: esa conexión salta RLS.
 *
 * Reutiliza los mismos mapeadores que el navegador (`lib/expedientes/mapeo`),
 * así el core recibe exactamente el mismo `ContextoExpediente`.
 */
import "server-only";

import type { ContextoExpediente } from "@/core/expedientes/tipos";
import { getSql } from "@/lib/db/client";
import type {
  ClienteRow,
  ContraparteRow,
  EmbarqueRow,
  ExpedienteAprobacionRow,
  ExpedienteDocumentoRow,
  ExpedienteEtapaRow,
  ExpedienteHitoRow,
  ExpedienteMovimientoRow,
  ExpedienteReservadoRow,
  ExpedienteRow,
  ExpedienteTareaRow,
} from "@/lib/db/types";
import {
  mapAprobacion,
  mapCliente,
  mapContraparte,
  mapDocumento,
  mapEmbarque,
  mapExpediente,
  mapHito,
  mapMovimiento,
  mapTarea,
  mapTramo,
} from "@/lib/expedientes/mapeo";

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: string): boolean {
  return RE_UUID.test(valor);
}

/**
 * El driver serverless devuelve las columnas `date` y `timestamptz` como
 * `Date`; la Data API (lo que ve el navegador) las devuelve como texto. El core
 * y los mapeadores esperan texto: una `date` (medianoche local, sin hora) pasa
 * a `YYYY-MM-DD` y un `timestamptz` a ISO completo.
 */
export function normalizarFechas<T extends Record<string, unknown>>(filas: T[]): T[] {
  return filas.map((fila) => {
    const salida: Record<string, unknown> = { ...fila };
    for (const [k, v] of Object.entries(salida)) {
      if (!(v instanceof Date)) continue;
      const esSoloFecha = v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0 && v.getMilliseconds() === 0;
      salida[k] = esSoloFecha
        ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
        : v.toISOString();
    }
    return salida as T;
  });
}

/** `null` si el expediente no existe o no hay conexión. Lanza solo por fallo de red/base. */
export async function cargarContextoServidor(expedienteId: string): Promise<ContextoExpediente | null> {
  const sql = getSql();
  if (!sql || !esUuid(expedienteId)) return null;

  const expedientes = normalizarFechas((await sql`select * from public.expedientes where id = ${expedienteId}::uuid limit 1`) as Record<string, unknown>[]) as unknown as ExpedienteRow[];
  const fila = expedientes[0];
  if (!fila) return null;

  const filas = async <T>(q: Promise<unknown>) => normalizarFechas((await q) as Record<string, unknown>[]) as T[];
  const [clientes, reservado, embarques, tareas, hitos, etapas, aprobaciones, documentos, movimientos] = await Promise.all([
    filas<ClienteRow>(sql`select * from public.clientes where id = ${fila.cliente_id}::uuid limit 1`),
    filas<ExpedienteReservadoRow>(sql`select * from public.expedientes_reservado where expediente_id = ${expedienteId}::uuid limit 1`),
    fila.embarque_id
      ? filas<EmbarqueRow>(sql`select * from public.embarques where id = ${fila.embarque_id}::uuid limit 1`)
      : Promise.resolve([] as EmbarqueRow[]),
    filas<ExpedienteTareaRow>(sql`select * from public.expediente_tareas where expediente_id = ${expedienteId}::uuid order by orden`),
    filas<ExpedienteHitoRow>(sql`select * from public.expediente_hitos where expediente_id = ${expedienteId}::uuid`),
    filas<ExpedienteEtapaRow>(sql`select * from public.expediente_etapas where expediente_id = ${expedienteId}::uuid order by desde`),
    filas<ExpedienteAprobacionRow>(sql`select * from public.expediente_aprobaciones where expediente_id = ${expedienteId}::uuid`),
    filas<ExpedienteDocumentoRow>(sql`select * from public.expediente_documentos where expediente_id = ${expedienteId}::uuid order by tipo, version desc`),
    filas<ExpedienteMovimientoRow>(sql`select * from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid order by fecha, created_at`),
  ]);

  const r = reservado[0] ?? null;
  const emb = embarques[0] ?? null;
  // Terceros del expediente y los que cobraron algún pago del libro (la rendición los nombra).
  const ids = [
    ...new Set(
      [r?.vendedor_id, r?.inspector_id, r?.agente_aduana_id, emb?.forwarder_id, emb?.aseguradora_id, ...movimientos.map((m) => m.contraparte_id)].filter(
        (x): x is string => Boolean(x),
      ),
    ),
  ];
  const contrapartes =
    ids.length > 0
      ? (normalizarFechas((await sql`select * from public.contrapartes where id = any(${ids}::uuid[])`) as Record<string, unknown>[]) as unknown as ContraparteRow[])
      : [];

  return {
    expediente: mapExpediente(fila, r),
    cliente: clientes[0] ? mapCliente(clientes[0]) : null,
    embarque: emb ? mapEmbarque(emb) : null,
    tareas: tareas.map(mapTarea),
    hitos: hitos.map(mapHito),
    etapas: etapas.map(mapTramo),
    aprobaciones: aprobaciones.map(mapAprobacion),
    movimientos: movimientos.map(mapMovimiento),
    documentos: documentos.map(mapDocumento),
    contrapartes: contrapartes.map(mapContraparte),
  };
}
