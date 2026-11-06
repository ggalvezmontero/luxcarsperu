/**
 * Direcciones públicas de Neon, derivadas de UNA sola variable.
 *
 * `NEXT_PUBLIC_NEON_URL` es la dirección https de la base SIN credenciales:
 *
 *     https://ep-xxxx.c-16.us-east-1.aws.neon.tech/neondb
 *
 * De ahí salen las dos direcciones que usa el sitio:
 *
 *   · Data API  → https://ep-xxxx.apirest.c-16.us-east-1.aws.neon.tech/neondb/rest/v1
 *   · Neon Auth → https://ep-xxxx.neonauth.c-16.us-east-1.aws.neon.tech/neondb/auth
 *
 * Es la misma regla que aplica `@neon/neon-js` (`defaultDeriveNeonUrls`). Se
 * repite acá, en vez de importarla, porque la entrada principal del SDK
 * reexporta también el código de servidor de Next: importarla desde un
 * componente cliente lo arrastraría al bundle del navegador.
 *
 * Acá solo hay variables públicas: este módulo puede importarse desde el
 * navegador. Nada de `DATABASE_URL` ni de llaves de Storage.
 */

/**
 * Next.js reemplaza `process.env.NEXT_PUBLIC_*` de forma estática, así que hay
 * que escribir el nombre literal para que el valor entre al bundle.
 */
const NEON_URL = (process.env.NEXT_PUBLIC_NEON_URL ?? "").trim();

export type NeonUrls = {
  /** Base de la Data API (PostgREST). */
  dataApi: string;
  /** Base de Neon Auth. El navegador NO la llama directo: ver `portalClient.ts`. */
  auth: string;
};

function derive(value: string): NeonUrls | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    // Con usuario, contraseña o parámetros es la cadena de conexión de
    // Postgres pegada por error: eso es un secreto y no va en una variable
    // pública. Se rechaza en vez de derivar algo a medias.
    if (url.username || url.password || url.search || url.hash) return null;

    const labels = url.hostname.split(".");
    if (labels.length < 3) return null;
    const path = url.pathname.replace(/\/+$/, "");
    if (!path) return null;

    const [endpoint, ...rest] = labels;
    const host = (label: string) =>
      `https://${[endpoint, label, ...rest].join(".")}${url.port ? `:${url.port}` : ""}`;

    return {
      dataApi: `${host("apirest")}${path}/rest/v1`,
      auth: `${host("neonauth")}${path}/auth`,
    };
  } catch {
    return null;
  }
}

const NEON_URLS = derive(NEON_URL);

/** Direcciones de la Data API y de Neon Auth. `null` si falta o está mal la variable. */
export function getNeonUrls(): NeonUrls | null {
  return NEON_URLS;
}

/** ¿Está `NEXT_PUBLIC_NEON_URL` definida y con forma válida? No abre conexión. */
export function isNeonConfigured(): boolean {
  return NEON_URLS !== null;
}
