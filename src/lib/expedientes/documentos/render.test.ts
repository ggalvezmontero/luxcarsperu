import { describe, expect, it } from "vitest";

import { construirDocumento, PLANTILLAS } from "@/core/expedientes/documentos";
import type { ContextoExpediente } from "@/core/expedientes/tipos";
import { entradaPorDefecto, presupuestar } from "@/core/expedientes/presupuesto";
import { renderDocx } from "./renderDocx";
import { renderPdf } from "./renderPdf";

/** Expediente mínimo: lo que falte sale como línea en blanco o queda en `faltantes`; acá importa que los archivos se construyan. */
function contexto(): ContextoExpediente {
  const presupuesto = presupuestar(entradaPorDefecto({ precio: 60_000, vehicleType: "gasolina", condition: "nuevo", origin: "otro" }));
  return {
    expediente: {
      id: "e1", codigo: "LC-2026-099", clienteId: "c1", etapa: "contrato", etapaDesde: "2026-11-25T00:00:00Z", origenSolicitudId: null, embarqueId: null, proporcionFlete: 1,
      vehiculo: { marca: "Ford", modelo: "Bronco", version: null, anio: 2026, vin: "1FMEE5DP0PLA00000", color: null, km: null, combustible: null, cilindradaCc: null, transmision: null, condicion: "nuevo", categoria: "gasolina", origen: "otro", paisEnsamblaje: null, docPropiedad: null, pesoKg: null, medidas: null },
      monedaCompra: "USD", precioCompra: 60_000, precioCompraUsd: 60_000, fechaLimiteCompra: null, fechaInspeccion: null, historialRef: null, fechaRelease: null, paisOrigen: "Estados Unidos", puertoOrigen: "Miami",
      presupuesto, honorariosUsd: presupuesto.honorarios, honorariosBaseUsd: presupuesto.honorariosBase, honorariosIgvUsd: presupuesto.honorariosIgv, porcentajeDetraccion: 12, margenH3: 0.03, tarifaCustodiaUsd: 25, costoInspeccionUsd: 350,
      fechaFirma: "2026-11-28", fechaLimiteH2: "2026-12-12", fechaEstEmbarque: "2027-01-09", fechaEstArribo: "2027-02-10", fechaEstEntrega: "2027-03-05", semanasEstimadas: "10 a 14", loaVence: "2027-02-28",
      damNumero: null, damFecha: null, damCanal: null, levanteEn: null, placa: null, tiveNumero: null, kmEntrega: null, fechaEntrega: null, canceladoMotivo: null, cerradoEn: null, createdAt: "2026-11-25T00:00:00Z", updatedAt: "2026-11-25T00:00:00Z",
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
});
