/**
 * Fotos que el cliente adjunta a su solicitud de venta, DESDE EL NAVEGADOR.
 *
 * Habla con `/api/cuenta/solicitudes/fotos`, que es quien comprueba la sesión y
 * que la solicitud sea de quien sube (ver esa ruta). La foto no pasa por el
 * servidor del sitio: la ruta entrega una URL firmada y el archivo sube directo
 * al almacenamiento.
 *
 * NINGUNA FUNCIÓN LANZA: devuelven `ok: false` con un mensaje para mostrar.
 */

import { comprimirFoto } from "@/lib/portal/imageCompression";

/** Mismo tope que aplica el servidor. Aquí solo evita ofrecer lo que se va a rechazar. */
export const FOTOS_MAXIMAS_SOLICITUD = 12;

const RUTA = "/api/cuenta/solicitudes/fotos";

/** Tipos que acepta la ruta. HEIF es el mismo formato que HEIC con otro nombre. */
const TIPO_ACEPTADO: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/heic": "image/heic",
  "image/heif": "image/heic",
};

export type FotoDeSolicitud = { path: string; url: string; bytes: number };

export type ResultadoSubida = { ok: true; foto: FotoDeSolicitud } | { ok: false; mensaje: string };

const MSG_GENERICO = "No se pudo subir la foto. Revisa tu conexión.";

async function leerJson(respuesta: Response): Promise<Record<string, unknown>> {
  try {
    const cuerpo: unknown = await respuesta.json();
    return cuerpo && typeof cuerpo === "object" ? (cuerpo as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Comprime una foto y la sube a la carpeta de la solicitud. */
export async function subirFotoDeSolicitud(solicitudId: string, archivo: File): Promise<ResultadoSubida> {
  try {
    const comprimida = await comprimirFoto(archivo);
    const contentType = TIPO_ACEPTADO[comprimida.contentType.toLowerCase()];
    if (!contentType) {
      return { ok: false, mensaje: "Ese formato no se puede subir. Usa JPEG, PNG, WebP o HEIC." };
    }

    const permiso = await fetch(RUTA, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solicitudId, contentType, bytes: comprimida.bytes }),
    });
    const datos = await leerJson(permiso);
    if (!permiso.ok || datos.ok !== true || typeof datos.url !== "string" || typeof datos.path !== "string") {
      return { ok: false, mensaje: typeof datos.mensaje === "string" ? datos.mensaje : MSG_GENERICO };
    }

    // El tipo va tal cual lo firmó el servidor: si cambia, el almacenamiento rechaza.
    const subida = await fetch(datos.url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: comprimida.blob,
    });
    if (!subida.ok) return { ok: false, mensaje: MSG_GENERICO };

    return {
      ok: true,
      foto: {
        path: datos.path,
        url: typeof datos.publicUrl === "string" ? datos.publicUrl : "",
        bytes: comprimida.bytes,
      },
    };
  } catch {
    return { ok: false, mensaje: MSG_GENERICO };
  }
}

/** Las fotos de una solicitud. La usa el portal al revisarla. */
export async function listarFotosDeSolicitud(
  solicitudId: string,
): Promise<{ ok: true; fotos: FotoDeSolicitud[] } | { ok: false; mensaje: string }> {
  try {
    const respuesta = await fetch(`${RUTA}?solicitudId=${encodeURIComponent(solicitudId)}`);
    const datos = await leerJson(respuesta);
    if (!respuesta.ok || datos.ok !== true || !Array.isArray(datos.fotos)) {
      return {
        ok: false,
        mensaje: typeof datos.mensaje === "string" ? datos.mensaje : "No se pudieron leer las fotos.",
      };
    }
    const fotos = (datos.fotos as unknown[]).flatMap((item) => {
      const f = item as Partial<FotoDeSolicitud> | null;
      return f && typeof f.path === "string" && typeof f.url === "string"
        ? [{ path: f.path, url: f.url, bytes: typeof f.bytes === "number" ? f.bytes : 0 }]
        : [];
    });
    return { ok: true, fotos };
  } catch {
    return { ok: false, mensaje: "No se pudieron leer las fotos." };
  }
}
