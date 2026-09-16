import { IMPORTER_RULES } from "@/core/pricing/importerRules";
import { VEHICLE_CATEGORIES } from "@/core/pricing/vehicleCategories";

export const LUXCARS_CONFIG = {
  brandName: "LuxCars Perú",
  brandVariants: [
    "LuxCars",
    "LuxCars Perú",
    "LuxCars.pe",
    "LuxCars Broker",
    "LuxCars Imports",
    "LuxAutoCars",
    "LuxCarX",
    "LXCARS",
    "LX Cars",
  ],
  legalName: "LUX CARS IMPORT S.A.C.",
  ruc: "20615410935",
  contact: {
    whatsappNumber: "51980794348",
    email: "info@luxcars.pe",
    phone: "+51 980 794 348",
    address: "Calle Dionisio Derteano 184, Of. 1102, San Isidro",
    city: "Lima",
    region: "Lima",
    country: "PE",
    website: "https://luxcars.pe",
  },
  /** Las cuatro líneas de negocio, tal como figuran en el material de marca. */
  businessLines: [
    {
      id: "compra-venta",
      label: "Compra y venta",
      description:
        "Compramos y vendemos vehículos premium con stock propio verificado.",
    },
    {
      id: "importacion",
      label: "Importación a pedido",
      description:
        "Buscamos, inspeccionamos e importamos el vehículo exacto que pides.",
    },
    {
      id: "tasacion",
      label: "Tasación y consignación",
      description:
        "Valorizamos tu vehículo y lo vendemos por ti. Sin contrato de exclusividad: sigues usando tu auto mientras lo vendemos.",
    },
    {
      id: "documentaria",
      label: "Gestión documentaria",
      description:
        "Nacionalización, homologación, placas y transferencias.",
    },
  ],
  services: {
    minimumVehiclePrice: IMPORTER_RULES.minimumVehiclePrice,
    finalRangeVariance: IMPORTER_RULES.finalRangeVariance,
  },
  vehicleTypes: VEHICLE_CATEGORIES,
  timeline: [
    { day: "Día 1", title: "Búsqueda & negociación" },
    { day: "Día 2-4", title: "Inspección certificada" },
    { day: "Día 5", title: "Reserva & transporte" },
    { day: "Día 6-20", title: "Tránsito marítimo" },
    { day: "Día 21-28", title: "Aduanas & nacionalización" },
    { day: "Día 29-35", title: "Revisión técnica & placas" },
    { day: "Entrega", title: "Entrega final certificada" },
  ],
  deliveryWindows: {
    fastTrack: { label: "Fast Track", days: [30, 40] as [number, number] },
    standard: { label: "Estándar", days: [40, 60] as [number, number] },
  },
  faq: [
    {
      question: "¿Qué cubre el servicio concierge de LuxCars Perú?",
      answer:
        "Nos encargamos de la búsqueda, negociación, inspección profesional, logística internacional, trámites en aduanas SUNAT, homologación, placas y entrega VIP en Lima.",
    },
    {
      question: "¿En cuánto tiempo llega mi auto a Lima?",
      answer:
        "Fast Track tarda entre 30 y 35 días desde la reserva. El servicio estándar toma entre 40 y 50 días según disponibilidad de naves y coordinación con SUNAT.",
    },
    {
      question: "¿Incluyen CarFax y AutoCheck?",
      answer:
        "Sí. Toda compra incluye CarFax, AutoCheck y una inspección en sitio por especialistas certificados en Miami.",
    },
    {
      question: "¿Cuál es la inversión mínima?",
      answer:
        `Trabajamos únicamente con vehículos premium y exóticos desde USD ${IMPORTER_RULES.minimumVehiclePrice.toLocaleString("en-US")} hacia arriba para asegurar calidad y exclusividad.`,
    },
    {
      question: "¿Tengo que dejarles mi auto para venderlo en consignación?",
      answer:
        "No. Trabajamos sin contrato de exclusividad: publicamos y gestionamos la venta de tu vehículo mientras tú lo sigues usando con normalidad. Solo lo coordinamos para las visitas de compradores interesados, y si lo vendes por tu cuenta no pagas comisión.",
    },
    {
      question: "¿Qué pasa si no encuentro el auto ideal?",
      answer:
        "Nuestro equipo compara 10+ portales premium en Miami y presenta un informe con las mejores oportunidades reales sin costo adicional.",
    },
  ],
  brandShowcase: [
    "Porsche",
    "Ferrari",
    "Lamborghini",
    "Rolls-Royce",
    "McLaren",
    "Bentley",
    "Range Rover",
    "BMW",
    "Mercedes-Benz",
    "Audi",
    "Lexus",
    "Tesla",
    "Cadillac",
    "Aston Martin",
    "Dodge SRT",
    "Toyota",
    "Jeep",
    "Ford",
    "Chevrolet",
  ],
  sourcingPlatforms: [
    "Cars.com",
    "CarGurus",
    "Autotrader",
    "TrueCar",
    "eBay Motors",
    "AutoTempest",
    "Facebook Marketplace (dealers verificados)",
    "Páginas oficiales de marcas premium",
  ],
  differentiators: [
    {
      title: "Transparencia total",
      description:
        "Sin costos ocultos ni sorpresas. Conoce cada dólar del proceso antes de firmar.",
    },
    {
      title: "Calculadora pública",
      description:
        "Obtén tu estimado completo sin esperar a un asesor. Datos claros en segundos.",
    },
    {
      title: "Ticket premium",
      description:
        `Solo trabajamos con autos desde USD ${IMPORTER_RULES.minimumVehiclePrice.toLocaleString("en-US")} para garantizar exclusividad real.`,
    },
    {
      title: "Consignación sin exclusividad",
      description:
        "Dejas tu auto en venta con nosotros y sigues manejándolo. No firmas exclusividad ni lo inmovilizas: si lo vendes por tu cuenta, no nos debes nada.",
    },
    {
      title: "Servicio concierge Miami → Perú",
      description:
        "Coordinamos todo el proceso puerta a puerta, con un equipo bilingüe experto.",
    },
    {
      title: "Somos tu broker",
      description:
        "Representamos únicamente tus intereses. Negociamos como si el auto fuera nuestro.",
    },
    {
      title: "Inspección certificada",
      description:
        "Inspección profesional en Miami con técnicos ASE + reportes CarFax y AutoCheck incluidos.",
    },
    {
      title: "Asesoría de búsqueda",
      description:
        "Comparativa real de 10+ opciones para asegurarte la mejor compra disponible.",
    },
    {
      title: "Cupos limitados",
      description:
        "Nos enfocamos en pocos clientes al mes para ofrecer un acompañamiento 100% personalizado.",
    },
    {
      title: "Precio final sin sorpresas",
      description:
        "Estimados con rango realista que incluye impuestos, fletes y nuestros honorarios.",
    },
  ],
};

export type VehicleTypeId =
  (typeof LUXCARS_CONFIG.vehicleTypes)[number]["id"];
