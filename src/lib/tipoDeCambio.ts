/**
 * Tipo de cambio USD → PEN del día. SOLO SERVIDOR.
 *
 * POR QUÉ EXISTE: en Search Console (nov 2026) la pregunta de seguimiento más
 * repetida sobre las fichas de modelo es "en soles" / "y en soles?". Google
 * cita el sitio como fuente de precios dentro de sus respuestas de IA y la
 * gente pide el número en moneda local. Una línea con el equivalente en soles
 * responde eso sin que el sitio cotice en soles: el estimado sigue en dólares.
 *
 * REGLAS:
 *   · La tasa NUNCA se escribe a mano. Sale de una API pública sin clave y se
 *     cachea un día (misma cadencia que las fichas, `revalidate = 86400`).
 *   · Si la API falla, se devuelve null y la línea no se muestra. Mejor sin
 *     soles que con un tipo de cambio inventado o viejo.
 *   · Es referencial: el texto que la use debe decirlo y dar la tasa.
 */
import "server-only";

export type TipoDeCambio = {
  /** Soles por dólar, p. ej. 3.72. */
  pen: number;
  /** Fecha de la tasa en ISO (YYYY-MM-DD). */
  fecha: string;
};

const URL_API = "https://open.er-api.com/v6/latest/USD";

export async function tipoDeCambioUsdPen(): Promise<TipoDeCambio | null> {
  try {
    const res = await fetch(URL_API, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    const pen = data.rates?.PEN;
    if (data.result !== "success" || typeof pen !== "number" || !(pen > 1 && pen < 10)) {
      return null;
    }
    const fecha = data.time_last_update_utc
      ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return { pen, fecha };
  } catch {
    return null;
  }
}

/** "S/ 352,000" con el redondeo a la centena: es un equivalente, no una cotización. */
export function enSoles(usd: number, tc: TipoDeCambio): string {
  const soles = Math.round((usd * tc.pen) / 100) * 100;
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 0,
  }).format(soles);
}
