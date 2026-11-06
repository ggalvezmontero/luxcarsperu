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

/** Id del usuario con sesión, o `null`. El SDK deja `client.auth` sin tipo. */
async function ownUserId(client: PortalClient): Promise<string | null> {
  const { data } = (await client.auth.getSession()) as {
    data: { session: PortalAuthSession };
  };
  return data.session?.user?.id ?? null;
}

async function selectProfile(
  client: PortalClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfile(data as unknown as ProfileRow);
}

/**
 * Perfil del usuario de la sesión. `null` si no hay sesión o si la consulta
 * falla.
 *
 * El perfil lo crea un trigger al registrarse. Si no aparece (cuenta anterior
 * al trigger, o el trigger falló), se le pide a la base que lo cree con
 * `asegurar_perfil()` —siempre con rol `cliente`— y se vuelve a leer.
 */
export async function fetchOwnProfile(
  client: PortalClient,
): Promise<Profile | null> {
  try {
    const userId = await ownUserId(client);
    if (!userId) return null;

    const profile = await selectProfile(client, userId);
    if (profile) return profile;

    const { error } = await client.rpc("asegurar_perfil");
    if (error) return null;
    return await selectProfile(client, userId);
  } catch {
    return null;
  }
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
