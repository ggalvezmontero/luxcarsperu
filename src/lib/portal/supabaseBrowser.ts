/**
 * Cliente de Supabase CON SESIÓN, compartido por el portal de administración
 * (/portal) y el área de cuenta del cliente (/cuenta).
 *
 * ¿Por qué no se reusa `getSupabaseClient()` de `src/lib/db/client.ts`?
 * Porque aquel se construye con `persistSession: false` y `autoRefreshToken:
 * false` a propósito: sirve al sitio público, que lee inventario publicado sin
 * identidad. El portal necesita lo contrario — guardar la sesión del equipo y
 * refrescar el token — así que tiene su propia instancia. La capa de datos NO
 * se toca.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * MODELO DE SEGURIDAD DEL PORTAL. Léelo antes de "mejorar" el login.
 * ──────────────────────────────────────────────────────────────────────────
 * 1. La sesión la emite y la valida SUPABASE AUTH. Acá no se inventa nada: no
 *    hay cookie propia, no hay JWT casero, no se guarda ninguna contraseña ni
 *    se compara ningún hash. `signInWithPassword` habla directo con Supabase.
 *
 * 2. La verdadera barrera NO es la pantalla de login: es RLS en Postgres. Las
 *    tablas `leads`, `consignments` y las columnas de margen de `vehicles`
 *    hacen `revoke all ... from anon` y, desde la migración 0010, sus
 *    políticas para `authenticated` exigen `public.es_admin()`: un cliente
 *    con sesión recibe cero filas, igual que un anónimo. Sin rol admin, las
 *    consultas del tablero vuelven vacías aunque alguien renderice el HTML
 *    del portal a la fuerza. El guard de la UI es comodidad, no el candado.
 *
 * 3. Por eso el tablero consulta desde el NAVEGADOR con esta llave anónima +
 *    sesión, y NO desde el servidor con `service_role`. La llave de servicio
 *    salta RLS: usarla para pintar el tablero le mostraría los leads a
 *    cualquiera que abra /portal. Es exactamente el agujero que hay que evitar.
 *
 * 4. TODO (mejora, no bloqueante): para renderizar el portal en el servidor
 *    haría falta `@supabase/ssr` (sesión en cookies) + un `middleware.ts` que
 *    redirija a /portal/login antes de responder. Hoy NO está instalado y
 *    agregar dependencias es decisión del dueño. Mientras tanto, el guard vive
 *    en el cliente y RLS protege los datos.
 *
 * 5. SÍ existe registro público (luxcars.pe/cuenta/login), desde la migración
 *    0010: los clientes crean cuenta para pedir búsquedas y ofrecer su auto.
 *    Toda cuenta nueva nace con rol `cliente`. Registrarse NO da acceso al
 *    portal: `es_admin()` lo niega, y el rol admin solo lo asigna otro
 *    administrador desde /portal/usuarios. Este cliente de navegador lo
 *    comparten el portal y el área de cuenta: una sola sesión por navegador.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Next.js reemplaza `process.env.NEXT_PUBLIC_*` de forma estática, así que hay
 * que escribir el nombre literal para que el valor entre al bundle.
 */
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY =
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() ||
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

/** Clave de almacenamiento de la sesión. Explícita para no depender del default. */
const STORAGE_KEY = "luxcars-portal-auth";

function isUsableUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * ¿Hay configuración suficiente para autenticarse desde el navegador?
 *
 * Solo mira las variables públicas: `SUPABASE_SERVICE_ROLE_KEY` es del servidor
 * y jamás llega acá (si llegara, sería un incidente de seguridad).
 */
export function isPortalAuthConfigured(): boolean {
  return isUsableUrl(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 0;
}

/** Qué variables públicas faltan. Para el aviso del tablero; no expone valores. */
export function getPortalAuthMissingEnv(): string[] {
  const missing: string[] = [];
  if (!isUsableUrl(SUPABASE_URL)) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

let browserClient: SupabaseClient | null = null;
let browserClientResolved = false;

/**
 * Cliente del portal, memoizado. Devuelve `null` —nunca lanza— si no hay
 * configuración o si se llama en el servidor: el portal debe compilar y
 * renderizar igual, mostrando el aviso de "falta configurar".
 */
export function getPortalSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (browserClientResolved) return browserClient;
  browserClientResolved = true;

  if (!isPortalAuthConfigured()) {
    browserClient = null;
    return null;
  }

  try {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: STORAGE_KEY,
      },
      global: { headers: { "x-application-name": "luxcars-portal" } },
    });
  } catch {
    browserClient = null;
  }
  return browserClient;
}

/**
 * Traduce los errores de Supabase Auth a español, sin filtrar si el correo
 * existe o no (evitar enumeración de usuarios es deliberado).
 */
export function describeAuthError(message: string): string {
  const raw = message.toLowerCase();
  if (raw.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (raw.includes("email not confirmed")) {
    return "La cuenta existe pero el correo no está confirmado. Confírmalo desde Supabase → Authentication → Users.";
  }
  if (raw.includes("rate limit") || raw.includes("too many")) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.";
  }
  if (raw.includes("failed to fetch") || raw.includes("network")) {
    return "No se pudo contactar a Supabase. Revisa la conexión y que NEXT_PUBLIC_SUPABASE_URL sea correcta.";
  }
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}
