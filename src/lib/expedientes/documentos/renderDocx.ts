/**
 * DOCX de una `Estructura` con el paquete `docx`. SOLO SERVIDOR: lo importa
 * la ruta que genera documentos. Es la versión editable para el abogado o para
 * un ajuste puntual; el PDF es el que se firma.
 *
 * Mismo árbol y mismo formato legal que `renderPdf`: A4 con márgenes de 25 × 22
 * mm, Luxcars Serif (Source Serif 4) incrustada en el archivo (Word la usa aunque no esté
 * instalada), cabecera con el logotipo y la razón social sobre un filete
 * dorado, portada centrada, cláusulas en mayúsculas (estilos de Word,
 * navegables), numerales "4.3" en sangría francesa, tablas de bordes finos,
 * notas con filete lateral, firmas que no se partan, pie con código, página x
 * de y y la web, e isotipo como marca de agua (imagen flotante detrás del texto
 * dentro de la cabecera, así se repite en cada página).
 */
import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableBorders,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  TextWrappingType,
  VerticalPositionAlign,
  VerticalPositionRelativeFrom,
  WidthType,
  type IParagraphOptions,
  type IRunOptions,
} from "docx";

import {
  alineacionesDeTabla,
  partirInline,
  partirNumeracion,
  tituloCortoDe,
  unirCifras,
  type Alineacion,
  type Bloque,
  type Estructura,
  type Texto,
} from "@/core/expedientes/documentos/estructura";

import { EMPRESA, FILAS_TABLA_JUNTA, MEDIDAS_MM, ORO, PROPORCION, RELLENO_CELDA_PT, TABLA_PT, anchosDeTabla, recursos, rotulos } from "./recursos";

const FUENTE = "Luxcars Serif";
/** Tamaños en medios puntos (docx): 21 = 10,5 pt. */
const CUERPO = 21;
const TABLA = TABLA_PT * 2;
const NOTA = 18;
const PIE = 15;
/** Interlineado 1,35 en 240avos de línea. */
const INTERLINEADO = 324;

const TINTA = "111111";
const GRIS = "5F6368";
const GRIS_LINEA = "C4C4C8";
/** Fondo de la cabecera de tabla: gris claro que se imprime nítido en blanco y negro. */
const GRIS_CABECERA = "E4E4E4";
const ORO_HEX = ORO.replace("#", "").toUpperCase();

/** Twips (1/20 pt). 1 mm = 56,69 twips. */
const twips = (milimetros: number) => Math.round(milimetros * 56.6929);
/** Píxeles a 96 ppp, la unidad de `ImageRun.transformation`. */
const px = (milimetros: number) => Math.round(milimetros * 3.7795);
/** EMU, la unidad de los desplazamientos de imágenes flotantes. */
const emu = (milimetros: number) => Math.round(milimetros * 36000);

const PAGINA = { ancho: 11906, alto: 16838 };
const MARGEN_X = twips(MEDIDAS_MM.margenLateral);
const MARGEN_Y = twips(MEDIDAS_MM.margenVertical);
/** Ancho útil de la A4 con esos márgenes. */
const ANCHO_UTIL = PAGINA.ancho - 2 * MARGEN_X;
/** Sangría de los numerales "4.3" y de las listas. */
const SANGRIA = 680;

const SIN_BORDE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const SIN_BORDES = { top: SIN_BORDE, bottom: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE };
const BORDE_TABLA = { style: BorderStyle.SINGLE, size: 4, color: GRIS_LINEA };
const BORDES_TABLA = { top: BORDE_TABLA, bottom: BORDE_TABLA, left: BORDE_TABLA, right: BORDE_TABLA };
/** Bordes a nivel de tabla: sin esto `docx` dibuja la rejilla negra por defecto. */
const REJILLA_GRIS = { ...BORDES_TABLA, insideHorizontal: BORDE_TABLA, insideVertical: BORDE_TABLA };
/** Raya negra bajo la cabecera de las tablas. */
const BORDE_CABECERA = { style: BorderStyle.SINGLE, size: 8, color: TINTA };
const ALINEAR: Record<Alineacion, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  izquierda: AlignmentType.LEFT,
  centro: AlignmentType.CENTER,
  derecha: AlignmentType.RIGHT,
};

type Extra = { size?: number; color?: string; bold?: boolean; italics?: boolean };

function tramos(texto: Texto, extra: Extra = {}): TextRun[] {
  return partirInline(texto).map(
    (t) =>
      new TextRun({
        text: unirCifras(t.texto),
        bold: extra.bold || t.negrita,
        italics: extra.italics || t.cursiva,
        font: FUENTE,
        size: extra.size ?? CUERPO,
        color: extra.color ?? TINTA,
      }),
  );
}

function parrafo(texto: Texto, opciones: Omit<IParagraphOptions, "children" | "text"> = {}, extra: Extra = {}): Paragraph {
  return new Paragraph({ children: tramos(texto, extra), ...opciones });
}

function run(text: string, extra: Omit<IRunOptions, "text" | "children"> = {}): TextRun {
  return new TextRun({ text, font: FUENTE, size: PIE, color: GRIS, ...extra });
}

/** Anchos de columna en DXA: los de `anchosDeTabla`, ajustados para que sumen el ancho útil exacto. */
function anchosDxa(b: Extract<Bloque, { tipo: "tabla" }>): number[] {
  const dxa = anchosDeTabla(b).map((f) => Math.round(f * ANCHO_UTIL));
  const diferencia = ANCHO_UTIL - dxa.reduce((s, x) => s + x, 0);
  if (dxa.length > 0) dxa[dxa.length - 1] = (dxa[dxa.length - 1] ?? 0) + diferencia;
  return dxa;
}

/**
 * Tabla a todo el ancho con anchos fijos (Word no los reajusta), cabecera
 * destacada que se repite en cada página, cifras alineadas a la derecha
 * (`alineacionesDeTabla`) y filas que no se parten. Una tabla corta
 * (`FILAS_TABLA_JUNTA`) va entera: cada fila "se mantiene con la siguiente".
 */
function tabla(b: Extract<Bloque, { tipo: "tabla" }>): Table {
  const anchos = anchosDxa(b);
  const alineaciones = alineacionesDeTabla(b);
  const junta = b.filas.length <= FILAS_TABLA_JUNTA;
  const filas = [...(b.cabecera ? [{ celdas: b.cabecera, cabecera: true }] : []), ...b.filas.map((celdas) => ({ celdas, cabecera: false }))];
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: REJILLA_GRIS,
    columnWidths: anchos,
    rows: filas.map(({ celdas, cabecera }, j) => {
      // La cabecera nunca queda sola al pie; en una tabla corta, ninguna fila se separa de la siguiente.
      const conSiguiente = j < filas.length - 1 && (cabecera || junta);
      return new TableRow({
        tableHeader: cabecera,
        cantSplit: true,
        children: celdas.map(
          (c, k) =>
            new TableCell({
              width: { size: anchos[k] ?? 1000, type: WidthType.DXA },
              borders: cabecera ? { ...BORDES_TABLA, bottom: BORDE_CABECERA } : BORDES_TABLA,
              shading: cabecera ? { type: ShadingType.CLEAR, color: "auto", fill: GRIS_CABECERA } : undefined,
              margins: { top: 70, bottom: 70, left: RELLENO_CELDA_PT * 20, right: RELLENO_CELDA_PT * 20 },
              children: [
                new Paragraph({
                  alignment: ALINEAR[alineaciones[k] ?? "izquierda"],
                  spacing: { line: 276, after: 0 },
                  keepNext: conSiguiente,
                  keepLines: true,
                  children: tramos(c, { size: TABLA, bold: cabecera }),
                }),
              ],
            }),
        ),
      });
    }),
  });
}

/** Firmas de dos en dos por fila. */
function enPares<T>(xs: T[]): T[][] {
  const filas: T[][] = [];
  for (let i = 0; i < xs.length; i += 2) filas.push(xs.slice(i, i + 2));
  return filas;
}

/**
 * Bloque de firmas como UNA tabla sin bordes, dos firmantes por fila: espacio
 * para firmar, la raya y las líneas debajo. Ninguna fila se parte (`cantSplit`)
 * y todas menos la última "se mantienen con la siguiente", así el bloque entero
 * queda en la misma página.
 */
function firmas(b: Extract<Bloque, { tipo: "firmas" }>): Table {
  const n = b.columnas.length > 1 ? 2 : 1;
  const ancho = Math.floor(ANCHO_UTIL / n);
  const pares = enPares(b.columnas);
  return new Table({
    width: { size: ANCHO_UTIL, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: TableBorders.NONE,
    columnWidths: Array.from({ length: n }, () => ancho),
    rows: pares.map((par, j) => {
      const ultimaFila = j === pares.length - 1;
      const celdas = par.map(
        (col) =>
          new TableCell({
            width: { size: ancho, type: WidthType.DXA },
            borders: SIN_BORDES,
            margins: { top: 0, bottom: 60, left: 400, right: 400 },
            children: [
              new Paragraph({ spacing: { before: twips(MEDIDAS_MM.espacioFirma), after: 0, line: 240 }, keepNext: true, keepLines: true }),
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 6, color: TINTA, space: 4 } },
                spacing: { before: 0, after: 60, line: 240 },
                keepNext: true,
                keepLines: true,
              }),
              ...col.lineas.map(
                (l, k) =>
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 0, line: 276 },
                    keepNext: !ultimaFila || k < col.lineas.length - 1,
                    keepLines: true,
                    children: tramos(l, { size: TABLA, bold: k === 0 }),
                  }),
              ),
            ],
          }),
      );
      if (par.length === 1 && n === 2) {
        celdas.push(new TableCell({ width: { size: ancho, type: WidthType.DXA }, borders: SIN_BORDES, children: [new Paragraph({ keepNext: !ultimaFila })] }));
      }
      return new TableRow({ cantSplit: true, children: celdas });
    }),
  });
}

function bloques(lista: Bloque[]): (Paragraph | Table)[] {
  const salida: (Paragraph | Table)[] = [];
  let instanciaNumerada = 0;
  for (const [indice, b] of lista.entries()) {
    switch (b.tipo) {
      case "titulo":
        salida.push(
          parrafo(b.texto, {
            heading: b.nivel === 1 ? HeadingLevel.HEADING_1 : b.nivel === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            alignment: AlignmentType.LEFT,
            keepNext: true,
            keepLines: true,
          }),
        );
        break;
      case "parrafo": {
        // El párrafo de cierre ("Firmado en…, el…") no se separa de las firmas.
        const conFirmas = lista[indice + 1]?.tipo === "firmas" ? { keepNext: true, keepLines: true } : {};
        const num = b.alineacion === "centro" ? null : partirNumeracion(b.texto);
        if (num) {
          salida.push(
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              indent: { left: SANGRIA, hanging: SANGRIA },
              tabStops: [{ type: TabStopType.LEFT, position: SANGRIA }],
              ...conFirmas,
              children: [new TextRun({ text: `${num.numero}\t`, font: FUENTE, size: CUERPO, color: TINTA }), ...tramos(num.resto)],
            }),
          );
        } else {
          salida.push(parrafo(b.texto, { alignment: b.alineacion === "centro" ? AlignmentType.CENTER : AlignmentType.JUSTIFIED, ...conFirmas }));
        }
        break;
      }
      case "nota":
        salida.push(
          parrafo(
            b.texto,
            {
              alignment: AlignmentType.LEFT,
              border: { left: { style: BorderStyle.SINGLE, size: 10, color: GRIS_LINEA, space: 8 } },
              indent: { left: 170 },
              spacing: { before: 160, after: 120, line: 300 },
              keepLines: true,
            },
            { size: NOTA, color: "444444", italics: true },
          ),
        );
        break;
      case "salto":
        salida.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } }));
        break;
      case "lista":
        if (b.estilo === "numerada") instanciaNumerada += 1;
        for (const item of b.items) {
          const comun = { alignment: AlignmentType.JUSTIFIED, spacing: { after: 60, line: INTERLINEADO } } as const;
          if (b.estilo === "numerada") {
            salida.push(parrafo(item, { ...comun, numbering: { reference: "numeros", level: 0, instance: instanciaNumerada } }));
          } else if (b.estilo === "vinetas") {
            salida.push(parrafo(item, { ...comun, bullet: { level: 0 } }));
          } else if (b.estilo === "casillas") {
            salida.push(
              new Paragraph({
                ...comun,
                indent: { left: SANGRIA, hanging: 400 },
                children: [new TextRun({ text: "☐  ", font: "Segoe UI Symbol", size: CUERPO, color: TINTA }), ...tramos(item)],
              }),
            );
          } else {
            salida.push(parrafo(item, { ...comun, indent: { left: SANGRIA / 2 } }));
          }
        }
        break;
      case "tabla":
        salida.push(tabla(b), new Paragraph({ spacing: { before: 0, after: 80, line: 240 } }));
        break;
      case "firmas":
        salida.push(firmas(b), new Paragraph({ spacing: { before: 0, after: 60, line: 240 } }));
        break;
    }
  }
  return salida;
}

/* -------------------------------------------------------------------------- */
/* Cabecera, pie y marca de agua                                              */
/* -------------------------------------------------------------------------- */

function imagenFlotante(data: Buffer, anchoMm: number, proporcion: number): ImageRun {
  return new ImageRun({
    type: "png",
    data,
    transformation: { width: px(anchoMm), height: px(anchoMm / proporcion) },
    altText: { title: "Marca de agua", description: "Isotipo de Lux Cars Import", name: "marca-de-agua" },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
      behindDocument: true,
      allowOverlap: true,
      lockAnchor: true,
      // Fuera de toda celda: con "diseño en celda" Word la ubicaría respecto de la celda, no de la página.
      layoutInCell: false,
      wrap: { type: TextWrappingType.NONE },
      margins: { top: emu(0), bottom: emu(0), left: emu(0), right: emu(0) },
    },
  });
}

function cabecera(estructura: Estructura): Header {
  const r = recursos();
  const t = rotulos(estructura.idioma);
  const marca = estructura.marcaDeAgua ?? "isotipo";
  const flotantes: ImageRun[] = [];
  if (marca !== null) flotantes.push(imagenFlotante(r.marcaIsotipo, MEDIDAS_MM.anchoMarcaIsotipo, PROPORCION.marcaIsotipo));
  if (marca === "borrador") flotantes.push(imagenFlotante(r.marcaBorrador, MEDIDAS_MM.anchoMarcaBorrador, PROPORCION.marcaBorrador));

  const anchoLogo = Math.round(ANCHO_UTIL * 0.35);
  return new Header({
    children: [
      new Table({
        width: { size: ANCHO_UTIL, type: WidthType.DXA },
        layout: TableLayoutType.FIXED,
        borders: TableBorders.NONE,
        columnWidths: [anchoLogo, ANCHO_UTIL - anchoLogo],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: anchoLogo, type: WidthType.DXA },
                borders: SIN_BORDES,
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                verticalAlign: "bottom",
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 0, line: 240 },
                    children: [
                      new ImageRun({
                        type: "png",
                        data: r.logo,
                        transformation: { width: px(MEDIDAS_MM.altoLogo * PROPORCION.logo), height: px(MEDIDAS_MM.altoLogo) },
                        altText: { title: "Lux Cars Import", description: "Logotipo de Lux Cars Import S.A.C.", name: "logo" },
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: ANCHO_UTIL - anchoLogo, type: WidthType.DXA },
                borders: SIN_BORDES,
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                verticalAlign: "bottom",
                children: [
                  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0, line: 276 }, children: [run(t.lineaEmpresa, { characterSpacing: 12 })] }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 0, after: 0, line: 276 },
                    children: [run(`${t.expediente} ${estructura.codigoExpediente} · ${tituloCortoDe(estructura)}`, { characterSpacing: 12 })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      // Filete dorado. La marca de agua se ancla en este párrafo y no en la tabla
      // de arriba: anclada dentro de una celda, Word la ubicaría respecto de ella.
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ORO_HEX, space: 1 } }, spacing: { before: 60, after: 0, line: 120 }, children: flotantes }),
    ],
  });
}

function pie(estructura: Estructura): Footer {
  const t = rotulos(estructura.idioma);
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: GRIS_LINEA, space: 4 } },
        tabStops: [
          { type: TabStopType.CENTER, position: Math.round(ANCHO_UTIL / 2) },
          { type: TabStopType.RIGHT, position: ANCHO_UTIL },
        ],
        spacing: { before: 0, after: 0, line: 240 },
        children: [
          run(`${estructura.codigoExpediente} · ${tituloCortoDe(estructura)}`),
          run(`\t${t.paginaPrefijo}`),
          new TextRun({ children: [PageNumber.CURRENT], font: FUENTE, size: PIE, color: GRIS }),
          run(t.paginaDe),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FUENTE, size: PIE, color: GRIS }),
          run(`\t${EMPRESA.web}`),
        ],
      }),
    ],
  });
}

/* -------------------------------------------------------------------------- */
/* Documento                                                                  */
/* -------------------------------------------------------------------------- */

/** El DOCX como bytes. */
export async function renderDocx(estructura: Estructura): Promise<Uint8Array> {
  const r = recursos();
  const t = rotulos(estructura.idioma);
  const portada: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 100, line: 312 },
      keepNext: true,
      children: [new TextRun({ text: estructura.titulo, bold: true, allCaps: true, characterSpacing: 44, font: FUENTE, size: 28, color: TINTA })],
    }),
  ];
  if (estructura.subtitulo) {
    portada.push(parrafo(estructura.subtitulo, { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 100, line: INTERLINEADO }, keepNext: true }, { italics: true, color: "333333" }));
  }
  if (estructura.lugarFecha) {
    portada.push(parrafo(estructura.lugarFecha, { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 100, line: INTERLINEADO }, keepNext: true }));
  }
  // Filete corto centrado bajo la portada: un párrafo vacío con borde inferior y sangrías grandes.
  const sangriaFilete = Math.round((ANCHO_UTIL - twips(21)) / 2);
  portada.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 5, color: TINTA, space: 1 } },
      indent: { left: sangriaFilete, right: sangriaFilete },
      spacing: { before: 120, after: 320, line: 120 },
      keepNext: true,
    }),
  );

  const doc = new Document({
    creator: EMPRESA.razonSocial,
    title: estructura.titulo,
    subject: `${t.expediente} ${estructura.codigoExpediente}`,
    fonts: [{ name: FUENTE, data: r.fuentes.regular, bold: r.fuentes.negrita, italic: r.fuentes.cursiva, boldItalic: r.fuentes.negritaCursiva }],
    styles: {
      default: {
        document: {
          run: { font: FUENTE, size: CUERPO, color: TINTA },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: INTERLINEADO } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, allCaps: true, characterSpacing: 28, font: FUENTE, color: TINTA },
          paragraph: { spacing: { before: 320, after: 120, line: 312 }, keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: CUERPO, bold: true, allCaps: true, characterSpacing: 20, font: FUENTE, color: TINTA },
          paragraph: { spacing: { before: 280, after: 100, line: 312 }, keepNext: true },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: CUERPO, bold: true, font: FUENTE, color: TINTA },
          paragraph: { spacing: { before: 200, after: 80, line: 312 }, keepNext: true },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "numeros",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: SANGRIA, hanging: 400 } }, run: { font: FUENTE } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGINA.ancho, height: PAGINA.alto },
            margin: { top: MARGEN_Y + twips(8), bottom: MARGEN_Y + twips(2), left: MARGEN_X, right: MARGEN_X, header: twips(10), footer: twips(10) },
          },
        },
        headers: { default: cabecera(estructura) },
        footers: { default: pie(estructura) },
        children: [...portada, ...bloques(estructura.bloques)],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
