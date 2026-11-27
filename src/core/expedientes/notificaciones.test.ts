import { describe, expect, it } from "vitest";

import {
  PLANTILLAS_NOTIFICACION,
  construirNotificacion,
  enlaceCuenta,
  enlaceWhatsApp,
  esPlantillaNotificacion,
  saludo,
  type ContextoNotificacion,
} from "./notificaciones";

const ctx: ContextoNotificacion = {
  codigo: "LC-2026-007",
  cliente: "Ana Prueba",
  auto: "Toyota Tundra 2026",
  etapa: "transito",
  enlace: enlaceCuenta("LC-2026-007"),
};

describe("plantillas de notificación", () => {
  it("todas renderizan con el código y el enlace, en texto y HTML, sin 'LuxCars'", () => {
    for (const plantilla of PLANTILLAS_NOTIFICACION) {
      const n = construirNotificacion(plantilla, ctx, {
        tarea: "Firmar el contrato",
        venceEl: "2026-12-01",
        montoUsd: 73410.5,
        hito: "H2",
        fecha: "2026-11-21",
        documento: "Constancia de fondos F01",
        fechaLimite: "2027-02-03",
        lugar: "Oficina de San Isidro",
      });
      expect(n.plantilla).toBe(plantilla);
      expect(n.asunto).toContain("LC-2026-007");
      expect(n.texto).toContain("LC-2026-007");
      expect(n.texto).toContain("https://www.luxcars.pe/cuenta/importaciones/LC-2026-007");
      expect(n.html).toContain("https://www.luxcars.pe/cuenta/importaciones/LC-2026-007");
      expect(n.html).toContain("<p>Hola Ana,</p>");
      expect(n.texto).not.toMatch(/LuxCars/);
      expect(n.html).not.toMatch(/LuxCars/);
      expect(n.texto).toContain("Equipo Luxcars");
    }
  });

  it("etapa alcanzada usa el nombre de la etapa para el cliente", () => {
    const n = construirNotificacion("etapa_alcanzada", ctx);
    expect(n.asunto).toMatch(/avanzó/);
    expect(n.texto).toContain("Toyota Tundra 2026");
    expect(n.texto).toMatch(/Callao/);
  });

  it("depósito confirmado nombra monto, hito y fecha", () => {
    const n = construirNotificacion("deposito_confirmado", ctx, { montoUsd: 73410.5, hito: "H2", fecha: "2026-11-21" });
    expect(n.texto).toContain("USD 73,410.50");
    expect(n.texto).toContain("H2 (Pago 2: flete y seguro)");
    expect(n.texto).toContain("21 de noviembre de 2026");
    expect(n.texto).toContain("Documentos");
  });

  it("lo opcional se omite sin romper el texto", () => {
    const n = construirNotificacion("aviso_pago", ctx, {});
    expect(n.texto).not.toContain("undefined");
    expect(n.texto).not.toContain("null");
    expect(n.texto).toMatch(/Pago 3/);
  });

  it("el aviso de pago cambia por hito: Pago 3 aduana, Pago 4 directo a SUNAT, Pago 5 honorarios netos", () => {
    const p3 = construirNotificacion("aviso_pago", ctx, { hito: "H4", montoUsd: 2500, fechaLimite: "2027-02-15" });
    expect(p3.asunto).toMatch(/Pago 3/);
    expect(p3.texto).toContain("USD 2,500.00");
    expect(p3.texto).toContain("15 de febrero de 2027");
    expect(p3.texto).toMatch(/Pago 5/);
    const p4 = construirNotificacion("aviso_pago", ctx, { hito: "H5", montoUsd: 27587.85, fechaLimite: "2027-02-16" });
    expect(p4.asunto).toMatch(/Pago 4: tributos a SUNAT/);
    expect(p4.texto).toMatch(/directamente a SUNAT/);
    expect(p4.texto).toMatch(/Clave SOL/);
    expect(p4.texto).toMatch(/Ya pagué/);
    const p5 = construirNotificacion("aviso_pago", ctx, { hito: "H6", montoUsd: 4086.57 });
    expect(p5.asunto).toMatch(/Pago 5/);
    expect(p5.texto).toMatch(/saldo de los gastos de aduana/);
  });

  it("escapa HTML en lo que viene del expediente", () => {
    const n = construirNotificacion("documento_disponible", { ...ctx, auto: "Ford <F-150>" }, { documento: 'Acta "final"' });
    expect(n.html).toContain("&lt;F-150&gt;");
    expect(n.html).toContain("&quot;final&quot;");
    expect(n.html).not.toContain("<F-150>");
  });

  it("saluda por el nombre a personas y en genérico a empresas", () => {
    expect(saludo("Ana Prueba")).toBe("Hola Ana,");
    expect(saludo("PRUEBA FASE 3 S.A.C.")).toBe("Hola,");
    expect(saludo("Transportes Lima S.R.L.")).toBe("Hola,");
    expect(saludo("")).toBe("Hola,");
  });

  it("enlace de WhatsApp con texto codificado; null sin teléfono", () => {
    expect(enlaceWhatsApp(null, "hola")).toBeNull();
    expect(enlaceWhatsApp("51980794348", "Hola Ana, ¿cómo va?")).toBe("https://wa.me/51980794348?text=Hola%20Ana%2C%20%C2%BFc%C3%B3mo%20va%3F");
  });

  it("reconoce las plantillas válidas", () => {
    expect(esPlantillaNotificacion("aviso_pago")).toBe(true);
    expect(esPlantillaNotificacion("aviso_tributos")).toBe(false);
    expect(esPlantillaNotificacion("spam")).toBe(false);
    expect(esPlantillaNotificacion(3)).toBe(false);
  });
});
