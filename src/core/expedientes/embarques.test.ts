import { describe, expect, it } from "vitest";

import { estadoEmbarque, faltantesEmbarque, repartoEquitativo, sumaReparto, validarReparto } from "./embarques";
import type { Embarque } from "./tipos";

const base: Embarque = {
  id: "b1",
  codigo: "EMB-2026-01",
  modalidad: "consolidado",
  contenedor: "c40hc",
  forwarderId: null,
  aseguradoraId: null,
  almacenConsolidacion: null,
  puertoOrigen: null,
  puertoDestino: "Callao",
  fechaReleaseEst: null,
  fechaReleaseReal: null,
  fechaCarga: null,
  fechaZarpeEst: null,
  fechaZarpeReal: null,
  fechaArriboEst: null,
  fechaArriboReal: null,
  nave: null,
  masterBl: null,
  precinto: null,
  fleteTotalUsd: null,
  gastosContenedorUsd: null,
  declaracionExportacion: null,
  estado: "planificado",
  notasInternas: null,
};

describe("reparto de flete", () => {
  it("equitativo suma exactamente 1 con dos y con tres", () => {
    expect(repartoEquitativo(["a", "b"])).toEqual([{ expedienteId: "a", proporcion: 0.5 }, { expedienteId: "b", proporcion: 0.5 }]);
    const tres = repartoEquitativo(["a", "b", "c"]);
    expect(sumaReparto(tres)).toBe(1);
    expect(tres[1].proporcion).toBe(0.3333);
    expect(tres[0].proporcion).toBe(0.3334);
    expect(repartoEquitativo([])).toEqual([]);
  });

  it("valida suma, rango y duplicados", () => {
    expect(validarReparto([{ expedienteId: "a", proporcion: 0.6 }, { expedienteId: "b", proporcion: 0.4 }])).toBeNull();
    expect(validarReparto([{ expedienteId: "a", proporcion: 0.6 }, { expedienteId: "b", proporcion: 0.3 }])).toMatch(/sumar 1/);
    expect(validarReparto([{ expedienteId: "a", proporcion: 0.5005 }, { expedienteId: "b", proporcion: 0.5 }])).toBeNull();
    expect(validarReparto([{ expedienteId: "a", proporcion: 0 }, { expedienteId: "b", proporcion: 1 }])).toMatch(/entre 0 y 1/);
    expect(validarReparto([{ expedienteId: "a", proporcion: 0.5 }, { expedienteId: "a", proporcion: 0.5 }])).toMatch(/dos veces/);
    expect(validarReparto([])).toMatch(/al menos/);
  });
});

describe("estado y faltantes del embarque", () => {
  it("deriva el estado de las fechas reales", () => {
    expect(estadoEmbarque(base)).toBe("planificado");
    expect(estadoEmbarque({ ...base, fechaZarpeReal: "2026-12-01" })).toBe("en_transito");
    expect(estadoEmbarque({ ...base, fechaZarpeReal: "2026-12-01", fechaArriboReal: "2026-12-20" })).toBe("arribado");
  });

  it("lista lo que falta para operar", () => {
    expect(faltantesEmbarque(base)).toEqual(["forwarder", "puerto de origen", "fecha de zarpe", "fecha de arribo"]);
    expect(faltantesEmbarque({ ...base, forwarderId: "f", puertoOrigen: "Vancouver", fechaZarpeReal: "2026-12-01", fechaArriboEst: "2026-12-20" })).toEqual(["master BL"]);
  });
});
