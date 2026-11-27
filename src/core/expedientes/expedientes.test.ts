import { describe, expect, it } from "vitest";

import { calculateImportQuote } from "../pricing/priceCalculator";
import { PRICING_CONFIG, oldestImportableModelYear } from "../pricing/pricingConfig";
import { alertas } from "./alertas";
import { evaluarAvance, siguienteEtapa, siguienteTarea, tareasParaEtapa } from "./avance";
import { formatoCodigo, normalizarCodigo, parsearCodigo } from "./codigo";
import { ETAPAS, TAREA_CLIENTE_POR_HITO, TAREA_LUXCARS_POR_HITO, accionDeTarea, definicionEtapa } from "./etapas";
import { CUENTA_POR_HITO, estadoHito, hitosDesde, sumarDiasHabiles } from "./hitos";
import { IGV_HONORARIOS, entradaPorDefecto, presupuestar } from "./presupuesto";
import type { ContextoExpediente, Documento, Expediente, Movimiento, Tarea } from "./tipos";
import { ETAPAS_CLIENTE, ETAPAS_ORDEN, PAGO_POR_HITO, TIPOS_HITO } from "./tipos";

/** 24 de noviembre de 2026 en Lima. */
const HOY = new Date("2026-11-24T15:00:00Z");

function expedienteBase(cambios: Partial<Expediente> = {}): Expediente {
  return {
    id: "e1",
    codigo: "LC-2026-001",
    clienteId: "c1",
    etapa: "prospecto",
    etapaDesde: "2026-11-20T12:00:00Z",
    origenSolicitudId: null,
    embarqueId: null,
    proporcionFlete: 1,
    vehiculo: {
      marca: "Toyota",
      modelo: "Sequoia TRD Pro",
      version: null,
      anio: 2026,
      vin: "7SVAAABA0SX000001",
      color: null,
      km: 0,
      combustible: null,
      cilindradaCc: 3445,
      transmision: null,
      condicion: "nuevo",
      categoria: "hev",
      origen: "originario-usa",
      paisEnsamblaje: "Estados Unidos",
      docPropiedad: null,
      pesoKg: null,
      medidas: null,
      clase: "M1",
    },
    monedaCompra: "USD",
    precioCompra: 91_000,
    precioCompraUsd: 91_000,
    fechaLimiteCompra: null,
    fechaInspeccion: null,
    historialRef: null,
    fechaRelease: null,
    paisOrigen: "Estados Unidos",
    puertoOrigen: "Miami",
    presupuesto: null,
    honorariosUsd: null,
    honorariosBaseUsd: null,
    honorariosIgvUsd: null,
    porcentajeDetraccion: null,
    tarifaCustodiaUsd: null,
    costoInspeccionUsd: null,
    fechaFirma: null,
    fechaLimiteH2: null,
    fechaEstEmbarque: null,
    fechaEstArribo: null,
    fechaEstEntrega: null,
    semanasEstimadas: null,
    loaVence: null,
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
    reservado: null,
    ...cambios,
  };
}

function tarea(clave: string, estado: Tarea["estado"] = "hecha", extra: Partial<Tarea> = {}): Tarea {
  const [resp] = clave.split(".");
  return {
    id: clave,
    expedienteId: "e1",
    etapa: "prospecto",
    clave,
    titulo: clave,
    descripcion: null,
    responsable: resp === "cliente" ? "cliente" : resp === "tercero" ? "tercero" : "luxcars",
    estado,
    venceEl: null,
    hechaEn: null,
    visibleCliente: resp === "cliente",
    orden: 0,
    ...extra,
  };
}

function contexto(cambios: Partial<ContextoExpediente> = {}, exp: Partial<Expediente> = {}): ContextoExpediente {
  return {
    expediente: expedienteBase(exp),
    cliente: {
      id: "c1",
      tipo: "empresa",
      razonSocial: "Prueba SAC",
      ruc: "20123456789",
      dni: null,
      domicilio: "Av. Prueba 123, Lima",
      partida: null,
      representante: "Ana Pérez",
      representanteDni: "12345678",
      representanteCargo: "Gerente",
      email: "ana@prueba.test",
      telefono: null,
      actividad: null,
      bancoOrigen: null,
      beneficiarioFinal: null,
      origenFondos: null,
      esPep: false,
      kycFichaRucEn: "2026-11-20",
      kycVigenciaEn: "2026-11-20",
      kycListasEn: "2026-11-20",
      kycListasResultado: "Sin coincidencias",
      kycCompleto: true,
      userId: "u1",
      notasInternas: null,
      createdAt: "2026-11-20T12:00:00Z",
      updatedAt: "2026-11-20T12:00:00Z",
    },
    embarque: null,
    tareas: [],
    hitos: [],
    aprobaciones: [],
    etapas: [],
    movimientos: [],
    documentos: [],
    ...cambios,
  };
}

/* -------------------------------------------------------------------------- */

describe("presupuesto", () => {
  it("coincide con calculateImportQuote para un auto exclusivo con el flete por defecto", () => {
    const entrada = entradaPorDefecto({
      precio: 91_000,
      vehicleType: "hev",
      condition: "nuevo",
      origin: "originario-usa",
      importerProfile: "primera-importacion",
      cylinderCapacityCc: 3445,
    });
    const p = presupuestar(entrada);
    const q = calculateImportQuote(
      {
        brand: "Toyota",
        model: "Sequoia",
        year: "2026",
        priceMiami: 91_000,
        vehicleType: "hev",
        condition: "nuevo",
        origin: "originario-usa",
        cylinderCapacityCc: 3445,
        importerProfile: "primera-importacion",
      },
      "standard",
    );
    expect(p.cif).toBeCloseTo(q.cif, 2);
    expect(p.seguro).toBeCloseTo(q.insurance, 2);
    expect(p.flete).toBeCloseTo(q.freight, 2);
    expect(p.tributos).toBeCloseTo(q.adValorem + q.isc + q.igv + q.ipm, 2);
    expect(p.percepcion).toBeCloseTo(q.percepcion, 2);
    expect(p.costoPuestoEnLima).toBeCloseTo(q.brokerFeeBase, 2);
    expect(p.honorarios).toBeCloseTo(q.brokerFee, 2);
    expect(p.totalSinPercepcion).toBeCloseTo(q.finalEstimate, 2);
    expect(p.totalConPercepcion).toBeCloseTo(q.cashRequired, 2);
  });

  it("reparte seis hitos en cinco pagos: H1 precio (más la inspección del usado), H2 flete + seguro, H3 y H6 mitad de honorarios, H4 gastos de aduana, H5 tributos", () => {
    const entrada = entradaPorDefecto({ precio: 60_000, vehicleType: "gasolina", condition: "usado", origin: "otro", costoInspeccion: 350 });
    const p = presupuestar(entrada);
    const h = Object.fromEntries(p.hitos.map((x) => [x.tipo, x.montoUsd]));
    expect(p.hitos.map((x) => x.tipo)).toEqual(["H1", "H2", "H3", "H4", "H5", "H6"]);
    expect(h.H1).toBe(60_350);
    expect(h.H2).toBeCloseTo(p.flete + p.seguro, 1);
    expect(h.H3).toBeCloseTo(p.honorarios * 0.5, 1);
    expect(h.H6).toBeCloseTo(p.honorarios * 0.5, 1);
    expect(h.H3).toBe(h.H6);
    expect(h.H4).toBeCloseTo(p.gastosAduana, 1);
    expect(h.H5).toBeCloseTo(p.tributos + p.percepcion, 1);
    // La inspección va en el Pago 1, no entra al CIF ni a la base de los honorarios.
    expect(p.cif).toBeCloseTo(60_000 + p.flete + p.seguro, 1);
    expect(p.costoPuestoEnLima).toBeCloseTo(p.cif + p.tributos + p.gastosAduana, 1);
    expect(p.totalSinPercepcion).toBeCloseTo(p.costoPuestoEnLima + 350 + p.honorarios, 1);
    expect(p.costoInspeccion).toBe(350);
    // Sin transporte interno, sin gastos registrales y sin margen.
    for (const k of ["inland", "gastosRegistrales", "margenH4", "margenTributos"]) expect(k in p, k).toBe(false);
    const claves = p.lineas.map((l) => l.clave);
    expect(claves).not.toContain("inland");
    expect(claves).not.toContain("gastos_registrales");
    expect(claves).toContain("inspeccion");
    expect(p.lineas.find((l) => l.clave === "flete")?.concepto).toBe("Flete (traslado al puerto y marítimo)");
    expect(p.lineas.find((l) => l.clave === "precio")?.concepto).toBe("Precio del vehículo");
    expect(p.lineas.find((l) => l.clave === "honorarios")?.concepto).toMatch(/gestión registral y placas incluidas/);
    expect(p.honorariosBase + p.honorariosIgv).toBeCloseTo(p.honorarios, 1);
    expect(p.honorariosBase).toBeCloseTo(p.honorarios / (1 + IGV_HONORARIOS), 1);
    // Una sola cuenta para el cliente (27 nov 2026): todo a Fondos de Clientes, salvo los tributos (directo a SUNAT).
    for (const x of p.hitos) expect(x.cuenta).toBe(CUENTA_POR_HITO[x.tipo]);
    expect(p.hitos.filter((x) => x.cuenta === "operaciones")).toEqual([]);
    expect(p.hitos.filter((x) => x.cuenta === "directo").map((x) => x.tipo)).toEqual(["H5"]);
    expect(p.hitos.filter((x) => x.cuenta === "fondos_clientes").map((x) => x.tipo)).toEqual(["H1", "H2", "H3", "H4", "H6"]);
  });

  it("la inspección solo existe en usados: en un nuevo no hay línea ni costo aunque llegue un monto", () => {
    const p = presupuestar(entradaPorDefecto({ precio: 60_000, vehicleType: "gasolina", condition: "nuevo", origin: "otro", costoInspeccion: 350 }));
    expect(p.costoInspeccion).toBe(0);
    expect(p.lineas.map((l) => l.clave)).not.toContain("inspeccion");
    expect(p.hitos.find((x) => x.tipo === "H1")?.montoUsd).toBe(60_000);
    expect(p.hitos.find((x) => x.tipo === "H1")?.descripcion).not.toMatch(/inspecci/i);
  });

  it("puede dejar la percepción fuera del H5 (tributos)", () => {
    const base = entradaPorDefecto({ precio: 60_000, vehicleType: "gasolina", condition: "usado", origin: "otro" });
    const con = presupuestar(base).hitos.find((x) => x.tipo === "H5")!.montoUsd;
    const sin = presupuestar({ ...base, percepcionEnTributos: false }).hitos.find((x) => x.tipo === "H5")!.montoUsd;
    expect(con - sin).toBeCloseTo(presupuestar(base).percepcion, 1);
  });

  it("cobra la mitad del flete en un consolidado a dos", () => {
    const exclusivo = presupuestar(entradaPorDefecto({ precio: 50_000, vehicleType: "gasolina", condition: "nuevo", origin: "otro" }));
    const compartido = presupuestar(
      entradaPorDefecto({ precio: 50_000, vehicleType: "gasolina", condition: "nuevo", origin: "otro", proporcionFlete: 0.5 }),
    );
    expect(compartido.flete).toBeCloseTo(exclusivo.flete / 2, 2);
    expect(compartido.fleteBase).toBe(exclusivo.fleteBase);
    expect(compartido.cif).toBeLessThan(exclusivo.cif);
  });

  it("aplica el mínimo de honorarios en un auto barato", () => {
    const p = presupuestar(entradaPorDefecto({ precio: 20_000, vehicleType: "gasolina", condition: "usado", origin: "otro" }));
    expect(p.honorarios).toBe(PRICING_CONFIG.brokerFeeMinimum);
    expect(p.tasas.honorariosMinimo).toBe(PRICING_CONFIG.brokerFeeMinimum);
  });

  it("convierte el precio con el tipo de cambio de referencia", () => {
    const p = presupuestar(
      entradaPorDefecto({ precio: 100_000, monedaCompra: "CAD", tcCompraRef: 0.72, vehicleType: "gasolina", condition: "nuevo", origin: "otro" }),
    );
    expect(p.precioUsd).toBe(72_000);
    expect(p.lineas[0].detalle).toContain("CAD");
  });

  it("guarda el snapshot de tasas y la versión del motor", () => {
    const p = presupuestar(entradaPorDefecto({ precio: 50_000, vehicleType: "ev", condition: "nuevo", origin: "otro" }));
    expect(p.motorVersion).toContain("core/expedientes");
    expect(p.tasas.igv).toBe(PRICING_CONFIG.igvRate);
    expect(p.tasas.honorariosTramos).toHaveLength(PRICING_CONFIG.brokerFeeTiers.length);
    expect(p.tasas.isc).toBe(0);
  });

  it("rechaza lo que la norma prohíbe (diésel usado)", () => {
    expect(() => presupuestar(entradaPorDefecto({ precio: 50_000, vehicleType: "diesel", condition: "usado", origin: "otro" }))).toThrow(/prohíbe/);
  });
});

describe("hitos", () => {
  const p = presupuestar(entradaPorDefecto({ precio: 60_000, vehicleType: "gasolina", condition: "usado", origin: "otro" }));

  it("fechas: H1 a la firma, H2 y H3 al release, H4 al arribo, H5 sin fecha hasta la liquidación, H6 al levante estimado o arribo + 10", () => {
    const hs = hitosDesde(p, { fechaFirma: "2026-12-01", fechaReleaseEst: "2026-12-18", fechaEstArribo: "2027-02-15" });
    const por = Object.fromEntries(hs.map((h) => [h.tipo, h]));
    expect(por.H1.fechaLimite).toBe("2026-12-01");
    expect(por.H2.fechaLimite).toBe("2026-12-18");
    expect(por.H3.fechaLimite).toBe("2026-12-18");
    expect(por.H4.fechaLimite).toBe("2027-02-15");
    expect(por.H5.fechaLimite).toBeNull();
    expect(por.H6.fechaLimite).toBe("2027-02-25");
    expect(por.H1.cuenta).toBe("fondos_clientes");
    expect(por.H2.cuenta).toBe("fondos_clientes");
    expect(por.H3.cuenta).toBe("fondos_clientes");
    expect(por.H4.cuenta).toBe("fondos_clientes");
    expect(por.H5.cuenta).toBe("directo");
    expect(por.H6.cuenta).toBe("fondos_clientes");
    // Una fecha límite explícita del Pago 2 manda sobre el release; el levante estimado manda sobre arribo + 10.
    const con = Object.fromEntries(hitosDesde(p, { fechaLimitePago2: "2026-12-10", fechaReleaseEst: "2026-12-18", fechaEstArribo: "2027-02-15", fechaEstLevante: "2027-02-20" }).map((h) => [h.tipo, h.fechaLimite]));
    expect(con.H2).toBe("2026-12-10");
    expect(con.H3).toBe("2026-12-10");
    expect(con.H6).toBe("2027-02-20");
    // Cinco pagos agrupan los seis hitos: H2 y H3 van juntos en el Pago 2.
    expect(TIPOS_HITO.map((h) => PAGO_POR_HITO[h])).toEqual([1, 2, 2, 3, 4, 5]);
  });

  it("cuenta días hábiles de lunes a viernes para el plazo de los tributos", () => {
    expect(sumarDiasHabiles("2027-02-10", 2)).toBe("2027-02-12"); // miércoles → viernes
    expect(sumarDiasHabiles("2027-02-11", 2)).toBe("2027-02-15"); // jueves → lunes
    expect(sumarDiasHabiles("2027-02-12", 2)).toBe("2027-02-16"); // viernes → martes
    expect(sumarDiasHabiles("2027-02-13", 2)).toBe("2027-02-16"); // sábado → martes
  });

  it("el H5 (directo a SUNAT) queda acreditado con el pago confirmado, sea cual sea la cifra exacta", () => {
    const h5 = hitosDesde(p).find((h) => h.tipo === "H5")!;
    const pago = (montoUsd: number, estado: Movimiento["estado"] = "confirmado"): Movimiento => ({
      id: "m", tipo: "deposito", cuenta: "directo", hito: "H5", estado, fecha: "2027-02-12", montoUsd, concepto: null, contraparteId: null,
    });
    expect(estadoHito(h5, [])).toBe("pendiente");
    expect(estadoHito(h5, [pago(h5.montoEstimadoUsd * 0.9, "por_confirmar")])).toBe("pendiente");
    expect(estadoHito(h5, [pago(h5.montoEstimadoUsd * 0.9)])).toBe("acreditado");
  });

  it("deriva el estado del libro: pendiente, parcial, acreditado", () => {
    const [h2] = hitosDesde(p).filter((h) => h.tipo === "H2");
    const mov = (montoUsd: number, estado: Movimiento["estado"] = "confirmado"): Movimiento => ({
      id: "m", tipo: "deposito", cuenta: "fondos_clientes", hito: "H2", estado, fecha: "2026-12-01", montoUsd, concepto: null, contraparteId: null,
    });
    expect(estadoHito(h2, [])).toBe("pendiente");
    expect(estadoHito(h2, [mov(1000)])).toBe("parcial");
    expect(estadoHito(h2, [mov(h2.montoEstimadoUsd)])).toBe("acreditado");
    expect(estadoHito(h2, [mov(h2.montoEstimadoUsd, "por_confirmar")])).toBe("pendiente");
  });
});

describe("etapas", () => {
  it("define las nueve etapas del cliente, prospecto y cancelado, con búsqueda antes de contrato", () => {
    expect(ETAPAS.map((e) => e.clave)).toEqual([...ETAPAS_ORDEN, "cancelado"]);
    expect(ETAPAS_ORDEN).toEqual(["prospecto", "busqueda", "contrato", "compra", "embarque", "transito", "aduana", "placas", "entrega", "cerrado"]);
    expect(ETAPAS_CLIENTE).toHaveLength(9);
    expect(definicionEtapa("prospecto").nombreCliente).toBeNull();
    expect(ETAPAS.map((e) => e.orden)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 99]);
  });

  it("la inspección solo aparece en usados y cada hito tiene su tarea de depósito y de confirmación", () => {
    const todas = ETAPAS.flatMap((e) => e.tareas);
    // En un auto nuevo ninguna tarea generada habla de inspección.
    const nuevo = contexto();
    for (const e of ETAPAS) {
      for (const t of tareasParaEtapa(e.clave, nuevo)) expect(`${t.clave} ${t.titulo} ${t.descripcion ?? ""}`, t.clave).not.toMatch(/inspecci/i);
    }
    // En un usado, búsqueda trae la inspección y la aprobación incluye el informe.
    const usado = contexto();
    usado.expediente.vehiculo = { ...usado.expediente.vehiculo, condicion: "usado" };
    const busqueda = tareasParaEtapa("busqueda", usado);
    expect(busqueda.map((t) => t.clave)).toContain("luxcars.inspeccion");
    expect(busqueda.find((t) => t.clave === "cliente.aprobar_unidad")?.titulo).toMatch(/informe de inspección/);
    const claves = new Set(todas.map((t) => t.clave));
    for (const h of TIPOS_HITO) {
      expect(claves.has(TAREA_CLIENTE_POR_HITO[h]), h).toBe(true);
      expect(claves.has(TAREA_LUXCARS_POR_HITO[h]), h).toBe(true);
    }
    // El depósito del cliente nace en la etapa que corresponde a cada pago.
    const etapaDe = (clave: string) => ETAPAS.find((e) => e.tareas.some((t) => t.clave === clave))!.clave;
    expect(etapaDe("cliente.depositar_h1")).toBe("contrato");
    // El Pago 2 (H2 + H3) es una sola transferencia: una sola tarea del cliente y una de confirmación.
    expect(etapaDe("cliente.depositar_h2")).toBe("embarque");
    expect(TAREA_CLIENTE_POR_HITO.H3).toBe("cliente.depositar_h2");
    expect(TAREA_LUXCARS_POR_HITO.H3).toBe("luxcars.confirmar_h2");
    expect(claves.has("cliente.depositar_h3")).toBe(false);
    // Las facturas de honorarios: la 1 al embarcar, la 2 en placas.
    expect(etapaDe("luxcars.factura_h3")).toBe("embarque");
    expect(etapaDe("luxcars.factura_h6")).toBe("placas");
    expect(etapaDe("cliente.depositar_h4")).toBe("transito");
    expect(etapaDe("cliente.depositar_h5")).toBe("aduana");
    expect(etapaDe("cliente.depositar_h6")).toBe("placas");
    expect(etapaDe("cliente.aprobar_unidad")).toBe("busqueda");
    expect(etapaDe("luxcars.aviso_pago3")).toBe("transito");
    expect(etapaDe("luxcars.aviso_tributos")).toBe("aduana");
    expect(etapaDe("luxcars.aviso_pago5")).toBe("placas");
  });

  it("cada etapa intermedia tiene compuerta y tareas plantilla con claves únicas", () => {
    const claves = new Set<string>();
    for (const e of ETAPAS) {
      if (e.clave !== "prospecto" && e.clave !== "cancelado") {
        expect(e.compuerta.length, e.clave).toBeGreaterThan(0);
      }
      if (e.clave !== "cerrado") {
        expect(e.tareas.length, e.clave).toBeGreaterThan(0);
      }
      for (const t of e.tareas) {
        expect(t.clave).toMatch(/^[a-z]+\.[a-z0-9_]+$/);
        expect(claves.has(t.clave), `clave repetida ${t.clave}`).toBe(false);
        claves.add(t.clave);
        if (t.responsable === "cliente") expect(t.visibleCliente, t.clave).toBe(true);
        if (t.accion) expect(t.responsable).toBe("cliente");
      }
    }
  });

  it("las acciones del portal apuntan a tareas del cliente", () => {
    expect(accionDeTarea("cliente.aprobar_unidad")).toBe("aprobar_unidad");
    expect(accionDeTarea("cliente.aprobar_inspeccion")).toBeNull();
    expect(accionDeTarea("cliente.depositar_h1")).toBe("declarar_deposito");
    expect(accionDeTarea("cliente.depositar_h5")).toBe("declarar_deposito");
    expect(accionDeTarea("cliente.depositar_h6")).toBe("declarar_deposito");
    expect(accionDeTarea("luxcars.confirmar_h2")).toBeNull();
    expect(accionDeTarea("luxcars.kyc")).toBeNull();
  });
});

describe("avance", () => {
  it("conoce la etapa siguiente y el final", () => {
    expect(siguienteEtapa("prospecto")).toBe("busqueda");
    expect(siguienteEtapa("busqueda")).toBe("contrato");
    expect(siguienteEtapa("entrega")).toBe("cerrado");
    expect(siguienteEtapa("cerrado")).toBeNull();
    expect(siguienteEtapa("cancelado")).toBeNull();
  });

  it("permite entrar a búsqueda con el cliente completo y lo niega sin domicilio", () => {
    const ok = evaluarAvance(contexto(), "busqueda", HOY);
    expect(ok.permitido).toBe(true);
    const ctx = contexto();
    ctx.cliente = { ...ctx.cliente!, domicilio: null };
    const r = evaluarAvance(ctx, "busqueda", HOY);
    expect(r.permitido).toBe(false);
    expect(r.faltantes.map((f) => f.clave)).toEqual(["cliente_completo"]);
  });

  it("marca el salto de etapa como faltante", () => {
    const r = evaluarAvance(contexto(), "contrato", HOY);
    expect(r.salto).toBe(true);
    expect(r.faltantes[0].clave).toBe("salto");
  });

  it("para contrato exige la unidad aprobada por el cliente y el presupuesto definitivo", () => {
    const sin = evaluarAvance(contexto({}, { etapa: "busqueda" }), "contrato", HOY);
    expect(sin.permitido).toBe(false);
    expect(sin.faltantes.map((f) => f.clave)).toEqual(["unidad_aprobada", "presupuesto_definitivo"]);
    const conAprobacion = evaluarAvance(
      contexto({ aprobaciones: [{ id: "a", tipo: "aprobar_unidad", payload: {}, createdAt: "2026-11-23T00:00:00Z" }], tareas: [tarea("luxcars.presupuesto_definitivo")] }, { etapa: "busqueda" }),
      "contrato",
      HOY,
    );
    expect(conAprobacion.permitido).toBe(true);
    // Un usado además necesita el informe de inspección subido.
    const usado = contexto({ aprobaciones: [{ id: "a", tipo: "aprobar_unidad", payload: {}, createdAt: "2026-11-23T00:00:00Z" }], tareas: [tarea("luxcars.presupuesto_definitivo")] }, { etapa: "busqueda" });
    usado.expediente.vehiculo = { ...usado.expediente.vehiculo, condicion: "usado" };
    expect(evaluarAvance(usado, "contrato", HOY).faltantes.map((f) => f.clave)).toEqual(["informe_inspeccion"]);
    usado.tareas.push(tarea("luxcars.inspeccion"));
    expect(evaluarAvance(usado, "contrato", HOY).permitido).toBe(true);
    // La aprobación vieja (inspección) ya no vale.
    const vieja = evaluarAvance(
      contexto({ aprobaciones: [{ id: "a", tipo: "aprobar_inspeccion", payload: {}, createdAt: "2026-11-23T00:00:00Z" }], tareas: [tarea("luxcars.presupuesto_definitivo")] }, { etapa: "busqueda" }),
      "contrato",
      HOY,
    );
    expect(vieja.faltantes.map((f) => f.clave)).toEqual(["unidad_aprobada"]);
  });

  it("para compra exige contrato y LOA firmados (documento o tarea), KYC, H1 acreditado y año modelo vigente", () => {
    const vacio = evaluarAvance(contexto({}, { etapa: "contrato" }), "compra", HOY);
    expect(vacio.faltantes.map((f) => f.clave)).toEqual(["contrato_firmado", "h1_acreditado"]);
    const sinKyc = contexto({}, { etapa: "contrato" });
    sinKyc.cliente = { ...sinKyc.cliente!, kycCompleto: false };
    expect(evaluarAvance(sinKyc, "compra", HOY).faltantes.map((f) => f.clave)).toEqual(["contrato_firmado", "kyc_completo", "h1_acreditado"]);
    const conTareas = evaluarAvance(contexto({ tareas: [tarea("cliente.firmar_contrato_loa"), tarea("luxcars.kyc"), tarea("luxcars.confirmar_h1")] }, { etapa: "contrato" }), "compra", HOY);
    expect(conTareas.permitido).toBe(true);
    const firmado = (tipo: "contrato" | "loa"): Documento => ({
      id: tipo, expedienteId: "e1", tipo, version: 1, estado: "firmado", origen: "generado", titulo: tipo, plantillaVersion: null,
      tienePdf: true, tieneDocx: true, tieneFirmado: true, visibleCliente: true, emitidoEn: "2026-11-20T00:00:00Z", firmadoEn: "2026-11-21", createdAt: "2026-11-20T00:00:00Z",
    });
    const h1: Movimiento = { id: "m", tipo: "deposito", cuenta: "fondos_clientes", hito: "H1", estado: "confirmado", fecha: "2026-12-01", montoUsd: 91_000, concepto: null, contraparteId: null };
    const conLibro = evaluarAvance(
      contexto({ documentos: [firmado("contrato"), firmado("loa")], tareas: [tarea("luxcars.kyc")], hitos: [{ tipo: "H1", montoEstimadoUsd: 91_000, fechaLimite: null, cuenta: "fondos_clientes", nota: null }], movimientos: [h1] }, { etapa: "contrato" }),
      "compra",
      HOY,
    );
    expect(conLibro.permitido).toBe(true);
    // Solo el contrato firmado, sin la LOA, no basta.
    const soloContrato = evaluarAvance(contexto({ documentos: [firmado("contrato")], tareas: [tarea("luxcars.kyc"), tarea("luxcars.confirmar_h1")] }, { etapa: "contrato" }), "compra", HOY);
    expect(soloContrato.faltantes.map((f) => f.clave)).toEqual(["contrato_firmado"]);
  });

  it("niega la compra de un usado 2025 que llegaría en 2027", () => {
    const ctx = contexto(
      { tareas: [tarea("cliente.firmar_contrato_loa"), tarea("luxcars.kyc"), tarea("luxcars.confirmar_h1")] },
      { etapa: "contrato", fechaEstArribo: "2027-01-20" },
    );
    ctx.expediente.vehiculo = { ...ctx.expediente.vehiculo, condicion: "usado", anio: 2025 };
    const r = evaluarAvance(ctx, "compra", HOY);
    expect(r.permitido).toBe(false);
    expect(r.faltantes.map((f) => f.clave)).toEqual(["anio_modelo"]);
    // El mismo auto llegando en 2026 sí entra.
    ctx.expediente.fechaEstArribo = "2026-12-28";
    expect(evaluarAvance(ctx, "compra", HOY).permitido).toBe(true);
  });

  it("embarque exige pago al broker y bill of sale; tránsito H2 y H3, póliza, BL y zarpe; aduana H4; placas levante y H5; entrega H6; cerrado acta, conformidad y saldo cero", () => {
    expect(evaluarAvance(contexto({}, { etapa: "compra" }), "embarque", HOY).faltantes.map((f) => f.clave)).toEqual(["pago_vendedor", "bill_of_sale"]);
    const embarque = {
      id: "b", codigo: "EMB-2026-01", modalidad: "exclusivo" as const, contenedor: "c40hc" as const, forwarderId: null, aseguradoraId: null,
      almacenConsolidacion: null, puertoOrigen: "Miami", puertoDestino: "Callao", fechaReleaseEst: null, fechaReleaseReal: null,
      fechaCarga: null, fechaZarpeEst: "2026-12-20", fechaZarpeReal: null, fechaArriboEst: "2027-01-10", fechaArriboReal: null,
      nave: null, masterBl: null, precinto: null, fleteTotalUsd: null, gastosContenedorUsd: null, declaracionExportacion: null,
      estado: "planificado", notasInternas: null,
    };
    const ctx = contexto({ tareas: [tarea("luxcars.poliza"), tarea("luxcars.borrador_bl")], embarque }, { etapa: "embarque" });
    expect(evaluarAvance(ctx, "transito", HOY).faltantes.map((f) => f.clave)).toEqual(["h2_acreditado", "h3_acreditado", "zarpe"]);
    ctx.tareas.push(tarea("luxcars.confirmar_h2"), tarea("luxcars.confirmar_h3"));
    ctx.embarque!.fechaZarpeReal = "2026-12-21";
    expect(evaluarAvance(ctx, "transito", HOY).permitido).toBe(true);

    expect(evaluarAvance(contexto({}, { etapa: "transito" }), "aduana", HOY).faltantes.map((f) => f.clave)).toEqual(["h4_acreditado", "dam_numerada"]);
    expect(evaluarAvance(contexto({ tareas: [tarea("luxcars.confirmar_h4")] }, { etapa: "transito", damNumero: "118-2027-10-1" }), "aduana", HOY).permitido).toBe(true);

    expect(evaluarAvance(contexto({}, { etapa: "aduana" }), "placas", HOY).faltantes.map((f) => f.clave)).toEqual(["levante", "h5_acreditado", "liquidacion_definitiva"]);
    expect(evaluarAvance(contexto({ tareas: [tarea("luxcars.confirmar_h5"), tarea("luxcars.liquidacion_definitiva")] }, { etapa: "aduana", levanteEn: "2027-02-12" }), "placas", HOY).permitido).toBe(true);

    expect(evaluarAvance(contexto({}, { etapa: "placas" }), "entrega", HOY).faltantes.map((f) => f.clave)).toEqual(["tive_placa", "h6_acreditado"]);
    expect(evaluarAvance(contexto({ tareas: [tarea("luxcars.confirmar_h6")] }, { etapa: "placas", placa: "ABC-123", tiveNumero: "T-1" }), "entrega", HOY).permitido).toBe(true);
    expect(evaluarAvance(contexto({}, { etapa: "entrega" }), "cerrado", HOY).faltantes.map((f) => f.clave)).toEqual(["acta_firmada", "conformidad_rendicion"]);
    // Con saldo en Fondos de Clientes no se cierra.
    const conSaldo = contexto(
      { tareas: [tarea("luxcars.acta_rendicion")], aprobaciones: [{ id: "c", tipo: "conformidad_rendicion", payload: {}, createdAt: "2027-03-05T00:00:00Z" }], movimientos: [{ id: "m", tipo: "deposito", cuenta: "fondos_clientes", hito: "H1", estado: "confirmado", fecha: "2026-12-01", montoUsd: 100, concepto: null, contraparteId: null }] },
      { etapa: "entrega" },
    );
    expect(evaluarAvance(conSaldo, "cerrado", HOY).faltantes.map((f) => f.clave)).toEqual(["saldo_cero"]);
    const cerrado = evaluarAvance(
      contexto({ tareas: [tarea("luxcars.acta_rendicion")], aprobaciones: [{ id: "c", tipo: "conformidad_rendicion", payload: {}, createdAt: "2027-03-05T00:00:00Z" }] }, { etapa: "entrega" }),
      "cerrado",
      HOY,
    );
    expect(cerrado.permitido).toBe(true);
  });

  it("cancelar siempre se permite y desde cerrado no se mueve nada", () => {
    expect(evaluarAvance(contexto({}, { etapa: "transito" }), "cancelado", HOY).permitido).toBe(true);
    expect(evaluarAvance(contexto({}, { etapa: "cerrado" }), "cancelado", HOY).permitido).toBe(false);
  });

  it("genera las tareas de la etapa con fechas y omite las que no aplican", () => {
    const sinConsolidado = tareasParaEtapa("embarque", contexto());
    expect(sinConsolidado.map((t) => t.clave)).not.toContain("cliente.elegir_consolidado");
    const ctx = contexto({}, { fechaLimiteH2: "2026-12-15", fechaFirma: "2026-12-01", fechaEstArribo: "2027-02-10" });
    ctx.embarque = { ...(contexto().embarque ?? ({} as never)), modalidad: "consolidado" } as never;
    expect(tareasParaEtapa("embarque", ctx).map((t) => t.clave)).toContain("cliente.elegir_consolidado");
    const embarque = tareasParaEtapa("embarque", ctx);
    expect(embarque.find((t) => t.clave === "cliente.depositar_h2")?.venceEl).toBe("2026-12-15");
    expect(embarque.find((t) => t.clave === "cliente.depositar_h2")?.titulo).toBe("Pago 2 de 5: flete, seguro y primera mitad de los honorarios");
    expect(embarque.some((t) => t.clave === "cliente.depositar_h3")).toBe(false);
    const contrato = tareasParaEtapa("contrato", ctx);
    expect(contrato.find((t) => t.clave === "cliente.depositar_h1")?.venceEl).toBe("2026-12-01");
    expect(contrato.find((t) => t.clave === "sistema.abrir_libro")?.estado).toBe("hecha");
    expect(contrato.every((t, i) => t.orden === i + 1)).toBe(true);
    // Tránsito: el Pago 3 (H4) vence al arribo estimado.
    expect(tareasParaEtapa("transito", ctx).find((t) => t.clave === "cliente.depositar_h4")?.venceEl).toBe("2027-02-10");
    // Aduana: el Pago 4 (H5) no tiene fecha hasta que el aviso con la liquidación la fija.
    expect(tareasParaEtapa("aduana", ctx).find((t) => t.clave === "cliente.depositar_h5")?.venceEl).toBeNull();
    ctx.hitos = [
      { tipo: "H5", montoEstimadoUsd: 1, fechaLimite: "2027-02-16", cuenta: "directo", nota: null },
      { tipo: "H6", montoEstimadoUsd: 1, fechaLimite: "2027-02-20", cuenta: "fondos_clientes", nota: null },
    ];
    expect(tareasParaEtapa("aduana", ctx).find((t) => t.clave === "cliente.depositar_h5")?.venceEl).toBe("2027-02-16");
    // Placas: el Pago 5 (H6) vence en la fecha del hito.
    expect(tareasParaEtapa("placas", ctx).find((t) => t.clave === "cliente.depositar_h6")?.venceEl).toBe("2027-02-20");
    // Búsqueda: historial solo en usados; MSO y recalls solo en nuevos.
    expect(tareasParaEtapa("busqueda", ctx).map((t) => t.clave)).toContain("luxcars.verificar_nuevo");
    expect(tareasParaEtapa("busqueda", ctx).map((t) => t.clave)).not.toContain("luxcars.historial");
    ctx.expediente.vehiculo = { ...ctx.expediente.vehiculo, condicion: "usado" };
    expect(tareasParaEtapa("busqueda", ctx).map((t) => t.clave)).toContain("luxcars.historial");
    expect(tareasParaEtapa("busqueda", ctx).map((t) => t.clave)).toContain("luxcars.inspeccion");
    expect(tareasParaEtapa("busqueda", ctx).map((t) => t.clave)).not.toContain("luxcars.verificar_nuevo");
  });

  it("propone como siguiente paso la primera tarea pendiente de Luxcars de la etapa", () => {
    const ctx = contexto({
      tareas: [
        tarea("cliente.firmar_contrato_loa", "pendiente", { etapa: "contrato", orden: 3 }),
        tarea("luxcars.kyc", "pendiente", { etapa: "contrato", orden: 1 }),
        tarea("luxcars.generar_contrato", "hecha", { etapa: "contrato", orden: 2 }),
      ],
    }, { etapa: "contrato" });
    expect(siguienteTarea(ctx)?.clave).toBe("luxcars.kyc");
  });
});

describe("alertas", () => {
  it("avisa del año modelo de un usado 2025 que arriba en 2027", () => {
    const ctx = contexto({}, { etapa: "contrato", fechaEstArribo: "2027-01-15" });
    ctx.expediente.vehiculo = { ...ctx.expediente.vehiculo, condicion: "usado", anio: 2025 };
    const a = alertas(ctx, HOY);
    expect(a.map((x) => x.clave)).toContain("anio_modelo");
    expect(a.find((x) => x.clave === "anio_modelo")?.detalle).toContain(String(oldestImportableModelYear(2027)));
  });

  it("no avisa del año modelo si arriba este año o el auto es nuevo", () => {
    const ctx = contexto({}, { etapa: "contrato", fechaEstArribo: "2026-12-20" });
    ctx.expediente.vehiculo = { ...ctx.expediente.vehiculo, condicion: "usado", anio: 2025 };
    expect(alertas(ctx, HOY).map((x) => x.clave)).not.toContain("anio_modelo");
    ctx.expediente.fechaEstArribo = "2027-02-01";
    ctx.expediente.vehiculo = { ...ctx.expediente.vehiculo, condicion: "nuevo" };
    expect(alertas(ctx, HOY).map((x) => x.clave)).not.toContain("anio_modelo");
  });

  it("avisa de H1 vencido, tareas vencidas, cliente sin cuenta y LOA por vencer", () => {
    const ctx = contexto(
      {
        hitos: [{ tipo: "H1", montoEstimadoUsd: 50_000, fechaLimite: "2026-11-20", cuenta: "fondos_clientes", nota: null }],
        tareas: [tarea("cliente.depositar_h2", "pendiente", { venceEl: "2026-11-20" })],
      },
      { etapa: "contrato", loaVence: "2026-12-10" },
    );
    ctx.cliente = { ...ctx.cliente!, userId: null };
    const claves = alertas(ctx, HOY).map((x) => x.clave);
    expect(claves).toContain("hito_vencido_H1");
    expect(claves).toContain("tarea_vencida_cliente.depositar_h2");
    expect(claves).toContain("cliente_sin_cuenta");
    expect(claves).toContain("loa_por_vencer");
  });

  it("no avisa del hito si la confirmación ya está hecha, ni en un expediente cerrado", () => {
    const ctx = contexto(
      {
        hitos: [{ tipo: "H2", montoEstimadoUsd: 50_000, fechaLimite: "2026-11-20", cuenta: "fondos_clientes", nota: null }],
        tareas: [tarea("luxcars.confirmar_h2")],
      },
      { etapa: "compra" },
    );
    expect(alertas(ctx, HOY).map((x) => x.clave)).not.toContain("hito_vencido_H2");
    expect(alertas(contexto({}, { etapa: "cerrado" }), HOY)).toEqual([]);
  });
});

describe("código", () => {
  it("formatea y parsea LC-AAAA-NNN", () => {
    expect(formatoCodigo(2026, 7)).toBe("LC-2026-007");
    expect(parsearCodigo(" lc-2026-007 ")).toEqual({ anio: 2026, numero: 7 });
    expect(parsearCodigo("EMB-2026-01")).toBeNull();
    expect(normalizarCodigo(" lc-2026-0 12 ")).toBe("LC-2026-012");
  });
});
