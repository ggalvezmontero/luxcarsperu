/**
 * Perfil del usuario con sesión (tabla `public.profiles`).
 *
 * Se lee DESDE EL NAVEGADOR con la sesión de Supabase Auth: RLS solo devuelve
 * el perfil propio (o todos, si quien pregunta es admin). Es el mismo modelo
 * del portal: la pantalla es comodidad, el candado es la base.
 *
 * NUNCA lanza.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { USER_ROLES, type ProfileRow, type UserRole } from "@/lib/db/types";

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
 * Perfil del usuario de la sesión. `null` si no hay sesión, si el perfil aún no
 * existe (el trigger lo crea al registrarse) o si la consulta falla.
 */
export async function fetchOwnProfile(
  client: SupabaseClient,
): Promise<Profile | null> {
  try {
    const { data: userData } = await client.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return null;

    const { data, error } = await client
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return mapProfile(data as unknown as ProfileRow);
  } catch {
    return null;
  }
}

/** Actualiza nombre y teléfono del propio perfil. El rol no se toca desde acá. */
export async function updateOwnProfile(
  client: SupabaseClient,
  input: { name: string; phone: string | null },
): Promise<{ ok: boolean; message: string }> {
  try {
    const { data: userData } = await client.auth.getUser();
    const userId = userData.user?.id;
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
