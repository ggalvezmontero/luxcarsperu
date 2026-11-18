/**
 * Llamadas del navegador a `/api/admin/cotizaciones-envio`. La cookie de
 * sesión viaja sola (mismo origen); el servidor vuelve a comprobar el rol.
 * NINGUNA FUNCIÓN LANZA: devuelven `ok: false` con un mensaje.
 */

import type { EntradaCotizacionEnvio, RegimenEnvio, ResultadoCotizacionEnvio } from "@/core/envios/tipos";

export type EstadoCotizacionEnvio = "borrador" | "enviada" | "aceptada";
export const ESTADOS_ORDEN: readonly EstadoCotizacionEnvio[] = ["borrador", "enviada", "aceptada"];
export const ESTADOS_LABEL: Record<EstadoCotizacionEnvio, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
};

export type CotizacionEnvioResumen = {
  id: string;
  numero: string;
  clienteNombre: string;
  clienteWhatsapp: string;
  marca: string;
  modelo: string;
  anioModelo: number;
  regimen: RegimenEnvio;
  estado: EstadoCotizacionEnvio;
  totalUsd: number;
  createdAt: string;
  updatedAt: string;
};

export type CotizacionEnvioCompleta = CotizacionEnvioResumen & {
  entrada: EntradaCotizacionEnvio;
  resultado: ResultadoCotizacionEnvio;
};

type Respuesta<T> = { ok: true; datos: T } | { ok: false; mensaje: string };

const BASE = "/api/admin/cotizaciones-envio";
const RED = "No se pudo contactar al servidor. Revisa la conexión.";

async function pedir<T>(url: string, init: RequestInit, extraer: (json: Record<string, unknown>) => T): Promise<Respuesta<T>> {
  try {
    const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
    const json = (await r.json().catch(() => null)) as Record<string, unknown> | null;
    if (!r.ok || !json || json.ok !== true) {
      return { ok: false, mensaje: typeof json?.mensaje === "string" ? json.mensaje : `Error ${r.status}.` };
    }
    return { ok: true, datos: extraer(json) };
  } catch {
    return { ok: false, mensaje: RED };
  }
}

export function listarCotizaciones() {
  return pedir(BASE, { method: "GET" }, (j) => (j.cotizaciones as CotizacionEnvioResumen[]) ?? []);
}

export function guardarCotizacion(entrada: EntradaCotizacionEnvio, estado: EstadoCotizacionEnvio) {
  return pedir(BASE, { method: "POST", body: JSON.stringify({ entrada, estado }) }, (j) => j.cotizacion as CotizacionEnvioResumen);
}

/** Corrige una cotización ya guardada: conserva número y fecha. */
export function actualizarCotizacion(id: string, entrada: EntradaCotizacionEnvio, estado: EstadoCotizacionEnvio) {
  return pedir(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify({ entrada, estado }) }, (j) => j.cotizacion as CotizacionEnvioResumen);
}

export function obtenerCotizacion(id: string) {
  return pedir(`${BASE}/${id}`, { method: "GET" }, (j) => j.cotizacion as CotizacionEnvioCompleta);
}

export function cambiarEstado(id: string, estado: EstadoCotizacionEnvio) {
  return pedir(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify({ estado }) }, (j) => j.cotizacion as CotizacionEnvioResumen);
}
