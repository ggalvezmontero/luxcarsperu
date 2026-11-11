import type { MetadataRoute } from "next";
import { LUXCARS_CONFIG } from "@/lib/config";
import { GUIAS, rutaGuia } from "@/lib/guias";
import { MARCAS_IMPORTABLES, rutaMarca } from "@/lib/importExamples/marca";
import { rutaModelo, tienePaginaPropia } from "@/lib/importExamples/modelo";
import { getImportExamples } from "@/lib/importExamples/servidor";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getPublishedVehicles } from "@/lib/db/vehicles";

const BASE = LUXCARS_CONFIG.contact.website;

/**
 * Sin esto el sitemap se genera una sola vez en el build y un auto publicado
 * desde el portal no entra hasta el siguiente despliegue. Una vez al día
 * basta: Google llega antes a un auto nuevo por el enlace desde /comprar, y
 * así las fechas `lastModified` de las páginas fijas no cambian cada hora.
 */
export const revalidate = 86400;

/**
 * Fichas del stock publicado, con la MISMA URL que la ficha declara como
 * canónica (`/comprar/<slug o id>`). Nunca lanza y nunca inventa: sin base de
 * datos (modo demo) o ante cualquier error devuelve `[]` y el sitemap queda
 * exactamente como antes. Los vendidos no entran: la ficha sigue viva, pero no
 * es una página que queramos empujar a Google.
 */
async function fichasDelStock(): Promise<MetadataRoute.Sitemap> {
  if (!isDatabaseConfigured()) return [];
  try {
    // 100 es el máximo que admite la consulta; hoy sobra.
    const autos = await getPublishedVehicles({ limit: 100, sort: "recientes" });
    return autos
      .filter((v) => v.status !== "vendido")
      .map((v) => {
        const publicado = v.publishedAt ? new Date(v.publishedAt) : null;
        return {
          url: `${BASE}/comprar/${v.slug ?? v.id}`,
          ...(publicado && !Number.isNaN(publicado.getTime())
            ? { lastModified: publicado }
            : {}),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        };
      });
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ahora = new Date();

  const fijas: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    // Una URL por línea de negocio: son las páginas que capturan la búsqueda
    // comercial ("comprar auto de lujo en Lima", "importar auto de EE. UU.",
    // "vender mi auto en consignación"), no solo la de importación.
    { url: `${BASE}/comprar`, lastModified: ahora, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/importar`, lastModified: ahora, changeFrequency: "monthly", priority: 0.9 },
    // La calculadora en su propia URL: responde "calculadora importación de
    // autos Perú", que como ancla de la portada no tenía página.
    { url: `${BASE}/calculadora`, lastModified: ahora, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/vender`, lastModified: ahora, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/escaneo`, lastModified: ahora, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/como-funciona`, lastModified: ahora, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/faq`, lastModified: ahora, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/terminos`, lastModified: ahora, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacidad`, lastModified: ahora, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/cookies`, lastModified: ahora, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Cada ejemplo que se puede cotizar entra con SU página (`/importar/<id>`):
  // son las URLs que capturan búsquedas de modelo concreto ("cuánto cuesta
  // importar una Tundra a Perú"). Antes entraban como `/?simular=<id>`, que es
  // la portada con un parámetro y canoniza a "/": Google las fundía en una.
  // Salen de la misma lista que pinta la web (la base, o el respaldo del
  // repositorio si la base no responde): nunca lanza.
  const { vehiculos: ejemplos } = await getImportExamples();
  const vehiculos: MetadataRoute.Sitemap = ejemplos.filter(tienePaginaPropia).map((v) => ({
    url: `${BASE}${rutaModelo(v.id)}`,
    lastModified: ahora,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Una página por marca: "importar [marca] de Estados Unidos a Perú".
  const marcas: MetadataRoute.Sitemap = MARCAS_IMPORTABLES.map((m) => ({
    url: `${BASE}${rutaMarca(m.nombre)}`,
    lastModified: ahora,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Las guías: una por búsqueda informativa (costo, requisitos, arancel, ISC).
  const guias: MetadataRoute.Sitemap = [
    { url: `${BASE}/guias`, lastModified: ahora, changeFrequency: "monthly", priority: 0.7 },
    ...GUIAS.map((g) => ({
      url: `${BASE}${rutaGuia(g.slug)}`,
      // La fecha real de la última revisión del contenido, no la del despliegue.
      lastModified: new Date(`${g.actualizada}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];

  // El stock va AL FINAL: lo de arriba no cambia de orden ni de contenido.
  const stock = await fichasDelStock();

  return [...fijas, ...vehiculos, ...marcas, ...guias, ...stock];
}
