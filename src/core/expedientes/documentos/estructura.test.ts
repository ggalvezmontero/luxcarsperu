import { describe, expect, it } from "vitest";

import { alineacionesDeTabla, partirNumeracion, tabla, tituloCortoDe, unirCifras, type Bloque, type Estructura } from "./estructura";
import { renderHtml } from "./renderHtml";

const comoTabla = (b: Bloque) => b as Extract<Bloque, { tipo: "tabla" }>;

describe("alineacionesDeTabla", () => {
  it("montos y porcentajes a la derecha, números de fila al centro, texto a la izquierda", () => {
    const t = comoTabla(
      tabla(
        ["Pago", "Cuándo", "Monto", "Porcentaje", "Dónde pagas"],
        [
          ["1", "Al firmar", "USD 2,692.45", "30 %", "Operaciones"],
          ["2", "Inspección", "**64,008.00**", "12.5 %", "Fondos de Clientes"],
          ["", "**Total**", "S/ 1,234", "", ""],
        ],
      ),
    );
    expect(alineacionesDeTabla(t)).toEqual(["centro", "izquierda", "derecha", "derecha", "izquierda"]);
  });

  it("un RUC o un DNI no es una cifra; una fecha tampoco", () => {
    const t = comoTabla(tabla(["RUC", "DNI", "Fecha", "Km"], [["20123456789", "12345678", "2026-11-28", "1200"]]));
    expect(alineacionesDeTabla(t)).toEqual(["izquierda", "izquierda", "izquierda", "derecha"]);
  });

  it("las celdas sin dato no deciden y la plantilla puede imponer la alineación", () => {
    const t = comoTabla(tabla(null, [["—", "____"], ["", "USD 10.00"]]));
    expect(alineacionesDeTabla(t)).toEqual(["izquierda", "derecha"]);
    expect(alineacionesDeTabla({ ...t, alineaciones: ["derecha"] })).toEqual(["derecha", "derecha"]);
  });
});

describe("unirCifras", () => {
  it("la moneda no se separa del monto ni la cifra de su porcentaje", () => {
    expect(unirCifras("Pagar USD 2,692.45 hoy")).toBe("Pagar USD\u00a02,692.45 hoy");
    expect(unirCifras("el 30 % de los honorarios")).toBe("el 30\u00a0% de los honorarios");
    expect(unirCifras("S/ 1,200 y PEN 50")).toBe("S/\u00a01,200 y PEN\u00a050");
    expect(unirCifras("cuesta $ 100")).toBe("cuesta $\u00a0100");
  });

  it("no toca el resto del texto", () => {
    expect(unirCifras("USD estimado")).toBe("USD estimado");
    expect(unirCifras("Lima, 28 de noviembre de 2026")).toBe("Lima, 28 de noviembre de 2026");
  });
});

describe("partirNumeracion y tituloCortoDe", () => {
  it("separa el numeral de cláusula del texto", () => {
    expect(partirNumeracion("4.3 El Mandante paga.")).toEqual({ numero: "4.3", resto: "El Mandante paga." });
    expect(partirNumeracion("12.10.2 Texto")).toEqual({ numero: "12.10.2", resto: "Texto" });
    expect(partirNumeracion("2026 fue un buen año")).toBeNull();
    expect(partirNumeracion("Texto sin número")).toBeNull();
  });

  it("usa el título corto si lo hay y recorta el largo", () => {
    const base: Estructura = { titulo: "x".repeat(80), idioma: "es", codigoExpediente: "LC-1", bloques: [] };
    expect(tituloCortoDe(base)).toHaveLength(60);
    expect(tituloCortoDe({ ...base, tituloCorto: "Contrato" })).toBe("Contrato");
  });
});

describe("vista previa HTML", () => {
  it("alinea las celdas como el PDF, pone el numeral en sangría francesa y muestra lugar y fecha", () => {
    const html = renderHtml({
      titulo: "Contrato",
      lugarFecha: "Lima, 28 de noviembre de 2026",
      idioma: "es",
      codigoExpediente: "LC-2026-099",
      bloques: [tabla(["Pago", "Monto"], [["1", "USD 10.00"]]), { tipo: "parrafo", texto: "4.3 El Mandante paga." }],
    });
    expect(html).toContain('<th class="doc-celda-centro">Pago</th>');
    expect(html).toContain('<td class="doc-celda-der">USD\u00a010.00</td>');
    expect(html).toContain('<span class="doc-num">4.3</span>El Mandante paga.');
    expect(html).toContain('<p class="doc-lugar-fecha">Lima, 28 de noviembre de 2026</p>');
    expect(html).toContain("Expediente LC-2026-099");
  });
});
