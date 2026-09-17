/**
 * Gestión de usuarios: lista de perfiles, cambio de rol y activación.
 * DESDE EL NAVEGADOR con la sesión de un administrador ("profiles: admin lee
 * todos" / "admin edita todos"). El trigger `profiles_proteger` impide que un
 * admin se quite su propio rol o se desactive.
 *
 * Las contraseñas y el alta de cuentas NO viven acá: las cuentas las crea
 * cada persona al registrarse en /cuenta/login, y el restablecimiento de
 * contraseña se hace desde Supabase → Authentication → Users.
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PROFILE_COLUMNS, mapProfile, type Profile } from "@/lib/auth/perfil";
import type { ProfileRow, UserRole } from "@/lib/db/types";

export type UsersQueryResult = { users: Profile[]; error: string | null };
export type UserMutationResult = { ok: boolean; message: string };

function sanitizeSearch(value: string): string {
  return value.replace(/[%,()]/g, " ").trim().slice(0, 80);
}

export async function fetchUsers(
  client: SupabaseClient,
  filters: { role?: UserRole | null; search?: string | null } = {},
): Promise<UsersQueryResult> {
  const search = filters.search ? sanitizeSearch(filters.search) : "";
  try {
    let query = client
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (filters.role) query = query.eq("rol", filters.role);
    if (search) {
      query = query.or(
        [`nombre.ilike.*${search}*`, `email.ilike.*${search}*`, `telefono.ilike.*${search}*`].join(","),
      );
    }
    const { data, error } = await query;
    if (error) {
      return { users: [], error: "No se pudieron leer los usuarios. Verifica tu sesión y que la migración 0010 esté aplicada." };
    }
    return { users: ((data ?? []) as unknown as ProfileRow[]).map(mapProfile), error: null };
  } catch {
    return { users: [], error: "No se pudieron leer los usuarios. Revisa tu conexión." };
  }
}

export async function setUserRole(
  client: SupabaseClient,
  input: { id: string; role: UserRole },
): Promise<UserMutationResult> {
  try {
    const { error } = await client.from("profiles").update({ rol: input.role }).eq("id", input.id);
    if (error) return { ok: false, message: describe(error.message) };
    return {
      ok: true,
      message: input.role === "admin" ? "Ahora es administrador y puede entrar al portal." : "Ahora es cliente: ya no entra al portal.",
    };
  } catch {
    return { ok: false, message: "No se pudo cambiar el rol. Revisa tu conexión." };
  }
}

export async function setUserActive(
  client: SupabaseClient,
  input: { id: string; active: boolean },
): Promise<UserMutationResult> {
  try {
    const { error } = await client.from("profiles").update({ activo: input.active }).eq("id", input.id);
    if (error) return { ok: false, message: describe(error.message) };
    return { ok: true, message: input.active ? "Cuenta activada." : "Cuenta desactivada. Conserva sus solicitudes." };
  } catch {
    return { ok: false, message: "No se pudo cambiar el estado. Revisa tu conexión." };
  }
}

function describe(message: string): string {
  if (/[áéíóñ]|administrador|rol/i.test(message)) return message;
  return "La base de datos rechazó el cambio. " + message;
}
