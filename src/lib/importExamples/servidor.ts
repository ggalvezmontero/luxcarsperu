/**
 * Ejemplos de importación a pedido para pintar la web. SOLO SERVIDOR.
 *
 * Los lee de la base (`public.ejemplos_importacion`, editable en
 * /portal/ejemplos) como visitante anónimo, y cae a la lista del repositorio
 * (`src/data/trendingVehicles.ts`) cuando la base no puede dar al menos
 * `MIN_EXAMPLES` ejemplos válidos.
 *
 * ESTOS BLOQUES POSICIONAN EN GOOGLE. Las reglas de abajo existen para que el
 * HTML de la home y de /importar nunca quede peor que con el archivo:
 *
 *   · NUNCA una sección vacía ni a medias: o la base da una lista completa y
 *     válida, o se pinta el respaldo entero. No se mezclan las dos fuentes.
 *   · Una fila que no cumple las reglas del catálogo se descarta al leer,
 *     aunque alguien la haya escrito a mano en la base.
 *   · Un ERROR de la base al regenerar la página no se convierte en "respaldo":
 *     se lanza, y Next conserva la última página buena. Si no, un corte de un
 *     segundo cambiaría los autos del dueño por los del archivo hasta la
 *     siguiente regeneración. (Mismo criterio que `getStockForIsr`.)
 *   · Durante `next build` ese error NO tumba el despliegue: ahí sí se usa el
 *     respaldo.
 */
import "server-only";

import { cache } from "react";

import { TRENDING_VEHICLES, type TrendingVehicle } from "@/data/trendingVehicles";
import { getPublicClient, isDatabaseConfigured, warnOnce } from "@/lib/db/client";

import { MIN_EXAMPLES, validarEjemplo } from "./validacion";

export type ImportExamples = {
  vehiculos: readonly TrendingVehicle[];
  /** De dónde salió la lista. `respaldo`: el archivo del repositorio. */
  fuente: "base" | "respaldo";
};

const RESPALDO: ImportExamples = { vehiculos: TRENDING_VEHICLES, fuente: "respaldo" };

/** Tabla de la que se lee. */
const TABLE = "ejemplos_importacion";

/** La Data API no conoce la tabla. Se trata como "sin montar", no como un corte. */
class TablaAusente extends Error {}

function enBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/** Los ejemplos activos y válidos de la base, en su orden. Lanza si la consulta falla. */
async function leerDeLaBase(): Promise<TrendingVehicle[]> {
  const client = getPublicClient();
  if (!client) throw new Error("No hay cliente de la Data API.");

  const { data, error } = await client
    .from(TABLE)
    .select("id, orden, datos")
    .eq("activo", true)
    .order("orden", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    // La tabla no existe para la Data API: base sin la migración 0012 (una
    // rama de pruebas, por ejemplo) o caché de esquema sin refrescar. No es un
    // corte pasajero, es "todavía no está montado": se usa el respaldo.
    if (error.code === "PGRST205" || /schema cache/i.test(error.message)) {
      throw new TablaAusente(error.message);
    }
    throw new Error(`No se pudieron leer los ejemplos: ${error.message}`);
  }

  const vehiculos: TrendingVehicle[] = [];
  for (const fila of (data ?? []) as { id: unknown; datos: unknown }[]) {
    const resultado = validarEjemplo(fila.datos);
    if (!resultado.ok || resultado.vehiculo.id !== fila.id) {
      warnOnce(
        `ejemplo-invalido:${String(fila.id)}`,
        `El ejemplo "${String(fila.id)}" no cumple las reglas del catálogo y no se muestra` +
          (resultado.ok ? "." : `: ${resultado.error}`),
      );
      continue;
    }
    vehiculos.push(resultado.vehiculo);
  }
  return vehiculos;
}

/**
 * Para las páginas que se regeneran (home, /importar). Un error de la base en
 * plena regeneración se lanza a propósito: ver el encabezado.
 *
 * `cache`: la home la llama dos veces en el mismo render (las tarjetas y los
 * presets de la calculadora) y tienen que ver exactamente la misma lista.
 */
export const getImportExamplesForIsr = cache(async (): Promise<ImportExamples> => {
  if (!isDatabaseConfigured()) return RESPALDO;

  let vehiculos: TrendingVehicle[];
  try {
    vehiculos = await leerDeLaBase();
  } catch (error) {
    if (error instanceof TablaAusente) {
      warnOnce(
        "ejemplos-sin-tabla",
        "La Data API no encuentra public.ejemplos_importacion (¿falta la migración 0012 o refrescar su caché de esquema?): se muestra la lista de respaldo.",
      );
      return RESPALDO;
    }
    if (enBuild()) {
      console.warn(
        "[luxcars/ejemplos] La base no respondió durante el build; se compila con la lista de respaldo.",
        error instanceof Error ? error.message : error,
      );
      return RESPALDO;
    }
    throw error;
  }

  if (vehiculos.length < MIN_EXAMPLES) {
    warnOnce(
      "ejemplos-insuficientes",
      `La base tiene ${vehiculos.length} ejemplos válidos y hacen falta ${MIN_EXAMPLES}: se muestra la lista de respaldo.`,
    );
    return RESPALDO;
  }
  return { vehiculos, fuente: "base" };
});

/** Igual, pero nunca lanza: ante cualquier error devuelve el respaldo. Para el sitemap. */
export async function getImportExamples(): Promise<ImportExamples> {
  try {
    return await getImportExamplesForIsr();
  } catch {
    return RESPALDO;
  }
}
