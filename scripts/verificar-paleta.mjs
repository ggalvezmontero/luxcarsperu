#!/usr/bin/env node
/**
 * Comprueba que src/lib/brandPalette.ts no se haya desincronizado de los tokens
 * de src/app/globals.css.
 *
 * POR QUE EXISTE: la UI usa los colores solo por token, pero hay dos
 * consumidores que corren fuera del navegador y no ven las variables CSS — la
 * imagen social de next/og (satori resuelve estilos inline) y la exportacion a
 * PDF. Sus colores viven copiados en brandPalette.ts.
 *
 * Esa copia YA se desincronizo una vez: al subir --color-ink-3 por contraste
 * AA, la imagen social y el PDF se quedaron con el gris viejo que no cumple.
 * Nada lo detecto porque compila igual de bien.
 *
 * Uso:  node scripts/verificar-paleta.mjs
 * Sale con codigo 1 y lista las diferencias si algo no coincide.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(raiz, "src/app/globals.css"), "utf8");
const ts = readFileSync(join(raiz, "src/lib/brandPalette.ts"), "utf8");

// --color-nombre: #RRGGBB;
const tokens = new Map();
for (const m of css.matchAll(/--(color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
  tokens.set(m[1], m[2].toUpperCase());
}

// /** --color-nombre */ clave: "#RRGGBB",
const entradas = [
  ...ts.matchAll(/\/\*\*\s*--(color-[a-z0-9-]+)\s*\*\/\s*\n\s*([A-Za-z0-9_]+)\s*:\s*"(#[0-9a-fA-F]{3,8})"/g),
];

if (entradas.length === 0) {
  console.error("No se encontro ninguna entrada anotada en brandPalette.ts.");
  console.error("Cada color debe llevar encima el comentario /** --color-xxx */.");
  process.exit(1);
}

const problemas = [];
for (const [, token, clave, valor] of entradas) {
  const esperado = tokens.get(token);
  if (!esperado) {
    problemas.push(`${clave}: apunta a --${token}, que no existe en globals.css.`);
  } else if (esperado !== valor.toUpperCase()) {
    problemas.push(`${clave}: brandPalette dice ${valor.toUpperCase()} y --${token} vale ${esperado}.`);
  }
}

if (problemas.length > 0) {
  console.error(`Paleta desincronizada (${problemas.length}):`);
  for (const p of problemas) console.error(`  - ${p}`);
  console.error("\nLa fuente de verdad es globals.css. Corrige brandPalette.ts, no al reves.");
  process.exit(1);
}

console.log(`Paleta sincronizada: ${entradas.length} colores coinciden con globals.css.`);
