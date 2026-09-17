"use client";

/**
 * Estado de sesión del portal, compartido entre el armazón y las pantallas.
 *
 * Quien decide si hay sesión es Supabase Auth, no este archivo: acá solo se
 * escucha `onAuthStateChange` y se guarda el resultado. No se persiste nada a
 * mano, no se guarda ninguna contraseña y no se emite ningún token propio.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchOwnProfile, type Profile } from "@/lib/auth/perfil";
import {
  getPortalSupabaseClient,
  isPortalAuthConfigured,
} from "@/lib/portal/supabaseBrowser";

/**
 * - `verificando`: todavía se está leyendo la sesión guardada (primer render).
 * - `autenticado`: hay sesión válida de Supabase.
 * - `anonimo`: no hay sesión; corresponde mandar a /portal/login.
 * - `sin-permiso`: hay sesión pero el perfil NO es administrador (un cliente
 *   del sitio). El portal no se muestra; RLS ya le devolvería cero filas,
 *   esto solo evita una pantalla vacía y confusa.
 * - `sin-configurar`: no hay variables de Supabase. No tiene sentido pedir
 *   login porque no hay a quién preguntarle: se muestra el portal en modo
 *   demostración, con todo en cero y el aviso de qué falta.
 *
 * `autenticado` significa, desde la migración 0010, "sesión válida Y rol
 * admin activo". Ninguna pantalla del portal tiene que volver a comprobarlo.
 */
export type PortalSessionStatus =
  | "verificando"
  | "autenticado"
  | "anonimo"
  | "sin-permiso"
  | "sin-configurar";

export type PortalSessionValue = {
  status: PortalSessionStatus;
  /** Correo del usuario con sesión, para mostrarlo en la barra lateral. */
  email: string | null;
  /** Perfil (`public.profiles`) del usuario con sesión. `null` sin sesión. */
  profile: Profile | null;
  /** Cliente con sesión. `null` si no hay configuración. */
  client: SupabaseClient | null;
  /** Cierra la sesión en Supabase y devuelve al login. */
  signOut: () => Promise<void>;
};

const PortalSessionContext = createContext<PortalSessionValue | null>(null);

export function PortalSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isPortalAuthConfigured();

  // El cliente se resuelve en render, no en un efecto: `getPortalSupabaseClient()`
  // está memoizado a nivel de módulo y devuelve `null` en el servidor, así que
  // esto es estable y no dispara un render extra. Guardarlo en estado obligaría
  // a un `setState` síncrono dentro del efecto (renders en cascada).
  const client = useMemo(() => getPortalSupabaseClient(), []);

  // El estado inicial ya es el correcto para el caso "sin configurar": el
  // efecto no necesita corregirlo.
  const [status, setStatus] = useState<PortalSessionStatus>(
    configured ? "verificando" : "sin-configurar",
  );
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!configured) return;

    let cancelled = false;

    if (!client) {
      // Configuración presente pero el cliente no se pudo construir. En un
      // microtask, no en el cuerpo del efecto: un `setState` síncrono acá
      // provoca renders en cascada (react-hooks/set-state-in-effect).
      queueMicrotask(() => {
        if (!cancelled) setStatus("sin-configurar");
      });
      return () => {
        cancelled = true;
      };
    }

    // Con sesión, el estado final depende del ROL del perfil, no solo de que
    // exista la sesión. Sin perfil (o inactivo, o cliente) no hay portal.
    const resolve = async (session: { user?: { email?: string } } | null) => {
      if (cancelled) return;
      setEmail(session?.user?.email ?? null);
      if (!session) {
        setProfile(null);
        setStatus("anonimo");
        return;
      }
      const own = await fetchOwnProfile(client);
      if (cancelled) return;
      setProfile(own);
      setStatus(own?.role === "admin" && own.active ? "autenticado" : "sin-permiso");
    };

    client.auth
      .getSession()
      .then(({ data }) => resolve(data.session))
      .catch(() => {
        // Supabase inalcanzable: se trata como "sin sesión", no como error
        // fatal. El usuario verá el login y el mensaje al intentar entrar.
        if (!cancelled) setStatus("anonimo");
      });

    const { data: listener } = client.auth.onAuthStateChange(
      (_event, session) => {
        void resolve(session);
      },
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [configured, client]);

  const signOut = useCallback(async () => {
    if (!client) return;
    try {
      await client.auth.signOut();
    } catch {
      // Si la red falla, el listener no se disparará: se fuerza el estado.
      setStatus("anonimo");
      setEmail(null);
      setProfile(null);
    }
  }, [client]);

  const value = useMemo<PortalSessionValue>(
    () => ({ status, email, profile, client, signOut }),
    [status, email, profile, client, signOut],
  );

  return (
    <PortalSessionContext.Provider value={value}>
      {children}
    </PortalSessionContext.Provider>
  );
}

export function usePortalSession(): PortalSessionValue {
  const value = useContext(PortalSessionContext);
  if (!value) {
    throw new Error(
      "usePortalSession() debe usarse dentro de <PortalSessionProvider>, que monta src/app/portal/layout.tsx.",
    );
  }
  return value;
}
