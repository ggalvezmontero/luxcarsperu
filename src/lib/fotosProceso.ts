/**
 * Fotos de los pasos del proceso de importación (home y /como-funciona) y de
 * la portada de /escaneo.
 *
 * Misma regla que el resto del sitio (docs/IMAGENES.md): cada foto muestra
 * literalmente lo que dice su paso —un concesionario de EE.UU., un diagnóstico
 * por el puerto OBD, el puerto del Callao, una llave que se entrega— y no
 * aparenta ser una operación de LuxCars. Todas salen de Wikimedia Commons con
 * licencia de uso comercial y están autohospedadas; la procedencia de cada una
 * está en docs/FOTOS.md. Las CC BY llevan `credito`, que se pinta con
 * `CreditoFoto` porque la licencia lo exige.
 *
 * El `alt` describe lo que se ve, no el paso que ilustra.
 */

export type FotoProceso = {
  src: string;
  alt: string;
  credito?: { autor: string; licencia: string; fuenteUrl: string };
};

export const FOTOS_PROCESO = {
  busqueda: {
    src: "/images/how/busqueda-concesionario.webp",
    alt: "Concesionario Porsche de noche, con autos blancos iluminados tras la vidriera",
    credito: {
      autor: "Eden, Janine and Jim",
      licencia: "CC BY 2.0",
      fuenteUrl: "https://commons.wikimedia.org/wiki/File:Porsche_Showroom_(51347492434).jpg",
    },
  },
  inspeccion: {
    src: "/images/how/inspeccion-diagnostico.webp",
    alt: "Una mano sostiene un conector de diagnóstico OBD dentro de un auto, junto a una laptop abierta",
    credito: {
      autor: "Nenad Stojkovic",
      licencia: "CC BY 2.0",
      fuenteUrl: "https://commons.wikimedia.org/wiki/File:Man_holding_Obd2_jack_for_car_software_diagnostic.jpg",
    },
  },
  compra: {
    src: "/images/how/compra-concesionario.webp",
    alt: "Fachada de vidrio de un concesionario Mercedes-AMG en Estados Unidos, en un día despejado",
    credito: {
      autor: "G. Edward Johnson",
      licencia: "CC BY 4.0",
      fuenteUrl: "https://commons.wikimedia.org/wiki/File:EuroMotorcars_Bethesda_MD_2021-12-12_09-44-18_1.jpg",
    },
  },
  embarque: {
    src: "/images/how/shipping.jpg",
    alt: "Terminal portuario con contenedores y grúas",
  },
  aduanas: {
    src: "/images/how/aduanas-callao.webp",
    alt: "Vista aérea del puerto del Callao, con grúas y contenedores apilados junto al mar",
  },
  entrega: {
    src: "/images/how/entrega-llave.webp",
    alt: "Una mano extiende la llave de un auto hacia la cámara",
  },
} as const satisfies Record<string, FotoProceso>;
