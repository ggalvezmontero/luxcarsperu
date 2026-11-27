/**
 * Recursos compartidos por el PDF y el DOCX de los documentos del expediente:
 * la tipografía incrustada, el logotipo de la cabecera y las marcas de agua, más
 * los rótulos fijos de la empresa. SOLO SERVIDOR.
 *
 * Tipografía: Source Serif 4 (Adobe, licencia SIL OFL 1.1, `fonts/OFL.txt`),
 * subconjunto latino sin hinting: cuatro archivos de ≈ 70 KB. Un documento
 * legal se lee mejor en serif y Word, Acrobat y el navegador la muestran igual
 * porque viaja dentro del archivo.
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
      regular: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/fonts/SourceSerif4-Regular.ttf")),
      negrita: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/fonts/SourceSerif4-Bold.ttf")),
      cursiva: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/fonts/SourceSerif4-It.ttf")),
      negritaCursiva: readFileSync(join(process.cwd(), "src/lib/expedientes/documentos/fonts/SourceSerif4-BoldIt.ttf")),
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
