/**
 * Neon Auth del lado del servidor. SOLO SERVIDOR.
 *
 * Dos usos:
 *
 *  1. El puente `/api/auth/*` (`src/app/api/auth/[...path]/route.ts`), que
 *     reenvía a Neon Auth las llamadas del navegador y deja la cookie de sesión
 *     en el dominio propio.
 *  2. `verificarSesionPortal()`, la puerta de los Route Handlers del portal que
 *     hacen algo que RLS no puede cuidar (hoy: firmar subidas al bucket de
 *     fotos, que vive fuera de Postgres).
 *
 * Igual que `db/client.ts`, NUNCA lanza: sin configuración devuelve `null` y
 * la ruta contesta 503 con el nombre de la variable que falta. Un portal que no
 * funciona hasta definir una variable es un problema de diez segundos; un
 * portal abierto es un incidente.
 */
import "server-only";

import { createNeonAuth } from "@neon/neon-js/auth/next/server";

import { getNeonUrls } from "@/lib/db/neonConfig";

/** Largo mínimo que exige el SDK para firmar la cookie de sesión. */
const LARGO_MINIMO_SECRETO = 32;

type PortalAuth = ReturnType<typeof createNeonAuth>;

function secretoCookie(): string {
  const valor = (process.env.NEON_AUTH_COOKIE_SECRET ?? "").trim();
  return valor.length >= LARGO_MINIMO_SECRETO ? valor : "";
}

let instancia: PortalAuth | null = null;
let resuelta = false;

/** Instancia de Neon Auth, memoizada. `null` si falta configuración. */
export function getPortalAuth(): PortalAuth | null {
  if (resuelta) return instancia;
  resuelta = true;

  const urls = getNeonUrls();
  const secret = secretoCookie();
  if (!urls || !secret) {
    instancia = null;
    return null;
  }

  try {
    instancia = createNeonAuth({ baseUrl: urls.auth, cookies: { secret } });
  } catch {
    instancia = null;
  }
  return instancia;
}

/** Qué falta para que el acceso funcione. Para mensajes; no expone valores. */
export function getPortalAuthServerMissingEnv(): string[] {
  const missing: string[] = [];
  if (!getNeonUrls()) missing.push("NEXT_PUBLIC_NEON_URL");
  if (!secretoCookie()) missing.push("NEON_AUTH_COOKIE_SECRET");
  return missing;
}

export type ResultadoSesion =
  | { ok: true; userId: string; email: string | null }
  | {
      ok: false;
      /** 401: no hay sesión válida. 503: el acceso no está configurado. */
      status: 401 | 503;
      codigo: "sin_sesion" | "portal_sin_configurar";
      mensaje: string;
    };

/**
 * ¿Esta petición viene de alguien del equipo con sesión abierta?
 *
 * Lee la cookie de la petición en curso, así que solo sirve dentro de un Route
 * Handler o Server Action. Nunca lanza: devuelve el motivo para que la ruta
 * conteste algo entendible.
 */
export async function verificarSesionPortal(): Promise<ResultadoSesion> {
  const auth = getPortalAuth();
  if (!auth) {
    return {
      ok: false,
      status: 503,
      codigo: "portal_sin_configurar",
      mensaje: `Ruta cerrada: falta ${getPortalAuthServerMissingEnv().join(" y ")}. Defínela en Vercel → Project Settings → Environment Variables y vuelve a desplegar.`,
    };
  }

  try {
    const { data } = await auth.getSession();
    const user = data?.user;
    if (!data?.session || !user?.id) {
      return {
        ok: false,
        status: 401,
        codigo: "sin_sesion",
        mensaje: "Tu sesión venció. Vuelve a entrar al portal.",
      };
    }
    return { ok: true, userId: user.id, email: user.email ?? null };
  } catch {
    // Neon Auth inalcanzable: se niega, no se deja pasar.
    return {
      ok: false,
      status: 401,
      codigo: "sin_sesion",
      mensaje: "No se pudo comprobar tu sesión. Vuelve a entrar al portal.",
    };
  }
}
