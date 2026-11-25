/**
 * DOCX de una `Estructura` con el paquete `docx`. SOLO SERVIDOR: lo importa
 * la ruta que genera documentos. Es la versión editable para el abogado o para
 * un ajuste puntual; el PDF es el que se firma.
 *
 * Mismo árbol que `renderHtml` y `renderPdf`: cabecera con la razón social,
 * pie con el código de expediente y la página, títulos como estilos de Word
 * (navegables), tablas con anchos relativos.
 */
import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
} from "docx";

import { partirInline, type Bloque, type Estructura, type Texto } from "@/core/expedientes/documentos/estructura";

const FUENTE = "Arial";
/** Tamaños en medios puntos (docx): 20 = 10 pt. */
const CUERPO = 20;
const GRIS = "5F6368";
const LINEA = "B8B8BE";
/** Ancho útil de una A4 con márgenes de 2.54 cm, en DXA (1 cm = 567). */
const ANCHO_UTIL_DXA = 11906 - 2 * 1440;

function tramos(texto: Texto, extra: { size?: number; color?: string } = {}): TextRun[] {
  return partirInline(texto).map(
    (t) => new TextRun({ text: t.texto, bold: t.negrita, italics: t.cursiva, font: FUENTE, size: extra.size ?? CUERPO, color: extra.color }),
  );
}

function parrafo(texto: Texto, opciones: Omit<IParagraphOptions, "children" | "text"> = {}, extra: { size?: number; color?: string } = {}): Paragraph {
  return new Paragraph({ children: tramos(texto, extra), spacing: { after: 100 }, ...opciones });
}

function normalizar(anchos: number[] | undefined, columnas: number): number[] {
  const base = anchos && anchos.length === columnas ? anchos : Array.from({ length: columnas }, () => 1);
  const suma = base.reduce((s, x) => s + x, 0) || 1;
  return base.map((x) => Math.round((x / suma) * ANCHO_UTIL_DXA));
}

const BORDE = { style: BorderStyle.SINGLE, size: 4, color: LINEA };
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };

function tabla(b: Extract<Bloque, { tipo: "tabla" }>): Table {
  const columnas = b.cabecera?.length ?? b.filas[0]?.length ?? 1;
  const anchos = normalizar(b.anchos, columnas);
  const fila = (celdas: Texto[], cabecera: boolean) =>
    new TableRow({
      tableHeader: cabecera,
      cantSplit: true,
      children: celdas.map(
        (c, k) =>
          new TableCell({
            width: { size: anchos[k] ?? 1000, type: WidthType.DXA },
            borders: BORDES,
            shading: cabecera ? { fill: "F1F1F3" } : undefined,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: [
              new Paragraph({
                children: partirInline(c).map(
                  (t) => new TextRun({ text: t.texto, bold: cabecera || t.negrita, italics: t.cursiva, font: FUENTE, size: 18 }),
                ),
              }),
            ],
          }),
      ),
    });
  return new Table({
    width: { size: ANCHO_UTIL_DXA, type: WidthType.DXA },
    columnWidths: anchos,
    rows: [...(b.cabecera ? [fila(b.cabecera, true)] : []), ...b.filas.map((f) => fila(f, false))],
  });
}

/**
 * Bloque de firmas como tabla sin bordes: una columna por firmante, con una
 * raya (borde superior de la celda) y las líneas debajo.
 */
function firmas(b: Extract<Bloque, { tipo: "firmas" }>): Table {
  const n = Math.max(1, b.columnas.length);
  const ancho = Math.floor(ANCHO_UTIL_DXA / n);
  const sinBorde = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return new Table({
    width: { size: ANCHO_UTIL_DXA, type: WidthType.DXA },
    columnWidths: b.columnas.map(() => ancho),
    rows: [
      new TableRow({
        cantSplit: true,
        children: b.columnas.map(
          (col) =>
            new TableCell({
              width: { size: ancho, type: WidthType.DXA },
              borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "111111" }, bottom: sinBorde, left: sinBorde, right: sinBorde },
              margins: { top: 80, bottom: 60, left: 200, right: 200 },
              children: col.lineas.map(
                (l, k) =>
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: partirInline(l).map((t) => new TextRun({ text: t.texto, bold: k === 0 || t.negrita, italics: t.cursiva, font: FUENTE, size: 18 })),
                  }),
              ),
            }),
        ),
      }),
    ],
  });
}

function bloques(lista: Bloque[]): (Paragraph | Table)[] {
  const salida: (Paragraph | Table)[] = [];
  let instanciaNumerada = 0;
  for (const b of lista) {
    switch (b.tipo) {
      case "titulo":
        salida.push(
          parrafo(b.texto, {
            heading: b.nivel === 1 ? HeadingLevel.HEADING_1 : b.nivel === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            spacing: { before: 220, after: 80 },
            keepNext: true,
          }),
        );
        break;
      case "parrafo":
        salida.push(parrafo(b.texto, { alignment: b.alineacion === "centro" ? AlignmentType.CENTER : AlignmentType.LEFT }));
        break;
      case "nota":
        salida.push(parrafo(b.texto, { spacing: { before: 120, after: 80 } }, { size: 16, color: GRIS }));
        break;
      case "salto":
        salida.push(new Paragraph({ border: { bottom: BORDE }, spacing: { before: 120, after: 120 } }));
        break;
      case "lista":
        if (b.estilo === "numerada") instanciaNumerada += 1;
        for (const item of b.items) {
          if (b.estilo === "numerada") {
            salida.push(parrafo(item, { numbering: { reference: "numeros", level: 0, instance: instanciaNumerada }, spacing: { after: 60 } }));
          } else if (b.estilo === "vinetas") {
            salida.push(parrafo(item, { bullet: { level: 0 }, spacing: { after: 60 } }));
          } else if (b.estilo === "casillas") {
            salida.push(new Paragraph({ children: [new TextRun({ text: "☐  ", font: "Segoe UI Symbol", size: CUERPO }), ...tramos(item)], indent: { left: 360, hanging: 360 }, spacing: { after: 60 } }));
          } else {
            salida.push(parrafo(item, { indent: { left: 360 }, spacing: { after: 60 } }));
          }
        }
        break;
      case "tabla":
        salida.push(tabla(b), new Paragraph({ spacing: { after: 60 } }));
        break;
      case "firmas":
        salida.push(new Paragraph({ spacing: { before: 480 } }), firmas(b), new Paragraph({ spacing: { after: 60 } }));
        break;
    }
  }
  return salida;
}

/** El DOCX como bytes. */
export async function renderDocx(estructura: Estructura): Promise<Uint8Array> {
  const en = estructura.idioma === "en";
  const doc = new Document({
    creator: "Lux Cars Import S.A.C.",
    title: estructura.titulo,
    subject: `Expediente ${estructura.codigoExpediente}`,
    styles: {
      default: { document: { run: { font: FUENTE, size: CUERPO, color: "111111" } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: FUENTE, color: "111111" } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, font: FUENTE, color: "111111" } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 20, bold: true, font: FUENTE, color: "111111" } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "numeros",
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 360, hanging: 360 } } } }],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: BORDE },
                tabStops: [{ type: "right", position: ANCHO_UTIL_DXA }],
                children: [
                  new TextRun({ text: "LUX CARS IMPORT S.A.C.", font: FUENTE, size: 16, color: GRIS, characterSpacing: 40 }),
                  new TextRun({ text: `\t${en ? "File" : "Expediente"} ${estructura.codigoExpediente}`, font: FUENTE, size: 16, color: GRIS }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: BORDE },
                tabStops: [{ type: "right", position: ANCHO_UTIL_DXA }],
                children: [
                  new TextRun({ text: `${estructura.codigoExpediente} · ${estructura.titulo}`, font: FUENTE, size: 15, color: GRIS }),
                  new TextRun({ text: `\t${en ? "Page " : "Página "}`, font: FUENTE, size: 15, color: GRIS }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FUENTE, size: 15, color: GRIS }),
                  new TextRun({ text: en ? " of " : " de ", font: FUENTE, size: 15, color: GRIS }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FUENTE, size: 15, color: GRIS }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ children: [new TextRun({ text: estructura.titulo, bold: true, font: FUENTE, size: 30 })], spacing: { after: 80 } }),
          ...(estructura.subtitulo ? [parrafo(estructura.subtitulo, { spacing: { after: 240 } }, { color: GRIS })] : []),
          ...bloques(estructura.bloques),
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
