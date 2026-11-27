/**
 * Genera ejemplos del formato (PDF y DOCX) en `docs/operaciones/ejemplos-formato/`
 * (carpeta ignorada por git) a partir de los fixtures, no de las plantillas. No
 * corre con `npm test`: solo con la variable de entorno.
 *
 *     EJEMPLOS_FORMATO=1 npx vitest run src/lib/expedientes/documentos/ejemplos-formato.test.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it } from "vitest";

import type { Estructura } from "@/core/expedientes/documentos/estructura";
import { fixtureActa, fixtureAnexoB, fixtureCompleto, fixtureConstancia, fixtureLoa } from "./fixture";
import { renderDocx } from "./renderDocx";
import { renderPdf } from "./renderPdf";

const CARPETA = join(process.cwd(), "docs/operaciones/ejemplos-formato");

describe.skipIf(!process.env.EJEMPLOS_FORMATO)("ejemplos de formato", () => {
  it("escribe PDF y DOCX de cada fixture", async () => {
    mkdirSync(CARPETA, { recursive: true });
    const trabajos: [string, Estructura][] = [
      ["contrato", fixtureCompleto()],
      ["contrato-borrador", fixtureCompleto({ marcaDeAgua: "borrador" })],
      ["anexo-b", fixtureAnexoB()],
      ["loa", fixtureLoa()],
      ["constancia", fixtureConstancia()],
      ["acta", fixtureActa()],
    ];
    for (const [nombre, estructura] of trabajos) {
      const [pdf, docx] = await Promise.all([renderPdf(estructura), renderDocx(estructura)]);
      writeFileSync(join(CARPETA, `${nombre}.pdf`), pdf);
      writeFileSync(join(CARPETA, `${nombre}.docx`), docx);
    }
  }, 120_000);
});
