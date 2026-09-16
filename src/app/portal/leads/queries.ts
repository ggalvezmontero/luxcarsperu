/**
 * Consultas de leads, ejecutadas DESDE EL NAVEGADOR con la sesión del equipo.
 *
 * ┌── POR QUÉ NO SE LEE EN EL SERVIDOR CON service_role ─────────────────────┐
 * │ `service_role` salta todas las políticas RLS. Un componente de servidor  │
 * │ que la use manda el HTML con los leads DENTRO, antes de que el guard de  │
 * │ sesión del portal llegue a correr: quien pida /portal/leads con `curl`   │
 * │ se lleva nombres, teléfonos y correos de clientes (Ley 29733).           │
 * │                                                                          │
 * │ Por eso estas consultas corren en el navegador con la llave anónima más  │
 * │ la sesión de Supabase Auth. Postgres las evalúa como `authenticated` y,  │
 * │ sin sesión, `public.leads` devuelve cero filas — que es exactamente lo   │
 * │ que debe pasar. El candado es RLS, no la pantalla de login.              │
 * │ Ver el encabezado de `src/lib/portal/supabaseBrowser.ts`.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * NINGUNA FUNCIÓN LANZA: devuelven un resultado con el error ya redactado en
 * español. La pantalla lo muestra tal cual.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadStatus } from "@/lib/db/types";
import {
  mapLead,
  type LeadAdminRow,
  type PortalLead,
  type PortalLeadFilters,
} from "./model";

const TABLE = "leads";

/** Techo de filas por consulta. Un CRM de esta escala no pagina todavía. */
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

const BASE_COLUMNS =
  "id, origen, estado, nombre, telefono, email, mensaje, vehicle_id, interes_marca, interes_modelo, interes_anio, presupuesto_usd, pagina_origen, created_at, contactado_en, cerrado_en, motivo_perdida, whatsapp_enviado";

/** Igual que arriba, más la unidad del stock embebida por la relación FK. */
const COLUMNS_WITH_VEHICLE = `${BASE_COLUMNS}, vehicle:vehicles ( marca, modelo, anio, titular )`;

export type LeadsQueryResult = {
  leads: PortalLead[];
  /** Mensaje en español si algo falló. `null` si la consulta respondió. */
  error: string | null;
};

export type LeadMutationResult = {
  ok: boolean;
  message: string;
};

/** Quita los comodines de PostgREST para que la búsqueda libre no rompa el `or`. */
function sanitizeSearch(value: string): string {
  return value.replace(/[%,()]/g, " ").trim().slice(0, 80);
}

/**
 * Lista los leads del embudo, del más reciente al más antiguo.
 *
 * Intenta traer el vehículo embebido; si PostgREST rechaza el embed (la
 * relación todavía no existe en ese entorno), reintenta sin él: la lista
 * importa más que el nombre del auto.
 */
export async function fetchLeads(
  client: SupabaseClient,
  filters: PortalLeadFilters = {},
): Promise<LeadsQueryResult> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const search = filters.search ? sanitizeSearch(filters.search) : "";

  const runQuery = (columns: string) => {
    let query = client
      .from(TABLE)
      .select(columns)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (filters.status) query = query.eq("estado", filters.status);
    if (filters.origin) query = query.eq("origen", filters.origin);
    if (search) {
      query = query.or(
        [
          `nombre.ilike.*${search}*`,
          `telefono.ilike.*${search}*`,
          `email.ilike.*${search}*`,
          `interes_marca.ilike.*${search}*`,
          `interes_modelo.ilike.*${search}*`,
        ].join(","),
      );
    }

    return query;
  };

  try {
    let { data, error } = await runQuery(COLUMNS_WITH_VEHICLE);

    if (error) {
      ({ data, error } = await runQuery(BASE_COLUMNS));
    }

    if (error) {
      return {
        leads: [],
        error:
          "No se pudieron leer los leads. Verifica tu sesión y la conexión con Supabase.",
      };
    }

    const rows = (data ?? []) as unknown as LeadAdminRow[];
    return { leads: rows.map(mapLead), error: null };
  } catch {
    return {
      leads: [],
      error: "No se pudieron leer los leads. Revisa tu conexión.",
    };
  }
}

/**
 * Mueve un lead de etapa.
 *
 * Solo escribe `estado` y `motivo_perdida`. Las fechas del embudo
 * (`contactado_en`, `cerrado_en`) las sella el trigger `leads_sellar_embudo`
 * en Postgres: si se mandaran desde acá, cada cambio de estado pisaría la
 * fecha del primer contacto y el tiempo de respuesta del equipo se vería
 * siempre perfecto.
 *
 * `perdido` EXIGE motivo (constraint `leads_perdido_exige_motivo`). Se valida
 * antes de enviar para dar un mensaje claro en vez de un error de Postgres.
 */
export async function updateLeadStatus(
  client: SupabaseClient,
  input: { id: string; status: LeadStatus; lostReason?: string | null },
): Promise<LeadMutationResult> {
  const lostReason = (input.lostReason ?? "").trim().slice(0, 500);

  if (input.status === "perdido" && !lostReason) {
    return {
      ok: false,
      message: "Para marcar un lead como perdido hay que indicar el motivo.",
    };
  }

  try {
    const { error } = await client
      .from(TABLE)
      .update({
        estado: input.status,
        motivo_perdida: input.status === "perdido" ? lostReason : null,
      })
      .eq("id", input.id);

    if (error) {
      return {
        ok: false,
        message: "No se pudo guardar el cambio de estado.",
      };
    }

    return { ok: true, message: "Estado actualizado." };
  } catch {
    return { ok: false, message: "No se pudo guardar el cambio de estado." };
  }
}

/**
 * Deja constancia de que se abrió WhatsApp con el cliente.
 *
 * No prueba que la persona haya recibido nada —wa.me abre la app y ahí se
 * pierde el rastro—, pero distingue el lead que el equipo ya trabajó del que
 * nadie tocó. Si falla, no se le avisa al usuario: es telemetría interna y no
 * debe estorbar el contacto.
 */
export async function markWhatsappOpened(
  client: SupabaseClient,
  id: string,
): Promise<void> {
  try {
    await client.from(TABLE).update({ whatsapp_enviado: true }).eq("id", id);
  } catch {
    // Silencio deliberado: ver el comentario de arriba.
  }
}
