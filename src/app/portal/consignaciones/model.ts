/**
 * Modelo de las consignaciones: tipos, etiquetas y utilidades puras.
 *
 * ┌── LA REGLA QUE DEFINE ESTA LÍNEA DE NEGOCIO: SIN EXCLUSIVIDAD ───────────┐
 * │ LuxCars no pide contrato de exclusividad. El dueño sigue usando su auto  │
 * │ mientras se vende y puede venderlo por su cuenta sin pagar comisión.     │
 * │ Por eso `soldByOwner` no es una excepción rara: es un desenlace previsto │
 * │ que el sistema tiene que poder cerrar limpio y en cero.                  │
 * │ La base lo blinda con `consignments_siempre_sin_exclusividad` (CHECK que │
 * │ solo admite TRUE) y con `consignments_venta_propia_coherente`.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌── PRECIO MÍNIMO = INFORMACIÓN RESERVADA ────────────────────────────────┐
 * │ `minimumPrice` es el piso que autorizó el dueño para negociar. Si llega  │
 * │ al comprador, se acabó la negociación. Nunca sale del portal y en        │
 * │ pantalla va oculto tras un clic explícito.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Acá no hay imports de servidor ni efectos: solo tipos, etiquetas, mapeo y
 * cálculo. Las consultas viven en `queries.ts` y corren en el navegador con la
 * sesión del equipo.
 */

import {
  CONSIGNMENT_STATUSES,
  type CommissionType,
  type ConsignmentRow,
  type ConsignmentStatus,
  type Currency,
} from "@/lib/db/types";

/**
 * FUENTE DE VERDAD DE LOS TIPOS DE ESQUEMA: `src/lib/db/types.ts`.
 *
 * `ConsignmentStatus`, `CommissionType` y `ConsignmentRow` son espejo de
 * `public.estado_consignacion`, `public.tipo_comision` y `public.consignments`.
 * Vivían acá y se movieron al módulo de tipos para que exista UNA sola
 * definición por enum de Postgres en todo el proyecto. Se reexportan para que
 * `queries.ts`, `ConsignmentsScreen.tsx` y `ConsignmentsTable.tsx` sigan
 * importando de `./model` sin cambios.
 *
 * Si agregas un estado, agrégalo en la migración y en `src/lib/db/types.ts`.
 * NO lo declares acá: dos listas del mismo enum terminan discrepando.
 */
export { CONSIGNMENT_STATUSES };
export type { CommissionType, ConsignmentRow, ConsignmentStatus };

export const CONSIGNMENT_STATUS_LABEL: Record<ConsignmentStatus, string> = {
  activa: "Activa",
  pausada: "Pausada",
  vendida_por_luxcars: "Vendida por LuxCars",
  vendida_por_dueno: "Vendida por el dueño",
  retirada: "Retirada",
  vencida: "Vencida",
};

/**
 * Estados que se pueden fijar desde un desplegable, sin datos adicionales.
 *
 * Los dos cierres por venta quedan fuera a propósito:
 *  - `vendida_por_dueno` tiene acción propia, porque además pone la comisión
 *    en cero (es el diferenciador del negocio, no un estado más de una lista).
 *  - `vendida_por_luxcars` exige `precio_venta_final` por la constraint
 *    `consignments_venta_luxcars_exige_precio`.
 */
export const MANAGEABLE_CONSIGNMENT_STATUSES: readonly ConsignmentStatus[] = [
  "activa",
  "pausada",
  "retirada",
  "vencida",
];

/** Estados en los que ya no hay nada que gestionar. */
const CLOSED_STATUSES: readonly ConsignmentStatus[] = [
  "vendida_por_luxcars",
  "vendida_por_dueno",
  "retirada",
  "vencida",
];

export function isClosedConsignment(status: ConsignmentStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export type PortalConsignment = {
  id: string;

  ownerName: string;
  ownerPhone: string;
  ownerEmail: string | null;
  ownerDocument: string | null;
  ownerDocumentType: string | null;

  vehicleId: string | null;
  brand: string;
  model: string;
  trim: string | null;
  year: number;
  plate: string | null;
  mileageKm: number | null;
  color: string | null;
  /** "Toyota Tacoma TRD 2026", listo para mostrar. */
  vehicleLabel: string;

  askingPrice: number;
  /** RESERVADO. Jamás se muestra al comprador. */
  minimumPrice: number | null;
  currency: Currency;
  appraisal: number | null;

  commissionType: CommissionType;
  /** Fracción 0–1 tal como la guarda Postgres (0.05 = 5%). */
  commissionPercent: number | null;
  commissionAmount: number | null;
  /**
   * Comisión estimada con la información de hoy. Si el dueño vendió por su
   * cuenta es 0 — y eso no es una pérdida: es la promesa cumplida.
   */
  estimatedCommission: number;

  startDate: string;
  endDate: string | null;
  status: ConsignmentStatus;

  /** Siempre `true`: la base no admite otra cosa. Se muestra como distintivo. */
  withoutExclusivity: boolean;
  soldByOwner: boolean;
  soldByOwnerAt: string | null;
  soldByOwnerNotes: string | null;

  finalSalePrice: number | null;
  commissionCharged: number | null;
  soldAt: string | null;

  internalNotes: string | null;
  createdAt: string;

  /** Días desde el inicio hasta el cierre, o hasta hoy si sigue abierta. */
  daysOnConsignment: number;
};

export type PortalConsignmentFilters = {
  status?: ConsignmentStatus | null;
  search?: string | null;
  limit?: number;
};

const MS_PER_DAY = 86_400_000;

/** Días completos entre dos fechas (ISO o `YYYY-MM-DD`). Nunca negativo. */
export function daysBetween(fromIso: string, toIso?: string | null): number {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  const diff = to - from;
  return diff <= 0 ? 0 : Math.floor(diff / MS_PER_DAY);
}

export function emptyConsignmentCounts(): Record<ConsignmentStatus, number> {
  return {
    activa: 0,
    pausada: 0,
    vendida_por_luxcars: 0,
    vendida_por_dueno: 0,
    retirada: 0,
    vencida: 0,
  };
}

/* ========================================================================== */
/* Fila cruda y mapeo                                                         */
/* ========================================================================== */

function toNumber(
  value: number | string | null | undefined,
  fallback = 0,
): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumberOrNull(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Comisión que le corresponde a LuxCars.
 *
 * Si el dueño vendió por su cuenta es CERO por definición del acuerdo, no por
 * un cálculo. Si ya está cobrada, manda el monto real cobrado.
 */
function commissionOf(row: ConsignmentRow): number {
  if (row.vendido_por_dueno === true) return 0;

  const charged = toNumberOrNull(row.comision_cobrada);
  if (charged !== null) return charged;

  const base =
    toNumberOrNull(row.precio_venta_final) ?? toNumber(row.precio_pedido);

  if (row.tipo_comision === "monto_fijo") return toNumber(row.comision_monto);
  return base * toNumber(row.comision_porcentaje);
}

function pickStatus(value: unknown): ConsignmentStatus {
  return typeof value === "string" &&
    (CONSIGNMENT_STATUSES as readonly string[]).includes(value)
    ? (value as ConsignmentStatus)
    : "activa";
}

export function mapConsignment(row: ConsignmentRow): PortalConsignment {
  const status = pickStatus(row.estado);
  const closingDate =
    row.vendido_en ??
    row.vendido_por_dueno_en ??
    (isClosedConsignment(status) ? row.fecha_fin : null);

  const label = [row.marca, row.modelo, row.version, String(row.anio)]
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .join(" ");

  return {
    id: row.id,
    ownerName: row.propietario_nombre,
    ownerPhone: row.propietario_telefono,
    ownerEmail: row.propietario_email,
    ownerDocument: row.propietario_documento,
    ownerDocumentType: row.propietario_tipo_documento,

    vehicleId: row.vehicle_id,
    brand: row.marca,
    model: row.modelo,
    trim: row.version,
    year: row.anio,
    plate: row.placa,
    mileageKm: row.kilometraje_km,
    color: row.color,
    vehicleLabel: label,

    askingPrice: toNumber(row.precio_pedido),
    minimumPrice: toNumberOrNull(row.precio_minimo),
    currency: row.moneda === "PEN" ? "PEN" : "USD",
    appraisal: toNumberOrNull(row.tasacion_luxcars),

    commissionType:
      row.tipo_comision === "monto_fijo" ? "monto_fijo" : "porcentaje",
    commissionPercent: toNumberOrNull(row.comision_porcentaje),
    commissionAmount: toNumberOrNull(row.comision_monto),
    estimatedCommission: commissionOf(row),

    startDate: row.fecha_inicio,
    endDate: row.fecha_fin,
    status,

    // La base solo admite TRUE; el `!== false` evita mentir si algún día una
    // fila legada llegara sin el dato.
    withoutExclusivity: row.sin_exclusividad !== false,
    soldByOwner: row.vendido_por_dueno === true,
    soldByOwnerAt: row.vendido_por_dueno_en,
    soldByOwnerNotes: row.vendido_por_dueno_notas,

    finalSalePrice: toNumberOrNull(row.precio_venta_final),
    commissionCharged: toNumberOrNull(row.comision_cobrada),
    soldAt: row.vendido_en,

    internalNotes: row.notas_internas,
    createdAt: row.created_at,

    daysOnConsignment: daysBetween(row.fecha_inicio, closingDate),
  };
}

/** Indicadores de cabecera, calculados sobre lo que se trajo. */
export type ConsignmentSummary = {
  countsByStatus: Record<ConsignmentStatus, number>;
  /** Consignaciones que siguen abiertas (ni vendidas ni retiradas). */
  open: PortalConsignment[];
  /** Suma de precios pedidos de lo abierto. */
  activePortfolioValue: number;
  /** Comisión estimada de lo abierto, si todo cerrara a precio pedido. */
  pipelineCommission: number;
  /** Promedio de días publicados entre las abiertas. */
  averageDaysOpen: number;
};

export function summarizeConsignments(
  consignments: PortalConsignment[],
): ConsignmentSummary {
  const countsByStatus = emptyConsignmentCounts();
  const open: PortalConsignment[] = [];
  let activePortfolioValue = 0;
  let pipelineCommission = 0;

  for (const item of consignments) {
    countsByStatus[item.status] += 1;
    if (!isClosedConsignment(item.status)) {
      open.push(item);
      activePortfolioValue += item.askingPrice;
      pipelineCommission += item.estimatedCommission;
    }
  }

  const averageDaysOpen = open.length
    ? Math.round(
        open.reduce((total, item) => total + item.daysOnConsignment, 0) /
          open.length,
      )
    : 0;

  return {
    countsByStatus,
    open,
    activePortfolioValue,
    pipelineCommission,
    averageDaysOpen,
  };
}
