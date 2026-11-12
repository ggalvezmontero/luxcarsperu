/**
 * Reglas de un "ejemplo de importación a pedido": los autos de referencia que
 * salen en la home y en /importar, y que precargan la calculadora.
 *
 * Antes vivían solo en `src/data/trendingVehicles.json` y sus reglas se
 * comprobaban al compilar (`buildTrendingVehicles`). Ahora el dueño los edita
 * desde el portal y se guardan en la base (`public.ejemplos_importacion`), así
 * que las MISMAS reglas se aplican en dos momentos:
 *
 *   · al guardar desde el portal, para decirle qué falta;
 *   · al leer para pintar la web, para descartar una fila que no las cumpla.
 *
 * Son las "reglas de honestidad del catálogo" de `trendingVehicles.ts`, sin
 * rebajar ninguna: foto solo propia y con licencia, crédito obligatorio si la
 * licencia lo exige, y simulación solo para autos que se consiguen en EE.UU.
 *
 * Sin dependencias de servidor: lo usan el portal (navegador) y la web.
 */

import type { PlanKey } from "@/core/pricing/pricingConfig";
import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import {
  licenciaExigeAtribucion,
  type TrendingVehicle,
  type TrendingVehicleAdValoremStatus,
  type TrendingVehicleCalculatorPreset,
  type TrendingVehicleImportViability,
  type TrendingVehiclePriceBasis,
  type TrendingVehicleWarning,
  type TrendingVehicleWarningKind,
} from "@/data/trendingVehicles";
import { VEHICLE_PHOTOS_BUCKET, getStorageEndpoint } from "@/lib/db/storage";

export const PRICE_BASES: readonly TrendingVehiclePriceBasis[] = [
  "msrp-oficial",
  "referencial-miami",
  "lista-peru",
];
export const AD_VALOREM_STATUSES: readonly TrendingVehicleAdValoremStatus[] = [
  "candidato-0",
  "no-califica",
  "depende-vin",
];
export const IMPORT_VIABILITIES: readonly TrendingVehicleImportViability[] = [
  "importable",
  "importable-con-advertencia",
  "no-conviene-importar",
];
export const WARNING_KINDS: readonly TrendingVehicleWarningKind[] = [
  "homologacion",
  "normativa",
  "origen",
  "disponibilidad",
  "precio",
];
export const EXAMPLE_VEHICLE_TYPES: readonly VehicleCategoryId[] = [
  "gasolina",
  "hev",
  "phev",
  "ev",
  "diesel",
];
export const EXAMPLE_PLANS: readonly PlanKey[] = ["fast", "standard"];

/** El id es parte de la URL (`/importar/<id>` y `/?simular=<id>`): minúsculas, números y guiones. */
export const EXAMPLE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const EXAMPLE_LIMITS = {
  id: 80,
  name: 120,
  detail: 600,
  segment: 60,
  priceNote: 400,
  assembly: 120,
  adValoremNote: 600,
  imageAlt: 400,
  imageCredit: 160,
  imageLicense: 60,
  url: 500,
  brand: 60,
  model: 80,
  warnings: 8,
  warningTitle: 120,
  warningDetail: 600,
  /** Tope de cualquier precio, en USD enteros. */
  price: 99_999_999,
} as const;

/**
 * Con menos ejemplos válidos que esto la web usa la lista de respaldo del
 * repositorio. La home muestra tres: no puede quedar una fila a medias.
 */
export const MIN_EXAMPLES = 3;

export type ExampleValidation =
  | { ok: true; vehiculo: TrendingVehicle }
  | { ok: false; campo: string; error: string };

function fallo(campo: string, error: string): ExampleValidation {
  return { ok: false, campo, error };
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" ? valor.trim() : null;
}

function entero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isInteger(valor) ? valor : null;
}

/** Prefijo de las fotos subidas al bucket propio; `null` sin configuración. */
export function ownBucketPrefix(): string | null {
  const endpoint = getStorageEndpoint();
  return endpoint ? `${endpoint}/${VEHICLE_PHOTOS_BUCKET}/` : null;
}

/**
 * ¿La foto es propia? Vale un archivo del sitio (`/images/…`) o uno del bucket
 * de Luxcars. Nada enlazado desde otro dominio: ese fue el origen de las fotos
 * que no correspondían al auto.
 */
export function isOwnImage(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  const prefijo = ownBucketPrefix();
  return prefijo !== null && src.startsWith(prefijo);
}

function esUrlWeb(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Comprueba un ejemplo y lo devuelve normalizado (solo los campos conocidos,
 * textos sin espacios sobrantes). `datos` puede venir de un formulario o de la
 * base: no se confía en su forma.
 */
export function validarEjemplo(datos: unknown): ExampleValidation {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    return fallo("datos", "El ejemplo no tiene la forma esperada.");
  }
  const d = datos as Record<string, unknown>;
  const L = EXAMPLE_LIMITS;

  const id = texto(d.id);
  if (!id || id.length > L.id || !EXAMPLE_ID_PATTERN.test(id)) {
    return fallo("id", "El identificador solo lleva minúsculas, números y guiones (ej. ford-bronco-raptor).");
  }

  const name = texto(d.name);
  if (!name || name.length < 2 || name.length > L.name) {
    return fallo("name", "Escribe el nombre oficial del modelo.");
  }

  const segment = texto(d.segment);
  if (!segment || segment.length > L.segment) {
    return fallo("segment", "Indica el segmento (ej. SUV · gasolina).");
  }

  const detail = texto(d.detail) ?? "";
  if (detail.length > L.detail) return fallo("detail", "La descripción es demasiado larga.");

  const priceMinUsd = entero(d.priceMinUsd);
  const priceMaxUsd = entero(d.priceMaxUsd);
  if (priceMinUsd === null || priceMinUsd < 0 || priceMinUsd > L.price) {
    return fallo("priceMinUsd", "El precio mínimo debe ser un número entero en USD.");
  }
  if (priceMaxUsd === null || priceMaxUsd < priceMinUsd || priceMaxUsd > L.price) {
    return fallo("priceMaxUsd", "El precio máximo debe ser un entero en USD, igual o mayor al mínimo.");
  }

  const priceBasis = d.priceBasis as TrendingVehiclePriceBasis;
  if (!PRICE_BASES.includes(priceBasis)) {
    return fallo("priceBasis", "Indica de dónde sale el precio.");
  }
  const priceNote = texto(d.priceNote) ?? "";
  if (priceNote.length > L.priceNote) return fallo("priceNote", "La nota del precio es demasiado larga.");

  const assemblyCountry = texto(d.assemblyCountry) ?? "";
  if (assemblyCountry.length > L.assembly) return fallo("assemblyCountry", "El país de ensamblaje es demasiado largo.");
  const assemblyPlant = texto(d.assemblyPlant) || null;
  if (assemblyPlant && assemblyPlant.length > L.assembly) {
    return fallo("assemblyPlant", "El nombre de la planta es demasiado largo.");
  }

  const adValorem = d.adValorem as TrendingVehicleAdValoremStatus;
  if (!AD_VALOREM_STATUSES.includes(adValorem)) {
    return fallo("adValorem", "Indica cómo queda frente al 0% de ad valorem.");
  }
  const adValoremNote = texto(d.adValoremNote) ?? "";
  if (adValoremNote.length > L.adValoremNote) return fallo("adValoremNote", "La nota de ad valorem es demasiado larga.");

  if (typeof d.availableInUsDealers !== "boolean") {
    return fallo("availableInUsDealers", "Indica si el auto se consigue en dealers de EE.UU.");
  }
  const availableInUsDealers = d.availableInUsDealers;

  const importViability = d.importViability as TrendingVehicleImportViability;
  if (!IMPORT_VIABILITIES.includes(importViability)) {
    return fallo("importViability", "Indica si conviene importarlo.");
  }

  const warningsRaw = d.warnings === undefined || d.warnings === null ? [] : d.warnings;
  if (!Array.isArray(warningsRaw) || warningsRaw.length > L.warnings) {
    return fallo("warnings", "Las advertencias no tienen la forma esperada.");
  }
  const warnings: TrendingVehicleWarning[] = [];
  for (const cruda of warningsRaw) {
    const w = (cruda ?? {}) as Record<string, unknown>;
    const kind = w.kind as TrendingVehicleWarningKind;
    const title = texto(w.title);
    const wDetail = texto(w.detail) ?? "";
    if (!WARNING_KINDS.includes(kind) || !title || title.length > L.warningTitle || wDetail.length > L.warningDetail) {
      return fallo("warnings", "Una advertencia está incompleta o es demasiado larga.");
    }
    warnings.push({ kind, title, detail: wDetail });
  }

  // --- Foto: propia, con licencia, y con crédito si la licencia lo exige ----
  const imageSrc = texto(d.imageSrc) || null;
  const imageAlt = texto(d.imageAlt) ?? "";
  const imageLicense = texto(d.imageLicense) || undefined;
  const imageCredit = texto(d.imageCredit) || undefined;
  const imageSourceUrl = texto(d.imageSourceUrl) || undefined;

  if (imageAlt.length > L.imageAlt) return fallo("imageAlt", "La descripción de la foto es demasiado larga.");
  if (imageCredit && imageCredit.length > L.imageCredit) return fallo("imageCredit", "El crédito de la foto es demasiado largo.");
  if (imageLicense && imageLicense.length > L.imageLicense) return fallo("imageLicense", "La licencia de la foto es demasiado larga.");
  if (imageSourceUrl && (imageSourceUrl.length > L.url || !esUrlWeb(imageSourceUrl))) {
    return fallo("imageSourceUrl", "El enlace a la fuente de la foto no es una dirección web válida.");
  }

  if (imageSrc !== null) {
    if (imageSrc.length > L.url || !isOwnImage(imageSrc)) {
      return fallo("imageSrc", "Solo se aceptan fotos propias: subidas desde el portal o guardadas en el sitio. No se enlazan fotos de otras páginas.");
    }
    if (imageAlt.length < 10) {
      return fallo("imageAlt", "Describe lo que se ve en la foto: modelo, color y ángulo.");
    }
    if (!imageLicense) {
      return fallo("imageLicense", "Indica la licencia de la foto. Sin licencia verificada no se publica.");
    }
    if (licenciaExigeAtribucion(imageLicense) && (!imageCredit || !imageSourceUrl)) {
      return fallo(
        !imageCredit ? "imageCredit" : "imageSourceUrl",
        `La licencia "${imageLicense}" exige nombrar al autor y enlazar la obra.`,
      );
    }
  }

  // --- Simulación: solo para autos que se consiguen en EE.UU. ---------------
  let calculator: TrendingVehicleCalculatorPreset | null = null;
  if (d.calculator !== null && d.calculator !== undefined) {
    const c = d.calculator as Record<string, unknown>;
    const brand = texto(c.brand);
    const model = texto(c.model);
    const priceUsd = entero(c.priceUsd);
    const vehicleType = c.vehicleType as VehicleCategoryId;
    const preferredPlan = c.preferredPlan as PlanKey | undefined;
    if (!brand || brand.length > L.brand) return fallo("calculator.brand", "Falta la marca para la calculadora.");
    if (!model || model.length > L.model) return fallo("calculator.model", "Falta el modelo para la calculadora.");
    if (priceUsd === null || priceUsd < 1 || priceUsd > L.price) {
      return fallo("calculator.priceUsd", "El precio para la calculadora debe ser un entero en USD.");
    }
    if (!EXAMPLE_VEHICLE_TYPES.includes(vehicleType)) {
      return fallo("calculator.vehicleType", "Indica el tipo de motor para la calculadora.");
    }
    if (preferredPlan !== undefined && preferredPlan !== null && !EXAMPLE_PLANS.includes(preferredPlan)) {
      return fallo("calculator.preferredPlan", "El plan de entrega no es válido.");
    }
    calculator = { brand, model, priceUsd, vehicleType, ...(preferredPlan ? { preferredPlan } : {}) };
  }
  if (availableInUsDealers && calculator === null) {
    return fallo("calculator", "Un auto que se consigue en EE.UU. necesita los datos para la calculadora.");
  }
  if (!availableInUsDealers && calculator !== null) {
    return fallo("calculator", "No se simula la importación de un auto que no se consigue en dealers de EE.UU.");
  }

  return {
    ok: true,
    vehiculo: {
      id,
      name,
      detail,
      segment,
      priceMinUsd,
      priceMaxUsd,
      priceBasis,
      priceNote,
      assemblyCountry,
      assemblyPlant,
      adValorem,
      adValoremNote,
      availableInUsDealers,
      importViability,
      warnings,
      imageSrc,
      imageAlt,
      ...(imageCredit ? { imageCredit } : {}),
      ...(imageLicense ? { imageLicense } : {}),
      ...(imageSourceUrl ? { imageSourceUrl } : {}),
      calculator,
    },
  };
}
