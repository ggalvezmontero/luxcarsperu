/**
 * Perfil del usuario con sesión (tabla `public.profiles`).
 *
 * Se lee DESDE EL NAVEGADOR con la sesión de Neon Auth: RLS solo devuelve
 * el perfil propio (o todos, si quien pregunta es admin). Es el mismo modelo
 * del portal: la pantalla es comodidad, el candado es la base.
 *
 * NUNCA lanza.
 */

import { USER_ROLES, type ProfileRow, type UserRole } from "@/lib/db/types";
import type { PortalAuthSession, PortalClient } from "@/lib/portal/portalClient";

export type Profile = {
  id: string;
  role: UserRole;
  active: boolean;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
};

export const PROFILE_COLUMNS =
  "id, rol, activo, nombre, telefono, email, created_at, updated_at";

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    role: (USER_ROLES as readonly string[]).includes(row.rol)
      ? (row.rol as UserRole)
      : "cliente",
    active: row.activo !== false,
    name: row.nombre ?? "",
    phone: row.telefono,
    email: row.email,
    createdAt: row.created_at,
  };
}

/**
 * Resultado de leer el perfil propio, distinguiendo lo que `null` mezclaba:
 *
 * - `ok`: la lectura funcionó y hay perfil.
 * - `sin-perfil`: la lectura funcionó y NO hay perfil (ni siquiera después de
 *   `asegurar_perfil()`).
 * - `error`: la lectura falló (token vencido, base dormida, red, sin sesión
 *   legible). No dice nada sobre el rol: quien llama NO debe tratarlo como
 *   "no es administrador" ni cerrar la sesión por esto.
 */
export type ProfileResult =
  | { status: "ok"; profile: Profile }
  | { status: "sin-perfil" }
  | { status: "error" };

/** Id del usuario con sesión, o `null`. El SDK deja `client.auth` sin tipo. */
async function ownUserId(client: PortalClient): Promise<string | null> {
  const { data } = (await client.auth.getSession()) as {
    data: { session: PortalAuthSession };
  };
  return data.session?.user?.id ?? null;
}

/** `profile: null` con `failed: false` = la consulta funcionó y no hay fila. */
async function selectProfile(
  client: PortalClient,
  userId: string,
): Promise<{ profile: Profile | null; failed: boolean }> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) return { profile: null, failed: true };
  if (!data) return { profile: null, failed: false };
  return { profile: mapProfile(data as unknown as ProfileRow), failed: false };
}

/**
 * Lee el perfil del usuario de la sesión y dice si la lectura falló. NUNCA lanza.
 *
 * El perfil lo crea un trigger al registrarse. Si no aparece (cuenta anterior
 * al trigger, o el trigger falló), se le pide a la base que lo cree con
 * `asegurar_perfil()` —siempre con rol `cliente`— y se vuelve a leer.
 */
export async function fetchOwnProfileResult(
  client: PortalClient,
): Promise<ProfileResult> {
  try {
    const userId = await ownUserId(client);
    if (!userId) return { status: "error" };

    const first = await selectProfile(client, userId);
    if (first.failed) return { status: "error" };
    if (first.profile) return { status: "ok", profile: first.profile };

    const { error } = await client.rpc("asegurar_perfil");
    if (error) return { status: "error" };

    const second = await selectProfile(client, userId);
    if (second.failed) return { status: "error" };
    return second.profile
      ? { status: "ok", profile: second.profile }
      : { status: "sin-perfil" };
  } catch {
    return { status: "error" };
  }
}

/**
 * Perfil del usuario de la sesión. `null` si no hay sesión, no hay perfil o la
 * consulta falla: no distingue los tres casos. Quien necesite saber si falló
 * (el portal, para no confundir un fallo con "no eres admin") usa
 * `fetchOwnProfileResult`.
 */
export async function fetchOwnProfile(
  client: PortalClient,
): Promise<Profile | null> {
  const result = await fetchOwnProfileResult(client);
  return result.status === "ok" ? result.profile : null;
}

/** Actualiza nombre y teléfono del propio perfil. El rol no se toca desde acá. */
export async function updateOwnProfile(
  client: PortalClient,
  input: { name: string; phone: string | null },
): Promise<{ ok: boolean; message: string }> {
  try {
    const userId = await ownUserId(client);
    if (!userId) return { ok: false, message: "No hay sesión activa." };

    const { error } = await client
      .from("profiles")
      .update({
        nombre: input.name.trim().slice(0, 160),
        telefono: input.phone?.trim().slice(0, 40) || null,
      })
      .eq("id", userId);

    if (error) return { ok: false, message: "No se pudo guardar el perfil." };
    return { ok: true, message: "Perfil actualizado." };
  } catch {
    return { ok: false, message: "No se pudo guardar el perfil. Revisa tu conexión." };
  }
}
