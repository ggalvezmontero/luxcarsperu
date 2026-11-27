/**
 * Consultas del módulo de cotizaciones desde el navegador, con la sesión del
 * equipo (Data API + RLS `(select es_admin())`). Las escrituras van por las
 * funciones SQL de `20261128120000_cotizaciones.sql`; el PDF, por la ruta de
 * servidor `/api/portal/cotizaciones/[id]/documento` (exige `storage:write`).
 */

import {
  calcularCotizacion,
  importadorCompleto,
  importadorDe,
  type ClienteCotizacion,
  type DatosCotizacion,
  type EstadoCotizacion,
  type ResultadoCotizacion,
} from "@/core/cotizaciones";
import type { EtapaExpediente } from "@/core/expedientes/tipos";
import { cargarCliente, describirError, type Resultado, type ResultadoId } from "@/lib/expedientes/consultas";
import type { PortalClient } from "@/lib/portal/portalClient";
import { datosExpedienteDesdeCotizacion, type OpcionesAceptar } from "./aExpediente";

const MSG_RED = "No se pudo completar. Revisa tu conexión e intenta de nuevo.";
const MSG_MIGRACION = "Verifica tu sesión y que la migración 20261128120000_cotizaciones.sql esté aplicada (y la caché de la Data API refrescada).";

export type Cotizacion = {
  id: string;
  codigo: string;
  estado: EstadoCotizacion;
  cliente: ClienteCotizacion;
  datos: DatosCotizacion;
  resultado: ResultadoCotizacion | null;
  totalUsd: number | null;
  fecha: string;
  venceEl: string | null;
  enviadaEn: string | null;
  aceptadaEn: string | null;
  rechazadaEn: string | null;
  motivo: string | null;
  tienePdf: boolean;
  documentoVersion: number;
  documentoGeneradoEn: string | null;
  expedienteIds: string[];
  notasInternas: string | null;
  createdAt: string;
};

type Fila = {
  id: string;
  codigo: string;
  estado: EstadoCotizacion;
  cliente_tipo: "persona" | "empresa";
  cliente_nombre: string;
  cliente_documento: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  cliente_id: string | null;
  datos: DatosCotizacion;
  resultado: ResultadoCotizacion | null;
  total_usd: number | string | null;
  fecha: string;
  vence_el: string | null;
  enviada_en: string | null;
  aceptada_en: string | null;
  rechazada_en: string | null;
  motivo: string | null;
  ruta_pdf: string | null;
  documento_version: number;
  documento_generado_en: string | null;
  expediente_ids: string[] | null;
  notas_internas: string | null;
  created_at: string;
};

const COLUMNAS =
  "id, codigo, estado, cliente_tipo, cliente_nombre, cliente_documento, cliente_email, cliente_telefono, cliente_id, datos, resultado, total_usd, fecha, vence_el, enviada_en, aceptada_en, rechazada_en, motivo, ruta_pdf, documento_version, documento_generado_en, expediente_ids, notas_internas, created_at";

function mapear(f: Fila): Cotizacion {
  return {
    id: f.id,
    codigo: f.codigo,
    estado: f.estado,
    cliente: {
      tipo: f.cliente_tipo,
      nombre: f.cliente_nombre,
      documento: f.cliente_documento ?? "",
      email: f.cliente_email ?? "",
      telefono: f.cliente_telefono ?? "",
      clienteId: f.cliente_id,
    },
    datos: f.datos,
    resultado: f.resultado,
    totalUsd: f.total_usd === null ? null : Number(f.total_usd),
    fecha: f.fecha,
    venceEl: f.vence_el,
    enviadaEn: f.enviada_en,
    aceptadaEn: f.aceptada_en,
    rechazadaEn: f.rechazada_en,
    motivo: f.motivo,
    tienePdf: Boolean(f.ruta_pdf),
    documentoVersion: f.documento_version,
    documentoGeneradoEn: f.documento_generado_en,
    expedienteIds: f.expediente_ids ?? [],
    notasInternas: f.notas_internas,
    createdAt: f.created_at,
  };
}

function error(m: string | undefined | null): string {
  const t = (m ?? "").trim();
  if (/schema cache/i.test(t)) return `La Data API no conoce la tabla todavía. ${MSG_MIGRACION}`;
  if (/[áéíóúñ¿¡]|cotizaci|auto|importador|RUC/i.test(t)) return t;
  return describirError(t);
}

export async function listarCotizaciones(client: PortalClient): Promise<{ cotizaciones: Cotizacion[]; error: string | null }> {
  try {
    const { data, error: e } = await client.from("cotizaciones").select(COLUMNAS).order("created_at", { ascending: false }).limit(300);
    if (e) return { cotizaciones: [], error: `No se pudieron leer las cotizaciones. ${MSG_MIGRACION}` };
    return { cotizaciones: ((data ?? []) as unknown as Fila[]).map(mapear), error: null };
  } catch {
    return { cotizaciones: [], error: MSG_RED };
  }
}

export type ExpedienteDeCotizacion = { id: string; codigo: string; etapa: EtapaExpediente; auto: number | null; vehiculo: string; embarqueId: string | null };

export async function cargarCotizacion(
  client: PortalClient,
  id: string,
): Promise<{ cotizacion: Cotizacion | null; expedientes: ExpedienteDeCotizacion[]; error: string | null }> {
  try {
    const [q, ex] = await Promise.all([
      client.from("cotizaciones").select(COLUMNAS).eq("id", id).maybeSingle(),
      client
        .from("expedientes")
        .select("id, codigo, etapa, cotizacion_auto, veh_marca, veh_modelo, veh_anio, embarque_id")
        .eq("cotizacion_id", id)
        .order("cotizacion_auto", { ascending: true }),
    ]);
    if (q.error) return { cotizacion: null, expedientes: [], error: `No se pudo leer la cotización. ${MSG_MIGRACION}` };
    const expedientes = ((ex.data ?? []) as unknown as {
      id: string;
      codigo: string;
      etapa: EtapaExpediente;
      cotizacion_auto: number | null;
      veh_marca: string;
      veh_modelo: string;
      veh_anio: number;
      embarque_id: string | null;
    }[]).map((e) => ({ id: e.id, codigo: e.codigo, etapa: e.etapa, auto: e.cotizacion_auto, vehiculo: `${e.veh_marca} ${e.veh_modelo} ${e.veh_anio}`, embarqueId: e.embarque_id }));
    return { cotizacion: q.data ? mapear(q.data as unknown as Fila) : null, expedientes, error: null };
  } catch {
    return { cotizacion: null, expedientes: [], error: MSG_RED };
  }
}

export type EntradaGuardar = {
  cliente: ClienteCotizacion;
  datos: DatosCotizacion;
  notasInternas: string;
};

/** Crea (id nulo) o edita en borrador. Calcula antes de guardar: la foto del cálculo queda en `resultado`. */
export async function guardarCotizacion(client: PortalClient, id: string | null, e: EntradaGuardar): Promise<ResultadoId> {
  let resultado: ResultadoCotizacion;
  try {
    resultado = calcularCotizacion(e.datos);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "No se pudo calcular la cotización." };
  }
  try {
    const { data, error: er } = await client.rpc("guardar_cotizacion", {
      p_id: id,
      p_datos: {
        cliente_tipo: e.cliente.tipo,
        cliente_nombre: e.cliente.nombre.trim(),
        cliente_documento: e.cliente.documento.trim() || null,
        cliente_email: e.cliente.email.trim() || null,
        cliente_telefono: e.cliente.telefono.trim() || null,
        cliente_id: e.cliente.clienteId ?? null,
        datos: e.datos,
        resultado,
        total_usd: resultado.total,
        notas_internas: e.notasInternas.trim() || null,
      },
    });
    if (er) return { ok: false, message: error(er.message) };
    return { ok: true, message: id ? "Cotización guardada." : "Cotización creada.", id: typeof data === "string" ? data : id ?? undefined };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function cambiarEstadoCotizacion(
  client: PortalClient,
  id: string,
  estado: "enviada" | "rechazada" | "vencida" | "borrador",
  motivo?: string,
): Promise<Resultado> {
  try {
    const { error: er } = await client.rpc("cambiar_estado_cotizacion", { p_id: id, p_estado: estado, p_motivo: motivo?.trim() || null });
    if (er) return { ok: false, message: error(er.message) };
    const msg = { enviada: "Marcada como enviada: vale 15 días.", rechazada: "Marcada como rechazada.", vencida: "Marcada como vencida.", borrador: "De vuelta a borrador." }[estado];
    return { ok: true, message: msg };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/**
 * Acepta la cotización: busca o crea la ficha de cada importador, arma los
 * datos de cada expediente con el core (mismas cifras) y los abre en una sola
 * transacción con `aceptar_cotizacion`.
 */
export async function aceptarCotizacion(client: PortalClient, q: Cotizacion, opciones: OpcionesAceptar): Promise<Resultado & { expedienteIds?: string[] }> {
  let resultado: ResultadoCotizacion;
  try {
    resultado = calcularCotizacion(q.datos);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "No se pudo calcular la cotización." };
  }
  const incompleto = q.datos.autos.findIndex((a) => !importadorCompleto(importadorDe(a, q.cliente)));
  if (incompleto >= 0) {
    return { ok: false, message: `Auto ${incompleto + 1}: para aceptar falta la razón social o el nombre del importador y su RUC (11 dígitos) o DNI.` };
  }
  try {
    const { data: ids, error: e1 } = await client.rpc("clientes_de_cotizacion", { p_id: q.id });
    if (e1) return { ok: false, message: error(e1.message) };
    const clienteIds = (Array.isArray(ids) ? ids : []) as string[];
    if (clienteIds.length !== q.datos.autos.length) return { ok: false, message: "No se pudieron preparar las fichas de los importadores." };
    const unicos = [...new Set(clienteIds)];
    const clientes = new Map((await Promise.all(unicos.map(async (cid) => [cid, await cargarCliente(client, cid)] as const))).map(([k, v]) => [k, v]));
    const expedientes = [];
    for (const [i, auto] of q.datos.autos.entries()) {
      const cliente = clientes.get(clienteIds[i]);
      if (!cliente) return { ok: false, message: "No se pudo leer la ficha de un importador." };
      expedientes.push(datosExpedienteDesdeCotizacion({ codigo: q.codigo, datos: q.datos, auto, resultado: resultado.autos[i], cliente, opciones }));
    }
    const { data, error: e2 } = await client.rpc("aceptar_cotizacion", { p_id: q.id, p_expedientes: expedientes });
    if (e2) return { ok: false, message: error(e2.message) };
    const creados = (Array.isArray(data) ? data : []) as string[];
    return { ok: true, message: creados.length === 1 ? "Cotización aceptada: expediente abierto." : `Cotización aceptada: ${creados.length} expedientes abiertos.`, expedienteIds: creados };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/**
 * Fija el importador de cada auto (pendiente hasta aceptar) sin tocar cifras;
 * vale también en una cotización enviada.
 */
export async function completarImportadores(client: PortalClient, id: string, importadores: ClienteCotizacion[]): Promise<Resultado> {
  try {
    const { error: er } = await client.rpc("completar_importadores_cotizacion", {
      p_id: id,
      p_importadores: importadores.map((c) => ({ tipo: c.tipo, nombre: c.nombre.trim(), documento: c.documento.replace(/\s/g, ""), email: c.email.trim(), telefono: c.telefono.trim() })),
    });
    if (er) return { ok: false, message: error(er.message) };
    return { ok: true, message: "Importadores guardados." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/** Genera (o regenera) el PDF y el DOCX en el bucket privado. */
export async function generarDocumentoCotizacion(id: string): Promise<Resultado & { version?: number }> {
  try {
    const r = await fetch(`/api/portal/cotizaciones/${encodeURIComponent(id)}/documento`, { method: "POST", credentials: "same-origin" });
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; mensaje?: string; version?: number };
    if (!r.ok || d.ok !== true) return { ok: false, message: d.mensaje ?? "No se pudo generar el documento." };
    return { ok: true, message: `Documento generado (versión ${d.version}).`, version: d.version };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export function urlDescargaCotizacion(id: string, formato: "pdf" | "docx"): string {
  return `/api/portal/cotizaciones/${encodeURIComponent(id)}/documento?formato=${formato}`;
}
