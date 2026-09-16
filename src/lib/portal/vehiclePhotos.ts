/**
 * Galería del stock: leer, subir, ordenar, marcar portada y borrar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTO CORRE EN EL NAVEGADOR Y NO EN UNA RUTA DE API DEL SERVIDOR
 * ────────────────────────────────────────────────────────────────────────────
 * Las políticas de `vehicle_photos` y del bucket `vehiculos` ya otorgan
 * insert/update/delete al rol `authenticated` (ver la migración
 * 20260915090300_vehicle_photos.sql). Con la sesión del equipo, el navegador
 * tiene exactamente los permisos que necesita y ni uno más: RLS sigue siendo el
 * candado.
 *
 * La alternativa —una ruta `/api` que escriba con `service_role`— sería un
 * retroceso de seguridad: esa llave SALTA TODAS LAS POLÍTICAS, así que la ruta
 * tendría que reimplementar por su cuenta el control de acceso que Postgres ya
 * hace bien, y cualquier error ahí abre el inventario entero. Es la misma
 * decisión, y por las mismas razones, que documenta el encabezado de
 * `src/lib/portal/supabaseBrowser.ts`.
 *
 * DE REGALO, RESUELVE EL PROBLEMA QUE MÁS IMPORTA ACÁ: subir directo del
 * teléfono a Supabase Storage esquiva el límite de ~4.5 MB que tiene el cuerpo
 * de una función serverless en Vercel, y ahorra un salto de red en una conexión
 * móvil que ya es lenta.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * RESTRICCIÓN LEGAL — NO LA "OPTIMICES" DENTRO DE SEIS MESES
 * ────────────────────────────────────────────────────────────────────────────
 * Acá solo entran fotos tomadas por el equipo o del fabricante con derecho de
 * uso. Está PROHIBIDO por contrato persistir imágenes o inventario de
 * MarketCheck, Auto.dev, eBay, Autotrader, CarGurus, Cars.com, TrueCar,
 * AutoTempest y Facebook Marketplace: sus términos prohíben textualmente
 * almacenar, cachear o indexar su contenido, y el incumplimiento revoca la
 * llave. Aparte del contrato, publicar la foto de otro auto como si fuera este
 * es publicidad engañosa. El mismo aviso vive en la migración y en
 * `src/lib/db/types.ts`; está repetido a propósito.
 *
 * NINGUNA FUNCIÓN LANZA: todas devuelven `ResultadoFoto` para que la interfaz
 * pueda mostrar un mensaje entendible parado al lado del auto.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { VEHICLE_PHOTOS_BUCKET, getPublicStorageUrl } from "@/lib/db/storage";

/* ========================================================================== */
/* Tipos                                                                      */
/* ========================================================================== */

/** Foto tal como la ve el portal. Incluye stock aún sin publicar. */
export type FotoVehiculo = {
  id: string;
  path: string;
  url: string | null;
  alt: string;
  orden: number;
  esPortada: boolean;
  bytes: number | null;
};

/** Ficha mínima para el encabezado. Sin precios ni notas internas. */
export type FichaVehiculo = {
  id: string;
  titulo: string;
  publicado: boolean;
};

export type ResultadoFoto<T> =
  | { ok: true; data: T }
  | { ok: false; mensaje: string };

type FilaFoto = {
  id: string;
  storage_path: string;
  url_publica: string | null;
  alt: string | null;
  orden: number | null;
  es_principal: boolean | null;
  bytes: number | string | null;
};

const TABLA_FOTOS = "vehicle_photos";
const TABLA_VEHICULOS = "vehicles";
const COLUMNAS = "id, storage_path, url_publica, alt, orden, es_principal, bytes";

const RE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tope del bucket `vehiculos`, fijado en la migración. */
export const BYTES_MAXIMOS = 15 * 1024 * 1024;

const EXTENSION_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
};

/* ========================================================================== */
/* Utilidades                                                                 */
/* ========================================================================== */

function mapearFoto(fila: FilaFoto, indice: number): FotoVehiculo {
  const bytes = fila.bytes === null || fila.bytes === undefined ? null : Number(fila.bytes);
  return {
    id: fila.id,
    path: fila.storage_path,
    // `url_publica` viene materializada; si faltara, se arma desde el bucket.
    url: fila.url_publica ?? getPublicStorageUrl(fila.storage_path),
    alt: fila.alt ?? "",
    orden: typeof fila.orden === "number" ? fila.orden : indice,
    esPortada: fila.es_principal === true,
    bytes: Number.isFinite(bytes) ? bytes : null,
  };
}

/**
 * Traduce el error de PostgREST a algo accionable.
 *
 * El caso que más va a pasar en la práctica es el 42501 / "row-level security":
 * la sesión caducó mientras el equipo fotografiaba. Decirle "error 42501" a
 * alguien parado en un estacionamiento no sirve de nada.
 */
function describirError(error: { message: string; code?: string }): string {
  const texto = error.message.toLowerCase();
  if (error.code === "42501" || texto.includes("row-level security")) {
    return "Tu sesión no tiene permiso para esta operación o caducó. Cierra sesión y vuelve a entrar.";
  }
  if (texto.includes("jwt") || texto.includes("expired")) {
    return "La sesión caducó. Vuelve a iniciar sesión para seguir subiendo fotos.";
  }
  if (texto.includes("failed to fetch") || texto.includes("network")) {
    return "Se cortó la conexión. Revisa la señal y vuelve a intentarlo.";
  }
  if (texto.includes("payload too large") || texto.includes("exceeded")) {
    return "La foto supera el máximo de 15 MB del almacenamiento.";
  }
  return error.message;
}

function sinSesion<T>(): ResultadoFoto<T> {
  return {
    ok: false,
    mensaje:
      "No hay sesión del portal. Inicia sesión en /portal/login para administrar las fotos.",
  };
}

/* ========================================================================== */
/* Lectura                                                                    */
/* ========================================================================== */

/**
 * Ficha del vehículo, publicado o no.
 *
 * Acepta UUID o slug porque el equipo copia cualquiera de los dos desde la
 * lista del portal; obligarlos a distinguir sería una fuente tonta de errores.
 */
export async function obtenerFichaVehiculo(
  client: SupabaseClient | null,
  idOSlug: string,
): Promise<ResultadoFoto<FichaVehiculo>> {
  if (!client) return sinSesion();

  const clave = idOSlug?.trim();
  if (!clave) return { ok: false, mensaje: "Falta el identificador del vehículo." };

  try {
    const { data, error } = await client
      .from(TABLA_VEHICULOS)
      .select("id, marca, modelo, version, anio, titular, publicado")
      .eq(RE_UUID.test(clave) ? "id" : "slug", clave)
      .limit(1)
      .maybeSingle();

    if (error) return { ok: false, mensaje: describirError(error) };
    if (!data) {
      return {
        ok: false,
        mensaje:
          "No se encontró ese vehículo. Puede que no exista o que tu sesión no tenga acceso.",
      };
    }

    const fila = data as {
      id: string;
      marca: string | null;
      modelo: string | null;
      version: string | null;
      anio: number | null;
      titular: string | null;
      publicado: boolean | null;
    };

    const titulo =
      fila.titular?.trim() ||
      [fila.anio, fila.marca, fila.modelo, fila.version]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      "Vehículo sin datos";

    return {
      ok: true,
      data: { id: fila.id, titulo, publicado: fila.publicado === true },
    };
  } catch (error) {
    return {
      ok: false,
      mensaje: `Error inesperado al leer el vehículo: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/** Galería completa, portada primero y después por `orden`. */
export async function listarFotos(
  client: SupabaseClient | null,
  vehicleId: string,
): Promise<ResultadoFoto<FotoVehiculo[]>> {
  if (!client) return sinSesion();

  try {
    const { data, error } = await client
      .from(TABLA_FOTOS)
      .select(COLUMNAS)
      .eq("vehicle_id", vehicleId)
      .order("es_principal", { ascending: false })
      .order("orden", { ascending: true });

    if (error) return { ok: false, mensaje: describirError(error) };
    return { ok: true, data: ((data ?? []) as unknown as FilaFoto[]).map(mapearFoto) };
  } catch (error) {
    return {
      ok: false,
      mensaje: `Error inesperado al leer la galería: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/* ========================================================================== */
/* Subida                                                                     */
/* ========================================================================== */

export type EntradaSubida = {
  vehicleId: string;
  blob: Blob;
  contentType: string;
  extension: string;
  alt: string;
  anchoPx: number | null;
  altoPx: number | null;
};

/**
 * Sube el archivo al bucket y registra la fila.
 *
 * ORDEN DELIBERADO — primero Storage, después la fila. Si el INSERT falla se
 * borra el objeto recién subido para no dejar archivos huérfanos pagando cuota.
 * Al revés sería peor: una fila apuntando a un archivo inexistente rompe la
 * ficha pública con una imagen rota, que es un problema visible para el cliente.
 *
 * `es_principal` y `orden` NO se calculan acá: los pone el trigger
 * `tg_acomodar_foto` de la base (primera foto = portada, las demás al final).
 * Duplicar esa lógica en el cliente crearía dos verdades que se separan.
 */
export async function subirFoto(
  client: SupabaseClient | null,
  entrada: EntradaSubida,
): Promise<ResultadoFoto<FotoVehiculo>> {
  if (!client) return sinSesion();

  if (entrada.blob.size === 0) {
    return { ok: false, mensaje: "El archivo está vacío." };
  }
  if (entrada.blob.size > BYTES_MAXIMOS) {
    return { ok: false, mensaje: "La foto supera los 15 MB permitidos." };
  }

  const tipo = entrada.contentType.toLowerCase();
  const extension = EXTENSION_POR_TIPO[tipo] ?? entrada.extension ?? "jpg";
  // Convención de la migración: {vehicle_id}/{uuid}.{ext}. El UUID evita que
  // dos fotos que el celular llamó igual (IMG_0001.jpg) se pisen.
  const storagePath = `${entrada.vehicleId}/${crypto.randomUUID()}.${extension}`;

  try {
    const { error: errorStorage } = await client.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .upload(storagePath, entrada.blob, {
        contentType: tipo,
        upsert: false,
        // Las fotos son inmutables: la ruta lleva UUID, así que nunca cambia el
        // contenido de una URL. Un año de caché es seguro y gratis.
        cacheControl: "31536000",
      });

    if (errorStorage) {
      return { ok: false, mensaje: describirError(errorStorage) };
    }

    const { data, error } = await client
      .from(TABLA_FOTOS)
      .insert({
        vehicle_id: entrada.vehicleId,
        storage_path: storagePath,
        url_publica: getPublicStorageUrl(storagePath),
        alt: entrada.alt.slice(0, 300),
        ancho_px: entrada.anchoPx,
        alto_px: entrada.altoPx,
        bytes: entrada.blob.size,
      })
      .select(COLUMNAS)
      .single();

    if (error || !data) {
      // Sin fila, el archivo no le sirve a nadie: se limpia.
      await client.storage.from(VEHICLE_PHOTOS_BUCKET).remove([storagePath]);
      return {
        ok: false,
        mensaje: error
          ? `${describirError(error)} La foto no se guardó.`
          : "La foto se subió pero no se pudo registrar. Se descartó el archivo.",
      };
    }

    return { ok: true, data: mapearFoto(data as unknown as FilaFoto, 0) };
  } catch (error) {
    return {
      ok: false,
      mensaje: `Error inesperado al subir: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/* ========================================================================== */
/* Orden, portada, alt y borrado                                              */
/* ========================================================================== */

/** Guarda el orden nuevo. `ids` va en el orden final que se ve en pantalla. */
export async function guardarOrden(
  client: SupabaseClient | null,
  vehicleId: string,
  ids: string[],
): Promise<ResultadoFoto<null>> {
  if (!client) return sinSesion();

  try {
    for (let indice = 0; indice < ids.length; indice += 1) {
      const { error } = await client
        .from(TABLA_FOTOS)
        // `orden` arranca en 1: el trigger de inserción interpreta el 0 como
        // "ponla al final", así que dejar un 0 guardado sería ambiguo.
        .update({ orden: indice + 1 })
        .eq("id", ids[indice])
        // Acotar por vehículo es una red de seguridad: aunque llegara el id de
        // una foto de otro auto, no se puede mover desde acá.
        .eq("vehicle_id", vehicleId);

      if (error) return { ok: false, mensaje: describirError(error) };
    }
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      mensaje: `Error inesperado al guardar el orden: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Marca la portada.
 *
 * Son dos pasos porque la base tiene un índice ÚNICO PARCIAL de una sola
 * portada por vehículo: hay que apagar la anterior antes de encender la nueva o
 * el UPDATE choca contra el índice.
 */
export async function marcarPortada(
  client: SupabaseClient | null,
  vehicleId: string,
  photoId: string,
): Promise<ResultadoFoto<null>> {
  if (!client) return sinSesion();

  try {
    const { error: errorApagar } = await client
      .from(TABLA_FOTOS)
      .update({ es_principal: false })
      .eq("vehicle_id", vehicleId)
      .eq("es_principal", true);

    if (errorApagar) return { ok: false, mensaje: describirError(errorApagar) };

    const { error } = await client
      .from(TABLA_FOTOS)
      .update({ es_principal: true })
      .eq("id", photoId)
      .eq("vehicle_id", vehicleId);

    if (error) {
      return {
        ok: false,
        mensaje: `${describirError(error)} El vehículo quedó sin portada: vuelve a marcar una.`,
      };
    }
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      mensaje: `Error inesperado al marcar la portada: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/** Guarda el texto alternativo. Sin alt no hay accesibilidad ni SEO. */
export async function guardarAlt(
  client: SupabaseClient | null,
  vehicleId: string,
  photoId: string,
  alt: string,
): Promise<ResultadoFoto<null>> {
  if (!client) return sinSesion();

  try {
    const { error } = await client
      .from(TABLA_FOTOS)
      .update({ alt: alt.slice(0, 300) })
      .eq("id", photoId)
      .eq("vehicle_id", vehicleId);

    if (error) return { ok: false, mensaje: describirError(error) };
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      mensaje: `Error inesperado al guardar la descripción: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Borra una foto: primero la fila, después el archivo.
 *
 * Si la borrada era la portada se promueve la siguiente, para que la ficha
 * pública nunca quede sin imagen principal. Si el archivo no se puede quitar
 * del bucket, la operación igual se considera exitosa y se avisa: un objeto
 * huérfano cuesta centavos, una galería que no se deja corregir cuesta una venta.
 */
export async function borrarFoto(
  client: SupabaseClient | null,
  vehicleId: string,
  foto: FotoVehiculo,
): Promise<ResultadoFoto<{ aviso?: string }>> {
  if (!client) return sinSesion();

  try {
    const { error } = await client
      .from(TABLA_FOTOS)
      .delete()
      .eq("id", foto.id)
      .eq("vehicle_id", vehicleId);

    if (error) return { ok: false, mensaje: describirError(error) };

    const { error: errorArchivo } = await client.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .remove([foto.path]);

    if (foto.esPortada) {
      const { data: siguiente } = await client
        .from(TABLA_FOTOS)
        .select("id")
        .eq("vehicle_id", vehicleId)
        .order("orden", { ascending: true })
        .limit(1)
        .maybeSingle();

      const idSiguiente = (siguiente as { id: string } | null)?.id;
      if (idSiguiente) {
        await client
          .from(TABLA_FOTOS)
          .update({ es_principal: true })
          .eq("id", idSiguiente)
          .eq("vehicle_id", vehicleId);
      }
    }

    return {
      ok: true,
      data: {
        aviso: errorArchivo
          ? "La foto se quitó de la ficha, pero el archivo quedó en el almacenamiento."
          : undefined,
      },
    };
  } catch (error) {
    return {
      ok: false,
      mensaje: `Error inesperado al borrar: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
