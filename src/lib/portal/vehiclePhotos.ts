/**
 * Galería del stock: leer, subir, ordenar, marcar portada y borrar.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTO CORRE EN EL NAVEGADOR Y NO EN UNA RUTA DE API DEL SERVIDOR
 * ────────────────────────────────────────────────────────────────────────────
 * Las políticas de `vehicle_photos` ya otorgan insert/update/delete al rol
 * `authenticated` (ver la migración 20260915090300_vehicle_photos.sql). Con la
 * sesión del equipo, el navegador tiene exactamente los permisos que necesita
 * y ni uno más: RLS sigue siendo el candado de las FILAS.
 *
 * La alternativa —una ruta `/api` que escriba con `DATABASE_URL`— sería un
 * retroceso de seguridad: esa conexión SALTA TODAS LAS POLÍTICAS, así que la
 * ruta tendría que reimplementar por su cuenta el control de acceso que
 * Postgres ya hace bien, y cualquier error ahí abre el inventario entero. Es
 * la misma decisión, y por las mismas razones, que documenta el encabezado de
 * `src/lib/portal/portalClient.ts`.
 *
 * LOS ARCHIVOS SON LA EXCEPCIÓN. El bucket de Neon Object Storage no tiene
 * políticas por usuario, así que escribir o borrar un archivo pide permiso a
 * `/api/portal/fotos`, que comprueba la sesión y firma la operación. La foto
 * igual sube directo del teléfono al bucket con esa URL firmada: esquiva el
 * límite de ~4.5 MB que tiene el cuerpo de una función serverless en Vercel y
 * ahorra un salto de red en una conexión móvil que ya es lenta.
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

import { getPublicStorageUrl } from "@/lib/db/storage";
import type { PortalClient } from "@/lib/portal/portalClient";

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

/** Tope por foto. `/api/portal/fotos` aplica el mismo. */
export const BYTES_MAXIMOS = 15 * 1024 * 1024;

/** Los mismos tipos que acepta `/api/portal/fotos`, que es quien decide la extensión. */
const TIPOS_ADMITIDOS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
]);

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
/* Archivos del bucket                                                        */
/* ========================================================================== */

/** Ruta de este sitio que firma las escrituras del bucket tras comprobar la sesión. */
const RUTA_FOTOS = "/api/portal/fotos";

type PermisoSubida = {
  path: string;
  url: string;
  headers: Record<string, string>;
  publicUrl: string | null;
};

async function leerMensaje(respuesta: Response, porDefecto: string): Promise<string> {
  try {
    const cuerpo = (await respuesta.json()) as { mensaje?: unknown };
    return typeof cuerpo.mensaje === "string" && cuerpo.mensaje
      ? cuerpo.mensaje
      : porDefecto;
  } catch {
    return porDefecto;
  }
}

/** Pide al servidor una URL firmada para subir UNA foto de este vehículo. */
async function pedirPermisoSubida(
  vehicleId: string,
  contentType: string,
  bytes: number,
): Promise<ResultadoFoto<PermisoSubida>> {
  const respuesta = await fetch(RUTA_FOTOS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vehicleId, contentType, bytes }),
  });
  if (!respuesta.ok) {
    return {
      ok: false,
      mensaje: await leerMensaje(respuesta, "No se pudo preparar la subida."),
    };
  }
  const cuerpo = (await respuesta.json()) as Partial<PermisoSubida>;
  if (!cuerpo.path || !cuerpo.url) {
    return { ok: false, mensaje: "No se pudo preparar la subida." };
  }
  return {
    ok: true,
    data: {
      path: cuerpo.path,
      url: cuerpo.url,
      headers: cuerpo.headers ?? {},
      publicUrl: cuerpo.publicUrl ?? null,
    },
  };
}

/** Quita archivos del bucket. `false` si el servidor no pudo; nunca lanza. */
async function quitarArchivos(paths: string[]): Promise<boolean> {
  try {
    const respuesta = await fetch(RUTA_FOTOS, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    return respuesta.ok;
  } catch {
    return false;
  }
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
  client: PortalClient | null,
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
  client: PortalClient | null,
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
 * Borra del bucket un archivo que quedó sin fila tras una excepción.
 *
 * Con una excepción no se sabe en qué punto se cortó: puede que el INSERT sí
 * haya llegado a la base y lo que se perdió fue la respuesta. Borrar el archivo
 * en ese caso dejaría una fila apuntando a la nada —una imagen rota en la ficha
 * pública—, que es peor que un archivo huérfano. Por eso se pregunta primero:
 * solo si la base confirma que NO hay fila con esa ruta se borra el archivo.
 * Si ni siquiera se puede preguntar (sin red), se deja: centavos de cuota
 * contra una ficha rota. Nunca lanza.
 */
async function limpiarSiHuerfano(client: PortalClient, storagePath: string): Promise<void> {
  try {
    const { data, error } = await client
      .from(TABLA_FOTOS)
      .select("id")
      .eq("storage_path", storagePath)
      .limit(1);
    if (error) return;
    if (Array.isArray(data) && data.length > 0) return;
    await quitarArchivos([storagePath]);
  } catch {
    // Sin red no hay cómo comprobarlo; ver arriba.
  }
}

/**
 * Sube el archivo al bucket y registra la fila.
 *
 * ORDEN DELIBERADO — primero el archivo, después la fila. Si el INSERT falla se
 * borra el objeto recién subido para no dejar archivos huérfanos pagando cuota.
 * Al revés sería peor: una fila apuntando a un archivo inexistente rompe la
 * ficha pública con una imagen rota, que es un problema visible para el cliente.
 *
 * `es_principal` y `orden` NO se calculan acá: los pone el trigger
 * `tg_acomodar_foto` de la base (primera foto = portada, las demás al final).
 * Duplicar esa lógica en el cliente crearía dos verdades que se separan.
 */
export async function subirFoto(
  client: PortalClient | null,
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
  if (!TIPOS_ADMITIDOS.has(tipo)) {
    return { ok: false, mensaje: "Solo se aceptan fotos JPEG, PNG, WebP, AVIF o HEIC." };
  }

  // Fuera del `try` para que el `catch` sepa si ya hay un archivo que limpiar.
  let storagePath: string | null = null;

  try {
    // La ruta ({vehicle_id}/{uuid}.{ext}) la decide el servidor al firmar.
    const permiso = await pedirPermisoSubida(entrada.vehicleId, tipo, entrada.blob.size);
    if (!permiso.ok) return permiso;
    storagePath = permiso.data.path;

    const subida = await fetch(permiso.data.url, {
      method: "PUT",
      headers: permiso.data.headers,
      body: entrada.blob,
    });
    if (!subida.ok) {
      return {
        ok: false,
        mensaje:
          subida.status === 403
            ? "El permiso de subida venció. Vuelve a intentarlo."
            : `El almacenamiento rechazó la foto (${subida.status}). Vuelve a intentarlo.`,
      };
    }

    const { data, error } = await client
      .from(TABLA_FOTOS)
      .insert({
        vehicle_id: entrada.vehicleId,
        storage_path: storagePath,
        url_publica: permiso.data.publicUrl ?? getPublicStorageUrl(storagePath),
        alt: entrada.alt.slice(0, 300),
        ancho_px: entrada.anchoPx,
        alto_px: entrada.altoPx,
        bytes: entrada.blob.size,
      })
      .select(COLUMNAS)
      .single();

    if (error || !data) {
      // Sin fila, el archivo no le sirve a nadie: se limpia.
      await quitarArchivos([storagePath]);
      return {
        ok: false,
        mensaje: error
          ? `${describirError(error)} La foto no se guardó.`
          : "La foto se subió pero no se pudo registrar. Se descartó el archivo.",
      };
    }

    return { ok: true, data: mapearFoto(data as unknown as FilaFoto, 0) };
  } catch (error) {
    // Una excepción (corte de red durante el PUT o durante el INSERT) también
    // puede dejar el archivo subido sin fila que lo use. Antes solo se limpiaba
    // en la rama `error` de arriba.
    if (storagePath) await limpiarSiHuerfano(client, storagePath);
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

/**
 * Guarda el orden nuevo. `ids` va en el orden final que se ve en pantalla.
 *
 * REGLA DE LA GALERÍA: LA PRIMERA FOTO ES LA PORTADA. Antes esta función solo
 * escribía `orden`; `es_principal` no cambiaba y `listarFotos` ordena
 * `es_principal desc, orden asc`, así que mover una foto al primer lugar
 * anunciaba "Ahora es la portada" pero la portada real —la que muestra el sitio
 * público— seguía siendo la otra, y al recargar la galería volvía atrás.
 *
 * Ahora, después de escribir el orden, si la portada no es `ids[0]` se mueve
 * con `marcarPortada` (que respeta el índice único parcial
 * `vehicle_photos_una_principal_idx`: apaga la anterior antes de encender la
 * nueva). Así el orden guardado y la portada siempre dicen lo mismo.
 */
export async function guardarOrden(
  client: PortalClient | null,
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

    const primera = ids[0];
    if (primera) {
      const { data: actual, error: errorPortada } = await client
        .from(TABLA_FOTOS)
        .select("id")
        .eq("vehicle_id", vehicleId)
        .eq("es_principal", true)
        .limit(1)
        .maybeSingle();

      if (errorPortada) return { ok: false, mensaje: describirError(errorPortada) };

      if ((actual as { id: string } | null)?.id !== primera) {
        const portada = await marcarPortada(client, vehicleId, primera);
        if (!portada.ok) return portada;
      }
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
  client: PortalClient | null,
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
  client: PortalClient | null,
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
  client: PortalClient | null,
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

    const archivoQuitado = await quitarArchivos([foto.path]);

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
        aviso: archivoQuitado
          ? undefined
          : "La foto se quitó de la ficha, pero el archivo quedó en el almacenamiento.",
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
