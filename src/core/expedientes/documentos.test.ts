import { describe, expect, it } from "vitest";

import { CAMPOS, FICHA, camposPlantilla, esCampo, esManual, fechaEnLetras, monto, porcentaje } from "./campos";
import { PLANTILLAS, construirDocumento, nombreArchivo, plantillaDe, textoDeEstructura } from "./documentos";
import { partirInline } from "./documentos/estructura";
import { renderHtml } from "./documentos/renderHtml";
import { evaluarAvance } from "./avance";
import { entradaPorDefecto, presupuestar } from "./presupuesto";
import type { ContextoExpediente, Contraparte, Documento, Expediente, Tarea } from "./tipos";

const HOY = new Date("2026-11-25T15:00:00Z");

function expediente(cambios: Partial<Expediente> = {}): Expediente {
  const presupuesto = presupuestar(
    entradaPorDefecto({
      precio: 98_500,
      monedaCompra: "CAD",
      tcCompraRef: 0.72,
      vehicleType: "hev",
      condition: "nuevo",
      origin: "otro",
      cylinderCapacityCc: 3445,
      importerProfile: "primera-importacion",
      inland: 450,
      proporcionFlete: 0.5,
      gastosRegistrales: 180,
      margenH3: 0.03,
    }),
  );
  return {
    id: "e1",
    codigo: "LC-2026-011",
    clienteId: "c1",
    etapa: "contrato",
    etapaDesde: "2026-11-20T12:00:00Z",
    origenSolicitudId: null,
    embarqueId: "b1",
    proporcionFlete: 0.5,
    vehiculo: {
      marca: "Toyota",
      modelo: "Tundra",
      version: "TRD Pro CrewMax",
      anio: 2026,
      vin: "5TFPC5DB1RX000000",
      color: "Blanco",
      km: 1200,
      combustible: null,
      cilindradaCc: 3445,
      transmision: "Automática 10 velocidades",
      condicion: "nuevo",
      categoria: "hev",
      origen: "otro",
      paisEnsamblaje: "Estados Unidos",
      docPropiedad: "NVIS sin registrar",
      pesoKg: 2650,
      medidas: "5.93 × 2.03 × 1.98 m",
    },
    monedaCompra: "CAD",
    precioCompra: 98_500,
    precioCompraUsd: presupuesto.precioUsd,
    fechaLimiteCompra: "2026-12-15",
    fechaInspeccion: "2026-12-04",
    historialRef: "CARFAX Canada n.º 123",
    fechaRelease: "2026-12-18",
    paisOrigen: "Canadá",
    puertoOrigen: "Vancouver",
    presupuesto,
    honorariosUsd: presupuesto.honorarios,
    honorariosBaseUsd: presupuesto.honorariosBase,
    honorariosIgvUsd: presupuesto.honorariosIgv,
    porcentajeDetraccion: 12,
    margenH3: 0.03,
    tarifaCustodiaUsd: 25,
    costoInspeccionUsd: 350,
    fechaFirma: "2026-11-28",
    fechaLimiteH2: "2026-12-12",
    fechaEstEmbarque: "2027-01-09",
    fechaEstArribo: "2027-02-10",
    fechaEstEntrega: "2027-03-05",
    semanasEstimadas: "10 a 14",
    loaVence: "2027-02-28",
    damNumero: null,
    damFecha: null,
    damCanal: null,
    levanteEn: null,
    placa: null,
    tiveNumero: null,
    kmEntrega: null,
    fechaEntrega: null,
    canceladoMotivo: null,
    cerradoEn: null,
    createdAt: "2026-11-20T12:00:00Z",
    updatedAt: "2026-11-20T12:00:00Z",
    reservado: { precioTope: 100_000, tcCompraRef: 0.72, vendedorId: "v1", inspectorId: "i1", agenteAduanaId: "a1", notasInternas: null },
    ...cambios,
  };
}

const CONTRAPARTES: Contraparte[] = [
  { id: "v1", tipo: "vendedor", nombre: "Example Motors Ltd.", pais: "Canadá", direccion: "1234 Kingsway, Vancouver, BC V5R 5J4, Canada", contacto: "Mark Lee", email: "sales@example.ca", telefono: "+1 604 000 0000", rucOTaxId: null, bancoVerificadoEn: null },
  { id: "f1", tipo: "forwarder", nombre: "Example Logistics Inc.", pais: "Canadá", direccion: null, contacto: null, email: "ops@example-logistics.com", telefono: null, rucOTaxId: null, bancoVerificadoEn: null },
  { id: "a1", tipo: "agente_aduana", nombre: "Agencia Prueba S.A.", pais: "Perú", direccion: null, contacto: "Sectorista", email: "aduana@prueba.test", telefono: null, rucOTaxId: "20999999999", bancoVerificadoEn: null },
  { id: "i1", tipo: "inspector", nombre: "Inspector Prueba", pais: "Canadá", direccion: null, contacto: null, email: null, telefono: null, rucOTaxId: null, bancoVerificadoEn: null },
];

const FIJOS = {
  LUXCARS_RUC: "20600000001",
  LUXCARS_DOMICILIO: "Calle Prueba 184, San Isidro, Lima",
  LUXCARS_PARTIDA: "14000000",
  LUXCARS_REPRESENTANTE: "Representante Prueba",
  LUXCARS_REP_DNI: "40000000",
  LUXCARS_CORREO: "info@luxcars.pe",
  LUXCARS_TELEFONO: "+51 980 794 348",
  CTA_OPER_BANCO: "BCP",
  CTA_OPER_NUMERO: "194-0000000-1-00",
  CTA_OPER_CCI: "002-194-000000000000-00",
  CTA_FONDOS_BANCO: "BCP",
  CTA_FONDOS_NUMERO: "194-0000000-1-01",
  CTA_FONDOS_CCI: "002-194-000000000000-01",
  CTA_DETRACCION_NUMERO: "00-000-000000",
} as const;

function contexto(cambios: Partial<ContextoExpediente> = {}, exp: Partial<Expediente> = {}): ContextoExpediente {
  return {
    expediente: expediente(exp),
    cliente: {
      id: "c1",
      tipo: "empresa",
      razonSocial: "Inversiones Andinas S.A.C.",
      ruc: "20123456789",
      dni: null,
      domicilio: "Calle Falsa 123, Miraflores, Lima",
      partida: "13000000",
      representante: "Juan Pérez Rojas",
      representanteDni: "08000000",
      representanteCargo: "Gerente general",
      email: "jperez@empresa.test",
      telefono: "+51 999 999 999",
      actividad: "Transporte de carga por carretera",
      bancoOrigen: "BCP, cuenta corriente en dólares",
      beneficiarioFinal: "Juan Pérez Rojas, DNI 08000000, 60 %",
      origenFondos: "Utilidades acumuladas de la empresa",
      esPep: false,
      kycFichaRucEn: null,
      kycVigenciaEn: null,
      kycListasEn: null,
      kycListasResultado: null,
      kycCompleto: false,
      userId: null,
      notasInternas: null,
      createdAt: "2026-11-20T12:00:00Z",
      updatedAt: "2026-11-20T12:00:00Z",
    },
    embarque: {
      id: "b1",
      codigo: "EMB-2026-01",
      modalidad: "consolidado",
      contenedor: "c40hc",
      forwarderId: "f1",
      aseguradoraId: null,
      almacenConsolidacion: "5678 Industrial Ave, Delta, BC",
      puertoOrigen: "Vancouver",
      puertoDestino: "Callao",
      fechaReleaseEst: null,
      fechaReleaseReal: null,
      fechaCarga: null,
      fechaZarpeEst: "2027-01-09",
      fechaZarpeReal: null,
      fechaArriboEst: "2027-02-10",
      fechaArriboReal: null,
      nave: null,
      masterBl: null,
      precinto: null,
      fleteTotalUsd: null,
      gastosContenedorUsd: null,
      declaracionExportacion: null,
      estado: "planificado",
      notasInternas: null,
    },
    tareas: [],
    hitos: [],
    aprobaciones: [],
    etapas: [],
    movimientos: [],
    documentos: [],
    contrapartes: CONTRAPARTES,
    ...cambios,
  };
}

function documento(tipo: Documento["tipo"], estado: Documento["estado"]): Documento {
  return {
    id: `${tipo}-${estado}`,
    expedienteId: "e1",
    tipo,
    version: 1,
    estado,
    origen: "generado",
    titulo: tipo,
    plantillaVersion: null,
    tienePdf: true,
    tieneDocx: true,
    tieneFirmado: estado === "firmado",
    visibleCliente: false,
    emitidoEn: "2026-11-25T12:00:00Z",
    firmadoEn: estado === "firmado" ? "2026-11-28" : null,
    createdAt: "2026-11-25T12:00:00Z",
  };
}

function tarea(clave: string, estado: Tarea["estado"]): Tarea {
  return { id: clave, expedienteId: "e1", etapa: "contrato", clave, titulo: clave, descripcion: null, responsable: "cliente", estado, venceEl: null, hechaEn: null, visibleCliente: true, orden: 0 };
}

/* -------------------------------------------------------------------------- */

describe("formatos de los campos", () => {
  it("escribe las fechas en letras y los montos con miles y dos decimales", () => {
    expect(fechaEnLetras("2026-11-28")).toBe("28 de noviembre de 2026");
    expect(fechaEnLetras(null)).toBe("");
    expect(monto(12450)).toBe("12,450.00");
    expect(monto(0)).toBe("0.00");
    expect(porcentaje(0.06)).toBe("6 %");
    expect(porcentaje(0.035)).toBe("3.5 %");
  });

  it("parte negritas y cursivas en tramos", () => {
    expect(partirInline("Hola **mundo** y *tú*")).toEqual([
      { texto: "Hola " },
      { texto: "mundo", negrita: true },
      { texto: " y " },
      { texto: "tú", cursiva: true },
    ]);
    expect(partirInline("sin marcas")).toEqual([{ texto: "sin marcas" }]);
  });
});

describe("camposPlantilla", () => {
  it("llena los campos desde el expediente, el cliente, el embarque, las contrapartes y el presupuesto", () => {
    const { campos, faltantes } = camposPlantilla(contexto(), FIJOS);
    expect(campos.EXPEDIENTE).toBe("LC-2026-011");
    expect(campos.FECHA_FIRMA).toBe("28 de noviembre de 2026");
    expect(campos.MODALIDAD_EMBARQUE).toBe("contenedor consolidado con otra unidad");
    expect(campos.TIPO_CONTENEDOR).toBe("40' HC");
    expect(campos.PROPORCION_FLETE).toBe("50 %");
    expect(campos.VEH_KM).toBe("1,200 km");
    expect(campos.VEH_COMBUSTIBLE).toBe("Híbrido gasolina");
    expect(campos.VEH_CONDICION).toBe("Nuevo");
    expect(campos.VENDEDOR_CONTACTO).toBe("Mark Lee, sales@example.ca");
    expect(campos.FORWARDER_CONTACTO).toBe("ops@example-logistics.com");
    expect(campos.AGENTE_ADUANA_RUC).toBe("20999999999");
    expect(campos.PRECIO_TOPE).toBe("100,000.00");
    expect(campos.PRECIO_COMPRA_USD).toBe("70,920.00");
    expect(campos.MARGEN_H3).toBe("3");
    expect(campos.PORCENTAJE_DETRACCION).toBe("12");
    expect(campos.TASA_PERCEPCION).toBe("10 %");
    expect(campos.LUXCARS_RUC).toBe(FIJOS.LUXCARS_RUC);
    // Solo quedan vacíos los que llegan con cada evento o se escriben a mano.
    expect(faltantes).toEqual([]);
  });

  it("detecta lo que falta y separa lo manual", () => {
    const ctx = contexto();
    ctx.cliente = { ...ctx.cliente!, ruc: null, domicilio: null };
    const r = camposPlantilla(ctx, {});
    expect(r.faltantes).toEqual(expect.arrayContaining(["CLIENTE_RUC", "CLIENTE_DOMICILIO", "LUXCARS_RUC", "CTA_OPER_NUMERO"]));
    expect(r.manualesVacios).toEqual(expect.arrayContaining(["DIAS_ESPERA_MAX", "VIN_OTRA_UNIDAD", "TC_REFERENCIAL"]));
    expect(r.faltantes).not.toContain("DIAS_ESPERA_MAX");
  });

  it("lo que llega de fuera gana, y lo vacío de fuera no borra lo del expediente", () => {
    const r = camposPlantilla(contexto(), { ...FIJOS, CIUDAD_FIRMA: "Arequipa", VEH_MARCA: "   " });
    expect(r.campos.CIUDAD_FIRMA).toBe("Arequipa");
    expect(r.campos.VEH_MARCA).toBe("Toyota");
  });

  it("adapta razón social, RUC y representante a una persona natural", () => {
    const ctx = contexto();
    ctx.cliente = { ...ctx.cliente!, tipo: "persona", ruc: null, dni: "45678901", representante: null, representanteDni: null, representanteCargo: null, partida: null };
    const { campos, faltantes } = camposPlantilla(ctx, FIJOS);
    expect(campos.CLIENTE_RUC).toBe("45678901");
    expect(campos.CLIENTE_REPRESENTANTE).toBe("Inversiones Andinas S.A.C.");
    expect(campos.CLIENTE_REP_DNI).toBe("45678901");
    expect(faltantes).toEqual([]);
  });
});

describe("plantillas", () => {
  it("son ocho, una por documento del paquete de firma, y cada tipo se resuelve", () => {
    expect(PLANTILLAS.map((p) => p.tipo)).toEqual([
      "contrato", "anexo_a", "anexo_b", "anexo_c", "anexo_d", "loa", "instrucciones_vendedor", "instrucciones_forwarder",
    ]);
    expect(plantillaDe("contrato")?.version).toMatch(/^contrato@/);
    expect(plantillaDe("bill_of_sale")).toBeNull();
  });

  it("cada plantilla referencia solo campos existentes y construye sin faltantes con el expediente completo", () => {
    const ctx = contexto();
    for (const plantilla of PLANTILLAS) {
      const doc = construirDocumento(plantilla, ctx, FIJOS);
      expect(doc.usados.length, plantilla.tipo).toBeGreaterThan(5);
      for (const campo of doc.usados) expect(esCampo(campo), `${plantilla.tipo} usa ${campo}`).toBe(true);
      expect(doc.faltantes, plantilla.tipo).toEqual([]);
      expect(doc.estructura.codigoExpediente).toBe("LC-2026-011");
      expect(doc.estructura.bloques.length, plantilla.tipo).toBeGreaterThan(3);
    }
  });

  it("todos los campos de la ficha los usa alguna plantilla, salvo los de cierre (fases siguientes)", () => {
    const ctx = contexto();
    const usados = new Set<string>();
    for (const plantilla of PLANTILLAS) for (const k of construirDocumento(plantilla, ctx, FIJOS).usados) usados.add(k);
    const sinUsar = CAMPOS.filter((k) => !usados.has(k));
    expect(sinUsar.every((k) => FICHA[k].grupo === "cierre" || k === "TC_REFERENCIAL"), sinUsar.join(", ")).toBe(true);
  });

  it("detecta los faltantes de ESE documento y los manuales salen como línea en blanco", () => {
    const ctx = contexto();
    ctx.cliente = { ...ctx.cliente!, ruc: null };
    const doc = construirDocumento(plantillaDe("contrato")!, ctx, FIJOS);
    expect(doc.faltantes).toEqual(["CLIENTE_RUC"]);
    expect(doc.manualesVacios).toContain("DIAS_ESPERA_MAX");
    expect(textoDeEstructura(doc.estructura)).toContain("esperar hasta ______________ días calendario");
    // Las instrucciones al forwarder no leen el RUC del cliente... sí lo leen; el Anexo B no.
    expect(construirDocumento(plantillaDe("anexo_b")!, ctx, FIJOS).faltantes).toEqual([]);
  });

  it("el contrato tiene las veintiuna cláusulas y la cláusula 18.1 admite las acciones del portal", () => {
    const texto = textoDeEstructura(construirDocumento(plantillaDe("contrato")!, contexto(), FIJOS).estructura);
    for (const titulo of ["Primera: Antecedentes", "Undécima: Transporte", "Décima octava: Comunicaciones", "Vigésima primera: Disposiciones generales"]) {
      expect(texto).toContain(titulo);
    }
    expect(texto).toContain("mediante las acciones de su cuenta en el portal de LUXCARS, que quedan registradas con fecha, hora y usuario.");
    expect(texto).toContain("artículos 1790 y 1806 del Código Civil");
    expect(texto).not.toContain("USD 100,000.00");
    expect(texto).toContain("CAD 100,000.00");
  });

  it("renderHtml devuelve un fragmento no vacío, escapado y con el título", () => {
    const ctx = contexto();
    ctx.cliente = { ...ctx.cliente!, razonSocial: "Tienda <Ampersand> & Hijos S.A.C." };
    for (const plantilla of PLANTILLAS) {
      const html = renderHtml(construirDocumento(plantilla, ctx, FIJOS).estructura);
      expect(html.length, plantilla.tipo).toBeGreaterThan(500);
      expect(html).toContain('<article class="doc"');
      expect(html).not.toContain("<Ampersand>");
    }
    const html = renderHtml(construirDocumento(plantillaDe("anexo_d")!, ctx, FIJOS).estructura);
    expect(html).toContain("Tienda &lt;Ampersand&gt; &amp; Hijos S.A.C.");
    expect(html).toContain("<strong>Lux Cars Import S.A.C.</strong>");
    expect(html).toContain('<table class="doc-tabla">');
  });

  it("nombra los archivos con el código, el tipo y la versión", () => {
    expect(nombreArchivo("LC-2026-011", "contrato", 2, "pdf")).toBe("LC-2026-011-contrato-v2.pdf");
  });
});

describe("ficha de datos (snapshot para mantener el paquete de Claude Docs sincronizado)", () => {
  it("nombre, grupo, descripción, ejemplo y si es manual", () => {
    const filas = CAMPOS.map((k) => `${k} · ${FICHA[k].grupo}${esManual(k) ? " · manual" : ""} · ${FICHA[k].descripcion} · ej. ${FICHA[k].ejemplo}`);
    expect(filas).toMatchSnapshot();
  });
});

describe("compuertas con documentos", () => {
  it("entra a búsqueda con contrato y LOA firmados aunque la tarea siga pendiente", () => {
    const ctx = contexto(
      {
        tareas: [tarea("cliente.firmar_contrato_loa", "pendiente"), tarea("luxcars.kyc", "hecha")],
        documentos: [documento("contrato", "firmado"), documento("loa", "firmado")],
      },
      { etapa: "contrato" },
    );
    expect(evaluarAvance(ctx, "busqueda", HOY).permitido).toBe(true);
  });

  it("no basta el contrato firmado sin la LOA, ni un contrato solo emitido", () => {
    const base = { tareas: [tarea("luxcars.kyc", "hecha")] };
    const soloContrato = contexto({ ...base, documentos: [documento("contrato", "firmado")] }, { etapa: "contrato" });
    expect(evaluarAvance(soloContrato, "busqueda", HOY).faltantes.map((f) => f.clave)).toEqual(["contrato_firmado"]);
    const emitidos = contexto({ ...base, documentos: [documento("contrato", "emitido"), documento("loa", "emitido")] }, { etapa: "contrato" });
    expect(evaluarAvance(emitidos, "busqueda", HOY).permitido).toBe(false);
  });

  it("la tarea hecha sigue valiendo como evidencia", () => {
    const ctx = contexto({ tareas: [tarea("cliente.firmar_contrato_loa", "hecha"), tarea("luxcars.kyc", "hecha")] }, { etapa: "contrato" });
    expect(evaluarAvance(ctx, "busqueda", HOY).permitido).toBe(true);
  });
});
