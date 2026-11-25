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
  Embarque,
  EtapaExpediente,
  Evento,
  TareaNueva,
} from "@/core/expedientes/tipos";
import type {
  ClienteRow,
  ContraparteRow,
  EmbarqueRow,
  ExpedienteAprobacionRow,
  ExpedienteEtapaRow,
  ExpedienteEventoRow,
  ExpedienteHitoRow,
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
  mapEmbarque,
  mapEvento,
  mapExpediente,
  mapHito,
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
    movimientos: [],
    documentos: [],
  };
}

const EMBED_TABLERO = [
  COLUMNAS.expediente,
  `clientes:cliente_id ( ${COLUMNAS.cliente} )`,
  `embarques:embarque_id ( ${COLUMNAS.embarque} )`,
  `expediente_tareas ( ${COLUMNAS.tarea} )`,
  `expediente_hitos ( ${COLUMNAS.hito} )`,
].join(", ");

const EMBED_DETALLE = [
  EMBED_TABLERO,
  `expedientes_reservado ( ${COLUMNAS.reservado} )`,
  `expediente_etapas ( ${COLUMNAS.etapaHist} )`,
  `expediente_aprobaciones ( ${COLUMNAS.aprobacion} )`,
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
    return { ctx: aContexto(data as unknown as Embebido), error: null };
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
