/**
 * Fotos de los pasos del proceso de importación (home y /como-funciona) y de
 * la portada de /escaneo.
 *
 * Cada foto muestra el paso con un auto dentro: un patio de unidades, un
 * mecánico revisando un motor, un showroom, un buque, autos en un puerto, una
 * llave que se entrega. Son ilustrativas: no aparentan ser una operación de
 * Luxcars. Salen de Unsplash bajo la Licencia Unsplash (uso comercial, sin
 * atribución obligatoria) y están autohospedadas; el autor y la página de
 * origen de cada una están en docs/FOTOS.md.
 *
 * `credito` queda para el día que entre una foto con licencia que SÍ exija
 * atribución (CC BY): los componentes la pintan con `CreditoFoto`.
 *
 * El `alt` describe lo que se ve, no el paso que ilustra.
 */

export type FotoProceso = {
  src: string;
  alt: string;
  credito?: { autor: string; licencia: string; fuenteUrl: string };
};

export const FOTOS_PROCESO: Record<
  "busqueda" | "inspeccion" | "compra" | "embarque" | "aduanas" | "entrega" | "escaneo",
  FotoProceso
> = {
  busqueda: {
    src: "/images/how/busqueda-patio-suv.webp",
    alt: "Fila de SUV negras estacionadas en el patio de un concesionario al atardecer",
  },
  inspeccion: {
    src: "/images/how/inspeccion-taller.webp",
    alt: "Un mecánico revisa el motor de un Mercedes-Benz con el capó abierto en un taller",
  },
  compra: {
    src: "/images/how/compra-showroom.webp",
    alt: "Audi RS gris oscuro visto desde atrás dentro de un showroom luminoso",
  },
  embarque: {
    src: "/images/how/embarque-buque.webp",
    alt: "Buque portacontenedores navegando en mar abierto, visto desde el aire",
  },
  aduanas: {
    src: "/images/how/aduanas-puerto-autos.webp",
    alt: "Camionetas y autos nuevos estacionados en un puerto, con barcos al fondo",
  },
  entrega: {
    src: "/images/how/entrega-llave-auto.webp",
    alt: "Una mano sostiene la llave de un Audi frente a un Audi plateado",
  },
  escaneo: {
    src: "/images/portadas/escaneo-laptop-diagnostico.webp",
    alt: "Un técnico sentado en un auto trabaja con una laptop de diagnóstico conectada al vehículo",
  },
};
