import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* -----------------------------------------------------------------------------
 * El logo real de la marca para las imágenes de vista previa (next/og).
 *
 * POR QUÉ EXISTE: las vistas previas escribían "LUX | CARS" con la tipografía
 * por defecto de satori. Se parecía al logo pero no lo era, y el dueño lo vio
 * al compartir luxcars.pe por WhatsApp (2026-11-16). El logo es un dibujo, no
 * un texto: aquí se lee el mismo archivo que usa la barra de navegación
 * (`public/brand/logo-blanco.svg`) y se entrega como data URI, que es lo que
 * satori acepta en un `<img>`.
 *
 * Se lee una sola vez por proceso. La ruta va escrita entera dentro de
 * `join(process.cwd(), …)` para que el trazado de archivos de Next la incluya
 * en las funciones que generan imágenes bajo demanda (`/c/<código>`).
 *
 * Si el logo cambia de proporción, actualiza LOGO_OG_RATIO (ancho / alto del
 * viewBox): satori necesita ancho y alto explícitos.
 * -------------------------------------------------------------------------- */

/** Ancho / alto del viewBox de logo-blanco.svg (1010 × 590). */
export const LOGO_OG_RATIO = 1010 / 590;

let logo: Promise<string> | null = null;

/** Data URI del logo blanco, para `<img src>` dentro de una ImageResponse. */
export function logoOgSrc(): Promise<string> {
  logo ??= readFile(
    join(process.cwd(), "public/brand/logo-blanco.svg"),
    "base64",
  ).then((data) => `data:image/svg+xml;base64,${data}`);
  return logo;
}

/** Medidas en píxeles del logo para una altura dada. */
export function logoOgSize(height: number) {
  return { width: Math.round(height * LOGO_OG_RATIO), height };
}
