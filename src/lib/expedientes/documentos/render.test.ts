import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";

import { construirDocumento, PLANTILLAS } from "@/core/expedientes/documentos";
import type { ContextoExpediente } from "@/core/expedientes/tipos";
import { entradaPorDefecto, presupuestar } from "@/core/expedientes/presupuesto";
import { fixtureCompleto } from "./fixture";
import { renderDocx } from "./renderDocx";
import { registrarFuentes, renderPdf } from "./renderPdf";

/** Expediente mínimo: lo que falte sale como línea en blanco o queda en `faltantes`; acá importa que los archivos se construyan. */
function contexto(): ContextoExpediente {
  const presupuesto = presupuestar(entradaPorDefecto({ precio: 60_000, vehicleType: "gasolina", condition: "nuevo", origin: "otro" }));
  return {
    expediente: {
      id: "e1", codigo: "LC-2026-099", clienteId: "c1", etapa: "contrato", etapaDesde: "2026-11-25T00:00:00Z", origenSolicitudId: null, embarqueId: null, proporcionFlete: 1,
      vehiculo: { marca: "Ford", modelo: "Bronco", version: null, anio: 2026, vin: "1FMEE5DP0PLA00000", color: null, km: null, combustible: null, cilindradaCc: null, transmision: null, condicion: "nuevo", categoria: "gasolina", origen: "otro", paisEnsamblaje: null, docPropiedad: null, pesoKg: null, medidas: null, clase: "M1" },
      monedaCompra: "USD", precioCompra: 60_000, precioCompraUsd: 60_000, fechaLimiteCompra: null, fechaInspeccion: null, historialRef: null, fechaRelease: null, paisOrigen: "Estados Unidos", puertoOrigen: "Miami",
      presupuesto, honorariosUsd: presupuesto.honorarios, honorariosBaseUsd: presupuesto.honorariosBase, honorariosIgvUsd: presupuesto.honorariosIgv, porcentajeDetraccion: 12, margenH3: 0.03, tarifaCustodiaUsd: 25, costoInspeccionUsd: 350,
      fechaFirma: "2026-11-28", fechaLimiteH2: "2026-12-12", fechaEstEmbarque: "2027-01-09", fechaEstArribo: "2027-02-10", fechaEstEntrega: "2027-03-05", semanasEstimadas: "10 a 14", loaVence: "2027-02-28",
      damNumero: null, damFecha: null, damCanal: null, damFactorConversion: null, damTcSbs: null, levanteEn: null, placa: null, tiveNumero: null, kmEntrega: null, fechaEntrega: null, canceladoMotivo: null, cerradoEn: null, createdAt: "2026-11-25T00:00:00Z", updatedAt: "2026-11-25T00:00:00Z",
      reservado: { precioTope: 62_000, tcCompraRef: 1, vendedorId: null, inspectorId: null, agenteAduanaId: null, notasInternas: null },
    },
    cliente: {
      id: "c1", tipo: "empresa", razonSocial: "Prueba & Cía S.A.C.", ruc: "20123456789", dni: null, domicilio: "Av. Prueba 123, Lima", partida: "12345678", representante: "Ana Pérez", representanteDni: "12345678", representanteCargo: "Gerente general", email: "ana@prueba.test", telefono: "+51 999 000 000",
      actividad: null, bancoOrigen: null, beneficiarioFinal: null, origenFondos: null, esPep: false, kycFichaRucEn: null, kycVigenciaEn: null, kycListasEn: null, kycListasResultado: null, kycCompleto: false, userId: null, notasInternas: null, createdAt: "", updatedAt: "",
    },
    embarque: null, tareas: [], hitos: [], aprobaciones: [], etapas: [], movimientos: [], documentos: [], contrapartes: [],
  };
}

const FIJOS = { LUXCARS_RUC: "20600000001", LUXCARS_DOMICILIO: "Calle X 1, Lima", LUXCARS_PARTIDA: "1", LUXCARS_REPRESENTANTE: "R", LUXCARS_REP_DNI: "1", LUXCARS_CORREO: "a@b.pe", LUXCARS_TELEFONO: "1", CTA_OPER_BANCO: "B", CTA_OPER_NUMERO: "1", CTA_OPER_CCI: "1", CTA_FONDOS_BANCO: "B", CTA_FONDOS_NUMERO: "2", CTA_FONDOS_CCI: "2", CTA_DETRACCION_NUMERO: "3" };

/** Páginas de un PDF de pdfkit: cada una es un objeto `/Type /Page` (no `/Pages`). */
function paginasPdf(pdf: Uint8Array): number {
  const texto = Buffer.from(pdf).toString("latin1");
  return (texto.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

function archivosDocx(docx: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(docx);
}

describe("renderizadores de servidor", () => {
  it("producen un PDF y un DOCX reales para cada plantilla", async () => {
    for (const plantilla of PLANTILLAS) {
      const { estructura } = construirDocumento(plantilla, contexto(), FIJOS);
      const [pdf, docx] = await Promise.all([renderPdf(estructura), renderDocx(estructura)]);
      expect(Buffer.from(pdf.slice(0, 5)).toString("latin1"), plantilla.tipo).toBe("%PDF-");
      expect(pdf.byteLength, plantilla.tipo).toBeGreaterThan(5_000);
      // Un .docx es un ZIP: empieza con "PK".
      expect(Buffer.from(docx.slice(0, 2)).toString("latin1"), plantilla.tipo).toBe("PK");
      expect(docx.byteLength, plantilla.tipo).toBeGreaterThan(3_000);
    }
  }, 60_000);

  it("el PDF del fixture completo se genera, pasa a otra página en el salto y lleva la fuente incrustada", async () => {
    const pdf = await renderPdf(fixtureCompleto());
    expect(paginasPdf(pdf)).toBeGreaterThanOrEqual(2);
    const texto = Buffer.from(pdf).toString("latin1");
    expect(texto).toMatch(/SourceSerif4/);
    // Tres imágenes como mínimo: logo (cabecera) y marca de agua en cada página.
    expect((texto.match(/\/Subtype\s*\/Image/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // Sin salto, el mismo contenido cabe en menos páginas.
    const sinSalto = await renderPdf(fixtureCompleto({ bloques: fixtureCompleto().bloques.filter((b) => b.tipo !== "salto") }));
    expect(paginasPdf(sinSalto)).toBeLessThan(paginasPdf(pdf) + 1);
  }, 30_000);

  it("el PDF en borrador y sin marca de agua también se generan", async () => {
    const [borrador, sinMarca] = await Promise.all([
      renderPdf(fixtureCompleto({ marcaDeAgua: "borrador" })),
      renderPdf(fixtureCompleto({ marcaDeAgua: null })),
    ]);
    const img = (pdf: Uint8Array) => (Buffer.from(pdf).toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;
    expect(img(borrador)).toBeGreaterThan(img(sinMarca));
  }, 30_000);

  it("las fuentes se registran una sola vez por proceso", async () => {
    await renderPdf(fixtureCompleto());
    await renderPdf(fixtureCompleto({ idioma: "en" }));
    expect(registrarFuentes()).toBe(1);
  }, 30_000);

  it("el DOCX trae cabecera con logo y marca de agua detrás del texto, pie con numeración y la fuente incrustada", async () => {
    const docx = await renderDocx(fixtureCompleto());
    const archivos = archivosDocx(docx);
    const nombres = Object.keys(archivos);
    const header = nombres.filter((n) => /^word\/header\d*\.xml$/.test(n)).map((n) => strFromU8(archivos[n])).join("");
    const footer = nombres.filter((n) => /^word\/footer\d*\.xml$/.test(n)).map((n) => strFromU8(archivos[n])).join("");
    const cuerpo = strFromU8(archivos["word/document.xml"]);
    expect(header).toContain("LUX CARS IMPORT S.A.C.");
    expect(header).toContain("LC-2026-099");
    expect(header).toContain("<wp:anchor");
    expect(header).toContain('behindDoc="1"');
    expect(header.toUpperCase()).toContain("D4AF37");
    expect(footer).toContain("PAGE");
    expect(footer).toContain("NUMPAGES");
    expect(footer).toContain("www.luxcars.pe");
    expect(nombres.filter((n) => /^word\/media\/.*\.png$/.test(n)).length).toBeGreaterThanOrEqual(2);
    expect(nombres.filter((n) => /^word\/fonts\//.test(n)).length).toBeGreaterThanOrEqual(1);
    expect(cuerpo).toContain('w:type="page"');
    expect(cuerpo).toContain("Contrato de mandato");
  }, 30_000);

  it("el DOCX en inglés rotula el pie en inglés", async () => {
    const docx = await renderDocx(fixtureCompleto({ idioma: "en", titulo: "Letter of authorization" }));
    const archivos = archivosDocx(docx);
    const footer = Object.keys(archivos).filter((n) => /^word\/footer\d*\.xml$/.test(n)).map((n) => strFromU8(archivos[n])).join("");
    expect(footer).toContain("Page ");
    expect(footer).not.toContain("Página");
  }, 30_000);
});
