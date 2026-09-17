"use client";

/**
 * Sesión del CLIENTE en el sitio público (/cuenta/*).
 *
 * Mismo modelo que el portal (`portalSession.tsx`): quien decide si hay sesión
 * es Supabase Auth; acá solo se escucha `onAuthStateChange` y se lee el perfil
 * (`public.profiles`) para saber nombre y rol. No se persiste nada a mano.
 *
 * Comparte el cliente de navegador con el portal a propósito: una sola sesión
 * por navegador. Un admin que entra por /cuenta ve su cuenta como cualquier
 * cliente y además tiene acceso al portal; un cliente que intenta /portal es
 * rechazado por su rol.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchOwnProfile, type Profile } from "@/lib/auth/perfil";
import {
  getPortalSupabaseClient,
  isPortalAuthConfigured,
} from "@/lib/portal/supabaseBrowser";

export type CuentaSessionStatus =
  | "verificando"
  | "autenticado"
  | "anonimo"
  | "sin-configurar";

export type CuentaSessionValue = {
  status: CuentaSessionStatus;
  email: string | null;
  userId: string | null;
  /** `null` mientras se carga o si no hay sesión. */
  profile: Profile | null;
  client: SupabaseClient | null;
  signOut: () => Promise<void>;
  /** Vuelve a leer el perfil (tras editarlo). */
  refreshProfile: () => Promise<void>;
};

const CuentaSessionContext = createContext<CuentaSessionValue | null>(null);

export function CuentaSessionProvider({ children }: { children: React.ReactNode }) {
  const configured = isPortalAuthConfigured();
  const client = useMemo(() => getPortalSupabaseClient(), []);

  const [status, setStatus] = useState<CuentaSessionStatus>(
    configured ? "verificando" : "sin-configurar",
  );
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!client) return;
    setProfile(await fetchOwnProfile(client));
  }, [client]);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;

    if (!client) {
      queueMicrotask(() => {
        if (!cancelled) setStatus("sin-configurar");
      });
      return () => {
        cancelled = true;
      };
    }

    const apply = async (session: { user?: { id: string; email?: string } } | null) => {
      if (cancelled) return;
      setEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
      if (session?.user) {
        const p = await fetchOwnProfile(client);
        if (cancelled) return;
        setProfile(p);
        setStatus("autenticado");
      } else {
        setProfile(null);
        setStatus("anonimo");
      }
    };

    client.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => {
        if (!cancelled) setStatus("anonimo");
      });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      void apply(session);
    });

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
      setStatus("anonimo");
      setEmail(null);
      setUserId(null);
      setProfile(null);
    }
  }, [client]);

  const value = useMemo<CuentaSessionValue>(
    () => ({ status, email, userId, profile, client, signOut, refreshProfile }),
    [status, email, userId, profile, client, signOut, refreshProfile],
  );

  return (
    <CuentaSessionContext.Provider value={value}>{children}</CuentaSessionContext.Provider>
  );
}

export function useCuentaSession(): CuentaSessionValue {
  const value = useContext(CuentaSessionContext);
  if (!value) {
    throw new Error(
      "useCuentaSession() debe usarse dentro de <CuentaSessionProvider>, que monta src/app/cuenta/layout.tsx.",
    );
  }
  return value;
}
