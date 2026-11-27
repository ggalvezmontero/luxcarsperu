/** Etiquetas y tonos del módulo de cotizaciones. */

import type { BadgeTone } from "@/components/portal/CrmUI";
import type { EstadoCotizacion } from "@/core/cotizaciones";
import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";

export const ESTADO_COTIZACION_LABEL: Record<EstadoCotizacion, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

export const ESTADO_COTIZACION_TONE: Record<EstadoCotizacion, BadgeTone> = {
  borrador: "neutral",
  enviada: "info",
  aceptada: "ok",
  rechazada: "danger",
  vencida: "warn",
};

export const PROPULSION_LABEL: Record<VehicleCategoryId, string> = {
  gasolina: "Gasolina",
  hev: "Híbrido (HEV)",
  phev: "Híbrido enchufable (PHEV)",
  ev: "Eléctrico (EV)",
  diesel: "Diésel",
};

/** Hoy en Lima, ISO (para el estado efectivo). */
export function hoyLimaIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}
