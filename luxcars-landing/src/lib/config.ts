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
    shippingBase: 3200,
    shippingRate: 0.028,
    insuranceMinimum: 900,
    insuranceRate: 0.017,
    igvRate: 0.18,
    stateComplianceRate: 0.07,
    brokerFeeRate: 0.1,
    finalRangeVariance: 0.025,
    localMarketMarkup: 0.45,
  },
  vehicleTypes: [
    {
      id: "suv-premium",
      label: "SUV Premium / Lujo",
      iscRate: 0.3,
      tooltip:
        "Las SUVs de lujo generalmente tienen un ISC aproximado del 30% según tablas SUNAT.",
    },
    {
      id: "deportivo",
      label: "Deportivo / Superdeportivo",
      iscRate: 0.4,
      tooltip:
        "Los superdeportivos y autos de alta cilindrada suelen tener un ISC cercano al 40%.",
    },
    {
      id: "ev",
      label: "Eléctrico (EV)",
      iscRate: 0,
      tooltip:
        "Los vehículos 100% eléctricos están exonerados del ISC (0%).",
    },
    {
      id: "phev",
      label: "Híbrido Enchufable (PHEV)",
      iscRate: 0.02,
      tooltip:
        "Los híbridos enchufables tienen un ISC preferencial aproximado del 2%.",
    },
    {
      id: "hev",
      label: "Híbrido (HEV)",
      iscRate: 0.1,
      tooltip:
        "Los híbridos no enchufables suelen tributar un ISC estimado del 10%.",
    },
    {
      id: "pickup",
      label: "Pickup / Camioneta",
      iscRate: 0.2,
      tooltip:
        "ISC estimado para camionetas o pickups orientadas a uso mixto.",
    },
  ] as const,
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

export type VehicleTypeId =
  (typeof LUXCARS_CONFIG.vehicleTypes)[number]["id"];

export type CalculatorInput = {
  brand: string;
  model: string;
  year: string;
  price: number;
  vehicleType: VehicleTypeId;
  peruPrice?: number;
};
