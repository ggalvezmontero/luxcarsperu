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
  CuentaMovimiento,
  TipoHito,
  DatosBancarios,
  Documento,
  Embarque,
  EtapaExpediente,
  Evento,
  Hito,
  Movimiento,
  NotificacionRegistrada,
  TareaNueva,
  TramoEtapa,
} from "@/core/expedientes/tipos";
import type { ExpedienteMetrica } from "@/core/expedientes/metricas";
import type { FilaRegistroUif, UmbralesUif } from "@/core/expedientes/uif";
import type { DatosNotificacion, PlantillaNotificacion } from "@/core/expedientes/notificaciones";
import type { LineaReparto } from "@/core/expedientes/embarques";
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
  NotificacionRow,
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
  mapNotificacion,
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
      const terceros = await client.from("contrapartes").select(COLUMNAS.contraparteCompleta).in("id", ids);
      ctx.contrapartes = ((terceros.data ?? []) as unknown as ContraparteRow[]).map(mapContraparte);
    } else {
      ctx.contrapartes = [];
    }
    // Las otras unidades del mismo embarque (consolidado): las instrucciones
    // al forwarder nombran el VIN de la otra unidad.
    if (ctx.expediente.embarqueId) {
      const unidades = await client
        .from("expedientes")
        .select("id, codigo, veh_vin, veh_marca, veh_modelo")
        .eq("embarque_id", ctx.expediente.embarqueId)
        .neq("etapa", "cancelado")
        .order("codigo");
      ctx.unidadesDelEmbarque = ((unidades.data ?? []) as unknown as { id: string; codigo: string; veh_vin: string | null; veh_marca: string; veh_modelo: string }[]).map((u) => ({
        id: u.id,
        codigo: u.codigo,
        vin: u.veh_vin,
        marca: u.veh_marca,
        modelo: u.veh_modelo,
      }));
    } else {
      ctx.unidadesDelEmbarque = [];
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
  /** Un expediente nace en prospecto o en búsqueda (27 nov 2026). */
  etapa?: "prospecto" | "busqueda";
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
  /** 'M1' | 'N1'. */
  veh_clase?: string | null;
  moneda_compra: string;
  precio_compra?: number | null;
  precio_compra_usd?: number | null;
  precio_tope?: number | null;
  tc_compra_ref?: number | null;
  /** Dealer (emite factura y MSO), broker (recibe el pago) y agente de aduana: contrapartes reservadas. */
  vendedor_id?: string | null;
  broker_id?: string | null;
  agente_aduana_id?: string | null;
  fecha_limite_compra?: string | null;
  pais_origen?: string | null;
  puerto_origen?: string | null;
  presupuesto?: unknown;
  honorarios_usd?: number | null;
  honorarios_base_usd?: number | null;
  honorarios_igv_usd?: number | null;
  /** Solo usados. */
  costo_inspeccion_usd?: number | null;
  inspector_id?: string | null;
  fecha_firma?: string | null;
  fecha_release?: string | null;
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

/**
 * Lo que la vista previa pasa como `porDefecto`: los parámetros de la empresa
 * (/portal/configuracion, respaldo en la variable de entorno) y el tipo de
 * cambio referencial del día (`TC_REFERENCIAL`, 4 decimales; ausente si el
 * servicio falló). `null` si la ruta no respondió.
 */
export async function cargarCamposFijos(expedienteId: string): Promise<Record<string, string> | null> {
  try {
    const respuesta = await fetch(`/api/portal/expedientes/${encodeURIComponent(expedienteId)}/documentos`, { credentials: "same-origin", cache: "no-store" });
    const datos = (await respuesta.json().catch(() => ({}))) as { ok?: unknown; fijos?: unknown; tc?: unknown };
    if (datos.ok !== true) return null;
    const fijos = datos.fijos && typeof datos.fijos === "object" ? { ...(datos.fijos as Record<string, string>) } : {};
    if (typeof datos.tc === "string" && datos.tc) fijos.TC_REFERENCIAL = datos.tc;
    return fijos;
  } catch {
    return null;
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
  cuenta: CuentaMovimiento;
  hito?: TipoHito | null;
  fecha: string;
  moneda: string;
  monto: number;
  tipo_cambio?: number | null;
  contraparte_id?: string | null;
  concepto?: string | null;
  documento_ref?: string | null;
  nota_interna?: string | null;
  /** Al confirmar un pago directo a SUNAT (moneda PEN): el equivalente en USD según la DAM. */
  monto_usd?: number | null;
  /** Pago al exterior desde Fondos de Clientes: comisión que debita el banco y Luxcars repone el mismo día. */
  comision_bancaria_usd?: number | null;
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

/* -------------------------------------------------------------------------- */
/* Embarques, contrapartes y notificaciones (fase 4)                          */
/* -------------------------------------------------------------------------- */

/** Lo que una lista o un embarque necesita saber de cada expediente del grupo. */
export type ExpedienteDelEmbarque = {
  id: string;
  codigo: string;
  etapa: EtapaExpediente;
  auto: string;
  vin: string | null;
  cliente: string;
  clienteId: string;
  proporcionFlete: number;
  embarqueId: string | null;
};

type FilaResumen = Pick<ExpedienteRow, "id" | "codigo" | "etapa" | "veh_marca" | "veh_modelo" | "veh_version" | "veh_anio" | "veh_vin" | "proporcion_flete" | "cliente_id" | "embarque_id"> & {
  clientes?: { razon_social: string } | { razon_social: string }[] | null;
};

const COLUMNAS_RESUMEN = "id, codigo, etapa, veh_marca, veh_modelo, veh_version, veh_anio, veh_vin, proporcion_flete, cliente_id, embarque_id, clientes ( razon_social )";

function aResumen(r: FilaResumen): ExpedienteDelEmbarque {
  const c = Array.isArray(r.clientes) ? r.clientes[0] : r.clientes;
  const prop = typeof r.proporcion_flete === "number" ? r.proporcion_flete : Number(r.proporcion_flete ?? 1);
  return {
    id: r.id,
    codigo: r.codigo,
    etapa: r.etapa as EtapaExpediente,
    auto: [r.veh_marca, r.veh_modelo, r.veh_version ?? "", String(r.veh_anio)].filter(Boolean).join(" "),
    vin: r.veh_vin,
    cliente: c?.razon_social ?? "Sin cliente",
    clienteId: r.cliente_id,
    proporcionFlete: Number.isFinite(prop) ? prop : 1,
    embarqueId: r.embarque_id,
  };
}

/** Embarques con cuántos expedientes activos lleva cada uno. */
export async function listarEmbarquesConExpedientes(client: PortalClient): Promise<{ embarques: Embarque[]; porEmbarque: Map<string, ExpedienteDelEmbarque[]>; error: string | null }> {
  const porEmbarque = new Map<string, ExpedienteDelEmbarque[]>();
  try {
    const [b, x] = await Promise.all([
      client.from("embarques").select(COLUMNAS.embarque).order("created_at", { ascending: false }).limit(200),
      client.from("expedientes").select(COLUMNAS_RESUMEN).not("embarque_id", "is", null).not("etapa", "in", "(cancelado)").limit(1000),
    ]);
    if (b.error) return { embarques: [], porEmbarque, error: describirError(b.error.message) };
    for (const fila of (x.data ?? []) as unknown as FilaResumen[]) {
      const r = aResumen(fila);
      if (!r.embarqueId) continue;
      const lista = porEmbarque.get(r.embarqueId) ?? [];
      lista.push(r);
      porEmbarque.set(r.embarqueId, lista);
    }
    return { embarques: ((b.data ?? []) as unknown as EmbarqueRow[]).map(mapEmbarque), porEmbarque, error: null };
  } catch {
    return { embarques: [], porEmbarque, error: MSG_RED };
  }
}

export async function cargarEmbarque(client: PortalClient, id: string): Promise<{ embarque: Embarque | null; expedientes: ExpedienteDelEmbarque[]; error: string | null }> {
  try {
    const [b, x] = await Promise.all([
      client.from("embarques").select(COLUMNAS.embarque).eq("id", id).maybeSingle(),
      client.from("expedientes").select(COLUMNAS_RESUMEN).eq("embarque_id", id).order("codigo"),
    ]);
    if (b.error) return { embarque: null, expedientes: [], error: describirError(b.error.message) };
    if (!b.data) return { embarque: null, expedientes: [], error: null };
    return { embarque: mapEmbarque(b.data as unknown as EmbarqueRow), expedientes: ((x.data ?? []) as unknown as FilaResumen[]).map(aResumen), error: x.error ? describirError(x.error.message) : null };
  } catch {
    return { embarque: null, expedientes: [], error: MSG_RED };
  }
}

/** Expedientes que se pueden subir a un contenedor: sin embarque, en compra o embarque (o búsqueda, si ya se planifica). */
export async function listarExpedientesSinEmbarque(client: PortalClient): Promise<ExpedienteDelEmbarque[]> {
  try {
    const { data, error } = await client
      .from("expedientes")
      .select(COLUMNAS_RESUMEN)
      .is("embarque_id", null)
      .in("etapa", ["busqueda", "compra", "embarque"])
      .order("codigo");
    if (error) return [];
    return ((data ?? []) as unknown as FilaResumen[]).map(aResumen);
  } catch {
    return [];
  }
}

export type DatosEmbarque = Partial<Omit<EmbarqueRow, "id" | "codigo">>;

export async function crearEmbarque(client: PortalClient, datos: DatosEmbarque): Promise<ResultadoId> {
  try {
    const { data, error } = await client.from("embarques").insert(limpiar(datos as Record<string, unknown>)).select("id").single();
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: "Embarque creado.", id: (data as { id?: string } | null)?.id };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/**
 * Asigna un expediente a un embarque (o lo saca, con `null`). Al sacarlo la
 * proporción vuelve a 1; al meterlo en uno consolidado el reparto se fija
 * después con `fijarRepartoFlete`.
 */
export async function asignarEmbarque(client: PortalClient, expedienteId: string, embarqueId: string | null, proporcion?: number): Promise<Resultado> {
  try {
    const cambios: Partial<ExpedienteRow> = { embarque_id: embarqueId };
    if (embarqueId === null) cambios.proporcion_flete = 1;
    else if (typeof proporcion === "number" && proporcion > 0 && proporcion <= 1) cambios.proporcion_flete = proporcion;
    const { error } = await client.from("expedientes").update(cambios).eq("id", expedienteId);
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: embarqueId ? "Expediente asignado al embarque." : "Expediente quitado del embarque." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function fijarRepartoFlete(client: PortalClient, embarqueId: string, lineas: readonly LineaReparto[]): Promise<Resultado> {
  try {
    const { data, error } = await client.rpc("fijar_reparto_flete", {
      p_embarque: embarqueId,
      p_reparto: lineas.map((l) => ({ expediente_id: l.expedienteId, proporcion: l.proporcion })),
    });
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: `Reparto fijado en ${String(data)} expedientes.` };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export type DatosZarpeArribo = {
  fecha_zarpe_est?: string | null;
  fecha_zarpe_real?: string | null;
  fecha_arribo_est?: string | null;
  fecha_arribo_real?: string | null;
  fecha_carga?: string | null;
  nave?: string | null;
  master_bl?: string | null;
  precinto?: string | null;
};

/** Fechas, nave y BL del embarque; evento visible y fechas estimadas en cada expediente del grupo. */
export async function registrarZarpeArribo(client: PortalClient, embarqueId: string, datos: DatosZarpeArribo): Promise<Resultado> {
  try {
    const { data, error } = await client.rpc("registrar_zarpe_arribo", { p_embarque: embarqueId, p_datos: limpiar(datos as Record<string, unknown>), p_actor: null });
    if (error) return { ok: false, message: describirError(error.message) };
    const n = Number(data);
    return { ok: true, message: n > 0 ? `Embarque actualizado; ${n} expediente${n === 1 ? "" : "s"} del grupo ${n === 1 ? "recibió" : "recibieron"} el aviso en su cuenta.` : "Embarque actualizado (sin expedientes activos en el grupo)." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/** Contrapartes con datos bancarios y verificación. Opcionalmente por tipo. */
export async function listarContrapartesCompletas(client: PortalClient, tipo?: string | null): Promise<{ contrapartes: Contraparte[]; error: string | null }> {
  try {
    let query = client.from("contrapartes").select(COLUMNAS.contraparteCompleta).order("tipo").order("nombre").limit(500);
    if (tipo) query = query.eq("tipo", tipo);
    const { data, error } = await query;
    if (error) return { contrapartes: [], error: describirError(error.message) };
    return { contrapartes: ((data ?? []) as unknown as ContraparteRow[]).map(mapContraparte), error: null };
  } catch {
    return { contrapartes: [], error: MSG_RED };
  }
}

export type DatosContraparteCompleta = DatosContraparte & {
  datos_bancarios?: DatosBancarios | null;
  notas?: string | null;
};

/** Al cambiar `datos_bancarios` la base borra la verificación anterior (trigger). */
export async function actualizarContraparte(client: PortalClient, id: string, datos: Partial<DatosContraparteCompleta>): Promise<Resultado> {
  try {
    const { error } = await client.from("contrapartes").update(limpiar(datos as Record<string, unknown>)).eq("id", id);
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: "Contraparte actualizada." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function crearContraparteCompleta(client: PortalClient, datos: DatosContraparteCompleta): Promise<ResultadoId> {
  if (datos.nombre.trim().length < 2) return { ok: false, message: "Escribe el nombre de la contraparte." };
  try {
    const { data, error } = await client.from("contrapartes").insert(limpiar(datos as Record<string, unknown>)).select("id").single();
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: "Contraparte creada.", id: (data as { id?: string } | null)?.id };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function verificarBancoContraparte(client: PortalClient, id: string, verificado = true): Promise<Resultado> {
  try {
    const { error } = await client.rpc("verificar_banco_contraparte", { p_id: id, p_verificado: verificado });
    if (error) return { ok: false, message: describirError(error.message) };
    return { ok: true, message: verificado ? "Cuenta bancaria marcada como verificada por teléfono." : "Verificación retirada." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

export async function listarNotificaciones(client: PortalClient, expedienteId: string): Promise<{ notificaciones: NotificacionRegistrada[]; error: string | null }> {
  try {
    const { data, error } = await client
      .from("notificaciones")
      .select(COLUMNAS.notificacion)
      .eq("expediente_id", expedienteId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { notificaciones: [], error: describirError(error.message) };
    return { notificaciones: ((data ?? []) as unknown as NotificacionRow[]).map(mapNotificacion), error: null };
  } catch {
    return { notificaciones: [], error: MSG_RED };
  }
}

export type ResultadoNotificar = Resultado & {
  estado?: "enviada" | "fallida" | "preparada";
  destinatario?: string | null;
  enlaceWhatsApp?: string | null;
  texto?: string;
};

/** Manda (correo) o prepara (WhatsApp) un aviso al cliente por la ruta de servidor, que lo registra. */
export async function enviarNotificacion(input: { expedienteId: string; plantilla: PlantillaNotificacion; canal: "email" | "whatsapp"; datos: DatosNotificacion }): Promise<ResultadoNotificar> {
  try {
    const respuesta = await fetch(`/api/portal/expedientes/${encodeURIComponent(input.expedienteId)}/notificaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ plantilla: input.plantilla, canal: input.canal, datos: input.datos }),
    });
    const datos = (await respuesta.json().catch(() => ({}))) as Record<string, unknown>;
    const estado = datos.estado as ResultadoNotificar["estado"];
    const enlace = typeof datos.enlaceWhatsApp === "string" ? datos.enlaceWhatsApp : null;
    if (!respuesta.ok || datos.ok !== true) {
      return { ok: false, message: typeof datos.mensaje === "string" ? datos.mensaje : "No se pudo enviar el aviso.", estado, enlaceWhatsApp: enlace, texto: typeof datos.texto === "string" ? datos.texto : undefined };
    }
    return {
      ok: true,
      message: estado === "enviada" ? `Correo enviado a ${String(datos.destinatario ?? "el cliente")}.` : "Mensaje preparado: se abre WhatsApp con el texto.",
      estado,
      destinatario: typeof datos.destinatario === "string" ? datos.destinatario : null,
      enlaceWhatsApp: enlace,
      texto: typeof datos.texto === "string" ? datos.texto : undefined,
    };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/* -------------------------------------------------------------------------- */
/* Fase 5: archivo, solicitudes, métricas y cumplimiento                       */
/* -------------------------------------------------------------------------- */

/**
 * Expedientes cerrados o cancelados, del cierre más reciente al más antiguo.
 * `anio` filtra por el año de `cerrado_en` (índice parcial
 * `expedientes_cerrado_en_idx`). Misma forma que `listarExpedientes` para que
 * el tablero pinte las dos listas con el mismo componente.
 */
export async function listarExpedientesArchivo(
  client: PortalClient,
  opciones: { anio?: number | null } = {},
): Promise<{ expedientes: ContextoExpediente[]; error: string | null }> {
  try {
    let query = client
      .from("expedientes")
      .select(EMBED_TABLERO)
      .in("etapa", ["cerrado", "cancelado"])
      .order("cerrado_en", { ascending: false, nullsFirst: false })
      .limit(200);
    if (opciones.anio) {
      query = query.gte("cerrado_en", `${opciones.anio}-01-01`).lt("cerrado_en", `${opciones.anio + 1}-01-01`);
    }
    const { data, error } = await query;
    if (error) return { expedientes: [], error: `No se pudo leer el archivo. ${MSG_MIGRACION} (${error.message})` };
    return { expedientes: ((data ?? []) as unknown as Embebido[]).map(aContexto), error: null };
  } catch {
    return { expedientes: [], error: "No se pudo leer el archivo. Revisa tu conexión." };
  }
}

export type ExpedienteDeSolicitud = { id: string; codigo: string; etapa: EtapaExpediente };

/** Qué expediente salió de cada solicitud de compra (índice `expedientes_origen_solicitud_idx`). */
export async function listarExpedientesPorSolicitud(client: PortalClient): Promise<Map<string, ExpedienteDeSolicitud>> {
  try {
    const { data, error } = await client
      .from("expedientes")
      .select("id, codigo, etapa, origen_solicitud_id")
      .not("origen_solicitud_id", "is", null)
      .limit(500);
    if (error) return new Map();
    const mapa = new Map<string, ExpedienteDeSolicitud>();
    for (const r of (data ?? []) as unknown as Pick<ExpedienteRow, "id" | "codigo" | "etapa" | "origen_solicitud_id">[]) {
      if (r.origen_solicitud_id) mapa.set(r.origen_solicitud_id, { id: r.id, codigo: r.codigo, etapa: r.etapa as EtapaExpediente });
    }
    return mapa;
  } catch {
    return new Map();
  }
}

export type SolicitudOrigen = { id: string; createdAt: string; marca: string; modelo: string; estado: string; nombre: string | null };

/** La solicitud de compra que dio origen a un expediente (para "Origen: solicitud del …"). */
export async function cargarSolicitudOrigen(client: PortalClient, id: string): Promise<SolicitudOrigen | null> {
  try {
    const { data, error } = await client
      .from("solicitudes_compra")
      .select("id, created_at, marca, modelo, estado, profiles:user_id ( nombre, email )")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const r = data as unknown as { id: string; created_at: string; marca: string; modelo: string; estado: string; profiles?: { nombre: string | null; email: string | null } | { nombre: string | null; email: string | null }[] | null };
    const p = uno(r.profiles);
    return { id: r.id, createdAt: r.created_at, marca: r.marca, modelo: r.modelo, estado: r.estado, nombre: p?.nombre?.trim() || p?.email || null };
  } catch {
    return null;
  }
}

/* --- Métricas ---------------------------------------------------------------- */

export type DatosMetricas = {
  expedientes: ExpedienteMetrica[];
  etapas: TramoEtapa[];
  hitosPorExpediente: Map<string, Hito[]>;
  movimientosPorExpediente: Map<string, Movimiento[]>;
};

type FilaExpedienteMetrica = Pick<ExpedienteRow, "id" | "codigo" | "etapa" | "etapa_desde" | "created_at" | "cerrado_en" | "fecha_est_arribo" | "veh_marca" | "veh_modelo" | "veh_anio"> & {
  clientes?: { razon_social: string } | { razon_social: string }[] | null;
};

/**
 * Lee lo justo para `src/core/expedientes/metricas.ts`: cuatro consultas
 * planas por la Data API con la sesión del administrador (RLS). Se decidió NO
 * crear una vista agregada: con decenas de expedientes al año el historial
 * completo son unos miles de filas (medido: 2.400 tramos en 0,4 ms con la
 * política corregida de la migración de cierre), y agregar en el core deja
 * una sola implementación de "días por etapa" probada con vitest. Si algún
 * día las lecturas pasan de ~10.000 filas, el camino es una vista
 * `expediente_metricas` con los mismos campos, no otro cálculo.
 */
export async function cargarDatosMetricas(client: PortalClient): Promise<{ datos: DatosMetricas | null; error: string | null }> {
  try {
    const [exp, et, hi, mo] = await Promise.all([
      client
        .from("expedientes")
        .select("id, codigo, etapa, etapa_desde, created_at, cerrado_en, fecha_est_arribo, veh_marca, veh_modelo, veh_anio, clientes:cliente_id ( razon_social )")
        .order("created_at", { ascending: false })
        .limit(2000),
      client.from("expediente_etapas").select("expediente_id, etapa, desde, hasta").limit(10000),
      client.from("expediente_hitos").select(COLUMNAS.hito + ", expediente_id").limit(10000),
      client.from("expediente_movimientos").select("id, expediente_id, tipo, cuenta, hito, estado, fecha, moneda, monto, tipo_cambio, monto_usd, concepto, contraparte_id, documento_ref, declarado_por_cliente, created_at").limit(10000),
    ]);
    const fallo = exp.error ?? et.error ?? hi.error ?? mo.error;
    if (fallo) return { datos: null, error: `No se pudieron leer las métricas. ${MSG_MIGRACION} (${fallo.message})` };

    const expedientes: ExpedienteMetrica[] = ((exp.data ?? []) as unknown as FilaExpedienteMetrica[]).map((r) => ({
      id: r.id,
      codigo: r.codigo,
      etapa: r.etapa as EtapaExpediente,
      etapaDesde: r.etapa_desde,
      createdAt: r.created_at,
      cerradoEn: r.cerrado_en,
      fechaEstArribo: r.fecha_est_arribo,
      clienteNombre: uno(r.clientes)?.razon_social ?? null,
      auto: `${r.veh_marca} ${r.veh_modelo} ${r.veh_anio}`,
    }));
    const etapas = ((et.data ?? []) as unknown as ExpedienteEtapaRow[]).map(mapTramo);
    const hitosPorExpediente = new Map<string, Hito[]>();
    for (const row of (hi.data ?? []) as unknown as (ExpedienteHitoRow & { expediente_id: string })[]) {
      const lista = hitosPorExpediente.get(row.expediente_id) ?? [];
      lista.push(mapHito(row));
      hitosPorExpediente.set(row.expediente_id, lista);
    }
    const movimientosPorExpediente = new Map<string, Movimiento[]>();
    for (const row of (mo.data ?? []) as unknown as ExpedienteMovimientoRow[]) {
      const lista = movimientosPorExpediente.get(row.expediente_id) ?? [];
      lista.push(mapMovimiento(row));
      movimientosPorExpediente.set(row.expediente_id, lista);
    }
    return { datos: { expedientes, etapas, hitosPorExpediente, movimientosPorExpediente }, error: null };
  } catch {
    return { datos: null, error: "No se pudieron leer las métricas. Revisa tu conexión." };
  }
}

/* --- Cumplimiento (UIF) -------------------------------------------------------- */

export type PreviaUif = { filas: FilaRegistroUif[]; total: number; umbrales: UmbralesUif; desde: string; hasta: string };

/** Vista previa de las operaciones reportables; el archivo se baja con `urlDescargaUif`. */
export async function cargarPreviaUif(desde: string, hasta: string): Promise<{ previa: PreviaUif | null; error: string | null }> {
  try {
    const res = await fetch(`/api/portal/expedientes/uif?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&formato=json`, { credentials: "include" });
    const json = (await res.json().catch(() => null)) as (PreviaUif & { ok: boolean; mensaje?: string }) | null;
    if (!res.ok || !json?.ok) return { previa: null, error: json?.mensaje ?? `No se pudo leer el registro (HTTP ${res.status}).` };
    return { previa: json, error: null };
  } catch {
    return { previa: null, error: "No se pudo leer el registro. Revisa tu conexión." };
  }
}

export function urlDescargaUif(desde: string, hasta: string): string {
  return `/api/portal/expedientes/uif?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&formato=csv`;
}
