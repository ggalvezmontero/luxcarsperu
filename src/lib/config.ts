import { IMPORTER_RULES } from "@/core/pricing/importerRules";
import {
  PRICING_CONFIG,
  oldestImportableModelYear,
} from "@/core/pricing/pricingConfig";
import {
  USED_ISC_RATE,
  VEHICLE_CATEGORIES,
} from "@/core/pricing/vehicleCategories";
import { IMPORT_COMPLIANCE_REFERENCE } from "@/lib/db/types";

/**
 * Negro de marca (#050505, el mismo `--color-void` de globals.css) para los
 * metadatos que exigen un color literal: la barra del navegador en móvil.
 * Vive aquí y no en el componente porque en los .tsx no se escriben hex.
 */
export const BRAND_THEME_COLOR = "#050505";

/* ---------------------------------------------------------------------------
   CÓMO SE ESCRIBE EL COPY DE ESTE ARCHIVO
   ---------------------------------------------------------------------------
   1. Ningún número se escribe a mano. Las tasas, los topes y los plazos salen
      de `src/core/pricing/` y de `IMPORT_COMPLIANCE_REFERENCE`. Si mañana la
      norma cambia, cambia en un solo lugar y el copy se actualiza solo. Un
      texto que dice "6%" mientras la calculadora cobra otra cosa destruye más
      confianza que no decir nada.
   2. Sin superlativos. Nada de "líderes", "excelencia", "los mejores".
      El comprador de un vehículo de USD 80,000 descuenta el relleno y se queda
      solo con los datos. Frases cortas, cifras concretas, y cuando la respuesta
      honesta es "no conviene", se dice.
   3. Las cuatro líneas de negocio pesan lo mismo. Este archivo alimenta el
      JSON-LD (`structuredData.ts`), el FAQ, el footer y el índice de líneas:
      si acá solo se habla de importación, tres cuartas partes del negocio son
      invisibles para Google y para el cliente.
   ------------------------------------------------------------------------- */

/**
 * Año de referencia normativo del copy. La antigüedad máxima se cuenta desde
 * el año modelo, así que el año calendario define qué modelos entran.
 *
 * Deliberadamente NO es `new Date().getFullYear()`: este objeto se consume
 * también desde componentes cliente y un valor dependiente del reloj provoca
 * desajustes de hidratación cada 1 de enero. Es una línea a actualizar por año.
 */
const REFERENCE_YEAR = 2026;
const OLDEST_IMPORTABLE_MODEL_YEAR = oldestImportableModelYear(REFERENCE_YEAR);

/** 0.155 → "15.5", 0.05 → "5". Sin ceros decimales de relleno. */
const pct = (rate: number): string => {
  const value = rate * 100;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
};

const usd = (amount: number): string => amount.toLocaleString("en-US");

const AD_VALOREM_GENERAL = pct(PRICING_CONFIG.adValoremByOrigin.otro);
const IGV = pct(PRICING_CONFIG.igvRate);
const IPM = pct(PRICING_CONFIG.ipmRate);
const IGV_TOTAL = pct(PRICING_CONFIG.igvRate + PRICING_CONFIG.ipmRate);
const PERCEPCION = {
  recurrenteNuevo: pct(PRICING_CONFIG.percepcionRates.recurrenteNuevo),
  usado: pct(PRICING_CONFIG.percepcionRates.usado),
  primera: pct(PRICING_CONFIG.percepcionRates.primeraImportacion),
};
const ISC_USADO = pct(USED_ISC_RATE);
/** ISC del diésel NUEVO. Se lee de la categoría para no teclear la tasa. */
const ISC_DIESEL_NUEVO = pct(
  VEHICLE_CATEGORIES.find((category) => category.id === "diesel")
    ?.newIscRate ?? 0,
);
const MIN_PRICE = usd(IMPORTER_RULES.minimumVehiclePrice);
const RANGE_VARIANCE = pct(IMPORTER_RULES.finalRangeVariance);
const MAX_KM_M1 = usd(IMPORT_COMPLIANCE_REFERENCE.maxMileageKm.M1);
const MAX_KM_N1 = usd(IMPORT_COMPLIANCE_REFERENCE.maxMileageKm.N1);

/**
 * Ventanas de entrega. Se declaran fuera del objeto porque el FAQ las cita
 * textualmente y un objeto literal no puede referenciarse a sí mismo. Antes
 * el FAQ decía "30 a 35 días" mientras esta constante decía 30-40: dos fuentes
 * de verdad para el mismo dato, y el cliente leía la más optimista.
 */
const DELIVERY_WINDOWS = {
  fastTrack: { label: "Fast Track", days: [30, 40] as [number, number] },
  standard: { label: "Estándar", days: [40, 60] as [number, number] },
};

const fastTrackRange = `${DELIVERY_WINDOWS.fastTrack.days[0]} y ${DELIVERY_WINDOWS.fastTrack.days[1]}`;
const standardRange = `${DELIVERY_WINDOWS.standard.days[0]} y ${DELIVERY_WINDOWS.standard.days[1]}`;

export const LUXCARS_CONFIG = {
  brandName: "LuxCars Perú",
  brandVariants: [
    "LuxCars",
    "LuxCars Perú",
    "luxcars.pe",
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
  /**
   * Las cuatro líneas de negocio. Los `id` son contrato: `LineasNegocioSection`
   * y el footer mapean metadatos y rutas contra ellos. El orden define la
   * numeración visible. Se puede reescribir label y description; no los ids.
   */
  businessLines: [
    {
      id: "compra-venta",
      label: "Compra y venta",
      description:
        "Stock propio en Lima, ya nacionalizado y con placas. Publicamos año, kilometraje y estado de cada unidad: el dato que no está verificado, no se publica.",
    },
    {
      id: "importacion",
      label: "Importación a pedido",
      description:
        "Buscamos el vehículo exacto en Estados Unidos, lo inspeccionamos antes de pagar y lo entregamos nacionalizado. Antes de cotizar verificamos que sea legalmente importable.",
    },
    {
      id: "tasacion",
      label: "Tasación y consignación",
      description:
        "Valorizamos tu vehículo y lo vendemos por ti. Sin contrato de exclusividad: lo sigues usando mientras se vende y si lo vendes tú, no pagas comisión.",
    },
    {
      id: "documentaria",
      label: "Gestión documentaria",
      description:
        "Nacionalización, homologación, revisión técnica, placas y transferencia. Servicio independiente: no necesitas haber comprado el auto con nosotros.",
    },
  ],
  services: {
    minimumVehiclePrice: IMPORTER_RULES.minimumVehiclePrice,
    finalRangeVariance: IMPORTER_RULES.finalRangeVariance,
    /**
     * OPCIONAL. El piso de USD 30,000 es una regla del importador
     * (`IMPORTER_RULES`), no de la empresa entera: aplica a la importación a
     * pedido. Explicitarlo evita que el copy espante a un cliente de
     * consignación con un auto de USD 18,000.
     */
    minimumAppliesTo: "importacion" as const,
  },
  vehicleTypes: VEHICLE_CATEGORIES,
  /**
   * Hitos de la importación a pedido. SIETE entradas, ni una más:
   * `ProcesoSection` asocia por índice el detalle largo y la proporción en la
   * escala de días. Si agregas o quitas una etapa, ese componente se desalinea.
   */
  timeline: [
    { day: "Día 1", title: "Búsqueda y negociación" },
    { day: "Día 2-4", title: "Inspección en sitio" },
    { day: "Día 5", title: "Reserva y embarque" },
    { day: "Día 6-20", title: "Tránsito marítimo" },
    { day: "Día 21-28", title: "Aduanas y nacionalización" },
    { day: "Día 29-35", title: "Homologación y placas" },
    { day: "Entrega", title: "Entrega documentada" },
  ],
  deliveryWindows: DELIVERY_WINDOWS,
  faq: [
    {
      question: "¿Qué hace exactamente LuxCars Perú?",
      answer:
        "Cuatro cosas. Vendemos vehículos de nuestro stock en Lima. Importamos a pedido desde Estados Unidos. Tasamos tu auto y lo vendemos en consignación sin contrato de exclusividad. Y hacemos gestión documentaria. Puedes contratar una sola línea; no hay paquete obligatorio.",
    },
    {
      question: "¿Puedo comprar un auto ya disponible en Lima, sin importar nada?",
      answer:
        "Sí. El stock propio ya está nacionalizado, con placas y tarjeta de propiedad. Lo ves, lo pruebas y lo compras. De cada unidad publicamos marca, modelo, año, kilometraje y precio. Si un dato no está verificado, no lo publicamos.",
    },
    {
      question: "¿Tengo que dejarles mi auto para venderlo en consignación?",
      answer:
        "No. Trabajamos sin contrato de exclusividad. Publicamos y gestionamos la venta mientras tú sigues usando el vehículo con normalidad; solo lo coordinamos para las visitas de compradores interesados. Si lo vendes por tu cuenta, no pagas comisión.",
    },
    {
      question: "¿Cómo tasan mi vehículo?",
      answer:
        "Partimos de los precios de cierre reales del mismo modelo, año y rango de kilometraje en Lima, no del precio de aviso. Revisamos historial de mantenimiento, estado documentario y cargas registrales. El resultado es un rango con un piso de negociación, no un número suelto.",
    },
    {
      question: "¿Hacen trámites de un auto que no compré con ustedes?",
      answer:
        "Sí. La gestión documentaria es una línea independiente: nacionalización, homologación ante el MTC, revisión técnica, inscripción registral, placas y transferencia de propiedad. No exigimos que el vehículo haya salido de nuestro stock.",
    },
    {
      question: `¿Qué vehículos usados se pueden importar al Perú en ${REFERENCE_YEAR}?`,
      answer:
        `Cuatro condiciones, todas obligatorias. Máximo ${IMPORT_COMPLIANCE_REFERENCE.maxVehicleAgeYears} años de antigüedad contados desde el año modelo, y el año en curso cuenta como uno: en ${REFERENCE_YEAR} entran modelos ${OLDEST_IMPORTABLE_MODEL_YEAR} en adelante. Timón izquierdo de fábrica. Tope de kilometraje de ${MAX_KM_M1} km en autos y SUV (categoría M1) y ${MAX_KM_N1} km en camionetas y pickups (N1). Y no ser diésel usado. Si el vehículo que te gusta no cumple, te lo decimos en la primera conversación.`,
    },
    {
      question: "¿Puedo importar una camioneta diésel usada?",
      answer:
        `No, y no hay trámite que lo levante. La importación de vehículos diésel usados está prohibida en autos, SUV y camionetas (D. Leg. 843 y el texto del D.S. 005-2020-MTC). Diésel nuevo sí se puede: tributa ${ISC_DIESEL_NUEVO}% de ISC. Cualquiera que te ofrezca traer un diésel usado te está vendiendo un problema en aduanas.`,
    },
    {
      question: "¿La percepción del IGV es un costo más?",
      answer:
        `No. Es un adelanto del IGV que recuperas como crédito fiscal, no dinero perdido. La tasa es ${PERCEPCION.recurrenteNuevo}% si eres importador recurrente con mercancía nueva, ${PERCEPCION.usado}% en mercancía usada y ${PERCEPCION.primera}% en primera importación o sin RUC. Sí es caja que tienes que poner el día de la nacionalización, por eso en la cotización la separamos: un número es el costo real de la importación y otro el efectivo que necesitas.`,
    },
    {
      question: "¿Es verdad que un auto comprado en Estados Unidos no paga ad valorem?",
      answer:
        `Solo en un caso. El 0% del acuerdo comercial Perú–EE.UU. exige tres cosas a la vez: que el vehículo sea NUEVO, que sea originario de EE.UU. (contenido regional de al menos 35% por costo neto) y que llegue con certificado de origen y TPI 802 en la DAM. Comprarlo en Miami no basta: un Toyota japonés, un BMW alemán o una unidad ensamblada en México pagan ${AD_VALOREM_GENERAL}%. Los usados pagan ${AD_VALOREM_GENERAL}% siempre, aunque sean originarios. Ante la duda cotizamos ${AD_VALOREM_GENERAL}%: preferimos darte una buena noticia al nacionalizar antes que una mala.`,
    },
    {
      question: "¿Qué tributos paga realmente un vehículo usado?",
      answer:
        `Ad valorem ${AD_VALOREM_GENERAL}% sobre el valor CIF. ISC ${ISC_USADO}%: todo usado de la partida 87.03 paga esa tasa, sea gasolina, híbrido o eléctrico. Sobre esa base acumulada, IGV ${IGV}% más IPM ${IPM}% (${IGV_TOTAL}% en conjunto). Y encima la percepción. La calculadora del sitio aplica esa cascada en ese orden, no un porcentaje plano.`,
    },
    {
      question: "¿Qué tan firme es el estimado de la calculadora?",
      answer:
        `El rango final se mueve ±${RANGE_VARIANCE}%. Los tributos no se mueven, son tasas. Lo que sí varía es el tipo de cambio del día, el flete del mes y el valor que SUNAT acepte como base imponible. No verás cargos nuevos al final: los honorarios ya están dentro del estimado.`,
    },
    {
      question: "¿En cuánto tiempo llega mi auto a Lima?",
      answer:
        `${DELIVERY_WINDOWS.fastTrack.label} toma entre ${fastTrackRange} días desde la reserva. ${DELIVERY_WINDOWS.standard.label}, entre ${standardRange} días. El tramo menos negociable es el marítimo: depende del calendario de naves, no de nosotros. Recibes seguimiento semanal con la posición real del embarque.`,
    },
    {
      question: "¿Incluyen CarFax y AutoCheck?",
      answer:
        "Sí, en toda importación: CarFax, AutoCheck, inspección presencial en Miami con técnicos certificados y verificación de título limpio. El informe llega antes de que se transfiera el dinero al vendedor. Si sale mal, no se compra y se busca otra unidad.",
    },
    {
      question: "¿Cuál es la inversión mínima?",
      answer:
        `Para importación a pedido trabajamos desde USD ${MIN_PRICE}. Por debajo de ese monto los costos fijos del proceso —flete, seguro, agente de aduanas, homologación— pesan demasiado sobre el valor del vehículo y la operación deja de tener sentido para ti. Para tasación, consignación o un trámite documentario ese piso no aplica: escríbenos y te decimos en el momento si podemos ayudarte.`,
    },
    {
      question: "¿Por qué no publican todo el inventario de Estados Unidos en la web?",
      answer:
        "Porque los términos de uso de esos portales prohíben copiar y almacenar su inventario en una base de datos propia. Lo que ves publicado es lo que verificamos nosotros: stock propio y unidades cargadas a mano, con el VIN decodificado contra la base pública del gobierno de Estados Unidos. Menos autos en pantalla y cero fichas inventadas. Si buscas un modelo que no está listado, lo rastreamos para ti y te enviamos el informe.",
    },
    {
      question: "¿Y si el auto que quiero no conviene traerlo?",
      answer:
        "Te lo decimos. Hay modelos que no tiene sentido importar: el Changan CS55 Plus y el Geely Coolray se venden nuevos en Perú por menos de lo que costaría traerlos, y ni siquiera están en la red de dealers de Estados Unidos. Otros llegan con advertencia: el Tesla Cybertruck no está homologado fuera de Norteamérica, así que la matriculación en Perú no está garantizada y sin ella no hay placas. Preferimos perder una venta antes que cobrarte por una mala idea.",
    },
  ],
  brandShowcase: [
    "Toyota",
    "Ford",
    "Chevrolet",
    "RAM",
    "Jeep",
    "Tesla",
    "Dodge SRT",
    "Cadillac",
    "Lexus",
    "BMW",
    "Mercedes-Benz",
    "Audi",
    "Porsche",
    "Range Rover",
    "Bentley",
    "Aston Martin",
    "McLaren",
    "Lamborghini",
    "Ferrari",
    "Rolls-Royce",
  ],
  /**
   * ────────────────────────────────────────────────────────────────────────
   * FUENTES DE BÚSQUEDA. NO SON FUENTES DE DATOS. NO LO "OPTIMICES".
   * ────────────────────────────────────────────────────────────────────────
   * Esta lista dice DÓNDE MIRA un asesor humano. No autoriza a consumir ni a
   * persistir su inventario. Los términos de MarketCheck, Auto.dev, eBay,
   * Autotrader, CarGurus, Cars.com, TrueCar, AutoTempest y Facebook
   * Marketplace prohíben textualmente "cache, store, index or otherwise
   * persist", prohíben crear "derivative databases" y obligan a borrar a las
   * 6 horas. Un solo INSERT con esos datos es incumplimiento de contrato y
   * revocación de la llave de API.
   *
   * La vía legal es la que ya usamos: carga manual curada en el admin con
   * autocompletado por VIN contra NHTSA vPIC (API del gobierno de EE.UU.,
   * gratuita, sin restricción contractual), y más adelante feeds XML de
   * dealers partner con cláusula de licencia firmada.
   */
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
  /**
   * `WhyUsSection` da el único acento dorado de la sección al diferenciador
   * titulado exactamente "Consignación sin exclusividad". Si le cambias el
   * título, el destacado desaparece sin error de compilación.
   */
  differentiators: [
    {
      title: "Consignación sin exclusividad",
      description:
        "Dejas tu auto en venta con nosotros y lo sigues manejando. No firmas exclusividad ni lo inmovilizas en un patio. Si lo vendes por tu cuenta, no nos debes nada.",
    },
    {
      title: "Cuatro líneas, una sola contraparte",
      description:
        "Compra de stock, importación a pedido, tasación y consignación, y gestión documentaria. Puedes usar una o las cuatro, y no cambias de interlocutor a mitad del proceso.",
    },
    {
      title: "La norma antes que el precio",
      description:
        `Antes de cotizar verificamos antigüedad, kilometraje, propulsión y timón. Máximo ${IMPORT_COMPLIANCE_REFERENCE.maxVehicleAgeYears} años desde el año modelo, ${MAX_KM_M1} km en autos y SUV, ${MAX_KM_N1} km en camionetas. Si no es nacionalizable, te lo decimos antes del depósito, no después.`,
    },
    {
      title: "Diésel usado: la respuesta es no",
      description:
        "Está prohibido importarlo en autos, SUV y camionetas. No hay excepción ni gestión que lo resuelva. Lo decimos en la primera llamada porque es el error que más caro sale.",
    },
    {
      title: "La percepción no es un costo",
      description:
        `Te damos dos cifras separadas: el costo real de la importación y el efectivo que necesitas. La percepción del IGV —${PERCEPCION.recurrenteNuevo}%, ${PERCEPCION.usado}% o ${PERCEPCION.primera}% según el caso— va en la segunda: es crédito fiscal que recuperas, no dinero perdido.`,
    },
    {
      title: "Ad valorem sin promesas",
      description:
        `El 0% del acuerdo con EE.UU. exige vehículo nuevo, originario y con certificado de origen. Cuando no se cumplen las tres, cotizamos ${AD_VALOREM_GENERAL}%. Preferimos una buena noticia al nacionalizar antes que una mala.`,
    },
    {
      title: "Calculadora pública",
      description:
        `El estimado completo sale en el sitio, sin dejar tus datos y sin esperar a un asesor. Incluye tributos, flete, seguro y nuestros honorarios, con un rango final de ±${RANGE_VARIANCE}%.`,
    },
    {
      title: "Fichas verificadas, no copiadas",
      description:
        "Cada unidad se carga a mano y el VIN se decodifica contra la base pública del gobierno de Estados Unidos. No replicamos fichas de portales ajenos: menos autos en pantalla, ningún dato inventado.",
    },
    {
      title: "Inspección antes de pagar",
      description:
        "Inspección presencial en Miami con técnicos certificados, informe de 150 puntos, CarFax, AutoCheck y verificación de título limpio. El informe llega antes de transferir el dinero. Si sale mal, no se compra.",
    },
    {
      title: "Te decimos cuándo no importar",
      description:
        "Un Changan CS55 Plus o un Geely Coolray se venden nuevos en Perú por menos de lo que costaría traerlos. Cuando el número no te favorece, lo decimos y perdemos la venta.",
    },
  ],
  /**
   * OPCIONAL. Datos duros verificados, listos para renderizar como tabla o
   * lista de comprobación. Existe para que una sección futura no tenga que
   * volver a teclear tasas: todo sale del motor de precios.
   */
  hardFacts: [
    {
      id: "antiguedad",
      title: "Antigüedad máxima",
      value: `${IMPORT_COMPLIANCE_REFERENCE.maxVehicleAgeYears} años`,
      detail: `Contados desde el año modelo, incluyendo el año en curso. En ${REFERENCE_YEAR}, solo modelos ${OLDEST_IMPORTABLE_MODEL_YEAR} en adelante.`,
    },
    {
      id: "kilometraje",
      title: "Tope de kilometraje",
      value: `${MAX_KM_M1} / ${MAX_KM_N1} km`,
      detail: "M1 (autos y SUV) y N1 (camionetas y pickups), respectivamente.",
    },
    {
      id: "diesel",
      title: "Diésel usado",
      value: "Prohibido",
      detail:
        "En autos, SUV y camionetas. D. Leg. 843 y texto del D.S. 005-2020-MTC. Diésel nuevo sí se importa.",
    },
    {
      id: "timon",
      title: "Timón",
      value: "Izquierdo de fábrica",
      detail: "No se acepta conversión de timón derecho.",
    },
    {
      id: "ad-valorem",
      title: "Ad valorem",
      value: `${AD_VALOREM_GENERAL}% · 0% condicionado`,
      detail:
        "0% solo si el vehículo es nuevo, originario de EE.UU. y llega con certificado de origen y TPI 802. Todo usado paga el general.",
    },
    {
      id: "isc-usado",
      title: "ISC en usados",
      value: `${ISC_USADO}%`,
      detail:
        "Toda la partida 87.03, sin importar la propulsión: gasolina, híbrido o eléctrico.",
    },
    {
      id: "igv",
      title: "IGV e IPM",
      value: `${IGV}% + ${IPM}%`,
      detail: `${IGV_TOTAL}% en conjunto, sobre CIF más ad valorem más ISC.`,
    },
    {
      id: "percepcion",
      title: "Percepción del IGV",
      value: "Recuperable",
      detail: `${PERCEPCION.recurrenteNuevo}% recurrente con mercancía nueva, ${PERCEPCION.usado}% en usados, ${PERCEPCION.primera}% en primera importación. Es crédito fiscal, no costo: caja que pones y recuperas.`,
    },
  ],
  /**
   * OPCIONAL. Texto de servicio por línea de negocio, con la misma clave `id`
   * que `businessLines`. Pensado para páginas de detalle: `summary` es el
   * párrafo de entrada, `includes` la lista de lo que sí está incluido y
   * `honesty` el límite que conviene decir antes de que lo pregunten.
   */
  serviceCopy: {
    "compra-venta": {
      headline: "Disponible hoy, en Lima",
      summary:
        "Unidades de stock propio, nacionalizadas y con placas. No esperas naves ni aduanas: firmas y te lo llevas.",
      includes: [
        "Año, kilometraje y estado publicados por unidad",
        "Historial y estado documentario a la vista antes de la visita",
        "Transferencia de propiedad incluida",
        "Prueba de manejo coordinada",
      ],
      honesty:
        "El stock es corto y rota. Si no está listado, no lo tenemos: no inflamos el catálogo con fichas de terceros.",
    },
    importacion: {
      headline: "El vehículo exacto que pediste",
      summary:
        `Búsqueda, negociación, inspección, flete, seguro, aduanas, homologación y placas. Desde USD ${MIN_PRICE}, con estimado público antes de que hables con un asesor.`,
      includes: [
        "Verificación normativa previa: antigüedad, kilometraje, propulsión y timón",
        "Inspección presencial con CarFax, AutoCheck y título limpio",
        "Cotización con la percepción del IGV separada del costo real",
        "Seguimiento semanal del embarque y carpeta documentaria completa",
      ],
      honesty:
        `El tránsito marítimo depende del calendario de naves. Por eso damos rango (${fastTrackRange} días en ${DELIVERY_WINDOWS.fastTrack.label}, ${standardRange} en ${DELIVERY_WINDOWS.standard.label}) y no una fecha exacta.`,
    },
    tasacion: {
      headline: "Lo vendes sin dejar de usarlo",
      summary:
        "Tasación con precios de cierre reales del mercado limeño y venta en consignación sin contrato de exclusividad.",
      includes: [
        "Rango de precio con piso de negociación, no un número suelto",
        "Revisión de cargas registrales y estado documentario",
        "Publicación y filtrado de compradores",
        "Coordinación de visitas: el auto se queda contigo",
      ],
      honesty:
        "Si lo vendes por tu cuenta, no pagas comisión. Y si tu expectativa de precio está por encima del mercado, te lo decimos con los comparables en la mano.",
    },
    documentaria: {
      headline: "El trámite, sin que sea tu problema",
      summary:
        "Nacionalización, homologación ante el MTC, revisión técnica, inscripción registral, placas y transferencia de propiedad.",
      includes: [
        "Gestión ante SUNAT, MTC y SUNARP",
        "Servicio suelto: no exige haber comprado con nosotros",
        "Revisión previa de admisibilidad antes de iniciar el expediente",
        "Estado del trámite por WhatsApp, sin tener que llamar a preguntar",
      ],
      honesty:
        "Hay expedientes que no salen: un vehículo inadmisible no se arregla con gestión. Lo revisamos antes de cobrarte.",
    },
  },
};

export type VehicleTypeId =
  (typeof LUXCARS_CONFIG.vehicleTypes)[number]["id"];
