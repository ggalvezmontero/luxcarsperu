/**
 * Consultas de consignaciones, ejecutadas DESDE EL NAVEGADOR con la sesión del
 * equipo.
 *
 * ┌── POR QUÉ NO SE LEE EN EL SERVIDOR CON service_role ─────────────────────┐
 * │ `service_role` salta todas las políticas RLS. Un componente de servidor  │
 * │ que la use manda el HTML con los datos DENTRO, antes de que corra ningún │
 * │ guard de sesión: quien pida la ruta con `curl` se lleva el teléfono del  │
 * │ dueño y —peor— el PRECIO MÍNIMO que autorizó para negociar.              │
 * │                                                                          │
 * │ Acá se consulta con la llave anónima más la sesión de Supabase Auth.     │
 * │ `public.consignments` hace `revoke all ... from anon` y solo otorga a    │
 * │ `authenticated`: sin sesión, Postgres devuelve cero filas. El candado es │
 * │ RLS, no la pantalla de login.                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MANAGEABLE_CONSIGNMENT_STATUSES,
  mapConsignment,
  type ConsignmentRow,
  type ConsignmentStatus,
  type PortalConsignment,
  type PortalConsignmentFilters,
} from "./model";

const TABLE = "consignments";
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const COLUMNS =
  "id, propietario_nombre, propietario_documento, propietario_tipo_documento, propietario_telefono, propietario_email, vehicle_id, marca, modelo, anio, version, placa, kilometraje_km, color, precio_pedido, precio_minimo, moneda, tasacion_luxcars, tipo_comision, comision_porcentaje, comision_monto, fecha_inicio, fecha_fin, estado, sin_exclusividad, vendido_por_dueno, vendido_por_dueno_en, vendido_por_dueno_notas, precio_venta_final, comision_cobrada, vendido_en, notas_internas, created_at";

export type ConsignmentsQueryResult = {
  consignments: PortalConsignment[];
  error: string | null;
};

export type ConsignmentMutationResult = {
  ok: boolean;
  message: string;
};

function sanitizeSearch(value: string): string {
  return value.replace(/[%,()]/g, " ").trim().slice(0, 80);
}

/** Lista las consignaciones, las más recientes primero. */
export async function fetchConsignments(
  client: SupabaseClient,
  filters: PortalConsignmentFilters = {},
): Promise<ConsignmentsQueryResult> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const search = filters.search ? sanitizeSearch(filters.search) : "";

  try {
    let query = client
      .from(TABLE)
      .select(COLUMNS)
      .order("fecha_inicio", { ascending: false })
      .limit(limit);

    if (filters.status) query = query.eq("estado", filters.status);
    if (search) {
      query = query.or(
        [
          `propietario_nombre.ilike.*${search}*`,
          `propietario_telefono.ilike.*${search}*`,
          `marca.ilike.*${search}*`,
          `modelo.ilike.*${search}*`,
          `placa.ilike.*${search}*`,
        ].join(","),
      );
    }

    const { data, error } = await query;

    if (error) {
      return {
        consignments: [],
        error:
          "No se pudieron leer las consignaciones. Verifica tu sesión y la conexión con Supabase.",
      };
    }

    const rows = (data ?? []) as unknown as ConsignmentRow[];
    return { consignments: rows.map(mapConsignment), error: null };
  } catch {
    return {
      consignments: [],
      error: "No se pudieron leer las consignaciones. Revisa tu conexión.",
    };
  }
}

/** `YYYY-MM-DD` de hoy: es el formato de las columnas `date`. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * EL DIFERENCIADOR DEL NEGOCIO: el dueño vendió su auto por su cuenta.
 *
 * LuxCars trabaja SIN contrato de exclusividad. El dueño sigue usando su auto
 * mientras se vende y puede venderlo él mismo; cuando eso pasa, la consignación
 * se cierra **sin comisión**. No es una fuga que haya que penalizar: es la
 * promesa comercial cumpliéndose, y el sistema tiene que poder registrarla en
 * un clic, sin campos de castigo ni "motivo de incumplimiento".
 *
 * Se escriben los tres campos del cierre —bandera, estado y comisión en cero—
 * aunque el trigger `tg_sellar_venta_propia` ya los selle: así la constraint
 * `consignments_venta_propia_coherente` se cumple en la misma sentencia y el
 * cierre es correcto incluso contra una base sin ese trigger.
 */
export async function markSoldByOwner(
  client: SupabaseClient,
  input: { id: string; notes?: string | null; soldOn?: string | null },
): Promise<ConsignmentMutationResult> {
  const soldOn =
    typeof input.soldOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.soldOn)
      ? input.soldOn
      : today();
  const notes = (input.notes ?? "").trim().slice(0, 1000) || null;

  try {
    const { error } = await client
      .from(TABLE)
      .update({
        vendido_por_dueno: true,
        vendido_por_dueno_en: soldOn,
        vendido_por_dueno_notas: notes,
        estado: "vendida_por_dueno",
        // Cero, y es lo correcto: sin exclusividad no hay comisión que cobrar.
        comision_cobrada: 0,
      })
      .eq("id", input.id);

    if (error) {
      return { ok: false, message: "No se pudo registrar la venta del dueño." };
    }

    return {
      ok: true,
      message: "Cerrada como vendida por el dueño, sin comisión.",
    };
  } catch {
    return { ok: false, message: "No se pudo registrar la venta del dueño." };
  }
}

/**
 * Cambia el estado de gestión de una consignación.
 *
 * Solo admite los estados que no exigen datos extra
 * (`MANAGEABLE_CONSIGNMENT_STATUSES`). Los dos cierres por venta quedan fuera:
 * `vendida_por_dueno` tiene su propia función y `vendida_por_luxcars` exige
 * `precio_venta_final` por la constraint `consignments_venta_luxcars_exige_precio`.
 *
 * TODO(cierre): formulario de venta por LuxCars con precio final y comisión.
 */
export async function updateConsignmentStatus(
  client: SupabaseClient,
  input: { id: string; status: ConsignmentStatus },
): Promise<ConsignmentMutationResult> {
  if (!MANAGEABLE_CONSIGNMENT_STATUSES.includes(input.status)) {
    return {
      ok: false,
      message:
        input.status === "vendida_por_dueno"
          ? "Usa la acción “Vendido por el dueño”: cierra sin comisión."
          : "Una venta por LuxCars necesita el precio final; regístrala desde el cierre de venta.",
    };
  }

  try {
    const { error } = await client
      .from(TABLE)
      .update({ estado: input.status })
      .eq("id", input.id)
      // Una consignación que el dueño ya cerró no se reabre por descuido.
      .eq("vendido_por_dueno", false);

    if (error) {
      return { ok: false, message: "No se pudo actualizar el estado." };
    }

    return { ok: true, message: "Estado actualizado." };
  } catch {
    return { ok: false, message: "No se pudo actualizar el estado." };
  }
}
