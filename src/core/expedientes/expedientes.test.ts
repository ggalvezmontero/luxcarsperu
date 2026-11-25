import { describe, expect, it } from "vitest";

import { calculateImportQuote } from "../pricing/priceCalculator";
import { PRICING_CONFIG, oldestImportableModelYear } from "../pricing/pricingConfig";
import { alertas } from "./alertas";
import { evaluarAvance, siguienteEtapa, siguienteTarea, tareasParaEtapa } from "./avance";
import { formatoCodigo, normalizarCodigo, parsearCodigo } from "./codigo";
import { ETAPAS, accionDeTarea, definicionEtapa } from "./etapas";
import { estadoHito, hitosDesde } from "./hitos";
import { IGV_HONORARIOS, entradaPorDefecto, presupuestar } from "./presupuesto";
import type { ContextoExpediente, Documento, Expediente, Movimiento, Tarea } from "./tipos";
import { ETAPAS_CLIENTE, ETAPAS_ORDEN } from "./tipos";

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
    margenH3: 0,
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

  it("reparte los hitos: H1 30 %, H4 70 %, H2 = precio + inland + flete + seguro, H3 con margen", () => {
    const entrada = entradaPorDefecto({
      precio: 60_000,
      vehicleType: "gasolina",
      condition: "usado",
      origin: "otro",
      inland: 900,
      gastosRegistrales: 450,
      margenH3: 0.05,
    });
    const p = presupuestar(entrada);
    const h = Object.fromEntries(p.hitos.map((x) => [x.tipo, x.montoUsd]));
    expect(h.H1).toBeCloseTo(p.honorarios * 0.3, 1);
    expect(h.H4).toBeCloseTo(p.honorarios * 0.7, 1);
    expect(h.H2).toBeCloseTo(60_000 + 900 + p.flete + p.seguro, 1);
    expect(h.H3).toBeCloseTo((p.tributos + p.percepcion + p.gastosAduana + 450) * 1.05, 1);
    expect(p.honorariosBase + p.honorariosIgv).toBeCloseTo(p.honorarios, 1);
    expect(p.honorariosBase).toBeCloseTo(p.honorarios / (1 + IGV_HONORARIOS), 1);
  });

  it("puede dejar la percepción fuera de H3", () => {
    const base = entradaPorDefecto({ precio: 60_000, vehicleType: "gasolina", condition: "usado", origin: "otro" });
    const con = presupuestar(base).hitos.find((x) => x.tipo === "H3")!.montoUsd;
    const sin = presupuestar({ ...base, percepcionEnH3: false }).hitos.find((x) => x.tipo === "H3")!.montoUsd;
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

  it("toma las fechas del expediente y adelanta H3 una semana al arribo", () => {
    const hs = hitosDesde(p, { fechaFirma: "2026-12-01", fechaLimiteH2: "2026-12-10", fechaEstArribo: "2027-02-15", fechaEstEntrega: "2027-03-01" });
    const por = Object.fromEntries(hs.map((h) => [h.tipo, h]));
    expect(por.H1.fechaLimite).toBe("2026-12-01");
    expect(por.H2.fechaLimite).toBe("2026-12-10");
    expect(por.H3.fechaLimite).toBe("2027-02-08");
    expect(por.H4.fechaLimite).toBe("2027-03-01");
    expect(por.H2.cuenta).toBe("fondos_clientes");
    expect(por.H1.cuenta).toBe("operaciones");
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
  it("define las nueve etapas del cliente, prospecto y cancelado", () => {
    expect(ETAPAS.map((e) => e.clave)).toEqual([...ETAPAS_ORDEN, "cancelado"]);
    expect(ETAPAS_CLIENTE).toHaveLength(9);
    expect(definicionEtapa("prospecto").nombreCliente).toBeNull();
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
    expect(accionDeTarea("cliente.aprobar_inspeccion")).toBe("aprobar_inspeccion");
    expect(accionDeTarea("cliente.depositar_h2")).toBe("declarar_deposito");
    expect(accionDeTarea("cliente.pagar_h4")).toBe("declarar_deposito");
    expect(accionDeTarea("luxcars.confirmar_h2")).toBeNull();
    expect(accionDeTarea("luxcars.kyc")).toBeNull();
  });
});

describe("avance", () => {
  it("conoce la etapa siguiente y el final", () => {
    expect(siguienteEtapa("prospecto")).toBe("contrato");
    expect(siguienteEtapa("entrega")).toBe("cerrado");
    expect(siguienteEtapa("cerrado")).toBeNull();
    expect(siguienteEtapa("cancelado")).toBeNull();
  });

  it("permite entrar a contrato con el cliente completo y lo niega sin domicilio", () => {
    const ok = evaluarAvance(contexto(), "contrato", HOY);
    expect(ok.permitido).toBe(true);
    const ctx = contexto();
    ctx.cliente = { ...ctx.cliente!, domicilio: null };
    const r = evaluarAvance(ctx, "contrato", HOY);
    expect(r.permitido).toBe(false);
    expect(r.faltantes.map((f) => f.clave)).toEqual(["cliente_completo"]);
  });

  it("marca el salto de etapa como faltante", () => {
    const r = evaluarAvance(contexto(), "busqueda", HOY);
    expect(r.salto).toBe(true);
    expect(r.faltantes[0].clave).toBe("salto");
  });

  it("para búsqueda exige contrato y LOA firmados (la tarea vale como evidencia) y KYC", () => {
    const sin = evaluarAvance(contexto({}, { etapa: "contrato" }), "busqueda", HOY);
    expect(sin.permitido).toBe(false);
    expect(sin.faltantes.map((f) => f.clave)).toEqual(["contrato_firmado"]);
    const con = evaluarAvance(contexto({ tareas: [tarea("cliente.firmar_contrato_loa")] }, { etapa: "contrato" }), "busqueda", HOY);
    expect(con.permitido).toBe(true);
    const firmado = (tipo: "contrato" | "loa"): Documento => ({
      id: tipo, expedienteId: "e1", tipo, version: 1, estado: "firmado", origen: "generado", titulo: tipo, plantillaVersion: null,
      tienePdf: true, tieneDocx: true, tieneFirmado: true, visibleCliente: true, emitidoEn: "2026-11-20T00:00:00Z", firmadoEn: "2026-11-21", createdAt: "2026-11-20T00:00:00Z",
    });
    const doc = evaluarAvance(contexto({ documentos: [firmado("contrato"), firmado("loa")] }, { etapa: "contrato" }), "busqueda", HOY);
    expect(doc.permitido).toBe(true);
  });

  it("para compra exige anexo A, aprobación del cliente, H1 y año modelo vigente", () => {
    const vacio = evaluarAvance(contexto({}, { etapa: "busqueda" }), "compra", HOY);
    expect(vacio.faltantes.map((f) => f.clave)).toEqual(["anexo_a_firmado", "inspeccion_aprobada", "h1_acreditado"]);
    const listo = evaluarAvance(
      contexto(
        {
          tareas: [tarea("luxcars.anexo_a_presupuesto"), tarea("cliente.pagar_h1")],
          aprobaciones: [{ id: "a", tipo: "aprobar_inspeccion", payload: {}, createdAt: "2026-11-23T00:00:00Z" }],
        },
        { etapa: "busqueda" },
      ),
      "compra",
      HOY,
    );
    expect(listo.permitido).toBe(true);
  });

  it("niega la compra de un usado 2025 que llegaría en 2027", () => {
    const ctx = contexto(
      {
        tareas: [tarea("luxcars.anexo_a_presupuesto"), tarea("cliente.pagar_h1")],
        aprobaciones: [{ id: "a", tipo: "aprobar_inspeccion", payload: {}, createdAt: "2026-11-23T00:00:00Z" }],
      },
      { etapa: "busqueda", fechaEstArribo: "2027-01-20" },
    );
    ctx.expediente.vehiculo = { ...ctx.expediente.vehiculo, condicion: "usado", anio: 2025 };
    const r = evaluarAvance(ctx, "compra", HOY);
    expect(r.permitido).toBe(false);
    expect(r.faltantes.map((f) => f.clave)).toEqual(["anio_modelo"]);
    // El mismo auto llegando en 2026 sí entra.
    ctx.expediente.fechaEstArribo = "2026-12-28";
    expect(evaluarAvance(ctx, "compra", HOY).permitido).toBe(true);
  });

  it("para tránsito exige el zarpe real del embarque", () => {
    const ctx = contexto(
      {
        tareas: [tarea("luxcars.poliza"), tarea("luxcars.borrador_bl")],
        embarque: {
          id: "b", codigo: "EMB-2026-01", modalidad: "exclusivo", contenedor: "c40hc", forwarderId: null, aseguradoraId: null,
          almacenConsolidacion: null, puertoOrigen: "Miami", puertoDestino: "Callao", fechaReleaseEst: null, fechaReleaseReal: null,
          fechaCarga: null, fechaZarpeEst: "2026-12-20", fechaZarpeReal: null, fechaArriboEst: "2027-01-10", fechaArriboReal: null,
          nave: null, masterBl: null, precinto: null, fleteTotalUsd: null, gastosContenedorUsd: null, declaracionExportacion: null,
          estado: "planificado", notasInternas: null,
        },
      },
      { etapa: "embarque" },
    );
    expect(evaluarAvance(ctx, "transito", HOY).faltantes.map((f) => f.clave)).toEqual(["zarpe"]);
    ctx.embarque!.fechaZarpeReal = "2026-12-21";
    expect(evaluarAvance(ctx, "transito", HOY).permitido).toBe(true);
  });

  it("cancelar siempre se permite y desde cerrado no se mueve nada", () => {
    expect(evaluarAvance(contexto({}, { etapa: "transito" }), "cancelado", HOY).permitido).toBe(true);
    expect(evaluarAvance(contexto({}, { etapa: "cerrado" }), "cancelado", HOY).permitido).toBe(false);
  });

  it("genera las tareas de la etapa con fechas y omite las que no aplican", () => {
    const sinConsolidado = tareasParaEtapa("embarque", contexto());
    expect(sinConsolidado.map((t) => t.clave)).not.toContain("cliente.elegir_consolidado");
    const ctx = contexto({}, { fechaLimiteH2: "2026-12-15" });
    ctx.embarque = { ...(contexto().embarque ?? ({} as never)), modalidad: "consolidado" } as never;
    expect(tareasParaEtapa("embarque", ctx).map((t) => t.clave)).toContain("cliente.elegir_consolidado");
    const compra = tareasParaEtapa("compra", ctx);
    expect(compra.find((t) => t.clave === "cliente.depositar_h2")?.venceEl).toBe("2026-12-15");
    const contrato = tareasParaEtapa("contrato", ctx);
    expect(contrato.find((t) => t.clave === "sistema.abrir_libro")?.estado).toBe("hecha");
    expect(contrato.every((t, i) => t.orden === i + 1)).toBe(true);
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

  it("avisa de H2 vencido, tareas vencidas, cliente sin cuenta y LOA por vencer", () => {
    const ctx = contexto(
      {
        hitos: [{ tipo: "H2", montoEstimadoUsd: 50_000, fechaLimite: "2026-11-20", cuenta: "fondos_clientes", nota: null }],
        tareas: [tarea("cliente.depositar_h2", "pendiente", { venceEl: "2026-11-20" })],
      },
      { etapa: "compra", loaVence: "2026-12-10" },
    );
    ctx.cliente = { ...ctx.cliente!, userId: null };
    const claves = alertas(ctx, HOY).map((x) => x.clave);
    expect(claves).toContain("hito_vencido_H2");
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
