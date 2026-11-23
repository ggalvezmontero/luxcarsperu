import "server-only";

import { currentYearInLima } from "@/core/pricing/pricingConfig";
import { cotizarEjemplo, tienePaginaPropia } from "@/lib/importExamples/modelo";
import { getImportExamplesForIsr } from "@/lib/importExamples/servidor";

/**
 * El caso real de /importar: el primer ejemplo de la lista del dueño que se
 * puede cotizar, es importable sin avisos y tiene foto. Si ninguno cumple,
 * el primero cotizable; si no hay ninguno, null.
 *
 * Vive aparte porque lo usan dos sitios que deben coincidir: el bloque
 * "Un caso real, con números" de la página y la descripción que Google
 * muestra en el resultado (nov 2026: en "importación de autos a pedido"
 * gana quien pone una cifra en el fragmento).
 */
export async function casoDePortada() {
  const { vehiculos } = await getImportExamplesForIsr();
  const anio = currentYearInLima();
  const cotizables = vehiculos
    .filter(tienePaginaPropia)
    .map((v) => ({ v, r: cotizarEjemplo(v, anio) }))
    .flatMap(({ v, r }) => (r.kind === "ready" ? [{ v, e: r.estimate }] : []));
  return cotizables.find(({ v }) => v.importViability === "importable" && v.imageSrc) ?? cotizables[0] ?? null;
}
