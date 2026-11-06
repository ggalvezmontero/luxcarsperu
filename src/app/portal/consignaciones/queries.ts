/**
 * Consultas de consignaciones, ejecutadas DESDE EL NAVEGADOR con la sesión del
 * equipo.
 *
 * ┌── POR QUÉ NO SE LEE EN EL SERVIDOR CON DATABASE_URL ─────────────────────┐
 * │ `DATABASE_URL` salta todas las políticas RLS. Un componente de servidor  │
 * │ que la use manda el HTML con los datos DENTRO, antes de que corra ningún │
 * │ guard de sesión: quien pida la ruta con `curl` se lleva el teléfono del  │
 * │ dueño y —peor— el PRECIO MÍNIMO que autorizó para negociar.              │
 * │                                                                          │
 * │ Acá se consulta por la Data API con la sesión de Neon Auth.              │
 * │ `public.consignments` hace `revoke all ... from anonymous` y solo        │
 * │ otorga a `authenticated`: sin sesión, Postgres devuelve cero filas. El   │
 * │ candado es RLS, no la pantalla de login.                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import type { PortalClient } from "@/lib/portal/portalClient";
import { retirarVehiculoDeConsignacion } from "../vehiculos/consultas";
import { hoyEnLima } from "../vehiculos/fechas";
import {
  MANAGEABLE_CONSIGNMENT_STATUSES,
  isClosedConsignment,
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
  client: PortalClient,
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
          "No se pudieron leer las consignaciones. Verifica tu sesión y la conexión con Neon.",
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

/**
 * `YYYY-MM-DD` de hoy EN LIMA: es el formato de las columnas `date`.
 *
 * Antes era `new Date().toISOString().slice(0, 10)`, que es el día en UTC:
 * desde las 19:00 de Lima ya es "mañana", y una venta registrada de noche
 * quedaba sellada con la fecha del día siguiente.
 */
function today(): string {
  return hoyEnLima();
}

/**
 * Cierra la ficha pública del auto de una consignación que se acaba de cerrar.
 *
 * Una consignación cerrada (vendida, retirada, vencida) con su `vehicle_id`
 * todavía `publicado = true, estado = 'disponible'` deja a los clientes
 * preguntando por un auto que ya no está. Por eso, al cerrar: se despublica la
 * ficha y, si el desenlace fue una venta, se marca vendida con la fecha.
 *
 * Devuelve el texto que hay que AGREGAR al mensaje de la consignación: vacío si
 * todo salió bien o no había ficha; un aviso claro si la consignación quedó
 * cerrada pero la ficha no se pudo tocar (son dos UPDATE desde el navegador,
 * no una transacción, así que ese caso existe y hay que decirlo).
 */
async function closeLinkedVehicle(
  client: PortalClient,
  vehicleId: string | null,
  soldOn: string | null,
): Promise<string> {
  if (!vehicleId) return "";
  const result = await retirarVehiculoDeConsignacion(client, vehicleId, {
    vendidoEn: soldOn,
  });
  if (result.ok) {
    return soldOn
      ? " La ficha del auto se despublicó y quedó como vendida."
      : " La ficha del auto se despublicó de la web.";
  }
  return ` OJO: la ficha del auto sigue como estaba (puede seguir publicada); despublícala desde Vehículos. Motivo: ${result.message}`;
}

/** Lee `vehicle_id` de las filas que devolvió un UPDATE con `.select()`. */
function updatedRows(data: unknown): { id: string; vehicle_id: string | null }[] {
  return Array.isArray(data)
    ? (data as { id: string; vehicle_id: string | null }[])
    : [];
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
  client: PortalClient,
  input: { id: string; notes?: string | null; soldOn?: string | null },
): Promise<ConsignmentMutationResult> {
  const soldOn =
    typeof input.soldOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.soldOn)
      ? input.soldOn
      : today();
  const notes = (input.notes ?? "").trim().slice(0, 1000) || null;

  try {
    const { data, error } = await client
      .from(TABLE)
      .update({
        vendido_por_dueno: true,
        vendido_por_dueno_en: soldOn,
        vendido_por_dueno_notas: notes,
        estado: "vendida_por_dueno",
        // Cero, y es lo correcto: sin exclusividad no hay comisión que cobrar.
        comision_cobrada: 0,
      })
      .eq("id", input.id)
      // Se pide la fila de vuelta para saber si de verdad se actualizó una y
      // para conocer su ficha pública (`vehicle_id`).
      .select("id, vehicle_id");

    if (error) {
      return { ok: false, message: "No se pudo registrar la venta del dueño." };
    }

    const rows = updatedRows(data);
    if (rows.length === 0) {
      return {
        ok: false,
        message:
          "No se encontró la consignación: puede que la hayan borrado o que tu sesión ya no tenga acceso. Recarga la página.",
      };
    }

    // El dueño lo vendió: la ficha se despublica y queda vendida con la
    // misma fecha.
    const vehicleNote = await closeLinkedVehicle(client, rows[0].vehicle_id, soldOn);

    return {
      ok: true,
      message: `Cerrada como vendida por el dueño, sin comisión.${vehicleNote}`,
    };
  } catch {
    return { ok: false, message: "No se pudo registrar la venta del dueño." };
  }
}

/**
 * Cambia el estado de gestión de una consignación. Si el estado nuevo la
 * cierra (retirada, vencida), además saca de la web su ficha vinculada.
 *
 * Solo admite los estados que no exigen datos extra
 * (`MANAGEABLE_CONSIGNMENT_STATUSES`). Los dos cierres por venta quedan fuera:
 * `vendida_por_dueno` tiene su propia función y `vendida_por_luxcars` exige
 * `precio_venta_final` por la constraint `consignments_venta_luxcars_exige_precio`.
 *
 * TODO(cierre): formulario de venta por LuxCars con precio final y comisión.
 * Cuando exista, tiene que llamar a `closeLinkedVehicle(client, vehicle_id,
 * vendido_en)` igual que `markSoldByOwner`, para que la ficha deje la web y
 * quede vendida.
 */
export async function updateConsignmentStatus(
  client: PortalClient,
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
    const { data, error } = await client
      .from(TABLE)
      .update({ estado: input.status })
      .eq("id", input.id)
      // Una consignación que el dueño ya cerró no se reabre por descuido.
      .eq("vendido_por_dueno", false)
      // Sin `.select()`, un UPDATE que no coincide con ninguna fila (porque el
      // dueño ya la había cerrado, o porque la borraron) vuelve sin error y la
      // pantalla decía "Estado actualizado." sin haber cambiado nada.
      .select("id, vehicle_id");

    if (error) {
      return { ok: false, message: "No se pudo actualizar el estado." };
    }

    const rows = updatedRows(data);
    if (rows.length === 0) {
      return {
        ok: false,
        message:
          "No se cambió nada: la consignación ya está cerrada como vendida por el dueño o ya no existe. Recarga la página.",
      };
    }

    // Retirada o vencida: el auto ya no está a la venta con LuxCars, así que
    // su ficha sale de la web. No es una venta: el estado del vehículo no se
    // toca. (`vendida_por_luxcars` no llega acá: exige precio final.)
    const vehicleNote = isClosedConsignment(input.status)
      ? await closeLinkedVehicle(client, rows[0].vehicle_id, null)
      : "";

    return { ok: true, message: `Estado actualizado.${vehicleNote}` };
  } catch {
    return { ok: false, message: "No se pudo actualizar el estado." };
  }
}
