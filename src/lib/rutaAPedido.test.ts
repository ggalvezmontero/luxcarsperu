/**
 * La hoja de ruta pública muestra la misma tabla de cinco pagos que el
 * contrato, los anexos, los avisos y la cuenta del cliente (Pago, Cuándo, Qué
 * cubre, Monto, Dónde pagas). El módulo no puede importar el core en tiempo de
 * ejecución (el generador del PDF lo transpila solo), así que esta prueba
 * comprueba que los textos sigan iguales.
 */
import { describe, expect, it } from "vitest";

import { CABECERA_CALENDARIO } from "@/core/expedientes/documentos/plantillas/calendario";
import { CUANDO_PAGO, DONDE_PAGA, QUE_CUBRE_PAGO } from "@/core/expedientes/hitos";
import { CABECERA_PAGOS_RUTA, DINERO_RUTA, PAGOS_RUTA, PASOS_RUTA } from "./rutaAPedido";

describe("hoja de ruta a pedido", () => {
  it("cinco pagos con las mismas columnas y textos que los documentos del expediente", () => {
    expect([...CABECERA_PAGOS_RUTA]).toEqual(CABECERA_CALENDARIO);
    expect(PAGOS_RUTA.map((p) => p.numero)).toEqual([1, 2, 3, 4, 5]);
    for (const p of PAGOS_RUTA) {
      expect(p.cuando, `Pago ${p.numero}`).toBe(CUANDO_PAGO[p.numero]);
      expect(p.queCubre, `Pago ${p.numero}`).toBe(QUE_CUBRE_PAGO[p.numero]);
      expect(p.donde, `Pago ${p.numero}`).toBe(DONDE_PAGA[p.numero]);
      // Página pública: el monto se describe, sin cifras.
      expect(p.monto, `Pago ${p.numero}`).not.toMatch(/\d/);
    }
  });

  it("sin códigos internos ni la cuenta de Operaciones", () => {
    const texto = JSON.stringify({ PASOS_RUTA, DINERO_RUTA });
    expect(texto).not.toMatch(/\bH[1-6]\b/);
    expect(texto).not.toMatch(/Operaciones/);
  });
});
