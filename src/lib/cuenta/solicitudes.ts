/**
 * Solicitudes del cliente (compra y venta), DESDE EL NAVEGADOR con su sesión.
 *
 * RLS es el candado: `solicitudes_compra` y `solicitudes_venta` solo dejan al
 * cliente insertar filas con su propio `user_id` y estado inicial, leer las
 * suyas, y cambiarlas a `cerrada` / `retirada`. Todo lo demás lo rechaza
 * Postgres (ver migración 0010), no este archivo.
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
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

export async function fetchMyPurchaseRequests(
  client: SupabaseClient,
): Promise<PurchaseRequest[]> {
  try {
    const { data, error } = await client
      .from("solicitudes_compra")
      .select(PURCHASE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return (data as unknown as PurchaseRequestRow[]).map(mapPurchaseRequest);
  } catch {
    return [];
  }
}

export async function fetchMySaleRequests(client: SupabaseClient): Promise<SaleRequest[]> {
  try {
    const { data, error } = await client
      .from("solicitudes_venta")
      .select(SALE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return (data as unknown as SaleRequestRow[]).map(mapSaleRequest);
  } catch {
    return [];
  }
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
  client: SupabaseClient,
  userId: string,
  input: NewPurchaseRequest,
): Promise<MutationResult> {
  try {
    const { error } = await client.from("solicitudes_compra").insert({
      user_id: userId,
      marca: input.brand.trim().slice(0, 80),
      modelo: input.model.trim().slice(0, 120),
      anio_min: input.yearMin,
      anio_max: input.yearMax,
      condicion: input.condition,
      presupuesto_max_usd: input.budgetMaxUsd,
      notas: input.notes.trim().slice(0, 2000) || null,
      estado: "nueva",
    });
    if (error) return { ok: false, message: "No se pudo enviar la solicitud. " + error.message };
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
  client: SupabaseClient,
  userId: string,
  input: NewSaleRequest,
): Promise<MutationResult> {
  try {
    const { error } = await client.from("solicitudes_venta").insert({
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
    });
    if (error) return { ok: false, message: "No se pudo enviar la solicitud. " + error.message };
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
  client: SupabaseClient,
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
  client: SupabaseClient,
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
