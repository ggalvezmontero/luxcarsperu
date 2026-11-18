import { describe, expect, it } from "vitest";

import { parsearEntradaEnvio } from "./parsearEntrada";

const VALIDA = {
  cliente: { nombre: "  Juan  ", whatsapp: "+1 305 555 0100" },
  vehiculo: {
    marca: "Subaru",
    modelo: "Outback",
    anioModelo: "2026",
    condicion: "usado",
    recorrido: "500",
    unidadRecorrido: "millas",
    combustible: "gasolina",
    paisFabricacion: "Japón",
    valorFacturaUsd: "55000",
    valorReferenciaUsadoUsd: "",
    cilindradaCc: null,
  },
  origen: { ciudad: "Vail", estado: "Colorado", puertoSalida: "" },
  regimen: "ley-retorno",
  retorno: { aniosFuera: "4", fechaRetorno: "2027-03-15" },
  prestamoVigente: true,
  fechaImportacion: "no-es-fecha",
  costos: { transporteInternoUsd: "1700", fleteUsd: 3228, gastosAduanaUsd: 2300, servicio: { tipo: "fijo", montoUsd: 3000 } },
};

describe("parsearEntradaEnvio", () => {
  it("sanea una entrada válida escrita como texto", () => {
    const e = parsearEntradaEnvio(VALIDA);
    expect(e).not.toBeNull();
    expect(e!.cliente.nombre).toBe("Juan");
    expect(e!.vehiculo.anioModelo).toBe(2026);
    expect(e!.vehiculo.recorrido).toBe(500);
    expect(e!.vehiculo.valorFacturaUsd).toBe(55_000);
    expect(e!.vehiculo.valorReferenciaUsadoUsd).toBeNull();
    expect(e!.origen.puertoSalida).toBe("Miami");
    expect(e!.retorno).toEqual({ aniosFuera: 4, fechaRetorno: "2027-03-15" });
    expect(e!.fechaImportacion).toBeNull();
    expect(e!.costos.transporteInternoUsd).toBe(1700);
    expect(e!.costos.servicio).toEqual({ tipo: "fijo", montoUsd: 3000 });
  });

  it("rechaza lo que no puede faltar", () => {
    expect(parsearEntradaEnvio(null)).toBeNull();
    expect(parsearEntradaEnvio("texto")).toBeNull();
    expect(parsearEntradaEnvio({ ...VALIDA, cliente: { nombre: "" } })).toBeNull();
    expect(parsearEntradaEnvio({ ...VALIDA, vehiculo: { ...VALIDA.vehiculo, marca: "" } })).toBeNull();
    expect(parsearEntradaEnvio({ ...VALIDA, vehiculo: { ...VALIDA.vehiculo, anioModelo: 1900 } })).toBeNull();
    expect(parsearEntradaEnvio({ ...VALIDA, vehiculo: { ...VALIDA.vehiculo, combustible: "nuclear" } })).toBeNull();
    expect(parsearEntradaEnvio({ ...VALIDA, regimen: "otro" })).toBeNull();
  });

  it("en importación regular descarta el bloque del Retorno y acota el porcentaje del servicio", () => {
    const e = parsearEntradaEnvio({
      ...VALIDA,
      regimen: "importacion-regular",
      costos: { ...VALIDA.costos, servicio: { tipo: "porcentaje", tasa: 7 } },
    });
    expect(e!.retorno).toBeNull();
    expect(e!.costos.servicio).toEqual({ tipo: "porcentaje", tasa: 1 });
  });

  it("recorta textos largos y corrige valores imposibles", () => {
    const e = parsearEntradaEnvio({
      ...VALIDA,
      vehiculo: { ...VALIDA.vehiculo, marca: "x".repeat(200), unidadRecorrido: "leguas", recorrido: -5, condicion: "casi nuevo" },
      prestamoVigente: "sí",
    });
    expect(e!.vehiculo.marca).toHaveLength(80);
    expect(e!.vehiculo.unidadRecorrido).toBe("millas");
    expect(e!.vehiculo.recorrido).toBe(0);
    expect(e!.vehiculo.condicion).toBe("usado");
    expect(e!.prestamoVigente).toBe(false);
  });
});
