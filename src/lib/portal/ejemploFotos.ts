/**
 * Foto de un "ejemplo de importación a pedido" (/portal/ejemplos). Solo cliente.
 *
 * Es el mismo baile que hacen las fotos del stock en `vehiclePhotos.ts`
 * —pedir permiso a `/api/portal/fotos`, subir directo al bucket con la URL
 * firmada, borrar pidiendo permiso otra vez— pero sin fila en
 * `vehicle_photos`: la URL pública termina dentro de `datos.imageSrc` del
 * ejemplo. Por eso vive aparte y no toca aquel archivo: allá cada paso está
 * atado a un vehículo y a su galería.
 *
 * Las fotos de ejemplos van a la carpeta `ejemplos/` del bucket. Esa carpeta
 * es también la RED DE SEGURIDAD del borrado: `rutaDeFotoEjemplo` solo
 * devuelve rutas de ahí, así que desde esta pantalla nunca se puede borrar la
 * foto de un auto del stock aunque alguien pegara su URL.
 *
 * Reglas de honestidad: acá solo entran fotos propias o con licencia que
 * permita uso comercial (ver `src/data/trendingVehicles.ts`). La subida no
 * puede comprobarlo; el formulario lo dice en claro y `validarEjemplo` exige
 * licencia y crédito.
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import { ownBucketPrefix } from "@/lib/importExamples/validacion";
import { getPublicStorageUrl } from "@/lib/db/storage";
import { comprimirFoto } from "@/lib/portal/imageCompression";

const RUTA_FOTOS = "/api/portal/fotos";
const CARPETA = "ejemplos";

/** Tope por foto; `/api/portal/fotos` aplica el mismo. */
const BYTES_MAXIMOS = 15 * 1024 * 1024;

/**
 * La tarjeta de la home y de /importar muestra la foto a unos 600 px de ancho:
 * 1600 px de lado mayor cubre pantallas retina con margen y deja archivos de
 * pocos cientos de KB.
 */
const LADO_MAXIMO = 1600;

/** Lo que acepta el selector de archivo del formulario. */
export const TIPOS_FOTO_EJEMPLO = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export type FotoEjemploSubida = { path: string; publicUrl: string };

export type ResultadoFotoEjemplo =
  | { ok: true; foto: FotoEjemploSubida; nota?: string }
  | { ok: false; mensaje: string };

async function leerMensaje(respuesta: Response, porDefecto: string): Promise<string> {
  try {
    const cuerpo = (await respuesta.json()) as { mensaje?: unknown };
    return typeof cuerpo.mensaje === "string" && cuerpo.mensaje ? cuerpo.mensaje : porDefecto;
  } catch {
    return porDefecto;
  }
}

/**
 * Comprime y sube una foto a `ejemplos/`. Devuelve la ruta (para poder
 * borrarla) y la URL pública (lo que se guarda en `imageSrc`).
 */
export async function subirFotoEjemplo(file: File): Promise<ResultadoFotoEjemplo> {
  const tipoOriginal = (file.type || "").toLowerCase();
  if (!(TIPOS_FOTO_EJEMPLO as readonly string[]).includes(tipoOriginal)) {
    return { ok: false, mensaje: "Solo se aceptan fotos JPEG, PNG, WebP o AVIF." };
  }

  let path: string | null = null;
  try {
    const comprimida = await comprimirFoto(file, { ladoMaximo: LADO_MAXIMO });
    if (comprimida.blob.size === 0) return { ok: false, mensaje: "El archivo está vacío." };
    if (comprimida.blob.size > BYTES_MAXIMOS) {
      return { ok: false, mensaje: "La foto supera los 15 MB permitidos." };
    }
    const contentType = comprimida.contentType.toLowerCase();

    const permiso = await fetch(RUTA_FOTOS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carpeta: CARPETA, contentType, bytes: comprimida.blob.size }),
    });
    if (!permiso.ok) {
      return { ok: false, mensaje: await leerMensaje(permiso, "No se pudo preparar la subida.") };
    }
    const cuerpo = (await permiso.json()) as {
      ok?: unknown;
      mensaje?: unknown;
      path?: unknown;
      url?: unknown;
      headers?: unknown;
      publicUrl?: unknown;
    };
    if (cuerpo.ok === false || typeof cuerpo.path !== "string" || typeof cuerpo.url !== "string") {
      return {
        ok: false,
        mensaje: typeof cuerpo.mensaje === "string" && cuerpo.mensaje ? cuerpo.mensaje : "No se pudo preparar la subida.",
      };
    }
    path = cuerpo.path;
    const publicUrl =
      (typeof cuerpo.publicUrl === "string" && cuerpo.publicUrl) || getPublicStorageUrl(path);
    if (!publicUrl) {
      return { ok: false, mensaje: "El almacenamiento de fotos no está configurado en este despliegue." };
    }

    // Con EXACTAMENTE las cabeceras que firmó el servidor: cambiar una invalida la firma.
    const headers =
      cuerpo.headers && typeof cuerpo.headers === "object" ? (cuerpo.headers as Record<string, string>) : {};
    const subida = await fetch(cuerpo.url, { method: "PUT", headers, body: comprimida.blob });
    if (!subida.ok) {
      return {
        ok: false,
        mensaje:
          subida.status === 403
            ? "El permiso de subida venció. Vuelve a intentarlo."
            : `El almacenamiento rechazó la foto (${subida.status}). Vuelve a intentarlo.`,
      };
    }

    return { ok: true, foto: { path, publicUrl }, nota: comprimida.nota };
  } catch (error) {
    // Un corte de red durante el PUT puede haber dejado el archivo arriba. Acá
    // no hay fila que lo use (a diferencia del stock), así que se borra sin
    // preguntar: lo peor que pasa es un DELETE de algo que no existe.
    if (path) await quitarFotoEjemplo(path);
    return {
      ok: false,
      mensaje: `No se pudo subir la foto: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Borra un archivo de `ejemplos/`. `false` si no se pudo; nunca lanza. */
export async function quitarFotoEjemplo(path: string): Promise<boolean> {
  if (!path.startsWith(`${CARPETA}/`)) return false;
  try {
    const respuesta = await fetch(RUTA_FOTOS, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paths: [path] }),
    });
    return respuesta.ok;
  } catch {
    return false;
  }
}

/**
 * Ruta en el bucket de una foto SUBIDA desde esta pantalla, o `null` si es
 * otra cosa: una ruta local del sitio (`/images/vehiculos/…`, que vive en el
 * repositorio y no se borra nunca desde acá) o un archivo fuera de `ejemplos/`.
 */
export function rutaDeFotoEjemplo(src: string | null | undefined): string | null {
  if (!src) return null;
  const prefijo = ownBucketPrefix();
  if (!prefijo || !src.startsWith(prefijo)) return null;
  let ruta: string;
  try {
    // `getPublicStorageUrl` codifica cada segmento; se deshace igual.
    ruta = src
      .slice(prefijo.length)
      .split(/[?#]/)[0]
      .split("/")
      .map(decodeURIComponent)
      .join("/");
  } catch {
    return null;
  }
  return ruta.startsWith(`${CARPETA}/`) && !ruta.includes("..") ? ruta : null;
}
