/**
 * Códigos de expediente (`LC-AAAA-NNN`) y de embarque (`EMB-AAAA-NN`).
 *
 * Los asigna la base por secuencia; acá solo se formatean y se reconocen
 * (para la búsqueda del tablero y la URL de la cuenta del cliente).
 */

const CODIGO_EXPEDIENTE = /^LC-(\d{4})-(\d{3,})$/i;
const CODIGO_EMBARQUE = /^EMB-(\d{4})-(\d{2,})$/i;

export function formatoCodigo(anio: number, numero: number): string {
  return `LC-${anio}-${String(numero).padStart(3, "0")}`;
}

export function formatoCodigoEmbarque(anio: number, numero: number): string {
  return `EMB-${anio}-${String(numero).padStart(2, "0")}`;
}

export type CodigoParseado = { anio: number; numero: number };

/** `LC-2026-001` → `{ anio: 2026, numero: 1 }`. Acepta minúsculas y espacios alrededor. */
export function parsearCodigo(texto: string): CodigoParseado | null {
  const m = CODIGO_EXPEDIENTE.exec(texto.trim());
  if (!m) return null;
  return { anio: Number(m[1]), numero: Number(m[2]) };
}

export function parsearCodigoEmbarque(texto: string): CodigoParseado | null {
  const m = CODIGO_EMBARQUE.exec(texto.trim());
  if (!m) return null;
  return { anio: Number(m[1]), numero: Number(m[2]) };
}

export function esCodigoExpediente(texto: string): boolean {
  return parsearCodigo(texto) !== null;
}

/** Normaliza lo que escribe el usuario a la forma guardada (mayúsculas, sin espacios). */
export function normalizarCodigo(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, "");
}
