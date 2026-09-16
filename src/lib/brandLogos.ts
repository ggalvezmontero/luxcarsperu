/**
 * Logos de marca (SVG vectoriales, versiones vigentes). Fuente y licencia de
 * cada archivo en docs/FOTOS.md. Todos tienen fondo transparente.
 *
 * `mode` dice cómo pasarlos a monocromo sobre fondo oscuro:
 *   invert → logo oscuro: se vuelve blanco con `brightness-0 invert`.
 *   none   → ya es blanco (BMW, Tesla): se usa tal cual.
 *   flip   → logo de color con texto blanco (óvalo Ford): gris claro con
 *            texto oscuro vía `grayscale invert`.
 */
export type LogoMode = "invert" | "none" | "flip";

export const BRAND_LOGOS: { name: string; file: string; mode: LogoMode }[] = [
  { name: "Audi", file: "audi.svg", mode: "invert" },
  { name: "BMW", file: "bmw.svg", mode: "none" },
  { name: "Mercedes-Benz", file: "mercedes.svg", mode: "invert" },
  { name: "Porsche", file: "porsche.svg", mode: "invert" },
  { name: "Toyota", file: "toyota.svg", mode: "invert" },
  { name: "Ford", file: "ford.svg", mode: "flip" },
  { name: "Chevrolet", file: "chevrolet.svg", mode: "invert" },
  { name: "Tesla", file: "tesla.svg", mode: "none" },
  { name: "Jeep", file: "jeep.svg", mode: "invert" },
  { name: "Lexus", file: "lexus.svg", mode: "invert" },
  { name: "Range Rover", file: "rangerover.svg", mode: "invert" },
  { name: "Cadillac", file: "cadillac.svg", mode: "invert" },
  { name: "Lamborghini", file: "lamborghini.svg", mode: "invert" },
  { name: "Ferrari", file: "ferrari.svg", mode: "invert" },
  { name: "McLaren", file: "mclaren.svg", mode: "invert" },
  { name: "Aston Martin", file: "astonmartin.svg", mode: "invert" },
  { name: "Rolls-Royce", file: "rollsroyce.svg", mode: "invert" },
  { name: "Bentley", file: "bentley.svg", mode: "invert" },
  { name: "Dodge", file: "dodge.svg", mode: "invert" },
  { name: "Chrysler", file: "chrysler.svg", mode: "invert" },
  { name: "RAM", file: "ram.svg", mode: "invert" },
];

/** Clases Tailwind que dejan el logo en blanco/gris claro sobre fondo oscuro. */
export const LOGO_MODE_CLASS: Record<LogoMode, string> = {
  invert: "brightness-0 invert",
  none: "",
  flip: "grayscale invert brightness-110",
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** Logo de una marca por nombre aproximado ("Dodge SRT" → Dodge). */
export function findBrandLogo(brand: string) {
  const key = normalize(brand);
  const hit = BRAND_LOGOS.find((b) => {
    const n = normalize(b.name);
    return n === key || key.startsWith(n) || n.startsWith(key);
  });
  return hit ? { src: `/images/brands/${hit.file}`, mode: hit.mode, name: hit.name } : null;
}
