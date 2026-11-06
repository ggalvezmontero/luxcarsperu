/**
 * Cliente de Neon CON SESIÓN, exclusivo del portal de administración.
 *
 * ¿Por qué no se reusa `getPublicClient()` de `src/lib/db/client.ts`?
 * Porque aquel es de servidor y consulta como visitante anónimo: sirve al
 * sitio público, que lee inventario publicado sin identidad. El portal necesita
 * lo contrario — la sesión del equipo — así que tiene su propia instancia.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * MODELO DE SEGURIDAD DEL PORTAL. Léelo antes de "mejorar" el login.
 * ──────────────────────────────────────────────────────────────────────────
 * 1. La sesión la emite y la valida NEON AUTH. Acá no se inventa nada: no hay
 *    JWT casero, no se guarda ninguna contraseña ni se compara ningún hash.
 *
 * 2. El navegador NO habla directo con Neon Auth: llama a `/api/auth/*` de este
 *    mismo sitio, que reenvía a Neon (`src/app/api/auth/[...path]/route.ts`).
 *    Así la cookie de sesión es de luxcars.pe y no de un dominio de terceros,
 *    que Safari y los modos privados bloquean. Sin ese puente, el login
 *    "funciona" en el escritorio y falla en el iPhone del dueño.
 *
 * 3. La verdadera barrera NO es la pantalla de login: es RLS en Postgres. Las
 *    tablas `leads`, `consignments` y las columnas de margen de `vehicles`
 *    hacen `revoke all ... from anonymous` y solo otorgan a `authenticated`
 *    (ver db/migrations/). Sin sesión válida, las consultas del tablero
 *    vuelven vacías aunque alguien renderice el HTML del portal a la fuerza.
 *    El guard de la UI es comodidad, no el candado.
 *
 * 4. Por eso el tablero consulta desde el NAVEGADOR, por la Data API y con el
 *    token de la sesión, y NO desde el servidor con `DATABASE_URL`. Esa
 *    conexión salta RLS: usarla para pintar el tablero le mostraría los leads
 *    a cualquiera que abra /portal. Es exactamente el agujero que hay que evitar.
 *
 * 5. NO existe registro público: está desactivado en Neon Auth
 *    (`disable_sign_up`). El dueño agrega a cada persona del equipo por correo
 *    en la consola de Neon → Auth → Users, y esa persona define su contraseña
 *    desde /portal/recuperar. Si el registro se reactiva, cualquiera se crea
 *    una cuenta y, al ser `authenticated`, RLS le abre los leads.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@neon/neon-js/supabase";

import { getNeonUrls, isNeonConfigured } from "@/lib/db/neonConfig";

/** Ruta de este sitio que reenvía a Neon Auth. */
export const PORTAL_AUTH_PATH = "/api/auth";

/** Cliente del portal: `auth` con la API de sesión y `from()` de la Data API. */
export type PortalClient = ReturnType<typeof createClient>;

/**
 * Lo único que el portal lee de una sesión. El SDK deja `client.auth` sin tipo
 * (`any`), así que se declara acá lo que se usa en vez de propagar el `any`.
 */
export type PortalAuthSession = {
  user?: { email?: string | null } | null;
} | null;

/**
 * ¿Hay configuración suficiente para autenticarse desde el navegador?
 *
 * Solo mira la variable pública. El puente `/api/auth` necesita además
 * `NEON_AUTH_COOKIE_SECRET`, que es del servidor y jamás llega acá: si falta,
 * el login responde con un mensaje que lo dice.
 */
export function isPortalAuthConfigured(): boolean {
  return isNeonConfigured();
}

/** Qué variables públicas faltan. Para el aviso del tablero; no expone valores. */
export function getPortalAuthMissingEnv(): string[] {
  return isNeonConfigured() ? [] : ["NEXT_PUBLIC_NEON_URL"];
}

let browserClient: PortalClient | null = null;
let browserClientResolved = false;

/**
 * Cliente del portal, memoizado. Devuelve `null` —nunca lanza— si no hay
 * configuración o si se llama en el servidor: el portal debe compilar y
 * renderizar igual, mostrando el aviso de "falta configurar".
 */
export function getPortalClient(): PortalClient | null {
  if (typeof window === "undefined") return null;
  if (browserClientResolved) return browserClient;
  browserClientResolved = true;

  const urls = getNeonUrls();
  if (!urls) {
    browserClient = null;
    return null;
  }

  try {
    browserClient = createClient({
      auth: { url: `${window.location.origin}${PORTAL_AUTH_PATH}` },
      dataApi: { url: urls.dataApi },
    });
  } catch {
    browserClient = null;
  }
  return browserClient;
}

/**
 * Traduce los errores de Neon Auth a español, sin filtrar si el correo existe
 * o no (evitar enumeración de usuarios es deliberado).
 */
export function describeAuthError(message: string): string {
  const raw = message.toLowerCase();
  if (
    raw.includes("invalid login credentials") ||
    raw.includes("invalid email or password") ||
    raw.includes("invalid password") ||
    raw.includes("user not found") ||
    raw.includes("credential account not found")
  ) {
    return "Correo o contraseña incorrectos. Si todavía no definiste tu contraseña, usa «Crear o recuperar contraseña».";
  }
  if (raw.includes("email not verified") || raw.includes("email not confirmed")) {
    return "La cuenta existe pero el correo no está verificado. Verifícalo desde la consola de Neon → Auth → Users.";
  }
  if (raw.includes("banned")) {
    return "Esta cuenta está suspendida. Habla con el administrador.";
  }
  if (raw.includes("rate limit") || raw.includes("too many")) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.";
  }
  if (raw.includes("portal_sin_configurar")) {
    return "El acceso no está configurado en este despliegue: falta NEON_AUTH_COOKIE_SECRET en Vercel → Environment Variables (ver .env.example).";
  }
  if (raw.includes("failed to fetch") || raw.includes("network")) {
    return "No se pudo contactar al servicio de acceso. Revisa la conexión y vuelve a intentar.";
  }
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}
