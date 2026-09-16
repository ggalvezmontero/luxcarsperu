import { LUXCARS_CONFIG } from "./config";

/**
 * Datos estructurados JSON-LD. Es lo que permite que Google entienda que
 * LuxCars es un negocio local con dirección, teléfono y servicios concretos,
 * en vez de una página más. Sin esto no hay rich results ni ficha de negocio.
 */

const BASE = LUXCARS_CONFIG.contact.website;

export function autoDealerSchema() {
  const { contact } = LUXCARS_CONFIG;
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": `${BASE}/#organizacion`,
    name: LUXCARS_CONFIG.brandName,
    legalName: LUXCARS_CONFIG.legalName,
    taxID: LUXCARS_CONFIG.ruc,
    url: BASE,
    logo: `${BASE}/brand/logo-blanco.svg`,
    image: `${BASE}/brand/logo-blanco.svg`,
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
    sameAs: [BASE],
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
    publisher: { "@id": `${BASE}/#organizacion` },
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
