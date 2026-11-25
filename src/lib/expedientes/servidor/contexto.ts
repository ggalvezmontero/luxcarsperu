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
  mapTarea,
  mapTramo,
} from "@/lib/expedientes/mapeo";

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: string): boolean {
  return RE_UUID.test(valor);
}

/** `null` si el expediente no existe o no hay conexión. Lanza solo por fallo de red/base. */
export async function cargarContextoServidor(expedienteId: string): Promise<ContextoExpediente | null> {
  const sql = getSql();
  if (!sql || !esUuid(expedienteId)) return null;

  const expedientes = (await sql`select * from public.expedientes where id = ${expedienteId}::uuid limit 1`) as unknown as ExpedienteRow[];
  const fila = expedientes[0];
  if (!fila) return null;

  const filas = <T>(q: Promise<unknown>) => q as Promise<T[]>;
  const [clientes, reservado, embarques, tareas, hitos, etapas, aprobaciones, documentos] = await Promise.all([
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
  ]);

  const r = reservado[0] ?? null;
  const emb = embarques[0] ?? null;
  const ids = [r?.vendedor_id, r?.inspector_id, r?.agente_aduana_id, emb?.forwarder_id, emb?.aseguradora_id].filter(
    (x): x is string => Boolean(x),
  );
  const contrapartes =
    ids.length > 0
      ? ((await sql`select * from public.contrapartes where id = any(${ids}::uuid[])`) as unknown as ContraparteRow[])
      : [];

  return {
    expediente: mapExpediente(fila, r),
    cliente: clientes[0] ? mapCliente(clientes[0]) : null,
    embarque: emb ? mapEmbarque(emb) : null,
    tareas: tareas.map(mapTarea),
    hitos: hitos.map(mapHito),
    etapas: etapas.map(mapTramo),
    aprobaciones: aprobaciones.map(mapAprobacion),
    movimientos: [],
    documentos: documentos.map(mapDocumento),
    contrapartes: contrapartes.map(mapContraparte),
  };
}
