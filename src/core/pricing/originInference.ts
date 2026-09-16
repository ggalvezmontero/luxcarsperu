import { PRICING_CONFIG, type VehicleOrigin } from "./pricingConfig";

/**
 * ============================================================================
 *  SUGERENCIA DE ORIGEN A PARTIR DE MARCA + MODELO
 * ============================================================================
 *
 * El ad valorem es 0% SOLO si el vehículo es ORIGINARIO de EE.UU. bajo el APC
 * Perú–Estados Unidos (regla de origen del capítulo 87 + certificado de origen
 * del exportador). Comprarlo en Miami no da origen: lo que decide es dónde se
 * ENSAMBLÓ y si cumple la regla de origen. Todo lo demás paga 6%.
 *
 * REGLA DE ORO DE ESTE MÓDULO: ante cualquier duda, devolver "otro" (6%).
 * Prometer 0% y cobrar 6% al nacionalizar destruye la confianza del cliente;
 * sugerir 6% y luego bajar a 0% con el certificado en mano es una buena
 * noticia. Por eso el veredicto se calcula con DOBLE CANDADO:
 *
 *     origin = (usOrigin === true && confidence === "alta") ? 0% : 6%
 *
 * Una regla marcada como ensamblada en EE.UU. pero con confianza media o baja
 * NO sugiere 0%: sugiere 6% y explica por qué vale la pena pedir el VIN.
 *
 * ---------------------------------------------------------------------------
 * LO QUE ESTE MÓDULO **NO** HACE
 * ---------------------------------------------------------------------------
 * - No decide el origen: lo SUGIERE. El único documento que vale ante SUNAT es
 *   el certificado de origen del APC emitido por el exportador.
 * - No usa porcentajes AALA como prueba. El AALA (etiqueta Monroney) mide
 *   contenido de EE.UU. **+ CANADÁ combinado**, excluye motor y transmisión, y
 *   no es el método de valor de contenido regional del APC. Además solo cubre
 *   vehículos de hasta 8,500 lb de GVWR: F-250, RAM 3500, Silverado HD y
 *   Cybertruck están EXENTOS y no tienen porcentaje publicado.
 * - No conoce el año del vehículo. Varios modelos cambian de país según el año
 *   (Jeep Cherokee, Chevrolet Camaro, Lexus ES, RAM 1500). En esos casos la
 *   respuesta es siempre 6% + `requiresVin`.
 *
 * Datos verificados al 15/09/2026. Las filas marcadas "vigilar" cambian en
 * 2027 (ver VIGILAR_2027 al final del archivo).
 */

/** Origen del vehículo a efectos del ad valorem (0% APC vs 6%). */
export type { VehicleOrigin };

/**
 * Confianza en LA SUGERENCIA devuelta, no en el dato de planta.
 *
 *  alta  → la sugerencia se puede mostrar sin titubear.
 *  media → la sugerencia es la conservadora, pero el caso admite discusión
 *          (doble planta, cambio por año, ensamblaje US sin origen APC probado).
 *  baja  → no hubo coincidencia o el dato no está verificado: 6% por defecto.
 */
export type OriginConfidence = "alta" | "media" | "baja";

export type OriginInference = {
  /** Lo que la calculadora debe usar HOY para cotizar. */
  origin: VehicleOrigin;
  confidence: OriginConfidence;
  /** Frase lista para mostrar al usuario, en español. */
  reason: string;
  /** 0 o 0.06, leído de PRICING_CONFIG para no duplicar la tasa. */
  adValoremRate: number;
  /** País de ensamblaje final conocido ("Desconocido" si no hubo match). */
  assemblyCountry: string;
  /** Planta de ensamblaje, cuando es única y verificada. */
  plant: string | null;
  /** true si la tabla reconoció marca+modelo. */
  matched: boolean;
  /** El VIN es el único desempate posible para este modelo. */
  requiresVin: boolean;
  /**
   * Se ensambla en EE.UU. pero no podemos afirmar el origen APC. La UI debe
   * ofrecer: "puede bajar a 0% si el vendedor emite certificado de origen".
   */
  mayQualifyWithCertificate: boolean;
  /** Ids internos, útiles para tests y trazabilidad. */
  brandKey: BrandKey | null;
  ruleId: string;
};

/* ==========================================================================
 * 1. NORMALIZACIÓN
 * ========================================================================== */

/**
 * El usuario escribe el modelo a mano, así que hay que aceptar "X5", "x5 m",
 * "X5 M Competition", "F-150", "f150", "AMG G63", "G 63", "RAV4", "4Runner".
 *
 * Normalizamos a minúsculas sin acentos, reemplazamos cualquier separador por
 * espacio y SEPARAMOS letras de dígitos. Así "X5", "x5" y "X 5" colapsan al
 * mismo texto canónico "x 5", y los patrones se escriben una sola vez.
 */
function normalizeText(value: string): string {
  const cleaned = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const isDigit = (char: string) => char >= "0" && char <= "9";
  const isLetter = (char: string) => char >= "a" && char <= "z";

  let out = "";
  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    const prev = cleaned[i - 1];
    if (
      prev &&
      ((isLetter(prev) && isDigit(char)) || (isDigit(prev) && isLetter(char)))
    ) {
      out += " ";
    }
    out += char;
  }

  return out.replace(/\s+/g, " ").trim();
}

/* ==========================================================================
 * 2. MARCAS
 * ========================================================================== */

export type BrandKey =
  | "ford"
  | "chevrolet"
  | "cadillac"
  | "chrysler"
  | "dodge"
  | "ram"
  | "jeep"
  | "tesla"
  | "toyota"
  | "lexus"
  | "bmw"
  | "mercedes"
  | "audi"
  | "porsche"
  | "ferrari"
  | "lamborghini"
  | "aston-martin"
  | "bentley"
  | "mclaren"
  | "rolls-royce"
  | "land-rover";

/**
 * Alias de marca ya normalizados. Incluye las variantes que el usuario suele
 * escribir ("Mercedes-AMG", "Dodge SRT", "Range Rover", "RAM 3500" en el campo
 * de marca) y las que aparecen en el catálogo del sitio.
 */
const BRAND_ALIASES: readonly { key: BrandKey; aliases: readonly string[] }[] = [
  { key: "ford", aliases: ["ford"] },
  { key: "chevrolet", aliases: ["chevrolet", "chevy", "chev"] },
  { key: "cadillac", aliases: ["cadillac", "caddy"] },
  { key: "chrysler", aliases: ["chrysler"] },
  { key: "dodge", aliases: ["dodge", "dodge srt", "srt"] },
  { key: "ram", aliases: ["ram", "ram trucks", "dodge ram"] },
  { key: "jeep", aliases: ["jeep"] },
  { key: "tesla", aliases: ["tesla"] },
  { key: "toyota", aliases: ["toyota", "toyota gazoo racing", "gr"] },
  { key: "lexus", aliases: ["lexus"] },
  { key: "bmw", aliases: ["bmw", "bmw m"] },
  {
    key: "mercedes",
    aliases: [
      "mercedes",
      "mercedes benz",
      "mercedes amg",
      "amg",
      "mercedes maybach",
      "maybach",
      "benz",
    ],
  },
  { key: "audi", aliases: ["audi"] },
  { key: "porsche", aliases: ["porsche"] },
  { key: "ferrari", aliases: ["ferrari"] },
  { key: "lamborghini", aliases: ["lamborghini", "lambo"] },
  { key: "aston-martin", aliases: ["aston martin", "aston"] },
  { key: "bentley", aliases: ["bentley"] },
  { key: "mclaren", aliases: ["mclaren"] },
  { key: "rolls-royce", aliases: ["rolls royce", "rolls"] },
  {
    key: "land-rover",
    aliases: [
      "range rover",
      "land rover",
      "landrover",
      "jaguar land rover",
      "jlr",
      "defender",
    ],
  },
];

/** Resuelve la marca aceptando alias y, si hace falta, buscándola en el texto. */
function resolveBrand(brand: string, haystack: string): BrandKey | null {
  const normalizedBrand = normalizeText(brand);

  for (const entry of BRAND_ALIASES) {
    if (entry.aliases.includes(normalizedBrand)) return entry.key;
  }

  // El usuario puede haber escrito todo junto ("Ford Bronco Raptor") en el
  // campo de modelo, o la marca con sufijos ("Mercedes-Benz AMG").
  let best: { key: BrandKey; length: number } | null = null;
  for (const entry of BRAND_ALIASES) {
    for (const alias of entry.aliases) {
      const pattern = new RegExp(`\\b${alias}\\b`);
      if (
        (normalizedBrand && pattern.test(normalizedBrand)) ||
        pattern.test(haystack)
      ) {
        if (!best || alias.length > best.length) {
          best = { key: entry.key, length: alias.length };
        }
      }
    }
  }

  return best?.key ?? null;
}

/* ==========================================================================
 * 3. TABLA DE REGLAS
 * ========================================================================== */

type OriginRule = {
  /** Id estable para tests y logs. */
  id: string;
  /**
   * Patrones sobre el texto normalizado "marca modelo". GANA EL PRIMERO que
   * coincide, así que el ORDEN DE LA LISTA ES PARTE DE LA REGLA: las trampas
   * de nombre (Bronco Sport antes que Bronco, Mach-E antes que Mustang,
   * Wagoneer S antes que Wagoneer, Corolla Cross antes que Corolla, GLE Coupe
   * antes que GLE, EQS SUV antes que EQS) van siempre primero.
   */
  patterns: readonly RegExp[];
  country: string;
  plant: string | null;
  /** Veredicto de ensamblaje/origen ya corregido por los verificadores. */
  usOrigin: boolean;
  confidence: OriginConfidence;
  requiresVin?: boolean;
  mayQualifyWithCertificate?: boolean;
  reason: string;
};

/* --------------------------------------------------------------------------
 * FORD
 * ------------------------------------------------------------------------ */
const FORD_RULES: readonly OriginRule[] = [
  {
    // TRAMPA DE NOMBRE: el cliente pide "Bronco" mirando un Bronco Sport.
    // Son plataformas, plantas y países distintos.
    id: "ford-bronco-sport",
    patterns: [/\bbronco sport\b/],
    country: "México",
    plant: "Hermosillo Stamping and Assembly, Sonora",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Bronco Sport se ensambla en Hermosillo, México (no confundir con el Bronco/Bronco Raptor, que sí es de Michigan). Paga 6%.",
  },
  {
    id: "ford-bronco",
    patterns: [/\bbronco\b/],
    country: "Estados Unidos",
    plant: "Michigan Assembly Plant, Wayne, Michigan",
    usOrigin: true,
    confidence: "alta",
    reason:
      "Michigan Assembly (Wayne) es la única planta del mundo que produce el Bronco y el Bronco Raptor. Candidato sólido a 0% con certificado de origen.",
  },
  {
    // CORRECCIÓN DEL VERIFICADOR: Ohio Assembly (Avon Lake) NO hace el F-250;
    // solo chassis cab F-350/450/550. Las plantas del F-250 pickup son
    // Kentucky Truck Plant y, desde Q3 2026, Oakville (Ontario, Canadá).
    id: "ford-super-duty",
    patterns: [/\bf (250|350|450|550)\b/, /\bsuper duty\b/],
    country: "Estados Unidos o Canadá (verificar VIN)",
    plant: "Kentucky Truck Plant, Louisville KY · Oakville Assembly, Ontario",
    usOrigin: false,
    confidence: "media",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "TRAMPA NUEVA: la producción canadiense del Super Duty arrancó en Oakville, Ontario en Q3 2026 (hasta 100,000 unidades/año). Un F-250 MY2026-2027 comprado hoy puede ser canadiense. Cotizamos 6%; con el VIN (1 = EE.UU., 2 = Canadá) y certificado, una unidad MY2024 o anterior suele bajar a 0%.",
  },
  {
    id: "ford-f150",
    patterns: [/\bf 150\b/, /\blightning\b/],
    country: "Estados Unidos",
    plant:
      "Dearborn Truck, Michigan · Kansas City Assembly, Missouri · Rouge EV Center (Lightning)",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El 100% de los F-150 se arma en Michigan o Missouri, y el Lightning en el Rouge EV Center de Dearborn. Dos plantas, ambas en EE.UU.: el resultado arancelario no cambia.",
  },
  {
    // TRAMPA FUERTE: lleva el nombre del ícono americano y es 100% mexicano.
    id: "ford-mach-e",
    patterns: [/\bmach e\b/, /\bmache\b/],
    country: "México",
    plant: "Cuautitlán Assembly, Estado de México",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Mustang Mach-E se ensambla en Cuautitlán, México. Lleva el nombre Mustang pero no califica al APC: 6%.",
  },
  {
    id: "ford-mustang",
    patterns: [/\bmustang\b/, /\bdark horse\b/, /\bshelby\b/],
    country: "Estados Unidos",
    plant: "Flat Rock Assembly Plant, Michigan",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Mustang coupé/convertible (GT, Dark Horse, Shelby) sale de Flat Rock, Michigan. Ojo: esto NO aplica al Mach-E, que es mexicano.",
  },
  {
    id: "ford-maverick",
    patterns: [/\bmaverick\b/],
    country: "México",
    plant: "Hermosillo Stamping and Assembly, Sonora",
    usOrigin: false,
    confidence: "alta",
    reason:
      "La Maverick se ensambla en Hermosillo, México. Sin plan confirmado de mudanza a EE.UU. (la planta de Tennessee arranca recién en 2029): 6%.",
  },
  {
    id: "ford-explorer",
    patterns: [/\bexplorer\b/],
    country: "Estados Unidos",
    plant: "Chicago Assembly Plant, Illinois",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Explorer del mercado norteamericano sale de Chicago, Illinois. (El 'Explorer' eléctrico europeo es de Colonia, Alemania, y no llega desde Miami.)",
  },
  {
    id: "ford-expedition",
    patterns: [/\bexpedition\b/],
    country: "Estados Unidos",
    plant: "Kentucky Truck Plant, Louisville, Kentucky",
    usOrigin: true,
    confidence: "alta",
    reason:
      "La Expedition se ensambla en Kentucky Truck Plant, Louisville. Candidata a 0% con certificado de origen.",
  },
  {
    id: "ford-ranger",
    patterns: [/\branger\b/],
    country: "Estados Unidos",
    plant: "Michigan Assembly Plant, Wayne, Michigan",
    usOrigin: true,
    confidence: "alta",
    reason:
      "La Ranger de mercado estadounidense se arma en Wayne, Michigan, junto al Bronco. Es un modelo global (Tailandia, Sudáfrica, Argentina): solo vale si la unidad se compró en EE.UU.",
  },
  {
    id: "ford-escape",
    patterns: [/\bescape\b/],
    country: "Estados Unidos",
    plant: "Louisville Assembly Plant, Kentucky",
    usOrigin: true,
    confidence: "alta",
    reason:
      "Todas las unidades existentes del Escape salieron de Louisville, Kentucky. MODELO DESCONTINUADO: la producción terminó el 17/12/2025, así que solo hay stock residual y usados.",
  },
];

/* --------------------------------------------------------------------------
 * CHEVROLET
 * ------------------------------------------------------------------------ */
const CHEVROLET_RULES: readonly OriginRule[] = [
  {
    // El caso más limpio del catálogo.
    id: "chevrolet-corvette",
    patterns: [/\bcorvette\b/, /\bstingray\b/, /\bz 06\b/, /\be ray\b/, /\bzr 1\b/],
    country: "Estados Unidos",
    plant: "Bowling Green Assembly, Kentucky",
    usOrigin: true,
    confidence: "alta",
    reason:
      "Bowling Green, Kentucky es productor exclusivo mundial del Corvette desde 1981, de la Stingray al ZR1X (el V8 LT6 del Z06 también se arma a mano ahí). Es el caso más limpio para sustentar 0%.",
  },
  {
    // CORRECCIÓN DEL VERIFICADOR: la HD NO es solo Flint. Oshawa (Canadá)
    // construye justo las configuraciones que más se importan (Crew Cab caja
    // estándar, WT/Custom/LT/LTZ/High Country y el ZR2).
    id: "chevrolet-silverado-hd",
    patterns: [
      /\bsilverado\b.*\b(2500|3500|hd)\b/,
      /\b(2500|3500)\b.*\bsilverado\b/,
      /\bsilverado hd\b/,
    ],
    country: "Estados Unidos o Canadá (verificar VIN)",
    plant: "Flint Assembly, Michigan · Oshawa Assembly, Ontario",
    usOrigin: false,
    confidence: "alta",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "La Silverado HD se produce en paralelo en Flint (Michigan) y en Oshawa (Ontario, Canadá), y Oshawa hace justo la Crew Cab que más se importa. Un VIN que empieza en 2GC es canadiense y NO califica. Al superar 8,500 lb tampoco lleva etiqueta AALA: el VIN es la única verificación.",
  },
  {
    id: "chevrolet-silverado",
    patterns: [/\bsilverado\b/],
    country: "Estados Unidos, México o Canadá (verificar VIN)",
    plant:
      "Fort Wayne, Indiana · Silao, Guanajuato · Oshawa, Ontario",
    usOrigin: false,
    confidence: "alta",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "TRAMPA PRINCIPAL DE CHEVROLET: la Silverado 1500 se fabrica simultáneamente en tres países y la Crew Cab —la versión que más se importa— sale de las tres plantas. Imposible acertar por marca y modelo: 6% obligatorio sin VIN (1 = EE.UU., 2 = Canadá, 3 = México).",
  },
  {
    id: "chevrolet-tahoe",
    patterns: [/\btahoe\b/],
    country: "Estados Unidos",
    plant: "Arlington Assembly, Texas",
    usOrigin: true,
    confidence: "alta",
    reason:
      "Arlington, Texas es la planta exclusiva a nivel global de los SUV full-size de GM (Tahoe, Suburban, Escalade). Candidato a 0% con certificado.",
  },
  {
    id: "chevrolet-suburban",
    patterns: [/\bsuburban\b/],
    country: "Estados Unidos",
    plant: "Arlington Assembly, Texas",
    usOrigin: true,
    confidence: "alta",
    reason:
      "La Suburban se ensambla exclusivamente en Arlington, Texas. Candidata a 0% con certificado.",
  },
  {
    // CORRECCIÓN: NO hay reconversión de Wentzville. El MY2027 arranca en la
    // misma planta el 19/10/2026, tres días después de cerrar el MY2026.
    id: "chevrolet-colorado",
    patterns: [/\bcolorado\b/],
    country: "Estados Unidos",
    plant: "Wentzville Assembly, Missouri",
    usOrigin: true,
    confidence: "alta",
    reason:
      "La Colorado se arma en Wentzville, Missouri, sin interrupción: el MY2026 cierra el 16/10/2026 y el MY2027 arranca el 19/10/2026 en la misma planta.",
  },
  {
    id: "chevrolet-traverse",
    patterns: [/\btraverse\b/],
    country: "Estados Unidos",
    plant: "Lansing Delta Township Assembly, Michigan",
    usOrigin: true,
    confidence: "alta",
    reason:
      "La Traverse MY2026 se produce en Lansing Delta Township, Michigan.",
  },
  {
    // TRAMPA EXTREMA: marca americana, ensamblaje coreano. Va antes que
    // "blazer" para que "Trailblazer" no caiga en otra regla.
    id: "chevrolet-trailblazer",
    patterns: [/\btrailblazer\b/, /\btrail blazer\b/],
    country: "Corea del Sur",
    plant: "GM Korea, Bupyeong (Incheon)",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Trailblazer se fabrica en Bupyeong, Corea del Sur. Marca americana, ensamblaje coreano: 6%.",
  },
  {
    id: "chevrolet-trax",
    patterns: [/\btrax\b/],
    country: "Corea del Sur",
    plant: "GM Changwon",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Trax se fabrica en Changwon, Corea del Sur, para exportación a Norteamérica. Ni siquiera está en Norteamérica: 6% sin discusión.",
  },
  {
    id: "chevrolet-equinox-ev",
    patterns: [/\bequinox ev\b/],
    country: "México",
    plant: "Ramos Arizpe Assembly, Coahuila",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Equinox EV se ensambla en Ramos Arizpe, México. OJO con el titular engañoso: GM subió el contenido de piezas US/Canadá del MY2026, pero más contenido estadounidense NO convierte el vehículo en originario de EE.UU.",
  },
  {
    // VIGILAR 2027: GM mueve el Equinox a gasolina a Fairfax (Kansas) a
    // mediados de 2027. Desde el MY2027 convivirán Equinox mexicano y
    // estadounidense con el mismo nombre → habrá que pedir VIN.
    id: "chevrolet-equinox",
    patterns: [/\bequinox\b/],
    country: "México",
    plant: "San Luis Potosí Assembly",
    usOrigin: false,
    confidence: "alta",
    requiresVin: true,
    reason:
      "El Equinox a gasolina se ensambla en San Luis Potosí, México: 6%. A partir del MY2027 GM lo agrega a Fairfax (Kansas), así que desde ese año convivirán unidades mexicanas y estadounidenses con el mismo nombre y hará falta el VIN (3 = México, 1/4/5 = EE.UU.).",
  },
  {
    // VIGILAR 2027: el Blazer a gasolina se muda a Spring Hill (Tennessee).
    id: "chevrolet-blazer",
    patterns: [/\bblazer\b/],
    country: "México",
    plant: "Ramos Arizpe Assembly, Coahuila",
    usOrigin: false,
    confidence: "alta",
    requiresVin: true,
    reason:
      "TRAMPA: nombre clásico americano, versión moderna 100% mexicana (Ramos Arizpe). Hoy 6%. GM anunció el traslado del Blazer a gasolina a Spring Hill, Tennessee en 2027: desde el MY2027 pedir VIN.",
  },
  {
    // El mismo nombre cambia de país según la generación.
    id: "chevrolet-camaro",
    patterns: [/\bcamaro\b/],
    country: "Estados Unidos o Canadá (según generación)",
    plant: "Lansing Grand River, Michigan · Oshawa, Ontario (2010-2015)",
    usOrigin: false,
    confidence: "media",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "El Camaro cambia de país según la generación: la sexta (2016-2024) es de Lansing, Michigan, pero la quinta (2010-2015) se hizo en Oshawa, CANADÁ. Producción terminada en 2024, así que solo hay usados: 6% hasta verificar el VIN (1 = EE.UU., 2 = Canadá).",
  },
];

/* --------------------------------------------------------------------------
 * CADILLAC
 * ------------------------------------------------------------------------ */
const CADILLAC_RULES: readonly OriginRule[] = [
  {
    id: "cadillac-escalade-iq",
    patterns: [/\bescalade iq/],
    country: "Estados Unidos",
    plant: "Factory ZERO, Detroit-Hamtramck, Michigan",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Escalade IQ/IQL se produce en Factory ZERO, Detroit-Hamtramck. Candidato a 0% con certificado.",
  },
  {
    id: "cadillac-escalade",
    patterns: [/\bescalade\b/],
    country: "Estados Unidos",
    plant: "Arlington Assembly, Texas",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Escalade y el Escalade ESV (incluido el V-Series) salen de Arlington, Texas, planta exclusiva a nivel global. Candidato a 0% con certificado. (En 2027 GM muda el Escalade a gasolina a Orion, Michigan: sigue siendo EE.UU.)",
  },
  {
    id: "cadillac-ct",
    patterns: [/\bct [45]\b/, /\bblackwing\b/],
    country: "Estados Unidos",
    plant: "Lansing Grand River Assembly, Michigan",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El CT4 y el CT5 (incluidos los Blackwing) se producen en Lansing Grand River, Michigan.",
  },
  {
    id: "cadillac-xt5-xt6",
    patterns: [/\bxt [56]\b/],
    country: "Estados Unidos",
    plant: "Spring Hill Manufacturing, Tennessee",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El XT5 y el XT6 se ensamblan en Spring Hill, Tennessee, junto al Lyriq y el Vistiq.",
  },
  {
    id: "cadillac-lyriq",
    patterns: [/\blyriq\b/],
    country: "Estados Unidos",
    plant: "Spring Hill Manufacturing, Tennessee",
    usOrigin: true,
    confidence: "alta",
    reason: "El Lyriq se ensambla en Spring Hill, Tennessee.",
  },
  {
    id: "cadillac-vistiq",
    patterns: [/\bvistiq\b/],
    country: "Estados Unidos",
    plant: "Spring Hill Manufacturing, Tennessee",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Vistiq 2026 se produce en Spring Hill, Tennessee, junto al Lyriq.",
  },
  {
    // TRAMPA: es el único Cadillac mexicano de la gama actual.
    id: "cadillac-optiq",
    patterns: [/\boptiq\b/],
    country: "México",
    plant: "Ramos Arizpe Assembly, Coahuila",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Optiq se ensambla en Ramos Arizpe, México, y sigue ahí para el MY2027. Es el único Cadillac mexicano de la gama: el cliente que asume que todo Cadillac es 0% se equivoca justo aquí.",
  },
  {
    // Ensamblaje estadounidense pero sin verificación primaria → el doble
    // candado lo deja en 6%.
    id: "cadillac-xt4",
    patterns: [/\bxt 4\b/],
    country: "Estados Unidos",
    plant: "Fairfax Assembly, Kansas",
    usOrigin: true,
    confidence: "media",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "El XT4 se armó en Fairfax, Kansas, pero la producción terminó en enero de 2025 y el dato no está confirmado contra comunicado primario. Cotizamos 6%; con VIN y certificado de origen puede bajar a 0%.",
  },
  {
    id: "cadillac-celestiq",
    patterns: [/\bcelestiq\b/],
    country: "Estados Unidos",
    plant: "Global Technical Center, Warren, Michigan",
    usOrigin: true,
    confidence: "media",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "El Celestiq se construye a mano en el GM Global Technical Center de Warren, Michigan, pero es producción artesanal de muy bajo volumen y no está verificada contra comunicado primario. Cotizamos 6%; con certificado puede bajar a 0%.",
  },
];

/* --------------------------------------------------------------------------
 * CHRYSLER — LA TRAMPA MÁS GRANDE DEL CATÁLOGO
 * La marca entera es canadiense. No existe hoy un Chrysler que califique al 0%.
 * ------------------------------------------------------------------------ */
const CHRYSLER_RULES: readonly OriginRule[] = [];

/* --------------------------------------------------------------------------
 * DODGE / DODGE SRT — casi todo canadiense
 * ------------------------------------------------------------------------ */
const DODGE_RULES: readonly OriginRule[] = [
  {
    id: "dodge-durango",
    patterns: [/\bdurango\b/],
    country: "Estados Unidos",
    plant: "Detroit Assembly Complex – Jefferson North, Michigan",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Durango (incluido el SRT Hellcat) se ensambla en Detroit, Michigan. Es prácticamente el ÚNICO Dodge vivo de ensamblaje estadounidense.",
  },
  {
    id: "dodge-charger",
    patterns: [/\bcharger\b/, /\bdaytona\b/, /\bsixpack\b/, /\bsix pack\b/],
    country: "Canadá",
    plant: "Windsor Assembly (2024+) · Brampton Assembly (2006-2023)",
    usOrigin: false,
    confidence: "alta",
    reason:
      "TRAMPA GRANDE: el Charger nuevo (Daytona EV y Sixpack a gasolina) se hace en Windsor, Ontario, y el Charger/SRT Hellcat 2006-2023 se hizo en Brampton, Ontario. El muscle car americano es canadiense: 6%.",
  },
  {
    id: "dodge-challenger",
    patterns: [/\bchallenger\b/, /\bdemon\b/],
    country: "Canadá",
    plant: "Brampton Assembly Plant, Ontario",
    usOrigin: false,
    confidence: "alta",
    reason:
      "TRAMPA EMBLEMÁTICA: el Challenger (incluidos SRT Hellcat y Demon 170) se ensambló íntegramente en Brampton, Ontario. Las placas conmemorativas 'Last Call' bajo el capó dicen literalmente 'Assembled in Brampton'. Ningún Challenger moderno califica al 0%.",
  },
  {
    id: "dodge-hornet",
    patterns: [/\bhornet\b/],
    country: "Italia",
    plant: "Pomigliano d'Arco, Nápoles",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Hornet es un Alfa Romeo Tonale rebautizado, ensamblado en Pomigliano d'Arco, Italia: 6%.",
  },
];

/* --------------------------------------------------------------------------
 * RAM
 * ------------------------------------------------------------------------ */
const RAM_RULES: readonly OriginRule[] = [
  {
    // MODELO QUE YA ESTÁ EN EL SITIO Y NO CALIFICA.
    id: "ram-heavy-duty",
    patterns: [/\b(2500|3500|4500|5500)\b/, /\bheavy duty\b/, /\bhd\b/],
    country: "México",
    plant: "Saltillo Truck Assembly Plant, Coahuila",
    usOrigin: false,
    confidence: "alta",
    reason:
      "TRAMPA MAYOR: toda la gama Heavy Duty de RAM (2500, 3500, 4500, 5500) se ensambla en Saltillo, México, desde 1995. No existe versión estadounidense del 3500. Además supera 8,500 lb y no lleva etiqueta AALA, así que ni siquiera se puede verificar en la ventanilla del concesionario: 6% siempre.",
  },
  {
    id: "ram-promaster",
    patterns: [/\bpromaster\b/, /\bpro master\b/],
    country: "México",
    plant: "Saltillo Van Assembly, Coahuila",
    usOrigin: false,
    confidence: "media",
    reason:
      "La ProMaster se ensambla en Saltillo, México. No verificado contra comunicado primario, pero en ningún escenario es estadounidense: 6%.",
  },
  {
    // OJO CON LA CONFUSIÓN 1500 vs 3500: un dígito cambia el país.
    id: "ram-1500",
    patterns: [/\b1500\b/],
    country: "Estados Unidos (DT) o México (Classic)",
    plant: "Sterling Heights Assembly, Michigan · Saltillo (Classic)",
    usOrigin: true,
    confidence: "media",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "La RAM 1500 de generación DT (2019+) se arma en Sterling Heights, Michigan, pero la 1500 Classic se vendió en paralelo hasta 2024 y se hizo también en Saltillo, MÉXICO. Cotizamos 6% hasta ver el VIN (1C6 = EE.UU., 3C6 = México); confirmado el DT y con certificado de origen, baja a 0%.",
  },
];

/* --------------------------------------------------------------------------
 * JEEP
 * ------------------------------------------------------------------------ */
const JEEP_RULES: readonly OriginRule[] = [
  {
    id: "jeep-wrangler",
    patterns: [/\bwrangler\b/, /\brubicon\b/],
    country: "Estados Unidos",
    plant: "Toledo Assembly Complex, Ohio",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Wrangler (incluidos 4xe y Rubicon 392) se construye en Toledo, Ohio. Candidato sólido a 0% con certificado de origen.",
  },
  {
    id: "jeep-gladiator",
    patterns: [/\bgladiator\b/],
    country: "Estados Unidos",
    plant: "Toledo Assembly Complex, Ohio",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Gladiator se construye en Toledo, Ohio, junto al Wrangler. Candidato sólido a 0% con certificado de origen.",
  },
  {
    id: "jeep-grand-cherokee",
    patterns: [/\bgrand cherokee\b/],
    country: "Estados Unidos",
    plant: "Detroit Assembly Complex – Mack, Michigan",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Grand Cherokee y el Grand Cherokee L se producen en Detroit, Michigan (la generación WK2 anterior también fue de Detroit, así que el origen se mantiene en usados recientes).",
  },
  {
    // UNA SOLA LETRA cambia el arancel: Wagoneer S ≠ Wagoneer.
    id: "jeep-wagoneer-s",
    patterns: [/\bwagoneer s\b/],
    country: "México",
    plant: "Toluca Car Assembly, Estado de México",
    usOrigin: false,
    confidence: "media",
    reason:
      "El Wagoneer S (eléctrico) se ensambla en Toluca, MÉXICO. Fácil de confundir con el Wagoneer/Grand Wagoneer de Warren, Michigan, que sí es estadounidense: una letra cambia el arancel. 6%.",
  },
  {
    id: "jeep-wagoneer",
    patterns: [/\bwagoneer\b/],
    country: "Estados Unidos",
    plant: "Warren Truck Assembly Plant, Michigan",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Wagoneer y el Grand Wagoneer se ensamblan en Warren Truck, Michigan. NO confundir con el Wagoneer S, que es mexicano.",
  },
  {
    id: "jeep-compass",
    patterns: [/\bcompass\b/],
    country: "México",
    plant: "Toluca Car Assembly, Estado de México",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Compass se ensambla hoy en Toluca, México: 6%. Stellantis reabrirá Belvidere (Illinois) para el Compass recién con lanzamiento en 2027, así que todo lo que está hoy en el mercado es mexicano.",
  },
  {
    // TRAMPA HISTÓRICA: mismo nombre, arancel opuesto según el año.
    id: "jeep-cherokee",
    patterns: [/\bcherokee\b/],
    country: "México (KM, MY2026) o Estados Unidos (KL, 2014-2023)",
    plant: "Toluca Car Assembly · Belvidere, Illinois (generación KL)",
    usOrigin: false,
    confidence: "alta",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "TRAMPA HISTÓRICA: el Cherokee KL (2014-2023) se fabricaba en Belvidere, ILLINOIS, pero la generación nueva KM (MY2026) es de Toluca, MÉXICO. Mismo nombre, arancel opuesto según el año: 6% hasta verificar año y VIN (1 = EE.UU., 3 = México).",
  },
  {
    id: "jeep-recon",
    patterns: [/\brecon\b/],
    country: "México",
    plant: "Toluca Car Assembly, Estado de México",
    usOrigin: false,
    confidence: "media",
    reason: "El Recon se ensambla en Toluca, México: 6%.",
  },
  {
    id: "jeep-renegade",
    patterns: [/\brenegade\b/],
    country: "Italia",
    plant: "Melfi, Basilicata",
    usOrigin: false,
    confidence: "media",
    reason:
      "El Renegade para Norteamérica se produce en Melfi, Italia: 6%.",
  },
];

/* --------------------------------------------------------------------------
 * TESLA — toda la gama vendida en EE.UU. es de Fremont o Austin.
 * El riesgo no es la planta, es que la unidad venga de Shanghái o Berlín.
 * ------------------------------------------------------------------------ */
const TESLA_RULES: readonly OriginRule[] = [
  {
    id: "tesla-cybertruck",
    patterns: [/\bcybertruck\b/, /\bcyber truck\b/],
    country: "Estados Unidos",
    plant: "Gigafactory Texas, Austin, Texas",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Cybertruck se produce únicamente en Giga Texas, Austin. Supera 8,500 lb de GVWR, así que está EXENTO de la etiqueta AALA y no existe porcentaje oficial que mostrar: el sustento es el punto de ensamblaje final más el certificado de origen del APC.",
  },
  {
    id: "tesla-model-x",
    patterns: [/\bmodel x\b/],
    country: "Estados Unidos",
    plant: "Tesla Factory, Fremont, California",
    usOrigin: true,
    confidence: "alta",
    reason:
      "Absolutamente todas las unidades del Model X salieron de Fremont, California. La producción terminó en mayo de 2026, así que solo hay stock y usados, pero el origen estadounidense no cambia.",
  },
  {
    id: "tesla-model-s",
    patterns: [/\bmodel s\b/],
    country: "Estados Unidos",
    plant: "Tesla Factory, Fremont, California",
    usOrigin: true,
    confidence: "alta",
    reason:
      "Todas las unidades históricas del Model S son de Fremont, California. Producción finalizada en Q2 2026: solo stock y usados.",
  },
  {
    id: "tesla-model-3",
    patterns: [/\bmodel 3\b/],
    country: "Estados Unidos",
    plant: "Tesla Factory, Fremont, California",
    usOrigin: true,
    confidence: "alta",
    requiresVin: true,
    reason:
      "El Model 3 del mercado norteamericano es de Fremont, California (n.º 1 del American-Made Index 2026). Tesla también lo fabrica en Shanghái para otros mercados: confirmar que el VIN empiece en 5YJ o 7SA antes de cerrar el 0%.",
  },
  {
    id: "tesla-model-y",
    patterns: [/\bmodel y\b/],
    country: "Estados Unidos",
    plant: "Tesla Factory, Fremont, California · Gigafactory Texas, Austin",
    usOrigin: true,
    confidence: "alta",
    requiresVin: true,
    reason:
      "El Model Y del mercado estadounidense sale de Fremont o Austin, ambas en EE.UU. Pero también se fabrica en Shanghái y Berlín: confirmar que el VIN empiece en 5YJ o 7SA (LRW = China, XP7 = Alemania).",
  },
];

/* --------------------------------------------------------------------------
 * TOYOTA
 * Lista blanca verificada de 0%: Tundra, Sequoia, Camry, Grand Highlander,
 * Highlander, Sienna y Corolla Cross. Todo lo demás, 6%.
 * ------------------------------------------------------------------------ */
const TOYOTA_RULES: readonly OriginRule[] = [
  {
    id: "toyota-tundra",
    patterns: [/\btundra\b/],
    country: "Estados Unidos",
    plant: "Toyota Motor Manufacturing Texas, San Antonio",
    usOrigin: true,
    confidence: "alta",
    reason:
      "La Tundra se ensambla exclusivamente en San Antonio, Texas, sin planta alternativa. Es de los pocos Toyota donde la sugerencia de 0% es sólida (sujeta a certificado de origen).",
  },
  {
    id: "toyota-sequoia",
    patterns: [/\bsequoia\b/],
    country: "Estados Unidos",
    plant: "Toyota Motor Manufacturing Texas, San Antonio",
    usOrigin: true,
    confidence: "alta",
    reason:
      "La Sequoia comparte línea con la Tundra en San Antonio, Texas. No hay planta alternativa para la generación actual.",
  },
  {
    id: "toyota-camry",
    patterns: [/\bcamry\b/],
    country: "Estados Unidos",
    plant: "Toyota Motor Manufacturing Kentucky, Georgetown",
    usOrigin: true,
    confidence: "alta",
    requiresVin: true,
    reason:
      "El Camry del mercado estadounidense (XV80, 100% híbrido) sale de Georgetown, Kentucky, con sus motores. Toyota también lo fabrica en Japón para otros mercados: el VIN lo confirma (4T/5T = EE.UU., JT = Japón).",
  },
  {
    id: "toyota-grand-highlander",
    patterns: [/\bgrand highlander\b/],
    country: "Estados Unidos",
    plant: "Toyota Motor Manufacturing Indiana, Princeton",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Grand Highlander se ensambla exclusivamente en Princeton, Indiana (puestos 40 y 46 del American-Made Index 2026).",
  },
  {
    // CORRECCIÓN: confianza sube de media a alta; y el futuro Highlander EV
    // es de Georgetown, Kentucky, o sea TAMBIÉN estadounidense (producción no
    // antes de enero de 2027).
    id: "toyota-highlander",
    patterns: [/\bhighlander\b/],
    country: "Estados Unidos",
    plant: "Toyota Motor Manufacturing Indiana, Princeton",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Highlander y el Highlander Hybrid del mercado estadounidense se arman en Princeton, Indiana (puestos 41 y 53 del American-Made Index 2026). El futuro Highlander EV también será estadounidense, de Georgetown, Kentucky.",
  },
  {
    id: "toyota-sienna",
    patterns: [/\bsienna\b/],
    country: "Estados Unidos",
    plant: "Toyota Motor Manufacturing Indiana, Princeton",
    usOrigin: true,
    confidence: "alta",
    reason:
      "La Sienna Hybrid de mercado estadounidense es exclusivamente de Princeton, Indiana.",
  },
  {
    // ENTRADA AÑADIDA POR EL VERIFICADOR: es el único error del estudio que
    // costaba VENTAS en vez de plata (sugerir 6% a un auto que califica).
    id: "toyota-corolla-cross",
    patterns: [/\bcorolla cross\b/],
    country: "Estados Unidos",
    plant: "Mazda Toyota Manufacturing USA, Huntsville/Madison, Alabama",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El Corolla Cross (y el Corolla Cross Hybrid) se ensambla en Huntsville, Alabama, única planta de Norteamérica que lo produce. No existe versión de mercado estadounidense con otro origen: candidato a 0%. Su VIN empieza en 7MU.",
  },
  {
    id: "toyota-gr-corolla",
    patterns: [/\bgr corolla\b/],
    country: "Japón",
    plant: "Motomachi, Aichi",
    usOrigin: false,
    confidence: "media",
    reason:
      "El GR Corolla se fabrica en Motomachi, Japón: 6%. (No confundir con el Corolla Cross, que sí es de Alabama.)",
  },
  {
    id: "toyota-corolla",
    patterns: [/\bcorolla\b/],
    country: "Estados Unidos o Japón (verificar VIN)",
    plant: "Blue Springs, Mississippi · plantas japonesas",
    usOrigin: false,
    confidence: "media",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "El Corolla sedán figura en el American-Made Index como ensamblado en 'Blue Springs, Miss., or Aichi, Japan', y el hatchback y las variantes GR son japoneses. 6% hasta verificar el VIN (5Y = Mississippi, JT = Japón).",
  },
  {
    // TRAMPA MÁS CARA DEL GRUPO: está en el catálogo del sitio.
    id: "toyota-tacoma",
    patterns: [/\btacoma\b/],
    country: "México",
    plant:
      "Toyota Baja California (Tijuana) · Toyota Guanajuato (Apaseo el Grande)",
    usOrigin: false,
    confidence: "alta",
    reason:
      "TRAMPA MAYOR: la Tacoma se ensambla en México (Tijuana y Guanajuato), no en EE.UU. El anuncio de USD 3.6B para San Antonio mueve producción recién hacia 2030. Toda unidad comprada hoy en Miami es mexicana: 6%.",
  },
  {
    id: "toyota-4runner",
    patterns: [/\b4 runner\b/, /\bfour runner\b/],
    country: "Japón",
    plant: "Tahara, Aichi",
    usOrigin: false,
    confidence: "alta",
    reason:
      "TRAMPA: el 4Runner es un ícono del mercado estadounidense pero nunca se ha ensamblado en EE.UU. La sexta generación (2025-2026) es de Tahara, Japón: 6%.",
  },
  {
    // TRAMPA DOBLE: ni japonés ni estadounidense. Está en el sitio.
    id: "toyota-supra",
    patterns: [/\bsupra\b/],
    country: "Austria",
    plant: "Magna Steyr, Graz",
    usOrigin: false,
    confidence: "alta",
    reason:
      "TRAMPA DOBLE: el GR Supra no es japonés ni estadounidense. Lo fabrica Magna Steyr en Graz, AUSTRIA, sobre plataforma BMW compartida con el Z4 (producción marzo 2019 – marzo 2026). No califica al APC: 6%.",
  },
  {
    id: "toyota-land-cruiser",
    patterns: [/\bland cruiser\b/, /\blandcruiser\b/],
    country: "Japón",
    plant: "Tahara / Yoshiwara, Aichi",
    usOrigin: false,
    confidence: "media",
    reason:
      "El Land Cruiser se ensambla en Japón, igual que el 4Runner y el Lexus GX con los que comparte plataforma: 6%.",
  },
  {
    // CORRECCIÓN: la confianza en la recomendación de 6% sube a ALTA. La
    // coexistencia EE.UU. + Canadá + Japón está confirmada contra fuente
    // primaria, y eso REFUERZA el 6% por defecto.
    id: "toyota-rav4",
    patterns: [/\brav 4\b/],
    country: "Estados Unidos, Canadá o Japón (verificar VIN)",
    plant:
      "Georgetown, Kentucky · Cambridge y Woodstock, Ontario · plantas japonesas",
    usOrigin: false,
    confidence: "alta",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "NO sugerir 0%: el RAV4 se arma en al menos tres países y buena parte del volumen norteamericano es CANADIENSE (Ontario). Canadá no da origen estadounidense bajo el APC aunque el AALA sume ambos países en un solo porcentaje. 6% hasta ver el VIN (2T = Canadá, 4T/5T = EE.UU., JT = Japón).",
  },
  {
    id: "toyota-gr86",
    patterns: [/\bgr 86\b/, /\bgt 86\b/],
    country: "Japón",
    plant: "Planta de Subaru en Gunma",
    usOrigin: false,
    confidence: "media",
    reason: "El GR86 se fabrica en Gunma, Japón: 6%.",
  },
];

/* --------------------------------------------------------------------------
 * LEXUS — regla de marca: todo 6% salvo el TX.
 * ------------------------------------------------------------------------ */
const LEXUS_RULES: readonly OriginRule[] = [
  {
    id: "lexus-tx",
    patterns: [/\btx\b/],
    country: "Estados Unidos",
    plant: "Toyota Motor Manufacturing Indiana, Princeton",
    usOrigin: true,
    confidence: "alta",
    reason:
      "El TX (350, 500h y 550h+) es el ÚNICO Lexus ensamblado en EE.UU.: Princeton, Indiana, desde noviembre de 2023. El puesto 7 del American-Made Index 2026 corresponde específicamente al TX 350 (el 500h está en el 50), así que no lo cites como si cubriera toda la gama.",
  },
  {
    // TRAMPA CRÍTICA POR AÑO: fue el único Lexus hecho en EE.UU. hasta 2025.
    id: "lexus-es",
    patterns: [/\bes\b/],
    country: "Japón (MY2026+) o Estados Unidos (2016-2025)",
    plant: "Toyota Motor Kyushu · Georgetown, Kentucky (hasta 2025)",
    usOrigin: false,
    confidence: "alta",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "TRAMPA POR AÑO: el ES fue el único Lexus fabricado en EE.UU. (Georgetown, Kentucky, 2015-2025), pero Toyota devolvió la producción a Kyushu, JAPÓN: un ES 2026 es japonés. 6% hasta verificar el VIN (4T/5T = EE.UU., JT = Japón).",
  },
  {
    id: "lexus-rx-nx",
    patterns: [/\brx\b/, /\bnx\b/],
    country: "Canadá o Japón",
    plant: "Toyota Motor Manufacturing Canada, Cambridge (Ontario) · Kyushu",
    usOrigin: false,
    confidence: "alta",
    reason:
      "TRAMPA DE CONTENIDO REGIONAL: el RX y el NX se arman en Cambridge (Ontario, CANADÁ) o en Japón, nunca en EE.UU. El porcentaje alto del Monroney es contenido EE.UU.+Canadá COMBINADO, pero el APC exige origen estadounidense: 6%.",
  },
  {
    id: "lexus-japon",
    patterns: [/\bgx\b/, /\blx\b/, /\bis\b/, /\bls\b/, /\blc\b/, /\brc\b/, /\bux\b/],
    country: "Japón",
    plant: "Tahara, Motomachi y Kyushu",
    usOrigin: false,
    confidence: "media",
    reason:
      "Ensamblaje japonés (Tahara, Motomachi o Kyushu): 6%. El único Lexus estadounidense es el TX.",
  },
];

/* --------------------------------------------------------------------------
 * BMW — LA TRAMPA INVERSA MÁS DELICADA
 *
 * Spartanburg (Carolina del Sur) ensambla X3, X4, X5, X6, X7 y XM, y para
 * X5/X6/X7/XM es fuente única mundial. PERO los verificadores corrigieron
 * todos esos veredictos a "no originario": el contenido AALA publicado es
 * 9% (X3), 21% (X7), 26% (XM), 32% (X5/X6), con motor austriaco y transmisión
 * alemana. Ensamblar en EE.UU. NO es cumplir la regla de origen del APC.
 * Se cotiza 6% y se avisa que puede bajar a 0% si el vendedor emite el
 * certificado de origen.
 * ------------------------------------------------------------------------ */
const BMW_RULES: readonly OriginRule[] = [
  {
    id: "bmw-ix5",
    patterns: [/\bix 5\b/],
    country: "Estados Unidos (previsto)",
    plant: "BMW Plant Spartanburg, Carolina del Sur",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El iX5 AÚN NO EXISTE: BMW confirmó inicio de producción a finales de 2026. No debería ofrecerse en la calculadora todavía.",
  },
  {
    id: "bmw-x5",
    patterns: [/\bx 5\b/],
    country: "Estados Unidos",
    plant: "BMW Plant Spartanburg, Carolina del Sur",
    usOrigin: false,
    confidence: "media",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "El X5 se ensambla en Spartanburg (fuente única mundial), pero el contenido AALA publicado es 32-35% US/Canadá, justo en el filo del 35% y medido con un método distinto al del APC (excluye motor y transmisión, que no son estadounidenses). Cotizamos 6%; puede bajar a 0% solo con certificado de origen del vendedor.",
  },
  {
    id: "bmw-x6",
    patterns: [/\bx 6\b/],
    country: "Estados Unidos",
    plant: "BMW Plant Spartanburg, Carolina del Sur",
    usOrigin: false,
    confidence: "media",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "El X6 se ensambla en Spartanburg (fuente única mundial), pero su contenido AALA es 32% US/Canadá, por debajo del 35% exigido. Cotizamos 6%; puede bajar a 0% solo con certificado de origen.",
  },
  {
    id: "bmw-x7",
    patterns: [/\bx 7\b/],
    country: "Estados Unidos",
    plant: "BMW Plant Spartanburg, Carolina del Sur",
    usOrigin: false,
    confidence: "alta",
    mayQualifyWithCertificate: true,
    reason:
      "El X7 se ensambla en Spartanburg, pero con 21% de contenido US/Canadá es muy improbable que alcance el 35% de contenido regional que exige el APC: 6%.",
  },
  {
    id: "bmw-xm",
    patterns: [/\bxm\b/],
    country: "Estados Unidos",
    plant: "BMW Plant Spartanburg, Carolina del Sur",
    usOrigin: false,
    confidence: "media",
    mayQualifyWithCertificate: true,
    reason:
      "El XM (y XM Label Red) se ensambla en Spartanburg —no en Dingolfing, como suele agruparse—, pero su contenido AALA es 26% US/Canadá. Cotizamos 6%; puede bajar a 0% solo con certificado de origen.",
  },
  {
    id: "bmw-x3",
    patterns: [/\bx 3\b/],
    country: "Estados Unidos o Sudáfrica (verificar VIN)",
    plant: "BMW Plant Spartanburg · BMW Plant Rosslyn, Sudáfrica",
    usOrigin: false,
    confidence: "alta",
    requiresVin: true,
    reason:
      "El X3 G45 tiene doble planta (Spartanburg y Rosslyn, Sudáfrica) y su contenido US/Canadá publicado es solo 9%, con motor austriaco y transmisión alemana. Es el peor candidato del grupo a cumplir el 35% del APC: 6%.",
  },
  {
    id: "bmw-x4",
    patterns: [/\bx 4\b/],
    country: "Estados Unidos",
    plant: "BMW Plant Spartanburg, Carolina del Sur",
    usOrigin: false,
    confidence: "alta",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "El X4 se ensamblaba en Spartanburg, pero la producción terminó en noviembre de 2025: solo hay usados. Su sucesor eléctrico iX4 se fabricará en Hungría, no en EE.UU. 6%.",
  },
  {
    id: "bmw-x1-x2",
    patterns: [/\bx [12]\b/, /\bix [12]\b/],
    country: "Alemania",
    plant: "Regensburg / Leipzig",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El X1, X2, iX1 e iX2 son los únicos BMW X que NO son de Spartanburg: se hacen en Alemania. La regla 'todos los X son americanos' es falsa. 6%.",
  },
  {
    id: "bmw-serie-2",
    patterns: [/\b(serie|series) 2\b/, /\b2 series\b/, /\bm 2\b/],
    country: "México",
    plant: "BMW Plant San Luis Potosí",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Serie 2 Coupé y el M2 se fabrican exclusivamente en San Luis Potosí, MÉXICO, para el mercado mundial. Comprado en Miami, ensamblado en México: 6%.",
  },
  {
    id: "bmw-serie-3",
    patterns: [/\b(serie|series) 3\b/, /\b3 series\b/, /\bm 340\b/, /\b3 (20|30|40)\b/],
    country: "Alemania o México",
    plant: "Múnich · BMW Plant San Luis Potosí",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Serie 3 se produce en Múnich (Alemania) y en San Luis Potosí (México) según versión y año. Ninguna es EE.UU.: 6% en ambos casos.",
  },
  {
    id: "bmw-alemania",
    patterns: [
      /\bm [3458]\b/,
      /\b(serie|series) [4578]\b/,
      /\b[4578] series\b/,
      /\bi [4578]\b/,
      /\bix\b/,
      /\bz 4\b/,
    ],
    country: "Alemania (Z4: Austria)",
    plant: "Múnich · Dingolfing · Magna Steyr Graz (Z4)",
    usOrigin: false,
    confidence: "alta",
    reason:
      "Ensamblaje europeo: los Serie 4/5/7/8, M3/M4/M5/M8, i4/i5/i7 e iX se hacen en Alemania, y el Z4 en Magna Steyr (Graz, Austria) junto al Toyota Supra. 6%.",
  },
];

/* --------------------------------------------------------------------------
 * MERCEDES-BENZ
 *
 * MBUSI (Tuscaloosa, Alabama) es fuente única mundial de GLE, GLE Coupé, GLS,
 * Maybach GLS, EQE SUV y EQS SUV. Pero el contenido AALA publicado de TODAS
 * las carlines de MBUSI es 10% US/Canadá, así que los verificadores flipearon
 * el veredicto: se cotiza 6% y se avisa que puede bajar con certificado.
 * ------------------------------------------------------------------------ */
const MERCEDES_RULES: readonly OriginRule[] = [
  {
    // CONTRA-TRAMPA #1 y modelo ya publicado en el sitio: el G63 NO es americano.
    id: "mercedes-clase-g",
    patterns: [
      /\bg 63\b/,
      /\bg 65\b/,
      /\bg (500|550|580)\b/,
      /\bclase g\b/,
      /\bg class\b/,
      /\bg wagon\b/,
      /\bgelandewagen\b/,
    ],
    country: "Austria",
    plant: "Magna Steyr, Graz",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Mercedes-AMG G63 y toda la Clase G (G550, G580 EQ) se ensamblan en Magna Steyr, Graz, AUSTRIA, desde 1979. Los motores AMG vienen de Affalterbach y se instalan en Graz. Ningún G-Class es estadounidense: 6%.",
  },
  {
    id: "mercedes-eqs-suv",
    patterns: [/\beqs suv\b/],
    country: "Estados Unidos",
    plant: "Mercedes-Benz U.S. International, Tuscaloosa, Alabama",
    usOrigin: false,
    confidence: "media",
    mayQualifyWithCertificate: true,
    reason:
      "OJO: solo el EQS **SUV** es de Alabama (el EQS Sedán es de Sindelfingen, Alemania). Aun así, el contenido AALA publicado de MBUSI es 10% US/Canadá, muy por debajo del 35% del APC: cotizamos 6% y solo baja a 0% con certificado de origen.",
  },
  {
    id: "mercedes-eqe-suv",
    patterns: [/\beqe suv\b/],
    country: "Estados Unidos",
    plant: "Mercedes-Benz U.S. International, Tuscaloosa, Alabama",
    usOrigin: false,
    confidence: "media",
    mayQualifyWithCertificate: true,
    reason:
      "Solo el EQE **SUV** es de Alabama (el EQE Sedán es de Bremen, Alemania), y el contenido AALA de MBUSI es 10% US/Canadá. Cotizamos 6%; el EQE SUV además termina producción en 2026, así que será stock de fin de ciclo.",
  },
  {
    id: "mercedes-maybach-gls",
    patterns: [/\bmaybach gls\b/],
    country: "Estados Unidos",
    plant: "Mercedes-Benz U.S. International, Tuscaloosa, Alabama",
    usOrigin: false,
    confidence: "media",
    mayQualifyWithCertificate: true,
    reason:
      "Dato contraintuitivo: el Maybach GLS 600 sí se ensambla en Alabama. Pero con 10% de contenido US/Canadá publicado y el ticket más alto del catálogo, es justo donde un error de 6% sobre el CIF cuesta más: cotizamos 6% y solo bajamos con certificado de origen.",
  },
  {
    id: "mercedes-gle-coupe",
    patterns: [/\bgle coupe\b/],
    country: "Estados Unidos",
    plant: "Mercedes-Benz U.S. International, Tuscaloosa, Alabama",
    usOrigin: false,
    confidence: "media",
    mayQualifyWithCertificate: true,
    reason:
      "El GLE Coupé se ensambla en Tuscaloosa (fuente única mundial), pero el contenido AALA de MBUSI es 10% US/Canadá. Cotizamos 6%; puede bajar a 0% solo con certificado de origen del vendedor.",
  },
  {
    id: "mercedes-gle",
    patterns: [/\bgle\b/],
    country: "Estados Unidos",
    plant: "Mercedes-Benz U.S. International, Tuscaloosa, Alabama",
    usOrigin: false,
    confidence: "media",
    mayQualifyWithCertificate: true,
    reason:
      "El GLE (350/450/450e y AMG 53/63 S) se ensambla en Tuscaloosa, fuente única mundial. Pero el contenido AALA publicado de MBUSI es 10% US/Canadá: cotizamos 6% y solo baja a 0% con certificado de origen.",
  },
  {
    id: "mercedes-gls",
    patterns: [/\bgls\b/],
    country: "Estados Unidos",
    plant: "Mercedes-Benz U.S. International, Tuscaloosa, Alabama",
    usOrigin: false,
    confidence: "media",
    mayQualifyWithCertificate: true,
    reason:
      "El GLS (450/580 y AMG 63) se ensambla en Tuscaloosa, fuente única mundial, pero con 10% de contenido US/Canadá publicado. Cotizamos 6%; puede bajar a 0% solo con certificado de origen.",
  },
  {
    id: "mercedes-eqs-eqe-sedan",
    patterns: [/\beqs\b/, /\beqe\b/],
    country: "Alemania",
    plant: "Sindelfingen (EQS) · Bremen (EQE)",
    usOrigin: false,
    confidence: "alta",
    reason:
      "CONTRA-TRAMPA: el EQS Sedán es de Sindelfingen y el EQE Sedán de Bremen, ambos en Alemania. Solo las versiones **SUV** son de Alabama. Si el cliente dice 'EQS' a secas, hay que preguntarle SUV o sedán. 6%.",
  },
  {
    // VIGILAR 2028: la localización del GLC en Tuscaloosa es para fines de
    // 2027 y no a pleno ritmo hasta 2029.
    id: "mercedes-glc",
    patterns: [/\bglc\b/],
    country: "Alemania",
    plant: "Bremen",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El GLC de mercado estadounidense se fabrica hoy en Bremen, Alemania: 6%. Mercedes localizará el GLC en Tuscaloosa recién hacia fines de 2027, así que esta regla hay que revisarla en 2028, no antes.",
  },
  {
    id: "mercedes-clase-s",
    patterns: [/\bclase s\b/, /\bs class\b/, /\bs (500|560|580|680)\b/, /\bmaybach\b/],
    country: "Alemania",
    plant: "Factory 56, Sindelfingen",
    usOrigin: false,
    confidence: "alta",
    reason:
      "La Clase S y la Maybach Clase S se fabrican en Factory 56, Sindelfingen, Alemania: 6%. No confundir con el Maybach GLS, que sí es de Alabama.",
  },
  {
    id: "mercedes-clase-c-e",
    patterns: [
      /\bclase [ce]\b/,
      /\b[ce] class\b/,
      /\bcle\b/,
      /\bc (200|300|43|63)\b/,
      /\be (350|450|53|63)\b/,
    ],
    country: "Alemania",
    plant: "Bremen · Sindelfingen",
    usOrigin: false,
    confidence: "alta",
    reason:
      "La Clase C, la Clase E y el CLE tienen red multiplanta global (Bremen, Sindelfingen, Sudáfrica, China, India) pero ninguna planta en EE.UU.: 6%.",
  },
  {
    id: "mercedes-sl-amg-gt",
    patterns: [/\bamg gt\b/, /\bsl\b/],
    country: "Alemania",
    plant: "Affalterbach · Sindelfingen · Bremen",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El SL y el AMG GT (coupé y 4 puertas) se reparten entre Affalterbach, Sindelfingen y Bremen según generación. En todos los escenarios, Alemania: 6%.",
  },
  {
    id: "mercedes-gla-glb-cla",
    patterns: [/\bgla\b/, /\bglb\b/, /\bcla\b/],
    country: "Alemania, Hungría o México",
    plant: "Rastatt · Kecskemét · Aguascalientes",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El GLA, GLB y CLA se reparten entre Rastatt (Alemania), Kecskemét (Hungría) y Aguascalientes (México) según año y mercado. Ninguna es EE.UU.: 6%.",
  },
];

/* --------------------------------------------------------------------------
 * RANGE ROVER / LAND ROVER
 * ------------------------------------------------------------------------ */
const LAND_ROVER_RULES: readonly OriginRule[] = [
  {
    id: "jlr-defender-discovery",
    patterns: [/\bdefender\b/, /\bdiscovery\b/],
    country: "Eslovaquia",
    plant: "JLR Nitra",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Defender y el Discovery se fabrican en Nitra, ESLOVAQUIA (los clientes suelen decir 'Range Rover' cuando quieren un Defender). JLR no tiene ninguna planta de ensamblaje en EE.UU.: 6%.",
  },
  {
    id: "jlr-evoque",
    patterns: [/\bevoque\b/],
    country: "Reino Unido",
    plant: "Halewood, Merseyside",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Evoque de mercado estadounidense es de Halewood, Reino Unido (también hubo producción en Brasil y China para esos mercados). 6%.",
  },
];

/* ==========================================================================
 * 4. REGLAS POR DEFECTO DE MARCA
 * Se usan cuando el modelo no coincide con ninguna fila. Para las marcas de
 * planta única (Ferrari, Lamborghini, Bentley, McLaren, Rolls-Royce, Porsche,
 * Audi, Chrysler) el default es la respuesta correcta y definitiva.
 * ========================================================================== */
const BRAND_DEFAULTS: Record<BrandKey, OriginRule> = {
  ford: {
    id: "ford-default",
    patterns: [],
    country: "Desconocido",
    plant: null,
    usOrigin: false,
    confidence: "baja",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "No reconocimos este modelo de Ford. Ford ensambla tanto en EE.UU. como en México y Canadá, así que cotizamos 6% por defecto; confirmá con el VIN (1/4/5 = EE.UU., 2 = Canadá, 3 = México).",
  },
  chevrolet: {
    id: "chevrolet-default",
    patterns: [],
    country: "Desconocido",
    plant: null,
    usOrigin: false,
    confidence: "baja",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "No reconocimos este modelo de Chevrolet. GM ensambla en EE.UU., México, Canadá y Corea del Sur, así que cotizamos 6% por defecto; confirmá con el VIN.",
  },
  cadillac: {
    id: "cadillac-default",
    patterns: [],
    country: "Desconocido",
    plant: null,
    usOrigin: false,
    confidence: "baja",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "No reconocimos este modelo de Cadillac. La mayoría de la gama es estadounidense, pero el Optiq es mexicano: cotizamos 6% y confirmamos con el VIN.",
  },
  chrysler: {
    // LA TRAMPA MÁS GRANDE DEL CATÁLOGO: la marca entera es canadiense.
    id: "chrysler-todos",
    patterns: [],
    country: "Canadá",
    plant: "Windsor Assembly Plant, Ontario",
    usOrigin: false,
    confidence: "alta",
    reason:
      "LA MARCA CHRYSLER ENTERA ES CANADIENSE: toda la gama viva (Pacifica, Pacifica Hybrid, Voyager, Grand Caravan) sale de Windsor, Ontario, y el difunto 300 salía de Brampton. No existe hoy un Chrysler que califique al 0%: 6% siempre.",
  },
  dodge: {
    id: "dodge-default",
    patterns: [],
    country: "Canadá o Italia",
    plant: "Windsor · Brampton · Pomigliano d'Arco",
    usOrigin: false,
    confidence: "media",
    reason:
      "Dodge es casi todo canadiense (Charger y Challenger) o italiano (Hornet). El Durango, de Detroit, es prácticamente el único Dodge estadounidense vivo: por defecto 6%.",
  },
  ram: {
    id: "ram-default",
    patterns: [],
    country: "Desconocido",
    plant: null,
    usOrigin: false,
    confidence: "baja",
    requiresVin: true,
    reason:
      "No reconocimos este modelo de RAM. La 1500 DT es de Michigan pero toda la gama Heavy Duty y la ProMaster son de Saltillo, México: cotizamos 6% y confirmamos con el VIN (1C6 = EE.UU., 3C6 = México).",
  },
  jeep: {
    id: "jeep-default",
    patterns: [],
    country: "Desconocido",
    plant: null,
    usOrigin: false,
    confidence: "baja",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "No reconocimos este modelo de Jeep. Toledo y Detroit son estadounidenses, pero Toluca (México) y Melfi (Italia) también producen Jeep: cotizamos 6% y confirmamos con el VIN.",
  },
  tesla: {
    id: "tesla-default",
    patterns: [],
    country: "Desconocido",
    plant: null,
    usOrigin: false,
    confidence: "baja",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "No reconocimos este modelo de Tesla. La gama vendida en EE.UU. sale de Fremont o Austin, pero Tesla también fabrica en Shanghái y Berlín: cotizamos 6% y confirmamos con el VIN (5YJ o 7SA = EE.UU.).",
  },
  toyota: {
    id: "toyota-default",
    patterns: [],
    country: "Desconocido",
    plant: null,
    usOrigin: false,
    confidence: "baja",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "Regla conservadora: Toyota por defecto paga 6%. Solo la lista blanca verificada (Tundra, Sequoia, Camry, Grand Highlander, Highlander, Sienna y Corolla Cross) se ensambla en EE.UU. Confirmá con el VIN (4T/5T/5Y/7MU = EE.UU., 2T = Canadá, 3T = México, JT = Japón).",
  },
  lexus: {
    id: "lexus-todos",
    patterns: [],
    country: "Japón",
    plant: "Plantas japonesas (única excepción: TX, en Princeton, Indiana)",
    usOrigin: false,
    confidence: "alta",
    reason:
      "Regla de marca: cualquier Lexus paga 6%, con UNA sola excepción, el TX de Princeton, Indiana. Tras el traslado del ES a Japón a fines de 2025, el TX quedó como el único Lexus ensamblado en EE.UU.",
  },
  bmw: {
    id: "bmw-default",
    patterns: [],
    country: "Desconocido",
    plant: null,
    usOrigin: false,
    confidence: "media",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "No reconocimos este modelo de BMW. Spartanburg ensambla los X3/X4/X5/X6/X7/XM, pero su contenido regional publicado no alcanza el 35% del APC, y el resto de la gama es alemana o mexicana: 6% por defecto.",
  },
  mercedes: {
    id: "mercedes-default",
    patterns: [],
    country: "Desconocido",
    plant: null,
    usOrigin: false,
    confidence: "media",
    requiresVin: true,
    mayQualifyWithCertificate: true,
    reason:
      "No reconocimos este modelo de Mercedes-Benz. Solo los SUV de Tuscaloosa (GLE, GLE Coupé, GLS, Maybach GLS, EQE SUV, EQS SUV) se ensamblan en EE.UU., y aun así con 10% de contenido US/Canadá: 6% por defecto.",
  },
  audi: {
    id: "audi-todos",
    patterns: [],
    country: "Alemania, Hungría, Eslovaquia o México",
    plant: "Ingolstadt · Neckarsulm · Győr · Bratislava · San José Chiapa",
    usOrigin: false,
    confidence: "alta",
    reason:
      "Audi NO tiene ninguna planta de ensamblaje en EE.UU., y en enero de 2026 Volkswagen congeló el proyecto de planta en Carolina del Sur. El Q5, el Audi más comprado en Miami, sale de Puebla, MÉXICO: todo Audi paga 6%.",
  },
  porsche: {
    id: "porsche-todos",
    patterns: [],
    country: "Alemania y Eslovaquia",
    plant: "Zuffenhausen · Leipzig · Bratislava (Cayenne)",
    usOrigin: false,
    confidence: "alta",
    reason:
      "Porsche no tiene ninguna planta en EE.UU. y lo desmintió públicamente en 2026. 911/718/Taycan de Zuffenhausen, Macan/Panamera de Leipzig, Cayenne de Bratislava: todo Porsche paga 6%.",
  },
  ferrari: {
    id: "ferrari-todos",
    patterns: [],
    country: "Italia",
    plant: "Maranello, Módena",
    usOrigin: false,
    confidence: "alta",
    reason:
      "Ferrari no fabrica ningún auto fuera de Italia. El 296 GTB, como toda la gama, es de Maranello: 6%, sin escenario posible de 0%.",
  },
  lamborghini: {
    id: "lamborghini-todos",
    patterns: [],
    country: "Italia",
    plant: "Sant'Agata Bolognese, Bolonia",
    usOrigin: false,
    confidence: "alta",
    reason:
      "Lamborghini ensambla el 100% de su gama en Sant'Agata Bolognese, Italia (el Urus lleva carrocería en bruto de Bratislava, pero el ensamblaje final y el país declarado es Italia). Urus y Huracán Sterrato: 6%.",
  },
  "aston-martin": {
    id: "aston-martin-todos",
    patterns: [],
    country: "Reino Unido",
    plant: "Gaydon, Warwickshire · St Athan, Gales (DBX)",
    usOrigin: false,
    confidence: "alta",
    reason:
      "Aston Martin fabrica en Gaydon (DB12, Vantage, Vanquish, Valhalla, DBS) y en St Athan, Gales (DBX/DBX707). Todo Reino Unido: 6%.",
  },
  bentley: {
    id: "bentley-todos",
    patterns: [],
    country: "Reino Unido",
    plant: "Crewe, Cheshire",
    usOrigin: false,
    confidence: "alta",
    reason:
      "Bentley fabrica el 100% de sus autos en Crewe, Reino Unido. Ningún escenario de 0%: 6%.",
  },
  mclaren: {
    id: "mclaren-todos",
    patterns: [],
    country: "Reino Unido",
    plant: "McLaren Production Centre, Woking, Surrey",
    usOrigin: false,
    confidence: "alta",
    reason:
      "Todos los McLaren de calle salen de Woking, Reino Unido, planta única de la marca: 6%.",
  },
  "rolls-royce": {
    // ENTRADA AÑADIDA POR EL VERIFICADOR: faltaba una marca completa del catálogo.
    id: "rolls-royce-todos",
    patterns: [],
    country: "Reino Unido",
    plant: "Goodwood, West Sussex",
    usOrigin: false,
    confidence: "alta",
    reason:
      "Phantom, Ghost, Cullinan y Spectre comparten una sola línea de montaje en Goodwood, Reino Unido, única planta de la marca. Pertenecer al grupo BMW NO la conecta con Spartanburg: 6%.",
  },
  "land-rover": {
    id: "land-rover-todos",
    patterns: [],
    country: "Reino Unido",
    plant: "Solihull, West Midlands",
    usOrigin: false,
    confidence: "alta",
    reason:
      "El Range Rover, el Range Rover Sport y el Velar se fabrican en Solihull, Reino Unido. JLR no opera ninguna planta de ensamblaje en EE.UU.: 6%.",
  },
};

const RULES_BY_BRAND: Record<BrandKey, readonly OriginRule[]> = {
  ford: FORD_RULES,
  chevrolet: CHEVROLET_RULES,
  cadillac: CADILLAC_RULES,
  chrysler: CHRYSLER_RULES,
  dodge: DODGE_RULES,
  ram: RAM_RULES,
  jeep: JEEP_RULES,
  tesla: TESLA_RULES,
  toyota: TOYOTA_RULES,
  lexus: LEXUS_RULES,
  bmw: BMW_RULES,
  mercedes: MERCEDES_RULES,
  audi: [],
  porsche: [],
  ferrari: [],
  lamborghini: [],
  "aston-martin": [],
  bentley: [],
  mclaren: [],
  "rolls-royce": [],
  "land-rover": LAND_ROVER_RULES,
};

/** Última red de seguridad: marca desconocida o campo vacío. */
const UNKNOWN_RULE: OriginRule = {
  id: "sin-coincidencia",
  patterns: [],
  country: "Desconocido",
  plant: null,
  usOrigin: false,
  confidence: "baja",
  requiresVin: true,
  mayQualifyWithCertificate: true,
  reason:
    "No pudimos identificar la marca o el modelo, así que cotizamos el escenario conservador: 6% de ad valorem. Si el vehículo se ensambló en EE.UU. y el vendedor emite certificado de origen del APC, recalculamos a 0%.",
};

/* ==========================================================================
 * 5. API
 * ========================================================================== */

/**
 * DOBLE CANDADO: solo se sugiere 0% cuando el ensamblaje estadounidense está
 * confirmado Y la confianza es alta. Cualquier otra combinación cae a 6%.
 */
function verdictOf(rule: OriginRule): VehicleOrigin {
  return rule.usOrigin && rule.confidence === "alta" ? "originario-usa" : "otro";
}

function toInference(
  rule: OriginRule,
  brandKey: BrandKey | null,
  matched: boolean,
): OriginInference {
  const origin = verdictOf(rule);
  return {
    origin,
    confidence: rule.confidence,
    reason: rule.reason,
    adValoremRate: PRICING_CONFIG.adValoremByOrigin[origin],
    assemblyCountry: rule.country,
    plant: rule.plant,
    matched,
    requiresVin: rule.requiresVin ?? false,
    // Si el ensamblaje es estadounidense pero no sugerimos 0%, el certificado
    // de origen sigue siendo la vía para bajar el arancel.
    mayQualifyWithCertificate:
      rule.mayQualifyWithCertificate ?? (rule.usOrigin && origin === "otro"),
    brandKey,
    ruleId: rule.id,
  };
}

/**
 * Sugiere el origen de un vehículo a partir de la marca y el modelo escritos
 * por el usuario. Nunca lanza: ante cualquier duda devuelve el valor
 * conservador ("otro" = 6%).
 *
 * @example
 * inferOrigin("Chevrolet", "Corvette Z06")  // → originario-usa, alta
 * inferOrigin("BMW", "X5 M Competition")    // → otro, media (ensambla en EE.UU.)
 * inferOrigin("RAM", "3500 Limited")        // → otro, alta (Saltillo, México)
 * inferOrigin("Toyota", "Corolla Cross")    // → originario-usa, alta (Alabama)
 */
export function inferOrigin(brand: string, model: string): OriginInference {
  const normalizedModel = normalizeText(model ?? "");
  const normalizedBrand = normalizeText(brand ?? "");
  const haystack = `${normalizedBrand} ${normalizedModel}`.trim();

  const brandKey = resolveBrand(brand ?? "", haystack);
  if (!brandKey) return toInference(UNKNOWN_RULE, null, false);

  for (const rule of RULES_BY_BRAND[brandKey]) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return toInference(rule, brandKey, true);
    }
  }

  // Sin coincidencia de modelo: manda la regla de marca. Para Chrysler, Audi,
  // Porsche, Ferrari, Lamborghini, Bentley, McLaren, Rolls-Royce y Lexus esa
  // regla es la respuesta definitiva, no un fallback.
  const fallback = BRAND_DEFAULTS[brandKey];
  return toInference(fallback, brandKey, fallback.confidence === "alta");
}

/* --------------------------------------------------------------------------
 * VIN: el único desempate real
 * ------------------------------------------------------------------------ */

/**
 * Primer carácter del VIN = país de ensamblaje final. Es el desempate que
 * resuelve las trampas caras (Silverado, F-250, Tacoma, RAV4, Lexus RX).
 *
 * OJO con el límite: el WMI se asigna al FABRICANTE, así que un auto hecho por
 * contrato en Magna Steyr (Graz, Austria) lleva WMI alemán — el AMG G63 empieza
 * en W y el Supra en WZ1. Para esos casos el primer carácter no dice "Austria",
 * pero tampoco dice EE.UU., así que la conclusión conservadora no cambia.
 * El dígito 11 identifica la planta dentro del fabricante.
 */
export const VIN_ASSEMBLY_COUNTRY: Readonly<Record<string, string>> = {
  "1": "Estados Unidos",
  "4": "Estados Unidos",
  "5": "Estados Unidos",
  // El 7 era originalmente Oceanía, pero la SAE ya asigna prefijos 7 a plantas
  // estadounidenses: 7SA = Tesla Austin, 7MU = Mazda Toyota Alabama.
  "7": "Estados Unidos",
  "2": "Canadá",
  "3": "México",
  J: "Japón",
  K: "Corea del Sur",
  L: "China",
  S: "Reino Unido",
  T: "Suiza / Chequia / Hungría",
  V: "Austria / Francia / España",
  W: "Alemania",
  X: "Rusia / Alemania (Tesla Giga Berlín: XP7)",
  Y: "Bélgica / Finlandia / Suecia",
  Z: "Italia",
};

/**
 * WMI (tres primeros caracteres) de los casos caros del catálogo. Sirve para
 * que el operador resuelva en segundos las trampas de doble planta.
 */
export const VIN_WMI_HINTS: readonly { wmi: string; significado: string }[] = [
  { wmi: "1GC / 3GC", significado: "Chevrolet Silverado: 1 = EE.UU., 3 = México" },
  { wmi: "2GC", significado: "Chevrolet Silverado (1500 o HD) de Oshawa, CANADÁ — no califica" },
  { wmi: "1FT", significado: "Ford F-Series de EE.UU. (Kentucky Truck Plant)" },
  { wmi: "2FT", significado: "Ford Super Duty de Oakville, CANADÁ — no califica" },
  { wmi: "1C6", significado: "RAM 1500 DT de Sterling Heights, Michigan" },
  { wmi: "3C6", significado: "RAM (1500 Classic y toda la gama HD) de Saltillo, MÉXICO" },
  { wmi: "4T / 5T", significado: "Toyota EE.UU.: 4T = Kentucky (Camry), 5T = Indiana y Texas" },
  { wmi: "5Y", significado: "Toyota Mississippi (Corolla sedán)" },
  { wmi: "7MU", significado: "Mazda Toyota Alabama (Corolla Cross) — sí califica" },
  { wmi: "2T", significado: "Toyota Canadá, Cambridge/Woodstock (RAV4, Lexus RX y NX) — no califica" },
  { wmi: "3T", significado: "Toyota México (Tacoma) — no califica" },
  { wmi: "JT", significado: "Toyota/Lexus Japón (4Runner, Land Cruiser, ES MY2026+)" },
  { wmi: "5YJ / 7SA", significado: "Tesla EE.UU. (Fremont y Austin)" },
  { wmi: "LRW / XP7", significado: "Tesla Shanghái / Berlín — no califica" },
];

export type VinOriginCheck = {
  origin: VehicleOrigin;
  country: string;
  confidence: OriginConfidence;
  reason: string;
};

/**
 * Resuelve el país de ensamblaje a partir del VIN. Devuelve null si el VIN no
 * tiene forma válida (17 caracteres), para que la UI siga con la sugerencia
 * por marca+modelo.
 */
export function inferOriginFromVin(vin: string): VinOriginCheck | null {
  const clean = (vin ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (clean.length !== 17) return null;

  const first = clean[0];
  const country = VIN_ASSEMBLY_COUNTRY[first];
  if (!country) {
    return {
      origin: "otro",
      country: "Desconocido",
      confidence: "baja",
      reason: `No reconocemos el primer carácter del VIN (${first}). Cotizamos 6% por precaución.`,
    };
  }

  const isUsa = country === "Estados Unidos";
  return {
    origin: isUsa ? "originario-usa" : "otro",
    country,
    confidence: "alta",
    reason: isUsa
      ? `El VIN empieza en ${first}: ensamblaje final en Estados Unidos. Con el certificado de origen del APC, ad valorem 0%.`
      : `El VIN empieza en ${first}: ensamblaje final en ${country}. No califica al APC Perú–EE.UU.: 6%.`,
  };
}

/**
 * Sugerencia final. Si hay VIN, MANDA EL VIN: es el único dato que resuelve
 * los modelos de doble planta y los que cambian de país según el año.
 *
 * Importante: un VIN estadounidense confirma el ENSAMBLAJE, no el origen APC.
 * El 0% se materializa recién con el certificado de origen del exportador.
 */
export function resolveOrigin(
  brand: string,
  model: string,
  vin?: string,
): OriginInference {
  const byModel = inferOrigin(brand, model);
  const byVin = vin ? inferOriginFromVin(vin) : null;
  if (!byVin) return byModel;

  return {
    ...byModel,
    origin: byVin.origin,
    confidence: byVin.confidence,
    reason: `${byVin.reason} ${byModel.reason}`,
    adValoremRate: PRICING_CONFIG.adValoremByOrigin[byVin.origin],
    assemblyCountry: byVin.country,
    requiresVin: false,
    mayQualifyWithCertificate: byVin.origin === "originario-usa",
  };
}

/* ==========================================================================
 * 6. TRAMPAS PARA MOSTRAR EN LA UI
 * Una línea por trampa. Sirven como tooltip o como aviso cuando la regla que
 * coincidió es una de estas.
 * ========================================================================== */
export const ORIGIN_TRAPS: readonly {
  ruleId: string;
  titulo: string;
  mensaje: string;
}[] = [
  {
    ruleId: "chrysler-todos",
    titulo: "Chrysler no tiene ninguna planta en EE.UU.",
    mensaje:
      "Toda la gama Chrysler se fabrica en Windsor, Ontario (Canadá). Ningún Chrysler califica al 0%.",
  },
  {
    ruleId: "ram-heavy-duty",
    titulo: "La RAM 3500 es mexicana",
    mensaje:
      "Las RAM 2500/3500/4500/5500 se ensamblan en Saltillo, México, desde 1995. No existe versión estadounidense.",
  },
  {
    ruleId: "ford-super-duty",
    titulo: "El F-250 ya no es solo de Kentucky",
    mensaje:
      "Desde Q3 2026 Ford también produce el Super Duty en Oakville, Canadá. Un F-250 2026-2027 puede ser canadiense: pedí el VIN.",
  },
  {
    ruleId: "chevrolet-silverado",
    titulo: "La Silverado 1500 sale de tres países",
    mensaje:
      "Indiana (EE.UU.), Silao (México) y Oshawa (Canadá) producen la misma Crew Cab. Solo el VIN lo resuelve.",
  },
  {
    ruleId: "chevrolet-silverado-hd",
    titulo: "La Silverado HD también se hace en Canadá",
    mensaje:
      "Oshawa (Ontario) construye justo la Crew Cab que más se importa. Un VIN que empieza en 2GC no califica.",
  },
  {
    ruleId: "toyota-tacoma",
    titulo: "La Tacoma es mexicana",
    mensaje:
      "Se ensambla en Tijuana y Guanajuato. La línea de San Antonio recién absorbe la Tacoma hacia 2030.",
  },
  {
    ruleId: "toyota-supra",
    titulo: "El Supra es austriaco",
    mensaje:
      "Lo fabrica Magna Steyr en Graz, Austria, sobre plataforma BMW, no en Japón ni en EE.UU.",
  },
  {
    ruleId: "toyota-4runner",
    titulo: "El 4Runner nunca fue estadounidense",
    mensaje: "Sale de Tahara, Japón, incluida la generación 2025-2026.",
  },
  {
    ruleId: "toyota-rav4",
    titulo: "Canadá no es Estados Unidos",
    mensaje:
      "Buena parte del RAV4 norteamericano es de Ontario. El porcentaje del Monroney suma EE.UU. + Canadá, pero el APC exige origen estadounidense.",
  },
  {
    ruleId: "mercedes-clase-g",
    titulo: "El AMG G63 es austriaco",
    mensaje:
      "La Clase G se ensambla en Magna Steyr, Graz, desde 1979. Ningún G-Class paga 0%.",
  },
  {
    ruleId: "mercedes-gle",
    titulo: "Ensamblar en Alabama no es ser originario de EE.UU.",
    mensaje:
      "El GLE, GLS y Maybach GLS se arman en Tuscaloosa, pero con 10% de contenido US/Canadá publicado. Cotizamos 6% salvo certificado de origen.",
  },
  {
    ruleId: "mercedes-eqs-eqe-sedan",
    titulo: "SUV y sedán no son el mismo país",
    mensaje:
      "EQE SUV y EQS SUV son de Alabama; EQE Sedán (Bremen) y EQS Sedán (Sindelfingen) son alemanes.",
  },
  {
    ruleId: "bmw-x5",
    titulo: "Un BMW X ensamblado en EE.UU. no garantiza el 0%",
    mensaje:
      "Spartanburg arma X3/X5/X6/X7/XM, pero su contenido regional publicado (9% a 35%) no alcanza el 35% del APC con seguridad.",
  },
  {
    ruleId: "bmw-x1-x2",
    titulo: "No todos los BMW X son americanos",
    mensaje: "El X1, X2, iX1 e iX2 se fabrican en Alemania.",
  },
  {
    ruleId: "ford-bronco-sport",
    titulo: "Bronco no es Bronco Sport",
    mensaje:
      "El Bronco y el Bronco Raptor son de Wayne, Michigan; el Bronco Sport es de Hermosillo, México.",
  },
  {
    ruleId: "ford-mach-e",
    titulo: "El Mustang Mach-E es mexicano",
    mensaje:
      "Lleva el nombre del ícono americano pero se ensambla en Cuautitlán, México.",
  },
  {
    ruleId: "jeep-wagoneer-s",
    titulo: "Una letra cambia el arancel",
    mensaje:
      "Wagoneer y Grand Wagoneer son de Warren, Michigan; el Wagoneer S es de Toluca, México.",
  },
  {
    ruleId: "jeep-cherokee",
    titulo: "El Cherokee cambió de país en 2026",
    mensaje:
      "El KL (2014-2023) era de Illinois; el KM (MY2026) es de Toluca, México. Mismo nombre, arancel opuesto.",
  },
  {
    ruleId: "lexus-es",
    titulo: "El Lexus ES cambió de país en 2025",
    mensaje:
      "Fue el único Lexus hecho en EE.UU. hasta 2025; desde el MY2026 se fabrica en Kyushu, Japón.",
  },
  {
    ruleId: "chevrolet-camaro",
    titulo: "El Camaro depende de la generación",
    mensaje:
      "La sexta generación es de Michigan; la quinta (2010-2015) era de Oshawa, Canadá.",
  },
  {
    ruleId: "chevrolet-equinox-ev",
    titulo: "Más contenido estadounidense no es origen estadounidense",
    mensaje:
      "GM subió las piezas US/Canadá del Equinox EV 2026, pero el ensamblaje final sigue en Ramos Arizpe, México.",
  },
  {
    ruleId: "cadillac-optiq",
    titulo: "El Optiq es el único Cadillac mexicano",
    mensaje:
      "El resto de la gama Cadillac es estadounidense; el Optiq se hace en Ramos Arizpe.",
  },
  {
    ruleId: "toyota-corolla-cross",
    titulo: "El Corolla Cross sí es estadounidense",
    mensaje:
      "Se arma en Huntsville, Alabama, única planta de Norteamérica que lo produce. A diferencia del Corolla sedán, califica a 0%.",
  },
];

/** Devuelve la trampa asociada a una sugerencia, si existe. */
export function trapFor(inference: OriginInference) {
  return ORIGIN_TRAPS.find((trap) => trap.ruleId === inference.ruleId) ?? null;
}

/* ==========================================================================
 * 7. FECHAS DE CADUCIDAD DE ESTA TABLA
 * Estos cambios YA están anunciados y van a romper reglas de arriba. No son
 * hipótesis: son inversiones confirmadas con fecha.
 * ========================================================================== */
export const VIGILAR: readonly { cuando: string; que: string }[] = [
  {
    cuando: "Ya (Q3 2026)",
    que: "Ford Super Duty: producción canadiense en Oakville ya arrancó. F-250/350/450 MY2026+ pueden ser canadienses.",
  },
  {
    cuando: "Fines de 2026",
    que: "BMW iX5: inicia producción en Spartanburg. Hoy no existe: no ofrecerlo en la calculadora.",
  },
  {
    cuando: "Enero 2027",
    que: "Toyota Highlander EV: arranca en Georgetown, Kentucky (también estadounidense).",
  },
  {
    cuando: "2027",
    que: "GM mueve el Equinox a gasolina a Fairfax (Kansas) y el Blazer a gasolina a Spring Hill (Tennessee). Convivirán unidades mexicanas y estadounidenses con el mismo nombre: pedir VIN.",
  },
  {
    cuando: "2027",
    que: "Jeep Compass y Cherokee: Belvidere (Illinois) reabre. Podrían pasar a origen estadounidense.",
  },
  {
    cuando: "Fines de 2027 (revisar en 2028)",
    que: "Mercedes GLC: localización en Tuscaloosa. No a pleno ritmo hasta 2029.",
  },
  {
    cuando: "2029-2030",
    que: "Toyota Tacoma: segunda línea en San Antonio. Recién entonces habrá Tacoma estadounidense.",
  },
];
