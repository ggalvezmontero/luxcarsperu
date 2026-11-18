import { describe, expect, it } from "vitest";

import { PRICING_CONFIG } from "../pricing/pricingConfig";
import { calcularServicio, cotizarEnvio, origenDesdePais } from "./calculoEnvio";
import { CONFIG_ENVIOS } from "./configEnvios";
import { generarMensajeWhatsapp } from "./mensajeWhatsapp";
import type { EntradaCotizacionEnvio } from "./tipos";
import { validarEnvio } from "./validaciones";
import {
  aniosDeUso,
  estimarValorAduana,
  fechaLimiteIngresoUsado,
  recorridoEnKm,
  resolverAnioImportacion,
} from "./valorAduana";

/** 18 de noviembre de 2026 en Lima. */
const AHORA = new Date("2026-11-18T15:00:00Z");

/**
 * Caso de prueba del dueño: Subaru Outback Wilderness 2026, usado, 500 millas,
 * gasolina, fabricado en Japón, factura US$ 55,000, desde Vail, Colorado, Ley
 * del Retorno, 4 años fuera, retorno en 2027, con préstamo, transporte interno
 * US$ 1,700. Esperado: total ≈ 10,530, alerta de préstamo, ingreso hasta el
 * 31/12/2027 y margen ajustado (valor estimado 49,500).
 */
const SUBARU: EntradaCotizacionEnvio = {
  cliente: { nombre: "María Pérez", whatsapp: "+1 970 555 0101" },
  vehiculo: {
    marca: "Subaru",
    modelo: "Outback Wilderness",
    anioModelo: 2026,
    condicion: "usado",
    recorrido: 500,
    unidadRecorrido: "millas",
    combustible: "gasolina",
    paisFabricacion: "Japón",
    valorFacturaUsd: 55_000,
    valorReferenciaUsadoUsd: null,
    cilindradaCc: null,
  },
  origen: { ciudad: "Vail", estado: "Colorado", puertoSalida: "Miami" },
  regimen: "ley-retorno",
  retorno: { aniosFuera: 4, fechaRetorno: "2027-03-15" },
  prestamoVigente: true,
  fechaImportacion: null,
  costos: {
    transporteInternoUsd: 1700,
    fleteUsd: CONFIG_ENVIOS.fleteMiamiCallaoUsd,
    gastosAduanaUsd: CONFIG_ENVIOS.gastosAduanaUsd,
    servicio: { tipo: "fijo", montoUsd: 3000 },
  },
};

type Cambios = Omit<Partial<EntradaCotizacionEnvio>, "vehiculo"> & {
  vehiculo?: Partial<EntradaCotizacionEnvio["vehiculo"]>;
};

function con(cambios: Cambios): EntradaCotizacionEnvio {
  return {
    ...SUBARU,
    ...cambios,
    vehiculo: { ...SUBARU.vehiculo, ...(cambios.vehiculo ?? {}) },
  };
}

describe("configuración", () => {
  it("toma flete y aduana del motor público, sin duplicarlos", () => {
    expect(CONFIG_ENVIOS.fleteMiamiCallaoUsd).toBeCloseTo(3228, 6);
    expect(CONFIG_ENVIOS.gastosAduanaUsd).toBe(2300);
    expect(CONFIG_ENVIOS.seguroTasaEfectiva).toBeCloseTo(0.0055, 10);
    expect(CONFIG_ENVIOS.usados.antiguedadMaximaAnios).toBe(PRICING_CONFIG.usedMaxAgeYears);
  });
});

describe("caso de prueba: Subaru Outback Wilderness 2026 por Ley del Retorno", () => {
  const r = cotizarEnvio(SUBARU, AHORA);

  it("totaliza cerca de US$ 10,530 sin tributos", () => {
    expect(r.elegido.regimen).toBe("ley-retorno");
    expect(r.elegido.tributos?.total).toBe(0);
    expect(r.elegido.seguroUsd).toBeCloseTo(302.5, 2);
    expect(r.elegido.totalUsd).toBeCloseTo(10_530.5, 1);
    expect(r.elegido.efectivoUsd).toBeCloseTo(r.elegido.totalUsd, 6);
    expect(r.elegido.beneficioAplica).toBe(true);
  });

  it("estima el valor para aduanas en 49,500 con margen ajustado", () => {
    expect(r.anioImportacion).toBe(2027);
    expect(r.valorAduana.metodo).toBe("depreciacion");
    expect(r.valorAduana.aniosUso).toBe(1);
    expect(r.valorAduana.valorUsd).toBeCloseTo(49_500, 2);
    expect(r.valorAduana.margenTopeUsd).toBeCloseTo(500, 2);
    const margen = r.alertas.find((a) => a.clave === "retorno-margen");
    expect(margen?.nivel).toBe("warn");
    expect(margen?.titulo).toContain("500");
  });

  it("avisa del préstamo y de la fecha límite de ingreso", () => {
    expect(r.alertas.find((a) => a.clave === "prestamo")?.nivel).toBe("warn");
    expect(r.fechaLimiteIngreso).toBe("2027-12-31");
    const antiguedad = r.alertas.find((a) => a.clave === "antiguedad");
    expect(antiguedad?.titulo).toContain("31/12/2027");
    expect(antiguedad?.nivel).toBe("warn"); // 2027 es el último año posible
  });

  it("no marca ningún impedimento (sin alertas de peligro)", () => {
    expect(r.alertas.filter((a) => a.nivel === "danger")).toHaveLength(0);
  });

  it("convierte 500 millas a 805 km", () => {
    expect(r.recorridoKm).toBeCloseTo(804.67, 1);
  });

  it("compara con la importación regular: 6% ad valorem, 40% ISC, 18% IGV+IPM, percepción 10% aparte", () => {
    const reg = r.regular;
    expect(reg.tributos).not.toBeNull();
    expect(reg.tributos!.tasas).toEqual({ adValorem: 0.06, isc: 0.4, igv: 0.155, ipm: 0.025, percepcion: 0.1 });
    // CIF = 49,500 + 3,228 + 302.50 = 53,030.50
    expect(reg.cifUsd).toBeCloseTo(53_030.5, 2);
    expect(reg.tributos!.adValorem).toBeCloseTo(53_030.5 * 0.06, 2);
    expect(reg.tributos!.isc).toBeCloseTo(53_030.5 * 1.06 * 0.4, 2);
    const baseIgv = 53_030.5 * 1.06 * 1.4;
    expect(reg.tributos!.igv + reg.tributos!.ipm).toBeCloseTo(baseIgv * 0.18, 2);
    expect(reg.tributos!.percepcion).toBeCloseTo(baseIgv * 1.18 * 0.1, 2);
    expect(reg.totalUsd).toBeCloseTo(10_530.5 + reg.tributos!.total, 2);
    // La percepción NO está en el total, sí en el efectivo.
    expect(reg.efectivoUsd).toBeCloseTo(reg.totalUsd + reg.tributos!.percepcion, 6);
    expect(reg.totalUsd).toBeGreaterThan(r.retorno.totalUsd);
  });

  it("genera el mensaje de WhatsApp en texto plano, de usted y con la nota fija", () => {
    const msg = generarMensajeWhatsapp(SUBARU, r);
    expect(msg).toContain("Hola María, le comparto");
    expect(msg).toContain("Subaru Outback Wilderness 2026");
    expect(msg).toContain("desde Vail, Colorado");
    expect(msg).toContain("Transporte interno en EE.UU.: USD 1,700");
    expect(msg).toContain("Total referencial: USD 10,531");
    expect(msg).toContain("Préstamo vigente");
    expect(msg).toContain("31/12/2027");
    expect(msg).toContain(CONFIG_ENVIOS.notaReferencial);
    expect(msg).not.toMatch(/[*_~`#]/);
    // Lo interno no sale: el margen frente al tope es para el equipo.
    expect(msg).not.toContain("Margen ajustado");
  });
});

describe("valor para aduanas", () => {
  it("usa la referencia cuando se ingresó", () => {
    const v = estimarValorAduana(con({ vehiculo: { valorReferenciaUsadoUsd: 47_000 } }), 2027);
    expect(v.metodo).toBe("referencia");
    expect(v.valorUsd).toBe(47_000);
    expect(v.margenTopeUsd).toBe(3000);
  });

  it("deprecia 10% por año con tope de 50%", () => {
    expect(aniosDeUso("usado", 2026, 2026)).toBe(1);
    expect(aniosDeUso("usado", 2020, 2027)).toBe(7);
    expect(aniosDeUso("nuevo", 2020, 2027)).toBe(0);
    const v = estimarValorAduana(con({ vehiculo: { anioModelo: 2020 } }), 2027);
    expect(v.depreciacion).toBe(0.5);
    expect(v.valorUsd).toBeCloseTo(27_500, 2);
  });

  it("un nuevo vale su factura", () => {
    const v = estimarValorAduana(con({ vehiculo: { condicion: "nuevo" } }), 2027);
    expect(v).toMatchObject({ metodo: "factura", valorUsd: 55_000, aniosUso: 0, depreciacion: 0 });
  });

  it("resuelve el año de importación: importación, luego retorno, luego hoy en Lima", () => {
    expect(resolverAnioImportacion(con({ fechaImportacion: "2028-02-01" }), AHORA)).toBe(2028);
    expect(resolverAnioImportacion(SUBARU, AHORA)).toBe(2027);
    expect(resolverAnioImportacion(con({ retorno: null, fechaImportacion: null }), AHORA)).toBe(2026);
    // El 31 de diciembre a las 23:00 UTC aún es 2026 en Lima.
    expect(resolverAnioImportacion(con({ retorno: null }), new Date("2027-01-01T03:00:00Z"))).toBe(2026);
  });
});

describe("validaciones", () => {
  it("antigüedad: un 2025 importado en 2027 ya no entra", () => {
    const r = cotizarEnvio(con({ vehiculo: { anioModelo: 2025 } }), AHORA);
    const a = r.alertas.find((x) => x.clave === "antiguedad");
    expect(a?.nivel).toBe("danger");
    expect(a?.detalle).toContain("31/12/2026");
    expect(fechaLimiteIngresoUsado("usado", 2025)).toBe("2026-12-31");
    expect(fechaLimiteIngresoUsado("nuevo", 2025)).toBeNull();
  });

  it("recorrido: convierte y compara contra 32,000 km por confirmar", () => {
    expect(recorridoEnKm(100, "millas")).toBeCloseTo(160.93, 2);
    expect(recorridoEnKm(100, "km")).toBe(100);
    const r = cotizarEnvio(con({ vehiculo: { recorrido: 20_500, unidadRecorrido: "millas" } }), AHORA);
    const a = r.alertas.find((x) => x.clave === "recorrido");
    expect(a?.nivel).toBe("warn");
    expect(a?.detalle).toContain("por confirmar");
    const ok = cotizarEnvio(con({ vehiculo: { recorrido: 31_999, unidadRecorrido: "km" } }), AHORA);
    expect(ok.alertas.find((x) => x.clave === "recorrido")).toBeUndefined();
  });

  it("diésel usado no ingresa y la importación regular no tiene tributos calculables", () => {
    const r = cotizarEnvio(con({ vehiculo: { combustible: "diesel" } }), AHORA);
    expect(r.alertas.find((x) => x.clave === "diesel-usado")?.nivel).toBe("danger");
    expect(r.regular.tributos).toBeNull();
    // Un diésel NUEVO sí: 20% de ISC.
    const nuevo = cotizarEnvio(con({ vehiculo: { combustible: "diesel", condicion: "nuevo" } }), AHORA);
    expect(nuevo.regular.tributos?.tasas.isc).toBe(0.2);
    expect(nuevo.alertas.find((x) => x.clave === "diesel-usado")).toBeUndefined();
  });

  it("sin préstamo no hay alerta de préstamo", () => {
    const r = cotizarEnvio(con({ prestamoVigente: false }), AHORA);
    expect(r.alertas.find((x) => x.clave === "prestamo")).toBeUndefined();
  });

  it("Ley del Retorno: menos de 3 años fuera pierde el beneficio", () => {
    const r = cotizarEnvio(con({ retorno: { aniosFuera: 2, fechaRetorno: "2027-03-15" } }), AHORA);
    expect(r.alertas.find((x) => x.clave === "retorno-anios")?.nivel).toBe("danger");
    expect(r.retorno.beneficioAplica).toBe(false);
  });

  it("Ley del Retorno: por encima de 50,000 se pierde todo el beneficio (no hay parcial)", () => {
    const r = cotizarEnvio(con({ vehiculo: { valorReferenciaUsadoUsd: 50_001 } }), AHORA);
    expect(r.alertas.find((x) => x.clave === "retorno-tope")?.nivel).toBe("danger");
    expect(r.alertas.find((x) => x.clave === "retorno-margen")).toBeUndefined();
    expect(r.retorno.beneficioAplica).toBe(false);
    // Los tributos del Retorno siguen en 0: la columna muestra lo que valdría con el beneficio.
    expect(r.retorno.tributos?.total).toBe(0);
  });

  it("Ley del Retorno: exactamente 50,000 entra y con margen 0 alerta", () => {
    const r = cotizarEnvio(con({ vehiculo: { valorReferenciaUsadoUsd: 50_000 } }), AHORA);
    expect(r.alertas.find((x) => x.clave === "retorno-tope")).toBeUndefined();
    expect(r.alertas.find((x) => x.clave === "retorno-margen")?.nivel).toBe("warn");
  });

  it("Ley del Retorno: margen holgado no alerta", () => {
    const r = cotizarEnvio(con({ vehiculo: { valorReferenciaUsadoUsd: 40_000 } }), AHORA);
    expect(r.alertas.find((x) => x.clave === "retorno-margen")).toBeUndefined();
  });

  it("Ley del Retorno: retorno después del 31/12/2029 pierde el beneficio; antes, informa la vigencia", () => {
    const tarde = cotizarEnvio(con({ retorno: { aniosFuera: 4, fechaRetorno: "2030-01-10" }, vehiculo: { anioModelo: 2029 } }), AHORA);
    expect(tarde.alertas.find((x) => x.clave === "retorno-vigencia")?.nivel).toBe("danger");
    const aTiempo = cotizarEnvio(SUBARU, AHORA);
    const v = aTiempo.alertas.find((x) => x.clave === "retorno-vigencia");
    expect(v?.nivel).toBe("info");
    expect(v?.titulo).toContain("31/12/2029");
    expect(aTiempo.alertas.find((x) => x.clave === "retorno-transferencia")?.detalle).toContain("3 años");
  });

  it("en importación regular no hay alertas del Retorno", () => {
    const r = cotizarEnvio(con({ regimen: "importacion-regular", retorno: null }), AHORA);
    expect(r.alertas.some((x) => x.clave.startsWith("retorno-"))).toBe(false);
    expect(r.elegido.regimen).toBe("importacion-regular");
  });

  it("ordena las alertas por gravedad", () => {
    const alertas = validarEnvio(
      con({ vehiculo: { combustible: "diesel" } }),
      { anioImportacion: 2027, valorAduana: estimarValorAduana(SUBARU, 2027) },
    );
    const niveles = alertas.map((a) => a.nivel);
    const orden = { danger: 0, warn: 1, info: 2 };
    for (let i = 1; i < niveles.length; i++) {
      expect(orden[niveles[i]]).toBeGreaterThanOrEqual(orden[niveles[i - 1]]);
    }
  });
});

describe("tributos de la importación regular", () => {
  it("nuevo fabricado en EE.UU.: ad valorem 0%; usado: 6% aunque sea de EE.UU.", () => {
    expect(origenDesdePais("Estados Unidos")).toBe("originario-usa");
    expect(origenDesdePais("EE. UU.")).toBe("originario-usa");
    expect(origenDesdePais("USA")).toBe("originario-usa");
    expect(origenDesdePais("Japón")).toBe("otro");
    expect(origenDesdePais("México")).toBe("otro");
    expect(origenDesdePais("")).toBe("otro");

    const nuevoUsa = cotizarEnvio(
      con({ regimen: "importacion-regular", retorno: null, vehiculo: { condicion: "nuevo", paisFabricacion: "Estados Unidos", cilindradaCc: 2400 } }),
      AHORA,
    );
    expect(nuevoUsa.regular.tributos?.tasas.adValorem).toBe(0);
    expect(nuevoUsa.regular.tributos?.tasas.isc).toBe(0.1);
    expect(nuevoUsa.regular.tributos?.tasas.percepcion).toBe(0.1);

    const usadoUsa = cotizarEnvio(con({ regimen: "importacion-regular", retorno: null, vehiculo: { paisFabricacion: "Estados Unidos" } }), AHORA);
    expect(usadoUsa.regular.tributos?.tasas.adValorem).toBe(0.06);
  });

  it("gasolina nuevo: ISC por cilindrada; híbrido y eléctrico nuevos: 0%", () => {
    const chico = cotizarEnvio(con({ regimen: "importacion-regular", retorno: null, vehiculo: { condicion: "nuevo", cilindradaCc: 1400 } }), AHORA);
    expect(chico.regular.tributos?.tasas.isc).toBe(0.05);
    const hev = cotizarEnvio(con({ regimen: "importacion-regular", retorno: null, vehiculo: { condicion: "nuevo", combustible: "hev" } }), AHORA);
    expect(hev.regular.tributos?.tasas.isc).toBe(0);
    const ev = cotizarEnvio(con({ regimen: "importacion-regular", retorno: null, vehiculo: { condicion: "nuevo", combustible: "ev" } }), AHORA);
    expect(ev.regular.tributos?.tasas.isc).toBe(0);
  });
});

describe("costos editables", () => {
  it("servicio fijo o por porcentaje sobre la factura", () => {
    expect(calcularServicio({ tipo: "fijo", montoUsd: 3000 }, 55_000)).toBe(3000);
    expect(calcularServicio({ tipo: "porcentaje", tasa: 0.05 }, 55_000)).toBe(2750);
    expect(calcularServicio({ tipo: "fijo", montoUsd: -5 }, 55_000)).toBe(0);
    const r = cotizarEnvio(con({ costos: { ...SUBARU.costos, servicio: { tipo: "porcentaje", tasa: 0.05 } } }), AHORA);
    expect(r.elegido.servicioUsd).toBe(2750);
    expect(r.elegido.totalUsd).toBeCloseTo(10_530.5 - 250, 2);
  });

  it("flete, aduana y transporte interno editados se reflejan en los dos regímenes", () => {
    const r = cotizarEnvio(
      con({ costos: { transporteInternoUsd: 900, fleteUsd: 3500, gastosAduanaUsd: 2000, servicio: { tipo: "fijo", montoUsd: 3000 } } }),
      AHORA,
    );
    expect(r.retorno.totalUsd).toBeCloseTo(900 + 3500 + 302.5 + 2000 + 3000, 2);
    expect(r.regular.cifUsd).toBeCloseTo(49_500 + 3500 + 302.5, 2);
    expect(r.regular.transporteInternoUsd).toBe(900);
  });

  it("montos negativos o inválidos se tratan como cero", () => {
    const r = cotizarEnvio(
      con({ costos: { transporteInternoUsd: -100, fleteUsd: Number.NaN, gastosAduanaUsd: 2300, servicio: { tipo: "fijo", montoUsd: 3000 } } }),
      AHORA,
    );
    expect(r.retorno.transporteInternoUsd).toBe(0);
    expect(r.retorno.fleteUsd).toBe(0);
    expect(r.retorno.totalUsd).toBeCloseTo(302.5 + 2300 + 3000, 2);
    expect(Number.isFinite(r.regular.totalUsd)).toBe(true);
  });
});
