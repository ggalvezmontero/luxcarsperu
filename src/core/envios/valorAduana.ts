import { CONFIG_ENVIOS } from "./configEnvios";
import type { EntradaCotizacionEnvio, ValorAduanaEstimado } from "./tipos";

/** Año de una fecha ISO `YYYY-MM-DD`, o `null` si no es una fecha válida. */
export function anioDeFecha(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const anio = Number(match[1]);
  const fecha = new Date(`${iso.trim()}T00:00:00Z`);
  if (!Number.isFinite(fecha.getTime())) return null;
  return anio;
}

/** El año en curso en Lima, igual que el motor público. */
export function anioEnLima(ahora: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric" }).format(ahora),
  );
}

/**
 * En qué año se importa: la fecha estimada de importación; si no la hay, la
 * fecha de retorno; si tampoco, el año en curso.
 */
export function resolverAnioImportacion(
  entrada: EntradaCotizacionEnvio,
  ahora: Date = new Date(),
): number {
  return (
    anioDeFecha(entrada.fechaImportacion) ??
    anioDeFecha(entrada.retorno?.fechaRetorno) ??
    anioEnLima(ahora)
  );
}

/**
 * Años de uso de un vehículo usado: del año modelo al año de importación, con
 * un mínimo de 1 (un usado del mismo año modelo ya rodó). Un nuevo tiene 0.
 */
export function aniosDeUso(
  condicion: EntradaCotizacionEnvio["vehiculo"]["condicion"],
  anioModelo: number,
  anioImportacion: number,
): number {
  if (condicion === "nuevo") return 0;
  return Math.max(1, anioImportacion - anioModelo);
}

/**
 * Valor estimado para aduanas.
 *
 *  · Nuevo: la factura.
 *  · Usado con valor de referencia: la referencia.
 *  · Usado sin referencia: factura menos 10% por año de uso, tope 50%.
 *
 * Siempre informa el margen frente al tope de la Ley del Retorno, aunque el
 * régimen elegido sea la importación regular: la comparación lado a lado lo
 * necesita.
 */
export function estimarValorAduana(
  entrada: EntradaCotizacionEnvio,
  anioImportacion: number,
): ValorAduanaEstimado {
  const { vehiculo } = entrada;
  const { depreciacionAnual, depreciacionMaxima } = CONFIG_ENVIOS.valorAduana;
  const tope = CONFIG_ENVIOS.leyRetorno.valorMaximoUsd;
  const anios = aniosDeUso(vehiculo.condicion, vehiculo.anioModelo, anioImportacion);

  if (vehiculo.condicion === "nuevo") {
    const valor = Math.max(0, vehiculo.valorFacturaUsd);
    return { valorUsd: valor, metodo: "factura", aniosUso: 0, depreciacion: 0, margenTopeUsd: tope - valor };
  }

  if (vehiculo.valorReferenciaUsadoUsd != null && vehiculo.valorReferenciaUsadoUsd > 0) {
    const valor = vehiculo.valorReferenciaUsadoUsd;
    return { valorUsd: valor, metodo: "referencia", aniosUso: anios, depreciacion: 0, margenTopeUsd: tope - valor };
  }

  const depreciacion = Math.min(depreciacionMaxima, depreciacionAnual * anios);
  const valor = Math.max(0, vehiculo.valorFacturaUsd) * (1 - depreciacion);
  return { valorUsd: valor, metodo: "depreciacion", aniosUso: anios, depreciacion, margenTopeUsd: tope - valor };
}

/** Recorrido en kilómetros, convirtiendo las millas si hace falta. */
export function recorridoEnKm(recorrido: number, unidad: EntradaCotizacionEnvio["vehiculo"]["unidadRecorrido"]): number {
  const valor = Math.max(0, Number.isFinite(recorrido) ? recorrido : 0);
  return unidad === "millas" ? valor * CONFIG_ENVIOS.millasAKm : valor;
}

/**
 * Último día en que un usado de ese año modelo puede ingresar: el 31 de
 * diciembre del año modelo + antigüedad máxima − 1. Con 2 años, un 2026 entra
 * hasta el 31/12/2027. `null` para un nuevo.
 */
export function fechaLimiteIngresoUsado(
  condicion: EntradaCotizacionEnvio["vehiculo"]["condicion"],
  anioModelo: number,
): string | null {
  if (condicion === "nuevo") return null;
  const ultimoAnio = anioModelo + CONFIG_ENVIOS.usados.antiguedadMaximaAnios - 1;
  return `${ultimoAnio}-12-31`;
}
