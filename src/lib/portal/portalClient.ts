/**
 * Cliente de Neon CON SESIÓN, compartido por el portal de administración
 * (/portal) y el área de cuenta del cliente (/cuenta).
 *
 * ¿Por qué no se reusa `getPublicClient()` de `src/lib/db/client.ts`?
 * Porque aquel es de servidor y consulta como visitante anónimo: sirve al
 * sitio público, que lee inventario publicado sin identidad. El portal y la
 * cuenta necesitan lo contrario — la sesión de quien entra — así que tienen su
 * propia instancia.
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
 *    "funciona" en el escritorio y falla en el iPhone del dueño. El JWT que
 *    exige la Data API también sale de ese puente (ver `obtenerJwt`).
 *
 * 3. La verdadera barrera NO es la pantalla de login: es RLS en Postgres. Las
 *    tablas `leads`, `consignments` y las columnas de margen de `vehicles`
 *    hacen `revoke all ... from anonymous` y, desde la migración 0010, sus
 *    políticas para `authenticated` exigen `public.es_admin()`: un cliente
 *    con sesión recibe cero filas, igual que un anónimo. Sin rol admin, las
 *    consultas del tablero vuelven vacías aunque alguien renderice el HTML
 *    del portal a la fuerza. El guard de la UI es comodidad, no el candado.
 *
 * 4. Por eso el tablero consulta desde el NAVEGADOR, por la Data API y con el
 *    token de la sesión, y NO desde el servidor con `DATABASE_URL`. Esa
 *    conexión salta RLS: usarla para pintar el tablero le mostraría los leads
 *    a cualquiera que abra /portal. Es exactamente el agujero que hay que evitar.
 *
 * 5. SÍ existe registro público (luxcars.pe/cuenta/login), desde la migración
 *    0010: los clientes crean cuenta para pedir búsquedas y ofrecer su auto.
 *    Toda cuenta nueva nace con rol `cliente`. Registrarse NO da acceso al
 *    portal: `es_admin()` lo niega, y el rol admin solo lo asigna otro
 *    administrador desde /portal/usuarios. Este cliente de navegador lo
 *    comparten el portal y el área de cuenta: una sola sesión por navegador.
 *
 * 6. Lo que RLS no puede cuidar (las fotos, que viven fuera de Postgres) lo
 *    cuida el servidor: `/api/portal/fotos` comprueba sesión Y rol admin.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@neon/neon-js/supabase";

import { getNeonUrls, isNeonConfigured } from "@/lib/db/neonConfig";

/** Ruta de este sitio que reenvía a Neon Auth. */
export const PORTAL_AUTH_PATH = "/api/auth";

/** Cliente con sesión: `auth` con la API de sesión y `from()` / `rpc()` de la Data API. */
export type PortalClient = ReturnType<typeof createClient>;

/**
 * Lo único que el sitio lee de una sesión. El SDK deja `client.auth` sin tipo
 * (`any`), así que se declara acá lo que se usa en vez de propagar el `any`.
 */
export type PortalAuthSession = {
  user?: { id?: string | null; email?: string | null } | null;
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

/**
 * Token JWT para la Data API.
 *
 * Neon Auth entrega el JWT de la sesión en una cabecera de respuesta
 * (`set-auth-jwt`) que el SDK lee cuando habla DIRECTO con Neon. Acá el
 * navegador habla con el puente `/api/auth`, que no reenvía esa cabecera: el
 * SDK se queda con el token opaco de la sesión y la Data API lo rechaza (400).
 * Por eso el JWT se pide aparte a `/api/auth/token` —misma cookie, mismo
 * dominio— y se pone en cada consulta.
 *
 * Se guarda solo en memoria, atado al usuario para el que se emitió, y se
 * descarta al cambiar la sesión: jamás debe sobrevivir a un cierre de sesión
 * ni pasar de una cuenta a otra.
 */
const MARGEN_VENCIMIENTO_MS = 30_000;
let jwtEnMemoria: { token: string; usuario: string; venceEn: number } | null = null;
let jwtEnCurso: Promise<string | null> | null = null;
/** Sube con cada cambio de sesión: un token pedido antes ya no se guarda. */
let generacionSesion = 0;

/** Dueño (`sub`) y vencimiento (`exp`, en ms) de un JWT. Vacíos si no se puede leer. */
function leerJwt(token: string): { usuario: string; venceEn: number } {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { sub, exp } = JSON.parse(json) as { sub?: unknown; exp?: unknown };
    return {
      usuario: typeof sub === "string" ? sub : "",
      venceEn: typeof exp === "number" ? exp * 1000 : 0,
    };
  } catch {
    return { usuario: "", venceEn: 0 };
  }
}

async function pedirJwt(): Promise<string | null> {
  try {
    const respuesta = await fetch(`${PORTAL_AUTH_PATH}/token`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!respuesta.ok) return null;
    const datos = (await respuesta.json()) as { token?: unknown };
    return typeof datos.token === "string" && datos.token ? datos.token : null;
  } catch {
    return null;
  }
}

/** JWT del usuario indicado. Uno guardado para otra cuenta no se reutiliza. */
async function obtenerJwt(usuario: string): Promise<string | null> {
  if (jwtEnMemoria && jwtEnMemoria.usuario !== usuario) olvidarJwt();
  if (jwtEnMemoria && jwtEnMemoria.venceEn - MARGEN_VENCIMIENTO_MS > Date.now()) {
    return jwtEnMemoria.token;
  }
  // Varias consultas a la vez comparten una sola petición del token.
  if (jwtEnCurso) return jwtEnCurso;
  const generacion = generacionSesion;
  const pedido = pedirJwt().then((token) => {
    if (generacion === generacionSesion) {
      jwtEnMemoria = token ? { token, ...leerJwt(token) } : null;
      jwtEnCurso = null;
    }
    return token;
  });
  jwtEnCurso = pedido;
  return pedido;
}

function olvidarJwt(): void {
  generacionSesion += 1;
  jwtEnMemoria = null;
  jwtEnCurso = null;
}

/**
 * `fetch` de la Data API: reemplaza el token opaco que pone el SDK por el JWT
 * de la sesión. Sin JWT (sesión vencida) la consulta sale como venía y la Data
 * API la rechaza: las pantallas lo muestran como "no se pudo leer".
 */
const fetchConJwt: typeof fetch = async (input, init) => {
  const usuario = await usuarioConSesion();
  const jwt = usuario ? await obtenerJwt(usuario) : null;
  // El token debe ser de quien tiene la sesión ahora; si no, no se usa.
  if (!jwt || leerJwt(jwt).usuario !== usuario) return fetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${jwt}`);
  return fetch(input, { ...init, headers });
};

let browserClient: PortalClient | null = null;
let browserClientResolved = false;

/** Id de quien tiene la sesión en este momento, según el SDK. */
async function usuarioConSesion(): Promise<string | null> {
  try {
    const { data } = (await browserClient?.auth.getSession()) as {
      data: { session: PortalAuthSession };
    };
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

type OyenteSesion = () => void | Promise<void>;
const oyentesSesion = new Set<OyenteSesion>();

/**
 * Suscribe a los cambios de sesión hechos EN ESTA PESTAÑA (entrar, registrarse,
 * salir). Devuelve la función para dejar de oír.
 *
 * Hace falta porque `onAuthStateChange` del SDK solo avisa la sesión inicial y
 * lo que pasa en OTRAS pestañas: ignora a propósito los eventos de la propia.
 * Sin esto, después de entrar el armazón seguiría creyendo que no hay sesión
 * hasta recargar la página.
 */
export function alCambiarSesion(oyente: OyenteSesion): () => void {
  oyentesSesion.add(oyente);
  return () => {
    oyentesSesion.delete(oyente);
  };
}

/**
 * Avisa que la sesión cambió en esta pestaña. Lo llama quien acaba de entrar,
 * registrarse o salir, y espera a que cada pantalla haya releído la sesión:
 * así se puede navegar después sin que la pantalla de destino rebote.
 */
export async function avisarCambioDeSesion(): Promise<void> {
  olvidarJwt();
  await Promise.allSettled([...oyentesSesion].map((oyente) => oyente()));
}

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
      dataApi: { url: urls.dataApi, options: { global: { fetch: fetchConJwt } } },
    });
    // Un cambio de sesión en otra pestaña invalida el JWT guardado. Los de
    // esta pestaña llegan por `avisarCambioDeSesion()`.
    browserClient.auth.onAuthStateChange(olvidarJwt);
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
    return "La cuenta existe pero el correo no está verificado. Revisa tu bandeja o escríbenos por WhatsApp.";
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
