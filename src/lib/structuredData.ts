import { LUXCARS_CONFIG } from "./config";
import { CATEGORY_LABEL, type StockVehicle } from "./stockLabels";

/**
 * Datos estructurados JSON-LD. Es lo que permite que Google entienda que
 * Luxcars es un negocio local con dirección, teléfono y servicios concretos,
 * en vez de una página más. Sin esto no hay rich results ni ficha de negocio.
 */

const BASE = LUXCARS_CONFIG.contact.website;

/**
 * @id de la organización. Los demás esquemas (Service de /importar, la oferta
 * de cada auto del stock) la REFERENCIAN con `{ "@id": ORGANIZATION_ID }` en
 * vez de repetir nombre, teléfono y dirección: así hay una sola fuente y Google
 * no ve dos negocios con datos que pueden divergir.
 */
export const ORGANIZATION_ID = `${BASE}/#organizacion`;

/**
 * Logo para los datos estructurados. Va el NEGRO a propósito: Google pinta el
 * logo sobre fondo blanco (panel de conocimiento, resultados) y el blanco que
 * usa la barra del sitio ahí es invisible. Mismos trazados, otro relleno.
 */
const SCHEMA_LOGO = `${BASE}/brand/logo-negro.svg`;

export function autoDealerSchema() {
  const { contact } = LUXCARS_CONFIG;
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": ORGANIZATION_ID,
    name: LUXCARS_CONFIG.brandName,
    legalName: LUXCARS_CONFIG.legalName,
    taxID: LUXCARS_CONFIG.ruc,
    url: BASE,
    logo: SCHEMA_LOGO,
    image: SCHEMA_LOGO,
    telephone: contact.phone,
    email: contact.email,
    priceRange: `USD ${LUXCARS_CONFIG.services.minimumVehiclePrice.toLocaleString("en-US")}+`,
    address: {
      "@type": "PostalAddress",
      streetAddress: contact.address,
      addressLocality: contact.city,
      addressRegion: contact.region,
      addressCountry: contact.country,
    },
    areaServed: [
      { "@type": "Country", name: "Perú" },
      { "@type": "City", name: "Lima" },
    ],
    makesOffer: LUXCARS_CONFIG.businessLines.map((linea) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: linea.label,
        description: linea.description,
      },
    })),
    // Perfiles externos de la misma entidad (nunca el propio sitio): es como
    // se le dice a Google que la ficha de Google Business, Instagram, Facebook
    // y TikTok son Luxcars Perú. Salen de LUXCARS_CONFIG.social.
    sameAs: Object.values(LUXCARS_CONFIG.social),
  };
}

export function faqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${BASE}/#faq`,
    mainEntity: LUXCARS_CONFIG.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE}/#sitio`,
    url: BASE,
    name: LUXCARS_CONFIG.brandName,
    inLanguage: "es-PE",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function breadcrumbSchema(items: { nombre: string; ruta: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.nombre,
      item: `${BASE}${item.ruta}`,
    })),
  };
}

/** Estado del stock → disponibilidad de schema.org. */
const AVAILABILITY: Record<StockVehicle["status"], string> = {
  disponible: "https://schema.org/InStock",
  reservado: "https://schema.org/Reserved",
  en_transito: "https://schema.org/PreOrder",
  vendido: "https://schema.org/SoldOut",
};

/**
 * Ficha de un auto del stock como `Car` de schema.org.
 *
 * REGLA: cada valor sale de lo MISMO que la ficha muestra en pantalla. Google
 * penaliza los datos estructurados que no coinciden con la página, así que lo
 * que la ficha no muestra (o muestra como "—") simplemente no se emite, en vez
 * de rellenarlo. En particular:
 *  · Sin precio publicado ("A consultar") no hay `offers`: un Offer sin precio
 *    es inválido y uno inventado sería peor.
 *  · El precio va redondeado a entero porque la ficha lo muestra sin decimales.
 *  · `images` son las mismas URLs que pinta la galería.
 */
export function vehicleSchema({
  vehicle: v,
  path,
  images,
}: {
  vehicle: StockVehicle;
  /** Ruta canónica de la ficha, p. ej. `/comprar/porsche-cayenne-2021`. */
  path: string;
  images: string[];
}) {
  const url = `${BASE}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Car",
    "@id": `${url}#vehiculo`,
    url,
    name: v.title,
    brand: { "@type": "Brand", name: v.brand },
    model: v.model,
    ...(v.trim ? { vehicleConfiguration: v.trim } : {}),
    vehicleModelDate: String(v.year),
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: v.mileageKm,
      unitCode: "KMT",
    },
    fuelType: CATEGORY_LABEL[v.category],
    ...(v.transmission ? { vehicleTransmission: v.transmission } : {}),
    ...(v.drivetrain ? { driveWheelConfiguration: v.drivetrain } : {}),
    ...(v.bodyStyle ? { bodyType: v.bodyStyle } : {}),
    ...(v.exteriorColor ? { color: v.exteriorColor } : {}),
    ...(v.description ? { description: v.description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(v.price !== null
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: Math.round(v.price),
            priceCurrency: v.currency,
            availability: AVAILABILITY[v.status],
            seller: { "@id": ORGANIZATION_ID },
          },
        }
      : {}),
  };
}
