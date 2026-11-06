import { LUXCARS_CONFIG } from "./config";

/**
 * Valores por defecto de Open Graph para las páginas que definen su propio
 * `openGraph`.
 *
 * POR QUÉ HACE FALTA: Next fusiona el metadata de forma SUPERFICIAL. En cuanto
 * una página declara `openGraph`, reemplaza el objeto entero del layout raíz y
 * pierde `siteName`, `locale` y la imagen generada en src/app/opengraph-image.tsx.
 * Así /importar, /comprar y /vender se compartían por WhatsApp sin vista previa.
 * Cada página hace `...OG_DEFAULTS` dentro de su `openGraph`.
 *
 * La imagen apunta a la ruta que genera src/app/opengraph-image.tsx (el mismo
 * alt y tamaño que exporta ese archivo). `metadataBase` del layout la vuelve
 * absoluta.
 */

export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: `${LUXCARS_CONFIG.brandName} — importación, compra y venta de autos de lujo en Perú`,
};

export const OG_DEFAULTS = {
  siteName: LUXCARS_CONFIG.brandName,
  locale: "es_PE",
  images: [OG_IMAGE],
};

/**
 * Twitter Card grande con el mismo título y descripción que el `openGraph` de
 * la página. Twitter (y WhatsApp/LinkedIn cuando caen a estas etiquetas) no
 * hereda la imagen del layout si la página redefine `twitter`, por eso va
 * explícita.
 */
export function twitterCard(
  title: string,
  description: string,
  images: string[] = [OG_IMAGE.url],
) {
  return {
    card: "summary_large_image" as const,
    title,
    description,
    images,
  };
}
