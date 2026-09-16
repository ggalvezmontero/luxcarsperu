/**
 * Indicadores del tablero del portal.
 *
 * Se consultan con `count: "exact", head: true`: PostgREST devuelve solo el
 * número de filas, sin traer ni una columna. Es la consulta más barata posible
 * y, sobre todo, no trae a memoria datos personales de los leads (Ley 29733)
 * que el tablero no necesita mostrar.
 *
 * REGLA DE ESTE ARCHIVO: nunca lanza. Sin sesión o sin base de datos devuelve
 * ceros y explica por qué. Un tablero en cero es información útil ("no hay
 * datos todavía"); un tablero roto no lo es.
 *
 * Las consultas corren en el NAVEGADOR con la sesión del equipo, así que RLS
 * las evalúa como `authenticated`. Sin sesión, Postgres responde cero filas —
 * que es justo lo que debe pasar. Ver el encabezado de `supabaseBrowser.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Lo que el dueño mira todos los días, en el orden en que le importa. */
export type PortalMetrics = {
  /** `vehicles.estado = 'disponible'`: unidades listas para vender. */
  stockDisponible: number;
  /** `vehicles.estado = 'reservado'`: con seña o compromiso. */
  reservados: number;
  /** `vehicles.estado = 'vendido'` con `vendido_en` dentro del mes corriente. */
  vendidosDelMes: number;
  /** `leads.estado = 'nuevo'`: consultas que nadie tocó todavía. */
  leadsSinAtender: number;
  /** `consignments.estado = 'activa'`: autos de terceros en venta. */
  consignacionesActivas: number;
  /** `vehicles.estado = 'en_transito'`: importaciones en camino. */
  enTransito: number;
  /** Disponibles pero con `publicado = false`: no las ve nadie en la web. */
  sinPublicar: number;
};

export const EMPTY_METRICS: PortalMetrics = {
  stockDisponible: 0,
  reservados: 0,
  vendidosDelMes: 0,
  leadsSinAtender: 0,
  consignacionesActivas: 0,
  enTransito: 0,
  sinPublicar: 0,
};

export type PortalMetricsResult = {
  metrics: PortalMetrics;
  /** `true` solo si TODAS las consultas respondieron. */
  ok: boolean;
  /** Motivos en español, listos para mostrar. Vacío si todo salió bien. */
  issues: string[];
};

/** Primer día del mes corriente en formato `YYYY-MM-DD` (columna `date`). */
export function firstDayOfCurrentMonth(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}-01`;
}

/** Etiqueta "septiembre 2026" para el rótulo de la tarjeta. */
export function currentMonthLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(now);
}

type CountSpec = {
  key: keyof PortalMetrics;
  label: string;
  run: (client: SupabaseClient) => PromiseLike<{
    count: number | null;
    error: { message: string } | null;
  }>;
};

/**
 * Definición de cada indicador. Los nombres de tabla y columna están en
 * español porque así está el esquema (ver `supabase/migrations/`); la
 * traducción a inglés vive en la capa de datos, no acá.
 */
const COUNT_SPECS: CountSpec[] = [
  {
    key: "stockDisponible",
    label: "unidades en stock",
    run: (c) =>
      c
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("estado", "disponible"),
  },
  {
    key: "reservados",
    label: "unidades reservadas",
    run: (c) =>
      c
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("estado", "reservado"),
  },
  {
    key: "vendidosDelMes",
    label: "vendidos del mes",
    run: (c) =>
      c
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("estado", "vendido")
        // Una unidad vendida sin `vendido_en` no cuenta: sin fecha no se puede
        // atribuir a un mes. Al cerrar una venta, registra siempre la fecha.
        .gte("vendido_en", firstDayOfCurrentMonth()),
  },
  {
    key: "leadsSinAtender",
    label: "leads sin atender",
    run: (c) =>
      c
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("estado", "nuevo"),
  },
  {
    key: "consignacionesActivas",
    label: "consignaciones activas",
    run: (c) =>
      c
        .from("consignments")
        .select("id", { count: "exact", head: true })
        .eq("estado", "activa"),
  },
  {
    key: "enTransito",
    label: "unidades en tránsito",
    run: (c) =>
      c
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("estado", "en_transito"),
  },
  {
    key: "sinPublicar",
    label: "disponibles sin publicar",
    run: (c) =>
      c
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("estado", "disponible")
        .eq("publicado", false),
  },
];

/**
 * Trae todos los indicadores en paralelo.
 *
 * Un indicador que falla vale 0 y suma un mensaje a `issues`; los demás se
 * muestran igual. Nunca lanza.
 */
export async function fetchPortalMetrics(
  client: SupabaseClient | null,
): Promise<PortalMetricsResult> {
  if (!client) {
    return {
      metrics: { ...EMPTY_METRICS },
      ok: false,
      issues: [
        "Sin conexión a Supabase: los indicadores muestran cero porque no hay de dónde leerlos.",
      ],
    };
  }

  const metrics: PortalMetrics = { ...EMPTY_METRICS };
  const issues: string[] = [];

  const settled = await Promise.all(
    COUNT_SPECS.map(async (spec) => {
      try {
        const { count, error } = await spec.run(client);
        if (error) return { spec, value: 0, error: error.message };
        return { spec, value: count ?? 0, error: null as string | null };
      } catch (error) {
        return {
          spec,
          value: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  for (const result of settled) {
    metrics[result.spec.key] = result.value;
    if (result.error) {
      issues.push(`No se pudo contar ${result.spec.label}: ${result.error}`);
    }
  }

  return { metrics, ok: issues.length === 0, issues };
}
