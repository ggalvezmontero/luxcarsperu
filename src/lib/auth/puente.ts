/**
 * Llamadas directas al puente de Neon Auth (`/api/auth/*`) para lo que el SDK
 * no trae como método: pedir y confirmar el enlace de contraseña, y pedir y
 * confirmar el código de verificación del correo.
 *
 * Nunca lanza: devuelve `ok` y, si falló, el código de error de Neon Auth (o
 * el estado HTTP, o "red" si no hubo respuesta) para que cada pantalla lo
 * traduzca a su manera.
 */

import { PORTAL_AUTH_PATH } from "@/lib/portal/portalClient";

export type ResultadoAuth = { ok: boolean; codigo: string };

export async function llamarAuth(
  ruta: string,
  cuerpo: Record<string, string>,
): Promise<ResultadoAuth> {
  try {
    const respuesta = await fetch(`${PORTAL_AUTH_PATH}${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (respuesta.ok) return { ok: true, codigo: "" };
    const datos = (await respuesta.json().catch(() => null)) as {
      code?: unknown;
    } | null;
    return {
      ok: false,
      codigo: typeof datos?.code === "string" ? datos.code : String(respuesta.status),
    };
  } catch {
    return { ok: false, codigo: "red" };
  }
}
