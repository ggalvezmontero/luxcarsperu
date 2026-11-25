/**
 * Expedientes de importación, vistos por el EQUIPO. Desde el navegador con la
 * sesión de un administrador: las políticas "el equipo …" de la migración 0016
 * son el candado. Sin rol admin, cero filas.
 *
 * Lo transaccional va por las funciones SQL (`crear_expediente`,
 * `avanzar_expediente`, `completar_tarea`, `vincular_cliente_cuenta`); lo
 * demás son lecturas y actualizaciones simples por la Data API.
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import type {
  Cliente,
  Contraparte,
  ContextoExpediente,
  Documento,
  Embarque,
  EtapaExpediente,
  Evento,
  Movimiento,
  TareaNueva,
} from "@/core/expedientes/tipos";
import type {
  ClienteRow,
  ContraparteRow,
  EmbarqueRow,
  ExpedienteAprobacionRow,
  ExpedienteDocumentoRow,
  ExpedienteEtapaRow,
  ExpedienteEventoRow,
  ExpedienteHitoRow,
  ExpedienteMovimientoRow,
  ExpedienteReservadoRow,
  ExpedienteRow,
  ExpedienteTareaRow,
  ProfileRow,
} from "@/lib/db/types";
import { PROFILE_COLUMNS, mapProfile, type Profile } from "@/lib/auth/perfil";
import type { PortalClient } from "@/lib/portal/portalClient";
import {
  COLUMNAS,
  mapAprobacion,
  mapCliente,
  mapContraparte,
  mapDocumento,
  mapEmbarque,
  mapEvento,
  mapExpediente,
  mapHito,
  mapMovimiento,
  mapTarea,
  mapTramo,
} from "./mapeo";

export type Resultado = { ok: boolean; message: string };
export type ResultadoId = Resultado & { id?: string };

const MSG_RED = "No se pudo completar. Revisa tu conexión e intenta de nuevo.";
const MSG_MIGRACION = "Verifica tu sesión y que la migración 20261125090000_expedientes.sql esté aplicada (y la caché de la Data API refrescada).";

/** Los mensajes de las funciones SQL ya vienen en español; el resto se resume. */
export function describirError(message: string | undefined | null): string {
  const m = (message ?? "").trim();
  if (!m) return MSG_RED;
  if (/[áéíóúñ¿¡]|expediente|administrador|cliente|etapa|motivo/i.test(m)) return m;
  if (/schema cache/i.test(m)) return `La Data API no conoce la tabla todavía. ${MSG_MIGRACION}`;
  return "La base de datos rechazó la operación. " + m;
}

type Embebido = ExpedienteRow & {
  clientes?: ClienteRow | ClienteRow[] | null;
  embarques?: EmbarqueRow | EmbarqueRow[] | null;
  expedientes_reservado?: ExpedienteReservadoRow | ExpedienteReservadoRow[] | null;
  expediente_tareas?: ExpedienteTareaRow[] | null;
  expediente_hitos?: ExpedienteHitoRow[] | null;
  expediente_etapas?: ExpedienteEtapaRow[] | null;
  expediente_eventos?: ExpedienteEventoRow[] | null;
  expediente_aprobaciones?: ExpedienteAprobacionRow[] | null;
  expediente_documentos?: ExpedienteDocumentoRow[] | null;
  expediente_movimientos?: ExpedienteMovimientoRow[] | null;
};

function uno<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function aContexto(row: Embebido): ContextoExpediente {
  const cliente = uno(row.clientes);
  const embarque = uno(row.embarques);
  return {
    expediente: mapExpediente(row, uno(row.expedientes_reservado)),
    cliente: cliente ? mapCliente(cliente) : null,
    embarque: embarque ? mapEmbarque(embarque) : null,
    tareas: (row.expediente_tareas ?? []).map(mapTarea).sort((a, b) => a.orden - b.orden),
    hitos: (row.expediente_hitos ?? []).map(mapHito),
    etapas: (row.expediente_etapas ?? []).map(mapTramo).sort((a, b) => a.desde.localeCompare(b.desde)),
    aprobaciones: (row.expediente_aprobaciones ?? []).map(mapAprobacion),
    movimientos: (row.expediente_movimientos ?? [])
      .map(mapMovimiento)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.createdAt ?? "").localeCompare(b.createdAt ?? "")),
    documentos: (row.expediente_documentos ?? [])
      .map(mapDocumento)
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || b.version - a.version),
  };
}

const EMBED_TABLERO = [
  COLUMNAS.expediente,
  `clientes:cliente_id ( ${COLUMNAS.cliente} )`,
  `embarques:embarque_id ( ${COLUMNAS.embarque} )`,
  `expediente_tareas ( ${COLUMNAS.tarea} )`,
  `expediente_hitos ( ${COLUMNAS.hito} )`,
  `expediente_movimientos ( ${COLUMNAS.movimiento} )`,
].join(", ");

const EMBED_DETALLE = [
  EMBED_TABLERO,
  `expedientes_reservado ( ${COLUMNAS.reservado} )`,
  `expediente_etapas ( ${COLUMNAS.etapaHist} )`,
  `expediente_aprobaciones ( ${COLUMNAS.aprobacion} )`,
  `expediente_documentos ( ${COLUMNAS.documento} )`,
].join(", ");

/* -------------------------------------------------------------------------- */
/* Lecturas                                                                   */
/* -------------------------------------------------------------------------- */

export async function listarExpedientes(
  client: PortalClient,
  opciones: { incluirCerrados?: boolean } = {},
): Promise<{ expedientes: ContextoExpediente[]; error: string | null }> {
  try {
    let query = client.from("expedientes").select(EMBED_TABLERO).order("etapa_desde", { ascending: false }).limit(200);
    if (!opciones.incluirCerrados) query = query.not("etapa", "in", "(cerrado,cancelado)");
    const { data, error } = await query;
    if (error) return { expedientes: [], error: `No se pudieron leer los expedientes. ${MSG_MIGRACION} (${error.message})` };
    return { expedientes: ((data ?? []) as unknown as Embebido[]).map(aContexto), error: null };
  } catch {
    return { expedientes: [], error: "No se pudieron leer los expedientes. Revisa tu conexión." };
  }
}

export async function cargarExpediente(
  client: PortalClient,
  id: string,
): Promise<{ ctx: ContextoExpediente | null; error: string | null }> {
  try {
    const { data, error } = await client.from("expedientes").select(EMBED_DETALLE).eq("id", id).maybeSingle();
    if (error) return { ctx: null, error: `No se pudo leer el expediente. ${MSG_MIGRACION} (${error.message})` };
    if (!data) return { ctx: null, error: null };
    const ctx = aContexto(data as unknown as Embebido);
    // Los terceros del expediente (vendedor, inspector, agente, forwarder):
    // los nombran los documentos. Una sola consulta por sus ids.
    const ids = [
      ...new Set(
        [
          ctx.expediente.reservado?.vendedorId,
          ctx.expediente.reservado?.inspectorId,
          ctx.expediente.reservado?.agenteAduanaId,
          ctx.embarque?.forwarderId,
          ctx.embarque?.aseguradoraId,
          ...ctx.movimientos.map((m) => m.contraparteId),
        ].filter((x): x is string => Boolean(x)),
      ),
    ];
    if (ids.length > 0) {
      const terceros = await client.from("contrapartes").select(COLUMNAS.contraparte).in("id", ids);
      ctx.contrapartes = ((terceros.data ?? []) as unknown as ContraparteRow[]).map(mapContraparte);
    } else {
      ctx.contrapartes = [];
    }
    return { ctx, error: null };
  } catch {
    return { ctx: null, error: "No se pudo leer el expediente. Revisa tu conexión." };
  }
}

export async function listarEventos(
  client: PortalClient,
  expedienteId: string,
): Promise<{ eventos: Evento[]; error: string | null }> {
  try {
    const { data, error } = await client
      .from("expediente_eventos")
      .select(COLUMNAS.evento)
      .eq("expediente_id", expedienteId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) return { eventos: [], error: describirError(error.message) };
    return { eventos: ((data ?? []) as unknown as ExpedienteEventoRow[]).map(mapEvento), error: null };
  } catch {
    return { eventos: [], error: MSG_RED };
  }
}

export async function listarClientes(
  client: PortalClient,
  busqueda = "",
): Promise<{ clientes: Cliente[]; error: string | null }> {
  const texto = busqueda.replace(/[%,()]/g, " ").trim().slice(0, 80);
  try {
    let query = client.from("clientes").select(COLUMNAS.cliente).order("razon_social", { ascending: true }).limit(200);
    if (texto) {
      query = query.or([`razon_social.ilike.*${texto}*`, `ruc.ilike.*${texto}*`, `dni.ilike.*${texto}*`, `email.ilike.*${texto}*`].join(","));
    }
    const { data, error } = await query;
    if (error) return { clientes: [], error: `No se pudieron leer los clientes. ${MSG_MIGRACION}` };
    return { clientes: ((data ?? []) as unknown as ClienteRow[]).map(mapCliente), error: null };
  } catch {
    return { clientes: [], error: "No se pudieron leer los clientes. Revisa tu conexión." };
  }
}

export async function cargarCliente(client: PortalClient, id: string): Promise<Cliente | null> {
  try {
    const { data, error } = await client.from("clientes").select(COLUMNAS.cliente).eq("id", id).maybeSingle();
    if (error || !data) return null;
    return mapCliente(data as unknown as ClienteRow);
  } catch {
    return null;
  }
}

/** Expedientes de un cliente, para su ficha. Solo lo necesario para listar. */
export async function listarExpedientesDeCliente(
  client: PortalClient,
  clienteId: string,
): Promise<{ id: string; codigo: string; etapa: EtapaExpediente; auto: string }[]> {
  try {
    const { data, error } = await client
      .from("expedientes")
      .select("id, codigo, etapa, veh_marca, veh_modelo, veh_anio")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return ((data ?? []) as unknown as Pick<ExpedienteRow, "id" | "codigo" | "etapa" | "veh_marca" | "veh_modelo" | "veh_anio">[]).map((r) => ({
      id: r.id,
      codigo: r.codigo,
      etapa: r.etapa as EtapaExpediente,
      auto: `${r.veh_marca} ${r.veh_modelo} ${r.veh_anio}`,
    }));
  } catch {
    return [];
  }
}

export async function listarEmbarques(client: PortalClient): Promise<{ embarques: Embarque[]; error: string | null }> {
  try {
    const { data, error } = await client.from("embarques").select(COLUMNAS.embarque).order("created_at", { ascending: false }).limit(100);
    if (error) return { embarques: [], error: describirError(error.message) };
    return { embarques: ((data ?? []) as unknown as EmbarqueRow[]).map(mapEmbarque), error: null };
  } catch {
    return { embarques: [], error: MSG_RED };
  }
}

export async function listarContrapartes(client: PortalClient): Promise<Contraparte[]> {
  try {
    const { data, error } = await client.from("contrapartes").select(COLUMNAS.contraparte).order("nombre").limit(200);
    if (error) return [];
    return ((data ?? []) as unknown as ContraparteRow[]).map(mapContraparte);
  } catch {
    return [];
  }
}

/** Datos mínimos de una contraparte nueva (la gestión completa llega en la fase 4). */
export type DatosContraparte = {
  tipo: string;
  nombre: string;
  pais?: string | null;
  direccion?: string | null;
  contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  ruc_o_tax_id?: string | null;
};

export async function crearContraparte(client: PortalClient, datos: DatosContraparte): Promise<ResultadoId> {
  if (datos.nombre.trim().length < 2) return { ok: false, message: "Escribe el nombre de la contraparte." };
  try {
    const { data, error } = await client.from("contrapartes").insert(limpiar(datos)).select("id").single();
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: "Contraparte creada.", id: (data as { id?: string } | null)?.id };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/** Cuentas de /cuenta que coinciden con un correo (para vincular a mano). */
export async function buscarPerfiles(client: PortalClient, texto: string): Promise<Profile[]> {
  const limpio = texto.replace(/[%,()]/g, " ").trim().slice(0, 80);
  if (!limpio) return [];
  try {
    const { data, error } = await client
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .or([`email.ilike.*${limpio}*`, `nombre.ilike.*${limpio}*`].join(","))
      .limit(10);
    if (error) return [];
    return ((data ?? []) as unknown as ProfileRow[]).map(mapProfile);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Escrituras                                                                 */
/* -------------------------------------------------------------------------- */

/** Lo que recibe `crear_expediente(p_datos)`. Columnas en español, como el esquema. */
export type DatosCrearExpediente = {
  cliente_id: string;
  etapa?: "prospecto" | "contrato";
  origen_solicitud_id?: string | null;
  embarque_id?: string | null;
  embarque_nuevo?: {
    modalidad: string;
    contenedor?: string | null;
    puerto_origen?: string | null;
    puerto_destino?: string | null;
    fecha_release_est?: string | null;
    fecha_zarpe_est?: string | null;
    fecha_arribo_est?: string | null;
    almacen_consolidacion?: string | null;
  } | null;
  proporcion_flete: number;
  veh_marca: string;
  veh_modelo: string;
  veh_version?: string | null;
  veh_anio: number;
  veh_vin?: string | null;
  veh_color?: string | null;
  veh_km?: number | null;
  veh_combustible?: string | null;
  veh_cilindrada_cc?: number | null;
  veh_transmision?: string | null;
  veh_condicion: string;
  veh_categoria: string;
  veh_origen: string;
  veh_pais_ensamblaje?: string | null;
  veh_doc_propiedad?: string | null;
  moneda_compra: string;
  precio_compra?: number | null;
  precio_compra_usd?: number | null;
  precio_tope?: number | null;
  tc_compra_ref?: number | null;
  fecha_limite_compra?: string | null;
  pais_origen?: string | null;
  puerto_origen?: string | null;
  presupuesto?: unknown;
  honorarios_usd?: number | null;
  honorarios_base_usd?: number | null;
  honorarios_igv_usd?: number | null;
  margen_h3?: number;
  fecha_limite_h2?: string | null;
  fecha_est_embarque?: string | null;
  fecha_est_arribo?: string | null;
  fecha_est_entrega?: string | null;
  semanas_estimadas?: string | null;
  notas_internas?: string | null;
  hitos?: { tipo: string; monto_estimado_usd: number; fecha_limite: string | null; cuenta: string; nota: string | null }[];
  tareas?: TareaJson[];
};

export type TareaJson = {
  etapa: string;
  clave: string;
  titulo: string;
  descripcion: string | null;
  responsable: string;
  estado: string;
  vence_el: string | null;
  visible_cliente: boolean;
  orden: number;
};

export function tareasAJson(tareas: readonly TareaNueva[]): TareaJson[] {
  return tareas.map((t) => ({
    etapa: t.etapa,
    clave: t.clave,
    titulo: t.titulo,
    descripcion: t.descripcion,
    responsable: t.responsable,
    estado: t.estado,
    vence_el: t.venceEl,
    visible_cliente: t.visibleCliente,
    orden: t.orden,
  }));
}

export async function crearExpediente(client: PortalClient, datos: DatosCrearExpediente): Promise<ResultadoId> {
  try {
    const { data, error } = await client.rpc("crear_expediente", { p_datos: datos });
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: "Expediente abierto.", id: typeof data === "string" ? data : undefined };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function avanzarExpediente(
  client: PortalClient,
  input: { id: string; destino: EtapaExpediente; tareas: readonly TareaNueva[]; forzado: boolean; motivo: string | null },
): Promise<Resultado> {
  try {
    const { error } = await client.rpc("avanzar_expediente", {
      p_id: input.id,
      p_destino: input.destino,
      p_tareas: tareasAJson(input.tareas),
      p_forzado: input.forzado,
      p_motivo: input.motivo?.trim() || null,
    });
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: input.destino === "cancelado" ? "Expediente cancelado." : "Etapa avanzada." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function completarTarea(
  client: PortalClient,
  input: { tareaId: string; estado: "hecha" | "no_aplica" | "pendiente" },
): Promise<Resultado> {
  try {
    const { error } = await client.rpc("completar_tarea", { p_tarea: input.tareaId, p_documento: null, p_estado: input.estado });
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: input.estado === "pendiente" ? "Tarea reabierta." : "Tarea actualizada." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function agregarNota(
  client: PortalClient,
  input: { expedienteId: string; texto: string; visibleCliente: boolean },
): Promise<Resultado> {
  const texto = input.texto.trim();
  if (texto.length < 2) return { ok: false, message: "Escribe la nota." };
  try {
    const { data: userData } = await client.auth.getUser();
    const { error } = await client.from("expediente_eventos").insert({
      expediente_id: input.expedienteId,
      tipo: "nota",
      titulo: input.visibleCliente ? "Mensaje de Luxcars" : "Nota interna",
      detalle: texto.slice(0, 4000),
      visible_cliente: input.visibleCliente,
      actor_id: userData.user?.id ?? null,
      actor_tipo: "admin",
    });
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: input.visibleCliente ? "Mensaje publicado en la cuenta del cliente." : "Nota guardada." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/** Cambia columnas sueltas del expediente (fechas, DAM, placa…). Sin reglas: eso lo hace el core al leer. */
export async function actualizarExpediente(
  client: PortalClient,
  id: string,
  cambios: Partial<ExpedienteRow>,
): Promise<Resultado> {
  try {
    const { error } = await client.from("expedientes").update(cambios).eq("id", id);
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: "Expediente actualizado." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function actualizarReservado(
  client: PortalClient,
  id: string,
  cambios: Partial<ExpedienteReservadoRow>,
): Promise<Resultado> {
  try {
    const { error } = await client
      .from("expedientes_reservado")
      .upsert({ ...cambios, expediente_id: id }, { onConflict: "expediente_id" });
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: "Datos reservados actualizados." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function actualizarEmbarque(
  client: PortalClient,
  id: string,
  cambios: Partial<EmbarqueRow>,
): Promise<Resultado> {
  try {
    const { error } = await client.from("embarques").update(cambios).eq("id", id);
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: "Embarque actualizado." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export type DatosCliente = Partial<Omit<ClienteRow, "id" | "created_at" | "updated_at" | "kyc_completo" | "user_id">> & {
  razon_social: string;
};

export async function crearCliente(client: PortalClient, datos: DatosCliente): Promise<ResultadoId> {
  try {
    const { data: userData } = await client.auth.getUser();
    const { data, error } = await client
      .from("clientes")
      .insert({ ...limpiar(datos), created_by: userData.user?.id ?? null })
      .select("id")
      .single();
    if (error) return { ok: false, message: describirErrorCliente(error.message) };
    return { ok: true, message: "Cliente creado.", id: (data as { id?: string } | null)?.id };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function actualizarCliente(client: PortalClient, id: string, datos: Partial<DatosCliente>): Promise<Resultado> {
  try {
    const { error } = await client.from("clientes").update(limpiar(datos)).eq("id", id);
    if (error) return { ok: false, message: describirErrorCliente(error.message) };
    return { ok: true, message: "Cliente actualizado." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function vincularCuenta(client: PortalClient, input: { clienteId: string; userId: string | null }): Promise<Resultado> {
  try {
    const { error } = await client.rpc("vincular_cliente_cuenta", { p_cliente: input.clienteId, p_user: input.userId });
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: input.userId ? "Cuenta vinculada: el cliente ya ve su expediente en luxcars.pe/cuenta." : "Cuenta desvinculada." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

function describirErrorCliente(message: string): string {
  if (/clientes_ruc_unico/i.test(message)) return "Ya existe un cliente con ese RUC.";
  if (/clientes_identificado/i.test(message)) return "El cliente necesita RUC o DNI.";
  if (/email/i.test(message) && /check/i.test(message)) return "El correo no parece válido.";
  if (/ruc/i.test(message) && /check/i.test(message)) return "El RUC tiene once dígitos.";
  return describirError(message);
}

/** Vacíos → null, para que los CHECK de la base no reciban cadenas vacías. */
function limpiar<T extends Record<string, unknown>>(obj: T): T {
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    salida[k] = typeof v === "string" ? v.trim() || null : v;
  }
  return salida as T;
}

/* -------------------------------------------------------------------------- */
/* Documentos (fase 2)                                                        */
/* -------------------------------------------------------------------------- */

/** Documentos de un expediente, todas las versiones, por tipo y versión descendente. */
export async function listarDocumentos(client: PortalClient, expedienteId: string): Promise<{ documentos: Documento[]; error: string | null }> {
  try {
    const { data, error } = await client
      .from("expediente_documentos")
      .select(COLUMNAS.documento)
      .eq("expediente_id", expedienteId)
      .order("tipo")
      .order("version", { ascending: false });
    if (error) return { documentos: [], error: describirError(error.message) };
    return { documentos: ((data ?? []) as unknown as ExpedienteDocumentoRow[]).map(mapDocumento), error: null };
  } catch {
    return { documentos: [], error: MSG_RED };
  }
}

/** Mostrar u ocultar un documento en la cuenta del cliente. El archivo sigue saliendo solo por URL firmada. */
export async function cambiarVisibilidadDocumento(
  client: PortalClient,
  input: { documentoId: string; visibleCliente: boolean },
): Promise<Resultado> {
  try {
    const { error } = await client
      .from("expediente_documentos")
      .update({ visible_cliente: input.visibleCliente })
      .eq("id", input.documentoId);
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: input.visibleCliente ? "El cliente ya ve este documento en su cuenta." : "Documento oculto para el cliente." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/**
 * Lo que devuelve `/api/portal/expedientes/[id]/documentos` al generar. Las URL
 * firmadas duran cinco minutos: son para abrir el archivo recién generado.
 */
export type DocumentoGenerado = { documentoId: string; version: number; urls: { pdf: string | null; docx: string | null } };

export type ResultadoGenerar =
  | ({ ok: true; message: string } & DocumentoGenerado)
  | { ok: false; message: string; faltantes?: string[] };

/** Genera (o regenera) un documento desde su plantilla: PDF y DOCX al bucket privado y la fila con el snapshot. */
export async function generarDocumento(
  input: { expedienteId: string; tipo: string; extra: Record<string, string>; visibleCliente: boolean },
): Promise<ResultadoGenerar> {
  try {
    const respuesta = await fetch(`/api/portal/expedientes/${encodeURIComponent(input.expedienteId)}/documentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ tipo: input.tipo, extra: input.extra, visibleCliente: input.visibleCliente }),
    });
    const datos = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
    if (!respuesta.ok || datos.ok !== true) {
      return {
        ok: false,
        message: typeof datos.mensaje === "string" ? datos.mensaje : "No se pudo generar el documento.",
        faltantes: Array.isArray(datos.faltantes) ? (datos.faltantes as string[]) : undefined,
      };
    }
    const urls = (datos.urls ?? {}) as { pdf?: unknown; docx?: unknown };
    return {
      ok: true,
      message: `Documento generado (versión ${String(datos.version)}).`,
      documentoId: String(datos.documentoId),
      version: Number(datos.version),
      urls: { pdf: typeof urls.pdf === "string" ? urls.pdf : null, docx: typeof urls.docx === "string" ? urls.docx : null },
    };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/** Datos fijos de Luxcars y sus cuentas (variable de entorno del servidor), para la vista previa. */
export async function cargarCamposFijos(expedienteId: string): Promise<Record<string, string>> {
  try {
    const respuesta = await fetch(`/api/portal/expedientes/${encodeURIComponent(expedienteId)}/documentos`, { credentials: "same-origin", cache: "no-store" });
    const datos = (await respuesta.json().catch(() => ({}))) as { fijos?: unknown };
    return datos.fijos && typeof datos.fijos === "object" ? (datos.fijos as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Tope del PDF firmado que acepta `/api/portal/expedientes/[id]/archivos`. */
export const BYTES_MAXIMOS_FIRMADO = 15 * 1024 * 1024;

/**
 * Sube el PDF firmado de un documento: pide la URL firmada al servidor, sube
 * directo al bucket privado y pide que se registre (`estado = firmado`).
 */
export async function subirDocumentoFirmado(
  input: { expedienteId: string; documentoId: string; archivo: File; firmadoEn: string | null },
): Promise<Resultado> {
  if (input.archivo.type !== "application/pdf") return { ok: false, message: "El firmado tiene que ser un PDF." };
  if (input.archivo.size === 0) return { ok: false, message: "El archivo está vacío." };
  if (input.archivo.size > BYTES_MAXIMOS_FIRMADO) return { ok: false, message: "El PDF supera los 15 MB permitidos." };
  const ruta = `/api/portal/expedientes/${encodeURIComponent(input.expedienteId)}/archivos`;
  try {
    const permiso = await fetch(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ documentoId: input.documentoId, contentType: "application/pdf", bytes: input.archivo.size }),
    });
    const datos = (await permiso.json().catch(() => ({}))) as Record<string, unknown>;
    if (!permiso.ok || datos.ok !== true || typeof datos.url !== "string") {
      return { ok: false, message: typeof datos.mensaje === "string" ? datos.mensaje : "No se pudo preparar la subida." };
    }
    const subida = await fetch(datos.url, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: input.archivo });
    if (!subida.ok) return { ok: false, message: "El almacenamiento rechazó el archivo. Vuelve a intentarlo." };

    const registro = await fetch(ruta, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ documentoId: input.documentoId, firmadoEn: input.firmadoEn }),
    });
    const r = (await registro.json().catch(() => ({}))) as Record<string, unknown>;
    if (!registro.ok || r.ok !== true) {
      return { ok: false, message: typeof r.mensaje === "string" ? r.mensaje : "El archivo subió pero no se pudo registrar." };
    }
    return { ok: true, message: "Firmado archivado: el documento pasó a estado firmado." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/** URL de descarga (redirige a una URL firmada de cinco minutos). */
export function urlDescargaDocumento(documentoId: string, formato: "pdf" | "docx" | "firmado"): string {
  return `/api/portal/expedientes/archivos?documento=${encodeURIComponent(documentoId)}&formato=${formato}`;
}

/* -------------------------------------------------------------------------- */
/* Dinero (fase 3)                                                            */
/* -------------------------------------------------------------------------- */

/** Movimientos de un expediente (todos los estados), por fecha. */
export async function listarMovimientos(client: PortalClient, expedienteId: string): Promise<{ movimientos: Movimiento[]; error: string | null }> {
  try {
    const { data, error } = await client
      .from("expediente_movimientos")
      .select(COLUMNAS.movimiento)
      .eq("expediente_id", expedienteId)
      .order("fecha")
      .order("created_at");
    if (error) return { movimientos: [], error: describirError(error.message) };
    return { movimientos: ((data ?? []) as unknown as ExpedienteMovimientoRow[]).map(mapMovimiento), error: null };
  } catch {
    return { movimientos: [], error: MSG_RED };
  }
}

/** Lo que recibe `registrar_movimiento` para un asiento nuevo. Columnas en español, como el esquema. */
export type DatosMovimiento = {
  tipo: "deposito" | "pago" | "devolucion" | "ajuste";
  cuenta: "fondos_clientes" | "operaciones" | "detracciones";
  hito?: "H1" | "H2" | "H3" | "H4" | null;
  fecha: string;
  moneda: string;
  monto: number;
  tipo_cambio?: number | null;
  contraparte_id?: string | null;
  concepto?: string | null;
  documento_ref?: string | null;
  nota_interna?: string | null;
};

export type ConstanciaEmitida = { documentoId: string; version: number; urls: { pdf: string | null; docx: string | null } };
export type ResultadoMovimiento = Resultado & { movimientoId?: string; constancia?: ConstanciaEmitida; constanciaError?: string };

async function llamarMovimientos(expedienteId: string, cuerpo: Record<string, unknown>, mensajeOk: string): Promise<ResultadoMovimiento> {
  try {
    const respuesta = await fetch(`/api/portal/expedientes/${encodeURIComponent(expedienteId)}/movimientos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(cuerpo),
    });
    const datos = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
    if (!respuesta.ok || datos.ok !== true) {
      return { ok: false, message: typeof datos.mensaje === "string" ? datos.mensaje : "No se pudo registrar el movimiento." };
    }
    const constancia = datos.constancia as ConstanciaEmitida | undefined;
    const constanciaError = typeof datos.constanciaError === "string" ? datos.constanciaError : undefined;
    return {
      ok: true,
      message: constancia ? `${mensajeOk} Constancia emitida (versión ${constancia.version}), visible para el cliente.` : constanciaError ? `${mensajeOk} ${constanciaError}` : mensajeOk,
      movimientoId: typeof datos.movimientoId === "string" ? datos.movimientoId : undefined,
      constancia,
      constanciaError,
    };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/** Registra un asiento confirmado. Si es un depósito con hito, el servidor emite la constancia. */
export async function registrarMovimiento(input: { expedienteId: string; movimiento: DatosMovimiento; constancia?: boolean }): Promise<ResultadoMovimiento> {
  if (!(input.movimiento.monto > 0)) return { ok: false, message: "El monto debe ser mayor que cero." };
  return llamarMovimientos(input.expedienteId, { accion: "registrar", movimiento: limpiar(input.movimiento as unknown as Record<string, unknown>), constancia: input.constancia ?? true }, "Movimiento registrado.");
}

/** Confirma un depósito declarado por el cliente (admite corregir monto, fecha y tipo de cambio) y emite la constancia. */
export async function confirmarDeposito(input: { expedienteId: string; movimientoId: string; cambios?: Partial<DatosMovimiento> }): Promise<ResultadoMovimiento> {
  return llamarMovimientos(input.expedienteId, { accion: "confirmar", movimientoId: input.movimientoId, movimiento: limpiar((input.cambios ?? {}) as Record<string, unknown>) }, "Depósito confirmado.");
}

export async function anularDeposito(input: { expedienteId: string; movimientoId: string; motivo: string }): Promise<ResultadoMovimiento> {
  if (input.motivo.trim().length < 5) return { ok: false, message: "Escribe el motivo (mínimo cinco caracteres)." };
  return llamarMovimientos(input.expedienteId, { accion: "anular", movimientoId: input.movimientoId, motivo: input.motivo.trim() }, "Depósito anulado; el cliente lo ve en su actividad.");
}

/** Tope del comprobante que acepta `/api/portal/expedientes/[id]/archivos` con `destino: "comprobante"`. */
export const BYTES_MAXIMOS_COMPROBANTE = 10 * 1024 * 1024;
export const TIPOS_COMPROBANTE = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

/** Sube el comprobante de un movimiento: URL firmada → PUT directo al bucket privado → registrar la ruta. */
export async function subirComprobanteMovimiento(input: { expedienteId: string; movimientoId: string; archivo: File }): Promise<Resultado> {
  if (!TIPOS_COMPROBANTE.includes(input.archivo.type)) return { ok: false, message: "El comprobante tiene que ser un PDF o una imagen." };
  if (input.archivo.size === 0) return { ok: false, message: "El archivo está vacío." };
  if (input.archivo.size > BYTES_MAXIMOS_COMPROBANTE) return { ok: false, message: "El comprobante supera los 10 MB permitidos." };
  const ruta = `/api/portal/expedientes/${encodeURIComponent(input.expedienteId)}/archivos`;
  try {
    const permiso = await fetch(ruta, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ destino: "comprobante", movimientoId: input.movimientoId, contentType: input.archivo.type, bytes: input.archivo.size }),
    });
    const datos = (await permiso.json().catch(() => ({}))) as Record<string, unknown>;
    if (!permiso.ok || datos.ok !== true || typeof datos.url !== "string") {
      return { ok: false, message: typeof datos.mensaje === "string" ? datos.mensaje : "No se pudo preparar la subida." };
    }
    const subida = await fetch(datos.url, { method: "PUT", headers: { "Content-Type": input.archivo.type }, body: input.archivo });
    if (!subida.ok) return { ok: false, message: "El almacenamiento rechazó el archivo. Vuelve a intentarlo." };
    const registro = await fetch(ruta, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ destino: "comprobante", movimientoId: input.movimientoId, contentType: input.archivo.type }),
    });
    const r = (await registro.json().catch(() => ({}))) as Record<string, unknown>;
    if (!registro.ok || r.ok !== true) return { ok: false, message: typeof r.mensaje === "string" ? r.mensaje : "El archivo subió pero no se pudo registrar." };
    return { ok: true, message: "Comprobante archivado." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/** URL de descarga del comprobante de un movimiento (redirige a una URL firmada de cinco minutos). */
export function urlDescargaComprobante(movimientoId: string): string {
  return `/api/portal/expedientes/archivos?movimiento=${encodeURIComponent(movimientoId)}`;
}

/**
 * Emite un documento del libro (aviso H3, liquidación definitiva, acta,
 * rendición): mismos campos que `generarDocumento`, sin formulario. Lo escrito
 * a mano (fecha del aviso, TC referencial, fecha de la rendición) va en `extra`.
 */
export async function emitirDocumentoDelLibro(input: { expedienteId: string; tipo: string; extra?: Record<string, string>; movimientoId?: string }): Promise<ResultadoGenerar> {
  try {
    const respuesta = await fetch(`/api/portal/expedientes/${encodeURIComponent(input.expedienteId)}/documentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ tipo: input.tipo, extra: input.extra ?? {}, visibleCliente: true, movimientoId: input.movimientoId }),
    });
    const datos = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
    if (!respuesta.ok || datos.ok !== true) {
      return {
        ok: false,
        message: typeof datos.mensaje === "string" ? datos.mensaje : "No se pudo emitir el documento.",
        faltantes: Array.isArray(datos.faltantes) ? (datos.faltantes as string[]) : undefined,
      };
    }
    const urls = (datos.urls ?? {}) as { pdf?: unknown; docx?: unknown };
    return {
      ok: true,
      message: `Documento emitido (versión ${String(datos.version)}).`,
      documentoId: String(datos.documentoId),
      version: Number(datos.version),
      urls: { pdf: typeof urls.pdf === "string" ? urls.pdf : null, docx: typeof urls.docx === "string" ? urls.docx : null },
    };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}
