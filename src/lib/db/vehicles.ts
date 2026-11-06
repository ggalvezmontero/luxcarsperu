/**
 * Lectura del stock PROPIO y curado.
 *
 * ADVERTENCIA CONTRACTUAL (detalle completo en `types.ts` y en la migración
 * `db/migrations/20260915090200_vehicles.sql`): las filas de `vehicles`
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
 *
 * EXCEPCIÓN EXPLÍCITA Y CON OTRO NOMBRE: `getPublishedVehiclesOrThrow()` y
 * `getVehicleByIdOrThrow()`. Existen para las páginas con ISR (`revalidate`).
 * Next solo conserva la última página buena si la regeneración LANZA; si la
 * lectura devuelve `[]` ante un error pasajero de Neon, esa página vacía queda
 * cacheada ("Todo el stock se vendió.") hasta la siguiente revalidación. Estas
 * variantes:
 *  · sin base de datos configurada devuelven `[]` / `null` igual que las otras
 *    (no es un error, es el modo demo);
 *  · con base configurada y una consulta que FALLA, lanzan `StockReadError`.
 * No las uses fuera de una página ISR: el respaldo de `next build` (no tumbar
 * el build por un error de red) vive en `lib/stock.ts`, que es quien las llama.
 */

import {
  getPublicStorageUrl,
  getPublicClient,
  isDatabaseConfigured,
  warnOnce,
  type DataApiClient,
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
  VehicleSource,
  VehicleStatus,
} from "./types";
import {
  CURRENCIES,
  VEHICLE_SOURCES,
  VEHICLE_CATEGORY_IDS,
  VEHICLE_CONDITIONS,
  VEHICLE_STATUSES,
} from "./types";

/** Vista pública. Ver la nota de arriba: no se consulta `vehicles` directamente. */
const PUBLIC_VIEW = "vehiculos_publicos";
const PHOTOS_TABLE = "vehicle_photos";

/** Columnas de `vehicle_photos` con GRANT para `anonymous`. Pedir `*` fallaría. */
const PHOTO_COLUMNS =
  "id, vehicle_id, storage_path, url_publica, alt, orden, es_principal, ancho_px, alto_px";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

/**
 * Error de lectura del stock con base de datos configurada (red, SQL, permisos).
 * `key` es la misma clave con la que las variantes que no lanzan avisan por
 * consola, para no duplicar el aviso.
 */
export class StockReadError extends Error {
  readonly key: string;
  constructor(key: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StockReadError";
    this.key = key;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
    source: pickFrom<VehicleSource>(row.fuente, VEHICLE_SOURCES, "carga_manual"),
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
 * acoplarnos a los genéricos internos del SDK (cambian entre menores).
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
 * Consulta de vehículos publicados. LANZA `StockReadError` ante cualquier
 * fallo; los envoltorios de abajo deciden si lo convierten en `[]`.
 */
async function queryPublishedVehicles(
  client: DataApiClient,
  filters: VehicleFilters,
): Promise<Vehicle[]> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(filters.offset ?? 0, 0);

  try {
    // La vista ya filtra `publicado`; no hace falta repetirlo.
    let query = client.from(PUBLIC_VIEW).select("*");

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
      throw new StockReadError(
        `vehicles:error:${error.code ?? "unknown"}`,
        `getPublishedVehicles() falló (${error.message}).`,
      );
    }

    return ((data ?? []) as unknown as PublicVehicleRow[]).map((row) =>
      mapVehicle(row),
    );
  } catch (error) {
    if (error instanceof StockReadError) throw error;
    throw new StockReadError(
      "vehicles:exception",
      `getPublishedVehicles() lanzó una excepción inesperada: ${describeError(error)}.`,
      { cause: error },
    );
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
  const client = getPublicClient();
  if (!client) {
    warnOnce(
      "vehicles:no-db",
      "Sin Neon configurado: getPublishedVehicles() devuelve []. Define NEXT_PUBLIC_NEON_URL (ver .env.example).",
    );
    return [];
  }

  try {
    return await queryPublishedVehicles(client, filters);
  } catch (error) {
    const key = error instanceof StockReadError ? error.key : "vehicles:exception";
    warnOnce(key, `${describeError(error)} Se devuelve lista vacía.`);
    return [];
  }
}

/**
 * Como `getPublishedVehicles()`, pero LANZA `StockReadError` si la base está
 * configurada y la consulta falla. Solo para páginas con ISR (ver cabecera).
 * Sin base de datos devuelve `[]`, igual que la variante que no lanza.
 */
export async function getPublishedVehiclesOrThrow(
  filters: VehicleFilters = {},
): Promise<Vehicle[]> {
  const client = getPublicClient();
  if (!client) {
    warnOnce(
      "vehicles:no-db",
      "Sin Neon configurado: getPublishedVehicles() devuelve []. Define NEXT_PUBLIC_NEON_URL (ver .env.example).",
    );
    return [];
  }
  return queryPublishedVehicles(client, filters);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Consulta de la fila de un vehículo (sin galería). LANZA `StockReadError`
 * ante cualquier fallo; devuelve `null` solo cuando la consulta salió bien y el
 * auto no existe o no está publicado.
 */
async function queryVehicleRow(
  client: DataApiClient,
  key: string,
): Promise<PublicVehicleRow | null> {
  try {
    const { data, error } = await client
      .from(PUBLIC_VIEW)
      .select("*")
      .eq(UUID_RE.test(key) ? "id" : "slug", key)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new StockReadError(
        `vehicles:detail-error:${error.code ?? "unknown"}`,
        `getVehicleById() falló (${error.message}).`,
      );
    }
    return data ? (data as unknown as PublicVehicleRow) : null;
  } catch (error) {
    if (error instanceof StockReadError) throw error;
    throw new StockReadError(
      "vehicles:detail-exception",
      `getVehicleById() lanzó una excepción inesperada: ${describeError(error)}.`,
      { cause: error },
    );
  }
}

/**
 * Un vehículo publicado por id (UUID) o por slug, con la galería completa.
 *
 * Devuelve `null` si no hay base de datos, si no existe o si no está publicado.
 * Nunca lanza: el consumidor debe tratar `null` como 404.
 *
 * Si falla solo la galería, la ficha sale sin fotos (como siempre); si falla la
 * consulta del auto, `null`.
 */
export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const key = id?.trim();
  if (!key) return null;

  const client = getPublicClient();
  if (!client) {
    warnOnce(
      "vehicles:no-db",
      "Sin Neon configurado: getVehicleById() devuelve null. Define NEXT_PUBLIC_NEON_URL (ver .env.example).",
    );
    return null;
  }

  let row: PublicVehicleRow | null;
  try {
    row = await queryVehicleRow(client, key);
  } catch (error) {
    const warnKey =
      error instanceof StockReadError ? error.key : "vehicles:detail-exception";
    warnOnce(warnKey, `${describeError(error)} Se devuelve null.`);
    return null;
  }
  if (!row) return null;
  return mapVehicle(row, await getVehiclePhotos(row.id));
}

/**
 * Como `getVehicleById()`, pero LANZA `StockReadError` si la base está
 * configurada y la consulta (o la galería) falla, en vez de devolver `null`.
 * Así la ficha responde 5xx y no un 404 falso para un auto que sí existe.
 * Solo para páginas con ISR (ver cabecera). Sin base de datos devuelve `null`.
 */
export async function getVehicleByIdOrThrow(id: string): Promise<Vehicle | null> {
  const key = id?.trim();
  if (!key) return null;

  const client = getPublicClient();
  if (!client) {
    warnOnce(
      "vehicles:no-db",
      "Sin Neon configurado: getVehicleById() devuelve null. Define NEXT_PUBLIC_NEON_URL (ver .env.example).",
    );
    return null;
  }
  // Aquí la galería también lanza: cachear la ficha sin fotos por un error
  // pasajero sería otra versión del mismo problema.
  const row = await queryVehicleRow(client, key);
  if (!row) return null;
  return mapVehicle(row, await queryVehiclePhotos(client, row.id));
}

/** Consulta de la galería. LANZA `StockReadError` ante cualquier fallo. */
async function queryVehiclePhotos(
  client: DataApiClient,
  vehicleId: string,
): Promise<VehiclePhoto[]> {
  try {
    const { data, error } = await client
      .from(PHOTOS_TABLE)
      .select(PHOTO_COLUMNS)
      .eq("vehicle_id", vehicleId)
      .order("es_principal", { ascending: false })
      .order("orden", { ascending: true });

    if (error) {
      throw new StockReadError(
        `vehicles:photos-error:${error.code ?? "unknown"}`,
        `getVehiclePhotos() falló (${error.message}).`,
      );
    }

    return ((data ?? []) as unknown as VehiclePhotoRow[]).map(mapPhoto);
  } catch (error) {
    if (error instanceof StockReadError) throw error;
    throw new StockReadError(
      "vehicles:photos-exception",
      `getVehiclePhotos() lanzó una excepción inesperada: ${describeError(error)}.`,
      { cause: error },
    );
  }
}

/**
 * Galería de un vehículo, ordenada con la portada primero.
 *
 * Va en consulta aparte porque PostgREST no infiere la relación entre la vista
 * `vehiculos_publicos` y `vehicle_photos`. El RLS de `vehicle_photos` ya impide
 * ver fotos de autos no publicados, así que esto no filtra nada de más.
 *
 * Nunca lanza: ante un error la ficha se muestra sin galería.
 */
export async function getVehiclePhotos(vehicleId: string): Promise<VehiclePhoto[]> {
  const client = getPublicClient();
  if (!client || !vehicleId) return [];

  try {
    return await queryVehiclePhotos(client, vehicleId);
  } catch (error) {
    const key =
      error instanceof StockReadError ? error.key : "vehicles:photos-exception";
    warnOnce(key, `${describeError(error)} La ficha se muestra sin galería.`);
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
