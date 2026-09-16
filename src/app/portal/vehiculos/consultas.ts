/**
 * Consultas del stock para el PORTAL DE ADMINISTRACIÓN.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTE MÓDULO RECIBE EL CLIENTE Y NO LO CONSTRUYE
 * ────────────────────────────────────────────────────────────────────────────
 * Estas funciones se ejecutan EN EL NAVEGADOR, con el cliente que trae la
 * sesión del equipo (`usePortalSession()`). No usan `service_role`, y eso es
 * deliberado.
 *
 * La razón está escrita en `src/app/portal/layout.tsx` y en
 * `src/lib/portal/supabaseBrowser.ts`: `service_role` salta TODAS las políticas
 * RLS. Si el listado se renderizara en el servidor con esa llave, Next mandaría
 * el HTML con el precio de compra, el margen y las notas internas ANTES de que
 * corriera ningún guard del navegador. Un `curl` a /portal/vehiculos —sin
 * ejecutar una línea de JavaScript— se llevaría el margen del negocio.
 *
 * Consultando desde el cliente, el candado es RLS en Postgres, que es el
 * candado de verdad:
 *   · con sesión del equipo (`authenticated`): se ve todo el stock, borradores
 *     y precios de compra incluidos;
 *   · sin sesión (`anon`): la política solo deja ver publicados y los GRANT por
 *     columna ni siquiera otorgan `precio_compra`, así que la consulta vuelve
 *     vacía. No hay nada que filtrar.
 *
 * El día que se instale `@supabase/ssr` y haya un `middleware.ts` que valide la
 * sesión antes de responder, esto puede volver al servidor. Hoy no.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * RESTRICCIÓN LEGAL DURA — NO LA "OPTIMICES"
 * ────────────────────────────────────────────────────────────────────────────
 * (Detalle completo en `src/lib/db/types.ts` y en la migración
 * `supabase/migrations/20260915090200_vehicles.sql`.)
 *
 * Las filas de `vehicles` solo pueden nacer de: carga manual curada en este
 * portal —con autocompletado por VIN contra NHTSA vPIC, cuya respuesta sí se
 * puede almacenar— o de feeds XML de dealers partner con licencia FIRMADA.
 *
 * Está PROHIBIDO insertar inventario de MarketCheck, Auto.dev, eBay,
 * Autotrader, CarGurus, Cars.com, TrueCar, AutoTempest o Facebook Marketplace:
 * sus contratos prohíben textualmente "cache, store, index or otherwise
 * persist", prohíben crear "derivative databases" y varios obligan a borrar en
 * seis horas. Un solo INSERT con esos datos es incumplimiento de contrato con
 * revocación inmediata de la llave de API.
 *
 * Si mañana aparece la idea de "un job que sincronice el stock solo y nos
 * ahorre los cuatro minutos por auto": no. Esos cuatro minutos son el precio de
 * operar dentro de la ley. La columna `fuente` es una lista blanca en la propia
 * base de datos justamente para que esta regla no dependa de la memoria de
 * nadie.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ninguna función lanza: ante cualquier fallo devuelven un resultado con el
 * motivo en español, listo para mostrar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Currency,
  VehicleCategoryId,
  VehicleCondition,
  VehicleSource,
  VehicleStatus,
} from "@/lib/db/types";

const TABLE = "vehicles";

/**
 * Columnas explícitas, nunca `*`.
 *
 * `public.vehicles` tiene GRANT por columna: `anon` no tiene permiso sobre
 * `precio_compra` ni `notas_internas`, así que un `select *` FALLA sin sesión.
 * Eso es a propósito (protege el margen), pero significa que pedir columnas por
 * nombre no es una manía de estilo: es lo que hace que la consulta funcione.
 */
const ADMIN_COLUMNS = [
  "id",
  "vin",
  "placa",
  "marca",
  "modelo",
  "version",
  "anio",
  "carroceria",
  "categoria",
  "condicion",
  "cilindrada_cc",
  "kilometraje_km",
  "precio_compra",
  "moneda_compra",
  "precio_venta",
  "moneda_venta",
  "estado",
  "ubicacion",
  "fuente",
  "publicado",
  "publicado_en",
  "slug",
  "titular",
  "fecha_ingreso",
  "created_at",
].join(", ");

/** Una fila del listado del portal, ya en el vocabulario de la UI. */
export type AdminVehicle = {
  id: string;
  vin: string | null;
  plate: string | null;
  brand: string;
  model: string;
  trim: string | null;
  year: number;
  bodyStyle: string | null;
  category: VehicleCategoryId;
  condition: VehicleCondition;
  engineCc: number | null;
  mileageKm: number;
  /** Reservado: es el margen del negocio. Solo se ve con sesión del equipo. */
  purchasePrice: number | null;
  purchaseCurrency: Currency;
  price: number | null;
  currency: Currency;
  status: VehicleStatus;
  location: string | null;
  source: VehicleSource;
  published: boolean;
  publishedAt: string | null;
  slug: string | null;
  title: string;
  intakeDate: string | null;
  createdAt: string | null;
};

export type AdminVehicleFilters = {
  /** `undefined` = todos los estados. */
  status?: VehicleStatus;
  /** Búsqueda libre: marca, modelo, versión, titular, VIN, placa o ubicación. */
  search?: string;
  /** `undefined` = publicados y borradores. */
  published?: boolean;
  limit?: number;
};

export type ConteoEstados = Record<VehicleStatus, number> & { total: number };

export type ResultadoListado = {
  estado: "ok" | "sin-sesion" | "error";
  vehiculos: AdminVehicle[];
  /** Conteo sobre TODO el stock, no solo sobre lo filtrado. */
  conteo: ConteoEstados;
  /** Mensaje en español listo para mostrar cuando `estado !== "ok"`. */
  mensaje?: string;
};

export const CONTEO_VACIO: ConteoEstados = {
  disponible: 0,
  reservado: 0,
  vendido: 0,
  en_transito: 0,
  total: 0,
};

const DEFAULT_LIMIT = 200;

/* ========================================================================== */
/* Mapeo fila -> dominio                                                      */
/* ========================================================================== */

type RawRow = Record<string, unknown>;

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

const STATUSES: readonly VehicleStatus[] = [
  "disponible",
  "reservado",
  "vendido",
  "en_transito",
];
const CATEGORIES: readonly VehicleCategoryId[] = [
  "gasolina",
  "hev",
  "diesel",
  "ev",
  "phev",
];
const CONDITIONS: readonly VehicleCondition[] = ["nuevo", "usado"];
const SOURCES: readonly VehicleSource[] = [
  "carga_manual",
  "importacion_directa",
  "consignacion",
  "feed_partner_licenciado",
];
const MONEDAS: readonly Currency[] = ["USD", "PEN"];

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapRow(row: RawRow): AdminVehicle {
  const brand = str(row.marca) ?? "";
  const model = str(row.modelo) ?? "";
  const year = toNumberOrNull(row.anio) ?? 0;

  return {
    id: String(row.id),
    vin: str(row.vin),
    plate: str(row.placa),
    brand,
    model,
    trim: str(row.version),
    year,
    bodyStyle: str(row.carroceria),
    category: pick<VehicleCategoryId>(row.categoria, CATEGORIES, "gasolina"),
    condition: pick<VehicleCondition>(row.condicion, CONDITIONS, "usado"),
    engineCc: toNumberOrNull(row.cilindrada_cc),
    mileageKm: toNumberOrNull(row.kilometraje_km) ?? 0,
    purchasePrice: toNumberOrNull(row.precio_compra),
    purchaseCurrency: pick<Currency>(row.moneda_compra, MONEDAS, "USD"),
    price: toNumberOrNull(row.precio_venta),
    currency: pick<Currency>(row.moneda_venta, MONEDAS, "USD"),
    status: pick<VehicleStatus>(row.estado, STATUSES, "disponible"),
    location: str(row.ubicacion),
    source: pick<VehicleSource>(row.fuente, SOURCES, "carga_manual"),
    published: row.publicado === true,
    publishedAt: str(row.publicado_en),
    slug: str(row.slug),
    title:
      str(row.titular) ??
      [year || null, brand, model, str(row.version)].filter(Boolean).join(" "),
    intakeDate: str(row.fecha_ingreso),
    createdAt: str(row.created_at),
  };
}

/**
 * `%`, `,` y los paréntesis rompen el parser de `or` de PostgREST: se cambian
 * por espacios antes de armar el filtro.
 */
function sanitizeSearch(raw: string): string {
  return raw.replace(/[%,()]/g, " ").trim();
}

/* ========================================================================== */
/* Listado                                                                    */
/* ========================================================================== */

/**
 * Stock completo para el portal. Nunca lanza.
 *
 * `client` debe ser el cliente CON SESIÓN del portal. Sin sesión, RLS deja ver
 * solo lo publicado y niega las columnas reservadas: la consulta falla o vuelve
 * vacía, que es exactamente lo que debe pasar.
 */
export async function listarVehiculos(
  client: SupabaseClient,
  filtros: AdminVehicleFilters = {},
): Promise<ResultadoListado> {
  const limit = Math.min(Math.max(filtros.limit ?? DEFAULT_LIMIT, 1), 500);

  try {
    let query = client.from(TABLE).select(ADMIN_COLUMNS);

    if (filtros.status) query = query.eq("estado", filtros.status);
    if (typeof filtros.published === "boolean")
      query = query.eq("publicado", filtros.published);

    const search = sanitizeSearch(filtros.search ?? "");
    if (search) {
      query = query.or(
        [
          `marca.ilike.%${search}%`,
          `modelo.ilike.%${search}%`,
          `version.ilike.%${search}%`,
          `titular.ilike.%${search}%`,
          `vin.ilike.%${search}%`,
          `placa.ilike.%${search}%`,
          `ubicacion.ilike.%${search}%`,
        ].join(","),
      );
    }

    const [listado, conteo] = await Promise.all([
      query
        .order("fecha_ingreso", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit),
      // El conteo va sobre TODO el stock: si dijera "3 reservados" con un
      // filtro puesto, la cifra dejaría de servir para navegar.
      client.from(TABLE).select("estado"),
    ]);

    if (listado.error) {
      return {
        estado: "error",
        vehiculos: [],
        conteo: { ...CONTEO_VACIO },
        mensaje: describirErrorLectura(listado.error.message),
      };
    }

    const tally = { ...CONTEO_VACIO };
    for (const row of (conteo.data ?? []) as unknown as RawRow[]) {
      const estado = pick<VehicleStatus>(row.estado, STATUSES, "disponible");
      tally[estado] += 1;
      tally.total += 1;
    }

    return {
      estado: "ok",
      vehiculos: ((listado.data ?? []) as unknown as RawRow[]).map(mapRow),
      conteo: tally,
    };
  } catch (error) {
    return {
      estado: "error",
      vehiculos: [],
      conteo: { ...CONTEO_VACIO },
      mensaje: `Error inesperado al leer el stock: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Traduce el error de PostgREST. El caso frecuente es "permission denied":
 * significa sesión caducada, no una avería.
 */
function describirErrorLectura(mensaje: string): string {
  if (/permission denied|jwt|row-level security/i.test(mensaje)) {
    return "La sesión no tiene permiso para leer el stock. Vuelve a iniciar sesión e inténtalo de nuevo.";
  }
  return `No se pudo leer el stock: ${mensaje}`;
}

/* ========================================================================== */
/* Alta                                                                       */
/* ========================================================================== */

/** Fila lista para insertar, en las columnas reales de Postgres (español). */
export type NuevoVehiculoRow = Record<string, unknown>;

export type ResultadoAlta =
  | { ok: true; id: string; slug: string | null }
  | {
      ok: false;
      motivo: "sin-permiso" | "duplicado" | "error";
      mensaje: string;
    };

/**
 * Inserta un vehículo con la sesión del equipo. Nunca lanza.
 *
 * La escritura va por RLS (política "vehicles: el equipo inserta", concedida a
 * `authenticated`), no por `service_role`. Así el alta no depende de un
 * endpoint de servidor sin autenticar: sin sesión, Postgres rechaza el INSERT.
 *
 * `fuente` viaja siempre en la fila y la base la valida contra su lista blanca
 * (`public.fuente_inventario`). Ese enum es la barrera que impide etiquetar como
 * propio un inventario cuya licencia no lo permite.
 */
export async function insertarVehiculo(
  client: SupabaseClient,
  fila: NuevoVehiculoRow,
): Promise<ResultadoAlta> {
  try {
    const { data, error } = await client
      .from(TABLE)
      .insert(fila)
      .select("id, slug")
      .single();

    if (error) {
      // 23505 = unique_violation. Los únicos UNIQUE que el usuario puede chocar
      // a mano son el VIN y el slug.
      if (error.code === "23505") {
        const esSlug = error.message.includes("slug");
        return {
          ok: false,
          motivo: "duplicado",
          mensaje: esSlug
            ? "Ya existe un vehículo con esa URL (slug). Cambia el titular o escribe un slug distinto."
            : "Ese VIN ya está cargado. Búscalo en el listado en lugar de crearlo de nuevo.",
        };
      }
      if (/permission denied|row-level security|jwt/i.test(error.message)) {
        return {
          ok: false,
          motivo: "sin-permiso",
          mensaje:
            "La sesión no tiene permiso para guardar. Vuelve a iniciar sesión: los datos del formulario no se pierden.",
        };
      }
      return {
        ok: false,
        motivo: "error",
        mensaje: `La base de datos rechazó el vehículo: ${error.message}`,
      };
    }

    const row = (data ?? {}) as RawRow;
    return { ok: true, id: String(row.id), slug: str(row.slug) };
  } catch (error) {
    return {
      ok: false,
      motivo: "error",
      mensaje: `Error inesperado al guardar: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
