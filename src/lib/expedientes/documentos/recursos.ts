/**
 * Recursos compartidos por el PDF y el DOCX de los documentos del expediente:
 * la tipografía incrustada, el logotipo de la cabecera y las marcas de agua, más
 * los rótulos fijos de la empresa. SOLO SERVIDOR.
 *
 * Tipografía: "Luxcars Serif", subconjunto latino sin hinting de Source Serif 4
 * (Adobe, licencia SIL OFL 1.1, `fonts/OFL.txt`): cuatro archivos de ≈ 70 KB.
 * Lleva otro nombre porque la OFL reserva el nombre "Source" y un subconjunto
 * cuenta como versión modificada (ver `fonts/README.md`). Un documento legal se
 * lee mejor en serif, y Word, Acrobat y el navegador la muestran igual porque
 * viaja dentro del archivo. Sus cifras son tabulares (todas del mismo ancho),
 * así que los montos alineados a la derecha cuadran dígito con dígito.
 *
 * Imágenes: PNG rasterizados de `public/brand/*.svg` a 1200 px de ancho (react-pdf
 * no pinta bien los SVG con `fill-rule` y Word no admite SVG en todas sus
 * versiones). La marca de agua ya lleva la opacidad (5,5 %) en el PNG porque Word
 * no sabe atenuar una imagen; así los dos formatos salen idénticos.
 *
 * Cada ruta va escrita entera dentro de `join(process.cwd(), …)` para que el
 * trazado de archivos de Next las incluya en la función que genera documentos
 * (la misma técnica que `src/lib/brandLogoOg.ts`). Todo se lee UNA vez por
 * proceso.
 */
import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { alineacionesDeTabla, partirInline, unirCifras, type Bloque, type Texto } from "@/core/expedientes/documentos/estructura";

export const EMPRESA = {
  razonSocial: "LUX CARS IMPORT S.A.C.",
  ruc: "20615410935",
  web: "www.luxcars.pe",
  domicilio: "Calle Dionisio Derteano 184, Of. 1102, San Isidro, Lima",
} as const;

/** Dorado de la marca: solo en el filete bajo la cabecera. El documento es blanco y negro. */
export const ORO = "#d4af37";

/** Proporciones ancho / alto de los PNG, para darles medidas exactas. */
export const PROPORCION = {
  logo: 1200 / 701,
  marcaIsotipo: 1200 / 900,
  marcaBorrador: 871 / 639,
} as const;

/** Medidas en milímetros, iguales en el PDF y en el DOCX. */
export const MEDIDAS_MM = {
  margenLateral: 25,
  margenVertical: 22,
  /** Alto del logotipo en la cabecera. */
  altoLogo: 11,
  /** Ancho del isotipo tenue centrado en la página. */
  anchoMarcaIsotipo: 110,
  /** Ancho del texto diagonal "BORRADOR". */
  anchoMarcaBorrador: 150,
  /** Espacio libre para firmar, encima de la raya. */
  espacioFirma: 28,
} as const;

/**
 * Una tabla de hasta tantas filas (sin contar la cabecera) va entera en la misma
 * página: el calendario de pagos, una ficha del vehículo. Las más largas se
 * parten entre filas, nunca dentro de una, y repiten la cabecera en cada página.
 */
export const FILAS_TABLA_JUNTA = 8;

/** Texto de las celdas de tabla, en puntos (PDF y DOCX). */
export const TABLA_PT = 9.5;
/** Relleno horizontal de cada celda, por lado, en puntos (PDF y DOCX). */
export const RELLENO_CELDA_PT = 5;
/** Ancho útil del cuerpo en puntos: A4 menos los márgenes laterales. */
export const ANCHO_UTIL_PT = ((210 - 2 * MEDIDAS_MM.margenLateral) * 72) / 25.4;

/**
 * Avance aproximado, en em, de los caracteres de una cifra en Luxcars Serif
 * (medido en los TTF): los dígitos son tabulares (0,50 em; 0,54 en negrita).
 * Sirve para que ninguna columna de montos sea más angosta que su monto más largo.
 */
const AVANCE_EM: Record<string, number> = { ".": 0.3, ",": 0.3, " ": 0.24, "\u00a0": 0.24, "%": 0.89, "/": 0.39, "(": 0.38, ")": 0.38, "-": 0.34, "−": 0.55 };

function anchoEm(texto: string, negrita: boolean): number {
  let em = 0;
  for (const ch of texto) {
    if (ch >= "0" && ch <= "9") em += negrita ? 0.542 : 0.5;
    else if (ch in AVANCE_EM) em += AVANCE_EM[ch] ?? 0.5;
    else if (ch >= "A" && ch <= "Z") em += 0.72;
    else em += 0.56;
  }
  return em;
}

const RELLENO_TOTAL_PT = 2 * RELLENO_CELDA_PT + 1.5;

/**
 * Ancho en puntos de lo que no puede partirse en una celda, con su relleno: la
 * celda entera (`entera`, para cifras) o su palabra más larga, separando solo en
 * espacios normales (los de `unirCifras` no separan), igual que react-pdf.
 */
function anchoPt(texto: Texto, { entera = false, negrita = false } = {}): number {
  let maximo = 0;
  let total = 0;
  for (const t of partirInline(texto)) {
    const n = negrita || Boolean(t.negrita);
    const plano = unirCifras(t.texto);
    total += anchoEm(plano, n);
    for (const palabra of plano.split(/ +/)) maximo = Math.max(maximo, anchoEm(palabra, n));
  }
  return (entera ? total : maximo) * TABLA_PT * 1.05 + RELLENO_TOTAL_PT;
}

/**
 * Anchos de las columnas como fracciones que suman 1: los relativos de la
 * plantilla, salvo que una columna quede más angosta que lo que no puede
 * partirse en ella. En las de cifras (y números de fila) eso es la celda
 * entera, para que "USD 97,761.79" no se parta en dos líneas; en las de texto,
 * la palabra más larga (un CCI, un VIN). En ambas cuenta también la palabra más
 * larga de la cabecera. La columna se ensancha lo justo y el ancho se descuenta
 * de las demás en proporción. La usan el PDF y el DOCX, que reparten igual.
 */
export function anchosDeTabla(tabla: Extract<Bloque, { tipo: "tabla" }>): number[] {
  const columnas = tabla.cabecera?.length ?? tabla.filas[0]?.length ?? 1;
  const base = tabla.anchos && tabla.anchos.length === columnas ? tabla.anchos : Array.from({ length: columnas }, () => 1);
  const suma = base.reduce((s, x) => s + x, 0) || 1;
  let fracciones = base.map((x) => x / suma);
  const alineaciones = alineacionesDeTabla(tabla);
  const minimos = alineaciones.map((a, k) => {
    const entera = a !== "izquierda";
    const valores = tabla.filas.map((f) => anchoPt(f[k] ?? "", { entera }));
    const cabecera = anchoPt(tabla.cabecera?.[k] ?? "", { negrita: true });
    return Math.min(0.45, Math.max(0, cabecera, ...valores) / ANCHO_UTIL_PT);
  });
  const sumaMinimos = minimos.reduce((s, x) => s + x, 0);
  // Si ni así caben, se reparte en proporción a lo que cada una necesita.
  if (sumaMinimos >= 1) return minimos.map((m) => m / sumaMinimos);
  // Al ensanchar unas se angostan otras; se repite hasta que ninguna quede bajo su mínimo.
  for (let vuelta = 0; vuelta < columnas; vuelta++) {
    const crecen = fracciones.map((f, k) => (minimos[k] ?? 0) > f + 1e-9);
    if (!crecen.some(Boolean)) break;
    const fijas = fracciones.map((f, k) => (crecen[k] ? (minimos[k] ?? f) : 0)).reduce((s, x) => s + x, 0);
    const resto = fracciones.reduce((s, f, k) => s + (crecen[k] ? 0 : f), 0);
    if (fijas >= 1 || resto <= 0) break;
    fracciones = fracciones.map((f, k) => (crecen[k] ? (minimos[k] ?? f) : (f * (1 - fijas)) / resto));
  }
  return fracciones;
}

export type Recursos = {
  fuentes: { regular: Buffer; negrita: Buffer; cursiva: Buffer; negritaCursiva: Buffer };
  logo: Buffer;
  marcaIsotipo: Buffer;
  marcaBorrador: Buffer;
};

let cache: Recursos | null = null;

/** Fuentes e imágenes como bytes, leídos una sola vez por proceso. */
export function recursos(): Recursos {
  cache ??= {
    fuentes: {
      regular: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/fonts/LuxcarsSerif-Regular.ttf")),
      negrita: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/fonts/LuxcarsSerif-Bold.ttf")),
      cursiva: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/fonts/LuxcarsSerif-Italic.ttf")),
      negritaCursiva: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/fonts/LuxcarsSerif-BoldItalic.ttf")),
    },
    logo: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/img/logo-negro.png")),
    marcaIsotipo: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/img/marca-isotipo.png")),
    marcaBorrador: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/img/marca-borrador.png")),
  };
  return cache;
}

/** Rótulos fijos de cabecera y pie, en el idioma del documento. */
export function rotulos(idioma: "es" | "en") {
  const en = idioma === "en";
  return {
    expediente: en ? "File" : "Expediente",
    pagina: (n: number | string, total: number | string) => (en ? `Page ${n} of ${total}` : `Página ${n} de ${total}`),
    paginaPrefijo: en ? "Page " : "Página ",
    paginaDe: en ? " of " : " de ",
    lineaEmpresa: `${EMPRESA.razonSocial} · RUC ${EMPRESA.ruc}`,
  };
}
