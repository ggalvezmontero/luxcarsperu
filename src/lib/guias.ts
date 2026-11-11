/**
 * Registro de las guías (/guias/<slug>).
 *
 * POR QUÉ EXISTEN: el sitio tenía páginas de servicio y ninguna que explicara
 * el tema. En Google las búsquedas de costo, requisitos, arancel e ISC las
 * ocupan blogs gratuitos, foros de hace años y notas de 2018, casi siempre sin
 * cifras o con cifras que se contradicen (estudio del 2026-11-10, en
 * docs/marketing). Cada guía responde UNA de esas búsquedas.
 *
 * REGLAS:
 *   · Ningún número se escribe a mano. Tasas, topes y ejemplos salen de
 *     `src/core/pricing` y de `LUXCARS_CONFIG`, igual que el resto del copy.
 *   · Una guía, una búsqueda. Dos guías compitiendo por la misma se estorban.
 *   · `actualizada` se cambia a mano cuando cambia el CONTENIDO, no en cada
 *     despliegue: es la fecha que Google muestra y no debe mentir.
 *
 * Este archivo lo leen el índice, el sitemap y los enlaces entre guías.
 */

export type Guia = {
  slug: string;
  /** Título de la página y del resultado en Google. `{anio}` → año en curso. */
  titulo: string;
  /** Nombre corto para enlaces y migas. */
  corto: string;
  descripcion: string;
  publicada: string;
  actualizada: string;
};

export const GUIAS: readonly Guia[] = [
  {
    slug: "cuanto-cuesta-importar-un-auto-a-peru",
    titulo: "Cuánto cuesta importar un auto a Perú en {anio}",
    corto: "Cuánto cuesta importar un auto",
    descripcion:
      "El costo real de importar y nacionalizar un auto de Estados Unidos a Perú, con ejemplos en cifras: flete, seguro, ad valorem, ISC, IGV y servicio.",
    publicada: "2026-11-10",
    actualizada: "2026-11-10",
  },
  {
    slug: "requisitos-para-importar-un-auto-a-peru",
    titulo: "Requisitos para importar un auto a Perú en {anio}",
    corto: "Requisitos para importar",
    descripcion:
      "Qué vehículos se pueden importar a Perú y cuáles no: antigüedad máxima, kilometraje, diésel usado, timón y los trámites hasta las placas.",
    publicada: "2026-11-10",
    actualizada: "2026-11-10",
  },
  {
    slug: "ad-valorem-0-autos-estados-unidos",
    titulo: "Ad valorem 0%: qué autos de Estados Unidos no pagan arancel en Perú",
    corto: "Ad valorem 0% y certificado de origen",
    descripcion:
      "Cuándo un auto comprado en Estados Unidos entra a Perú con 0% de arancel, qué es el certificado de origen y qué modelos califican según su planta.",
    publicada: "2026-11-10",
    actualizada: "2026-11-10",
  },
  {
    slug: "isc-vehiculos-peru",
    titulo: "ISC de vehículos en Perú {anio}: tasas por motor, nuevos y usados",
    corto: "ISC de vehículos",
    descripcion:
      "Cuánto ISC paga un vehículo al importarse a Perú: gasolina, diésel, híbridos, eléctricos y usados. Tabla vigente y ejemplos en cifras.",
    publicada: "2026-11-10",
    actualizada: "2026-11-10",
  },
];

export function rutaGuia(slug: string): string {
  return `/guias/${slug}`;
}

export function tituloGuia(guia: Guia, anio: number): string {
  return guia.titulo.replace("{anio}", String(anio));
}

export function guiaPorSlug(slug: string): Guia {
  const guia = GUIAS.find((g) => g.slug === slug);
  if (!guia) throw new Error(`[guias] No existe la guía "${slug}".`);
  return guia;
}
