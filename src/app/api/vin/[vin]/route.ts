/**
 * GET /api/vin/{VIN} — decodifica un VIN contra NHTSA vPIC.
 *
 * Es el único "enriquecimiento automático" de datos que LuxCars puede usar de
 * forma legal (el porqué completo está en `src/lib/vin.ts`): vPIC es del
 * Departamento de Transporte de EE.UU., es gratuito, no pide llave y no
 * prohíbe almacenar su respuesta. Devuelve la ficha técnica del VIN, no
 * inventario de un tercero.
 *
 * NO SE LLAMA A vPIC DESDE EL NAVEGADOR. Va por este Route Handler para poder:
 *   · validar el VIN antes de gastar una petición,
 *   · poner un timeout (vPIC se pone lento en horario pico de EE.UU. y el
 *     formulario no puede quedarse colgado esperando),
 *   · cachear en la capa de datos de Next: un VIN decodifica SIEMPRE igual,
 *     así que la segunda carga del mismo auto es instantánea y no molesta a
 *     una API pública gratuita,
 *   · traducir a español y al vocabulario del motor de precios en un solo
 *     lugar, y no repetirlo en cada formulario que lo necesite.
 *
 * Nunca lanza: todo error sale como JSON con `ok: false` y un mensaje en
 * español. El formulario de alta debe seguir funcionando aunque vPIC esté caído
 * — se escriben los datos a mano y listo.
 */

import { validateVin, type VinDecoded, type VinLookupResponse } from "@/lib/vin";
import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import { NextResponse } from "next/server";

const VPIC_ENDPOINT = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

/** vPIC responde en menos de un segundo cuando está sano. 8s es rendirse. */
const TIMEOUT_MS = 8_000;

/**
 * Un VIN decodifica igual hoy que dentro de un año: la respuesta se puede
 * cachear sin límite práctico. 30 días es un equilibrio entre no molestar a una
 * API pública gratuita y recoger correcciones del fabricante.
 */
const CACHE_SECONDS = 60 * 60 * 24 * 30;

/** Fila plana de `DecodeVinValues`. Solo los campos que se usan. */
type VpicRow = Partial<Record<string, string>>;

function clean(value: string | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  // vPIC marca lo que no aplica con estas cadenas en vez de dejarlas vacías.
  if (/^(not applicable|n\/a|unknown)$/i.test(text)) return null;
  return text;
}

function toInt(value: string | undefined): number | null {
  const text = clean(value);
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFloat(value: string | undefined): number | null {
  const text = clean(value);
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Cilindrada en cc. vPIC a veces trae `DisplacementCC` (3982.0) y a veces solo
 * `DisplacementL` (3.0). Se prefiere cc y se convierte desde litros si falta.
 */
function resolveEngineCc(row: VpicRow): number | null {
  const cc = toFloat(row.DisplacementCC);
  if (cc !== null && cc > 0) return Math.round(cc);
  const liters = toFloat(row.DisplacementL);
  if (liters !== null && liters > 0) return Math.round(liters * 1000);
  return null;
}

const FUEL_ES: Record<string, string> = {
  gasoline: "Gasolina",
  diesel: "Diésel",
  electric: "Eléctrico",
  "natural gas": "Gas natural",
  "compressed natural gas": "Gas natural comprimido (GNC)",
  "liquefied petroleum gas": "Gas licuado (GLP)",
  ethanol: "Etanol",
  "flexible fuel": "Combustible flexible (FFV)",
  hydrogen: "Hidrógeno",
};

function translateFuel(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  for (const [key, es] of Object.entries(FUEL_ES)) {
    if (lower.includes(key)) return es;
  }
  return raw;
}

/**
 * Sugiere la categoría del motor de precios. ES UNA SUGERENCIA: el formulario
 * la deja modificable porque de ella depende el ISC, y equivocarse ahí cambia
 * el precio final del auto.
 *
 * OJO con el híbrido: un mild-hybrid de 48V NO es HEV para efectos tributarios
 * — tributa como gasolina (ver el tooltip de `hev` en vehicleCategories.ts).
 * vPIC los distingue en `ElectrificationLevel`, así que aquí se respeta esa
 * distinción en vez de mandar todo lo que diga "hybrid" a la categoría HEV.
 */
function suggestCategory(
  fuel: string | null,
  electrification: string | null,
): VehicleCategoryId | null {
  const level = (electrification ?? "").toLowerCase();
  const fuelLower = (fuel ?? "").toLowerCase();

  if (level.includes("bev") || fuelLower === "electric") return "ev";
  if (level.includes("phev") || level.includes("plug-in")) return "phev";
  // "Mild HEV" / "Micro" tributan como gasolina; solo el híbrido full es HEV.
  if (level.includes("mild") || level.includes("micro")) return "gasolina";
  if (level.includes("hev") || level.includes("strong")) return "hev";

  if (fuelLower.includes("diesel")) return "diesel";
  if (fuelLower.includes("gasoline") || fuelLower.includes("ethanol"))
    return "gasolina";

  return null;
}

/** Países que aparecen de verdad en el catálogo de LuxCars. */
const COUNTRY_ES: Record<string, string> = {
  "united states (usa)": "Estados Unidos",
  "united states": "Estados Unidos",
  usa: "Estados Unidos",
  austria: "Austria",
  germany: "Alemania",
  japan: "Japón",
  mexico: "México",
  canada: "Canadá",
  "south korea": "Corea del Sur",
  korea: "Corea del Sur",
  "united kingdom (uk)": "Reino Unido",
  "united kingdom": "Reino Unido",
  italy: "Italia",
  spain: "España",
  france: "Francia",
  china: "China",
  brazil: "Brasil",
  argentina: "Argentina",
  thailand: "Tailandia",
  india: "India",
  "south africa": "Sudáfrica",
  slovakia: "Eslovaquia",
  hungary: "Hungría",
  "czech republic": "República Checa",
  belgium: "Bélgica",
  netherlands: "Países Bajos",
  sweden: "Suecia",
  turkey: "Turquía",
  portugal: "Portugal",
  poland: "Polonia",
};

function translateCountry(raw: string | null): string | null {
  if (!raw) return null;
  const es = COUNTRY_ES[raw.trim().toLowerCase()];
  if (es) return es;
  // Título en vez del MAYÚSCULA SOSTENIDA con el que vPIC devuelve los países.
  return raw
    .toLowerCase()
    .replace(/\b[a-záéíóúñ]/g, (c) => c.toUpperCase());
}

function mapRow(vin: string, row: VpicRow): VinDecoded {
  const fuelRaw = clean(row.FuelTypePrimary);
  const electrification = clean(row.ElectrificationLevel);

  return {
    vin,
    brand: clean(row.Make),
    model: clean(row.Model),
    year: toInt(row.ModelYear),
    bodyStyle: clean(row.BodyClass),
    engineCc: resolveEngineCc(row),
    fuelType: translateFuel(fuelRaw),
    fuelTypeRaw: fuelRaw,
    suggestedCategory: suggestCategory(fuelRaw, electrification),
    assemblyCountry: translateCountry(clean(row.PlantCountry)),
    assemblyPlant:
      [clean(row.PlantCity), clean(row.PlantCompanyName)]
        .filter(Boolean)
        .join(" · ") || null,
    trim: clean(row.Trim) ?? clean(row.Series),
    doors: toInt(row.Doors),
    drivetrain: clean(row.DriveType),
    transmission:
      [clean(row.TransmissionStyle), clean(row.TransmissionSpeeds)]
        .filter(Boolean)
        .join(" · ") || null,
    vehicleType: clean(row.VehicleType),
    manufacturer: clean(row.Manufacturer),
  };
}

/** Lo que el usuario debe saber sin tener que comparar campo por campo. */
function buildNotices(data: VinDecoded, row: VpicRow): string[] {
  const notices: string[] = [];

  const errorText = clean(row.ErrorText);
  // vPIC devuelve "0 - VIN decoded clean. Check Digit (9th position) is correct".
  if (errorText && !/^0\s*-/.test(errorText)) {
    notices.push(`NHTSA reporta: ${errorText}`);
  }

  const missing: string[] = [];
  if (!data.brand) missing.push("marca");
  if (!data.model) missing.push("modelo");
  if (!data.year) missing.push("año");
  if (!data.bodyStyle) missing.push("carrocería");
  if (!data.engineCc) missing.push("cilindrada");
  if (!data.fuelType) missing.push("combustible");
  if (!data.assemblyCountry) missing.push("país de ensamblaje");

  if (missing.length) {
    notices.push(
      `vPIC no tiene ${missing.join(", ")} para este VIN. Complétalo a mano con la ficha del dealer.`,
    );
  }

  if (!data.suggestedCategory) {
    notices.push(
      "No se pudo deducir la categoría (gasolina / híbrido / diésel / eléctrico). Elígela a mano: de ella depende el ISC.",
    );
  }

  return notices;
}

function json(body: VinLookupResponse, status: number): NextResponse {
  return NextResponse.json(body, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ vin: string }> },
): Promise<NextResponse> {
  const { vin: rawVin } = await context.params;
  const validation = validateVin(decodeURIComponent(rawVin ?? ""));

  if (!validation.valid) {
    return json(
      {
        ok: false,
        vin: validation.vin,
        code: "vin-invalido",
        error: validation.reason,
      },
      400,
    );
  }

  const vin = validation.vin;

  let response: Response;
  try {
    response = await fetch(
      `${VPIC_ENDPOINT}/${encodeURIComponent(vin)}?format=json`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // Legal cachear: la respuesta es de una API del gobierno de EE.UU.,
        // sin cláusula que lo prohíba (a diferencia del inventario de terceros).
        next: { revalidate: CACHE_SECONDS, tags: ["vin"] },
      },
    );
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return json(
      {
        ok: false,
        vin,
        code: "upstream-error",
        error: timedOut
          ? "NHTSA no respondió en 8 segundos. Escribe los datos a mano o vuelve a intentar en un momento."
          : "No se pudo contactar a NHTSA. Escribe los datos a mano y guarda igual: el VIN queda registrado.",
      },
      504,
    );
  }

  if (!response.ok) {
    return json(
      {
        ok: false,
        vin,
        code: "upstream-error",
        error: `NHTSA respondió ${response.status}. Escribe los datos a mano; el auto se guarda igual.`,
      },
      502,
    );
  }

  let payload: { Results?: VpicRow[] };
  try {
    payload = (await response.json()) as { Results?: VpicRow[] };
  } catch {
    return json(
      {
        ok: false,
        vin,
        code: "upstream-error",
        error: "NHTSA devolvió una respuesta ilegible. Escribe los datos a mano.",
      },
      502,
    );
  }

  const row = payload.Results?.[0];
  if (!row) {
    return json(
      {
        ok: false,
        vin,
        code: "sin-datos",
        error: "NHTSA no devolvió datos para este VIN.",
      },
      404,
    );
  }

  const data = mapRow(vin, row);

  // Un VIN sintáctico pero inexistente decodifica "vacío": ni marca ni año.
  // Eso no es un éxito con campos faltantes, es un VIN que no existe.
  if (!data.brand && !data.model && !data.year) {
    return json(
      {
        ok: false,
        vin,
        code: "sin-datos",
        error:
          "NHTSA no reconoce este VIN. Verifica que esté bien copiado; si el auto no se comercializa en EE.UU., carga los datos a mano.",
      },
      404,
    );
  }

  return json({ ok: true, vin, data, notices: buildNotices(data, row) }, 200);
}
