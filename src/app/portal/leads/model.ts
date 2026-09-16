/**
 * Modelo del embudo de leads: tipos, etiquetas, mapeo y utilidades puras.
 *
 * No importa nada de servidor ni abre conexiones: se puede usar desde un
 * componente "use client" sin arrastrar al navegador la capa de datos del
 * sitio público (que se construye para `service_role`).
 *
 * Las columnas de Postgres están en español (`nombre`, `interes_marca`); el
 * dominio que consume la UI está en inglés camelCase, igual que en
 * `src/lib/db/types.ts`. La traducción vive acá, en un solo lugar.
 */

import {
  LEAD_ORIGINS,
  LEAD_STATUSES,
  type LeadOrigin,
  type LeadRow,
  type LeadStatus,
} from "@/lib/db/types";

/* ========================================================================== */
/* Embudo                                                                     */
/* ========================================================================== */

/**
 * Etapas del embudo, en el orden en que ocurren.
 *
 * El dueño pidió cinco (nuevo, contactado, cotizado, cerrado, perdido) y el
 * enum `public.estado_lead` tiene siete. Manda el enum —es la fuente de verdad
 * y la base rechaza cualquier otro valor— y se agrupa para la lectura:
 * 'calificado' y 'negociacion' son pasos intermedios del camino a 'cotizado' y
 * 'ganado', y 'ganado' es el "cerrado" del dueño.
 */
export const LEAD_STAGES: ReadonlyArray<{
  id: LeadStatus;
  label: string;
  /** Agrupación de lectura para los indicadores de la cabecera. */
  group: "abierto" | "cerrado";
}> = [
  { id: "nuevo", label: "Nuevo", group: "abierto" },
  { id: "contactado", label: "Contactado", group: "abierto" },
  { id: "calificado", label: "Calificado", group: "abierto" },
  { id: "cotizado", label: "Cotizado", group: "abierto" },
  { id: "negociacion", label: "En negociación", group: "abierto" },
  { id: "ganado", label: "Cerrado / ganado", group: "cerrado" },
  { id: "perdido", label: "Perdido", group: "cerrado" },
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  cotizado: "Cotizado",
  negociacion: "En negociación",
  ganado: "Cerrado / ganado",
  perdido: "Perdido",
};

export const LEAD_ORIGIN_LABEL: Record<LeadOrigin, string> = {
  calculadora: "Calculadora",
  contacto: "Contacto",
  stock: "Stock",
  consignacion: "Consignación",
};

/* ========================================================================== */
/* Tipos de la pantalla                                                       */
/* ========================================================================== */

/** Lead tal como lo consume el portal. */
export type PortalLead = {
  id: string;
  origin: LeadOrigin;
  status: LeadStatus;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  vehicleId: string | null;
  /** "Toyota Tacoma TRD 2026", resuelto desde `vehicles` si hay unidad. */
  vehicleLabel: string | null;
  interestBrand: string | null;
  interestModel: string | null;
  interestYear: number | null;
  budgetUsd: number | null;
  sourcePath: string | null;
  createdAt: string;
  contactedAt: string | null;
  closedAt: string | null;
  lostReason: string | null;
  whatsappSent: boolean;
  /** Días transcurridos desde que entró. Para detectar leads dormidos. */
  ageDays: number;
};

export type PortalLeadFilters = {
  status?: LeadStatus | null;
  origin?: LeadOrigin | null;
  /** Búsqueda libre sobre nombre, teléfono, correo y marca/modelo de interés. */
  search?: string | null;
  limit?: number;
};

/* ========================================================================== */
/* Fila cruda y mapeo                                                         */
/* ========================================================================== */

/**
 * Fila de `public.leads` con las columnas internas del portal.
 *
 * Extiende `LeadRow` de `src/lib/db/types.ts` (la forma pública) con lo que
 * solo ve el equipo: seguimiento del embudo y motivo de pérdida.
 */
export type LeadAdminRow = LeadRow & {
  contactado_en: string | null;
  cerrado_en: string | null;
  motivo_perdida: string | null;
  whatsapp_enviado: boolean | null;
  /** Unidad del stock embebida por la relación FK, si la consulta la pidió. */
  vehicle?: {
    marca: string | null;
    modelo: string | null;
    anio: number | null;
    titular: string | null;
  } | null;
};

function pickFrom<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function toNumberOrNull(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const MS_PER_DAY = 86_400_000;

/** Días completos entre una fecha ISO y hoy. `0` si la fecha es ilegible. */
export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  const diff = Date.now() - then;
  return diff <= 0 ? 0 : Math.floor(diff / MS_PER_DAY);
}

function vehicleLabelOf(row: LeadAdminRow): string | null {
  const vehicle = row.vehicle;
  if (!vehicle) return null;
  if (vehicle.titular?.trim()) return vehicle.titular.trim();
  const parts = [
    vehicle.marca,
    vehicle.modelo,
    vehicle.anio ? String(vehicle.anio) : null,
  ]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .map((part) => part.trim());
  return parts.length ? parts.join(" ") : null;
}

export function mapLead(row: LeadAdminRow): PortalLead {
  return {
    id: row.id,
    origin: pickFrom<LeadOrigin>(row.origen, LEAD_ORIGINS, "contacto"),
    status: pickFrom<LeadStatus>(row.estado, LEAD_STATUSES, "nuevo"),
    name: row.nombre,
    phone: row.telefono,
    email: row.email,
    message: row.mensaje,
    vehicleId: row.vehicle_id,
    vehicleLabel: vehicleLabelOf(row),
    interestBrand: row.interes_marca,
    interestModel: row.interes_modelo,
    interestYear: row.interes_anio,
    budgetUsd: toNumberOrNull(row.presupuesto_usd),
    sourcePath: row.pagina_origen,
    createdAt: row.created_at,
    contactedAt: row.contactado_en,
    closedAt: row.cerrado_en,
    lostReason: row.motivo_perdida,
    whatsappSent: row.whatsapp_enviado === true,
    ageDays: daysSince(row.created_at),
  };
}

export function emptyLeadCounts(): Record<LeadStatus, number> {
  return {
    nuevo: 0,
    contactado: 0,
    calificado: 0,
    cotizado: 0,
    negociacion: 0,
    ganado: 0,
    perdido: 0,
  };
}

export function countLeadsByStatus(
  leads: PortalLead[],
): Record<LeadStatus, number> {
  const counts = emptyLeadCounts();
  for (const lead of leads) counts[lead.status] += 1;
  return counts;
}
