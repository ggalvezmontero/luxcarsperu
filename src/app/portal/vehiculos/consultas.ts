/**
 * Consultas del stock para el PORTAL DE ADMINISTRACIÓN.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTE MÓDULO RECIBE EL CLIENTE Y NO LO CONSTRUYE
 * ────────────────────────────────────────────────────────────────────────────
 * Estas funciones se ejecutan EN EL NAVEGADOR, con el cliente que trae la
 * sesión del equipo (`usePortalSession()`). No usan `DATABASE_URL`, y eso es
 * deliberado.
 *
 * La razón está escrita en `src/app/portal/layout.tsx` y en
 * `src/lib/portal/portalClient.ts`: `DATABASE_URL` salta TODAS las políticas
 * RLS. Si el listado se renderizara en el servidor con esa llave, Next mandaría
 * el HTML con el precio de compra, el margen y las notas internas ANTES de que
 * corriera ningún guard del navegador. Un `curl` a /portal/vehiculos —sin
 * ejecutar una línea de JavaScript— se llevaría el margen del negocio.
 *
 * Consultando desde el cliente, el candado es RLS en Postgres, que es el
 * candado de verdad:
 *   · con sesión del equipo (`authenticated`): se ve todo el stock, borradores
 *     y precios de compra incluidos;
 *   · sin sesión (`anonymous`): la política solo deja ver publicados y los GRANT por
 *     columna ni siquiera otorgan `precio_compra`, así que la consulta vuelve
 *     vacía. No hay nada que filtrar.
 *
 * El día que haya un `proxy.ts` que valide la sesión de Neon Auth antes de
 * responder, esto puede volver al servidor. Hoy no.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * RESTRICCIÓN LEGAL DURA — NO LA "OPTIMICES"
 * ────────────────────────────────────────────────────────────────────────────
 * (Detalle completo en `src/lib/db/types.ts` y en la migración
 * `db/migrations/20260915090200_vehicles.sql`.)
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

import type { PortalClient } from "@/lib/portal/portalClient";
import type {
  Currency,
  VehicleCategoryId,
  VehicleCondition,
  VehicleSource,
  VehicleStatus,
} from "@/lib/db/types";
import { hoyEnLima } from "./fechas";
import { MONTO_MAXIMO, slugificar } from "./nuevo/validacion";

const TABLE = "vehicles";

/**
 * Columnas explícitas, nunca `*`.
 *
 * `public.vehicles` tiene GRANT por columna: `anonymous` no tiene permiso sobre
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
  client: PortalClient,
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
      /**
       * Solo con `motivo: "duplicado"`: qué UNIQUE chocó, para que el
       * formulario muestre el error bajo el campo correcto y no siempre bajo
       * el VIN.
       */
      campo?: "vin" | "slug";
    };

/**
 * Inserta un vehículo con la sesión del equipo. Nunca lanza.
 *
 * La escritura va por RLS (política "vehicles: el equipo inserta", concedida a
 * `authenticated`), no por `DATABASE_URL`. Así el alta no depende de un
 * endpoint de servidor sin autenticar: sin sesión, Postgres rechaza el INSERT.
 *
 * `fuente` viaja siempre en la fila y la base la valida contra su lista blanca
 * (`public.fuente_inventario`). Ese enum es la barrera que impide etiquetar como
 * propio un inventario cuya licencia no lo permite.
 */
export async function insertarVehiculo(
  client: PortalClient,
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
        const esSlug = esChoqueDeSlug(error);
        return {
          ok: false,
          motivo: "duplicado",
          campo: esSlug ? "slug" : "vin",
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

/* ========================================================================== */
/* Edición de la ficha completa                                               */
/* ========================================================================== */
/*
 * Hasta el 2026-11-11 el portal creaba un vehículo y luego solo podía moverlo
 * por su ciclo de vida (publicar, estado, precio). Un error en el kilometraje,
 * la versión o la descripción no tenía arreglo sin tocar la base. Estas tres
 * funciones cierran ese hueco: leer la ficha completa, guardarla con el MISMO
 * formulario del alta, y avisar a la web.
 */

/** Columnas que edita el formulario del alta (ver `nuevo/validacion.ts`). */
const FICHA_COLUMNS = [
  "id",
  "fuente",
  "fuente_referencia",
  "vin",
  "placa",
  "marca",
  "modelo",
  "version",
  "anio",
  "carroceria",
  "categoria",
  "condicion",
  "procedencia",
  "cilindrada_cc",
  "transmision",
  "traccion",
  "color_exterior",
  "color_interior",
  "puertas",
  "asientos",
  "kilometraje_km",
  "precio_compra",
  "moneda_compra",
  "fecha_compra",
  "precio_venta",
  "moneda_venta",
  "precio_negociable",
  "vendido_en",
  "estado",
  "ubicacion",
  "publicado",
  "slug",
  "titular",
  "descripcion",
  "destacados",
  "notas_internas",
].join(", ");

/** Valores de la ficha como los espera el formulario: todo texto, "" = vacío. */
export type ValoresFicha = Record<string, string>;

export type FichaEditable = {
  id: string;
  titulo: string;
  slug: string | null;
  publicado: boolean;
  negociable: boolean;
  valores: ValoresFicha;
};

export type ResultadoFicha =
  | { ok: true; ficha: FichaEditable }
  | { ok: false; motivo: "sin-permiso" | "no-encontrado" | "error"; mensaje: string };

/** Postgres → texto del formulario. Las listas van una por línea. */
function textoDeFicha(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((v) => String(v)).join("\n");
  if (typeof value === "boolean") return value ? "true" : "false";
  const texto = String(value);
  // numeric(12,2) llega como "31000.00": el formulario muestra 31000.
  return /^-?\d+\.0+$/.test(texto) ? texto.replace(/\.0+$/, "") : texto;
}

/** Ficha completa de un vehículo, para editarla. Nunca lanza. */
export async function leerFichaVehiculo(
  client: PortalClient,
  id: string,
): Promise<ResultadoFicha> {
  try {
    const { data, error } = await client
      .from(TABLE)
      .select(FICHA_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      const rechazo = traducirRechazo(error);
      return {
        ok: false,
        motivo: rechazo.motivo === "sin-permiso" ? "sin-permiso" : "error",
        mensaje: rechazo.mensaje,
      };
    }
    if (!data) {
      return {
        ok: false,
        motivo: "no-encontrado",
        mensaje: "No existe ese vehículo, o tu sesión no puede verlo.",
      };
    }

    const row = data as RawRow;
    const valores: ValoresFicha = {};
    for (const [columna, valor] of Object.entries(row)) {
      if (columna === "id" || columna === "publicado" || columna === "precio_negociable") continue;
      valores[columna] = textoDeFicha(valor);
    }
    const resumen = mapRow(row);
    return {
      ok: true,
      ficha: {
        id: String(row.id),
        titulo: resumen.title,
        slug: resumen.slug,
        publicado: row.publicado === true,
        negociable: row.precio_negociable !== false,
        valores,
      },
    };
  } catch (error) {
    return {
      ok: false,
      motivo: "error",
      mensaje: `Error inesperado al leer la ficha: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Guarda la ficha completa (la misma fila que produce `validarVehiculo`) sobre
 * un vehículo existente. Devuelve lo mismo que el alta para que el formulario
 * trate los dos caminos igual. Nunca lanza.
 */
export async function guardarFichaVehiculo(
  client: PortalClient,
  id: string,
  fila: NuevoVehiculoRow,
): Promise<ResultadoAlta> {
  const resultado = await actualizarVehiculo(client, id, fila, "Cambios guardados.");
  if (resultado.ok) {
    return { ok: true, id: resultado.vehiculo.id, slug: resultado.vehiculo.slug };
  }
  if (resultado.motivo === "duplicado") {
    return {
      ok: false,
      motivo: "duplicado",
      campo: resultado.campo === "slug" ? "slug" : "vin",
      mensaje: resultado.mensaje,
    };
  }
  if (resultado.motivo === "sin-permiso") {
    return { ok: false, motivo: "sin-permiso", mensaje: resultado.mensaje };
  }
  return { ok: false, motivo: "error", mensaje: resultado.mensaje };
}

/**
 * Pide a la web que regenere la portada, /comprar, la ficha del auto y el
 * sitemap (ver `src/app/api/portal/vehiculos/revalidar`). Si falla, lo
 * guardado sigue guardado: la web se pone al día sola cuando vence su caché.
 */
export async function avisarWebVehiculo(vehiculo: {
  id: string;
  slug: string | null;
}): Promise<boolean> {
  try {
    const respuesta = await fetch("/api/portal/vehiculos/revalidar", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: vehiculo.id, slug: vehiculo.slug }),
    });
    return respuesta.ok;
  } catch {
    return false;
  }
}

/** El UNIQUE que chocó es el del slug (`vehicles_slug_key`) y no el del VIN. */
function esChoqueDeSlug(error: { message: string; details?: string | null }): boolean {
  return /slug/i.test(`${error.message} ${error.details ?? ""}`);
}

/* ========================================================================== */
/* Cambios sobre un vehículo ya cargado                                       */
/* ========================================================================== */
/*
 * Antes de esto el portal podía CREAR un vehículo pero nunca tocarlo: un
 * borrador no se podía publicar, el precio no se podía corregir y un auto
 * vendido seguía "disponible". Cada función de abajo es UNA mutación acotada
 * —publicar, despublicar, cambiar estado, cambiar precio— y no un formulario de
 * edición de todas las columnas.
 *
 * Reglas comunes:
 *   · Escriben con la sesión del equipo, por RLS ("vehicles: el equipo
 *     actualiza", que exige `public.es_admin()`).
 *   · Devuelven la fila ACTUALIZADA (`.select()` después del UPDATE), así el
 *     listado se corrige en el lugar sin recargar todo, y de paso se sabe si de
 *     verdad se actualizó una fila: cero filas = no existe o no hay permiso.
 *   · Los CHECK de la tabla se validan ANTES para dar un mensaje en español,
 *     y si igual la base rechaza, el error se traduce (ver `traducirRechazo`).
 *
 * NINGUNA LANZA.
 */

export type ResultadoCambio =
  | { ok: true; vehiculo: AdminVehicle; mensaje: string }
  | {
      ok: false;
      motivo: "sin-permiso" | "duplicado" | "falta-dato" | "no-encontrado" | "error";
      mensaje: string;
      /** Qué dato hay que pedir o corregir en pantalla. */
      campo?: "precio" | "slug" | "fecha";
    };

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Traduce lo que Postgres responde a un UPDATE de `vehicles`.
 *
 * Los nombres de constraint salen de db/migrations/20260915090200_vehicles.sql:
 *   · vehicles_publicado_exige_precio  → check (not publicado or precio_venta is not null)
 *   · vehicles_publicado_exige_slug    → check (not publicado or slug is not null)
 *   · vehicles_vendido_exige_fecha     → check (estado <> 'vendido' or vendido_en is not null)
 *   · vehicles_slug_key                → slug text unique
 */
function traducirRechazo(error: {
  message: string;
  code?: string;
  details?: string | null;
}): Extract<ResultadoCambio, { ok: false }> {
  const texto = `${error.message} ${error.details ?? ""}`;

  if (error.code === "23505") {
    return esChoqueDeSlug(error)
      ? {
          ok: false,
          motivo: "duplicado",
          campo: "slug",
          mensaje: "Ya hay otro vehículo con esa URL (slug). Escribe una distinta.",
        }
      : {
          ok: false,
          motivo: "duplicado",
          mensaje: `La base de datos rechazó el cambio por un dato repetido: ${error.message}`,
        };
  }
  if (texto.includes("vehicles_publicado_exige_precio")) {
    return {
      ok: false,
      motivo: "falta-dato",
      campo: "precio",
      mensaje: "Para publicar el auto hace falta el precio de venta.",
    };
  }
  if (texto.includes("vehicles_publicado_exige_slug")) {
    return {
      ok: false,
      motivo: "falta-dato",
      campo: "slug",
      mensaje: "Para publicar el auto hace falta su URL (slug).",
    };
  }
  if (texto.includes("vehicles_vendido_exige_fecha")) {
    return {
      ok: false,
      motivo: "falta-dato",
      campo: "fecha",
      mensaje: "Un vehículo vendido necesita la fecha de venta.",
    };
  }
  if (error.code === "42501" || /permission denied|row-level security|jwt/i.test(texto)) {
    return {
      ok: false,
      motivo: "sin-permiso",
      mensaje:
        "La sesión no tiene permiso para modificar el stock o caducó. Vuelve a iniciar sesión.",
    };
  }
  return {
    ok: false,
    motivo: "error",
    mensaje: `La base de datos rechazó el cambio: ${error.message}`,
  };
}

/** UPDATE de una fila por id, devolviendo la fila nueva. Nunca lanza. */
async function actualizarVehiculo(
  client: PortalClient,
  id: string,
  cambios: Record<string, unknown>,
  mensajeOk: string,
): Promise<ResultadoCambio> {
  try {
    const { data, error } = await client
      .from(TABLE)
      .update(cambios)
      .eq("id", id)
      .select(ADMIN_COLUMNS);

    if (error) return traducirRechazo(error);

    const filas = (data ?? []) as unknown as RawRow[];
    if (filas.length === 0) {
      return {
        ok: false,
        motivo: "no-encontrado",
        mensaje:
          "No se actualizó ningún vehículo: puede que lo hayan borrado o que tu sesión ya no tenga acceso. Recarga la página.",
      };
    }
    return { ok: true, vehiculo: mapRow(filas[0]), mensaje: mensajeOk };
  } catch (error) {
    return {
      ok: false,
      motivo: "error",
      mensaje: `Error inesperado al guardar el cambio: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/** Valida un precio de venta escrito a mano. `null` = válido. */
function errorDePrecio(precio: number): string | null {
  if (!Number.isFinite(precio) || precio <= 0) {
    return "El precio de venta tiene que ser un número mayor que cero.";
  }
  // numeric(12, 2): más que esto lo rechaza Postgres con "numeric field overflow".
  if (precio > MONTO_MAXIMO) {
    return "El precio es demasiado alto para guardarse. Revisa los ceros.";
  }
  return null;
}

/**
 * Publica el auto en la web.
 *
 * La base exige precio y slug para un auto publicado
 * (`vehicles_publicado_exige_precio` y `vehicles_publicado_exige_slug`). Si a
 * la fila le falta alguno, la pantalla los pide y llegan acá en `datos`; se
 * escriben en el MISMO UPDATE que `publicado = true`, para que nunca quede un
 * auto publicado a medias. `publicado_en` lo sella el trigger
 * `tg_sellar_publicacion`.
 */
export async function publicarVehiculo(
  client: PortalClient,
  vehiculo: Pick<AdminVehicle, "id" | "price" | "slug">,
  datos: { precio?: number | null; moneda?: Currency; slug?: string | null } = {},
): Promise<ResultadoCambio> {
  const cambios: Record<string, unknown> = { publicado: true };

  if (typeof datos.precio === "number") {
    const problema = errorDePrecio(datos.precio);
    if (problema) {
      return { ok: false, motivo: "falta-dato", campo: "precio", mensaje: problema };
    }
    cambios.precio_venta = datos.precio;
    if (datos.moneda) cambios.moneda_venta = datos.moneda;
  } else if (vehiculo.price === null) {
    return {
      ok: false,
      motivo: "falta-dato",
      campo: "precio",
      mensaje: "Para publicar el auto hace falta el precio de venta.",
    };
  }

  if (typeof datos.slug === "string" && datos.slug.trim()) {
    // Mismas reglas que el alta: minúsculas, sin tildes, guiones.
    const slug = slugificar(datos.slug);
    if (!slug) {
      return {
        ok: false,
        motivo: "falta-dato",
        campo: "slug",
        mensaje: "La URL solo puede tener letras, números y guiones.",
      };
    }
    cambios.slug = slug;
  } else if (vehiculo.slug === null) {
    return {
      ok: false,
      motivo: "falta-dato",
      campo: "slug",
      mensaje: "Para publicar el auto hace falta su URL (slug).",
    };
  }

  return actualizarVehiculo(client, vehiculo.id, cambios, "Publicado: ya se ve en la web.");
}

/** Saca el auto de la web. La ficha, sus fotos y su slug se conservan. */
export async function despublicarVehiculo(
  client: PortalClient,
  id: string,
): Promise<ResultadoCambio> {
  return actualizarVehiculo(
    client,
    id,
    { publicado: false },
    "Despublicado: ya no se ve en la web. Sigue en el stock como borrador.",
  );
}

/**
 * Cambia el estado (`public.estado_vehiculo`: disponible, reservado,
 * en_transito, vendido).
 *
 * `vendido` exige `vendido_en` por `vehicles_vendido_exige_fecha`: si no llega
 * una fecha, se usa HOY EN LIMA (no el día UTC). Al salir de `vendido` la fecha
 * de venta se borra: un auto que vuelve a estar disponible no tiene venta, y
 * dejarla ahí ensuciaría cualquier reporte de cierres.
 *
 * NO despublica: un vendido que el equipo deja publicado sirve de prueba
 * social (está escrito en la política de lectura pública de la migración).
 * Para ocultarlo está "Despublicar".
 */
export async function cambiarEstadoVehiculo(
  client: PortalClient,
  id: string,
  estado: VehicleStatus,
  opciones: { vendidoEn?: string | null } = {},
): Promise<ResultadoCambio> {
  if (!STATUSES.includes(estado)) {
    return { ok: false, motivo: "error", mensaje: "Ese estado no existe." };
  }

  const cambios: Record<string, unknown> = { estado };
  if (estado === "vendido") {
    const fecha = opciones.vendidoEn?.trim() || hoyEnLima();
    if (!RE_FECHA.test(fecha)) {
      return {
        ok: false,
        motivo: "falta-dato",
        campo: "fecha",
        mensaje: "La fecha de venta no es válida.",
      };
    }
    cambios.vendido_en = fecha;
  } else {
    cambios.vendido_en = null;
  }

  return actualizarVehiculo(client, id, cambios, "Estado actualizado.");
}

/** Cambia el precio de venta y, si se indica, su moneda (`moneda_venta`). */
export async function cambiarPrecioVehiculo(
  client: PortalClient,
  id: string,
  precio: number,
  moneda?: Currency,
): Promise<ResultadoCambio> {
  const problema = errorDePrecio(precio);
  if (problema) {
    return { ok: false, motivo: "falta-dato", campo: "precio", mensaje: problema };
  }
  const cambios: Record<string, unknown> = { precio_venta: precio };
  if (moneda && MONEDAS.includes(moneda)) cambios.moneda_venta = moneda;
  return actualizarVehiculo(client, id, cambios, "Precio actualizado.");
}

/**
 * Saca de la web el vehículo de una consignación que se cerró.
 *
 * Lo usa `src/app/portal/consignaciones/queries.ts`: una consignación cerrada
 * (vendida, retirada, vencida) con la ficha todavía publicada y "disponible"
 * deja a los clientes preguntando por un auto que ya no está. Con `vendidoEn`
 * además la marca vendida con esa fecha (`vehicles_vendido_exige_fecha`).
 *
 * Devuelve `{ ok, message }` como las consultas de consignaciones. Nunca lanza.
 */
export async function retirarVehiculoDeConsignacion(
  client: PortalClient,
  vehicleId: string,
  opciones: { vendidoEn?: string | null } = {},
): Promise<{ ok: boolean; message: string }> {
  const cambios: Record<string, unknown> = { publicado: false };
  if (opciones.vendidoEn) {
    cambios.estado = "vendido";
    cambios.vendido_en = opciones.vendidoEn;
  }
  const resultado = await actualizarVehiculo(client, vehicleId, cambios, "");
  return resultado.ok
    ? { ok: true, message: "" }
    : { ok: false, message: resultado.mensaje };
}
