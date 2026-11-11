/**
 * Solicitudes del cliente (compra y venta), DESDE EL NAVEGADOR con su sesión.
 *
 * RLS es el candado: `solicitudes_compra` y `solicitudes_venta` solo dejan al
 * cliente insertar filas con su propio `user_id` y estado inicial, leer las
 * suyas, y cambiarlas a `cerrada` / `retirada`. Todo lo demás lo rechaza
 * Postgres (ver migración 0010), no este archivo.
 *
 * OJO: RLS también deja a los ADMIN leer todas las filas (es lo que necesita
 * el portal). Por eso las lecturas de "Mi cuenta" filtran además por el
 * `user_id` de la sesión: sin ese filtro, un admin que entra a /cuenta ve los
 * autos y búsquedas de todos los clientes (pasó el 2026-11-10).
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import {
  PURCHASE_REQUEST_CONDITIONS,
  PURCHASE_REQUEST_STATUSES,
  SALE_REQUEST_STATUSES,
  VEHICLE_CATEGORY_IDS,
  type Currency,
  type PurchaseRequestCondition,
  type PurchaseRequestRow,
  type PurchaseRequestStatus,
  type SaleRequestRow,
  type SaleRequestStatus,
  type VehicleCategoryId,
} from "@/lib/db/types";
import type { PortalClient } from "@/lib/portal/portalClient";

export type PurchaseRequest = {
  id: string;
  userId: string;
  brand: string;
  model: string;
  yearMin: number | null;
  yearMax: number | null;
  condition: PurchaseRequestCondition;
  budgetMaxUsd: number | null;
  notes: string | null;
  status: PurchaseRequestStatus;
  reply: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaleRequest = {
  id: string;
  userId: string;
  brand: string;
  model: string;
  trim: string | null;
  year: number;
  category: VehicleCategoryId;
  mileageKm: number;
  color: string | null;
  plate: string | null;
  declaredCondition: string | null;
  description: string | null;
  askingPrice: number;
  currency: Currency;
  contactPhone: string;
  status: SaleRequestStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  vehicleId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MutationResult = { ok: boolean; message: string };

export const PURCHASE_COLUMNS =
  "id, user_id, marca, modelo, anio_min, anio_max, condicion, presupuesto_max_usd, notas, estado, respuesta_luxcars, atendido_por, created_at, updated_at";

export const SALE_COLUMNS =
  "id, user_id, marca, modelo, version, anio, categoria, kilometraje_km, color, placa, condicion_declarada, descripcion, precio_pedido, moneda, telefono_contacto, estado, motivo_rechazo, revisado_por, revisado_en, consignment_id, vehicle_id, created_at, updated_at";

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapPurchaseRequest(row: PurchaseRequestRow): PurchaseRequest {
  return {
    id: row.id,
    userId: row.user_id,
    brand: row.marca,
    model: row.modelo,
    yearMin: row.anio_min,
    yearMax: row.anio_max,
    condition: pick(row.condicion, PURCHASE_REQUEST_CONDITIONS, "indistinto"),
    budgetMaxUsd: num(row.presupuesto_max_usd),
    notes: row.notas,
    status: pick(row.estado, PURCHASE_REQUEST_STATUSES, "nueva"),
    reply: row.respuesta_luxcars,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSaleRequest(row: SaleRequestRow): SaleRequest {
  return {
    id: row.id,
    userId: row.user_id,
    brand: row.marca,
    model: row.modelo,
    trim: row.version,
    year: row.anio,
    category: pick(row.categoria, VEHICLE_CATEGORY_IDS, "gasolina"),
    mileageKm: num(row.kilometraje_km) ?? 0,
    color: row.color,
    plate: row.placa,
    declaredCondition: row.condicion_declarada,
    description: row.descripcion,
    askingPrice: num(row.precio_pedido) ?? 0,
    currency: row.moneda === "PEN" ? "PEN" : "USD",
    contactPhone: row.telefono_contacto,
    status: pick(row.estado, SALE_REQUEST_STATUSES, "pendiente"),
    rejectionReason: row.motivo_rechazo,
    reviewedAt: row.revisado_en,
    vehicleId: row.vehicle_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const GENERIC_ERROR = "No se pudo completar la operación. Revisa tu conexión e intenta de nuevo.";

/* ------------------------------------------------------------------------- */
/* Lecturas                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Lectura de una lista: `error: true` significa que la lectura FALLÓ (sesión
 * vencida, red, base dormida), no que no haya filas. Sin esta distinción una
 * sesión vencida se pintaba como "todavía no pediste nada" y el cliente
 * mandaba la misma solicitud otra vez.
 */
export type ListResult<T> = { data: T[]; error: boolean };

export async function fetchMyPurchaseRequests(
  client: PortalClient,
  userId: string,
): Promise<ListResult<PurchaseRequest>> {
  if (!userId) return { data: [], error: false };
  try {
    const { data, error } = await client
      .from("solicitudes_compra")
      .select(PURCHASE_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return { data: [], error: true };
    return {
      data: (data as unknown as PurchaseRequestRow[]).map(mapPurchaseRequest),
      error: false,
    };
  } catch {
    return { data: [], error: true };
  }
}

export async function fetchMySaleRequests(
  client: PortalClient,
  userId: string,
): Promise<ListResult<SaleRequest>> {
  if (!userId) return { data: [], error: false };
  try {
    const { data, error } = await client
      .from("solicitudes_venta")
      .select(SALE_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return { data: [], error: true };
    return {
      data: (data as unknown as SaleRequestRow[]).map(mapSaleRequest),
      error: false,
    };
  } catch {
    return { data: [], error: true };
  }
}

/**
 * Ids de los autos del cliente que están PUBLICADOS en el sitio.
 *
 * El cliente no puede leer `vehicles`, así que lo pregunta a la función
 * `mis_autos_publicados()` (una fila `vehicle_id` por auto publicado suyo).
 * Una solicitud aprobada solo está "publicada" si su `vehicleId` está acá:
 * aprobar no es publicar, y `/comprar/{id}` de un auto sin publicar es un 404.
 * Si la llamada falla, `ids` queda vacío: ningún auto se da por publicado y no
 * se muestra un enlace que podría estar muerto.
 */
export async function fetchMyPublishedVehicleIds(
  client: PortalClient,
): Promise<Set<string>> {
  try {
    const { data, error } = await client.rpc("mis_autos_publicados");
    if (error || !Array.isArray(data)) return new Set();
    const ids = new Set<string>();
    for (const row of data as Array<{ vehicle_id?: unknown }>) {
      if (typeof row?.vehicle_id === "string") ids.add(row.vehicle_id);
    }
    return ids;
  } catch {
    return new Set();
  }
}

/* ------------------------------------------------------------------------- */
/* Errores de la base, en español                                             */
/* ------------------------------------------------------------------------- */

type DbError = { code?: string | null; message?: string | null } | null;
type DbResult = { error: DbError; status?: number };

const MSG_SESION =
  "Tu sesión venció o tu cuenta no puede enviar solicitudes. Vuelve a iniciar sesión e intenta de nuevo; si sigue igual, escríbenos por WhatsApp.";
const MSG_CUENTA_NO_LISTA =
  "Tu cuenta todavía no está lista. Intenta de nuevo en un momento o escríbenos por WhatsApp.";
const MSG_FUERA_DE_RANGO =
  "Algún dato del formulario está fuera de rango. Revísalo e intenta de nuevo.";
const MSG_NO_ENVIADA =
  "No se pudo enviar la solicitud. Revisa tu conexión e intenta de nuevo.";

function esErrorDeSesion(error: NonNullable<DbError>, status?: number): boolean {
  const mensaje = (error.message ?? "").toLowerCase();
  return (
    error.code === "42501" ||
    (error.code ?? "").startsWith("PGRST3") ||
    status === 401 ||
    mensaje.includes("jwt")
  );
}

/**
 * Traduce un error de la base a un mensaje para el cliente. NUNCA devuelve el
 * texto crudo de Postgres/PostgREST (viene en inglés y habla de tablas y
 * restricciones), con una sola excepción: `P0001`, el `raise exception` de un
 * trigger, cuyo mensaje está escrito en español para el cliente (p. ej. el
 * límite diario de solicitudes).
 */
function describirErrorDeEnvio(error: NonNullable<DbError>, status?: number): string {
  if (esErrorDeSesion(error, status)) return MSG_SESION;
  switch (error.code) {
    case "23503":
      return MSG_CUENTA_NO_LISTA;
    case "23514":
      return MSG_FUERA_DE_RANGO;
    case "P0001": {
      const mensaje = (error.message ?? "").trim();
      return mensaje || MSG_NO_ENVIADA;
    }
    default:
      return MSG_NO_ENVIADA;
  }
}

/**
 * Inserta una solicitud. Si falla por clave foránea (`23503`: el cliente
 * todavía no tiene fila en `profiles`), pide `asegurar_perfil()` y reintenta
 * UNA vez; si sigue fallando, dice que la cuenta no está lista.
 */
async function enviarSolicitud(
  client: PortalClient,
  insertar: () => PromiseLike<DbResult>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let resultado = await insertar();

  if (resultado.error?.code === "23503") {
    const { error: errorPerfil, status } = await client.rpc("asegurar_perfil");
    if (errorPerfil) {
      return {
        ok: false,
        message: esErrorDeSesion(errorPerfil, status) ? MSG_SESION : MSG_CUENTA_NO_LISTA,
      };
    }
    resultado = await insertar();
  }

  if (resultado.error) {
    return { ok: false, message: describirErrorDeEnvio(resultado.error, resultado.status) };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------------- */
/* Escrituras del cliente                                                     */
/* ------------------------------------------------------------------------- */

export type NewPurchaseRequest = {
  brand: string;
  model: string;
  yearMin: number | null;
  yearMax: number | null;
  condition: PurchaseRequestCondition;
  budgetMaxUsd: number | null;
  notes: string;
};

export async function createPurchaseRequest(
  client: PortalClient,
  userId: string,
  input: NewPurchaseRequest,
): Promise<MutationResult> {
  try {
    const fila = {
      user_id: userId,
      marca: input.brand.trim().slice(0, 80),
      modelo: input.model.trim().slice(0, 120),
      anio_min: input.yearMin,
      anio_max: input.yearMax,
      condicion: input.condition,
      presupuesto_max_usd: input.budgetMaxUsd,
      notas: input.notes.trim().slice(0, 2000) || null,
      estado: "nueva",
    };
    const envio = await enviarSolicitud(client, () =>
      client.from("solicitudes_compra").insert(fila),
    );
    if (!envio.ok) return { ok: false, message: envio.message };
    return { ok: true, message: "Solicitud enviada. Te escribimos por WhatsApp en cuanto tengamos opciones." };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

export type NewSaleRequest = {
  brand: string;
  model: string;
  trim: string;
  year: number;
  category: VehicleCategoryId;
  mileageKm: number;
  color: string;
  plate: string;
  declaredCondition: string;
  description: string;
  askingPrice: number;
  currency: Currency;
  contactPhone: string;
};

export async function createSaleRequest(
  client: PortalClient,
  userId: string,
  input: NewSaleRequest,
): Promise<MutationResult> {
  try {
    const fila = {
      user_id: userId,
      marca: input.brand.trim().slice(0, 80),
      modelo: input.model.trim().slice(0, 120),
      version: input.trim.trim().slice(0, 120) || null,
      anio: input.year,
      categoria: input.category,
      kilometraje_km: input.mileageKm,
      color: input.color.trim().slice(0, 60) || null,
      placa: input.plate.trim().toUpperCase().slice(0, 12) || null,
      condicion_declarada: input.declaredCondition.slice(0, 80) || null,
      descripcion: input.description.trim().slice(0, 2000) || null,
      precio_pedido: input.askingPrice,
      moneda: input.currency,
      telefono_contacto: input.contactPhone.trim().slice(0, 40),
      estado: "pendiente",
    };
    const envio = await enviarSolicitud(client, () =>
      client.from("solicitudes_venta").insert(fila),
    );
    if (!envio.ok) return { ok: false, message: envio.message };
    return {
      ok: true,
      message: "Recibimos tu auto. Lo revisamos y te avisamos cuando esté publicado.",
    };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

/** El cliente da por terminada su búsqueda. */
export async function closePurchaseRequest(
  client: PortalClient,
  id: string,
): Promise<MutationResult> {
  try {
    const { error } = await client
      .from("solicitudes_compra")
      .update({ estado: "cerrada" })
      .eq("id", id);
    if (error) return { ok: false, message: "No se pudo cerrar la solicitud." };
    return { ok: true, message: "Solicitud cerrada." };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

/** El cliente retira su auto antes de que lo revisen. */
export async function withdrawSaleRequest(
  client: PortalClient,
  id: string,
): Promise<MutationResult> {
  try {
    const { error } = await client
      .from("solicitudes_venta")
      .update({ estado: "retirada" })
      .eq("id", id);
    if (error) return { ok: false, message: "No se pudo retirar la solicitud." };
    return { ok: true, message: "Solicitud retirada." };
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
}

/* ------------------------------------------------------------------------- */
/* Etiquetas                                                                  */
/* ------------------------------------------------------------------------- */

export const PURCHASE_STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  nueva: "Recibida",
  en_busqueda: "En búsqueda",
  propuesta_enviada: "Con propuesta",
  cerrada: "Cerrada",
  descartada: "No atendida",
};

export const SALE_STATUS_LABEL: Record<SaleRequestStatus, string> = {
  pendiente: "En revisión",
  aprobada: "Publicada",
  rechazada: "No aprobada",
  retirada: "Retirada",
};

export const PURCHASE_CONDITION_LABEL: Record<PurchaseRequestCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
  indistinto: "Me da igual",
};

/** Condición declarada por el dueño al ofrecer su auto. */
export const DECLARED_CONDITIONS = [
  "Impecable · sin detalles",
  "Muy bueno · detalles menores",
  "Bueno · uso normal",
  "Requiere trabajos",
] as const;
