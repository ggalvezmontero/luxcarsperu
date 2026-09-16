/**
 * Nombres en español de los enums de la base de datos.
 *
 * Los valores de `public.estado_vehiculo`, `public.fuente_inventario`, etc.
 * viajan en snake_case ("en_transito"). Traducirlos en cada componente termina
 * con tres redacciones distintas del mismo estado, así que viven acá.
 */

import type {
  Currency,
  VehicleCategoryId,
  VehicleCondition,
  VehicleSource,
  VehicleStatus,
} from "@/lib/db/types";

export const ESTADO_LABEL: Record<VehicleStatus, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  en_transito: "En tránsito",
  vendido: "Vendido",
};

export const ESTADO_OPCIONES: readonly VehicleStatus[] = [
  "disponible",
  "reservado",
  "en_transito",
  "vendido",
];

export const CONDICION_LABEL: Record<VehicleCondition, string> = {
  nuevo: "Nuevo",
  usado: "Usado",
};

export const CATEGORIA_LABEL: Record<VehicleCategoryId, string> = {
  gasolina: "Gasolina",
  hev: "Híbrido full (HEV)",
  diesel: "Diésel",
  ev: "Eléctrico (EV)",
  phev: "Híbrido enchufable (PHEV)",
};

export const FUENTE_LABEL: Record<VehicleSource, string> = {
  carga_manual: "Carga manual",
  importacion_directa: "Importación directa",
  consignacion: "Consignación",
  feed_partner_licenciado: "Feed de partner licenciado",
};

/**
 * Fuentes elegibles desde el formulario. `feed_partner_licenciado` queda fuera
 * a propósito: esa etiqueta solo la puede poner un importador de feed con
 * contrato firmado, nunca una carga a mano.
 */
export const FUENTE_OPCIONES: readonly VehicleSource[] = [
  "carga_manual",
  "importacion_directa",
  "consignacion",
];

export const MONEDA_OPCIONES: readonly Currency[] = ["USD", "PEN"];

/** Precio con moneda, o un guion si todavía no tiene precio. */
export function formatearPrecio(
  valor: number | null,
  moneda: Currency,
): string {
  if (valor === null) return "—";
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

export function formatearKilometraje(km: number): string {
  return `${new Intl.NumberFormat("es-PE").format(km)} km`;
}

export function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(fecha);
}
