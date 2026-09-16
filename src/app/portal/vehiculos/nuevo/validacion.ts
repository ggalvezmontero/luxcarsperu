/**
 * Validación del alta de vehículo: `FormData` → fila lista para Postgres.
 *
 * Es una función pura, sin React y sin Supabase, por dos razones: se puede
 * probar sola, y el día que el alta vuelva al servidor (con `@supabase/ssr` y
 * un `middleware.ts` que valide la sesión) se reutiliza tal cual.
 *
 * QUÉ VALIDA Y POR QUÉ, SI LA BASE YA VALIDA: las reglas de abajo son espejo de
 * los CHECK de `supabase/migrations/20260915090200_vehicles.sql`. La barrera de
 * verdad es Postgres —acá corre en el navegador, así que no protege de nada—,
 * pero sirve para devolver "para publicar hace falta el precio de venta" en vez
 * de un `violates check constraint "vehicles_publicado_exige_precio"` en inglés
 * y en mayúsculas. Si cambia la migración, hay que cambiar esto; está anotado
 * en ambos lados.
 *
 * LO QUE NO SE REIMPLEMENTA ACÁ: la normativa de importación (antigüedad
 * máxima, diésel usado prohibido, tope de kilometraje). Su única fuente de
 * verdad es `checkAdmissibility()` en `src/core/pricing/priceCalculator.ts`.
 * El formulario la consulta y muestra el aviso, pero el alta NO bloquea: un
 * auto en consignación de un cliente peruano puede tener ocho años y 150,000 km
 * con toda legitimidad. Esas reglas aplican al IMPORTAR, no al inventariar.
 */

import type { NuevoVehiculoRow } from "../consultas";
import { validateVin } from "@/lib/vin";
import type {
  Currency,
  VehicleCategoryId,
  VehicleCondition,
  VehicleSource,
  VehicleStatus,
} from "@/lib/db/types";

export type ErroresCampo = Record<string, string>;

export type ResultadoValidacion =
  | { ok: true; fila: NuevoVehiculoRow; titulo: string; publicado: boolean }
  | { ok: false; errores: ErroresCampo; mensaje: string };

const CATEGORIES: readonly VehicleCategoryId[] = [
  "gasolina",
  "hev",
  "diesel",
  "ev",
  "phev",
];
const CONDITIONS: readonly VehicleCondition[] = ["nuevo", "usado"];
const STATUSES: readonly VehicleStatus[] = [
  "disponible",
  "reservado",
  "vendido",
  "en_transito",
];
const CURRENCIES: readonly Currency[] = ["USD", "PEN"];

/**
 * Fuentes elegibles desde el formulario. `feed_partner_licenciado` NO está:
 * esa etiqueta solo puede ponerla un importador de feed con contrato firmado,
 * no una persona cargando un auto a mano. Dejarla en el desplegable sería
 * invitar a etiquetar mal la procedencia del dato, que es justo lo que la lista
 * blanca de la base de datos existe para evitar.
 */
const SOURCES: readonly VehicleSource[] = [
  "carga_manual",
  "importacion_directa",
  "consignacion",
];

/** Máximo de líneas que se guardan en `destacados`. */
const MAX_DESTACADOS = 12;

function texto(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function bandera(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

function opcion<T extends string>(
  formData: FormData,
  name: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = formData.get(name);
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

type NumeroLeido =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/** Lee un número opcional. Rechaza texto y los rangos que la BD no acepta. */
function numero(
  formData: FormData,
  name: string,
  opciones: { min?: number; max?: number; etiqueta: string },
): NumeroLeido {
  const raw = texto(formData, name);
  if (raw === null) return { ok: true, value: null };

  // Se aceptan "32,000" y "32 000": es como se pega desde un anuncio.
  const parsed = Number(raw.replace(/[\s,]/g, ""));
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: `${opciones.etiqueta} debe ser un número.` };
  }
  if (opciones.min !== undefined && parsed < opciones.min) {
    return {
      ok: false,
      error: `${opciones.etiqueta} no puede ser menor que ${opciones.min}.`,
    };
  }
  if (opciones.max !== undefined && parsed > opciones.max) {
    return {
      ok: false,
      error: `${opciones.etiqueta} no puede ser mayor que ${opciones.max}.`,
    };
  }
  return { ok: true, value: parsed };
}

/** URL legible: "2026-toyota-gr-supra-final-edition". */
export function slugificar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function validarVehiculo(formData: FormData): ResultadoValidacion {
  const errores: ErroresCampo = {};

  /* --- Identificación ---------------------------------------------------- */

  const vinCrudo = texto(formData, "vin");
  let vin: string | null = null;
  if (vinCrudo) {
    const validacion = validateVin(vinCrudo);
    if (!validacion.valid) errores.vin = validacion.reason;
    else vin = validacion.vin;
  }

  const marca = texto(formData, "marca");
  const modelo = texto(formData, "modelo");
  if (!marca) errores.marca = "La marca es obligatoria.";
  if (!modelo) errores.modelo = "El modelo es obligatorio.";

  const anio = numero(formData, "anio", {
    min: 1980,
    max: 2100,
    etiqueta: "El año",
  });
  if (!anio.ok) errores.anio = anio.error;
  else if (anio.value === null) errores.anio = "El año es obligatorio.";

  /* --- Ficha técnica ----------------------------------------------------- */

  const cilindrada = numero(formData, "cilindrada_cc", {
    min: 0,
    max: 20000,
    etiqueta: "La cilindrada",
  });
  if (!cilindrada.ok) errores.cilindrada_cc = cilindrada.error;

  const puertas = numero(formData, "puertas", {
    min: 1,
    max: 8,
    etiqueta: "Las puertas",
  });
  if (!puertas.ok) errores.puertas = puertas.error;

  const asientos = numero(formData, "asientos", {
    min: 1,
    max: 30,
    etiqueta: "Los asientos",
  });
  if (!asientos.ok) errores.asientos = asientos.error;

  const kilometraje = numero(formData, "kilometraje_km", {
    min: 0,
    max: 2_000_000,
    etiqueta: "El kilometraje",
  });
  if (!kilometraje.ok) errores.kilometraje_km = kilometraje.error;

  /* --- Comercial --------------------------------------------------------- */

  const precioCompra = numero(formData, "precio_compra", {
    min: 0,
    etiqueta: "El precio de compra",
  });
  if (!precioCompra.ok) errores.precio_compra = precioCompra.error;

  const precioVenta = numero(formData, "precio_venta", {
    min: 0,
    etiqueta: "El precio de venta",
  });
  if (!precioVenta.ok) errores.precio_venta = precioVenta.error;

  /* --- Operación y publicación ------------------------------------------- */

  const categoria = opcion(formData, "categoria", CATEGORIES, "gasolina");
  const condicion = opcion(formData, "condicion", CONDITIONS, "usado");
  const estado = opcion(formData, "estado", STATUSES, "disponible");
  const fuente = opcion(formData, "fuente", SOURCES, "carga_manual");
  const monedaCompra = opcion(formData, "moneda_compra", CURRENCIES, "USD");
  const monedaVenta = opcion(formData, "moneda_venta", CURRENCIES, "USD");

  const publicado = bandera(formData, "publicado");
  const negociable = bandera(formData, "precio_negociable");
  const vendidoEn = texto(formData, "vendido_en");
  const titular = texto(formData, "titular");

  // Espejo de `vehicles_vendido_exige_fecha`.
  if (estado === "vendido" && !vendidoEn) {
    errores.vendido_en =
      "Un vehículo marcado como vendido necesita la fecha de venta.";
  }

  // Espejo de `vehicles_publicado_exige_precio`: publicar sin precio obliga al
  // cliente a escribir por WhatsApp solo para saber cuánto cuesta.
  if (publicado && (!precioVenta.ok || precioVenta.value === null)) {
    errores.precio_venta =
      "Para publicar el auto en la web hace falta el precio de venta.";
  }

  const nombreBase =
    titular ??
    [anio.ok ? anio.value : null, marca, modelo, texto(formData, "version")]
      .filter(Boolean)
      .join(" ");

  // Espejo de `vehicles_publicado_exige_slug`. Si no se escribió slug y se pidió
  // publicar, se arma uno: la cola del VIN evita que dos unidades del mismo
  // modelo y año choquen.
  const slugManual = texto(formData, "slug");
  let slug = slugManual ? slugificar(slugManual) : null;
  if (publicado && !slug) {
    const cola = vin ? `-${vin.slice(-6).toLowerCase()}` : "";
    const base = slugificar(nombreBase);
    slug = base ? `${base}${cola}` : null;
    if (!slug) {
      errores.slug =
        "No se pudo generar la URL automáticamente. Escribe un slug o completa marca, modelo y año.";
    }
  }

  const cantidad = Object.keys(errores).length;
  if (cantidad > 0) {
    return {
      ok: false,
      errores,
      mensaje:
        cantidad === 1
          ? "Falta corregir un campo."
          : `Faltan corregir ${cantidad} campos.`,
    };
  }

  /* --- Fila, en las columnas reales de Postgres -------------------------- */

  const destacadosCrudo = texto(formData, "destacados");
  const destacados = destacadosCrudo
    ? destacadosCrudo
        .split("\n")
        .map((linea) => linea.trim())
        .filter(Boolean)
        .slice(0, MAX_DESTACADOS)
    : [];

  const fila: NuevoVehiculoRow = {
    // Procedencia del DATO. La base la valida contra su lista blanca.
    fuente,
    fuente_referencia: texto(formData, "fuente_referencia"),

    vin,
    placa: texto(formData, "placa"),

    marca,
    modelo,
    version: texto(formData, "version"),
    anio: anio.ok ? anio.value : null,
    carroceria: texto(formData, "carroceria"),

    categoria,
    condicion,
    cilindrada_cc: cilindrada.ok ? cilindrada.value : null,
    transmision: texto(formData, "transmision"),
    traccion: texto(formData, "traccion"),
    color_exterior: texto(formData, "color_exterior"),
    color_interior: texto(formData, "color_interior"),
    puertas: puertas.ok ? puertas.value : null,
    asientos: asientos.ok ? asientos.value : null,
    kilometraje_km: (kilometraje.ok ? kilometraje.value : null) ?? 0,

    precio_compra: precioCompra.ok ? precioCompra.value : null,
    moneda_compra: monedaCompra,
    fecha_compra: texto(formData, "fecha_compra"),

    precio_venta: precioVenta.ok ? precioVenta.value : null,
    moneda_venta: monedaVenta,
    precio_negociable: negociable,

    vendido_en: vendidoEn,

    estado,
    ubicacion: texto(formData, "ubicacion"),

    publicado,
    slug,
    titular: titular ?? (nombreBase || null),
    descripcion: texto(formData, "descripcion"),
    destacados,

    notas_internas: texto(formData, "notas_internas"),
  };

  // `fecha_ingreso` solo viaja si se cambió; si no, manda el `default
  // current_date` de la tabla.
  const fechaIngreso = texto(formData, "fecha_ingreso");
  if (fechaIngreso) fila.fecha_ingreso = fechaIngreso;

  return {
    ok: true,
    fila,
    titulo: nombreBase || `${marca} ${modelo}`,
    publicado,
  };
}
