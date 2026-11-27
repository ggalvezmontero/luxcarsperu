/**
 * Un documento como ESTRUCTURA, no como archivo.
 *
 * Cada plantilla devuelve un árbol de bloques (títulos, párrafos, listas,
 * tablas, firmas, notas). Tres renderizadores consumen el mismo árbol: HTML
 * (vista previa, isomórfico), PDF (`@react-pdf/renderer`, servidor) y DOCX
 * (`docx`, servidor). El texto se escribe UNA vez, en la plantilla; si cambia
 * una cláusula, cambian los tres formatos.
 *
 * El texto en línea admite dos marcas, las mismas que usa el paquete original
 * en Markdown: `**negrita**` y `*cursiva*`. `partirInline` las convierte en
 * tramos para que cada renderizador pinte lo suyo.
 */

/** Texto con `**negrita**` y `*cursiva*` opcionales. */
export type Texto = string;

export type Tramo = { texto: string; negrita?: boolean; cursiva?: boolean };

export type Bloque =
  | { tipo: "titulo"; nivel: 1 | 2 | 3; texto: Texto }
  | { tipo: "parrafo"; texto: Texto; alineacion?: "izquierda" | "centro" }
  /**
   * `simple`: cada ítem trae su propia marca ("a)", "1."), no se agrega otra.
   * `numerada`: 1., 2., 3. · `vinetas`: punto · `casillas`: casilla para marcar.
   */
  | { tipo: "lista"; estilo: "simple" | "numerada" | "vinetas" | "casillas"; items: Texto[] }
  | {
      tipo: "tabla";
      cabecera?: Texto[];
      filas: Texto[][];
      /** Anchos relativos por columna (suman lo que sea; se normalizan). */
      anchos?: number[];
    }
  /** Bloque de firmas: una columna por firmante, con sus líneas debajo de la raya. */
  | { tipo: "firmas"; columnas: { lineas: Texto[] }[] }
  /** Texto menor, en gris (notas de uso, aclaraciones). */
  | { tipo: "nota"; texto: Texto }
  | { tipo: "salto" };

export type Estructura = {
  /** Título del documento (encabezado del archivo). */
  titulo: string;
  /** Línea bajo el título: "Expediente LC-2026-001 · Anexo A del contrato…". */
  subtitulo?: string;
  idioma: "es" | "en";
  /** Va en el pie de cada página. */
  codigoExpediente: string;
  bloques: Bloque[];
  /**
   * Portada: "Lima, 28 de noviembre de 2026". Solo si la plantilla lo trae; los
   * renderizadores no inventan fecha ni lugar.
   */
  lugarFecha?: string;
  /**
   * Nombre breve para la cabecera y el pie de cada página ("Contrato de
   * mandato"). Sin él se recorta `titulo`.
   */
  tituloCorto?: string;
  /**
   * Marca de agua de cada página: el isotipo tenue (por defecto), el isotipo
   * más el texto diagonal "BORRADOR", o ninguna (`null`).
   */
  marcaDeAgua?: MarcaDeAgua;
};

export type MarcaDeAgua = "isotipo" | "borrador" | null;

/**
 * Párrafos de cláusula: "4.3 El Mandante…". Separa la numeración del texto
 * para que los renderizadores la pongan en sangría francesa (el número al
 * margen, el texto alineado). Devuelve `null` si el párrafo no empieza así.
 */
export function partirNumeracion(texto: Texto): { numero: string; resto: Texto } | null {
  const m = /^(\d{1,2}(?:\.\d{1,2}){1,3}\.?)\s+(\S[\s\S]*)$/.exec(texto);
  return m ? { numero: m[1], resto: m[2] } : null;
}

/** El título breve para cabecera y pie: `tituloCorto`, o `titulo` recortado. */
export function tituloCortoDe(estructura: Estructura, maximo = 60): string {
  if (estructura.tituloCorto) return estructura.tituloCorto;
  const t = estructura.titulo;
  return t.length > maximo ? `${t.slice(0, maximo - 1).trimEnd()}…` : t;
}

/* -------------------------------------------------------------------------- */
/* Constructores cortos para las plantillas                                   */
/* -------------------------------------------------------------------------- */

export const h1 = (texto: Texto): Bloque => ({ tipo: "titulo", nivel: 1, texto });
export const h2 = (texto: Texto): Bloque => ({ tipo: "titulo", nivel: 2, texto });
export const h3 = (texto: Texto): Bloque => ({ tipo: "titulo", nivel: 3, texto });
export const p = (texto: Texto): Bloque => ({ tipo: "parrafo", texto });
export const centrado = (texto: Texto): Bloque => ({ tipo: "parrafo", texto, alineacion: "centro" });
export const lista = (items: Texto[]): Bloque => ({ tipo: "lista", estilo: "simple", items });
export const numerada = (items: Texto[]): Bloque => ({ tipo: "lista", estilo: "numerada", items });
export const vinetas = (items: Texto[]): Bloque => ({ tipo: "lista", estilo: "vinetas", items });
export const casillas = (items: Texto[]): Bloque => ({ tipo: "lista", estilo: "casillas", items });
export const tabla = (cabecera: Texto[] | null, filas: Texto[][], anchos?: number[]): Bloque => ({
  tipo: "tabla",
  cabecera: cabecera ?? undefined,
  filas,
  anchos,
});
export const firmas = (...columnas: Texto[][]): Bloque => ({
  tipo: "firmas",
  columnas: columnas.map((lineas) => ({ lineas })),
});
export const nota = (texto: Texto): Bloque => ({ tipo: "nota", texto });
export const salto = (): Bloque => ({ tipo: "salto" });

/* -------------------------------------------------------------------------- */
/* Texto en línea                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Parte un texto con `**negrita**` y `*cursiva*` en tramos. Las marcas sin
 * cierre se dejan como texto literal. No anida (negrita dentro de cursiva).
 */
export function partirInline(texto: Texto): Tramo[] {
  const tramos: Tramo[] = [];
  const re = /\*\*([^*]+?)\*\*|\*([^*\s][^*]*?)\*/g;
  let ultimo = 0;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (m.index > ultimo) tramos.push({ texto: texto.slice(ultimo, m.index) });
    if (m[1] !== undefined) tramos.push({ texto: m[1], negrita: true });
    else tramos.push({ texto: m[2], cursiva: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) tramos.push({ texto: texto.slice(ultimo) });
  return tramos.length > 0 ? tramos : [{ texto: "" }];
}

/** El texto sin marcas, para títulos de archivo, búsquedas y pruebas. */
export function textoPlano(texto: Texto): string {
  return partirInline(texto).map((t) => t.texto).join("");
}

/** Todo el texto del documento, plano, en orden. Para pruebas y para buscar. */
export function textoDeEstructura(estructura: Estructura): string {
  const partes: string[] = [estructura.titulo, estructura.subtitulo ?? "", estructura.lugarFecha ?? ""];
  for (const b of estructura.bloques) {
    switch (b.tipo) {
      case "titulo":
      case "parrafo":
      case "nota":
        partes.push(textoPlano(b.texto));
        break;
      case "lista":
        partes.push(...b.items.map(textoPlano));
        break;
      case "tabla":
        if (b.cabecera) partes.push(...b.cabecera.map(textoPlano));
        for (const fila of b.filas) partes.push(...fila.map(textoPlano));
        break;
      case "firmas":
        for (const col of b.columnas) partes.push(...col.lineas.map(textoPlano));
        break;
      case "salto":
        break;
    }
  }
  return partes.join("\n");
}
