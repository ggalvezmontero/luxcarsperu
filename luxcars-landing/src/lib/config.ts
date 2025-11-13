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
  contact: {
    whatsappNumber: "51987654321",
    email: "concierge@luxcars.pe",
  },
  services: {
    minimumVehiclePrice: 50000,
    shippingInsuranceBase: 4500,
    shippingInsuranceRate: 0.045,
    adValoremRate: 0.06,
    igvRate: 0.18,
    adminFeeRate: 0.07,
    brokerFeeRate: 0.1,
    finalRangeVariance: 0.05,
    localMarketMarkup: 0.45,
  },
  timeline: [
    { day: "Día 1", title: "Búsqueda & negociación" },
    { day: "Día 2-4", title: "Inspección + CarFax + AutoCheck" },
    { day: "Día 5", title: "Reserva y transporte interno" },
    { day: "Día 6-20", title: "Tránsito marítimo Miami → Callao" },
    { day: "Día 21-28", title: "Aduanas SUNAT y nacionalización" },
    { day: "Día 29-35", title: "Revisión técnica, inscripción y placas" },
    { day: "Entrega", title: "Entrega final certificada" },
  ],
  deliveryWindows: {
    fastTrack: { label: "Fast Track", days: [30, 35] as [number, number] },
    standard: { label: "Estándar", days: [40, 50] as [number, number] },
  },
  iscByBrand: {
    porsche: { rate: 0.25, label: "Performance" },
    bmw: { rate: 0.15, label: "Luxury" },
    "mercedes-benz": { rate: 0.15, label: "Luxury" },
    audi: { rate: 0.15, label: "Luxury" },
    lexus: { rate: 0.15, label: "Luxury" },
    tesla: { rate: 0.0, label: "Eléctrico" },
    "range rover": { rate: 0.2, label: "SUV" },
    cadillac: { rate: 0.2, label: "SUV" },
    "dodge srt": { rate: 0.25, label: "Muscle" },
    bentley: { rate: 0.2, label: "Ultra Luxury" },
    ferrari: { rate: 0.3, label: "Exótico" },
    lamborghini: { rate: 0.3, label: "Exótico" },
    mclaren: { rate: 0.3, label: "Exótico" },
    "aston martin": { rate: 0.3, label: "Exótico" },
    "rolls-royce": { rate: 0.2, label: "Ultra Luxury" },
  },
  iscDefault: { rate: 0.12, label: "Premium" },
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
        "Trabajamos únicamente con vehículos premium y exóticos desde USD 50,000 hacia arriba para asegurar calidad y exclusividad.",
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
        "Solo trabajamos con autos desde USD 50,000 para garantizar exclusividad real.",
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

export type CalculatorInput = {
  brand: string;
  model: string;
  year: string;
  price: number;
};
