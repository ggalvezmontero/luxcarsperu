/**
 * Formato legal de los documentos (PDF y DOCX) sobre los fixtures de
 * `fixture.ts`, sin depender de las plantillas. Las plantillas reales se prueban
 * en `render.test.ts`.
 */
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { tabla, type Bloque } from "@/core/expedientes/documentos/estructura";

import { fixtureCompleto, fixtureTablaLarga, tablaCalendario } from "./fixture";
import { ANCHO_UTIL_PT, anchosDeTabla } from "./recursos";
import { renderDocx } from "./renderDocx";
import { registrarFuentes, renderPdf } from "./renderPdf";

/** Páginas de un PDF de pdfkit: cada una es un objeto `/Type /Page` (no `/Pages`). */
function paginasPdf(pdf: Uint8Array): number {
  return (Buffer.from(pdf).toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

function imagenesPdf(pdf: Uint8Array): number {
  return (Buffer.from(pdf).toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;
}

/** Las partes XML de un .docx (es un ZIP), por nombre. */
function partesDocx(docx: Uint8Array): Record<string, string> {
  const archivos = unzipSync(docx);
  const partes: Record<string, string> = {};
  for (const [nombre, bytes] of Object.entries(archivos)) {
    if (nombre.endsWith(".xml") || nombre.endsWith(".rels")) partes[nombre] = strFromU8(bytes);
  }
  return partes;
}

function unidas(partes: Record<string, string>, patron: RegExp): string {
  return Object.keys(partes)
    .filter((n) => patron.test(n))
    .map((n) => partes[n])
    .join("");
}

/** Las tablas (`<w:tbl>…</w:tbl>`) de una parte, en orden. Sin tablas anidadas. */
function tablas(xml: string | undefined): string[] {
  return xml?.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) ?? [];
}

const filas = (tabla: string | undefined) => tabla?.match(/<w:tr>[\s\S]*?<\/w:tr>/g) ?? [];
const celdas = (fila: string | undefined) => fila?.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
const alineacion = (celda: string | undefined) => /<w:jc w:val="(\w+)"\/>/.exec(celda ?? "")?.[1];

describe("anchos de columna", () => {
  const comoTabla = (b: Bloque) => b as Extract<Bloque, { tipo: "tabla" }>;

  it("la columna de montos se ensancha lo justo para que el total no se parta", () => {
    const t = comoTabla(tablaCalendario());
    const anchos = anchosDeTabla(t);
    expect(anchos.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
    const declarado = 1.7 / (0.7 + 2.6 + 3.2 + 1.7 + 2.6);
    expect(anchos[3]).toBeGreaterThan(declarado);
    // "USD 97,761.79" en negrita a 9,5 pt mide unos 64 pt más el relleno.
    expect((anchos[3] ?? 0) * ANCHO_UTIL_PT).toBeGreaterThan(64 + 10);
    // Lo ganado sale de las columnas de texto, en proporción.
    expect(anchos[2]).toBeLessThan(3.2 / 10.8);
  });

  it("una columna de texto nunca es más angosta que su palabra más larga (un CCI no se parte)", () => {
    const cci = "002-194-000000000000-00";
    const anchos = anchosDeTabla(comoTabla(tabla(["Banco", "Detalle"], [["BCP", `Fondos de Clientes, CCI ${cci}`]], [9, 1])));
    // 19 dígitos y 4 guiones a 9,5 pt son unos 103 pt, más el relleno.
    expect((anchos[1] ?? 0) * ANCHO_UTIL_PT).toBeGreaterThan(103 + 10);
  });

  it("sin cifras, respeta los anchos de la plantilla", () => {
    const anchos = anchosDeTabla(comoTabla(tabla(["A", "B"], [["uno", "dos"]], [1, 3])));
    expect(anchos[0]).toBeCloseTo(0.25, 6);
    expect(anchos[1]).toBeCloseTo(0.75, 6);
  });
});

describe("PDF con formato legal", () => {
  it("el fixture completo pasa a otra página en el salto y lleva fuente, logo y marca de agua", async () => {
    const pdf = await renderPdf(fixtureCompleto());
    expect(paginasPdf(pdf)).toBeGreaterThanOrEqual(2);
    expect(Buffer.from(pdf).toString("latin1")).toMatch(/LuxcarsSerif/);
    // Logo de la cabecera y marca de agua (pdfkit reutiliza cada imagen en todas las páginas).
    expect(imagenesPdf(pdf)).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it("en borrador lleva una imagen más que sin marca de agua", async () => {
    const [borrador, sinMarca] = await Promise.all([renderPdf(fixtureCompleto({ marcaDeAgua: "borrador" })), renderPdf(fixtureCompleto({ marcaDeAgua: null }))]);
    expect(imagenesPdf(borrador)).toBeGreaterThan(imagenesPdf(sinMarca));
  }, 30_000);

  it("una tabla que no cabe en una página se parte entre filas", async () => {
    const [corta, larga] = await Promise.all([renderPdf(fixtureTablaLarga(5)), renderPdf(fixtureTablaLarga(80))]);
    expect(paginasPdf(corta)).toBe(1);
    expect(paginasPdf(larga)).toBeGreaterThanOrEqual(3);
  }, 30_000);

  it("las fuentes se registran una sola vez por proceso", async () => {
    await renderPdf(fixtureCompleto());
    await renderPdf(fixtureCompleto({ idioma: "en" }));
    expect(registrarFuentes()).toBe(1);
  }, 30_000);
});

describe("DOCX con formato legal", () => {
  it("trae cabecera con logo y filete dorado, marca de agua detrás del texto, pie numerado y la fuente incrustada", async () => {
    const partes = partesDocx(await renderDocx(fixtureCompleto()));
    const cabecera = unidas(partes, /^word\/header\d*\.xml$/);
    const pie = unidas(partes, /^word\/footer\d*\.xml$/);
    expect(cabecera).toContain("LUX CARS IMPORT S.A.C.");
    expect(cabecera).toContain("LC-2026-099");
    expect(cabecera.toUpperCase()).toContain("D4AF37");
    expect(cabecera).toContain('behindDoc="1"');
    expect(pie).toContain("PAGE");
    expect(pie).toContain("NUMPAGES");
    expect(pie).toContain("www.luxcars.pe");
    expect(partes["word/fontTable.xml"]).toContain('w:name="Luxcars Serif"');
    expect(partes["word/fontTable.xml"]).toContain("w:embedRegular");
    expect(partes["word/document.xml"]).toContain('w:type="page"');
  }, 30_000);

  it("la marca de agua se ancla fuera de toda tabla, centrada en la página", async () => {
    const partes = partesDocx(await renderDocx(fixtureCompleto()));
    const cabecera = unidas(partes, /^word\/header\d*\.xml$/);
    const anclas = cabecera.match(/<wp:anchor [^>]*>/g) ?? [];
    expect(anclas.length).toBeGreaterThanOrEqual(1);
    for (const a of anclas) expect(a).toContain('layoutInCell="0"');
    for (const t of tablas(cabecera)) expect(t).not.toContain("<wp:anchor");
    expect(cabecera).toContain('relativeFrom="page"');
  }, 30_000);

  it("el calendario de pagos: ancho fijo, cabecera destacada que se repite, filas enteras, montos a la derecha", async () => {
    const partes = partesDocx(await renderDocx(fixtureCompleto()));
    const calendario = tablas(partes["word/document.xml"])[0];
    expect(calendario).toContain('<w:tblW w:type="dxa" w:w="9072"/>');
    expect(calendario).toContain('<w:tblLayout w:type="fixed"/>');
    const [cab, ...cuerpo] = filas(calendario);
    expect(cab).toContain("<w:tblHeader/>");
    expect(cab).toContain('w:fill="E4E4E4"');
    expect(cab).toContain('<w:bottom w:val="single" w:color="111111" w:sz="8"/>');
    expect(cuerpo).toHaveLength(5);
    for (const f of [cab, ...cuerpo]) expect(f).toContain("<w:cantSplit/>");
    // Columnas: Pago (centro), Cuándo, Qué cubre, Monto (derecha), Dónde pagas.
    for (const f of [cab, ...cuerpo]) {
      const c = celdas(f);
      expect(alineacion(c[0])).toBe("center");
      expect(alineacion(c[1])).toBe("left");
      expect(alineacion(c[3])).toBe("right");
      expect(alineacion(c[4])).toBe("left");
    }
    // Tabla corta: todas las filas menos la última se mantienen con la siguiente.
    for (const f of [cab, ...cuerpo.slice(0, -1)]) expect(f).toMatch(/<w:keepNext\/>/);
    expect(cuerpo.at(-1)).not.toMatch(/<w:keepNext\/>/);
  }, 30_000);

  it("una tabla larga puede partirse entre filas, pero la cabecera no queda sola", async () => {
    const partes = partesDocx(await renderDocx(fixtureTablaLarga(40)));
    const [cab, primera, segunda] = filas(tablas(partes["word/document.xml"])[0]);
    expect(cab).toMatch(/<w:keepNext\/>/);
    expect(primera).not.toMatch(/<w:keepNext\/>/);
    expect(segunda).toContain("<w:cantSplit/>");
  }, 30_000);

  it("las firmas van en una sola tabla de dos columnas que no se separa", async () => {
    const partes = partesDocx(await renderDocx(fixtureCompleto()));
    const firmas = tablas(partes["word/document.xml"]).at(-1) ?? "";
    expect(firmas).toContain("Testigo");
    const [primera, segunda] = filas(firmas);
    expect(filas(firmas)).toHaveLength(2);
    expect(celdas(primera)).toHaveLength(2);
    expect(celdas(segunda)).toHaveLength(2);
    expect(primera).toContain("<w:cantSplit/>");
    // Toda la primera fila se mantiene con la segunda.
    const parrafosPrimera = (primera ?? "").match(/<w:p>[\s\S]*?<\/w:p>|<w:p [\s\S]*?<\/w:p>/g) ?? [];
    expect(parrafosPrimera.length).toBeGreaterThan(0);
    for (const p of parrafosPrimera) expect(p).toMatch(/<w:keepNext\/>/);
  }, 30_000);

  it("el párrafo de cierre se mantiene con las firmas", async () => {
    const xml = partesDocx(await renderDocx(fixtureCompleto()))["word/document.xml"] ?? "";
    const cierre = xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*?Firmado en dos ejemplares[\s\S]*?<\/w:p>/)?.[0] ?? "";
    expect(cierre).toContain("Firmado en dos ejemplares");
    expect(cierre).toMatch(/<w:keepNext\/>/);
  }, 30_000);

  it("en inglés rotula el pie en inglés", async () => {
    const partes = partesDocx(await renderDocx(fixtureCompleto({ idioma: "en", titulo: "Letter of authorization" })));
    const pie = unidas(partes, /^word\/footer\d*\.xml$/);
    expect(pie).toContain("Page ");
    expect(pie).not.toContain("Página");
  }, 30_000);
});
