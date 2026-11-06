/**
 * Fechas de calendario del portal (columnas SQL `date`) y el "hoy" de Lima.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTE ARCHIVO: EL DÍA DE MENOS
 * ────────────────────────────────────────────────────────────────────────────
 * Una columna `date` (fecha_ingreso, fecha_inicio, vendido_en…) llega por la
 * Data API como "2026-11-05". `new Date("2026-11-05")` la interpreta como la
 * medianoche UTC, y formatearla con Intl SIN zona horaria la convierte a la del
 * navegador: en Lima (UTC-5) eso es el 4 de noviembre a las 19:00. Resultado,
 * todas las fechas del portal salían un día antes.
 *
 * Y al revés: `new Date().toISOString().slice(0, 10)` es el día en UTC, así que
 * desde las 19:00 de Lima ya es "mañana", y una venta registrada a las 20:00
 * quedaba sellada con la fecha del día siguiente.
 *
 * Reglas de este módulo:
 *   · una fecha `YYYY-MM-DD` es un DÍA DE CALENDARIO, no un instante: se
 *     muestra tal cual, sin pasar por ninguna zona horaria;
 *   · "hoy" es hoy en America/Lima, que es donde opera el negocio, sin importar
 *     la zona del equipo que abra el portal.
 *
 * Los timestamps (`created_at`, `publicado_en`…) SÍ son instantes y se siguen
 * formateando como antes, en la zona del navegador. Este módulo no los toca.
 */

export const ZONA_NEGOCIO = "America/Lima";

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `true` si el texto es una fecha de calendario `YYYY-MM-DD` (columna `date`). */
export function esFechaCalendario(valor: string): boolean {
  return RE_FECHA.test(valor);
}

/**
 * Formatea una columna `date` como ese mismo día ("05 nov. 2026").
 *
 * Se arma la fecha en UTC y se formatea EN UTC: así ningún desfase de zona
 * puede moverla de día. Si llega un timestamp completo, se formatea como
 * instante en la zona del navegador, que es el comportamiento de siempre.
 */
export function formatearFechaCalendario(valor: string | null): string {
  if (!valor) return "—";
  const partes = RE_FECHA.exec(valor);

  if (partes) {
    const [, anio, mes, dia] = partes;
    const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
    if (Number.isNaN(fecha.getTime())) return "—";
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(fecha);
  }

  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(instante);
}

/** `YYYY-MM-DD` de hoy EN LIMA: el formato que espera una columna `date`. */
export function hoyEnLima(ahora: Date = new Date()): string {
  // `formatToParts` y no el texto formateado: el orden de día/mes/año depende
  // de la configuración regional y no conviene apostar a ella.
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_NEGOCIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const valor = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

/**
 * Milisegundos UTC de la medianoche de una fecha de calendario, o del instante
 * si es un timestamp. `NaN` si no se puede leer. Sirve para contar días entre
 * dos fechas `date` sin que la zona horaria sume o reste uno.
 */
export function msDeFecha(valor: string): number {
  const partes = RE_FECHA.exec(valor);
  if (partes) {
    const [, anio, mes, dia] = partes;
    return Date.UTC(Number(anio), Number(mes) - 1, Number(dia));
  }
  return new Date(valor).getTime();
}
