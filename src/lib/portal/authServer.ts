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
 *     fotos, que vive fuera de Postgres). Exige sesión Y rol admin: desde que
 *     los clientes tienen cuenta, "tiene sesión" ya no significa "es del
 *     equipo".
 *
 * Igual que `db/client.ts`, NUNCA lanza: sin configuración devuelve `null` y
 * la ruta contesta 503 con el nombre de la variable que falta. Un portal que no
 * funciona hasta definir una variable es un problema de diez segundos; un
 * portal abierto es un incidente.
 */
import "server-only";

import { createNeonAuth } from "@neon/neon-js/auth/next/server";

import { getSql } from "@/lib/db/client";
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
      /**
       * 401: no hay sesión válida. 403: hay sesión pero no es de un
       * administrador. 503: el acceso no está configurado.
       */
      status: 401 | 403 | 503;
      codigo: "sin_sesion" | "sin_permiso" | "portal_sin_configurar";
      mensaje: string;
    };

/**
 * ¿Esta petición viene de un administrador con sesión abierta?
 *
 * El rol se lee de `public.profiles` con la conexión directa (`DATABASE_URL`),
 * no del navegador: es el mismo criterio que `public.es_admin()` aplica en
 * las políticas RLS — perfil con rol `admin` y activo.
 *
 * Lee la cookie de la petición en curso, así que solo sirve dentro de un Route
 * Handler o Server Action. Nunca lanza: devuelve el motivo para que la ruta
 * conteste algo entendible.
 */
export async function verificarSesionPortal(): Promise<ResultadoSesion> {
  const auth = getPortalAuth();
  const sql = getSql();
  if (!auth || !sql) {
    const falta = [...getPortalAuthServerMissingEnv(), ...(sql ? [] : ["DATABASE_URL"])];
    return {
      ok: false,
      status: 503,
      codigo: "portal_sin_configurar",
      mensaje: `Ruta cerrada: falta ${falta.join(" y ")}. Defínela en Vercel → Project Settings → Environment Variables y vuelve a desplegar.`,
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

    const admin = await sql`
      select 1
      from public.profiles
      where id = ${user.id}::uuid
        and rol = 'admin'
        and activo
      limit 1
    `;
    if (admin.length === 0) {
      return {
        ok: false,
        status: 403,
        codigo: "sin_permiso",
        mensaje: "Esta cuenta no tiene rol de administrador.",
      };
    }
    return { ok: true, userId: user.id, email: user.email ?? null };
  } catch {
    // Neon Auth o la base inalcanzables: se niega, no se deja pasar.
    return {
      ok: false,
      status: 401,
      codigo: "sin_sesion",
      mensaje: "No se pudo comprobar tu sesión. Vuelve a entrar al portal.",
    };
  }
}
