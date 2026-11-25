/**
 * Expedientes de importación del CLIENTE, desde el navegador con su sesión.
 *
 * El cliente no lee las tablas base: lee las vistas `expediente_cliente`,
 * `expediente_tarea_cliente`, `expediente_evento_cliente`,
 * `expediente_hito_cliente`, `expediente_etapa_cliente`,
 * `expediente_aprobacion_cliente`, `embarque_cliente`,
 * `expediente_documento_cliente` y `expediente_movimiento_cliente`, que
 * filtran por propiedad adentro y exponen solo lo que le corresponde
 * (migraciones 0016 a 0018). Los archivos de los
 * documentos se bajan por `/api/cuenta/expedientes/archivos`.
 * Sus acciones van por `cliente_accion_expediente`.
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import type {
  Cliente,
  ContextoExpediente,
  Evento,
  Hito,
  Tarea,
  TipoAprobacion,
} from "@/core/expedientes/tipos";
import type {
  EmbarqueClienteRow,
  ExpedienteAprobacionRow,
  ExpedienteDocumentoRow,
  ExpedienteEtapaRow,
  ExpedienteEventoRow,
  ExpedienteHitoRow,
  ExpedienteMovimientoRow,
  ExpedienteRow,
  ExpedienteTareaRow,
} from "@/lib/db/types";
import {
  COLUMNAS,
  mapAprobacion,
  mapDocumento,
  mapEmbarqueCliente,
  mapEvento,
  mapExpediente,
  mapHito,
  mapMovimiento,
  mapTarea,
  mapTramo,
} from "@/lib/expedientes/mapeo";
import type { PortalClient } from "@/lib/portal/portalClient";

export type ResumenImportacion = {
  expediente: ContextoExpediente["expediente"];
  /** Tareas suyas pendientes (lo que "necesitamos de ti"). */
  pendientes: Tarea[];
  hitos: Hito[];
};

export type ListaResultado<T> = { data: T[]; error: boolean };

type FilaClienteCuenta = {
  id: string;
  tipo: string;
  razon_social: string;
  ruc: string | null;
  email: string | null;
  telefono: string | null;
  representante: string | null;
};

export async function fetchMisImportaciones(client: PortalClient): Promise<ListaResultado<ResumenImportacion>> {
  try {
    const [exp, tareas, hitos] = await Promise.all([
      client.from("expediente_cliente").select(COLUMNAS.expedienteCliente).order("created_at", { ascending: false }).limit(20),
      client.from("expediente_tarea_cliente").select(COLUMNAS.tareaCliente).eq("estado", "pendiente").eq("responsable", "cliente"),
      client.from("expediente_hito_cliente").select(COLUMNAS.hitoCliente),
    ]);
    if (exp.error || !exp.data) return { data: [], error: true };
    const pendientes = ((tareas.data ?? []) as unknown as ExpedienteTareaRow[]).map(mapTarea);
    const hitosRows = (hitos.data ?? []) as unknown as ExpedienteHitoRow[];
    return {
      data: ((exp.data ?? []) as unknown as ExpedienteRow[]).map((row) => ({
        expediente: mapExpediente(row),
        pendientes: pendientes.filter((t) => t.expedienteId === row.id),
        hitos: hitosRows.filter((h) => h.expediente_id === row.id).map(mapHito),
      })),
      error: false,
    };
  } catch {
    return { data: [], error: true };
  }
}

export async function cargarMiImportacion(
  client: PortalClient,
  codigo: string,
): Promise<{ ctx: ContextoExpediente | null; eventos: Evento[]; error: boolean }> {
  try {
    const { data, error } = await client.from("expediente_cliente").select(COLUMNAS.expedienteCliente).eq("codigo", codigo).maybeSingle();
    if (error) return { ctx: null, eventos: [], error: true };
    if (!data) return { ctx: null, eventos: [], error: false };
    const row = data as unknown as ExpedienteRow;
    const [tareas, hitos, etapas, eventos, aprobaciones, embarque, cliente, documentos, movimientos] = await Promise.all([
      client.from("expediente_tarea_cliente").select(COLUMNAS.tareaCliente).eq("expediente_id", row.id).order("orden"),
      client.from("expediente_hito_cliente").select(COLUMNAS.hitoCliente).eq("expediente_id", row.id),
      client.from("expediente_etapa_cliente").select(COLUMNAS.etapaHistCliente).eq("expediente_id", row.id).order("desde"),
      client.from("expediente_evento_cliente").select(COLUMNAS.eventoCliente).eq("expediente_id", row.id).order("created_at", { ascending: false }).limit(100),
      client.from("expediente_aprobacion_cliente").select(COLUMNAS.aprobacion).eq("expediente_id", row.id),
      client.from("embarque_cliente").select(COLUMNAS.embarqueCliente).eq("expediente_id", row.id).maybeSingle(),
      client.from("cliente_cuenta").select("id, tipo, razon_social, ruc, email, telefono, representante").eq("id", row.cliente_id).maybeSingle(),
      client.from("expediente_documento_cliente").select(COLUMNAS.documentoCliente).eq("expediente_id", row.id).order("created_at", { ascending: false }),
      client.from("expediente_movimiento_cliente").select(COLUMNAS.movimientoCliente).eq("expediente_id", row.id).order("fecha").order("created_at"),
    ]);
    const c = (cliente.data ?? null) as FilaClienteCuenta | null;
    const ctx: ContextoExpediente = {
      expediente: mapExpediente(row),
      cliente: c ? clienteParcial(c) : null,
      embarque: embarque.data ? mapEmbarqueCliente(embarque.data as unknown as EmbarqueClienteRow) : null,
      tareas: ((tareas.data ?? []) as unknown as ExpedienteTareaRow[]).map((t) => mapTarea({ ...t, visible_cliente: true })),
      hitos: ((hitos.data ?? []) as unknown as ExpedienteHitoRow[]).map(mapHito),
      etapas: ((etapas.data ?? []) as unknown as ExpedienteEtapaRow[]).map(mapTramo),
      aprobaciones: ((aprobaciones.data ?? []) as unknown as ExpedienteAprobacionRow[]).map(mapAprobacion),
      movimientos: ((movimientos.data ?? []) as unknown as ExpedienteMovimientoRow[]).map(mapMovimiento),
      documentos: ((documentos.data ?? []) as unknown as ExpedienteDocumentoRow[]).map(mapDocumento),
    };
    return {
      ctx,
      eventos: ((eventos.data ?? []) as unknown as ExpedienteEventoRow[]).map((e) => mapEvento({ ...e, visible_cliente: true })),
      error: false,
    };
  } catch {
    return { ctx: null, eventos: [], error: true };
  }
}

/** La vista del cliente no trae KYC ni notas: se completa con nulos. */
function clienteParcial(c: FilaClienteCuenta): Cliente {
  return {
    id: c.id,
    tipo: c.tipo === "persona" ? "persona" : "empresa",
    razonSocial: c.razon_social,
    ruc: c.ruc,
    dni: null,
    domicilio: null,
    partida: null,
    representante: c.representante,
    representanteDni: null,
    representanteCargo: null,
    email: c.email,
    telefono: c.telefono,
    actividad: null,
    bancoOrigen: null,
    beneficiarioFinal: null,
    origenFondos: null,
    esPep: false,
    kycFichaRucEn: null,
    kycVigenciaEn: null,
    kycListasEn: null,
    kycListasResultado: null,
    kycCompleto: false,
    userId: null,
    notasInternas: null,
    createdAt: "",
    updatedAt: "",
  };
}

const MSG_GENERICO = "No se pudo registrar tu respuesta. Intenta de nuevo o escríbenos por WhatsApp.";

export async function accionCliente(
  client: PortalClient,
  input: { expedienteId: string; tipo: TipoAprobacion; payload?: Record<string, unknown> },
): Promise<{ ok: boolean; message: string }> {
  try {
    const payload = {
      ...(input.payload ?? {}),
      agente_usuario: typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 300),
    };
    const { error } = await client.rpc("cliente_accion_expediente", {
      p_expediente: input.expedienteId,
      p_tipo: input.tipo,
      p_payload: payload,
    });
    if (error) {
      const m = (error.message ?? "").trim();
      // `raise exception` de la función: ya viene en español para el cliente.
      return { ok: false, message: error.code === "P0001" && m ? m : MSG_GENERICO };
    }
    return { ok: true, message: "Listo, quedó registrado. El equipo lo ve en tu expediente." };
  } catch {
    return { ok: false, message: MSG_GENERICO };
  }
}

/** URL de descarga de un documento visible (redirige a una URL firmada de cinco minutos). */
export function urlDescargaDocumentoCliente(documentoId: string): string {
  return `/api/cuenta/expedientes/archivos?documento=${encodeURIComponent(documentoId)}`;
}

/* -------------------------------------------------------------------------- */
/* Dinero (fase 3): "Ya transferí"                                            */
/* -------------------------------------------------------------------------- */

export const BYTES_MAXIMOS_COMPROBANTE = 10 * 1024 * 1024;
export const TIPOS_COMPROBANTE = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * Sube el comprobante del depósito al bucket privado: pide la URL firmada a
 * `/api/cuenta/expedientes/comprobantes` (que comprueba que el expediente sea
 * suyo) y sube directo. Devuelve el `path` para `declarar_deposito`.
 */
export async function subirComprobanteCliente(input: { expedienteId: string; archivo: File }): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  if (!TIPOS_COMPROBANTE.includes(input.archivo.type)) return { ok: false, message: "El comprobante tiene que ser un PDF o una imagen (JPEG, PNG, WebP o HEIC)." };
  if (input.archivo.size === 0) return { ok: false, message: "El archivo está vacío." };
  if (input.archivo.size > BYTES_MAXIMOS_COMPROBANTE) return { ok: false, message: "El comprobante supera los 10 MB permitidos." };
  try {
    const permiso = await fetch("/api/cuenta/expedientes/comprobantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ expedienteId: input.expedienteId, contentType: input.archivo.type, bytes: input.archivo.size }),
    });
    const datos = (await permiso.json().catch(() => ({}))) as Record<string, unknown>;
    if (!permiso.ok || datos.ok !== true || typeof datos.url !== "string" || typeof datos.path !== "string") {
      return { ok: false, message: typeof datos.mensaje === "string" ? datos.mensaje : "No se pudo preparar la subida del comprobante." };
    }
    const subida = await fetch(datos.url, { method: "PUT", headers: { "Content-Type": input.archivo.type }, body: input.archivo });
    if (!subida.ok) return { ok: false, message: "No se pudo subir el comprobante. Inténtalo de nuevo o envíalo por WhatsApp." };
    return { ok: true, path: datos.path };
  } catch {
    return { ok: false, message: "No se pudo subir el comprobante. Revisa tu conexión." };
  }
}

export type DeclaracionDeposito = {
  hito: "H1" | "H2" | "H3" | "H4";
  monto: number;
  fecha: string;
  banco: string;
  operacion?: string;
  comprobante?: File | null;
};

/** "Ya transferí": sube el comprobante (si hay) y declara el depósito; queda por confirmar hasta que el equipo lo acredite. */
export async function declararDeposito(client: PortalClient, input: { expedienteId: string; datos: DeclaracionDeposito }): Promise<{ ok: boolean; message: string }> {
  const d = input.datos;
  if (!(d.monto > 0)) return { ok: false, message: "Escribe el monto que transferiste." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) return { ok: false, message: "Indica la fecha de la transferencia." };
  if (d.banco.trim().length < 2) return { ok: false, message: "Indica el banco desde el que transferiste." };
  let comprobantePath: string | undefined;
  if (d.comprobante) {
    const subida = await subirComprobanteCliente({ expedienteId: input.expedienteId, archivo: d.comprobante });
    if (!subida.ok) return subida;
    comprobantePath = subida.path;
  }
  const r = await accionCliente(client, {
    expedienteId: input.expedienteId,
    tipo: "declarar_deposito",
    payload: { hito: d.hito, monto: d.monto, fecha: d.fecha, banco: d.banco.trim(), operacion: d.operacion?.trim() || undefined, comprobante_path: comprobantePath },
  });
  if (!r.ok) return r;
  return { ok: true, message: "Gracias. Registramos tu depósito como pendiente de confirmar: en cuanto se acredite te enviamos la constancia." };
}

/** URL de descarga del comprobante de un movimiento suyo (redirige a una URL firmada de cinco minutos). */
export function urlDescargaComprobanteCliente(movimientoId: string): string {
  return `/api/cuenta/expedientes/archivos?movimiento=${encodeURIComponent(movimientoId)}`;
}
