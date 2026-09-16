/**
 * Lectura del stock PROPIO y curado.
 *
 * ADVERTENCIA CONTRACTUAL (detalle completo en `types.ts` y en la migración
 * `supabase/migrations/20260915090200_vehicles.sql`): las filas de `vehicles`
 * solo pueden nacer de carga manual en el admin, del decodificador de VIN de
 * NHTSA vPIC o de feeds de dealers partner con licencia firmada. Queda
 * PROHIBIDO insertar inventario de MarketCheck, Auto.dev, eBay, Autotrader,
 * CarGurus, Cars.com, TrueCar, AutoTempest o Facebook Marketplace.
 *
 * POR QUÉ SE CONSULTA UNA VISTA Y NO LA TABLA: `public.vehicles` tiene GRANT
 * por columna, así que `select *` FALLA para el rol anónimo — es deliberado,
 * protege `precio_compra` y `notas_internas`. El camino público es la vista
 * `public.vehiculos_publicos` (security_invoker, ya filtrada por `publicado`).
 *
 * Este módulo NUNCA lanza: sin base de datos devuelve `[]` / `null` y el sitio
 * sigue funcionando igual.
 */

import {
  getPublicStorageUrl,
  getSupabaseClient,
  isDatabaseConfigured,
  warnOnce,
} from "./client";
import type {
  Currency,
  PublicVehicleRow,
  Vehicle,
  VehicleCategoryId,
  VehicleCondition,
  VehicleFilters,
  VehiclePhoto,
  VehiclePhotoRow,
  VehicleSort,
  VehicleStatus,
} from "./types";
import {
  CURRENCIES,
  VEHICLE_CATEGORY_IDS,
  VEHICLE_CONDITIONS,
  VEHICLE_STATUSES,
} from "./types";

/** Vista pública. Ver la nota de arriba: no se consulta `vehicles` directamente. */
const PUBLIC_VIEW = "vehiculos_publicos";
const PHOTOS_TABLE = "vehicle_photos";

/** Columnas de `vehicle_photos` con GRANT para `anon`. Pedir `*` fallaría. */
const PHOTO_COLUMNS =
  "id, vehicle_id, storage_path, url_publica, alt, orden, es_principal, ancho_px, alto_px";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

/* ========================================================================== */
/* Mapeo fila -> dominio                                                      */
/* ========================================================================== */

function toNumberOrNull(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickFrom<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function mapPhoto(row: VehiclePhotoRow, index: number): VehiclePhoto {
  return {
    id: row.id,
    path: row.storage_path,
    // `url_publica` viene materializada; si el admin no la guardó, se arma.
    url: row.url_publica ?? getPublicStorageUrl(row.storage_path),
    alt: row.alt ?? "",
    position: typeof row.orden === "number" ? row.orden : index,
    isCover: row.es_principal === true,
    widthPx: row.ancho_px,
    heightPx: row.alto_px,
  };
}

function mapVehicle(row: PublicVehicleRow, photos: VehiclePhoto[] = []): Vehicle {
  const title =
    row.titular?.trim() ||
    [row.anio, row.marca, row.modelo, row.version]
      .filter(Boolean)
      .join(" ")
      .trim();

  const coverPhoto =
    row.foto_portada_url || photos.find((p) => p.isCover)
      ? {
          url: row.foto_portada_url ?? photos.find((p) => p.isCover)?.url ?? null,
          alt:
            row.foto_portada_alt ??
            photos.find((p) => p.isCover)?.alt ??
            title,
        }
      : null;

  return {
    id: row.id,
    slug: row.slug,

    brand: row.marca,
    model: row.modelo,
    trim: row.version,
    year: row.anio,
    bodyStyle: row.carroceria,

    category: pickFrom<VehicleCategoryId>(
      row.categoria,
      VEHICLE_CATEGORY_IDS,
      "gasolina",
    ),
    condition: pickFrom<VehicleCondition>(
      row.condicion,
      VEHICLE_CONDITIONS,
      "usado",
    ),
    engineCc: toNumberOrNull(row.cilindrada_cc),
    transmission: row.transmision,
    drivetrain: row.traccion,
    exteriorColor: row.color_exterior,
    doors: toNumberOrNull(row.puertas),
    seats: toNumberOrNull(row.asientos),
    mileageKm: toNumberOrNull(row.kilometraje_km) ?? 0,

    price: toNumberOrNull(row.precio_venta),
    currency: pickFrom<Currency>(row.moneda_venta, CURRENCIES, "USD"),
    priceNegotiable: row.precio_negociable !== false,

    status: pickFrom<VehicleStatus>(row.estado, VEHICLE_STATUSES, "disponible"),
    location: row.ubicacion,
    title,
    description: row.descripcion,
    highlights: Array.isArray(row.destacados) ? row.destacados : [],
    publishedAt: row.publicado_en,

    coverPhoto,
    photos,
  };
}

/* ========================================================================== */
/* Consultas                                                                  */
/* ========================================================================== */

/**
 * Lo mínimo que necesitamos del builder de PostgREST para ordenar, sin
 * acoplarnos a los genéricos internos de supabase-js (cambian entre menores).
 */
type Orderable<T> = {
  order(
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): T;
};

function applySort<T extends Orderable<T>>(
  query: T,
  sort: VehicleSort | undefined,
): T {
  switch (sort) {
    case "precio-asc":
      return query.order("precio_venta", { ascending: true, nullsFirst: false });
    case "precio-desc":
      return query.order("precio_venta", {
        ascending: false,
        nullsFirst: false,
      });
    case "anio-desc":
      return query.order("anio", { ascending: false });
    case "km-asc":
      return query.order("kilometraje_km", { ascending: true });
    case "recientes":
    default:
      return query.order("publicado_en", {
        ascending: false,
        nullsFirst: false,
      });
  }
}

/**
 * Vehículos publicados que cumplen los filtros.
 *
 * Sin base de datos configurada devuelve `[]` y lo avisa UNA sola vez por
 * proceso (no en cada render). Ante un error de red o de SQL también devuelve
 * `[]`: la página nunca debe romperse por el inventario.
 *
 * Trae la foto de portada. La galería completa llega en `getVehicleById`.
 */
export async function getPublishedVehicles(
  filters: VehicleFilters = {},
): Promise<Vehicle[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    warnOnce(
      "vehicles:no-db",
      "Sin Supabase configurado: getPublishedVehicles() devuelve []. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example).",
    );
    return [];
  }

  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(filters.offset ?? 0, 0);

  try {
    // La vista ya filtra `publicado`; no hace falta repetirlo.
    let query = supabase.from(PUBLIC_VIEW).select("*");

    if (filters.category) {
      query = Array.isArray(filters.category)
        ? query.in("categoria", filters.category)
        : query.eq("categoria", filters.category);
    }
    if (filters.condition) query = query.eq("condicion", filters.condition);
    if (filters.status) {
      query = Array.isArray(filters.status)
        ? query.in("estado", filters.status)
        : query.eq("estado", filters.status);
    }
    if (filters.brand) query = query.ilike("marca", filters.brand);
    if (typeof filters.yearMin === "number")
      query = query.gte("anio", filters.yearMin);
    if (typeof filters.yearMax === "number")
      query = query.lte("anio", filters.yearMax);
    if (typeof filters.priceMin === "number")
      query = query.gte("precio_venta", filters.priceMin);
    if (typeof filters.priceMax === "number")
      query = query.lte("precio_venta", filters.priceMax);
    if (typeof filters.maxMileageKm === "number")
      query = query.lte("kilometraje_km", filters.maxMileageKm);

    const search = filters.search?.trim();
    if (search) {
      // `%`, `,` y paréntesis romperían el parser de `or` de PostgREST.
      const safe = search.replace(/[%,()]/g, " ").trim();
      if (safe) {
        query = query.or(
          `marca.ilike.%${safe}%,modelo.ilike.%${safe}%,version.ilike.%${safe}%,titular.ilike.%${safe}%`,
        );
      }
    }

    const { data, error } = await applySort(query, filters.sort).range(
      offset,
      offset + limit - 1,
    );

    if (error) {
      warnOnce(
        `vehicles:error:${error.code ?? "unknown"}`,
        `getPublishedVehicles() falló (${error.message}). Se devuelve lista vacía.`,
      );
      return [];
    }

    return ((data ?? []) as unknown as PublicVehicleRow[]).map((row) =>
      mapVehicle(row),
    );
  } catch (error) {
    warnOnce(
      "vehicles:exception",
      `getPublishedVehicles() lanzó una excepción inesperada: ${
        error instanceof Error ? error.message : String(error)
      }. Se devuelve lista vacía.`,
    );
    return [];
  }
}

/**
 * Un vehículo publicado por id (UUID) o por slug, con la galería completa.
 *
 * Devuelve `null` si no hay base de datos, si no existe o si no está publicado.
 * Nunca lanza: el consumidor debe tratar `null` como 404.
 */
export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const key = id?.trim();
  if (!key) return null;

  const supabase = getSupabaseClient();
  if (!supabase) {
    warnOnce(
      "vehicles:no-db",
      "Sin Supabase configurado: getVehicleById() devuelve null. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example).",
    );
    return null;
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

  try {
    const { data, error } = await supabase
      .from(PUBLIC_VIEW)
      .select("*")
      .eq(isUuid ? "id" : "slug", key)
      .limit(1)
      .maybeSingle();

    if (error) {
      warnOnce(
        `vehicles:detail-error:${error.code ?? "unknown"}`,
        `getVehicleById() falló (${error.message}). Se devuelve null.`,
      );
      return null;
    }
    if (!data) return null;

    const row = data as unknown as PublicVehicleRow;
    return mapVehicle(row, await getVehiclePhotos(row.id));
  } catch (error) {
    warnOnce(
      "vehicles:detail-exception",
      `getVehicleById() lanzó una excepción inesperada: ${
        error instanceof Error ? error.message : String(error)
      }. Se devuelve null.`,
    );
    return null;
  }
}

/**
 * Galería de un vehículo, ordenada con la portada primero.
 *
 * Va en consulta aparte porque PostgREST no infiere la relación entre la vista
 * `vehiculos_publicos` y `vehicle_photos`. El RLS de `vehicle_photos` ya impide
 * ver fotos de autos no publicados, así que esto no filtra nada de más.
 */
export async function getVehiclePhotos(vehicleId: string): Promise<VehiclePhoto[]> {
  const supabase = getSupabaseClient();
  if (!supabase || !vehicleId) return [];

  try {
    const { data, error } = await supabase
      .from(PHOTOS_TABLE)
      .select(PHOTO_COLUMNS)
      .eq("vehicle_id", vehicleId)
      .order("es_principal", { ascending: false })
      .order("orden", { ascending: true });

    if (error) {
      warnOnce(
        `vehicles:photos-error:${error.code ?? "unknown"}`,
        `getVehiclePhotos() falló (${error.message}). La ficha se muestra sin galería.`,
      );
      return [];
    }

    return ((data ?? []) as unknown as VehiclePhotoRow[]).map(mapPhoto);
  } catch (error) {
    warnOnce(
      "vehicles:photos-exception",
      `getVehiclePhotos() lanzó una excepción inesperada: ${
        error instanceof Error ? error.message : String(error)
      }. La ficha se muestra sin galería.`,
    );
    return [];
  }
}

/**
 * Últimas unidades disponibles, para la portada.
 * Sin base de datos devuelve `[]` y la sección simplemente no se muestra.
 */
export async function getLatestVehicles(limit = 6): Promise<Vehicle[]> {
  return getPublishedVehicles({
    status: "disponible",
    limit,
    sort: "recientes",
  });
}

/** `true` si hay stock publicado que mostrar. Nunca lanza. */
export async function hasPublishedVehicles(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const vehicles = await getPublishedVehicles({ limit: 1 });
  return vehicles.length > 0;
}
