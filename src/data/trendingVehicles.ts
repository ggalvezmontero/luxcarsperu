/**
 * ============================================================================
 * CATÁLOGO CURADO DE VEHÍCULOS DESTACADOS — LUX CARS IMPORT S.A.C.
 * ============================================================================
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ RESTRICCIÓN LEGAL DURA — NO LA "OPTIMICES" EN SEIS MESES                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ESTÁ PROHIBIDO poblar este archivo (o CUALQUIER tabla de base de datos,
 * caché, índice de búsqueda o archivo derivado) con inventario proveniente de:
 *
 *     MarketCheck · Auto.dev · eBay · Autotrader · CarGurus · Cars.com
 *     TrueCar · AutoTempest · Facebook Marketplace
 *
 * Sus términos de servicio lo prohíben textualmente: "cache, store, index or
 * otherwise persist", prohibición de "derivative databases" y borrado
 * obligatorio a las 6 horas. Un INSERT con esos datos NO es una zona gris: es
 * incumplimiento de contrato con revocación de llave de API.
 *
 * Esto aplica también a un script de "sincronización nocturna", a un job de
 * Vercel Cron, a un snapshot "temporal" en Supabase y a un JSON commiteado al
 * repo. El formato no cambia la prohibición: persistir es persistir.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA VÍA LEGAL SÍ VIABLE                                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * 1. Carga MANUAL CURADA desde el admin, con autocompletado por VIN contra
 *    NHTSA vPIC — API del gobierno de EE. UU., gratuita, sin autenticación y
 *    sin límite contractual:
 *      https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json
 *    Costo real: ~4 minutos por auto.
 * 2. Más adelante, feeds XML de dealers partner CON cláusula de licencia
 *    firmada que autorice el almacenamiento.
 *
 * Este archivo es exactamente eso: una lista curada a mano, escrita por el
 * equipo, sin una sola fila proveniente de un scraper o de una API prohibida.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ REGLAS DE HONESTIDAD DEL CATÁLOGO                                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * - PRECIOS: solo se escribe una cifra exacta cuando hay MSRP oficial
 *   verificado (priceBasis "msrp-oficial"). Si no lo hay, va un rango prudente
 *   marcado "referencial-miami" y la UI DEBE mostrarlo como referencial.
 *   NUNCA inventar una cifra para que el rango se vea más apretado.
 * - IMÁGENES: `imageSrc` es `string | null`. El catálogo anterior usaba fotos
 *   de Unsplash que NO correspondían al vehículo (un 4x4 genérico etiquetado
 *   "Bronco Raptor", un pickup cualquiera etiquetado "Cybertruck"). Es
 *   preferible no mostrar foto a mostrar una mentira, así que un slot sin foto
 *   verificada se queda en null y la UI resuelve el caso sin foto.
 *   Una foto solo entra si cumple las TRES condiciones, verificadas una por
 *   una y documentadas en `docs/FOTOS.md`:
 *     1. Es el modelo y la generación correctos, confirmado mirando la imagen
 *        (no confiando en el nombre del archivo ni en la categoría de origen).
 *     2. Tiene licencia que permite uso comercial (CC0 o CC BY). Quedan fuera
 *        las salas de prensa de los fabricantes ("editorial use only") y el
 *        contenido de MarketCheck, eBay, Autotrader, CarGurus, Cars.com,
 *        TrueCar, AutoTempest y Facebook Marketplace.
 *     3. Está autohospedada en `/public/images/vehiculos/`, no hotlinkeada.
 *   `imageAlt` describe lo que REALMENTE se ve (modelo, generación, ángulo,
 *   color) y aclara que es imagen referencial del modelo, no de la unidad en
 *   venta: LUX CARS es broker, no tiene la unidad en patio.
 *   Si `imageLicense` exige atribución (familia CC BY), `imageCredit` y
 *   `imageSourceUrl` son OBLIGATORIOS y el crédito DEBE publicarse en la UI
 *   con `<CreditoFoto />`. No publicarlo es infringir la licencia. El invariante
 *   de `buildTrendingVehicles()` revienta el build si falta.
 * - ORIGEN / AD VALOREM: los datos de planta y ad valorem están alineados con
 *   `src/core/pricing/originInference.ts`. Si ahí cambia una regla, acá se
 *   corrige también. No duplicar lógica: esto es copy para el cliente, la
 *   verdad tributaria vive en el motor de precios.
 * - CONTRAEJEMPLOS: Changan y Geely se quedan en la lista a propósito, con
 *   `importViability: "no-conviene-importar"`. Ya se venden NUEVOS en Perú más
 *   barato de lo que costaría importarlos y no existen en dealers de EE. UU.
 *   No se presentan como oportunidad: se presentan como la razón por la que el
 *   cliente debería confiar en la asesoría.
 */

import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import type { PlanKey } from "@/core/pricing/pricingConfig";
import rawPresets from "./trendingSimulationPresets.json";
import rawVehicles from "./trendingVehicles.json";

/** Preset que precarga la calculadora de importación. */
export type TrendingVehicleCalculatorPreset = {
  brand: string;
  model: string;
  priceUsd: number;
  vehicleType: VehicleCategoryId;
  preferredPlan?: PlanKey;
};

/**
 * De dónde sale la cifra mostrada.
 * - "msrp-oficial": MSRP de fábrica verificado. Se puede mostrar sin rodeos.
 * - "referencial-miami": rango prudente de mercado EE. UU. La UI DEBE
 *   etiquetarlo como referencial y no como precio de venta.
 * - "lista-peru": precio de concesionario peruano, NO precio Miami. Aplica a
 *   los contraejemplos que no conviene importar.
 */
export type TrendingVehiclePriceBasis =
  | "msrp-oficial"
  | "referencial-miami"
  | "lista-peru";

/**
 * Estado frente al 0% de ad valorem del APC Perú-EE. UU.
 * Recordar: solo los NUEVOS originarios llegan a 0%; un usado paga 6% aunque
 * tenga certificado de origen (ver `pricingConfig.adValoremByOrigin`).
 */
export type TrendingVehicleAdValoremStatus =
  /** Ensamblaje estadounidense exclusivo: candidato sólido a 0% con certificado. */
  | "candidato-0"
  /** Ensamblaje fuera de EE. UU.: 6%, sin discusión. */
  | "no-califica"
  /** Hay plantas en más de un país: se cotiza 6% hasta ver el VIN. */
  | "depende-vin";

/** Qué hacer con este vehículo desde el lado del negocio. */
export type TrendingVehicleImportViability =
  | "importable"
  | "importable-con-advertencia"
  /** Ya se consigue nuevo en Perú más barato: recomendar compra local. */
  | "no-conviene-importar";

export type TrendingVehicleWarningKind =
  | "homologacion"
  | "normativa"
  | "origen"
  | "disponibilidad"
  | "precio";

export type TrendingVehicleWarning = {
  kind: TrendingVehicleWarningKind;
  title: string;
  detail: string;
};

export type TrendingVehicle = {
  id: string;
  /** Nombre OFICIAL del fabricante, no un apodo comercial. */
  name: string;
  detail: string;
  segment: string;
  priceMinUsd: number;
  priceMaxUsd: number;
  priceBasis: TrendingVehiclePriceBasis;
  /** Qué incluye y qué no incluye la cifra. Texto para mostrar al cliente. */
  priceNote: string;
  /** País de ensamblaje final. Decide el ad valorem, no la marca. */
  assemblyCountry: string;
  /** Planta concreta cuando es única y verificable; null si no aplica. */
  assemblyPlant: string | null;
  adValorem: TrendingVehicleAdValoremStatus;
  adValoremNote: string;
  /** ¿Se consigue realmente en un dealer de EE. UU.? */
  availableInUsDealers: boolean;
  importViability: TrendingVehicleImportViability;
  warnings: readonly TrendingVehicleWarning[];
  /**
   * Ruta local bajo `/public/images/vehiculos/`, o null mientras no exista una
   * foto verificada con derecho de uso. Ver "REGLAS DE HONESTIDAD DEL
   * CATÁLOGO" arriba. La UI debe renderizar un placeholder, no una foto de
   * stock de otro vehículo.
   */
  imageSrc: string | null;
  /**
   * Descripción de lo que se ve de verdad: modelo, generación, ángulo, color y
   * los rasgos que permiten identificar la versión. Nunca un texto genérico
   * igual al nombre de la tarjeta.
   */
  imageAlt: string;
  /** Autor de la foto. Obligatorio si la licencia exige atribución. */
  imageCredit?: string;
  /** Licencia tal como la declara la fuente: "CC0 1.0", "CC BY 4.0", etc. */
  imageLicense?: string;
  /** Página de origen del archivo, para trazabilidad y para el enlace a la obra. */
  imageSourceUrl?: string;
  /**
   * null cuando el vehículo no se consigue en dealers de EE. UU. y por lo
   * tanto no tiene sentido simular su importación.
   */
  calculator: TrendingVehicleCalculatorPreset | null;
};

/**
 * Vehículo con preset de calculadora garantizado. Es lo que devuelve
 * `getTrendingVehicleById`, para que el consumidor no tenga que chequear null.
 */
export type ImportableTrendingVehicle = TrendingVehicle & {
  calculator: TrendingVehicleCalculatorPreset;
};

/**
 * ¿Esta licencia obliga a publicar el crédito?
 *
 * CC0 y dominio público NO obligan (el crédito se guarda igual, por
 * trazabilidad). Toda la familia CC BY —con o sin SA— SÍ obliga: la cláusula
 * 3(a)(1) exige nombrar al autor, enlazar la licencia y enlazar la obra. Si el
 * crédito no se publica, se está infringiendo la licencia.
 *
 * Ante una licencia desconocida devuelve `true`: se prefiere un crédito de más
 * a una infracción.
 */
export function licenciaExigeAtribucion(licencia?: string | null): boolean {
  if (!licencia) return false;
  const l = licencia.trim().toUpperCase();
  if (l.startsWith("CC0") || l.includes("PUBLIC DOMAIN") || l.includes("DOMINIO PÚBLICO")) {
    return false;
  }
  return true;
}

type RawVehicle = Omit<TrendingVehicle, "calculator">;

type RawPreset = {
  id: string;
  brand: string;
  model: string;
  vehicleType: VehicleCategoryId;
  priceUsd: number;
  preferredPlan?: PlanKey;
};

function buildTrendingVehicles(): TrendingVehicle[] {
  const presets = new Map<string, RawPreset>(
    (rawPresets as RawPreset[]).map((p) => [p.id, p]),
  );

  const built = (rawVehicles as RawVehicle[]).map((v): TrendingVehicle => {
    const preset = presets.get(v.id);

    // INVARIANTE: tiene preset de calculadora si y solo si se consigue en
    // dealers de EE. UU. Así un id mal escrito revienta en build en vez de
    // desaparecer silenciosamente de la calculadora.
    if (v.availableInUsDealers && !preset) {
      throw new Error(
        `[trendingVehicles] "${v.id}" está marcado availableInUsDealers=true ` +
          `pero no tiene entrada en trendingSimulationPresets.json.`,
      );
    }
    if (!v.availableInUsDealers && preset) {
      throw new Error(
        `[trendingVehicles] "${v.id}" NO se consigue en dealers de EE. UU. ` +
          `pero tiene preset de importación en trendingSimulationPresets.json. ` +
          `No simulamos importaciones que no se pueden ejecutar.`,
      );
    }

    if (v.imageSrc !== null && !v.imageSrc.startsWith("/")) {
      throw new Error(
        `[trendingVehicles] "${v.id}" apunta a una imagen externa ` +
          `("${v.imageSrc}"). Solo se aceptan fotos propias servidas desde ` +
          `/public. Ver "REGLAS DE HONESTIDAD DEL CATÁLOGO".`,
      );
    }

    // INVARIANTE LEGAL: una foto bajo licencia que exige atribución (CC BY y
    // derivadas) no se puede publicar sin autor ni enlace a la obra. Revienta
    // el build antes que la web salga infringiendo la licencia.
    if (v.imageSrc !== null && licenciaExigeAtribucion(v.imageLicense)) {
      if (!v.imageCredit || !v.imageSourceUrl) {
        throw new Error(
          `[trendingVehicles] "${v.id}" usa una foto con licencia ` +
            `"${v.imageLicense}", que EXIGE atribución, pero le falta ` +
            `${!v.imageCredit ? "imageCredit" : "imageSourceUrl"}. ` +
            `Publicarla así infringe la licencia. Ver docs/FOTOS.md.`,
        );
      }
    }

    // Una foto sin licencia declarada es una foto sin derecho de uso probado.
    if (v.imageSrc !== null && !v.imageLicense) {
      throw new Error(
        `[trendingVehicles] "${v.id}" tiene foto pero no declara ` +
          `imageLicense. Sin licencia verificada no se publica: ese fue el ` +
          `origen del problema con las fotos de stock. Ver docs/FOTOS.md.`,
      );
    }

    return {
      ...v,
      calculator: preset
        ? {
            brand: preset.brand,
            model: preset.model,
            priceUsd: preset.priceUsd,
            vehicleType: preset.vehicleType,
            preferredPlan: preset.preferredPlan,
          }
        : null,
    };
  });

  const huerfanos = (rawPresets as RawPreset[]).filter(
    (p) => !built.some((v) => v.id === p.id),
  );
  if (huerfanos.length > 0) {
    throw new Error(
      `[trendingVehicles] Presets sin vehículo: ${huerfanos
        .map((p) => p.id)
        .join(", ")}`,
    );
  }

  return built;
}

export const TRENDING_VEHICLES: readonly TrendingVehicle[] =
  buildTrendingVehicles();

export const TRENDING_BY_ID: Readonly<Record<string, TrendingVehicle>> =
  Object.fromEntries(TRENDING_VEHICLES.map((v) => [v.id, v]));

/** Los que sí tiene sentido cotizar: se consiguen y se pueden traer. */
export const IMPORTABLE_TRENDING_VEHICLES: readonly ImportableTrendingVehicle[] =
  TRENDING_VEHICLES.filter(
    (v): v is ImportableTrendingVehicle => v.calculator !== null,
  );

/** Los contraejemplos honestos: ya se consiguen nuevos en Perú. */
export const LOCAL_ALTERNATIVE_VEHICLES: readonly TrendingVehicle[] =
  TRENDING_VEHICLES.filter((v) => v.importViability === "no-conviene-importar");

/**
 * Devuelve el vehículo SOLO si tiene preset de calculadora, para que quien
 * precarga el simulador reciba `calculator` siempre definido.
 */
export function getTrendingVehicleById(
  id: string,
): ImportableTrendingVehicle | undefined {
  const vehicle = TRENDING_BY_ID[id];
  if (!vehicle || vehicle.calculator === null) {
    return undefined;
  }
  return vehicle as ImportableTrendingVehicle;
}

/** Cualquier vehículo del catálogo, tenga o no preset de importación. */
export function getCatalogVehicleById(id: string): TrendingVehicle | undefined {
  return TRENDING_BY_ID[id];
}
