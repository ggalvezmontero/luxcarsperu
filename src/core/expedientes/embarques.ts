/**
 * Reparto del flete entre los expedientes de un embarque consolidado y los
 * avisos del embarque. TypeScript puro; la base vuelve a validar en
 * `fijar_reparto_flete`.
 */

import type { Embarque } from "./tipos";

/** Tolerancia con la que la suma de proporciones se acepta como 1 (misma que la función SQL). */
export const TOLERANCIA_REPARTO = 0.001;

export type LineaReparto = { expedienteId: string; proporcion: number };

/** Reparto en partes iguales con 4 decimales; el residuo va al primero para que sume exactamente 1. */
export function repartoEquitativo(ids: readonly string[]): LineaReparto[] {
  if (ids.length === 0) return [];
  const base = Math.floor(10000 / ids.length) / 10000;
  const lineas = ids.map((id) => ({ expedienteId: id, proporcion: base }));
  const residuo = Math.round((1 - base * ids.length) * 10000) / 10000;
  lineas[0].proporcion = Math.round((base + residuo) * 10000) / 10000;
  return lineas;
}

export function sumaReparto(lineas: readonly LineaReparto[]): number {
  return Math.round(lineas.reduce((s, l) => s + l.proporcion, 0) * 10000) / 10000;
}

/** `null` si el reparto es válido; si no, el motivo en español. */
export function validarReparto(lineas: readonly LineaReparto[]): string | null {
  if (lineas.length === 0) return "El reparto necesita al menos un expediente.";
  const vistos = new Set<string>();
  for (const l of lineas) {
    if (!Number.isFinite(l.proporcion) || l.proporcion <= 0 || l.proporcion > 1) return "Cada proporción debe estar entre 0 y 1.";
    if (vistos.has(l.expedienteId)) return "Un expediente aparece dos veces.";
    vistos.add(l.expedienteId);
  }
  const suma = sumaReparto(lineas);
  if (Math.abs(suma - 1) > TOLERANCIA_REPARTO) return `Las proporciones deben sumar 1 (suman ${suma.toFixed(4)}).`;
  return null;
}

/** Qué le falta a un embarque para que el equipo pueda operarlo. */
export function faltantesEmbarque(b: Embarque): string[] {
  const faltan: string[] = [];
  if (!b.forwarderId) faltan.push("forwarder");
  if (!b.puertoOrigen) faltan.push("puerto de origen");
  if (!b.fechaZarpeEst && !b.fechaZarpeReal) faltan.push("fecha de zarpe");
  if (!b.fechaArriboEst && !b.fechaArriboReal) faltan.push("fecha de arribo");
  if (b.fechaZarpeReal && !b.masterBl) faltan.push("master BL");
  return faltan;
}

export type EstadoEmbarque = "planificado" | "en_transito" | "arribado";

export function estadoEmbarque(b: Embarque): EstadoEmbarque {
  if (b.fechaArriboReal) return "arribado";
  if (b.fechaZarpeReal) return "en_transito";
  return "planificado";
}
