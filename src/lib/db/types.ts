/**
 * Tipos de dominio de la capa de datos de LuxCars.
 *
 * FUENTE DE VERDAD DEL ESQUEMA: `supabase/migrations/`. Este archivo es su
 * espejo en TypeScript, nada más. Las columnas en Postgres están en español
 * (`marca`, `anio`, `precio_venta`); el dominio expuesto a la UI está en inglés
 * camelCase para que encaje sin traducción con el motor de precios de
 * `src/core/pricing/` (que usa `brand` / `model` / `year`). La traducción vive
 * en los mapeadores de `vehicles.ts` y `leads.ts`, en un solo lugar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * RESTRICCION LEGAL DURA — INVENTARIO DE TERCEROS. NO LA "OPTIMICES".
 * ────────────────────────────────────────────────────────────────────────────
 * Está PROHIBIDO persistir en esta base de datos inventario proveniente de
 * MarketCheck, Auto.dev, eBay, Autotrader, CarGurus, Cars.com, TrueCar,
 * AutoTempest o Facebook Marketplace. Sus términos prohíben textualmente
 * "cache, store, index or otherwise persist", prohíben crear "derivative
 * databases" y obligan a borrar a las 6 horas. Un solo INSERT con esos datos
 * es incumplimiento de contrato y revocación de la llave de API.
 *
 * Lo que SÍ es legal y es la vía elegida:
 *   1. Carga manual curada desde el admin (~4 minutos por auto).
 *   2. Autocompletado por VIN contra NHTSA vPIC — API del gobierno de EE.UU.,
 *      gratuita, sin autenticación y sin restricción contractual:
 *      https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json
 *      Su respuesta SÍ puede guardarse (tabla `vehicle_models`).
 *   3. Más adelante: feeds XML de dealers partner, con cláusula de licencia
 *      firmada (`fuente = 'feed_partner_licenciado'`).
 *
 * La columna `vehicles.fuente` es una lista blanca que aplica esta regla en el
 * motor de base de datos. Si alguien propone "cachear la API de inventario un
 * ratito para que cargue más rápido": la respuesta es no, y el motivo es
 * contractual, no técnico.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import type {
  VehicleCondition,
  VehicleOrigin,
} from "@/core/pricing/pricingConfig";

/**
 * Se reexportan para que la UI consuma un solo módulo de tipos, pero la fuente
 * de verdad sigue siendo `src/core/pricing/` — que NO se toca.
 */
export type { VehicleCondition, VehicleOrigin };
export type { VehicleCategoryId };

/* ========================================================================== */
/* Vehículos — espejo de public.vehicles / public.vehiculos_publicos           */
/* ========================================================================== */

/** `public.estado_vehiculo`. Ojo: "publicado" es una columna aparte, no un estado. */
export type VehicleStatus =
  | "disponible"
  | "reservado"
  | "vendido"
  | "en_transito";

/**
 * `public.fuente_inventario`. Lista blanca de PROCEDENCIA DEL DATO (no del
 * vehículo). Agregar un valor exige migración y justificación legal.
 */
export type VehicleSource =
  | "carga_manual"
  | "importacion_directa"
  | "consignacion"
  | "feed_partner_licenciado";

/** `public.moneda`. */
export type Currency = "USD" | "PEN";

/**
 * `public.rol_usuario`. Cada usuario de Supabase Auth tiene un perfil con rol.
 * `cliente` solo ve y escribe sus propias solicitudes; `admin` es el equipo y
 * entra al portal. Es lo que evalúa `public.es_admin()` en cada política RLS.
 */
export type UserRole = "cliente" | "admin";

/** `public.estado_solicitud_compra`. Pedido de búsqueda de un auto. */
export type PurchaseRequestStatus =
  | "nueva"
  | "en_busqueda"
  | "propuesta_enviada"
  | "cerrada"
  | "descartada";

/** `public.estado_solicitud_venta`. Auto ofrecido en consignación, con aprobación. */
export type SaleRequestStatus = "pendiente" | "aprobada" | "rechazada" | "retirada";

/** Condición que pide el cliente al buscar un auto. Texto, no enum del motor. */
export type PurchaseRequestCondition = "nuevo" | "usado" | "indistinto";

/** Foto de la galería. `path` es la ruta dentro del bucket de Storage. */
export type VehiclePhoto = {
  id: string;
  path: string;
  /** URL pública. Materializada en la tabla; si falta, se arma desde el bucket. */
  url: string | null;
  alt: string;
  position: number;
  isCover: boolean;
  widthPx: number | null;
  heightPx: number | null;
};

/**
 * Vehículo publicado, tal como lo ve el sitio público.
 *
 * Solo campos publicables: `precio_compra`, `precio_final` y `notas_internas`
 * no están acá porque `anon` no tiene GRANT sobre esas columnas. Son el margen
 * del negocio; no deben poder filtrarse a un componente por descuido.
 */
export type Vehicle = {
  id: string;
  /** Un vehículo publicado siempre tiene slug (lo garantiza un CHECK en la BD). */
  slug: string | null;

  brand: string; // marca
  model: string; // modelo
  trim: string | null; // version
  year: number; // anio
  bodyStyle: string | null; // carroceria

  category: VehicleCategoryId; // categoria
  condition: VehicleCondition; // condicion
  engineCc: number | null; // cilindrada_cc
  transmission: string | null; // transmision
  drivetrain: string | null; // traccion
  exteriorColor: string | null; // color_exterior
  doors: number | null; // puertas
  seats: number | null; // asientos
  mileageKm: number; // kilometraje_km

  /** `precio_venta`. `null` en una ficha aún sin precio (no puede publicarse así). */
  price: number | null;
  currency: Currency; // moneda_venta
  priceNegotiable: boolean; // precio_negociable

  status: VehicleStatus; // estado
  /**
   * `fuente`. Procedencia del dato. Para la web pública lo único que importa es
   * si vale `consignacion`: el auto es de un cliente y se dice así.
   */
  source: VehicleSource;
  location: string | null; // ubicacion
  title: string; // titular, con respaldo armado desde marca/modelo/año
  description: string | null; // descripcion
  highlights: string[]; // destacados
  publishedAt: string | null; // publicado_en

  /** Portada resuelta por la vista. La galería completa se pide por separado. */
  coverPhoto: { url: string | null; alt: string } | null;
  /** Vacío en los listados; poblado en `getVehicleById`. */
  photos: VehiclePhoto[];
};

/** Criterios de listado público. Todos opcionales. */
export type VehicleFilters = {
  category?: VehicleCategoryId | VehicleCategoryId[];
  condition?: VehicleCondition;
  status?: VehicleStatus | VehicleStatus[];
  brand?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  maxMileageKm?: number;
  /** Búsqueda libre sobre marca, modelo, versión y titular. */
  search?: string;
  limit?: number;
  offset?: number;
  sort?: VehicleSort;
};

export type VehicleSort =
  | "recientes"
  | "precio-asc"
  | "precio-desc"
  | "anio-desc"
  | "km-asc";

/* ========================================================================== */
/* Leads — espejo de public.leads                                             */
/* ========================================================================== */

/** `public.origen_lead`: desde qué parte del sitio llegó la consulta. */
export type LeadOrigin = "calculadora" | "contacto" | "stock" | "consignacion";

/** `public.estado_lead`. */
export type LeadStatus =
  | "nuevo"
  | "contactado"
  | "calificado"
  | "cotizado"
  | "negociacion"
  | "ganado"
  | "perdido";

export type CreateLeadInput = {
  origin: LeadOrigin;
  name: string;
  /** Teléfono o email: al menos uno. La BD lo exige con un CHECK. */
  phone?: string | null;
  email?: string | null;
  message?: string | null;

  /** Unidad del stock consultada, si la hay. */
  vehicleId?: string | null;
  /** Lo que busca cuando la unidad todavía no existe (importación a pedido). */
  interestBrand?: string | null;
  interestModel?: string | null;
  interestYear?: number | null;
  budgetUsd?: number | null;

  /** Ruta desde la que se envió: "/importar", "/comprar/xxx". */
  sourcePath?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  /** `true` si el cliente además abrió el enlace de WhatsApp. */
  whatsappSent?: boolean;
};

export type Lead = {
  id: string;
  origin: LeadOrigin;
  status: LeadStatus;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  vehicleId: string | null;
  interestBrand: string | null;
  interestModel: string | null;
  interestYear: number | null;
  budgetUsd: number | null;
  sourcePath: string | null;
  createdAt: string;
};

/**
 * Resultado de `createLead`.
 *
 * El caso `ok: false` NO es un error a esconder: es la ruta normal mientras no
 * haya base de datos. La UI debe leer `fallback === "whatsapp"` y empujar al
 * usuario al enlace de WhatsApp con el mensaje ya armado (`src/lib/whatsapp.ts`).
 */
export type CreateLeadResult =
  | { ok: true; lead: Lead }
  | {
      ok: false;
      reason: "database-not-configured" | "invalid-input" | "database-error";
      fallback: "whatsapp";
      /** Mensaje ya redactado en español, listo para mostrar al usuario. */
      message: string;
    };

/* ========================================================================== */
/* Consignaciones — espejo de public.consignments                             */
/* ========================================================================== */

/**
 * `public.estado_consignacion`.
 *
 * `vendida_por_dueno` NO es una fuga ni un incumplimiento: la consignación es
 * SIN CONTRATO DE EXCLUSIVIDAD, así que el dueño vendiendo su propio auto es un
 * desenlace previsto y cierra con comisión CERO. No modelar penalidades sobre
 * este estado.
 */
export type ConsignmentStatus =
  | "activa"
  | "pausada"
  | "vendida_por_luxcars"
  | "vendida_por_dueno"
  | "retirada"
  | "vencida";

/** `public.tipo_comision`. */
export type CommissionType = "porcentaje" | "monto_fijo";

/* ========================================================================== */
/* Filas crudas de Postgres (snake_case, en español)                          */
/* ========================================================================== */

/**
 * Fila de `public.vehiculos_publicos`, la vista con `security_invoker` que el
 * front público debe usar. NO se consulta `public.vehicles` con `select *`:
 * los GRANT son por columna y esa consulta FALLA para `anon`, a propósito.
 */
export type PublicVehicleRow = {
  id: string;
  slug: string | null;
  marca: string;
  modelo: string;
  version: string | null;
  anio: number;
  carroceria: string | null;
  categoria: string;
  cilindrada_cc: number | null;
  transmision: string | null;
  traccion: string | null;
  color_exterior: string | null;
  puertas: number | null;
  asientos: number | null;
  kilometraje_km: number | null;
  condicion: string;
  precio_venta: number | string | null;
  moneda_venta: string | null;
  precio_negociable: boolean | null;
  estado: string;
  ubicacion: string | null;
  titular: string | null;
  descripcion: string | null;
  destacados: string[] | null;
  publicado_en: string | null;
  foto_portada_url: string | null;
  foto_portada_alt: string | null;
  /**
   * `vehicles.fuente`, expuesta por la migración 0009. Opcional a propósito:
   * si la vista todavía no se actualizó, el mapeo asume stock propio.
   */
  fuente?: string | null;
};

/** Fila de `public.vehicle_photos`, limitada a las columnas con GRANT a `anon`. */
export type VehiclePhotoRow = {
  id: string;
  vehicle_id: string;
  storage_path: string;
  url_publica: string | null;
  alt: string | null;
  orden: number | null;
  es_principal: boolean | null;
  ancho_px: number | null;
  alto_px: number | null;
};

/** Fila de `public.leads`. Solo accesible con service_role o sesión del equipo. */
export type LeadRow = {
  id: string;
  origen: string;
  estado: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  mensaje: string | null;
  vehicle_id: string | null;
  interes_marca: string | null;
  interes_modelo: string | null;
  interes_anio: number | null;
  presupuesto_usd: number | string | null;
  pagina_origen: string | null;
  created_at: string;
};

/**
 * Fila de `public.consignments`. Columnas en español, como el esquema.
 *
 * Los montos llegan como `string` cuando PostgREST serializa `numeric`: por eso
 * cada columna de dinero admite `number | string`. La conversión vive en el
 * mapeador de `src/app/portal/consignaciones/model.ts`, en un solo lugar.
 *
 * `precio_minimo` es el piso autorizado por el dueño: RESERVADO, jamás se
 * muestra al comprador.
 */
export type ConsignmentRow = {
  id: string;
  propietario_nombre: string;
  propietario_documento: string | null;
  propietario_tipo_documento: string | null;
  propietario_telefono: string;
  propietario_email: string | null;
  vehicle_id: string | null;
  marca: string;
  modelo: string;
  anio: number;
  version: string | null;
  placa: string | null;
  kilometraje_km: number | null;
  color: string | null;
  precio_pedido: number | string;
  precio_minimo: number | string | null;
  moneda: string | null;
  tasacion_luxcars: number | string | null;
  tipo_comision: string;
  comision_porcentaje: number | string | null;
  comision_monto: number | string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: string;
  sin_exclusividad: boolean | null;
  vendido_por_dueno: boolean | null;
  vendido_por_dueno_en: string | null;
  vendido_por_dueno_notas: string | null;
  precio_venta_final: number | string | null;
  comision_cobrada: number | string | null;
  vendido_en: string | null;
  notas_internas: string | null;
  created_at: string;
};

/** Fila de `public.profiles`. */
export type ProfileRow = {
  id: string;
  rol: string;
  activo: boolean;
  nombre: string;
  telefono: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

/** Fila de `public.solicitudes_compra`. */
export type PurchaseRequestRow = {
  id: string;
  user_id: string;
  marca: string;
  modelo: string;
  anio_min: number | null;
  anio_max: number | null;
  condicion: string;
  presupuesto_max_usd: number | string | null;
  notas: string | null;
  estado: string;
  respuesta_luxcars: string | null;
  atendido_por: string | null;
  created_at: string;
  updated_at: string;
};

/** Fila de `public.solicitudes_venta`. */
export type SaleRequestRow = {
  id: string;
  user_id: string;
  marca: string;
  modelo: string;
  version: string | null;
  anio: number;
  categoria: string;
  kilometraje_km: number;
  color: string | null;
  placa: string | null;
  condicion_declarada: string | null;
  descripcion: string | null;
  precio_pedido: number | string;
  moneda: string | null;
  telefono_contacto: string;
  estado: string;
  motivo_rechazo: string | null;
  revisado_por: string | null;
  revisado_en: string | null;
  consignment_id: string | null;
  vehicle_id: string | null;
  created_at: string;
  updated_at: string;
};

/* ========================================================================== */
/* Constantes de validación (espejo de los enums de Postgres)                 */
/* ========================================================================== */

export const VEHICLE_STATUSES: readonly VehicleStatus[] = [
  "disponible",
  "reservado",
  "vendido",
  "en_transito",
];

export const VEHICLE_SOURCES: readonly VehicleSource[] = [
  "carga_manual",
  "importacion_directa",
  "consignacion",
  "feed_partner_licenciado",
];

export const VEHICLE_CATEGORY_IDS: readonly VehicleCategoryId[] = [
  "gasolina",
  "hev",
  "diesel",
  "ev",
  "phev",
];

export const VEHICLE_CONDITIONS: readonly VehicleCondition[] = [
  "nuevo",
  "usado",
];

export const CURRENCIES: readonly Currency[] = ["USD", "PEN"];

export const LEAD_ORIGINS: readonly LeadOrigin[] = [
  "calculadora",
  "contacto",
  "stock",
  "consignacion",
];

export const LEAD_STATUSES: readonly LeadStatus[] = [
  "nuevo",
  "contactado",
  "calificado",
  "cotizado",
  "negociacion",
  "ganado",
  "perdido",
];

export const CONSIGNMENT_STATUSES: readonly ConsignmentStatus[] = [
  "activa",
  "pausada",
  "vendida_por_luxcars",
  "vendida_por_dueno",
  "retirada",
  "vencida",
];

export const COMMISSION_TYPES: readonly CommissionType[] = [
  "porcentaje",
  "monto_fijo",
];

export const USER_ROLES: readonly UserRole[] = ["cliente", "admin"];

export const PURCHASE_REQUEST_STATUSES: readonly PurchaseRequestStatus[] = [
  "nueva",
  "en_busqueda",
  "propuesta_enviada",
  "cerrada",
  "descartada",
];

export const SALE_REQUEST_STATUSES: readonly SaleRequestStatus[] = [
  "pendiente",
  "aprobada",
  "rechazada",
  "retirada",
];

export const PURCHASE_REQUEST_CONDITIONS: readonly PurchaseRequestCondition[] = [
  "nuevo",
  "usado",
  "indistinto",
];

/**
 * Régimen peruano de importación de vehículos usados (año calendario 2026),
 * reproducido acá SOLO como referencia para la UI del admin.
 *
 * La única fuente de verdad para decidir admisibilidad es `checkAdmissibility()`
 * en `src/core/pricing/priceCalculator.ts`. NO reimplementes la norma: dos
 * implementaciones de la misma regla terminan discrepando.
 */
export const IMPORT_COMPLIANCE_REFERENCE = {
  /**
   * Antigüedad máxima en años, contando el año en curso como el primero: en
   * 2026, solo modelos 2025 en adelante. Cálculo: `oldestImportableModelYear()`.
   */
  maxVehicleAgeYears: 2,
  /** Diésel USADO: PROHIBIDO en autos y camionetas. Sin excepciones. */
  usedDieselAllowed: false,
  /** Timón izquierdo de fábrica: obligatorio. */
  leftHandDriveRequired: true,
  /** Tope de kilometraje: M1 (autos y SUV) / N1 (camionetas y pickups). */
  maxMileageKm: { M1: 32000, N1: 36000 },
} as const;
