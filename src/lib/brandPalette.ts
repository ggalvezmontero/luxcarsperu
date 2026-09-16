/* -----------------------------------------------------------------------------
 * Paleta de marca para contextos que NO pueden leer CSS.
 *
 * La fuente de verdad del sistema de diseno es src/app/globals.css y en la UI
 * los colores se usan SOLO por token (bg-surface, text-silver, border-line...).
 * Escribir un hex dentro de un componente esta prohibido.
 *
 * Pero hay dos consumidores que corren fuera del navegador y no ven esas
 * variables: la imagen social generada con next/og (satori resuelve estilos
 * inline, sin hoja de estilos) y la exportacion a PDF. Para que esos dos no
 * inventen su propia paleta, los valores viven aqui, en un solo archivo, con el
 * nombre del token al que corresponden.
 *
 * Si cambias un color en globals.css, cambialo tambien aqui. No al reves.
 * -------------------------------------------------------------------------- */

export const BRAND_PALETTE = {
  /** --color-void */
  void: "#050505",
  /** --color-bg */
  bg: "#0A0A0B",
  /** --color-surface */
  surface: "#121214",
  /** --color-line */
  line: "#2C2C31",
  /** --color-ink */
  ink: "#FFFFFF",
  /** --color-ink-3 */
  ink3: "#8E8E96",
  /** --color-silver */
  silver: "#C0C0C0",
  /** --color-silver-bright */
  silverBright: "#E8E8EC",
  /** --color-gold */
  gold: "#D4AF37",
} as const;
