/**
 * Solicitudes de clientes, vistas por el equipo. DESDE EL NAVEGADOR con la
 * sesión de un administrador: las políticas "admin lee todas" de la migración
 * 0010 son el candado. Sin rol admin, cero filas.
 *
 * Aprobar y rechazar van por las funciones `aprobar_solicitud_venta` y
 * `rechazar_solicitud_venta` (SECURITY DEFINER, verifican `es_admin()`):
 * crear consignación + ficha + enlace en tres pasos desde el navegador
 * dejaría estados a medias si uno falla.
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PURCHASE_COLUMNS,
  SALE_COLUMNS,
  mapPurchaseRequest,
  mapSaleRequest,
  type MutationResult,
  type PurchaseRequest,
  type SaleRequest,
} from "@/lib/cuenta/solicitudes";
import type {
  PurchaseRequestRow,
  PurchaseRequestStatus,
  SaleRequestRow,
} from "@/lib/db/types";

/** Datos del cliente embebidos por PostgREST vía la FK `user_id → profiles`. */
type ClientEmbed = {
  profiles?: { nombre: string | null; email: string | null; telefono: string | null } | null;
};

export type Requester = { name: string; email: string | null; phone: string | null };

export type AdminPurchaseRequest = PurchaseRequest & { requester: Requester };
export type AdminSaleRequest = SaleRequest & { requester: Requester };

const EMBED = "profiles:user_id ( nombre, email, telefono )";

function requesterOf(row: ClientEmbed): Requester {
  const p = row.profiles;
  return {
    name: p?.nombre?.trim() || p?.email || "Cliente sin nombre",
    email: p?.email ?? null,
    phone: p?.telefono ?? null,
  };
}

export async function fetchSaleRequests(
  client: SupabaseClient,
): Promise<{ requests: AdminSaleRequest[]; error: string | null }> {
  try {
    const { data, error } = await client
      .from("solicitudes_venta")
      .select(`${SALE_COLUMNS}, ${EMBED}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      return { requests: [], error: "No se pudieron leer las solicitudes de venta. Verifica tu sesión y que la migración 0010 esté aplicada." };
    }
    const rows = (data ?? []) as unknown as (SaleRequestRow & ClientEmbed)[];
    return {
      requests: rows.map((row) => ({ ...mapSaleRequest(row), requester: requesterOf(row) })),
      error: null,
    };
  } catch {
    return { requests: [], error: "No se pudieron leer las solicitudes. Revisa tu conexión." };
  }
}

export async function fetchPurchaseRequests(
  client: SupabaseClient,
): Promise<{ requests: AdminPurchaseRequest[]; error: string | null }> {
  try {
    const { data, error } = await client
      .from("solicitudes_compra")
      .select(`${PURCHASE_COLUMNS}, ${EMBED}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      return { requests: [], error: "No se pudieron leer los pedidos de búsqueda. Verifica tu sesión y que la migración 0010 esté aplicada." };
    }
    const rows = (data ?? []) as unknown as (PurchaseRequestRow & ClientEmbed)[];
    return {
      requests: rows.map((row) => ({ ...mapPurchaseRequest(row), requester: requesterOf(row) })),
      error: null,
    };
  } catch {
    return { requests: [], error: "No se pudieron leer los pedidos. Revisa tu conexión." };
  }
}

/**
 * Aprueba: crea la consignación y la ficha pública en una transacción.
 * `price` es el precio de publicación (por defecto, el que pidió el dueño).
 * `commissionRate` va de 0 a 1 (0.05 = 5%).
 */
export async function approveSaleRequest(
  client: SupabaseClient,
  input: { id: string; price: number | null; commissionRate: number; publish: boolean },
): Promise<MutationResult & { vehicleId?: string }> {
  if (input.commissionRate < 0 || input.commissionRate > 1) {
    return { ok: false, message: "La comisión va de 0% a 100%." };
  }
  try {
    const { data, error } = await client.rpc("aprobar_solicitud_venta", {
      p_solicitud_id: input.id,
      p_precio_venta: input.price,
      p_comision_porcentaje: input.commissionRate,
      p_publicar: input.publish,
    });
    if (error) return { ok: false, message: describeDbError(error.message) };
    return {
      ok: true,
      message: input.publish
        ? "Aprobada. La ficha ya está publicada como consignación; cárgale fotos desde Vehículos."
        : "Aprobada. La ficha quedó creada sin publicar; publícala desde Vehículos cuando tenga fotos.",
      vehicleId: typeof data === "string" ? data : undefined,
    };
  } catch {
    return { ok: false, message: "No se pudo aprobar. Revisa tu conexión." };
  }
}

export async function rejectSaleRequest(
  client: SupabaseClient,
  input: { id: string; reason: string },
): Promise<MutationResult> {
  const reason = input.reason.trim();
  if (reason.length < 3) return { ok: false, message: "Escribe el motivo: el cliente lo va a leer." };
  try {
    const { error } = await client.rpc("rechazar_solicitud_venta", {
      p_solicitud_id: input.id,
      p_motivo: reason,
    });
    if (error) return { ok: false, message: describeDbError(error.message) };
    return { ok: true, message: "Rechazada. El cliente ve el motivo en su cuenta." };
  } catch {
    return { ok: false, message: "No se pudo rechazar. Revisa tu conexión." };
  }
}

/** Cambia el estado de un pedido de búsqueda y, opcionalmente, la respuesta visible al cliente. */
export async function updatePurchaseRequest(
  client: SupabaseClient,
  input: { id: string; status: PurchaseRequestStatus; reply: string | null },
): Promise<MutationResult> {
  try {
    const { data: userData } = await client.auth.getUser();
    const { error } = await client
      .from("solicitudes_compra")
      .update({
        estado: input.status,
        respuesta_luxcars: input.reply?.trim().slice(0, 2000) || null,
        atendido_por: userData.user?.id ?? null,
      })
      .eq("id", input.id);
    if (error) return { ok: false, message: describeDbError(error.message) };
    return { ok: true, message: "Pedido actualizado." };
  } catch {
    return { ok: false, message: "No se pudo actualizar. Revisa tu conexión." };
  }
}

/** Los mensajes de las funciones SQL ya vienen en español; el resto se resume. */
function describeDbError(message: string): string {
  if (/[áéíóñ]|solicitud|administrador|comisi/i.test(message)) return message;
  return "La base de datos rechazó la operación. " + message;
}
