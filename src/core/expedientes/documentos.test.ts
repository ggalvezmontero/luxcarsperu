import { describe, expect, it } from "vitest";

import { CAMPOS, CAMPOS_EMPRESA, FICHA, camposPlantilla, esCampo, esCampoEmpresa, fechaEnLetras, monto, porcentaje } from "./campos";
import { PLANTILLAS, TIPOS_DESDE_LIBRO, construirDocumento, nombreArchivo, plantillaDe, textoDeEstructura } from "./documentos";
import { camposActaRendicion, datosActa, datosAvisoPago, datosConstancia, datosLiquidacion, datosPago5, montoDelAviso, saldoCuenta } from "./ledger";
import { COLUMNAS_COMPUERTA, ORIGEN_CAMPO, PLANTILLAS_POR_ETAPA, datosPorEtapa, plantillasDelMapaExisten } from "./datosPorEtapa";
import { partirInline } from "./documentos/estructura";
import { renderHtml } from "./documentos/renderHtml";
import { evaluarAvance } from "./avance";
import { entradaPorDefecto, presupuestar } from "./presupuesto";
import type { ContextoExpediente, Contraparte, Documento, Expediente, Movimiento, Tarea } from "./tipos";

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
      proporcionFlete: 0.5,
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
      clase: "N1",
    },
    monedaCompra: "CAD",
    precioCompra: 98_500,
    precioCompraUsd: presupuesto.precioUsd,
    fechaLimiteCompra: "2026-12-15",
    fechaInspeccion: null,
    historialRef: "MSO sin matricular · recalls por VIN: ninguno",
    fechaRelease: "2026-12-18",
    paisOrigen: "Canadá",
    puertoOrigen: "Vancouver",
    presupuesto,
    honorariosUsd: presupuesto.honorarios,
    honorariosBaseUsd: presupuesto.honorariosBase,
    honorariosIgvUsd: presupuesto.honorariosIgv,
    porcentajeDetraccion: 12,
    tarifaCustodiaUsd: 25,
    costoInspeccionUsd: null,
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
    damFactorConversion: null,
    damTcSbs: null,
    levanteEn: null,
    placa: null,
    tiveNumero: null,
    kmEntrega: null,
    fechaEntrega: null,
    canceladoMotivo: null,
    cerradoEn: null,
    createdAt: "2026-11-20T12:00:00Z",
    updatedAt: "2026-11-20T12:00:00Z",
    reservado: { precioTope: 100_000, tcCompraRef: 0.72, vendedorId: "v1", brokerId: "k1", inspectorId: null, agenteAduanaId: "a1", notasInternas: null },
    ...cambios,
  };
}

const CONTRAPARTES: Contraparte[] = [
  { id: "v1", tipo: "vendedor", nombre: "Example Motors Ltd.", pais: "Canadá", direccion: "1234 Kingsway, Vancouver, BC V5R 5J4, Canada", contacto: "Mark Lee", email: "sales@example.ca", telefono: "+1 604 000 0000", rucOTaxId: null, datosBancarios: null, bancoVerificadoEn: null, bancoVerificadoPor: null, notas: null },
  { id: "f1", tipo: "forwarder", nombre: "Example Logistics Inc.", pais: "Canadá", direccion: null, contacto: null, email: "ops@example-logistics.com", telefono: null, rucOTaxId: null, datosBancarios: null, bancoVerificadoEn: null, bancoVerificadoPor: null, notas: null },
  { id: "a1", tipo: "agente_aduana", nombre: "Agencia Prueba S.A.", pais: "Perú", direccion: null, contacto: "Sectorista", email: "aduana@prueba.test", telefono: null, rucOTaxId: "20999999999", datosBancarios: null, bancoVerificadoEn: null, bancoVerificadoPor: null, notas: null },
  { id: "i1", tipo: "inspector", nombre: "Inspecciones Prueba LLC", pais: "Estados Unidos", direccion: null, contacto: "Inspector de campo", email: "campo@inspecciones.test", telefono: null, rucOTaxId: null, datosBancarios: null, bancoVerificadoEn: null, bancoVerificadoPor: null, notas: null },
  { id: "k1", tipo: "broker", nombre: "Example Auto Brokers LLC", pais: "Estados Unidos", direccion: "9800 NW 12th St, Doral, FL 33172, USA", contacto: "Daniel Ortega", email: "deals@example-brokers.com", telefono: "+1 305 000 0000", rucOTaxId: null, datosBancarios: null, bancoVerificadoEn: null, bancoVerificadoPor: null, notas: null },
];

const FIJOS = {
  LUXCARS_RUC: "20600000001",
  LUXCARS_DOMICILIO: "Calle Prueba 184, San Isidro, Lima",
  LUXCARS_PARTIDA: "14000000",
  LUXCARS_REPRESENTANTE: "Representante Prueba",
  LUXCARS_REP_DNI: "40000000",
  LUXCARS_CORREO: "info@luxcars.pe",
  LUXCARS_TELEFONO: "+51 980 794 348",
  CTA_FONDOS_BANCO: "BCP",
  CTA_FONDOS_NUMERO: "194-0000000-1-01",
  CTA_FONDOS_CCI: "002-194-000000000000-01",
  CTA_DETRACCION_NUMERO: "00-000-000000",
  PORCENTAJE_DETRACCION: "10",
  CIUDAD_FIRMA: "Lima",
  DIAS_ESPERA_MAX: "15",
  TC_REFERENCIAL: "3.7500",
} as const;

/** La otra unidad del contenedor compartido (consolidado). */
const UNIDADES = [
  { id: "e1", codigo: "LC-2026-011", vin: "5TFPC5DB1RX000000", marca: "Toyota", modelo: "Tundra" },
  { id: "e2", codigo: "LC-2026-012", vin: "1FTFW1E8XPFA00000", marca: "Ford", modelo: "F-150" },
];

/** Lo que el formulario escribe a mano para que las plantillas del libro salgan completas en el render. */
const A_MANO = { FECHA_AVISO: "2 de febrero de 2027" } as const;

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
    unidadesDelEmbarque: UNIDADES,
    ...cambios,
  };
}

/** El mismo expediente con un auto usado: inspección, inspector y su costo en el Pago 1. */
function contextoUsado(): ContextoExpediente {
  const presupuesto = presupuestar(
    entradaPorDefecto({ precio: 98_500, monedaCompra: "CAD", tcCompraRef: 0.72, vehicleType: "hev", condition: "usado", origin: "otro", cylinderCapacityCc: 3445, proporcionFlete: 0.5, costoInspeccion: 350 }),
  );
  const ctx = contexto({}, { presupuesto, honorariosUsd: presupuesto.honorarios, honorariosBaseUsd: presupuesto.honorariosBase, honorariosIgvUsd: presupuesto.honorariosIgv, fechaInspeccion: "2026-11-24", costoInspeccionUsd: 350, historialRef: "CarFax sin siniestros, un dueño" });
  ctx.expediente.vehiculo = { ...ctx.expediente.vehiculo, condicion: "usado" };
  ctx.expediente.reservado = { ...ctx.expediente.reservado!, inspectorId: "i1" };
  return ctx;
}

/** Monto del hito en el presupuesto del expediente. */
function ctxH(ctx: ContextoExpediente, tipo: "H1" | "H2" | "H3" | "H4" | "H5" | "H6"): number {
  return ctx.expediente.presupuesto!.hitos.find((h) => h.tipo === tipo)!.montoUsd;
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
    const { campos, faltantes } = camposPlantilla(contexto(), {}, FIJOS);
    expect(campos.EXPEDIENTE).toBe("LC-2026-011");
    expect(campos.FECHA_FIRMA).toBe("28 de noviembre de 2026");
    expect(campos.MODALIDAD_EMBARQUE).toBe("contenedor consolidado con otra unidad");
    expect(campos.TIPO_CONTENEDOR).toBe("40' HC");
    expect(campos.PROPORCION_FLETE).toBe("50 %");
    expect(campos.VEH_KM).toBe("1,200 km");
    expect(campos.VEH_COMBUSTIBLE).toBe("Híbrido gasolina");
    expect(campos.VEH_CONDICION).toBe("Nuevo");
    // El broker ocupa VENDEDOR_*; el dealer, DEALER_*.
    expect(campos.VENDEDOR_NOMBRE).toBe("Example Auto Brokers LLC");
    expect(campos.VENDEDOR_CONTACTO).toBe("Daniel Ortega, deals@example-brokers.com");
    expect(campos.DEALER_NOMBRE).toBe("Example Motors Ltd.");
    expect(campos.DEALER_CONTACTO).toBe("Mark Lee, sales@example.ca");
    expect(campos.FORWARDER_CONTACTO).toBe("ops@example-logistics.com");
    expect(campos.AGENTE_ADUANA_RUC).toBe("20999999999");
    expect(campos.PRECIO_TOPE).toBe("100,000.00");
    expect(campos.PRECIO_COMPRA_USD).toBe("70,920.00");
    // Los montos de los cinco pagos: el Pago 2 junta el H2 y el H3; el Pago 4 es el H5.
    expect(campos.PAGO1_MONTO).toBe("70,920.00");
    expect(campos.PAGO2_MONTO).toBe(monto(ctxH(contexto(), "H2") + ctxH(contexto(), "H3")));
    expect(campos.PAGO4_MONTO).toBe(monto(ctxH(contexto(), "H5")));
    expect(campos.PAGO5_MONTO).toBe(monto(ctxH(contexto(), "H6")));
    expect(campos.COMISION_MITAD).not.toBe("");
    expect(campos.TASA_PERCEPCION).toBe("10 %");
    expect(campos.LUXCARS_RUC).toBe(FIJOS.LUXCARS_RUC);
    // Solo quedan vacíos los que arma el libro con cada evento o se escriben a mano al emitir.
    expect(faltantes).not.toContain("LUXCARS_RUC");
    expect(faltantes).not.toContain("CIUDAD_FIRMA");
    expect(faltantes).toContain("FECHA_DEPOSITO");
    expect(faltantes).toContain("FECHA_AVISO");
  });

  it("todo lo vacío es faltante: ya no hay campos manuales ni líneas en blanco", () => {
    const ctx = contexto();
    ctx.cliente = { ...ctx.cliente!, ruc: null, domicilio: null };
    const r = camposPlantilla(ctx, {});
    expect(r.faltantes).toEqual(expect.arrayContaining(["CLIENTE_RUC", "CLIENTE_DOMICILIO", "LUXCARS_RUC", "CTA_FONDOS_NUMERO", "DIAS_ESPERA_MAX", "TC_REFERENCIAL", "CIUDAD_FIRMA"]));
    expect(Object.values(r.campos).some((v) => v.includes("______"))).toBe(false);
    expect("manualesVacios" in r).toBe(false);
  });

  it("el expediente manda sobre el porDefecto, y el formulario (extra) manda sobre todo", () => {
    // El expediente tiene 12 % de detracción: el 10 % de la empresa no lo pisa.
    const base = camposPlantilla(contexto(), {}, FIJOS);
    expect(base.campos.PORCENTAJE_DETRACCION).toBe("12");
    // Sin porcentaje en el expediente, vale el de la empresa.
    const sinPorcentaje = camposPlantilla(contexto({}, { porcentajeDetraccion: null }), {}, FIJOS);
    expect(sinPorcentaje.campos.PORCENTAJE_DETRACCION).toBe("10");
    // Lo escrito en el formulario gana sobre el expediente y sobre la empresa.
    const aMano = camposPlantilla(contexto(), { PORCENTAJE_DETRACCION: "12", CIUDAD_FIRMA: "Arequipa", DIAS_ESPERA_MAX: "20", VEH_MARCA: "   " }, FIJOS);
    expect(aMano.campos.PORCENTAJE_DETRACCION).toBe("12");
    expect(aMano.campos.CIUDAD_FIRMA).toBe("Arequipa");
    expect(aMano.campos.DIAS_ESPERA_MAX).toBe("20");
    // Un extra vacío no borra lo del expediente; un porDefecto vacío tampoco.
    expect(aMano.campos.VEH_MARCA).toBe("Toyota");
    expect(camposPlantilla(contexto(), {}, { ...FIJOS, VEH_MARCA: " " }).campos.VEH_MARCA).toBe("Toyota");
    // La ciudad de firma y los días de espera salen de la empresa; el TC referencial del servicio del día.
    expect(base.campos.CIUDAD_FIRMA).toBe("Lima");
    expect(base.campos.DIAS_ESPERA_MAX).toBe("15");
    expect(base.campos.TC_REFERENCIAL).toBe("3.7500");
  });

  it("en consolidado el VIN de la otra unidad sale de los otros expedientes del embarque; en exclusivo dice N/A", () => {
    expect(camposPlantilla(contexto(), {}, FIJOS).campos.VIN_OTRA_UNIDAD).toBe("1FTFW1E8XPFA00000");
    // Dos unidades más en el contenedor: las dos, separadas por coma.
    const tres = contexto({ unidadesDelEmbarque: [...UNIDADES, { id: "e3", codigo: "LC-2026-013", vin: "WBA00000000000000", marca: "BMW", modelo: "X5" }] });
    expect(camposPlantilla(tres, {}, FIJOS).campos.VIN_OTRA_UNIDAD).toBe("1FTFW1E8XPFA00000, WBA00000000000000");
    // La otra unidad todavía no tiene VIN: queda vacío (lo pide el formulario), no se inventa.
    const sinVin = contexto({ unidadesDelEmbarque: [UNIDADES[0], { ...UNIDADES[1], vin: null }] });
    expect(camposPlantilla(sinVin, {}, FIJOS).campos.VIN_OTRA_UNIDAD).toBe("");
    expect(camposPlantilla(sinVin, {}, FIJOS).faltantes).toContain("VIN_OTRA_UNIDAD");
    // Solo en el embarque, sin otras unidades: también falta.
    expect(camposPlantilla(contexto({ unidadesDelEmbarque: [UNIDADES[0]] }), {}, FIJOS).campos.VIN_OTRA_UNIDAD).toBe("");
    // Exclusivo o Ro-Ro: no aplica.
    const exclusivo = contexto();
    exclusivo.embarque = { ...exclusivo.embarque!, modalidad: "exclusivo" };
    expect(camposPlantilla(exclusivo, {}, FIJOS).campos.VIN_OTRA_UNIDAD).toBe("N/A");
  });

  it("la clase del vehículo (M1 / N1) llena VEH_CATEGORIA y sin ella falta", () => {
    expect(camposPlantilla(contexto(), {}, FIJOS).campos.VEH_CATEGORIA).toBe("N1");
    const m1 = contexto();
    m1.expediente.vehiculo = { ...m1.expediente.vehiculo, clase: "M1" };
    expect(camposPlantilla(m1, {}, FIJOS).campos.VEH_CATEGORIA).toBe("M1");
    const sinClase = contexto();
    sinClase.expediente.vehiculo = { ...sinClase.expediente.vehiculo, clase: null };
    expect(camposPlantilla(sinClase, {}, FIJOS).faltantes).toContain("VEH_CATEGORIA");
  });

  it("sin broker, el dealer cobra directo y ocupa los campos VENDEDOR_*", () => {
    const ctx = contexto();
    ctx.expediente.reservado = { ...ctx.expediente.reservado!, brokerId: null };
    const { campos } = camposPlantilla(ctx, {}, FIJOS);
    expect(campos.VENDEDOR_NOMBRE).toBe("Example Motors Ltd.");
    expect(campos.DEALER_NOMBRE).toBe("Example Motors Ltd.");
  });

  it("adapta razón social, RUC y representante a una persona natural", () => {
    const ctx = contexto();
    ctx.cliente = { ...ctx.cliente!, tipo: "persona", ruc: null, dni: "45678901", representante: null, representanteDni: null, representanteCargo: null, partida: null };
    const { campos, faltantes } = camposPlantilla(ctx, {}, FIJOS);
    expect(campos.CLIENTE_RUC).toBe("45678901");
    expect(campos.CLIENTE_REPRESENTANTE).toBe("Inversiones Andinas S.A.C.");
    expect(campos.CLIENTE_REP_DNI).toBe("45678901");
    expect(faltantes).not.toContain("CLIENTE_PARTIDA");
  });

  it("CAMPOS_EMPRESA son los de Luxcars y sus cuentas (menos correo y teléfono) más detracción, ciudad y días de espera", () => {
    expect(CAMPOS_EMPRESA).toEqual([
      "LUXCARS_RUC", "LUXCARS_DOMICILIO", "LUXCARS_PARTIDA", "LUXCARS_REPRESENTANTE", "LUXCARS_REP_DNI",
      "CTA_FONDOS_BANCO", "CTA_FONDOS_NUMERO", "CTA_FONDOS_CCI", "CTA_DETRACCION_NUMERO",
      "PORCENTAJE_DETRACCION", "CIUDAD_FIRMA", "DIAS_ESPERA_MAX",
    ]);
    expect(esCampoEmpresa("LUXCARS_RUC")).toBe(true);
    expect(esCampoEmpresa("LUXCARS_CORREO")).toBe(false);
    expect(esCampoEmpresa("CLIENTE_RUC")).toBe(false);
    for (const k of CAMPOS_EMPRESA) expect(FICHA[k].descripcion).not.toMatch(/CONFIRMAR/);
  });
});

describe("plantillas", () => {
  it("son trece: las del acto de firma (contrato, anexos, LOA, poder), las dos instrucciones y las cuatro que nacen del libro", () => {
    expect(PLANTILLAS.map((p) => p.tipo)).toEqual([
      "contrato", "anexo_a", "anexo_b", "anexo_c", "anexo_d", "loa", "poder_inmatriculacion", "instrucciones_vendedor", "instrucciones_forwarder",
      "constancia_fondos", "aviso_h3", "liquidacion_definitiva", "acta_rendicion",
    ]);
    expect(plantillaDe("contrato")?.version).toMatch(/^contrato@/);
    expect(plantillaDe("bill_of_sale")).toBeNull();
    expect(plantillaDe("acta_entrega")).toBeNull();
    expect(plantillaDe("rendicion")).toBeNull();
    expect(TIPOS_DESDE_LIBRO.every((t) => plantillaDe(t) !== null)).toBe(true);
    // Una sola firma en notaría (contrato, LOA, poder) y una simple a la entrega; los anexos van dentro del contrato.
    expect(PLANTILLAS.filter((p) => p.seFirma).map((p) => p.tipo)).toEqual(["contrato", "loa", "poder_inmatriculacion", "acta_rendicion"]);
  });

  it("un auto nuevo no menciona la inspección en ninguna plantilla; ninguna tiene transporte interno ni gastos registrales como línea aparte", () => {
    const ctx = contexto();
    for (const plantilla of PLANTILLAS) {
      const texto = textoDeEstructura(construirDocumento(plantilla, ctx, A_MANO, FIJOS).estructura);
      expect(texto, plantilla.tipo).not.toMatch(/inspecci|inspection|inspector/i);
      expect(texto, plantilla.tipo).not.toMatch(/Transporte interno|transporte interno en origen|inland/i);
      expect(texto, plantilla.tipo).not.toMatch(/Gastos registrales/);
    }
    const contratoTexto = textoDeEstructura(construirDocumento(plantillaDe("contrato")!, ctx, {}, FIJOS).estructura);
    expect(contratoTexto).toContain("Se pagan en dos mitades iguales");
    // El calendario de pagos va al inicio, en la tercera cláusula, con la tabla de cinco filas; las demás se remiten a ella.
    expect(contratoTexto).toMatch(/Segunda: Objeto[\s\S]*Tercera: Calendario de pagos\n3\.1 El Mandante hace cinco pagos/);
    expect(contratoTexto).toContain("Pago\nCuándo\nQué cubre\nMonto\nDónde pagas\nPago 1 de 5");
    expect(contratoTexto).toContain(
      "3.2 Todos los pagos del Mandante a LUXCARS se realizan en la cuenta Fondos de Clientes indicada en el Anexo D. LUXCARS aplica de esos fondos el importe de cada factura de honorarios en la fecha de su emisión y destina el resto exclusivamente a los pagos por cuenta del Mandante.",
    );
    expect(contratoTexto).toContain("acta de entrega y rendición de cuentas");
    expect(contratoTexto).toContain("poder especial");
    expect(contratoTexto).toContain("Example Auto Brokers LLC");
    // 5.3: autodetracción por defecto y, como alternativa, que el Mandante detraiga.
    expect(contratoTexto).toMatch(/5\.3 [^\n]*paga siempre el importe completo de cada factura[^\n]*LUXCARS deposita la detracción en su propia cuenta de detracciones del Banco de la Nación dentro de los cinco días hábiles[^\n]*Si el Mandante prefiere detraer él mismo/);
    // 5.4: la gestión registral está dentro de los honorarios; 6.6: alternativa para los tributos; 6.8: comisión del wire.
    expect(contratoTexto).toMatch(/5\.4 Los honorarios comprenden[^\n]*homologación o ficha técnica[^\n]*SUNARP[^\n]*placas[^\n]*tarjeta/);
    expect(contratoTexto).toContain("6.6 Los tributos de importación los paga el Mandante directamente a SUNAT");
    expect(contratoTexto).toContain("6.8 Si el banco debita de la cuenta Fondos de Clientes una comisión");
    expect(contratoTexto).toContain("son de cargo exclusivo del Mandante y serán asumidos por él");
    expect(contratoTexto).toContain("dentro de los dos días hábiles del aviso");
    const anexoBTexto = textoDeEstructura(construirDocumento(plantillaDe("anexo_b")!, ctx, {}, FIJOS).estructura);
    expect(anexoBTexto).toContain("Calendario de pagos: cinco pagos");
    expect(anexoBTexto).toContain("Pago\nCuándo\nQué cubre\nMonto\nDónde pagas\nPago 1 de 5");
    expect(anexoBTexto).toContain("Flete (traslado al puerto y marítimo)");
    expect(anexoBTexto).toContain("son de cargo exclusivo del Mandante y serán asumidos por él");
    expect(anexoBTexto).toContain("El sobrante se descuenta del Pago 5");
    // Sin códigos internos: el cliente solo ve "Pago 1 de 5" … "Pago 5 de 5".
    expect(anexoBTexto).not.toMatch(/\bH[1-6]\b/);
    // La fila de tributos del costo y el Pago 4 del calendario cuadran al centavo.
    const tributosFila = /Tributos de importación \(Pago 4, directo a SUNAT\)\n[^\n]*\n([\d,.]+)/.exec(anexoBTexto)?.[1];
    expect(anexoBTexto).toContain(`USD ${tributosFila} (estimado; se paga en soles)`);
    const poder = textoDeEstructura(construirDocumento(plantillaDe("poder_inmatriculacion")!, ctx, {}, FIJOS).estructura);
    expect(poder).toContain("CONFIRMAR con el notario");
    expect(poder).toContain("inmatriculación");
  });

  it("un auto usado trae la inspección en el contrato, el Anexo A, el Anexo B y las instrucciones al vendedor, sin faltantes", () => {
    const ctx = contextoUsado();
    const texto = (tipo: Parameters<typeof plantillaDe>[0]) => {
      const doc = construirDocumento(plantillaDe(tipo)!, ctx, {}, FIJOS);
      expect(doc.faltantes, String(tipo)).toEqual([]);
      return textoDeEstructura(doc.estructura);
    };
    expect(texto("contrato")).toMatch(/inspecci/i);
    expect(texto("anexo_a")).toMatch(/inspecci/i);
    expect(texto("anexo_b")).toContain("Inspección del vehículo usado");
    expect(texto("anexo_b")).toContain("350.00");
    expect(texto("instrucciones_vendedor")).toMatch(/inspection/i);
    // El costo de la inspección va en el Pago 1 y no cambia los honorarios.
    expect(ctxH(ctx, "H1")).toBe(70_920 + 350);
    const sinInspeccion = presupuestar(entradaPorDefecto({ precio: 98_500, monedaCompra: "CAD", tcCompraRef: 0.72, vehicleType: "hev", condition: "usado", origin: "otro", cylinderCapacityCc: 3445, proporcionFlete: 0.5 }));
    expect(ctx.expediente.presupuesto!.honorarios).toBe(sinInspeccion.honorarios);
  });

  it("cada plantilla referencia solo campos existentes y las de firma e instrucciones construyen sin faltantes con el expediente completo", () => {
    const ctx = contexto();
    for (const plantilla of PLANTILLAS) {
      const doc = construirDocumento(plantilla, ctx, {}, FIJOS);
      expect(doc.usados.length, plantilla.tipo).toBeGreaterThan(5);
      for (const campo of doc.usados) expect(esCampo(campo), `${plantilla.tipo} usa ${campo}`).toBe(true);
      if (!TIPOS_DESDE_LIBRO.includes(plantilla.tipo)) expect(doc.faltantes, plantilla.tipo).toEqual([]);
      expect(doc.estructura.codigoExpediente).toBe("LC-2026-011");
      expect(doc.estructura.bloques.length, plantilla.tipo).toBeGreaterThan(3);
      expect("manualesVacios" in doc).toBe(false);
    }
  });

  it("todos los campos de la ficha los usa alguna plantilla (con un nuevo, un usado y las tres variantes del aviso)", () => {
    const usados = new Set<string>();
    for (const ctx of [contexto(), contextoUsado(), contextoConLibro()]) {
      for (const plantilla of PLANTILLAS) {
        const variantes = plantilla.tipo === "aviso_h3" ? [{ HITO: "H4" }, { HITO: "H5" }, { HITO: "H6" }] : [{}];
        for (const extra of variantes) for (const k of construirDocumento(plantilla, ctx, extra, FIJOS).usados) usados.add(k);
      }
    }
    const sinUsar = CAMPOS.filter((k) => !usados.has(k));
    expect(sinUsar, sinUsar.join(", ")).toEqual([]);
  });

  it("detecta los faltantes de ESE documento; sin la empresa configurada, el contrato pide sus datos y nunca imprime una raya", () => {
    const ctx = contexto();
    ctx.cliente = { ...ctx.cliente!, ruc: null };
    const doc = construirDocumento(plantillaDe("contrato")!, ctx, {}, FIJOS);
    expect(doc.faltantes).toEqual(["CLIENTE_RUC"]);
    expect(textoDeEstructura(doc.estructura)).toContain("esperar hasta 15 días calendario");
    // El Anexo B no lee el RUC del cliente.
    expect(construirDocumento(plantillaDe("anexo_b")!, ctx, {}, FIJOS).faltantes).toEqual([]);
    // Sin los datos de la empresa: faltan, son todos de CAMPOS_EMPRESA y el texto no tiene líneas en blanco.
    const sinEmpresa = construirDocumento(plantillaDe("contrato")!, contexto(), {});
    expect(sinEmpresa.faltantes.length).toBeGreaterThan(5);
    // Correo y teléfono no son de Configuración: los pone el servidor desde LUXCARS_CONFIG.
    expect(sinEmpresa.faltantes.filter((k) => !esCampoEmpresa(k))).toEqual(["LUXCARS_CORREO", "LUXCARS_TELEFONO"]);
    expect(sinEmpresa.faltantes).toEqual(expect.arrayContaining(["LUXCARS_RUC", "LUXCARS_REP_DNI", "DIAS_ESPERA_MAX", "CIUDAD_FIRMA"]));
    expect(textoDeEstructura(sinEmpresa.estructura)).not.toContain("______________");
  });

  it("el formulario (extra) pisa al porDefecto también en el documento construido", () => {
    const doc = construirDocumento(plantillaDe("contrato")!, contexto(), { CIUDAD_FIRMA: "Arequipa", DIAS_ESPERA_MAX: "20" }, FIJOS);
    const texto = textoDeEstructura(doc.estructura);
    expect(texto).toContain("en Arequipa, el 28 de noviembre de 2026");
    expect(texto).toContain("esperar hasta 20 días calendario");
  });

  it("el contrato tiene las veintiuna cláusulas y la cláusula 18.1 admite las acciones del portal", () => {
    const texto = textoDeEstructura(construirDocumento(plantillaDe("contrato")!, contexto(), {}, FIJOS).estructura);
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
      const html = renderHtml(construirDocumento(plantilla, ctx, A_MANO, FIJOS).estructura);
      expect(html.length, plantilla.tipo).toBeGreaterThan(500);
      expect(html).toContain('<article class="doc"');
      expect(html).not.toContain("<Ampersand>");
    }
    const html = renderHtml(construirDocumento(plantillaDe("anexo_d")!, ctx, {}, FIJOS).estructura);
    expect(html).toContain("Tienda &lt;Ampersand&gt; &amp; Hijos S.A.C.");
    expect(html).toContain("<strong>Lux Cars Import S.A.C.</strong>");
    expect(html).toContain('<table class="doc-tabla">');
  });

  it("nombra los archivos con el código, el tipo y la versión", () => {
    expect(nombreArchivo("LC-2026-011", "contrato", 2, "pdf")).toBe("LC-2026-011-contrato-v2.pdf");
  });
});

/* -------------------------------------------------------------------------- */
/* Plantillas que nacen del libro                                             */
/* -------------------------------------------------------------------------- */

function mov(cambios: Partial<Movimiento> & Pick<Movimiento, "id" | "tipo" | "montoUsd">): Movimiento {
  return {
    cuenta: "fondos_clientes", hito: null, estado: "confirmado", fecha: "2026-12-10", moneda: "USD", monto: cambios.montoUsd, tipoCambio: 1,
    concepto: null, contraparteId: null, documentoRef: null, tieneComprobante: false, declaradoPorCliente: false, createdAt: "2026-12-10T12:00:00Z",
    ...cambios,
  };
}

/**
 * Un expediente ya liberado con el libro completo y una sola cuenta para el
 * cliente: Pagos 1 a 4 (el Pago 2 en una sola transferencia), la factura 1
 * aplicada desde Fondos de Clientes con su autodetracción, el wire al broker
 * con su comisión repuesta, flete, seguro, gastos de aduana y los tributos
 * pagados directo a SUNAT.
 */
function contextoConLibro(): ContextoExpediente {
  const ctx = contexto({}, { etapa: "placas", damNumero: "118-2027-10-000001", damFecha: "2027-02-09", damCanal: "verde", damFactorConversion: 0.7212, damTcSbs: 3.762, levanteEn: "2027-02-12", placa: "BXX-000", tiveNumero: "T-123", kmEntrega: 1260, fechaEntrega: "2027-03-05" });
  const p = ctx.expediente.presupuesto!;
  ctx.hitos = p.hitos.map((h) => ({ tipo: h.tipo, montoEstimadoUsd: h.montoUsd, fechaLimite: h.tipo === "H4" ? "2027-02-10" : h.tipo === "H6" ? "2027-02-22" : null, cuenta: h.cuenta, nota: null }));
  const h = (t: "H1" | "H2" | "H3" | "H4") => ctx.hitos.find((x) => x.tipo === t)!.montoEstimadoUsd;
  ctx.movimientos = [
    mov({ id: "d1", tipo: "deposito", hito: "H1", montoUsd: h("H1"), fecha: "2026-12-01", documentoRef: "BCP · op. 00123456", declaradoPorCliente: true }),
    mov({ id: "p1", tipo: "pago", hito: "H1", montoUsd: 70_920, moneda: "CAD", monto: 98_500, tipoCambio: 0.72, concepto: "Precio del vehículo (wire al broker)", contraparteId: "k1", documentoRef: "Bill of sale 4411, SWIFT 77", fecha: "2026-12-03" }),
    mov({ id: "c1", tipo: "pago", montoUsd: 45, concepto: "Comisión bancaria del wire (cargo del banco)", fecha: "2026-12-03" }),
    mov({ id: "c2", tipo: "ajuste", montoUsd: 45, concepto: "Reposición de la comisión bancaria, por cuenta de Luxcars", fecha: "2026-12-03" }),
    mov({ id: "d2", tipo: "deposito", hito: "H2", montoUsd: Math.round((h("H2") + h("H3")) * 100) / 100, fecha: "2026-12-18" }),
    // Factura 1: su importe pasa de Fondos de Clientes a Operaciones el día que se emite; la detracción va al Banco de la Nación.
    mov({ id: "a1", tipo: "pago", montoUsd: h("H3"), concepto: "Aplicación de honorarios · factura 1 F001-000101", documentoRef: "F001-000101", fecha: "2026-12-18" }),
    mov({ id: "a2", tipo: "deposito", cuenta: "operaciones", montoUsd: h("H3"), concepto: "Honorarios recibidos desde Fondos de Clientes · factura 1 F001-000101", documentoRef: "F001-000101", fecha: "2026-12-18" }),
    mov({ id: "r1", tipo: "pago", cuenta: "operaciones", montoUsd: 561.08, moneda: "PEN", monto: 2_110, tipoCambio: 0.26591, concepto: "Detracción de la factura 1 depositada en el Banco de la Nación (autodetracción)", documentoRef: "BN 123456789", fecha: "2026-12-22" }),
    mov({ id: "r2", tipo: "deposito", cuenta: "detracciones", montoUsd: 561.08, moneda: "PEN", monto: 2_110, tipoCambio: 0.26591, concepto: "Detracción de la factura 1 (autodetracción)", documentoRef: "BN 123456789", fecha: "2026-12-22" }),
    // El flete real sale USD 100 por debajo del estimado: ese saldo queda a favor del cliente.
    mov({ id: "p3", tipo: "pago", hito: "H2", montoUsd: Math.round((h("H2") - 390.5 - 100) * 100) / 100, concepto: "Flete (traslado al puerto y marítimo)", contraparteId: "f1", fecha: "2027-01-09" }),
    mov({ id: "p4", tipo: "pago", hito: "H2", montoUsd: 390.5, concepto: "Seguro de transporte", fecha: "2027-01-09" }),
    mov({ id: "d4", tipo: "deposito", hito: "H4", montoUsd: h("H4"), fecha: "2027-02-08" }),
    mov({ id: "t5", tipo: "deposito", cuenta: "directo", hito: "H5", montoUsd: 27_587.85, moneda: "PEN", monto: 103_785.55, tipoCambio: 0.2658, documentoRef: "Liquidación 118-2027-0001234", tieneComprobante: true, declaradoPorCliente: true, fecha: "2027-02-11" }),
    mov({ id: "g1", tipo: "pago", hito: "H4", montoUsd: 2_000, concepto: "Agente de aduana", contraparteId: "a1", documentoRef: "Factura F001-123", fecha: "2027-02-12" }),
    mov({ id: "g2", tipo: "pago", hito: "H4", montoUsd: 150, concepto: "Grúa del puerto", documentoRef: "Factura G-77", fecha: "2027-02-12" }),
    mov({ id: "x", tipo: "deposito", hito: "H4", montoUsd: 999, estado: "por_confirmar", fecha: "2027-02-21" }),
    mov({ id: "z", tipo: "pago", hito: "H4", montoUsd: 5_000, estado: "anulado", fecha: "2027-02-21" }),
  ];
  return ctx;
}

describe("plantillas que nacen del libro", () => {
  it("la constancia toma fecha, monto, hito, saldos y correlativo del depósito y lo imprime", () => {
    const ctx = contextoConLibro();
    const deposito = ctx.movimientos.find((m) => m.id === "d1")!;
    const campos = datosConstancia(deposito, ctx);
    expect(campos).toMatchObject({ FECHA_DEPOSITO: "1 de diciembre de 2026", HITO: "H1", PAGO_DEPOSITO: "Pago 1 de 5", SALDO_ANTERIOR: "0.00", CONSTANCIA_NUMERO: "F01", CLIENTE_BANCO_ORIGEN: "BCP", NUMERO_OPERACION: "00123456" });
    expect(campos.SALDO_NUEVO).toBe(campos.MONTO_DEPOSITO);
    const doc = construirDocumento(plantillaDe("constancia_fondos")!, ctx, campos, FIJOS);
    expect(doc.faltantes).toEqual([]);
    const texto = textoDeEstructura(doc.estructura);
    expect(texto).toContain("Constancia n.º LC-2026-011-F01");
    expect(texto).toContain("Pago al que corresponde\nPago 1 de 5");
    expect(texto).toContain("[X] Pago 1 de 5: el precio del auto");
    // El destino del H1 es el broker.
    expect(texto).toContain("Example Auto Brokers LLC");
    expect(texto).toContain("BCP");
  });

  it("aviso del Pago 3 (H4): gastos de aduana según la pro forma del agente, a Fondos de Clientes, al arribo", () => {
    const ctx = contextoConLibro();
    const campos = datosAvisoPago(ctx, "H4", { MONTO_AVISO: "2,450.00" });
    expect(campos).toMatchObject({ HITO: "H4", MONTO_AVISO: "2,450.00", FECHA_LIMITE_PAGO: "10 de febrero de 2027" });
    // Sin monto escrito, el estimado del hito.
    expect(datosAvisoPago(ctx, "H4").MONTO_AVISO).toBe(monto(ctxH(ctx, "H4")));
    expect(montoDelAviso(ctx, "H4", campos)).toBe(2_450);
    const doc = construirDocumento(plantillaDe("aviso_h3")!, ctx, { ...campos, FECHA_AVISO: "2 de febrero de 2027" }, FIJOS);
    expect(doc.faltantes).toEqual([]);
    const texto = textoDeEstructura(doc.estructura);
    // Qué pago es, cuánto, dónde, hasta cuándo y de dónde sale la cifra; sin códigos internos.
    expect(texto).toContain("Qué pago es\nPago 3 de 5: gastos de aduana");
    expect(texto).toContain("Monto exacto\nUSD 2,450.00");
    expect(texto).toContain('Cuenta Fondos de Clientes de LUXCARS · BCP 194-0000000-1-01');
    expect(texto).toContain('concepto "LC-2026-011 Pago 3"');
    expect(texto).toContain("Fecha límite\n10 de febrero de 2027");
    expect(texto).toContain("De la pro forma del agente de aduana Agencia Prueba S.A. Arribo estimado");
    expect(texto).not.toMatch(/\bH[1-6]\b/);
  });

  it("aviso del Pago 4 (H5): tributos exactos de la liquidación, que el cliente paga directo a SUNAT dentro de dos días hábiles", () => {
    const ctx = contextoConLibro();
    // Jueves 11 de febrero + dos días hábiles = lunes 15.
    const campos = datosAvisoPago(ctx, "H5", {}, "2027-02-11");
    expect(campos).toEqual({ HITO: "H5", FECHA_LIMITE_PAGO: "15 de febrero de 2027" });
    const extra = { ...campos, LIQUIDACION_NUMERO: "118-2027-0001234", TRIBUTOS_USD: "27,587.85", TRIBUTOS_SOLES: "103,785.55", FECHA_AVISO: "11 de febrero de 2027" };
    expect(montoDelAviso(ctx, "H5", extra)).toBe(27_587.85);
    const doc = construirDocumento(plantillaDe("aviso_h3")!, ctx, extra, FIJOS);
    expect(doc.faltantes).toEqual([]);
    const texto = textoDeEstructura(doc.estructura);
    expect(texto).toContain("De la liquidación de SUNAT n.º 118-2027-0001234");
    expect(texto).toContain("Monto exacto\nS/ 103,785.55");
    expect(texto).toContain("Directo a SUNAT, con el número de liquidación 118-2027-0001234");
    expect(texto).toContain("Fecha límite\n15 de febrero de 2027");
    expect(texto).toContain("Clave SOL");
    expect(texto).toContain("son de cargo exclusivo del Mandante y serán asumidos por él");
    // No se deposita a Luxcars: el aviso no trae la cuenta de Fondos de Clientes.
    expect(texto).not.toContain(FIJOS.CTA_FONDOS_NUMERO);
    // Sin los datos de la liquidación, el aviso no se emite.
    expect(construirDocumento(plantillaDe("aviso_h3")!, ctx, { ...campos, FECHA_AVISO: "11 de febrero de 2027" }, FIJOS).faltantes).toEqual(
      expect.arrayContaining(["LIQUIDACION_NUMERO", "TRIBUTOS_USD", "TRIBUTOS_SOLES"]),
    );
  });

  it("aviso del Pago 5 (H6): la segunda mitad de los honorarios menos el sobrante de aduana", () => {
    const ctx = contextoConLibro();
    const p5 = datosPago5(ctx);
    expect(p5.aduana).toEqual({ recibido: 2_300, pagado: 2_150, saldo: 150 });
    expect(p5.neto).toBe(Math.round((p5.honorarios - 150) * 100) / 100);
    const campos = datosAvisoPago(ctx, "H6");
    expect(campos).toMatchObject({ HITO: "H6", ADUANA_RECIBIDO: "2,300.00", ADUANA_PAGADO: "2,150.00", ADUANA_SALDO: "150.00", PAGO5_NETO: monto(p5.neto), MONTO_AVISO: monto(p5.neto), FECHA_LIMITE_PAGO: "22 de febrero de 2027" });
    expect(montoDelAviso(ctx, "H6", campos)).toBe(p5.neto);
    const doc = construirDocumento(plantillaDe("aviso_h3")!, ctx, { ...campos, FECHA_AVISO: "13 de febrero de 2027" }, FIJOS);
    expect(doc.faltantes).toEqual([]);
    const texto = textoDeEstructura(doc.estructura);
    expect(texto).toContain(`Monto exacto\nUSD ${monto(p5.neto)}`);
    // El Pago 5 va a la misma cuenta de siempre; lo que sobró de aduana se resta con su signo.
    expect(texto).toContain('concepto "LC-2026-011 Pago 5"');
    expect(texto).toContain("Lo que sobró de los gastos de aduana (se resta)\n− 150.00");
    expect(texto).toContain("nosotros depositamos la detracción de la factura (12 %) en el Banco de la Nación");
    expect(texto).not.toMatch(/\bH[1-6]\b/);
  });

  it("la liquidación definitiva lista los tributos pagados directo, los gastos de aduana y el saldo que pasa al Pago 5", () => {
    const ctx = contextoConLibro();
    const campos = datosLiquidacion(ctx);
    expect(campos.TC_SBS_PAGO).toBe("3.7620");
    expect(campos.FACTOR_CONVERSION).toBe("0.7212");
    expect(campos.FECHA_LEVANTE).toBe("12 de febrero de 2027");
    expect(campos).toMatchObject({ TOTAL_TRIBUTOS_USD: "27,587.85", TOTAL_TRIBUTOS_PEN: "103,785.55", TOTAL_GASTOS_USD: "2,150.00", ADUANA_RECIBIDO: "2,300.00", ADUANA_PAGADO: "2,150.00", ADUANA_SALDO: "150.00" });
    const doc = construirDocumento(plantillaDe("liquidacion_definitiva")!, ctx, campos, FIJOS);
    expect(doc.faltantes).toEqual([]);
    const texto = textoDeEstructura(doc.estructura);
    expect(texto).toContain("DAM n.º 118-2027-10-000001 del 9 de febrero de 2027");
    expect(texto).toContain("Pagado directamente por el Mandante a SUNAT");
    expect(texto).toContain("Liquidación 118-2027-0001234");
    expect(texto).toContain("Agencia Prueba S.A.");
    expect(texto).toContain("Factura F001-123");
    expect(texto).toContain("Sobrante a favor del Mandante: se descuenta del Pago 5");
    // El anulado y el por confirmar no entran.
    expect(texto).not.toContain("5,000.00");
    expect(texto).not.toContain("999.00");
  });

  it("el acta de entrega y rendición: Pago 5 acreditado solo con el libro, las dos facturas tomadas de Fondos de Clientes con su detracción, y cuadra con Fondos de Clientes", () => {
    const ctx = contextoConLibro();
    const sin = construirDocumento(plantillaDe("acta_rendicion")!, ctx, camposActaRendicion(ctx), FIJOS);
    expect(sin.faltantes).toEqual([]);
    expect(textoDeEstructura(sin.estructura)).toContain("[X] pendiente, el vehículo queda en custodia");
    expect(sin.campos.H6_ACREDITADO_FECHA).toBe("pendiente");
    expect(datosActa(ctx).H6_ACREDITADO_FECHA).toBe("pendiente");
    expect(textoDeEstructura(sin.estructura)).toContain("Placa\nBXX-000");
    // Pago 5: el aviso deja el H6 en el neto y el cliente lo deposita en Fondos de Clientes; con la factura 2 se aplica la mitad completa.
    // El sobrante de aduana se compensa solo, en la misma cuenta: no hay asiento de compensación.
    const p5 = datosPago5(ctx);
    ctx.hitos = ctx.hitos.map((x) => (x.tipo === "H6" ? { ...x, montoEstimadoUsd: p5.neto } : x));
    ctx.movimientos.push(
      mov({ id: "d6", tipo: "deposito", hito: "H6", montoUsd: p5.neto, fecha: "2027-03-05" }),
      mov({ id: "a3", tipo: "pago", montoUsd: p5.honorarios, concepto: "Aplicación de honorarios · factura 2 F001-000187", documentoRef: "F001-000187", fecha: "2027-03-05" }),
      mov({ id: "a4", tipo: "deposito", cuenta: "operaciones", montoUsd: p5.honorarios, concepto: "Honorarios recibidos desde Fondos de Clientes · factura 2 F001-000187", documentoRef: "F001-000187", fecha: "2027-03-05" }),
    );
    const sinDevolver = camposActaRendicion(ctx);
    expect(sinDevolver.H6_ACREDITADO_FECHA).toBe("5 de marzo de 2027");
    // Recibido (los cuatro pagos a Fondos de Clientes) menos lo pagado a terceros menos las dos facturas; la comisión del wire se repuso.
    const recibido = (["H1", "H2", "H3", "H4"] as const).reduce((s, t) => s + ctxH(ctx, t), 0) + p5.neto;
    const flete = ctx.movimientos.find((m) => m.id === "p3")!.montoUsd;
    const pagado = 70_920 + flete + 390.5 + 2_000 + 150;
    const saldo = Math.round((recibido - pagado - ctxH(ctx, "H3") - p5.honorarios) * 100) / 100;
    expect(saldo).toBe(100);
    expect(sinDevolver.SALDO_RENDICION).toBe(monto(saldo));
    expect(saldoCuenta(ctx.movimientos)).toBe(saldo);
    expect(sinDevolver.TOTAL_DIRECTO).toBe("27,587.85");
    expect(sinDevolver.COMISIONES_BANCARIAS).toBe("45.00");
    expect(sinDevolver.DEVOLUCION_MONTO).toBe("pendiente");
    expect(sinDevolver.DEVOLUCION_FECHA).toBe("pendiente");
    ctx.movimientos.push(mov({ id: "dev", tipo: "devolucion", montoUsd: saldo, fecha: "2027-03-06", documentoRef: "00999" }));
    const campos = camposActaRendicion(ctx);
    expect(campos.DEVOLUCION_MONTO).toBe(sinDevolver.SALDO_RENDICION);
    expect(campos.NUMERO_OPERACION).toBe("00999");
    // Crédito fiscal: los tributos pagados directo no traen el detalle, se toma el del Anexo B.
    const p = ctx.expediente.presupuesto!;
    expect(campos.CREDITO_FISCAL).toBe(monto(p.igv + p.ipm + p.percepcion));
    const doc = construirDocumento(plantillaDe("acta_rendicion")!, ctx, campos, FIJOS);
    expect(doc.faltantes).toEqual([]);
    const texto = textoDeEstructura(doc.estructura);
    expect(texto).toContain("Acta de entrega y rendición de cuentas");
    expect(texto).toContain("Saldo a favor del Mandante");
    expect(texto).toContain("Example Auto Brokers LLC");
    expect(texto).toContain("Bill of sale 4411, SWIFT 77");
    expect(texto).toContain("LC-2026-011-F01");
    // Lo recibido: el Pago 2 en una sola transferencia; los asientos internos no aparecen como depósitos del cliente.
    expect(texto).toContain(`Pago 2 de 5\nLC-2026-011-F02\n${monto(ctxH(ctx, "H2") + ctxH(ctx, "H3"))}`);
    expect(texto).not.toContain("Honorarios recibidos desde Fondos de Clientes");
    expect(texto).toContain("Pagado directamente por el Mandante (Pago 4, tributos a SUNAT)");
    expect(texto).toContain("Gastos de aduana recibidos (Pago 3)");
    expect(texto).toContain("Sobrante: se restó del Pago 5");
    expect(texto).toContain("Comisiones bancarias de las transferencias al exterior");
    expect(texto).toContain(`Honorarios tomados de Fondos de Clientes al emitir cada factura (sección 9)\n− ${monto(ctxH(ctx, "H3") + p5.honorarios)}`);
    expect(texto).toContain("Total pagado por el Mandante");
    expect(texto).toContain("Pago 5 de 5: [X] acreditado el 5 de marzo de 2027");
    // Las dos facturas: fecha de emisión, lo tomado de Fondos de Clientes y la constancia de la detracción.
    expect(texto).toContain(`Factura 1 (50 %, al release)\nPago 2 de 5\n18 de diciembre de 2026\n${monto(p5.honorarios)}\n${monto(ctxH(ctx, "H3"))}\n561.08 · BN 123456789`);
    expect(texto).toContain(`Factura 2 (50 %, al levante)\nPago 5 de 5\n5 de marzo de 2027\n${monto(p5.honorarios)}\n${monto(p5.honorarios)}`);
    expect(texto).not.toMatch(/\bH[1-6]\b/);
  });

  it("ningún documento muestra códigos internos ni la cuenta de Operaciones; el cliente siempre lee Pago N de 5", () => {
    const ctx = contextoConLibro();
    const extra = { ...A_MANO, LIQUIDACION_NUMERO: "118-2027-0001234", TRIBUTOS_USD: "27,587.85", TRIBUTOS_SOLES: "103,785.55" };
    const docs = [
      ...PLANTILLAS.filter((p) => !TIPOS_DESDE_LIBRO.includes(p.tipo)).map((p) => construirDocumento(p, contexto(), A_MANO, FIJOS)),
      construirDocumento(plantillaDe("constancia_fondos")!, ctx, datosConstancia(ctx.movimientos.find((m) => m.id === "d2")!, ctx), FIJOS),
      ...(["H4", "H5", "H6"] as const).map((h) => construirDocumento(plantillaDe("aviso_h3")!, ctx, { ...extra, ...datosAvisoPago(ctx, h, {}, "2027-02-11") }, FIJOS)),
      construirDocumento(plantillaDe("liquidacion_definitiva")!, ctx, datosLiquidacion(ctx), FIJOS),
      construirDocumento(plantillaDe("acta_rendicion")!, ctx, camposActaRendicion(ctx), FIJOS),
    ];
    for (const d of docs) {
      const texto = textoDeEstructura(d.estructura);
      expect(texto, d.plantilla.tipo).not.toMatch(/\bH[1-6]\b/);
      expect(texto, d.plantilla.tipo).not.toMatch(/Operaciones(?! en Línea)/);
      expect(texto, d.plantilla.tipo).not.toMatch(/CTA_OPER/);
    }
    // La constancia del Pago 2 lo nombra entero: flete, seguro y primera mitad de los honorarios.
    const constancia = textoDeEstructura(docs.find((d) => d.plantilla.tipo === "constancia_fondos")!.estructura);
    expect(constancia).toContain("[X] Pago 2 de 5: flete, seguro y primera mitad de los honorarios");
  });

  it("sin libro, las cuatro plantillas del libro no lanzan pero declaran faltantes: no se emiten con rayas", () => {
    const ctx = contexto();
    for (const tipo of TIPOS_DESDE_LIBRO) {
      const doc = construirDocumento(plantillaDe(tipo)!, ctx, {}, FIJOS);
      expect(doc.faltantes.length, tipo).toBeGreaterThan(0);
      // Ningún campo vacío se imprime como raya (las rayas que quedan en el texto son las de llenar a mano al firmar: hora, nivel de combustible, observaciones).
      expect(Object.values(doc.campos).some((v) => /^_+$/.test(v)), tipo).toBe(false);
    }
  });
});

describe("ficha de datos (snapshot para mantener el paquete de Claude Docs sincronizado)", () => {
  it("nombre, grupo, si es de la empresa, descripción y ejemplo", () => {
    const filas = CAMPOS.map((k) => `${k} · ${FICHA[k].grupo}${esCampoEmpresa(k) ? " · empresa" : ""} · ${FICHA[k].descripcion} · ej. ${FICHA[k].ejemplo}`);
    expect(filas).toMatchSnapshot();
  });
});

describe("compuertas con documentos", () => {
  it("entra a compra con contrato y LOA firmados aunque la tarea siga pendiente (y H1 por tarea)", () => {
    const ctx = contexto(
      {
        tareas: [tarea("cliente.firmar_contrato_loa", "pendiente"), tarea("luxcars.kyc", "hecha"), tarea("luxcars.confirmar_h1", "hecha")],
        documentos: [documento("contrato", "firmado"), documento("loa", "firmado")],
      },
      { etapa: "contrato" },
    );
    expect(evaluarAvance(ctx, "compra", HOY).permitido).toBe(true);
  });

  it("no basta el contrato firmado sin la LOA, ni un contrato solo emitido", () => {
    const base = { tareas: [tarea("luxcars.kyc", "hecha"), tarea("luxcars.confirmar_h1", "hecha")] };
    const soloContrato = contexto({ ...base, documentos: [documento("contrato", "firmado")] }, { etapa: "contrato" });
    expect(evaluarAvance(soloContrato, "compra", HOY).faltantes.map((f) => f.clave)).toEqual(["contrato_firmado"]);
    const emitidos = contexto({ ...base, documentos: [documento("contrato", "emitido"), documento("loa", "emitido")] }, { etapa: "contrato" });
    expect(evaluarAvance(emitidos, "compra", HOY).permitido).toBe(false);
  });

  it("la tarea hecha sigue valiendo como evidencia", () => {
    const ctx = contexto({ tareas: [tarea("cliente.firmar_contrato_loa", "hecha"), tarea("luxcars.kyc", "hecha"), tarea("luxcars.confirmar_h1", "hecha")] }, { etapa: "contrato" });
    expect(evaluarAvance(ctx, "compra", HOY).permitido).toBe(true);
  });
});

describe("datos por etapa", () => {
  it("el mapa plantilla → etapa y el origen de los campos son consistentes con la ficha", () => {
    expect(plantillasDelMapaExisten()).toBe(true);
    const cubiertas = new Set(Object.values(PLANTILLAS_POR_ETAPA).flat());
    for (const p of PLANTILLAS) expect(cubiertas.has(p.tipo), p.tipo).toBe(true);
    for (const campo of Object.keys(ORIGEN_CAMPO)) expect(esCampo(campo), campo).toBe(true);
    for (const lista of Object.values(COLUMNAS_COMPUERTA)) for (const c of lista!) expect(ORIGEN_CAMPO[c.campo], c.campo).toBeDefined();
  });

  it("con el expediente completo en búsqueda no falta nada salvo lo que el libro arma al emitir", () => {
    const ctx = contexto({}, { etapa: "busqueda" });
    const r = datosPorEtapa(ctx, FIJOS);
    expect(r.etapaSiguiente).toBe("contrato");
    expect(r.documentos.map((d) => d.etapa)).toEqual(["busqueda", "contrato"]);
    expect(r.faltantes).toEqual([]);
    expect(r.empresa).toEqual([]);
    expect(r.contrapartesSinAsignar).toEqual([]);
  });

  it("detecta lo que falta, dice dónde se guarda y qué documento o compuerta lo pide, sin repetir", () => {
    const ctx = contexto({}, { etapa: "busqueda", fechaFirma: null, loaVence: null });
    ctx.cliente = { ...ctx.cliente!, partida: null, actividad: null };
    ctx.expediente.vehiculo = { ...ctx.expediente.vehiculo, vin: null };
    const r = datosPorEtapa(ctx, FIJOS);
    const por = Object.fromEntries(r.faltantes.map((f) => [f.campo, f]));
    expect(Object.keys(por).sort()).toEqual(["CLIENTE_ACTIVIDAD", "CLIENTE_PARTIDA", "FECHA_FIRMA", "LOA_VENCIMIENTO", "VEH_VIN"]);
    expect(por.VEH_VIN.origen).toMatchObject({ destino: "expediente", columna: "veh_vin" });
    expect(por.VEH_VIN.documentos).toContain("anexo_a");
    expect(por.VEH_VIN.urgente).toBe(true);
    expect(por.CLIENTE_PARTIDA.origen).toMatchObject({ destino: "cliente", columna: "partida" });
    expect(por.CLIENTE_PARTIDA.documentos).toEqual(expect.arrayContaining(["contrato", "anexo_c"]));
    expect(por.FECHA_FIRMA.origen.tipo).toBe("fecha");
    // Los faltantes de la empresa van aparte, a Configuración.
    const sinEmpresa = datosPorEtapa(ctx, {});
    expect(sinEmpresa.empresa).toEqual(expect.arrayContaining(["LUXCARS_RUC", "CTA_FONDOS_NUMERO"]));
    expect(sinEmpresa.empresa.some((k) => k.startsWith("CTA_OPER"))).toBe(false);
    expect(sinEmpresa.faltantes.map((f) => f.campo)).not.toContain("LUXCARS_RUC");
  });

  it("en aduana el aviso del Pago 4 pide la DAM pero no los datos de la liquidación (se escriben al emitir); un usado pide inspector", () => {
    const ctx = contexto({}, { etapa: "aduana", damNumero: null, damFecha: null });
    const r = datosPorEtapa(ctx, FIJOS);
    expect(r.documentos).toEqual([{ etapa: "aduana", tipos: ["aviso_h3", "liquidacion_definitiva"] }, { etapa: "placas", tipos: ["aviso_h3"] }]);
    const por = Object.fromEntries(r.faltantes.map((f) => [f.campo, f]));
    expect(por.DAM_NUMERO.documentos).toEqual(expect.arrayContaining(["aviso_h3", "liquidacion_definitiva"]));
    expect(por.DAM_NUMERO.urgente).toBe(true);
    for (const k of ["LIQUIDACION_NUMERO", "TRIBUTOS_USD", "TRIBUTOS_SOLES", "MONTO_AVISO", "FECHA_AVISO", "FECHA_LIMITE_PAGO"]) expect(Object.keys(por), k).not.toContain(k);
    // Un usado en búsqueda sin inspector asignado: lo avisa; un nuevo no lo necesita.
    const usado = contextoUsado();
    usado.expediente.etapa = "busqueda";
    usado.expediente.reservado = { ...usado.expediente.reservado!, inspectorId: null };
    expect(datosPorEtapa(usado, FIJOS).contrapartesSinAsignar).toContain("inspector");
    expect(datosPorEtapa(contexto({}, { etapa: "busqueda" }), FIJOS).contrapartesSinAsignar).not.toContain("inspector");
  });

  it("pide las columnas de la compuerta siguiente y avisa de contrapartes sin asignar", () => {
    const ctx = contexto({}, { etapa: "placas", placa: null, tiveNumero: null, fechaEntrega: null });
    ctx.expediente.reservado = { ...ctx.expediente.reservado!, agenteAduanaId: null };
    const r = datosPorEtapa(ctx, FIJOS);
    const por = Object.fromEntries(r.faltantes.map((f) => [f.campo, f]));
    expect(por.PLACA.compuertas).toEqual(["tive_placa"]);
    expect(por.TIVE_NUMERO.compuertas).toEqual(["tive_placa"]);
    expect(por.PLACA.urgente).toBe(true);
    // El acta de la etapa siguiente pide la fecha de entrega y el km; el libro arma los totales (no se piden).
    expect(por.FECHA_ENTREGA.documentos).toEqual(["acta_rendicion"]);
    expect(Object.keys(por)).not.toContain("TOTAL_RECIBIDO");
    expect(r.contrapartesSinAsignar).toEqual(["agente_aduana"]);
    // Sin siguiente etapa no hay compuertas.
    expect(datosPorEtapa(contexto({}, { etapa: "cerrado" }), FIJOS).etapaSiguiente).toBeNull();
  });
});
